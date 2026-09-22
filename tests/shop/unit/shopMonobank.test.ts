import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  buildMonobankInvoice,
  createMonobankInvoice,
  getMonobankConfig,
  isMonobankEnabled,
  isMonobankPaymentUrl,
  monobankCheckoutKey,
  monobankMinorUnits,
  parseMonobankStatus,
  resolveMonobankStatusUpdate,
  verifyMonobankSignature,
} from "../../../src/lib/shopMonobank";

const order = {
  orderNumber: "OC-TEST-1",
  viewToken: "guest-secret",
  currency: "UAH",
  total: 253.45,
  shippingCost: 20,
  taxAmount: 10,
  items: [
    { title: "Brake pads", productSlug: "test-brakes", quantity: 3, price: 74.48, total: 223.44 },
  ],
};
const payment = {
  id: "pay-test",
  invoiceId: "invoice-test",
  amount: 25345,
  ccy: 980,
  status: "created",
  providerModifiedAt: null as Date | null,
};
const storedOrder = { ...order, paymentMethod: "MONOBANK", paymentStatus: "PENDING" };
const event = {
  invoiceId: "invoice-test",
  status: "success" as const,
  amount: 25345,
  ccy: 980,
  finalAmount: 25345,
  modifiedDate: "2026-09-22T10:00:00Z",
  reference: "pay-test",
};

test("invoice uses integer kopecks, debit, persisted basket and explicit environment URLs", () => {
  const invoice = buildMonobankInvoice(order, payment.id, "ua", "https://preview.example.com");
  assert.equal(invoice.amount, 25345);
  assert.equal(invoice.ccy, 980);
  assert.equal(invoice.paymentType, "debit");
  assert.equal(invoice.merchantPaymInfo.reference, payment.id);
  assert.equal(
    invoice.merchantPaymInfo.basketOrder.reduce((sum, row) => sum + row.total, 0),
    invoice.amount
  );
  assert.equal(invoice.merchantPaymInfo.basketOrder[0].qty, 3);
  assert.equal(invoice.webHookUrl, "https://preview.example.com/api/shop/monobank/callback");
  assert.match(
    invoice.redirectUrl,
    /\/ua\/shop\/checkout\/success\?order=OC-TEST-1&token=guest-secret$/
  );
  assert.equal("saveCardData" in invoice, false);
  assert.equal("customerEmails" in invoice.merchantPaymInfo, false);
});

test("basket discounts reconcile to the charged total", () => {
  const invoice = buildMonobankInvoice(
    { ...order, total: 200 },
    payment.id,
    "en",
    "https://preview.example.com"
  );
  assert.deepEqual(invoice.merchantPaymInfo.discounts, [
    { type: "DISCOUNT", mode: "VALUE", value: 53.44 },
  ]);
});

test("zero, unsupported currency, noninteger quantities and unsafe amounts are rejected", () => {
  for (const currency of ["EUR", "USD"]) {
    assert.throws(() =>
      buildMonobankInvoice({ ...order, currency }, payment.id, "en", "https://example.com")
    );
  }
  assert.throws(() =>
    buildMonobankInvoice({ ...order, total: 0 }, payment.id, "en", "https://example.com")
  );
  assert.throws(() =>
    buildMonobankInvoice(
      { ...order, items: [{ ...order.items[0], quantity: 1.5 }] },
      payment.id,
      "en",
      "https://example.com"
    )
  );
  assert.throws(() =>
    buildMonobankInvoice(
      { ...order, items: [{ ...order.items[0], total: 1 }] },
      payment.id,
      "en",
      "https://example.com"
    )
  );
  for (const value of [-1, Infinity, NaN, 30_000_000])
    assert.throws(() => monobankMinorUnits(value));
  assert.equal(monobankMinorUnits(19.99), 1999);
});

test("config is opt-in, server-only, and requires an explicit HTTPS origin", (t) => {
  const saved = { ...process.env };
  t.after(() => {
    process.env = saved;
  });
  delete process.env.MONOBANK_ENABLED;
  delete process.env.MONOBANK_TOKEN;
  delete process.env.MONOBANK_PUBLIC_URL;
  assert.equal(isMonobankEnabled(), false);
  process.env.MONOBANK_TOKEN = "synthetic-test-token";
  process.env.MONOBANK_PUBLIC_URL = "https://preview.example.com";
  assert.equal(isMonobankEnabled(), false);
  process.env.MONOBANK_ENABLED = "1";
  assert.equal(isMonobankEnabled(), true);
  for (const publicUrl of [
    "http://example.com",
    "https://user:pass@example.com",
    "https://example.com/path",
    "https://example.com?foo=1",
  ]) {
    process.env.MONOBANK_PUBLIC_URL = publicUrl;
    assert.throws(getMonobankConfig);
    assert.equal(isMonobankEnabled(), false);
  }
});

test("payment URL rejects impersonation and javascript redirects", () => {
  for (const url of [
    "javascript:alert(1)",
    "https://pay.mbnk.biz.evil.test/x",
    "https://pay.mbnk.biz@evil.test",
    "http://pay.mbnk.biz/x",
  ])
    assert.equal(isMonobankPaymentUrl(url), false);
  assert.equal(isMonobankPaymentUrl("https://pay.mbnk.biz/test-invoice"), true);
});

