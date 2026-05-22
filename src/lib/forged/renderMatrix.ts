import type { Material } from "./configSchema";

export function colorToken(hex: string): string {
  return hex.replace(/^#/, "").toLowerCase();
}

/**
 * Photoreal configurator renders are generated assets, not live composites.
 * Path convention:
 * /public/forged/renders/<car-slug>/<design-slug>/<material>.jpg
 */
export function getForgedCarRenderUrl(
  carSlug: string,
  designSlug: string,
  material: Material
): string {
  return `/forged/renders/${carSlug}/${designSlug}/${material}.jpg`;
}
