/**
 * Resync Turn14Item prices by calling Turn14's /v1/pricing/{itemId} endpoint
 * for every row where price = 0. The original bulk-load (global-sync route)
 * only walks /v1/items, which doesn't include prices — so 48,686 rows
 * landed in the DB with price = 0.
 *
 * Usage:
 *   npx tsx scripts/resync-turn14-prices.ts                   # full sync
 *   npx tsx scripts/resync-turn14-prices.ts --brand=Brembo    # one brand
 *   npx tsx scripts/resync-turn14-prices.ts --limit=100       # first 100 items
 *   npx tsx scripts/resync-turn14-prices.ts --brand=Brembo --limit=50
 *
 * Rate-limited to ~1.1 req/s (Turn14 hard limit is 5000 req/hour ≈ 1.4
 * req/s — we keep a 20% buffer to absorb retries and live admin traffic
 * sharing the same OAuth token bucket).
 *
 * Full sync at this rate ≈ 12 hours. Logs progress every 100 items.
 * Safe to interrupt and re-run — only touches rows with price = 0.
 *
 * REQUIRES: TURN14_CLIENT_ID + TURN14_CLIENT_SECRET in .env.local. These
 * are production-only secrets — to run locally, fetch them from Vercel
 * (`vercel env pull .env.local`). Otherwise: deploy this as a one-off
 * admin route or run it on a Vercel CLI shell.
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// turn14.ts and prisma capture process.env at module-load time. We MUST
// import them dynamically AFTER dotenv.config above, or CLIENT_ID/SECRET
// and DATABASE_URL will be undefined.

// 900 ms between requests = ~4,000 req/hour. Turn14's documented limit
// is 5,000 req/hour (~1.4 req/s); we sit 20% below that to leave room
// for OAuth token refresh, the live admin UI, and any retries.
//
// History: an earlier value of 260 ms (~4 req/s = 14,400 req/h) triggered
// a "you exceeded 5000 req/hour" email from Turn14 after ~30 minutes —
// we mis-read the published 5/sec figure that turned out to be hourly.
const REQ_INTERVAL_MS = 900;
let lastCallAt = 0;
async function throttle() {
  const wait = lastCallAt + REQ_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

function parseArgs() {
  const args = { brand: "", limit: 0 };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--brand=")) args.brand = arg.slice("--brand=".length);
    else if (arg.startsWith("--limit="))
      args.limit = parseInt(arg.slice("--limit=".length), 10) || 0;
  }
  return args;
}

function extractPrice(pricingResponse: any): number {
  if (!pricingResponse?.data?.attributes) return 0;
  const attrs = pricingResponse.data.attributes;
  const pricelists: Array<{ name: string; price: string }> = attrs.pricelists || [];
  // Prefer Retail; fall back to MAP; then List.
  const retail = pricelists.find((p) => p.name === "Retail");
  const map = pricelists.find((p) => p.name === "MAP");
  const list = pricelists.find((p) => p.name === "List");
  const raw = retail?.price ?? map?.price ?? list?.price ?? "0";
  return parseFloat(raw) || 0;
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { fetchTurn14ItemPricing } = await import("../src/lib/turn14");
  const args = parseArgs();
  console.log(
    `[resync-turn14] starting${args.brand ? ` brand=${args.brand}` : ""}${args.limit ? ` limit=${args.limit}` : ""}`
  );

  const where: any = { price: 0 };
  if (args.brand) where.brand = { contains: args.brand, mode: "insensitive" };

  const total = await prisma.turn14Item.count({ where });
  console.log(`[resync-turn14] candidates: ${total}`);
  if (total === 0) {
    console.log("[resync-turn14] nothing to do");
    return;
  }

  const take = args.limit && args.limit < total ? args.limit : total;
  const items = await prisma.turn14Item.findMany({
    where,
    select: { id: true, brand: true, name: true },
    take,
  });

  let updated = 0;
  let failed = 0;
  let noPriceReturned = 0;
  const startedAt = Date.now();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      await throttle();
      const pricing = await fetchTurn14ItemPricing(item.id);
      const price = extractPrice(pricing);
      if (price > 0) {
        await prisma.turn14Item.update({ where: { id: item.id }, data: { price } });
        updated++;
      } else {
        noPriceReturned++;
      }
    } catch (err) {
      failed++;
      if (failed < 5) {
        console.warn(
          `[resync-turn14] item ${item.id} (${item.brand}) failed:`,
          (err as Error).message?.slice(0, 200)
        );
      }
    }
    if ((i + 1) % 100 === 0 || i === items.length - 1) {
      const elapsed = (Date.now() - startedAt) / 1000;
      const rps = (i + 1) / elapsed;
      const remaining = items.length - (i + 1);
      const etaSec = remaining / Math.max(rps, 0.1);
      console.log(
        `[resync-turn14] ${i + 1}/${items.length} | updated=${updated} no-price=${noPriceReturned} failed=${failed} | ${rps.toFixed(1)} req/s | ETA ${(etaSec / 60).toFixed(1)}min`
      );
    }
  }

  console.log(
    `[resync-turn14] DONE — updated=${updated}, no-price=${noPriceReturned}, failed=${failed}, total=${items.length}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
