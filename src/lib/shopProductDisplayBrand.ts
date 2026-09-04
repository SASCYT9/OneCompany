export const URBAN_PRODUCT_BRAND_ALIASES = [
  "land rover",
  "lamborghini",
  "rolls-royce",
  "mercedes-benz",
  "audi",
  "range rover",
  "bentley",
  "volkswagen",
  "urban",
  "urban automotive",
] as const;

const URBAN_PRODUCT_BRANDS = new Set<string>(URBAN_PRODUCT_BRAND_ALIASES);

export function isUrbanProductBrand(brand: string | null | undefined): boolean {
  return Boolean(brand && URBAN_PRODUCT_BRANDS.has(brand.trim().toLowerCase()));
}

export function getProductDisplayBrand(brand: string | null | undefined): string {
  if (!brand) return "";
  return isUrbanProductBrand(brand) ? "Urban Automotive" : brand.trim();
}
