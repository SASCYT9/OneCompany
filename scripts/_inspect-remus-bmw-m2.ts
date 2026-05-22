import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

(async () => {
  const { prisma } = await import("../src/lib/prisma");

  // Count Remus + bmw + m2 candidates by tag.
  const fitsMakeBmw = await prisma.shopProduct.count({
    where: {
      brand: "Remus",
      tags: { has: "fits-make:bmw" },
    },
  });
  console.log(`Remus + fits-make:bmw       = ${fitsMakeBmw}`);

  const fitsModelBmwM2 = await prisma.shopProduct.count({
    where: {
      brand: "Remus",
      tags: { has: "fits-model:bmw:m2" },
    },
  });
  console.log(`Remus + fits-model:bmw:m2   = ${fitsModelBmwM2}`);

  // Maybe Vehicle Model in CSV is "M2 Series" or "M Series" — check what's there.
  const m2Variants = await prisma.shopProduct.findMany({
    where: {
      brand: "Remus",
      tags: { has: "fits-make:bmw" },
    },
    select: { sku: true, titleEn: true, tags: true },
    take: 5,
  });
  console.log("\nSample BMW REMUS bundles (first 5):");
  for (const r of m2Variants) {
    const fitsModelTags = (r.tags ?? []).filter((t) => t.startsWith("fits-model:"));
    const fitsTrimTags = (r.tags ?? []).filter((t) => t.startsWith("fits-trim:"));
    console.log(`  [${r.sku}] ${r.titleEn}`);
    console.log(`    fits-model: ${fitsModelTags.join(", ")}`);
    console.log(`    fits-trim:  ${fitsTrimTags.slice(0, 3).join(", ")}`);
  }

  // What distinct fits-model:bmw:* tags exist?
  const bmwModelsResult = await prisma.$queryRaw<Array<{ tag: string; cnt: bigint }>>`
    SELECT unnest(tags) AS tag, COUNT(*)::bigint AS cnt
    FROM "ShopProduct"
    WHERE brand = 'Remus'
    GROUP BY tag
    HAVING unnest(tags) LIKE 'fits-model:bmw:%'
    ORDER BY cnt DESC
    LIMIT 20
  `.catch((e) => {
    console.warn("GROUP BY HAVING form not supported on this Postgres, using subquery:", e.message);
    return [];
  });

  if (bmwModelsResult.length === 0) {
    const rows = await prisma.$queryRaw<Array<{ tag: string; cnt: bigint }>>`
      SELECT tag, COUNT(*)::bigint AS cnt FROM (
        SELECT unnest(tags) AS tag FROM "ShopProduct" WHERE brand = 'Remus'
      ) t
      WHERE tag LIKE 'fits-model:bmw:%'
      GROUP BY tag
      ORDER BY cnt DESC
      LIMIT 20
    `;
    console.log("\nDistinct fits-model:bmw:* tags in DB:");
    for (const r of rows) console.log(`  ${r.tag} = ${Number(r.cnt)}`);
  }

  await prisma.$disconnect();
})();
