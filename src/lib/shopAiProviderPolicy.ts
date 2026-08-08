export const SHOP_AI_DEFAULT_MODEL = "gemini-3.5-flash-lite";
export const SHOP_AI_PLANNER_TIMEOUT_MS = 12_000;
export const SHOP_AI_QUERY_EMBEDDING_TIMEOUT_MS = 10_000;
export const SHOP_AI_SERVER_TURN_DEADLINE_MS = 15_000;
export const SHOP_AI_CLIENT_ABORT_MS = 18_000;

export type ShopAiProviderErrorKind =
  | "invalid_config"
  | "auth"
  | "quota"
  | "timeout"
  | "network"
  | "schema";

function errorStatus(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const source = error as Record<string, unknown>;
  const direct = Number(source.status ?? source.statusCode ?? source.code);
  if (Number.isInteger(direct) && direct >= 100 && direct <= 599) return direct;
  const nested = source.response;
  if (nested && typeof nested === "object") {
    const status = Number((nested as Record<string, unknown>).status);
    if (Number.isInteger(status) && status >= 100 && status <= 599) return status;
  }
  return null;
}

export function classifyShopAiProviderError(error: unknown): ShopAiProviderErrorKind {
  const status = errorStatus(error);
  const name = error instanceof Error ? error.name : "";
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String((error as Record<string, unknown>).message ?? "")
        : String(error ?? "");
  const normalized = `${name} ${message}`.toLocaleLowerCase("en-US");

  if (
    status === 401 ||
    status === 403 ||
    /api[ _-]?key|unauthori[sz]ed|permission denied/.test(normalized)
  ) {
    return "auth";
  }
  if (status === 429 || /quota|rate limit|resource[_ ]exhausted/.test(normalized)) {
    return "quota";
  }
  if (
    name === "AbortError" ||
    status === 408 ||
    status === 504 ||
    /deadline|timed?\s*out|timeout/.test(normalized)
  ) {
    return "timeout";
  }
  if (
    status === 400 &&
    /schema|response[_ ]?schema|json|invalid argument|unsupported parameter/.test(normalized)
  ) {
    return "schema";
  }
  if (
    status === 400 ||
    /model.*(?:not found|invalid)|configuration|config|api version/.test(normalized)
  ) {
    return "invalid_config";
  }
  if (
    (status !== null && status >= 500) ||
    /network|fetch failed|econn|enotfound|socket|connection/.test(normalized)
  ) {
    return "network";
  }
  return "schema";
}

export function shouldOpenShopAiProviderCircuit(kind: ShopAiProviderErrorKind) {
  return kind === "auth" || kind === "invalid_config";
}
