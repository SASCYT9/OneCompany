import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/adminRbac";
import { prisma } from "@/lib/prisma";
import { createWhitepayCryptoOrder, isWhitepayEnabled } from "@/lib/shopWhitepay";
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
    if (!await claimAdminWhitepayOrder(prisma, order, "WHITEPAY_CRYPTO"))
      return NextResponse.json({ error: "WHITEPAY_CONCURRENT_UPDATE" }, { status: 409 });

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://onecompany.global");

    // Amount as float string e.g. "100.50"
    const amountStr = Number(order.total).toFixed(2);

    // Use the actual view checkout link as the response URL after payment
    const successUrl = `${baseUrl}/ua/shop/checkout/success?order=${encodeURIComponent(order.orderNumber)}&token=${encodeURIComponent(order.viewToken)}`;
    const failUrl = `${baseUrl}/ua/shop/checkout/error`;
    const webhookUrl = `${baseUrl}/api/shop/whitepay/callback`;

    const whitepayResult = await createWhitepayCryptoOrder({
      amount: amountStr,
      currency: order.currency, // Whitepay uses this to calculate crypto equivalents
      description: `One Company — Замовлення #${order.orderNumber} / ${order.email}`,
      external_order_id: `${order.orderNumber}_${Date.now()}`, // only the successful atomic claim reaches the provider
      successful_link: successUrl,
      failure_link: failUrl,
    });

    if (!whitepayResult.success) {
      console.error("[Whitepay Crypto API error]", whitepayResult);
      return NextResponse.json(
        { error: whitepayResult.error || "Failed to generate link" },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: whitepayResult.url, paymentId: whitepayResult.orderId });
  } catch (e: any) {
    console.error("Admin generate whitepay crypto link error", e);
    return NextResponse.json(
      { error: e.message || "Failed to generate payment link" },
      { status: 500 }
    );
  }
}
