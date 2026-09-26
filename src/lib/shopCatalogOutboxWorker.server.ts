import "server-only";

import { Prisma, ShopCatalogOutboxStatus, type ShopCatalogProjectionTarget } from "@prisma/client";

import { prisma } from "./prisma";

export const SHOP_CATALOG_OUTBOX_LIMITS = {
  maxBatch: 50,
  defaultLeaseMs: 60_000,
  maxLeaseMs: 10 * 60_000,
  maxErrorLength: 8_000,
} as const;

export type ShopCatalogClaimedOutbox = {
  id: string;
  entityType: "PRODUCT" | "PRICE_BOOK" | "SETTINGS";
  entityId: string;
  productId: string | null;
  revisionId: string | null;
  canonicalVersion: bigint;
  changeDomains: readonly string[];
  payload: Prisma.JsonValue;
  attempts: number;
  maxAttempts: number;
  lockedBy: string | null;
  leaseExpiresAt: Date | null;
  revision: {
    id: string;
    productId: string;
    version: bigint;
    contentHash: string;
    createdAt: Date;
    snapshot: Prisma.JsonValue;
  } | null;
};

export type ShopCatalogOutboxTargetContext = {
  job: ShopCatalogClaimedOutbox;
  target: ShopCatalogProjectionTarget;
};

export type ShopCatalogOutboxTargetHandler = (
  context: ShopCatalogOutboxTargetContext
) => Promise<void>;

export type ShopCatalogOutboxTargetHandlers = Partial<
  Record<ShopCatalogProjectionTarget, ShopCatalogOutboxTargetHandler>
>;

export type ShopCatalogOutboxProcessResult = {
  jobId: string;
  status: "COMPLETED" | "RETRY" | "DEAD_LETTER" | "LOST_LEASE";
  targets: readonly ShopCatalogProjectionTarget[];
  error: string | null;
};

function requiredWorkerId(value: string) {
  const workerId = value.trim();
  if (!workerId) throw new TypeError("workerId is required");
  if (workerId.length > 200) throw new TypeError("workerId exceeds 200 characters");
  return workerId;
}

function boundedError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, SHOP_CATALOG_OUTBOX_LIMITS.maxErrorLength);
}

function projectionTargets(payload: Prisma.JsonValue): ShopCatalogProjectionTarget[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Catalog outbox payload must be an object");
  }
  const targets = (payload as Prisma.JsonObject).projectionTargets;
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error("Catalog outbox payload has no projectionTargets");
  }
  const allowed = new Set<ShopCatalogProjectionTarget>([
    "CONTENT",
    "SEARCH",
    "PRICE",
    "INVENTORY",
    "SETTINGS",
  ]);
  const unique = new Set<ShopCatalogProjectionTarget>();
  for (const target of targets) {
    if (typeof target !== "string" || !allowed.has(target as ShopCatalogProjectionTarget)) {
      throw new Error(`Unsupported catalog projection target: ${String(target)}`);
    }
    unique.add(target as ShopCatalogProjectionTarget);
  }
  return [...unique];
}

