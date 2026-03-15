import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { buildCheckoutQuote, type CheckoutShippingAddress } from '@/lib/shopCheckout';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { resolveShopCart, SHOP_CART_COOKIE } from '@/lib/shopCart';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';

const prisma = new PrismaClient();
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

type QuoteBody = {
  items?: Array<{ slug: string; quantity: number; variantId?: string | null }>;
  shipping?: Partial<CheckoutShippingAddress>;
  currency?: string;
};

function normalizeShippingAddress(input: Partial<CheckoutShippingAddress> | undefined): CheckoutShippingAddress {
  return {
    line1: String(input?.line1 ?? '').trim(),
    line2: String(input?.line2 ?? '').trim() || undefined,
    city: String(input?.city ?? '').trim(),
    region: String(input?.region ?? '').trim() || undefined,
    postcode: String(input?.postcode ?? '').trim() || undefined,
    country: String(input?.country ?? '').trim(),
  };
}

export async function POST(request: NextRequest) {
  let body: QuoteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const session = await getCurrentShopCustomerSession();
  const settingsRecord = await getOrCreateShopSettings(prisma);
  const settings = getShopSettingsRuntime(settingsRecord);
  const activeCart = await resolveShopCart(prisma, {
    cartToken: request.cookies.get(SHOP_CART_COOKIE)?.value,
    customerId: session?.customerId ?? null,
    locale: session?.preferredLocale ?? 'en',
    currency: body.currency ?? settings.defaultCurrency,
  });
  const requestItems = Array.isArray(body.items) ? body.items : [];
  const items =
    session?.customerId
      ? activeCart.cart.items.map((item) => ({
          slug: item.productSlug,
          quantity: item.quantity,
          variantId: item.variantId,
        }))
      : requestItems.length
        ? requestItems
        : activeCart.cart.items.map((item) => ({
            slug: item.productSlug,
            quantity: item.quantity,
            variantId: item.variantId,
          }));
  if (!items.length) {
    const response = NextResponse.json({
      currency: String(body.currency ?? 'EUR').toUpperCase(),
      pricingAudience: session?.group === 'B2B_APPROVED' ? 'b2b' : 'b2c',
      subtotal: 0,
      shippingCost: 0,
      taxAmount: 0,
      total: 0,
      itemCount: 0,
      items: [],
      shippingZone: null,
      taxRegion: null,
    });
    response.cookies.set(SHOP_CART_COOKIE, activeCart.token, {
      path: '/',
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    return response;
  }

  const shippingAddress = normalizeShippingAddress(body.shipping);
  const quote = await buildCheckoutQuote(prisma, {
    items,
    shippingAddress,
    currency: body.currency,
    customerGroup: session?.group ?? null,
    customerId: session?.customerId ?? null,
    customerB2BDiscountPercent: session?.b2bDiscountPercent ?? null,
  });

  const response = NextResponse.json({
    currency: quote.currency,
    pricingAudience: quote.pricingAudience,
    subtotal: quote.subtotal,
    shippingCost: quote.shippingCost,
    taxAmount: quote.taxAmount,
    total: quote.total,
    itemCount: quote.itemCount,
    items: quote.items,
    shippingZone: quote.shippingZone,
    taxRegion: quote.taxRegion,
  });
  response.cookies.set(SHOP_CART_COOKIE, activeCart.token, {
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}
