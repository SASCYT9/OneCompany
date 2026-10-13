import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/adminRbac";
import { prisma } from "@/lib/prisma";
import { customerMoney } from "@/lib/admin/productPriceEditor";
import { DEFAULT_CURRENCY_RATES, normalizeShopCurrencyRates } from "@/lib/shopAdminSettings";
import { loadShopB2bCustomerPricingTerms } from "@/lib/shopB2bAdmin.server";
import { createShopB2bTermsResolver } from "@/lib/shopB2bBrandDiscounts";
import { resolveShopProductBrand } from "@/lib/shopProductBrand";

const PRICE_FIELDS = {
  priceSourceCurrency: true,
  priceEur: true,
  priceUsd: true,
  priceUah: true,
  b2bPriceSourceCurrency: true,
  priceEurB2b: true,
  priceUsdB2b: true,
  priceUahB2b: true,
} as const;

function priceIn(money: { eur: number; usd: number; uah: number } | null, currency: string) {
  if (!money) return null;
  const value = currency === "EUR" ? money.eur : currency === "USD" ? money.usd : money.uah;
  return value > 0 ? Math.round(value * 100) / 100 : null;
}

function discounted(money: { eur: number; usd: number; uah: number } | null, percent: number) {
  if (!money || !(percent > 0)) return null;
  const factor = 1 - Math.min(percent, 100) / 100;
  const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  return {
    eur: round(money.eur * factor),
    usd: round(money.usd * factor),
    uah: round(money.uah * factor),
  };
}

/**
 * GET /api/admin/shop/orders/catalog-search?q=&currency=UAH&customerId= — catalog
 * variants to add to an order, priced the way the storefront prices them today.
 * With an approved partner's `customerId`, `b2bPrice` is that partner's price:
 * the product's own wholesale price, else retail minus their brand discount.
 */
export async function GET(request: NextRequest) {
  try {
    await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);
    const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 120) ?? "";
    const currency = (request.nextUrl.searchParams.get("currency") ?? "UAH").toUpperCase();
    const customerId = request.nextUrl.searchParams.get("customerId")?.trim() || null;
    const words = query
      .split(/\s+/)
      .filter((word) => word.length > 1)
      .slice(0, 5);
    if (!words.length) return NextResponse.json({ items: [] });

    const where: Prisma.ShopProductVariantWhereInput = {
      AND: words.map((word) => ({
        OR: [
          { sku: { contains: word, mode: "insensitive" } },
          { title: { contains: word, mode: "insensitive" } },
          { product: { titleUa: { contains: word, mode: "insensitive" } } },
          { product: { titleEn: { contains: word, mode: "insensitive" } } },
          { product: { brand: { contains: word, mode: "insensitive" } } },
        ],
      })),
    };
    const [settings, variants, terms] = await Promise.all([
      prisma.shopSettings.findUnique({ where: { key: "shop" }, select: { currencyRates: true } }),
      prisma.shopProductVariant.findMany({
        where,
        take: 15,
        orderBy: [{ product: { isPublished: "desc" } }, { position: "asc" }],
        select: {
          id: true,
          title: true,
          sku: true,
          image: true,
          isDefault: true,
          ...PRICE_FIELDS,
          product: {
            select: {
              id: true,
              slug: true,
              titleUa: true,
              titleEn: true,
              brand: true,
              vendor: true,
              tags: true,
              image: true,
              isPublished: true,
              ...PRICE_FIELDS,
            },
          },
        },
      }),
      customerId ? loadShopB2bCustomerPricingTerms(prisma, customerId) : Promise.resolve(null),
    ]);
    const rates = normalizeShopCurrencyRates(settings?.currencyRates ?? DEFAULT_CURRENCY_RATES);
    const partnerTerms = terms?.group === "B2B_APPROVED" ? terms : null;
    const discountFor = createShopB2bTermsResolver(partnerTerms);

    const items = variants.map((variant) => {
      const product = variant.product;
      const ownPrice = customerMoney(variant, "price", rates);
      const retail = ownPrice ?? customerMoney(product, "price", rates);
      const brand = resolveShopProductBrand(product) || null;
      const explicitB2b =
        customerMoney(variant, "b2bPrice", rates) ?? customerMoney(product, "b2bPrice", rates);
      const discountPercent = partnerTerms && !explicitB2b ? discountFor(brand).percent : 0;
      const variantTitle =
        variant.title && !/^default( title)?$/i.test(variant.title.trim()) ? variant.title : null;
      return {
        variantId: variant.id,
        productId: product.id,
        productSlug: product.slug,
        title: [product.titleUa || product.titleEn, variantTitle].filter(Boolean).join(" — "),
        brand,
        sku: variant.sku,
        image: variant.image || product.image,
        published: product.isPublished,
        price: priceIn(retail, currency),
        b2bPrice: priceIn(explicitB2b ?? discounted(retail, discountPercent), currency),
        discountPercent,
      };
    });
    return NextResponse.json({ items, currency });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((error as Error).message === "FORBIDDEN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Admin order catalog search", error);
    return NextResponse.json({ error: "Пошук не вдався. Спробуйте ще раз." }, { status: 500 });
  }
}

export const runtime = "nodejs";
