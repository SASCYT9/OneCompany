/**
 * GET /api/cron/customer-emails — Vercel cron (every 30 min, sends only 09:00–21:00 Kyiv):
 * - abandoned-cart reminders the buyer opted into at checkout (`shopCartReminder`);
 * - one review request a week after an order is marked «Доставлено» (`shopReviewRequest`).
 * `?dryRun=1` reports what would happen without sending or writing anything.
 */
import { NextRequest, NextResponse } from "next/server";
import { render } from "@react-email/render";
import { Resend } from "resend";
import AbandonedCartEmail from "@/components/emails/AbandonedCartEmail";
import { emailBaseUrl } from "@/components/emails/EmailLayout";
import ReviewRequestEmail from "@/components/emails/ReviewRequestEmail";
import { prisma } from "@/lib/prisma";
import { serializeResolvedShopCart } from "@/lib/shopCart";
import { runCartReminders, type DueCartReminder } from "@/lib/shopCartReminder";
import { convertShopMoney, type ShopCurrencyCode } from "@/lib/shopMoneyFormat";
import { buildShopViewerPricingContextServer } from "@/lib/shopPricingContext.server";
import { getPublicShopSettingsRuntime } from "@/lib/shopPublicSettings";
import {
  orderEmailLocale,
  runReviewRequests,
  SHOP_GOOGLE_REVIEW_URL,
  type ReviewRequestOrder,
} from "@/lib/shopReviewRequest";
import { localizeShopText } from "@/lib/shopText";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");

function unsubscribeHeaders(url: string) {
  return { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
}

async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  unsubscribeUrl: string;
  idempotencyKey: string;
}) {
  const { data, error } = await resend.emails.send(
    {
      from: `One Company <${process.env.EMAIL_FROM}>`,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      headers: unsubscribeHeaders(input.unsubscribeUrl),
    },
    // A retried run can never deliver the same email twice.
    { idempotencyKey: input.idempotencyKey }
  );
  if (error) throw new Error(`${error.name}: ${error.message}`);
  return data?.id ?? null;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  if (!dryRun && (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)) {
    return NextResponse.json({ ok: false, error: "Email is not configured" }, { status: 503 });
  }

  const settings = await getPublicShopSettingsRuntime();

  const sendCartReminder = async (reminder: DueCartReminder) => {
    const customer = reminder.cart.customer;
    const context = await buildShopViewerPricingContextServer({
      prisma,
      settings,
      customerId: customer?.id,
      customerGroup: customer?.group,
      isAuthenticated: Boolean(customer),
      customerB2BDiscountPercent:
        customer?.b2bDiscountPercent != null ? Number(customer.b2bDiscountPercent) : null,
      priceCountry: reminder.country,
    });
    const payload = await serializeResolvedShopCart(reminder.cart, context);
    // Products removed from the catalog drop out; nothing left means nothing to remind.
    if (!payload.items.length) throw new Error("EMPTY");
    const locale = reminder.locale === "en" ? "en" : "ua";
    const currency = (["UAH", "EUR", "USD"].includes(reminder.currency)
      ? reminder.currency
      : "UAH") as ShopCurrencyCode;
    const items = payload.items.map((item) => {
      const unitPrice = item.price ? convertShopMoney(item.price, currency, settings.currencyRates) : 0;
      return {
        title: localizeShopText(locale, item.title),
        variantTitle: item.variantTitle,
        quantity: Math.max(1, Math.ceil(item.quantity / (item.packSize ?? 1))),
        image: item.image || item.fallbackImage,
        lineTotal: unitPrice > 0 && !item.pricing.requestQuote ? unitPrice * item.quantity : null,
      };
    });
    const unsubscribeUrl = `${emailBaseUrl}/api/shop/email/unsubscribe?t=${encodeURIComponent(reminder.token)}`;
    const html = await render(
      AbandonedCartEmail({
        locale,
        firstName: reminder.firstName ?? customer?.firstName ?? null,
        currency,
        items,
        cartUrl: `${emailBaseUrl}/api/shop/cart/reminder/${encodeURIComponent(reminder.token)}`,
        unsubscribeUrl,
      })
    );
    return sendEmail({
      to: reminder.email,
      subject: locale === "ua" ? "Ви залишили товари в кошику" : "You left items in your cart",
      html,
      unsubscribeUrl,
      idempotencyKey: `cart-reminder/${reminder.cartId}/${reminder.consentAt.getTime()}`,
    });
  };

  const sendReviewRequest = async (order: ReviewRequestOrder) => {
    const locale = orderEmailLocale(order);
    const unsubscribeUrl = `${emailBaseUrl}/api/shop/email/unsubscribe?o=${encodeURIComponent(order.orderNumber)}&t=${encodeURIComponent(order.viewToken)}`;
    const html = await render(
      ReviewRequestEmail({
        locale,
        orderNumber: order.orderNumber,
        firstName: order.customer?.firstName ?? order.customerName.split(" ")[0] ?? null,
        items: order.items.map((item) => ({ title: item.title })),
        reviewUrl: SHOP_GOOGLE_REVIEW_URL,
        unsubscribeUrl,
      })
    );
    return sendEmail({
      to: order.email.trim(),
      subject:
        locale === "ua" ? `Як вам замовлення ${order.orderNumber}?` : `How was your order ${order.orderNumber}?`,
      html,
      unsubscribeUrl,
      idempotencyKey: `review-request/${order.id}`,
    });
  };

  // The two flows are independent: one failing never stops the other.
  const [carts, reviews] = await Promise.allSettled([
    runCartReminders(prisma, { send: sendCartReminder, dryRun }),
    runReviewRequests(prisma, { send: sendReviewRequest, dryRun }),
  ]);
  for (const [name, outcome] of [["carts", carts], ["reviews", reviews]] as const)
    if (outcome.status === "rejected") console.error(`[customer-emails.cron] ${name} failed`, outcome.reason);
  const failed = carts.status === "rejected" || reviews.status === "rejected";
  return NextResponse.json(
    {
      ok: !failed,
      dryRun,
      carts: carts.status === "fulfilled" ? carts.value : { error: "failed" },
      reviews: reviews.status === "fulfilled" ? reviews.value : { error: "failed" },
    },
    { status: failed ? 500 : 200 }
  );
}
