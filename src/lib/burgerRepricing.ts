const TUNER_TYPES = new Set(["JB4 Tuners", "JB+ Tuners", "Stage 1 Tuners"]);
export const BURGER_SHIPPING_SAFETY_KG = 1;
export const BURGER_WEIGHT_ESTIMATE_RESERVE = 0.10;

export function isBurgerTunerFamily(productType: string | null | undefined): boolean {
  return TUNER_TYPES.has(productType ?? "");
}

export type BurgerPackageEstimate = {
  /** Estimated weight of the base part before selected add-ons and packing. */
  productKg: number;
  /** Extra parts supplied only with this selected configuration. */
  optionAdditions: Array<{ name: string; kg: number }>;
  /** Box, padding, and other packing materials. */
  packagingKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export type BurgerVariantPriceInput = {
  productType: string;
  /** Current Shopify price, which may be promotional. */
  supplierUsd: number;
  /** Shopify regular/compare-at price for this exact variant, when provided. */
  compareAtUsd?: number | null;
  domesticShippingUsd: number;
  packageEstimate: BurgerPackageEstimate;
  /** Digital products are priced without physical shipping or a parcel estimate. */
  requiresShipping?: boolean;
};

export type BurgerVariantPriceResult = {
  regularSupplierUsd: number;
  optionAddedKg: number;
  packedPhysicalKg: number;
  dimensionalKg: number;
  billableKg: number;
  unroundedPriceUsd: number;
  priceUsd: number;
};

export function roundBurgerPriceUpToFive(priceUsd: number): number {
  if (!Number.isFinite(priceUsd) || priceUsd < 0) {
    throw new Error("Burger price must be a non-negative number");
  }
  // Ignore only sub-cent binary floating point noise at an exact boundary.
  const centsRoundedUp = Math.ceil(priceUsd * 100 - 1e-7);
  return Math.ceil(centsRoundedUp / 500) * 5;
}

/** Quote the agreed Burger rule only when the packed weight and box are known. */
export function calculateBurgerVariantPrice(input: BurgerVariantPriceInput): BurgerVariantPriceResult {
  const regularSupplierUsd = Math.max(input.supplierUsd, input.compareAtUsd ?? 0);
  if (!Number.isFinite(input.supplierUsd) || input.supplierUsd <= 0 ||
      (input.compareAtUsd != null && (!Number.isFinite(input.compareAtUsd) || input.compareAtUsd < 0)) ||
      !Number.isFinite(input.domesticShippingUsd) || input.domesticShippingUsd < 0) {
    throw new Error("Burger price requires a valid regular supplier price and shipping amount");
  }
  if (input.requiresShipping === false) {
    const rawPriceUsd = regularSupplierUsd * 1.15;
    const unroundedPriceUsd = Math.round(rawPriceUsd * 100) / 100;
    return {
      regularSupplierUsd,
      optionAddedKg: 0,
      packedPhysicalKg: 0,
      dimensionalKg: 0,
      billableKg: 0,
      unroundedPriceUsd,
      priceUsd: roundBurgerPriceUpToFive(rawPriceUsd),
    };
  }
  const p = input.packageEstimate;
  if (!Array.isArray(p.optionAdditions)) {
    throw new Error("Burger price requires an explicit list of selected option weights");
  }
  const optionAddedKg = p.optionAdditions.reduce((sum, option) => sum + option.kg, 0);
  const values = [
    input.supplierUsd, input.domesticShippingUsd,
    p.productKg, p.packagingKg, p.lengthCm, p.widthCm, p.heightCm,
    optionAddedKg,
  ];
  if (values.some((value) => !Number.isFinite(value)) ||
      p.optionAdditions.some((option) => !option.name.trim() || !Number.isFinite(option.kg) || option.kg < 0) ||
      (input.compareAtUsd != null && (!Number.isFinite(input.compareAtUsd) || input.compareAtUsd < 0)) ||
      input.supplierUsd <= 0 || input.domesticShippingUsd < 0 ||
      p.productKg <= 0 || p.packagingKg < 0 ||
      p.lengthCm <= 0 || p.widthCm <= 0 || p.heightCm <= 0) {
    throw new Error("Burger price requires a valid source price, shipping quote, and package estimate");
  }

  const packedPhysicalKg = (p.productKg + optionAddedKg) *
    (1 + BURGER_WEIGHT_ESTIMATE_RESERVE) + p.packagingKg;
  const dimensionalKg = p.lengthCm * p.widthCm * p.heightCm / 5000;
  const billableKg = Math.ceil(Math.max(packedPhysicalKg, dimensionalKg)) +
    BURGER_SHIPPING_SAFETY_KG;
  const rawPriceUsd = ((regularSupplierUsd + input.domesticShippingUsd) * 1.15) +
    10 * billableKg;
  const unroundedPriceUsd = Math.round(rawPriceUsd * 100) / 100;
  const priceUsd = roundBurgerPriceUpToFive(rawPriceUsd);
  return { regularSupplierUsd, optionAddedKg, packedPhysicalKg, dimensionalKg, billableKg,
    unroundedPriceUsd, priceUsd };
}
