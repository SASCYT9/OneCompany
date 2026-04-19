const ABSOLUTE_URL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
const SMGASSETS_IMG_BASE = 'https://smgassets.blob.core.windows.net/customers/urban/dist/img';
const KNOWN_THEME_ASSET_MAP: Record<string, string> = {
  'blueprint-cullinan-left.png': '/images/shop/urban/banners/models/cullinan/banner-1-1920.jpg',
  'blueprint-w465-front.jpg': '/images/shop/urban/banners/models/gwagonSoftKit/banner-1-1920.jpg',
  'blueprint-w465-left.jpg': '/images/shop/urban/banners/models/gwagonSoftKit/banner-1-1920.jpg',
  'blueprint-w465-right.jpg':
    '/images/shop/urban/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-11-2560.webp',
  'blueprint-w465-back.jpg':
    '/images/shop/urban/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-12-2560.webp',
};

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

  return KNOWN_THEME_ASSET_MAP[safePath] ?? '';
}
