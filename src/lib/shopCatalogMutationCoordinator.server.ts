import "server-only";

import { Prisma } from "@prisma/client";

import { canonicalizeCatalogBaselineValue, hashCatalogBaselineValue } from "./shopCatalogBaseline";
import {
  buildShopCatalogProjection,
  type ShopCatalogProjectionSource,
} from "./shopCatalogProjection.server";
import {
  buildShopCatalogPublicationPlan,
  type ShopCatalogChangeDomain,
} from "./shopCatalogPublication";
import { SHOP_CATALOG_REVISION_SNAPSHOT_SCHEMA_VERSION } from "./shopCatalogProjectionSource.server";
import { prisma } from "./prisma";

const MAX_POSTGRES_BIGINT = BigInt("9223372036854775807");

export type ShopCatalogCoordinatedMutationSnapshot = {
  /** Full product state, encoded losslessly into the immutable revision. */
  canonical: unknown;
  /** Rebuildable compact input; never used as a replacement for canonical. */
  projectionSource: ShopCatalogProjectionSource;
  actorType?: string | null;
  actorId?: string | null;
  reason?: string | null;
  sourceRecordId?: string | null;
};

export type ShopCatalogCoordinatedMutationInput = {
  productId: string;
  expectedCatalogVersion?: string | null;
  changeDomains: readonly ShopCatalogChangeDomain[];
  mutateAndSnapshot(
    tx: Prisma.TransactionClient,
    nextCatalogVersion: string
  ): Promise<ShopCatalogCoordinatedMutationSnapshot>;
};

export type ShopCatalogCoordinatedMutationResult = {
  productId: string;
  previousVersion: string;
  canonicalVersion: string;
  revisionId: string;
  outboxId: string;
  dedupeKey: string;
  projectionTargets: readonly string[];
  contentHash: string;
};

export type ShopCatalogCoordinatedCreationInput = {
  changeDomains: readonly ShopCatalogChangeDomain[];
  create(tx: Prisma.TransactionClient, initialCatalogVersion: string): Promise<string>;
  snapshot(
    tx: Prisma.TransactionClient,
    productId: string,
    initialCatalogVersion: string
  ): Promise<ShopCatalogCoordinatedMutationSnapshot>;
};

type LockedProduct = {
  id: string;
  slug: string;
  catalogVersion: bigint;
};

function jsonRoundTrip(value: unknown, field: string): Prisma.InputJsonValue {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new Error("undefined root");
    return JSON.parse(serialized) as Prisma.InputJsonValue;
  } catch (error) {
    throw new TypeError(`${field} must be JSON serializable`, { cause: error });
  }
}

function expectedVersion(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw new TypeError("expectedCatalogVersion must be an unsigned decimal integer");
  }
  return BigInt(value);
}

export async function coordinateShopCatalogProductMutationInTransaction(
  tx: Prisma.TransactionClient,
  input: ShopCatalogCoordinatedMutationInput
): Promise<ShopCatalogCoordinatedMutationResult> {
  if (!input.productId.trim()) throw new TypeError("productId is required");
  const expected = expectedVersion(input.expectedCatalogVersion);
      const products = await tx.$queryRaw<LockedProduct[]>`
        SELECT "id", "slug", "catalogVersion"
        FROM "ShopProduct"
        WHERE "id" = ${input.productId}
        FOR UPDATE
      `;
      const product = products[0];
      if (!product) throw new Error(`Cannot mutate missing product ${input.productId}`);
      if (expected !== null && expected !== product.catalogVersion) {
        throw new Error(
          `Catalog version conflict for ${input.productId}: expected ${expected}, current ${product.catalogVersion}`
        );
      }
      const nextVersion = product.catalogVersion + BigInt(1);
      if (nextVersion > MAX_POSTGRES_BIGINT) throw new Error("Catalog version overflow");

      // Set the locked aggregate version before the writer reloads its canonical
      // state, so the immutable snapshot describes the exact committed version.
      // The surrounding transaction rolls this back together with the mutation.
      await tx.shopProduct.update({
        where: { id: product.id },
        data: { catalogVersion: nextVersion },
      });
      const snapshotInput = await input.mutateAndSnapshot(tx, nextVersion.toString());
      const contentHash = hashCatalogBaselineValue(snapshotInput.canonical);
      const projectionSource = {
        ...snapshotInput.projectionSource,
        productId: product.id,
        sourceVersion: nextVersion.toString(),
        catalogVersion: nextVersion.toString(),
        canonicalContentHash: contentHash,
      } satisfies ShopCatalogProjectionSource;
      buildShopCatalogProjection(projectionSource);
      const safeProjectionSource = jsonRoundTrip(projectionSource, "projectionSource");
      const canonical = canonicalizeCatalogBaselineValue(snapshotInput.canonical);
      const newSlug = projectionSource.slug;
      const plan = buildShopCatalogPublicationPlan({
        entityType: "PRODUCT",
        entityId: product.id,
        canonicalVersion: nextVersion.toString(),
        changeDomains: input.changeDomains,
        oldSlug: product.slug,
        newSlug,
      });

      const revision = await tx.shopCatalogProductRevision.create({
        data: {
          productId: product.id,
          version: nextVersion,
          schemaVersion: SHOP_CATALOG_REVISION_SNAPSHOT_SCHEMA_VERSION,
          changeDomains: [...plan.changeDomains],
          snapshot: {
            schemaVersion: SHOP_CATALOG_REVISION_SNAPSHOT_SCHEMA_VERSION,
            canonical,
            projectionSource: safeProjectionSource,
          } as Prisma.InputJsonValue,
          contentHash,
          actorType: snapshotInput.actorType ?? null,
          actorId: snapshotInput.actorId ?? null,
          reason: snapshotInput.reason ?? null,
          sourceRecordId: snapshotInput.sourceRecordId ?? null,
        },
      });
      const outbox = await tx.shopCatalogOutbox.create({
        data: {
          dedupeKey: plan.dedupeKey,
          entityType: plan.entityType,
          entityId: plan.entityId,
          productId: product.id,
          revisionId: revision.id,
          canonicalVersion: nextVersion,
          changeDomains: [...plan.changeDomains],
          payload: plan as unknown as Prisma.InputJsonValue,
        },
      });
      for (const target of plan.projectionTargets) {
        await tx.shopCatalogPublicationReceipt.upsert({
          where: {
            entityType_entityId_target: {
              entityType: plan.entityType,
              entityId: plan.entityId,
              target,
            },
          },
          create: {
            entityType: plan.entityType,
            entityId: plan.entityId,
            target,
            productId: product.id,
            status: "SAVED",
          },
          update: {
            productId: product.id,
            processingVersion: null,
            failedVersion: null,
            status: "SAVED",
            lastError: null,
          },
        });
      }

      return Object.freeze({
        productId: product.id,
        previousVersion: product.catalogVersion.toString(),
        canonicalVersion: nextVersion.toString(),
        revisionId: revision.id,
        outboxId: outbox.id,
        dedupeKey: plan.dedupeKey,
        projectionTargets: Object.freeze([...plan.projectionTargets]),
        contentHash,
      });
}

