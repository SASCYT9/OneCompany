import "server-only";

import { buildShopCatalogProjection } from "./shopCatalogProjection.server";
import { persistShopCatalogProjectionBuild } from "./shopCatalogProjectionPersistence.server";
import { projectionSourceFromRevision } from "./shopCatalogProjectionSource.server";
import {
  claimShopCatalogOutbox,
  processShopCatalogOutboxJob,
  type ShopCatalogClaimedOutbox,
  type ShopCatalogOutboxProcessResult,
  type ShopCatalogOutboxTargetHandlers,
} from "./shopCatalogOutboxWorker.server";

export type ShopCatalogOutboxRuntimeResult = {
  claimed: number;
  completed: number;
  retried: number;
  deadLettered: number;
  lostLease: number;
  results: readonly ShopCatalogOutboxProcessResult[];
};

function projectionHandlers(job: ShopCatalogClaimedOutbox): ShopCatalogOutboxTargetHandlers {
  let persisted: Promise<void> | null = null;
  const publish = async () => {
    if (!persisted) {
      persisted = (async () => {
        const source = projectionSourceFromRevision({
          productId: job.productId ?? job.entityId,
          catalogVersion: job.canonicalVersion,
          revisionId: job.revision?.id ?? null,
          revisionVersion: job.revision?.version ?? null,
          contentHash: job.revision?.contentHash ?? null,
          createdAt: job.revision?.createdAt ?? null,
          snapshot: job.revision?.snapshot ?? null,
        });
        await persistShopCatalogProjectionBuild(buildShopCatalogProjection(source));
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
}): Promise<ShopCatalogOutboxRuntimeResult> {
  const jobs = await claimShopCatalogOutbox(input);
  const results: ShopCatalogOutboxProcessResult[] = [];
  for (const job of jobs) {
    results.push(
      await processShopCatalogOutboxJob({
        job,
        workerId: input.workerId,
        handlers: projectionHandlers(job),
      })
    );
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
