import { createHmac, timingSafeEqual } from "node:crypto";

export const SHOP_AI_V2_RELEASE_GATE_ID = "one-ai-v2-live-release-eval";
export const SHOP_AI_V2_RELEASE_GATE_MARKER_PREFIX = "one-ai-v2-release-gate.v2";
export const SHOP_AI_V2_RELEASE_GATE_SCHEMA_VERSION = 2 as const;
export const SHOP_AI_V2_RELEASE_GATE_MIN_SECRET_BYTES = 32;
export const SHOP_AI_V2_RELEASE_GATE_MAX_AGE_MS = 24 * 60 * 60 * 1_000;
export const SHOP_AI_V2_RELEASE_MAX_RESPONSE_BYTES = 100 * 1024;
export const SHOP_AI_V2_RELEASE_MAX_FULL_TURN_MS = 6_000;
export const SHOP_AI_V2_RELEASE_MAX_P95_FULL_TURN_MS = 3_000;
export const SHOP_AI_V2_RELEASE_MIN_CASES = 500;

const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const WORKFLOW_RUN_ID_PATTERN = /^[1-9][0-9]*$/;

export type ShopAiV2ReleaseGateMarkerPayload = {
  schemaVersion: typeof SHOP_AI_V2_RELEASE_GATE_SCHEMA_VERSION;
  gate: typeof SHOP_AI_V2_RELEASE_GATE_ID;
  status: "passed";
  commitSha: string;
  corpusSha256: string;
  evalReportSha256: string;
  catalogFingerprint: string;
  evaluatedAt: string;
  expiresAt: string;
  repository: string;
  workflowRunId: string;
  workflowRunAttempt: number;
};

export type ShopAiV2ReleaseGateMarkerInput = Omit<
  ShopAiV2ReleaseGateMarkerPayload,
  "schemaVersion" | "gate" | "status"
>;

export type ShopAiV2ReleaseGateMarkerVerification =
  | {
      ok: true;
      payload: ShopAiV2ReleaseGateMarkerPayload;
    }
  | {
      ok: false;
      reason: "invalid-payload" | "invalid-signature" | "malformed-marker" | "weak-signing-secret";
    };

export type ShopAiV2ReleaseActivationGuardFailureCode =
  | "deployed-commit-missing-or-invalid"
  | "release-gate-commit-mismatch"
  | "release-gate-catalog-fingerprint-mismatch"
  | "release-gate-catalog-fingerprint-missing-or-invalid"
  | "release-gate-marker-expired"
  | "release-gate-marker-invalid"
  | "release-gate-marker-missing"
  | "release-gate-signing-secret-missing-or-weak";

export type ShopAiV2ReleaseActivationGuardFailure = {
  code: ShopAiV2ReleaseActivationGuardFailureCode;
  message: string;
};

export type ShopAiV2ReleaseActivationGuardInput = {
  deploymentEnvironment?: string | null;
  deployedCommitSha?: string | null;
  releaseGateMarker?: string | null;
  releaseGateSigningSecret?: string | null;
  catalogFingerprint?: string | null;
  now?: string | number | Date;
  v2Enabled?: boolean | string | null;
  v2ShadowEnabled?: boolean | string | null;
};

export type ShopAiV2ReleaseActivationGuardResult = {
  ok: boolean;
  production: boolean;
  activationRequested: boolean;
  servedTrafficRequested: boolean;
  shadowTrafficRequested: boolean;
  guardRequired: boolean;
  deployedCommitSha: string | null;
  markerCommitSha: string | null;
  currentCatalogFingerprint: string | null;
  markerCatalogFingerprint: string | null;
  markerPayload: ShopAiV2ReleaseGateMarkerPayload | null;
  failures: ShopAiV2ReleaseActivationGuardFailure[];
};

