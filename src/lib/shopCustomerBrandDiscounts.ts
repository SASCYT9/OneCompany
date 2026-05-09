/**
 * Per-customer per-brand B2B discount overrides (#51).
 *
 * NOTE: this module reads/writes the new `ShopCustomerBrandDiscount` table.
 * The migration `20260508120000_add_archived_at_and_brand_discounts` MUST be
 * applied for any function in this file to succeed at runtime — otherwise
 * Prisma will return a P2021 ("table does not exist") error.
 *
 * Pricing integration (resolveEffectiveDiscountPercent must look up these
 * overrides) is a follow-up — see #51 acceptance criteria. The admin UI
 * landed first so we can capture the discount data, then wire it into
 * pricing once the schema is approved and live.
 */

import { Prisma, type PrismaClient } from '@prisma/client';

export type CustomerBrandDiscountInput = {
  brand: string;
  discountPct: number;
  notes?: string | null;
};

function sanitize(input: CustomerBrandDiscountInput) {
  const brand = String(input.brand ?? '').trim();
  const pct = Number(input.discountPct);
  if (!brand) throw new Error('BRAND_REQUIRED');
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new Error('DISCOUNT_OUT_OF_RANGE');
  }
  return {
    brand,
    discountPct: new Prisma.Decimal(pct.toFixed(2)),
    notes: typeof input.notes === 'string' && input.notes.trim() ? input.notes.trim() : null,
  };
}

export async function listCustomerBrandDiscounts(prisma: PrismaClient, customerId: string) {
  return prisma.shopCustomerBrandDiscount.findMany({
    where: { customerId },
    orderBy: { brand: 'asc' },
  });
}

export async function upsertCustomerBrandDiscount(
  prisma: PrismaClient,
  customerId: string,
  input: CustomerBrandDiscountInput,
) {
  const data = sanitize(input);
  return prisma.shopCustomerBrandDiscount.upsert({
    where: { customerId_brand: { customerId, brand: data.brand } },
    create: {
      customerId,
      brand: data.brand,
      discountPct: data.discountPct,
      notes: data.notes,
    },
    update: {
      discountPct: data.discountPct,
      notes: data.notes,
    },
  });
}

export async function deleteCustomerBrandDiscount(
  prisma: PrismaClient,
  customerId: string,
  brand: string,
) {
  await prisma.shopCustomerBrandDiscount.deleteMany({
    where: { customerId, brand },
  });
}

/**
 * Resolves the effective discount % for a given customer + brand.
 * Returns the per-brand override when present; otherwise falls back to the
 * customer's global `b2bDiscountPercent`. Returns null when neither is set.
 *
 * Currently NOT yet wired into `resolveShopPriceBands` — pricing keeps using
 * the global discount until follow-up integration in #51.
 */
export async function getEffectiveCustomerDiscount(
  prisma: PrismaClient,
  customerId: string,
  brand: string | null | undefined,
): Promise<number | null> {
  if (brand) {
    const override = await prisma.shopCustomerBrandDiscount.findUnique({
      where: { customerId_brand: { customerId, brand } },
      select: { discountPct: true },
    });
    if (override) return Number(override.discountPct);
  }
  const customer = await prisma.shopCustomer.findUnique({
    where: { id: customerId },
    select: { b2bDiscountPercent: true },
  });
  return customer?.b2bDiscountPercent != null ? Number(customer.b2bDiscountPercent) : null;
}
