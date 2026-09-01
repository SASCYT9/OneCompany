import type { ShopMoneySet } from "@/lib/shopCatalog";
import { prisma } from "@/lib/prisma";
import { resolveShopProductBrand } from "@/lib/shopProductBrand";

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
  defaultVariantId: string | null;
}>;

const money = (eur: unknown, usd: unknown, uah: unknown): ShopMoneySet => ({
  eur: Number(eur ?? 0) || 0,
  usd: Number(usd ?? 0) || 0,
  uah: Number(uah ?? 0) || 0,
});

const present = (value: ShopMoneySet) =>
  value.eur > 0 || value.usd > 0 || value.uah > 0 ? value : null;

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

  const rows = await prisma.shopProduct.findMany({
    where: { id: { in: uniqueIds }, isPublished: true, status: "ACTIVE" },
    select: {
      id: true,
      brand: true,
      vendor: true,
      image: true,
      sku: true,
      priceEur: true,
      priceEurEurope: true,
      priceUsd: true,
      priceUah: true,
      priceEurB2b: true,
      priceUsdB2b: true,
      priceUahB2b: true,
      compareAtEur: true,
      compareAtUsd: true,
      compareAtUah: true,
      compareAtEurB2b: true,
      compareAtUsdB2b: true,
      compareAtUahB2b: true,
      variants: {
        orderBy: [{ isDefault: "desc" }, { position: "asc" }],
        take: 1,
        select: {
          id: true,
          sku: true,
          image: true,
          priceEur: true,
          priceEurEurope: true,
          priceUsd: true,
          priceUah: true,
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
      media: {
        where: { mediaType: "IMAGE" },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        take: 1,
        select: { src: true },
      },
    },
  });
  const order = new Map(uniqueIds.map((id, index) => [id, index]));

  return rows
    .map((row) => {
      const variant = row.variants[0];
      return {
        productId: row.id,
        price: money(
          row.priceEur ?? variant?.priceEur,
          row.priceUsd ?? variant?.priceUsd,
          row.priceUah ?? variant?.priceUah
        ),
        europePrice: present(money(row.priceEurEurope ?? variant?.priceEurEurope, 0, 0)),
        b2bPrice: present(
          money(
            row.priceEurB2b ?? variant?.priceEurB2b,
            row.priceUsdB2b ?? variant?.priceUsdB2b,
            row.priceUahB2b ?? variant?.priceUahB2b
          )
        ),
        compareAt: present(
          money(
            row.compareAtEur ?? variant?.compareAtEur,
            row.compareAtUsd ?? variant?.compareAtUsd,
            row.compareAtUah ?? variant?.compareAtUah
          )
        ),
        b2bCompareAt: present(
          money(
            row.compareAtEurB2b ?? variant?.compareAtEurB2b,
            row.compareAtUsdB2b ?? variant?.compareAtUsdB2b,
            row.compareAtUahB2b ?? variant?.compareAtUahB2b
          )
        ),
        brand: resolveShopProductBrand(row) || null,
        sku: row.sku ?? variant?.sku ?? null,
        primaryMediaUrl: row.image ?? variant?.image ?? row.media[0]?.src ?? null,
        defaultVariantId: variant?.id ?? null,
      } satisfies ShopCatalogCardPricing;
    })
    .sort(
      (left, right) =>
        (order.get(left.productId) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(right.productId) ?? Number.MAX_SAFE_INTEGER)
    );
}
