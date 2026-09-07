/**
 * Pure cache contract for Catalog V2 reads.
 *
 * A cache entry is shareable only after the canonical aggregate, its published
 * projection and source coverage describe the same complete release. Keeping
 * this decision separate from Next/Vercel APIs makes it testable and keeps a
 * failed publication or reader rollback fail closed.
 */

export type ShopCatalogCacheRoute =
  "html" | "rsc" | "search" | "facets" | "suggestions" | "recommendations";

export type ShopCatalogCacheAudience = "public" | "customer";
export type ShopCatalogCacheReaderMode = "active" | "shadow" | "rollback";
export type ShopCatalogCachePublicationStatus = "PUBLISHED" | "SAVED" | "PUBLISHING" | "FAILED";

export type ShopCatalogCachePolicyInput = {
  route: ShopCatalogCacheRoute;
  audience: ShopCatalogCacheAudience;
  hasCustomerSession: boolean;
  isB2b: boolean;
  readerMode: ShopCatalogCacheReaderMode;
  publicationStatus: ShopCatalogCachePublicationStatus;
  sourceCoverageComplete: boolean;
  canonicalVersion: string | number | bigint | null | undefined;
  publishedVersion: string | number | bigint | null | undefined;
  projectionVersion: string | number | bigint | null | undefined;
};

export type ShopCatalogCachePolicy = {
  shareable: boolean;
  cacheControl: string;
  maxAgeSeconds: number;
  staleWhileRevalidateSeconds: number;
  reason:
    | "public_complete_release"
    | "customer_session"
    | "b2b_audience"
    | "reader_rollback"
    | "shadow_reader"
    | "publication_not_complete"
    | "source_coverage_incomplete"
    | "version_missing"
    | "version_mismatch";
};

const TTL_SECONDS: Readonly<Record<ShopCatalogCacheRoute, readonly [number, number]>> = {
  html: [300, 600],
  rsc: [60, 120],
  search: [60, 120],
  facets: [30, 30],
  suggestions: [120, 300],
  recommendations: [60, 300],
};

function normalizedVersion(
  value: string | number | bigint | null | undefined,
  field: string
): string | null {
  if (value == null) return null;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new TypeError(`${field} must be a non-negative integer`);
    }
    return String(value);
  }
  const text = String(value);
  if (!/^\d+$/.test(text)) throw new TypeError(`${field} must be an unsigned decimal integer`);
  return BigInt(text).toString();
}

function noStore(reason: ShopCatalogCachePolicy["reason"]): ShopCatalogCachePolicy {
  return Object.freeze({
    shareable: false,
    cacheControl: "private, no-store",
    maxAgeSeconds: 0,
    staleWhileRevalidateSeconds: 0,
    reason,
  });
}

/** Resolve whether a storefront response may enter a shared CDN cache. */
export function resolveShopCatalogCachePolicy(
  input: ShopCatalogCachePolicyInput
): ShopCatalogCachePolicy {
  if (input.hasCustomerSession || input.audience === "customer") return noStore("customer_session");
  if (input.isB2b) return noStore("b2b_audience");
  if (input.readerMode === "rollback") return noStore("reader_rollback");
  if (input.readerMode === "shadow") return noStore("shadow_reader");
  if (input.publicationStatus !== "PUBLISHED") return noStore("publication_not_complete");
  if (!input.sourceCoverageComplete) return noStore("source_coverage_incomplete");

  const canonicalVersion = normalizedVersion(input.canonicalVersion, "canonicalVersion");
  const publishedVersion = normalizedVersion(input.publishedVersion, "publishedVersion");
  const projectionVersion = normalizedVersion(input.projectionVersion, "projectionVersion");
  if (!canonicalVersion || !publishedVersion || !projectionVersion)
    return noStore("version_missing");
  if (canonicalVersion !== publishedVersion || publishedVersion !== projectionVersion) {
    return noStore("version_mismatch");
  }

  const [maxAgeSeconds, staleWhileRevalidateSeconds] = TTL_SECONDS[input.route];
  return Object.freeze({
    shareable: true,
    cacheControl: `public, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`,
    maxAgeSeconds,
    staleWhileRevalidateSeconds,
    reason: "public_complete_release",
  });
}

export type ShopCatalogCacheKeyInput = {
  route: ShopCatalogCacheRoute;
  locale: string;
  country?: string | null;
  currency?: string | null;
  queryFingerprint: string;
  publishedVersion: string | number | bigint;
};

function keyPart(value: string, field: string) {
  if (/[^\S\r\n]*[\r\n]/.test(value) || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new TypeError(`${field} is invalid`);
  }
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${field} is required`);
  if (normalized.length > 256) {
    throw new TypeError(`${field} is invalid`);
  }
  return normalized;
}

/** Build a versioned shared-cache key; customer-specific requests must not use it. */
export function buildShopCatalogCacheKey(input: ShopCatalogCacheKeyInput): string {
  const version = normalizedVersion(input.publishedVersion, "publishedVersion");
  if (!version) throw new TypeError("publishedVersion is required");
  return [
    "shop-catalog-v2",
    keyPart(input.route, "route"),
    keyPart(input.locale, "locale").toLowerCase(),
    keyPart(input.country ?? "global", "country").toLowerCase(),
    keyPart(input.currency ?? "default", "currency").toUpperCase(),
    keyPart(input.queryFingerprint, "queryFingerprint"),
    version,
  ].join(":");
}
