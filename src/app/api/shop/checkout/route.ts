/**
 * POST /api/shop/checkout
 * Body: { items, contact, shipping, currency, locale?, paymentMethod?: 'FOP'|'WHITEBIT'|'WHITEPAY_FIAT' }
 * FOP: creates order PENDING_REVIEW, sends email, returns { orderNumber, viewToken }.
 * WHITEBIT: creates order PENDING_PAYMENT, redirects to WhiteBIT Crypto Pay; webhook confirms.
 * WHITEPAY_FIAT: creates order PENDING_PAYMENT, redirects to WhiteBIT Card Pay; webhook confirms.
 */

import { NextRequest, NextResponse } from "next/server";
import type { ShopOrder } from "@prisma/client";
import { render } from "@react-email/render";
import { Resend } from "resend";
import { generateOrderNumber, generateViewToken } from "@/lib/shopOrder";
import { createInitialOrderEvent } from "@/lib/shopAdminOrders";
import { buildCheckoutQuote } from "@/lib/shopCheckout";
import { dispatchCrmWebhook } from "@/lib/webhookDispatcher";
import OrderConfirmationEmail from "@/components/emails/OrderConfirmationEmail";
import { notifyAdminNewShopOrder } from "@/lib/telegramNotifications";
import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import { clearShopCart, resolveShopCart, SHOP_CART_COOKIE } from "@/lib/shopCart";
import { upsertCustomerDefaultShippingAddress } from "@/lib/shopCustomers";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";

import { createWhitepayCryptoOrder, createWhitepayFiatOrder } from "@/lib/shopWhitepay";
import { prisma } from "@/lib/prisma";
import {
  isMonobankEnabled,
  monobankCheckoutKey,
  monobankMinorUnits,
  monobankRequestHash,
  MonobankError,
} from "@/lib/shopMonobank";
import { prepareMonobankPayment } from "@/lib/shopMonobankPayments";

const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const CURRENCIES = ["EUR", "USD", "UAH"] as const;

