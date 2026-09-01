import { createHash } from "node:crypto";

import {
  SHOP_CATALOG_OWNERSHIP_FINGERPRINT,
  type ShopCatalogReleaseEvidence,
} from "./shopCatalogReleaseActivationGuard";

export const SHOP_CATALOG_LOGICAL_SOURCES = Object.freeze([
  "adro", "akrapovic", "brabus", "burger", "csf", "do88", "eventuri",
  "girodisc", "ilmberger", "ipe", "ohlins", "racechip", "remus", "urban",
] as const);

type PerformanceArtifact = Record<string, unknown>;

function finite(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} is missing or invalid`);
  }
  return value;
}

export function readCommitBoundPerformance(input: {
  commitSha: string;
  scale: PerformanceArtifact;
  publication: PerformanceArtifact;
}) {
  for (const [label, artifact] of [["scale", input.scale], ["publication", input.publication]] as const) {
    if (artifact.version !== 1 || artifact.commitSha !== input.commitSha) {
      throw new Error(`${label} gate artifact does not match commit ${input.commitSha}`);
    }
  }
  const sizes = input.scale.sizes;
  if (!Array.isArray(sizes) || !sizes.some((entry) => typeof entry === "object" && entry !== null && Number((entry as Record<string, unknown>).products) >= 500_000)) {
    throw new Error("scale gate must include at least 500000 products");
  }
  const measurements = sizes.flatMap((entry) =>
    Array.isArray((entry as Record<string, unknown>).measurements)
      ? ((entry as Record<string, unknown>).measurements as Array<Record<string, unknown>>)
      : []
  );
  if (!measurements.length) throw new Error("scale gate has no measurements");
  return Object.freeze({
    scaleP95Ms: Math.max(...measurements.map((entry) => finite(entry.warmP95Ms, "scale warmP95Ms"))),
    publicationP95Ms: finite(input.publication.p95Ms, "publication p95Ms"),
  });
}

export function fingerprintCatalogSourceCoverage(
  sources: readonly { key: string; recordFingerprints: readonly string[] }[]
) {
  if (sources.length !== SHOP_CATALOG_LOGICAL_SOURCES.length) throw new Error("all 14 logical sources are required");
  const expected = SHOP_CATALOG_LOGICAL_SOURCES.join("\n");
  const ordered = [...sources].sort((a, b) => a.key.localeCompare(b.key));
  if (ordered.map((source) => source.key).join("\n") !== expected) throw new Error("logical source set is incomplete or unexpected");
  if (ordered.some((source) => !source.recordFingerprints.length || source.recordFingerprints.some((value) => !/^[a-f0-9]{64}$/i.test(value)))) {
    throw new Error("source coverage contains missing or invalid record fingerprints");
  }
  return createHash("sha256")
    .update(ordered.map((source) => `${source.key}:${source.recordFingerprints.join(",")}`).join("\n"))
    .digest("hex");
}

export function buildShopCatalogReleaseEvidence(input: {
  commitSha: string;
  generatedAt: Date;
  lifetimeMinutes: number;
  sourceCoverageFingerprint: string;
  projectionLag: number;
  shadow: { sampledRequests: number; mismatches: number; errorRate: number; windowHours: number };
  performance: { scaleP95Ms: number; publicationP95Ms: number };
  rollout: { maxCanaryPercentage: number; fullSsrApproved: boolean; approvedBy: string };
}): ShopCatalogReleaseEvidence {
  if (!/^[a-f0-9]{40}$/.test(input.commitSha)) throw new Error("full commit SHA is required");
  if (!Number.isInteger(input.lifetimeMinutes) || input.lifetimeMinutes < 1 || input.lifetimeMinutes > 1440) throw new Error("evidence lifetime must be 1..1440 minutes");
  if (!Number.isInteger(input.rollout.maxCanaryPercentage) || input.rollout.maxCanaryPercentage < 1 || input.rollout.maxCanaryPercentage > 100) throw new Error("max canary percentage must be 1..100");
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._@-]{2,119}$/u.test(input.rollout.approvedBy.trim())) throw new Error("decision owner is required");
  return {
    version: 2,
    commitSha: input.commitSha,
    generatedAt: input.generatedAt.toISOString(),
    expiresAt: new Date(input.generatedAt.getTime() + input.lifetimeMinutes * 60_000).toISOString(),
    ownershipFingerprint: SHOP_CATALOG_OWNERSHIP_FINGERPRINT,
    sourceCoverageFingerprint: input.sourceCoverageFingerprint,
    sourcesReady: SHOP_CATALOG_LOGICAL_SOURCES.length,
    projectionLag: input.projectionLag,
    shadow: input.shadow,
    performance: input.performance,
    rollout: input.rollout,
  };
}
