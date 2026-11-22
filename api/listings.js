// GET /api/listings — returns merged listings (static + bulk from Blob)
import { get } from "@vercel/blob";
import staticData from "../data/listings.json" with { type: "json" };

const BULK_FILENAME = "bulk-listings.json";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  let bulkListings = [];
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const result = await get(BULK_FILENAME, { access: "private" });
      if (result && result.stream) {
        const text = await new Response(result.stream).text();
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) bulkListings = parsed;
      }
    }
  } catch (err) {
    console.error("Blob read failed:", err);
  }

  // Dedupe by id, static wins
  const staticIds = new Set(staticData.listings.map(l => l.id));
  const filteredBulk = bulkListings.filter(l => l.id && !staticIds.has(l.id));
  const merged = [...staticData.listings, ...filteredBulk];

  return res.status(200).json({
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
