import "server-only";

import { Prisma, type PrismaClient } from "@prisma/client";

import {
  evaluateShopCatalogSelectorPublication,
  type ShopCatalogSourceRevisionCoverageManifest,
} from "./shopCatalogSourceRevisionCoverage";
import { SHOP_CATALOG_PROJECTION_SCHEMA_VERSION } from "./shopCatalogProjection.server";
import { SHOP_CATALOG_REBUILD_CHECKPOINT_ID } from "./shopCatalogRebuildCheckpoint.server";

/**
 * ShopCatalogState already has one immutable hash slot and two monotonic
 * version slots.  The marker uses those existing columns as follows:
 *
 *   fingerprint       = source revision coverage fingerprint
 *   canonicalVersion  = projectionVersion
 *   projectionVersion = projectionVersion
 *
 * The coverage fingerprint itself includes the selector fingerprint and all
 * source revisions, so no lossy JSON encoding or schema migration is needed.
 */
export const SHOP_CATALOG_SOURCE_COVERAGE_MARKER_VERSION = 1 as const;
export const SHOP_CATALOG_SOURCE_COVERAGE_MARKER_ID = "active" as const;

type Version = string | number | bigint | null | undefined;

export type ShopCatalogSourceCoverageMarker = Readonly<{
  markerVersion: typeof SHOP_CATALOG_SOURCE_COVERAGE_MARKER_VERSION;
  projectionVersion: string;
  sourceCoverageFingerprint: string;
}>;

export type ShopCatalogSourceCoverageMarkerState = Readonly<{
  canonicalVersion: string;
  projectionVersion: string;
  fingerprint: string | null;
}>;

export type ShopCatalogSourceCoverageMarkerDecision =
  | "INSERT"
  | "NEWER_VERSION"
  | "IDEMPOTENT"
  | "STALE_VERSION"
  | "VERSION_CONFLICT"
  | "INCONSISTENT_CURRENT_STATE";

export type ShopCatalogSourceCoverageMarkerPlan = Readonly<{
  apply: boolean;
  decision: ShopCatalogSourceCoverageMarkerDecision;
  marker: ShopCatalogSourceCoverageMarker;
}>;

function normalizedVersion(value: Version, field: string) {
  if (value == null) throw new TypeError(`${field} is required`);
  const normalized = String(value).trim();
  if (!/^\d+$/u.test(normalized))
    throw new TypeError(`${field} must be an unsigned decimal integer`);
  return BigInt(normalized).toString();
}

function validFingerprint(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/iu.test(value.trim());
}

/** Build a marker only from a manifest that passed the complete source gate. */
export function buildShopCatalogSourceCoverageMarker(input: {
  manifest: ShopCatalogSourceRevisionCoverageManifest;
  requiredSourceIds: readonly string[];
}): ShopCatalogSourceCoverageMarker {
  const decision = evaluateShopCatalogSelectorPublication({
    manifest: input.manifest,
    requiredSourceIds: input.requiredSourceIds,
  });
  if (decision.status !== "READY" || !decision.sourceCoverageFingerprint) {
    throw new Error(`Source coverage marker blocked: ${decision.reasons.join("; ")}`);
  }
  const projectionVersion = normalizedVersion(
    input.manifest.projectionVersion,
    "projectionVersion"
  );
  if (!validFingerprint(decision.sourceCoverageFingerprint)) {
    throw new TypeError("sourceCoverageFingerprint must be a SHA-256 hex digest");
  }
  return Object.freeze({
    markerVersion: SHOP_CATALOG_SOURCE_COVERAGE_MARKER_VERSION,
    projectionVersion,
    sourceCoverageFingerprint: decision.sourceCoverageFingerprint.toLowerCase(),
  });
}

function stateVersion(
  state: ShopCatalogSourceCoverageMarkerState,
  field: "canonicalVersion" | "projectionVersion"
) {
  try {
    return normalizedVersion(state[field], field);
  } catch {
    return null;
  }
}

/**
 * Pure monotonic decision. The database writer locks the state row before
 * calling this function, so a retry cannot overwrite a newer marker.
 */
