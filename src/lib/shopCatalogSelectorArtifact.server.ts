import "server-only";

import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "./prisma";
import { SHOP_CATALOG_PROJECTION_SCHEMA_VERSION } from "./shopCatalogProjection.server";
import { SHOP_CATALOG_REBUILD_CHECKPOINT_ID } from "./shopCatalogRebuildCheckpoint.server";

/**
 * The fitment endpoint must never infer completeness from a non-empty set of
 * projection rows.  A rebuild can leave a perfectly valid looking prefix in
 * the tables while the remaining sources are still being imported.  This
 * bounded read checks the release marker, rebuild checkpoint and the rows that
 * would be exposed by the selector before the route consumes them.
 */
export type ShopCatalogSelectorArtifactReadiness = Readonly<{
  ready: boolean;
  reason:
    | "ready"
    | "state_missing"
    | "state_version_missing"
    | "state_version_mismatch"
    | "state_fingerprint_invalid"
    | "rebuild_checkpoint_missing"
    | "rebuild_incomplete"
    | "projection_schema_mismatch"
    | "projection_version_mismatch"
    | "projection_locale_incomplete"
    | "projection_policy_missing"
    | "projection_policy_incomplete"
    | "projection_clause_unverified"
    | "projection_constraint_unknown"
    | "projection_empty"
    | "schema_unavailable";
  projectionVersion: string | null;
  fingerprint: string | null;
}>;

type Version = string | number | bigint | null | undefined;

function normalizedVersion(value: Version) {
  if (value == null) return null;
  const raw = String(value).trim();
  return /^\d+$/u.test(raw) ? BigInt(raw).toString() : null;
}

function validFingerprint(value: string | null | undefined) {
  return typeof value === "string" && /^[a-f0-9]{64}$/iu.test(value.trim());
}

export type ShopCatalogSelectorArtifactReadinessInput = {
  state: {
    canonicalVersion: Version;
    projectionVersion: Version;
    fingerprint: string | null | undefined;
  } | null;
  checkpoint: { status: string; projectionSchemaVersion: number } | null;
  projection: {
    activePublishedProducts: number;
    localeCompleteProducts: number;
    versionMismatchRows: number;
    policyProducts: number;
    policyClauseMismatchProducts: number;
    unverifiedClauseProducts: number;
    unknownConstraintProducts: number;
  };
};

/** Pure gate used by both the DB loader and release tests. */
export function evaluateShopCatalogSelectorArtifactReadiness(
  input: ShopCatalogSelectorArtifactReadinessInput
): ShopCatalogSelectorArtifactReadiness {
  const state = input.state;
  const projectionVersion = normalizedVersion(state?.projectionVersion);
  const fingerprint = state?.fingerprint?.trim().toLowerCase() ?? null;
  const base = (reason: ShopCatalogSelectorArtifactReadiness["reason"], ready = false) =>
    Object.freeze({ ready, reason, projectionVersion, fingerprint });

  if (!state) return base("state_missing");
  if (!projectionVersion || !normalizedVersion(state.canonicalVersion))
    return base("state_version_missing");
  if (projectionVersion !== normalizedVersion(state.canonicalVersion))
    return base("state_version_mismatch");
  if (!validFingerprint(fingerprint)) return base("state_fingerprint_invalid");
  if (!input.checkpoint) return base("rebuild_checkpoint_missing");
  if (input.checkpoint.status !== "COMPLETED") return base("rebuild_incomplete");
  if (input.checkpoint.projectionSchemaVersion !== SHOP_CATALOG_PROJECTION_SCHEMA_VERSION)
    return base("projection_schema_mismatch");
  if (input.projection.activePublishedProducts < 1) return base("projection_empty");
  if (input.projection.versionMismatchRows > 0) return base("projection_version_mismatch");
  if (input.projection.localeCompleteProducts < input.projection.activePublishedProducts)
    return base("projection_locale_incomplete");
  if (input.projection.policyProducts < 1) return base("projection_policy_missing");
  // A single current policy is not enough: an active projection without its
  // policy would disappear from every selector query while the release marker
  // still looked healthy. Require one current policy for every exposed
  // product, and reject policies whose durable clause count does not match the
  // rows that were actually published.
  if (input.projection.policyProducts < input.projection.activePublishedProducts)
    return base("projection_policy_incomplete");
  if (input.projection.policyClauseMismatchProducts > 0)
    return base("projection_policy_incomplete");
  if (input.projection.unverifiedClauseProducts > 0) return base("projection_clause_unverified");
  if (input.projection.unknownConstraintProducts > 0) return base("projection_constraint_unknown");
  return base("ready", true);
}

