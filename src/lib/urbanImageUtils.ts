/**
 * Urban product image utilities.
 * Detects GP Products placeholder images and resolves fallback images from collections.
 */

import type { UrbanCollectionPageConfig } from '@/app/[locale]/shop/data/urbanCollectionPages';
import { URBAN_COLLECTION_CARDS } from '@/app/[locale]/shop/data/urbanCollectionsList';
import type { ShopProduct } from '@/lib/shopCatalog';
import {
  getUrbanCanonicalCollectionHandleOverride,
  getUrbanCollectionMediaRoleOverrides,
  getUrbanProgramFallbackImage,
} from '@/lib/urbanProductOverrides';
import {
  buildUrbanCollectionMediaSet,
  resolveUrbanCardVisualIntent,
  resolveUrbanVisualIntent,
  type UrbanCollectionMediaSet,
  type UrbanVisualIntent,
} from '@/lib/urbanVisualIntent';

const FALLBACK_URBAN_IMAGE = '/images/shop/urban/hero/models/defender2020Plus/2025Updates/hero-1-1920.jpg';
const G_WAGON_COLLECTION_HANDLES = new Set([
  'mercedes-g-wagon-softkit',
  'mercedes-g-wagon-w465-widetrack',
  'mercedes-g-wagon-w465-aerokit',
]);
const NON_G_WAGON_IMAGE_MARKERS = [
  'defender',
  'discovery',
  'cullinan',
  'ghost',
  'range-rover',
  'rangerover',
  'urus',
  'rsq8',
  'golf',
  'transporter',
];
const URBAN_MODEL_IMAGE_MARKERS_BY_HANDLE: Record<string, string[]> = {
  'land-rover-defender-110': ['defender', 'defender2020plus', 'defender-110', 'defender110'],
  'land-rover-defender-90': ['defender', 'defender2020plus', 'defender-90', 'defender90'],
  'land-rover-defender-130': ['defender', 'defender2020plus', 'defender-130', 'defender130'],
  'land-rover-defender-110-octa': ['defender', 'defender2020plus', 'octa'],
  'land-rover-discovery-5': ['discovery', 'discovery2021plus'],
  'range-rover-l460': ['range-rover', 'rangerover', 'rangerover2022plus', 'l460'],
  'range-rover-sport-l461': ['range-rover', 'rangerover', 'range-rover-sport', 'rangeroversport', 'sport-l461', 'l461'],
  'range-rover-sport-l494': ['range-rover', 'rangerover', 'range-rover-sport', 'rangeroversport', 'sport-l494', 'l494', 'svr'],
  'lamborghini-urus': ['urus'],
  'lamborghini-urus-se': ['urus', 'urus-se', 'urusse'],
  'lamborghini-urus-s': ['urus', 'urus-s', 'uruss'],
  'lamborghini-urus-performante': ['urus', 'urusperformante', 'urus-performante'],
  'lamborghini-aventador-s': ['aventador', 'aventador-s'],
  'rolls-royce-cullinan': ['cullinan'],
  'rolls-royce-cullinan-series-ii': ['cullinan', 'series-ii', 'seriesii'],
  'rolls-royce-ghost-series-ii': ['ghost', 'series-ii', 'seriesii'],
  'mercedes-g-wagon-softkit': ['gwagon', 'g-wagon', 'g63', 'w463', 'w463a', 'softkit', 'soft-kit'],
  'mercedes-g-wagon-w465-widetrack': ['gwagon', 'g-wagon', 'g63', 'w465', 'widetrack'],
  'mercedes-g-wagon-w465-aerokit': ['gwagon', 'g-wagon', 'g63', 'w465', 'aerokit', 'aero-kit'],
  'mercedes-eqc': ['eqc'],
  'audi-rsq8-facelift': ['rsq8'],
  'audi-rsq8': ['rsq8'],
  'audi-rs6-rs7': ['rs6', 'rs7'],
  'audi-rs4': ['rs4'],
  'audi-rs3': ['rs3'],
  'bentley-continental-gt': ['continentalgt', 'continental-gt'],
  'volkswagen-golf-r': ['golf'],
  'volkswagen-transporter-t6-1': ['transporter', 't6-1', 't61'],
};
const ALL_URBAN_MODEL_IMAGE_MARKERS = Array.from(
  new Set(Object.values(URBAN_MODEL_IMAGE_MARKERS_BY_HANDLE).flat())
);

