type PaymentValues = {
  paymentStatus: string;
  amountPaid: number;
  deliveryMethod: string | null;
  ttnNumber: string | null;
  shippingCalculatedCost: number | null;
};
export type OrderPaymentDraft = {
  paymentStatus: string;
  amountPaid: string;
  deliveryMethod: string;
  ttnNumber: string;
  shippingCalculatedCost: string;
};

export function buildOrderPaymentUpdate(
  order: PaymentValues,
  draft: OrderPaymentDraft
): Partial<PaymentValues> {
  const amountPaid = Number(draft.amountPaid);
  const shippingCalculatedCost =
    draft.shippingCalculatedCost.trim() === "" ? null : Number(draft.shippingCalculatedCost);
  if (!draft.amountPaid.trim() || !Number.isFinite(amountPaid) || amountPaid < 0)
    throw new Error("Вкажіть коректну сплачену суму, не меншу за нуль.");
  if (
    shippingCalculatedCost !== null &&
    (!Number.isFinite(shippingCalculatedCost) || shippingCalculatedCost < 0)
  )
    throw new Error("Вартість доставки має бути невід’ємним числом.");
  const patch: Partial<PaymentValues> = {};
  if (draft.paymentStatus !== order.paymentStatus) patch.paymentStatus = draft.paymentStatus;
  if (amountPaid !== order.amountPaid) patch.amountPaid = amountPaid;
  if (draft.deliveryMethod !== (order.deliveryMethod || ""))
    patch.deliveryMethod = draft.deliveryMethod || null;
  if (draft.ttnNumber !== (order.ttnNumber || "")) patch.ttnNumber = draft.ttnNumber || null;
  // Sending an unchanged null here would reset the order's existing shipping charge.
  if (shippingCalculatedCost !== order.shippingCalculatedCost)
    patch.shippingCalculatedCost = shippingCalculatedCost;
  return patch;
}
