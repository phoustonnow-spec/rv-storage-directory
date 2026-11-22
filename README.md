# RV Storage Directory

California RV storage directory. Static site, no backend. Deployed on Vercel.

## Files

- `index.html` — browse + filter
- `about.html` — about page
- `list-your-facility.html` — tier info for operators
- `css/styles.css` — cool neutral palette, WCAG 2.1 AA
- `js/app.js` — client-side filter/search
- `data/listings.json` — the only thing to edit when adding or removing facilities

## Adding or updating listings

Edit `data/listings.json`. Each listing needs at minimum:

```
{
  "id": "unique-slug",
  "name": "Facility name",
  "tier": "listed",
  "verified": false,
  "city": "City",
  "county": "County",
  "region": "inland-empire"
}
```

Tiers: `listed`, `featured`, `partner`. Regions: `inland-empire`, `orange-county`, `los-angeles`, `san-diego`.

## Replacing placeholders with real data

From your desktop (not from a sandbox), run an Overpass query against OpenStreetMap to pull California RV storage facilities:

```
[out:json][timeout:60];
(
  node["shop"="storage_rental"](32.5,-124.5,42.0,-114.0);
  way["shop"="storage_rental"](32.5,-124.5,42.0,-114.0);
  node["amenity"="vehicle_storage"](32.5,-124.5,42.0,-114.0);
  way["amenity"="vehicle_storage"](32.5,-124.5,42.0,-114.0);
);
out center tags;
```

Convert the result into the listing schema above and merge into `data/listings.json`. Keep Circle C Storage and any claimed operators as `verified: true`; mark scraped entries `verified: false`, `tier: "listed"`.
