const ABSOLUTE_URL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
const SMGASSETS_IMG_BASE = 'https://smgassets.blob.core.windows.net/customers/urban/dist/img';

export function resolveUrbanThemeAssetUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  // Urban images migrated to local: serve from our base
  if (trimmed.startsWith(SMGASSETS_IMG_BASE + '/')) {
    const rest = trimmed.slice(SMGASSETS_IMG_BASE.length + 1).split('?')[0];
    return '/images/shop/urban/' + rest;
  }

  if (
    ABSOLUTE_URL_RE.test(trimmed) ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  const safePath = trimmed
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `/urban-theme-assets/${safePath}`;
}
