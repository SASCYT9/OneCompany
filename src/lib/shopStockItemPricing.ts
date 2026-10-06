import type { ShopPriceSet } from "./shopMoneyFormat";
import type { StockItem } from "./shopStockSearchTypes";

export function getShopStockItemPriceSet(
  item: Pick<StockItem, "priceSet" | "priceEur" | "priceUsd" | "priceUah" | "price">
): ShopPriceSet {
  return {
    ...item.priceSet,
    eur: item.priceSet?.eur ?? item.priceEur ?? 0,
    usd: item.priceSet?.usd ?? item.priceUsd ?? item.price ?? 0,
    uah: item.priceSet?.uah ?? item.priceUah ?? 0,
  };
}

export function getShopStockItemCompareAtSet(
  item: Pick<StockItem, "originalPriceSet" | "originalPrice">
): ShopPriceSet | null {
  const compareAt = item.originalPriceSet;
  if (
    compareAt &&
    ((compareAt.eur ?? 0) > 0 || (compareAt.usd ?? 0) > 0 || (compareAt.uah ?? 0) > 0)
  )
    return compareAt;
  if (item.originalPrice && item.originalPrice > 0)
    return { eur: 0, usd: item.originalPrice, uah: 0 };
  return null;
}
