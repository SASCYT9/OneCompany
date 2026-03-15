import type { ShopScope } from '@/lib/shopCatalog';

export type BundleInventoryProductInput = {
  id: string;
  slug: string;
  scope: ShopScope;
  brand: string;
  image: string;
  title: {
    ua: string;
    en: string;
  };
  collection: {
    ua: string;
    en: string;
  };
  collections?: Array<{
    id?: string;
    handle: string;
    title: {
      ua: string;
      en: string;
    };
    brand?: string | null;
    isUrban?: boolean;
    sortOrder?: number;
  }>;
  tags?: string[];
  stock: string;
  defaultVariantInventoryQty?: number | null;
};

export type BundleInventoryItemInput = {
  id: string;
  quantity: number;
  componentProduct: BundleInventoryProductInput;
  componentVariant?: {
    id: string;
    title?: string | null;
    inventoryQty?: number | null;
  } | null;
};

export type BundleInventoryItemResolved = {
  id: string;
  quantity: number;
  availableQuantity: number;
  variantId: string | null;
  variantTitle: string | null;
  product: BundleInventoryProductInput;
};

function normalizePositiveInt(value: number | null | undefined, fallback = 0) {
  const parsed = Math.floor(Number(value ?? fallback) || 0);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed);
}

function resolveComponentInventoryQty(item: BundleInventoryItemInput) {
  if (item.componentVariant) {
    return normalizePositiveInt(item.componentVariant.inventoryQty, 0);
  }

  return normalizePositiveInt(item.componentProduct.defaultVariantInventoryQty, 0);
}

export function resolveBundleInventory(items: BundleInventoryItemInput[]) {
  if (!items.length) {
    return {
      availableQuantity: 0,
      stock: 'preOrder' as const,
      items: [] as BundleInventoryItemResolved[],
    };
  }

  const resolvedItems = items.map((item) => {
    const quantity = Math.max(1, normalizePositiveInt(item.quantity, 1));
    const componentInventoryQty = resolveComponentInventoryQty(item);

    return {
      id: item.id,
      quantity,
      availableQuantity: Math.floor(componentInventoryQty / quantity),
      variantId: item.componentVariant?.id ?? null,
      variantTitle: item.componentVariant?.title ?? null,
      product: item.componentProduct,
    };
  });

  const availableQuantity = resolvedItems.reduce(
    (minimum, item) => Math.min(minimum, item.availableQuantity),
    Number.POSITIVE_INFINITY
  );

  return {
    availableQuantity: Number.isFinite(availableQuantity) ? availableQuantity : 0,
    stock: availableQuantity > 0 ? ('inStock' as const) : ('preOrder' as const),
    items: resolvedItems,
  };
}
