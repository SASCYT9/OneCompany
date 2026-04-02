import { Prisma } from '@prisma/client';
import { resolveBundleInventory } from '@/lib/shopBundles';

export const adminBundleComponentCollectionSelect = {
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

export const adminBundleComponentVariantSelect = {
  id: true,
  title: true,
  inventoryQty: true,
  isDefault: true,
} satisfies Prisma.ShopProductVariantSelect;

export const adminBundleComponentProductSelect = {
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
  variants: {
    orderBy: [{ isDefault: 'desc' }, { position: 'asc' }],
    select: adminBundleComponentVariantSelect,
  },
  collections: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: adminBundleComponentCollectionSelect,
  },
} satisfies Prisma.ShopProductSelect;

export const adminBundleInclude = {
  items: {
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: {
      componentProduct: {
        select: adminBundleComponentProductSelect,
      },
      componentVariant: {
        select: adminBundleComponentVariantSelect,
      },
    },
  },
} satisfies Prisma.ShopBundleInclude;

export const adminProductInclude = {
  category: true,
  media: { orderBy: { position: 'asc' } },
  options: { orderBy: { position: 'asc' } },
  variants: { orderBy: { position: 'asc' } },
  metafields: { orderBy: [{ namespace: 'asc' }, { key: 'asc' }] },
  collections: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      collection: true,
    },
  },
  bundle: {
    include: adminBundleInclude,
  },
} satisfies Prisma.ShopProductInclude;

export const adminProductListSelect = {
  id: true,
  slug: true,
  sku: true,
  scope: true,
  brand: true,
  vendor: true,
  productType: true,
  category: {
    select: {
      id: true,
      slug: true,
      titleEn: true,
      titleUa: true,
    },
  },
  titleUa: true,
  titleEn: true,
  stock: true,
  status: true,
  priceUah: true,
  priceEur: true,
  priceUsd: true,
  priceUahB2b: true,
  priceEurB2b: true,
  priceUsdB2b: true,
  isPublished: true,
  updatedAt: true,
  variants: {
    orderBy: [{ isDefault: 'desc' }, { position: 'asc' }],
    take: 1,
    select: {
      priceUah: true,
      priceEur: true,
      priceUsd: true,
      priceUahB2b: true,
      priceEurB2b: true,
      priceUsdB2b: true,
    },
  },
  collections: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      collectionId: true,
      collection: {
        select: {
          handle: true,
        },
      },
    },
  },
  _count: {
    select: {
      variants: true,
      media: true,
      collections: true,
    },
  },
} satisfies Prisma.ShopProductSelect;

export type AdminShopProductRecord = Prisma.ShopProductGetPayload<{
  include: typeof adminProductInclude;
}>;

export type AdminShopProductListRecord = Prisma.ShopProductGetPayload<{
  select: typeof adminProductListSelect;
}>;

export type AdminShopProductMediaInput = {
  src: string;
  altText?: string | null;
  position?: number;
  mediaType?: 'IMAGE' | 'VIDEO' | 'EXTERNAL_VIDEO';
};

export type AdminShopProductOptionInput = {
  name: string;
  position?: number;
  values?: string[];
};

export type AdminShopProductVariantInput = {
  title?: string | null;
  sku?: string | null;
  position?: number;
  option1Value?: string | null;
  option1LinkedTo?: string | null;
  option2Value?: string | null;
  option2LinkedTo?: string | null;
  option3Value?: string | null;
  option3LinkedTo?: string | null;
  grams?: number | null;
  inventoryTracker?: string | null;
  inventoryQty?: number | null;
  inventoryPolicy?: 'DENY' | 'CONTINUE';
  fulfillmentService?: string | null;
  priceEur?: number | null;
  priceUsd?: number | null;
  priceUah?: number | null;
  priceEurB2b?: number | null;
  priceUsdB2b?: number | null;
  priceUahB2b?: number | null;
  compareAtEur?: number | null;
  compareAtUsd?: number | null;
  compareAtUah?: number | null;
  compareAtEurB2b?: number | null;
  compareAtUsdB2b?: number | null;
  compareAtUahB2b?: number | null;
  requiresShipping?: boolean;
  taxable?: boolean;
  barcode?: string | null;
  image?: string | null;
  weightUnit?: string | null;
  weight?: number | null;
  taxCode?: string | null;
  costPerItem?: number | null;
  isDefault?: boolean;
  isDimensionsEstimated?: boolean;
};

