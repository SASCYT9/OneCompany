/**
 * Forged-wheel "from €X" estimate.
 *
 * IMPORTANT: this is a starting estimate shown in the configurator —
 * NOT a binding price. Final price always goes through manual quote.
 * The estimate exists purely so customers don't bounce off "request a
 * quote" with no cost anchor.
 *
 * Calibrate the multipliers and deltas after the first physical batch
 * with real margin data.
 */

import { findForgedDesign } from "@/data/forgedDesigns";
import type { Diameter, ForgedConfig, Material, WidthJ } from "./configSchema";

const MATERIAL_MULT: Record<Material, number> = {
  aluminium: 1.0,
  magnesium: 3.5,
  carbon: 6.0,
};

const BASELINE_DIAMETER: Diameter = 18;
const PER_INCH_OVER_BASELINE = 100;
const PER_J_OVER_9 = 60;
const STAGGERED_FITMENT_PREMIUM = 80;

/**
 * Estimate the "from" price of a 4-wheel set in EUR.
 * Returns a value rounded UP to the nearest €50.
 */
export function estimateForgedSetPriceEur(input: {
  designSlug: string;
  diameter: Diameter;
  widthFront: WidthJ;
  widthRear: WidthJ;
  material: Material;
}): number | null {
  const design = findForgedDesign(input.designSlug);
  if (!design) return null;

  const base = design.basePriceEur;
  const diameterDelta = Math.max(0, input.diameter - BASELINE_DIAMETER) * PER_INCH_OVER_BASELINE;

  const avgWidth = (input.widthFront + input.widthRear) / 2;
  const widthDelta = Math.max(0, avgWidth - 9) * PER_J_OVER_9;

  const staggeredDelta = input.widthFront !== input.widthRear ? STAGGERED_FITMENT_PREMIUM : 0;

  const beforeMaterial = base + diameterDelta + widthDelta + staggeredDelta;
  const afterMaterial = beforeMaterial * MATERIAL_MULT[input.material];

  return Math.ceil(afterMaterial / 50) * 50;
}

/**
 * Convenience wrapper for the configurator state shape.
 */
export function estimateFromConfig(c: ForgedConfig): number | null {
  return estimateForgedSetPriceEur({
    designSlug: c.designSlug,
    diameter: c.diameter,
    widthFront: c.widthFront,
    widthRear: c.widthRear,
    material: c.material,
  });
}

/**
 * Lightweight breakdown used by the ConfigSummary tooltip so the customer
 * understands what's driving the number.
 */
export function priceBreakdownEur(c: ForgedConfig): Array<{ label: string; valueEur: number }> {
  const design = findForgedDesign(c.designSlug);
  if (!design) return [];
  const base = design.basePriceEur;
  const diameterDelta = Math.max(0, c.diameter - BASELINE_DIAMETER) * PER_INCH_OVER_BASELINE;
  const avgWidth = (c.widthFront + c.widthRear) / 2;
  const widthDelta = Math.max(0, avgWidth - 9) * PER_J_OVER_9;
  const staggeredDelta = c.widthFront !== c.widthRear ? STAGGERED_FITMENT_PREMIUM : 0;
  const materialMultPct = (MATERIAL_MULT[c.material] - 1) * 100;
  return [
    { label: `Базова (${design.nameEn}, ${BASELINE_DIAMETER}″, Al)`, valueEur: base },
    { label: `Діаметр ${c.diameter}″`, valueEur: diameterDelta },
    { label: `Ширина (середня ${avgWidth}J)`, valueEur: widthDelta },
    { label: `Стаггер (різні ширини осей)`, valueEur: staggeredDelta },
    {
      label: `Матеріал ${c.material} (×${MATERIAL_MULT[c.material]}, +${materialMultPct.toFixed(0)}%)`,
      valueEur: 0,
    },
  ];
}
