import "server-only";

import { prisma } from "@/lib/prisma";
import {
  SHOP_WAREHOUSE_IN_STOCK_SKUS,
  SHOP_WAREHOUSE_IN_STOCK_SLUGS,
} from "@/lib/shopWarehouseInventory";

export type ShopWarehouseProduct = { id: string; sku: string | null; slug: string };

const CACHE_TTL_MS = 30_000;
type WarehouseCache = {
  cached?: { expiresAt: number; value: ShopWarehouseProduct[] };
  pending?: Promise<ShopWarehouseProduct[]>;
};
// Next can bundle the API and page separately in the same server process.
// Share only public inventory IDs, never viewer prices or session data.
const processCache = globalThis as typeof globalThis & {
  __oneCompanyWarehouseCacheV1?: WarehouseCache;
};
const cache = (processCache.__oneCompanyWarehouseCacheV1 ??= {});

/** Shared short lived lookup for the bounded warehouse inventory set. */
export function getShopWarehouseProducts(): Promise<ShopWarehouseProduct[]> {
  const now = Date.now();
  if (cache.cached && cache.cached.expiresAt > now) return Promise.resolve(cache.cached.value);
  if (cache.pending) return cache.pending;
  cache.pending = prisma.shopProduct
    .findMany({
      where: {
        isPublished: true,
        status: "ACTIVE",
        OR: [
          ...SHOP_WAREHOUSE_IN_STOCK_SKUS.flatMap((sku) => [
            { sku: { equals: sku, mode: "insensitive" as const } },
            { variants: { some: { sku: { equals: sku, mode: "insensitive" as const } } } },
          ]),
          { slug: { in: [...SHOP_WAREHOUSE_IN_STOCK_SLUGS] } },
        ],
      },
      select: { id: true, sku: true, slug: true },
    })
    .then((value) => {
      cache.cached = { expiresAt: Date.now() + CACHE_TTL_MS, value };
      return value;
    })
    .finally(() => {
      cache.pending = undefined;
    });
  return cache.pending;
}
