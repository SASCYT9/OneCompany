import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { build } from "esbuild";
import { NextRequest } from "next/server";

const requireReal = createRequire(path.resolve("package.json"));
async function fixture(kind: "fiat" | "crypto", patch: Record<string, unknown> = {}, providerFails = false) {
  const calls: Array<{ amount: string; currency: string }> = [];
  const writes: unknown[] = [];
  const order = { id: "order1", orderNumber: "SYNTHETIC-ORDER", total: 100, currency: "UAH",
    email: "buyer@example.invalid", viewToken: "synthetic-token", paymentStatus: "UNPAID",
    paymentMethod: "MANAGER_QUOTE", status: "PENDING_REVIEW", amountPaid: 0, isDraft: false,
    updatedAt: new Date("2026-10-03T12:00:00Z"), stripeCheckoutSessionId: null,
    shippingAddress: { country: "United States" },
    pricingSnapshot: { internationalDelivery: { status: "awaiting_agreement" } }, monobankPayment: null, ...patch };
  const create = async (data: typeof calls[number]) => {
    calls.push(data); return providerFails ? { success: false, error: "Synthetic ambiguous response" } : { success: true, url: "https://synthetic.example.invalid/payment", orderId: "synthetic-payment" };
  };
  const dependencies: Record<string, unknown> = {
    "next/headers": { cookies: async () => ({}) },
    "@/lib/adminAuth": { assertAdminRequest: async (_cookie: unknown, permission: string) => assert.equal(permission, "shop.orders.write") },
    "@/lib/adminRbac": { ADMIN_PERMISSIONS: { SHOP_ORDERS_WRITE: "shop.orders.write" } },
    "@/lib/prisma": { prisma: { shopOrder: { findUnique: async () => ({ ...order }), updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      if (order.paymentMethod !== where.paymentMethod || order.paymentStatus !== where.paymentStatus) return { count: 0 };
      writes.push(data); Object.assign(order, data); return { count: 1 };
    } } } },
    "@/lib/shopWhitepay": { isWhitepayEnabled: () => true, createWhitepayFiatOrder: create, createWhitepayCryptoOrder: create },
  };
  const bundled = await build({ entryPoints: [`src/app/api/admin/shop/orders/[id]/whitepay/${kind}/route.ts`], bundle: true,
    write: false, platform: "node", format: "cjs", packages: "external", plugins: [{ name: "whitepay-fixtures", setup(builder) {
      builder.onResolve({ filter: /^@\// }, (args) => args.path in dependencies ? { path: args.path, external: true } : undefined);
    } }] });
  const routeModule = { exports: {} as { POST: (request: NextRequest, context: unknown) => Promise<Response> } };
  new Function("require", "module", "exports", bundled.outputFiles[0].text)(
    (id: string) => dependencies[id] ?? requireReal(id), routeModule, routeModule.exports
  );
  return { calls, writes, post: () => routeModule.exports.POST(new NextRequest(`http://localhost/api/admin/shop/orders/order1/whitepay/${kind}`, { method: "POST" }), { params: Promise.resolve({ id: "order1" }) }) };
}

test("both Whitepay methods require an international agreement for the exact saved amount", async () => {
  for (const kind of ["fiat", "crypto"] as const) {
    for (const pricingSnapshot of [{ internationalDelivery: { status: "awaiting_agreement" } },
      { internationalDelivery: { status: "agreed", currency: "UAH", total: 99 } }]) {
      const f = await fixture(kind, { pricingSnapshot });
      const response = await f.post();
      assert.equal(response.status, 409);
      assert.equal((await response.json()).error, "INTERNATIONAL_DELIVERY_NOT_AGREED");
      assert.equal(f.calls.length + f.writes.length, 0);
    }
    const f = await fixture(kind, { pricingSnapshot: { internationalDelivery: { status: "agreed", currency: "UAH", total: 100 } } });
    assert.equal((await f.post()).status, 200);
    assert.deepEqual(f.calls[0].amount, "100.00");
    assert.equal(f.calls[0].currency, "UAH");
    assert.equal(f.writes.length, 1);
  }
});

test("existing providers, partial payments, refunds and closed orders cannot get a full-total Whitepay link", async () => {
  for (const kind of ["fiat", "crypto"] as const) {
    for (const patch of [{ paymentMethod: "WHITEPAY_FIAT" }, { paymentMethod: "WHITEPAY_CRYPTO" },
      { paymentStatus: "PARTIALLY_PAID" }, { paymentStatus: "PARTIALLY_REFUNDED" }, { paymentStatus: "REFUNDED" },
      { amountPaid: 1 }, { status: "CANCELLED" }, { stripeCheckoutSessionId: "existing-session" }, { isDraft: true }]) {
      const f = await fixture(kind, { shippingAddress: { country: "Ukraine" }, ...patch });
      assert.equal((await f.post()).status, 409);
      assert.equal(f.calls.length + f.writes.length, 0);
    }
  }
});

test("concurrent requests and retries make one Whitepay provider call; ambiguous responses retain the claim", async () => {
  for (const kind of ["fiat", "crypto"] as const) {
    for (const providerFails of [false, true]) {
      const f = await fixture(kind, { shippingAddress: { country: "Ukraine" } }, providerFails);
      const statuses = await Promise.all([f.post(), f.post()]).then(responses => responses.map(response => response.status));
      assert.ok(statuses.includes(409));
      assert.ok(statuses.includes(providerFails ? 502 : 200));
      assert.equal(f.calls.length, 1);
      assert.equal(f.writes.length, 1);
      assert.equal((await f.post()).status, 409);
      assert.equal(f.calls.length, 1);
    }
  }
});

test("Ukraine Whitepay remains available while a prepared mono payment cannot get a second provider link", async () => {
  for (const kind of ["fiat", "crypto"] as const) {
    const ukraine = { shippingAddress: { country: "Ukraine" }, paymentMethod: "FOP", currency: "EUR" };
    const f = await fixture(kind, ukraine);
    assert.equal((await f.post()).status, 200);
    assert.equal(f.calls[0].currency, "EUR");
    for (const patch of [{ paymentMethod: "MONOBANK" }, { monobankPayment: { id: "prepared-payment" } }]) {
      const blocked = await fixture(kind, { ...ukraine, ...patch });
      assert.equal((await blocked.post()).status, 409);
      assert.equal(blocked.calls.length + blocked.writes.length, 0);
    }
  }
});
