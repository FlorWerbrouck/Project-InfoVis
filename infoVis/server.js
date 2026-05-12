const express         = require("express");
const fs              = require("fs");
const compression     = require("compression");
const { chain }       = require("stream-chain");
const { parser }      = require("stream-json");
const { streamArray } = require("stream-json/streamers/stream-array.js");

const app = express();
app.use(compression());
app.use(express.static("."));

// ── Stream-parse data.json to avoid ERR_STRING_TOO_LONG on large files ─────────

function loadData() {
    return new Promise((resolve, reject) => {
        const records = [];
        const pipeline = chain([
            fs.createReadStream("data.json"),
            parser(),
            streamArray(),
        ]);
        pipeline.on("data",  ({ value }) => records.push(value));
        pipeline.on("end",   () => resolve(records));
        pipeline.on("error", reject);
    });
}

(async () => {

console.log("Parsing data…");
const crimeData = await loadData();
console.log(`Loaded ${crimeData.length.toLocaleString()} records. Computing aggregates…`);

// ── Single-pass aggregation at startup ────────────────────────────────────────

const byArea    = {};   // AREA NAME → { sumLat, sumLon, count }
const byCrime   = {};   // Crm Cd Desc → count
const byStatus  = {};   // Status Desc → count
const crimeSet  = new Set();
const areaSet   = new Set();
const statusSet = new Set();

for (const d of crimeData) {
    const area   = d["AREA NAME"];
    const crime  = d["Crm Cd Desc"];
    const status = d["Status Desc"];

    if (area) {
        areaSet.add(area);
        if (!byArea[area]) byArea[area] = { sumLat: 0, sumLon: 0, count: 0 };
        byArea[area].count++;
        if (d.LAT && d.LON) { byArea[area].sumLat += d.LAT; byArea[area].sumLon += d.LON; }
    }
    if (crime)  { crimeSet.add(crime);   byCrime[crime]   = (byCrime[crime]   || 0) + 1; }
    if (status) { statusSet.add(status); byStatus[status] = (byStatus[status] || 0) + 1; }
}

const topCrime = Object.entries(byCrime).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
const topArea  = Object.entries(byArea) .sort((a, b) => b[1].count - a[1].count)[0]?.[0] ?? null;

const metadata = {
    total:      crimeData.length,
    crimeTypes: [...crimeSet].sort(),
    areas:      [...areaSet].sort(),
    statuses:   [...statusSet].sort(),
    topCrime,
    topArea,
};

const areas = Object.entries(byArea).map(([name, v]) => ({
    name,
    lat:   v.sumLat / v.count,
    lon:   v.sumLon / v.count,
    count: v.count,
})).sort((a, b) => b.count - a.count);

// ── LAPD division boundaries (optional) ───────────────────────────────────────

let divisionGeoJSON = null;
try {
    const raw = JSON.parse(fs.readFileSync("lapd-divisions.geojson", "utf8"));

    // Auto-detect which GeoJSON property holds the area name by matching against
    // the known area names from the crime data
    const knownLower = new Set(Object.keys(byArea).map(n => n.toLowerCase()));
    const hits = {};
    for (const feat of raw.features) {
        for (const [k, v] of Object.entries(feat.properties || {})) {
            if (typeof v === "string" && knownLower.has(v.toLowerCase())) {
                hits[k] = (hits[k] || 0) + 1;
            }
        }
    }
    const areaProp = Object.entries(hits).sort((a, b) => b[1] - a[1])[0]?.[0];

    // Crime data uses abbreviated names for two areas; map them to the GeoJSON spellings
    const nameNorm = {
        'n hollywood': 'north hollywood',
        'west la':     'west los angeles',
    };

    // Enrich each feature with its crime count
    for (const feat of raw.features) {
        const name  = areaProp ? feat.properties[areaProp] : null;
        const match = name
            ? Object.entries(byArea).find(([k]) => {
                const kl = k.toLowerCase();
                return (nameNorm[kl] ?? kl) === name.toLowerCase();
              })
            : null;
        feat.properties._count    = match ? match[1].count : 0;
        feat.properties._areaName = match ? match[0] : (name || "Unknown");
    }

    divisionGeoJSON = raw;
    console.log(`Loaded LAPD division boundaries (matched via property "${areaProp}").`);
} catch {
    console.log("lapd-divisions.geojson not found — using centroid bubbles.");
}

console.log("Ready.");

// ── Routes ────────────────────────────────────────────────────────────────────

app.get("/metadata",   (req, res) => res.json(metadata));
app.get("/areas",      (req, res) => res.json(areas));
app.get("/divisions",  (req, res) => {
    if (!divisionGeoJSON) return res.status(404).json({ error: "Division GeoJSON not loaded" });
    res.json(divisionGeoJSON);
});

app.get("/data", (req, res) => {
    const { crimeType, area, gender, status, ageMin, ageMax,
            dateFrom, dateTo, q, minLat, maxLat, minLon, maxLon } = req.query;

    const hasBbox  = minLat !== undefined;
    const bMinLat  = hasBbox ? +minLat : 0;
    const bMaxLat  = hasBbox ? +maxLat : 0;
    const bMinLon  = hasBbox ? +minLon : 0;
    const bMaxLon  = hasBbox ? +maxLon : 0;
    const search   = q ? q.toLowerCase() : null;

    let totalMatching = 0;
    const data = [];

    for (const d of crimeData) {
        // Bounding box (required when zoomed in)
        if (hasBbox) {
            if (!d.LAT || !d.LON) continue;
            if (d.LAT < bMinLat || d.LAT > bMaxLat ||
                d.LON < bMinLon || d.LON > bMaxLon) continue;
        }

        // Attribute filters
        if (crimeType && d["Crm Cd Desc"] !== crimeType) continue;
        if (area      && d["AREA NAME"]   !== area)      continue;
        if (gender    && d["Vict Sex"]    !== gender)    continue;
        if (status    && d["Status Desc"] !== status)    continue;

        const age = d["Vict Age"];
        if (ageMin && (age == null || age < +ageMin)) continue;
        if (ageMax && (age == null || age > +ageMax)) continue;

        // DateTime OCC: "YYYY-MM-DD HH:MM:SS" — slice(0,10) gives ISO date, sorts as string
        const dt = d["DateTime OCC"];
        if (dateFrom && dt && dt.slice(0, 10) < dateFrom) continue;
        if (dateTo   && dt && dt.slice(0, 10) > dateTo)   continue;

        if (search) {
            const hit =
                String(d["DR_NO"]       || "").includes(search) ||
                (d["LOCATION"]          || "").toLowerCase().includes(search) ||
                (d["Crm Cd Desc"]       || "").toLowerCase().includes(search);
            if (!hit) continue;
        }

        totalMatching++;
        data.push(d);
    }

    res.json({ totalMatching, data });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server at http://localhost:${PORT}`));

})();
