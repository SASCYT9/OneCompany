import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { build } from "esbuild";
import { NextRequest } from "next/server";

const requireReal = createRequire(path.resolve("package.json"));
const bundled = build({
  entryPoints: ["src/app/api/admin/shop/drafts/route.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  packages: "external",
  plugins: [
    {
      name: "test-dependencies",
      setup(builder) {
        builder.onResolve({ filter: /^@\/lib\/(prisma|adminAuth|adminRbac)$/ }, (args) => ({
          path: args.path,
          external: true,
        }));
      },
    },
  ],
});
type CapturedOrder = {
  isDraft: boolean;
  status: string;
  total: number;
  currency: string;
  items: { create: { price: number; total: number; variantId: string }[] };
  pricingSnapshot: { items: { sku: string }[] };
};
async function fixture(authError = "") {
  const writes: CapturedOrder[] = [];
  const audits: unknown[] = [];
  const db = {
    shopCustomer: { findUnique: async () => ({ group: "B2C" }) },
    shopProduct: {
      findMany: async () => [
        {
          id: "p1",
          slug: "part",
          sku: "PRODUCT",
          variants: [{ id: "v1", sku: "VARIANT", title: "Gloss" }],
        },
      ],
    },
    shopOrder: {
      create: async ({ data }: { data: CapturedOrder }) => {
        writes.push(data);
        return { id: "draft1", orderNumber: "DRAFT-TEST" };
      },
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
  };
  const dependencies: Record<string, unknown> = {
    "next/headers": { cookies: async () => ({}) },
    "@/lib/prisma": { prisma: db },
    "@/lib/adminAuth": {
      assertAdminRequest: async (_cookies: unknown, permission: string) => {
        assert.equal(permission, "shop.orders.write");
        if (authError) throw new Error(authError);
        return { email: "manager@example.com" };
      },
    },
    "@/lib/adminRbac": {
      ADMIN_PERMISSIONS: { SHOP_ORDERS_WRITE: "shop.orders.write" },
      writeAdminAuditLog: async (_tx: unknown, _session: unknown, entry: unknown) =>
        audits.push(entry),
    },
  };
  const routeModule = { exports: {} as { POST: (req: NextRequest) => Promise<Response> } };
  new Function("require", "module", "exports", (await bundled).outputFiles[0].text)(
    (id: string) => dependencies[id] ?? requireReal(id),
    routeModule,
    routeModule.exports
  );
  const post = (body: unknown) =>
    routeModule.exports.POST(
      new NextRequest("http://localhost/api/admin/shop/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
    );
  return { post, writes, audits };
}
const valid = {
  customerName: "Demo",
  email: "demo@example.com",
  currency: "EUR",
  shippingCost: 0.2,
  items: [
    {
      productId: "p1",
      productSlug: "part",
      variantId: "v1",
      title: "Part",
      quantity: 3,
      price: 0.1,
      sku: "CLIENT-SUPPLIED",
    },
  ],
};
test("POST creates only an audited draft with exact totals and canonical variant SKU", async () => {
  const f = await fixture();
  const response = await f.post(valid);
  assert.equal(response.status, 200);
  assert.equal(f.writes.length, 1);
  assert.equal(f.audits.length, 1);
  assert.equal(f.writes[0].isDraft, true);
  assert.equal(f.writes[0].status, "PENDING_REVIEW");
  assert.equal(f.writes[0].total, 0.5);
  assert.equal(f.writes[0].items.create[0].total, 0.3);
  assert.equal(f.writes[0].pricingSnapshot.items[0].sku, "VARIANT");
  // The fixture intentionally exposes no inventory, payment or notification operations.
});
test("POST rejects invalid totals and foreign variants without persisting anything", async () => {
  for (const body of [
    { ...valid, shippingCost: -1 },
    { ...valid, currency: "XYZ" },
    { ...valid, items: [{ ...valid.items[0], variantId: "other-product-variant" }] },
    { ...valid, items: [{ ...valid.items[0], productId: "missing" }] },
  ]) {
    const f = await fixture();
    assert.equal((await f.post(body)).status, 400);
    assert.equal(f.writes.length, 0);
    assert.equal(f.audits.length, 0);
  }
});
test("POST retains authentication and order-write permission checks", async () => {
  for (const [message, status] of [
    ["UNAUTHORIZED", 401],
    ["FORBIDDEN", 403],
  ] as const) {
    const f = await fixture(message);
    assert.equal((await f.post(valid)).status, status);
    assert.equal(f.writes.length, 0);
  }
});
