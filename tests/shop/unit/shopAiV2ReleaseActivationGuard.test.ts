import assert from "node:assert/strict";
import test from "node:test";

import {
  createShopAiV2ReleaseGateMarker,
  evaluateShopAiV2ReleaseActivationGuard,
  normalizeShopAiCommitSha,
  readShopAiV2ReleaseActivationGuardInput,
  SHOP_AI_V2_RELEASE_MIN_CASES,
  validateShopAiV2ReleaseEvalReport,
  verifyShopAiV2ReleaseGateMarker,
} from "../../../src/lib/shopAiV2ReleaseActivationGuard";

const COMMIT_SHA = "a".repeat(40);
const OTHER_COMMIT_SHA = "b".repeat(40);
const CORPUS_SHA256 = "c".repeat(64);
const EVAL_REPORT_SHA256 = "d".repeat(64);
const CATALOG_FINGERPRINT = "e".repeat(64);
const OTHER_CATALOG_FINGERPRINT = "f".repeat(64);
const SIGNING_SECRET = "release-gate-secret-with-at-least-32-bytes";

function markerForCommit(commitSha = COMMIT_SHA) {
  return createShopAiV2ReleaseGateMarker(
    {
      commitSha,
      corpusSha256: CORPUS_SHA256,
      evalReportSha256: EVAL_REPORT_SHA256,
      catalogFingerprint: CATALOG_FINGERPRINT,
      evaluatedAt: "2026-07-17T12:00:00.000Z",
      expiresAt: "2026-07-18T12:00:00.000Z",
      repository: "one-company/storefront",
      workflowRunId: "123456789",
      workflowRunAttempt: 1,
    },
    SIGNING_SECRET
  );
}

test("a valid signed marker is normalized, verified, and bound to its commit", () => {
  const marker = markerForCommit(COMMIT_SHA.toUpperCase());
  const verification = verifyShopAiV2ReleaseGateMarker(marker, SIGNING_SECRET);

  assert.equal(verification.ok, true);
  if (verification.ok) {
    assert.equal(verification.payload.commitSha, COMMIT_SHA);
    assert.equal(verification.payload.corpusSha256, CORPUS_SHA256);
    assert.equal(verification.payload.evalReportSha256, EVAL_REPORT_SHA256);
    assert.equal(verification.payload.catalogFingerprint, CATALOG_FINGERPRINT);
  }
});

function passingEvalReport() {
  return {
    schemaVersion: 2,
    generatedAt: "2026-07-17T12:00:00.000Z",
    expectedCommit: COMMIT_SHA,
    catalogFingerprint: CATALOG_FINGERPRINT,
    releaseGate: { passed: true },
    limits: {
      maxResponseBytes: 100 * 1024,
      maxFullTurnMs: 6_000,
      maxP95FullTurnMs: 3_000,
    },
    summary: {
      passed: true,
      totalCases: SHOP_AI_V2_RELEASE_MIN_CASES,
      failedCases: 0,
      p95FullTurnMs: 2_500,
      performanceErrors: [],
    },
    results: Array.from({ length: SHOP_AI_V2_RELEASE_MIN_CASES }, (_, index) => ({
      id: `case-${index}`,
      passed: true,
      pipeline: "v2",
      retrieval: index % 10 === 0 ? "not-run" : "strict",
      responseCommit: COMMIT_SHA,
      catalogFingerprint: CATALOG_FINGERPRINT,
      responseBytes: 20_000,
      latencyMs: 2_000,
    })),
  };
}

test("release report validation enforces commit, V2 markers, and performance gates", () => {
  assert.deepEqual(validateShopAiV2ReleaseEvalReport(passingEvalReport(), COMMIT_SHA), {
    ok: true,
    errors: [],
  });
});

