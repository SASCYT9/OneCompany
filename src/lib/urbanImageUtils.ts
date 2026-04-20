/**
 * Urban product image utilities.
 * Detects GP Products placeholder images and resolves fallback images from collections.
 */

import type { UrbanCollectionPageConfig } from '@/app/[locale]/shop/data/urbanCollectionPages';
import { URBAN_COLLECTION_CARDS } from '@/app/[locale]/shop/data/urbanCollectionsList';
import {
  getUrbanCanonicalCollectionHandleOverride,
  getUrbanProgramFallbackImage,
} from '@/lib/urbanProductOverrides';

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

  const configImages = config
    ? [
        config.hero.externalPosterUrl,
        config.overview.externalImageUrl,
        ...config.gallery.slides.map((slide) => slide.externalImageUrl),
        ...config.bannerStack.banners
          .filter((banner) => banner.mediaType === 'image')
          .map((banner) => banner.externalImageUrl),
        ...config.blueprint.views.map((view) => view.externalImageUrl),
      ]
    : [];

  return uniqueNonPlaceholderImages([...cardImages, ...configImages]);
}

export function resolveUrbanCollectionCardImage(
  image: string | undefined | null,
  modelHandles: string[],
  collectionImages: string[],
  seed: string,
  gallery: Array<string | null | undefined> = []
): string {
  const resolvedModelHandles = resolveCanonicalModelHandles(modelHandles, seed);
  const raw = normalizeUrbanImageUrl(image);

  if (raw && !isUrbanPlaceholderImage(raw) && isUrbanImageCompatibleWithModel(raw, resolvedModelHandles)) {
    return raw;
  }

  const galleryCandidate = uniqueNonPlaceholderImages(gallery).find((url) =>
    isUrbanImageCompatibleWithModel(url, resolvedModelHandles)
  );
  if (galleryCandidate) {
    return galleryCandidate;
  }

  return resolveUrbanProgramFallback(resolvedModelHandles, collectionImages);
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
