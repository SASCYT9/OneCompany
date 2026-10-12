import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/adminRbac";
import { prisma } from "@/lib/prisma";
import { customerMoney } from "@/lib/admin/productPriceEditor";
import { DEFAULT_CURRENCY_RATES, normalizeShopCurrencyRates } from "@/lib/shopAdminSettings";

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

/**
 * GET /api/admin/shop/orders/catalog-search?q=&currency=UAH — catalog variants to add
 * to an order, priced the way the storefront prices them today.
 */
export async function GET(request: NextRequest) {
  try {
    await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);
    const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 120) ?? "";
    const currency = (request.nextUrl.searchParams.get("currency") ?? "UAH").toUpperCase();
    const words = query.split(/\s+/).filter((word) => word.length > 1).slice(0, 5);
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
    const [settings, variants] = await Promise.all([
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
              image: true,
              isPublished: true,
              ...PRICE_FIELDS,
            },
          },
        },
      }),
    ]);
    const rates = normalizeShopCurrencyRates(settings?.currencyRates ?? DEFAULT_CURRENCY_RATES);

    const items = variants.map((variant) => {
      const product = variant.product;
      const ownPrice = customerMoney(variant, "price", rates);
      const variantTitle =
        variant.title && !/^default( title)?$/i.test(variant.title.trim()) ? variant.title : null;
      return {
        variantId: variant.id,
        productId: product.id,
        productSlug: product.slug,
        title: [product.titleUa || product.titleEn, variantTitle].filter(Boolean).join(" — "),
        brand: product.brand,
        sku: variant.sku,
        image: variant.image || product.image,
        published: product.isPublished,
        price: priceIn(ownPrice ?? customerMoney(product, "price", rates), currency),
        b2bPrice: priceIn(
          customerMoney(variant, "b2bPrice", rates) ?? customerMoney(product, "b2bPrice", rates),
          currency
        ),
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
