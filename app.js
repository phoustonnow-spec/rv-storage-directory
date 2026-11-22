// RV Storage Directory — client-side filter/search
(function () {
  "use strict";

  const state = {
    listings: [],
    regions: {},
    filters: { region: "", county: "", city: "", q: "" }
  };

  const el = {
    region: document.getElementById("filter-region"),
    county: document.getElementById("filter-county"),
    city: document.getElementById("filter-city"),
    q: document.getElementById("filter-q"),
    grid: document.getElementById("results-grid"),
    count: document.getElementById("results-count"),
    emptyState: document.getElementById("empty-state")
  };

  async function init() {
    try {
      const r = await fetch("data/listings.json");
      if (!r.ok) throw new Error("data load failed");
      const data = await r.json();
      state.listings = data.listings || [];
      state.regions = data.regions || {};
      populateFilters();
      wireEvents();
      render();
    } catch (err) {
      el.grid.innerHTML = '<p role="alert" style="padding:20px;color:#b91c1c;">Could not load listings. Please refresh.</p>';
      console.error(err);
    }
  }

  function populateFilters() {
    // Region dropdown
    Object.entries(state.regions).forEach(([key, r]) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = r.name;
      el.region.appendChild(opt);
    });
    refreshCountyOptions();
    refreshCityOptions();
  }

  function refreshCountyOptions() {
    const current = el.county.value;
    el.county.innerHTML = '<option value="">All counties</option>';
    const counties = new Set();
    state.listings
      .filter(l => !state.filters.region || l.region === state.filters.region)
      .forEach(l => l.county && counties.add(l.county));
    Array.from(counties).sort().forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      el.county.appendChild(opt);
    });
    if (counties.has(current)) el.county.value = current;
  }

  function refreshCityOptions() {
    const current = el.city.value;
    el.city.innerHTML = '<option value="">All cities</option>';
    const cities = new Set();
    state.listings
      .filter(l => !state.filters.region || l.region === state.filters.region)
      .filter(l => !state.filters.county || l.county === state.filters.county)
      .forEach(l => l.city && cities.add(l.city));
    Array.from(cities).sort().forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      el.city.appendChild(opt);
    });
    if (cities.has(current)) el.city.value = current;
  }

  function wireEvents() {
    el.region.addEventListener("change", () => {
      state.filters.region = el.region.value;
      state.filters.county = "";
      state.filters.city = "";
      refreshCountyOptions();
      refreshCityOptions();
      render();
    });
    el.county.addEventListener("change", () => {
      state.filters.county = el.county.value;
      state.filters.city = "";
      refreshCityOptions();
      render();
    });
    el.city.addEventListener("change", () => {
      state.filters.city = el.city.value;
      render();
    });
    el.q.addEventListener("input", () => {
      state.filters.q = el.q.value.trim().toLowerCase();
      render();
    });
  }

  function matches(l) {
    if (state.filters.region && l.region !== state.filters.region) return false;
    if (state.filters.county && l.county !== state.filters.county) return false;
    if (state.filters.city && l.city !== state.filters.city) return false;
    if (state.filters.q) {
      const hay = [l.name, l.city, l.county, l.address, l.description, (l.features || []).join(" ")]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(state.filters.q)) return false;
    }
    return true;
  }

  function render() {
    const filtered = state.listings.filter(matches);
    // Sort: partners first, then featured, then listed; verified before unverified
    const tierRank = { partner: 0, featured: 1, listed: 2 };
    filtered.sort((a, b) => {
      const ta = tierRank[a.tier] ?? 3;
      const tb = tierRank[b.tier] ?? 3;
      if (ta !== tb) return ta - tb;
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    el.count.innerHTML = `<strong>${filtered.length}</strong> ${filtered.length === 1 ? "facility" : "facilities"}`;
    el.grid.innerHTML = "";
    if (filtered.length === 0) {
      el.emptyState.hidden = false;
      return;
    }
    el.emptyState.hidden = true;
    const frag = document.createDocumentFragment();
    filtered.forEach(l => frag.appendChild(renderCard(l)));
    el.grid.appendChild(frag);
  }

  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function renderCard(l) {
    const art = document.createElement("article");
    art.className = `card card--${l.tier || "listed"}`;
    art.setAttribute("aria-labelledby", `h-${l.id}`);

    const badges = [];
    if (l.verified) {
      badges.push('<span class="badge badge--verified" aria-label="Verified operator">&#10004; Verified Operator</span>');
    } else {
      badges.push('<span class="badge badge--listed">Listed for Reference</span>');
    }

    const addressLine = [l.address, l.city, l.county && `${l.county} County`].filter(Boolean).join(" &middot; ");
    const features = (l.features || []).slice(0, 6)
      .map(f => `<li>${esc(f)}</li>`).join("");

    const actions = [];
    if (l.phone) actions.push(`<a class="btn-primary" href="tel:${esc(l.phone.replace(/[^0-9+]/g, ""))}">Call ${esc(l.phone)}</a>`);
    if (l.website) actions.push(`<a class="btn-secondary" href="${esc(l.website)}" target="_blank" rel="noopener">Visit site</a>`);

    art.innerHTML = `
      <div class="badge-row">${badges.join("")}</div>
      <h3 id="h-${esc(l.id)}">${esc(l.name)}</h3>
      ${addressLine ? `<p class="card-meta">${addressLine}</p>` : ""}
      ${l.description ? `<p class="card-desc">${esc(l.description)}</p>` : ""}
      ${features ? `<ul class="card-features" aria-label="Features">${features}</ul>` : ""}
      ${actions.length ? `<div class="card-actions">${actions.join("")}</div>` : ""}
    `;
    return art;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