export type AdminShopProductMetafieldInput = {
  namespace: string;
  key: string;
  value: string;
  valueType?: string;
};

export type AdminShopProductPayload = {
  slug: string;
  sku?: string | null;
  scope: string;
  brand?: string | null;
  vendor?: string | null;
  productType?: string | null;
  productCategory?: string | null;
  categoryId?: string | null;
  tags: string[];
  collectionIds: string[];
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  titleUa: string;
  titleEn: string;
  categoryUa?: string | null;
  categoryEn?: string | null;
  shortDescUa?: string | null;
  shortDescEn?: string | null;
  longDescUa?: string | null;
  longDescEn?: string | null;
  bodyHtmlUa?: string | null;
  bodyHtmlEn?: string | null;
  leadTimeUa?: string | null;
  leadTimeEn?: string | null;
  stock: string;
  collectionUa?: string | null;
  collectionEn?: string | null;
  priceEur?: number | null;
  priceUsd?: number | null;
  priceUah?: number | null;
  priceEurB2b?: number | null;
  priceUsdB2b?: number | null;
  priceUahB2b?: number | null;
  compareAtEur?: number | null;
  compareAtUsd?: number | null;
  compareAtUah?: number | null;
  compareAtEurB2b?: number | null;
  compareAtUsdB2b?: number | null;
  compareAtUahB2b?: number | null;
  image?: string | null;
  seoTitleUa?: string | null;
  seoTitleEn?: string | null;
  seoDescriptionUa?: string | null;
  seoDescriptionEn?: string | null;
  isPublished: boolean;
  publishedAt?: string | null;
  gallery?: unknown;
  highlights?: unknown;
  media: AdminShopProductMediaInput[];
  options: AdminShopProductOptionInput[];
  variants: AdminShopProductVariantInput[];
  metafields: AdminShopProductMetafieldInput[];
};

type NormalizedResult = {
  data: AdminShopProductPayload;
  errors: string[];
};

function sanitizeSlug(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function nullableString(value: unknown): string | null {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed : null;
}

function stringValue(value: unknown, fallback = ''): string {
  return String(value ?? fallback).trim();
}

function boolValue(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on', 'active'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', 'draft', 'archived'].includes(normalized)) return false;
  }
  return fallback;
}

