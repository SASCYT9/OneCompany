import type { Prisma, PrismaClient } from "@prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;
const CART_EXPIRY_GRACE_MS = 7 * DAY_MS;

export type ShopStorageRetentionResult = {
  deletedCarts: number;
  deletedRateLimitBuckets: number;
  complete: boolean;
};

/**
 * Nightly cleanup for rows that only grow. Carts: every expired guest cart, and
 * guest carts that never received an item (one per cookie-less visitor or bot
 * before carts were created lazily). A customer's cart is removed only when it
 * is both expired and empty. Items cascade with their cart.
 */
export async function runShopStorageRetention(
  prisma: PrismaClient,
  options: { now?: Date; batchSize?: number; maxBatches?: number; deadlineMs?: number } = {}
): Promise<ShopStorageRetentionResult> {
  const now = options.now ?? new Date();
  const batchSize = options.batchSize ?? 5_000;
  const maxBatches = options.maxBatches ?? 20;
  const deadline = Date.now() + (options.deadlineMs ?? 45_000);
  // Reads extend a cart's expiry only in its last week (shopCart touchCart),
  // while the cookie is renewed on every visit; this grace keeps both aligned.
  const expiredBefore = new Date(now.getTime() - CART_EXPIRY_GRACE_MS);
  const cartWhere: Prisma.ShopCartWhereInput = {
    OR: [
      { customerId: null, expiresAt: { lt: expiredBefore } },
      { customerId: null, createdAt: { lt: new Date(now.getTime() - DAY_MS) }, items: { none: {} } },
      { expiresAt: { lt: expiredBefore }, items: { none: {} } },
    ],
  };

  let deletedCarts = 0;
  let complete = false;
  for (let batch = 0; batch < maxBatches && Date.now() < deadline; batch++) {
    const ids = (
      await prisma.shopCart.findMany({ where: cartWhere, select: { id: true }, take: batchSize })
    ).map((row) => row.id);
    if (ids.length === 0) {
      complete = true;
      break;
    }
    // Re-apply the predicate: a cart reactivated after selection must survive.
    deletedCarts += (
      await prisma.shopCart.deleteMany({ where: { AND: [{ id: { in: ids } }, cartWhere] } })
    ).count;
    if (ids.length < batchSize) {
      complete = true;
      break;
    }
  }

  const deletedRateLimitBuckets = (
    await prisma.requestRateLimit.deleteMany({ where: { expiresAt: { lt: now } } })
  ).count;

  return { deletedCarts, deletedRateLimitBuckets, complete };
}
