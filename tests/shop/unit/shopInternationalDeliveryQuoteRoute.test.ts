import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { build } from "esbuild";
import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

const requireReal = createRequire(path.resolve("package.json"));
const bundled = build({
  entryPoints: ["src/app/api/admin/shop/orders/[id]/delivery-quote/route.ts"],
  bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
  plugins: [{ name: "delivery-quote-fixtures", setup(builder) {
    builder.onResolve({ filter: /^@\/lib\/(prisma|adminAuth|adminRbac|shopAdminSettings)$/ },
      (args) => ({ path: args.path, external: true }));
  } }],
});

async function fixture(options: { paid?: boolean; invoice?: boolean; concurrent?: boolean; authError?: string; agreedUsd?: boolean } = {}) {
  const order = {
    id: "order1", currency: options.agreedUsd ? "UAH" : "EUR", paymentMethod: "MANAGER_QUOTE", status: "PENDING_REVIEW",
    amountPaid: options.paid ? 10 : 0, paymentStatus: options.paid ? "PAID" : "UNPAID",
    monobankPayment: options.invoice ? { invoiceId: "synthetic-invoice" } : null,
    updatedAt: new Date("2026-10-03T12:00:00Z"), total: new Prisma.Decimal(options.agreedUsd ? 6221.74 : 100), taxAmount: new Prisma.Decimal(0),
    pricingSnapshot: options.agreedUsd ? { currency: "UAH", currencyRates: { EUR: 1, USD: 1.15, UAH: 53 }, internationalDelivery: { status: "agreed", currency: "UAH", total: 6221.74, shippingQuote: { amount: 20, currency: "USD", amountUah: 921.74 } } } : { currency: "EUR", internationalDelivery: { status: "awaiting_agreement" } },
    items: [{ id: "item1", productSlug: "part", variantId: null, quantity: 1, price: new Prisma.Decimal(options.agreedUsd ? 5300 : 100), total: new Prisma.Decimal(options.agreedUsd ? 5300 : 100) }],
  };
  const writes: Array<Record<string, unknown>> = [];
  const lines: unknown[] = [];
  const audits: Array<{ metadata: Record<string, unknown> }> = [];
  const events: unknown[] = [];
  let rate = 53;
  const db = {
    shopOrder: {
      findUnique: async () => order,
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        assert.equal(where.updatedAt, order.updatedAt);
        assert.equal(where.paymentMethod, "MANAGER_QUOTE");
        assert.equal(where.paymentStatus, "UNPAID");
        if (options.concurrent) return { count: 0 };
        writes.push(data); return { count: 1 };
      },
    },
    shopOrderItem: { update: async (data: unknown) => lines.push(data) },
    shopOrderStatusEvent: { create: async (data: unknown) => events.push(data) },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
  };
  const dependencies: Record<string, unknown> = {
    "next/headers": { cookies: async () => ({}) },
    "@/lib/prisma": { prisma: db },
    "@/lib/adminAuth": { assertAdminRequest: async (_cookie: unknown, permission: string) => {
      assert.ok(["shop.orders.read", "shop.orders.write"].includes(permission));
      if (options.authError) throw new Error(options.authError);
      return { email: "admin@example.invalid", name: "Synthetic admin" };
    } },
    "@/lib/adminRbac": {
      ADMIN_PERMISSIONS: { SHOP_ORDERS_READ: "shop.orders.read", SHOP_ORDERS_WRITE: "shop.orders.write" },
      writeAdminAuditLog: async (_tx: unknown, _session: unknown, entry: typeof audits[number]) => audits.push(entry),
    },
    "@/lib/shopAdminSettings": { getOrCreateShopSettings: async () => ({}), getShopSettingsRuntime: () => ({ currencyRates: { EUR: 1, USD: 1.15, UAH: rate } }) },
  };
  type Handler = (request: NextRequest, context: unknown) => Promise<Response>;
  const routeModule = { exports: {} as { GET: Handler; POST: Handler } };
  new Function("require", "module", "exports", (await bundled).outputFiles[0].text)(
    (id: string) => dependencies[id] ?? requireReal(id), routeModule, routeModule.exports
  );
  const context = { params: Promise.resolve({ id: "order1" }) };
  return { writes, lines, audits, events, setRate: (next: number) => { rate = next; },
    get: (query: Record<string, string> = { shippingCostUah: "10" }) => routeModule.exports.GET(new NextRequest(`http://localhost/api/admin/shop/orders/order1/delivery-quote?${new URLSearchParams(query)}`), context),
    post: (patch: Record<string, unknown> = {}) => routeModule.exports.POST(new NextRequest("http://localhost/api/admin/shop/orders/order1/delivery-quote", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ shippingCostUah: 10, expectedTotalUah: 5310, customerAgreed: true, ...patch }),
    }), context),
  };
}

