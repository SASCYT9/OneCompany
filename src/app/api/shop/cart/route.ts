import { NextRequest, NextResponse } from 'next/server';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { SHOP_CART_COOKIE, replaceEntireShopCart, resolveShopCart, serializeResolvedShopCart } from '@/lib/shopCart';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { buildShopViewerPricingContext } from '@/lib/shopPricingAudience';
import { prisma } from '@/lib/prisma';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function setCartCookie(response: NextResponse, token: string) {
  response.cookies.set(SHOP_CART_COOKIE, token, {
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function GET(request: NextRequest) {
  try {
    const [session, settingsRecord] = await Promise.all([
      getCurrentShopCustomerSession(),
      getOrCreateShopSettings(prisma),
    ]);
    const settings = getShopSettingsRuntime(settingsRecord);
    const context = buildShopViewerPricingContext(
      settings,
      session?.group ?? null,
      Boolean(session),
      session?.b2bDiscountPercent ?? null
    );
    const { cart, token } = await resolveShopCart(prisma, {
      cartToken: request.cookies.get(SHOP_CART_COOKIE)?.value,
      customerId: session?.customerId ?? null,
      locale: session?.preferredLocale ?? 'en',
      currency: settings.defaultCurrency,
    });
    const payload = await serializeResolvedShopCart(cart, context);
    const response = NextResponse.json(payload);
    setCartCookie(response, token);
    return response;
  } catch (error) {
    console.error('Shop cart get', error);
    return NextResponse.json({ error: 'Failed to load cart' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: { items?: Array<{ slug: string; quantity: number; variantId?: string | null }>; currency?: string; locale?: string };
  try {
    body = (await request.json()) as { items?: Array<{ slug: string; quantity: number; variantId?: string | null }>; currency?: string; locale?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const [session, settingsRecord] = await Promise.all([
      getCurrentShopCustomerSession(),
      getOrCreateShopSettings(prisma),
    ]);
    const settings = getShopSettingsRuntime(settingsRecord);
    const context = buildShopViewerPricingContext(
      settings,
      session?.group ?? null,
      Boolean(session),
      session?.b2bDiscountPercent ?? null
    );
    const { cart, token } = await replaceEntireShopCart(prisma, {
      cartToken: request.cookies.get(SHOP_CART_COOKIE)?.value,
      customerId: session?.customerId ?? null,
      currency: body.currency ?? settings.defaultCurrency,
      locale: body.locale ?? session?.preferredLocale ?? 'en',
      items: Array.isArray(body.items) ? body.items : [],
    });
    const payload = await serializeResolvedShopCart(cart, context);
    const response = NextResponse.json(payload);
    setCartCookie(response, token);
    return response;
  } catch (error) {
    console.error('Shop cart replace', error);
    return NextResponse.json({ error: 'Failed to update cart' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
