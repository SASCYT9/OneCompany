/** The storefront price rule for products manufactured by do88. */
export const DO88_CUSTOMER_MARKUP = 0.10;

/**
 * Calculate EUR storefront price from do88performance.eu's Consumer / Incl. VAT
 * price. Keep the supplier price as the base so repeated syncs never compound.
 */
export function calculateDo88CustomerPriceEur(sourceCustomerPriceEur: number): number {
  if (!Number.isFinite(sourceCustomerPriceEur) || sourceCustomerPriceEur <= 0) {
    throw new Error("do88 customer source price must be a positive finite number");
  }

  return Math.round((sourceCustomerPriceEur * (1 + DO88_CUSTOMER_MARKUP) + Number.EPSILON) * 100) / 100;
}
