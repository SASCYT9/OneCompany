import { Prisma, PrismaClient } from '@prisma/client';
import { resolveBundleInventory } from '@/lib/shopBundles';

const bundleVariantSelect = {
  id: true,
  title: true,
  sku: true,
  inventoryQty: true,
  isDefault: true,
  priceEur: true,
  priceUsd: true,
  priceUah: true,
} satisfies Prisma.ShopProductVariantSelect;

const bundleCollectionSelect = {
  collectionId: true,
  sortOrder: true,
  collection: {
    select: {
      id: true,
      handle: true,
      titleUa: true,
      titleEn: true,
      brand: true,
      isUrban: true,
    },
  },
} satisfies Prisma.ShopProductCollectionSelect;

const bundleComponentProductSelect = {
  id: true,
  slug: true,
  scope: true,
  brand: true,
  titleUa: true,
  titleEn: true,
  collectionUa: true,
  collectionEn: true,
  image: true,
  stock: true,
  tags: true,
  priceEur: true,
  priceUsd: true,
  priceUah: true,
  variants: {
    orderBy: [{ isDefault: 'desc' }, { position: 'asc' }],
    select: bundleVariantSelect,
  },
  collections: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: bundleCollectionSelect,
  },
} satisfies Prisma.ShopProductSelect;

export const adminShopBundleInclude = {
  product: {
    select: {
      id: true,
      slug: true,
      scope: true,
      brand: true,
      titleUa: true,
      titleEn: true,
      image: true,
      stock: true,
      priceEur: true,
      priceUsd: true,
      priceUah: true,
      isPublished: true,
      status: true,
      variants: {
        orderBy: [{ isDefault: 'desc' }, { position: 'asc' }],
        select: bundleVariantSelect,
      },
    },
  },
  items: {
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: {
      componentProduct: {
        select: bundleComponentProductSelect,
      },
      componentVariant: {
        select: bundleVariantSelect,
      },
    },
  },
} satisfies Prisma.ShopBundleInclude;

export type AdminShopBundleRecord = Prisma.ShopBundleGetPayload<{
  include: typeof adminShopBundleInclude;
}>;

function decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) return null;
  return Number(value);
}

function nullableString(value: unknown) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function positiveInt(value: unknown, fallback = 1) {
  const parsed = Math.floor(Number(value ?? fallback) || fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function resolveBundleSummary(record: AdminShopBundleRecord) {
  return resolveBundleInventory(
    record.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      componentProduct: {
        id: item.componentProduct.id,
        slug: item.componentProduct.slug,
        scope: item.componentProduct.scope === 'moto' ? 'moto' : 'auto',
        brand: item.componentProduct.brand ?? '',
        image: item.componentProduct.image ?? '',
        title: {
          ua: item.componentProduct.titleUa,
          en: item.componentProduct.titleEn,
        },
        collection: {
          ua: item.componentProduct.collectionUa ?? '',
          en: item.componentProduct.collectionEn ?? '',
        },
        collections: item.componentProduct.collections.map((entry) => ({
          id: entry.collection.id,
          handle: entry.collection.handle,
          title: {
            ua: entry.collection.titleUa,
            en: entry.collection.titleEn,
          },
          brand: entry.collection.brand,
          isUrban: entry.collection.isUrban,
          sortOrder: entry.sortOrder,
        })),
        tags: item.componentProduct.tags,
        stock: item.componentProduct.stock,
        defaultVariantInventoryQty:
          item.componentProduct.variants.find((variant) => variant.isDefault)?.inventoryQty ??
          item.componentProduct.variants[0]?.inventoryQty ??
          0,
      },
      componentVariant: item.componentVariant
        ? {
            id: item.componentVariant.id,
            title: item.componentVariant.title,
            inventoryQty: item.componentVariant.inventoryQty,
          }
        : null,
    }))
  );
}

