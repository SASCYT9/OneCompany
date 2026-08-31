import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "./prisma";
import {
  rebuildShopCatalogProjectionPage,
  type ShopCatalogProjectionPersistResult,
  type ShopCatalogProjectionRebuildPageResult,
  type ShopCatalogProjectionRebuildSource,
} from "./shopCatalogProjectionPersistence.server";
import type { ShopCatalogProjectionBuild } from "./shopCatalogProjection.server";

export const SHOP_CATALOG_REBUILD_CHECKPOINT_ID = "catalog-v2-projection" as const;

export type ShopCatalogRebuildCheckpointStatus = "RUNNING" | "COMPLETED" | "FAILED";

export type ShopCatalogRebuildCheckpointSnapshot = {
  id: string;
  runId: string;
  status: ShopCatalogRebuildCheckpointStatus;
  afterProductId: string | null;
  pageCount: number;
  productCount: string;
  projectionSchemaVersion: number;
  startedAt: Date;
  completedAt: Date | null;
  lastError: string | null;
};

type LockedCheckpoint = {
  id: string;
  runId: string;
  status: string;
  afterProductId: string | null;
};

function requiredIdentity(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${field} is required`);
  if (normalized.length > 320) throw new TypeError(`${field} exceeds 320 characters`);
  return normalized;
}

function snapshot(row: {
  id: string;
  runId: string;
  status: string;
  afterProductId: string | null;
  pageCount: number;
  productCount: bigint;
  projectionSchemaVersion: number;
  startedAt: Date;
  completedAt: Date | null;
  lastError: string | null;
}): ShopCatalogRebuildCheckpointSnapshot {
  return Object.freeze({
    ...row,
    status: row.status as ShopCatalogRebuildCheckpointStatus,
    productCount: row.productCount.toString(),
  });
}

export function validateShopCatalogCheckpointAdvance(input: {
  currentCursor: string | null;
  nextCursor: string;
  pageProductCount: number;
}) {
  const nextCursor = requiredIdentity(input.nextCursor, "nextCursor");
  if (!Number.isSafeInteger(input.pageProductCount) || input.pageProductCount < 1) {
    throw new TypeError("pageProductCount must be a positive safe integer");
  }
  if (input.currentCursor !== null && input.currentCursor.localeCompare(nextCursor, "en") >= 0) {
    throw new Error("Checkpoint cursor must advance strictly");
  }
  return nextCursor;
}

export async function startShopCatalogRebuildCheckpoint(input: {
  runId: string;
  checkpointId?: string;
  projectionSchemaVersion?: number;
}) {
  const id = requiredIdentity(
    input.checkpointId ?? SHOP_CATALOG_REBUILD_CHECKPOINT_ID,
    "checkpointId"
  );
  const runId = requiredIdentity(input.runId, "runId");
  const projectionSchemaVersion = input.projectionSchemaVersion ?? 1;
  if (!Number.isSafeInteger(projectionSchemaVersion) || projectionSchemaVersion < 1) {
    throw new TypeError("projectionSchemaVersion must be a positive safe integer");
  }
  return prisma.$transaction(
    async (tx) => {
      const existing = (
        await tx.$queryRaw<LockedCheckpoint[]>`
          SELECT "id", "runId", "status", "afterProductId"
          FROM "ShopCatalogRebuildCheckpoint"
          WHERE "id" = ${id}
          FOR UPDATE
        `
      )[0];
      if (existing?.status === "RUNNING") {
        if (existing.runId !== runId) {
          throw new Error(`Catalog rebuild ${existing.runId} is already running`);
        }
        const current = await tx.shopCatalogRebuildCheckpoint.findUniqueOrThrow({ where: { id } });
        return snapshot(current);
      }
      const startedAt = new Date();
      const current = await tx.shopCatalogRebuildCheckpoint.upsert({
        where: { id },
        create: {
          id,
          runId,
          status: "RUNNING",
          projectionSchemaVersion,
          startedAt,
        },
        update: {
          runId,
          status: "RUNNING",
          afterProductId: null,
          pageCount: 0,
          productCount: BigInt(0),
          projectionSchemaVersion,
          startedAt,
          completedAt: null,
          lastError: null,
        },
      });
      return snapshot(current);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function readShopCatalogRebuildCheckpoint(
  checkpointId: string = SHOP_CATALOG_REBUILD_CHECKPOINT_ID
) {
  const row = await prisma.shopCatalogRebuildCheckpoint.findUnique({
    where: { id: requiredIdentity(checkpointId, "checkpointId") },
  });
  return row ? snapshot(row) : null;
}

export async function advanceShopCatalogRebuildCheckpoint(input: {
  runId: string;
  nextCursor: string;
  pageProductCount: number;
  checkpointId?: string;
}) {
  const id = requiredIdentity(
    input.checkpointId ?? SHOP_CATALOG_REBUILD_CHECKPOINT_ID,
    "checkpointId"
  );
  const runId = requiredIdentity(input.runId, "runId");
  return prisma.$transaction(async (tx) => {
    const current = (
      await tx.$queryRaw<LockedCheckpoint[]>`
        SELECT "id", "runId", "status", "afterProductId"
        FROM "ShopCatalogRebuildCheckpoint"
        WHERE "id" = ${id}
        FOR UPDATE
      `
    )[0];
    if (!current || current.runId !== runId || current.status !== "RUNNING") {
      throw new Error(`Catalog rebuild checkpoint ${id} is not owned by run ${runId}`);
    }
    const nextCursor = validateShopCatalogCheckpointAdvance({
      currentCursor: current.afterProductId,
      nextCursor: input.nextCursor,
      pageProductCount: input.pageProductCount,
    });
    const updated = await tx.shopCatalogRebuildCheckpoint.update({
      where: { id },
      data: {
        afterProductId: nextCursor,
        pageCount: { increment: 1 },
        productCount: { increment: BigInt(input.pageProductCount) },
      },
    });
    return snapshot(updated);
  });
}

export async function completeShopCatalogRebuildCheckpoint(input: {
  runId: string;
  checkpointId?: string;
}) {
  const id = requiredIdentity(
    input.checkpointId ?? SHOP_CATALOG_REBUILD_CHECKPOINT_ID,
    "checkpointId"
  );
  const runId = requiredIdentity(input.runId, "runId");
  const updated = await prisma.shopCatalogRebuildCheckpoint.updateMany({
    where: { id, runId, status: "RUNNING" },
    data: { status: "COMPLETED", completedAt: new Date(), lastError: null },
  });
  if (updated.count !== 1) throw new Error(`Catalog rebuild checkpoint ${id} cannot complete`);
  return readShopCatalogRebuildCheckpoint(id);
}

export async function failShopCatalogRebuildCheckpoint(input: {
  runId: string;
  error: string;
  checkpointId?: string;
}) {
  const id = requiredIdentity(
    input.checkpointId ?? SHOP_CATALOG_REBUILD_CHECKPOINT_ID,
    "checkpointId"
  );
  const runId = requiredIdentity(input.runId, "runId");
  const error = input.error.trim().slice(0, 8_000);
  if (!error) throw new TypeError("error is required");
  const updated = await prisma.shopCatalogRebuildCheckpoint.updateMany({
    where: { id, runId, status: "RUNNING" },
    data: { status: "FAILED", completedAt: new Date(), lastError: error },
  });
  if (updated.count !== 1) throw new Error(`Catalog rebuild checkpoint ${id} cannot fail`);
  return readShopCatalogRebuildCheckpoint(id);
}

/**
 * Executes one page and checkpoints only after every product transaction has
 * committed. Replaying after a crash is safe because persistence is idempotent.
 */
export async function runCheckpointedShopCatalogRebuildPage(input: {
  runId: string;
  source: ShopCatalogProjectionRebuildSource;
  checkpointId?: string;
  limit?: number;
  persist?: (build: ShopCatalogProjectionBuild) => Promise<ShopCatalogProjectionPersistResult>;
}): Promise<{
  checkpoint: ShopCatalogRebuildCheckpointSnapshot;
  page: ShopCatalogProjectionRebuildPageResult;
}> {
  const id = input.checkpointId ?? SHOP_CATALOG_REBUILD_CHECKPOINT_ID;
  const checkpoint = await readShopCatalogRebuildCheckpoint(id);
  if (!checkpoint || checkpoint.runId !== input.runId || checkpoint.status !== "RUNNING") {
    throw new Error(`Catalog rebuild checkpoint ${id} is not running for ${input.runId}`);
  }
  const page = await rebuildShopCatalogProjectionPage({
    source: input.source,
    afterProductId: checkpoint.afterProductId,
    limit: input.limit,
    persist: input.persist,
  });
  const updated = page.batch.productCount
    ? await advanceShopCatalogRebuildCheckpoint({
        checkpointId: id,
        runId: input.runId,
        nextCursor: page.nextCursor!,
        pageProductCount: page.batch.productCount,
      })
    : await completeShopCatalogRebuildCheckpoint({ checkpointId: id, runId: input.runId });
  if (!updated) throw new Error(`Catalog rebuild checkpoint ${id} disappeared`);
  return Object.freeze({ checkpoint: updated, page });
}