function intValue(value: unknown): number | null {
  if (value === '' || value == null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

function decimalValue(value: unknown): number | null {
  if (value === '' || value == null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? '').trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function uniqueStrings(value: string[]) {
  return Array.from(new Set(value.filter(Boolean)));
}

function ensureObjectArray<T extends Record<string, unknown>>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is T => Boolean(entry) && typeof entry === 'object');
}

function normalizeMedia(value: unknown): AdminShopProductMediaInput[] {
  return ensureObjectArray<Record<string, unknown>>(value)
    .map((item, index): AdminShopProductMediaInput => {
      const normalizedType = stringValue(item.mediaType, 'IMAGE').toUpperCase();
      return {
        src: stringValue(item.src),
        altText: nullableString(item.altText),
        position: intValue(item.position) ?? index + 1,
        mediaType:
          normalizedType === 'VIDEO'
            ? 'VIDEO'
            : normalizedType === 'EXTERNAL_VIDEO'
              ? 'EXTERNAL_VIDEO'
              : 'IMAGE',
      };
    })
    .filter((item) => item.src);
}

function normalizeOptions(value: unknown): AdminShopProductOptionInput[] {
  return ensureObjectArray<Record<string, unknown>>(value)
    .map((item, index) => ({
      name: stringValue(item.name),
      position: intValue(item.position) ?? index + 1,
      values: stringArray(item.values),
    }))
    .filter((item) => item.name);
}

function normalizeVariants(value: unknown): AdminShopProductVariantInput[] {
  return ensureObjectArray<Record<string, unknown>>(value)
    .map((item, index): AdminShopProductVariantInput => {
      const normalizedInventoryPolicy = stringValue(item.inventoryPolicy, 'CONTINUE').toUpperCase();
      return {
        title: nullableString(item.title),
        sku: nullableString(item.sku),
        position: intValue(item.position) ?? index + 1,
        option1Value: nullableString(item.option1Value),
        option1LinkedTo: nullableString(item.option1LinkedTo),
        option2Value: nullableString(item.option2Value),
        option2LinkedTo: nullableString(item.option2LinkedTo),
        option3Value: nullableString(item.option3Value),
        option3LinkedTo: nullableString(item.option3LinkedTo),
        grams: intValue(item.grams),
        inventoryTracker: nullableString(item.inventoryTracker),
        inventoryQty: intValue(item.inventoryQty) ?? 0,
        inventoryPolicy: normalizedInventoryPolicy === 'DENY' ? 'DENY' : 'CONTINUE',
        fulfillmentService: nullableString(item.fulfillmentService),
        priceEur: decimalValue(item.priceEur),
        priceUsd: decimalValue(item.priceUsd),
        priceUah: decimalValue(item.priceUah),
        priceEurB2b: decimalValue(item.priceEurB2b),
        priceUsdB2b: decimalValue(item.priceUsdB2b),
        priceUahB2b: decimalValue(item.priceUahB2b),
        compareAtEur: decimalValue(item.compareAtEur),
        compareAtUsd: decimalValue(item.compareAtUsd),
        compareAtUah: decimalValue(item.compareAtUah),
        compareAtEurB2b: decimalValue(item.compareAtEurB2b),
        compareAtUsdB2b: decimalValue(item.compareAtUsdB2b),
        compareAtUahB2b: decimalValue(item.compareAtUahB2b),
        requiresShipping: boolValue(item.requiresShipping, true),
        taxable: boolValue(item.taxable, true),
        barcode: nullableString(item.barcode),
        image: nullableString(item.image),
        weightUnit: nullableString(item.weightUnit),
        taxCode: nullableString(item.taxCode),
        costPerItem: decimalValue(item.costPerItem),
        isDefault: boolValue(item.isDefault, index === 0),
      };
    })
    .filter((item) => item.title || item.sku || item.option1Value || item.option2Value || item.option3Value);
}

function normalizeMetafields(value: unknown): AdminShopProductMetafieldInput[] {
  return ensureObjectArray<Record<string, unknown>>(value)
    .map((item) => ({
      namespace: stringValue(item.namespace),
      key: stringValue(item.key),
      value: stringValue(item.value),
      valueType: stringValue(item.valueType, 'single_line_text_field'),
    }))
    .filter((item) => item.namespace && item.key);
}

export function normalizeAdminProductPayload(input: unknown): NormalizedResult {
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const titleUa = stringValue(source.titleUa || source.title_ua || source.title);
  const titleEn = stringValue(source.titleEn || source.title_en || source.title);
  const slug = sanitizeSlug(source.slug || source.handle || titleEn || titleUa);
  const media = normalizeMedia(source.media);
  const variants = normalizeVariants(source.variants);
  const errors: string[] = [];

  if (!slug) errors.push('slug is required');
  if (!titleUa && !titleEn) errors.push('titleUa or titleEn is required');

  const data: AdminShopProductPayload = {
    slug,
    sku: nullableString(source.sku),
    scope: stringValue(source.scope, 'auto') === 'moto' ? 'moto' : 'auto',
    brand: nullableString(source.brand),
    vendor: nullableString(source.vendor),
    productType: nullableString(source.productType),
    productCategory: nullableString(source.productCategory),
    categoryId: nullableString(source.categoryId),
    tags: stringArray(source.tags),
    collectionIds: uniqueStrings(stringArray(source.collectionIds)),
    status:
      stringValue(source.status, 'ACTIVE').toUpperCase() === 'DRAFT'
        ? 'DRAFT'
        : stringValue(source.status, 'ACTIVE').toUpperCase() === 'ARCHIVED'
          ? 'ARCHIVED'
          : 'ACTIVE',
    titleUa: titleUa || titleEn,
    titleEn: titleEn || titleUa,
    categoryUa: nullableString(source.categoryUa),
    categoryEn: nullableString(source.categoryEn),
    shortDescUa: nullableString(source.shortDescUa),
    shortDescEn: nullableString(source.shortDescEn),
    longDescUa: nullableString(source.longDescUa),
    longDescEn: nullableString(source.longDescEn),
    bodyHtmlUa: nullableString(source.bodyHtmlUa),
    bodyHtmlEn: nullableString(source.bodyHtmlEn),
    leadTimeUa: nullableString(source.leadTimeUa),
    leadTimeEn: nullableString(source.leadTimeEn),
    stock: stringValue(source.stock, 'inStock') === 'preOrder' ? 'preOrder' : 'inStock',
    collectionUa: nullableString(source.collectionUa),
    collectionEn: nullableString(source.collectionEn),
    priceEur: decimalValue(source.priceEur),
    priceUsd: decimalValue(source.priceUsd),
    priceUah: decimalValue(source.priceUah),
    priceEurB2b: decimalValue(source.priceEurB2b),
    priceUsdB2b: decimalValue(source.priceUsdB2b),
    priceUahB2b: decimalValue(source.priceUahB2b),
    compareAtEur: decimalValue(source.compareAtEur),
    compareAtUsd: decimalValue(source.compareAtUsd),
    compareAtUah: decimalValue(source.compareAtUah),
    compareAtEurB2b: decimalValue(source.compareAtEurB2b),
    compareAtUsdB2b: decimalValue(source.compareAtUsdB2b),
    compareAtUahB2b: decimalValue(source.compareAtUahB2b),
    image: nullableString(source.image) ?? media[0]?.src ?? nullableString(variants[0]?.image),
    seoTitleUa: nullableString(source.seoTitleUa),
    seoTitleEn: nullableString(source.seoTitleEn),
    seoDescriptionUa: nullableString(source.seoDescriptionUa),
    seoDescriptionEn: nullableString(source.seoDescriptionEn),
    isPublished: boolValue(source.isPublished, true),
    publishedAt: nullableString(source.publishedAt),
    gallery: source.gallery ?? null,
    highlights: source.highlights ?? null,
    media,
    options: normalizeOptions(source.options),
    variants,
    metafields: normalizeMetafields(source.metafields),
  };

  if (!data.media.length && data.image) {
    data.media = [{ src: data.image, position: 1, mediaType: 'IMAGE' }];
  }

  if (!data.variants.length) {
    data.variants = [
      {
        title: 'Default Title',
        sku: data.sku,
        position: 1,
        inventoryQty: 0,
        inventoryPolicy: 'CONTINUE',
        priceEur: data.priceEur,
        priceUsd: data.priceUsd,
        priceUah: data.priceUah,
        priceEurB2b: data.priceEurB2b,
        priceUsdB2b: data.priceUsdB2b,
        priceUahB2b: data.priceUahB2b,
        compareAtEur: data.compareAtEur,
        compareAtUsd: data.compareAtUsd,
        compareAtUah: data.compareAtUah,
        compareAtEurB2b: data.compareAtEurB2b,
        compareAtUsdB2b: data.compareAtUsdB2b,
        compareAtUahB2b: data.compareAtUahB2b,
        requiresShipping: true,
        taxable: true,
        image: data.image,
        isDefault: true,
      },
    ];
  }

  return { data, errors };
}

function nestedMediaCreate(media: AdminShopProductMediaInput[]) {
  return media.map((item, index) => ({
    src: item.src,
    altText: item.altText ?? null,
    position: item.position ?? index + 1,
    mediaType: item.mediaType ?? 'IMAGE',
  }));
}

function nestedOptionCreate(options: AdminShopProductOptionInput[]) {
  return options.map((item, index) => ({
    name: item.name,
    position: item.position ?? index + 1,
    values: item.values ?? [],
  }));
}

function nestedVariantCreate(variants: AdminShopProductVariantInput[]) {
  return variants.map((item, index) => ({
    title: item.title ?? null,
    sku: item.sku ?? null,
    position: item.position ?? index + 1,
    option1Value: item.option1Value ?? null,
    option1LinkedTo: item.option1LinkedTo ?? null,
    option2Value: item.option2Value ?? null,
    option2LinkedTo: item.option2LinkedTo ?? null,
    option3Value: item.option3Value ?? null,
    option3LinkedTo: item.option3LinkedTo ?? null,
    grams: item.grams ?? null,
    inventoryTracker: item.inventoryTracker ?? null,
    inventoryQty: item.inventoryQty ?? 0,
    inventoryPolicy: item.inventoryPolicy ?? 'CONTINUE',
    fulfillmentService: item.fulfillmentService ?? null,
    priceEur: item.priceEur ?? null,
    priceUsd: item.priceUsd ?? null,
    priceUah: item.priceUah ?? null,
    priceEurB2b: item.priceEurB2b ?? null,
    priceUsdB2b: item.priceUsdB2b ?? null,
    priceUahB2b: item.priceUahB2b ?? null,
    compareAtEur: item.compareAtEur ?? null,
    compareAtUsd: item.compareAtUsd ?? null,
    compareAtUah: item.compareAtUah ?? null,
    compareAtEurB2b: item.compareAtEurB2b ?? null,
    compareAtUsdB2b: item.compareAtUsdB2b ?? null,
    compareAtUahB2b: item.compareAtUahB2b ?? null,
    requiresShipping: item.requiresShipping ?? true,
    taxable: item.taxable ?? true,
    barcode: item.barcode ?? null,
    image: item.image ?? null,
    weightUnit: item.weightUnit ?? null,
    weight: item.weight ?? null,
    taxCode: item.taxCode ?? null,
    costPerItem: item.costPerItem ?? null,
    isDefault: item.isDefault ?? index === 0,
    isDimensionsEstimated: item.isDimensionsEstimated ?? false,
  }));
}

function nestedMetafieldCreate(metafields: AdminShopProductMetafieldInput[]) {
  return metafields.map((item) => ({
    namespace: item.namespace,
    key: item.key,
    value: item.value,
    valueType: item.valueType ?? 'single_line_text_field',
  }));
}

function jsonValueOrNull(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

export function buildAdminProductCreateData(data: AdminShopProductPayload): Prisma.ShopProductCreateInput {
  return {
    slug: data.slug,
    sku: data.sku ?? null,
    scope: data.scope,
    brand: data.brand ?? null,
    vendor: data.vendor ?? null,
    productType: data.productType ?? null,
    productCategory: data.productCategory ?? null,
    category: data.categoryId ? { connect: { id: data.categoryId } } : undefined,
    tags: data.tags,
    status: data.status,
    titleUa: data.titleUa,
    titleEn: data.titleEn,
    categoryUa: data.categoryUa ?? null,
    categoryEn: data.categoryEn ?? null,
    shortDescUa: data.shortDescUa ?? null,
    shortDescEn: data.shortDescEn ?? null,
    longDescUa: data.longDescUa ?? null,
    longDescEn: data.longDescEn ?? null,
    bodyHtmlUa: data.bodyHtmlUa ?? null,
    bodyHtmlEn: data.bodyHtmlEn ?? null,
    leadTimeUa: data.leadTimeUa ?? null,
    leadTimeEn: data.leadTimeEn ?? null,
    stock: data.stock,
    collectionUa: data.collectionUa ?? null,
    collectionEn: data.collectionEn ?? null,
    priceEur: data.priceEur ?? null,
    priceUsd: data.priceUsd ?? null,
    priceUah: data.priceUah ?? null,
    priceEurB2b: data.priceEurB2b ?? null,
    priceUsdB2b: data.priceUsdB2b ?? null,
    priceUahB2b: data.priceUahB2b ?? null,
    compareAtEur: data.compareAtEur ?? null,
    compareAtUsd: data.compareAtUsd ?? null,
    compareAtUah: data.compareAtUah ?? null,
    compareAtEurB2b: data.compareAtEurB2b ?? null,
    compareAtUsdB2b: data.compareAtUsdB2b ?? null,
    compareAtUahB2b: data.compareAtUahB2b ?? null,
    image: data.image ?? null,
    gallery: jsonValueOrNull(data.gallery),
    highlights: jsonValueOrNull(data.highlights),
    seoTitleUa: data.seoTitleUa ?? null,
    seoTitleEn: data.seoTitleEn ?? null,
    seoDescriptionUa: data.seoDescriptionUa ?? null,
    seoDescriptionEn: data.seoDescriptionEn ?? null,
    isPublished: data.isPublished,
    publishedAt: data.publishedAt ? new Date(data.publishedAt) : data.isPublished ? new Date() : null,
    collections: {
      create: data.collectionIds.map((collectionId, index) => ({
        sortOrder: index,
        collection: {
          connect: { id: collectionId },
        },
      })),
    },
    media: { create: nestedMediaCreate(data.media) },
    options: { create: nestedOptionCreate(data.options) },
    variants: { create: nestedVariantCreate(data.variants) },
    metafields: { create: nestedMetafieldCreate(data.metafields) },
  };
}

export function buildAdminProductUpdateData(data: AdminShopProductPayload): Prisma.ShopProductUpdateInput {
  return {
    slug: data.slug,
    sku: data.sku ?? null,
    scope: data.scope,
    brand: data.brand ?? null,
    vendor: data.vendor ?? null,
    productType: data.productType ?? null,
    productCategory: data.productCategory ?? null,
    category: data.categoryId ? { connect: { id: data.categoryId } } : { disconnect: true },
    tags: data.tags,
    status: data.status,
    titleUa: data.titleUa,
    titleEn: data.titleEn,
    categoryUa: data.categoryUa ?? null,
    categoryEn: data.categoryEn ?? null,
    shortDescUa: data.shortDescUa ?? null,
    shortDescEn: data.shortDescEn ?? null,
    longDescUa: data.longDescUa ?? null,
    longDescEn: data.longDescEn ?? null,
    bodyHtmlUa: data.bodyHtmlUa ?? null,
    bodyHtmlEn: data.bodyHtmlEn ?? null,
    leadTimeUa: data.leadTimeUa ?? null,
    leadTimeEn: data.leadTimeEn ?? null,
    stock: data.stock,
    collectionUa: data.collectionUa ?? null,
    collectionEn: data.collectionEn ?? null,
    priceEur: data.priceEur ?? null,
    priceUsd: data.priceUsd ?? null,
    priceUah: data.priceUah ?? null,
    priceEurB2b: data.priceEurB2b ?? null,
    priceUsdB2b: data.priceUsdB2b ?? null,
    priceUahB2b: data.priceUahB2b ?? null,
    compareAtEur: data.compareAtEur ?? null,
    compareAtUsd: data.compareAtUsd ?? null,
    compareAtUah: data.compareAtUah ?? null,
    compareAtEurB2b: data.compareAtEurB2b ?? null,
    compareAtUsdB2b: data.compareAtUsdB2b ?? null,
    compareAtUahB2b: data.compareAtUahB2b ?? null,
    image: data.image ?? null,
    gallery: jsonValueOrNull(data.gallery),
    highlights: jsonValueOrNull(data.highlights),
    seoTitleUa: data.seoTitleUa ?? null,
    seoTitleEn: data.seoTitleEn ?? null,
    seoDescriptionUa: data.seoDescriptionUa ?? null,
    seoDescriptionEn: data.seoDescriptionEn ?? null,
    isPublished: data.isPublished,
    publishedAt: data.publishedAt ? new Date(data.publishedAt) : data.isPublished ? new Date() : null,
    collections: {
      deleteMany: {},
      create: data.collectionIds.map((collectionId, index) => ({
        sortOrder: index,
        collection: {
          connect: { id: collectionId },
        },
      })),
    },
    media: {
      deleteMany: {},
      create: nestedMediaCreate(data.media),
    },
    options: {
      deleteMany: {},
      create: nestedOptionCreate(data.options),
    },
    variants: {
      deleteMany: {},
      create: nestedVariantCreate(data.variants),
    },
    metafields: {
      deleteMany: {},
      create: nestedMetafieldCreate(data.metafields),
    },
  };
}

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value == null) return null;
  return Number(value);
}

