export const ZOOM_THRESHOLD = 12;

// Descent code mapping
const descentMapping = {
    "A": "Other Asian",
    "B": "Black",
    "C": "Chinese",
    "D": "Cambodian",
    "F": "Filipino",
    "G": "Guamanian",
    "H": "Hispanic/Latin/Mexican",
    "I": "American Indian/Alaskan Native",
    "J": "Japanese",
    "K": "Korean",
    "L": "Laotian",
    "O": "Other",
    "P": "Pacific Islander",
    "S": "Samoan",
    "U": "Hawaiian",
    "V": "Vietnamese",
    "W": "White",
    "X": "Unknown",
    "Z": "Asian Indian"
};

export const map = L.map('map', { fullscreenControl: true, worldCopyJump: false, attributionControl: false });
L.control.attribution({ position: 'bottomleft' }).addTo(map);

L.control.locate().addTo(map);
new L.Control.Geocoder().addTo(map);
document.querySelector('.leaflet-control-geocoder-form input').placeholder = "Search address...";

const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxNativeZoom: 19, maxZoom: 25, detectRetina: true,
}).addTo(map);

const cartoPositron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://carto.com/attributions">CartoDB</a>',
    detectRetina: true,
});

const cartoPositronD = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://carto.com/attributions">CartoDB</a> contributors',
    detectRetina: true,
});

var la = [34.05, -118.25];
map.setView(la, 10);

L.control.layers(
    { "OpenStreetMap": osm, "Carto Light": cartoPositron, "Carto Dark": cartoPositronD },
    {},
    { position: 'bottomleft' }
).addTo(map);

const cluster = L.markerClusterGroup({
    singleMarkerMode: true,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: true,
    zoomToBoundsOnClick: true,
}).addTo(map);

L.easyButton({
    states: [{
    stateName: 'zoom-to-la', 
      icon: '<i class="bi bi-crosshair2"></i>',  // Bootstrap icon or emoji
      title: 'Center LA',                 // Tooltip when hovering
      onClick: function(btn, map) {
        map.setView(la, 10);
      }
    }]
  }).addTo(map);

// ── Per-area marker management ─────────────────────────────────────────────────

const markersByArea = new Map(); // areaName → L.marker[]

export function addMarkersForArea(areaName, data) {
    if (markersByArea.has(areaName))
        cluster.removeLayers(markersByArea.get(areaName));

    const markers = data
        .filter(d => d.LAT && d.LON)
        .map(d => L.marker([d.LAT, d.LON]).bindPopup(() => createPopup(d)));
    markersByArea.set(areaName, markers);
    cluster.addLayers(markers);
}

export function removeMarkersForArea(areaName) {
    if (!markersByArea.has(areaName)) return;
    cluster.removeLayers(markersByArea.get(areaName));
    markersByArea.delete(areaName);
}

export function clearAllMarkers() {
    cluster.clearLayers();
    markersByArea.clear();
}

// ── Popup ──────────────────────────────────────────────────────────────────────

function getCrimePartLabel(part) {
    if (part === 1) return "Serious Crime";
    if (part === 2) return "Less Serious Crime";
    return "Unknown";
}

function createPopup(d) {
    const extra = [d["Crm Cd 2 Desc"], d["Crm Cd 3 Desc"], d["Crm Cd 4 Desc"]]
        .filter(Boolean).map(c => `<br>&nbsp;&nbsp;+ ${c}`).join("");
    
    const descentCode = d["Vict Descent"] || "X";
    const descentLabel = descentMapping[descentCode] || "Unknown";

    return `
        <b>${d["Crm Cd Desc"] || "N/A"}</b>${extra}<br>
        <b>Date:</b> ${d["DateTime OCC"] || "N/A"}<br>
        <b>Classification:</b> ${getCrimePartLabel(d["Part 1-2"])}<br>
        <b>Status:</b> ${d["Status Desc"] || "N/A"}<br>
        <br>
        <b>Weapon:</b> ${d["Weapon Desc"] || "N/A"}<br>
        <b>Premise:</b> ${d["Premis Desc"] || "N/A"}<br>
        <br>
        <b>Victim Age:</b> ${d["Vict Age"] ?? "N/A"}<br>
        <b>Victim Sex:</b> ${d["Vict Sex"] || "N/A"}<br>
        <b>Victim Descent:</b> ${descentLabel}<br>
        <br>
        <b>Area:</b> ${d["AREA NAME"] || "N/A"}<br>
        <b>Location:</b> ${d["LOCATION"] || "N/A"}<br>
        <b>ID:</b> ${d["DR_NO"] || "-"}
    `;
}

