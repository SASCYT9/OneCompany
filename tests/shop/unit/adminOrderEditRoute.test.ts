import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { build } from "esbuild";
import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

const requireReal = createRequire(path.resolve("package.json"));
const bundled = build({
  entryPoints: ["src/app/api/admin/shop/orders/[id]/edit/route.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  packages: "external",
  plugins: [
    {
      name: "admin-order-edit-fixtures",
      setup(builder) {
        builder.onResolve({ filter: /^@\/lib\/(prisma|adminAuth|adminRbac)$/ }, (args) => ({
          path: args.path,
          external: true,
        }));
      },
    },
  ],
});

const UPDATED_AT = new Date("2026-10-13T09:00:00.000Z");

async function fixture(options: { paid?: boolean; mono?: boolean; concurrent?: boolean } = {}) {
  const claims: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> = [];
  const itemWrites: Array<[string, unknown]> = [];
  const events: Array<{ data: { note: string } }> = [];
  const audits: unknown[] = [];
  const order = {
    id: "order1",
    status: "PENDING_REVIEW",
    updatedAt: UPDATED_AT,
    isDraft: false,
    customerName: "Іван Тест",
    email: "ivan@example.invalid",
    phone: "+380000000000",
    shippingAddress: { country: "Ukraine", city: "Київ", line1: "НП 1", carrier: { ref: "keep" } },
    currency: "UAH",
    subtotal: new Prisma.Decimal(1000),
    total: new Prisma.Decimal(1100),
    paymentStatus: options.paid ? "PAID" : "UNPAID",
    paymentMethod: options.mono ? "MONOBANK" : "FOP",
    amountPaid: options.paid ? 1100 : 0,
    stripeCheckoutSessionId: null,
    monobankPayment: options.mono ? { id: "payment1" } : null,
    pricingSnapshot: { items: [] },
    items: [
      {
        id: "item1",
        title: "Вихлоп",
        quantity: 1,
        price: new Prisma.Decimal(1000),
        total: new Prisma.Decimal(1000),
      },
    ],
  };
  const db = {
    shopOrder: {
      findUnique: async () => order,
      updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        claims.push(args);
        return { count: options.concurrent ? 0 : 1 };
      },
    },
    shopOrderItem: {
      update: async (args: unknown) => itemWrites.push(["update", args]),
      deleteMany: async (args: unknown) => itemWrites.push(["delete", args]),
      create: async (args: unknown) => itemWrites.push(["create", args]),
    },
    shopProductVariant: {
      findUnique: async () => ({
        id: "variant1",
        sku: "SKU-1",
        image: null,
        product: { id: "product1", slug: "catalog-product", image: "https://example.invalid/p.jpg" },
      }),
    },
    shopProduct: { findUnique: async () => null },
    shopOrderStatusEvent: {
      create: async (entry: { data: { note: string } }) => events.push(entry),
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
  };
  const dependencies: Record<string, unknown> = {
    "next/headers": { cookies: async () => ({}) },
    "@/lib/prisma": { prisma: db },
    "@/lib/adminAuth": {
      assertAdminRequest: async (_cookie: unknown, permission: string) => {
        assert.equal(permission, "shop.orders.write");
        return { name: "Менеджер", email: "admin@example.invalid" };
      },
    },
    "@/lib/adminRbac": {
      ADMIN_PERMISSIONS: { SHOP_ORDERS_WRITE: "shop.orders.write" },
      writeAdminAuditLog: async (_db: unknown, _session: unknown, entry: unknown) => audits.push(entry),
    },
  };
  const routeModule = {
    exports: {} as {
      PATCH: (request: NextRequest, context: unknown) => Promise<Response>;
    },
  };
  new Function("require", "module", "exports", (await bundled).outputFiles[0].text)(
    (id: string) => dependencies[id] ?? requireReal(id),
    routeModule,
    routeModule.exports
  );
  return {
    claims,
    itemWrites,
    events,
    audits,
    patch: (body: Record<string, unknown>) =>
      routeModule.exports.PATCH(
        new NextRequest("http://localhost/api/admin/shop/orders/order1/edit", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ expectedUpdatedAt: UPDATED_AT.toISOString(), ...body }),
        }),
        { params: Promise.resolve({ id: "order1" }) }
      ),
  };
}