test("release report validation rejects legacy, mismatched, slow, or oversized results", () => {
  const report = passingEvalReport();
  report.summary.p95FullTurnMs = 3_001;
  report.results[0] = {
    ...report.results[0],
    pipeline: "legacy",
    responseCommit: OTHER_COMMIT_SHA,
    catalogFingerprint: OTHER_CATALOG_FINGERPRINT,
    responseBytes: 100 * 1024 + 1,
    latencyMs: 6_001,
  };
  const validation = validateShopAiV2ReleaseEvalReport(report, COMMIT_SHA);

  assert.equal(validation.ok, false);
  assert.equal(
    validation.errors.some((error) => error.includes("P95")),
    true
  );
  assert.equal(
    validation.errors.some((error) => error.includes("V2 pipeline")),
    true
  );
  assert.equal(
    validation.errors.some((error) => error.includes("wrong deployment")),
    true
  );
  assert.equal(
    validation.errors.some((error) => error.includes("different catalog fingerprint")),
    true
  );
  assert.equal(
    validation.errors.some((error) => error.includes("response-size")),
    true
  );
  assert.equal(
    validation.errors.some((error) => error.includes("full-turn")),
    true
  );
});

test("marker verification rejects tampered payloads and signatures", () => {
  const marker = markerForCommit();
  const segments = marker.split(".");
  const tamperedPayload = [...segments];
  tamperedPayload[tamperedPayload.length - 2] = Buffer.from(
    JSON.stringify({ status: "passed", commitSha: OTHER_COMMIT_SHA }),
    "utf8"
  ).toString("base64url");
  const tamperedSignature = `${marker.slice(0, -1)}${marker.endsWith("a") ? "b" : "a"}`;
  const nonCanonicalSignature = `${marker}!`;

  assert.deepEqual(verifyShopAiV2ReleaseGateMarker(tamperedPayload.join("."), SIGNING_SECRET), {
    ok: false,
    reason: "invalid-signature",
  });
  assert.deepEqual(verifyShopAiV2ReleaseGateMarker(tamperedSignature, SIGNING_SECRET), {
    ok: false,
    reason: "invalid-signature",
  });
  assert.deepEqual(verifyShopAiV2ReleaseGateMarker(nonCanonicalSignature, SIGNING_SECRET), {
    ok: false,
    reason: "malformed-marker",
  });
});