const PAYMENT_METHODS = ["FOP", "WHITEBIT", "WHITEPAY_FIAT", "MONOBANK"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

function normalizePaymentMethod(value: unknown): PaymentMethod {
  const v = String(value ?? "FOP")
    .trim()
    .toUpperCase();
  return PAYMENT_METHODS.includes(v as PaymentMethod) ? (v as PaymentMethod) : "FOP";
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
  checkoutKey?: string;
  expectedAmount?: number;
};

async function monobankCheckoutResponse(order: { id: string; orderNumber: string; viewToken: string }, locale: string) {
  let redirectUrl: string | undefined;
  try {
    redirectUrl = await prepareMonobankPayment(prisma, order.id, locale);
  } catch (error) {
    // The persisted order is the recovery path; never ask the buyer to create it again.
    console.error("[Checkout monobank]", error instanceof MonobankError ? error.code : "MONOBANK_PAYMENT_UNAVAILABLE");
  }
  return { orderNumber: order.orderNumber, viewToken: order.viewToken, redirectUrl };
}

export async function POST(req: NextRequest) {
  let body: CheckoutBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid checkout" }, { status: 400 });
  }

  const session = await getCurrentShopCustomerSession();
  const paymentMethod = normalizePaymentMethod(body.paymentMethod);
  let monoKeyHash: string | undefined;
  let monoRequestHash: string | undefined;
  if (paymentMethod === "MONOBANK") {
    if (!isMonobankEnabled()) return NextResponse.json({ error: "MONOBANK_UNAVAILABLE" }, { status: 503 });
    try {
      monoKeyHash = monobankCheckoutKey(body.checkoutKey);
    } catch {
      return NextResponse.json({ error: "Invalid checkout key" }, { status: 400 });
    }
    monoRequestHash = monobankRequestHash(body, session?.customerId ?? null);
    const existing = await prisma.shopMonobankPayment.findUnique({
      where: { checkoutKeyHash: monoKeyHash }, include: { order: true },
    });
    if (existing) {
      if (existing.requestHash !== monoRequestHash) {
        return NextResponse.json({ error: "Checkout key already used" }, { status: 409 });
      }
      return NextResponse.json(await monobankCheckoutResponse(existing.order, body.locale ?? "en"), {
        headers: { "Cache-Control": "no-store" },
      });
    }
  }
  const settingsRecord = await getOrCreateShopSettings(prisma);
  const settings = getShopSettingsRuntime(settingsRecord);
  const activeCart = await resolveShopCart(prisma, {
    cartToken: req.cookies.get(SHOP_CART_COOKIE)?.value,
    customerId: session?.customerId ?? null,
    locale: session?.preferredLocale ?? "en",
    currency: body.currency ?? settings.defaultCurrency,
  });
  const requestItems = Array.isArray(body.items) ? body.items : [];
  const items = session?.customerId
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
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const email = typeof body.contact?.email === "string" ? body.contact.email.trim() : "";
  const name = typeof body.contact?.name === "string" ? body.contact.name.trim() : "";
  if (!email || !name) {
    return NextResponse.json({ error: "Email and name are required" }, { status: 400 });
  }

  const shipping = body.shipping ?? {};
  const line1 = typeof shipping.line1 === "string" ? shipping.line1.trim() : "";
  const city = typeof shipping.city === "string" ? shipping.city.trim() : "";
  const country = typeof shipping.country === "string" ? shipping.country.trim() : "";
  if (!line1 || !city || !country) {
    return NextResponse.json(
      { error: "Shipping address (line1, city, country) is required" },
      { status: 400 }
    );
  }

  let quote: Awaited<ReturnType<typeof buildCheckoutQuote>>;
  try {
    quote = await buildCheckoutQuote(prisma, {
      items,
      shippingAddress: {
        line1,
        line2: typeof shipping.line2 === "string" ? shipping.line2.trim() : undefined,
        city,
        region: typeof shipping.region === "string" ? shipping.region.trim() : undefined,
        postcode: typeof shipping.postcode === "string" ? shipping.postcode.trim() : undefined,
        country,
      },
      currency: CURRENCIES.includes((body.currency ?? "EUR") as (typeof CURRENCIES)[number])
        ? (body.currency ?? "EUR")
        : "EUR",
      customerGroup: session?.group ?? null,
      customerId: session?.customerId ?? null,
      customerB2BDiscountPercent: session?.b2bDiscountPercent ?? null,
    });
  } catch (error) {
    if ((error as Error).message === "WHEELFORCE_SET_OF_FOUR_REQUIRED") {
      return NextResponse.json({ error: "WheelForce wheels are sold in sets of four", code: "WHEELFORCE_SET_OF_FOUR_REQUIRED" }, { status: 400 });
    }
    throw error;
  }

  if (quote.items.length === 0) {
    return NextResponse.json({ error: "No valid items in cart" }, { status: 400 });
  }

  if (quote.requiresQuote) {
    return NextResponse.json(
      {
        error: "Manual quote required before checkout",
        requiresQuote: true,
        landedCost: quote.landedCost,
        brandsRequiringQuote: quote.brandsRequiringQuote,
      },
      { status: 409 }
    );
  }

  if (paymentMethod === "MONOBANK") {
    if (quote.currency !== "UAH" || quote.total <= 0) {
      return NextResponse.json({ error: "MONOBANK_REQUIRES_UAH_QUOTE" }, { status: 400 });
    }
    if (!Number.isSafeInteger(body.expectedAmount) || body.expectedAmount !== monobankMinorUnits(quote.total)) {
      return NextResponse.json({ error: "MONOBANK_QUOTE_CHANGED" }, { status: 409 });
    }
  }

  const orderNumber = await generateOrderNumber();
  const viewToken = generateViewToken();
  const locale = (body.locale === "ua" ? "ua" : "en") as "ua" | "en";

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://onecompany.global");

  const shippingAddress = {
    line1,
    line2: typeof shipping.line2 === "string" ? shipping.line2.trim() : undefined,
    city,
    region: typeof shipping.region === "string" ? shipping.region.trim() : undefined,
    postcode: typeof shipping.postcode === "string" ? shipping.postcode.trim() : undefined,
    country,
  };
  const oneAiAttributionByItem = new Map(
    activeCart.cart.items
      .filter((item) => item.oneAiRunId && item.oneAiCandidateDecisionId)
      .map((item) => [
        `${item.productSlug}::${item.variantId ?? ""}`,
        {
          runId: item.oneAiRunId,
          candidateDecisionId: item.oneAiCandidateDecisionId,
          productId: item.productId,
          variantId: item.variantId,
        },
      ])
  );

  const orderData = {
    orderNumber,
    status: paymentMethod === "MONOBANK" ? "PENDING_PAYMENT" as const : "PENDING_REVIEW" as const,
    ...(paymentMethod === "MONOBANK" ? {
      paymentStatus: "PENDING",
      monobankPayment: {
        create: {
          checkoutKeyHash: monoKeyHash!, requestHash: monoRequestHash!,
          amount: monobankMinorUnits(quote.total),
        },
      },
    } : {}),
    paymentMethod,
    customerId: session?.customerId ?? null,
    customerGroupSnapshot: session?.group ?? "B2C",
    email,
    customerName: name,
    phone: typeof body.contact?.phone === "string" ? body.contact.phone.trim() || null : null,
    shippingAddress,
    currency: quote.currency,
    subtotal: quote.subtotal,
    shippingCost: quote.shippingCost,
    taxAmount: quote.taxAmount,
    total: quote.total,
    pricingSnapshot: quote.pricingSnapshot,
    viewToken,
    items: {
      create: quote.items.map((i) => {
        const attribution = oneAiAttributionByItem.get(`${i.productSlug}::${i.variantId ?? ""}`);
        return {
          productSlug: i.productSlug,
          productId: i.productId,
          variantId: i.variantId,
          oneAiRunId: attribution?.runId ?? null,
          oneAiCandidateDecisionId: attribution?.candidateDecisionId ?? null,
          title: i.title,
          quantity: i.quantity,
          price: i.unitPrice,
          total: i.total,
          image: i.image,
        };
      }),
    },
  };

  // ── HYBRID CHECKOUT MODE ──
  // By default, do not redirect immediately (Hybrid Checkout).
  // Exception: WHITEBIT payment method has an auto-redirect override per user request.

  let order: ShopOrder;
  try {
    order = await prisma.shopOrder.create({ data: orderData });
  } catch (error) {
    if (monoKeyHash && (error as { code?: string }).code === "P2002") {
      const existing = await prisma.shopMonobankPayment.findUnique({
        where: { checkoutKeyHash: monoKeyHash }, include: { order: true },
      });
      if (existing && existing.requestHash === monoRequestHash) {
        return NextResponse.json(await monobankCheckoutResponse(existing.order, locale), {
          headers: { "Cache-Control": "no-store" },
        });
      }
      return NextResponse.json({ error: "Checkout in progress; please retry" }, { status: 409 });
    }
    throw error;
  }

  const oneAiOrderSignals = quote.items.flatMap((item) => {
    const attribution = oneAiAttributionByItem.get(`${item.productSlug}::${item.variantId ?? ""}`);
    if (!attribution?.runId || !attribution.candidateDecisionId) return [];
    return [
      {
        runId: attribution.runId,
        candidateDecisionId: attribution.candidateDecisionId,
        productId: attribution.productId ?? item.productId,
        variantId: attribution.variantId,
        signal: "ORDER_COMPLETED" as const,
        metadata: {
          source: "shop_checkout",
          orderId: order.id,
          orderNumber: order.orderNumber,
        },
      },
    ];
  });
  if (oneAiOrderSignals.length > 0) {
    try {
      await prisma.shopAiFeedback.createMany({ data: oneAiOrderSignals });
    } catch (error) {
      console.warn("OneAI order attribution could not be persisted", {
        orderId: order.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  let redirectUrl: string | undefined = undefined;

  if (paymentMethod === "WHITEBIT") {
    try {
      const successUrl = `${baseUrl}/${locale}/shop/checkout/success?order=${encodeURIComponent(orderNumber)}&token=${encodeURIComponent(viewToken)}`;

      const wpRes = await createWhitepayCryptoOrder({
        amount: quote.total.toString(),
        currency: quote.currency.toUpperCase(),
        description: `One Company — Замовлення #${order.orderNumber} / ${order.email}`,
        external_order_id: String(order.orderNumber),
        successful_link: successUrl,
        failure_link: successUrl,
      });

      console.log("[Checkout] Whitepay response:", JSON.stringify(wpRes));

      if (wpRes.success && wpRes.url) {
        redirectUrl = wpRes.url;
        order = await prisma.shopOrder.update({
          where: { id: order.id },
          data: { status: "PENDING_PAYMENT" },
        });
      } else {
        console.error("[Checkout] Whitepay redirect generation failed:", wpRes.error, wpRes);
      }
    } catch (wpError) {
      console.error("[Checkout] Whitepay exception:", wpError);
    }
  }

  if (paymentMethod === "WHITEPAY_FIAT") {
    try {
      // Fiat API only accepts: amount, currency, external_order_id
      // Redirect URLs are configured in Whitepay CRM payment page settings
      const wpRes = await createWhitepayFiatOrder({
        amount: quote.total.toString(),
        currency: quote.currency.toUpperCase(),
        external_order_id: String(order.orderNumber),
      });

      console.log("[Checkout] Whitepay Fiat response:", JSON.stringify(wpRes));

      if (wpRes.success && wpRes.url) {
        redirectUrl = wpRes.url;
        order = await prisma.shopOrder.update({
          where: { id: order.id },
          data: { status: "PENDING_PAYMENT", paymentMethod: "WHITEPAY_FIAT" },
        });
      } else {
        console.error("[Checkout] Whitepay Fiat redirect generation failed:", wpRes.error, wpRes);
      }
    } catch (wpError) {
      console.error("[Checkout] Whitepay Fiat exception:", wpError);
    }
  }
  await dispatchCrmWebhook("order.created", order).catch(() => {});

  if (paymentMethod === "MONOBANK") {
    await prisma.shopOrderStatusEvent.create({
      data: { orderId: order.id, fromStatus: null, toStatus: "PENDING_PAYMENT", actorType: "system", actorName: "checkout", note: "Order created for plata by mono payment." },
    });
  } else {
    await createInitialOrderEvent(prisma, order.id);
  }
  if (session?.customerId) {
    await upsertCustomerDefaultShippingAddress(prisma, session.customerId, shippingAddress);
  }
  await clearShopCart(prisma, {
    cartToken: activeCart.token,
    customerId: session?.customerId ?? null,
    locale: session?.preferredLocale ?? "en",
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
          landedCost: quote.landedCost,
          total: quote.total,
          locale,
          viewOrderUrl,
          items: quote.items.map((i) => ({ title: i.title, quantity: i.quantity, total: i.total })),
        })
      );
      await resend.emails.send({
        from: `One Company Shop <${process.env.EMAIL_FROM}>`,
        to: [email],
        subject:
          locale === "ua" ? `Замовлення ${orderNumber} прийнято` : `Order ${orderNumber} confirmed`,
        html: emailHtml,
      });
    } catch (err) {
      console.error("Order confirmation email failed (order already created):", err);
    }
  }

  try {
    await notifyAdminNewShopOrder({
      orderId: order.id,
      orderNumber,
      customerName: name,
      email,
      phone: order.phone,
      customerGroup: order.customerGroupSnapshot,
      shippingAddress,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      status: order.status,
      shippingCost: quote.shippingCost,
      requiresQuote: quote.requiresQuote,
      taxAmount: quote.taxAmount,
      items: quote.items.map((item) => ({
        sku: item.sku,
        variantTitle: item.variantTitle,
        productSlug: item.productSlug,
        productId: item.productId,
        variantId: item.variantId,
        title: item.title,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
      currency: quote.currency,
      total: quote.total,
      itemCount: quote.items.reduce((s, i) => s + i.quantity, 0),
    });
  } catch (err) {
    console.error("Admin shop order notification failed (non-blocking):", err);
  }

  if (paymentMethod === "MONOBANK") {
    redirectUrl = (await monobankCheckoutResponse(order, locale)).redirectUrl;
  }

  const response = NextResponse.json({
    redirectUrl,
    orderNumber,
    viewToken,
    subtotal: quote.subtotal,
    regionalAdjustmentAmount: quote.regionalAdjustmentAmount,
    shippingCost: quote.shippingCost,
    shippingIncludedInPrice: quote.shippingIncludedInPrice,
    taxableSubtotal: quote.taxableSubtotal,
    taxableShippingCost: quote.taxableShippingCost,
    taxAmount: quote.taxAmount,
    total: quote.total,
    landedCost: quote.landedCost,
    currency: quote.currency,
    pricingAudience: quote.pricingAudience,
    shippingZone: quote.shippingZone,
    taxRegion: quote.taxRegion,
    regionalPricingRule: quote.regionalPricingRule,
    showTaxesIncludedNotice: quote.showTaxesIncludedNotice,
    requiresQuote: quote.requiresQuote,
    brandsRequiringQuote: quote.brandsRequiringQuote,
  });
  response.cookies.set(SHOP_CART_COOKIE, activeCart.token, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