export function planShopCatalogSourceCoverageMarker(input: {
  current: ShopCatalogSourceCoverageMarkerState | null;
  marker: ShopCatalogSourceCoverageMarker;
}): ShopCatalogSourceCoverageMarkerPlan {
  const current = input.current;
  if (!current) {
    return Object.freeze({ apply: true, decision: "INSERT", marker: input.marker });
  }
  const canonicalVersion = stateVersion(current, "canonicalVersion");
  const projectionVersion = stateVersion(current, "projectionVersion");
  if (!canonicalVersion || !projectionVersion || canonicalVersion !== projectionVersion) {
    return Object.freeze({
      apply: false,
      decision: "INCONSISTENT_CURRENT_STATE",
      marker: input.marker,
    });
  }
  const incomingVersion = BigInt(input.marker.projectionVersion);
  const currentVersion = BigInt(projectionVersion);
  if (incomingVersion < currentVersion) {
    return Object.freeze({ apply: false, decision: "STALE_VERSION", marker: input.marker });
  }
  if (incomingVersion > currentVersion) {
    return Object.freeze({ apply: true, decision: "NEWER_VERSION", marker: input.marker });
  }
  if (current.fingerprint?.trim().toLowerCase() === input.marker.sourceCoverageFingerprint) {
    return Object.freeze({ apply: false, decision: "IDEMPOTENT", marker: input.marker });
  }
  return Object.freeze({ apply: false, decision: "VERSION_CONFLICT", marker: input.marker });
}

type MarkerClient = Pick<PrismaClient, "$queryRaw" | "$executeRaw">;

type CheckpointRow = { status: string; projectionSchemaVersion: number };
type StateRow = {
  canonicalVersion: bigint;
  projectionVersion: bigint;
  fingerprint: string | null;
};

function missingSchema(error: unknown) {
  const code = String((error as { code?: unknown })?.code ?? "");
  const message = String((error as { message?: unknown })?.message ?? "");
  return code === "P2021" || code === "42P01" || /relation .* does not exist/i.test(message);
}

function markerState(row: StateRow): ShopCatalogSourceCoverageMarkerState {
  return Object.freeze({
    canonicalVersion: row.canonicalVersion.toString(),
    projectionVersion: row.projectionVersion.toString(),
    fingerprint: row.fingerprint?.trim().toLowerCase() ?? null,
  });
}

/** Read the persisted marker without materializing catalog rows. */
export async function readShopCatalogSourceCoverageMarker(
  client: Pick<PrismaClient, "$queryRaw">,
  stateId: string = SHOP_CATALOG_SOURCE_COVERAGE_MARKER_ID
): Promise<ShopCatalogSourceCoverageMarker | null> {
  const rows = await client.$queryRaw<StateRow[]>(Prisma.sql`
    SELECT "canonicalVersion", "projectionVersion", "fingerprint"
    FROM "ShopCatalogState"
    WHERE "id" = ${stateId}
    LIMIT 1
  `);
  const row = rows[0];
  if (!row || !validFingerprint(row.fingerprint)) return null;
  const state = markerState(row);
  const version = stateVersion(state, "projectionVersion");
  if (!version || version !== stateVersion(state, "canonicalVersion")) return null;
  return Object.freeze({
    markerVersion: SHOP_CATALOG_SOURCE_COVERAGE_MARKER_VERSION,
    projectionVersion: version,
    sourceCoverageFingerprint: row.fingerprint.trim().toLowerCase(),
  });
}

/**
 * Publishes the marker after a completed projection checkpoint. The state row
 * is locked and all writes are monotonic. Missing schema remains an explicit
 * failure; a caller must never silently treat an unavailable marker table as
 * a complete release.
 */