export async function coordinateShopCatalogProductMutation(
  input: ShopCatalogCoordinatedMutationInput
): Promise<ShopCatalogCoordinatedMutationResult> {
  return prisma.$transaction(
    (tx) => coordinateShopCatalogProductMutationInTransaction(tx, input),
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 30_000,
    }
  );
}

/** Creates a new aggregate and its first immutable publication atomically. */
export async function coordinateShopCatalogProductCreation(
  input: ShopCatalogCoordinatedCreationInput
): Promise<ShopCatalogCoordinatedMutationResult> {
  const initialVersion = BigInt(1);
  return prisma.$transaction(
    async (tx) => {
      const productId = (await input.create(tx, initialVersion.toString())).trim();
      if (!productId) throw new Error("Catalog creation callback returned no product ID");
      const updated = await tx.shopProduct.updateMany({
        where: { id: productId, catalogVersion: BigInt(0) },
        data: { catalogVersion: initialVersion },
      });
      if (updated.count !== 1) {
        throw new Error(`New catalog product ${productId} must start at version 0`);
      }
      const snapshotInput = await input.snapshot(tx, productId, initialVersion.toString());
      const contentHash = hashCatalogBaselineValue(snapshotInput.canonical);
      const projectionSource = {
        ...snapshotInput.projectionSource,
        productId,
        sourceVersion: initialVersion.toString(),
        catalogVersion: initialVersion.toString(),
        canonicalContentHash: contentHash,
      } satisfies ShopCatalogProjectionSource;
      buildShopCatalogProjection(projectionSource);
      const safeProjectionSource = jsonRoundTrip(projectionSource, "projectionSource");
      const canonical = canonicalizeCatalogBaselineValue(snapshotInput.canonical);
      const plan = buildShopCatalogPublicationPlan({
        entityType: "PRODUCT",
        entityId: productId,
        canonicalVersion: initialVersion.toString(),
        changeDomains: input.changeDomains,
        oldSlug: null,
        newSlug: projectionSource.slug,
      });
      const revision = await tx.shopCatalogProductRevision.create({
        data: {
          productId,
          version: initialVersion,
          schemaVersion: SHOP_CATALOG_REVISION_SNAPSHOT_SCHEMA_VERSION,
          changeDomains: [...plan.changeDomains],
          snapshot: {
            schemaVersion: SHOP_CATALOG_REVISION_SNAPSHOT_SCHEMA_VERSION,
            canonical,
            projectionSource: safeProjectionSource,
          } as Prisma.InputJsonValue,
          contentHash,
          actorType: snapshotInput.actorType ?? null,
          actorId: snapshotInput.actorId ?? null,
          reason: snapshotInput.reason ?? null,
          sourceRecordId: snapshotInput.sourceRecordId ?? null,
        },
      });
      const outbox = await tx.shopCatalogOutbox.create({
        data: {
          dedupeKey: plan.dedupeKey,
          entityType: plan.entityType,
          entityId: plan.entityId,
          productId,
          revisionId: revision.id,
          canonicalVersion: initialVersion,
          changeDomains: [...plan.changeDomains],
          payload: plan as unknown as Prisma.InputJsonValue,
        },
      });
      for (const target of plan.projectionTargets) {
        await tx.shopCatalogPublicationReceipt.create({
          data: {
            entityType: plan.entityType,
            entityId: plan.entityId,
            target,
            productId,
            status: "SAVED",
          },
        });
      }
      return Object.freeze({
        productId,
        previousVersion: "0",
        canonicalVersion: initialVersion.toString(),
        revisionId: revision.id,
        outboxId: outbox.id,
        dedupeKey: plan.dedupeKey,
        projectionTargets: Object.freeze([...plan.projectionTargets]),
        contentHash,
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 }
  );
}
