import catalogLandingBrandHubs from "@/data/shopCatalogLandingBrandHubs.json";
import type { ShopProduct } from "@/lib/shopCatalog";
import { extractStorefrontTag } from "@/lib/shopProductStorefront";
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

/** Brand key (catalog label or landing slug) → `/shop/brand/<slug>` landing page. */
const CATALOG_LANDING_BRAND_HUBS = new Map(
  Object.entries(catalogLandingBrandHubs as Record<string, string>).flatMap(([label, slug]) => [
    [normalizeStorefrontKey(label), slug] as const,
    [normalizeStorefrontKey(slug), slug] as const,
  ])
);

/** "KW Suspension", "KW Suspensions" and "kw" all reach the KW landing page. */
function resolveCatalogLandingBrandHub(brand: string | null | undefined): string | null {
  const key = normalizeStorefrontKey(brand);
  if (!key) return null;
  return (
    CATALOG_LANDING_BRAND_HUBS.get(key) ?? CATALOG_LANDING_BRAND_HUBS.get(key.split(" ")[0]) ?? null
  );
}

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
  const legacySegment =
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

/**
 * Every product lives at `/{locale}/shop/{slug}`, in one product-page design.
 * The old brand storefront URLs (`/shop/{brand}/products/{slug}`) answer with a
 * permanent redirect here (see `next.config.ts`).
 */
export function buildShopStorefrontProductPath(locale: string, input: StorefrontRouteInput) {
  return `/${locale}/shop/${input.slug}`;
}

export function buildShopStorefrontProductPathForProduct(
  locale: string,
  product: Pick<ShopProduct, "slug" | "brand" | "vendor" | "tags">
) {
  return buildShopStorefrontProductPath(locale, product);
}

/** The old storefront home of a brand segment now resolves to its catalog landing page. */
export function buildShopStorefrontRootPath(locale: string, segment: StorefrontSegment) {
  return `/${locale}/shop/brand/${segment}`;
}

/**
 * Build the destination for a product's brand label: the brand's catalog
 * landing page (`/shop/brand/{slug}`) when it has one, otherwise the main
 * catalog with a brand filter. The old brand storefronts redirect to these
 * landing pages.
 */
export function buildShopStorefrontBrandPath(locale: string, brand: string | null | undefined) {
  const normalizedLabel = brand?.trim();

  if (!normalizedLabel) return `/${locale}/shop/catalog`;

  const hub = resolveCatalogLandingBrandHub(normalizedLabel);
  if (hub) return `/${locale}/shop/brand/${hub}`;

  return `/${locale}/shop/catalog?brand=${encodeURIComponent(normalizedLabel)}`;
}

/**
 * Indexable catalog landing page of a brand (`/shop/brand/{slug}`), or `null`
 * when the brand has none.
 *
 * Brand tiles on `/brands` and category pages are modal triggers, so their
 * crawlable link is a hidden anchor. Pointing it at the brand landing gives
 * each brand internal links from the brand hubs; brands without a landing keep
 * their current target instead of a noindex `?brand=` catalog filter.
 */
export function resolveShopStorefrontBrandLandingPath(
  locale: string,
  brand: string | null | undefined
): string | null {
  if (!normalizeStorefrontKey(brand)) return null;
  const hub = resolveCatalogLandingBrandHub(brand);
  return hub ? `/${locale}/shop/brand/${hub}` : null;
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
    : `/${resolvedLocale}/shop/catalog`;
}
