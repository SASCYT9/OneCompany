/**
 * Public catalog accessors for One Company Forged.
 *
 * Designs live as a static TS catalog (src/data/forgedDesigns.ts), not as
 * ShopProduct rows. Rationale: every order is custom-configured; orderable
 * SKUs are minted on submit as ShopOrderItem rows referencing the design
 * slug. This avoids polluting ShopProduct with non-buyable rows and
 * removes the need for a Prisma migration on a shared production DB.
 *
 * If/when the catalog grows beyond ~50 designs, migrate to ShopProduct
 * rows guarded by a `forged.configurable_only = true` metafield.
 */

import { FORGED_DESIGNS, FORGED_BRAND_NAME, type ForgedDesign } from "@/data/forgedDesigns";

export { FORGED_BRAND_NAME };

export function getForgedDesigns(): ForgedDesign[] {
  return FORGED_DESIGNS.filter((design) => design.isCatalogVisible !== false);
}

export function getForgedDesign(slug: string): ForgedDesign | undefined {
  return FORGED_DESIGNS.find((d) => d.slug === slug);
}

export function isForgedSlug(slug: string): boolean {
  return FORGED_DESIGNS.some((d) => d.slug === slug);
}
