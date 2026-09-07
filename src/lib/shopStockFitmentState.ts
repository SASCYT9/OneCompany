export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

export async function parseShopStockJsonResponse(response: Response): Promise<unknown> {
  const body = await response.text();
  if (!response.ok) throw new Error("stock_request_failed");
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
