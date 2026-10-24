/**
 * GET /api/shop/cart/reminder/[token] — "Back to my cart" from the reminder email. Puts
 * that cart back into this browser (any device) and opens the cart page.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setShopCartCookies } from "@/lib/shopCart";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const reminder = token
    ? await prisma.shopCartReminder.findUnique({
        where: { token },
        select: {
          locale: true,
          cart: { select: { token: true, _count: { select: { items: true } } } },
        },
      })
    : null;
  const locale = reminder?.locale === "en" ? "en" : "ua";
  const response = NextResponse.redirect(
    new URL(reminder ? `/${locale}/shop/cart` : `/${locale}/shop/catalog`, request.nextUrl.origin)
  );
  response.headers.set("Cache-Control", "no-store");
  if (reminder) setShopCartCookies(response, reminder.cart.token, reminder.cart._count.items);
  return response;
}
