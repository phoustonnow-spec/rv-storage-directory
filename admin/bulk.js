// Admin bulk upload
(function () {
  "use strict";
  const form = document.getElementById("bulk-form");
  const result = document.getElementById("bulk-result");

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/^"|"$/g, ""));
    return lines.slice(1).map(line => {
      // Basic CSV parse: handle quoted values
      const vals = [];
      let cur = "", inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { inQ = !inQ; continue; }
        if (c === "," && !inQ) { vals.push(cur); cur = ""; continue; }
        cur += c;
      }
      vals.push(cur);
      const row = {};
      headers.forEach((h, i) => { row[h] = (vals[i] || "").trim(); });
      if (row.lat) row.lat = parseFloat(row.lat);
      if (row.lng) row.lng = parseFloat(row.lng);
      if (row.verified === "true") row.verified = true;
      if (row.verified === "false") row.verified = false;
      if (row.features && typeof row.features === "string") {
        row.features = row.features.split(/[|;]/).map(f => f.trim()).filter(Boolean);
      }
      return row;
    });
  }

  function show(text, kind) {
    result.hidden = false;
    result.style.background = kind === "ok" ? "#d1fae5" : "#fee2e2";
    result.style.borderLeftColor = kind === "ok" ? "#047857" : "#b91c1c";
    result.style.color = kind === "ok" ? "#064e3b" : "#7f1d1d";
    result.textContent = text;
  }

  form.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    result.hidden = true;

    const password = form.querySelector("#f-pass").value;
    const mode = form.querySelector("#f-mode").value;
    const file = form.querySelector("#f-file").files[0];
    const paste = form.querySelector("#f-paste").value.trim();

    if (!password) return show("Enter the admin password.", "err");

    let listings = [];
    try {
      if (file) {
        const text = await file.text();
        if (file.name.endsWith(".csv")) {
          listings = parseCSV(text);
        } else {
          const parsed = JSON.parse(text);
          listings = Array.isArray(parsed) ? parsed : (parsed.listings || []);
        }
      } else if (paste) {
        const parsed = JSON.parse(paste);
        listings = Array.isArray(parsed) ? parsed : (parsed.listings || []);
      } else {
        return show("Upload a file or paste JSON.", "err");
      }
    } catch (err) {
      return show("Could not parse input: " + err.message, "err");
    }

    if (!listings.length) return show("No listings found in input.", "err");

    show("Uploading " + listings.length + " listings...", "ok");

    try {
      const r = await fetch("/api/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Password": password },
        body: JSON.stringify({ listings: listings, mode: mode })
      });
      const data = await r.json();
      if (!r.ok) return show("Error: " + (data.error || r.statusText), "err");
      const msg = "Success. Accepted " + data.accepted + " / total after merge: " + data.total_after +
                  (data.errors && data.errors.length ? "\nWarnings: " + data.errors.join("; ") : "");
      show(msg, "ok");
    } catch (err) {
      show("Request failed: " + err.message, "err");
    }
  });
})();
