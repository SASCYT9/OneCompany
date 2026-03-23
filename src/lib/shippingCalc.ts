/**
 * Shipping calculator for B2B orders.
 *
 * Weight conversion:  Turn14 items are in LBS → we convert to KG
 * Volumetric weight:  L × W × H (cm) / 5000
 * Shipping cost:      actualWeight × ratePerKg + max(0, volWeight − actualWeight) × volSurchargePerKg
 *
 * All values are editable in the admin UI; this module provides sensible defaults.
 */

// ─── Constants ────────────────────────────────────────────────

const LBS_TO_KG = 0.453592;

// ─── Zone profiles ───────────────────────────────────────────

export type ShippingZone = 'UA' | 'KZ' | 'EU' | 'US' | 'OTHER';

export interface ShippingZoneProfile {
  label: string;
  labelUa: string;
  ratePerKg: number;        // USD per kg (actual weight)
  volSurchargePerKg: number; // USD per kg of volumetric *surcharge* (vol − actual)
  baseFee: number;           // flat base handling fee in USD
}

export const SHIPPING_ZONES: Record<ShippingZone, ShippingZoneProfile> = {
  KZ: {
    label: 'Kazakhstan',
    labelUa: 'Казахстан',
    ratePerKg: 14,
    volSurchargePerKg: 2,
    baseFee: 0,
  },
  UA: {
    label: 'Ukraine (domestic)',
    labelUa: 'Україна',
    ratePerKg: 1.5,
    volSurchargePerKg: 0.5,
    baseFee: 3,
  },
  EU: {
    label: 'Europe',
    labelUa: 'Європа',
    ratePerKg: 8,
    volSurchargePerKg: 1.5,
    baseFee: 10,
  },
  US: {
    label: 'USA (domestic)',
    labelUa: 'США',
    ratePerKg: 5,
    volSurchargePerKg: 1,
    baseFee: 8,
  },
  OTHER: {
    label: 'Rest of world',
    labelUa: 'Інший регіон',
    ratePerKg: 16,
    volSurchargePerKg: 3,
    baseFee: 15,
  },
};

// ─── Conversion helpers ──────────────────────────────────────

/** Convert pounds to kilograms. */
export function lbsToKg(lbs: number): number {
  return Math.round(lbs * LBS_TO_KG * 1000) / 1000; // 3 decimal precision
}

/** Convert kilograms to pounds. */
export function kgToLbs(kg: number): number {
  return Math.round((kg / LBS_TO_KG) * 1000) / 1000;
}

/** Calculate volumetric weight from dimensions in centimeters. */
export function volumetricWeightKg(
  lengthCm: number,
  widthCm: number,
  heightCm: number,
): number {
  if (lengthCm <= 0 || widthCm <= 0 || heightCm <= 0) return 0;
  return Math.round((lengthCm * widthCm * heightCm) / 5000 * 1000) / 1000;
}

// ─── Shipping cost calculation ───────────────────────────────

export interface ShippingCalcInput {
  /** Actual weight in KG (already converted from LBS if needed). */
  actualWeightKg: number;
  /** Dimensions in centimeters for volumetric calc. Set to 0 if unknown. */
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  /** Shipping zone. */
  zone: ShippingZone;
  /** Override rate per kg (defaults to zone profile). */
  ratePerKg?: number;
  /** Override volumetric surcharge per kg (defaults to zone profile). */
  volSurchargePerKg?: number;
  /** Override base fee (defaults to zone profile). */
  baseFee?: number;
}

export interface ShippingCalcResult {
  actualWeightKg: number;
  volWeightKg: number;
  /** Extra kg that volumetric exceeds actual (max 0). */
  volSurchargeKg: number;
  ratePerKg: number;
  volSurchargePerKg: number;
  baseFee: number;
  /** Base shipping: actualWeightKg × ratePerKg. */
  baseCost: number;
  /** Volumetric surcharge: volSurchargeKg × volSurchargePerKg. */
  volCost: number;
  /** Total shipping: baseFee + baseCost + volCost. */
  totalShipping: number;
  zone: ShippingZone;
}

export function calcShipping(input: ShippingCalcInput): ShippingCalcResult {
  const profile = SHIPPING_ZONES[input.zone] || SHIPPING_ZONES.OTHER;

  const ratePerKg = input.ratePerKg ?? profile.ratePerKg;
  const volSurchargePerKg = input.volSurchargePerKg ?? profile.volSurchargePerKg;
  const baseFee = input.baseFee ?? profile.baseFee;
  const actualWeightKg = Math.max(0, input.actualWeightKg);

  const volWeightKg = volumetricWeightKg(input.lengthCm, input.widthCm, input.heightCm);
  const volSurchargeKg = Math.max(0, volWeightKg - actualWeightKg);

  const baseCost = round2(actualWeightKg * ratePerKg);
  const volCost = round2(volSurchargeKg * volSurchargePerKg);
  const totalShipping = round2(baseFee + baseCost + volCost);

  return {
    actualWeightKg,
    volWeightKg,
    volSurchargeKg,
    ratePerKg,
    volSurchargePerKg,
    baseFee,
    baseCost,
    volCost,
    totalShipping,
    zone: input.zone,
  };
}

// ─── Price calculation ───────────────────────────────────────

export interface OrderPriceCalcInput {
  /** Base cost from supplier (e.g. Turn14 dealer price) in USD. */
  baseCostUsd: number;
  /** Markup percentage to apply on top of base cost. */
  markupPct: number;
  /** Customer discount percentage. */
  discountPct: number;
  /** Quantity. */
  quantity: number;
}

export interface OrderPriceCalcResult {
  baseCostUsd: number;
  markupPct: number;
  markedUpPrice: number;
  discountPct: number;
  discountAmount: number;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export function calcItemPrice(input: OrderPriceCalcInput): OrderPriceCalcResult {
  const markedUpPrice = round2(input.baseCostUsd * (1 + input.markupPct / 100));
  const discountAmount = round2(markedUpPrice * (input.discountPct / 100));
  const unitPrice = round2(markedUpPrice - discountAmount);
  const lineTotal = round2(unitPrice * input.quantity);

  return {
    baseCostUsd: input.baseCostUsd,
    markupPct: input.markupPct,
    markedUpPrice,
    discountPct: input.discountPct,
    discountAmount,
    unitPrice,
    quantity: input.quantity,
    lineTotal,
  };
}

// ─── Utils ───────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
