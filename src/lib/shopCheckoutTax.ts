const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateTaxAmount(region: { rate: number; appliesToShipping: boolean } | null, taxableSubtotal: number, taxableShippingCost: number) {
  if (!region || region.rate <= 0) return 0;
  const base = taxableSubtotal + (region.appliesToShipping ? taxableShippingCost : 0);
  if (base <= 0) return 0;
  return roundMoney(base * region.rate);
}

export function calculateProportionalAmount(amount: number, numerator: number, denominator: number) {
  if (amount <= 0 || numerator <= 0 || denominator <= 0) return 0;
  const ratio = Math.min(1, numerator / denominator);
  return roundMoney(amount * ratio);
}
