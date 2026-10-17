import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import path from "node:path";
import { build } from "esbuild";
import { NextRequest } from "next/server";

const requireReal = createRequire(path.resolve("package.json"));
type Handler = (request: NextRequest, context?: unknown) => Promise<Response>;

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
        name: "cart-reminder-fixtures",
        setup(builder) {
          builder.onResolve({ filter: /^@\// }, (args) =>
            args.path in dependencies ? { path: args.path, external: true } : undefined
          );
        },
      },
    ],
  });
  const routeModule = { exports: {} as { GET?: Handler; POST?: Handler } };
  new Function("require", "module", "exports", bundled.outputFiles[0].text)(
    (id: string) => dependencies[id] ?? requireReal(id),
    routeModule,
    routeModule.exports
  );
  return routeModule.exports;
}

test("checkout consent needs a valid email, a cart and stays rate limited", async () => {
  const saved: unknown[] = [];
  let allowed = true;
  let guestCart: { id: string } | null = { id: "cart-guest" };
  const prisma = {
    shopCart: {
      findFirst: async () => null,
      findUnique: async ({ where }: { where: { token: string } }) => (where.token === "tok" ? guestCart : null),
    },
    shopCartReminder: {
      findUnique: async ({ where }: { where: { cartId?: string } }) =>
        where.cartId === "cart-guest" && saved.length === 1
          ? { email: "buyer@example.com", handledAt: null, outcome: null }
          : null,
      upsert: async (args: unknown) => saved.push(args),
      deleteMany: async (args: unknown) => saved.push(["withdraw", args]),
    },
  };
  const { GET, POST } = await route("src/app/api/shop/cart/reminder/route.ts", {
    "@/lib/prisma": { prisma },
    "@/lib/localStorefront": { isLocalStorefrontMode: () => false },
    "@/lib/shopCart": { SHOP_CART_COOKIE: "oc_cart_token" },
    "@/lib/shopCustomerSession": { getCurrentShopCustomerSession: async () => null },
    "@/lib/shopPublicRateLimit": { consumeRateLimit: async () => allowed, getRequestIp: () => "203.0.113.7" },
  });
  const post = (body: unknown, cookie = "oc_cart_token=tok") =>
    POST!(
      new NextRequest("https://onecompany.global/api/shop/cart/reminder", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify(body),
      })
    );

  assert.equal((await post({ consent: true, email: "not-an-email" })).status, 400);
  const ok = await post({ consent: true, email: "Buyer@Example.com", currency: "eur", country: "Germany", locale: "en" });
  assert.equal(ok.status, 200);
  const upsert = saved[0] as { where: { cartId: string }; create: { email: string; currency: string; locale: string } };
  assert.equal(upsert.where.cartId, "cart-guest");
  assert.equal(upsert.create.email, "buyer@example.com");
  assert.equal(upsert.create.currency, "EUR");
  assert.equal(upsert.create.locale, "en");
  // After a reload, checkout learns the consent is still on.
  const state = await GET!(
    new NextRequest("https://onecompany.global/api/shop/cart/reminder", { headers: { cookie: "oc_cart_token=tok" } })
  );
  assert.deepEqual(await state.json(), { consent: true, email: "buyer@example.com" });

  assert.equal((await post({ consent: false })).status, 200);
  assert.deepEqual(saved[1], ["withdraw", { where: { cartId: "cart-guest", handledAt: null } }]);

  guestCart = null;
  assert.equal((await post({ consent: true, email: "buyer@example.com" })).status, 404);
  allowed = false;
  assert.equal((await post({ consent: true, email: "buyer@example.com" })).status, 429);
  // Withdrawing is never rate limited.
  guestCart = { id: "cart-guest" };
  assert.equal((await post({ consent: false })).status, 200);
});

