function populateSelect(id, values) {
    const sel = document.getElementById(id);
    [...values].sort().forEach(v => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        sel.appendChild(opt);
    });
}

export function buildFilterOptions(data) {
    populateSelect("filter-crime-type", new Set(data.map(d => d["Crm Cd Desc"]).filter(Boolean)));
    populateSelect("filter-area",       new Set(data.map(d => d["AREA NAME"]).filter(Boolean)));
    populateSelect("filter-status",     new Set(data.map(d => d["Status Desc"]).filter(Boolean)));
}

export function applyFilters(data) {
    const crimeType = document.getElementById("filter-crime-type").value;
    const area      = document.getElementById("filter-area").value;
    const gender    = document.getElementById("filter-gender").value;
    const status    = document.getElementById("filter-status").value;
    const ageMin    = parseInt(document.getElementById("filter-age-min").value);
    const ageMax    = parseInt(document.getElementById("filter-age-max").value);
    const dateFrom  = document.getElementById("filter-date-from").value;
    const dateTo    = document.getElementById("filter-date-to").value;

    return data.filter(d => {
        if (crimeType && d["Crm Cd Desc"] !== crimeType) return false;
        if (area      && d["AREA NAME"]   !== area)      return false;
        if (gender    && d["Vict Sex"]    !== gender)    return false;
        if (status    && d["Status Desc"] !== status)    return false;

        const age = d["Vict Age"];
        if (!isNaN(ageMin) && age < ageMin) return false;
        if (!isNaN(ageMax) && age > ageMax) return false;

        // Date filtering — adjust format string to match actual DateTime OCC values
        if (dateFrom || dateTo) {
            const raw = d["DateTime OCC"];
            if (raw) {
                const date = new Date(raw);
                if (dateFrom && date < new Date(dateFrom)) return false;
                if (dateTo   && date > new Date(dateTo + "T23:59:59")) return false;
            }
        }

        return true;
    });
}

export function resetFilters() {
    ["filter-crime-type", "filter-area", "filter-gender", "filter-status"].forEach(id => {
        document.getElementById(id).value = "";
    });
    ["filter-date-from", "filter-date-to", "filter-age-min", "filter-age-max"].forEach(id => {
        document.getElementById(id).value = "";
    });
}
