import { randomUUID } from "node:crypto";
import type { PrismaClient, ShopMonobankPayment } from "@prisma/client";
import {
  monobankIsoCode,
  monobankCheckoutKey,
  monobankMinorUnits,
  monobankRequestHash,
  isMonobankEnabled,
  MonobankError,
  removeMonobankInvoice,
} from "@/lib/shopMonobank";
import {
  prepareMonobankPayment,
  refreshMonobankPayment,
  reusableMonobankLink,
} from "@/lib/shopMonobankPayments";
import {
  internationalDeliveryAgreementMatches,
  snapshotRecord,
} from "@/lib/shopInternationalDeliveryQuote";
import { isInternationalDelivery } from "@/lib/shopInternationalCheckout";
import {
  adminMonobankBlockReason,
  adminMonobankCanReplaceProvider,
} from "./shopMonobankEligibility";
import { renewExpiredMonobankPayment } from "./shopMonobankPayments";

export type AdminMonobankOptions = {
  /** The manager confirmed the previous provider (e.g. Whitepay) was not paid. */
  replacePreviousProvider?: boolean;
};

export type AdminMonobankLink = {
  url: string;
  /** false = Mono did not answer the status check; the stored open link was re-shared. */
  statusVerified: boolean;
};

/**
 * An invoice request whose outcome never reached us (timeout, killed function) has no
 * link anyone could have paid, so after this grace period it may be requested again.
 */
export const MONOBANK_STALE_CREATION_MS = 2 * 60_000;

const PROVIDER_LABEL: Record<string, string> = {
  WHITEBIT: "Криптовалюта · Whitepay",
  WHITEPAY_CRYPTO: "Криптовалюта · Whitepay",
  WHITEPAY_FIAT: "Картка · Whitepay",
};

function isTransientMonobankError(error: unknown) {
  if (!(error instanceof MonobankError)) return false;
  return (
    error.code === "MONOBANK_REQUEST_UNCERTAIN" ||
    error.code === "MONOBANK_INVALID_RESPONSE" ||
    error.code === "MONOBANK_HTTP_429" ||
    /^MONOBANK_HTTP_5\d\d$/.test(error.code)
  );
}

async function releaseStaleInvoiceCreation(
  prisma: PrismaClient,
  payment: ShopMonobankPayment,
  actorName: string,
  now: Date
) {
  const stale =
    !payment.invoiceId &&
    (payment.status === "creation_unknown" ||
      (payment.status === "creating" &&
        payment.updatedAt.getTime() < now.getTime() - MONOBANK_STALE_CREATION_MS));
  if (!stale) return;
  await prisma.$transaction(async (tx) => {
    const released = await tx.shopMonobankPayment.updateMany({
      where: {
        id: payment.id,
        invoiceId: null,
        status: payment.status,
        updatedAt: payment.updatedAt,
      },
      data: { status: "new" },
    });
    if (released.count !== 1) return;
    const order = await tx.shopOrder.findUniqueOrThrow({ where: { id: payment.orderId } });
    await tx.shopOrderStatusEvent.create({
      data: {
        orderId: payment.orderId,
        fromStatus: order.status,
        toStatus: order.status,
        actorType: "admin",
        actorName,
        note: "mono: попередній запит на рахунок не завершився, посилання ніхто не отримав. Створюємо новий рахунок.",
      },
    });
  });
}

