
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

function getCrimePartLabel(part) {
  if (part === 1 ) return "Serious Crime";
  if (part === 2) return "Less Serious Crime";
  return "Unknown";
}

function createPopup(d) {
  return `
    <b>Main Crime:</b> ${d["Crm Cd Desc"] || "N/A"} (${d["Crm Cd"] || "-"})<br>
    <b>Date:</b> ${d["DateTime OCC"] || "N/A"}<br>
    <b>Status:</b> ${d["Status Desc"] || "N/A"} (${d["Status"] || "-"})<br>
    <b>Classification:</b> ${getCrimePartLabel(d["Part 1-2"])} (${d["Part 1-2"] || "-"})<br>
    <br>

    <b>Modus Operandi:</b> ${d["MO Desc"] || "N/A"} (${d["Mocodes"] || "-"})<br>
    <b>Weapon:</b> ${d["Weapon Desc"] || "N/A"} (${d["Weapon Used Cd"] || "-"})<br>
    <br>
    
    <b>Victim Age:</b> ${d["Vict Age"] ?? "N/A"}<br>
    <b>Victim Sex:</b> ${d["Vict Sex"] || "N/A"}<br>
    <b>Victim Descent:</b> ${d["Vict Descent Desc"] || "N/A"} (${d["Vict Descent"] || "-"})<br>
    <br>

    <b>Area:</b> ${d["AREA NAME"] || "N/A"} (${d["AREA"] || "-"})<br>
    <b>Location:</b> ${d["LOCATION"] || "N/A"}<br>
    <b>Premise:</b> ${d["Premis Desc"] || "N/A"} (${d["Premis Cd"] || "-"})<br>
    <br>

    <b>Additional Crime 2:</b> ${d["Crm Cd 2 Desc"] || "N/A"} (${d["Crm Cd 2"] || "-"})<br>
    <b>Additional Crime 3:</b> ${d["Crm Cd 3 Desc"] || "N/A"} (${d["Crm Cd 3"] || "-"})<br>
    <b>Additional Crime 4:</b> ${d["Crm Cd 4 Desc"] || "N/A"} (${d["Crm Cd 4"] || "-"})<br>
    <br>
    
    <b>ID:</b> ${d["DR_NO"] || "-"}
  `;
}


fetch("/data")
    .then(res => res.json())
    .then(data => {
        data.forEach(d => {
            if (d.LAT && d.LON) {
                const marker = L.marker([d.LAT, d.LON])
                    .bindPopup(createPopup(d));
                cluster.addLayer(marker);
            }
        });
        map.addLayer(cluster);
    })
    .catch(err => console.error("Error loading data:", err));
