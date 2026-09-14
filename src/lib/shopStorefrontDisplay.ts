import {
  getShopConfirmedAvailability,
  isShopWarehouseInStockProduct,
  type ShopStorefrontDisplay,
} from "./shopWarehouseInventory";

export const SHOP_STOREFRONT_DISPLAY_NAMESPACE = "onecompany";
export const SHOP_STOREFRONT_DISPLAY_KEY = "storefront_display";

type Metafield = { namespace: string; key: string; value: string };

export function isShopStorefrontDisplayMetafield(field: Pick<Metafield, "namespace" | "key">) {
  return (
    field.namespace === SHOP_STOREFRONT_DISPLAY_NAMESPACE &&
    field.key === SHOP_STOREFRONT_DISPLAY_KEY
  );
}

export function parseShopStorefrontDisplay(value: unknown): ShopStorefrontDisplay | null {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    typeof input.availability !== "string" ||
    !["inStock", "preOrder", "inTransit"].includes(input.availability) ||
    typeof input.showInStock !== "boolean" ||
    typeof input.showInCarousel !== "boolean"
  )
    return null;
  if (input.showInCarousel && (!input.showInStock || input.availability !== "inStock")) return null;
  if (input.showInStock && input.availability !== "inStock") return null;
  return {
    availability: input.availability as ShopStorefrontDisplay["availability"],
    showInStock: input.showInStock,
    showInCarousel: input.showInCarousel,
  };
}

export function readShopStorefrontDisplay(
  fields?: readonly Metafield[]
): ShopStorefrontDisplay | undefined {
  const field = fields?.find(isShopStorefrontDisplayMetafield);
  if (!field) return undefined;
  // Invalid saved data must never restore an old hardcoded in-stock badge.
  return (
    parseShopStorefrontDisplay(field.value) ?? {
      availability: "preOrder",
      showInStock: false,
      showInCarousel: false,
    }
  );
}

export function defaultShopStorefrontDisplay(
  sku: string | null | undefined,
  slug?: string | null,
  stock?: string | null
): ShopStorefrontDisplay {
  const confirmed = getShopConfirmedAvailability(sku, slug);
  return {
    availability: confirmed ?? (stock === "inStock" ? "inStock" : "preOrder"),
    showInStock: confirmed === "inStock",
    showInCarousel: isShopWarehouseInStockProduct(sku, slug),
  };
}
