import { boundedCatalogPages } from "@/lib/boundedCatalogPages";
import type { ShopMoneySet, ShopProduct } from "@/lib/shopCatalog";
import { prisma } from "@/lib/prisma";
import { resolveShopProductBrand } from "@/lib/shopProductBrand";

const PAGE_SIZE = 250;

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
  options: { evidenceOnly?: boolean } = {}
): Promise<ShopProduct[]> {
  // Vehicle ID resolution does not render prices or media. Keep every text field
  // consumed by the fitment extractor while omitting that unrelated DB payload.
  const includeCommerce = !options.evidenceOnly;
  const products: ShopProduct[] = [];
  // Keep each rich response capped at 250 rows, while overlapping four reads.
  // ID windows are keyset-paginated; avoid increasingly expensive OFFSET scans.
  const pages = boundedCatalogPages({
    pageSize: PAGE_SIZE,
    concurrency: 4,
    readIds: async (after, limit) => {
      const rows = await prisma.shopProduct.findMany({
        where: { isPublished: true, status: "ACTIVE", ...(after ? { id: { gt: after } } : {}) },
        orderBy: { id: "asc" },
        take: limit,
        select: { id: true },
      });
      return rows.map((row) => row.id);
    },
    readRows: (ids) =>
      prisma.shopProduct.findMany({
        where: { id: { in: ids }, isPublished: true, status: "ACTIVE" },
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
              inventoryQty: includeCommerce,
              image: includeCommerce,
              isDefault: true,
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
            },
          },
        },
      }),
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
        longDescription: { ua: "", en: "" },
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
        collections: row.collections.map((entry) => ({
          id: entry.collection.id,
          handle: entry.collection.handle,
          title: { ua: entry.collection.titleUa, en: entry.collection.titleEn },
          brand: entry.collection.brand,
          isUrban: entry.collection.isUrban,
          sortOrder: entry.sortOrder,
        })),
        variants: row.variants.map((variant) => ({
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