// ── Area layer (polygon choropleth or bubble fallback) ─────────────────────────

let areaLayer  = null;
let _maxCount  = 0;
const _selected = new Set(); // selected area names
const _featureLayers = new Map(); // areaName → Leaflet layer

function lerpColor(hex1, hex2, t) {
    const parse = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
    const [r1,g1,b1] = parse(hex1);
    const [r2,g2,b2] = parse(hex2);
    const r = Math.round(r1 + (r2 - r1) * t).toString(16).padStart(2, '0');
    const g = Math.round(g1 + (g2 - g1) * t).toString(16).padStart(2, '0');
    const b = Math.round(b1 + (b2 - b1) * t).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}

function baseStyle(count) {
    const t = _maxCount > 0 ? Math.sqrt(count / _maxCount) : 0;
    return {
        fillColor:   lerpColor('#fde8ea', '#c1121f', t),
        fillOpacity: 0.65,
        color:       '#ffffff',
        weight:      2,
    };
}

function applyLayerStyle(layer, name) {
    const count = layer.feature?.properties?._count || 0;
    const style = baseStyle(count);
    if (_selected.has(name)) {
        layer.setStyle({ ...style, fillOpacity: 0, color: '#1a73e8', weight: 3 });
    } else {
        layer.setStyle(style);
    }
}

function tooltipText(name, count, isSelected) {
    const c = count.toLocaleString();
    if (isSelected) return `<b>${name}</b><br>${c} incidents<br><i>Click to deselect</i>`;
    return `<b>${name}</b><br>${c} incidents<br><i>Click to load markers</i>`;
}

export function setAreaSelected(areaName, selected) {
    if (selected) _selected.add(areaName);
    else _selected.delete(areaName);

    const layer = _featureLayers.get(areaName);
    if (!layer) return;
    applyLayerStyle(layer, areaName);

    const count = layer.feature?.properties?._count || 0;
    layer.bindTooltip(tooltipText(areaName, count, selected), { sticky: true });
}

export function initDivisionLayer(geojson, onClickArea) {
    if (areaLayer) map.removeLayer(areaLayer);
    _featureLayers.clear();

    _maxCount = geojson.features.reduce((m, f) => Math.max(m, f.properties._count || 0), 0);

    areaLayer = L.geoJSON(geojson, {
        style: feat => baseStyle(feat.properties._count || 0),
        onEachFeature(feat, layer) {
            const name  = feat.properties._areaName || "Unknown";
            const count = feat.properties._count    || 0;
            _featureLayers.set(name, layer);

            layer.bindTooltip(tooltipText(name, count, false, false), { sticky: true });
            layer.on({
                mouseover: e => {
                    if (_selected.has(name))
                        e.target.setStyle({ color: '#0a4fa6', weight: 4 });
                    else
                        e.target.setStyle({ fillOpacity: 0.85 });
                },
                mouseout:  e => applyLayerStyle(e.target, name),
                click:     () => onClickArea?.(name, layer.getBounds().getCenter()),
            });
        },
    }).addTo(map);
}

