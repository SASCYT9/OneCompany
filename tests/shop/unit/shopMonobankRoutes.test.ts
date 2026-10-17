import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { build } from "esbuild";
import { NextRequest } from "next/server";

const requireReal = createRequire(path.resolve("package.json"));
async function route(entry: string, dependencies: Record<string, unknown>) {
  const bundled = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    packages: "external",
    plugins: [
      {
        name: "mono-route-fixtures",
        setup(builder) {
          builder.onResolve({ filter: /^@\// }, (args) =>
            args.path in dependencies ? { path: args.path, external: true } : undefined
          );
        },
      },
    ],
  });
  const routeModule = {
    exports: {} as { POST: (request: NextRequest, context?: unknown) => Promise<Response> },
  };
  new Function("require", "module", "exports", bundled.outputFiles[0].text)(
    (id: string) => dependencies[id] ?? requireReal(id),
    routeModule,
    routeModule.exports
  );
  return routeModule.exports.POST;
}

test("webhook route authenticates the exact bytes before applying payment state", async (t) => {
  const saved = { ...process.env };
  t.after(() => {
    process.env = saved;
  });
  process.env.MONOBANK_TOKEN = "synthetic-test-token";
  process.env.MONOBANK_PUBLIC_URL = "https://preview.example.com";
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const key = Buffer.from(publicKey.export({ type: "spki", format: "pem" })).toString("base64");
  t.mock.method(globalThis, "fetch", async () => Response.json({ key }));
  const applied: unknown[] = [];
  const post = await route("src/app/api/shop/monobank/callback/route.ts", {
    "@/lib/prisma": { prisma: {} },
    "@/lib/shopMonobankPayments": {
      applyMonobankStatus: async (_db: unknown, data: unknown) => {
        applied.push(data);
      },
    },
  });
  const body = JSON.stringify({
    invoiceId: "test",
    status: "success",
    amount: 100,
    ccy: 980,
    finalAmount: 100,
    modifiedDate: "2026-09-22T10:00:00Z",
    reference: "local-payment",
  });
  const signature = sign("sha256", Buffer.from(body), privateKey).toString("base64");
  const request = (raw: string, sig?: string) =>
    new NextRequest("https://preview.example.com/api/shop/monobank/callback", {
      method: "POST",
      body: raw,
      headers: sig ? { "X-Sign": sig } : {},
    });
  assert.equal((await post(request(body))).status, 401);
  assert.equal((await post(request(`${body} `, signature))).status, 401);
  assert.equal(applied.length, 0);
  assert.equal((await post(request(body, signature))).status, 200);
  assert.equal(applied.length, 1);
  const malformed = '{"status":"success"}';
  assert.equal(
    (
      await post(
        request(malformed, sign("sha256", Buffer.from(malformed), privateKey).toString("base64"))
      )
    ).status,
    400
  );
  assert.equal(applied.length, 1);
});

test("resuming payment requires the order capability or its authenticated customer", async () => {
  let customerId: string | null = null;
  let query: unknown;
  let created = 0;
  let allowOrder = false;
  const post = await route("src/app/api/shop/orders/[orderNumber]/monobank/route.ts", {
    "@/lib/prisma": {
      prisma: {
        shopOrder: {
          findFirst: async (args: unknown) => {
            query = args;
            return allowOrder
              ? { id: "o1", paymentMethod: "MONOBANK", monobankPayment: null }
              : null;
          },
        },
      },
    },
    "@/lib/shopCustomerSession": {
      getCurrentShopCustomerSession: async () => (customerId ? { customerId } : null),
    },
    "@/lib/shopMonobankPayments": {
      prepareMonobankPayment: async () => {
        created++;
        return "https://pay.mbnk.biz/test";
      },
      refreshMonobankPayment: async () => {},
    },
  });
  const req = (body: unknown) =>
    new NextRequest("https://preview.example.com/api/shop/orders/OC-1/monobank", {
      method: "POST",
      body: JSON.stringify(body),
    });
  const ctx = { params: Promise.resolve({ orderNumber: "OC-1" }) };
  assert.equal((await post(req({}), ctx)).status, 401);
  assert.equal(query, undefined);
  assert.equal((await post(req({ token: "invalid" }), ctx)).status, 404);
  assert.deepEqual(query, {
    where: { orderNumber: "OC-1", viewToken: "invalid" },
    include: { monobankPayment: true },
  });
  assert.equal(created, 0);
  customerId = "customer-1";
  allowOrder = true;
  assert.equal((await post(req({}), ctx)).status, 200);
  assert.deepEqual(query, {
    where: { orderNumber: "OC-1", customerId: "customer-1" },
    include: { monobankPayment: true },
  });
  assert.equal(created, 1);
});