type SelectorArtifactClient = Pick<PrismaClient, "$queryRaw">;

type ProjectionReadinessRow = {
  activePublishedProducts: bigint;
  localeCompleteProducts: bigint;
  versionMismatchRows: bigint;
  policyProducts: bigint;
  policyClauseMismatchProducts: bigint;
  unverifiedClauseProducts: bigint;
  unknownConstraintProducts: bigint;
};

function count(value: bigint | number | null | undefined) {
  const number = Number(value ?? 0);
  if (!Number.isSafeInteger(number) || number < 0) throw new TypeError("invalid selector count");
  return number;
}

function missingSchema(error: unknown) {
  const code = String((error as { code?: unknown })?.code ?? "");
  const message = String((error as { message?: unknown })?.message ?? "");
  return code === "P2021" || code === "42P01" || /relation .* does not exist/i.test(message);
}

/**
 * Reads only aggregate metadata. No product, policy or constraint rows are
 * materialized in a request, so this remains bounded even for a large catalog.
 * Any missing table or malformed release marker fails closed.
 */
export async function readShopCatalogSelectorArtifactReadiness(
  client: SelectorArtifactClient = prisma
): Promise<ShopCatalogSelectorArtifactReadiness> {
  if (client === prisma) {
    const now = Date.now();
    if (readinessCache && readinessCache.expiresAt > now) return readinessCache.value;
    if (readinessInFlight) return readinessInFlight;
    readinessInFlight = readShopCatalogSelectorArtifactReadinessUncached(client)
      .then((value) => {
        readinessCache = { value, expiresAt: Date.now() + SHOP_CATALOG_SELECTOR_READINESS_TTL_MS };
        return value;
      })
      .finally(() => {
        readinessInFlight = null;
      });
    return readinessInFlight;
  }
  return readShopCatalogSelectorArtifactReadinessUncached(client);
}

/** Keep the release check short-lived and single-flight in warm server isolates. */
export const SHOP_CATALOG_SELECTOR_READINESS_TTL_MS = 15_000 as const;
let readinessCache: {
  value: ShopCatalogSelectorArtifactReadiness;
  expiresAt: number;
} | null = null;
let readinessInFlight: Promise<ShopCatalogSelectorArtifactReadiness> | null = null;

