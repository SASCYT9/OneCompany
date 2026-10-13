import type { CustomerGroup, PrismaClient } from "@prisma/client";
import type { ShopSettingsRuntime } from "@/lib/shopAdminSettings";
import {
  buildShopBrandDiscountMap,
  mergeShopPartnerBrandDiscountMaps,
} from "@/lib/shopB2bBrandDiscounts";
import {
  buildShopViewerPricingContext,
  type ShopViewerPricingContext,
} from "@/lib/shopPricingAudience";

/**
 * `customerBrandDiscountMap` is the partner's whole brand layer: their tariff
 * group's rules with their own rules on top. The two tiers are adjacent in
 * `resolveShopB2bDiscount`, so merging them prices exactly the same while the
 * storefront, cart and SQL price paths keep a single partner map.
 */
export async function loadShopBrandDiscountMaps(
  prisma: PrismaClient,
  customerId: string | null | undefined,
  customerGroup: CustomerGroup | null | undefined
) {
  if (!customerId || customerGroup !== "B2B_APPROVED") return undefined;
  const [system, group, customer] = await Promise.all([
    prisma.shopBrandB2bDiscount.findMany({ select: { brand: true, discountPct: true } }),
    prisma.shopB2bTariffGroupBrandDiscount.findMany({
      where: { group: { customers: { some: { id: customerId } } } },
      select: { brand: true, discountPct: true },
    }),
    prisma.shopCustomerBrandDiscount.findMany({
      where: { customerId },
      select: { brand: true, discountPct: true },
    }),
  ]);
  return {
    systemBrandDiscountMap: buildShopBrandDiscountMap(system),
    customerBrandDiscountMap: mergeShopPartnerBrandDiscountMaps(
      buildShopBrandDiscountMap(group),
      buildShopBrandDiscountMap(customer)
    ),
  };
}

export async function buildShopViewerPricingContextServer(input: {
  prisma: PrismaClient;
  settings: ShopSettingsRuntime;
  customerId?: string | null;
  customerGroup?: CustomerGroup | null;
  isAuthenticated: boolean;
  customerB2BDiscountPercent?: number | null;
  priceCountry?: string | null;
}): Promise<ShopViewerPricingContext> {
  const brandMaps = await loadShopBrandDiscountMaps(
    input.prisma,
    input.customerId,
    input.customerGroup
  );
  return buildShopViewerPricingContext(
    input.settings,
    input.customerGroup ?? null,
    input.isAuthenticated,
    input.customerB2BDiscountPercent ?? null,
    brandMaps,
    { priceCountry: input.priceCountry ?? null }
  );
}
