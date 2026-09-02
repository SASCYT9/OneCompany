import { PrismaClient } from "@prisma/client";

type CountRow = { count: bigint };

function assertAuthorization() {
  if (!process.argv.includes("--commit")) return;
  if (process.env.KW_CATALOG_PROJECTION_ACK !== "1") throw new Error("Set KW_CATALOG_PROJECTION_ACK=1 to acknowledge KW projections");
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (url.hostname !== "db.prisma.io" || url.pathname !== "/postgres") throw new Error("KW projection acknowledgement requires the approved production database");
}

async function main() {
  assertAuthorization();
  const commit = process.argv.includes("--commit");
  const prisma = new PrismaClient();
  try {
    const [owned, revisionMismatches, projectionMismatches, receiptMismatches] = await Promise.all([
      prisma.$queryRaw<CountRow[]>`SELECT count(*)::bigint AS count FROM "ShopProduct" WHERE brand = 'KW Suspensions'`,
      prisma.$queryRaw<CountRow[]>`
        SELECT count(*)::bigint AS count FROM "ShopProduct" p
        LEFT JOIN "ShopCatalogProductRevision" r ON r."productId" = p.id AND r.version = p."catalogVersion"
        WHERE p.brand = 'KW Suspensions' AND r.id IS NULL`,
      prisma.$queryRaw<CountRow[]>`
        SELECT count(*)::bigint AS count FROM "ShopProduct" p
        JOIN "ShopCatalogProductRevision" r ON r."productId" = p.id AND r.version = p."catalogVersion"
        LEFT JOIN "ShopCatalogProjection" ua ON ua."productId" = p.id AND ua.locale = 'ua'
        LEFT JOIN "ShopCatalogProjection" en ON en."productId" = p.id AND en.locale = 'en'
        WHERE p.brand = 'KW Suspensions' AND (
          ua."catalogVersion" IS DISTINCT FROM p."catalogVersion" OR en."catalogVersion" IS DISTINCT FROM p."catalogVersion"
          OR ua."sourceContentHash" IS DISTINCT FROM r."contentHash" OR en."sourceContentHash" IS DISTINCT FROM r."contentHash"
        )`,
      prisma.$queryRaw<CountRow[]>`
        SELECT count(*)::bigint AS count FROM "ShopProduct" p
        WHERE p.brand = 'KW Suspensions' AND (
          SELECT count(*) FROM "ShopCatalogPublicationReceipt" receipt WHERE receipt."productId" = p.id
        ) < 4`,
    ]);
    const report = {
      mode: commit ? "commit" : "dry-run",
      owned: Number(owned[0]?.count ?? 0),
      revisionMismatches: Number(revisionMismatches[0]?.count ?? 0),
      projectionMismatches: Number(projectionMismatches[0]?.count ?? 0),
      receiptMismatches: Number(receiptMismatches[0]?.count ?? 0),
    };
    if (report.owned !== 1_999 || report.revisionMismatches || report.projectionMismatches || report.receiptMismatches) throw new Error(`KW acknowledgement preflight failed: ${JSON.stringify(report)}`);
    if (!commit) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }
    const result = await prisma.$transaction(async (tx) => {
      const receipts = await tx.$executeRaw`
        UPDATE "ShopCatalogPublicationReceipt" receipt SET
          "appliedRevisionId" = revision.id, "appliedVersion" = product."catalogVersion",
          "processingVersion" = NULL, "failedVersion" = NULL, status = 'PUBLISHED', "lastError" = NULL, "updatedAt" = now()
        FROM "ShopProduct" product
        JOIN "ShopCatalogProductRevision" revision ON revision."productId" = product.id AND revision.version = product."catalogVersion"
        WHERE receipt."productId" = product.id AND product.brand = 'KW Suspensions'`;
      const products = await tx.$executeRaw`
        UPDATE "ShopProduct" SET "publishedCatalogVersion" = "catalogVersion", "updatedAt" = now()
        WHERE brand = 'KW Suspensions' AND "publishedCatalogVersion" < "catalogVersion"`;
      const outbox = await tx.$executeRaw`
        UPDATE "ShopCatalogOutbox" outbox SET status = 'COMPLETED', "processedAt" = now(),
          "lockedBy" = NULL, "lockedAt" = NULL, "leaseExpiresAt" = NULL, "lastError" = NULL, "updatedAt" = now()
        FROM "ShopProduct" product
        WHERE outbox."productId" = product.id AND product.brand = 'KW Suspensions' AND outbox."canonicalVersion" <= product."catalogVersion"`;
      return { receipts, products, outbox };
    }, { timeout: 30_000 });
    process.stdout.write(`${JSON.stringify({ ...report, ...result }, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