async function readShopCatalogSelectorArtifactReadinessUncached(
  client: SelectorArtifactClient
): Promise<ShopCatalogSelectorArtifactReadiness> {
  try {
    const [stateRows, checkpointRows] = await Promise.all([
      client.$queryRaw<
        Array<{ canonicalVersion: bigint; projectionVersion: bigint; fingerprint: string | null }>
      >(Prisma.sql`
        SELECT "canonicalVersion", "projectionVersion", "fingerprint"
        FROM "ShopCatalogState"
        WHERE "id" = 'active'
        LIMIT 1
      `),
      client.$queryRaw<Array<{ status: string; projectionSchemaVersion: number }>>(Prisma.sql`
        SELECT "status", "projectionSchemaVersion"
        FROM "ShopCatalogRebuildCheckpoint"
        WHERE "id" = ${SHOP_CATALOG_REBUILD_CHECKPOINT_ID}
        LIMIT 1
      `),
    ]);
    const state = stateRows[0] ?? null;
    const checkpoint = checkpointRows[0] ?? null;
    if (!state || !checkpoint) {
      return evaluateShopCatalogSelectorArtifactReadiness({
        state,
        checkpoint,
        projection: {
          activePublishedProducts: 0,
          localeCompleteProducts: 0,
          versionMismatchRows: 0,
          policyProducts: 0,
          policyClauseMismatchProducts: 0,
          unverifiedClauseProducts: 0,
          unknownConstraintProducts: 0,
        },
      });
    }
    const projectionVersion = normalizedVersion(state.projectionVersion);
    if (!projectionVersion) {
      return evaluateShopCatalogSelectorArtifactReadiness({
        state,
        checkpoint,
        projection: {
          activePublishedProducts: 0,
          localeCompleteProducts: 0,
          versionMismatchRows: 0,
          policyProducts: 0,
          policyClauseMismatchProducts: 0,
          unverifiedClauseProducts: 0,
          unknownConstraintProducts: 0,
        },
      });
    }
    const rows = await client.$queryRaw<ProjectionReadinessRow[]>(Prisma.sql`
      WITH active AS (
        SELECT projection."productId",
               count(DISTINCT projection."locale")::bigint AS locale_count,
               count(*) FILTER (WHERE projection."projectionVersion" <> ${BigInt(projectionVersion)})::bigint AS version_mismatch
        FROM "ShopCatalogProjection" projection
        WHERE projection."isPublished" = true
          AND projection."statusKey" = 'ACTIVE'
          AND projection."locale" IN ('ua', 'en')
        GROUP BY projection."productId"
      ),
      current_policies AS (
        SELECT DISTINCT policy."productId", policy."targetKey", policy."sourceVersion", policy."clauseCount"
        FROM active
        JOIN "ShopCatalogProjectionPolicy" policy
          ON policy."productId" = active."productId"
         AND policy."sourceVersion" = ${BigInt(projectionVersion)}
      ),
      policy_clause_counts AS (
        SELECT policy."productId",
               policy."targetKey",
               policy."clauseCount",
               count(clause."id")::bigint AS actual_clause_count
        FROM current_policies policy
        LEFT JOIN "ShopCatalogProjectionClause" clause
          ON clause."targetKey" = policy."targetKey"
         AND clause."productId" = policy."productId"
         AND clause."sourceVersion" = policy."sourceVersion"
        GROUP BY policy."productId", policy."targetKey", policy."clauseCount"
      ),
      policy_gaps AS (
        SELECT DISTINCT "productId"
        FROM policy_clause_counts
        WHERE actual_clause_count <> "clauseCount"
      ),
      bad_clauses AS (
        SELECT DISTINCT clause."productId"
        FROM active
        JOIN "ShopCatalogProjectionClause" clause
          ON clause."productId" = active."productId"
         AND clause."sourceVersion" = ${BigInt(projectionVersion)}
          AND clause."verification" <> 'VERIFIED'
      ),
      unknown_constraints AS (
        SELECT DISTINCT constraint_row."productId"
        FROM active
        JOIN "ShopCatalogProjectionConstraint" constraint_row
          ON constraint_row."productId" = active."productId"
         AND constraint_row."sourceVersion" = ${BigInt(projectionVersion)}
          AND constraint_row."state" = 'UNKNOWN'
      )
      SELECT
        (SELECT count(*)::bigint FROM active) AS "activePublishedProducts",
        (SELECT count(*)::bigint FROM active WHERE locale_count = 2) AS "localeCompleteProducts",
        (SELECT coalesce(sum(version_mismatch), 0)::bigint FROM active) AS "versionMismatchRows",
        (SELECT count(DISTINCT "productId")::bigint FROM current_policies) AS "policyProducts",
        (SELECT count(DISTINCT "productId")::bigint FROM policy_gaps) AS "policyClauseMismatchProducts",
        (SELECT count(*)::bigint FROM bad_clauses) AS "unverifiedClauseProducts",
        (SELECT count(*)::bigint FROM unknown_constraints) AS "unknownConstraintProducts"
    `);
    const row = rows[0];
    if (!row) throw new Error("selector readiness aggregate is empty");
    return evaluateShopCatalogSelectorArtifactReadiness({
      state,
      checkpoint,
      projection: {
        activePublishedProducts: count(row.activePublishedProducts),
        localeCompleteProducts: count(row.localeCompleteProducts),
        versionMismatchRows: count(row.versionMismatchRows),
        policyProducts: count(row.policyProducts),
        policyClauseMismatchProducts: count(row.policyClauseMismatchProducts),
        unverifiedClauseProducts: count(row.unverifiedClauseProducts),
        unknownConstraintProducts: count(row.unknownConstraintProducts),
      },
    });
  } catch (error) {
    if (missingSchema(error))
      return Object.freeze({
        ready: false,
        reason: "schema_unavailable",
        projectionVersion: null,
        fingerprint: null,
      });
    throw error;
  }
}
