import type { PrismaClient, ShopMonobankPayment } from "@prisma/client";
import { adminMonobankBlockReason } from "./shopMonobankEligibility";
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

/** One active invoice per order. An uncertain POST must never create another. */
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
    order.isDraft ||
    order.currency !== "UAH" ||
    monobankMinorUnits(order.total) !== payment.amount ||
    order.amountPaid > 0 ||
    ["PAID", "REFUNDED", "PARTIALLY_REFUNDED", "PARTIALLY_PAID"].includes(order.paymentStatus) ||
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

  const invoiceRequestedAt = new Date();
  try {
    const invoice = await createMonobankInvoice(body);
    // A signed webhook may already have bound this invoice and settled the order.
    const stillPayable = await prisma.$transaction(async (tx) => {
      const attached = await tx.shopMonobankPayment.updateMany({
        where: { id: payment.id, OR: [{ invoiceId: null }, { invoiceId: invoice.invoiceId }] },
        data: {
          invoiceId: invoice.invoiceId,
          pageUrl: invoice.pageUrl,
          expiresAt: new Date(invoiceRequestedAt.getTime() + MONOBANK_VALIDITY_SECONDS * 1000),
        },
      });
      if (attached.count !== 1) throw new MonobankError("MONOBANK_PAYMENT_MISMATCH");
      await tx.shopMonobankPayment.updateMany({
        where: { id: payment.id, status: "creating", providerModifiedAt: null },
        data: { status: "created" },
      });
      const currentOrder = await tx.shopOrder.findUniqueOrThrow({ where: { id: orderId }, include: { monobankPayment: true } });
      return adminMonobankBlockReason(currentOrder) === null;
    });
    if (!stillPayable) throw new MonobankError("MONOBANK_ORDER_NOT_PAYABLE", true);
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

/** Only a fresh authenticated bank response of expired permits invoice replacement. */
export async function renewExpiredMonobankPayment(prisma: PrismaClient, orderId: string, actorName: string) {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.shopMonobankPayment.findUnique({ where: { orderId }, include: { order: true } });
    if (!payment?.invoiceId || payment.status !== "expired") return;
    // Serialize renewal with callbacks and other admin tabs; re-read after acquiring the lock.
    const claimed = await tx.shopMonobankPayment.updateMany({
      where: { id: payment.id, invoiceId: payment.invoiceId, status: "expired", providerModifiedAt: payment.providerModifiedAt },
      data: { status: "retiring" },
    });
    if (claimed.count !== 1) throw new MonobankError("MONOBANK_CONCURRENT_UPDATE");
    const order = await tx.shopOrder.findUniqueOrThrow({ where: { id: orderId }, include: { monobankPayment: true } });
    const reason = adminMonobankBlockReason(order);
    if (reason) throw new MonobankError(reason, true);
    if (monobankMinorUnits(order.total) !== payment.amount) throw new MonobankError("MONOBANK_PAYMENT_MISMATCH", true);
    await tx.shopMonobankPaymentHistory.create({ data: {
      id: payment.id, orderId, invoiceId: payment.invoiceId, amount: payment.amount, ccy: payment.ccy,
      status: "expired", providerModifiedAt: payment.providerModifiedAt,
    } });
    await tx.shopMonobankPayment.delete({ where: { id: payment.id } });
    await tx.shopMonobankPayment.create({ data: {
      orderId, checkoutKeyHash: payment.checkoutKeyHash, requestHash: payment.requestHash, amount: payment.amount, ccy: payment.ccy,
    } });
    const changed = await tx.shopOrder.updateMany({
      where: { id: orderId, updatedAt: order.updatedAt, amountPaid: 0, paymentStatus: order.paymentStatus, status: order.status },
      data: { paymentStatus: "PENDING" },
    });
    if (changed.count !== 1) throw new MonobankError("MONOBANK_CONCURRENT_UPDATE");
    await tx.shopOrderStatusEvent.create({ data: {
      orderId, fromStatus: order.status, toStatus: order.status, actorType: "admin", actorName,
      note: `mono: банк підтвердив завершення строку рахунку ${payment.invoiceId}; попередній рахунок збережено в історії.`,
    } });
  });
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
    if (!payment) {
      const history = await tx.shopMonobankPaymentHistory.findUnique({ where: { invoiceId: event.invoiceId } });
      if (!history) throw new MonobankError("MONOBANK_PAYMENT_NOT_FOUND", true);
      if (event.amount !== history.amount || event.ccy !== history.ccy ||
          (event.reference !== undefined && event.reference !== history.id))
        throw new MonobankError("MONOBANK_PAYMENT_MISMATCH", true);
      const modifiedAt = new Date(event.modifiedDate);
      if (history.providerModifiedAt && modifiedAt <= history.providerModifiedAt) return false;
      if (event.status === "success" && event.finalAmount === undefined)
        throw new MonobankError("MONOBANK_FINAL_AMOUNT_REQUIRED", true);
      const finalAmount = event.status === "success" || event.status === "reversed" ? event.finalAmount ?? 0 : history.finalAmount;
      const claimed = await tx.shopMonobankPaymentHistory.updateMany({
        where: { id: history.id, providerModifiedAt: history.providerModifiedAt },
        data: { status: event.status, providerModifiedAt: modifiedAt, finalAmount },
      });
      if (claimed.count !== 1) throw new MonobankError("MONOBANK_CONCURRENT_UPDATE");
      if (finalAmount > 0 || history.finalAmount > 0) {
        // An unexpected financial event on a retired invoice requires reconciliation.
        // Never let an old failure/expiration cancel the active invoice or mark it unpaid.
        const order = await tx.shopOrder.findUniqueOrThrow({ where: { id: history.orderId } });
        await tx.shopOrder.update({ where: { id: order.id }, data: { paymentStatus: "PARTIALLY_PAID", amountPaid: { increment: (finalAmount - history.finalAmount) / 100 } } });
        await tx.shopOrderStatusEvent.create({ data: { orderId: order.id, fromStatus: order.status, toStatus: order.status, actorType: "system", actorName: "plata by mono",
          note: `Потрібна звірка оплати: фінансова зміна старого mono-рахунку ${event.invoiceId}; активне посилання заблоковано.` } });
      }
      return true;
    }
    if (await tx.shopMonobankPaymentHistory.count({ where: { orderId: payment.orderId, finalAmount: { gt: 0 } } }))
      throw new MonobankError("MONOBANK_RECONCILIATION_REQUIRED", true);
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
export async function refreshMonobankPayment(prisma: PrismaClient, payment: ShopMonobankPayment, force = false) {
  if (!payment.invoiceId) return false;
  const now = new Date();
  const claim = await prisma.shopMonobankPayment.updateMany({
    where: {
      id: payment.id,
      ...(force ? {} : { OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: new Date(now.getTime() - 15_000) } }] }),
    },
    data: { lastSyncedAt: now },
  });
  if (claim.count !== 1) return false;
  return applyMonobankStatus(prisma, await getMonobankInvoiceStatus(payment.invoiceId));
}

export function publicMonobankPayment(
  payment: ShopMonobankPayment | null,
  orderStatus: string,
  paymentStatus: string,
  amountPaid = 0
) {
  if (!payment) return null;
  const closed =
    amountPaid > 0 ||
    ["PAID", "REFUNDED", "PARTIALLY_REFUNDED", "PARTIALLY_PAID"].includes(paymentStatus) ||
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
