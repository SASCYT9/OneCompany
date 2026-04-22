const IPE_BRAND_KEYS = new Set([
  'ipe',
  'ipe exhaust',
  'innotech performance exhaust',
]);

function normalizeIpeKey(value: string | null | undefined) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

export function isIpeBrandValue(value: string | null | undefined) {
  const normalized = normalizeIpeKey(value);
  if (!normalized) {
    return false;
  }

  return IPE_BRAND_KEYS.has(normalized) || normalized.includes('innotech performance exhaust');
}

export function hasIpeBrandTag(tags: readonly string[] | null | undefined) {
  return (tags ?? []).some((tag) => isIpeBrandValue(tag));
}

type IpeProductLike = {
  brand?: string | null;
  vendor?: string | null;
  tags?: readonly string[] | null;
};

export function isIpeProduct(product: IpeProductLike) {
  return (
    isIpeBrandValue(product.brand) ||
    isIpeBrandValue(product.vendor) ||
    hasIpeBrandTag(product.tags)
  );
}
