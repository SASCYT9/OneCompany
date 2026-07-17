import { timingSafeEqualText } from "@/lib/requestSecrets";

export const SHOP_AI_EVAL_TOKEN_HEADER = "x-one-ai-eval-token";
export const SHOP_AI_EVAL_REQUEST_PIPELINE_HEADER = "x-one-ai-eval-pipeline";
export const SHOP_AI_PIPELINE_HEADER = "x-one-ai-pipeline";
export const SHOP_AI_RETRIEVAL_HEADER = "x-one-ai-retrieval";
export const SHOP_AI_COMMIT_HEADER = "x-one-ai-commit";
export const SHOP_AI_CATALOG_FINGERPRINT_HEADER = "x-one-ai-catalog-fingerprint";
export const SHOP_AI_EVAL_AUTHENTICATED_HEADER = "x-one-ai-eval-authenticated";
export const SHOP_AI_EVAL_ACTIVE_CPU_HEADER = "x-one-ai-eval-active-cpu-ms";
export const SHOP_AI_EVAL_RETRIEVAL_LATENCY_HEADER = "x-one-ai-eval-retrieval-latency-ms";
export const SHOP_AI_EVAL_GENERATION_CALLS_HEADER = "x-one-ai-eval-generation-calls";
export const SHOP_AI_EVAL_EMBEDDING_CALLS_HEADER = "x-one-ai-eval-embedding-calls";

export type ShopAiPipelineMarker = "legacy" | "v2";
export type ShopAiRetrievalMarker = "legacy" | "not-run" | "strict" | "strict-unavailable";

export type ShopAiEvalAccess = {
  attempted: boolean;
  authorized: boolean;
  requireV2: boolean;
};

export type ShopAiEvalEnvironment = Partial<
  Record<"SHOP_AI_EVAL_ENABLED" | "NODE_ENV" | "VERCEL_ENV", string>
>;

const MIN_EVAL_TOKEN_LENGTH = 32;

export function isShopAiEvalBoundaryEnabled(environment: ShopAiEvalEnvironment = process.env) {
  if (environment.SHOP_AI_EVAL_ENABLED !== "1") return false;
  if (environment.VERCEL_ENV === "production") return false;

  // Vercel preview is the only production-mode runtime where protected eval
  // may bypass the public turn rate limit. A non-Vercel NODE_ENV=production
  // process has no independently verifiable staging boundary, so fail closed.
  if (environment.NODE_ENV === "production") {
    return environment.VERCEL_ENV === "preview";
  }

  return true;
}

export function resolveShopAiEvalAccess(
  headers: Headers,
  configuredToken: string | null | undefined
): ShopAiEvalAccess {
  const suppliedToken = headers.get(SHOP_AI_EVAL_TOKEN_HEADER)?.trim() ?? "";
  const requestedPipeline =
    headers.get(SHOP_AI_EVAL_REQUEST_PIPELINE_HEADER)?.trim().toLowerCase() ?? "";
  const attempted = Boolean(suppliedToken || requestedPipeline);
  const secret = configuredToken?.trim() ?? "";
  const authorized =
    secret.length >= MIN_EVAL_TOKEN_LENGTH &&
    suppliedToken.length >= MIN_EVAL_TOKEN_LENGTH &&
    timingSafeEqualText(suppliedToken, secret);

  return {
    attempted,
    authorized,
    requireV2: authorized && requestedPipeline === "v2",
  };
}

export function buildShopAiPipelineHeaders(input: {
  pipeline: ShopAiPipelineMarker;
  retrieval: ShopAiRetrievalMarker;
  evalAuthenticated: boolean;
  commitSha?: string | null;
  catalogFingerprint?: string | null;
  evalMetrics?: {
    activeCpuMs: number;
    retrievalLatencyMs: number;
    generationCalls: number;
    embeddingCalls: number;
  };
}) {
  const commitSha = input.commitSha?.trim() || "local";
  const headers: Record<string, string> = {
    [SHOP_AI_PIPELINE_HEADER]: input.pipeline,
    [SHOP_AI_RETRIEVAL_HEADER]: input.retrieval,
    [SHOP_AI_COMMIT_HEADER]: commitSha,
    [SHOP_AI_EVAL_AUTHENTICATED_HEADER]: input.evalAuthenticated ? "1" : "0",
    "Cache-Control": "no-store",
  };
  if (input.evalAuthenticated && input.evalMetrics) {
    const catalogFingerprint = input.catalogFingerprint?.trim();
    if (catalogFingerprint) {
      headers[SHOP_AI_CATALOG_FINGERPRINT_HEADER] = catalogFingerprint;
    }
    headers[SHOP_AI_EVAL_ACTIVE_CPU_HEADER] = String(
      Math.max(0, Math.round(input.evalMetrics.activeCpuMs))
    );
    headers[SHOP_AI_EVAL_RETRIEVAL_LATENCY_HEADER] = String(
      Math.max(0, Math.round(input.evalMetrics.retrievalLatencyMs))
    );
    headers[SHOP_AI_EVAL_GENERATION_CALLS_HEADER] = String(
      Math.max(0, Math.round(input.evalMetrics.generationCalls))
    );
    headers[SHOP_AI_EVAL_EMBEDDING_CALLS_HEADER] = String(
      Math.max(0, Math.round(input.evalMetrics.embeddingCalls))
    );
  }
  return headers;
}