export function initAreaLayer(areas, onClickArea) {
    if (areaLayer) map.removeLayer(areaLayer);

    const maxCount = Math.max(...areas.map(a => a.count));
    const MIN_R = 14, MAX_R = 48;

    const circles = areas.map(area => {
        const t      = Math.sqrt(area.count / maxCount);
        const r      = MIN_R + (MAX_R - MIN_R) * t;
        const circle = L.circleMarker([area.lat, area.lon], {
            radius:      r,
            fillColor:   lerpColor('#fde8ea', '#c1121f', t),
            fillOpacity: 0.65,
            color:       '#c1121f',
            weight:      2,
        });
        circle.bindTooltip(
            `<b>${area.name}</b><br>${area.count.toLocaleString()} incidents<br><i>Click to load markers</i>`,
            { direction: 'top', sticky: false }
        );
        circle.on('click', () => onClickArea?.(area.name, L.latLng(area.lat, area.lon)));
        return circle;
    });

    areaLayer = L.layerGroup(circles).addTo(map);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export function getBounds() {
    const b = map.getBounds();
    return {
        minLat: b.getSouth(),
        maxLat: b.getNorth(),
        minLon: b.getWest(),
        maxLon: b.getEast(),
    };
}


// ── Deck GL ────────────────────────────────────────────────────────────────────


let deckLayer;

export async function heatmap(params = {}, layerType) {
    const qs = new URLSearchParams(params).toString();

    const res = await fetch(qs ? `/coordinates?${qs}` : "/coordinates");
    const crimes = await res.json();
    const areasData = await fetch("/divisions").then(r => r.json());

    const polygonLayer = new deck.PolygonLayer({
        id: 'divisions',
        data: areasData.features,
        getPolygon: d => d.geometry.coordinates,
        stroked: true,
        filled: false,
        getLineColor: [0, 120, 255],
        lineWidthMinPixels: 2
    });

    let newLayer;

    if (layerType === 'heatmap') {
        newLayer = new deck.HeatmapLayer({
            id: 'crime-heatmap',
            data: crimes,
            getPosition: d => [d.longitude, d.latitude],
            getWeight: d => 1,
            radiusPixels: 25,
            opacity: 0.7
        });
    } else if (layerType === 'scatterplot') {
        newLayer = new deck.ScatterplotLayer({
            id: 'crime-scatterplot',
            data: crimes,
            getPosition: d => [d.longitude, d.latitude],
            getRadius: 100,
            getFillColor: [255, 0, 0],
            radiusMinPixels: 1,
            radiusMaxPixels: 10,
            opacity: 0.8,
            pickable: true,
            async onClick(info) {

                if (!info.object) return;
    
                const crime = info.object;
    
                try {
    
                    const res = await fetch(`/coordinates/${crime.id}`);
                    const fullRecord = await res.json();
    
                    const html = createPopup(fullRecord);
    
                    // show Leaflet popup
                    L.popup()
                        .setLatLng([crime.latitude, crime.longitude])
                        .setContent(html)
                        .openOn(map);
    
                } catch (err) {
                    console.error(err);
                }
            }
        });
    } else if (layerType === 'grid') {
        newLayer = new deck.GridLayer({
            id: 'crime-grid',
            data: crimes,
            getPosition: d => [d.longitude, d.latitude],
            cellSize: 200,
            elevationScale: 4,
            elevationRange: [0, 1000],
            extruded: true,
        });
    } else if (layerType === 'hexagon') {
    newLayer = new deck.HexagonLayer({
        id: 'crime-hexagon',
        data: crimes,
        getPosition: d => [d.longitude, d.latitude],
        radius: 200,
        elevationScale: 4,
        elevationRange: [0, 1000],
        extruded: true,
        getFillColor: d => [255, 100 - d.count * 2, 0],
    });
}

    const layers = [newLayer, polygonLayer];

    if (!deckLayer) {
        deckLayer = new DeckGlLeaflet.LeafletLayer({ 
            views: [new deck.MapView({ repeat: false })],
            layers,
         });
        map.addLayer(deckLayer);
    } else {
        deckLayer.setProps({ layers });
    }
}


export function hideLeafletLayers() {
    if (map.hasLayer(cluster)) map.removeLayer(cluster);
    if (areaLayer && map.hasLayer(areaLayer)) map.removeLayer(areaLayer);
}

export function showLeafletLayers() {
    if (!map.hasLayer(cluster)) map.addLayer(cluster);
    if (areaLayer && !map.hasLayer(areaLayer)) map.addLayer(areaLayer);
    if (deckLayer) {
        deckLayer.setProps({ layers: [] });
    }
}