export type ShopAiV2ReleaseEvalReportValidation = {
  ok: boolean;
  errors: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasStrongSigningSecret(secret: string | null | undefined) {
  return Boolean(
    secret && Buffer.byteLength(secret, "utf8") >= SHOP_AI_V2_RELEASE_GATE_MIN_SECRET_BYTES
  );
}

function isCanonicalIsoDate(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function isBooleanFlagEnabled(value: boolean | string | null | undefined) {
  if (typeof value === "boolean") return value;
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

function isProductionDeployment(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized === "production" || normalized === "prod";
}

function normalizeSha256(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return SHA256_PATTERN.test(normalized) ? normalized : null;
}

export function normalizeShopAiCatalogFingerprint(value: string | null | undefined) {
  return normalizeSha256(value);
}

export function normalizeShopAiCommitSha(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return COMMIT_SHA_PATTERN.test(normalized) ? normalized : null;
}

function validateMarkerPayload(value: unknown): ShopAiV2ReleaseGateMarkerPayload | null {
  if (!isRecord(value)) return null;
  const commitSha = normalizeShopAiCommitSha(
    typeof value.commitSha === "string" ? value.commitSha : null
  );
  const corpusSha256 = normalizeSha256(
    typeof value.corpusSha256 === "string" ? value.corpusSha256 : null
  );
  const evalReportSha256 = normalizeSha256(
    typeof value.evalReportSha256 === "string" ? value.evalReportSha256 : null
  );
  const catalogFingerprint = normalizeShopAiCatalogFingerprint(
    typeof value.catalogFingerprint === "string" ? value.catalogFingerprint : null
  );
  const evaluatedAt = typeof value.evaluatedAt === "string" ? value.evaluatedAt : "";
  const expiresAt = typeof value.expiresAt === "string" ? value.expiresAt : "";
  const repository = typeof value.repository === "string" ? value.repository : "";
  const workflowRunId = typeof value.workflowRunId === "string" ? value.workflowRunId : "";
  const workflowRunAttempt = value.workflowRunAttempt;

  if (
    value.schemaVersion !== SHOP_AI_V2_RELEASE_GATE_SCHEMA_VERSION ||
    value.gate !== SHOP_AI_V2_RELEASE_GATE_ID ||
    value.status !== "passed" ||
    !commitSha ||
    !corpusSha256 ||
    !evalReportSha256 ||
    !catalogFingerprint ||
    !isCanonicalIsoDate(evaluatedAt) ||
    !isCanonicalIsoDate(expiresAt) ||
    Date.parse(expiresAt) <= Date.parse(evaluatedAt) ||
    Date.parse(expiresAt) - Date.parse(evaluatedAt) > SHOP_AI_V2_RELEASE_GATE_MAX_AGE_MS ||
    !REPOSITORY_PATTERN.test(repository) ||
    !WORKFLOW_RUN_ID_PATTERN.test(workflowRunId) ||
    !Number.isSafeInteger(workflowRunAttempt) ||
    Number(workflowRunAttempt) < 1
  ) {
    return null;
  }

  return {
    schemaVersion: SHOP_AI_V2_RELEASE_GATE_SCHEMA_VERSION,
    gate: SHOP_AI_V2_RELEASE_GATE_ID,
    status: "passed",
    commitSha,
    corpusSha256,
    evalReportSha256,
    catalogFingerprint,
    evaluatedAt,
    expiresAt,
    repository,
    workflowRunId,
    workflowRunAttempt: Number(workflowRunAttempt),
  };
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function validateShopAiV2ReleaseEvalReport(
  value: unknown,
  expectedCommitSha: string
): ShopAiV2ReleaseEvalReportValidation {
  const errors: string[] = [];
  const expectedCommit = normalizeShopAiCommitSha(expectedCommitSha);
  if (!expectedCommit) {
    return {
      ok: false,
      errors: ["expected commit must be a full 40-character Git SHA"],
    };
  }
  if (!isRecord(value)) {
    return { ok: false, errors: ["eval report must be an object"] };
  }
  if (value.schemaVersion !== SHOP_AI_V2_RELEASE_GATE_SCHEMA_VERSION) {
    errors.push(`eval report schemaVersion must be ${SHOP_AI_V2_RELEASE_GATE_SCHEMA_VERSION}`);
  }
  if (typeof value.generatedAt !== "string" || !isCanonicalIsoDate(value.generatedAt)) {
    errors.push("eval report generatedAt must be a canonical UTC timestamp");
  }

  const reportCommit = normalizeShopAiCommitSha(
    typeof value.expectedCommit === "string" ? value.expectedCommit : null
  );
  if (reportCommit !== expectedCommit) {
    errors.push(
      `eval report commit ${reportCommit ?? "missing/invalid"} does not match ${expectedCommit}`
    );
  }

  const catalogFingerprint = normalizeShopAiCatalogFingerprint(
    typeof value.catalogFingerprint === "string" ? value.catalogFingerprint : null
  );
  if (!catalogFingerprint) {
    errors.push("eval report is missing a valid Knowledge V2 catalog fingerprint");
  }

  const releaseGate = isRecord(value.releaseGate) ? value.releaseGate : null;
  if (releaseGate?.passed !== true) {
    errors.push("eval report release corpus gate did not pass");
  }

  const limits = isRecord(value.limits) ? value.limits : null;
  const maxResponseBytes = finiteNumber(limits?.maxResponseBytes);
  const maxFullTurnMs = finiteNumber(limits?.maxFullTurnMs);
  const maxP95FullTurnMs = finiteNumber(limits?.maxP95FullTurnMs);
  if (
    maxResponseBytes === null ||
    maxResponseBytes <= 0 ||
    maxResponseBytes > SHOP_AI_V2_RELEASE_MAX_RESPONSE_BYTES
  ) {
    errors.push(
      `eval report response-size limit must be at most ${SHOP_AI_V2_RELEASE_MAX_RESPONSE_BYTES} bytes`
    );
  }
  if (
    maxFullTurnMs === null ||
    maxFullTurnMs <= 0 ||
    maxFullTurnMs > SHOP_AI_V2_RELEASE_MAX_FULL_TURN_MS
  ) {
    errors.push(
      `eval report full-turn limit must be at most ${SHOP_AI_V2_RELEASE_MAX_FULL_TURN_MS}ms`
    );
  }
  if (
    maxP95FullTurnMs === null ||
    maxP95FullTurnMs <= 0 ||
    maxP95FullTurnMs > SHOP_AI_V2_RELEASE_MAX_P95_FULL_TURN_MS
  ) {
    errors.push(
      `eval report P95 limit must be at most ${SHOP_AI_V2_RELEASE_MAX_P95_FULL_TURN_MS}ms`
    );
  }

  const summary = isRecord(value.summary) ? value.summary : null;
  const totalCases = finiteNumber(summary?.totalCases);
  const failedCases = finiteNumber(summary?.failedCases);
  const p95FullTurnMs = finiteNumber(summary?.p95FullTurnMs);
  const performanceErrors = Array.isArray(summary?.performanceErrors)
    ? summary.performanceErrors
    : null;
  if (summary?.passed !== true) errors.push("eval report summary did not pass");
  if (
    totalCases === null ||
    !Number.isSafeInteger(totalCases) ||
    totalCases < SHOP_AI_V2_RELEASE_MIN_CASES
  ) {
    errors.push(`eval report must contain at least ${SHOP_AI_V2_RELEASE_MIN_CASES} cases`);
  }
  if (failedCases !== 0) errors.push("eval report contains failed cases");
  if (
    p95FullTurnMs === null ||
    p95FullTurnMs < 0 ||
    p95FullTurnMs > SHOP_AI_V2_RELEASE_MAX_P95_FULL_TURN_MS
  ) {
    errors.push(`eval report P95 must be at most ${SHOP_AI_V2_RELEASE_MAX_P95_FULL_TURN_MS}ms`);
  }
  if (!performanceErrors || performanceErrors.length > 0) {
    errors.push("eval report contains performance errors");
  }

  const results = Array.isArray(value.results) ? value.results : null;
  if (!results || results.length !== totalCases) {
    errors.push("eval report result count does not match summary.totalCases");
  } else {
    for (const [index, result] of results.entries()) {
      if (!isRecord(result)) {
        errors.push(`eval report result ${index} is invalid`);
        continue;
      }
      if (result.passed !== true) {
        errors.push(`eval report result ${index} did not pass`);
      }
      if (result.pipeline !== "v2") {
        errors.push(`eval report result ${index} did not use the V2 pipeline`);
      }
      if (result.retrieval !== "strict" && result.retrieval !== "not-run") {
        errors.push(`eval report result ${index} did not use strict V2 retrieval`);
      }
      if (
        normalizeShopAiCommitSha(
          typeof result.responseCommit === "string" ? result.responseCommit : null
        ) !== expectedCommit
      ) {
        errors.push(`eval report result ${index} has the wrong deployment commit`);
      }
      if (
        normalizeShopAiCatalogFingerprint(
          typeof result.catalogFingerprint === "string" ? result.catalogFingerprint : null
        ) !== catalogFingerprint
      ) {
        errors.push(`eval report result ${index} has a different catalog fingerprint`);
      }
      const responseBytes = finiteNumber(result.responseBytes);
      if (
        responseBytes === null ||
        responseBytes < 0 ||
        responseBytes > SHOP_AI_V2_RELEASE_MAX_RESPONSE_BYTES
      ) {
        errors.push(`eval report result ${index} exceeds the response-size limit`);
      }
      const latencyMs = finiteNumber(result.latencyMs);
      if (latencyMs === null || latencyMs < 0 || latencyMs > SHOP_AI_V2_RELEASE_MAX_FULL_TURN_MS) {
        errors.push(`eval report result ${index} exceeds the full-turn limit`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

function signatureForPayload(encodedPayload: string, signingSecret: string) {
  return createHmac("sha256", signingSecret)
    .update(`${SHOP_AI_V2_RELEASE_GATE_MARKER_PREFIX}.${encodedPayload}`, "utf8")
    .digest("base64url");
}

export function createShopAiV2ReleaseGateMarker(
  input: ShopAiV2ReleaseGateMarkerInput,
  signingSecret: string
) {
  if (!hasStrongSigningSecret(signingSecret)) {
    throw new Error(
      `Shop AI V2 release-gate signing secret must be at least ${SHOP_AI_V2_RELEASE_GATE_MIN_SECRET_BYTES} bytes`
    );
  }

  const payload = validateMarkerPayload({
    schemaVersion: SHOP_AI_V2_RELEASE_GATE_SCHEMA_VERSION,
    gate: SHOP_AI_V2_RELEASE_GATE_ID,
    status: "passed",
    ...input,
  });
  if (!payload) {
    throw new Error("Shop AI V2 release-gate marker payload is invalid");
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signatureForPayload(encodedPayload, signingSecret);
  return `${SHOP_AI_V2_RELEASE_GATE_MARKER_PREFIX}.${encodedPayload}.${signature}`;
}

export function verifyShopAiV2ReleaseGateMarker(
  marker: string,
  signingSecret: string
): ShopAiV2ReleaseGateMarkerVerification {
  if (!hasStrongSigningSecret(signingSecret)) {
    return { ok: false, reason: "weak-signing-secret" };
  }

  const prefix = `${SHOP_AI_V2_RELEASE_GATE_MARKER_PREFIX}.`;
  if (!marker.startsWith(prefix)) {
    return { ok: false, reason: "malformed-marker" };
  }
  const markerBody = marker.slice(prefix.length);
  const separatorIndex = markerBody.lastIndexOf(".");
  if (separatorIndex <= 0 || separatorIndex === markerBody.length - 1) {
    return { ok: false, reason: "malformed-marker" };
  }

  const encodedPayload = markerBody.slice(0, separatorIndex);
  const suppliedSignature = markerBody.slice(separatorIndex + 1);
  const expectedSignature = signatureForPayload(encodedPayload, signingSecret);
  if (!/^[A-Za-z0-9_-]+$/.test(suppliedSignature)) {
    return { ok: false, reason: "malformed-marker" };
  }
  const suppliedSignatureBytes = Buffer.from(suppliedSignature, "utf8");
  const expectedSignatureBytes = Buffer.from(expectedSignature, "utf8");
  if (
    suppliedSignatureBytes.length !== expectedSignatureBytes.length ||
    !timingSafeEqual(suppliedSignatureBytes, expectedSignatureBytes)
  ) {
    return { ok: false, reason: "invalid-signature" };
  }

  try {
    const rawPayload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as unknown;
    const payload = validateMarkerPayload(rawPayload);
    return payload ? { ok: true, payload } : { ok: false, reason: "invalid-payload" };
  } catch {
    return { ok: false, reason: "invalid-payload" };
  }
}

export function evaluateShopAiV2ReleaseActivationGuard(
  input: ShopAiV2ReleaseActivationGuardInput
): ShopAiV2ReleaseActivationGuardResult {
  const production = isProductionDeployment(input.deploymentEnvironment);
  const servedTrafficRequested = isBooleanFlagEnabled(input.v2Enabled);
  const shadowTrafficRequested = isBooleanFlagEnabled(input.v2ShadowEnabled);
  const activationRequested = servedTrafficRequested || shadowTrafficRequested;
  const guardRequired = production && activationRequested;
  const deployedCommitSha = normalizeShopAiCommitSha(input.deployedCommitSha);
  const currentCatalogFingerprint = normalizeShopAiCatalogFingerprint(input.catalogFingerprint);
  const failures: ShopAiV2ReleaseActivationGuardFailure[] = [];
  let markerPayload: ShopAiV2ReleaseGateMarkerPayload | null = null;

  if (!guardRequired) {
    return {
      ok: true,
      production,
      activationRequested,
      servedTrafficRequested,
      shadowTrafficRequested,
      guardRequired,
      deployedCommitSha,
      markerCommitSha: null,
      currentCatalogFingerprint,
      markerCatalogFingerprint: null,
      markerPayload,
      failures,
    };
  }

  if (!deployedCommitSha) {
    failures.push({
      code: "deployed-commit-missing-or-invalid",
      message: "Production One AI V2 activation requires a full 40-character deployed commit SHA.",
    });
  }

  if (!input.releaseGateMarker?.trim()) {
    failures.push({
      code: "release-gate-marker-missing",
      message: "Production One AI V2 activation requires SHOP_AI_V2_RELEASE_GATE_MARKER.",
    });
  }

  if (!hasStrongSigningSecret(input.releaseGateSigningSecret)) {
    failures.push({
      code: "release-gate-signing-secret-missing-or-weak",
      message: `Production One AI V2 activation requires a release-gate signing secret of at least ${SHOP_AI_V2_RELEASE_GATE_MIN_SECRET_BYTES} bytes.`,
    });
  }

  if (!currentCatalogFingerprint) {
    failures.push({
      code: "release-gate-catalog-fingerprint-missing-or-invalid",
      message:
        "Production One AI V2 activation requires the current 64-character Knowledge V2 catalog fingerprint.",
    });
  }

  if (input.releaseGateMarker?.trim() && hasStrongSigningSecret(input.releaseGateSigningSecret)) {
    const markerVerification = verifyShopAiV2ReleaseGateMarker(
      input.releaseGateMarker.trim(),
      input.releaseGateSigningSecret as string
    );
    if (!markerVerification.ok) {
      failures.push({
        code: "release-gate-marker-invalid",
        message: `Shop AI V2 release-gate marker is invalid (${markerVerification.reason}).`,
      });
    } else {
      markerPayload = markerVerification.payload;
      const now =
        input.now instanceof Date
          ? input.now.getTime()
          : typeof input.now === "number"
            ? input.now
            : typeof input.now === "string"
              ? Date.parse(input.now)
              : Date.now();
      if (!Number.isFinite(now) || now >= Date.parse(markerPayload.expiresAt)) {
        failures.push({
          code: "release-gate-marker-expired",
          message: `Shop AI V2 release gate expired at ${markerPayload.expiresAt}.`,
        });
      }
      if (deployedCommitSha && markerPayload.commitSha !== deployedCommitSha) {
        failures.push({
          code: "release-gate-commit-mismatch",
          message: `Shop AI V2 release gate passed for ${markerPayload.commitSha}, but this deployment is ${deployedCommitSha}.`,
        });
      }
      if (
        currentCatalogFingerprint &&
        markerPayload.catalogFingerprint !== currentCatalogFingerprint
      ) {
        failures.push({
          code: "release-gate-catalog-fingerprint-mismatch",
          message:
            "Shop AI V2 release gate was evaluated against a different Knowledge V2 catalog revision.",
        });
      }
    }
  }

  return {
    ok: failures.length === 0,
    production,
    activationRequested,
    servedTrafficRequested,
    shadowTrafficRequested,
    guardRequired,
    deployedCommitSha,
    markerCommitSha: markerPayload?.commitSha ?? null,
    currentCatalogFingerprint,
    markerCatalogFingerprint: markerPayload?.catalogFingerprint ?? null,
    markerPayload,
    failures,
  };
}

function firstNonEmptyEnvironmentValue(environment: NodeJS.ProcessEnv, keys: readonly string[]) {
  for (const key of keys) {
    const value = environment[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function readShopAiV2ReleaseActivationGuardInput(
  environment: NodeJS.ProcessEnv
): ShopAiV2ReleaseActivationGuardInput {
  return {
    deploymentEnvironment: firstNonEmptyEnvironmentValue(environment, [
      "VERCEL_ENV",
      "VERCEL_TARGET_ENV",
      "SHOP_AI_DEPLOYMENT_ENV",
      "NODE_ENV",
    ]),
    deployedCommitSha: firstNonEmptyEnvironmentValue(environment, [
      "VERCEL_GIT_COMMIT_SHA",
      "GITHUB_SHA",
      "SOURCE_VERSION",
      "SHOP_AI_DEPLOYED_COMMIT_SHA",
    ]),
    releaseGateMarker: environment.SHOP_AI_V2_RELEASE_GATE_MARKER,
    releaseGateSigningSecret: environment.SHOP_AI_V2_RELEASE_GATE_SIGNING_SECRET,
    catalogFingerprint: environment.SHOP_AI_V2_CATALOG_FINGERPRINT,
    v2Enabled: environment.SHOP_AI_V2_ENABLED,
    v2ShadowEnabled: environment.SHOP_AI_V2_SHADOW,
  };
}
