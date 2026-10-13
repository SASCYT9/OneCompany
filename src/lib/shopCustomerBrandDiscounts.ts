/**
 * Per-customer per-brand B2B discount overrides (#51).
 *
 * NOTE: this module reads/writes the new `ShopCustomerBrandDiscount` table.
 * The migration `20260508120000_add_archived_at_and_brand_discounts` MUST be
 * applied for any function in this file to succeed at runtime — otherwise
 * Prisma will return a P2021 ("table does not exist") error.
 *
 * Pricing reads these overrides first (loadShopBrandDiscountMaps →
 * resolveShopB2bDiscount): customer-brand → system brand →
 * customer % → shop default.
 */

import { Prisma, type PrismaClient } from "@prisma/client";

export type CustomerBrandDiscountInput = {
  brand: string;
  discountPct: number;
  notes?: string | null;
};

function sanitize(input: CustomerBrandDiscountInput) {
  const brand = String(input.brand ?? "").trim();
  const pct = Number(input.discountPct);
  if (!brand) throw new Error("BRAND_REQUIRED");
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new Error("DISCOUNT_OUT_OF_RANGE");
  }
  return {
    brand,
    discountPct: new Prisma.Decimal(pct.toFixed(2)),
    notes: typeof input.notes === "string" && input.notes.trim() ? input.notes.trim() : null,
  };
}

export async function listCustomerBrandDiscounts(prisma: PrismaClient, customerId: string) {
  return prisma.shopCustomerBrandDiscount.findMany({
    where: { customerId },
    orderBy: { brand: "asc" },
  });
}

export async function upsertCustomerBrandDiscount(
  prisma: PrismaClient,
  customerId: string,
  input: CustomerBrandDiscountInput
) {
  const data = sanitize(input);
  // Brands match case-insensitively in pricing, so "AKRAPOVIC" and
  // "Akrapovic" are one rule: update a differently-cased row in place.
  const existing = await prisma.shopCustomerBrandDiscount.findFirst({
    where: { customerId, brand: { equals: data.brand, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) {
    return prisma.shopCustomerBrandDiscount.update({
      where: { id: existing.id },
      data: { brand: data.brand, discountPct: data.discountPct, notes: data.notes },
    });
  }
  return prisma.shopCustomerBrandDiscount.create({
    data: {
      customerId,
      brand: data.brand,
      discountPct: data.discountPct,
      notes: data.notes,
    },
  });
}

export async function deleteCustomerBrandDiscount(
  prisma: PrismaClient,
  customerId: string,
  brand: string
) {
  await prisma.shopCustomerBrandDiscount.deleteMany({
    where: { customerId, brand: { equals: brand.trim(), mode: "insensitive" } },
  });
}
