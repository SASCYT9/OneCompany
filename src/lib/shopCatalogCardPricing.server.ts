import type { ShopMoneySet } from "@/lib/shopCatalog";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveShopProductBrand } from "@/lib/shopProductBrand";
import {
  parseShopStorefrontDisplay,
  SHOP_STOREFRONT_DISPLAY_NAMESPACE,
  SHOP_STOREFRONT_DISPLAY_KEY,
} from "@/lib/shopStorefrontDisplay";
import type { ShopStorefrontDisplay } from "@/lib/shopWarehouseInventory";

export type ShopCatalogCardPricing = Readonly<{
  productId: string;
  price: ShopMoneySet;
  europePrice: ShopMoneySet | null;
  b2bPrice: ShopMoneySet | null;
  compareAt: ShopMoneySet | null;
  b2bCompareAt: ShopMoneySet | null;
  brand: string | null;
  sku: string | null;
  primaryMediaUrl: string | null;
  imageSources: string[];
  defaultVariantId: string | null;
  storefrontDisplay?: ShopStorefrontDisplay;
}>;

const money = (eur: unknown, usd: unknown, uah: unknown): ShopMoneySet => ({
  eur: Number(eur ?? 0) || 0,
  usd: Number(usd ?? 0) || 0,
  uah: Number(uah ?? 0) || 0,
});

const present = (value: ShopMoneySet) =>
  value.eur > 0 || value.usd > 0 || value.uah > 0 ? value : null;

// Search, pagination and mobile back-navigation can ask for the same visible
// page concurrently. Coalesce only the in-flight read; successful values are
// never retained, so a price edit remains visible on the next request.
const cardPricingFlights = new Map<string, Promise<ShopCatalogCardPricing[]>>();

type ShopCatalogCardPricingRow = {
  storefrontDisplayValue: string | null;
  id: string;
  brand: string | null;
  vendor: string | null;
  image: string | null;
  sku: string | null;
  priceEur: unknown;
  priceEurEurope: unknown;
  priceUsd: unknown;
  priceUah: unknown;
  priceEurB2b: unknown;
  priceUsdB2b: unknown;
  priceUahB2b: unknown;
  compareAtEur: unknown;
  compareAtUsd: unknown;
  compareAtUah: unknown;
  compareAtEurB2b: unknown;
  compareAtUsdB2b: unknown;
  compareAtUahB2b: unknown;
  variantId: string | null;
  variantSku: string | null;
  variantImage: string | null;
  variantPriceEur: unknown;
  variantPriceEurEurope: unknown;
  variantPriceUsd: unknown;
  variantPriceUah: unknown;
  variantPriceEurB2b: unknown;
  variantPriceUsdB2b: unknown;
  variantPriceUahB2b: unknown;
  variantCompareAtEur: unknown;
  variantCompareAtUsd: unknown;
  variantCompareAtUah: unknown;
  variantCompareAtEurB2b: unknown;
  variantCompareAtUsdB2b: unknown;
  variantCompareAtUahB2b: unknown;
  mediaSrc: string | null;
};

/**
 * Read only the card fields needed after projection pagination. A nested
 * Prisma include can issue several relation queries and hydrate arrays for
 * every visible product; this single statement keeps the same precedence
 * while bounding the work to one default variant and one image per ID.
 */
async function readShopCatalogCardPricingRows(
  uniqueIds: readonly string[]
): Promise<ShopCatalogCardPricingRow[]> {
  return prisma.$queryRaw<ShopCatalogCardPricingRow[]>(Prisma.sql`
    SELECT
      product."id",
      (SELECT field."value" FROM "ShopProductMetafield" field
       WHERE field."productId" = product."id"
         AND field."namespace" = ${SHOP_STOREFRONT_DISPLAY_NAMESPACE}
         AND field."key" = ${SHOP_STOREFRONT_DISPLAY_KEY}
       LIMIT 1) AS "storefrontDisplayValue",
      product."brand",
      product."vendor",
      product."image",
      product."sku",
      product."priceEur",
      product."priceEurEurope",
      product."priceUsd",
      product."priceUah",
      product."priceEurB2b",
      product."priceUsdB2b",
      product."priceUahB2b",
      product."compareAtEur",
      product."compareAtUsd",
      product."compareAtUah",
      product."compareAtEurB2b",
      product."compareAtUsdB2b",
      product."compareAtUahB2b",
      variant."id" AS "variantId",
      variant."sku" AS "variantSku",
      variant."image" AS "variantImage",
      variant."priceEur" AS "variantPriceEur",
      variant."priceEurEurope" AS "variantPriceEurEurope",
      variant."priceUsd" AS "variantPriceUsd",
      variant."priceUah" AS "variantPriceUah",
      variant."priceEurB2b" AS "variantPriceEurB2b",
      variant."priceUsdB2b" AS "variantPriceUsdB2b",
      variant."priceUahB2b" AS "variantPriceUahB2b",
      variant."compareAtEur" AS "variantCompareAtEur",
      variant."compareAtUsd" AS "variantCompareAtUsd",
      variant."compareAtUah" AS "variantCompareAtUah",
      variant."compareAtEurB2b" AS "variantCompareAtEurB2b",
      variant."compareAtUsdB2b" AS "variantCompareAtUsdB2b",
      variant."compareAtUahB2b" AS "variantCompareAtUahB2b",
      media."src" AS "mediaSrc"
    FROM "ShopProduct" product
    LEFT JOIN LATERAL (
      SELECT
        candidate."id", candidate."sku", candidate."image",
        candidate."priceEur", candidate."priceEurEurope", candidate."priceUsd", candidate."priceUah",
        candidate."priceEurB2b", candidate."priceUsdB2b", candidate."priceUahB2b",
        candidate."compareAtEur", candidate."compareAtUsd", candidate."compareAtUah",
        candidate."compareAtEurB2b", candidate."compareAtUsdB2b", candidate."compareAtUahB2b"
      FROM "ShopProductVariant" candidate
      WHERE candidate."productId" = product."id"
      ORDER BY candidate."isDefault" DESC, candidate."position" ASC, candidate."id" ASC
      LIMIT 1
    ) variant ON true
    LEFT JOIN LATERAL (
      SELECT candidate."src"
      FROM "ShopProductMedia" candidate
      WHERE candidate."productId" = product."id"
        AND candidate."mediaType" = 'IMAGE'
      ORDER BY candidate."position" ASC, candidate."createdAt" ASC, candidate."id" ASC
      LIMIT 1
    ) media ON true
    WHERE product."id" IN (${Prisma.join(uniqueIds)})
      AND product."isPublished" = true
      AND product."status" = 'ACTIVE'
  `);
}

