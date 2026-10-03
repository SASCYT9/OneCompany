import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { claimAdminWhitepayOrder } from "../../../src/lib/shopAdminWhitepay";

const databaseUrl = process.env.MONOBANK_TEST_DATABASE_URL;
test("Whitepay claims use atomic production-shaped updates in a disposable DB", { skip: !databaseUrl }, async (t) => {
  const target = new URL(databaseUrl!);
  assert.ok(["localhost", "127.0.0.1"].includes(target.hostname) && target.pathname.startsWith("/monobank_test"));
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const ids: string[] = [];
  t.after(async () => { await prisma.shopMonobankPayment.deleteMany({ where: { orderId: { in: ids } } }); await prisma.shopOrder.deleteMany({ where: { id: { in: ids } } }); await prisma.$disconnect(); });
  async function fixture() {
    const key = randomUUID();
    const order = await prisma.shopOrder.create({ data: { orderNumber: `WHITEPAY-TEST-${key}`, customerName: "Synthetic buyer", email: "test@example.invalid", shippingAddress: { country: "Ukraine" }, currency: "UAH", subtotal: 100, shippingCost: 0, taxAmount: 0, total: 100, viewToken: key, paymentMethod: "FOP", paymentStatus: "UNPAID", status: "PENDING_REVIEW" } });
    ids.push(order.id); return order;
  }
  await t.test("concurrent fiat/crypto requests claim once, and retry cannot claim again", async () => {
    const order = await fixture();
    const results = await Promise.all([claimAdminWhitepayOrder(prisma, order, "WHITEPAY_FIAT"), claimAdminWhitepayOrder(prisma, order, "WHITEPAY_CRYPTO")]);
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(await claimAdminWhitepayOrder(prisma, order, "WHITEPAY_FIAT"), false);
    assert.equal((await prisma.shopOrder.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus, "PENDING");
  });
  await t.test("changed delivery total or partial settlement rejects an old claim", async () => {
    const order = await fixture();
    await prisma.shopOrder.update({ where: { id: order.id }, data: { total: 120, amountPaid: 10 } });
    assert.equal(await claimAdminWhitepayOrder(prisma, order, "WHITEPAY_FIAT"), false);
  });
  await t.test("an existing mono attempt blocks Whitepay even before its order method changes", async () => {
    const order = await fixture();
    await prisma.shopMonobankPayment.create({ data: { orderId: order.id, checkoutKeyHash: randomUUID(), requestHash: randomUUID(), amount: 10000 } });
    assert.equal(await claimAdminWhitepayOrder(prisma, order, "WHITEPAY_CRYPTO"), false);
  });
});
