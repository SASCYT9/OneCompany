/**
 * Discover the full Turn14 API surface for ONE item:
 *   - /items/{id}         → catalog metadata
 *   - /pricing/{id}       → price tiers (Retail/MAP/List/Jobber)
 *   - /inventory/{id}     → stock per warehouse
 *   - /media/{id}         → image/video assets
 *   - /fitment/{id}       → vehicle fit
 *
 * Picks the first row from Turn14Item (price=0) as target.
 * Dumps every top-level key + price-related fields so we can compare
 * what we currently store vs what's available.
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const API = "https://api.turn14.com/v1";

// IMPORTANT: turn14.ts captures process.env at module-load time, so we
// defer it until after dotenv.config has populated process.env. tsx in
// CJS mode forbids top-level await, so we wrap in an IIFE.
async function call(endpoint: string) {
  const { getTurn14AccessToken } = await import("../src/lib/turn14");
  const token = await getTurn14AccessToken();
  const r = await fetch(`${API}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) {
    return { ok: false, status: r.status, text: (await r.text()).slice(0, 200) };
  }
  return { ok: true, status: r.status, body: await r.json() };
}

function keysOf(obj: any): string[] {
  if (!obj || typeof obj !== "object") return [];
  return Object.keys(obj).sort();
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  // Pick a Brembo item — they're 14k of them in DB, all price=0.
  const sample = await prisma.turn14Item.findFirst({
    where: { brand: "Brembo", price: 0 },
    select: { id: true, partNumber: true, brand: true, name: true, attributes: true },
  });
  if (!sample) throw new Error("No Brembo Turn14Item with price=0 found");

  console.log("=== Target sample ===");
  console.log({
    id: sample.id,
    partNumber: sample.partNumber,
    brand: sample.brand,
    name: sample.name?.slice(0, 60),
    storedAttrKeys: keysOf(sample.attributes as any),
  });

  // Probe each endpoint
  const endpoints = [
    `/items/${sample.id}`,
    `/pricing/${sample.id}`,
    `/inventory/${sample.id}`,
    `/media/${sample.id}`,
    `/fitment/${sample.id}`,
    // also try the "items" list query to see if pricing is included there:
    `/items?part_number=${encodeURIComponent(sample.partNumber || "")}`,
  ];

  for (const ep of endpoints) {
    console.log("\n=== " + ep + " ===");
    const r = await call(ep);
    console.log("status:", r.status);
    if (!r.ok) {
      console.log("error:", (r as any).text);
      continue;
    }
    const body: any = (r as any).body;
    const data = body?.data;
    if (Array.isArray(data)) {
      console.log("isArray, length:", data.length);
      if (data.length > 0) {
        console.log("first.attributes keys:", keysOf(data[0]?.attributes));
        // pricing-related?
        const priceKeys = keysOf(data[0]?.attributes).filter((k) =>
          /price|cost|pricelist|map/i.test(k)
        );
        if (priceKeys.length) {
          console.log("price-keys:", priceKeys);
          for (const k of priceKeys)
            console.log("   " + k + " =", JSON.stringify(data[0].attributes[k]).slice(0, 300));
        }
      }
    } else {
      const attrs = data?.attributes;
      console.log("attributes keys:", keysOf(attrs));
      const priceKeys = keysOf(attrs).filter((k) => /price|cost|pricelist|map/i.test(k));
      if (priceKeys.length) {
        console.log("price-keys:", priceKeys);
        for (const k of priceKeys)
          console.log("   " + k + " =", JSON.stringify(attrs[k]).slice(0, 500));
      }
      // Special-case for pricing endpoint to show full structure
      if (ep.startsWith("/pricing/")) {
        console.log("FULL pricing.attributes:", JSON.stringify(attrs, null, 2).slice(0, 1500));
      }
      // Special-case for inventory
      if (ep.startsWith("/inventory/")) {
        console.log("FULL inventory.attributes:", JSON.stringify(attrs, null, 2).slice(0, 1500));
      }
    }
    if (body?.meta) console.log("meta:", body.meta);
    await new Promise((res) => setTimeout(res, 260));
  }
}

main()
  .catch((e) => {
    console.error("FATAL:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
