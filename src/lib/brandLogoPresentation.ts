import { hasLightBackgroundLogo } from "@/lib/invertBrands";

/**
 * BMC's red/black transparent wordmark needs a light surface to stay legible
 * on storefront cards and filters in both color themes.
 */
export function getBrandLogoSurfaceClass(brandName: string | undefined | null): string {
  if (!hasLightBackgroundLogo(brandName)) return "";
  return "rounded-md !bg-white";
}

export function brandLogoNeedsLightSurface(brandName: string | undefined | null): boolean {
  return hasLightBackgroundLogo(brandName);
}
