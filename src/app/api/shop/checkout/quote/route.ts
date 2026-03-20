import { NextRequest, NextResponse } from 'next/server';
import { buildCheckoutQuote, type CheckoutShippingAddress } from '@/lib/shopCheckout';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { resolveShopCart, SHOP_CART_COOKIE } from '@/lib/shopCart';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { prisma } from '@/lib/prisma';
import { ensureDefaultShopStores, normalizeShopStoreKey } from '@/lib/shopStores';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

type QuoteBody = {
  items?: Array<{ slug: string; quantity: number; variantId?: string | null }>;
  shipping?: Partial<CheckoutShippingAddress>;
  currency?: string;
  storeKey?: string;
  promoCode?: string;
};

function mapPromotionError(error: unknown) {
  switch ((error as Error).message) {
    case 'PROMOTION_NOT_FOUND':
      return 'Promo code not found';
    case 'PROMOTION_UNAVAILABLE':
      return 'Promo code is not active for this order';
    case 'PROMOTION_MINIMUM_NOT_MET':
      return 'Order subtotal does not meet promo minimum';
    case 'PROMOTION_NOT_APPLICABLE':
      return 'Promo code does not apply to these items';
    default:
      return null;
  }
}

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
  await ensureDefaultShopStores(prisma);
  const settingsRecord = await getOrCreateShopSettings(prisma);
  const settings = getShopSettingsRuntime(settingsRecord);
  const storeKey = normalizeShopStoreKey(body.storeKey ?? request.nextUrl.searchParams.get('store'));
  const activeCart = await resolveShopCart(prisma, {
    storeKey,
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
      discountAmount: 0,
      shippingCost: 0,
      taxAmount: 0,
      total: 0,
      itemCount: 0,
      items: [],
      promotion: null,
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
  let quote;
  try {
    quote = await buildCheckoutQuote(prisma, {
      storeKey,
      items,
      shippingAddress,
      currency: body.currency,
      customerGroup: session?.group ?? null,
      customerId: session?.customerId ?? null,
      customerB2BDiscountPercent: session?.b2bDiscountPercent ?? null,
      promoCode: body.promoCode ?? null,
    });
  } catch (error) {
    const promotionError = mapPromotionError(error);
    if (promotionError) {
      return NextResponse.json({ error: promotionError }, { status: 400 });
    }
    throw error;
  }

  const response = NextResponse.json({
    currency: quote.currency,
    pricingAudience: quote.pricingAudience,
    subtotal: quote.subtotal,
    discountAmount: quote.discountAmount,
    shippingCost: quote.shippingCost,
    taxAmount: quote.taxAmount,
    total: quote.total,
    itemCount: quote.itemCount,
    items: quote.items,
    promotion: quote.promotion,
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
