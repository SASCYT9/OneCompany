export type ShopAiRequestBoundaryEnvironment = Partial<
  Record<
    "NEXT_PUBLIC_SITE_URL" | "NEXT_PUBLIC_BASE_URL" | "VERCEL_URL" | "SHOP_AI_ALLOWED_ORIGINS",
    string
  >
>;

export type ShopAiRequestBoundaryResult =
  | { ok: true }
  | {
      ok: false;
      status: 403 | 415;
      error: "Origin is not allowed" | "Content-Type must be application/json";
    };

function normalizeHttpOrigin(value: string | null | undefined) {
  const candidate = value?.trim();
  if (!candidate || candidate === "null") return null;

  try {
    const parsed = new URL(candidate);
    if (
      (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
      parsed.username ||
      parsed.password
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function normalizeBaseUrl(value: string | null | undefined) {
  const candidate = value?.trim();
  if (!candidate) return null;
  return normalizeHttpOrigin(
    candidate.startsWith("http://") || candidate.startsWith("https://")
      ? candidate
      : `https://${candidate}`
  );
}

export function resolveShopAiAllowedOrigins(
  requestUrl: string,
  environment: ShopAiRequestBoundaryEnvironment = process.env as ShopAiRequestBoundaryEnvironment
) {
  const origins = new Set<string>();
  const requestOrigin = normalizeHttpOrigin(requestUrl);
  if (requestOrigin) origins.add(requestOrigin);

  const siteOrigin = normalizeHttpOrigin(environment.NEXT_PUBLIC_SITE_URL);
  if (siteOrigin) origins.add(siteOrigin);

  const baseOrigin = normalizeBaseUrl(environment.NEXT_PUBLIC_BASE_URL);
  if (baseOrigin) origins.add(baseOrigin);

  const vercelOrigin = normalizeBaseUrl(environment.VERCEL_URL);
  if (vercelOrigin) origins.add(vercelOrigin);

  for (const configuredOrigin of (environment.SHOP_AI_ALLOWED_ORIGINS ?? "").split(",")) {
    const origin = normalizeHttpOrigin(configuredOrigin);
    if (origin) origins.add(origin);
  }

  return origins;
}

/**
 * One AI is a browser-facing JSON endpoint. Requiring a trusted Origin and a
 * non-simple JSON content type prevents cross-site form/text requests from
 * spending AI budget or writing feedback. Protected eval sends the evaluated
 * target's own origin explicitly.
 */
export function validateShopAiJsonRequest(
  headers: Headers,
  requestUrl: string,
  environment: ShopAiRequestBoundaryEnvironment = process.env as ShopAiRequestBoundaryEnvironment
): ShopAiRequestBoundaryResult {
  const mediaType = headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    return {
      ok: false,
      status: 415,
      error: "Content-Type must be application/json",
    };
  }

  const requestOrigin = normalizeHttpOrigin(headers.get("origin"));
  if (!requestOrigin || !resolveShopAiAllowedOrigins(requestUrl, environment).has(requestOrigin)) {
    return {
      ok: false,
      status: 403,
      error: "Origin is not allowed",
    };
  }

  return { ok: true };
}