export async function claimShopCatalogOutbox(input: {
  workerId: string;
  limit?: number;
  outboxIds?: readonly string[];
  now?: Date;
  leaseMs?: number;
}): Promise<ShopCatalogClaimedOutbox[]> {
  const workerId = requiredWorkerId(input.workerId);
  const limit = input.limit ?? 10;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > SHOP_CATALOG_OUTBOX_LIMITS.maxBatch) {
    throw new TypeError(`limit must be between 1 and ${SHOP_CATALOG_OUTBOX_LIMITS.maxBatch}`);
  }
  const leaseMs = input.leaseMs ?? SHOP_CATALOG_OUTBOX_LIMITS.defaultLeaseMs;
  if (
    !Number.isSafeInteger(leaseMs) ||
    leaseMs < 1_000 ||
    leaseMs > SHOP_CATALOG_OUTBOX_LIMITS.maxLeaseMs
  ) {
    throw new TypeError(
      `leaseMs must be between 1000 and ${SHOP_CATALOG_OUTBOX_LIMITS.maxLeaseMs}`
    );
  }
  const now = input.now ?? new Date();
  const leaseExpiresAt = new Date(now.getTime() + leaseMs);
  const outboxIdFilter = input.outboxIds
    ? input.outboxIds.length
      ? Prisma.sql`AND "id" IN (${Prisma.join([...new Set(input.outboxIds)])})`
      : Prisma.sql`AND false`
    : Prisma.empty;

  const claimedIds = await prisma.$transaction(async (tx) => {
    const claimed = await tx.$queryRaw<Array<{ id: string }>>`
      WITH candidates AS (
        SELECT "id"
        FROM "ShopCatalogOutbox"
        WHERE (
          ("status" IN ('PENDING', 'RETRY') AND "availableAt" <= ${now})
          OR ("status" = 'PROCESSING' AND "leaseExpiresAt" < ${now})
        )
        ${outboxIdFilter}
        ORDER BY "availableAt" ASC, "createdAt" ASC, "id" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      UPDATE "ShopCatalogOutbox" outbox
      SET
        "status" = 'PROCESSING',
        "attempts" = outbox."attempts" + 1,
        "lockedBy" = ${workerId},
        "lockedAt" = ${now},
        "leaseExpiresAt" = ${leaseExpiresAt},
        "updatedAt" = ${now}
      FROM candidates
      WHERE outbox."id" = candidates."id"
      RETURNING outbox."id"
    `;
    return claimed.map((row) => row.id);
  });
  if (!claimedIds.length) return [];

  // Revision snapshots can be large. Load them after the atomic lease claim so
  // the row-locking transaction doesn't time out while materializing JSON.
  const jobs = await prisma.shopCatalogOutbox.findMany({
    where: {
      id: { in: claimedIds },
      status: ShopCatalogOutboxStatus.PROCESSING,
      lockedBy: workerId,
      leaseExpiresAt,
    },
    include: {
      revision: {
        select: {
          id: true,
          productId: true,
          version: true,
          contentHash: true,
          createdAt: true,
          snapshot: true,
        },
      },
    },
    orderBy: [{ canonicalVersion: "asc" }, { id: "asc" }],
  });
  return jobs as ShopCatalogClaimedOutbox[];
}