export async function prepareAdminMonobankPayment(
  prisma: PrismaClient,
  orderId: string,
  locale: string,
  actorName: string,
  options: AdminMonobankOptions = {}
): Promise<AdminMonobankLink> {
  if (!isMonobankEnabled()) throw new MonobankError("MONOBANK_NOT_CONFIGURED", true);
  const current = await prisma.shopOrder.findUnique({
    where: { id: orderId },
    include: { monobankPayment: true },
  });
  if (!current) throw new MonobankError("ORDER_NOT_FOUND", true);
  const replaceProvider =
    options.replacePreviousProvider === true && adminMonobankCanReplaceProvider(current);
  const blocked = adminMonobankBlockReason(current);
  if (blocked && !(replaceProvider && blocked === "PREVIOUS_PAYMENT_UNVERIFIED"))
    throw new MonobankError(blocked, true);
  if (current.monobankPayment?.invoiceId) {
    // An explicit admin retry must read the bank even if the buyer just polled.
    try {
      await refreshMonobankPayment(prisma, current.monobankPayment, true);
    } catch (error) {
      // Mono is slow or down: the stored open invoice can still be handed out.
      const link = isTransientMonobankError(error)
        ? reusableMonobankLink(current.monobankPayment)
        : null;
      if (link) return { url: link, statusVerified: false };
      throw error;
    }
  } else if (current.monobankPayment) {
    await releaseStaleInvoiceCreation(prisma, current.monobankPayment, actorName, new Date());
  }
  await prisma.$transaction(async (tx) => {
    const order = await tx.shopOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { monobankPayment: true },
    });
    const reason = adminMonobankBlockReason(order);
    const replacing =
      replaceProvider &&
      reason === "PREVIOUS_PAYMENT_UNVERIFIED" &&
      adminMonobankCanReplaceProvider(order);
    if (reason && !replacing) throw new MonobankError(reason, true);
    // The invoice uses the order's currency: hryvnia for Ukraine, and for a buyer
    // abroad the UAH/EUR/USD the manager agreed with them.
    const country = String(snapshotRecord(order.shippingAddress).country ?? "");
    const ccy = monobankIsoCode(order.currency);
    if (ccy === null || (!isInternationalDelivery(country) && order.currency !== "UAH"))
      throw new MonobankError("MONOBANK_REQUIRES_UAH_QUOTE", true);
    if (
      isInternationalDelivery(country) &&
      !internationalDeliveryAgreementMatches(order.pricingSnapshot, order.currency, order.total)
    )
      throw new MonobankError("INTERNATIONAL_DELIVERY_NOT_AGREED", true);
    if (order.monobankPayment) return;
    const amount = monobankMinorUnits(order.total);
    if (amount <= 0 || amount > 2_147_483_647)
      throw new MonobankError("MONOBANK_INVALID_AMOUNT", true);
    await tx.shopMonobankPayment.upsert({
      where: { orderId },
      update: {},
      create: {
        orderId,
        checkoutKeyHash: monobankCheckoutKey(randomUUID()),
        requestHash: monobankRequestHash(
          { orderId, amount, currency: order.currency },
          order.customerId
        ),
        amount,
        ccy,
      },
    });
    const changed = await tx.shopOrder.updateMany({
      where: {
        id: orderId,
        updatedAt: order.updatedAt,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        amountPaid: 0,
        total: order.total,
        status: order.status,
      },
      data: { paymentMethod: "MONOBANK", paymentStatus: "PENDING", status: "PENDING_PAYMENT" },
    });
    if (changed.count !== 1) throw new MonobankError("MONOBANK_CONCURRENT_UPDATE");
    await tx.shopOrderStatusEvent.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: "PENDING_PAYMENT",
        actorType: "admin",
        actorName,
        note: replacing
          ? `${actorName} підтвердив(ла), що оплати через «${PROVIDER_LABEL[order.paymentMethod] ?? order.paymentMethod}» немає. Спосіб оплати змінено на plata by mono. Якщо клієнт все ж оплатить попереднім способом — потрібне повернення коштів.`
          : "Підготовка посилання plata by mono після перевірки статусу оплати.",
      },
    });
  });
  await renewExpiredMonobankPayment(prisma, orderId, actorName);
  // A buyer abroad reads the bank page's basket in English ("Shipping", not «Доставка»).
  const invoiceLocale = isInternationalDelivery(
    String(snapshotRecord(current.shippingAddress).country ?? "")
  )
    ? "en"
    : locale;
  return {
    url: await prepareMonobankPayment(prisma, orderId, invoiceLocale),
    statusVerified: true,
  };
}

const PAID_STATUSES = ["PAID", "PARTIALLY_PAID", "REFUNDED", "PARTIALLY_REFUNDED"];

