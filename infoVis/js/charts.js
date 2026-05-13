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

// ── Trends Chart (crimes over time) ───────────────────────────────────────────

let trendsChart = null;

export function renderTrends(data) {
    const container = document.getElementById("chart-trends");
    
    if (!data || data.length === 0) {
        container.innerHTML = "<p style='text-align: center; color: #999; padding: 20px;'>No data to display</p>";
        return;
    }

    // Aggregate crimes by month
    const byMonth = {};
    data.forEach(d => {
        const date = d["DateTime OCC"]?.slice(0, 7); // Extract YYYY-MM
        if (date) {
            byMonth[date] = (byMonth[date] || 0) + 1;
        }
    });

    // Sort by month and prepare chart data
    const sortedMonths = Object.keys(byMonth).sort();
    const counts = sortedMonths.map(month => byMonth[month]);

    // Extract years for X-axis labels (show year only when it changes)
    const labels = sortedMonths.map((month, index) => {
        const year = month.slice(0, 4);
        const prevYear = index > 0 ? sortedMonths[index - 1].slice(0, 4) : null;
        return year !== prevYear ? year : "";
    });

    // Ensure container has a canvas
    if (!container.querySelector("canvas")) {
        container.innerHTML = "<canvas></canvas>";
    }

    const ctx = container.querySelector("canvas").getContext("2d");

    // Destroy existing chart if any
    if (trendsChart) {
        trendsChart.destroy();
    }

    trendsChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Crimes per month",
                    data: counts,
                    borderColor: "#e74c3c",
                    backgroundColor: "rgba(231, 76, 60, 0.15)",
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: "#e74c3c",
                    pointBorderColor: "#fff",
                    pointBorderWidth: 2,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: true, text: "Crimes per Month", font: { size: 16, weight: "bold" } },
                tooltip: {
                    backgroundColor: "rgba(0, 0, 0, 0.8)",
                    padding: 12,
                    titleFont: { size: 14, weight: "bold" },
                    bodyFont: { size: 13 },
                    cornerRadius: 4,
                    callbacks: {
                        title: function(context) {
                            return "Month: " + sortedMonths[context[0].dataIndex];
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: "Date", font: { size: 12 } },
                    ticks: {
                        maxRotation: 0,
                        minRotation: 0,
                        font: { size: 11 }
                    }
                },
                y: {
                    title: { display: true, text: "Number of Crimes", font: { size: 12 } },
                    beginAtZero: true,
                    ticks: { font: { size: 11 } }
                }
            }
        }
    });
}

// ── Bar Chart (crime type breakdown) ──────────────────────────────────────────

let barChart = null;

export function renderBarChart(data) {
    const container = document.getElementById("chart-bar");
    
    if (!data || data.length === 0) {
        container.innerHTML = "<p style='text-align: center; color: #999; padding: 20px;'>No data to display</p>";
        return;
    }

    // Aggregate crimes by type
    const byCrime = {};
    data.forEach(d => {
        const crime = d["Crm Cd Desc"];
        if (crime) {
            byCrime[crime] = (byCrime[crime] || 0) + 1;
        }
    });

    // Sort by frequency descending and take top 10
    const sorted = Object.entries(byCrime)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const crimes = sorted.map(([name]) => name);
    const counts = sorted.map(([, count]) => count);
    
    // Truncate labels for display (max 30 chars)
    const labels = crimes.map(crime => crime.length > 30 ? crime.slice(0, 27) + "…" : crime);

    // Ensure container has a canvas
    if (!container.querySelector("canvas")) {
        container.innerHTML = "<canvas></canvas>";
    }

    const ctx = container.querySelector("canvas").getContext("2d");

    // Destroy existing chart if any
    if (barChart) {
        barChart.destroy();
    }

    barChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Number of crimes",
                    data: counts,
                    backgroundColor: "#e74c3c",
                    borderColor: "#c0392b",
                    borderWidth: 1,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: true, text: "Top 10 Crime Types", font: { size: 16, weight: "bold" } },
                tooltip: {
                    backgroundColor: "rgba(0, 0, 0, 0.8)",
                    padding: 12,
                    titleFont: { size: 14, weight: "bold" },
                    bodyFont: { size: 13 },
                    cornerRadius: 4,
                    callbacks: {
                        title: function(context) {
                            return crimes[context[0].dataIndex];
                        },
                        label: function(context) {
                            return "Crimes: " + context.parsed.y.toLocaleString();
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0,
                        font: { size: 9 }
                    }
                },
                y: {
                    title: { display: true, text: "Number of Crimes", font: { size: 12 } },
                    beginAtZero: true,
                    ticks: { font: { size: 11 } }
                }
            }
        }
    });
}

// Placeholders — implement with a charting library (e.g. Plotly, Chart.js)
export function renderCorrelations(data) {}
