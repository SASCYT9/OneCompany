import { Prisma, PrismaClient } from '@prisma/client';
import { URBAN_COLLECTION_CARDS } from '@/app/[locale]/shop/data/urbanCollectionsList';
import { getUrbanCollectionHandleForProduct } from '@/lib/urbanCollectionMatcher';
import { DEFAULT_SHOP_STORE_KEY, normalizeShopStoreKey } from '@/lib/shopStores';

export const adminCollectionInclude = {
  store: {
    select: {
      key: true,
      name: true,
    },
  },
  products: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          titleEn: true,
          titleUa: true,
          brand: true,
          image: true,
          isPublished: true,
        },
      },
    },
  },
} satisfies Prisma.ShopCollectionInclude;

export const adminCollectionListSelect = {
  id: true,
  storeKey: true,
  store: {
    select: {
      key: true,
      name: true,
    },
  },
  handle: true,
  titleUa: true,
  titleEn: true,
  brand: true,
  heroImage: true,
  isPublished: true,
  isUrban: true,
  sortOrder: true,
  updatedAt: true,
  _count: {
    select: {
      products: true,
    },
  },
} satisfies Prisma.ShopCollectionSelect;

export type AdminShopCollectionRecord = Prisma.ShopCollectionGetPayload<{
  include: typeof adminCollectionInclude;
}>;

export type AdminShopCollectionListRecord = Prisma.ShopCollectionGetPayload<{
  select: typeof adminCollectionListSelect;
}>;

export type AdminShopCollectionPayload = {
  storeKey: string;
  handle: string;
  titleUa: string;
  titleEn: string;
  brand?: string | null;
  descriptionUa?: string | null;
  descriptionEn?: string | null;
  heroImage?: string | null;
  isPublished: boolean;
  isUrban: boolean;
  sortOrder: number;
};

function sanitizeHandle(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function stringValue(value: unknown, fallback = ''): string {
  return String(value ?? fallback).trim();
}

function nullableString(value: unknown): string | null {
  const trimmed = stringValue(value);
  return trimmed || null;
}

function boolValue(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'active', 'published', 'urban'].includes(normalized)) return true;
    if (['false', '0', 'no', 'draft', 'hidden'].includes(normalized)) return false;
  }
  return fallback;
}

function intValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

export function normalizeAdminCollectionPayload(input: unknown) {
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const titleUa = stringValue(source.titleUa || source.title_ua || source.title);
  const titleEn = stringValue(source.titleEn || source.title_en || source.title);
  const handle = sanitizeHandle(source.handle || source.slug || titleEn || titleUa);
  const storeKey = normalizeShopStoreKey(source.storeKey);
  const errors: string[] = [];

  if (!handle) errors.push('handle is required');
  if (!titleUa && !titleEn) errors.push('titleUa or titleEn is required');

  const data: AdminShopCollectionPayload = {
    storeKey,
    handle,
    titleUa: titleUa || titleEn,
    titleEn: titleEn || titleUa,
    brand: nullableString(source.brand),
    descriptionUa: nullableString(source.descriptionUa),
    descriptionEn: nullableString(source.descriptionEn),
    heroImage: nullableString(source.heroImage),
    isPublished: boolValue(source.isPublished, true),
    isUrban: boolValue(source.isUrban, false),
    sortOrder: intValue(source.sortOrder, 0),
  };

  return { data, errors };
}

export function buildAdminCollectionCreateData(data: AdminShopCollectionPayload): Prisma.ShopCollectionCreateInput {
  return {
    store: {
      connect: {
        key: data.storeKey || DEFAULT_SHOP_STORE_KEY,
      },
    },
    handle: data.handle,
    titleUa: data.titleUa,
    titleEn: data.titleEn,
    brand: data.brand ?? null,
    descriptionUa: data.descriptionUa ?? null,
    descriptionEn: data.descriptionEn ?? null,
    heroImage: data.heroImage ?? null,
    isPublished: data.isPublished,
    isUrban: data.isUrban,
    sortOrder: data.sortOrder,
  };
}

export function buildAdminCollectionUpdateData(data: AdminShopCollectionPayload): Prisma.ShopCollectionUpdateInput {
  return {
    store: {
      connect: {
        key: data.storeKey || DEFAULT_SHOP_STORE_KEY,
      },
    },
    handle: data.handle,
    titleUa: data.titleUa,
    titleEn: data.titleEn,
    brand: data.brand ?? null,
    descriptionUa: data.descriptionUa ?? null,
    descriptionEn: data.descriptionEn ?? null,
    heroImage: data.heroImage ?? null,
    isPublished: data.isPublished,
    isUrban: data.isUrban,
    sortOrder: data.sortOrder,
  };
}

