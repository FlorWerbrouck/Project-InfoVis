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
let correlationCharts = {}; // Store chart instances for gender, descent, and age

// Make correlationCharts globally accessible
if (typeof window !== 'undefined') {
    window.correlationCharts = correlationCharts;
}

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

export function renderCorrelations(data) {
    if (!data || data.length === 0) {
        document.getElementById("chart-corr-gender").innerHTML = "<p style='text-align: center; color: #999;'>No data</p>";
        document.getElementById("chart-corr-descent").innerHTML = "<p style='text-align: center; color: #999;'>No data</p>";
        document.getElementById("chart-corr-age").innerHTML = "<p style='text-align: center; color: #999;'>No data</p>";
        return;
    }

    // Ensure canvases exist in placeholders
    const genderContainer = document.getElementById("chart-corr-gender");
    const descentContainer = document.getElementById("chart-corr-descent");
    const ageContainer = document.getElementById("chart-corr-age");

    if (!genderContainer.querySelector("canvas")) {
        genderContainer.innerHTML = "<canvas></canvas>";
    }
    if (!descentContainer.querySelector("canvas")) {
        descentContainer.innerHTML = "<canvas></canvas>";
    }
    if (!ageContainer.querySelector("canvas")) {
        ageContainer.innerHTML = "<canvas></canvas>";
    }

    // Aggregate data for correlations
    
    // Gender correlations
    const byGender = {};
    const genderMap = { "M": "Male", "F": "Female", "X": "Unknown" };
    data.forEach(d => {
        const gender = genderMap[d["Vict Sex"]] || "Unknown";
        byGender[gender] = (byGender[gender] || 0) + 1;
    });

    // Descent correlations
    const byDescent = {};
    data.forEach(d => {
        const descentCode = d["Vict Descent"] || "X";
        const descent = descentMapping[descentCode] || "Unknown";
        byDescent[descent] = (byDescent[descent] || 0) + 1;
    });

    // Age correlations
    const byAge = {};
    data.forEach(d => {
        const age = d["Vict Age"];
        if (age != null && age >= 0 && age <= 120) {
            byAge[age] = (byAge[age] || 0) + 1;
        }
    });

    // Render gender chart
    try {
        const genderOrder = ["Male", "Female", "Unknown"];
        const genderLabels = genderOrder.filter(g => g in byGender);
        const genderCounts = genderLabels.map(g => byGender[g]);
        const genderTotal = genderCounts.reduce((a, b) => a + b, 0);
        const genderPercentages = genderCounts.map(count => (count / genderTotal) * 100);
        renderCorrelationChart(
            "chart-corr-gender",
            genderLabels,
            genderPercentages,
            "Crimes by Victim Gender",
            "crimesGender",
            genderCounts
        );
    } catch (err) {
        console.error("Error rendering gender chart:", err);
    }

    // Render descent chart
    const descentSorted = Object.entries(byDescent)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
    
    try {
        const descentCounts = descentSorted.map(([, v]) => v);
        const descentTotal = descentCounts.reduce((a, b) => a + b, 0);
        const descentPercentages = descentCounts.map(count => (count / descentTotal) * 100);
        renderCorrelationChart(
            "chart-corr-descent",
            descentSorted.map(([k]) => k),
            descentPercentages,
            "Top Crime Descents",
            "crimesDescent",
            descentCounts
        );
    } catch (err) {
        console.error("Error rendering descent chart:", err);
    }

    // Render age chart - create age buckets
    const ageBuckets = {
        "0-10": 0,
        "10-20": 0,
        "20-30": 0,
        "30-40": 0,
        "40-50": 0,
        "50-60": 0,
        "60-70": 0,
        "70+": 0
    };
    
    data.forEach(d => {
        const age = d["Vict Age"];
        if (age != null && age >= 0) {
            if (age < 10) ageBuckets["0-10"]++;
            else if (age < 20) ageBuckets["10-20"]++;
            else if (age < 30) ageBuckets["20-30"]++;
            else if (age < 40) ageBuckets["30-40"]++;
            else if (age < 50) ageBuckets["40-50"]++;
            else if (age < 60) ageBuckets["50-60"]++;
            else if (age < 70) ageBuckets["60-70"]++;
            else ageBuckets["70+"]++;
        }
    });
    
    try {
        const ageContainer = document.getElementById("chart-corr-age");
        if (!ageContainer) {
            console.warn("Container with id 'chart-corr-age' not found");
        } else {
            let ageCanvas = ageContainer.querySelector("canvas");
            if (!ageCanvas) {
                ageContainer.innerHTML = "<canvas></canvas>";
                ageCanvas = ageContainer.querySelector("canvas");
            }
            const ageCtx = ageCanvas.getContext("2d");
            if (correlationCharts.age) {
                correlationCharts.age.destroy();
            }
            
            const ageCounts = Object.values(ageBuckets);
            const ageTotal = ageCounts.reduce((a, b) => a + b, 0);
            const agePercentages = ageCounts.map(count => ageTotal > 0 ? (count / ageTotal) * 100 : 0);
            
            correlationCharts.age = new Chart(ageCtx, {
        type: "bar",
        data: {
            labels: Object.keys(ageBuckets),
            datasets: [
                {
                    label: "Crimes per age group",
                    data: agePercentages,
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
                title: { display: true, text: "Crimes by Victim Age Group", font: { size: 14, weight: "bold" } },
                tooltip: {
                    backgroundColor: "rgba(0, 0, 0, 0.8)",
                    padding: 10,
                    titleFont: { size: 12, weight: "bold" },
                    bodyFont: { size: 11 },
                    cornerRadius: 4,
                    callbacks: {
                        label: function(context) {
                            const percentage = context.parsed.y.toFixed(2);
                            const count = ageCounts[context.dataIndex];
                            return `Percentage: ${percentage}% | Count: ${count.toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 0,
                        minRotation: 0,
                        font: { size: 10 },
                        autoSkip: false
                    },
                    title: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: { font: { size: 10 } },
                    title: { display: true, text: "Percentage (%)", font: { size: 12 } }
                }
            }
        }
            });
        }
    } catch (err) {
        console.error("Error rendering age chart:", err);
    }
}

function renderCorrelationChart(canvasId, labels, data, title, chartKey, originalCounts) {
    const container = document.getElementById(canvasId);
    if (!container) {
        console.warn(`Container with id "${canvasId}" not found`);
        return;
    }
    
    let canvas = container.querySelector("canvas");
    if (!canvas) {
        container.innerHTML = "<canvas></canvas>";
        canvas = container.querySelector("canvas");
    }
    
    const ctx = canvas.getContext("2d");
    
    if (correlationCharts[chartKey]) {
        correlationCharts[chartKey].destroy();
    }
    
    correlationCharts[chartKey] = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                {
                    label: title,
                    data: data,
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
                title: { display: true, text: title, font: { size: 14, weight: "bold" } },
                tooltip: {
                    backgroundColor: "rgba(0, 0, 0, 0.8)",
                    padding: 10,
                    titleFont: { size: 12, weight: "bold" },
                    bodyFont: { size: 11 },
                    cornerRadius: 4,
                    callbacks: {
                        label: function(context) {
                            const percentage = context.parsed.y.toFixed(2);
                            const count = originalCounts ? originalCounts[context.dataIndex] : context.parsed.y;
                            return `Percentage: ${percentage}% | Count: ${count.toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 0,
                        minRotation: 0,
                        font: { size: 8 },
                        autoSkip: false
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: { font: { size: 10 } },
                    title: { display: true, text: "Percentage (%)", font: { size: 12 } }
                }
            }
        }
    });
}
