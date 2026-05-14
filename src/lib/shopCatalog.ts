export type ShopScope = "auto" | "moto";
export type ShopStock = "inStock" | "preOrder";

type LocalizedText = {
  ua: string;
  en: string;
};

export type ShopMoneySet = {
  eur: number;
  usd: number;
  uah: number;
};

export type ShopProductCollectionLink = {
  id?: string;
  handle: string;
  title: LocalizedText;
  brand?: string | null;
  isUrban?: boolean;
  sortOrder?: number;
};

export type ShopProductVariantSummary = {
  id?: string;
  title?: string | null;
  sku?: string | null;
  position?: number;
  optionValues?: string[];
  inventoryQty?: number;
  image?: string | null;
  isDefault?: boolean;
  price: ShopMoneySet;
  b2bPrice?: ShopMoneySet;
  compareAt?: ShopMoneySet;
  b2bCompareAt?: ShopMoneySet;
  weightKg?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
};

export type ShopBundleComponentSummary = {
  id: string;
  quantity: number;
  availableQuantity: number;
  variantId?: string | null;
  variantTitle?: string | null;
  product: {
    id: string;
    slug: string;
    scope: ShopScope;
    brand: string;
    image: string;
    title: LocalizedText;
    collection: LocalizedText;
    collections?: ShopProductCollectionLink[];
    tags?: string[];
  };
};

export type ShopBundleSummary = {
  id: string;
  availableQuantity: number;
  items: ShopBundleComponentSummary[];
};

export interface ShopProduct {
  id?: string;
  slug: string;
  sku: string;
  scope: ShopScope;
  brand: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  collections?: ShopProductCollectionLink[];
  title: LocalizedText;
  category: LocalizedText;
  shortDescription: LocalizedText;
  longDescription: LocalizedText;
  leadTime: LocalizedText;
  stock: ShopStock;
  collection: LocalizedText;
  price: ShopMoneySet;
  b2bPrice?: ShopMoneySet;
  compareAt?: ShopMoneySet;
  b2bCompareAt?: ShopMoneySet;
  weightKg?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  image: string;
  gallery?: string[];
  /**
   * Per-image material tag aligned with `gallery` order. Only set on iPE
   * products that have both Titanium and Stainless Steel variants AND a
   * gallery whose original (pre-rebase) filenames hint material. Used by the
   * iPE PDP to filter the gallery to the active variant's material.
   * `'ti' | 'ss' | null` per image.
   */
  galleryMaterials?: Array<"ti" | "ss" | null>;
  highlights: LocalizedText[];
  variants?: ShopProductVariantSummary[];
  categoryNode?: {
    id: string;
    slug: string;
    title: LocalizedText;
  } | null;
  bundle?: ShopBundleSummary | null;
}

export const SHOP_PRODUCTS: ShopProduct[] = [];

export function getShopProductBySlug(slug: string): ShopProduct | undefined {
  return SHOP_PRODUCTS.find((product) => product.slug === slug);
}

export function getShopProductsByScope(scope: "all" | ShopScope): ShopProduct[] {
  if (scope === "all") {
    return SHOP_PRODUCTS;
  }

  return SHOP_PRODUCTS.filter((product) => product.scope === scope);
}
