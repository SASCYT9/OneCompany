/**
 * Sanity-check the /shop/stock vehicle filter for all brands.
 *
 * For each brand:
 *   1. Total products (no vehicle filter)
 *   2. Top 3 makes by `fits-make:*` tag count
 *   3. Top model under each top make
 *   4. Verify the trio Brand + Make + Model returns non-empty
 *      via the same WHERE-clause the API uses.
 *
 * Mirrors the logic in `src/app/api/shop/stock/search/route.ts:handleShopSearch`.
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

(async () => {
  const { prisma } = await import("../src/lib/prisma");

  const brands = await prisma.shopProduct.groupBy({
    by: ["brand"],
    where: { isPublished: true, status: "ACTIVE", brand: { not: null } },
    _count: true,
    orderBy: { _count: { brand: "desc" } },
  });

  console.log(`\n=== ${brands.length} brands to test ===\n`);

  for (const b of brands) {
    const brand = b.brand!;
    const totalCount = b._count;

    // Top 3 makes that this brand has fitments for.
    const makeTags = await prisma.$queryRaw<Array<{ slug: string; cnt: bigint }>>`
      SELECT slug, COUNT(*)::bigint AS cnt FROM (
        SELECT substring(tag from 11::int) AS slug
        FROM "ShopProduct", unnest(tags) AS tag
        WHERE brand = ${brand}
          AND "isPublished" = true
          AND status = 'ACTIVE'
          AND tag LIKE 'fits-make:%'
      ) t
      GROUP BY slug
      ORDER BY cnt DESC
      LIMIT 3
    `;

    console.log(`─── ${brand.padEnd(22)} total=${totalCount} ───`);
    if (makeTags.length === 0) {
      console.log(`  ⚠ NO fits-make:* tags on any product. Vehicle filter will return 0.`);
      console.log("");
      continue;
    }

    for (const m of makeTags) {
      const makeSlug = m.slug;
      const makeCount = Number(m.cnt);

      // Count what brand+make filter would return.
      const countWithMake = await prisma.shopProduct.count({
        where: {
          isPublished: true,
          status: "ACTIVE",
          brand,
          tags: { hasEvery: [`fits-make:${makeSlug}`] },
        },
      });

      // Top model under this make for this brand.
      const modelTags = await prisma.$queryRaw<Array<{ slug: string; cnt: bigint }>>`
        SELECT slug, COUNT(*)::bigint AS cnt FROM (
          SELECT substring(tag from ${("fits-model:" + makeSlug + ":").length + 1}::int) AS slug
          FROM "ShopProduct", unnest(tags) AS tag
          WHERE brand = ${brand}
            AND "isPublished" = true
            AND status = 'ACTIVE'
            AND tag LIKE ${"fits-model:" + makeSlug + ":%"}
        ) t
        WHERE slug NOT LIKE '%:%'
        GROUP BY slug
        ORDER BY cnt DESC
        LIMIT 1
      `;

      const topModel = modelTags[0];
      if (!topModel) {
        const status = countWithMake > 0 ? "✓" : "✗";
        console.log(
          `  ${status} make=${makeSlug.padEnd(14)} → make-only=${countWithMake} (no models)`
        );
        continue;
      }

      const countWithModel = await prisma.shopProduct.count({
        where: {
          isPublished: true,
          status: "ACTIVE",
          brand,
          tags: { hasEvery: [`fits-model:${makeSlug}:${topModel.slug}`] },
        },
      });

      const okMake = countWithMake > 0 ? "✓" : "✗";
      const okModel = countWithModel > 0 ? "✓" : "✗";
      console.log(
        `  ${okMake} make=${makeSlug.padEnd(14)} → ${String(countWithMake).padStart(4)} items   ${okModel} +model=${topModel.slug.padEnd(20)} → ${countWithModel} items`
      );
    }
    console.log("");
  }

  await prisma.$disconnect();
})();
