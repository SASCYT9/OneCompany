import "server-only";

import { Prisma, type PrismaClient } from "@prisma/client";

import {
  buildShopCatalogPublicationPlan,
  type ShopCatalogChangeDomain,
} from "./shopCatalogPublication";

const MAX_POSTGRES_BIGINT = BigInt("9223372036854775807");

export type ShopCatalogGlobalPublication = {
  entityType: "PRICE_BOOK" | "SETTINGS";
  entityId: string;
  changeDomains: readonly ShopCatalogChangeDomain[];
};

export type ShopCatalogGlobalPublicationResult = {
  entityType: "PRICE_BOOK" | "SETTINGS";
  entityId: string;
  previousVersion: string;
  canonicalVersion: string;
  outboxId: string;
  dedupeKey: string;
  projectionTargets: readonly string[];
};

type LockedGlobalVersion = {
  entityType: "PRICE_BOOK" | "SETTINGS";
  entityId: string;
  currentVersion: bigint;
};

function normalizePublications(publications: readonly ShopCatalogGlobalPublication[]) {
  if (!publications.length) throw new TypeError("At least one global publication is required");
  const identities = new Set<string>();
  return [...publications]
    .map((publication) => {
      const entityId = publication.entityId.trim();
      if (!entityId) throw new TypeError("Global publication entityId is required");
      const identity = `${publication.entityType}:${entityId}`;
      if (identities.has(identity)) throw new TypeError(`Duplicate global publication ${identity}`);
      identities.add(identity);
      return { ...publication, entityId };
    })
    .sort((left, right) =>
      `${left.entityType}:${left.entityId}`.localeCompare(`${right.entityType}:${right.entityId}`)
    );
}

/**
 * Commits a global settings/price-book mutation and every publication cursor in
 * one Serializable transaction. Stable lock ordering prevents cross-route
 * deadlocks when one settings write advances both global aggregates.
 */
export async function coordinateShopCatalogGlobalMutationInTransaction<T>(
  tx: Prisma.TransactionClient,
  input: {
    publications: readonly ShopCatalogGlobalPublication[];
    mutate(tx: Prisma.TransactionClient): Promise<T>;
  }
): Promise<{ value: T; publications: readonly ShopCatalogGlobalPublicationResult[] }> {
  const publications = normalizePublications(input.publications);
  const locked: LockedGlobalVersion[] = [];

  for (const publication of publications) {
    await tx.$executeRaw`
      INSERT INTO "ShopCatalogGlobalVersion"
        ("entityType", "entityId", "currentVersion", "createdAt", "updatedAt")
      VALUES
        (${publication.entityType}::"ShopCatalogPublicationEntityType", ${publication.entityId}, 0, NOW(), NOW())
      ON CONFLICT ("entityType", "entityId") DO NOTHING
    `;
    const rows = await tx.$queryRaw<LockedGlobalVersion[]>`
      SELECT "entityType", "entityId", "currentVersion"
      FROM "ShopCatalogGlobalVersion"
      WHERE "entityType" = ${publication.entityType}::"ShopCatalogPublicationEntityType"
        AND "entityId" = ${publication.entityId}
      FOR UPDATE
    `;
    if (!rows[0])
      throw new Error(
        `Could not lock global catalog version ${publication.entityType}:${publication.entityId}`
      );
    locked.push(rows[0]);
  }

  const value = await input.mutate(tx);
  const results: ShopCatalogGlobalPublicationResult[] = [];

  for (let index = 0; index < publications.length; index += 1) {
    const publication = publications[index]!;
    const cursor = locked[index]!;
    const nextVersion = cursor.currentVersion + BigInt(1);
    if (nextVersion > MAX_POSTGRES_BIGINT) throw new Error("Global catalog version overflow");
    const advanced = await tx.$executeRaw`
      UPDATE "ShopCatalogGlobalVersion"
      SET "currentVersion" = ${nextVersion}, "updatedAt" = NOW()
      WHERE "entityType" = ${publication.entityType}::"ShopCatalogPublicationEntityType"
        AND "entityId" = ${publication.entityId}
        AND "currentVersion" = ${cursor.currentVersion}
    `;
    if (advanced !== 1)
      throw new Error(
        `Could not advance global catalog version ${publication.entityType}:${publication.entityId}`
      );

    const plan = buildShopCatalogPublicationPlan({
      entityType: publication.entityType,
      entityId: publication.entityId,
      canonicalVersion: nextVersion.toString(),
      changeDomains: publication.changeDomains,
    });
    const outbox = await tx.shopCatalogOutbox.create({
      data: {
        dedupeKey: plan.dedupeKey,
        entityType: plan.entityType,
        entityId: plan.entityId,
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
          status: "SAVED",
        },
        update: {
          processingVersion: null,
          failedVersion: null,
          status: "SAVED",
          lastError: null,
        },
      });
    }
    results.push({
      entityType: publication.entityType,
      entityId: publication.entityId,
      previousVersion: cursor.currentVersion.toString(),
      canonicalVersion: nextVersion.toString(),
      outboxId: outbox.id,
      dedupeKey: plan.dedupeKey,
      projectionTargets: Object.freeze([...plan.projectionTargets]),
    });
  }

  return { value, publications: Object.freeze(results) };
}

export async function coordinateShopCatalogGlobalMutationWithClient<T>(
  client: PrismaClient,
  input: {
    publications: readonly ShopCatalogGlobalPublication[];
    mutate(tx: Prisma.TransactionClient): Promise<T>;
  }
) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await client.$transaction(
        (tx) => coordinateShopCatalogGlobalMutationInTransaction(tx, input),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 30_000,
        }
      );
    } catch (error) {
      const rawSerializationConflict =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2010" &&
        typeof error.meta === "object" &&
        error.meta !== null &&
        error.meta.code === "40001";
      const retryable =
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") ||
        rawSerializationConflict;
      if (!retryable || attempt === 3) throw error;
    }
  }
  throw new Error("Global catalog transaction retry loop exhausted");
}
