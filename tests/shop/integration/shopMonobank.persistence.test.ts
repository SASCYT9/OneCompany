import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { prepareMonobankPayment, applyMonobankStatus } from "../../../src/lib/shopMonobankPayments";
import { monobankCheckoutKey, type MonobankInvoiceStatus } from "../../../src/lib/shopMonobank";

const databaseUrl = process.env.MONOBANK_TEST_DATABASE_URL;

test(
  "mono persistence, creation races, signed-status ordering and recovery",
  { skip: !databaseUrl },
  async (t) => {
    const url = new URL(databaseUrl!);
    assert.ok(
      ["127.0.0.1", "localhost"].includes(url.hostname) &&
        url.pathname.startsWith("/monobank_test"),
      "Use a disposable local monobank_test database only"
    );
    const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const saved = { ...process.env };
    const orderIds: string[] = [];
    t.after(async () => {
      await prisma.shopMonobankPayment.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.shopOrder.deleteMany({ where: { id: { in: orderIds } } });
      await prisma.$disconnect();
      process.env = saved;
    });
    process.env.MONOBANK_ENABLED = "1";
    process.env.MONOBANK_TOKEN = "synthetic-test-token";
    process.env.MONOBANK_PUBLIC_URL = "https://preview.example.com";
    const fixture = async () => {
      const id = randomUUID();
      const created = await prisma.shopOrder.create({
        data: {
          orderNumber: `MONO-TEST-${id}`,
          email: "mono@example.invalid",
          customerName: "Mono Test",
          shippingAddress: { country: "Ukraine", city: "Kyiv", line1: "Test" },
          currency: "UAH",
          subtotal: 100,
          shippingCost: 20,
          taxAmount: 0,
          total: 120,
          viewToken: randomUUID(),
          paymentMethod: "MONOBANK",
          paymentStatus: "PENDING",
          status: "PENDING_PAYMENT",
          items: {
            create: [
              {
                productSlug: "mono-test-item",
                title: "Test item",
                quantity: 2,
                price: 50,
                total: 100,
              },
            ],
          },
          monobankPayment: {
            create: {
              amount: 12000,
              checkoutKeyHash: monobankCheckoutKey(randomUUID()),
              requestHash: id,
            },
          },
        },
        include: { monobankPayment: true },
      });
      orderIds.push(created.id);
      return created;
    };
    const status = (
      record: Awaited<ReturnType<typeof fixture>>,
      patch: Partial<MonobankInvoiceStatus> = {}
    ): MonobankInvoiceStatus => ({
      invoiceId: `invoice-${record.id}`,
      reference: record.monobankPayment!.id,
      amount: 12000,
      ccy: 980,
      status: "success",
      finalAmount: 12000,
      modifiedDate: "2026-09-22T12:00:00Z",
      ...patch,
    });
    let calls = 0;
    const fetchMock = t.mock.method(
      globalThis,
      "fetch",
      async (_input: unknown, init?: RequestInit) => {
        calls++;
        const body = JSON.parse(String(init?.body));
        const record = await prisma.shopMonobankPayment.findUniqueOrThrow({
          where: { id: body.merchantPaymInfo.reference },
        });
        return Response.json({
          invoiceId: `invoice-${record.orderId}`,
          pageUrl: `https://pay.mbnk.biz/invoice-${record.orderId}`,
        });
      }
    );

    await t.test("parallel payment requests create exactly one external invoice", async () => {
      const order = await fixture();
      const start = calls;
      const responses = await Promise.allSettled([
        prepareMonobankPayment(prisma, order.id, "ua"),
        prepareMonobankPayment(prisma, order.id, "ua"),
      ]);
      assert.ok(responses.some((r) => r.status === "fulfilled"));
      assert.equal(calls - start, 1);
      assert.equal(
        await prepareMonobankPayment(prisma, order.id, "ua"),
        `https://pay.mbnk.biz/invoice-${order.id}`
      );
      assert.equal(calls - start, 1);
      assert.equal(await prisma.shopOrder.count({ where: { id: order.id } }), 1);
    });

    await t.test(
      "success settles atomically, duplicates add no events, stale status cannot undo it",
      async () => {
        const order = await fixture();
        await prepareMonobankPayment(prisma, order.id, "ua");
        assert.equal(await applyMonobankStatus(prisma, status(order)), true);
        const paid = await prisma.shopOrder.findUniqueOrThrow({ where: { id: order.id } });
        assert.equal(paid.paymentStatus, "PAID");
        assert.equal(paid.status, "CONFIRMED");
        assert.equal(paid.amountPaid, 120);
        assert.equal(await applyMonobankStatus(prisma, status(order)), false);
        assert.equal(
          await applyMonobankStatus(
            prisma,
            status(order, { status: "processing", modifiedDate: "2026-09-22T11:59:00Z" })
          ),
          false
        );
        assert.equal(await prisma.shopOrderStatusEvent.count({ where: { orderId: order.id } }), 1);
        await assert.rejects(prepareMonobankPayment(prisma, order.id, "ua"), {
          code: "MONOBANK_ORDER_NOT_PAYABLE",
        });
      }
    );

    await t.test("concurrent settlement creates one financial event", async () => {
      const order = await fixture();
      await prepareMonobankPayment(prisma, order.id, "en");
      await Promise.allSettled([
        applyMonobankStatus(prisma, status(order)),
        applyMonobankStatus(prisma, status(order)),
      ]);
      assert.equal(
        (await prisma.shopOrder.findUniqueOrThrow({ where: { id: order.id } })).amountPaid,
        120
      );
      assert.equal(await prisma.shopOrderStatusEvent.count({ where: { orderId: order.id } }), 1);
    });

    await t.test("wrong amount leaves both payment and order unchanged", async () => {
      const order = await fixture();
      await prepareMonobankPayment(prisma, order.id, "ua");
      await assert.rejects(applyMonobankStatus(prisma, status(order, { amount: 12001 })), {
        code: "MONOBANK_PAYMENT_MISMATCH",
      });
      assert.equal(
        (await prisma.shopOrder.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus,
        "PENDING"
      );
      assert.equal(
        (await prisma.shopMonobankPayment.findUniqueOrThrow({ where: { orderId: order.id } }))
          .providerModifiedAt,
        null
      );
    });

    await t.test("partial and full refunds preserve fulfillment state", async () => {
      const order = await fixture();
      await prepareMonobankPayment(prisma, order.id, "en");
      await applyMonobankStatus(prisma, status(order));
      await prisma.shopOrder.update({ where: { id: order.id }, data: { status: "SHIPPED" } });
      await applyMonobankStatus(
        prisma,
        status(order, {
          status: "reversed",
          finalAmount: 5000,
          modifiedDate: "2026-09-22T12:01:00Z",
        })
      );
      let refunded = await prisma.shopOrder.findUniqueOrThrow({ where: { id: order.id } });
      assert.equal(refunded.paymentStatus, "PARTIALLY_REFUNDED");
      assert.equal(refunded.amountPaid, 50);
      assert.equal(refunded.status, "SHIPPED");
      await applyMonobankStatus(
        prisma,
        status(order, { status: "reversed", finalAmount: 0, modifiedDate: "2026-09-22T12:02:00Z" })
      );
      refunded = await prisma.shopOrder.findUniqueOrThrow({ where: { id: order.id } });
      assert.equal(refunded.paymentStatus, "REFUNDED");
      assert.equal(refunded.amountPaid, 0);
      assert.equal(refunded.status, "SHIPPED");
    });

    await t.test(
      "timeout blocks another invoice and a verified callback recovers settlement",
      async () => {
        const order = await fixture();
        fetchMock.mock.mockImplementation(async () => {
          calls++;
          throw new Error("network timeout");
        });
        const start = calls;
        await assert.rejects(prepareMonobankPayment(prisma, order.id, "ua"), {
          code: "MONOBANK_REQUEST_UNCERTAIN",
        });
        assert.equal(
          (await prisma.shopMonobankPayment.findUniqueOrThrow({ where: { orderId: order.id } }))
            .status,
          "creation_unknown"
        );
        await assert.rejects(prepareMonobankPayment(prisma, order.id, "ua"), {
          code: "MONOBANK_PAYMENT_PENDING",
        });
        assert.equal(calls - start, 1);
        await applyMonobankStatus(prisma, status(order));
        assert.equal(
          (await prisma.shopOrder.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus,
          "PAID"
        );
      }
    );
  }
);
