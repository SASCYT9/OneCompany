import "server-only";

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  readShopStorefrontDisplay,
  SHOP_STOREFRONT_DISPLAY_NAMESPACE,
  SHOP_STOREFRONT_DISPLAY_KEY,
} from "@/lib/shopStorefrontDisplay";
import {
  isShopInStockProduct,
  shouldShowShopProductInCarousel,
  SHOP_DIGITAL_IN_STOCK_SKUS,
  SHOP_WAREHOUSE_IN_STOCK_SKUS,
  SHOP_WAREHOUSE_IN_STOCK_SLUGS,
} from "@/lib/shopWarehouseInventory";

export type ShopWarehouseProduct = {
  id: string;
  sku: string | null;
  slug: string;
  showInCarousel: boolean;
};

const CACHE_TTL_MS = 30_000;
type WarehouseCache = {
  cached?: { expiresAt: number; value: ShopWarehouseProduct[] };
  pending?: Promise<ShopWarehouseProduct[]>;
  generation: number;
};
// Next can bundle the API and page separately in the same server process.
// Share only public inventory IDs, never viewer prices or session data.
const processCache = globalThis as typeof globalThis & {
  __oneCompanyWarehouseCacheV2?: WarehouseCache;
};
const cache = (processCache.__oneCompanyWarehouseCacheV2 ??= { generation: 0 });
cache.generation ??= 0;

async function queryWarehouseProducts(): Promise<ShopWarehouseProduct[]> {
  const products = await prisma.shopProduct.findMany({
    where: {
      isPublished: true,
      status: "ACTIVE",
      OR: [
        ...[...SHOP_WAREHOUSE_IN_STOCK_SKUS, ...SHOP_DIGITAL_IN_STOCK_SKUS].flatMap((sku) => [
          { sku: { equals: sku, mode: "insensitive" as const } },
          { variants: { some: { sku: { equals: sku, mode: "insensitive" as const } } } },
        ]),
        { slug: { in: [...SHOP_WAREHOUSE_IN_STOCK_SLUGS] } },
        {
          metafields: {
            some: {
              namespace: SHOP_STOREFRONT_DISPLAY_NAMESPACE,
              key: SHOP_STOREFRONT_DISPLAY_KEY,
            },
          },
        },
      ],
    },
    select: {
      id: true,
      sku: true,
      slug: true,
      variants: { select: { sku: true } },
      metafields: {
        where: { namespace: SHOP_STOREFRONT_DISPLAY_NAMESPACE, key: SHOP_STOREFRONT_DISPLAY_KEY },
      },
    },
  });
  return products.flatMap((product) => {
    const display = readShopStorefrontDisplay(product.metafields);
    const candidateSkus = [product.sku, ...(product.variants ?? []).map((variant) => variant.sku)];
    const confirmedStockSku = candidateSkus.find((sku) => isShopInStockProduct(sku, product.slug));
    const isAvailable = display
      ? isShopInStockProduct(product.sku, product.slug, display)
      : Boolean(confirmedStockSku);
    if (!isAvailable) return [];

    const confirmedCarouselSku = candidateSkus.find((sku) =>
      shouldShowShopProductInCarousel(sku, product.slug)
    );
    const showInCarousel = display
      ? shouldShowShopProductInCarousel(product.sku, product.slug, display)
      : Boolean(confirmedCarouselSku);
    return [
      {
        id: product.id,
        sku: confirmedCarouselSku ?? confirmedStockSku ?? product.sku,
        slug: product.slug,
        showInCarousel,
      },
    ];
  });
}

// Confirmed physical and digital availability is shared by every anonymous
// request. In production, keep one 60-second Data Cache entry across warm
// instances; tests and local development retain the deterministic process
// cache below. Product edits may therefore take at most one minute to appear
// in the stock badge, while repeated searches avoid another remote DB read.
const readWarehouseProducts =
  process.env.NODE_ENV === "production"
    ? unstable_cache(queryWarehouseProducts, ["shop-available-products-v4"], {
        revalidate: 60,
        tags: ["shop-warehouse-products"],
      })
    : queryWarehouseProducts;

/** Clear the process-local layer when a product mutation invalidates tags. */
export function invalidateShopWarehouseProductsCache() {
  cache.cached = undefined;
  cache.generation += 1;
}

/** Shared lookup for confirmed physical stock and available digital licenses. */
export function getShopInStockProducts(): Promise<ShopWarehouseProduct[]> {
  const now = Date.now();
  if (cache.cached && cache.cached.expiresAt > now) return Promise.resolve(cache.cached.value);
  if (cache.pending) return cache.pending;
  const generation = cache.generation;
  const pending = readWarehouseProducts()
    .then((value) => {
      if (cache.generation === generation) {
        cache.cached = { expiresAt: Date.now() + CACHE_TTL_MS, value };
      }
      return value;
    })
    .finally(() => {
      if (cache.pending === pending) cache.pending = undefined;
    });
  cache.pending = pending;
  return pending;
}
