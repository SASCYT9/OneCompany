export type ShopStockVehicleScope = "auto" | "moto";

const MOTORCYCLE_MAKES = new Set(
  [
    "Aprilia",
    "Benelli",
    "Bimota",
    "BMW",
    "Buell",
    "Can-Am",
    "CFMoto",
    "Ducati",
    "GasGas",
    "Harley-Davidson",
    "Honda",
    "Husaberg",
    "Husqvarna",
    "Indian",
    "Kawasaki",
    "KTM",
    "Moto Guzzi",
    "MV Agusta",
    "Norton",
    "Piaggio",
    "Royal Enfield",
    "Suzuki",
    "Triumph",
    "Vespa",
    "Victory",
    "Yamaha",
    "Zero",
  ].map((make) => make.toLowerCase().replace(/[^a-z0-9]+/g, ""))
);

function normalizeVehicleMake(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Fitment extraction can confuse product nouns with vehicle makes (for
 * example, an English motorcycle "seat" with the car brand SEAT). Moto makes
 * therefore use a canonical allow-list. Auto remains open because the
 * automotive catalog contains many small and historic manufacturers.
 */
export function isVehicleMakeCompatibleWithScope(
  make: string | null | undefined,
  scope: ShopStockVehicleScope | null
) {
  if (!make || !scope || scope === "auto") return true;
  return MOTORCYCLE_MAKES.has(normalizeVehicleMake(make));
}

export function parseShopStockVehicleScope(
  value: string | null | undefined
): ShopStockVehicleScope | null {
  const normalized = value?.trim().toLowerCase();
  return normalized === "auto" || normalized === "moto" ? normalized : null;
}

/**
 * Product scope is authoritative when it is valid. Older imports used the
 * invalid `SHOP` value, so fall back to the already-normalized fitment type for
 * those rows and default unknown legacy products to the automotive catalog.
 */
export function resolveShopStockVehicleScope(
  productScope: string | null | undefined,
  normalizedVehicleType: string | null | undefined
): ShopStockVehicleScope {
  const explicitScope = parseShopStockVehicleScope(productScope);
  if (explicitScope) return explicitScope;

  return normalizedVehicleType?.trim().toLowerCase() === "motorcycle" ? "moto" : "auto";
}

export function filterShopStockItemsByVehicleScope<
  T extends { vehicleScope: ShopStockVehicleScope },
>(items: T[], scope: ShopStockVehicleScope | null): T[] {
  return scope ? items.filter((item) => item.vehicleScope === scope) : items;
}
