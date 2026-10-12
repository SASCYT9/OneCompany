import { randomUUID } from "node:crypto";
import type { PrismaClient, ShopMonobankPayment } from "@prisma/client";
import {
  monobankCheckoutKey,
  monobankMinorUnits,
  monobankRequestHash,
  isMonobankEnabled,
  MonobankError,
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
    if (order.currency !== "UAH") throw new MonobankError("MONOBANK_REQUIRES_UAH_QUOTE", true);
    const country = String(snapshotRecord(order.shippingAddress).country ?? "");
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
        requestHash: monobankRequestHash({ orderId, amount, currency: "UAH" }, order.customerId),
        amount,
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
  return { url: await prepareMonobankPayment(prisma, orderId, locale), statusVerified: true };
}
