import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const sample = await prisma.shopProduct.findFirst({
    where: { brand: "Remus" },
    select: { slug: true, tags: true },
  });
  console.log("Sample REMUS row:", sample?.slug);
  console.log("Tags (first 20):", sample?.tags.slice(0, 20));

  // Aggregate fitment tag prefixes
  const r1 = await prisma.$queryRaw<Array<{ prefix: string; count: bigint }>>`
    SELECT substring(tag from 1 for 12) AS prefix, COUNT(*)::bigint AS count
    FROM "ShopProduct", unnest(tags) AS tag
    WHERE brand = 'Remus' AND tag LIKE 'fits%'
    GROUP BY prefix
    ORDER BY count DESC
    LIMIT 10
  `;
  console.log("\nFitment tag prefixes (REMUS):", r1);

  // Distinct makes via fits-make:
  const r2 = await prisma.$queryRaw<Array<{ slug: string; count: bigint }>>`
    SELECT slug, COUNT(*)::bigint AS count FROM (
      SELECT substring(tag from 11) AS slug
      FROM "ShopProduct", unnest(tags) AS tag
      WHERE "isPublished" = true AND status = 'ACTIVE'
        AND tag LIKE 'fits-make:%'
    ) t
    WHERE slug <> '' AND slug NOT LIKE '%:%'
    GROUP BY slug
    ORDER BY count DESC
    LIMIT 15
  `;
  console.log("\nMakes via SQL:", r2);

  // Try the EXACT same query the route handler uses (parameterized)
  const offset = 10;
  const likePattern = "fits-make:%";
  const r3 = await prisma.$queryRaw<Array<{ slug: string; count: bigint }>>`
    SELECT slug, COUNT(*)::bigint AS count FROM (
      SELECT substring(tag from ${offset + 1}) AS slug
      FROM "ShopProduct", unnest(tags) AS tag
      WHERE "isPublished" = true
        AND status = 'ACTIVE'
        AND tag LIKE ${likePattern}
    ) t
    WHERE slug <> '' AND slug NOT LIKE '%:%'
    GROUP BY slug
    ORDER BY count DESC, slug ASC
    LIMIT 10
  `;
  console.log("\nMakes via PARAMETERIZED SQL (mirrors route):", r3);

  await prisma.$disconnect();
}
main().catch(console.error);
