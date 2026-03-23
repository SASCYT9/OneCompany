/**
 * Turn14 Pricing Engine
 * 
 * Price calculation pipeline:
 * Turn14 cost → Brand markup % → Customer markup % (override) → Final price
 */

import { prisma } from '@/lib/prisma';

const DEFAULT_MARKUP_PCT = 25; // 25% default markup

type PriceBreakdown = {
  costPrice: number;
  brandMarkupPct: number;
  customerMarkupPct: number | null;  // null = using brand default
  effectiveMarkupPct: number;
  finalPrice: number;
  profit: number;
  marginPct: number;
};

/**
 * Get the effective markup for a customer.
 * Priority: CustomerMarkup > Turn14BrandMarkup > DEFAULT
 */
export async function getEffectiveMarkup(
  brandId?: string,
  customerId?: string
): Promise<{ markupPct: number; source: 'customer' | 'brand' | 'default' }> {
  // 1. Check customer-specific markup
  if (customerId) {
    const customerMarkup = await prisma.customerMarkup.findUnique({
      where: { customerId },
    });
    if (customerMarkup?.isActive) {
      return { markupPct: customerMarkup.markupPct, source: 'customer' };
    }
  }

  // 2. Check brand-specific markup
  if (brandId) {
    const brandMarkup = await prisma.turn14BrandMarkup.findUnique({
      where: { brandId },
    });
    if (brandMarkup?.isActive) {
      return { markupPct: brandMarkup.markupPct, source: 'brand' };
    }
  }

  // 3. Default
  return { markupPct: DEFAULT_MARKUP_PCT, source: 'default' };
}

/**
 * Calculate full price breakdown for a product
 */
export async function calculatePrice(
  costPrice: number,
  brandId?: string,
  customerId?: string
): Promise<PriceBreakdown> {
  // Get brand markup
  let brandMarkupPct = DEFAULT_MARKUP_PCT;
  if (brandId) {
    const bm = await prisma.turn14BrandMarkup.findUnique({ where: { brandId } });
    if (bm?.isActive) brandMarkupPct = bm.markupPct;
  }

  // Get customer markup (overrides brand)
  let customerMarkupPct: number | null = null;
  if (customerId) {
    const cm = await prisma.customerMarkup.findUnique({ where: { customerId } });
    if (cm?.isActive) customerMarkupPct = cm.markupPct;
  }

  const effectiveMarkupPct = customerMarkupPct ?? brandMarkupPct;
  const finalPrice = costPrice * (1 + effectiveMarkupPct / 100);
  const profit = finalPrice - costPrice;
  const marginPct = costPrice > 0 ? (profit / finalPrice) * 100 : 0;

  return {
    costPrice,
    brandMarkupPct,
    customerMarkupPct,
    effectiveMarkupPct,
    finalPrice: Math.round(finalPrice * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    marginPct: Math.round(marginPct * 10) / 10,
  };
}

/**
 * Get all customer markups for admin display
 */
export async function getAllCustomerMarkups() {
  return prisma.customerMarkup.findMany({
    orderBy: { customerName: 'asc' },
  });
}

/**
 * Upsert a customer markup
 */
export async function upsertCustomerMarkup(data: {
  customerId: string;
  customerName: string;
  markupPct: number;
  notes?: string;
}) {
  return prisma.customerMarkup.upsert({
    where: { customerId: data.customerId },
    update: {
      customerName: data.customerName,
      markupPct: data.markupPct,
      notes: data.notes || null,
      isActive: true,
    },
    create: {
      customerId: data.customerId,
      customerName: data.customerName,
      markupPct: data.markupPct,
      notes: data.notes || null,
    },
  });
}

/**
 * Delete a customer markup (reverts to brand default)
 */
export async function deleteCustomerMarkup(customerId: string) {
  return prisma.customerMarkup.delete({
    where: { customerId },
  }).catch(() => null);
}
