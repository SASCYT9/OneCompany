import { prisma } from '@/lib/prisma';

/**
 * Discount Engine — server-side validation + amount calculation.
 *
 * Use cases:
 *   1. Cart preview: showCartDiscountPreview() given line items + customer group
 *   2. Order create: applyDiscountToOrder() with strict checks; redemption is recorded
 *   3. Cart UI inline check: validateDiscountCode() for "Apply" button feedback
 *
 * Code is currency-agnostic for PERCENTAGE and FREE_SHIPPING.
 * FIXED_AMOUNT must match order currency (or fall back to inferred conversion).
 */

export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING' | 'BUY_X_GET_Y';
export type DiscountScope = 'CART' | 'PRODUCT' | 'COLLECTION' | 'SHIPPING';
export type DiscountStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'ARCHIVED';

export type DiscountRow = {
  id: string;
  code: string;
  type: DiscountType;
  scope: DiscountScope;
  status: DiscountStatus;
  value: number;
  currency: string | null;
  minOrderValue: number | null;
  customerGroups: string[] | null;
  productIds: string[] | null;
  collectionIds: string[] | null;
  excludeOnSale: boolean;
  buyQuantity: number | null;
  getQuantity: number | null;
  getDiscountPct: number | null;
  usageLimit: number | null;
  usageLimitPerUser: number | null;
  usageCount: number;
  validFrom: Date | null;
  validUntil: Date | null;
};

export type CartContext = {
  customerId: string | null;
  customerEmail: string | null;
  customerGroup: string;
  currency: string;
  subtotal: number;
  shippingCost: number;
  items: Array<{
    productId: string | null;
    collectionIds: string[];
    quantity: number;
    price: number;
    onSale: boolean;
  }>;
};

export type DiscountResult =
  | { ok: false; reason: string }
  | { ok: true; amount: number; freeShipping: boolean; discount: DiscountRow };

/**
 * Validate a discount code against a cart. Returns the discount amount (positive number)
 * to subtract from subtotal, OR a reason for rejection.
 *
 * Pure function — does NOT increment usageCount; that happens only after order is placed
 * via recordDiscountRedemption().
 */
export async function validateDiscountCode(code: string, cart: CartContext): Promise<DiscountResult> {
  if (!code || !code.trim()) return { ok: false, reason: 'No code supplied' };
  const upperCode = code.trim().toUpperCase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const discount = (await (prisma as any).shopDiscount.findUnique({
    where: { code: upperCode },
  })) as DiscountRow | null;

  if (!discount) return { ok: false, reason: 'Code not found' };
  if (discount.status !== 'ACTIVE') return { ok: false, reason: `Discount is ${discount.status.toLowerCase()}` };

  const now = new Date();
  if (discount.validFrom && now < discount.validFrom) return { ok: false, reason: 'Not yet valid' };
  if (discount.validUntil && now > discount.validUntil) return { ok: false, reason: 'Expired' };

  if (discount.usageLimit != null && discount.usageCount >= discount.usageLimit) {
    return { ok: false, reason: 'Usage limit reached' };
  }

  if (discount.minOrderValue != null && cart.subtotal < Number(discount.minOrderValue)) {
    return { ok: false, reason: `Minimum order value: ${discount.minOrderValue} ${cart.currency}` };
  }

  if (
    discount.customerGroups &&
    Array.isArray(discount.customerGroups) &&
    discount.customerGroups.length > 0 &&
    !discount.customerGroups.includes(cart.customerGroup)
  ) {
    return { ok: false, reason: 'Not eligible for your customer group' };
  }

  if (discount.usageLimitPerUser != null && cart.customerId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userRedemptions = await (prisma as any).shopDiscountRedemption.count({
      where: { discountId: discount.id, customerId: cart.customerId },
    });
    if (userRedemptions >= discount.usageLimitPerUser) {
      return { ok: false, reason: 'You have already used this code the maximum number of times' };
    }
  }

  // Compute eligible subtotal (some scopes restrict to specific products/collections)
  let eligibleSubtotal = 0;
  if (discount.scope === 'CART') {
    eligibleSubtotal = cart.subtotal;
  } else if (discount.scope === 'PRODUCT' && discount.productIds) {
    const ids = discount.productIds;
    eligibleSubtotal = cart.items
      .filter((it) => it.productId && ids.includes(it.productId))
      .filter((it) => !discount.excludeOnSale || !it.onSale)
      .reduce((sum, it) => sum + it.price * it.quantity, 0);
  } else if (discount.scope === 'COLLECTION' && discount.collectionIds) {
    const ids = discount.collectionIds;
    eligibleSubtotal = cart.items
      .filter((it) => it.collectionIds.some((cid) => ids.includes(cid)))
      .filter((it) => !discount.excludeOnSale || !it.onSale)
      .reduce((sum, it) => sum + it.price * it.quantity, 0);
  } else if (discount.scope === 'SHIPPING') {
    eligibleSubtotal = cart.shippingCost;
  }

  if (eligibleSubtotal <= 0 && discount.type !== 'FREE_SHIPPING') {
    return { ok: false, reason: 'Cart has no eligible items for this code' };
  }

  // Compute amount
  let amount = 0;
  let freeShipping = false;

  switch (discount.type) {
    case 'PERCENTAGE':
      amount = round2((eligibleSubtotal * Number(discount.value)) / 100);
      break;
    case 'FIXED_AMOUNT':
      if (discount.currency && discount.currency !== cart.currency) {
        return { ok: false, reason: `Code is for ${discount.currency}, cart is ${cart.currency}` };
      }
      amount = Math.min(Number(discount.value), eligibleSubtotal);
      break;
    case 'FREE_SHIPPING':
      freeShipping = true;
      amount = cart.shippingCost;
      break;
    case 'BUY_X_GET_Y': {
      // Buy X items, get Y at discount %
      const buyQty = discount.buyQuantity ?? 1;
      const getQty = discount.getQuantity ?? 1;
      const getPct = discount.getDiscountPct ?? 100;
      const totalUnits = cart.items.reduce((sum, it) => sum + it.quantity, 0);
      // How many "get" sets fit?
      const sets = Math.floor(totalUnits / (buyQty + getQty));
      // Apply discount to cheapest items as the "free" ones (best for customer is also typical retailer behavior)
      const sortedPrices = cart.items
        .flatMap((it) => Array(it.quantity).fill(it.price) as number[])
        .sort((a, b) => a - b);
      const freeUnits = sets * getQty;
      amount = round2(
        sortedPrices.slice(0, freeUnits).reduce((sum, p) => sum + (p * getPct) / 100, 0)
      );
      break;
    }
  }

  if (amount <= 0 && !freeShipping) return { ok: false, reason: 'Discount amount is zero' };

  return { ok: true, amount, freeShipping, discount };
}

/**
 * Record a discount redemption AFTER the order has been created.
 * Atomic: increments usageCount and creates a Redemption row.
 */
export async function recordDiscountRedemption(args: {
  discountId: string;
  orderId: string;
  customerId: string | null;
  email: string | null;
  amount: number;
  currency: string;
}): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).$transaction([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma as any).shopDiscount.update({
      where: { id: args.discountId },
      data: { usageCount: { increment: 1 } },
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma as any).shopDiscountRedemption.create({
      data: {
        discountId: args.discountId,
        orderId: args.orderId,
        customerId: args.customerId,
        email: args.email,
        amount: args.amount,
        currency: args.currency,
      },
    }),
  ]);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