export function serializeAdminCollection(record: AdminShopCollectionRecord) {
  return {
    id: record.id,
    storeKey: record.storeKey,
    store: record.store,
    handle: record.handle,
    titleUa: record.titleUa,
    titleEn: record.titleEn,
    brand: record.brand,
    descriptionUa: record.descriptionUa,
    descriptionEn: record.descriptionEn,
    heroImage: record.heroImage,
    isPublished: record.isPublished,
    isUrban: record.isUrban,
    sortOrder: record.sortOrder,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    productsCount: record.products.length,
    products: record.products.map((entry) => ({
      id: entry.product.id,
      slug: entry.product.slug,
      titleEn: entry.product.titleEn,
      titleUa: entry.product.titleUa,
      brand: entry.product.brand,
      image: entry.product.image,
      isPublished: entry.product.isPublished,
      sortOrder: entry.sortOrder,
    })),
  };
}

export function serializeAdminCollectionListItem(record: AdminShopCollectionRecord | AdminShopCollectionListRecord) {
  return {
    id: record.id,
    storeKey: record.storeKey,
    store: record.store,
    handle: record.handle,
    titleUa: record.titleUa,
    titleEn: record.titleEn,
    brand: record.brand,
    heroImage: record.heroImage,
    isPublished: record.isPublished,
    isUrban: record.isUrban,
    sortOrder: record.sortOrder,
    productsCount: 'products' in record ? record.products.length : record._count.products,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function syncUrbanCollections(prisma: PrismaClient) {
  const collectionIdByHandle = new Map<string, string>();
  let created = 0;
  let updated = 0;

  for (const [index, card] of URBAN_COLLECTION_CARDS.entries()) {
    const collection = await prisma.shopCollection.upsert({
      where: {
        storeKey_handle: {
          storeKey: 'urban',
          handle: card.collectionHandle,
        },
      },
      update: {
        titleUa: card.title,
        titleEn: card.title,
        brand: card.brand,
        heroImage: card.externalImageUrl,
        isPublished: true,
        isUrban: true,
        sortOrder: index,
      },
      create: {
        storeKey: 'urban',
        handle: card.collectionHandle,
        titleUa: card.title,
        titleEn: card.title,
        brand: card.brand,
        heroImage: card.externalImageUrl,
        isPublished: true,
        isUrban: true,
        sortOrder: index,
      },
      select: { id: true, createdAt: true, updatedAt: true },
    });

    collectionIdByHandle.set(card.collectionHandle, collection.id);

    if (collection.createdAt.getTime() === collection.updatedAt.getTime()) {
      created += 1;
    } else {
      updated += 1;
    }
  }

  return {
    created,
    updated,
    collectionIdByHandle,
  };
}

export async function syncUrbanCollectionAssignments(prisma: PrismaClient) {
  const { created, updated, collectionIdByHandle } = await syncUrbanCollections(prisma);
  const products = await prisma.shopProduct.findMany({
    where: { storeKey: 'urban' },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      brand: true,
      titleUa: true,
      titleEn: true,
      collectionUa: true,
      collectionEn: true,
      tags: true,
      collections: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          collectionId: true,
          sortOrder: true,
          collection: {
            select: {
              handle: true,
              titleUa: true,
              titleEn: true,
              brand: true,
              isUrban: true,
            },
          },
        },
      },
    },
  });

  const assignments: Array<{ productId: string; collectionId: string; sortOrder: number }> = [];

  for (const product of products) {
    const matcherHandle = getUrbanCollectionHandleForProduct({
      brand: product.brand ?? '',
      title: {
        ua: product.titleUa,
        en: product.titleEn,
      },
      collection: {
        ua: product.collectionUa ?? '',
        en: product.collectionEn ?? '',
      },
      tags: product.tags,
      collections: product.collections.map((entry) => ({
        handle: entry.collection.handle,
        title: {
          ua: entry.collection.titleUa,
          en: entry.collection.titleEn,
        },
        brand: entry.collection.brand,
        isUrban: entry.collection.isUrban,
        sortOrder: entry.sortOrder,
      })),
    });

    if (!matcherHandle) {
      continue;
    }

    const collectionId = collectionIdByHandle.get(matcherHandle);
    if (!collectionId) {
      continue;
    }

    const alreadyAssigned = product.collections.some((entry) => entry.collectionId === collectionId);
    if (alreadyAssigned) {
      continue;
    }

    assignments.push({
      productId: product.id,
      collectionId,
      sortOrder: product.collections.length,
    });
  }

  const assigned = assignments.length
    ? (
        await prisma.shopProductCollection.createMany({
          data: assignments,
          skipDuplicates: true,
        })
      ).count
    : 0;

  return {
    created,
    updated,
    assigned,
    totalCollections: collectionIdByHandle.size,
  };
}
