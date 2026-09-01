import { NextRequest, NextResponse } from "next/server";
import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import {
  SHOP_CART_COOKIE,
  replaceEntireShopCart,
  resolveShopCart,
  serializeResolvedShopCart,
} from "@/lib/shopCart";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { buildShopViewerPricingContextServer } from "@/lib/shopPricingContext.server";
import { prisma } from "@/lib/prisma";
import { isLocalStorefrontMode } from "@/lib/localStorefront";
import {
  replaceLocalShopCart,
  resolveLocalShopCart,
  serializeLocalShopCart,
} from "@/lib/shopLocalCart";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function setCartCookie(response: NextResponse, token: string) {
  response.cookies.set(SHOP_CART_COOKIE, token, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function GET(request: NextRequest) {
  try {
    const [session, settingsRecord] = await Promise.all([
      getCurrentShopCustomerSession(),
      getOrCreateShopSettings(prisma),
    ]);
    const settings = getShopSettingsRuntime(settingsRecord);
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
        token: request.cookies.get(SHOP_CART_COOKIE)?.value,
        currency: settings.defaultCurrency,
        locale: session?.preferredLocale ?? "en",
      });
      const payload = await serializeLocalShopCart(cart, context);
      const response = NextResponse.json(payload);
      setCartCookie(response, token);
      return response;
    }
    const { cart, token } = await resolveShopCart(prisma, {
      cartToken: request.cookies.get(SHOP_CART_COOKIE)?.value,
      customerId: session?.customerId ?? null,
      locale: session?.preferredLocale ?? "en",
      currency: settings.defaultCurrency,
    });
    const payload = await serializeResolvedShopCart(cart, context);
    const response = NextResponse.json(payload);
    setCartCookie(response, token);
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
    const [session, settingsRecord] = await Promise.all([
      getCurrentShopCustomerSession(),
      getOrCreateShopSettings(prisma),
    ]);
    const settings = getShopSettingsRuntime(settingsRecord);
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
      setCartCookie(response, token);
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
    setCartCookie(response, token);
    return response;
  } catch (error) {
    console.error("Shop cart replace", error);
    return NextResponse.json({ error: "Failed to update cart" }, { status: 500 });
  }
}

export const runtime = "nodejs";
