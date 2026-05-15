/**
 * One-off diagnostic: real product counts per brand + slug/SKU duplicates check.
 * Run: npx tsx scripts/check-product-dupes.ts
 */
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
const prisma = new PrismaClient();

async function main() {
  const counts: Array<{
    brand: string;
    total: bigint;
    unique_slugs: bigint;
    unique_skus: bigint;
  }> = await prisma.$queryRaw`
    SELECT
      LOWER(COALESCE(NULLIF(brand, ''), NULLIF(vendor, ''), '?')) AS brand,
      COUNT(*)::bigint AS total,
      COUNT(DISTINCT slug)::bigint AS unique_slugs,
      COUNT(DISTINCT NULLIF(sku, ''))::bigint AS unique_skus
    FROM "ShopProduct"
    WHERE "isPublished" = true AND "status" = 'ACTIVE'
    GROUP BY 1
    ORDER BY total DESC
    LIMIT 25;
  `;

  console.log("\n=== Реальна кількість опублікованих продуктів за брендом ===");
  console.table(
    counts.map((r) => ({
      brand: r.brand,
      total: Number(r.total),
      unique_slugs: Number(r.unique_slugs),
      unique_skus: Number(r.unique_skus),
      slug_dup: Number(r.total) - Number(r.unique_slugs),
    }))
  );

  const dupeSlug: Array<{ slug: string; n: bigint }> = await prisma.$queryRaw`
    SELECT slug, COUNT(*)::bigint AS n
    FROM "ShopProduct"
    GROUP BY slug
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 15;
  `;
  console.log("\n=== Дублікати slug (top 15) ===");
  console.log(dupeSlug.length === 0 ? "ЖОДНОГО" : dupeSlug);

  const dupeSku: Array<{ sku: string; n: bigint; brands: string }> = await prisma.$queryRaw`
    SELECT sku, COUNT(*)::bigint AS n, STRING_AGG(DISTINCT brand, ', ') AS brands
    FROM "ShopProduct"
    WHERE sku IS NOT NULL AND sku <> ''
    GROUP BY sku
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 15;
  `;
  console.log("\n=== Дублікати SKU (top 15) ===");
  console.log(dupeSku.length === 0 ? "ЖОДНОГО" : dupeSku);

  const total: Array<{ total: bigint; published: bigint }> = await prisma.$queryRaw`
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE "isPublished" = true AND status = 'ACTIVE')::bigint AS published
    FROM "ShopProduct";
  `;
  console.log("\n=== Загалом у таблиці ShopProduct ===");
  console.log(
    `всього: ${Number(total[0].total)}, опубліковано+ACTIVE: ${Number(total[0].published)}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