async function persistMarkerInTransaction(
  tx: MarkerClient,
  marker: ShopCatalogSourceCoverageMarker,
  checkpointId: string
): Promise<ShopCatalogSourceCoverageMarkerPlan> {
  const checkpointRows = await tx.$queryRaw<CheckpointRow[]>(Prisma.sql`
      SELECT "status", "projectionSchemaVersion"
      FROM "ShopCatalogRebuildCheckpoint"
      WHERE "id" = ${checkpointId}
      FOR SHARE
    `);
  const checkpoint = checkpointRows[0];
  if (!checkpoint || checkpoint.status !== "COMPLETED") {
    throw new Error("Source coverage marker requires a completed projection checkpoint");
  }
  if (checkpoint.projectionSchemaVersion !== SHOP_CATALOG_PROJECTION_SCHEMA_VERSION) {
    throw new Error("Source coverage marker projection schema version is stale");
  }

  // The checkpoint proves that the bounded rebuild finished, while this
  // aggregate proves that the rows being exposed belong to this exact
  // marker version. It returns counts only and never materializes products.
  const projectionRows = await tx.$queryRaw<
    Array<{
      activeProducts: bigint;
      incompleteLocaleProducts: bigint;
      mismatchedRows: bigint;
    }>
  >(Prisma.sql`
      WITH active AS (
        SELECT "productId",
               count(DISTINCT "locale") AS locale_count,
               count(*) FILTER (WHERE "projectionVersion" <> ${BigInt(marker.projectionVersion)}) AS mismatched_rows
        FROM "ShopCatalogProjection"
        WHERE "isPublished" = true
          AND "statusKey" = 'ACTIVE'
          AND "locale" IN ('ua', 'en')
        GROUP BY "productId"
      )
      SELECT
        count(*)::bigint AS "activeProducts",
        count(*) FILTER (WHERE locale_count <> 2)::bigint AS "incompleteLocaleProducts",
        coalesce(sum(mismatched_rows), 0)::bigint AS "mismatchedRows"
      FROM active
    `);
  const projection = projectionRows[0];
  if (!projection || Number(projection.activeProducts) < 1) {
    throw new Error("Source coverage marker requires an active published projection");
  }
  if (Number(projection.incompleteLocaleProducts) > 0 || Number(projection.mismatchedRows) > 0) {
    throw new Error("Source coverage marker requires complete current-locale projection rows");
  }

  const stateRows = await tx.$queryRaw<StateRow[]>(Prisma.sql`
      SELECT "canonicalVersion", "projectionVersion", "fingerprint"
      FROM "ShopCatalogState"
      WHERE "id" = ${SHOP_CATALOG_SOURCE_COVERAGE_MARKER_ID}
      FOR UPDATE
    `);
  const current = stateRows[0] ? markerState(stateRows[0]) : null;
  const plan = planShopCatalogSourceCoverageMarker({ current, marker });
  if (plan.decision === "VERSION_CONFLICT") {
    throw new Error("Source coverage marker conflicts with the current projection version");
  }
  if (plan.decision === "INCONSISTENT_CURRENT_STATE") {
    throw new Error("Current catalog state has inconsistent versions");
  }
  if (!plan.apply) return plan;

  await tx.$executeRaw(Prisma.sql`
      INSERT INTO "ShopCatalogState" (
        "id", "canonicalVersion", "projectionVersion", "fingerprint", "updatedAt"
      ) VALUES (
        ${SHOP_CATALOG_SOURCE_COVERAGE_MARKER_ID},
        ${BigInt(marker.projectionVersion)},
        ${BigInt(marker.projectionVersion)},
        ${marker.sourceCoverageFingerprint},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("id") DO UPDATE SET
        "canonicalVersion" = EXCLUDED."canonicalVersion",
        "projectionVersion" = EXCLUDED."projectionVersion",
        "fingerprint" = EXCLUDED."fingerprint",
        "updatedAt" = CURRENT_TIMESTAMP
    `);
  return plan;
}

export async function persistShopCatalogSourceCoverageMarker(input: {
  manifest: ShopCatalogSourceRevisionCoverageManifest;
  requiredSourceIds: readonly string[];
  checkpointId?: string;
}): Promise<ShopCatalogSourceCoverageMarkerPlan> {
  const marker = buildShopCatalogSourceCoverageMarker(input);

  try {
    const { prisma } = await import("./prisma");
    return await prisma.$transaction(
      async (tx) =>
        persistMarkerInTransaction(
          tx,
          marker,
          input.checkpointId ?? SHOP_CATALOG_REBUILD_CHECKPOINT_ID
        ),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );
  } catch (error) {
    if (missingSchema(error)) {
      throw new Error("Cannot persist source coverage marker: catalog state schema is unavailable");
    }
    throw error;
  }
}

/**
 * Transaction-owned variant for a rebuild/publication coordinator. The
 * caller must supply a transaction client; this keeps marker persistence in
 * the same commit as its publication state when the coordinator owns one.
 */
export async function persistShopCatalogSourceCoverageMarkerWithClient(
  client: MarkerClient,
  input: {
    manifest: ShopCatalogSourceRevisionCoverageManifest;
    requiredSourceIds: readonly string[];
    checkpointId?: string;
  }
): Promise<ShopCatalogSourceCoverageMarkerPlan> {
  const marker = buildShopCatalogSourceCoverageMarker(input);
  return persistMarkerInTransaction(
    client,
    marker,
    input.checkpointId ?? SHOP_CATALOG_REBUILD_CHECKPOINT_ID
  );
}
