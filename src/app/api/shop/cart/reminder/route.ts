/**
 * POST /api/shop/cart/reminder — the checkout's "remind me" checkbox. Saves (or withdraws)
 * the buyer's consent to one abandoned-cart email for their current cart.
 */
import { NextRequest, NextResponse } from "next/server";
import { isLocalStorefrontMode } from "@/lib/localStorefront";
import { prisma } from "@/lib/prisma";
import { SHOP_CART_COOKIE } from "@/lib/shopCart";
import { normalizeReminderEmail, saveCartReminderConsent } from "@/lib/shopCartReminder";
import { getCurrentShopCustomerSession } from "@/lib/shopCustomerSession";
import { consumeRateLimit, getRequestIp } from "@/lib/shopPublicRateLimit";

const CURRENCIES = new Set(["UAH", "EUR", "USD"]);

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return reply({ error: "INVALID_REQUEST" }, 400);
  const consent = body.consent === true;
  const email = normalizeReminderEmail(body.email);
  if (consent && !email) return reply({ error: "INVALID_EMAIL" }, 400);
  // The DB-less storefront preview has no carts to remember.
  if (isLocalStorefrontMode()) return reply({ ok: true, saved: false });

  // Each opt-in can trigger an email, so one visitor cannot enrol address after address.
  if (
    !(await consumeRateLimit({
      keyParts: ["cart-reminder", getRequestIp(request.headers)],
      windowMs: 10 * 60 * 1000,
      maxPerWindow: 12,
    }))
  )
    return reply({ error: "RATE_LIMITED" }, 429);

  const session = await getCurrentShopCustomerSession();
  const token = request.cookies.get(SHOP_CART_COOKIE)?.value?.trim();
  // The same cart checkout uses: the customer's own cart first, else this browser's.
  const cart =
    (session?.customerId
      ? await prisma.shopCart.findFirst({
          where: { customerId: session.customerId },
          orderBy: { updatedAt: "desc" },
          select: { id: true },
        })
      : null) ??
    (token ? await prisma.shopCart.findUnique({ where: { token }, select: { id: true } }) : null);
  if (!cart) return reply({ error: "CART_NOT_FOUND" }, 404);

  const currency = String(body.currency ?? "").toUpperCase();
  const result = await saveCartReminderConsent(prisma, {
    cartId: cart.id,
    email,
    consent,
    firstName: typeof body.firstName === "string" ? body.firstName : null,
    locale: body.locale === "en" ? "en" : "ua",
    currency: CURRENCIES.has(currency) ? currency : "UAH",
    country: typeof body.country === "string" ? body.country : null,
  });
  return reply({ ok: true, ...result });
}
