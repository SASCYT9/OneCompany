/**
 * POST /api/shop/checkout
 * Body: { items, contact, shipping, currency, locale?, paymentMethod?: 'FOP'|'STRIPE'|'WHITEBIT' }
 * FOP: creates order PENDING_REVIEW, sends email, returns { orderNumber, viewToken }.
 * STRIPE: creates order PENDING_PAYMENT, returns { redirectUrl, orderNumber, viewToken }; webhook confirms and sends email.
 * WHITEBIT: for now same as FOP (coming later).
 */

import { NextRequest, NextResponse } from 'next/server';
import { render } from '@react-email/render';
import { Resend } from 'resend';
import { generateOrderNumber, generateViewToken } from '@/lib/shopOrder';
import { createInitialOrderEvent } from '@/lib/shopAdminOrders';
import { buildCheckoutQuote } from '@/lib/shopCheckout';
import OrderConfirmationEmail from '@/components/emails/OrderConfirmationEmail';
import { notifyAdminNewShopOrder } from '@/lib/telegramNotifications';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { clearShopCart, resolveShopCart, SHOP_CART_COOKIE } from '@/lib/shopCart';
import { upsertCustomerDefaultShippingAddress } from '@/lib/shopCustomers';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { prisma } from '@/lib/prisma';
import {
  createStripeCheckoutSession,
  stripeSupportedCurrency,
} from '@/lib/shopStripe';
import { ensureDefaultShopStores, normalizeShopStoreKey } from '@/lib/shopStores';
const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const CURRENCIES = ['EUR', 'USD', 'UAH'] as const;

const PAYMENT_METHODS = ['FOP', 'STRIPE', 'WHITEBIT'] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

function normalizePaymentMethod(value: unknown, settings: { stripeEnabled: boolean }): PaymentMethod {
  const v = String(value ?? 'FOP').trim().toUpperCase();
  if (v === 'STRIPE' && !settings.stripeEnabled) return 'FOP';
  if (v === 'WHITEBIT') return 'FOP'; // not implemented yet
  return PAYMENT_METHODS.includes(v as PaymentMethod) ? (v as PaymentMethod) : 'FOP';
}

