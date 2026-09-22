import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { build } from "esbuild";
import { NextRequest } from "next/server";

const requireReal = createRequire(path.resolve("package.json"));
type StoredOrder = {
  id: string;
  orderNumber: string;
  viewToken: string;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
};
type PaymentCreate = { checkoutKeyHash: string; requestHash: string; amount: number };
type CheckoutFixtureBody = {
  items: Array<{ slug: string; quantity: number }>;
  contact: { name: string; email: string; phone?: string };
  shipping: {
    line1: string;
    line2?: string;
    city: string;
    region?: string;
    postcode?: string;
    country: string;
  };
  currency: string;
  locale: string;
  paymentMethod: string;
  checkoutKey: string;
  expectedAmount: number;
};

async function fixture() {
  const orders: StoredOrder[] = [];
  const payments = new Map<string, { requestHash: string; order: StoredOrder }>();
  let notifications = 0;
  let cartClears = 0;
  let invoiceUnavailable = false;
  const quote = {
    currency: "UAH",
    items: [
      {
        productSlug: "test",
        title: "Test product",
        quantity: 2,
        unitPrice: 50,
        total: 100,
        productId: "p1",
        variantId: null,
      },
    ],
    subtotal: 100,
    shippingCost: 0,
    taxAmount: 0,
    total: 100,
    requiresQuote: false,
    pricingSnapshot: { currency: "UAH" },
  };
  const dependencies: Record<string, unknown> = {
    "@/lib/prisma": {
      prisma: {
        shopMonobankPayment: {
          findUnique: async ({ where }: { where: { checkoutKeyHash: string } }) =>
            payments.get(where.checkoutKeyHash) ?? null,
        },
        shopOrder: {
          create: async ({
            data,
          }: {
            data: StoredOrder & { monobankPayment?: { create: PaymentCreate } };
          }) => {
            const order = { ...data, id: `order-${orders.length + 1}` };
            orders.push(order);
            const payment = data.monobankPayment?.create;
            if (payment)
              payments.set(payment.checkoutKeyHash, { requestHash: payment.requestHash, order });
            return order;
          },
        },
        shopOrderStatusEvent: { create: async () => ({}) },
      },
    },
    "@/lib/shopOrder": {
      generateOrderNumber: async () => `OC-QA-${orders.length + 1}`,
      generateViewToken: () => randomUUID(),
    },
    "@/lib/shopAdminOrders": { createInitialOrderEvent: async () => {} },
    "@/lib/shopCheckout": { buildCheckoutQuote: async () => quote },
    "@/lib/webhookDispatcher": { dispatchCrmWebhook: async () => {} },
    "@/components/emails/OrderConfirmationEmail": { default: () => null },
    "@/lib/telegramNotifications": {
      notifyAdminNewShopOrder: async () => {
        notifications++;
      },
    },
    "@/lib/shopCustomerSession": { getCurrentShopCustomerSession: async () => null },
    "@/lib/shopCart": {
      SHOP_CART_COOKIE: "test-cart",
      resolveShopCart: async () => ({ token: "test-cart-token", cart: { items: [] } }),
      clearShopCart: async () => {
        cartClears++;
      },
    },
    "@/lib/shopCustomers": { upsertCustomerDefaultShippingAddress: async () => {} },
    "@/lib/shopAdminSettings": {
      getOrCreateShopSettings: async () => ({}),
      getShopSettingsRuntime: () => ({ defaultCurrency: "UAH" }),
    },
    "@/lib/shopWhitepay": {
      createWhitepayCryptoOrder: async () => {},
      createWhitepayFiatOrder: async () => {},
    },
    "@/lib/shopMonobankPayments": {
      prepareMonobankPayment: async () => {
        if (invoiceUnavailable) throw new Error("Provider offline");
        return "https://pay.mbnk.biz/qa";
      },
    },
  };
  const bundled = await build({
    entryPoints: ["src/app/api/shop/checkout/route.ts"],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    packages: "external",
    plugins: [
      {
        name: "checkout-fixtures",
        setup(builder) {
          builder.onResolve({ filter: /^@\// }, (args) =>
            args.path in dependencies ? { path: args.path, external: true } : undefined
          );
        },
      },
    ],
  });
  const routeModule = { exports: {} as { POST: (req: NextRequest) => Promise<Response> } };
  new Function("require", "module", "exports", bundled.outputFiles[0].text)(
    (id: string) => dependencies[id] ?? requireReal(id),
    routeModule,
    routeModule.exports
  );
  const body: CheckoutFixtureBody = {
    items: [{ slug: "test", quantity: 2 }],
    contact: { name: "Buyer", email: "qa@example.invalid" },
    shipping: { line1: "Test", city: "Kyiv", country: "Ukraine" },
    currency: "UAH",
    locale: "ua",
    paymentMethod: "MONOBANK",
    checkoutKey: randomUUID(),
    expectedAmount: 10000,
  };
  return {
    body,
    quote,
    orders,
    post: (payload = body) =>
      routeModule.exports.POST(
        new NextRequest("https://preview.example.com/api/shop/checkout", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      ),
    counts: () => ({ notifications, cartClears }),
    failInvoice: () => {
      invoiceUnavailable = true;
    },
  };
}

test("checkout adds mono without duplicate orders or weakening price/quote gates", async (t) => {
  const saved = { ...process.env };
  t.after(() => {
    process.env = saved;
  });
  process.env.MONOBANK_ENABLED = "1";
  process.env.MONOBANK_TOKEN = "synthetic-test-token";
  process.env.MONOBANK_PUBLIC_URL = "https://preview.example.com";
  process.env.RESEND_API_KEY = "";
  process.env.EMAIL_FROM = "";

  await t.test("same checkout key resumes the same order and emits side effects once", async () => {
    const f = await fixture();
    const first = await f.post();
    assert.equal(first.status, 200);
    const firstResult = await first.json();
    assert.equal(firstResult.redirectUrl, "https://pay.mbnk.biz/qa");
    const second = await f.post();
    const secondResult = await second.json();
    assert.equal(secondResult.orderNumber, firstResult.orderNumber);
    assert.equal(secondResult.viewToken, firstResult.viewToken);
    assert.equal(f.orders.length, 1);
    assert.deepEqual(f.counts(), { notifications: 1, cartClears: 1 });
    assert.equal(f.orders[0].status, "PENDING_PAYMENT");
    assert.equal(f.orders[0].paymentStatus, "PENDING");
    assert.equal(
      (await f.post({ ...f.body, contact: { ...f.body.contact, email: "other@example.invalid" } }))
        .status,
      409
    );
  });

  await t.test("provider failure retains an unpaid order and its recovery token", async () => {
    const f = await fixture();
    f.failInvoice();
    const response = await f.post();
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.ok(result.orderNumber && result.viewToken);
    assert.equal(result.redirectUrl, undefined);
    assert.equal(f.orders[0].paymentStatus, "PENDING");
  });

  await t.test("checkout persists every visible contact and delivery field", async () => {
    const f = await fixture();
    const response = await f.post({
      ...f.body,
      contact: {
        name: "Oleksandr Pryklad",
        email: "buyer@example.invalid",
        phone: "+380670000000",
      },
      shipping: {
        line1: "Branch 12",
        line2: "Office 4",
        city: "Kyiv",
        region: "Kyiv",
        postcode: "01001",
        country: "Ukraine",
      },
    });
    assert.equal(response.status, 200);
    const order = f.orders[0] as StoredOrder & {
      customerName: string;
      email: string;
      phone: string | null;
      shippingAddress: Record<string, string>;
      currency: string;
    };
    assert.equal(order.customerName, "Oleksandr Pryklad");
    assert.equal(order.email, "buyer@example.invalid");
    assert.equal(order.phone, "+380670000000");
    assert.deepEqual(order.shippingAddress, {
      line1: "Branch 12",
      line2: "Office 4",
      city: "Kyiv",
      region: "Kyiv",
      postcode: "01001",
      country: "Ukraine",
    });
    assert.equal(order.currency, "UAH");
    assert.equal(order.paymentMethod, "MONOBANK");
  });

  await t.test("changed totals, non-UAH quotes and manual quotes never create orders", async () => {
    const f = await fixture();
    assert.equal((await f.post({ ...f.body, expectedAmount: 1 })).status, 409);
    f.quote.currency = "EUR";
    assert.equal((await f.post()).status, 400);
    f.quote.currency = "UAH";
    f.quote.requiresQuote = true;
    assert.equal((await f.post()).status, 409);
    assert.equal(f.orders.length, 0);
    assert.deepEqual(f.counts(), { notifications: 0, cartClears: 0 });
  });

  await t.test(
    "disabled method fails before persistence and existing FOP remains available",
    async () => {
      const f = await fixture();
      process.env.MONOBANK_ENABLED = "0";
      assert.equal((await f.post()).status, 503);
      assert.equal(f.orders.length, 0);
      assert.equal((await f.post({ ...f.body, paymentMethod: "FOP" })).status, 200);
      assert.equal(f.orders[0].paymentMethod, "FOP");
      assert.equal(f.orders[0].status, "PENDING_REVIEW");
    }
  );
});
