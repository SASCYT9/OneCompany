import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/adminRbac";
import { prisma } from "@/lib/prisma";
import { getShopProductBySlugServer } from "@/lib/shopCatalogServer";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { buildShopViewerPricingContextServer } from "@/lib/shopPricingContext.server";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";
import { createShopB2bTermsResolver } from "@/lib/shopB2bBrandDiscounts";
import { loadShopB2bCustomerPricingTerms } from "@/lib/shopB2bAdmin.server";

const MAX_RESULTS = 8;

/**
 * GET /api/admin/shop/b2b/price-check?customerId=&q=&country=
 *
 * Prices matching products through the storefront pricing path for one
 * partner, so a manager sees exactly what that partner sees and which rule
 * produced the discount. Read-only.
 */
export async function GET(request: NextRequest) {
  try {
    await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ);
    const params = request.nextUrl.searchParams;
    const customerId = params.get("customerId")?.trim() ?? "";
    const query = params.get("q")?.trim().slice(0, 120) ?? "";
    const country = params.get("country")?.trim() || "Ukraine";
    const words = query
      .split(/\s+/)
      .filter((word) => word.length > 1)
      .slice(0, 5);
    if (!customerId || !words.length) return NextResponse.json({ items: [] });

    const customer = await prisma.shopCustomer.findUnique({
      where: { id: customerId },
      select: { id: true, group: true, b2bDiscountPercent: true },
    });
    if (!customer) return NextResponse.json({ error: "Клієнта не знайдено" }, { status: 404 });

    const where: Prisma.ShopProductWhereInput = {
      isPublished: true,
      AND: words.map((word) => ({
        OR: [
          { sku: { contains: word, mode: "insensitive" } },
          { titleUa: { contains: word, mode: "insensitive" } },
          { titleEn: { contains: word, mode: "insensitive" } },
          { brand: { contains: word, mode: "insensitive" } },
          { vendor: { contains: word, mode: "insensitive" } },
        ],
      })),
    };
    const [settingsRecord, terms, matches] = await Promise.all([
      getOrCreateShopSettings(prisma),
      loadShopB2bCustomerPricingTerms(prisma, customer.id),
      prisma.shopProduct.findMany({
        where,
        take: MAX_RESULTS,
        orderBy: { updatedAt: "desc" },
        select: { slug: true },
      }),
    ]);
    const settings = getShopSettingsRuntime(settingsRecord);
    const context = await buildShopViewerPricingContextServer({
      prisma,
      settings,
      customerId: customer.id,
      customerGroup: customer.group,
      isAuthenticated: true,
      customerB2BDiscountPercent:
        customer.b2bDiscountPercent != null ? Number(customer.b2bDiscountPercent) : null,
      priceCountry: country,
    });

    // Same tiers as the storefront, kept apart so the manager sees which rule won
    // (the storefront folds the tariff group into the partner map).
    const ruleFor = createShopB2bTermsResolver(terms);
    const items = [];
    // Sequential on purpose: each lookup is a full product read.
    for (const { slug } of matches) {
      const product = await getShopProductBySlugServer(slug);
      if (!product) continue;
      const brand = product.brand || product.vendor || null;
      const pricing = resolveShopProductPricing(product, context);
      const rule = ruleFor(brand);
      const partnerPricing = pricing.audience === "b2b";
      items.push({
        slug: product.slug,
        title: product.title.ua || product.title.en || product.slug,
        sku: product.sku || null,
        brand,
        image: product.image ?? null,
        retail: pricing.bands.b2c.price,
        partner: pricing.effectivePrice,
        discountPercent: partnerPricing ? (pricing.discountPercent ?? 0) : 0,
        priceSource: pricing.source,
        rule: partnerPricing ? rule.source : "none",
      });
    }

    return NextResponse.json(
      { items, customerGroup: customer.group, tariffGroup: terms?.tariffGroup ?? null, country },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    const message = (error as Error).message;
    if (message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Admin B2B price check", error);
    return NextResponse.json({ error: "Перевірка не вдалася" }, { status: 500 });
  }
}

export const runtime = "nodejs";
