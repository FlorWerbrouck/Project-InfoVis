
const map = L.map('map', { continuousWorld: false, attributionControl: false });
L.control.attribution({
    position: 'bottomleft'
}).addTo(map);

var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxNativeZoom: 19,
    maxZoom: 25,
}).addTo(map);
var cartoPositron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://carto.com/attributions">CartoDB</a>'
});

var cartoPositronD = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://carto.com/attributions">CartoDB</a> contributors'
});

map.setView([34.05, -118.25], 11);
L.control.layers({
    "OpenStreetMap": osm,
    "cartoLightMatter": cartoPositron,
    "cartoDarkMatter": cartoPositronD,
},
    {},
    {
        position: 'bottomleft'
    }).addTo(map);

const cluster = L.markerClusterGroup({
    chunkedLoading: true,
    singleMarkerMode: true,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: true,
    zoomToBoundsOnClick: true,
});


fetch("/data")
    .then(res => res.json())
    .then(data => {
        data.forEach(d => {
            if (d.LAT && d.LON) {
                const marker = L.marker([d.LAT, d.LON])
                    .bindPopup(`<b>${d["Crm Cd Desc"]}</b><br>${d["DateTime OCC"]}<br>${d["AREA NAME"]}`);
                cluster.addLayer(marker);
            }
        });
        map.addLayer(cluster);
    })
    .catch(err => console.error("Error loading data:", err));
