/**
 * Audit how each brand encodes vehicle fitment in tags.
 * Goal: see which prefixes exist (car_make, fits-make, vehicle:, etc.)
 * so we can plan a backfill that makes /shop/stock vehicle filter
 * actually return results for non-REMUS brands.
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

(async () => {
  const { prisma } = await import("../src/lib/prisma");

  const brands = [
    "RaceChip",
    "Brabus",
    "Akrapovic",
    "CSF",
    "do88",
    "GiroDisc",
    "Burger Motorsports",
    "Ohlins",
    "Ilmberger Carbon",
    "ADRO",
    "Urban Automotive",
    "iPE exhaust",
  ];

  for (const b of brands) {
    const rows = await prisma.$queryRaw<Array<{ prefix: string; cnt: bigint }>>`
      SELECT split_part(tag, ':', 1) AS prefix, COUNT(*)::bigint AS cnt
      FROM "ShopProduct", unnest(tags) AS tag
      WHERE brand = ${b}
        AND "isPublished" = true
        AND status = 'ACTIVE'
        AND tag LIKE '%:%'
      GROUP BY prefix
      ORDER BY cnt DESC
      LIMIT 8
    `;
    if (rows.length === 0) continue;
    console.log(`\n[${b}]`);
    for (const r of rows) console.log(`  ${r.prefix.padEnd(20)} ${Number(r.cnt)}`);
  }

  // Show a 3-row sample of RaceChip and Brabus product tags so I can see the actual encoding.
  console.log("\n=== Sample tags ===");
  const samples = await prisma.shopProduct.findMany({
    where: { brand: { in: ["RaceChip", "Brabus", "Akrapovic"] }, isPublished: true },
    select: { brand: true, sku: true, tags: true },
    take: 6,
  });
  for (const s of samples) {
    const carTags = (s.tags ?? []).filter(
      (t) =>
        t.startsWith("car_") ||
        t.startsWith("vehicle") ||
        t.startsWith("fits") ||
        t.startsWith("make:") ||
        t.startsWith("model:")
    );
    console.log(`\n[${s.brand} | ${s.sku}] car-ish tags:`);
    console.log(`  ${carTags.slice(0, 8).join(", ") || "(none)"}`);
  }

  await prisma.$disconnect();
})();
