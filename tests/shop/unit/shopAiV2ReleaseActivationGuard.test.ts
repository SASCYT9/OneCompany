import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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
import { SHOP_AI_V2_ROLLOUT_CATEGORIES } from "../../../src/lib/shopAiV2RolloutContract";

test("release guard keeps config-time imports resolvable without Next aliases", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src", "lib", "shopAiV2ReleaseActivationGuard.ts"),
    "utf8"
  );
  assert.match(source, /from "\.\/shopAiV2RolloutContract"/);
  assert.doesNotMatch(source, /from "@\/lib\/shopAiV2RolloutContract"/);
});

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
  const countsByCategory = Object.fromEntries(
    SHOP_AI_V2_ROLLOUT_CATEGORIES.map((category, index) => [category, index === 0 ? 140 : 30])
  );
  const recallAt20ByCategory = Object.fromEntries(
    SHOP_AI_V2_ROLLOUT_CATEGORIES.map((category) => [category, 0.9])
  );
  return {
    schemaVersion: 2,
    generatedAt: "2026-07-17T12:00:00.000Z",
    expectedCommit: COMMIT_SHA,
    catalogFingerprint: CATALOG_FINGERPRINT,
    dataReadiness: {
      schemaVersion: 1,
      checkedAt: "2026-07-17T11:59:00.000Z",
      catalogStable: true,
      catalogFingerprint: CATALOG_FINGERPRINT,
      catalogRevision: "42",
      embeddingModel: "gemini-embedding-2:search-v1",
      knowledge: {
        total: SHOP_AI_V2_RELEASE_MIN_CASES,
        ready: 300,
        needsReview: 200,
        pending: 0,
        processing: 0,
        failed: 0,
        blocked: 0,
        nonCanonical: 0,
      },
      embeddings: {
        totalChunks: 2_000,
        currentChunks: 2_000,
        pendingChunks: 0,
      },
      outbox: {
        pending: 0,
        processing: 0,
        retry: 0,
        completed: 500,
        deadLetter: 0,
        backlog: 0,
      },
      staleProcessingRuns: 0,
      countsByCategory: { ...countsByCategory },
      passed: true,
      errors: [],
    },
    releaseGate: {
      passed: true,
      errors: [],
      reviewPolicy: "catalog_grounded_machine",
      totalCases: SHOP_AI_V2_RELEASE_MIN_CASES,
      enabledCategories: [...SHOP_AI_V2_ROLLOUT_CATEGORIES],
      countsByCategory,
      countsByLanguage: { ua: 100, en: 100, ru: 100, mixed: 100, translit: 100 },
      hardNegativeCases: 100,
      exactSkuCases: 25,
      missingLanguages: [],
      unlabeledLanguageCases: 0,
      unreviewedCases: 0,
      invalidExpectationContractCases: 0,
      duplicateQueryCases: 0,
    },
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
      quality: {
        recallAt20: 0.95,
        recallAt20ByCategory,
        noMatchCases: 100,
        noMatchAccuracy: 0.96,
        exactSkuCases: 25,
        exactSkuAccuracy: 1,
        wrongExactCount: 0,
        hallucinatedClaimCases: 0,
        degradedRate: 0.005,
      },
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
      wrongExactCount: 0,
      grounded: true,
    })),
  };
}

test("release report validation enforces commit, V2 markers, and performance gates", () => {
  assert.deepEqual(validateShopAiV2ReleaseEvalReport(passingEvalReport(), COMMIT_SHA), {
    ok: true,
    errors: [],
  });
});

