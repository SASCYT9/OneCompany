/**
 * Set to true once `stock` field carries real distributor data.
 * While false, all "В наявності / Under order" badges and filters are hidden.
 */
export const SHOW_STOCK_BADGE = false;

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
