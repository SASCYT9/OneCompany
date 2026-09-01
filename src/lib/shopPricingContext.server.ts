import type { CustomerGroup, PrismaClient } from "@prisma/client";
import type { ShopSettingsRuntime } from "@/lib/shopAdminSettings";
import {
  buildShopViewerPricingContext,
  type ShopViewerPricingContext,
} from "@/lib/shopPricingAudience";

export async function loadShopBrandDiscountMaps(
  prisma: PrismaClient,
  customerId: string | null | undefined,
  customerGroup: CustomerGroup | null | undefined
) {
  if (!customerId || customerGroup !== "B2B_APPROVED") return undefined;
  const [system, customer] = await Promise.all([
    prisma.shopBrandB2bDiscount.findMany({ select: { brand: true, discountPct: true } }),
    prisma.shopCustomerBrandDiscount.findMany({
      where: { customerId },
      select: { brand: true, discountPct: true },
    }),
  ]);
  const toMap = (rows: Array<{ brand: string; discountPct: unknown }>) =>
    new Map(rows.map((row) => [row.brand.trim().toLowerCase(), Number(row.discountPct)]));
  return {
    systemBrandDiscountMap: toMap(system),
    customerBrandDiscountMap: toMap(customer),
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
