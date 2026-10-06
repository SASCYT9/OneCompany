import assert from "node:assert/strict";
import test from "node:test";
import { runShopStorageRetention } from "../../../src/lib/shopStorageRetention";

type Cart = { id: string; customerId: string | null; expiresAt: Date; createdAt: Date; items: number };

function fakePrisma(carts: Cart[], expiredBuckets: number) {
  const remaining = [...carts];
  let cartWhere: { OR: Array<Record<string, unknown>> } | null = null;
  const matches = (cart: Cart) =>
    cartWhere!.OR.some((rule) => {
      if ("customerId" in rule && rule.customerId !== cart.customerId) return false;
      const expires = rule.expiresAt as { lt: Date } | undefined;
      if (expires && !(cart.expiresAt < expires.lt)) return false;
      const created = rule.createdAt as { lt: Date } | undefined;
      if (created && !(cart.createdAt < created.lt)) return false;
      if ("items" in rule && cart.items > 0) return false;
      return true;
    });
  const client = {
    shopCart: {
      findMany: async ({ where, take }: { where: typeof cartWhere; take: number }) => {
        cartWhere = where;
        return remaining.filter(matches).slice(0, take).map(({ id }) => ({ id }));
      },
      deleteMany: async ({ where }: { where: { AND: [{ id: { in: string[] } }, typeof cartWhere] } }) => {
        cartWhere = where.AND[1];
        const ids = new Set(where.AND[0].id.in);
        const before = remaining.length;
        for (let index = remaining.length - 1; index >= 0; index--)
          if (ids.has(remaining[index].id) && matches(remaining[index])) remaining.splice(index, 1);
        return { count: before - remaining.length };
      },
    },
    requestRateLimit: { deleteMany: async () => ({ count: expiredBuckets }) },
  };
  return { client: client as never, remaining };
}

test("retention removes expired and never-used guest carts but keeps live and customer carts", async () => {
  const now = new Date("2026-10-06T03:41:00Z");
  const days = (value: number) => new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
  const { client, remaining } = fakePrisma(
    [
      { id: "guest-expired", customerId: null, expiresAt: days(-8), createdAt: days(-38), items: 2 },
      { id: "guest-expired-in-grace", customerId: null, expiresAt: days(-2), createdAt: days(-32), items: 1 },
      { id: "guest-empty-old", customerId: null, expiresAt: days(28), createdAt: days(-2), items: 0 },
      { id: "guest-empty-today", customerId: null, expiresAt: days(30), createdAt: days(-0.1), items: 0 },
      { id: "guest-live", customerId: null, expiresAt: days(20), createdAt: days(-10), items: 1 },
      { id: "customer-expired-with-items", customerId: "c1", expiresAt: days(-9), createdAt: days(-40), items: 1 },
      { id: "customer-expired-empty", customerId: "c2", expiresAt: days(-9), createdAt: days(-40), items: 0 },
    ],
    7
  );
  const result = await runShopStorageRetention(client, { now, batchSize: 2 });
  assert.deepEqual(
    remaining.map((cart) => cart.id),
    ["guest-expired-in-grace", "guest-empty-today", "guest-live", "customer-expired-with-items"]
  );
  assert.equal(result.deletedCarts, 3);
  assert.equal(result.deletedRateLimitBuckets, 7);
  assert.equal(result.complete, true);
});
