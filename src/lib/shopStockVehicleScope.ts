export type ShopStockVehicleScope = "auto" | "moto";

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
