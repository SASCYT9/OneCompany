/**
 * Forged-wheel lead-time estimator.
 *
 * Aluminium baseline comes from each design's `leadTimeWeeksAl`.
 * Magnesium and carbon add weeks because the foundry cycle is slower
 * and there are fewer suppliers we can route through.
 *
 * Output is a localised string the configurator surfaces in the summary
 * panel and the operator sees in the admin draft view.
 */

import { findForgedDesign } from "@/data/forgedDesigns";
import type { Finish, ForgedConfig, Material } from "./configSchema";

const MATERIAL_OFFSET_WEEKS: Record<Material, number> = {
  aluminium: 0,
  magnesium: 2,
  carbon: 4,
};

const FINISH_OFFSET_WEEKS: Record<Finish, number> = {
  gloss: 0,
  satin: 0,
  matte: 1,
  brushed: 1,
  "forged-clear": 2,
  "two-tone": 2,
};

export type LeadTimeRange = {
  weeksMin: number;
  weeksMax: number;
};

export function leadTimeFromConfig(c: ForgedConfig): LeadTimeRange | null {
  const design = findForgedDesign(c.designSlug);
  if (!design) return null;
  const base = design.leadTimeWeeksAl;
  const offset = MATERIAL_OFFSET_WEEKS[c.material] + FINISH_OFFSET_WEEKS[c.finish];
  return {
    weeksMin: base + offset,
    // Add a 3-week tail so we don't over-promise on slow finishing slots.
    weeksMax: base + offset + 3,
  };
}

export function formatLeadTime(range: LeadTimeRange, locale: "ua" | "en"): string {
  if (locale === "ua") {
    return `${range.weeksMin}–${range.weeksMax} тижнів`;
  }
  return `${range.weeksMin}–${range.weeksMax} weeks`;
}
