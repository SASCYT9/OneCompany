import { createHash } from "node:crypto";

/**
 * The coverage unit used by the selector publisher.  A source is identified by
 * its immutable source revision, rather than by the latest row in the source
 * table.  This keeps a selector artifact from accidentally combining rows
 * produced by two different imports.
 */
export const SHOP_CATALOG_SOURCE_REVISION_COVERAGE_VERSION = 1 as const;

export type ShopCatalogSourceRevisionCoverageInput = {
  sourceId: string;
  revision: string | number | bigint;
  expectedRecords: number;
  observedRecords: number;
  readyRecords: number;
};

export type ShopCatalogSourceRevisionCoverage = {
  sourceId: string;
  revision: string;
  expectedRecords: number;
  observedRecords: number;
  readyRecords: number;
  coveragePercent: number;
  complete: boolean;
};

export type ShopCatalogSourceRevisionCoverageManifest = {
  version: typeof SHOP_CATALOG_SOURCE_REVISION_COVERAGE_VERSION;
  projectionVersion: string;
  selectorFingerprint: string;
  sources: readonly ShopCatalogSourceRevisionCoverage[];
  fingerprint: string;
};

export type ShopCatalogSourceRevisionCoverageDecision = Readonly<{
  status: "READY" | "BLOCKED";
  reasons: readonly string[];
  sourceCoverageFingerprint: string | null;
}>;

function normalizedRevision(value: string | number | bigint, field: string) {
  const normalized = String(value).trim();
  if (!normalized) throw new TypeError(`${field} is required`);
  return normalized;
}

function normalizedSourceId(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) throw new TypeError("sourceId is required");
  return normalized;
}

