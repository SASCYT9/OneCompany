import assert from "node:assert/strict";
import test from "node:test";

import {
  buildShopCatalogReleaseEvidence,
  fingerprintCatalogSourceCoverage,
  readCommitBoundPerformance,
  SHOP_CATALOG_LOGICAL_SOURCES,
} from "../../../src/lib/shopCatalogReleaseEvidence";

const commit = "a".repeat(40);
const scale = { version: 1, commitSha: commit, sizes: [{ products: 500_000, measurements: [{ warmP95Ms: 81 }, { warmP95Ms: 92 }] }] };
const publication = { version: 1, commitSha: commit, p95Ms: 740 };

test("release performance artifacts are commit-bound and include 500k scale", () => {
  assert.deepEqual(readCommitBoundPerformance({ commitSha: commit, scale, publication }), { scaleP95Ms: 92, publicationP95Ms: 740 });
  assert.throws(() => readCommitBoundPerformance({ commitSha: "b".repeat(40), scale, publication }), /does not match commit/);
  assert.throws(() => readCommitBoundPerformance({ commitSha: commit, scale: { ...scale, sizes: [] }, publication }), /500000/);
});

test("source coverage fingerprint requires the exact 14-source set", () => {
  const sources = SHOP_CATALOG_LOGICAL_SOURCES.map((key) => ({ key, recordFingerprints: ["c".repeat(64)] }));
  assert.match(fingerprintCatalogSourceCoverage(sources), /^[a-f0-9]{64}$/);
  assert.throws(() => fingerprintCatalogSourceCoverage(sources.slice(1)), /14 logical sources/);
  assert.throws(() => fingerprintCatalogSourceCoverage(sources.map((entry, index) => index ? entry : { ...entry, recordFingerprints: [] })), /missing or invalid/);
});

test("release evidence has a bounded lifetime and exact immutable identity", () => {
  const evidence = buildShopCatalogReleaseEvidence({
    commitSha: commit,
    generatedAt: new Date("2026-09-01T12:00:00.000Z"),
    lifetimeMinutes: 120,
    sourceCoverageFingerprint: "d".repeat(64),
    projectionLag: 0,
    shadow: { sampledRequests: 1000, mismatches: 0, errorRate: 0 },
    performance: { scaleP95Ms: 92, publicationP95Ms: 740 },
  });
  assert.equal(evidence.expiresAt, "2026-09-01T14:00:00.000Z");
  assert.equal(evidence.sourcesReady, 14);
  assert.throws(() => buildShopCatalogReleaseEvidence({ ...evidence, generatedAt: new Date(), lifetimeMinutes: 1441 }), /1..1440/);
});
