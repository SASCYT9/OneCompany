import type { PrismaClient, ShopOrder } from "@prisma/client";

type PayableOrder = Pick<ShopOrder, "id" | "updatedAt" | "total" | "currency" | "status" | "paymentMethod" | "paymentStatus" | "amountPaid" | "stripeCheckoutSessionId" | "isDraft">;

export function whitepayOrderEligibilityError(order: PayableOrder) {
  if (!["FOP", "MANAGER_QUOTE"].includes(order.paymentMethod) || order.stripeCheckoutSessionId)
    return "OTHER_PAYMENT_PROVIDER_REVIEW_REQUIRED";
  if (order.paymentStatus !== "UNPAID" || order.amountPaid !== 0 || order.isDraft ||
    !["PENDING_REVIEW", "PENDING_PAYMENT"].includes(order.status) ||
    !Number.isFinite(Number(order.total)) || Number(order.total) <= 0)
    return "WHITEPAY_ORDER_NOT_PAYABLE";
  return null;
}

export async function claimAdminWhitepayOrder(prisma: PrismaClient, order: PayableOrder, method: "WHITEPAY_FIAT" | "WHITEPAY_CRYPTO") {
  // Claim before the external call. An ambiguous provider response retains the
  // claim for merchant reconciliation; retrying must never create another charge.
  const changed = await prisma.shopOrder.updateMany({
    where: {
      id: order.id, updatedAt: order.updatedAt, total: order.total, currency: order.currency,
      status: order.status, paymentMethod: order.paymentMethod, paymentStatus: "UNPAID",
      amountPaid: 0, isDraft: false, stripeCheckoutSessionId: null,
      monobankPayment: { is: null },
    },
    data: { paymentMethod: method, paymentStatus: "PENDING", status: "PENDING_PAYMENT" },
  });
  return changed.count === 1;
}
