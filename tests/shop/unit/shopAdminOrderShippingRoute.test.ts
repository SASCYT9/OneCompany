import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { build } from "esbuild";
import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

const requireReal = createRequire(path.resolve("package.json"));
const bundled = build({
  entryPoints: ["src/app/api/admin/shop/orders/[id]/route.ts"],
  bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
  plugins: [{
    name: "admin-order-fixtures",
    setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/(prisma|adminAuth|adminRbac|shopAdminOrders)$/ },
        (args) => ({ path: args.path, external: true }));
    },
  }],
});

async function fixture(options: { method?: string; payment?: boolean; concurrent?: boolean; authError?: string } = {}) {
  const writes: Array<Record<string, unknown>> = [];
  const audits: unknown[] = [];
  const events: unknown[] = [];
  let reads = 0;
  const current = {
    id: "order1", status: "PENDING_REVIEW", updatedAt: new Date("2026-10-03T12:00:00Z"),
    subtotal: new Prisma.Decimal(100), taxAmount: new Prisma.Decimal(5),
    shippingCost: new Prisma.Decimal(10), total: new Prisma.Decimal(112),
    paymentMethod: options.method ?? "FOP", monobankPayment: options.payment ? { id: "payment1" } : null,
  };
  const db = {
    shopOrder: {
      findUnique: async () => { reads++; return current; },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        assert.equal(where.updatedAt, current.updatedAt);
        if (options.concurrent) return { count: 0 };
        writes.push(data);
        return { count: 1 };
      },
      findUniqueOrThrow: async () => current,
    },
    shopOrderStatusEvent: { create: async (entry: unknown) => events.push(entry) },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
  };
  const dependencies: Record<string, unknown> = {
    "next/headers": { cookies: async () => ({}) },
    "@/lib/prisma": { prisma: db },
    "@/lib/adminAuth": { assertAdminRequest: async (_cookie: unknown, permission: string) => {
      assert.equal(permission, "shop.orders.write");
      if (options.authError) throw new Error(options.authError);
      return { name: "Test admin", email: "admin@example.invalid" };
    } },
    "@/lib/adminRbac": {
      ADMIN_PERMISSIONS: { SHOP_ORDERS_WRITE: "shop.orders.write" },
      writeAdminAuditLog: async (_db: unknown, _session: unknown, entry: unknown) => audits.push(entry),
    },
    "@/lib/shopAdminOrders": { canTransitionOrderStatus: () => true },
  };
  const routeModule = { exports: {} as { PATCH: (request: NextRequest, context: unknown) => Promise<Response> } };
  new Function("require", "module", "exports", (await bundled).outputFiles[0].text)(
    (id: string) => dependencies[id] ?? requireReal(id), routeModule, routeModule.exports
  );
  return {
    writes, audits, events, reads: () => reads,
    patch: (body: unknown) => routeModule.exports.PATCH(new NextRequest("http://localhost/api/admin/shop/orders/order1", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }), { params: Promise.resolve({ id: "order1" }) }),
  };
}

test("shipping amount cannot diverge from an existing or prepared mono invoice", async () => {
  for (const options of [{ method: "MONOBANK" }, { method: "FOP", payment: true }]) {
    const f = await fixture(options);
    assert.equal((await f.patch({ shippingCalculatedCost: 20 })).status, 409);
    assert.equal(f.writes.length, 0);
    assert.equal(f.audits.length, 0);
  }
});

test("unchanged shipping and tracking edits preserve the saved mono total including adjustments", async () => {
  const f = await fixture({ method: "MONOBANK", payment: true });
  assert.equal((await f.patch({ shippingCalculatedCost: "10", ttnNumber: "SYNTHETIC-TRACKING" })).status, 200);
  assert.equal(f.writes[0].ttnNumber, "SYNTHETIC-TRACKING");
  assert.equal(f.writes[0].total, undefined);
  assert.equal(f.writes[0].shippingCost, undefined);
  assert.equal(f.audits.length, 1);
});

test("international manager requests must use the agreed delivery quote flow", async () => {
  const f = await fixture({ method: "MANAGER_QUOTE" });
  assert.equal((await f.patch({ shippingCalculatedCost: 20 })).status, 409);
  assert.equal(f.writes.length, 0);
});

test("ordinary bank-transfer shipping edits still work and invalid costs are rejected", async () => {
  const f = await fixture();
  assert.equal((await f.patch({ shippingCalculatedCost: 20 })).status, 200);
  assert.equal(f.writes[0].total, 125);
  for (const shippingCalculatedCost of [-1, "invalid", "Infinity"]) {
    const invalid = await fixture();
    assert.equal((await invalid.patch({ shippingCalculatedCost })).status, 400);
    assert.equal(invalid.writes.length, 0);
  }
});

test("a concurrent payment update rejects stale admin changes and creates no audit or event", async () => {
  const f = await fixture({ concurrent: true });
  assert.equal((await f.patch({ shippingCalculatedCost: 20 })).status, 409);
  assert.equal(f.writes.length, 0);
  assert.equal(f.audits.length, 0);
  assert.equal(f.events.length, 0);
});

test("shipping edits retain authentication and order-write permission checks", async () => {
  for (const [authError, status] of [["UNAUTHORIZED", 401], ["FORBIDDEN", 403]] as const) {
    const f = await fixture({ authError });
    assert.equal((await f.patch({ shippingCalculatedCost: 20 })).status, status);
    assert.equal(f.reads(), 0);
    assert.equal(f.writes.length, 0);
  }
});
