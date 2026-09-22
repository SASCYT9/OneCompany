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