type CheckoutBody = {
  items?: Array<{ slug: string; quantity: number; variantId?: string | null }>;
  contact?: { email?: string; name?: string; phone?: string };
  shipping?: {
    line1?: string;
    line2?: string;
    city?: string;
    region?: string;
    postcode?: string;
    country?: string;
  };
  currency?: string;
  locale?: string;
  paymentMethod?: string;
  storeKey?: string;
};
export async function POST(req: NextRequest) {
  let body: CheckoutBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const session = await getCurrentShopCustomerSession();
  await ensureDefaultShopStores(prisma);
  const settingsRecord = await getOrCreateShopSettings(prisma);
  const settings = getShopSettingsRuntime(settingsRecord);
  const storeKey = normalizeShopStoreKey(body.storeKey ?? req.nextUrl.searchParams.get('store'));
  const activeCart = await resolveShopCart(prisma, {
    storeKey,
    cartToken: req.cookies.get(SHOP_CART_COOKIE)?.value,
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
  if (items.length === 0) {
    return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
  }

  const email = typeof body.contact?.email === 'string' ? body.contact.email.trim() : '';
  const name = typeof body.contact?.name === 'string' ? body.contact.name.trim() : '';
  if (!email || !name) {
    return NextResponse.json({ error: 'Email and name are required' }, { status: 400 });
  }

  const shipping = body.shipping ?? {};
  const line1 = typeof shipping.line1 === 'string' ? shipping.line1.trim() : '';
  const city = typeof shipping.city === 'string' ? shipping.city.trim() : '';
  const country = typeof shipping.country === 'string' ? shipping.country.trim() : '';
  if (!line1 || !city || !country) {
    return NextResponse.json({ error: 'Shipping address (line1, city, country) is required' }, { status: 400 });
  }

  const quote = await buildCheckoutQuote(prisma, {
    storeKey,
    items,
    shippingAddress: {
      line1,
      line2: typeof shipping.line2 === 'string' ? shipping.line2.trim() : undefined,
      city,
      region: typeof shipping.region === 'string' ? shipping.region.trim() : undefined,
      postcode: typeof shipping.postcode === 'string' ? shipping.postcode.trim() : undefined,
      country,
    },
    currency: CURRENCIES.includes((body.currency ?? 'EUR') as (typeof CURRENCIES)[number])
      ? (body.currency ?? 'EUR')
      : 'EUR',
    customerGroup: session?.group ?? null,
    customerId: session?.customerId ?? null,
    customerB2BDiscountPercent: session?.b2bDiscountPercent ?? null,
  });

  if (quote.items.length === 0) {
    return NextResponse.json({ error: 'No valid items in cart' }, { status: 400 });
  }

  const paymentMethod = normalizePaymentMethod(body.paymentMethod, {
    stripeEnabled: settings.stripeEnabled,
  });

  const orderNumber = await generateOrderNumber();
  const viewToken = generateViewToken();
  const locale = (body.locale === 'ua' ? 'ua' : 'en') as 'ua' | 'en';

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://onecompany.global');

  const shippingAddress = {
    line1,
    line2: typeof shipping.line2 === 'string' ? shipping.line2.trim() : undefined,
    city,
    region: typeof shipping.region === 'string' ? shipping.region.trim() : undefined,
    postcode: typeof shipping.postcode === 'string' ? shipping.postcode.trim() : undefined,
    country,
  };

  const orderData = {
    storeKey,
    orderNumber,
    status: paymentMethod === 'STRIPE' ? ('PENDING_PAYMENT' as const) : ('PENDING_REVIEW' as const),
    paymentMethod: paymentMethod === 'STRIPE' ? 'STRIPE' : paymentMethod === 'WHITEBIT' ? 'WHITEBIT' : 'FOP',
    customerId: session?.customerId ?? null,
    customerGroupSnapshot: session?.group ?? 'B2C',
    email,
    customerName: name,
    phone: typeof body.contact?.phone === 'string' ? body.contact.phone.trim() || null : null,
    shippingAddress,
    currency: quote.currency,
    subtotal: quote.subtotal,
    shippingCost: quote.shippingCost,
    taxAmount: quote.taxAmount,
    total: quote.total,
    pricingSnapshot: quote.pricingSnapshot,
    viewToken,
    items: {
      create: quote.items.map((i) => ({
        productSlug: i.productSlug,
        productId: i.productId,
        variantId: i.variantId,
        title: i.title,
        quantity: i.quantity,
        price: i.unitPrice,
        total: i.total,
        image: i.image,
      })),
    },
  };

  if (paymentMethod === 'STRIPE') {
    const stripeCurrency = stripeSupportedCurrency(quote.currency);
    if (!stripeCurrency) {
      return NextResponse.json(
        { error: 'Stripe supports only EUR or USD for this order. Use FOP or change currency.' },
        { status: 400 }
      );
    }
    const amountTotalCents = Math.round(Number(quote.total) * 100);
    if (amountTotalCents < 50) {
      return NextResponse.json({ error: 'Minimum amount for card payment is 0.50' }, { status: 400 });
    }

    const order = await prisma.shopOrder.create({
      data: orderData,
    });
    await createInitialOrderEvent(prisma, order.id, order.status);
    if (session?.customerId) {
      await upsertCustomerDefaultShippingAddress(prisma, session.customerId, shippingAddress);
    }

    const sessionResult = await createStripeCheckoutSession({
      orderId: order.id,
      orderNumber,
      amountTotalCents,
      currency: stripeCurrency,
      customerEmail: email,
      successUrl: `${baseUrl}/${locale}/shop/checkout/success?order=${encodeURIComponent(orderNumber)}&token=${encodeURIComponent(viewToken)}`,
      cancelUrl: `${baseUrl}/${locale}/shop/checkout`,
      locale,
    });

    if ('error' in sessionResult) {
      await prisma.shopOrder.update({
        where: { id: order.id },
        data: { status: 'CANCELLED' },
      });
      return NextResponse.json({ error: sessionResult.error }, { status: 502 });
    }

    await prisma.shopOrder.update({
      where: { id: order.id },
      data: { stripeCheckoutSessionId: sessionResult.sessionId },
    });

    await clearShopCart(prisma, {
      storeKey,
      cartToken: activeCart.token,
      customerId: session?.customerId ?? null,
      locale: session?.preferredLocale ?? 'en',
      currency: quote.currency,
    });

    const response = NextResponse.json({
      redirectUrl: sessionResult.url,
      orderNumber,
      viewToken,
      subtotal: quote.subtotal,
      shippingCost: quote.shippingCost,
      taxAmount: quote.taxAmount,
      total: quote.total,
      currency: quote.currency,
      paymentMethod: 'STRIPE',
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

  const order = await prisma.shopOrder.create({
    data: orderData,
  });

  await createInitialOrderEvent(prisma, order.id, order.status);
  if (session?.customerId) {
    await upsertCustomerDefaultShippingAddress(prisma, session.customerId, shippingAddress);
  }
  await clearShopCart(prisma, {
    storeKey,
    cartToken: activeCart.token,
    customerId: session?.customerId ?? null,
    locale: session?.preferredLocale ?? 'en',
    currency: quote.currency,
  });

  const viewOrderUrl = `${baseUrl}/${locale}/shop/checkout/success?order=${encodeURIComponent(orderNumber)}&token=${encodeURIComponent(viewToken)}`;

  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    try {
      const emailHtml = await render(
        OrderConfirmationEmail({
          orderNumber,
          customerName: name,
          email,
          currency: quote.currency,
          subtotal: quote.subtotal,
          shippingCost: quote.shippingCost,
          taxAmount: quote.taxAmount,
          total: quote.total,
          locale,
          viewOrderUrl,
          items: quote.items.map((i) => ({ title: i.title, quantity: i.quantity, total: i.total })),
        })
      );
      await resend.emails.send({
        from: `One Company Shop <${process.env.EMAIL_FROM}>`,
        to: [email],
        subject: locale === 'ua' ? `Замовлення ${orderNumber} прийнято` : `Order ${orderNumber} confirmed`,
        html: emailHtml,
      });
    } catch (err) {
      console.error('Order confirmation email failed (order already created):', err);
    }
  }

  try {
    await notifyAdminNewShopOrder({
      orderNumber,
      customerName: name,
      email,
      currency: quote.currency,
      total: quote.total,
      itemCount: quote.items.reduce((s, i) => s + i.quantity, 0),
    });
  } catch (err) {
    console.error('Admin shop order notification failed (non-blocking):', err);
  }

  const response = NextResponse.json({
    orderNumber,
    viewToken,
    subtotal: quote.subtotal,
    shippingCost: quote.shippingCost,
    taxAmount: quote.taxAmount,
    total: quote.total,
    currency: quote.currency,
    pricingAudience: quote.pricingAudience,
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
