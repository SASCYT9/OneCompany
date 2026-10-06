import { NextRequest, NextResponse } from "next/server";
import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import {
  addItemToShopCart,
  SHOP_CART_COOKIE,
  serializeResolvedShopCart,
  resolveShopCart,
  replaceEntireShopCart,
  mergeShopCartItemInputs,
} from "@/lib/shopCart";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { buildShopViewerPricingContextServer } from "@/lib/shopPricingContext.server";
import { prisma } from "@/lib/prisma";
import { isLocalStorefrontMode } from "@/lib/localStorefront";
import {
  mergeLocalShopCartItems,
  replaceLocalShopCart,
  resolveLocalShopCart,
  serializeLocalShopCart,
} from "@/lib/shopLocalCart";

import { getShopProductBySlugServer } from "@/lib/shopCatalogServer";
import { isWheelForceWheel, WHEELFORCE_WHEEL_SET_SIZE } from "@/lib/wheelforceFamily";
import { requiresUrbanBodyKitQuote, URBAN_BODYKIT_QUOTE_ERROR } from "@/lib/shopProductPurchasePolicy";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const WHEELFORCE_SET_ERROR = "WheelForce wheels are sold in sets of four";

function setCartCookie(response: NextResponse, token: string) {
  response.cookies.set(SHOP_CART_COOKIE, token, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function POST(request: NextRequest) {
  let body: {
    slug?: string;
    quantity?: number;
    variantId?: string | null;
    currency?: string;
    locale?: string;
    country?: string;
    items?: any[];
  };
  try {
    body = (await request.json()) as any;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const finalSlug = String(body.slug ?? "").trim();

  try {
    const isBulk = Array.isArray(body.items);
    if (!isBulk && !finalSlug) {
      return NextResponse.json(
        { error: "slug is required to add an item to the cart" },
        { status: 400 }
      );
    }

    const itemsToAdd =
      isBulk && body.items
        ? body.items
            .map((item: any) => ({
              slug: String(item.slug ?? "").trim(),
              quantity: Number(item.quantity ?? 1),
              variantId: item.variantId ? String(item.variantId) : null,
            }))
            .filter((item: any) => item.slug)
        : [
            {
              slug: finalSlug,
              quantity: Number(body.quantity ?? 1),
              variantId: body.variantId ? String(body.variantId) : null,
            },
        ].filter((item) => item.slug);

    const requestedSlugs = [...new Set(itemsToAdd.map((item) => item.slug))];
    const wheelForceWheelSlugs = new Set<string>();
    if (isLocalStorefrontMode()) {
      const products = await Promise.all(requestedSlugs.map((slug) => getShopProductBySlugServer(slug)));
      for (const product of products) {
        if (product && requiresUrbanBodyKitQuote(product)) return NextResponse.json({ error: "This decal pack is sold only with a body kit. Request a package from the manager.", code: URBAN_BODYKIT_QUOTE_ERROR }, { status: 400 });
        if (product && isWheelForceWheel(product)) wheelForceWheelSlugs.add(product.slug);
      }
    } else if (requestedSlugs.length) {
      const products = await prisma.shopProduct.findMany({
        where: { slug: { in: requestedSlugs } },
        select: { slug: true, brand: true, tags: true, productType: true, sku: true },
      });
      for (const product of products) {
        if (requiresUrbanBodyKitQuote(product)) return NextResponse.json({ error: "This decal pack is sold only with a body kit. Request a package from the manager.", code: URBAN_BODYKIT_QUOTE_ERROR }, { status: 400 });
        if (isWheelForceWheel(product)) wheelForceWheelSlugs.add(product.slug);
      }
    }
    const invalidIncomingWheel = itemsToAdd.find((item) =>
      wheelForceWheelSlugs.has(item.slug) &&
      (!Number.isInteger(item.quantity) || item.quantity < WHEELFORCE_WHEEL_SET_SIZE || item.quantity % WHEELFORCE_WHEEL_SET_SIZE !== 0)
    );
    if (invalidIncomingWheel) {
      return NextResponse.json({ error: WHEELFORCE_SET_ERROR, code: "WHEELFORCE_SET_OF_FOUR_REQUIRED" }, { status: 400 });
    }

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
      const { cart } = resolveLocalShopCart({
        token: request.cookies.get(SHOP_CART_COOKIE)?.value,
        currency: body.currency ?? settings.defaultCurrency,
        locale: body.locale ?? session?.preferredLocale ?? "en",
      });
      const existingInputs = cart.items.map((item) => ({
        slug: item.slug,
        quantity: item.quantity,
        variantId: item.variantId,
      }));
      const mergedItems = mergeLocalShopCartItems(existingInputs, itemsToAdd);
      if (mergedItems.some((item) => wheelForceWheelSlugs.has(item.slug) && item.quantity % WHEELFORCE_WHEEL_SET_SIZE !== 0)) {
        return NextResponse.json({ error: WHEELFORCE_SET_ERROR, code: "WHEELFORCE_SET_OF_FOUR_REQUIRED" }, { status: 400 });
      }
      const { cart: refreshed, token } = replaceLocalShopCart(
        {
          token: cart.token,
          currency: body.currency ?? settings.defaultCurrency,
          locale: body.locale ?? session?.preferredLocale ?? "en",
        },
        mergedItems
      );
      const payload = await serializeLocalShopCart(refreshed, context);
      const response = NextResponse.json(payload);
      setCartCookie(response, token);
      return response;
    }

    const { cart, token } = await resolveShopCart(prisma, {
      cartToken: request.cookies.get(SHOP_CART_COOKIE)?.value,
      customerId: session?.customerId ?? null,
      currency: body.currency ?? settings.defaultCurrency,
      locale: body.locale ?? session?.preferredLocale ?? "en",
    });

    const existingInputs = cart.items.map((item) => ({
      slug: item.productSlug,
      quantity: item.quantity,
      variantId: item.variantId,
    }));

    const nextItems = mergeShopCartItemInputs(existingInputs, itemsToAdd);
    if (nextItems.some((item) => wheelForceWheelSlugs.has(item.slug) && item.quantity % WHEELFORCE_WHEEL_SET_SIZE !== 0)) {
      return NextResponse.json({ error: WHEELFORCE_SET_ERROR, code: "WHEELFORCE_SET_OF_FOUR_REQUIRED" }, { status: 400 });
    }

    const { cart: refreshed, token: finalToken } = await replaceEntireShopCart(prisma, {
      cartToken: token,
      customerId: session?.customerId ?? null,
      currency: body.currency ?? settings.defaultCurrency,
      locale: body.locale ?? session?.preferredLocale ?? "en",
      items: nextItems,
    });

    const payload = await serializeResolvedShopCart(refreshed, context);
    const response = NextResponse.json(payload);
    setCartCookie(response, finalToken);
    return response;
  } catch (error) {
    console.error("Shop cart item add", error);
    return NextResponse.json({ error: "Failed to add cart item" }, { status: 500 });
  }
}

export const runtime = "nodejs";
