import { boundedCatalogPages, readCatalogRowsWithSizeFallback } from "@/lib/boundedCatalogPages";
import type { ShopMoneySet, ShopProduct } from "@/lib/shopCatalog";
import { prisma } from "@/lib/prisma";
import { resolveShopProductBrand } from "@/lib/shopProductBrand";
import { withAccelerate } from "@prisma/extension-accelerate";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 250;
const isAccelerateEnabled =
  process.env.DATABASE_URL?.startsWith("prisma://") ||
  process.env.DATABASE_URL?.startsWith("prisma+postgres://") ||
  false;
let acceleratedPrisma: ReturnType<typeof createAcceleratedPrisma> | null = null;

function createAcceleratedPrisma() {
  return prisma.$extends(withAccelerate());
}

function productQueryClient(): ReturnType<typeof createAcceleratedPrisma> {
  if (!isAccelerateEnabled) {
    return prisma as unknown as ReturnType<typeof createAcceleratedPrisma>;
  }
  acceleratedPrisma ??= createAcceleratedPrisma();
  return acceleratedPrisma;
}

function withProductCache<T extends Record<string, unknown>>(query: T): T {
  if (!isAccelerateEnabled) return query;
  return {
    ...query,
    cacheStrategy: { ttl: 300, swr: 60, tags: ["shop-products"] },
  };
}

type FitmentCatalogRow = Prisma.ShopProductGetPayload<{
  include: {
    variants: true;
    collections: { include: { collection: true } };
  };
}>;

const money = (
  eur: { toString(): string } | number | null,
  usd: { toString(): string } | number | null,
  uah: { toString(): string } | number | null
): ShopMoneySet => ({
  eur: Number(eur ?? 0),
  usd: Number(usd ?? 0),
  uah: Number(uah ?? 0),
});

/**
 * Loads the complete published catalog in bounded pages for vehicle filtering.
 *
 * The regular storefront loader includes complete descriptions, media,
 * options, metafields and bundle graphs. Asking Prisma Accelerate for that
 * graph across ~15k products exceeds both its execution-time and 5 MB response
 * limits, after which development used a tiny static fallback. Vehicle filters
 * only need search/fitment evidence plus card pricing and a primary image, so
 * keep this projection deliberately small and deterministic.
 */
