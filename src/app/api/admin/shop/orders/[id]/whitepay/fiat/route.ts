import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/adminRbac";
import { prisma } from "@/lib/prisma";
import { createWhitepayFiatOrder, isWhitepayEnabled } from "@/lib/shopWhitepay";
import { isInternationalDelivery, internationalDeliveryAgreementMatches } from "@/lib/shopInternationalCheckout";
import { claimAdminWhitepayOrder, whitepayOrderEligibilityError } from "@/lib/shopAdminWhitepay";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);
    const { id } = await params;

    if (!isWhitepayEnabled()) {
      return NextResponse.json({ error: "Whitepay Token is not configured." }, { status: 500 });
    }

    const order = await prisma.shopOrder.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        currency: true,
        email: true,
        viewToken: true,
        paymentStatus: true,
        paymentMethod: true,
        amountPaid: true,
        status: true,
        updatedAt: true,
        isDraft: true,
        stripeCheckoutSessionId: true,
        shippingAddress: true,
        pricingSnapshot: true,
        monobankPayment: { select: { id: true } },
      },
    });

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const address = order.shippingAddress as Record<string, unknown> | null;
    if (isInternationalDelivery(String(address?.country ?? "")) &&
      !internationalDeliveryAgreementMatches(order.pricingSnapshot, order.currency, order.total))
      return NextResponse.json({ error: "INTERNATIONAL_DELIVERY_NOT_AGREED" }, { status: 409 });
    if (order.paymentMethod === "MONOBANK" || order.monobankPayment)
      return NextResponse.json({ error: "OTHER_PAYMENT_PROVIDER_REVIEW_REQUIRED" }, { status: 409 });
    if (order.paymentStatus === "PAID")
      return NextResponse.json({ error: "Order already paid" }, { status: 400 });
    const eligibilityError = whitepayOrderEligibilityError(order);
    if (eligibilityError) return NextResponse.json({ error: eligibilityError }, { status: 409 });
    if (!await claimAdminWhitepayOrder(prisma, order, "WHITEPAY_FIAT"))
      return NextResponse.json({ error: "WHITEPAY_CONCURRENT_UPDATE" }, { status: 409 });

    // Amount as float string e.g. "100.50"
    const amountStr = Number(order.total).toFixed(2);

    // Whitepay usually expects Fiat requests in UAH if it's UA local acquiring,
    // but we will send order.currency and let Whitepay handle it if configured.
    let currency = order.currency;
    if (currency === "UAH") currency = "UAH";

    // Fiat API only accepts: amount, currency, external_order_id
    // successful_link / failure_link are configured in Whitepay CRM payment page settings
    const whitepayResult = await createWhitepayFiatOrder({
      amount: amountStr,
      currency: currency,
      external_order_id: `${order.orderNumber}_${Date.now()}`, // only the successful atomic claim reaches the provider
    });

    if (!whitepayResult.success) {
      console.error("[Whitepay Fiat API error]", whitepayResult);
      return NextResponse.json(
        { error: whitepayResult.error || "Failed to generate link" },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: whitepayResult.url, paymentId: whitepayResult.orderId });
  } catch (e: any) {
    console.error("Admin generate whitepay fiat link error", e);
    return NextResponse.json(
      { error: e.message || "Failed to generate payment link" },
      { status: 500 }
    );
  }
}
