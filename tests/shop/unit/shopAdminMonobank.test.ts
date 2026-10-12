import test from "node:test";
import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { prepareAdminMonobankPayment } from "../../../src/lib/shopAdminMonobank";

function fakePrisma(patch: Record<string, unknown> = {}) {
  const now = new Date("2026-10-04T12:00:00.000Z");
  const order: Record<string, unknown> = {
    id: "synthetic-order-1",
    orderNumber: "OC-TEST-1",
    viewToken: "synthetic-view-token",
    customerId: null,
    customerName: "Synthetic buyer",
    email: "buyer@example.invalid",
    phone: null,
    shippingAddress: { country: "Ukraine" },
    pricingSnapshot: null,
    currency: "UAH",
    subtotal: 1000,
    shippingCost: 0,
    taxAmount: 0,
    total: 1000,
    amountPaid: 0,
    paymentMethod: "CARD_PROCESSOR",
    paymentStatus: "PENDING",
    status: "PENDING_PAYMENT",
    stripeCheckoutSessionId: null,
    updatedAt: now,
    isDraft: false,
    items: [
      {
        id: "item-1",
        title: "Synthetic item",
        productSlug: "synthetic-item",
        quantity: 1,
        price: 1000,
        total: 1000,
        image: null,
        variantId: null,
      },
    ],
    ...patch,
  };
  const events: Array<Record<string, unknown>> = [];
  const payment: Record<string, unknown> = {};
  let paymentCreated = false;
  let providerCreates = 0;

  const tx = {
    shopOrder: {
      findUnique: async () => ({ ...order, monobankPayment: paymentCreated ? payment : null }),
      findUniqueOrThrow: async () => ({
        ...order,
        monobankPayment: paymentCreated ? payment : null,
      }),
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        if (!Object.entries(where).every(([key, value]) => Reflect.get(order, key) === value))
          return { count: 0 };
        Object.assign(order, data, { updatedAt: new Date() });
        return { count: 1 };
      },
    },
    shopMonobankPayment: {
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        if (!paymentCreated) {
          Object.assign(payment, {
            id: "mono-payment-1",
            orderId: order.id,
            invoiceId: null,
            pageUrl: null,
            amount: create.amount,
            status: "new",
            providerModifiedAt: null,
            lastSyncedAt: null,
            expiresAt: null,
            createdAt: now,
            updatedAt: now,
            ...create,
          });
          paymentCreated = true;
        }
        return payment;
      },
      findUnique: async () =>
        paymentCreated ? { ...payment, order: { ...order, items: order.items } } : null,
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        if (!paymentCreated || where.id !== payment.id) return { count: 0 };
        if (where.invoiceId === null && payment.invoiceId !== null) return { count: 0 };
        const status = where.status as string | { in?: string[] } | undefined;
        if (typeof status === "string" && status !== payment.status) return { count: 0 };
        if (typeof status === "object" && status.in && !status.in.includes(String(payment.status)))
          return { count: 0 };
        const alternatives = where.OR as Array<Record<string, unknown>> | undefined;
        if (
          alternatives &&
          !alternatives.some((condition) =>
            condition.invoiceId === null
              ? payment.invoiceId === null
              : condition.invoiceId === payment.invoiceId
          )
        )
          return { count: 0 };
        Object.assign(payment, data, { updatedAt: new Date() });
        return { count: 1 };
      },
    },
    shopOrderStatusEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        events.push(data);
        return data;
      },
    },
  };
  const prisma = {
    shopOrder: { findUnique: tx.shopOrder.findUnique },
    shopMonobankPayment: tx.shopMonobankPayment,
    $transaction: async (handler: (transaction: typeof tx) => Promise<unknown>) => handler(tx),
  } as unknown as PrismaClient;
  return {
    prisma,
    order,
    events,
    get providerCreates() {
      return providerCreates;
    },
    countProviderCreate() {
      providerCreates++;
    },
  };
}

