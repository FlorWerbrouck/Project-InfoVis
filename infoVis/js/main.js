import { map, addMarkers }                      from './map.js';
import { initUI }                               from './ui.js';
import { buildFilterOptions, applyFilters,
         resetFilters }                         from './filters.js';
import { updateStats }                          from './charts.js';

initUI();

let allData = [];

fetch("/data")
    .then(res => res.json())
    .then(data => {
        allData = data;
        addMarkers(allData);
        updateStats(allData);
        buildFilterOptions(allData);
        document.getElementById("loading-overlay").style.display = "none";
        // Force Leaflet to re-render after the overlay is removed from view
        setTimeout(() => map.invalidateSize(), 0);
    })
    .catch(err => {
        console.error("Error loading data:", err);
        document.querySelector("#loading-overlay p").textContent =
            `Failed to load data: ${err.message}`;
    });

document.getElementById("apply-filters-btn").addEventListener("click", () => {
    const filtered = applyFilters(allData);
    addMarkers(filtered);
    updateStats(filtered);
});

document.getElementById("reset-filters-btn").addEventListener("click", () => {
    resetFilters();
    addMarkers(allData);
    updateStats(allData);
});

document.getElementById("search-btn").addEventListener("click", () => {
    const query = document.getElementById("search-input").value.trim().toLowerCase();
    if (!query) return;
    const filtered = allData.filter(d =>
        String(d["DR_NO"]      || "").toLowerCase().includes(query) ||
        String(d["LOCATION"]   || "").toLowerCase().includes(query) ||
        String(d["Crm Cd Desc"]|| "").toLowerCase().includes(query)
    );
    addMarkers(filtered);
    updateStats(filtered);
});
