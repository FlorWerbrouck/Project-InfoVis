import { map, addMarkersForArea, removeMarkersForArea,
         initAreaLayer, initDivisionLayer,
         setAreaSelected, ZOOM_THRESHOLD,
         hideLeafletLayers, showLeafletLayers, heatmap,
         startDrawing, stopDrawing, clearDrawnRegion,
         setAreaLayerVisible }  from './map.js';
import { initUI, setModeActive }                                       from './ui.js';
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
let currentDrawnPolygon = null; // [[lat,lon], ...] — set when a region is drawn

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

        let chartData = initialData;
        let totalMatching = 0;
        const hasActiveFilter = Object.keys(currentFilters).length > 0 || currentDrawnPolygon;

        if (hasActiveFilter) {
            try {
                const params = { ...currentFilters };
                if (currentDrawnPolygon) params.polygon = JSON.stringify(currentDrawnPolygon);
                const result = await fetchData(params);
                chartData = result.data || [];
                totalMatching = result.totalMatching;
            } catch (err) {
                console.warn("Could not fetch filtered data for charts:", err);
            }
        }

        if (showDeck) {
            updateStats(totalRecords, hasActiveFilter ? totalMatching : totalRecords, chartData);
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

// Expose refreshStats globally so it can be called from UI tab switches
window.refreshStats = refreshStats;

// ── Region selection ───────────────────────────────────────────────────────────

// Build fetch params for an area, always including the polygon filter when active
function areaParams(name) {
    const params = name === '__region__'
        ? { ...currentFilters, polygon: JSON.stringify(currentDrawnPolygon) }
        : { ...currentFilters, area: name };
    if (name !== '__region__' && currentDrawnPolygon)
        params.polygon = JSON.stringify(currentDrawnPolygon);
    return params;
}

// When polygon is active and no districts are selected, load the full polygon as markers
async function loadPolygonRegion() {
    const params = { ...currentFilters, polygon: JSON.stringify(currentDrawnPolygon) };
    const result = await fetchData(params);
    selectedAreas.set('__region__', result);
    await new Promise(r => setTimeout(r, 0));
    addMarkersForArea('__region__', result.data);
}

async function toggleArea(areaName, center) {
    if (selectedAreas.has(areaName)) {
        selectedAreas.delete(areaName);
        setAreaSelected(areaName, false);
        removeMarkersForArea(areaName);
        // If no districts remain and polygon is active, restore polygon-wide markers
        const remaining = [...selectedAreas.keys()].filter(n => n !== '__region__');
        if (remaining.length === 0 && currentDrawnPolygon) {
            setMapLoading(true);
            try { await loadPolygonRegion(); } finally { setMapLoading(false); }
        }
        refreshStats();
        return;
    }

    // Selecting a district: remove the polygon-wide markers (avoid double-counting)
    if (selectedAreas.has('__region__')) {
        removeMarkersForArea('__region__');
        selectedAreas.delete('__region__');
    }

    const regularAreas = [...selectedAreas.keys()].filter(n => n !== '__region__');
    if (regularAreas.length >= MAX_SELECTED) {
        const oldest = regularAreas[0];
        selectedAreas.delete(oldest);
        setAreaSelected(oldest, false);
        removeMarkersForArea(oldest);
    }

    selectedAreas.set(areaName, null);
    setAreaSelected(areaName, true);

    if (map.getZoom() < ZOOM_THRESHOLD)
        map.setView(center, ZOOM_THRESHOLD + 1);

    setMapLoading(true);
    try {
        const result = await fetchData(areaParams(areaName));
        selectedAreas.set(areaName, result);
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
    if (selectedAreas.size === 0) {
        // Nothing selected — if polygon is active show polygon-wide markers
        if (currentDrawnPolygon) {
            setMapLoading(true);
            try { await loadPolygonRegion(); refreshStats(); } finally { setMapLoading(false); }
        }
        return;
    }
    setMapLoading(true);
    try {
        const results = await Promise.all(
            [...selectedAreas.keys()].map(name =>
                fetchData(areaParams(name)).then(r => ({ name, r }))
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
        if (name !== '__region__') setAreaSelected(name, false);
        removeMarkersForArea(name);
    }
    selectedAreas.clear();
    currentDrawnPolygon = null;
    clearDrawnRegion();
    setAreaLayerVisible(true);
    document.getElementById("btn-draw-region").classList.remove("active");
}

// ── Boot ───────────────────────────────────────────────────────────────────────

let initialData = []; // Store full dataset for initial charts

(async () => {
    try {
        setChartsLoading(true);
        setTrendsLoading(true);
        setCorrelationsLoading(true);

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

        // Stats panel is ready immediately — no need to wait for full data
        updateAreaStats(totalRecords, globalMetadata?.topCrime, globalMetadata?.topArea);
        setChartsLoading(false);
        setTimeout(() => map.invalidateSize(), 0);

        // Load full dataset for charts in the background (non-blocking)
        fetch("/data")
            .then(r => r.json())
            .then(dataJson => {
                initialData = dataJson.data || [];
                renderTrends(initialData);
                renderBarChart(initialData);
                renderCorrelations(initialData);
            })
            .catch(err => console.warn("Could not load initial data for charts:", err))
            .finally(() => {
                setTrendsLoading(false);
                setCorrelationsLoading(false);
                // Fade out the full-page loading overlay
                const overlay = document.getElementById('app-loading');
                overlay.classList.add('fade-out');
                overlay.addEventListener('transitionend', () => overlay.classList.add('hidden'), { once: true });
            });

    } catch (err) {
        console.error("Boot error:", err);
        setChartsLoading(false);
        setTrendsLoading(false);
        setCorrelationsLoading(false);
        const overlay = document.getElementById('app-loading');
        overlay.classList.add('fade-out');
        overlay.addEventListener('transitionend', () => overlay.classList.add('hidden'), { once: true });
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


// ── Mode helpers ───────────────────────────────────────────────────────────────

function cancelDrawMode() {
    stopDrawing();
    document.getElementById("btn-draw-region").classList.remove("active");
}

function switchToMarkers() {
    cancelDrawMode();
    showDeck = false;
    showLeafletLayers();
    setAreaLayerVisible(!currentDrawnPolygon);
    setModeActive('btn-markers');
}

// ── Mode buttons ───────────────────────────────────────────────────────────────

document.getElementById("btn-markers").addEventListener("click", async () => {
    switchToMarkers();
    await refreshSelectedAreas();
    refreshStats();
});

document.getElementById("btn-heatmap").addEventListener("click", () => {
    cancelDrawMode();
    typeMap = 'heatmap';
    showDeck = true;
    getHeatmap('heatmap');
    hideLeafletLayers();
    refreshStats();
    setModeActive('btn-heatmap');
});

document.getElementById("btn-scatter").addEventListener("click", () => {
    cancelDrawMode();
    typeMap = 'scatterplot';
    showDeck = true;
    getHeatmap('scatterplot');
    hideLeafletLayers();
    refreshStats();
    setModeActive('btn-scatter');
});

// Grid and Hexagon are legacy — they piggyback on the Heatmap slot visually
document.getElementById("btn-grid").addEventListener("click", () => {
    cancelDrawMode();
    typeMap = 'grid';
    showDeck = true;
    getHeatmap('grid');
    hideLeafletLayers();
    refreshStats();
    setModeActive('btn-heatmap');
});

document.getElementById("btn-hexagon").addEventListener("click", () => {
    cancelDrawMode();
    typeMap = 'hexagon';
    showDeck = true;
    getHeatmap('hexagon');
    hideLeafletLayers();
    refreshStats();
    setModeActive('btn-heatmap');
});

// ── Draw region tool ───────────────────────────────────────────────────────────

document.getElementById("btn-draw-region").addEventListener("click", (e) => {
    if (showDeck) {
        showDeck = false;
        showLeafletLayers();
    }
    setModeActive('btn-markers');
    const drawBtn = e.currentTarget; // capture now — currentTarget is null inside async callbacks
    drawBtn.classList.add("active");
    startDrawing(async (latlngs) => {
        drawBtn.classList.remove("active");
        currentDrawnPolygon = latlngs;
        setAreaLayerVisible(false);

        // Clear any existing district selections — polygon is now the active filter
        for (const name of [...selectedAreas.keys()]) {
            if (name !== '__region__') setAreaSelected(name, false);
            removeMarkersForArea(name);
        }
        selectedAreas.clear();

        setMapLoading(true);
        try {
            if (showDeck) {
                await getHeatmap(typeMap);
            } else {
                await loadPolygonRegion();
            }
            refreshStats();
        } catch (err) {
            console.error("Error loading drawn region:", err);
        } finally {
            setMapLoading(false);
        }
    });
});

document.getElementById("btn-clear-region").addEventListener("click", () => {
    currentDrawnPolygon = null;
    stopDrawing();
    clearDrawnRegion();
    removeMarkersForArea('__region__');
    selectedAreas.delete('__region__');
    setAreaLayerVisible(true);
    document.getElementById("btn-draw-region").classList.remove("active");
    // Re-fetch any selected districts without the polygon filter
    refreshSelectedAreas();
    refreshStats();
});

async function getHeatmap(layerType) {
    setMapLoading(true);
    try {
        const params = { ...currentFilters };
        if (currentDrawnPolygon) params.polygon = JSON.stringify(currentDrawnPolygon);
        await heatmap(params, layerType);
    } catch (err) {
        console.error("Error refreshing areas:", err);
    } finally {
        setMapLoading(false);
    }
}
