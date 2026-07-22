import assert from "node:assert/strict";
import test from "node:test";

import {
  buildShopAiPipelineHeaders,
  isShopAiEvalBoundaryEnabled,
  resolveShopAiEvalAccess,
  SHOP_AI_EVAL_REQUEST_PIPELINE_HEADER,
  SHOP_AI_EVAL_TOKEN_HEADER,
} from "../../../src/lib/shopAiEvalBoundary";

const TOKEN = "reviewed-staging-eval-token-32-characters";

test("protected eval is disabled in production except Vercel preview", () => {
  assert.equal(
    isShopAiEvalBoundaryEnabled({
      SHOP_AI_EVAL_ENABLED: "1",
      NODE_ENV: "production",
    }),
    false
  );
  assert.equal(
    isShopAiEvalBoundaryEnabled({
      SHOP_AI_EVAL_ENABLED: "1",
      NODE_ENV: "production",
      VERCEL_ENV: "production",
    }),
    false
  );
  assert.equal(
    isShopAiEvalBoundaryEnabled({
      SHOP_AI_EVAL_ENABLED: "1",
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
    }),
    true
  );
  assert.equal(
    isShopAiEvalBoundaryEnabled({
      SHOP_AI_EVAL_ENABLED: "1",
      NODE_ENV: "development",
    }),
    true
  );
});

test("eval access requires a sufficiently long exact server-side token", () => {
  const validHeaders = new Headers({
    [SHOP_AI_EVAL_TOKEN_HEADER]: TOKEN,
    [SHOP_AI_EVAL_REQUEST_PIPELINE_HEADER]: "v2",
  });
  assert.deepEqual(resolveShopAiEvalAccess(validHeaders, TOKEN), {
    attempted: true,
    authorized: true,
    requireV2: true,
  });

  const invalidHeaders = new Headers({
    [SHOP_AI_EVAL_TOKEN_HEADER]: `${TOKEN}-wrong`,
    [SHOP_AI_EVAL_REQUEST_PIPELINE_HEADER]: "v2",
  });
  assert.deepEqual(resolveShopAiEvalAccess(invalidHeaders, TOKEN), {
    attempted: true,
    authorized: false,
    requireV2: false,
  });

  assert.equal(resolveShopAiEvalAccess(validHeaders, "short").authorized, false);
});

test("pipeline headers expose only provenance, never the eval token", () => {
  const headers = buildShopAiPipelineHeaders({
    pipeline: "v2",
    retrieval: "strict",
    evalAuthenticated: true,
    commitSha: "abc123",
  });

  assert.deepEqual(headers, {
    "x-one-ai-pipeline": "v2",
    "x-one-ai-retrieval": "strict",
    "x-one-ai-commit": "abc123",
    "x-one-ai-eval-authenticated": "1",
    "Cache-Control": "no-store",
  });
  assert.equal(JSON.stringify(headers).includes(TOKEN), false);
});

test("internal eval metrics are emitted only for authenticated evaluation responses", () => {
  const metrics = {
    activeCpuMs: 21,
    retrievalLatencyMs: 34,
    generationCalls: 1,
    embeddingCalls: 0,
  };
  const authenticated = buildShopAiPipelineHeaders({
    pipeline: "v2",
    retrieval: "strict",
    evalAuthenticated: true,
    catalogFingerprint: "a".repeat(64),
    evalMetrics: metrics,
  });
  assert.equal(authenticated["x-one-ai-catalog-fingerprint"], "a".repeat(64));
  assert.equal(authenticated["x-one-ai-eval-active-cpu-ms"], "21");
  assert.equal(authenticated["x-one-ai-eval-retrieval-latency-ms"], "34");
  assert.equal(authenticated["x-one-ai-eval-generation-calls"], "1");

  const publicHeaders = buildShopAiPipelineHeaders({
    pipeline: "v2",
    retrieval: "strict",
    evalAuthenticated: false,
    evalMetrics: metrics,
  });
  assert.equal(publicHeaders["x-one-ai-eval-active-cpu-ms"], undefined);
  assert.equal(publicHeaders["x-one-ai-catalog-fingerprint"], undefined);
});
