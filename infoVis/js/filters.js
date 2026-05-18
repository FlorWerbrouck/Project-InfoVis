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

// ── Date range slider ──────────────────────────────────────────────────────────

let _sliderReset = null;

const dateToNum = str => Math.floor(new Date(str).getTime() / 86400000);
const numToDate = n   => new Date(n * 86400000).toISOString().slice(0, 10);

function fmtLabel(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function initDateSlider(minDate, maxDate) {
    const fromInput  = document.getElementById("filter-date-from");
    const toInput    = document.getElementById("filter-date-to");
    const sFrom      = document.getElementById("date-slider-from");
    const sTo        = document.getElementById("date-slider-to");
    const fill       = document.getElementById("date-slider-fill");
    const minLabel   = document.getElementById("date-slider-min-label");
    const maxLabel   = document.getElementById("date-slider-max-label");

    const minNum = dateToNum(minDate);
    const maxNum = dateToNum(maxDate);

    [sFrom, sTo].forEach(s => { s.min = minNum; s.max = maxNum; });
    sFrom.value = minNum;
    sTo.value   = maxNum;

    minLabel.textContent = fmtLabel(minDate);
    maxLabel.textContent = fmtLabel(maxDate);

    function updateFill() {
        const span = maxNum - minNum || 1;
        const l = (+sFrom.value - minNum) / span * 100;
        const r = (+sTo.value   - minNum) / span * 100;
        fill.style.left  = l + "%";
        fill.style.width = (r - l) + "%";
    }

    sFrom.addEventListener("input", () => {
        if (+sFrom.value > +sTo.value) sFrom.value = sTo.value;
        fromInput.value = +sFrom.value === minNum ? "" : numToDate(+sFrom.value);
        updateFill();
    });

    sTo.addEventListener("input", () => {
        if (+sTo.value < +sFrom.value) sTo.value = sFrom.value;
        toInput.value = +sTo.value === maxNum ? "" : numToDate(+sTo.value);
        updateFill();
    });

    // Sync date text inputs → slider
    fromInput.addEventListener("change", () => {
        const num = fromInput.value
            ? Math.max(minNum, Math.min(maxNum, dateToNum(fromInput.value)))
            : minNum;
        sFrom.value = num;
        updateFill();
    });

    toInput.addEventListener("change", () => {
        const num = toInput.value
            ? Math.max(minNum, Math.min(maxNum, dateToNum(toInput.value)))
            : maxNum;
        sTo.value = num;
        updateFill();
    });

    _sliderReset = () => {
        sFrom.value = minNum;
        sTo.value   = maxNum;
        updateFill();
    };

    updateFill();
}

export function resetFilters() {
    ["filter-crime-type", "filter-gender", "filter-status"].forEach(id => {
        document.getElementById(id).value = "";
    });
    ["filter-date-from", "filter-date-to", "filter-age-min", "filter-age-max",
     "search-input"].forEach(id => {
        document.getElementById(id).value = "";
    });
    if (_sliderReset) _sliderReset();
}
