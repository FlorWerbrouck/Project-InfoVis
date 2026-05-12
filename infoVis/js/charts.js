function topByFrequency(data, key) {
    const counts = {};
    data.forEach(d => { const v = d[key]; if (v) counts[v] = (counts[v] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
}

export function updateStats(data) {
    document.getElementById("stat-total").textContent    = data.length.toLocaleString();
    document.getElementById("stat-filtered").textContent = data.length.toLocaleString();

    const topCrime = topByFrequency(data, "Crm Cd Desc");
    const crimeEl  = document.getElementById("stat-top-crime");
    crimeEl.textContent = topCrime.length > 14 ? topCrime.slice(0, 14) + "…" : topCrime;
    crimeEl.title = topCrime;

    document.getElementById("stat-top-area").textContent = topByFrequency(data, "AREA NAME");
}

// Placeholders — implement with a charting library (e.g. Plotly, Chart.js)
export function renderBarChart(data) {}
export function renderTrends(data) {}
export function renderCorrelations(data) {}
