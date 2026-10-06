import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { buildShopCatalogProjection } from "./shopCatalogProjection.server";
import { projectionSourceFromRevision } from "./shopCatalogProjectionSource.server";
import { planShopCatalogProjectionPersistence } from "./shopCatalogProjectionPersistence.server";
import type { ShopCatalogClaimedOutbox, ShopCatalogOutboxProcessResult } from "./shopCatalogOutboxWorker.server";
import { retrySerializablePriceBatch } from "./shopPriceBookBatchRetry";

/** Publishes eligible PRICE jobs atomically; others retain the ordinary full path. */
export async function publishShopCatalogPriceBatch(
  jobs: readonly ShopCatalogClaimedOutbox[], workerId: string
): Promise<readonly ShopCatalogOutboxProcessResult[] | null> {
  if (!jobs.length || jobs.length > 10 || !workerId.trim()) return null;
  if (new Set(jobs.map(job => job.productId)).size !== jobs.length) return null;
  if (jobs.some(job => {
    const payload = job.payload as Prisma.JsonObject | null;
    return job.entityType !== "PRODUCT" || job.productId !== job.entityId ||
      job.changeDomains.length !== 1 || job.changeDomains[0] !== "PRICE" ||
      !payload || JSON.stringify(payload.projectionTargets) !== '["PRICE"]';
  })) return null;
  const sources = jobs.map(job => projectionSourceFromRevision({
    productId: job.productId!, catalogVersion: job.canonicalVersion,
    revisionId: job.revision?.id ?? null, revisionVersion: job.revision?.version ?? null,
    contentHash: job.revision?.contentHash ?? null, createdAt: job.revision?.createdAt ?? null,
    snapshot: job.revision?.snapshot ?? null,
  }));
  const builds = sources.map(buildShopCatalogProjection);
  return retrySerializablePriceBatch(() => prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL idle_in_transaction_session_timeout = '15s'");
    const leased = await tx.shopCatalogOutbox.findMany({ where: {
      id: { in: jobs.map(job => job.id) }, status: "PROCESSING", lockedBy: workerId,
      leaseExpiresAt: { gt: new Date() },
    }, select: { id: true, productId: true, canonicalVersion: true, revisionId: true } });
    if (leased.length !== jobs.length || jobs.some(job => !leased.some(row => row.id === job.id &&
      row.productId === job.productId && row.canonicalVersion === job.canonicalVersion && row.revisionId === job.revisionId)))
      throw new Error("Price publication batch lost its lease or revision");
    const ids = jobs.map(job => job.productId!);
    const products = await tx.$queryRaw<Array<{ id: string; catalogVersion: bigint }>>(Prisma.sql`
      SELECT id, "catalogVersion" FROM "ShopProduct" WHERE id IN (${Prisma.join([...ids].sort())}) ORDER BY id FOR UPDATE
    `);
    if (products.length !== jobs.length || jobs.some(job => products.find(row => row.id === job.productId)?.catalogVersion !== job.canonicalVersion)) return null;
    const receipts = await tx.shopCatalogPublicationReceipt.findMany({ where: {
      entityType: "PRODUCT", entityId: { in: ids }, target: "PRICE",
    }, select: { entityId: true, appliedVersion: true } });
    if (receipts.length !== jobs.length || jobs.some(job => receipts.find(row => row.entityId === job.productId)!.appliedVersion >= job.canonicalVersion)) return null;
    const projections = await tx.shopCatalogProjection.findMany({ where: { productId: { in: ids } },
      select: { productId: true, locale: true, projectionVersion: true, contentHash: true,
        sourceContentHash: true, sourceUpdatedAt: true } });
    const currentSkus = await tx.shopCatalogProjectionSku.findMany({ where: { productId: { in: ids } },
      select: { productId: true, skuKey: true, variantId: true, sourceVersion: true, sku: true,
        normalizedSku: true, isDefault: true, stableRank: true } });
    const advances: Array<{ productId: string; previousVersion: string; nextVersion: string }> = [];
    const rows: Array<Record<string, unknown>> = [];
    for (const incoming of builds) {
      const current = projections.filter(row => row.productId === incoming.productId);
      const plan = planShopCatalogProjectionPersistence(current, incoming);
      if (plan.decision !== "NEWER_VERSION" || current.length !== incoming.projections.length) continue;
      const previousVersion = current[0].projectionVersion;
      // Reconstruct the expected old envelope from the new immutable source.
      // Matching both stored hashes proves every search/media/stock/fitment field
      // agrees, even for legacy projections whose old revision is unavailable.
      const previous = buildShopCatalogProjection({ ...sources.find(source => source.productId === incoming.productId)!,
        sourceVersion: previousVersion.toString(), catalogVersion: previousVersion.toString(),
        sourceUpdatedAt: current[0].sourceUpdatedAt?.toISOString() ?? null,
        canonicalContentHash: current[0].sourceContentHash });
      const previousPlan = planShopCatalogProjectionPersistence(current, previous);
      if (previousPlan.decision !== "IDEMPOTENT") continue;
      const actualSkus = currentSkus.filter(row => row.productId === incoming.productId);
      if (actualSkus.length !== previousPlan.skuRows.length || previousPlan.skuRows.some(expected => {
        const actual = actualSkus.find(row => row.skuKey === expected.skuKey) as Record<string, unknown> | undefined;
        return !actual || Object.entries(expected).some(([field, value]) => field === "stableRank"
          ? Number(actual[field]) !== Number(value) : actual[field] !== value);
      })) continue;
      advances.push({ productId: incoming.productId, previousVersion: previousVersion.toString(), nextVersion: incoming.projectionVersion });
      rows.push(...plan.projectionRows);
    }
    if (!advances.length) return null;
    const completionJobs = jobs.filter(job => advances.some(row => row.productId === job.productId));
    const versionInput = JSON.stringify(advances);
    const counts = await tx.$queryRaw<Array<{ productId: string; kind: number; count: bigint }>>(Prisma.sql`
      WITH input AS (SELECT * FROM jsonb_to_recordset(${versionInput}::jsonb) AS x("productId" text,"previousVersion" bigint))
      SELECT i."productId",0 AS kind,count(s.id) FROM input i LEFT JOIN "ShopCatalogProjectionSku" s ON s."productId"=i."productId" AND s."sourceVersion"=i."previousVersion" GROUP BY i."productId"
      UNION ALL SELECT i."productId",1,count(s.id) FROM input i LEFT JOIN "ShopCatalogProjectionPolicy" s ON s."productId"=i."productId" AND s."sourceVersion"=i."previousVersion" GROUP BY i."productId"
      UNION ALL SELECT i."productId",2,count(s.id) FROM input i LEFT JOIN "ShopCatalogProjectionClause" s ON s."productId"=i."productId" AND s."sourceVersion"=i."previousVersion" GROUP BY i."productId"
      UNION ALL SELECT i."productId",3,count(s.id) FROM input i LEFT JOIN "ShopCatalogProjectionConstraint" s ON s."productId"=i."productId" AND s."sourceVersion"=i."previousVersion" GROUP BY i."productId"
    `);
    if (counts.some(row => { const incoming = builds.find(build => build.productId === row.productId)!;
      return Number(row.count) !== [incoming.skuRecords.length, incoming.compatibilityPolicies.length,
        incoming.compatibilityClauses.length, incoming.compatibilityConstraints.length][row.kind]; })) return null;

    const projectionRows = JSON.stringify(rows, (_key, value) => typeof value === "bigint" ? value.toString() : value);
    const updatedProjections = await tx.$executeRaw(Prisma.sql`
      UPDATE "ShopCatalogProjection" p SET "sourceVersion"=i."sourceVersion","catalogVersion"=i."catalogVersion",
        "projectionVersion"=i."projectionVersion","sourceUpdatedAt"=i."sourceUpdatedAt",
        "sourceContentHash"=i."sourceContentHash","canonicalRelationHash"=i."canonicalRelationHash",
        "compatibilityHash"=i."compatibilityHash","contentHash"=i."contentHash","updatedAt"=NOW()
      FROM jsonb_to_recordset(${projectionRows}::jsonb) i("productId" text,locale text,"sourceVersion" bigint,
        "catalogVersion" bigint,"projectionVersion" bigint,"sourceUpdatedAt" timestamp,"sourceContentHash" text,
        "canonicalRelationHash" text,"compatibilityHash" text,"contentHash" text)
      WHERE p."productId"=i."productId" AND p.locale=i.locale
    `);
    if (updatedProjections !== rows.length) throw new Error("Price projection batch incomplete");
    // Identifiers are a closed internal list, never job or request input. FK updates cascade.
    for (const table of ["ShopCatalogProjectionSku", "ShopCatalogProjectionPolicy", "ShopCatalogProjectionClause", "ShopCatalogProjectionConstraint"]) {
      await tx.$executeRaw(Prisma.sql`
        UPDATE ${Prisma.raw('"' + table + '"')} p SET "sourceVersion"=i."nextVersion"
        FROM jsonb_to_recordset(${versionInput}::jsonb) i("productId" text,"previousVersion" bigint,"nextVersion" bigint)
        WHERE p."productId"=i."productId" AND p."sourceVersion"=i."previousVersion"
      `);
    }
    const completion = JSON.stringify(completionJobs.map(job => ({ id: job.id, productId: job.productId,
      version: job.canonicalVersion.toString(), revisionId: job.revisionId })));
    const updatedReceipts = await tx.$executeRaw(Prisma.sql`
      UPDATE "ShopCatalogPublicationReceipt" r SET "appliedRevisionId"=i."revisionId","appliedVersion"=i.version,
        "processingVersion"=NULL,"failedVersion"=NULL,status='PUBLISHED',"lastError"=NULL,"updatedAt"=NOW()
      FROM jsonb_to_recordset(${completion}::jsonb) i("productId" text,version bigint,"revisionId" text)
      WHERE r."entityType"='PRODUCT' AND r."entityId"=i."productId" AND r.target='PRICE' AND r."appliedVersion"<i.version
    `);
    if (updatedReceipts !== completionJobs.length) throw new Error("Price receipt batch incomplete");
    await tx.$executeRaw(Prisma.sql`
      UPDATE "ShopProduct" p SET "publishedCatalogVersion"=GREATEST(p."publishedCatalogVersion",i.version)
      FROM jsonb_to_recordset(${completion}::jsonb) i("productId" text,version bigint) WHERE p.id=i."productId"
    `);
    const completed = await tx.shopCatalogOutbox.updateMany({ where: { id: { in: completionJobs.map(job => job.id) },
      status: "PROCESSING", lockedBy: workerId, leaseExpiresAt: { gt: new Date() } },
      data: { status: "COMPLETED", processedAt: new Date(), lockedBy: null, lockedAt: null, leaseExpiresAt: null, lastError: null } });
    if (completed.count !== completionJobs.length) throw new Error("Price publication batch lease expired");
    return completionJobs.map(job => ({ jobId: job.id, status: "COMPLETED" as const, targets: ["PRICE"] as const, error: null }));
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000, maxWait: 10_000 }));
}
