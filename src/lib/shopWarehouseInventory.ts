export const SHOP_WAREHOUSE_IN_STOCK_SKUS = [
  "EVE-G9X-CF-INT",
  "EVE-G9X-CF-CHG",
  "EVE-F9XM5M8-CF-INT",
  "EVE-F9XM5M8-CHG",
  "EVE-X56M-CHG",
  "EVE-G8XMV2-CF-INT",
  "EVE-G8XM-CF-SC",
  "EVE-4V8TT-CF-INT",
  "EVE-AMGGT-CF-INT",
  "EVE-W192-FTR",
  "EVE-FLC",
] as const;

const normalizeWarehouseSku = (value: string | null | undefined) =>
  value?.trim().toUpperCase() ?? "";

const warehouseSkuSet = new Set<string>(SHOP_WAREHOUSE_IN_STOCK_SKUS);

const warehouseHeroImageBySku: Readonly<Record<string, string>> = {
  "EVE-G9X-CF-CHG": "/images/shop/eventuri/eve-g9x-cf-chg-hero.jpg",
};

export const isShopWarehouseInStockSku = (value: string | null | undefined) =>
  warehouseSkuSet.has(normalizeWarehouseSku(value));

export const getShopWarehouseStockStatus = (value: string | null | undefined) =>
  isShopWarehouseInStockSku(value) ? ("inStock" as const) : ("preOrder" as const);

export const resolveShopWarehouseHeroImage = (
  sku: string | null | undefined,
  fallback: string | null
) => warehouseHeroImageBySku[normalizeWarehouseSku(sku)] ?? fallback;
