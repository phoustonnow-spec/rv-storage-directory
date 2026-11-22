// RV Storage Directory - submission form opens user's email client
(function () {
  "use strict";

  const form = document.getElementById("listing-form");
  const errorEl = document.getElementById("form-error");
  if (!form) return;

  // Destination email for submissions
  const TO_EMAIL = "phoustonnow@gmail.com";

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    errorEl.hidden = true;
    errorEl.textContent = "";

    const data = new FormData(form);
    const required = ["business", "contact", "email", "phone", "city", "county", "region"];
    const missing = required.filter(k => !(data.get(k) || "").trim());
    if (missing.length) {
      errorEl.textContent = "Please fill in: " + missing.join(", ");
      errorEl.hidden = false;
      const first = form.querySelector('[name="' + missing[0] + '"]');
      if (first) first.focus();
      return;
    }

    const features = data.getAll("features").join(", ") || "(none specified)";
    const business = data.get("business").trim();

    const lines = [
      "New facility submission",
      "",
      "Business: " + business,
      "Contact: " + data.get("contact").trim(),
      "Email: " + data.get("email").trim(),
      "Phone: " + data.get("phone").trim(),
      "",
      "Address: " + (data.get("address") || "").trim(),
      "City: " + data.get("city").trim(),
      "County: " + data.get("county").trim(),
      "ZIP: " + (data.get("zip") || "").trim(),
      "Region: " + data.get("region"),
      "",
      "Website: " + (data.get("website") || "").trim(),
      "Hours: " + (data.get("hours") || "").trim(),
      "Tier: " + (data.get("tier") || "Not specified"),
      "",
      "Features: " + features,
      "",
      "Description:",
      (data.get("description") || "").trim(),
      "",
      "--",
      "Submitted via rvstoragedirectory.com"
    ].join("\n");

    const subject = "New facility: " + business;
    const href = "mailto:" + TO_EMAIL +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(lines);

    window.location.href = href;
  });
})();