test("checkout capabilities are unpredictable UUIDs and stored only as hashes", () => {
  const key = "1357a069-a573-47f0-9a23-935261b03bc5";
  assert.equal(monobankCheckoutKey(key).length, 64);
  assert.equal(monobankCheckoutKey(key), monobankCheckoutKey(key));
  assert.throws(() => monobankCheckoutKey("order-123"));
});

test("raw-body ECDSA verification rejects tampering, wrong key and missing signature", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const key = Buffer.from(publicKey.export({ type: "spki", format: "pem" })).toString("base64");
  const raw = JSON.stringify(event);
  const signature = sign("sha256", Buffer.from(raw), privateKey).toString("base64");
  assert.equal(verifyMonobankSignature(raw, signature, key), true);
  assert.equal(verifyMonobankSignature(`${raw} `, signature, key), false);
  assert.equal(verifyMonobankSignature(raw.replace("25345", "25346"), signature, key), false);
  assert.equal(verifyMonobankSignature(raw, "", key), false);
  assert.equal(verifyMonobankSignature(raw, signature, "invalid"), false);
});

test("status payload validation does not coerce amounts or accept unknown statuses", () => {
  assert.deepEqual(
    parseMonobankStatus({ ...event, paymentInfo: { cardToken: "not-retained" } }),
    event
  );
  for (const patch of [
    { amount: "25345" },
    { status: "paid" },
    { finalAmount: 30000 },
    { finalAmount: -1 },
    { modifiedDate: "bad date" },
  ]) {
    assert.throws(() => parseMonobankStatus({ ...event, ...patch }));
  }
});

test("only exact successful debit settlement marks the order paid", () => {
  const paid = resolveMonobankStatusUpdate(payment, storedOrder, event)!;
  assert.equal(paid.paymentStatus, "PAID");
  assert.equal(paid.amountPaid, 253.45);
  for (const status of ["created", "processing", "hold"] as const) {
    assert.equal(
      resolveMonobankStatusUpdate(payment, storedOrder, { ...event, status })!.paymentStatus,
      "PENDING"
    );
  }
  assert.throws(() =>
    resolveMonobankStatusUpdate(payment, storedOrder, { ...event, finalAmount: undefined })
  );
  for (const patch of [
    { amount: 25346 },
    { ccy: 978 },
    { invoiceId: "other" },
    { reference: "other" },
  ]) {
    assert.throws(() => resolveMonobankStatusUpdate(payment, storedOrder, { ...event, ...patch }));
  }
  assert.throws(() => resolveMonobankStatusUpdate(payment, { ...storedOrder, total: 300 }, event));
});

test("duplicate and out-of-order events cannot roll back payment", () => {
  const settled = {
    ...payment,
    status: "success",
    providerModifiedAt: new Date(event.modifiedDate),
  };
  const paidOrder = { ...storedOrder, paymentStatus: "PAID" };
  assert.equal(resolveMonobankStatusUpdate(settled, paidOrder, event), null);
  assert.equal(
    resolveMonobankStatusUpdate(settled, paidOrder, {
      ...event,
      modifiedDate: "2026-09-22T09:00:00Z",
      status: "processing",
    }),
    null
  );
  assert.equal(
    resolveMonobankStatusUpdate(settled, paidOrder, {
      ...event,
      modifiedDate: "2026-09-22T11:00:00Z",
      status: "failure",
    }),
    null
  );
});

test("refunds update net paid amount; webhook can recover a lost creation response", () => {
  assert.equal(
    resolveMonobankStatusUpdate(payment, storedOrder, {
      ...event,
      status: "reversed",
      finalAmount: 20000,
    })!.paymentStatus,
    "PARTIALLY_REFUNDED"
  );
  assert.equal(
    resolveMonobankStatusUpdate(payment, storedOrder, {
      ...event,
      status: "reversed",
      finalAmount: 0,
    })!.amountPaid,
    0
  );
  assert.equal(
    resolveMonobankStatusUpdate(
      { ...payment, invoiceId: null, status: "creating" },
      storedOrder,
      event
    )!.paymentStatus,
    "PAID"
  );
  assert.throws(() =>
    resolveMonobankStatusUpdate({ ...payment, invoiceId: null }, storedOrder, event)
  );
});

test("HTTP errors distinguish a rejected request from an ambiguous network failure", async (t) => {
  const saved = { ...process.env };
  t.after(() => {
    process.env = saved;
  });
  process.env.MONOBANK_TOKEN = "synthetic-test-token";
  process.env.MONOBANK_PUBLIC_URL = "https://preview.example.com";
  const invoice = buildMonobankInvoice(order, payment.id, "en", "https://preview.example.com");
  let calls = 0;
  const fetchMock = t.mock.method(
    globalThis,
    "fetch",
    async (_input: unknown, init?: RequestInit) => {
      calls++;
      assert.equal((init?.headers as Record<string, string>)["X-Token"], "synthetic-test-token");
      assert.equal(init?.redirect, "error");
      return new Response("{}", { status: 403 });
    }
  );
  await assert.rejects(createMonobankInvoice(invoice), {
    code: "MONOBANK_HTTP_403",
    definitive: true,
  });
  fetchMock.mock.mockImplementation(async () => {
    calls++;
    throw new Error("timeout");
  });
  await assert.rejects(createMonobankInvoice(invoice), {
    code: "MONOBANK_REQUEST_UNCERTAIN",
    definitive: false,
  });
  assert.equal(calls, 2, "invoice POST is never automatically retried");
});
