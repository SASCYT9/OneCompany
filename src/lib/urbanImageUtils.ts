/**
 * Urban product image utilities.
 * Detects GP Products placeholder images and resolves fallback images from collections.
 */

import { URBAN_COLLECTION_CARDS } from '@/app/[locale]/shop/data/urbanCollectionsList';

const FALLBACK_URBAN_IMAGE = '/images/shop/urban/hero/models/defender2020Plus/2025Updates/hero-1-1920.jpg';

function stripQueryAndHash(url: string) {
  return url.split(/[?#]/, 1)[0] ?? url;
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

/**
 * Given a product image URL and the model handles it belongs to,
 * returns a real image URL — either the original (if valid) or a collection fallback.
 */
export function resolveUrbanProductImage(
  image: string | undefined | null,
  modelHandles: string[]
): string {
  let raw = image ? image.replace(/^["']|["']$/g, '').trim() : '';
  if (raw.startsWith('//')) raw = `https:${raw}`;

  if (!raw || isUrbanPlaceholderImage(raw)) {
    for (const handle of modelHandles) {
      const card = URBAN_COLLECTION_CARDS.find((c) => c.collectionHandle === handle);
      if (card?.externalImageUrl) return card.externalImageUrl;
    }
    return FALLBACK_URBAN_IMAGE;
  }

  return raw;
}

/**
 * Filter placeholder images out of a gallery array and replace with collection fallback.
 */
export function filterUrbanGalleryImages(
  gallery: (string | null | undefined)[],
  modelHandles: string[]
): string[] {
  const filtered = gallery
    .map((g) => {
      if (!g) return '';
      const raw = g.replace(/^["']|["']$/g, '').trim();
      return raw.startsWith('//') ? `https:${raw}` : raw;
    })
    .filter((url) => url.length > 0 && !isUrbanPlaceholderImage(url));

  if (filtered.length === 0) {
    // All images were placeholders — return at least the collection fallback
    for (const handle of modelHandles) {
      const card = URBAN_COLLECTION_CARDS.find((c) => c.collectionHandle === handle);
      if (card?.externalImageUrl) return [card.externalImageUrl];
    }
    return [FALLBACK_URBAN_IMAGE];
  }

  return filtered;
}
