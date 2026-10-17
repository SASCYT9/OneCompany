import { isInternationalDelivery } from "./shopInternationalCheckout";

type OrderBillingRegion = { currency?: string; shippingAddress?: unknown };

type OrderPaymentState = OrderBillingRegion & {
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  amountPaid: number | { toString(): string };
  isDraft: boolean;
  stripeCheckoutSessionId?: string | null;
  monobankPayment?: unknown;
};

/**
 * Delivery in Ukraine is billed in hryvnia only; EUR/USD invoices are for buyers abroad.
 * Checked whenever a link is issued, reused, shown or emailed, because a manager may
 * change the delivery country after the invoice exists.
 */
export function monobankCurrencyBlockReason(order: OrderBillingRegion): string | null {
  if (order.currency === undefined) return null;
  const address = order.shippingAddress;
  const country =
    address && typeof address === "object" && !Array.isArray(address)
      ? String((address as Record<string, unknown>).country ?? "")
      : "";
  return order.currency.toUpperCase() !== "UAH" && !isInternationalDelivery(country)
    ? "MONOBANK_REQUIRES_UAH_QUOTE"
    : null;
}

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
  return monobankCurrencyBlockReason(order);
}

/**
 * The previous provider (Whitepay crypto/fiat, an unconfirmed pending payment) cannot be
 * read back automatically, so a manager may confirm it was not paid and switch to mono.
 * Legacy Stripe sessions stay blocked: they need reconciliation in Stripe.
 */
export function adminMonobankCanReplaceProvider(order: OrderPaymentState): boolean {
  return (
    adminMonobankBlockReason(order) === "PREVIOUS_PAYMENT_UNVERIFIED" &&
    !order.stripeCheckoutSessionId &&
    !order.monobankPayment
  );
}
