import { customerMoney, readPriceBand } from "@/lib/admin/productPriceEditor";
import { readShopStorefrontDisplay } from "@/lib/shopStorefrontDisplay";
import { getShopConfirmedAvailability } from "@/lib/shopWarehouseInventory";

export type AdminListAvailability = {
  /** What the catalog card shows. */
  value: "inStock" | "inTransit" | "preOrder";
  /** "unset" = nobody chose availability yet; the storefront falls back to legacy data. */
  origin: "editor" | "warehouse-list" | "unset";
};

/** Same precedence as the storefront card: saved display setting, then the code SKU lists. */
export function resolveAdminListAvailability(input: {
  sku: string | null;
  slug: string;
  variantSkus: Array<string | null>;
  metafields: Array<{ namespace: string; key: string; value: string }>;
}): AdminListAvailability {
  const display = readShopStorefrontDisplay(input.metafields);
  if (display) {
    return {
      value: getShopConfirmedAvailability(input.sku, input.slug, display) ?? "preOrder",
      origin: "editor",
    };
  }
  for (const sku of [input.sku, ...input.variantSkus]) {
    const confirmed = getShopConfirmedAvailability(sku, input.slug);
    if (confirmed) return { value: confirmed, origin: "warehouse-list" };
  }
  return { value: "preOrder", origin: "unset" };
}

export type AdminListPrice = {
  uah: number;
  eur: number;
  usd: number;
  sourceCurrency: string | null;
} | null;

/** Retail price as a customer sees it today, from the product or its default variant. */
export function resolveAdminListPrice(
  product: {
    priceSourceCurrency: string | null;
    priceEur: number | null;
    priceUsd: number | null;
    priceUah: number | null;
  },
  variantSourceCurrency: string | null | undefined,
  rates: Record<string, number>
): AdminListPrice {
  const form = {
    priceSourceCurrency: product.priceSourceCurrency ?? variantSourceCurrency ?? "",
    priceEur: product.priceEur ?? "",
    priceUsd: product.priceUsd ?? "",
    priceUah: product.priceUah ?? "",
  };
  const money = customerMoney(form, "price", rates);
  return money ? { ...money, sourceCurrency: readPriceBand(form, "price").currency } : null;
}