test("admin emails the open mono link in the buyer's language and records it", async (t) => {
  const saved = { ...process.env };
  t.after(() => {
    process.env = saved;
  });
  process.env.RESEND_API_KEY = "re_synthetic";
  process.env.EMAIL_FROM = "info@example.invalid";
  const sent: Array<{ to: string[]; subject: string }> = [];
  const events: Array<{ note: string }> = [];
  let sendError: { name: string; message: string } | null = null;
  let historyDown = false;
  let order: Record<string, unknown> | null = null;
  const db: Record<string, unknown> = {
    shopOrder: { findUnique: async () => order },
    shopOrderStatusEvent: {
      create: async ({ data }: { data: { note: string } }) => {
        if (historyDown) throw new Error("database unavailable");
        events.push(data);
      },
    },
  };
  db.$transaction = async (callback: (tx: unknown) => Promise<unknown>) => callback(db);
  const post = await route("src/app/api/admin/shop/orders/[id]/monobank/email/route.ts", {
    "next/headers": { cookies: async () => ({}) },
    "@/lib/adminAuth": { assertAdminRequest: async () => ({ name: "Manager", email: "m@x" }) },
    "@/lib/adminRbac": {
      ADMIN_PERMISSIONS: { SHOP_ORDERS_WRITE: "shop.orders.write" },
      writeAdminAuditLog: async () => {},
    },
    "@/lib/prisma": { prisma: db },
    "@/lib/shopMonobankPayments": {
      reusableMonobankLink: (payment: { pageUrl?: string } | null) => payment?.pageUrl ?? null,
    },
    "@/components/emails/PaymentLinkEmail": { __esModule: true, default: () => null },
    "@react-email/render": { render: async () => "<html></html>" },
    resend: {
      Resend: class {
        emails = {
          send: async (message: { to: string[]; subject: string }) => {
            sent.push(message);
            return sendError ? { data: null, error: sendError } : { data: { id: "e1" }, error: null };
          },
        };
      },
    },
  });
  const call = () =>
    post(new NextRequest("https://preview.example.com/api/admin/shop/orders/o1/monobank/email", {
      method: "POST",
    }), { params: Promise.resolve({ id: "o1" }) });
  const base = {
    id: "o1",
    orderNumber: "OC-2026-00099",
    email: "buyer@example.invalid",
    customerName: "Buyer",
    status: "PENDING_PAYMENT",
    paymentMethod: "MONOBANK",
    paymentStatus: "PENDING",
    amountPaid: 0,
    isDraft: false,
    currency: "UAH",
    total: 1782.16,
    shippingAddress: { country: "Ukraine" },
    monobankPayment: { pageUrl: "https://pay.monobank.ua/test", expiresAt: null },
  };

  order = { ...base, monobankPayment: null };
  assert.equal((await call()).status, 409);
  // A settled or cancelled order never gets its old live invoice by email.
  for (const patch of [
    { paymentStatus: "PAID" },
    { amountPaid: 100 },
    { status: "CANCELLED" },
    { paymentMethod: "FOP" },
  ]) {
    const refused = await (order = { ...base, ...patch }, call());
    assert.equal(refused.status, 409);
    assert.equal((await refused.json()).error, "ORDER_NOT_PAYABLE");
  }
  assert.equal(sent.length, 0);

  order = base;
  const ok = await call();
  assert.equal(ok.status, 200);
  assert.deepEqual(sent[0].to, ["buyer@example.invalid"]);
  assert.equal(sent[0].subject, "Оплата замовлення OC-2026-00099");
  assert.match(events[0].note, /buyer@example\.invalid/);

  order = { ...base, currency: "EUR", shippingAddress: { country: "Germany" } };
  await call();
  assert.equal(sent[1].subject, "Payment for order OC-2026-00099");

  // Sent but the history write failed: still a success, so nobody re-sends it.
  historyDown = true;
  const unrecorded = await call();
  assert.equal(unrecorded.status, 200);
  assert.equal((await unrecorded.json()).recorded, false);
  assert.equal(sent.length, 3);
  historyDown = false;

  sendError = { name: "validation_error", message: "API key is invalid" };
  assert.equal((await call()).status, 502);
  assert.equal(events.length, 2);
});
