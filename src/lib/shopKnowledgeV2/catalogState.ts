import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";

export const SHOP_KNOWLEDGE_CATALOG_STATE_ID = "active";
const SHOP_KNOWLEDGE_CATALOG_FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;

type CatalogStateClient = PrismaClient | Prisma.TransactionClient;

export type ShopKnowledgeCatalogStateSnapshot = {
  available: boolean;
  revision: bigint | null;
  fingerprint: string | null;
};

function isMissingCatalogStateSchemaError(error: unknown) {
  const code = String((error as { code?: unknown })?.code ?? "");
  const message = String((error as { message?: unknown })?.message ?? "");
  return (
    code === "P2021" ||
    code === "42P01" ||
    /ShopKnowledgeCatalogState|relation .* does not exist/i.test(message)
  );
}

export function normalizeShopKnowledgeCatalogFingerprint(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return SHOP_KNOWLEDGE_CATALOG_FINGERPRINT_PATTERN.test(normalized) ? normalized : null;
}

export function isShopKnowledgeCatalogFingerprintCurrent(input: {
  actual: string | null | undefined;
  expected: string | null | undefined;
}) {
  const actual = normalizeShopKnowledgeCatalogFingerprint(input.actual);
  const expected = normalizeShopKnowledgeCatalogFingerprint(input.expected);
  return Boolean(actual && expected && actual === expected);
}

export function requiresShopKnowledgeCatalogRuntimeGuard(
  environment: Pick<NodeJS.ProcessEnv, "NODE_ENV" | "VERCEL_ENV">
) {
  if (environment.VERCEL_ENV) return environment.VERCEL_ENV === "production";
  return environment.NODE_ENV === "production";
}

export async function readShopKnowledgeCatalogState(
  client: CatalogStateClient
): Promise<ShopKnowledgeCatalogStateSnapshot> {
  try {
    const rows = await client.$queryRaw<Array<{ revision: bigint; fingerprint: string }>>(
      Prisma.sql`
        SELECT "revision", "fingerprint"
        FROM "ShopKnowledgeCatalogState"
        WHERE "id" = ${SHOP_KNOWLEDGE_CATALOG_STATE_ID}
        LIMIT 1
      `
    );
    const row = rows[0];
    const fingerprint = normalizeShopKnowledgeCatalogFingerprint(row?.fingerprint);
    return row && fingerprint
      ? { available: true, revision: row.revision, fingerprint }
      : { available: false, revision: null, fingerprint: null };
  } catch (error) {
    if (!isMissingCatalogStateSchemaError(error)) throw error;
    return { available: false, revision: null, fingerprint: null };
  }
}

export async function bumpShopKnowledgeCatalogState(
  client: CatalogStateClient,
  changedAt = new Date()
) {
  const fingerprint = createHash("sha256")
    .update("one-ai-v2-catalog-state\0", "utf8")
    .update(randomUUID(), "utf8")
    .update(changedAt.toISOString(), "utf8")
    .digest("hex");

  await client.$executeRaw(
    Prisma.sql`
      INSERT INTO "ShopKnowledgeCatalogState" (
        "id",
        "revision",
        "fingerprint",
        "updatedAt"
      )
      VALUES (
        ${SHOP_KNOWLEDGE_CATALOG_STATE_ID},
        1,
        ${fingerprint},
        ${changedAt}
      )
      ON CONFLICT ("id") DO UPDATE
      SET
        "revision" = "ShopKnowledgeCatalogState"."revision" + 1,
        "fingerprint" = EXCLUDED."fingerprint",
        "updatedAt" = EXCLUDED."updatedAt"
    `
  );

  return fingerprint;
}
