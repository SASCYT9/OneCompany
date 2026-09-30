/**
 * Set to true once `stock` field carries real distributor data.
 * While false, all "В наявності / Under order" badges and filters are hidden.
 */
export const SHOW_STOCK_BADGE = false;

/** Pending or failed filters cannot relabel cards from the previous result. */
export function shouldShowShopStockVehicleMatch(input: {
  hasVehicle: boolean;
  loading: boolean;
  error: unknown;
}) {
  return input.hasVehicle && !input.loading && !input.error;
}

/** Brand chips and the sidebar share one additive multi-selection contract. */
export function toggleShopStockBrandSelection(current: readonly string[], brand: string) {
  const value = brand.trim();
  if (!value) return [...current];
  const key = value.toLowerCase();
  return current.some((selected) => selected.trim().toLowerCase() === key)
    ? current.filter((selected) => selected.trim().toLowerCase() !== key)
    : [...current, value];
}

/**
 * Eventuri has an explicitly reviewed physical-stock list for the Van Company
 * storefront. Keep this scoped flag separate from the global stock rollout so
 * unrelated brands do not surface unverified availability labels.
 */
export const SHOW_EVENTURI_STOCK_BADGE = true;

export function isEventuriBrand(value: string | null | undefined) {
  return (
    String(value ?? "")
      .trim()
      .toLowerCase() === "eventuri"
  );
}

export function shouldShowEventuriStockBadge(
  brand: string | null | undefined,
  stock: string | null | undefined
) {
  return SHOW_EVENTURI_STOCK_BADGE && isEventuriBrand(brand) && stock === "inStock";
}
