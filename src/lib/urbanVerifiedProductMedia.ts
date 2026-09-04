import media from './urbanVerifiedProductMedia.json';

export type UrbanVerifiedProductMedia = {
  source: string;
  image: string;
  gallery: string[];
};

/** Reviewed SKU-level corrections. Keep exact source URLs, including Shopify UUIDs. */
export function getUrbanVerifiedProductMedia(slugOrSku: string | null | undefined): UrbanVerifiedProductMedia | null {
  const key = String(slugOrSku ?? '').trim().toLowerCase();
  return Object.hasOwn(media, key) ? (media as Record<string, UrbanVerifiedProductMedia>)[key] : null;
}