export function serializeAdminProduct(record: AdminShopProductRecord) {
  const bundleInventory = record.bundle
    ? resolveBundleInventory(
        record.bundle.items.map((item) => ({
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
      )
    : null;

  return {
    id: record.id,
    slug: record.slug,
    sku: record.sku,
    scope: record.scope,
    brand: record.brand,
    vendor: record.vendor,
    productType: record.productType,
    productCategory: record.productCategory,
    categoryId: record.categoryId,
    category: record.category
      ? {
          id: record.category.id,
          slug: record.category.slug,
          titleEn: record.category.titleEn,
          titleUa: record.category.titleUa,
        }
      : null,
    tags: record.tags,
    collectionIds: record.collections.map((entry) => entry.collectionId),
    status: record.status,
    titleUa: record.titleUa,
    titleEn: record.titleEn,
    categoryUa: record.categoryUa,
    categoryEn: record.categoryEn,
    shortDescUa: record.shortDescUa,
    shortDescEn: record.shortDescEn,
    longDescUa: record.longDescUa,
    longDescEn: record.longDescEn,
    bodyHtmlUa: record.bodyHtmlUa,
    bodyHtmlEn: record.bodyHtmlEn,
    leadTimeUa: record.leadTimeUa,
    leadTimeEn: record.leadTimeEn,
    stock: record.stock,
    collectionUa: record.collectionUa,
    collectionEn: record.collectionEn,
    priceEur: decimalToNumber(record.priceEur),
    priceUsd: decimalToNumber(record.priceUsd),
    priceUah: decimalToNumber(record.priceUah),
    priceEurB2b: decimalToNumber(record.priceEurB2b),
    priceUsdB2b: decimalToNumber(record.priceUsdB2b),
    priceUahB2b: decimalToNumber(record.priceUahB2b),
    compareAtEur: decimalToNumber(record.compareAtEur),
    compareAtUsd: decimalToNumber(record.compareAtUsd),
    compareAtUah: decimalToNumber(record.compareAtUah),
    compareAtEurB2b: decimalToNumber(record.compareAtEurB2b),
    compareAtUsdB2b: decimalToNumber(record.compareAtUsdB2b),
    compareAtUahB2b: decimalToNumber(record.compareAtUahB2b),
    image: record.image,
    gallery: record.gallery,
    highlights: record.highlights,
    seoTitleUa: record.seoTitleUa,
    seoTitleEn: record.seoTitleEn,
    seoDescriptionUa: record.seoDescriptionUa,
    seoDescriptionEn: record.seoDescriptionEn,
    isPublished: record.isPublished,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    media: record.media.map((item) => ({
      id: item.id,
      src: item.src,
      altText: item.altText,
      position: item.position,
      mediaType: item.mediaType,
    })),
    options: record.options.map((item) => ({
      id: item.id,
      name: item.name,
      position: item.position,
      values: item.values,
    })),
    variants: record.variants.map((item) => ({
      id: item.id,
      title: item.title,
      sku: item.sku,
      position: item.position,
      option1Value: item.option1Value,
      option1LinkedTo: item.option1LinkedTo,
      option2Value: item.option2Value,
      option2LinkedTo: item.option2LinkedTo,
      option3Value: item.option3Value,
      option3LinkedTo: item.option3LinkedTo,
      grams: item.grams,
      inventoryTracker: item.inventoryTracker,
      inventoryQty: item.inventoryQty,
      inventoryPolicy: item.inventoryPolicy,
      fulfillmentService: item.fulfillmentService,
      priceEur: decimalToNumber(item.priceEur),
      priceUsd: decimalToNumber(item.priceUsd),
      priceUah: decimalToNumber(item.priceUah),
      priceEurB2b: decimalToNumber(item.priceEurB2b),
      priceUsdB2b: decimalToNumber(item.priceUsdB2b),
      priceUahB2b: decimalToNumber(item.priceUahB2b),
      compareAtEur: decimalToNumber(item.compareAtEur),
      compareAtUsd: decimalToNumber(item.compareAtUsd),
      compareAtUah: decimalToNumber(item.compareAtUah),
      compareAtEurB2b: decimalToNumber(item.compareAtEurB2b),
      compareAtUsdB2b: decimalToNumber(item.compareAtUsdB2b),
      compareAtUahB2b: decimalToNumber(item.compareAtUahB2b),
      requiresShipping: item.requiresShipping,
      taxable: item.taxable,
      barcode: item.barcode,
      image: item.image,
      weightUnit: item.weightUnit,
      taxCode: item.taxCode,
      costPerItem: decimalToNumber(item.costPerItem),
      isDefault: item.isDefault,
    })),
    metafields: record.metafields.map((item) => ({
      id: item.id,
      namespace: item.namespace,
      key: item.key,
      value: item.value,
      valueType: item.valueType,
    })),
    collections: record.collections.map((entry) => ({
      id: entry.collection.id,
      handle: entry.collection.handle,
      titleUa: entry.collection.titleUa,
      titleEn: entry.collection.titleEn,
      brand: entry.collection.brand,
      isPublished: entry.collection.isPublished,
      isUrban: entry.collection.isUrban,
      sortOrder: entry.sortOrder,
    })),
    bundle: record.bundle
      ? {
          id: record.bundle.id,
          availableQuantity: bundleInventory?.availableQuantity ?? 0,
          items: bundleInventory?.items ?? [],
        }
      : null,
  };
}

export function serializeAdminProductListItem(record: AdminShopProductRecord | AdminShopProductListRecord) {
  const primaryVariant = record.variants[0];
  return {
    id: record.id,
    slug: record.slug,
    sku: record.sku,
    scope: record.scope,
    brand: record.brand,
    vendor: record.vendor,
    productType: record.productType,
    categoryId: record.category?.id ?? null,
    category: record.category
      ? {
          id: record.category.id,
          slug: record.category.slug,
          titleEn: record.category.titleEn,
          titleUa: record.category.titleUa,
        }
      : null,
    collectionIds: record.collections.map((entry) => entry.collectionId),
    collectionHandles: record.collections.map((entry) => entry.collection.handle),
    titleUa: record.titleUa,
    titleEn: record.titleEn,
    stock: record.stock,
    status: record.status,
    priceUah: decimalToNumber(record.priceUah) ?? decimalToNumber(primaryVariant?.priceUah),
    priceEur: decimalToNumber(record.priceEur) ?? decimalToNumber(primaryVariant?.priceEur),
    priceUsd: decimalToNumber(record.priceUsd) ?? decimalToNumber(primaryVariant?.priceUsd),
    priceUahB2b: decimalToNumber(record.priceUahB2b) ?? decimalToNumber(primaryVariant?.priceUahB2b),
    priceEurB2b: decimalToNumber(record.priceEurB2b) ?? decimalToNumber(primaryVariant?.priceEurB2b),
    priceUsdB2b: decimalToNumber(record.priceUsdB2b) ?? decimalToNumber(primaryVariant?.priceUsdB2b),
    isPublished: record.isPublished,
    updatedAt: record.updatedAt.toISOString(),
    variantsCount: '_count' in record ? record._count.variants : record.variants.length,
    mediaCount: '_count' in record ? record._count.media : record.media.length,
    collectionsCount: '_count' in record ? record._count.collections : record.collections.length,
  };
}