/** Why «Змінити замовлення» cannot reopen this order (null: it can). */
export function adminMonobankChangeBlockReason(order: {
  isDraft: boolean;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  amountPaid: number | { toString(): string };
}): string | null {
  if (order.isDraft) return "MONOBANK_DRAFT_NOT_ACCEPTED";
  if (Number(order.amountPaid) > 0 || PAID_STATUSES.includes(order.paymentStatus))
    return "MONOBANK_ORDER_NOT_PAYABLE";
  if (
    order.paymentMethod !== "MONOBANK" ||
    !["PENDING_REVIEW", "PENDING_PAYMENT"].includes(order.status)
  )
    return "ORDER_NOT_CHANGEABLE";
  return null;
}

/**
 * «Змінити замовлення»: invalidates the open mono link at the bank so the order's items,
 * prices and currency can change. Delivery in Ukraine stays a mono order (edit, then issue
 * a new hryvnia link); abroad it goes back to «за погодженням менеджера», where the manager
 * picks UAH/EUR/USD, agrees the total and issues the new link.
 */
export async function cancelAdminMonobankLink(
  prisma: PrismaClient,
  orderId: string,
  actorName: string
) {
  if (!isMonobankEnabled()) throw new MonobankError("MONOBANK_NOT_CONFIGURED", true);
  const current = await prisma.shopOrder.findUnique({
    where: { id: orderId },
    include: { monobankPayment: true },
  });
  if (!current) throw new MonobankError("ORDER_NOT_FOUND", true);
  const blocked = adminMonobankChangeBlockReason(current);
  if (blocked) throw new MonobankError(blocked, true);

  let payment = current.monobankPayment;
  // An invoice may be being created this very moment: never orphan it at the bank.
  if (payment && !payment.invoiceId && payment.status === "creating")
    throw new MonobankError("MONOBANK_PAYMENT_PENDING");
  if (payment?.invoiceId) {
    // Read the bank first: a payment in progress must never be cut off.
    await refreshMonobankPayment(prisma, payment, true);
    payment = await prisma.shopMonobankPayment.findUnique({ where: { id: payment.id } });
    if (!payment?.invoiceId) throw new MonobankError("MONOBANK_CONCURRENT_UPDATE");
    if (["success", "processing", "hold"].includes(payment.status))
      throw new MonobankError("MONOBANK_PAYMENT_IN_PROGRESS", true);
    if (!["expired", "reversed"].includes(payment.status))
      await removeMonobankInvoice(payment.invoiceId);
  }

  const international = isInternationalDelivery(
    String(snapshotRecord(current.shippingAddress).country ?? "")
  );
  await prisma.$transaction(async (tx) => {
    const order = await tx.shopOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { monobankPayment: true },
    });
    const reason = adminMonobankChangeBlockReason(order);
    if (reason) throw new MonobankError(reason, true);
    const row = order.monobankPayment;
    if (row && (row.id !== payment?.id || row.invoiceId !== payment?.invoiceId))
      throw new MonobankError("MONOBANK_CONCURRENT_UPDATE");
    if (row) {
      // The invalidated invoice stays on record: a late bank event can still be matched.
      if (row.invoiceId)
        await tx.shopMonobankPaymentHistory.create({
          data: {
            id: row.id,
            orderId,
            invoiceId: row.invoiceId,
            amount: row.amount,
            ccy: row.ccy,
            status: "removed",
            providerModifiedAt: row.providerModifiedAt,
          },
        });
      await tx.shopMonobankPayment.delete({ where: { id: row.id } });
    }
    const changed = await tx.shopOrder.updateMany({
      where: {
        id: orderId,
        updatedAt: order.updatedAt,
        paymentMethod: "MONOBANK",
        paymentStatus: order.paymentStatus,
        amountPaid: 0,
      },
      data: {
        paymentStatus: "UNPAID",
        ...(international ? { paymentMethod: "MANAGER_QUOTE" } : {}),
      },
    });
    if (changed.count !== 1) throw new MonobankError("MONOBANK_CONCURRENT_UPDATE");
    await tx.shopOrderStatusEvent.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: order.status,
        actorType: "admin",
        actorName,
        note:
          (row?.invoiceId
            ? `mono: посилання ${row.invoiceId} скасовано в банку, щоб змінити замовлення.`
            : "Замовлення відкрито для змін.") +
          (international
            ? " Погодьте суму й валюту заново та видайте нове посилання."
            : " Після змін видайте нове посилання."),
      },
    });
  });
  return { international, invoiceId: payment?.invoiceId ?? null };
}