test("the email link restores that cart in any browser; unsubscribe works by link and one click", async () => {
  const suppressed: string[] = [];
  const prisma = {
    shopCartReminder: {
      findUnique: async ({ where }: { where: { token: string } }) =>
        where.token === "good"
          ? { email: "buyer@example.com", locale: "ua", cart: { token: "cart-token", _count: { items: 2 } } }
          : null,
      updateMany: async () => ({ count: 1 }),
    },
    shopEmailSuppression: {
      upsert: async ({ create }: { create: { email: string } }) => suppressed.push(create.email),
    },
    shopOrder: {
      findUnique: async ({ where }: { where: { orderNumber: string } }) =>
        where.orderNumber === "OC-1"
          ? { email: "reviewer@example.com", viewToken: "view-1", shippingAddress: { country: "Germany" }, customer: null }
          : null,
    },
    $transaction: async (work: Promise<unknown>[]) => Promise.all(work),
  };
  const restore = await route("src/app/api/shop/cart/reminder/[token]/route.ts", {
    "@/lib/prisma": { prisma },
    "@/lib/shopCart": {
      setShopCartCookies: (response: Response, token: string) =>
        response.headers.append("set-cookie", `oc_cart_token=${token}; Path=/`),
    },
  });
  const back = await restore.GET!(new NextRequest("https://onecompany.global/api/shop/cart/reminder/good"), {
    params: Promise.resolve({ token: "good" }),
  });
  assert.equal(back.headers.get("location"), "https://onecompany.global/ua/shop/cart");
  assert.match(String(back.headers.get("set-cookie")), /oc_cart_token=cart-token/);
  const unknown = await restore.GET!(new NextRequest("https://onecompany.global/api/shop/cart/reminder/x"), {
    params: Promise.resolve({ token: "x" }),
  });
  assert.equal(unknown.headers.get("location"), "https://onecompany.global/ua/shop");
  assert.equal(unknown.headers.get("set-cookie"), null);

  const unsubscribe = await route("src/app/api/shop/email/unsubscribe/route.ts", { "@/lib/prisma": { prisma } });
  const page = await unsubscribe.GET!(new NextRequest("https://onecompany.global/api/shop/email/unsubscribe?t=good"));
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Ви відписалися/);
  const oneClick = await unsubscribe.POST!(
    new NextRequest("https://onecompany.global/api/shop/email/unsubscribe?t=good", {
      method: "POST",
      body: "List-Unsubscribe=One-Click",
    })
  );
  assert.deepEqual(await oneClick.json(), { ok: true });
  assert.deepEqual(suppressed, ["buyer@example.com", "buyer@example.com"]);
  const stale = await unsubscribe.GET!(new NextRequest("https://onecompany.global/api/shop/email/unsubscribe?t=nope"));
  assert.match(await stale.text(), /застаріло/);
  // The review email unsubscribes by order number plus the order's private token.
  const review = await unsubscribe.GET!(
    new NextRequest("https://onecompany.global/api/shop/email/unsubscribe?o=OC-1&t=view-1")
  );
  assert.match(await review.text(), /You are unsubscribed/);
  assert.equal(suppressed.at(-1), "reviewer@example.com");
});

test("the customer-emails cron runs cart reminders and review requests, with the cron secret only", async (t) => {
  const saved = { ...process.env };
  t.after(() => {
    process.env = saved;
  });
  process.env.CRON_SECRET = "cron-secret";
  const runs: unknown[] = [];
  const cron = await route("src/app/api/cron/customer-emails/route.ts", {
    "@/lib/prisma": { prisma: {} },
    "@/lib/shopCart": { serializeResolvedShopCart: async () => ({ items: [] }) },
    "@/lib/shopCartReminder": {
      runCartReminders: async (_db: unknown, options: { dryRun?: boolean }) => {
        runs.push(["carts", options.dryRun]);
        return { window: true, considered: 0, outcomes: {} };
      },
    },
    "@/lib/shopReviewRequest": {
      SHOP_GOOGLE_REVIEW_URL: "https://example.invalid/review",
      orderEmailLocale: () => "ua",
      runReviewRequests: async (_db: unknown, options: { dryRun?: boolean }) => {
        runs.push(["reviews", options.dryRun]);
        return { window: true, considered: 0, outcomes: {} };
      },
    },
    "@/lib/shopPublicSettings": { getPublicShopSettingsRuntime: async () => ({ currencyRates: {} }) },
    "@/lib/shopPricingContext.server": { buildShopViewerPricingContextServer: async () => ({}) },
  });
  const call = (auth?: string, query = "") =>
    cron.GET!(
      new NextRequest(`https://onecompany.global/api/cron/customer-emails${query}`, {
        headers: auth ? { authorization: auth } : {},
      })
    );
  assert.equal((await call()).status, 401);
  assert.equal((await call("Bearer wrong")).status, 401);
  const dry = await call("Bearer cron-secret", "?dryRun=1");
  assert.equal(dry.status, 200);
  assert.deepEqual(runs, [["carts", true], ["reviews", true]]);
});