function configureMono(t: TestContext) {
  const saved = { ...process.env };
  t.after(() => {
    process.env = saved;
  });
  process.env.MONOBANK_ENABLED = "1";
  process.env.MONOBANK_TOKEN = "synthetic-test-token";
  process.env.MONOBANK_PUBLIC_URL = "https://preview.example.com";
}

test("an unverified external payment is blocked without calling Mono", async (t) => {
  configureMono(t);
  const fake = fakePrisma();
  t.mock.method(globalThis, "fetch", async () => {
    fake.countProviderCreate();
    throw new Error("Mono must not be called before confirmation");
  });
  await assert.rejects(
    prepareAdminMonobankPayment(fake.prisma, "synthetic-order-1", "ua", "Test admin"),
    /PREVIOUS_PAYMENT_UNVERIFIED/
  );
  assert.equal(fake.providerCreates, 0);
  assert.equal(fake.order.paymentMethod, "CARD_PROCESSOR");
});

test("an unpaid manual order can receive a Mono invoice", async (t) => {
  configureMono(t);
  const fake = fakePrisma({ paymentMethod: "FOP", paymentStatus: "UNPAID" });
  const sentBodies: Record<string, unknown>[] = [];
  t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => {
    fake.countProviderCreate();
    sentBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return Response.json({
      invoiceId: "synthetic-invoice-1",
      pageUrl: "https://pay.mbnk.biz/synthetic-invoice-1",
    });
  });
  const link = await prepareAdminMonobankPayment(
    fake.prisma,
    "synthetic-order-1",
    "ua",
    "Test admin"
  );
  assert.deepEqual(link, { url: "https://pay.mbnk.biz/synthetic-invoice-1", statusVerified: true });
  assert.equal(fake.providerCreates, 1);
  assert.equal(fake.order.paymentMethod, "MONOBANK");
  assert.equal(fake.order.paymentStatus, "PENDING");
  assert.equal(fake.order.status, "PENDING_PAYMENT");
  assert.match(String(fake.events[0].note), /перевірки статусу/i);
  assert.equal(
    (sentBodies[0].merchantPaymInfo as Record<string, unknown>).destination,
    "OneCompany OC-TEST-1"
  );
});

test("paid amounts cannot be retried even with explicit confirmation", async (t) => {
  configureMono(t);
  const fake = fakePrisma({ amountPaid: 1000, paymentStatus: "PAID", status: "CONFIRMED" });
  t.mock.method(globalThis, "fetch", async () => {
    fake.countProviderCreate();
    throw new Error("Mono must not be called for a paid order");
  });
  await assert.rejects(
    prepareAdminMonobankPayment(fake.prisma, "synthetic-order-1", "ua", "Test admin"),
    /MONOBANK_ORDER_NOT_PAYABLE/
  );
  assert.equal(fake.providerCreates, 0);
});

for (const [name, patch, error] of [
  [
    "unaccepted draft",
    { isDraft: true, paymentMethod: "FOP", paymentStatus: "UNPAID" },
    /DRAFT_NOT_ACCEPTED/,
  ],
  [
    "cancelled order",
    { status: "CANCELLED", paymentMethod: "FOP", paymentStatus: "UNPAID" },
    /ORDER_NOT_PAYABLE/,
  ],
  [
    "Stripe session even if marked failed",
    { stripeCheckoutSessionId: "cs_old", paymentMethod: "FOP", paymentStatus: "FAILED" },
    /PREVIOUS_PAYMENT_UNVERIFIED/,
  ],
] as const) {
  test(`${name} cannot create or mutate a Mono payment`, async (t) => {
    configureMono(t);
    const fake = fakePrisma(patch);
    await assert.rejects(
      prepareAdminMonobankPayment(fake.prisma, "synthetic-order-1", "ua", "Test admin"),
      error
    );
    assert.equal(fake.events.length, 0);
    assert.equal(fake.providerCreates, 0);
  });
}

