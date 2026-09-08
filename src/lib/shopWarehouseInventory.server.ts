import "server-only";

import { unstable_cache } from "next/cache";
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

async function queryWarehouseProducts(): Promise<ShopWarehouseProduct[]> {
  return prisma.shopProduct.findMany({
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
  });
}

// The warehouse SKU allowlist changes rarely and is shared by every anonymous
// request. In production, keep one 60-second Data Cache entry across warm
// instances; tests and local development retain the deterministic process
// cache below. Product edits may therefore take at most one minute to appear
// in the stock badge, while repeated searches avoid another remote DB read.
const readWarehouseProducts =
  process.env.NODE_ENV === "production"
    ? unstable_cache(queryWarehouseProducts, ["shop-warehouse-products-v1"], {
        revalidate: 60,
        tags: ["shop-warehouse-products"],
      })
    : queryWarehouseProducts;

/** Shared short lived lookup for the bounded warehouse inventory set. */
export function getShopWarehouseProducts(): Promise<ShopWarehouseProduct[]> {
  const now = Date.now();
  if (cache.cached && cache.cached.expiresAt > now) return Promise.resolve(cache.cached.value);
  if (cache.pending) return cache.pending;
  cache.pending = readWarehouseProducts()
    .then((value) => {
      cache.cached = { expiresAt: Date.now() + CACHE_TTL_MS, value };
      return value;
    })
    .finally(() => {
      cache.pending = undefined;
    });
  return cache.pending;
}