/**
 * Fresh, bounded storefront pricing read for an already-resolved catalog page.
 * It deliberately avoids the full product include graph and any data cache so
 * an admin price edit is visible on the next request.
 */
export async function getShopCatalogCardPricingByIds(
  ids: readonly string[]
): Promise<ShopCatalogCardPricing[]> {
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return [];
  if (uniqueIds.length > 100) throw new RangeError("Catalog card pricing is limited to 100 IDs");

  const flightKey = uniqueIds.join("\u001f");
  const existing = cardPricingFlights.get(flightKey);
  if (existing) return existing;

  const promise = readShopCatalogCardPricing(uniqueIds).finally(() => {
    if (cardPricingFlights.get(flightKey) === promise) cardPricingFlights.delete(flightKey);
  });
  cardPricingFlights.set(flightKey, promise);
  return promise;
}

async function readShopCatalogCardPricing(uniqueIds: readonly string[]) {
  const rows = await readShopCatalogCardPricingRows(uniqueIds);
  const order = new Map(uniqueIds.map((id, index) => [id, index]));

  return rows
    .map((row) => {
      const variant = {
        id: row.variantId,
        sku: row.variantSku,
        image: row.variantImage,
        priceEur: row.variantPriceEur,
        priceEurEurope: row.variantPriceEurEurope,
        priceUsd: row.variantPriceUsd,
        priceUah: row.variantPriceUah,
        priceEurB2b: row.variantPriceEurB2b,
        priceUsdB2b: row.variantPriceUsdB2b,
        priceUahB2b: row.variantPriceUahB2b,
        compareAtEur: row.variantCompareAtEur,
        compareAtUsd: row.variantCompareAtUsd,
        compareAtUah: row.variantCompareAtUah,
        compareAtEurB2b: row.variantCompareAtEurB2b,
        compareAtUsdB2b: row.variantCompareAtUsdB2b,
        compareAtUahB2b: row.variantCompareAtUahB2b,
      };
      return {
        productId: row.id,
        storefrontDisplay:
          row.storefrontDisplayValue == null
            ? undefined
            : (parseShopStorefrontDisplay(row.storefrontDisplayValue) ?? {
                availability: "preOrder",
                showInStock: false,
                showInCarousel: false,
              }),
        price: money(
          row.priceEur ?? variant.priceEur,
          row.priceUsd ?? variant.priceUsd,
          row.priceUah ?? variant.priceUah
        ),
        europePrice: present(money(row.priceEurEurope ?? variant.priceEurEurope, 0, 0)),
        b2bPrice: present(
          money(
            row.priceEurB2b ?? variant.priceEurB2b,
            row.priceUsdB2b ?? variant.priceUsdB2b,
            row.priceUahB2b ?? variant.priceUahB2b
          )
        ),
        compareAt: present(
          money(
            row.compareAtEur ?? variant.compareAtEur,
            row.compareAtUsd ?? variant.compareAtUsd,
            row.compareAtUah ?? variant.compareAtUah
          )
        ),
        b2bCompareAt: present(
          money(
            row.compareAtEurB2b ?? variant.compareAtEurB2b,
            row.compareAtUsdB2b ?? variant.compareAtUsdB2b,
            row.compareAtUahB2b ?? variant.compareAtUahB2b
          )
        ),
        brand: resolveShopProductBrand(row) || null,
        sku: row.sku ?? variant.sku ?? null,
        primaryMediaUrl: row.image?.trim() || variant.image?.trim() || row.mediaSrc?.trim() || null,
        imageSources: [
          ...new Set(
            [row.image, variant.image, row.mediaSrc]
              .map((src) => src?.trim())
              .filter((src): src is string => Boolean(src))
          ),
        ],
        defaultVariantId: variant.id ?? null,
      } satisfies ShopCatalogCardPricing;
    })
    .sort(
      (left, right) =>
        (order.get(left.productId) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(right.productId) ?? Number.MAX_SAFE_INTEGER)
    );
}
