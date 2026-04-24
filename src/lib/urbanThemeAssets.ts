import fs from 'node:fs';
import path from 'node:path';

const ABSOLUTE_URL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
const SMGASSETS_IMG_BASE = 'https://smgassets.blob.core.windows.net/customers/urban/dist/img';
const KNOWN_THEME_ASSET_MAP: Record<string, string> = {
};
const localAssetExistsCache = new Map<string, boolean>();

const COLLECTION_THEME_ASSET_MAP: Record<string, Record<string, string>> = {
  'mercedes-g-wagon-w465-widetrack': {
    'blueprint-w465-front.jpg':
      '/images/shop/urban/cols/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-widetrack-front-grille.webp',
    'blueprint-w465-left.jpg':
      '/images/shop/urban/hero/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-widetrack-studio-1920.webp',
    'blueprint-w465-right.jpg':
      '/images/shop/urban/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-11-2560.webp',
    'blueprint-w465-back.jpg':
      '/images/shop/urban/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-12-2560.webp',
  },
  'rolls-royce-cullinan': {
    'blueprint-cullinan-front.png': '/images/shop/urban/banners/models/cullinan/banner-1-1920.jpg',
    'blueprint-cullinan-left.png': '/images/shop/urban/banners/models/cullinan/banner-3-1920.jpg',
    'blueprint-cullinan-right.png': '/images/shop/urban/banners/models/cullinan/banner-2-1920.jpg',
    'blueprint-cullinan-back.png': '/images/shop/urban/banners/models/cullinan/banner-4-1920.jpg',
  },
  'rolls-royce-cullinan-series-ii': {
    'blueprint-cullinan-front.png':
      '/images/shop/urban/carousel/models/cullinanSeriesII/webp/urban-automotive-cullinan-series-ii-7-2560.webp',
    'blueprint-cullinan-left.png':
      '/images/shop/urban/hero/models/cullinanSeriesII/webp/urban-automotive-cullinan-profile-1920.webp',
    'blueprint-cullinan-right.png':
      '/images/shop/urban/cols/models/cullinanSeriesII/webp/urban-automotive-rolls-royce-cullinan.webp',
    'blueprint-cullinan-back.png':
      '/images/shop/urban/carousel/models/cullinanSeriesII/webp/urban-automotive-cullinan-series-ii-6-2560.webp',
  },
  'rolls-royce-ghost-series-ii': {
    'blueprint-cullinan-front.png': '/images/shop/urban/cols/models/ghost/col-image-1-lg.jpg',
    'blueprint-cullinan-left.png': '/images/shop/urban/carousel/models/ghost/carousel-18-1920.jpg',
    'blueprint-cullinan-right.png': '/images/shop/urban/hero/models/ghost/hero-1-1920.jpg',
    'blueprint-cullinan-back.png': '/images/shop/urban/banners/models/ghost/banner-2-1920.jpg',
  },
};

type ResolveUrbanThemeAssetOptions = {
  collectionHandle?: string;
};

function publicAssetExists(urlPath: string) {
  if (!urlPath.startsWith('/')) {
    return false;
  }

  const cached = localAssetExistsCache.get(urlPath);
  if (cached !== undefined) {
    return cached;
  }

  const relativePath = urlPath
    .slice(1)
    .split('/')
    .filter(Boolean);
  const filePath = path.join(process.cwd(), 'public', ...relativePath);
  const exists = fs.existsSync(filePath);
  localAssetExistsCache.set(urlPath, exists);
  return exists;
}

export function resolveUrbanThemeAssetUrl(
  value: string,
  options?: ResolveUrbanThemeAssetOptions
): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  // Urban images migrated to local: serve from our base
  if (trimmed.startsWith(SMGASSETS_IMG_BASE + '/')) {
    const rest = trimmed.slice(SMGASSETS_IMG_BASE.length + 1).split('?')[0];
    const localUrl = '/images/shop/urban/' + rest;
    return publicAssetExists(localUrl) ? localUrl : trimmed;
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

  const collectionAssetMap = options?.collectionHandle
    ? COLLECTION_THEME_ASSET_MAP[options.collectionHandle]
    : undefined;

  return collectionAssetMap?.[safePath] ?? KNOWN_THEME_ASSET_MAP[safePath] ?? '';
}