function monoInvoiceResponse() {
  return Response.json({
    invoiceId: "synthetic-invoice-1",
    pageUrl: "https://pay.mbnk.biz/synthetic-invoice-1",
  });
}

test("a manager can replace an unpaid Whitepay order with mono after explicit confirmation", async (t) => {
  configureMono(t);
  const fake = fakePrisma({ paymentMethod: "WHITEBIT", paymentStatus: "UNPAID" });
  t.mock.method(globalThis, "fetch", async () => {
    fake.countProviderCreate();
    return monoInvoiceResponse();
  });
  await assert.rejects(
    prepareAdminMonobankPayment(fake.prisma, "synthetic-order-1", "ua", "Test admin"),
    /PREVIOUS_PAYMENT_UNVERIFIED/
  );
  assert.equal(fake.providerCreates, 0);

  const link = await prepareAdminMonobankPayment(
    fake.prisma,
    "synthetic-order-1",
    "ua",
    "Test admin",
    {
      replacePreviousProvider: true,
    }
  );
  assert.deepEqual(link, { url: "https://pay.mbnk.biz/synthetic-invoice-1", statusVerified: true });
  assert.equal(fake.order.paymentMethod, "MONOBANK");
  assert.match(String(fake.events[0].note), /Test admin підтвердив\(ла\).*Whitepay.*plata by mono/);
});

test("the provider override never applies to a legacy Stripe session", async (t) => {
  configureMono(t);
  const fake = fakePrisma({
    paymentMethod: "WHITEBIT",
    paymentStatus: "UNPAID",
    stripeCheckoutSessionId: "cs_old",
  });
  t.mock.method(globalThis, "fetch", async () => {
    fake.countProviderCreate();
    return monoInvoiceResponse();
  });
  await assert.rejects(
    prepareAdminMonobankPayment(fake.prisma, "synthetic-order-1", "ua", "Test admin", {
      replacePreviousProvider: true,
    }),
    /PREVIOUS_PAYMENT_UNVERIFIED/
  );
  assert.equal(fake.providerCreates, 0);
});

test("an open invoice is re-shared when Mono does not answer the status check", async (t) => {
  configureMono(t);
  const fake = fakePrisma({ paymentMethod: "FOP", paymentStatus: "UNPAID" });
  let monoDown = false;
  t.mock.method(globalThis, "fetch", async () => {
    if (monoDown) throw new Error("synthetic timeout");
    fake.countProviderCreate();
    return monoInvoiceResponse();
  });
  await prepareAdminMonobankPayment(fake.prisma, "synthetic-order-1", "ua", "Test admin");
  monoDown = true;
  const link = await prepareAdminMonobankPayment(
    fake.prisma,
    "synthetic-order-1",
    "ua",
    "Test admin"
  );
  assert.deepEqual(link, {
    url: "https://pay.mbnk.biz/synthetic-invoice-1",
    statusVerified: false,
  });
  assert.equal(fake.providerCreates, 1, "no second invoice while the bank is silent");
});

test("an invoice request whose outcome never arrived can be issued again", async (t) => {
  configureMono(t);
  const fake = fakePrisma({ paymentMethod: "FOP", paymentStatus: "UNPAID" });
  let attempt = 0;
  t.mock.method(globalThis, "fetch", async () => {
    attempt++;
    if (attempt === 1) throw new Error("synthetic timeout during create");
    fake.countProviderCreate();
    return monoInvoiceResponse();
  });
  await assert.rejects(
    prepareAdminMonobankPayment(fake.prisma, "synthetic-order-1", "ua", "Test admin"),
    /MONOBANK_REQUEST_UNCERTAIN/
  );
  const link = await prepareAdminMonobankPayment(
    fake.prisma,
    "synthetic-order-1",
    "ua",
    "Test admin"
  );
  assert.equal(link.url, "https://pay.mbnk.biz/synthetic-invoice-1");
  assert.ok(fake.events.some((event) => /не завершився/.test(String(event.note))));
});