function count(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative safe integer`);
  }
  return value;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stableCoverageValue(value: ShopCatalogSourceRevisionCoverage) {
  return [
    value.sourceId,
    value.revision,
    value.expectedRecords,
    value.observedRecords,
    value.readyRecords,
    value.coveragePercent,
    value.complete ? "1" : "0",
  ].join("\u0000");
}

function coverageManifestFingerprint(input: {
  projectionVersion: string;
  selectorFingerprint: string;
  sources: readonly ShopCatalogSourceRevisionCoverage[];
}) {
  return sha256(
    [
      String(SHOP_CATALOG_SOURCE_REVISION_COVERAGE_VERSION),
      input.projectionVersion,
      input.selectorFingerprint.toLowerCase(),
      ...input.sources.map(stableCoverageValue),
    ].join("\n")
  );
}

function normalizeCoverage(
  input: ShopCatalogSourceRevisionCoverageInput
): ShopCatalogSourceRevisionCoverage {
  const sourceId = normalizedSourceId(input.sourceId);
  const revision = normalizedRevision(input.revision, `${sourceId}.revision`);
  const expectedRecords = count(input.expectedRecords, `${sourceId}.expectedRecords`);
  const observedRecords = count(input.observedRecords, `${sourceId}.observedRecords`);
  const readyRecords = count(input.readyRecords, `${sourceId}.readyRecords`);
  if (observedRecords > expectedRecords) {
    throw new RangeError(`${sourceId}.observedRecords cannot exceed expectedRecords`);
  }
  if (readyRecords > observedRecords) {
    throw new RangeError(`${sourceId}.readyRecords cannot exceed observedRecords`);
  }
  const coveragePercent = expectedRecords
    ? Math.round((observedRecords / expectedRecords) * 10_000) / 100
    : 100;
  return {
    sourceId,
    revision,
    expectedRecords,
    observedRecords,
    readyRecords,
    coveragePercent,
    complete: observedRecords === expectedRecords && readyRecords === expectedRecords,
  };
}

/**
 * Creates the immutable, deterministic coverage evidence consumed by a
 * selector publication job.  The source list is sorted and duplicate source
 * IDs are rejected so a caller cannot hide an incomplete revision behind a
 * second, complete row for the same source.
 */
export function buildShopCatalogSourceRevisionCoverageManifest(input: {
  projectionVersion: string | number | bigint;
  selectorFingerprint: string;
  sources: readonly ShopCatalogSourceRevisionCoverageInput[];
}): ShopCatalogSourceRevisionCoverageManifest {
  const projectionVersion = normalizedRevision(input.projectionVersion, "projectionVersion");
  if (!/^[a-f0-9]{64}$/iu.test(input.selectorFingerprint)) {
    throw new TypeError("selectorFingerprint must be a SHA-256 hex digest");
  }
  if (!input.sources.length) throw new TypeError("at least one source coverage entry is required");
  const sources = input.sources
    .map(normalizeCoverage)
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId, "en"));
  const duplicate = sources.find(
    (source, index) => source.sourceId === sources[index - 1]?.sourceId
  );
  if (duplicate) throw new TypeError(`duplicate source coverage entry: ${duplicate.sourceId}`);
  return Object.freeze({
    version: SHOP_CATALOG_SOURCE_REVISION_COVERAGE_VERSION,
    projectionVersion,
    selectorFingerprint: input.selectorFingerprint.toLowerCase(),
    sources: Object.freeze(sources.map((source) => Object.freeze(source))),
    fingerprint: coverageManifestFingerprint({
      projectionVersion,
      selectorFingerprint: input.selectorFingerprint,
      sources,
    }),
  });
}

/**
 * Fails closed unless every required source has exactly one complete revision
 * entry.  A selector publisher should call this before writing or activating
 * an artifact; a partial source must remain available only as raw evidence.
 */
export function evaluateShopCatalogSelectorPublication(input: {
  manifest: ShopCatalogSourceRevisionCoverageManifest | null;
  requiredSourceIds: readonly string[];
}): ShopCatalogSourceRevisionCoverageDecision {
  const reasons: string[] = [];
  const manifest = input.manifest;
  const required = input.requiredSourceIds.map(normalizedSourceId);
  const requiredSet = new Set(required);
  if (requiredSet.size !== required.length) reasons.push("required source set contains duplicates");
  if (!manifest) {
    reasons.push("source revision coverage manifest is missing");
    return { status: "BLOCKED", reasons: Object.freeze(reasons), sourceCoverageFingerprint: null };
  }
  if (manifest.version !== SHOP_CATALOG_SOURCE_REVISION_COVERAGE_VERSION) {
    reasons.push("source revision coverage manifest version is unsupported");
  }
  if (typeof manifest.projectionVersion !== "string" || !manifest.projectionVersion.trim()) {
    reasons.push("projectionVersion is required");
  }
  if (
    typeof manifest.selectorFingerprint !== "string" ||
    !/^[a-f0-9]{64}$/iu.test(manifest.selectorFingerprint)
  ) {
    reasons.push("selectorFingerprint is invalid");
  }
  if (typeof manifest.fingerprint !== "string" || !/^[a-f0-9]{64}$/iu.test(manifest.fingerprint)) {
    reasons.push("source coverage fingerprint is invalid");
  } else if (
    typeof manifest.projectionVersion === "string" &&
    typeof manifest.selectorFingerprint === "string" &&
    Array.isArray(manifest.sources) &&
    manifest.fingerprint !==
      coverageManifestFingerprint({
        projectionVersion: manifest.projectionVersion,
        selectorFingerprint: manifest.selectorFingerprint,
        sources: manifest.sources,
      })
  ) {
    reasons.push("source coverage fingerprint does not match manifest contents");
  }
  const seen = new Set<string>();
  for (const source of manifest.sources) {
    const sourceId =
      typeof source.sourceId === "string" ? source.sourceId.trim().toLowerCase() : "";
    const sourceRevision = typeof source.revision === "string" ? source.revision.trim() : "";
    if (!sourceId) {
      reasons.push("source coverage entry has no sourceId");
      continue;
    }
    if (seen.has(sourceId)) reasons.push(`duplicate source coverage entry: ${sourceId}`);
    seen.add(sourceId);
    if (!sourceRevision) reasons.push(`missing source revision for ${sourceId}`);
    const validCounts = [source.expectedRecords, source.observedRecords, source.readyRecords].every(
      (value) => Number.isSafeInteger(value) && value >= 0
    );
    if (!validCounts) {
      reasons.push(`invalid record counts for ${sourceId}@${sourceRevision}`);
      continue;
    }
    if (source.observedRecords > source.expectedRecords) {
      reasons.push(`${sourceId}@${sourceRevision} observed records exceed expected records`);
    }
    if (source.readyRecords > source.observedRecords) {
      reasons.push(`${sourceId}@${sourceRevision} ready records exceed observed records`);
    }
    const expectedComplete =
      source.observedRecords === source.expectedRecords &&
      source.readyRecords === source.expectedRecords;
    if (source.complete !== expectedComplete) {
      reasons.push(`${sourceId}@${sourceRevision} complete flag does not match record counts`);
    }
    if (!expectedComplete) {
      reasons.push(
        `${sourceId}@${sourceRevision} coverage is incomplete (${source.observedRecords}/${source.expectedRecords} records, ${source.readyRecords} ready)`
      );
    }
  }
  for (const sourceId of requiredSet) {
    if (!seen.has(sourceId)) reasons.push(`missing required source coverage: ${sourceId}`);
  }
  for (const sourceId of seen) {
    if (!requiredSet.has(sourceId)) reasons.push(`unexpected source coverage: ${sourceId}`);
  }
  return Object.freeze({
    status: reasons.length ? "BLOCKED" : "READY",
    reasons: Object.freeze(reasons),
    sourceCoverageFingerprint: reasons.length ? null : manifest.fingerprint,
  });
}
