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
export async function getShopFitmentCatalogProducts(): Promise<ShopProduct[]> {
  const products: ShopProduct[] = [];
  let cursor: string | undefined;

  while (true) {
    const rows = await prisma.shopProduct.findMany({
      where: { isPublished: true, status: "ACTIVE" },
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
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
        image: true,
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
      },
    });

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

    if (rows.length < PAGE_SIZE) break;
    cursor = rows.at(-1)?.id;
  }

  return products;
}
