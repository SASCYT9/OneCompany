import type { ShopPriceSet } from "./shopMoneyFormat";
import type { StockItem } from "./shopStockSearchTypes";

export function getShopStockItemPriceSet(item: Pick<StockItem, "priceSet" | "priceEur" | "priceUsd" | "priceUah" | "price">): ShopPriceSet {
  return {
    ...item.priceSet,
    eur: item.priceSet?.eur ?? item.priceEur ?? 0,
    usd: item.priceSet?.usd ?? item.priceUsd ?? item.price ?? 0,
    uah: item.priceSet?.uah ?? item.priceUah ?? 0,
  };
}
