import { NextRequest, NextResponse } from "next/server";
import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import {
  SHOP_CART_COOKIE,
  emptyShopCartPayload,
  replaceEntireShopCart,
  resolveShopCart,
  serializeResolvedShopCart,
  setShopCartCookies,
} from "@/lib/shopCart";
import { getPublicShopSettingsRuntime } from "@/lib/shopPublicSettings";
import { buildShopViewerPricingContextServer } from "@/lib/shopPricingContext.server";
import { prisma } from "@/lib/prisma";
import { isLocalStorefrontMode } from "@/lib/localStorefront";
import {
  replaceLocalShopCart,
  resolveLocalShopCart,
  serializeLocalShopCart,
} from "@/lib/shopLocalCart";

export async function GET(request: NextRequest) {
  try {
    const [session, settings] = await Promise.all([
      getCurrentShopCustomerSession(),
      getPublicShopSettingsRuntime(),
    ]);
    const cartToken = request.cookies.get(SHOP_CART_COOKIE)?.value;
    if (!isLocalStorefrontMode() && !cartToken && !session?.customerId) {
      const response = NextResponse.json(
        emptyShopCartPayload(settings.defaultCurrency, session?.preferredLocale ?? "en")
      );
      setShopCartCookies(response, null, 0);
      return response;
    }
    const country = request.nextUrl.searchParams.get("country");
    const context = await buildShopViewerPricingContextServer({
      prisma,
      settings,
      customerId: session?.customerId,
      customerGroup: session?.group,
      isAuthenticated: Boolean(session),
      customerB2BDiscountPercent: session?.b2bDiscountPercent,
      priceCountry: country,
    });
    if (isLocalStorefrontMode()) {
      const { cart, token } = resolveLocalShopCart({
        token: cartToken,
        currency: settings.defaultCurrency,
        locale: session?.preferredLocale ?? "en",
      });
      const payload = await serializeLocalShopCart(cart, context);
      const response = NextResponse.json(payload);
      setShopCartCookies(response, token, payload.totalItems);
      return response;
    }
    const { cart, token } = await resolveShopCart(prisma, {
      cartToken,
      customerId: session?.customerId ?? null,
      locale: session?.preferredLocale ?? "en",
      currency: settings.defaultCurrency,
    });
    const payload = await serializeResolvedShopCart(cart, context);
    const response = NextResponse.json(payload);
    setShopCartCookies(response, token, payload.totalItems);
    return response;
  } catch (error) {
    console.error("Shop cart get", error);
    return NextResponse.json({ error: "Failed to load cart" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: {
    items?: Array<{ slug: string; quantity: number; variantId?: string | null }>;
    currency?: string;
    locale?: string;
    country?: string;
  };
  try {
    body = (await request.json()) as {
      items?: Array<{ slug: string; quantity: number; variantId?: string | null }>;
      currency?: string;
      locale?: string;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const [session, settings] = await Promise.all([
      getCurrentShopCustomerSession(),
      getPublicShopSettingsRuntime(),
    ]);
    const country =
      String(body.country ?? request.nextUrl.searchParams.get("country") ?? "").trim() || null;
    const context = await buildShopViewerPricingContextServer({
      prisma,
      settings,
      customerId: session?.customerId,
      customerGroup: session?.group,
      isAuthenticated: Boolean(session),
      customerB2BDiscountPercent: session?.b2bDiscountPercent,
      priceCountry: country,
    });
    if (isLocalStorefrontMode()) {
      const { cart, token } = replaceLocalShopCart(
        {
          token: request.cookies.get(SHOP_CART_COOKIE)?.value,
          currency: body.currency ?? settings.defaultCurrency,
          locale: body.locale ?? session?.preferredLocale ?? "en",
        },
        Array.isArray(body.items)
          ? body.items.map((item) => ({
              slug: String(item.slug ?? "").trim(),
              quantity: Number(item.quantity ?? 1),
              variantId: item.variantId ? String(item.variantId) : null,
            }))
          : []
      );
      const payload = await serializeLocalShopCart(cart, context);
      const response = NextResponse.json(payload);
      setShopCartCookies(response, token, payload.totalItems);
      return response;
    }
    const { cart, token } = await replaceEntireShopCart(prisma, {
      cartToken: request.cookies.get(SHOP_CART_COOKIE)?.value,
      customerId: session?.customerId ?? null,
      currency: body.currency ?? settings.defaultCurrency,
      locale: body.locale ?? session?.preferredLocale ?? "en",
      items: Array.isArray(body.items) ? body.items : [],
    });
    const payload = await serializeResolvedShopCart(cart, context);
    const response = NextResponse.json(payload);
    setShopCartCookies(response, token, payload.totalItems);
    return response;
  } catch (error) {
    console.error("Shop cart replace", error);
    return NextResponse.json({ error: "Failed to update cart" }, { status: 500 });
  }
}

export const runtime = "nodejs";
