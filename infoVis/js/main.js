import { map, addMarkersForArea, removeMarkersForArea,
         initAreaLayer, initDivisionLayer,
         setAreaSelected, ZOOM_THRESHOLD }               from './map.js';
import { initUI }                                        from './ui.js';
import { buildFilterOptions, getFilterParams,
         fetchData, resetFilters }                       from './filters.js';
import { updateStats, updateAreaStats, renderTrends, renderBarChart } from './charts.js';

initUI();

const MAX_SELECTED  = 3;
let totalRecords    = 0;
let globalMetadata  = null;
let currentFilters  = {};

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

// ── Stats ──────────────────────────────────────────────────────────────────────

function refreshStats() {
    if (selectedAreas.size === 0) {
        updateAreaStats(totalRecords, globalMetadata?.topCrime, globalMetadata?.topArea);
        renderTrends(initialData);
        renderBarChart(initialData);
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
        } catch (err) {
            console.warn("Could not load initial data for charts:", err);
        }

        refreshStats();
        setChartsLoading(false); // Hide loading spinner for stats
        setTrendsLoading(false); // Hide loading spinner for trends
        setTimeout(() => map.invalidateSize(), 0);

    } catch (err) {
        console.error("Boot error:", err);
        setChartsLoading(false);
        setTrendsLoading(false);
    }
})();

// ── Controls ───────────────────────────────────────────────────────────────────

document.getElementById("apply-filters-btn").addEventListener("click", async () => {
    currentFilters = getFilterParams();
    await refreshSelectedAreas();
});

document.getElementById("reset-filters-btn").addEventListener("click", () => {
    resetFilters();
    currentFilters = {};
    deselectAll();
    refreshStats();
});

document.getElementById("search-btn").addEventListener("click", async () => {
    currentFilters = getFilterParams();
    await refreshSelectedAreas();
});

document.getElementById("search-input").addEventListener("keydown", async e => {
    if (e.key === "Enter") {
        currentFilters = getFilterParams();
        await refreshSelectedAreas();
    }
});
