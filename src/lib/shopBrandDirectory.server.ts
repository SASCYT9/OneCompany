import type { PrismaClient } from "@prisma/client";

/**
 * Car-make labels used to group Urban Automotive products on the storefront.
 * They are not suppliers, so the logistics tools show them as one bucket.
 */
export const URBAN_PSEUDO_BRAND_LABELS = [
  "Land Rover",
  "Lamborghini",
  "Rolls-Royce",
  "Mercedes-Benz",
  "Audi",
  "Range Rover",
  "Bentley",
  "Volkswagen",
] as const;
const URBAN_PSEUDO_BRANDS = new Set<string>(URBAN_PSEUDO_BRAND_LABELS.map((label) => label.toLowerCase()));

export const URBAN_AGGREGATE_BRAND = "Urban Automotive";

/** Distinct product brands with counts, for the logistics rule editors. */
export async function listShopBrands(
  prisma: PrismaClient
): Promise<Array<{ brand: string; productCount: number }>> {
  const rows = await prisma.shopProduct.groupBy({
    by: ["brand"],
    _count: { _all: true },
    where: { brand: { not: null } },
  });
  const isUrbanLabel = (brand: string) => URBAN_PSEUDO_BRANDS.has(brand.trim().toLowerCase());
  const urbanCount = rows
    .filter((row) => row.brand && isUrbanLabel(row.brand))
    .reduce((sum, row) => sum + row._count._all, 0);
  const out = rows
    .filter((row) => row.brand && row.brand.trim() && !isUrbanLabel(row.brand))
    .map((row) => ({ brand: row.brand as string, productCount: row._count._all }));
  if (urbanCount > 0) out.push({ brand: URBAN_AGGREGATE_BRAND, productCount: urbanCount });
  return out.sort((a, b) => b.productCount - a.productCount || a.brand.localeCompare(b.brand));
}