export async function getShopFitmentCatalogProducts(
  options: {
    evidenceOnly?: boolean;
    productIds?: readonly string[];
    includeDescriptions?: boolean;
    includeVariants?: boolean;
    includeCollections?: boolean;
  } = {}
): Promise<ShopProduct[]> {
  // Vehicle ID resolution does not render prices or media. Keep every text field
  // consumed by the fitment extractor while omitting that unrelated DB payload.
  const includeCommerce = !options.evidenceOnly;
  const includeVariants = options.includeVariants !== false;
  const includeCollections = options.includeCollections !== false;
  // Long descriptions are intentionally opt-in. Buyer search uses the compact
  // projection and persisted fitment records; the backfill/import path can
  // request description evidence without inflating every search response.
  const includeDescriptions = options.includeDescriptions === true;
  const requestedProductIds = options.productIds
    ? [...new Set(options.productIds.filter((id): id is string => Boolean(id)))].sort()
    : null;
  const products: ShopProduct[] = [];
  // Rich card reads retain 250-row pages. Text-only evidence uses larger
  // windows to reduce database round trips, splitting on byte-limit errors.
  // ID windows are keyset-paginated; avoid increasingly expensive OFFSET scans.
  const pages = boundedCatalogPages({
    pageSize: requestedProductIds
      ? 500
      : options.evidenceOnly || !includeVariants
        ? 1_000
        : PAGE_SIZE,
    // Keep the compact first read below the database connection ceiling; the
    // search request also reads settings, pricing and inventory in parallel.
    concurrency: 4,
    readIds: async (after, limit) => {
      if (requestedProductIds) {
        const start = after ? requestedProductIds.indexOf(after) + 1 : 0;
        return requestedProductIds.slice(Math.max(0, start), start + limit);
      }
      const rows = (await productQueryClient().shopProduct.findMany(
        withProductCache({
          where: { isPublished: true, status: "ACTIVE", ...(after ? { id: { gt: after } } : {}) },
          orderBy: { id: "asc" },
          take: limit,
          select: { id: true },
        }) as never
      )) as unknown as Array<{ id: string }>;
      return rows.map((row) => row.id);
    },
    readRows: (ids) =>
      readCatalogRowsWithSizeFallback<FitmentCatalogRow>(
        ids,
        (batchIds) =>
          productQueryClient().shopProduct.findMany(
            withProductCache({
              where: { id: { in: batchIds }, isPublished: true, status: "ACTIVE" },
              orderBy: { id: "asc" },
              select: {
                id: true,
                slug: true,
                sku: true,
                scope: true,
                brand: true,
                vendor: true,
                productType: true,
                tags: true,
                titleUa: true,
                titleEn: true,
                categoryUa: true,
                categoryEn: true,
                shortDescUa: true,
                shortDescEn: true,
                ...(includeDescriptions
                  ? {
                      longDescUa: true,
                      longDescEn: true,
                      bodyHtmlUa: true,
                      bodyHtmlEn: true,
                    }
                  : {}),
                collectionUa: true,
                collectionEn: true,
                stock: true,
                priceEur: includeCommerce,
                priceUsd: includeCommerce,
                priceUah: includeCommerce,
                priceEurEurope: includeCommerce,
                priceEurB2b: includeCommerce,
                priceUsdB2b: includeCommerce,
                priceUahB2b: includeCommerce,
                compareAtEur: includeCommerce,
                compareAtUsd: includeCommerce,
                compareAtUah: includeCommerce,
                compareAtEurB2b: includeCommerce,
                compareAtUsdB2b: includeCommerce,
                compareAtUahB2b: includeCommerce,
                image: includeCommerce,
                ...(includeCollections
                  ? {
                      collections: {
                        select: {
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
                        },
                      },
                    }
                  : {}),
                // Variant options and inventory do not contribute to fitment
                // extraction. Avoid multiplying the cold legacy scan by the
                // variant graph; rich storefront reads still keep it intact.
                ...(includeCommerce && includeVariants
                  ? {
                      variants: {
                        orderBy: { position: "asc" },
                        select: {
                          id: true,
                          title: true,
                          sku: true,
                          position: true,
                          option1Value: true,
                          option2Value: true,
                          option3Value: true,
                          inventoryQty: true,
                          image: true,
                          isDefault: true,
                          priceEur: true,
                          priceUsd: true,
                          priceUah: true,
                          priceEurEurope: true,
                          priceEurB2b: true,
                          priceUsdB2b: true,
                          priceUahB2b: true,
                          compareAtEur: true,
                          compareAtUsd: true,
                          compareAtUah: true,
                          compareAtEurB2b: true,
                          compareAtUsdB2b: true,
                          compareAtUahB2b: true,
                        },
                      },
                    }
                  : {}),
              },
            }) as never
          ) as unknown as Promise<FitmentCatalogRow[]>
      ),
  });

  for await (const rows of pages) {
    for (const row of rows) {
      products.push({
        id: row.id,
        slug: row.slug,
        sku: row.sku ?? "",
        scope: row.scope === "moto" ? "moto" : "auto",
        brand: resolveShopProductBrand(row),
        vendor: row.vendor ?? undefined,
        productType: row.productType ?? undefined,
        tags: row.tags,
        title: { ua: row.titleUa, en: row.titleEn },
        category: { ua: row.categoryUa ?? "", en: row.categoryEn ?? "" },
        shortDescription: { ua: row.shortDescUa ?? "", en: row.shortDescEn ?? "" },
        longDescription: {
          ua:
            (includeDescriptions
              ? ((row as { bodyHtmlUa?: string | null }).bodyHtmlUa ??
                (row as { longDescUa?: string | null }).longDescUa)
              : null) ?? "",
          en:
            (includeDescriptions
              ? ((row as { bodyHtmlEn?: string | null }).bodyHtmlEn ??
                (row as { longDescEn?: string | null }).longDescEn)
              : null) ?? "",
        },
        leadTime: { ua: "", en: "" },
        stock: row.stock === "preOrder" ? "preOrder" : "inStock",
        collection: { ua: row.collectionUa ?? "", en: row.collectionEn ?? "" },
        price: money(row.priceEur, row.priceUsd, row.priceUah),
        europePrice: money(row.priceEurEurope, row.priceUsd, row.priceUah),
        b2bPrice: money(row.priceEurB2b, row.priceUsdB2b, row.priceUahB2b),
        compareAt: money(row.compareAtEur, row.compareAtUsd, row.compareAtUah),
        b2bCompareAt: money(row.compareAtEurB2b, row.compareAtUsdB2b, row.compareAtUahB2b),
        image: row.image ?? "",
        highlights: [],
        collections: readProductCollections(row).map((entry) => ({
          id: entry.collection.id,
          handle: entry.collection.handle,
          title: { ua: entry.collection.titleUa, en: entry.collection.titleEn },
          brand: entry.collection.brand,
          isUrban: entry.collection.isUrban,
          sortOrder: entry.sortOrder,
        })),
        variants: (row.variants ?? []).map((variant) => ({
          id: variant.id,
          title: variant.title,
          sku: variant.sku,
          position: variant.position,
          optionValues: [variant.option1Value, variant.option2Value, variant.option3Value].filter(
            (value): value is string => Boolean(value)
          ),
          inventoryQty: variant.inventoryQty,
          image: variant.image,
          isDefault: variant.isDefault,
          price: money(variant.priceEur, variant.priceUsd, variant.priceUah),
          europePrice: money(variant.priceEurEurope, variant.priceUsd, variant.priceUah),
          b2bPrice: money(variant.priceEurB2b, variant.priceUsdB2b, variant.priceUahB2b),
          compareAt: money(variant.compareAtEur, variant.compareAtUsd, variant.compareAtUah),
          b2bCompareAt: money(
            variant.compareAtEurB2b,
            variant.compareAtUsdB2b,
            variant.compareAtUahB2b
          ),
        })),
      });
    }
  }

  return products;
}

type ProductCollectionRow = {
  sortOrder: number;
  collection: {
    id: string;
    handle: string;
    titleUa: string;
    titleEn: string;
    brand: string;
    isUrban: boolean;
  };
};

function readProductCollections(row: object): ProductCollectionRow[] {
  if (!("collections" in row) || !Array.isArray(row.collections)) return [];
  return row.collections as ProductCollectionRow[];
}
