// RV Storage Directory - client-side filter, search, map
(function () {
  "use strict";

  const state = {
    listings: [],
    regions: {},
    filters: { region: "", county: "", city: "", q: "" },
    map: null,
    markers: {},
    markerLayer: null
  };

  const el = {
    region: document.getElementById("filter-region"),
    county: document.getElementById("filter-county"),
    city: document.getElementById("filter-city"),
    q: document.getElementById("filter-q"),
    grid: document.getElementById("results-grid"),
    count: document.getElementById("results-count"),
    emptyState: document.getElementById("empty-state"),
    mapEl: document.getElementById("map")
  };

  async function init() {
    try {
      let data;
      // Try the merged API first; fall back to static if API not available
      try {
        const r = await fetch("/api/listings");
        if (r.ok) data = await r.json();
      } catch (_) { /* ignore */ }
      if (!data) {
        const r2 = await fetch("data/listings.json");
        data = await r2.json();
      }
      state.listings = data.listings || [];
      state.regions = data.regions || {};
      initMap();
      populateFilters();
      wireEvents();
      render();
    } catch (err) {
      el.grid.innerHTML = '<p role="alert" style="padding:20px;color:#b91c1c;">Could not load listings. Please refresh.</p>';
      console.error(err);
    }
  }

  function initMap() {
    if (!el.mapEl || typeof L === "undefined") return;
    state.map = L.map(el.mapEl, { scrollWheelZoom: false }).setView([34.0, -118.2], 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(state.map);
    state.markerLayer = L.layerGroup().addTo(state.map);
    // Enable scroll zoom only after user interaction
    el.mapEl.addEventListener("click", () => state.map.scrollWheelZoom.enable(), { once: true });
  }

  function refreshMap(filtered) {
    if (!state.map || !state.markerLayer) return;
    state.markerLayer.clearLayers();
    state.markers = {};
    const partnerIcon = L.divIcon({ className: "pin pin-partner", iconSize: [18, 18] });
    const verifiedIcon = L.divIcon({ className: "pin pin-verified", iconSize: [16, 16] });
    const listedIcon = L.divIcon({ className: "pin pin-listed", iconSize: [14, 14] });

    const points = [];
    filtered.forEach(l => {
      if (typeof l.lat !== "number" || typeof l.lng !== "number") return;
      const icon = l.tier === "partner" ? partnerIcon : (l.verified ? verifiedIcon : listedIcon);
      const m = L.marker([l.lat, l.lng], { icon: icon, title: l.name });
      const popup = '<strong>' + esc(l.name) + '</strong><br>' +
        (l.city ? esc(l.city) + (l.county ? ', ' + esc(l.county) : '') + '<br>' : '') +
        (l.phone ? '<a href="tel:' + esc(l.phone.replace(/[^0-9+]/g, '')) + '">' + esc(l.phone) + '</a><br>' : '') +
        (l.website ? '<a href="' + esc(l.website) + '" target="_blank" rel="noopener">Website</a>' : '');
      m.bindPopup(popup);
      m.addTo(state.markerLayer);
      state.markers[l.id] = m;
      points.push([l.lat, l.lng]);
    });
    if (points.length) {
      state.map.fitBounds(points, { padding: [40, 40], maxZoom: 11 });
    }
  }

  function focusMap(id) {
    const m = state.markers[id];
    if (!m) return;
    el.mapEl.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      state.map.setView(m.getLatLng(), 13, { animate: true });
      m.openPopup();
    }, 350);
  }

  function populateFilters() {
    Object.entries(state.regions).forEach(([key, r]) => {
      const opt = document.createElement("option");
      opt.value = key; opt.textContent = r.name;
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
      opt.value = c; opt.textContent = c;
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
      opt.value = c; opt.textContent = c;
      el.city.appendChild(opt);
    });
    if (cities.has(current)) el.city.value = current;
  }

  function wireEvents() {
    el.region.addEventListener("change", () => {
      state.filters.region = el.region.value;
      state.filters.county = ""; state.filters.city = "";
      refreshCountyOptions(); refreshCityOptions(); render();
    });
    el.county.addEventListener("change", () => {
      state.filters.county = el.county.value;
      state.filters.city = "";
      refreshCityOptions(); render();
    });
    el.city.addEventListener("change", () => {
      state.filters.city = el.city.value;
      render();
    });
    el.q.addEventListener("input", () => {
      state.filters.q = el.q.value.trim().toLowerCase();
      render();
    });
    el.grid.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-map-id]");
      if (btn) {
        ev.preventDefault();
        focusMap(btn.getAttribute("data-map-id"));
      }
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
    const tierRank = { partner: 0, featured: 1, listed: 2 };
    filtered.sort((a, b) => {
      const ta = tierRank[a.tier] ?? 3;
      const tb = tierRank[b.tier] ?? 3;
      if (ta !== tb) return ta - tb;
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    el.count.innerHTML = '<strong>' + filtered.length + '</strong> ' + (filtered.length === 1 ? 'facility' : 'facilities');
    el.grid.innerHTML = "";
    if (filtered.length === 0) { el.emptyState.hidden = false; refreshMap([]); return; }
    el.emptyState.hidden = true;
    const frag = document.createDocumentFragment();
    filtered.forEach(l => frag.appendChild(renderCard(l)));
    el.grid.appendChild(frag);
    refreshMap(filtered);
  }

  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function renderCard(l) {
    const art = document.createElement("article");
    art.className = 'card card--' + (l.tier || "listed");
    art.setAttribute("aria-labelledby", 'h-' + l.id);
    const badges = [];
    if (l.verified) badges.push('<span class="badge badge--verified" aria-label="Verified operator">&#10004; Verified Operator</span>');
    else badges.push('<span class="badge badge--listed">Listed for Reference</span>');
    const addressLine = [l.address, l.city, l.county && (l.county + ' County')].filter(Boolean).join(" &middot; ");
    const features = (l.features || []).slice(0, 6).map(f => '<li>' + esc(f) + '</li>').join("");
    const actions = [];
    if (l.phone) actions.push('<a class="btn-primary" href="tel:' + esc(l.phone.replace(/[^0-9+]/g, "")) + '">Call ' + esc(l.phone) + '</a>');
    if (l.website) actions.push('<a class="btn-secondary" href="' + esc(l.website) + '" target="_blank" rel="noopener">Visit site</a>');
    if (typeof l.lat === "number" && typeof l.lng === "number") {
      actions.push('<button type="button" class="btn-map" data-map-id="' + esc(l.id) + '">View on map</button>');
    }
    art.innerHTML = '<div class="badge-row">' + badges.join("") + '</div>' +
      '<h3 id="h-' + esc(l.id) + '">' + esc(l.name) + '</h3>' +
      (addressLine ? '<p class="card-meta">' + addressLine + '</p>' : "") +
      (l.description ? '<p class="card-desc">' + esc(l.description) + '</p>' : "") +
      (features ? '<ul class="card-features" aria-label="Features">' + features + '</ul>' : "") +
      (actions.length ? '<div class="card-actions">' + actions.join("") + '</div>' : "");
    return art;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
