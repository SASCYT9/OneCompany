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

export async function coordinateShopCatalogProductMutation(
  input: ShopCatalogCoordinatedMutationInput
): Promise<ShopCatalogCoordinatedMutationResult> {
  if (!input.productId.trim()) throw new TypeError("productId is required");
  const expected = expectedVersion(input.expectedCatalogVersion);
  return prisma.$transaction(
    async (tx) => {
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

      await tx.shopProduct.update({
        where: { id: product.id },
        data: { catalogVersion: nextVersion },
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
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 30_000,
    }
  );
}
