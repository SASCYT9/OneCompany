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
import { adminMonobankBlockReason } from "@/lib/shopMonobankEligibility";
import { reusableMonobankLink } from "@/lib/shopMonobankPayments";

const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");

function failure(code: string, status: number) {
  return NextResponse.json({ error: code }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session: Awaited<ReturnType<typeof assertAdminRequest>>;
  try {
    session = await assertAdminRequest(await cookies(), ADMIN_PERMISSIONS.SHOP_ORDERS_WRITE);
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNAUTHORIZED";
    return failure(code === "FORBIDDEN" ? code : "UNAUTHORIZED", code === "FORBIDDEN" ? 403 : 401);
  }
  const { id } = await params;
  // The admin page keeps one key per send until it succeeds, so a retry after a lost
  // provider response is deduplicated by Resend instead of reaching the buyer twice.
  const body = (await request.json().catch(() => null)) as { attemptKey?: unknown } | null;
  const attemptKey =
    typeof body?.attemptKey === "string" && /^[A-Za-z0-9-]{8,64}$/.test(body.attemptKey)
      ? body.attemptKey
      : null;
  const order = await prisma.shopOrder.findUnique({
    where: { id },
    include: { monobankPayment: true },
  });
  if (!order) return failure("ORDER_NOT_FOUND", 404);
  // A paid, settled-elsewhere or cancelled order must not get a live invoice again.
  if (order.paymentMethod !== "MONOBANK" || adminMonobankBlockReason(order))
    return failure("ORDER_NOT_PAYABLE", 409);
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
  const { data: sent, error: sendError } = await resend.emails.send(
    {
      from: `One Company <${process.env.EMAIL_FROM}>`,
      to: [order.email],
      subject:
        locale === "ua"
          ? `Оплата замовлення ${order.orderNumber}`
          : `Payment for order ${order.orderNumber}`,
      html,
    },
    attemptKey
      ? {
          // Scoped to the link: a regenerated invoice is a new email, not a retry.
          idempotencyKey: `mono-link-email/${id}/${order.monobankPayment?.invoiceId ?? "link"}/${attemptKey}`,
        }
      : undefined
  );
  if (sendError) {
    console.error("[Admin mono payment email] send failed", {
      orderId: id,
      error: `${sendError.name}: ${sendError.message}`,
    });
    return failure("EMAIL_SEND_FAILED", 502);
  }

  // The email is gone at this point: a failed log write must not read as a failed
  // send, or the manager would retry and the buyer would get it twice.
  const emailId = typeof sent?.id === "string" && sent.id ? sent.id : null;
  let recorded = true;
  try {
    await prisma.$transaction(async (tx) => {
      // A retried attempt gets Resend's original response (same email id) and sends
      // nothing new, so the history must not show a second send either.
      if (
        emailId &&
        (await tx.shopOrderStatusEvent.findFirst({
          where: { orderId: id, note: { contains: emailId } },
          select: { id: true },
        }))
      )
        return;
      await writeAdminAuditLog(tx, session, {
        scope: "shop",
        action: "order.monobank.payment_link_emailed",
        entityType: "shop.order",
        entityId: id,
        metadata: { email: order.email, emailId },
      });
      await tx.shopOrderStatusEvent.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: order.status,
          actorType: "admin",
          actorName: session.name,
          note: `Посилання на оплату mono надіслано на ${order.email}${emailId ? ` (лист ${emailId})` : ""}.`,
        },
      });
    });
  } catch (error) {
    recorded = false;
    console.error("[Admin mono payment email] sent but not recorded", {
      orderId: id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return NextResponse.json(
    { ok: true, email: order.email, recorded },
    { headers: { "Cache-Control": "no-store" } }
  );
}
