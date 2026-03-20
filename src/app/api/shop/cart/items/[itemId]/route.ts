import { NextRequest, NextResponse } from 'next/server';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { deleteShopCartItem, SHOP_CART_COOKIE, serializeResolvedShopCart, updateShopCartItemQuantity } from '@/lib/shopCart';
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

async function loadPricingContext() {
  const [session, settingsRecord] = await Promise.all([
    getCurrentShopCustomerSession(),
    getOrCreateShopSettings(prisma),
  ]);
  const settings = getShopSettingsRuntime(settingsRecord);
  return {
    session,
    settings,
    context: buildShopViewerPricingContext(
      settings,
      session?.group ?? null,
      Boolean(session),
      session?.b2bDiscountPercent ?? null
    ),
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  let body: { quantity?: number; currency?: string; locale?: string; storeKey?: string };
  try {
    body = (await request.json()) as { quantity?: number; currency?: string; locale?: string; storeKey?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const quantity = Number(body.quantity ?? 0);
  if (!Number.isFinite(quantity)) {
    return NextResponse.json({ error: 'quantity is required' }, { status: 400 });
  }

  const { itemId } = await params;

  try {
    await ensureDefaultShopStores(prisma);
    const storeKey = normalizeShopStoreKey(body.storeKey ?? request.nextUrl.searchParams.get('store'));
    const { session, settings, context } = await loadPricingContext();
    const { cart, token } = await updateShopCartItemQuantity(prisma, {
      storeKey,
      cartToken: request.cookies.get(SHOP_CART_COOKIE)?.value,
      customerId: session?.customerId ?? null,
      currency: body.currency ?? settings.defaultCurrency,
      locale: body.locale ?? session?.preferredLocale ?? 'en',
      itemId,
      quantity,
    });
    const payload = await serializeResolvedShopCart(cart, context);
    const response = NextResponse.json(payload);
    setCartCookie(response, token);
    return response;
  } catch (error) {
    if ((error as Error).message === 'CART_ITEM_NOT_FOUND') {
      return NextResponse.json({ error: 'Cart item not found' }, { status: 404 });
    }
    console.error('Shop cart item patch', error);
    return NextResponse.json({ error: 'Failed to update cart item' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  try {
    await ensureDefaultShopStores(prisma);
    const storeKey = normalizeShopStoreKey(request.nextUrl.searchParams.get('store'));
    const { session, settings, context } = await loadPricingContext();
    const { cart, token } = await deleteShopCartItem(prisma, {
      storeKey,
      cartToken: request.cookies.get(SHOP_CART_COOKIE)?.value,
      customerId: session?.customerId ?? null,
      currency: settings.defaultCurrency,
      locale: session?.preferredLocale ?? 'en',
      itemId,
    });
    const payload = await serializeResolvedShopCart(cart, context);
    const response = NextResponse.json(payload);
    setCartCookie(response, token);
    return response;
  } catch (error) {
    console.error('Shop cart item delete', error);
    return NextResponse.json({ error: 'Failed to delete cart item' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
