/**
 * Urban product image utilities.
 * Detects GP Products placeholder images and resolves fallback images from collections.
 */

import type { UrbanCollectionPageConfig } from '@/app/[locale]/shop/data/urbanCollectionPages';
import { URBAN_COLLECTION_CARDS } from '@/app/[locale]/shop/data/urbanCollectionsList';
import type { ShopProduct } from '@/lib/shopCatalog';
import {
  getUrbanCanonicalCollectionHandleOverride,
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

function isUrbanImageCompatibleWithHandle(url: string, handle: string) {
  const normalized = stripQueryAndHash(normalizeUrbanImageUrl(url)).toLowerCase();
  if (!normalized || isUrbanPlaceholderImage(normalized)) {
    return false;
  }

  if (G_WAGON_COLLECTION_HANDLES.has(handle) && NON_G_WAGON_IMAGE_MARKERS.some((marker) => normalized.includes(marker))) {
    return false;
  }

  if (handle === 'mercedes-g-wagon-softkit') {
    return !normalized.includes('gwagonwidetrack2024') && !normalized.includes('gwagonaerokit2024');
  }

  if (handle === 'mercedes-g-wagon-w465-widetrack') {
    return !normalized.includes('gwagonsoftkit') && !normalized.includes('gwagonaerokit2024');
  }

  if (handle === 'mercedes-g-wagon-w465-aerokit') {
    return !normalized.includes('gwagonsoftkit') && !normalized.includes('gwagonwidetrack2024');
  }

  return true;
}

function isUrbanImageCompatibleWithModel(url: string, modelHandles: string[]) {
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

function isUrbanBlueprintImage(url: string) {
  const normalized = stripQueryAndHash(normalizeUrbanImageUrl(url)).toLowerCase();
  return (
    normalized.includes('blueprint-') ||
    normalized.includes('/kits/models/')
  );
}

function classifyUrbanCollectionImageRole(url: string) {
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

function buildUrbanCollectionMediaFromUrls(collectionImages: string[]) {
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
  const intent = product ? resolveUrbanCardVisualIntent(product) : 'detail';
  const matchingOwnImages = ownImages.filter((url) => ownImageMatchesIntent(url, intent));

  if (matchingOwnImages.length > 0) {
    return matchingOwnImages[0]!;
  }

  if (!product) {
    return resolveUrbanProgramFallback(resolvedModelHandles, collectionImages);
  }

  const mediaSet = buildUrbanCollectionMediaFromUrls(collectionImages);
  const realCandidate = getMatchingRealPhotoForIntent(mediaSet, intent);
  if (realCandidate && isUrbanImageCompatibleWithModel(realCandidate, resolvedModelHandles)) {
    return realCandidate;
  }

  const blueprintCandidate = getMatchingBlueprintForIntent(mediaSet, intent);
  if (blueprintCandidate && isUrbanImageCompatibleWithModel(blueprintCandidate, resolvedModelHandles)) {
    return blueprintCandidate;
  }

  const stableFallback =
    mediaSet.rolePhotos.hero[0] ??
    mediaSet.photoGallery[0] ??
    uniqueNonPlaceholderImages(collectionImages).find((url) =>
      isUrbanImageCompatibleWithModel(url, resolvedModelHandles)
    ) ??
    null;

  if (stableFallback) {
    return stableFallback;
  }

  if (ownImages.length > 0) {
    return ownImages[0]!;
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
  const intent = resolveUrbanVisualIntent(product);
  const mediaSet = buildUrbanCollectionMediaSet(config, resolvedModelHandles[0]);

  if (intent === 'package' && mediaSet.photoGallery.length > 0) {
    return mediaSet.photoGallery;
  }

  if (ownImages.length > 0) {
    return ownImages;
  }

  const realCandidate = getMatchingRealPhotoForIntent(mediaSet, intent);
  if (realCandidate && isUrbanImageCompatibleWithModel(realCandidate, resolvedModelHandles)) {
    return [realCandidate];
  }

  const blueprintCandidate = getMatchingBlueprintForIntent(mediaSet, intent);
  if (blueprintCandidate && isUrbanImageCompatibleWithModel(blueprintCandidate, resolvedModelHandles)) {
    return [blueprintCandidate];
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
