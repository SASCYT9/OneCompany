export const URBAN_BODYKIT_QUOTE_ERROR = "URBAN_DECALS_REQUIRE_BODY_KIT_QUOTE";
export function requiresUrbanBodyKitQuote(product: { sku?: string | null; slug?: string | null }) {
  const compact = (value?: string | null) => (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return compact(product.sku) === "urbdec26009343v1" || compact(product.slug) === "urbdec26009343v1";
}