test("contacts and address can be fixed even on a paid order, keeping carrier data", async () => {
  const f = await fixture({ paid: true, mono: true });
  const response = await f.patch({
    contact: { customerName: "Іван Тест", email: "ivan@example.invalid", phone: "+380111111111" },
    shippingAddress: { country: "Ukraine", city: "Львів", line1: "НП 7" },
  });
  assert.equal(response.status, 200);
  assert.equal(f.claims.length, 1);
  assert.equal(f.claims[0].where.amountPaid, undefined, "contact edits do not need payment guards");
  assert.equal(f.claims[0].data.phone, "+380111111111");
  assert.deepEqual(f.claims[0].data.shippingAddress, {
    country: "Ukraine",
    city: "Львів",
    line1: "НП 7",
    carrier: { ref: "keep" },
  });
  assert.match(f.events[0].data.note, /телефон \+380000000000 → \+380111111111/);
  assert.equal(f.audits.length, 1);
});

test("items cannot change once a payment link carries the old amount", async () => {
  const f = await fixture({ mono: true });
  const response = await f.patch({ items: { update: [{ id: "item1", quantity: 2, price: 1000 }] } });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "PAYMENT_LINK");
  assert.equal(f.claims.length, 0);
  assert.equal(f.itemWrites.length, 0);
  assert.equal(f.events.length, 0);
});

test("item edits move the totals and claim the order only while it is still unpaid", async () => {
  const f = await fixture();
  const response = await f.patch({
    items: {
      update: [{ id: "item1", quantity: 2, price: 1000 }],
      add: [{ variantId: "variant1", productId: "spoofed", title: "Фільтр", quantity: 1, price: 500 }],
    },
    note: "клієнт доклав фільтр",
  });
  assert.equal(response.status, 200);
  const claim = f.claims[0];
  assert.equal(claim.where.amountPaid, 0);
  assert.deepEqual(claim.where.monobankPayment, { is: null });
  assert.equal(claim.data.subtotal, 2500);
  assert.equal(claim.data.total, 2600);
  const snapshotItems = (claim.data.pricingSnapshot as { items: Array<Record<string, unknown>> }).items;
  assert.equal(snapshotItems[0].sku, "SKU-1");
  assert.deepEqual(f.itemWrites[0], [
    "update",
    { where: { id: "item1" }, data: { quantity: 2, price: 1000, total: 2000 } },
  ]);
  const created = f.itemWrites[1][1] as { data: Record<string, unknown> };
  assert.equal(created.data.productId, "product1", "catalog lines are resolved on the server");
  assert.equal(created.data.productSlug, "catalog-product");
  assert.match(f.events[0].data.note, /сума 1\s100 UAH → 2\s600 UAH/);
  assert.match(f.events[0].data.note, /Коментар: клієнт доклав фільтр/);
});

test("a stale form or a concurrent payment never overwrites the order", async () => {
  const stale = await fixture();
  const staleResponse = await stale.patch({
    expectedUpdatedAt: "2026-10-12T09:00:00.000Z",
    items: { update: [{ id: "item1", quantity: 2, price: 1000 }] },
  });
  assert.equal(staleResponse.status, 409);
  assert.equal(stale.claims.length, 0);

  const raced = await fixture({ concurrent: true });
  const racedResponse = await raced.patch({
    items: { update: [{ id: "item1", quantity: 2, price: 1000 }] },
  });
  assert.equal(racedResponse.status, 409);
  assert.equal(raced.itemWrites.length, 0);
  assert.equal(raced.events.length, 0);
  assert.equal(raced.audits.length, 0);
});
