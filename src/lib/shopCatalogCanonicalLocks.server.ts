import "server-only";

import { Prisma, type PrismaClient } from "@prisma/client";

type CatalogLockClient = Prisma.TransactionClient | PrismaClient;

export function catalogSourceBindingLockKey(input: {
  sourceId: string;
  entityType: "PRODUCT" | "VARIANT";
  externalKey: string;
}) {
  return `catalog:binding:${input.sourceId}:${input.entityType}:${input.externalKey}`;
}

export function catalogCompatibilityTargetLockKey(input: {
  productId: string;
  variantId: string | null;
}) {
  return `catalog:compatibility:${input.variantId ? `variant:${input.variantId}` : `product:${input.productId}`}`;
}

/**
 * Serializes canonical promotions across every importer process. Locks are
 * transaction-scoped and sorted so callers that need the same keys cannot
 * deadlock merely because they discovered them in a different order.
 */
export async function acquireCatalogCanonicalLocks(
  client: CatalogLockClient,
  keys: readonly string[]
) {
  const orderedKeys = [...new Set(keys)].sort((left, right) => left.localeCompare(right));
  for (const lockKey of orderedKeys) {
    await client.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`
      SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0)) IS NULL AS locked
    `);
  }
}
