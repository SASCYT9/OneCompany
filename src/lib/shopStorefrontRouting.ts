import type { ShopProduct } from '@/lib/shopCatalog';

type StorefrontRouteInput = {
  slug: string;
  brand?: string | null;
  vendor?: string | null;
};

const STOREFRONT_SEGMENT_BY_BRAND = new Map<string, string>([
  ['adro', 'adro'],
  ['akrapovic', 'akrapovic'],
  ['akrapovic', 'akrapovic'],
  ['brabus', 'brabus'],
  ['burger motorsports', 'burger'],
  ['burger motorsports inc', 'burger'],
  ['burger motorsports inc.', 'burger'],
  ['burger motorsports, inc.', 'burger'],
  ['csf', 'csf'],
  ['do88', 'do88'],
  ['girodisc', 'girodisc'],
  ['ipe', 'ipe'],
  ['innotech performance exhaust', 'ipe'],
  ['ohlins', 'ohlins'],
  ['racechip', 'racechip'],
  ['urban', 'urban'],
  ['urban automotive', 'urban'],
]);

function normalizeStorefrontKey(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

export function isExternalCatalogProductSlug(slug: string | null | undefined) {
  if (!slug) {
    return false;
  }

  return slug.startsWith('turn14-') || slug.startsWith('crm-');
}

export function resolveShopStorefrontSegment(input: Pick<StorefrontRouteInput, 'brand' | 'vendor'>) {
  const brandKey = normalizeStorefrontKey(input.brand);
  const vendorKey = normalizeStorefrontKey(input.vendor);

  if (brandKey && STOREFRONT_SEGMENT_BY_BRAND.has(brandKey)) {
    return STOREFRONT_SEGMENT_BY_BRAND.get(brandKey) ?? null;
  }

  if (vendorKey && STOREFRONT_SEGMENT_BY_BRAND.has(vendorKey)) {
    return STOREFRONT_SEGMENT_BY_BRAND.get(vendorKey) ?? null;
  }

  return null;
}

export function buildShopStorefrontProductPath(
  locale: string,
  input: StorefrontRouteInput
) {
  const segment = resolveShopStorefrontSegment(input);

  if (segment) {
    return `/${locale}/shop/${segment}/products/${input.slug}`;
  }

  return `/${locale}/shop/${input.slug}`;
}

export function buildShopStorefrontProductPathForProduct(
  locale: string,
  product: Pick<ShopProduct, 'slug' | 'brand' | 'vendor'>
) {
  return buildShopStorefrontProductPath(locale, product);
}
