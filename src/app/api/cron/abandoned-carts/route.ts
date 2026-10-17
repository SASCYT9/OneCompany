/**
 * GET /api/cron/abandoned-carts — Vercel cron (every 30 min). Sends the one
 * abandoned-cart reminder buyers opted into at checkout; see `shopCartReminder`.
 * `?dryRun=1` reports what would happen without sending or writing anything.
 */
import { NextRequest, NextResponse } from "next/server";
import { render } from "@react-email/render";
import { Resend } from "resend";
import AbandonedCartEmail from "@/components/emails/AbandonedCartEmail";
import { emailBaseUrl } from "@/components/emails/EmailLayout";
import { prisma } from "@/lib/prisma";
import { serializeResolvedShopCart } from "@/lib/shopCart";
import { runCartReminders, type DueCartReminder } from "@/lib/shopCartReminder";
import { convertShopMoney, type ShopCurrencyCode } from "@/lib/shopMoneyFormat";
import { buildShopViewerPricingContextServer } from "@/lib/shopPricingContext.server";
import { getPublicShopSettingsRuntime } from "@/lib/shopPublicSettings";
import { localizeShopText } from "@/lib/shopText";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");

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
  const send = async (reminder: DueCartReminder) => {
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
    const { data, error } = await resend.emails.send(
      {
        from: `One Company <${process.env.EMAIL_FROM}>`,
        to: [reminder.email],
        subject: locale === "ua" ? "Ви залишили товари в кошику" : "You left items in your cart",
        html,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      },
      // A retried run can never deliver the same reminder twice.
      { idempotencyKey: `cart-reminder/${reminder.cartId}/${reminder.consentAt.getTime()}` }
    );
    if (error) throw new Error(`${error.name}: ${error.message}`);
    return data?.id ?? null;
  };

  try {
    const result = await runCartReminders(prisma, { send, dryRun });
    return NextResponse.json({ ok: true, dryRun, ...result });
  } catch (error) {
    console.error("[abandoned-carts.cron] failed", error);
    return NextResponse.json({ ok: false, error: "Cart reminders failed" }, { status: 500 });
  }
}
