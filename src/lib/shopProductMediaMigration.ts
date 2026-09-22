import { createHash } from "node:crypto";

import { isBlobStorageUrl } from "@/lib/runtimeAssetPaths";

export const SHOP_PRODUCT_MEDIA_BLOB_PREFIX = "media/library/shop-products/";

const SHOPIFY_UUID_SUFFIX_PATTERN =
  /_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.(?:jpg|jpeg|png|webp|gif|avif))/i;

export function normalizeShopProductMediaSource(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  return trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
}

/**
 * Returns the original URL first, followed by safe supplier-specific aliases
 * that are known to repair stale references without changing the DB identity
 * used for the deterministic Blob pathname.
 */
export function getShopProductMediaDownloadCandidates(source: string) {
  const normalized = normalizeShopProductMediaSource(source);
  if (!normalized) return [];

  const candidates = [normalized];
  try {
    const url = new URL(normalized);
    if (url.hostname.toLowerCase() === "cdn.shopify.com") {
      const upgraded = normalized.replace(SHOPIFY_UUID_SUFFIX_PATTERN, "$1");
      if (upgraded !== normalized) candidates.push(upgraded);
    }
  } catch {
    // The migration only downloads absolute HTTP(S) sources; keep the original
    // value here so the caller reports the normal source validation failure.
  }
  return candidates;
}

export function isRemoteShopProductMediaSource(value: string | null | undefined) {
  const source = normalizeShopProductMediaSource(value);
  if (!source || isBlobStorageUrl(source)) return false;

  try {
    const url = new URL(source);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function buildShopProductMediaBlobPathname(source: string) {
  const digest = createHash("sha256").update(source).digest("hex");
  return `${SHOP_PRODUCT_MEDIA_BLOB_PREFIX}${digest}`;
}

export function collectRemoteShopProductMediaSources(
  value: unknown,
  output = new Set<string>()
): Set<string> {
  if (typeof value === "string") {
    const source = normalizeShopProductMediaSource(value);
    if (source && isRemoteShopProductMediaSource(source)) output.add(source);
    return output;
  }

  if (Array.isArray(value)) {
    for (const entry of value) collectRemoteShopProductMediaSources(entry, output);
    return output;
  }

  if (value && typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      collectRemoteShopProductMediaSources(entry, output);
    }
  }

  return output;
}

export function rewriteShopProductMediaValue<T>(
  value: T,
  resolvedSources: ReadonlyMap<string, string>
): { value: T; replacements: number } {
  if (typeof value === "string") {
    const source = normalizeShopProductMediaSource(value);
    const replacement = source ? resolvedSources.get(source) : undefined;
    return replacement
      ? { value: replacement as T, replacements: 1 }
      : { value, replacements: 0 };
  }

  if (Array.isArray(value)) {
    let replacements = 0;
    const next = value.map((entry) => {
      const rewritten = rewriteShopProductMediaValue(entry, resolvedSources);
      replacements += rewritten.replacements;
      return rewritten.value;
    });
    return { value: next as T, replacements };
  }

  if (value && typeof value === "object") {
    let replacements = 0;
    const next = Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
        const rewritten = rewriteShopProductMediaValue(entry, resolvedSources);
        replacements += rewritten.replacements;
        return [key, rewritten.value];
      })
    );
    return { value: next as T, replacements };
  }

  return { value, replacements: 0 };
}
