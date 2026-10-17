import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import path from "node:path";
import { build } from "esbuild";
import { NextRequest } from "next/server";
import * as realMono from "../../../src/lib/shopMonobank";

const requireReal = createRequire(path.resolve("package.json"));

type Payment = { id: string; invoiceId: string | null; status: string; amount: number; ccy: number; providerModifiedAt: Date | null };

function fixture(patch: { country?: string; payment?: Partial<Payment> | null; order?: Record<string, unknown> } = {}) {
  const order: Record<string, unknown> = {
    id: "order1",
    isDraft: false,
    status: "PENDING_PAYMENT",
    paymentMethod: "MONOBANK",
    paymentStatus: "PENDING",
    amountPaid: 0,
    updatedAt: new Date("2026-10-17T10:00:00Z"),
    shippingAddress: { country: patch.country ?? "Ukraine" },
    ...patch.order,
  };
  let payment: Payment | null =
    patch.payment === null
      ? null
      : { id: "pay1", invoiceId: "inv-1", status: "created", amount: 20082, ccy: 980, providerModifiedAt: null, ...patch.payment };
  const history: Array<Record<string, unknown>> = [];
  const events: string[] = [];
  const db = {
    shopOrder: {
      findUnique: async () => ({ ...order, monobankPayment: payment }),
      findUniqueOrThrow: async () => ({ ...order, monobankPayment: payment }),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const matches = ["paymentMethod", "paymentStatus"].every((key) => where[key] === order[key]);
        if (!matches) return { count: 0 };
        Object.assign(order, data);
        return { count: 1 };
      },
    },
    shopMonobankPayment: {
      findUnique: async () => payment,
      delete: async () => {
        payment = null;
      },
    },
    shopMonobankPaymentHistory: { create: async ({ data }: { data: Record<string, unknown> }) => history.push(data) },
    shopOrderStatusEvent: { create: async ({ data }: { data: { note: string } }) => events.push(data.note) },
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(db),
  };
  return {
    db,
    order,
    history,
    events,
    get payment() {
      return payment;
    },
    setBankStatus(status: string) {
      if (payment) payment.status = status;
    },
  };
}

async function cancelRoute(f: ReturnType<typeof fixture>, bank: { status?: string; removeError?: string }) {
  const removed: string[] = [];
  const audits: unknown[] = [];
  const bundled = await build({
    entryPoints: ["src/app/api/admin/shop/orders/[id]/monobank/cancel/route.ts"],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    packages: "external",
    plugins: [
      {
        name: "change-order-fixtures",
        setup(builder) {
          builder.onResolve(
            { filter: /^@\/lib\/(prisma|adminAuth|adminRbac|shopMonobank|shopMonobankPayments)$/ },
            (args) => ({ path: args.path, external: true })
          );
        },
      },
    ],
  });
  const dependencies: Record<string, unknown> = {
    "next/headers": { cookies: async () => ({}) },
    "@/lib/prisma": { prisma: f.db },
    "@/lib/adminAuth": { assertAdminRequest: async () => ({ name: "Менеджер", email: "m@example.invalid" }) },
    "@/lib/adminRbac": {
      ADMIN_PERMISSIONS: { SHOP_ORDERS_WRITE: "shop.orders.write" },
      writeAdminAuditLog: async (_db: unknown, _session: unknown, entry: unknown) => audits.push(entry),
    },
    "@/lib/shopMonobank": {
      ...realMono,
      isMonobankEnabled: () => true,
      removeMonobankInvoice: async (invoiceId: string) => {
        if (bank.removeError) throw new realMono.MonobankError(bank.removeError, true);
        removed.push(invoiceId);
      },
    },
    "@/lib/shopMonobankPayments": {
      // The bank's current state is read first.
      refreshMonobankPayment: async () => {
        if (bank.status) f.setBankStatus(bank.status);
        return true;
      },
      prepareMonobankPayment: async () => null,
      reusableMonobankLink: () => null,
      renewExpiredMonobankPayment: async () => undefined,
    },
  };
  const routeModule = { exports: {} as { POST: (request: NextRequest, context: unknown) => Promise<Response> } };
  new Function("require", "module", "exports", bundled.outputFiles[0].text)(
    (id: string) => dependencies[id] ?? requireReal(id),
    routeModule,
    routeModule.exports
  );
  const response = await routeModule.exports.POST(
    new NextRequest("https://onecompany.global/api/admin/shop/orders/order1/monobank/cancel", { method: "POST" }),
    { params: Promise.resolve({ id: "order1" }) }
  );
  return { response, body: await response.json(), removed, audits };
}

test("an open link in Ukraine is invalidated at the bank and the order becomes editable", async () => {
  const f = fixture();
  const { response, body, removed, audits } = await cancelRoute(f, { status: "created" });
  assert.equal(response.status, 200);
  assert.deepEqual(body, { ok: true, international: false, invoiceId: "inv-1" });
  assert.deepEqual(removed, ["inv-1"]);
  assert.equal(f.payment, null);
  assert.equal(f.history[0].invoiceId, "inv-1");
  assert.equal(f.history[0].status, "removed");
  assert.equal(f.order.paymentStatus, "UNPAID");
  assert.equal(f.order.paymentMethod, "MONOBANK");
  assert.match(f.events[0], /inv-1 скасовано/);
  assert.equal(audits.length, 1);
});

test("abroad the order goes back to the manager's quote, where the currency is chosen", async () => {
  const f = fixture({ country: "Germany" });
  const { body } = await cancelRoute(f, { status: "created" });
  assert.equal(body.international, true);
  assert.equal(f.order.paymentMethod, "MANAGER_QUOTE");
  assert.equal(f.order.paymentStatus, "UNPAID");
  assert.match(f.events[0], /валюту заново/);
});

test("a payment in progress or done is never cut off", async () => {
  for (const status of ["processing", "success", "hold"]) {
    const f = fixture();
    const { response, body, removed } = await cancelRoute(f, { status });
    assert.equal(response.status, 409);
    assert.equal(body.error, "MONOBANK_PAYMENT_IN_PROGRESS");
    assert.deepEqual(removed, []);
    assert.notEqual(f.payment, null);
    assert.equal(f.order.paymentStatus, "PENDING");
  }
  const paid = fixture({ order: { amountPaid: 200.82, paymentStatus: "PAID" } });
  const refused = await cancelRoute(paid, { status: "created" });
  assert.equal(refused.body.error, "MONOBANK_ORDER_NOT_PAYABLE");
  assert.deepEqual(refused.removed, []);
});

test("an expired link needs no bank call; a bank refusal or an invoice being created changes nothing", async () => {
  const expired = fixture();
  const done = await cancelRoute(expired, { status: "expired" });
  assert.equal(done.response.status, 200);
  assert.deepEqual(done.removed, []);
  assert.equal(expired.payment, null);

  const refused = fixture();
  const answer = await cancelRoute(refused, { status: "created", removeError: "MONOBANK_HTTP_400" });
  assert.equal(answer.response.status, 502);
  assert.equal(answer.body.error, "MONOBANK_HTTP_400");
  assert.notEqual(refused.payment, null);
  assert.equal(refused.order.paymentStatus, "PENDING");

  const creating = fixture({ payment: { invoiceId: null, status: "creating" } });
  const pending = await cancelRoute(creating, {});
  assert.equal(pending.body.error, "MONOBANK_PAYMENT_PENDING");
  assert.notEqual(creating.payment, null);
});
