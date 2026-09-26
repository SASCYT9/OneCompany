import media from "./urbanVerifiedProductMedia.json";

export type UrbanVerifiedProductMedia = {
  source: string;
  image: string;
  gallery: string[];
};

/** Reviewed legacy media corrections. Admin-owned media takes priority when its marker is set. */
export function getUrbanVerifiedProductMedia(
  slugOrSku: string | null | undefined
): UrbanVerifiedProductMedia | null {
  const key = String(slugOrSku ?? "")
    .trim()
    .toLowerCase();
  return Object.hasOwn(media, key)
    ? (media as Record<string, UrbanVerifiedProductMedia>)[key]
    : null;
}
