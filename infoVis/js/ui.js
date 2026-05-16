import { map } from './map.js';

export function initUI() {
    initSidebar();
    initPanelTabs();
    initPanelCollapse();
}

function initSidebar() {
    document.getElementById("sidebar-toggle-btn").addEventListener("click", () => {
        document.getElementById("sidebar").classList.toggle("collapsed");
        setTimeout(() => map.invalidateSize(), 220);
    });

    document.querySelectorAll(".sb-section-hdr").forEach(hdr => {
        hdr.addEventListener("click", () => {
            hdr.classList.toggle("open");
            document.getElementById(hdr.dataset.target).classList.toggle("hidden");
        });
    });
}

function initPanelTabs() {
    document.querySelectorAll(".panel-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            if (!tab.dataset.pane) return;
            document.querySelectorAll(".panel-tab").forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".panel-pane").forEach(p => p.classList.remove("active"));
            tab.classList.add("active");
            document.getElementById(tab.dataset.pane).classList.add("active");
            // Expand panel if it was collapsed
            document.getElementById("bottom-panel").classList.remove("collapsed");
            document.getElementById("panel-collapse-btn").textContent = "▼";
        });
    });
}

function initPanelCollapse() {
    const panel = document.getElementById("bottom-panel");
    const btn   = document.getElementById("panel-collapse-btn");
    btn.addEventListener("click", () => {
        const collapsed = panel.classList.toggle("collapsed");
        btn.textContent = collapsed ? "▲" : "▼";
        map.invalidateSize();
    });
}

export function activeButton(e) {
    document.querySelectorAll(".map-ctrl-btn").forEach(btn => {
        btn.classList.remove("active");
    });

    e.currentTarget.classList.add("active");

}
