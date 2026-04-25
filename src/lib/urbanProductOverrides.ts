const URBAN_CANONICAL_COLLECTION_HANDLE_OVERRIDES: Record<string, string> = {
  'urb-bun-25358198-v1': 'mercedes-g-wagon-softkit',
  'urb-bun-25358207-v1': 'mercedes-g-wagon-w465-widetrack',
};

const URBAN_PRODUCT_TITLE_OVERRIDES: Record<string, { ua: string; en: string }> = {
  'urb-bun-25358198-v1': {
    ua: 'Пакет Urban Soft Kit для Mercedes-Benz G-Wagon W463A',
    en: 'Urban Soft Kit Package for Mercedes-Benz G-Wagon W463A',
  },
  'urb-bun-25358207-v1': {
    ua: 'Комплект обвісу Urban Widetrack для Mercedes-Benz G-Wagon W465',
    en: 'Urban Widetrack Body Kit for Mercedes-Benz G-Wagon W465',
  },
  'urb-bod-25353141-v1': {
    ua: 'Повний пакет Urban Facelift 2020+ для Land Rover Discovery 5',
    en: 'Urban Facelift 2020+ Full Package for Land Rover Discovery 5',
  },
  'urb-bod-25353142-v1': {
    ua: 'Bodykit Urban Facelift 2020+ для Land Rover Discovery 5',
    en: 'Urban Facelift 2020+ Bodykit for Land Rover Discovery 5',
  },
  'urb-bod-25353138-v1': {
    ua: 'Повний пакет Urban Pre-Facelift 2017-2020 для Land Rover Discovery 5',
    en: 'Urban Pre-Facelift 2017-2020 Full Package for Land Rover Discovery 5',
  },
  'urb-bod-25353139-v1': {
    ua: 'Bodykit Urban Pre-Facelift 2017-2020 для Land Rover Discovery 5',
    en: 'Urban Pre-Facelift 2017-2020 Bodykit for Land Rover Discovery 5',
  },
};

const URBAN_PROGRAM_FALLBACK_IMAGES: Record<string, string> = {
  'mercedes-g-wagon-softkit': '/images/shop/urban/carousel/models/gwagonSoftKit/carousel-1-1920.jpg',
  'mercedes-g-wagon-w465-aerokit':
    '/images/shop/urban/carousel/models/gwagonAeroKit2024/webp/urban-automotive-g-wagon-g63-w465-aerokit-1-2560.webp',
  'mercedes-g-wagon-w465-widetrack':
    '/images/shop/urban/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-5-2560.webp',
};
const URBAN_COLLECTION_MEDIA_ROLE_OVERRIDES: Record<string, Partial<Record<string, string[]>>> = {};

export function getUrbanCanonicalCollectionHandleOverride(slug: string | null | undefined) {
  return slug ? (URBAN_CANONICAL_COLLECTION_HANDLE_OVERRIDES[slug] ?? null) : null;
}

export function getUrbanProductTitleOverrides(slug: string | null | undefined) {
  return slug ? (URBAN_PRODUCT_TITLE_OVERRIDES[slug] ?? null) : null;
}

export function getUrbanProductTitleOverrideForLocale(
  slug: string | null | undefined,
  locale: 'ua' | 'en'
) {
  const overrides = getUrbanProductTitleOverrides(slug);
  return overrides ? overrides[locale] : null;
}

export function getUrbanProgramFallbackImage(handle: string | null | undefined) {
  return handle ? (URBAN_PROGRAM_FALLBACK_IMAGES[handle] ?? null) : null;
}

export function getUrbanCollectionMediaRoleOverrides(handle: string | null | undefined) {
  return handle ? (URBAN_COLLECTION_MEDIA_ROLE_OVERRIDES[handle] ?? null) : null;
}
