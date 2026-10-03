import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { prepareAdminMonobankPayment } from "../../../src/lib/shopAdminMonobank";

const databaseUrl = process.env.MONOBANK_TEST_DATABASE_URL;
test("admin payment recovery uses a real disposable DB and synthetic bank", { skip: !databaseUrl }, async (t) => {
  const target = new URL(databaseUrl!);
  assert.ok(["localhost", "127.0.0.1"].includes(target.hostname) && target.pathname.startsWith("/monobank_test"));
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const saved = { ...process.env };
  process.env.MONOBANK_ENABLED = "1";
  process.env.MONOBANK_TOKEN = "synthetic-test-token";
  process.env.MONOBANK_PUBLIC_URL = "https://preview.example.com";
  const ids: string[] = [];
  let creates = 0;
  let statusReads = 0;
  let paid = false;
  let statusFails = false;
  t.mock.method(globalThis, "fetch", async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("invoice/create")) {
      creates++;
      const body = JSON.parse(String(init?.body));
      const payment = await prisma.shopMonobankPayment.findUniqueOrThrow({ where: { id: body.merchantPaymInfo.reference } });
      return Response.json({ invoiceId: `invoice-${payment.orderId}`, pageUrl: `https://pay.mbnk.biz/invoice-${payment.orderId}` });
    }
    if (url.includes("invoice/status")) {
      statusReads++;
      if (statusFails) return new Response("Unavailable", { status: 503 });
      const invoiceId = new URL(url).searchParams.get("invoiceId")!;
      const payment = await prisma.shopMonobankPayment.findUniqueOrThrow({ where: { invoiceId } });
      return Response.json({ invoiceId, reference: payment.id, amount: payment.amount, ccy: 980, status: paid ? "success" : "created", ...(paid ? { finalAmount: payment.amount } : {}), modifiedDate: new Date().toISOString() });
    }
    throw new Error("Unexpected external request in test");
  });
  t.after(async () => {
    await prisma.shopMonobankPayment.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.shopOrder.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
    process.env = saved;
  });
  async function fixture(patch: { country?: string; currency?: string; paymentMethod?: string; pricingSnapshot?: object } = {}) {
    const key = randomUUID();
    const order = await prisma.shopOrder.create({ data: { orderNumber: `ADMIN-MONO-TEST-${key}`, customerName: "Synthetic buyer", email: "test@example.invalid", shippingAddress: { country: patch.country ?? "Ukraine", line1: "Test", city: "Test" }, currency: patch.currency ?? "UAH", subtotal: 100, shippingCost: 0, taxAmount: 0, total: 100, viewToken: key, paymentMethod: patch.paymentMethod ?? "FOP", paymentStatus: "UNPAID", status: "PENDING_REVIEW", ...(patch.pricingSnapshot ? { pricingSnapshot: patch.pricingSnapshot } : {}), items: { create: [{ productSlug: "synthetic-item", title: "Synthetic item", quantity: 1, price: 100, total: 100 }] } } });
    ids.push(order.id);
    return order;
  }
  await t.test("two admin clicks create one invoice and retain an existing valid link", async () => {
    const order = await fixture();
    const callsBefore = creates;
    const results = await Promise.allSettled([prepareAdminMonobankPayment(prisma, order.id, "ua", "Test admin"), prepareAdminMonobankPayment(prisma, order.id, "ua", "Test admin")]);
    assert.ok(results.some((result) => result.status === "fulfilled"));
    assert.equal(creates - callsBefore, 1);
    assert.equal(await prisma.shopMonobankPayment.count({ where: { orderId: order.id } }), 1);
    const link = await prepareAdminMonobankPayment(prisma, order.id, "ua", "Test admin");
    assert.match(link, /^https:\/\/pay\.mbnk\.biz\//);
    assert.equal(creates - callsBefore, 1);
  });
  await t.test("fresh bank success blocks an admin retry even immediately after a poll", async () => {
    const order = await fixture();
    await prepareAdminMonobankPayment(prisma, order.id, "ua", "Test admin");
    await prisma.shopMonobankPayment.update({ where: { orderId: order.id }, data: { lastSyncedAt: new Date() } });
    const before = statusReads;
    paid = true;
    await assert.rejects(prepareAdminMonobankPayment(prisma, order.id, "ua", "Test admin"), /MONOBANK_ORDER_NOT_PAYABLE/);
    assert.equal(statusReads, before + 1);
    assert.equal((await prisma.shopOrder.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus, "PAID");
    paid = false;
  });
  await t.test("unavailable bank status does not return a potentially stale payment link", async () => {
    const order = await fixture();
    await prepareAdminMonobankPayment(prisma, order.id, "ua", "Test admin");
    const before = creates;
    statusFails = true;
    await assert.rejects(prepareAdminMonobankPayment(prisma, order.id, "ua", "Test admin"), /MONOBANK_HTTP_503/);
    assert.equal(creates, before);
    statusFails = false;
  });
  await t.test("international invoice requires the exact agreed UAH total", async () => {
    const order = await fixture({ country: "United States", paymentMethod: "MANAGER_QUOTE" });
    const before = creates;
    await assert.rejects(prepareAdminMonobankPayment(prisma, order.id, "ua", "Test admin"), /INTERNATIONAL_DELIVERY_NOT_AGREED/);
    await prisma.shopOrder.update({ where: { id: order.id }, data: { pricingSnapshot: { internationalDelivery: { status: "agreed", currency: "UAH", total: 99 } } } });
    await assert.rejects(prepareAdminMonobankPayment(prisma, order.id, "ua", "Test admin"), /INTERNATIONAL_DELIVERY_NOT_AGREED/);
    assert.equal(creates, before);
    await prisma.shopOrder.update({ where: { id: order.id }, data: { pricingSnapshot: { internationalDelivery: { status: "agreed", currency: "UAH", total: 100 } } } });
    await prepareAdminMonobankPayment(prisma, order.id, "ua", "Test admin");
    assert.equal(creates, before + 1);
  });
  await t.test("another provider and unsupported currency require review before any mutation", async () => {
    for (const [patch, code] of [[{ paymentMethod: "WHITEPAY_FIAT" }, "OTHER_PAYMENT_PROVIDER_REVIEW_REQUIRED"], [{ currency: "USD" }, "MONOBANK_REQUIRES_UAH_QUOTE"]] as const) {
      const order = await fixture(patch);
      await assert.rejects(prepareAdminMonobankPayment(prisma, order.id, "ua", "Test admin"), new RegExp(code));
      assert.equal(await prisma.shopMonobankPayment.count({ where: { orderId: order.id } }), 0);
      assert.equal((await prisma.shopOrder.findUniqueOrThrow({ where: { id: order.id } })).paymentMethod, order.paymentMethod);
    }
  });
});