test("non-production and inactive production deployments do not require a marker", () => {
  const preview = evaluateShopAiV2ReleaseActivationGuard({
    deploymentEnvironment: "preview",
    v2Enabled: "1",
  });
  const inactiveProduction = evaluateShopAiV2ReleaseActivationGuard({
    deploymentEnvironment: "production",
    v2Enabled: "0",
    v2ShadowEnabled: "false",
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.guardRequired, false);
  assert.equal(inactiveProduction.ok, true);
  assert.equal(inactiveProduction.guardRequired, false);
});

test("production serving and shadow activation both fail closed without a marker", () => {
  for (const flags of [
    { v2Enabled: "true", v2ShadowEnabled: "0" },
    { v2Enabled: "0", v2ShadowEnabled: "1" },
  ]) {
    const result = evaluateShopAiV2ReleaseActivationGuard({
      deploymentEnvironment: "production",
      deployedCommitSha: COMMIT_SHA,
      releaseGateSigningSecret: SIGNING_SECRET,
      catalogFingerprint: CATALOG_FINGERPRINT,
      ...flags,
    });

    assert.equal(result.ok, false);
    assert.equal(result.guardRequired, true);
    assert.equal(
      result.failures.some((failure) => failure.code === "release-gate-marker-missing"),
      true
    );
  }
});

test("production activation passes only for a valid marker on the deployed commit", () => {
  const result = evaluateShopAiV2ReleaseActivationGuard({
    deploymentEnvironment: "production",
    deployedCommitSha: COMMIT_SHA.toUpperCase(),
    releaseGateMarker: markerForCommit(),
    releaseGateSigningSecret: SIGNING_SECRET,
    catalogFingerprint: CATALOG_FINGERPRINT,
    now: "2026-07-17T13:00:00.000Z",
    v2Enabled: "1",
  });

  assert.equal(result.ok, true);
  assert.equal(result.guardRequired, true);
  assert.equal(result.markerCommitSha, COMMIT_SHA);
  assert.deepEqual(result.failures, []);
});

test("production activation rejects a valid marker for a different commit", () => {
  const result = evaluateShopAiV2ReleaseActivationGuard({
    deploymentEnvironment: "prod",
    deployedCommitSha: OTHER_COMMIT_SHA,
    releaseGateMarker: markerForCommit(),
    releaseGateSigningSecret: SIGNING_SECRET,
    catalogFingerprint: CATALOG_FINGERPRINT,
    now: "2026-07-17T13:00:00.000Z",
    v2Enabled: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.markerCommitSha, COMMIT_SHA);
  assert.equal(
    result.failures.some((failure) => failure.code === "release-gate-commit-mismatch"),
    true
  );
});

test("production activation rejects invalid commit identity and weak signing material", () => {
  const result = evaluateShopAiV2ReleaseActivationGuard({
    deploymentEnvironment: "production",
    deployedCommitSha: "abc123",
    releaseGateMarker: markerForCommit(),
    releaseGateSigningSecret: "too-short",
    catalogFingerprint: CATALOG_FINGERPRINT,
    v2ShadowEnabled: "true",
  });
  const codes = result.failures.map((failure) => failure.code);

  assert.equal(result.ok, false);
  assert.equal(codes.includes("deployed-commit-missing-or-invalid"), true);
  assert.equal(codes.includes("release-gate-signing-secret-missing-or-weak"), true);
});

test("environment adapter prefers explicit Vercel identity over generic production values", () => {
  const input = readShopAiV2ReleaseActivationGuardInput({
    VERCEL_ENV: "preview",
    NODE_ENV: "production",
    VERCEL_GIT_COMMIT_SHA: COMMIT_SHA,
    GITHUB_SHA: OTHER_COMMIT_SHA,
    SHOP_AI_DEPLOYED_COMMIT_SHA: OTHER_COMMIT_SHA,
    SHOP_AI_V2_ENABLED: "1",
    SHOP_AI_V2_CATALOG_FINGERPRINT: CATALOG_FINGERPRINT,
  });

  assert.equal(input.deploymentEnvironment, "preview");
  assert.equal(input.deployedCommitSha, COMMIT_SHA);
  assert.equal(input.catalogFingerprint, CATALOG_FINGERPRINT);
  assert.equal(evaluateShopAiV2ReleaseActivationGuard(input).guardRequired, false);
});

test("production activation fails closed for stale or mismatched catalog evidence", () => {
  const expired = evaluateShopAiV2ReleaseActivationGuard({
    deploymentEnvironment: "production",
    deployedCommitSha: COMMIT_SHA,
    releaseGateMarker: markerForCommit(),
    releaseGateSigningSecret: SIGNING_SECRET,
    catalogFingerprint: CATALOG_FINGERPRINT,
    now: "2026-07-18T12:00:00.000Z",
    v2Enabled: "1",
  });
  const mismatched = evaluateShopAiV2ReleaseActivationGuard({
    deploymentEnvironment: "production",
    deployedCommitSha: COMMIT_SHA,
    releaseGateMarker: markerForCommit(),
    releaseGateSigningSecret: SIGNING_SECRET,
    catalogFingerprint: OTHER_CATALOG_FINGERPRINT,
    now: "2026-07-17T13:00:00.000Z",
    v2Enabled: "1",
  });

  assert.equal(expired.ok, false);
  assert.equal(
    expired.failures.some((failure) => failure.code === "release-gate-marker-expired"),
    true
  );
  assert.equal(mismatched.ok, false);
  assert.equal(
    mismatched.failures.some(
      (failure) => failure.code === "release-gate-catalog-fingerprint-mismatch"
    ),
    true
  );
});

test("commit normalization only accepts full Git SHA-1 values", () => {
  assert.equal(normalizeShopAiCommitSha(` ${COMMIT_SHA.toUpperCase()} `), COMMIT_SHA);
  assert.equal(normalizeShopAiCommitSha("abc123"), null);
  assert.equal(normalizeShopAiCommitSha("g".repeat(40)), null);
});
