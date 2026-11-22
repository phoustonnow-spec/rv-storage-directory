// GET /api/listings — returns merged listings (static + bulk from Blob)
import { get, list } from "@vercel/blob";
import staticData from "../data/listings.json" with { type: "json" };

const BULK_FILENAME = "bulk-listings.json";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Cache-Control", "no-store");

  const debug = { hasToken: !!process.env.BLOB_READ_WRITE_TOKEN };
  let bulkListings = [];

  try {
    const r = await get(BULK_FILENAME, { access: "private" });
    debug.get = r ? { statusCode: r.statusCode, hasStream: !!r.stream } : null;
    if (r && r.stream) {
      const text = await new Response(r.stream).text();
      debug.getTextLen = text.length;
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) bulkListings = parsed;
    }
  } catch (e) {
    debug.getError = String((e && e.message) || e);
  }

  try {
    const r2 = await get(BULK_FILENAME, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
    debug.getWithToken = r2 ? { statusCode: r2.statusCode, hasStream: !!r2.stream } : null;
  } catch (e) {
    debug.getWithTokenError = String((e && e.message) || e);
  }

  try {
    const listed = await list({ prefix: BULK_FILENAME });
    debug.list = (listed.blobs || []).map(b => ({ pathname: b.pathname, size: b.size, hasUrl: !!b.url, hasDownloadUrl: !!b.downloadUrl }));
  } catch (e) {
    debug.listError = String((e && e.message) || e);
  }

  const staticIds = new Set(staticData.listings.map(l => l.id));
  const filteredBulk = bulkListings.filter(l => l.id && !staticIds.has(l.id));
  const merged = [...staticData.listings, ...filteredBulk];

  return res.status(200).json({
    _debug: debug,
    updated: new Date().toISOString().slice(0, 10),
    regions: staticData.regions,
    listings: merged,
    stats: {
      static: staticData.listings.length,
      bulk: filteredBulk.length,
      total: merged.length
    }
  });
}
