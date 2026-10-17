/**
 * POST /api/admin/shop/orders/[id]/monobank/email
 * Emails the buyer the order's open plata by mono link (the manager's third option
 * next to "Copy" and "Open"). Never creates or changes an invoice.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { render } from "@react-email/render";
import { Resend } from "resend";
import PaymentLinkEmail from "@/components/emails/PaymentLinkEmail";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import { prisma } from "@/lib/prisma";
import { isInternationalDelivery } from "@/lib/shopInternationalCheckout";
import { snapshotRecord } from "@/lib/shopInternationalDeliveryQuote";
import { reusableMonobankLink } from "@/lib/shopMonobankPayments";

const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");

function failure(code: string, status: number) {
  return NextResponse.json({ error: code }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session: Awaited<ReturnType<typeof assertAdminRequest>>;
  try {
    session = await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNAUTHORIZED";
    return failure(code === "FORBIDDEN" ? code : "UNAUTHORIZED", code === "FORBIDDEN" ? 403 : 401);
  }
  const { id } = await params;
  const order = await prisma.shopOrder.findUnique({
    where: { id },
    include: { monobankPayment: true },
  });
  if (!order) return failure("ORDER_NOT_FOUND", 404);
  const paymentUrl = reusableMonobankLink(order.monobankPayment);
  if (!paymentUrl) return failure("PAYMENT_LINK_MISSING", 409);
  if (!order.email) return failure("ORDER_EMAIL_MISSING", 409);
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    return failure("EMAIL_NOT_CONFIGURED", 503);

  const country = String(snapshotRecord(order.shippingAddress).country ?? "");
  const locale = isInternationalDelivery(country) ? "en" : "ua";
  const amountText = new Intl.NumberFormat(locale === "ua" ? "uk-UA" : "en-US", {
    style: "currency",
    currency: order.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(order.total));
  const expiresAt = order.monobankPayment?.expiresAt;
  const validUntilText = expiresAt
    ? expiresAt.toLocaleString(locale === "ua" ? "uk-UA" : "en-GB", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Kyiv",
      }) + (locale === "ua" ? " (за Києвом)" : " (Kyiv time)")
    : null;

  const html = await render(
    PaymentLinkEmail({
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      locale,
      amountText,
      paymentUrl,
      validUntilText,
    })
  );
  const { error: sendError } = await resend.emails.send({
    from: `One Company <${process.env.EMAIL_FROM}>`,
    to: [order.email],
    subject:
      locale === "ua"
        ? `Оплата замовлення ${order.orderNumber}`
        : `Payment for order ${order.orderNumber}`,
    html,
  });
  if (sendError) {
    console.error("[Admin mono payment email] send failed", {
      orderId: id,
      error: `${sendError.name}: ${sendError.message}`,
    });
    return failure("EMAIL_SEND_FAILED", 502);
  }

  await writeAdminAuditLog(prisma, session, {
    scope: "shop",
    action: "order.monobank.payment_link_emailed",
    entityType: "shop.order",
    entityId: id,
    metadata: { email: order.email },
  });
  await prisma.shopOrderStatusEvent.create({
    data: {
      orderId: id,
      fromStatus: order.status,
      toStatus: order.status,
      actorType: "admin",
      actorName: session.name,
      note: `Посилання на оплату mono надіслано на ${order.email}.`,
    },
  });
  return NextResponse.json(
    { ok: true, email: order.email },
    { headers: { "Cache-Control": "no-store" } }
  );
}