test("manager quote preview is read-only; agreement saves exact UAH totals, original prices and an audit", async () => {
  const f = await fixture();
  const preview = await f.get();
  assert.equal(preview.status, 200);
  assert.equal((await preview.json()).total, 5310);
  assert.equal(f.writes.length, 0);
  assert.equal((await f.post()).status, 200);
  const saved = f.writes[0];
  assert.equal(saved.currency, "UAH");
  assert.equal(saved.subtotal, 5300);
  assert.equal(saved.total, 5310);
  const snapshot = saved.pricingSnapshot as { internationalDelivery: { total: number; originalOrder: { currency: string; total: number } }; originalPricingSnapshot: { currency: string } };
  assert.equal(snapshot.internationalDelivery.total, 5310);
  assert.deepEqual(snapshot.internationalDelivery.originalOrder.currency, "EUR");
  assert.equal(snapshot.internationalDelivery.originalOrder.total, 100);
  assert.equal(snapshot.originalPricingSnapshot.currency, "EUR");
  assert.equal(f.lines.length, 1);
  assert.equal(f.audits[0].metadata.customerAgreed, true);
  assert.equal(f.events.length, 1);
});

test("USD and EUR shipping are saved with source amount/currency, converted value and rates", async () => {
  for (const [currency, shippingCost, total] of [["USD", 921.74, 6221.74], ["EUR", 1060, 6360]] as const) {
    const f = await fixture();
    const preview = await f.get({ shippingAmount: "20", shippingCurrency: currency });
    assert.equal((await preview.json()).shippingCost, shippingCost);
    assert.equal((await f.post({ shippingAmount: 20, shippingCurrency: currency, expectedShippingCostUah: shippingCost, expectedTotalUah: total })).status, 200);
    const snapshot = f.writes[0].pricingSnapshot as { currencyRates: { UAH: number }; internationalDelivery: { shippingQuote: { amount: number; currency: string; amountUah: number } } };
    assert.equal(snapshot.internationalDelivery.shippingQuote.amount, 20);
    assert.equal(snapshot.internationalDelivery.shippingQuote.currency, currency);
    assert.equal(snapshot.internationalDelivery.shippingQuote.amountUah, shippingCost);
    assert.equal(snapshot.currencyRates.UAH, 53);
    assert.deepEqual(f.audits[0].metadata.shippingQuote, snapshot.internationalDelivery.shippingQuote);
  }
});

test("an unchanged agreed foreign delivery keeps the saved rate; edits use the current rate", async () => {
  const f = await fixture({ agreedUsd: true });
  f.setRate(54);
  const unchanged = await (await f.get({ shippingAmount: "20", shippingCurrency: "USD" })).json();
  assert.equal(unchanged.ratesLocked, true);
  assert.equal(unchanged.shippingCost, 921.74);
  assert.equal(unchanged.total, 6221.74);
  const edited = await (await f.get({ shippingAmount: "21", shippingCurrency: "USD" })).json();
  assert.equal(edited.ratesLocked, false);
  assert.equal(edited.shippingCost, 986.09);
  assert.equal(edited.total, 6286.09);
});

test("foreign shipping requires its source amount and exact previewed UAH conversion", async () => {
  const f = await fixture();
  assert.equal((await f.get({ shippingCostUah: "20", shippingCurrency: "USD" })).status, 409);
  assert.equal((await f.post({ shippingAmount: 20, shippingCurrency: "USD", expectedTotalUah: 6221.74 })).status, 409);
  assert.equal((await f.post({ shippingAmount: 20, shippingCurrency: "USD", expectedShippingCostUah: 900, expectedTotalUah: 6221.74 })).status, 409);
  assert.equal((await f.post({ shippingAmount: null, shippingCurrency: "USD", expectedShippingCostUah: 921.74, expectedTotalUah: 6221.74 })).status, 409);
  assert.equal(f.writes.length, 0);
});

test("missing consent, changed total or a changed exchange rate cannot save a stale agreement", async () => {
  for (const patch of [{ customerAgreed: false }, { expectedTotalUah: 5300 }]) {
    const f = await fixture();
    assert.equal((await f.post(patch)).status, 409);
    assert.equal(f.writes.length, 0);
  }
  const f = await fixture();
  assert.equal((await f.get()).status, 200);
  f.setRate(54);
  assert.equal((await f.post()).status, 409);
  assert.equal(f.writes.length + f.lines.length + f.audits.length, 0);
});

test("paid, invoiced or concurrently updated orders reject without changing line prices", async () => {
  for (const options of [{ paid: true }, { invoice: true }, { concurrent: true }]) {
    const f = await fixture(options);
    assert.equal((await f.post()).status, 409);
    assert.equal(f.writes.length + f.lines.length + f.audits.length + f.events.length, 0);
  }
});

test("international quote APIs retain current read/write access checks", async () => {
  for (const [authError, status] of [["UNAUTHORIZED", 401], ["FORBIDDEN", 403]] as const) {
    const f = await fixture({ authError });
    assert.equal((await f.get()).status, status);
    assert.equal((await f.post()).status, status);
    assert.equal(f.writes.length, 0);
  }
});
