const SHOPIFY_CDN_URL = /^https?:\/\/cdn\.shopify\.com\//i;
const SHOPIFY_UUID_SUFFIX_PATTERN =
  /_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.(?:jpg|jpeg|png|webp|gif|avif))/i;
const SHOPIFY_GENERIC_MEDIA_NAME =
  /\/(?:media|image|img|photo|file|picture)_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|jpeg|png|webp|gif|avif)(?:[?#]|$)/i;

/**
 * Shopify CDN sometimes serves a clean re-upload of an asset and 404s the
 * original `_<uuid>` filename (seen with Urban Automotive:
 * `Studio-10_df5ca99f-….jpg` → 404, `Studio-10.jpg` → 200), so DB-cached URLs
 * are repaired by dropping the UUID.
 *
 * Files uploaded through Shopify's media library are named `media_<uuid>.jpg`
 * (Link ECU): there the UUID is the file's identity and `media.jpg` is an
 * unrelated asset of the same store, so such URLs are never rewritten.
 */
export function stripStaleShopifyUuidSuffix(url: string) {
  if (!SHOPIFY_CDN_URL.test(url) || SHOPIFY_GENERIC_MEDIA_NAME.test(url)) return url;
  return url.replace(SHOPIFY_UUID_SUFFIX_PATTERN, "$1");
}