export function serializeAdminShopBundleListItem(record: AdminShopBundleRecord) {
  const resolved = resolveBundleSummary(record);

  return {
    id: record.id,
    productId: record.productId,
    updatedAt: record.updatedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    availableQuantity: resolved.availableQuantity,
    componentsCount: record.items.length,
    product: {
      id: record.product.id,
      slug: record.product.slug,
      scope: record.product.scope,
      brand: record.product.brand,
      titleUa: record.product.titleUa,
      titleEn: record.product.titleEn,
      image: record.product.image,
      stock: record.product.stock,
      isPublished: record.product.isPublished,
      status: record.product.status,
      priceEur: decimalToNumber(record.product.priceEur),
      priceUsd: decimalToNumber(record.product.priceUsd),
      priceUah: decimalToNumber(record.product.priceUah),
    },
  };
}

export function serializeAdminShopBundleDetail(record: AdminShopBundleRecord) {
  const resolved = resolveBundleSummary(record);

  return {
    ...serializeAdminShopBundleListItem(record),
    items: resolved.items.map((item, index) => ({
      id: item.id,
      position: index + 1,
      quantity: item.quantity,
      availableQuantity: item.availableQuantity,
      componentProductId: item.product.id,
      componentVariantId: item.variantId,
      componentVariantTitle: item.variantTitle,
      componentProduct: {
        id: item.product.id,
        slug: item.product.slug,
        scope: item.product.scope,
        brand: item.product.brand,
        image: item.product.image,
        title: item.product.title,
        collection: item.product.collection,
      },
    })),
  };
}

export function normalizeAdminShopBundlePayload(input: unknown) {
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const productId = String(source.productId ?? '').trim();
  const itemsSource = Array.isArray(source.items) ? source.items : [];

  const items = itemsSource
    .map((item, index) => {
      const sourceItem = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      return {
        componentProductId: String(sourceItem.componentProductId ?? '').trim(),
        componentVariantId: nullableString(sourceItem.componentVariantId),
        quantity: positiveInt(sourceItem.quantity, 1),
        position: positiveInt(sourceItem.position, index + 1),
      };
    })
    .filter((item) => item.componentProductId);

  const errors: string[] = [];

  if (!productId) {
    errors.push('productId is required');
  }

  if (!items.length) {
    errors.push('at least one bundle component is required');
  }

  if (items.some((item) => item.componentProductId === productId)) {
    errors.push('bundle product cannot reference itself as a component');
  }

  return {
    data: {
      productId,
      items,
    },
    errors,
  };
}

export async function listAdminShopBundleProductOptions(prisma: PrismaClient) {
  const products = await prisma.shopProduct.findMany({
    orderBy: [{ titleEn: 'asc' }, { titleUa: 'asc' }],
    select: {
      id: true,
      slug: true,
      scope: true,
      brand: true,
      titleUa: true,
      titleEn: true,
      image: true,
      isPublished: true,
      status: true,
      priceEur: true,
      priceUsd: true,
      priceUah: true,
      bundle: {
        select: {
          id: true,
        },
      },
      variants: {
        orderBy: [{ isDefault: 'desc' }, { position: 'asc' }],
        select: bundleVariantSelect,
      },
    },
  });

  return products.map((product) => ({
    id: product.id,
    slug: product.slug,
    scope: product.scope,
    brand: product.brand,
    titleUa: product.titleUa,
    titleEn: product.titleEn,
    image: product.image,
    isPublished: product.isPublished,
    status: product.status,
    priceEur: decimalToNumber(product.priceEur),
    priceUsd: decimalToNumber(product.priceUsd),
    priceUah: decimalToNumber(product.priceUah),
    bundleId: product.bundle?.id ?? null,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      inventoryQty: variant.inventoryQty,
      isDefault: variant.isDefault,
      priceEur: decimalToNumber(variant.priceEur),
      priceUsd: decimalToNumber(variant.priceUsd),
      priceUah: decimalToNumber(variant.priceUah),
    })),
  }));
}
