// POST /api/bulk — admin bulk upload of listings
// Requires ADMIN_PASSWORD env var and BLOB_READ_WRITE_TOKEN
import { put } from "@vercel/blob";

const BULK_FILENAME = "bulk-listings.json";
const VALID_REGIONS = new Set(["inland-empire", "orange-county", "los-angeles", "san-diego"]);
const VALID_TIERS = new Set(["listed", "featured", "partner"]);

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function normalize(row, idx) {
  const errors = [];
  if (!row || typeof row !== "object") {
    return { errors: ["row " + idx + ": not an object"] };
  }
  const name = (row.name || row.business || "").toString().trim();
  if (!name) errors.push("row " + idx + ": missing name");
  const city = (row.city || "").toString().trim();
  if (!city) errors.push("row " + idx + ": missing city");
  const region = (row.region || "").toString().trim();
  if (region && !VALID_REGIONS.has(region)) {
    errors.push("row " + idx + ": invalid region '" + region + "'");
  }
  const tier = row.tier && VALID_TIERS.has(row.tier) ? row.tier : "listed";
  const id = (row.id && String(row.id).trim()) || (slugify(name) + "-" + slugify(city));

  const listing = {
    id: id,
    name: name,
    tier: tier,
    verified: Boolean(row.verified),
    city: city,
    county: (row.county || "").toString().trim() || undefined,
    region: region || undefined,
    address: (row.address || "").toString().trim() || undefined,
    zip: (row.zip || "").toString().trim() || undefined,
    phone: (row.phone || "").toString().trim() || undefined,
    website: (row.website || "").toString().trim() || undefined,
    email: (row.email || "").toString().trim() || undefined,
    description: (row.description || "").toString().trim() || undefined,
    hours: (row.hours || "").toString().trim() || undefined,
    lat: typeof row.lat === "number" ? row.lat : (row.lat ? parseFloat(row.lat) : undefined),
    lng: typeof row.lng === "number" ? row.lng : (row.lng ? parseFloat(row.lng) : undefined),
    features: Array.isArray(row.features) ? row.features.map(f => String(f).trim()).filter(Boolean) :
              (typeof row.features === "string" ? row.features.split(/[,;|]/).map(f => f.trim()).filter(Boolean) : undefined)
  };

  // Strip undefined
  Object.keys(listing).forEach(k => { if (listing[k] === undefined || listing[k] === "") delete listing[k]; });

  return { listing: errors.length ? null : listing, errors };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  try { return JSON.parse(raw); } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminPass = process.env.ADMIN_PASSWORD;
  if (!adminPass) {
    return res.status(500).json({ error: "Admin password not configured on server" });
  }
  const sent = req.headers["x-admin-password"];
  if (sent !== adminPass) {
    return res.status(401).json({ error: "Invalid admin password" });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: "Vercel Blob not configured. Enable Blob storage in Vercel dashboard." });
  }

  const body = await readBody(req);
  if (!body) return res.status(400).json({ error: "Invalid JSON body" });

  const rows = Array.isArray(body) ? body : (Array.isArray(body.listings) ? body.listings : null);
  if (!rows) return res.status(400).json({ error: "Expected an array or { listings: [...] }" });

  const mode = (body && body.mode) || "merge"; // "merge" or "replace"

  const errors = [];
  const valid = [];
  rows.forEach((row, idx) => {
    const result = normalize(row, idx);
    if (result.errors.length) errors.push(...result.errors);
    else if (result.listing) valid.push(result.listing);
  });

  if (!valid.length) {
    return res.status(400).json({ error: "No valid rows", details: errors });
  }

  // Load existing bulk if merging
  let final = valid;
  if (mode === "merge") {
    try {
      const existing = await fetch("https://" + req.headers.host + "/api/listings");
      if (existing.ok) {
        const data = await existing.json();
        const existingBulk = (data.listings || []).filter(l => !l.id.startsWith("placeholder-") && l.id !== "circle-c-storage");
        // Static listings already in listings.json are excluded by the GET endpoint's dedupe
        const incomingIds = new Set(valid.map(l => l.id));
        const kept = existingBulk.filter(l => !incomingIds.has(l.id));
        final = [...kept, ...valid];
      }
    } catch (err) {
      console.error("Merge read failed, proceeding with upload only:", err);
    }
  }

  try {
    const blob = await put(BULK_FILENAME, JSON.stringify(final), {
      access: "public",
      contentType: "application/json",
      allowOverwrite: true
    });
    return res.status(200).json({
      ok: true,
      mode: mode,
      accepted: valid.length,
      total_after: final.length,
      errors: errors,
      url: blob.url
    });
  } catch (err) {
    return res.status(500).json({ error: "Blob write failed: " + (err.message || String(err)) });
  }
}
