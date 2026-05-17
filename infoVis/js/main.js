import { map, addMarkersForArea, removeMarkersForArea,
         initAreaLayer, initDivisionLayer,
         setAreaSelected, ZOOM_THRESHOLD,
         hideLeafletLayers, showLeafletLayers,
         heatmap}               from './map.js';
import { initUI, activeButton }                                        from './ui.js';
import { buildFilterOptions, getFilterParams,
         fetchData, resetFilters }                       from './filters.js';
import { updateStats, updateAreaStats, renderTrends, renderBarChart, renderCorrelations } from './charts.js';

initUI();

const MAX_SELECTED  = 3;
let totalRecords    = 0;
let globalMetadata  = null;
let currentFilters  = {};
let showDeck = false;
let typeMap = 'heatmap';

// areaName → { data: [...], totalMatching: number }
const selectedAreas = new Map();

// ── Loading indicator ──────────────────────────────────────────────────────────

function setMapLoading(on) {
    document.getElementById('map-loading').classList.toggle('hidden', !on);
}

function setChartsLoading(on) {
    document.getElementById('charts-loading').classList.toggle('hidden', !on);
}

function setTrendsLoading(on) {
    const el = document.getElementById('trends-loading');
    if (el) el.classList.toggle('hidden', !on);
}

function setCorrelationsLoading(on) {
    const el = document.getElementById('corr-loading');
    if (el) el.classList.toggle('hidden', !on);
}

// ── Stats ──────────────────────────────────────────────────────────────────────

async function refreshStats() {
    if (selectedAreas.size === 0 || showDeck) {
        updateAreaStats(totalRecords, globalMetadata?.topCrime, globalMetadata?.topArea);
        
        // If filters are applied, fetch and show filtered data; otherwise show initial data
        let chartData = initialData;
        const hasFilters = Object.keys(currentFilters).length > 0;
        
        if (Object.keys(currentFilters).length > 0) {
            try {
                const result = await fetchData(currentFilters);
                chartData = result.data || [];
            } catch (err) {
                console.warn("Could not fetch filtered data for charts:", err);
            }
        }
         if (showDeck) {
            if (Object.keys(currentFilters).length > 0) {
                updateStats(totalRecords, totalMatching, chartData);
            } else  {
            updateStats(totalRecords, totalRecords, chartData);
        }
                  }
        
        renderTrends(chartData);
        renderBarChart(chartData);
        renderCorrelations(chartData);
        return;
    }
    
    let totalMatching = 0;
    const allData = [];
    for (const { data, totalMatching: tm } of selectedAreas.values()) {
        if (data) { allData.push(...data); totalMatching += (tm || 0); }
    }
    
    updateStats(totalRecords, totalMatching, allData);
    renderTrends(allData);
    renderBarChart(allData);
    renderCorrelations(allData);
}

// ── Region selection ───────────────────────────────────────────────────────────

async function toggleArea(areaName, center) {
    if (selectedAreas.has(areaName)) {
        // Deselect
        selectedAreas.delete(areaName);
        setAreaSelected(areaName, false);
        removeMarkersForArea(areaName);
        refreshStats();
        return;
    }

    if (selectedAreas.size >= MAX_SELECTED) {
        // Auto-deselect the oldest selected area
        const oldest = selectedAreas.keys().next().value;
        selectedAreas.delete(oldest);
        setAreaSelected(oldest, false);
        removeMarkersForArea(oldest);
    }

    // Select — reserve the slot immediately so the UI reflects selection
    selectedAreas.set(areaName, null);
    setAreaSelected(areaName, true);

    // Zoom in if we're still at overview level
    if (map.getZoom() < ZOOM_THRESHOLD)
        map.setView(center, ZOOM_THRESHOLD + 1);

    setMapLoading(true);
    try {
        const params = { ...currentFilters, area: areaName };
        const result = await fetchData(params);
        selectedAreas.set(areaName, result);
        // Yield one frame so the overlay is painted before the synchronous marker work blocks
        await new Promise(r => setTimeout(r, 0));
        addMarkersForArea(areaName, result.data);
        refreshStats();
    } catch (err) {
        console.error("Error loading area:", err);
        selectedAreas.delete(areaName);
        setAreaSelected(areaName, false);
    } finally {
        setMapLoading(false);
    }
}