test("release report validation independently enforces catalog data readiness", () => {
  const report = passingEvalReport();
  report.dataReadiness.passed = true;
  report.dataReadiness.knowledge.processing = 1;
  report.dataReadiness.knowledge.ready = 299;
  report.dataReadiness.embeddings.pendingChunks = 1;
  report.dataReadiness.embeddings.currentChunks = 1_999;
  report.dataReadiness.outbox.retry = 1;
  report.dataReadiness.outbox.backlog = 1;
  report.dataReadiness.staleProcessingRuns = 1;

  const validation = validateShopAiV2ReleaseEvalReport(report, COMMIT_SHA);

  assert.equal(validation.ok, false);
  const errors = validation.errors.join("\n");
  assert.match(errors, /PROCESSING count must be zero/);
  assert.match(errors, /embedding backlog must be zero/);
  assert.match(errors, /outbox backlog must be zero/);
  assert.match(errors, /stale OneAI PROCESSING runs/);
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

test("release report validation rejects quality regressions", () => {
  const report = passingEvalReport();
  report.summary.quality.recallAt20 = 0.89;
  report.summary.quality.recallAt20ByCategory.exhaust = 0.84;
  report.summary.quality.noMatchAccuracy = 0.94;
  report.summary.quality.exactSkuAccuracy = 0.99;
  report.summary.quality.wrongExactCount = 1;
  report.summary.quality.hallucinatedClaimCases = 1;
  report.summary.quality.degradedRate = 0.01;
  report.results[0] = {
    ...report.results[0],
    wrongExactCount: 1,
    grounded: false,
  };

  const validation = validateShopAiV2ReleaseEvalReport(report, COMMIT_SHA);
  assert.equal(validation.ok, false);
  const errors = validation.errors.join("\n");
  assert.match(errors, /Recall@20/);
  assert.match(errors, /no-match accuracy/);
  assert.match(errors, /exact-SKU accuracy/);
  assert.match(errors, /wrong exact/);
  assert.match(errors, /ungrounded/);
  assert.match(errors, /degraded rate/);
});

test("release report validation independently rejects an incomplete or padded corpus", () => {
  const report = passingEvalReport();
  report.releaseGate.enabledCategories = ["exhaust"];
  report.releaseGate.countsByCategory.exhaust = SHOP_AI_V2_RELEASE_MIN_CASES;
  report.releaseGate.countsByCategory.brakes = 29;
  report.releaseGate.hardNegativeCases = 99;
  report.releaseGate.countsByLanguage.translit = 0;
  report.releaseGate.unreviewedCases = 1;

  const validation = validateShopAiV2ReleaseEvalReport(report, COMMIT_SHA);

  assert.equal(validation.ok, false);
  const errors = validation.errors.join("\n");
  assert.match(errors, /all 13 canonical categories/);
  assert.match(errors, /100 hard-negative/);
  assert.match(errors, /translit language coverage/);
  assert.match(errors, /unreviewed cases/);
  assert.match(errors, /category brakes/);
});

test("release report validation rejects an unknown corpus review policy", () => {
  const report = passingEvalReport();
  report.releaseGate.reviewPolicy = "pretend_human";

  const validation = validateShopAiV2ReleaseEvalReport(report, COMMIT_SHA);

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /reviewPolicy must be one of/);
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

test("production serving fails closed without a marker while internal shadow remains available", () => {
  const served = evaluateShopAiV2ReleaseActivationGuard({
    deploymentEnvironment: "production",
    deployedCommitSha: COMMIT_SHA,
    releaseGateSigningSecret: SIGNING_SECRET,
    catalogFingerprint: CATALOG_FINGERPRINT,
    v2Enabled: "true",
  });
  const shadow = evaluateShopAiV2ReleaseActivationGuard({
    deploymentEnvironment: "production",
    v2Enabled: "0",
    v2ShadowEnabled: "1",
  });

  assert.equal(served.ok, false);
  assert.equal(served.guardRequired, true);
  assert.equal(
    served.failures.some((failure) => failure.code === "release-gate-marker-missing"),
    true
  );
  assert.equal(shadow.ok, true);
  assert.equal(shadow.activationRequested, true);
  assert.equal(shadow.guardRequired, false);
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
    v2Enabled: "true",
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
