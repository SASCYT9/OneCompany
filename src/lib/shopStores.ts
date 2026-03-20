import type { PrismaClient } from '@prisma/client';

export const DEFAULT_SHOP_STORE_KEY = 'urban';

export const DEFAULT_SHOP_STORES = [
  {
    key: 'urban',
    name: 'Urban Automotive',
    description: 'Default store for the current One Company shop catalog.',
    sortOrder: 0,
  },
] as const;

export type ShopStoreSummary = {
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  productCount?: number;
  collectionCount?: number;
  categoryCount?: number;
  orderCount?: number;
};

export function normalizeShopStoreKey(value: unknown): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized || DEFAULT_SHOP_STORE_KEY;
}

export function sanitizeShopStoreKeyInput(value: unknown): string {
  const normalized = normalizeShopStoreKey(value).replace(/[^a-z0-9-_]+/g, '-');
  return normalized.replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export type ShopStoreInput = {
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
};

export function normalizeShopStoreInput(input: unknown, fallbackKey?: string): ShopStoreInput {
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const key = sanitizeShopStoreKeyInput(source.key ?? fallbackKey ?? '');
  const name = String(source.name ?? '').trim();
  const description = String(source.description ?? '').trim() || null;
  const sortOrder = Number(source.sortOrder ?? 0);

  return {
    key,
    name,
    description,
    isActive: source.isActive !== false,
    sortOrder: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0,
  };
}

export async function ensureDefaultShopStores(prisma: PrismaClient) {
  for (const store of DEFAULT_SHOP_STORES) {
    await prisma.shopStore.upsert({
      where: { key: store.key },
      update: {
        name: store.name,
        description: store.description,
        sortOrder: store.sortOrder,
        isActive: true,
      },
      create: {
        key: store.key,
        name: store.name,
        description: store.description,
        sortOrder: store.sortOrder,
        isActive: true,
      },
    });
  }
}

export async function listShopStores(prisma: PrismaClient): Promise<ShopStoreSummary[]> {
  await ensureDefaultShopStores(prisma);
  const stores = await prisma.shopStore.findMany({
    include: {
      _count: {
        select: {
          products: true,
          collections: true,
          categories: true,
          orders: true,
        },
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  return stores.map((store) => ({
    key: store.key,
    name: store.name,
    description: store.description,
    isActive: store.isActive,
    sortOrder: store.sortOrder,
    productCount: store._count.products,
    collectionCount: store._count.collections,
    categoryCount: store._count.categories,
    orderCount: store._count.orders,
  }));
}

export async function createShopStore(prisma: PrismaClient, input: ShopStoreInput): Promise<ShopStoreSummary> {
  const created = await prisma.shopStore.create({
    data: {
      key: input.key,
      name: input.name,
      description: input.description,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    },
    include: {
      _count: {
        select: {
          products: true,
          collections: true,
          categories: true,
          orders: true,
        },
      },
    },
  });

  return {
    key: created.key,
    name: created.name,
    description: created.description,
    isActive: created.isActive,
    sortOrder: created.sortOrder,
    productCount: created._count.products,
    collectionCount: created._count.collections,
    categoryCount: created._count.categories,
    orderCount: created._count.orders,
  };
}

export async function updateShopStore(
  prisma: PrismaClient,
  key: string,
  input: Omit<ShopStoreInput, 'key'>
): Promise<ShopStoreSummary> {
  const updated = await prisma.shopStore.update({
    where: { key },
    data: {
      name: input.name,
      description: input.description,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    },
    include: {
      _count: {
        select: {
          products: true,
          collections: true,
          categories: true,
          orders: true,
        },
      },
    },
  });

  return {
    key: updated.key,
    name: updated.name,
    description: updated.description,
    isActive: updated.isActive,
    sortOrder: updated.sortOrder,
    productCount: updated._count.products,
    collectionCount: updated._count.collections,
    categoryCount: updated._count.categories,
    orderCount: updated._count.orders,
  };
}