async function refreshSelectedAreas() {
    if (selectedAreas.size === 0) return;
    setMapLoading(true);
    try {
        const results = await Promise.all(
            [...selectedAreas.keys()].map(name =>
                fetchData({ ...currentFilters, area: name }).then(r => ({ name, r }))
            )
        );
        await new Promise(res => setTimeout(res, 0));
        for (const { name, r } of results) {
            selectedAreas.set(name, r);
            addMarkersForArea(name, r.data);
        }
        refreshStats();
    } catch (err) {
        console.error("Error refreshing areas:", err);
    } finally {
        setMapLoading(false);
    }
}

function deselectAll() {
    for (const name of selectedAreas.keys()) {
        setAreaSelected(name, false);
        removeMarkersForArea(name);
    }
    selectedAreas.clear();
}

// ── Boot ───────────────────────────────────────────────────────────────────────

let initialData = []; // Store full dataset for initial charts

(async () => {
    try {
        setChartsLoading(true); // Show loading spinner for stats
        setTrendsLoading(true); // Show loading spinner for trends
        setCorrelationsLoading(true); // Show loading spinner for correlations
        
        const [metadata, divRes] = await Promise.all([
            fetch("/metadata").then(r => r.json()),
            fetch("/divisions"),
        ]);

        globalMetadata = metadata;
        totalRecords   = metadata.total;
        buildFilterOptions(metadata);

        if (divRes.ok) {
            initDivisionLayer(await divRes.json(), toggleArea);
        } else {
            const areasData = await fetch("/areas").then(r => r.json());
            initAreaLayer(areasData, toggleArea);
        }

        // Fetch full dataset for initial charts
        try {
            const dataRes = await fetch("/data");
            const dataJson = await dataRes.json();
            initialData = dataJson.data || [];
            
            renderTrends(initialData);
            renderBarChart(initialData);
            renderCorrelations(initialData);
        } catch (err) {
            console.warn("Could not load initial data for charts:", err);
        }

        await refreshStats();
        setChartsLoading(false); // Hide loading spinner for stats
        setTrendsLoading(false); // Hide loading spinner for trends
        setCorrelationsLoading(false); // Hide loading spinner for correlations
        setTimeout(() => map.invalidateSize(), 0);

    } catch (err) {
        console.error("Boot error:", err);
        setChartsLoading(false);
        setTrendsLoading(false);
        setCorrelationsLoading(false);
    }
})();

// ── Search Autocomplete ────────────────────────────────────────────────────────

const searchInput = document.getElementById("search-input");
const searchSuggestions = document.getElementById("search-suggestions");

searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase().trim();
    
    if (!query || query.length < 2) {
        searchSuggestions.style.display = "none";
        return;
    }

    // Collect unique suggestions from crime types and location/DR_NO from data
    const suggestions = new Map(); // key -> { text, type }
    
    // Add crime types
    if (globalMetadata?.crimeTypes) {
        globalMetadata.crimeTypes.forEach(crimeType => {
            if (crimeType.toLowerCase().includes(query)) {
                suggestions.set(crimeType, { text: crimeType, type: "Crime Type" });
            }
        });
    }
    
    // Add locations and DR_NOs from data
    initialData.forEach(d => {
        const location = (d["LOCATION"] || "").toLowerCase();
        const drNo = String(d["DR_NO"] || "").toLowerCase();
        
        if (location.includes(query)) {
            suggestions.set(location, { text: d["LOCATION"], type: "Location" });
        }
        if (drNo.includes(query) && d["DR_NO"]) {
            suggestions.set(drNo, { text: String(d["DR_NO"]), type: "DR_NO" });
        }
    });

    // Limit to top 8 suggestions
    const items = Array.from(suggestions.values()).slice(0, 8);
    
    if (items.length === 0) {
        searchSuggestions.style.display = "none";
        return;
    }
    
    // Populate dropdown
    searchSuggestions.innerHTML = items.map(item => `
        <div class="suggestion-item" data-value="${item.text}">
            ${item.text}
            <span class="suggestion-type">${item.type}</span>
        </div>
    `).join("");
    
    searchSuggestions.style.display = "block";
    
    // Add click handlers for suggestions
    searchSuggestions.querySelectorAll(".suggestion-item").forEach(item => {
        item.addEventListener("click", () => {
            searchInput.value = item.getAttribute("data-value");
            searchSuggestions.style.display = "none";
        });
    });
});

