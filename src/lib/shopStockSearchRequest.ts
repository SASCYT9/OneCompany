import { parseShopStockJsonResponse } from "./shopStockFitmentState";

/** Retry one transient GET failure, without retrying invalid data or stale searches. */
export async function fetchShopStockSearch(
  url: string,
  signal: AbortSignal,
  request: typeof fetch = fetch
): Promise<unknown> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      signal.throwIfAborted();
      const response = await request(url, { signal, ...(attempt ? { cache: "no-store" as const } : {}) });
      return await parseShopStockJsonResponse(response);
    } catch (error) {
      const status = (error as { status?: number } | null)?.status;
      const transient = error instanceof TypeError || status === 502 || status === 503 || status === 504;
      if (signal.aborted || attempt > 0 || !transient) throw error;
    }
  }
}
