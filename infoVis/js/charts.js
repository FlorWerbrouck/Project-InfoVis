function topByFrequency(data, key) {
    const counts = {};
    data.forEach(d => { const v = d[key]; if (v) counts[v] = (counts[v] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
}

function setTopCrime(value) {
    const el = document.getElementById("stat-top-crime");
    el.textContent = value.length > 14 ? value.slice(0, 14) + "…" : value;
    el.title = value;
}

// Called when zoomed in and individual records are loaded
// totalRecords : full DB size
// totalMatching: records passing current filters (from server)
// data         : capped subset actually shown on the map
export function updateStats(totalRecords, totalMatching, data) {
    document.getElementById("stat-total").textContent = totalRecords.toLocaleString();

    const shownEl = document.getElementById("stat-filtered");
    if (data.length < totalMatching) {
        shownEl.textContent = `${data.length.toLocaleString()} / ${totalMatching.toLocaleString()}`;
        shownEl.title = `Showing ${data.length.toLocaleString()} of ${totalMatching.toLocaleString()} matching`;
    } else {
        shownEl.textContent = totalMatching.toLocaleString();
        shownEl.title = "";
    }

    setTopCrime(topByFrequency(data, "Crm Cd Desc"));
    document.getElementById("stat-top-area").textContent = topByFrequency(data, "AREA NAME");
}

// Called when in the area overview (low zoom) — uses pre-computed server values
export function updateAreaStats(totalRecords, topCrime, topArea) {
    document.getElementById("stat-total").textContent    = totalRecords.toLocaleString();
    document.getElementById("stat-filtered").textContent = "—";
    document.getElementById("stat-filtered").title       = "Zoom in to see filtered counts";
    setTopCrime(topCrime ?? "—");
    document.getElementById("stat-top-area").textContent = topArea ?? "—";
}

// Placeholders — implement with a charting library (e.g. Plotly, Chart.js)
export function renderBarChart(data) {}
export function renderTrends(data) {}
export function renderCorrelations(data) {}
