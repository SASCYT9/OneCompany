import { NextRequest, NextResponse } from 'next/server';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { addItemToShopCart, SHOP_CART_COOKIE, serializeResolvedShopCart } from '@/lib/shopCart';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { prisma } from '@/lib/prisma';
import { buildShopViewerPricingContext } from '@/lib/shopPricingAudience';
import { ensureDefaultShopStores, normalizeShopStoreKey } from '@/lib/shopStores';
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

export async function POST(request: NextRequest) {
  let body: { slug?: string; quantity?: number; variantId?: string | null; currency?: string; locale?: string; storeKey?: string };
  try {
    body = (await request.json()) as { slug?: string; quantity?: number; variantId?: string | null; currency?: string; locale?: string; storeKey?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!String(body.slug ?? '').trim()) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  }

  try {
    await ensureDefaultShopStores(prisma);
    const storeKey = normalizeShopStoreKey(body.storeKey ?? request.nextUrl.searchParams.get('store'));
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
    const { cart, token } = await addItemToShopCart(prisma, {
      storeKey,
      cartToken: request.cookies.get(SHOP_CART_COOKIE)?.value,
      customerId: session?.customerId ?? null,
      currency: body.currency ?? settings.defaultCurrency,
      locale: body.locale ?? session?.preferredLocale ?? 'en',
      item: {
        slug: String(body.slug).trim(),
        quantity: Number(body.quantity ?? 1),
        variantId: body.variantId ? String(body.variantId) : null,
      },
    });

    const payload = await serializeResolvedShopCart(cart, context);
    const response = NextResponse.json(payload);
    setCartCookie(response, token);
    return response;
  } catch (error) {
    console.error('Shop cart item add', error);
    return NextResponse.json({ error: 'Failed to add cart item' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
