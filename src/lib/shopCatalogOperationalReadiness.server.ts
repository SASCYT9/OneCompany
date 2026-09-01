import "server-only";

import type { PrismaClient } from "@prisma/client";

import { readShopCatalogShadowEvidenceWithClient } from "./shopCatalogShadowTelemetry.server";

export async function readShopCatalogProjectionReadinessWithClient(client: PrismaClient) {
  const rows = await client.$queryRaw<Array<{
    published_products: bigint;
    current_products: bigint;
    missing_locale_projections: bigint;
    max_version_lag: bigint | null;
  }>>`
    SELECT count(*)::bigint AS published_products,
           count(*) FILTER (WHERE ready_locales = 2)::bigint AS current_products,
           sum(GREATEST(2 - ready_locales, 0))::bigint AS missing_locale_projections,
           max(GREATEST(product_version - newest_projection_version, 0))::bigint AS max_version_lag
    FROM (
      SELECT product.id,
             product."publishedCatalogVersion" AS product_version,
             count(projection.id) FILTER (
               WHERE projection.locale IN ('ua', 'en')
                 AND projection."catalogVersion" = product."publishedCatalogVersion"
             ) AS ready_locales,
             coalesce(max(projection."catalogVersion"), 0) AS newest_projection_version
      FROM "ShopProduct" product
      LEFT JOIN "ShopCatalogProjection" projection ON projection."productId" = product.id
      WHERE product."isPublished" = true AND product.status = 'ACTIVE'
      GROUP BY product.id, product."publishedCatalogVersion"
    ) readiness
  `;
  const row = rows[0];
  return Object.freeze({
    publishedProducts: Number(row?.published_products ?? 0),
    currentProducts: Number(row?.current_products ?? 0),
    missingLocaleProjections: Number(row?.missing_locale_projections ?? 0),
    maxVersionLag: Number(row?.max_version_lag ?? 0),
  });
}

export async function readShopCatalogOperationalReadinessWithClient(
  client: PrismaClient,
  input: { deploymentCommit?: string | null; shadowSince?: Date; now?: Date } = {}
) {
  const now = input.now ?? new Date();
  const [statusGroups, oldestBacklog, retryAttempts, failedReceipts, projection] = await Promise.all([
    client.shopCatalogOutbox.groupBy({ by: ["status"], _count: { _all: true } }),
    client.shopCatalogOutbox.findFirst({
      where: { status: { in: ["PENDING", "PROCESSING", "RETRY"] } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    client.shopCatalogOutbox.aggregate({
      where: { status: { in: ["PROCESSING", "RETRY", "DEAD_LETTER"] } },
      _sum: { attempts: true },
    }),
    client.shopCatalogPublicationReceipt.count({ where: { status: "FAILED" } }),
    readShopCatalogProjectionReadinessWithClient(client),
  ]);
  const counts = Object.fromEntries(statusGroups.map((entry) => [entry.status, entry._count._all])) as Record<string, number>;
  const backlog = (counts.PENDING ?? 0) + (counts.PROCESSING ?? 0) + (counts.RETRY ?? 0);
  const commit = input.deploymentCommit?.trim().toLowerCase();
  const shadow = commit && /^[a-f0-9]{40}$/.test(commit)
    ? await readShopCatalogShadowEvidenceWithClient(client, {
        deploymentCommit: commit,
        since: input.shadowSince ?? new Date(now.getTime() - 24 * 3_600_000),
      })
    : null;
  const reasons = [
    ...(projection.publishedProducts < 10_000 ? [`published catalog has only ${projection.publishedProducts} products`] : []),
    ...(backlog ? [`catalog outbox backlog is ${backlog}`] : []),
    ...((counts.DEAD_LETTER ?? 0) ? [`catalog outbox has ${counts.DEAD_LETTER} dead letters`] : []),
    ...(failedReceipts ? [`catalog publication has ${failedReceipts} failed receipts`] : []),
    ...(projection.missingLocaleProjections ? [`${projection.missingLocaleProjections} locale projections are missing or stale`] : []),
    ...(projection.maxVersionLag ? [`maximum projection version lag is ${projection.maxVersionLag}`] : []),
  ];
  return Object.freeze({
    version: 1 as const,
    generatedAt: now.toISOString(),
    ready: reasons.length === 0,
    reasons: Object.freeze(reasons),
    outbox: Object.freeze({
      pending: counts.PENDING ?? 0,
      processing: counts.PROCESSING ?? 0,
      retry: counts.RETRY ?? 0,
      completed: counts.COMPLETED ?? 0,
      deadLetter: counts.DEAD_LETTER ?? 0,
      backlog,
      oldestBacklogAgeMs: oldestBacklog ? Math.max(0, now.getTime() - oldestBacklog.createdAt.getTime()) : 0,
      retryAttempts: retryAttempts._sum.attempts ?? 0,
    }),
    failedReceipts,
    projection,
    shadow,
  });
}
