type OrderPaymentState = {
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  amountPaid: number | { toString(): string };
  isDraft: boolean;
  stripeCheckoutSessionId?: string | null;
  monobankPayment?: unknown;
};

/** Provider changes are permitted only when no external payment attempt can exist. */
export function adminMonobankBlockReason(order: OrderPaymentState): string | null {
  if (order.isDraft) return "MONOBANK_DRAFT_NOT_ACCEPTED";
  if (
    !["PENDING_REVIEW", "PENDING_PAYMENT"].includes(order.status) ||
    Number(order.amountPaid) > 0 ||
    ["PAID", "REFUNDED", "PARTIALLY_REFUNDED", "PARTIALLY_PAID"].includes(order.paymentStatus)
  )
    return "MONOBANK_ORDER_NOT_PAYABLE";
  if (
    !["FOP", "MANAGER_QUOTE", "MONOBANK"].includes(order.paymentMethod) ||
    order.stripeCheckoutSessionId ||
    (!order.monobankPayment && order.paymentStatus === "PENDING")
  )
    return "PREVIOUS_PAYMENT_UNVERIFIED";
  return null;
}
