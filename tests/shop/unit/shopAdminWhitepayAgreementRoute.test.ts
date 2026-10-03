import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { build } from "esbuild";
import { NextRequest } from "next/server";

const requireReal = createRequire(path.resolve("package.json"));
async function fixture(kind: "fiat" | "crypto", patch: Record<string, unknown> = {}) {
  const calls: Array<{ amount: string; currency: string }> = [];
  const writes: unknown[] = [];
  const order = { id: "order1", orderNumber: "SYNTHETIC-ORDER", total: 100, currency: "UAH",
    email: "buyer@example.invalid", viewToken: "synthetic-token", paymentStatus: "UNPAID",
    paymentMethod: "MANAGER_QUOTE", shippingAddress: { country: "United States" },
    pricingSnapshot: { internationalDelivery: { status: "awaiting_agreement" } }, monobankPayment: null, ...patch };
  const create = async (data: typeof calls[number]) => {
    calls.push(data); return { success: true, url: "https://synthetic.example.invalid/payment", orderId: "synthetic-payment" };
  };
  const dependencies: Record<string, unknown> = {
    "next/headers": { cookies: async () => ({}) },
    "@/lib/adminAuth": { assertAdminRequest: async (_cookie: unknown, permission: string) => assert.equal(permission, "shop.orders.write") },
    "@/lib/adminRbac": { ADMIN_PERMISSIONS: { SHOP_ORDERS_WRITE: "shop.orders.write" } },
    "@/lib/prisma": { prisma: { shopOrder: { findUnique: async () => order, update: async (data: unknown) => writes.push(data) } } },
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