async function setReceiptPublishing(
  job: ShopCatalogClaimedOutbox,
  target: ShopCatalogProjectionTarget,
  workerId: string
) {
  const updated = await prisma.$transaction(async (tx) => {
    const lease = await tx.shopCatalogOutbox.findFirst({
      where: {
        id: job.id,
        status: ShopCatalogOutboxStatus.PROCESSING,
        lockedBy: workerId,
        leaseExpiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!lease) return 0;
    const receipt = await tx.shopCatalogPublicationReceipt.updateMany({
      where: {
        entityType: job.entityType,
        entityId: job.entityId,
        target,
        appliedVersion: { lt: job.canonicalVersion },
      },
      data: {
        processingVersion: job.canonicalVersion,
        status: "PUBLISHING",
        lastError: null,
      },
    });
    return receipt.count;
  });
  return updated > 0;
}

async function completeTarget(
  job: ShopCatalogClaimedOutbox,
  target: ShopCatalogProjectionTarget,
  workerId: string
) {
  await prisma.$transaction(async (tx) => {
    const lease = await tx.shopCatalogOutbox.findFirst({
      where: {
        id: job.id,
        status: ShopCatalogOutboxStatus.PROCESSING,
        lockedBy: workerId,
        leaseExpiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!lease) throw new Error(`Lost lease for catalog outbox ${job.id}`);
    const updated = await tx.shopCatalogPublicationReceipt.updateMany({
      where: {
        entityType: job.entityType,
        entityId: job.entityId,
        target,
        processingVersion: job.canonicalVersion,
        OR: [
          { appliedVersion: { lt: job.canonicalVersion } },
          { appliedVersion: job.canonicalVersion },
        ],
      },
      data: {
        appliedRevisionId: job.revisionId,
        appliedVersion: job.canonicalVersion,
        processingVersion: null,
        failedVersion: null,
        status: "PUBLISHED",
        lastError: null,
      },
    });
    if (updated.count !== 1) {
      throw new Error(`Could not complete ${target} receipt for ${job.id}`);
    }
  });
}

async function failJob(
  job: ShopCatalogClaimedOutbox,
  workerId: string,
  error: string,
  targets: readonly ShopCatalogProjectionTarget[]
): Promise<ShopCatalogOutboxProcessResult> {
  const deadLetter = job.attempts >= job.maxAttempts;
  const retryDelayMs = Math.min(15 * 60_000, 1_000 * 2 ** Math.min(job.attempts, 9));
  const retainedLease = await prisma.$transaction(async (tx) => {
    const updated = await tx.shopCatalogOutbox.updateMany({
      where: {
        id: job.id,
        status: ShopCatalogOutboxStatus.PROCESSING,
        lockedBy: workerId,
        leaseExpiresAt: { gt: new Date() },
      },
      data: {
        status: deadLetter ? ShopCatalogOutboxStatus.DEAD_LETTER : ShopCatalogOutboxStatus.RETRY,
        availableAt: deadLetter ? undefined : new Date(Date.now() + retryDelayMs),
        lockedBy: null,
        lockedAt: null,
        leaseExpiresAt: null,
        processedAt: deadLetter ? new Date() : null,
        lastError: error,
      },
    });
    if (updated.count !== 1) return false;
    await tx.shopCatalogPublicationReceipt.updateMany({
      where: {
        entityType: job.entityType,
        entityId: job.entityId,
        target: { in: [...targets] },
        processingVersion: job.canonicalVersion,
      },
      data: {
        processingVersion: null,
        failedVersion: deadLetter ? job.canonicalVersion : null,
        status: deadLetter ? "FAILED" : "SAVED",
        lastError: error,
      },
    });
    return true;
  });
  if (!retainedLease) {
    return {
      jobId: job.id,
      status: "LOST_LEASE",
      targets: Object.freeze([...targets]),
      error,
    };
  }
  return {
    jobId: job.id,
    status: deadLetter ? "DEAD_LETTER" : "RETRY",
    targets: Object.freeze([...targets]),
    error,
  };
}

async function setMediaReceiptsPublishing(
  job: ShopCatalogClaimedOutbox,
  targets: readonly ShopCatalogProjectionTarget[],
  workerId: string
) {
  return prisma.$transaction(async (tx) => {
    const lease = await tx.shopCatalogOutbox.findFirst({
      where: {
        id: job.id,
        status: ShopCatalogOutboxStatus.PROCESSING,
        lockedBy: workerId,
        leaseExpiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!lease) throw new Error(`Lost lease for catalog outbox ${job.id}`);
    const updated = await tx.shopCatalogPublicationReceipt.updateMany({
      where: {
        entityType: job.entityType,
        entityId: job.entityId,
        target: { in: [...targets] },
        appliedVersion: { lt: job.canonicalVersion },
      },
      data: {
        processingVersion: job.canonicalVersion,
        status: "PUBLISHING",
        lastError: null,
      },
    });
    return updated.count > 0;
  });
}

async function completeMediaReceipts(
  job: ShopCatalogClaimedOutbox,
  targets: readonly ShopCatalogProjectionTarget[],
  workerId: string
) {
  await prisma.$transaction(async (tx) => {
    const lease = await tx.shopCatalogOutbox.findFirst({
      where: {
        id: job.id,
        status: ShopCatalogOutboxStatus.PROCESSING,
        lockedBy: workerId,
        leaseExpiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!lease) throw new Error(`Lost lease for catalog outbox ${job.id}`);
    await tx.shopCatalogPublicationReceipt.updateMany({
      where: {
        entityType: job.entityType,
        entityId: job.entityId,
        target: { in: [...targets] },
        processingVersion: job.canonicalVersion,
      },
      data: {
        appliedRevisionId: job.revisionId,
        appliedVersion: job.canonicalVersion,
        processingVersion: null,
        failedVersion: null,
        status: "PUBLISHED",
        lastError: null,
      },
    });
  });
}

async function completeOutboxAndProduct(job: ShopCatalogClaimedOutbox, workerId: string) {
  return prisma.$transaction(async (tx) => {
    const outbox = await tx.shopCatalogOutbox.updateMany({
      where: {
        id: job.id,
        status: ShopCatalogOutboxStatus.PROCESSING,
        lockedBy: workerId,
        leaseExpiresAt: { gt: new Date() },
      },
      data: {
        status: ShopCatalogOutboxStatus.COMPLETED,
        processedAt: new Date(),
        lockedBy: null,
        lockedAt: null,
        leaseExpiresAt: null,
        lastError: null,
      },
    });
    if (outbox.count !== 1) return false;

    if (job.entityType === "PRODUCT" && job.productId) {
      const product = await tx.shopProduct.updateMany({
        where: {
          id: job.productId,
          catalogVersion: { gte: job.canonicalVersion },
          publishedCatalogVersion: { lt: job.canonicalVersion },
        },
        data: { publishedCatalogVersion: job.canonicalVersion },
      });
      if (product.count !== 1) {
        const alreadyPublished = await tx.shopProduct.count({
          where: {
            id: job.productId,
            publishedCatalogVersion: { gte: job.canonicalVersion },
          },
        });
        if (alreadyPublished !== 1) {
          throw new Error(`Could not publish catalog version for ${job.id}`);
        }
      }
    }
    return true;
  });
}

async function processMediaOnlyShopCatalogOutboxJob(input: {
  job: ShopCatalogClaimedOutbox;
  workerId: string;
  handlers: ShopCatalogOutboxTargetHandlers;
  targets: readonly ShopCatalogProjectionTarget[];
}): Promise<ShopCatalogOutboxProcessResult> {
  try {
    const handler = input.targets.map((target) => input.handlers[target]).find(Boolean);
    if (!handler) throw new Error(`No catalog outbox handler registered for ${input.targets[0]}`);
    const shouldApply = await setMediaReceiptsPublishing(input.job, input.targets, input.workerId);
    if (shouldApply) {
      await handler({ job: input.job, target: input.targets[0] });
      await completeMediaReceipts(input.job, input.targets, input.workerId);
    }
    const completed = await completeOutboxAndProduct(input.job, input.workerId);
    if (!completed) throw new Error(`Lost lease for catalog outbox ${input.job.id}`);
    return {
      jobId: input.job.id,
      status: "COMPLETED",
      targets: Object.freeze([...input.targets]),
      error: null,
    };
  } catch (error) {
    return failJob(input.job, input.workerId, boundedError(error), input.targets);
  }
}

export async function processShopCatalogOutboxJob(input: {
  job: ShopCatalogClaimedOutbox;
  workerId: string;
  handlers: ShopCatalogOutboxTargetHandlers;
}): Promise<ShopCatalogOutboxProcessResult> {
  const workerId = requiredWorkerId(input.workerId);
  const targets = projectionTargets(input.job.payload);
  const mediaOnly =
    input.job.entityType === "PRODUCT" &&
    input.job.changeDomains.length > 0 &&
    input.job.changeDomains.every((domain) => domain === "MEDIA");
  if (mediaOnly) {
    return processMediaOnlyShopCatalogOutboxJob({ ...input, targets });
  }
  try {
    for (const target of targets) {
      const handler = input.handlers[target];
      if (!handler) throw new Error(`No catalog outbox handler registered for ${target}`);
      const shouldApply = await setReceiptPublishing(input.job, target, workerId);
      if (!shouldApply) continue;
      await handler({ job: input.job, target });
      await completeTarget(input.job, target, workerId);
    }
    const completed = await completeOutboxAndProduct(input.job, workerId);
    if (!completed) throw new Error(`Lost lease for catalog outbox ${input.job.id}`);
    return {
      jobId: input.job.id,
      status: "COMPLETED",
      targets: Object.freeze(targets),
      error: null,
    };
  } catch (error) {
    return failJob(input.job, workerId, boundedError(error), targets);
  }
}
