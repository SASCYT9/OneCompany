import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const products = await p.shopProduct.findMany({
  where: {
    OR: [
      { brand: { equals: "brabus", mode: "insensitive" } },
      { vendor: { equals: "brabus", mode: "insensitive" } },
    ],
  },
  select: { sku: true, slug: true, image: true, gallery: true, titleEn: true },
});

let withExternal = 0,
  total = 0,
  hostCount = new Map();
const wheelRegex = /^(Y\d{2}|M\d{2}|F\d{2}|Z\d{2}|R\d{2}|ZM\d{2}|T\d{2}|G\d{2}|2E\d{2})-/i;
let wheelsWithExternal = 0,
  wheels = 0;

for (const x of products) {
  total++;
  const isWheel = wheelRegex.test(x.sku);
  if (isWheel) wheels++;
  const g = x.gallery || [];
  const externals = g.filter((u) => /^https?:\/\//.test(u) && !u.includes("vercel-storage.com"));
  if (externals.length > 0) {
    withExternal++;
    if (isWheel) wheelsWithExternal++;
    for (const u of externals) {
      try {
        const h = new URL(u).hostname;
        hostCount.set(h, (hostCount.get(h) || 0) + 1);
      } catch {}
    }
  }
}
console.log(`Total: ${total}  with external URLs in gallery: ${withExternal}`);
console.log(`Wheels (Y*/M*/F* etc): ${wheels}  of which with external: ${wheelsWithExternal}`);
console.log("External hosts:");
for (const [h, n] of [...hostCount.entries()].sort((a, b) => b[1] - a[1]))
  console.log(`  ${n.toString().padStart(4)}  ${h}`);

// Sample 5 wheel galleries
console.log("\nSample wheel galleries:");
let shown = 0;
for (const x of products) {
  if (!wheelRegex.test(x.sku)) continue;
  if (shown++ > 4) break;
  console.log(`\n  ${x.sku}: ${(x.titleEn || "").slice(0, 80)}`);
  console.log(`    image: ${x.image}`);
  for (const u of x.gallery || []) console.log(`    gal:   ${u}`);
}

await p.$disconnect();
