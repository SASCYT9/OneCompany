import type { ShopProduct } from '@/lib/shopCatalog';

type BrabusImageProduct = Pick<ShopProduct, 'brand' | 'slug' | 'sku' | 'tags' | 'title' | 'collection' | 'image'>;

const BRABUS_GENERIC_FALLBACK = '/images/shop/brabus/hq/brabus-portal-hero.png';

function normalizeSegment(value: string | null | undefined) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle));
}

export function isBrabusLocalImage(src: string | null | undefined) {
  return normalizeSegment(src).startsWith('brabus-images ');
}

export function resolveBrabusFallbackImage(product: BrabusImageProduct): string | null {
  if (normalizeSegment(product.brand) !== 'brabus') {
    return null;
  }

  const searchIndex = [
    product.slug,
    product.sku,
    product.image,
    product.title?.ua,
    product.title?.en,
    product.collection?.ua,
    product.collection?.en,
    ...(product.tags ?? []),
  ]
    .map(normalizeSegment)
    .filter(Boolean)
    .join(' | ');

  if (includesAny(searchIndex, ['porsche', 'taycan', '911 turbo', '911'])) {
    return '/images/shop/brabus/hq/brabus_porsche_rocket_stealth.png';
  }

  if (includesAny(searchIndex, ['rolls', 'ghost', 'cullinan', 'masterpiece', 'signature carbon'])) {
    return '/images/shop/brabus/hq/brabus_stealth_masterpiece.png';
  }

  if (includesAny(searchIndex, ['bentley', 'continental gt', 'continental gtc'])) {
    return '/images/shop/brabus/hq/brabus_bentley_stealth.png';
  }

  if (includesAny(searchIndex, ['range rover', 'p530'])) {
    return '/images/shop/brabus/hq/brabus_range_rover_stealth.png';
  }

  if (includesAny(searchIndex, ['urus', 'lamborghini'])) {
    return '/images/shop/brabus/hq/brabus_urus_stealth.png';
  }

  if (includesAny(searchIndex, ['g-klasse', 'g klasse', 'g class', 'w 463a', 'w463a', 'w 465', 'w465', 'amg g 63', 'g 500', 'g 350'])) {
    return '/images/shop/brabus/hq/brabus_gclass_stealth.png';
  }

  if (includesAny(searchIndex, ['gt-klasse', 'gt klasse', 'amg gt', 's-klasse', 's klasse', 'sl-klasse', 'sl klasse', 'maybach', 'z 223', 'w 223', 'v 223', 'a 217', 'c 217', 'amg s 63', 'amg s 65'])) {
    return '/images/shop/brabus/hq/brabus_s63_stealth.png';
  }

  if (includesAny(searchIndex, ['interior', "інтер'єр", 'salon', 'салон', 'dashboard', 'панель', 'steering wheel', 'керма', 'armrest', 'підлокіт', 'floor', 'килим', 'accessories', 'аксесуар', 'signature carbon'])) {
    return '/images/shop/brabus/hq/brabus_stealth_interior.png';
  }

  if (includesAny(searchIndex, ['engine', 'rocket 1000', 'rocket 900', 'powerxtra', 'valve exhaust', 'вихлоп'])) {
    return '/images/shop/brabus/hq/brabus_carbon_engine.png';
  }

  return BRABUS_GENERIC_FALLBACK;
}
