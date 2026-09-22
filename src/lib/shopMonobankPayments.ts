import type { PrismaClient, ShopMonobankPayment } from "@prisma/client";
import {
  buildMonobankInvoice,
  createMonobankInvoice,
  getMonobankConfig,
  getMonobankInvoiceStatus,
  isMonobankEnabled,
  isMonobankPaymentUrl,
  MONOBANK_VALIDITY_SECONDS,
  MonobankError,
  monobankMinorUnits,
  resolveMonobankStatusUpdate,
  type MonobankInvoiceStatus,
} from "@/lib/shopMonobank";

/** One order has one invoice. An uncertain POST must never silently create another. */
export async function prepareMonobankPayment(
  prisma: PrismaClient,
  orderId: string,
  locale: string
) {
  if (!isMonobankEnabled()) throw new MonobankError("MONOBANK_NOT_CONFIGURED", true);
  const payment = await prisma.shopMonobankPayment.findUnique({
    where: { orderId },
    include: { order: { include: { items: true } } },
  });
  if (!payment) throw new MonobankError("MONOBANK_PAYMENT_NOT_FOUND", true);
  const { order } = payment;
  if (
    order.paymentMethod !== "MONOBANK" ||
    order.currency !== "UAH" ||
    monobankMinorUnits(order.total) !== payment.amount ||
    order.amountPaid > 0 ||
    ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"].includes(order.paymentStatus) ||
    !["PENDING_PAYMENT", "PENDING_REVIEW"].includes(order.status)
  ) {
    throw new MonobankError("MONOBANK_ORDER_NOT_PAYABLE", true);
  }
  if (payment.invoiceId) {
    if (
      (payment.expiresAt && payment.expiresAt <= new Date()) ||
      ["expired", "reversed", "success", "hold"].includes(payment.status)
    ) {
      throw new MonobankError("MONOBANK_INVOICE_CLOSED", true);
    }
    if (!isMonobankPaymentUrl(payment.pageUrl)) throw new MonobankError("MONOBANK_PAYMENT_PENDING");
    return payment.pageUrl;
  }
  const body = buildMonobankInvoice(order, payment.id, locale, getMonobankConfig().publicUrl);
  const claim = await prisma.shopMonobankPayment.updateMany({
    where: { id: payment.id, invoiceId: null, status: { in: ["new", "create_failed"] } },
    data: { status: "creating" },
  });
  if (claim.count !== 1) throw new MonobankError("MONOBANK_PAYMENT_PENDING");

  try {
    const invoice = await createMonobankInvoice(body);
    // A signed webhook may already have bound this invoice and settled the order.
    await prisma.$transaction(async (tx) => {
      const attached = await tx.shopMonobankPayment.updateMany({
        where: { id: payment.id, OR: [{ invoiceId: null }, { invoiceId: invoice.invoiceId }] },
        data: {
          invoiceId: invoice.invoiceId,
          pageUrl: invoice.pageUrl,
          expiresAt: new Date(payment.createdAt.getTime() + MONOBANK_VALIDITY_SECONDS * 1000),
        },
      });
      if (attached.count !== 1) throw new MonobankError("MONOBANK_PAYMENT_MISMATCH");
      await tx.shopMonobankPayment.updateMany({
        where: { id: payment.id, status: "creating", providerModifiedAt: null },
        data: { status: "created" },
      });
    });
    return invoice.pageUrl;
  } catch (error) {
    await prisma.shopMonobankPayment.updateMany({
      where: { id: payment.id, status: "creating", invoiceId: null },
      data: {
        status:
          error instanceof MonobankError && error.definitive ? "create_failed" : "creation_unknown",
      },
    });
    throw error;
  }
}

/** Used by both authenticated bank status reads and signature-verified webhooks. */
export async function applyMonobankStatus(prisma: PrismaClient, event: MonobankInvoiceStatus) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.shopMonobankPayment.findFirst({
      where: {
        OR: [
          { invoiceId: event.invoiceId },
          ...(event.reference ? [{ id: event.reference, invoiceId: null }] : []),
        ],
      },
      include: { order: true },
    });
    if (!payment) throw new MonobankError("MONOBANK_PAYMENT_NOT_FOUND", true);
    const update = resolveMonobankStatusUpdate(payment, payment.order, event);
    if (!update) return false;
    const claimed = await tx.shopMonobankPayment.updateMany({
      where: {
        id: payment.id,
        providerModifiedAt: payment.providerModifiedAt,
        invoiceId: payment.invoiceId,
      },
      data: {
        invoiceId: event.invoiceId,
        status: event.status,
        providerModifiedAt: update.modifiedAt,
        lastSyncedAt: new Date(),
      },
    });
    if (claimed.count !== 1) throw new MonobankError("MONOBANK_CONCURRENT_UPDATE");
    const { order } = payment;
    const status =
      update.paymentStatus === "PAID" &&
      ["PENDING_PAYMENT", "PENDING_REVIEW"].includes(order.status)
        ? "CONFIRMED"
        : order.status;
    const changed = await tx.shopOrder.updateMany({
      where: {
        id: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        amountPaid: order.amountPaid,
        total: order.total,
        paymentMethod: "MONOBANK",
      },
      data: { paymentStatus: update.paymentStatus, amountPaid: update.amountPaid, status },
    });
    if (changed.count !== 1) throw new MonobankError("MONOBANK_CONCURRENT_UPDATE");
    if (
      update.paymentStatus !== order.paymentStatus ||
      update.amountPaid !== order.amountPaid ||
      status !== order.status
    ) {
      await tx.shopOrderStatusEvent.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: status,
          actorType: "system",
          actorName: "plata by mono",
          note: `mono: ${event.status}; payment: ${update.paymentStatus}; amount: ${update.amountPaid} UAH`,
        },
      });
    }
    return true;
  });
}

/** DB-backed rate limit also covers multiple tabs / serverless instances. */
export async function refreshMonobankPayment(prisma: PrismaClient, payment: ShopMonobankPayment) {
  if (!payment.invoiceId) return false;
  const now = new Date();
  const claim = await prisma.shopMonobankPayment.updateMany({
    where: {
      id: payment.id,
      OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: new Date(now.getTime() - 15_000) } }],
    },
    data: { lastSyncedAt: now },
  });
  if (claim.count !== 1) return false;
  return applyMonobankStatus(prisma, await getMonobankInvoiceStatus(payment.invoiceId));
}

export function publicMonobankPayment(
  payment: ShopMonobankPayment | null,
  orderStatus: string,
  paymentStatus: string
) {
  if (!payment) return null;
  const closed =
    ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"].includes(paymentStatus) ||
    !["PENDING_PAYMENT", "PENDING_REVIEW"].includes(orderStatus) ||
    ["success", "reversed", "expired", "hold"].includes(payment.status) ||
    Boolean(payment.expiresAt && payment.expiresAt <= new Date());
  return {
    status: payment.status,
    canPay:
      isMonobankEnabled() &&
      !closed &&
      (["new", "create_failed"].includes(payment.status) || isMonobankPaymentUrl(payment.pageUrl)),
  };
}
