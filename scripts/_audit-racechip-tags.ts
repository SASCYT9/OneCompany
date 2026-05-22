import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

(async () => {
  const { prisma } = await import("../src/lib/prisma");

  // Distinct car_make: values for RaceChip
  const makes = await prisma.$queryRaw<Array<{ tag: string; cnt: bigint }>>`
    SELECT tag, COUNT(*)::bigint AS cnt FROM (
      SELECT unnest(tags) AS tag FROM "ShopProduct"
      WHERE brand = 'RaceChip' AND "isPublished" = true
    ) t
    WHERE tag LIKE 'car_make:%'
    GROUP BY tag
    ORDER BY cnt DESC
    LIMIT 15
  `;
  console.log("=== RaceChip car_make: values ===");
  for (const m of makes) console.log(`  ${m.tag.padEnd(35)} ${Number(m.cnt)}`);

  // Distinct car_model: values for RaceChip
  const models = await prisma.$queryRaw<Array<{ tag: string; cnt: bigint }>>`
    SELECT tag, COUNT(*)::bigint AS cnt FROM (
      SELECT unnest(tags) AS tag FROM "ShopProduct"
      WHERE brand = 'RaceChip' AND "isPublished" = true
    ) t
    WHERE tag LIKE 'car_model:%'
    GROUP BY tag
    ORDER BY cnt DESC
    LIMIT 10
  `;
  console.log("\n=== RaceChip car_model: top 10 ===");
  for (const m of models) console.log(`  ${m.tag.padEnd(45)} ${Number(m.cnt)}`);

  // Same for GiroDisc
  const giroMakes = await prisma.$queryRaw<Array<{ tag: string; cnt: bigint }>>`
    SELECT tag, COUNT(*)::bigint AS cnt FROM (
      SELECT unnest(tags) AS tag FROM "ShopProduct"
      WHERE brand = 'GiroDisc' AND "isPublished" = true
    ) t
    WHERE tag LIKE 'car_make:%'
    GROUP BY tag
    ORDER BY cnt DESC
    LIMIT 10
  `;
  console.log("\n=== GiroDisc car_make: ===");
  for (const m of giroMakes) console.log(`  ${m.tag.padEnd(35)} ${Number(m.cnt)}`);

  // Burger uses chassis:, model:, engine: without `car_` prefix
  const burgerChassis = await prisma.$queryRaw<Array<{ tag: string; cnt: bigint }>>`
    SELECT tag, COUNT(*)::bigint AS cnt FROM (
      SELECT unnest(tags) AS tag FROM "ShopProduct"
      WHERE brand = 'Burger Motorsports' AND "isPublished" = true
    ) t
    WHERE tag LIKE 'chassis:%' OR tag LIKE 'model:%' OR tag LIKE 'engine:%'
    GROUP BY tag
    ORDER BY cnt DESC
    LIMIT 10
  `;
  console.log("\n=== Burger chassis/model/engine: ===");
  for (const m of burgerChassis) console.log(`  ${m.tag.padEnd(45)} ${Number(m.cnt)}`);

  await prisma.$disconnect();
})();
