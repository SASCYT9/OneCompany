import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import {
  monobankCheckoutKey,
  monobankMinorUnits,
  monobankRequestHash,
  isMonobankEnabled,
  MonobankError,
} from "@/lib/shopMonobank";
import { prepareMonobankPayment, refreshMonobankPayment } from "@/lib/shopMonobankPayments";
import {
  internationalDeliveryAgreementMatches,
  snapshotRecord,
} from "@/lib/shopInternationalDeliveryQuote";
import { isInternationalDelivery } from "@/lib/shopInternationalCheckout";

export async function prepareAdminMonobankPayment(
  prisma: PrismaClient,
  orderId: string,
  locale: string,
  actorName: string
) {
  if (!isMonobankEnabled()) throw new MonobankError("MONOBANK_NOT_CONFIGURED", true);
  const current = await prisma.shopOrder.findUnique({
    where: { id: orderId },
    include: { monobankPayment: true },
  });
  if (!current) throw new MonobankError("ORDER_NOT_FOUND", true);
  if (current.monobankPayment?.invoiceId) {
    // An explicit admin retry must read the bank even if the buyer just polled.
    // A failed status read stops the operation before a payment URL is returned.
    await refreshMonobankPayment(prisma, current.monobankPayment, true);
  }
  await prisma.$transaction(async (tx) => {
    const order = await tx.shopOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { monobankPayment: true },
    });
    if (
      order.amountPaid > 0 ||
      ["PAID", "REFUNDED", "PARTIALLY_REFUNDED", "PARTIALLY_PAID"].includes(order.paymentStatus) ||
      !["PENDING_REVIEW", "PENDING_PAYMENT"].includes(order.status)
    )
      throw new MonobankError("MONOBANK_ORDER_NOT_PAYABLE", true);
    if (order.currency !== "UAH") throw new MonobankError("MONOBANK_REQUIRES_UAH_QUOTE", true);
    const country = String(snapshotRecord(order.shippingAddress).country ?? "");
    if (
      isInternationalDelivery(country) &&
      !internationalDeliveryAgreementMatches(order.pricingSnapshot, order.currency, order.total)
    )
      throw new MonobankError("INTERNATIONAL_DELIVERY_NOT_AGREED", true);
    if (
      !["FOP", "MANAGER_QUOTE", "MONOBANK"].includes(order.paymentMethod) ||
      order.stripeCheckoutSessionId
    )
      throw new MonobankError("OTHER_PAYMENT_PROVIDER_REVIEW_REQUIRED", true);
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
        note: "Підготовка посилання plata by mono після перевірки статусу оплати.",
      },
    });
  });
  return prepareMonobankPayment(prisma, orderId, locale);
}
