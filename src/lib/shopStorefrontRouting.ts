import type { ShopProduct } from "@/lib/shopCatalog";
import { extractStorefrontTag } from "@/lib/shopProductStorefront";
import { isIpeBrandValue } from "@/lib/ipeBrand";
import { STOREFRONT_ROUTE_REGISTRY, type StorefrontSegment } from "@/lib/storefrontRouteRegistry";

type StorefrontRouteInput = {
  slug: string;
  brand?: string | null;
  vendor?: string | null;
  tags?: string[] | null;
};

function normalizeStorefrontKey(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

const STOREFRONT_SEGMENT_BY_BRAND = new Map<string, StorefrontSegment>(
  STOREFRONT_ROUTE_REGISTRY.flatMap((route) =>
    route.brandAliases.map((brand) => [normalizeStorefrontKey(brand), route.segment] as const)
  )
);

export function isExternalCatalogProductSlug(slug: string | null | undefined) {
  if (!slug) {
    return false;
  }

  return slug.startsWith("turn14-") || slug.startsWith("crm-");
}

export function resolveShopStorefrontSegment(
  input: Pick<StorefrontRouteInput, "brand" | "vendor" | "tags">
) {
  const brandKey = normalizeStorefrontKey(input.brand);
  const vendorKey = normalizeStorefrontKey(input.vendor);
  const explicitStorefront = extractStorefrontTag(input.tags);
  const isIpeAlias = isIpeBrandValue(input.brand) || isIpeBrandValue(input.vendor);
  const legacySegment =
    (isIpeAlias ? "ipe" : null) ||
    (brandKey && STOREFRONT_SEGMENT_BY_BRAND.get(brandKey)) ||
    (vendorKey && STOREFRONT_SEGMENT_BY_BRAND.get(vendorKey)) ||
    null;

  if (explicitStorefront === "urban") {
    return "urban";
  }

  if (explicitStorefront === "brabus") {
    return "brabus";
  }

  if (explicitStorefront === "main") {
    return legacySegment === "urban" || legacySegment === "brabus" ? null : legacySegment;
  }

  return legacySegment;
}

export function buildShopStorefrontProductPath(locale: string, input: StorefrontRouteInput) {
  const segment = resolveShopStorefrontSegment(input);

  if (segment) {
    return `/${locale}/shop/${segment}/products/${input.slug}`;
  }

  return `/${locale}/shop/${input.slug}`;
}

export function buildShopStorefrontProductPathForProduct(
  locale: string,
  product: Pick<ShopProduct, "slug" | "brand" | "vendor" | "tags">
) {
  return buildShopStorefrontProductPath(locale, product);
}

export function buildShopStorefrontRootPath(locale: string, segment: StorefrontSegment) {
  return `/${locale}/shop/${segment}`;
}

/**
 * Prefer the canonical storefront URL returned by the catalog API, but never
 * allow an unexpected locale or a non-shop URL to become a client-side
 * navigation target. Older API responses without `href` continue to use the
 * legacy short product route, which redirects to the canonical storefront.
 */
export function resolveShopCatalogProductHref(
  locale: string,
  href: string | null | undefined,
  slug: string
) {
  const resolvedLocale = locale === "en" ? "en" : "ua";
  const shopPrefix = `/${resolvedLocale}/shop/`;
  const normalizedHref = href?.trim();

  if (
    normalizedHref?.startsWith(shopPrefix) &&
    !normalizedHref.includes("\\") &&
    !/[\u0000-\u001f\u007f]/.test(normalizedHref)
  ) {
    return normalizedHref;
  }

  const normalizedSlug = slug.trim();
  return normalizedSlug
    ? `${shopPrefix}${encodeURIComponent(normalizedSlug)}`
    : `/${resolvedLocale}/shop`;
}
