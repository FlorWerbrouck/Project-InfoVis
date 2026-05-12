function populateSelect(id, values) {
    const sel = document.getElementById(id);
    values.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        sel.appendChild(opt);
    });
}

export function buildFilterOptions({ crimeTypes, statuses }) {
    populateSelect("filter-crime-type", crimeTypes);
    populateSelect("filter-status",     statuses);
}

export function getFilterParams() {
    const raw = {
        crimeType: document.getElementById("filter-crime-type").value,
        gender:    document.getElementById("filter-gender").value,
        status:    document.getElementById("filter-status").value,
        ageMin:    document.getElementById("filter-age-min").value,
        ageMax:    document.getElementById("filter-age-max").value,
        dateFrom:  document.getElementById("filter-date-from").value,
        dateTo:    document.getElementById("filter-date-to").value,
        q:         document.getElementById("search-input").value.trim(),
    };
    // Drop empty values so they don't appear in the query string
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => v));
}

export async function fetchData(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(qs ? `/data?${qs}` : "/data");
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    return res.json(); // { totalMatching, data }
}

export function resetFilters() {
    ["filter-crime-type", "filter-gender", "filter-status"].forEach(id => {
        document.getElementById(id).value = "";
    });
    ["filter-date-from", "filter-date-to", "filter-age-min", "filter-age-max",
     "search-input"].forEach(id => {
        document.getElementById(id).value = "";
    });
}
