export const ATOMIC_UAH_PER_EUR = 52;
// This supplier discount applies only to products explicitly scoped as Moto.
export const ATOMIC_MOTO_DISCOUNT_PERCENT = 3;

export type AtomicPricing = {
  priceUah: number;
  priceEur: number;
  compareAtUah: number;
  compareAtEur: number;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseAmount(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;

  let normalized = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/[^\d.,+-]/g, "");
  if (!normalized) return undefined;

  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    normalized =
      lastComma > lastDot
        ? normalized.replace(/\./g, "").replace(",", ".")
        : normalized.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const decimalDigits = normalized.length - lastComma - 1;
    normalized =
      decimalDigits > 0 && decimalDigits <= 2
        ? normalized.replace(",", ".")
        : normalized.replace(/,/g, "");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? roundMoney(parsed) : undefined;
}

export function parseAtomicPriceUah(row: Record<string, unknown>): number | undefined {
  for (const candidate of [row.price_uah, row.price, row.retail, row.rrp]) {
    const parsed = parseAmount(candidate);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

export function calculateAtomicPricing(
  priceUah: number,
  scope: "moto" | "other" = "other"
): AtomicPricing | null {
  if (!Number.isFinite(priceUah) || priceUah <= 0) return null;

  const exactAtomicPriceUah = roundMoney(priceUah);
  const discountPercent = scope === "moto" ? ATOMIC_MOTO_DISCOUNT_PERCENT : 0;
  const discountedPriceUah = roundMoney(exactAtomicPriceUah * (1 - discountPercent / 100));
  const priceEur = roundMoney(discountedPriceUah / ATOMIC_UAH_PER_EUR);
  const compareAtEur = roundMoney(exactAtomicPriceUah / ATOMIC_UAH_PER_EUR);
  if (discountedPriceUah <= 0 || priceEur <= 0 || compareAtEur <= 0) return null;

  return {
    priceUah: discountedPriceUah,
    priceEur,
    compareAtUah: exactAtomicPriceUah,
    compareAtEur,
  };
}
