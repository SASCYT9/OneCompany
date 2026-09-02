import { PrismaClient } from "@prisma/client";

import { adminProductInclude } from "../src/lib/shopAdminCatalog";
import { buildShopCatalogProjectionSourceFromAdminRecord } from "../src/lib/shopCatalogAdminSnapshot.server";
import { buildShopCatalogProjection } from "../src/lib/shopCatalogProjection.server";
import { planShopCatalogProjectionPersistence } from "../src/lib/shopCatalogProjectionPersistence.server";
import { projectionSourceFromRevision } from "../src/lib/shopCatalogProjectionSource.server";

const PAGE_SIZE = 50;

function assertAuthorized() {
  if (!process.argv.includes("--commit")) {
    throw new Error("Projection backfill is write-only; pass --commit explicitly");
  }
  if (process.env.CATALOG_V2_PRODUCTION_PROJECTION_ACK !== "1") {
    throw new Error("Set CATALOG_V2_PRODUCTION_PROJECTION_ACK=1 to authorize the production projection backfill");
  }
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const url = new URL(databaseUrl);
  if (url.hostname !== "db.prisma.io" || url.pathname !== "/postgres") {
    throw new Error("Projection backfill target must be the approved Prisma production database");
  }
}

async function main() {
  assertAuthorized();
  const brand = process.argv.find((argument) => argument.startsWith("--brand="))?.slice("--brand=".length).trim() || null;
  const force = process.argv.includes("--force");
  const fromRevisions = process.argv.includes("--from-revisions");
  const client = new PrismaClient();
  let afterId: string | undefined;
  let processed = 0;
  let applied = 0;

  try {
    if (!process.argv.includes("--resume")) {
      await client.$transaction(async (tx) => {
        await tx.shopCatalogProjectionConstraint.deleteMany();
        await tx.shopCatalogProjectionClause.deleteMany();
        await tx.shopCatalogProjectionPolicy.deleteMany();
        await tx.shopCatalogProjectionSku.deleteMany();
        await tx.shopCatalogProjection.deleteMany();
        await tx.shopCatalogProjectionFacetCount.deleteMany();
      });
    }

    while (!process.argv.includes("--facets-only")) {
      const products = await client.shopProduct.findMany({
        where: { isPublished: true, status: "ACTIVE", ...(brand ? { brand } : {}) },
        orderBy: { id: "asc" },
        take: PAGE_SIZE,
        ...(afterId ? { cursor: { id: afterId }, skip: 1 } : {}),
        include: adminProductInclude,
      });
      if (!products.length) break;

      const existing = await client.shopCatalogProjection.findMany({
        where: { locale: "ua", productId: { in: products.map((product) => product.id) } },
        select: { productId: true },
      });
      const existingIds = new Set(existing.map((row) => row.productId));
      const pendingProducts = force ? products : products.filter((product) => !existingIds.has(product.id));

      const revisions = fromRevisions && pendingProducts.length ? await client.shopCatalogProductRevision.findMany({
        where: { productId: { in: pendingProducts.map((product) => product.id) } },
        select: { id: true, productId: true, version: true, contentHash: true, createdAt: true, snapshot: true },
      }) : [];
      const currentRevisionByProduct = new Map(revisions
        .filter((revision) => pendingProducts.some((product) => product.id === revision.productId && product.catalogVersion === revision.version))
        .map((revision) => [revision.productId, revision]));
      if (fromRevisions && currentRevisionByProduct.size !== pendingProducts.length) throw new Error("Current immutable revision is missing for projection backfill");

      const variantToProduct = new Map(
        pendingProducts.flatMap((product) => product.variants.map((variant) => [variant.id, product.id] as const))
      );
      const inventoryCounts = new Map<string, number>();
      if (variantToProduct.size) {
        const grouped = await client.shopInventoryLevel.groupBy({
          by: ["variantId"],
          where: { variantId: { in: [...variantToProduct.keys()] } },
          _count: { _all: true },
        });
        for (const row of grouped) {
          const productId = variantToProduct.get(row.variantId);
          if (productId) inventoryCounts.set(productId, (inventoryCounts.get(productId) ?? 0) + row._count._all);
        }
      }

      const plans = pendingProducts.map((product) => {
        const revision = currentRevisionByProduct.get(product.id);
        const source = revision ? projectionSourceFromRevision({
          productId: product.id, catalogVersion: product.catalogVersion, revisionId: revision.id,
          revisionVersion: revision.version, contentHash: revision.contentHash, createdAt: revision.createdAt, snapshot: revision.snapshot,
        }) : buildShopCatalogProjectionSourceFromAdminRecord(product, product.catalogVersion.toString(), inventoryCounts.get(product.id) ?? 0);
        return planShopCatalogProjectionPersistence([], buildShopCatalogProjection(source));
      });
      await client.$transaction(async (tx) => {
        if (force && pendingProducts.length) {
          const productIds = pendingProducts.map((product) => product.id);
          await tx.shopCatalogProjectionConstraint.deleteMany({ where: { productId: { in: productIds } } });
          await tx.shopCatalogProjectionClause.deleteMany({ where: { productId: { in: productIds } } });
          await tx.shopCatalogProjectionPolicy.deleteMany({ where: { productId: { in: productIds } } });
          await tx.shopCatalogProjectionSku.deleteMany({ where: { productId: { in: productIds } } });
          await tx.shopCatalogProjection.deleteMany({ where: { productId: { in: productIds } } });
        }
        const projectionRows = plans.flatMap((plan) => plan.projectionRows);
        const skuRows = plans.flatMap((plan) => plan.skuRows);
        const policyRows = plans.flatMap((plan) => plan.policyRows);
        const clauseRows = plans.flatMap((plan) => plan.clauseRows);
        const constraintRows = plans.flatMap((plan) => plan.constraintRows);
        if (projectionRows.length) await tx.shopCatalogProjection.createMany({ data: projectionRows as never[], skipDuplicates: true });
        if (skuRows.length) await tx.shopCatalogProjectionSku.createMany({ data: skuRows as never[], skipDuplicates: true });
        if (policyRows.length) await tx.shopCatalogProjectionPolicy.createMany({ data: policyRows as never[], skipDuplicates: true });
        if (clauseRows.length) await tx.shopCatalogProjectionClause.createMany({ data: clauseRows as never[], skipDuplicates: true });
        if (constraintRows.length) await tx.shopCatalogProjectionConstraint.createMany({ data: constraintRows as never[], skipDuplicates: true });
      });
      processed += products.length;
      applied += pendingProducts.length;
      afterId = products.at(-1)!.id;
      process.stdout.write(`[catalog-v2-production-projection] ${processed} applied=${applied}\n`);
    }

    await client.shopCatalogProjectionFacetCount.deleteMany();
    await client.$executeRawUnsafe(`
      INSERT INTO "ShopCatalogProjectionFacetCount"
        ("locale", "dimension", "prefixKey", "valueKey", "valueLabel", "productCount", "updatedAt")
      SELECT "locale", 'BRAND', prefix, "brandKey", max("brandLabel"), count(*)::int, now()
      FROM "ShopCatalogProjection"
      CROSS JOIN LATERAL (VALUES (''), ('scope:' || "scopeKey")) AS prefixes(prefix)
      WHERE "isPublished" = true AND "statusKey" = 'ACTIVE' AND "brandKey" <> ''
      GROUP BY "locale", prefix, "brandKey"
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO "ShopCatalogProjectionFacetCount"
        ("locale", "dimension", "prefixKey", "valueKey", "valueLabel", "productCount", "updatedAt")
      SELECT projection."locale", 'MAKE', prefix, lower(c."textValue"), max(c."textValue"),
             count(DISTINCT projection."productId")::int, now()
      FROM "ShopCatalogProjection" projection
      JOIN "ShopCatalogProjectionConstraint" c
        ON c."productId" = projection."productId"
       AND c."dimension" = 'MAKE'
       AND c."state" = 'EXACT'
       AND c."textValue" IS NOT NULL
      JOIN "ShopCatalogProjectionClause" cl
        ON cl."targetKey" = c."targetKey"
       AND cl."clauseKey" = c."clauseKey"
      CROSS JOIN LATERAL (
        VALUES ('brand:' || lower(projection."brandKey")),
               ('scope:' || projection."scopeKey" || '|brand:' || lower(projection."brandKey"))
      ) AS prefixes(prefix)
      WHERE projection."isPublished" = true AND projection."statusKey" = 'ACTIVE'
      GROUP BY projection."locale", prefix, lower(c."textValue")
    `);

    const [publishedProducts, uaProjections, enProjections] = await Promise.all([
      client.shopProduct.count({ where: { isPublished: true, status: "ACTIVE" } }),
      client.shopCatalogProjection.count({ where: { locale: "ua", isPublished: true, statusKey: "ACTIVE" } }),
      client.shopCatalogProjection.count({ where: { locale: "en", isPublished: true, statusKey: "ACTIVE" } }),
    ]);
    if (uaProjections !== publishedProducts || enProjections !== publishedProducts) {
      throw new Error(
        `Projection parity failed: products=${publishedProducts}, ua=${uaProjections}, en=${enProjections}`
      );
    }
    console.log(JSON.stringify({ processed, applied, publishedProducts, uaProjections, enProjections }));
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