type UrbanMediaSelectionProduct = Pick<
  ShopProduct,
  'slug' | 'title' | 'category' | 'productType' | 'tags' | 'bundle'
>;

type UrbanMediaGalleryProduct = UrbanMediaSelectionProduct &
  Pick<ShopProduct, 'image' | 'gallery'>;

function stripQueryAndHash(url: string) {
  return url.split(/[?#]/, 1)[0] ?? url;
}

function normalizeUrbanImageUrl(url: string | null | undefined) {
  const raw = String(url ?? '').replace(/^["']|["']$/g, '').trim();
  if (!raw) return '';
  return raw.startsWith('//') ? `https:${raw}` : raw;
}

function uniqueNonPlaceholderImages(urls: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      urls
        .map((url) => normalizeUrbanImageUrl(url))
        .filter((url) => url.length > 0 && !isUrbanPlaceholderImage(url))
    )
  );
}

/**
 * Detects GP Products placeholder images that should not be shown on the storefront.
 * These include "IMAGE COMING SOON" overlays and generic vehicle silhouette PNGs.
 */
export function isUrbanPlaceholderImage(url: string | null | undefined): boolean {
  const normalized = String(url ?? '').trim().toLowerCase();
  const normalizedPath = stripQueryAndHash(normalized);
  if (!normalized) return true;

  if (
    [
      'image-coming-soon',
      'coming-soon',
      'comingsoon',
      'placeholder',
      'no-image',
      'image_coming_soon',
      'gp-portal',
      'gpproducts',
    ].some((marker) => normalized.includes(marker))
  ) {
    return true;
  }

  // House of Urban sync accidentally imported generic Shopify studio PNGs for G-Wagon.
  // They are not valid product media for the storefront and should always fall back.
  if (
    normalized.includes('cdn.shopify.com/s/files/1/0733/4058/4242/files/gwagon_') &&
    normalizedPath.endsWith('.png')
  ) {
    return true;
  }

  // Block GP Products generic vehicle placeholder PNGs that masquerade as real model images
  // e.g., /L460.png, /Gwagon_e9292903-5bf9...png, /Transporter.png
  if (
    normalizedPath.includes('cdn.shopify.com') &&
    /\/(transporter|gwagon|l460|l461|l494|cullinan|defender|urus)(_[a-z0-9\-]+)?\.png$/i.test(normalizedPath)
  ) {
    return true;
  }

  return false;
}

function resolveCanonicalModelHandles(modelHandles: string[], slug?: string | null) {
  const overrideHandle = getUrbanCanonicalCollectionHandleOverride(slug);
  return Array.from(
    new Set([overrideHandle, ...modelHandles].filter((handle): handle is string => Boolean(handle)))
  );
}

function flattenSeparators(value: string) {
  return value.toLowerCase().replace(/[\s_.\-]/g, '');
}

function isUrbanImageCompatibleWithHandle(url: string, handle: string) {
  const normalized = stripQueryAndHash(normalizeUrbanImageUrl(url)).toLowerCase();
  if (!normalized || isUrbanPlaceholderImage(normalized)) {
    return false;
  }

  const rawMarkerHaystack = normalized.includes('/products/')
    ? normalized.split('/').pop() ?? normalized
    : normalized;
  // Filenames mix separators (Range_Rover vs range-rover vs rangerover, G-Wagon_Soft_Kit
  // vs gwagonsoftkit). Compare on a flattened form so markers match regardless of
  // which separator the source uses.
  const flatHaystack = flattenSeparators(rawMarkerHaystack);
  const matchedModelMarkers = ALL_URBAN_MODEL_IMAGE_MARKERS.filter((marker) =>
    flatHaystack.includes(flattenSeparators(marker))
  );
  const allowedModelMarkers = URBAN_MODEL_IMAGE_MARKERS_BY_HANDLE[handle] ?? [];
  if (
    matchedModelMarkers.length > 0 &&
    allowedModelMarkers.length > 0 &&
    !matchedModelMarkers.some((marker) => allowedModelMarkers.includes(marker))
  ) {
    return false;
  }

  if (
    G_WAGON_COLLECTION_HANDLES.has(handle) &&
    NON_G_WAGON_IMAGE_MARKERS.some((marker) => flatHaystack.includes(flattenSeparators(marker)))
  ) {
    return false;
  }

  if (handle === 'mercedes-g-wagon-softkit') {
    return !flatHaystack.includes('gwagonwidetrack') && !flatHaystack.includes('gwagonaerokit');
  }

  if (handle === 'mercedes-g-wagon-w465-widetrack') {
    return !flatHaystack.includes('gwagonsoftkit') && !flatHaystack.includes('gwagonaerokit');
  }

  if (handle === 'mercedes-g-wagon-w465-aerokit') {
    return !flatHaystack.includes('gwagonsoftkit') && !flatHaystack.includes('gwagonwidetrack');
  }

  return true;
}

export function isUrbanImageCompatibleWithModel(url: string, modelHandles: string[]) {
  if (!modelHandles.length) {
    return !isUrbanPlaceholderImage(url);
  }

  return modelHandles.some((handle) => isUrbanImageCompatibleWithHandle(url, handle));
}

function resolveUrbanProgramFallback(modelHandles: string[], collectionImages: string[]) {
  for (const handle of modelHandles) {
    const programFallback = getUrbanProgramFallbackImage(handle);
    if (programFallback) {
      return programFallback;
    }
  }

  for (const handle of modelHandles) {
    const card = URBAN_COLLECTION_CARDS.find((item) => item.collectionHandle === handle);
    if (card?.externalImageUrl) {
      return card.externalImageUrl;
    }
  }

  const compatibleCollectionImage = uniqueNonPlaceholderImages(collectionImages).find((url) =>
    isUrbanImageCompatibleWithModel(url, modelHandles)
  );
  if (compatibleCollectionImage) {
    return compatibleCollectionImage;
  }

  return FALLBACK_URBAN_IMAGE;
}

export function isUrbanBlueprintImage(url: string) {
  const normalized = stripQueryAndHash(normalizeUrbanImageUrl(url)).toLowerCase();
  return (
    normalized.includes('blueprint-') ||
    normalized.includes('/kits/models/')
  );
}

export function isUrbanGenericCarouselImage(url: string | null | undefined): boolean {
  const path = stripQueryAndHash(normalizeUrbanImageUrl(url)).toLowerCase();
  if (!path) return false;
  if (!/\/carousel\/models\/[^/]+\/(webp\/)?[a-z0-9._-]+-\d+(?:-\d+)?\.(webp|jpg|jpeg|png)$/.test(path)) {
    return false;
  }
  const filename = path.split('/').pop() ?? path;
  return !/\b(front|rear|back|side|left|right|detail|wheel|arch|exhaust|grille|hood|spoiler|hero)\b/.test(filename);
}

export function classifyUrbanCollectionImageRole(url: string) {
  const normalized = stripQueryAndHash(normalizeUrbanImageUrl(url)).toLowerCase();

  if (
    normalized.includes('detail') ||
    normalized.includes('mirror') ||
    normalized.includes('badge') ||
    normalized.includes('trim')
  ) {
    return 'detail' as const;
  }
  if (
    normalized.includes('/back') ||
    normalized.includes('-back') ||
    normalized.includes('rear') ||
    normalized.includes('diffuser') ||
    normalized.includes('exhaust')
  ) {
    return 'rear' as const;
  }
  if (
    normalized.includes('/left') ||
    normalized.includes('/right') ||
    normalized.includes('-left') ||
    normalized.includes('-right') ||
    normalized.includes('side') ||
    normalized.includes('wheel') ||
    normalized.includes('arch')
  ) {
    return 'side' as const;
  }
  if (
    normalized.includes('/front') ||
    normalized.includes('-front') ||
    normalized.includes('front') ||
    normalized.includes('grille') ||
    normalized.includes('hood')
  ) {
    return 'front' as const;
  }
  if (normalized.includes('/hero/') || normalized.includes('hero-')) {
    return 'hero' as const;
  }
  return 'neutral' as const;
}

function buildUrbanCollectionMediaFromUrls(
  collectionImages: string[],
  collectionHandle?: string | null
) {
  const photoGallery: string[] = [];
  const rolePhotos: UrbanCollectionMediaSet['rolePhotos'] = {
    hero: [],
    front: [],
    rear: [],
    side: [],
    detail: [],
    neutral: [],
  };
  const blueprintByIntent: UrbanCollectionMediaSet['blueprintByIntent'] = {
    front: [],
    rear: [],
    side: [],
  };

  uniqueNonPlaceholderImages(collectionImages).forEach((url) => {
    if (isUrbanBlueprintImage(url)) {
      const role = classifyUrbanCollectionImageRole(url);
      if (role === 'front') {
        blueprintByIntent.front.push(url);
      } else if (role === 'rear') {
        blueprintByIntent.rear.push(url);
      } else if (role === 'side') {
        blueprintByIntent.side.push(url);
      }
      return;
    }

    photoGallery.push(url);
    const role = classifyUrbanCollectionImageRole(url);
    if (!rolePhotos[role].includes(url)) {
      rolePhotos[role].push(url);
    }
  });

  // Merge curated role tags from URBAN_COLLECTION_MEDIA_ROLE_OVERRIDES so
  // role-based fallback selection can pick the right vehicle angle even when
  // filename heuristics yield 'neutral' (e.g. carousel-N-1920.jpg). Overrides
  // are prepended in declared order so the first listed URL wins.
  const overrides = getUrbanCollectionMediaRoleOverrides(collectionHandle);
  if (overrides) {
    (Object.keys(rolePhotos) as Array<keyof UrbanCollectionMediaSet['rolePhotos']>).forEach((role) => {
      const overrideUrls = overrides[role];
      if (!overrideUrls) return;
      const normalizedOverrides = overrideUrls
        .map((url) => normalizeUrbanImageUrl(url))
        .filter((url) => url && !isUrbanPlaceholderImage(url));
      const remaining = rolePhotos[role].filter((url) => !normalizedOverrides.includes(url));
      rolePhotos[role] = [...normalizedOverrides, ...remaining];
      normalizedOverrides.forEach((url) => {
        if (!photoGallery.includes(url)) photoGallery.push(url);
      });
    });
  }

  return {
    photoGallery,
    rolePhotos,
    blueprintByIntent,
  };
}

function getMatchingRealPhotoForIntent(
  mediaSet: UrbanCollectionMediaSet,
  intent: UrbanVisualIntent
) {
  if (intent === 'package') {
    return mediaSet.rolePhotos.front[0] ?? mediaSet.rolePhotos.hero[0] ?? mediaSet.photoGallery[0] ?? null;
  }
  if (intent === 'front') {
    return mediaSet.rolePhotos.front[0] ?? null;
  }
  if (intent === 'rear') {
    return mediaSet.rolePhotos.rear[0] ?? null;
  }
  if (intent === 'side') {
    return mediaSet.rolePhotos.side[0] ?? null;
  }
  return mediaSet.rolePhotos.detail[0] ?? mediaSet.rolePhotos.neutral[0] ?? mediaSet.rolePhotos.hero[0] ?? null;
}

function getMatchingBlueprintForIntent(
  mediaSet: UrbanCollectionMediaSet,
  intent: UrbanVisualIntent
) {
  if (intent === 'front') {
    return mediaSet.blueprintByIntent.front[0] ?? null;
  }
  if (intent === 'rear') {
    return mediaSet.blueprintByIntent.rear[0] ?? null;
  }
  if (intent === 'side') {
    return mediaSet.blueprintByIntent.side[0] ?? null;
  }
  return null;
}

function ownImageMatchesIntent(url: string, intent: UrbanVisualIntent) {
  if (isUrbanBlueprintImage(url)) {
    const blueprintRole = classifyUrbanCollectionImageRole(url);
    if (intent === 'front') return blueprintRole === 'front';
    if (intent === 'rear') return blueprintRole === 'rear';
    if (intent === 'side') return blueprintRole === 'side';
    return intent === 'detail';
  }

  const role = classifyUrbanCollectionImageRole(url);

  if (intent === 'front') {
    return role === 'front' || role === 'hero';
  }

  if (intent === 'rear') {
    return role === 'rear';
  }

  if (intent === 'side') {
    return role === 'side';
  }

  if (intent === 'detail') {
    return role === 'detail' || role === 'neutral';
  }

  return role === 'front' || role === 'hero';
}

export function buildUrbanCollectionPhotoGallery(
  config: UrbanCollectionPageConfig | null | undefined,
  collectionHandle?: string | null
) {
  return buildUrbanCollectionMediaSet(config, collectionHandle).photoGallery;
}

/**
 * Given a product image URL and the model handles it belongs to,
 * returns a real image URL — either the original (if valid) or a collection fallback.
 */
export function resolveUrbanProductImage(
  image: string | undefined | null,
  modelHandles: string[],
  slug?: string | null
): string {
  const resolvedModelHandles = resolveCanonicalModelHandles(modelHandles, slug);
  const raw = normalizeUrbanImageUrl(image);

  if (raw && !isUrbanPlaceholderImage(raw) && isUrbanImageCompatibleWithModel(raw, resolvedModelHandles)) {
    return raw;
  }

  return resolveUrbanProgramFallback(resolvedModelHandles, []);
}

export function buildUrbanCollectionImagePool(
  config: UrbanCollectionPageConfig | null | undefined,
  modelHandles: string[]
): string[] {
  const cardImages = modelHandles.map((handle) => {
    const card = URBAN_COLLECTION_CARDS.find((item) => item.collectionHandle === handle);
    return card?.externalImageUrl;
  });
  const mediaSet = buildUrbanCollectionMediaSet(config, modelHandles[0]);

  return uniqueNonPlaceholderImages([
    ...mediaSet.photoGallery,
    ...cardImages,
    ...mediaSet.blueprintByIntent.front,
    ...mediaSet.blueprintByIntent.side,
    ...mediaSet.blueprintByIntent.rear,
  ]);
}

export function resolveUrbanCollectionCardImage(
  image: string | undefined | null,
  modelHandles: string[],
  collectionImages: string[],
  seed: string,
  gallery: Array<string | null | undefined> = [],
  product?: UrbanMediaSelectionProduct
): string {
  const resolvedModelHandles = resolveCanonicalModelHandles(modelHandles, product?.slug ?? seed);
  const ownImages = uniqueNonPlaceholderImages([image, ...gallery]).filter((url) =>
    isUrbanImageCompatibleWithModel(url, resolvedModelHandles)
  );
  // Generic carousel kit-shots are compatible with the model but not specific
  // product photos; treat them as last-resort fallback rather than authoritative
  // own images so role-tagged collection media can win for products with a
  // strong visual intent (rear/front/side/detail).
  const realOwnImages = ownImages.filter((url) => !isUrbanGenericCarouselImage(url));
  const genericOwnCarousel = ownImages.filter((url) => isUrbanGenericCarouselImage(url));
  const intent = product ? resolveUrbanCardVisualIntent(product) : 'detail';
  const matchingRealOwnImages = realOwnImages.filter((url) => ownImageMatchesIntent(url, intent));

  if (matchingRealOwnImages.length > 0) {
    return matchingRealOwnImages[0]!;
  }

  if (realOwnImages.length > 0) {
    return realOwnImages[0]!;
  }

  const mediaSet = buildUrbanCollectionMediaFromUrls(collectionImages, resolvedModelHandles[0]);
  const realCandidate = getMatchingRealPhotoForIntent(mediaSet, intent);
  if (realCandidate && isUrbanImageCompatibleWithModel(realCandidate, resolvedModelHandles)) {
    return realCandidate;
  }

  const blueprintCandidate = getMatchingBlueprintForIntent(mediaSet, intent);
  if (blueprintCandidate && isUrbanImageCompatibleWithModel(blueprintCandidate, resolvedModelHandles)) {
    return blueprintCandidate;
  }

  if (genericOwnCarousel.length > 0) {
    return genericOwnCarousel[0]!;
  }

  if (!product) {
    return resolveUrbanProgramFallback(resolvedModelHandles, collectionImages);
  }

  const stableFallback =
    uniqueNonPlaceholderImages([
      ...mediaSet.rolePhotos.hero,
      ...mediaSet.photoGallery,
      ...collectionImages,
    ]).find((url) => isUrbanImageCompatibleWithModel(url, resolvedModelHandles)) ?? null;

  if (stableFallback) {
    return stableFallback;
  }

  return resolveUrbanProgramFallback(resolvedModelHandles, collectionImages);
}

export function resolveUrbanProductGallery(
  product: UrbanMediaGalleryProduct,
  modelHandles: string[],
  config: UrbanCollectionPageConfig | null | undefined
) {
  const resolvedModelHandles = resolveCanonicalModelHandles(modelHandles, product.slug);
  const ownImages = uniqueNonPlaceholderImages([product.image, ...(product.gallery ?? [])]).filter((url) =>
    isUrbanImageCompatibleWithModel(url, resolvedModelHandles)
  );
  const realOwnImages = ownImages.filter((url) => !isUrbanGenericCarouselImage(url));
  const genericOwnCarousel = ownImages.filter((url) => isUrbanGenericCarouselImage(url));
  const intent = resolveUrbanVisualIntent(product);
  const mediaSet = buildUrbanCollectionMediaSet(config, resolvedModelHandles[0]);

  // Real (non-generic) product photos take priority — they're the actual item.
  if (realOwnImages.length > 0) {
    return realOwnImages;
  }

  if (intent === 'package' && mediaSet.photoGallery.length > 0) {
    return mediaSet.photoGallery;
  }

  // Build a hybrid gallery: role-matched collection shots first (best context
  // for the part), then any generic carousel from the product (vehicle context),
  // then fallback shots — only if everything else is empty.
  const candidates: string[] = [];
  const realCandidate = getMatchingRealPhotoForIntent(mediaSet, intent);
  if (realCandidate && isUrbanImageCompatibleWithModel(realCandidate, resolvedModelHandles)) {
    candidates.push(realCandidate);
  }
  const blueprintCandidate = getMatchingBlueprintForIntent(mediaSet, intent);
  if (blueprintCandidate && isUrbanImageCompatibleWithModel(blueprintCandidate, resolvedModelHandles)) {
    candidates.push(blueprintCandidate);
  }
  for (const url of genericOwnCarousel) {
    if (!candidates.includes(url)) candidates.push(url);
  }
  if (candidates.length > 0) {
    return candidates;
  }

  return [resolveUrbanProgramFallback(resolvedModelHandles, mediaSet.photoGallery)];
}

/**
 * Filter placeholder images out of a gallery array and replace with collection fallback.
 */
export function filterUrbanGalleryImages(
  gallery: (string | null | undefined)[],
  modelHandles: string[]
): string[] {
  const resolvedModelHandles = resolveCanonicalModelHandles(modelHandles);
  const filtered = uniqueNonPlaceholderImages(gallery).filter((url) =>
    isUrbanImageCompatibleWithModel(url, resolvedModelHandles)
  );

  if (filtered.length === 0) {
    return [resolveUrbanProgramFallback(resolvedModelHandles, [])];
  }

  return filtered;
}
