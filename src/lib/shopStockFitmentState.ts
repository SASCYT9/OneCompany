export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

export async function parseShopStockJsonResponse(response: Response): Promise<unknown> {
  const body = await response.text();
  if (!response.ok) {
    let code: string | undefined;
    try {
      const payload = JSON.parse(body) as { code?: unknown };
      if (typeof payload.code === "string") code = payload.code;
    } catch {
      // Preserve the stable request error when the server sends non-JSON text.
    }
    const error = new Error("stock_request_failed") as Error & {
      status: number;
      code?: string;
    };
    error.status = response.status;
    if (code) error.code = code;
    throw error;
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error("stock_response_invalid");
  }
}

export function hasFitmentResponseType(
  value: unknown,
  type: string
): value is { type: string; data: unknown } {
  return Boolean(value && typeof value === "object" && (value as { type?: unknown }).type === type);
}

export function hasPartialFitmentCoverage(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const meta = (value as { meta?: unknown }).meta;
  if (!meta || typeof meta !== "object") return false;
  const coverage = meta as { complete?: unknown; coverage?: unknown };
  return coverage.complete === false || coverage.coverage === "partial";
}

export function isSelectorNotReadyError(value: unknown): boolean {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value as { code?: unknown }).code === "SELECTOR_NOT_READY"
  );
}

/**
 * Keep a URL supplied value visible until the server returns a matching option.
 * Aliases can then be replaced with the canonical label without dropping a
 * valid deep link when option loading is incomplete.
 */
export function resolveFitmentOption<T extends string>(
  options: readonly T[],
  requested: string,
  key: (value: string) => string = (value) => value.trim().toLocaleLowerCase()
): T | null {
  const requestedKey = key(requested);
  if (!requestedKey) return null;
  return options.find((option) => key(option) === requestedKey) ?? null;
}

export function isCurrentFitmentRequest(
  requestKey: string,
  currentKey: string,
  aborted = false
): boolean {
  return !aborted && requestKey === currentKey;
}
