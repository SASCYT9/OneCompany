import "server-only";

import { buildShopCatalogProjection } from "./shopCatalogProjection.server";
import {
  persistShopCatalogMediaProjectionBuild,
  persistShopCatalogPriceProjectionBuild,
  persistShopCatalogProjectionBuild,
} from "./shopCatalogProjectionPersistence.server";
import { projectionSourceFromRevision } from "./shopCatalogProjectionSource.server";
import {
  claimShopCatalogOutbox,
  processShopCatalogOutboxJob,
  type ShopCatalogClaimedOutbox,
  type ShopCatalogOutboxProcessResult,
  type ShopCatalogOutboxTargetHandlers,
} from "./shopCatalogOutboxWorker.server";
import { prisma } from "./prisma";
import { publishShopCatalogPriceBatch } from "./shopCatalogPricePublicationBatch.server";
import { retrySerializablePriceBatch } from "./shopPriceBookBatchRetry";

export type ShopCatalogOutboxRuntimeResult = {
  claimed: number;
  completed: number;
  retried: number;
  deadLettered: number;
  lostLease: number;
  results: readonly ShopCatalogOutboxProcessResult[];
};

function projectionHandlers(job: ShopCatalogClaimedOutbox): ShopCatalogOutboxTargetHandlers {
  // Global settings and price-book values are already committed to their
  // canonical live tables in the same transaction as this outbox event. Their
  // targeted publication step advances the durable receipt only; unlike a
  // product event there is no product projection or catalog-wide fanout.
  if (job.entityType !== "PRODUCT") {
    const acknowledgeCanonicalGlobalState = async () => {};
    return {
      PRICE: acknowledgeCanonicalGlobalState,
      SETTINGS: acknowledgeCanonicalGlobalState,
    };
  }
  let persisted: Promise<void> | null = null;
  const mediaOnly =
    job.changeDomains.length > 0 && job.changeDomains.every((domain) => domain === "MEDIA");
  const priceOnly =
    job.changeDomains.length > 0 && job.changeDomains.every((domain) => domain === "PRICE");
  const publish = async () => {
    if (!persisted) {
      persisted = (async () => {
        const canonical = await prisma.shopProduct.findUnique({
          where: { id: job.productId ?? job.entityId },
          select: { catalogVersion: true },
        });
        if (!canonical) throw new Error(`Cannot publish missing catalog product ${job.productId ?? job.entityId}`);
        if (canonical.catalogVersion > job.canonicalVersion) return;
        const source = projectionSourceFromRevision({
          productId: job.productId ?? job.entityId,
          catalogVersion: job.canonicalVersion,
          revisionId: job.revision?.id ?? null,
          revisionVersion: job.revision?.version ?? null,
          contentHash: job.revision?.contentHash ?? null,
          createdAt: job.revision?.createdAt ?? null,
          snapshot: job.revision?.snapshot ?? null,
        });
        const build = buildShopCatalogProjection(source);
        if (mediaOnly) {
          await persistShopCatalogMediaProjectionBuild(build);
        } else if (priceOnly) {
          await retrySerializablePriceBatch(() => persistShopCatalogPriceProjectionBuild(build));
        } else {
          await persistShopCatalogProjectionBuild(build);
        }
      })();
    }
    await persisted;
  };

  return {
    CONTENT: publish,
    SEARCH: publish,
    PRICE: publish,
    INVENTORY: publish,
    SETTINGS: publish,
  };
}

/** Runs one bounded recovery batch. Repeated calls are safe and idempotent. */
export async function runShopCatalogOutboxRuntime(input: {
  workerId: string;
  limit?: number;
  outboxIds?: readonly string[];
}): Promise<ShopCatalogOutboxRuntimeResult> {
  const jobs = await claimShopCatalogOutbox(input);
  const results: ShopCatalogOutboxProcessResult[] = [];
  for (let offset = 0; offset < jobs.length; offset += 10) {
    const batch = jobs.slice(offset, offset + 10);
    let published: readonly ShopCatalogOutboxProcessResult[] | null = null;
    try {
      published = await publishShopCatalogPriceBatch(batch, input.workerId);
    } catch (error) {
      // Ordinary processing retains per-job durable error/retry and lease handling.
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "UNKNOWN";
      const meta = error && typeof error === "object" && "meta" in error ? error.meta as { code?: string } | undefined : undefined;
      console.warn("Catalog PRICE batch fell back to individual publication", code, meta?.code ?? "");
    }
    if (published) results.push(...published);
    const completedIds = new Set(published?.map(result => result.jobId) ?? []);
    for (const job of batch.filter(job => !completedIds.has(job.id))) {
      results.push(await processShopCatalogOutboxJob({ job, workerId: input.workerId,
        handlers: projectionHandlers(job) }));
    }
  }
  return Object.freeze({
    claimed: jobs.length,
    completed: results.filter((result) => result.status === "COMPLETED").length,
    retried: results.filter((result) => result.status === "RETRY").length,
    deadLettered: results.filter((result) => result.status === "DEAD_LETTER").length,
    lostLease: results.filter((result) => result.status === "LOST_LEASE").length,
    results: Object.freeze(results),
  });
}