// Hide suggestions on blur
searchInput.addEventListener("blur", () => {
    setTimeout(() => {
        searchSuggestions.style.display = "none";
    }, 200); // Small delay to allow click to register
});

// Show suggestions on focus if input has text
searchInput.addEventListener("focus", () => {
    if (searchInput.value.length >= 2) {
        searchInput.dispatchEvent(new Event("input"));
    }
});

// ── Tab Switching ──────────────────────────────────────────────────────────────

// Handle tab switching to ensure charts render properly when tabs become visible
document.querySelectorAll(".panel-tab").forEach(tab => {
    tab.addEventListener("click", () => {
        const paneId = tab.getAttribute("data-pane");
        
        // If correlations tab is clicked, re-render correlations to ensure they display properly
        if (paneId === "pane-correlations") {
            // Get current chart data
            let chartData = initialData;
            if (selectedAreas.size > 0) {
                const allData = [];
                for (const { data, totalMatching: tm } of selectedAreas.values()) {
                    if (data) allData.push(...data);
                }
                chartData = allData.length > 0 ? allData : initialData;
            } else if (Object.keys(currentFilters).length > 0) {
                // If filters are applied but no areas selected, use initialData
                // (filtered data is only available during filter application)
                chartData = initialData;
            }
            
            // Re-render correlations
            renderCorrelations(chartData);
        }
    });
});

// ── Controls ───────────────────────────────────────────────────────────────────

document.getElementById("apply-filters-btn").addEventListener("click", async () => {
    currentFilters = getFilterParams();
    showDeck ? getHeatmap(typeMap) : refreshSelectedAreas();
    refreshStats(); // Update charts with new filters
});

document.getElementById("reset-filters-btn").addEventListener("click", () => {
    resetFilters();
    currentFilters = {};
    showDeck ? getHeatmap(typeMap) : deselectAll();
    refreshStats();
});

document.getElementById("search-btn").addEventListener("click", async () => {
    currentFilters = getFilterParams();
    showDeck ? getHeatmap(typeMap) : await refreshSelectedAreas();
    refreshStats(); // Update charts with new search
});

document.getElementById("search-input").addEventListener("keydown", async e => {
    if (e.key === "Enter") {
        currentFilters = getFilterParams();
        showDeck ? getHeatmap(typeMap) : await refreshSelectedAreas();
        refreshStats(); // Update charts with new search
    }
});


document.getElementById("btn-markers").addEventListener("click", async (e) => {
    showDeck = false;
    showLeafletLayers();
    await refreshSelectedAreas();
    refreshStats();
    activeButton(e);
});

document.getElementById("btn-heatmap").addEventListener("click", (e) => {
    typeMap = 'heatmap';
    getHeatmap(typeMap);
    hideLeafletLayers();
   if (!showDeck) {
        showDeck = true;
        refreshStats();
    }
    activeButton(e);

});
document.getElementById("btn-grid").addEventListener("click", (e) => {
    typeMap = 'grid';
    getHeatmap(typeMap);
    hideLeafletLayers();
   if (!showDeck) {
        showDeck = true;
        refreshStats();
    }
    activeButton(e);

});

document.getElementById("btn-scatter").addEventListener("click", (e) => {
    typeMap = 'scatterplot';
    showDeck = true;
    getHeatmap(typeMap);
    hideLeafletLayers();
   if (!showDeck) {
        showDeck = true;
        refreshStats();
    }
    activeButton(e);

});

document.getElementById("btn-hexagon").addEventListener("click", (e) => {
    typeMap = 'hexagon';
    getHeatmap(typeMap);
    hideLeafletLayers();
   if (!showDeck) {
        showDeck = true;
        refreshStats();
    }
    activeButton(e);

});

async function getHeatmap(layerType) {
    setMapLoading(true);
    try {
        await heatmap(currentFilters, layerType);

    } catch (err) {
        console.error("Error refreshing areas:", err);
    } finally {
        setMapLoading(false);
    }
}
