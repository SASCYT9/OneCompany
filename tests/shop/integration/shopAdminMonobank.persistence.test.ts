import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { prepareAdminMonobankPayment } from "../../../src/lib/shopAdminMonobank";
import { applyMonobankStatus } from "../../../src/lib/shopMonobankPayments";

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
  let expired = false;
  let settleDuringCreate = false;
  t.mock.method(globalThis, "fetch", async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("invoice/create")) {
      creates++;
      const body = JSON.parse(String(init?.body));
      const payment = await prisma.shopMonobankPayment.findUniqueOrThrow({ where: { id: body.merchantPaymInfo.reference } });
      if (settleDuringCreate) await applyMonobankStatus(prisma, { invoiceId: `invoice-${payment.id}`, reference: payment.id, amount: payment.amount, ccy: payment.ccy, status: 'success', finalAmount: payment.amount, modifiedDate: new Date().toISOString() });
      return Response.json({ invoiceId: `invoice-${payment.id}`, pageUrl: `https://pay.mbnk.biz/invoice-${payment.id}` });
    }
    if (url.includes("invoice/status")) {
      statusReads++;
      if (statusFails) return new Response("Unavailable", { status: 503 });
      const invoiceId = new URL(url).searchParams.get("invoiceId")!;
      const payment = await prisma.shopMonobankPayment.findUniqueOrThrow({ where: { invoiceId } });
      return Response.json({ invoiceId, reference: payment.id, amount: payment.amount, ccy: 980, status: paid ? "success" : expired ? "expired" : "created", ...(paid ? { finalAmount: payment.amount } : {}), modifiedDate: new Date().toISOString() });
    }
    throw new Error("Unexpected external request in test");
  });
  t.after(async () => {
    await prisma.shopMonobankPaymentHistory.deleteMany({ where: { orderId: { in: ids } } });
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
  await t.test("an unrelated pending card attempt cannot be bypassed by a manual assertion", async () => {
    const order = await fixture({ paymentMethod: "CARD_PROCESSOR" });
    await prisma.shopOrder.update({ where: { id: order.id }, data: { paymentStatus: "PENDING", status: "PENDING_PAYMENT" } });
    await assert.rejects(
      prepareAdminMonobankPayment(prisma, order.id, "ua", "Test admin"),
      /PREVIOUS_PAYMENT_UNVERIFIED/
    );
    assert.equal(await prisma.shopMonobankPayment.count({ where: { orderId: order.id } }), 0);
    const changed = await prisma.shopOrder.findUniqueOrThrow({ where: { id: order.id } });
    assert.equal(changed.paymentMethod, "CARD_PROCESSOR");
    assert.equal(changed.paymentStatus, "PENDING");
    assert.equal(changed.status, "PENDING_PAYMENT");
  });
  await t.test("unaccepted drafts and cancelled orders cannot be reopened by the payment endpoint", async () => {
    for (const data of [{ isDraft: true }, { status: "CANCELLED" as const }]) {
      const order = await fixture();
      await prisma.shopOrder.update({ where: { id: order.id }, data });
      const before = creates;
      await assert.rejects(prepareAdminMonobankPayment(prisma, order.id, "ua", "Test admin"), /DRAFT_NOT_ACCEPTED|ORDER_NOT_PAYABLE/);
      assert.equal(creates, before);
      assert.equal(await prisma.shopMonobankPayment.count({ where: { orderId: order.id } }), 0);
    }
  });
  await t.test("expiry confirmed by the bank renews once, preserving history and isolating late callbacks", async () => {
    const order = await fixture();
    await prepareAdminMonobankPayment(prisma, order.id, "ua", "Test admin");
    const original = await prisma.shopMonobankPayment.findUniqueOrThrow({ where: { orderId: order.id } });
    expired = true;
    const before = creates;
    await Promise.allSettled([prepareAdminMonobankPayment(prisma, order.id, "ua", "Test admin"), prepareAdminMonobankPayment(prisma, order.id, "ua", "Test admin")]);
    expired = false;
    const active = await prisma.shopMonobankPayment.findUniqueOrThrow({ where: { orderId: order.id } });
    assert.notEqual(active.id, original.id);
    assert.notEqual(active.invoiceId, original.invoiceId);
    assert.equal(creates, before + 1);
    assert.equal(await prisma.shopMonobankPaymentHistory.count({ where: { orderId: order.id } }), 1);
    await applyMonobankStatus(prisma, { invoiceId: original.invoiceId!, reference: original.id, amount: original.amount, ccy: 980, status: "failure", modifiedDate: new Date(Date.now() + 1000).toISOString() });
    const after = await prisma.shopOrder.findUniqueOrThrow({ where: { id: order.id } });
    assert.equal(after.paymentStatus, "PENDING");
    assert.equal(after.status, "PENDING_PAYMENT");
    assert.equal((await prisma.shopMonobankPayment.findUniqueOrThrow({ where: { orderId: order.id } })).invoiceId, active.invoiceId);
    await applyMonobankStatus(prisma, { invoiceId: original.invoiceId!, reference: original.id, amount: original.amount, ccy: 980, status: 'success', finalAmount: original.amount, modifiedDate: new Date(Date.now()+2000).toISOString() });
    assert.equal(Number((await prisma.shopOrder.findUniqueOrThrow({where:{id:order.id}})).amountPaid),100);
    await assert.rejects(prepareAdminMonobankPayment(prisma,order.id,'ua','Test admin'),/ORDER_NOT_PAYABLE/);
    assert.equal(creates,before+1);
  });
  await t.test('settlement arriving during invoice creation is preserved and no payable link is returned', async()=>{
    const order=await fixture();settleDuringCreate=true;
    try {await assert.rejects(prepareAdminMonobankPayment(prisma,order.id,'ua','Test admin'),/ORDER_NOT_PAYABLE/);}
    finally {settleDuringCreate=false;}
    const paidOrder=await prisma.shopOrder.findUniqueOrThrow({where:{id:order.id}});
    assert.equal(paidOrder.paymentStatus,'PAID');assert.equal(Number(paidOrder.amountPaid),100);
    const payment=await prisma.shopMonobankPayment.findUniqueOrThrow({where:{orderId:order.id}});
    assert.equal(payment.status,'success');assert.ok(payment.invoiceId);
  });
  await t.test("a delayed first creation receives a full invoice lifetime", async () => {
    const order = await fixture();
    const payment = await prisma.shopMonobankPayment.create({ data: { orderId: order.id, amount: 10000, checkoutKeyHash: randomUUID(), requestHash: randomUUID(), createdAt: new Date(Date.now() - 3 * 86400000) } });
    await prisma.shopOrder.update({ where: { id: order.id }, data: { paymentMethod: "MONOBANK" } });
    await prepareAdminMonobankPayment(prisma, order.id, "ua", "Test admin");
    const result = await prisma.shopMonobankPayment.findUniqueOrThrow({ where: { id: payment.id } });
    assert.ok(result.expiresAt!.getTime() - Date.now() > 86300000);
  });
  await t.test("unsupported currency requires review before any mutation", async () => {
    const order = await fixture({ currency: "USD" });
    await assert.rejects(
      prepareAdminMonobankPayment(prisma, order.id, "ua", "Test admin"),
      /MONOBANK_REQUIRES_UAH_QUOTE/
    );
    assert.equal(await prisma.shopMonobankPayment.count({ where: { orderId: order.id } }), 0);
    assert.equal((await prisma.shopOrder.findUniqueOrThrow({ where: { id: order.id } })).paymentMethod, order.paymentMethod);
  });
});
