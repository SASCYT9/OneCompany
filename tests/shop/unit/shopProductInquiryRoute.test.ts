import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { build } from "esbuild";
import { NextRequest } from "next/server";

const requireReal = createRequire(path.resolve("package.json"));
async function fixture(options: { scope?: string; missing?: boolean; rateLimited?: boolean } = {}) {
  const stored: Array<{ messageText: string; category: string; metadata: Record<string, unknown> }> = [];
  const bot: Array<{ message: string; category: string }> = [];
  const telegram: Array<{ message: string }> = [];
  const emails: Array<{ html: string; to: string[] }> = [];
  const dependencies: Record<string, unknown> = {
    "@/lib/prisma": { prisma: { message: { create: async ({ data }: { data: typeof stored[number] }) => {
      stored.push(data); return { id: "synthetic-message" };
    } } } },
    "@/lib/shopCatalogServer": { getShopProductBySlugServer: async () => options.missing ? null : ({
      id: "product1", slug: "canonical-part", sku: "PARENT-SKU", brand: "Urban Automotive",
      scope: options.scope ?? "auto", title: { ua: "Канонічний товар", en: "Canonical product" },
      variants: [{ id: "variant1", sku: "CANONICAL-VARIANT-SKU", title: "Gloss Black" }],
    }) },
    "@/lib/shopPublicRateLimit": { getRequestIp: () => "local-synthetic", consumeRateLimit: async () => !options.rateLimited },
    "@/lib/bot/notifications": { notifyAdminsNewMessage: async (_id: string, data: typeof bot[number]) => bot.push(data) },
    "@/lib/telegram": { formatAutoMessage: (data: { wishes: string }) => data.wishes, formatMotoMessage: (data: { wishes: string }) => data.wishes },
    "@/lib/telegramNotifications": {
      normalizeTelegramChatId: () => "synthetic-destination",
      getConfiguredContactTopicDestination: () => null,
      buildTelegramActionButtons: () => ({}),
      sendTelegramToDestinations: async (data: typeof telegram[number]) => { telegram.push(data); return { ok: true }; },
    },
    resend: { Resend: class {
      emails = { send: async (data: typeof emails[number]) => { emails.push(data); return { data: { id: "synthetic-email" } }; } };
    } },
  };
  const bundled = await build({ entryPoints: ["src/app/api/contact/route.ts"], bundle: true, write: false,
    platform: "node", format: "cjs", packages: "external", plugins: [{ name: "contact-fixtures", setup(builder) {
      builder.onResolve({ filter: /^@\// }, (args) => args.path in dependencies ? { path: args.path, external: true } : undefined);
    } }] });
  const routeModule = { exports: {} as { POST: (request: NextRequest) => Promise<Response> } };
  new Function("require", "module", "exports", bundled.outputFiles[0].text)(
    (id: string) => dependencies[id] ?? requireReal(id), routeModule, routeModule.exports
  );
  return { stored, bot, telegram, emails,
    post: (patch: Record<string, unknown> = {}) => routeModule.exports.POST(new NextRequest("http://localhost/api/contact", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        name: "Synthetic buyer", email: "buyer@example.invalid", phone: "+380000000000",
        type: "moto", productSlug: "canonical-part", variantId: "variant1", locale: "ua",
        wishes: "Please verify the package", sku: "CLIENT-INVENTED-SKU", ...patch,
      }),
    })),
  };
}

test("canonical inquiry context reaches stored request and every simulated manager channel", async (t) => {
  const saved = { ...process.env };
  t.after(() => { process.env = saved; });
  process.env.RESEND_API_KEY = "synthetic-test-key";
  process.env.EMAIL_FROM = "from@example.invalid";
  process.env.EMAIL_AUTO = "auto@example.invalid";
  process.env.EMAIL_MOTO = "moto@example.invalid";
  for (const scope of ["auto", "moto"]) {
    const f = await fixture({ scope });
    const response = await f.post();
    assert.equal(response.status, 200);
    assert.equal(f.stored[0].category, scope.toUpperCase());
    assert.equal(f.bot[0].category, scope);
    for (const message of [f.stored[0].messageText, f.bot[0].message, f.telegram[0].message, f.emails[0].html]) {
      assert.match(message, /CANONICAL-VARIANT-SKU/);
      assert.doesNotMatch(message, /CLIENT-INVENTED-SKU/);
    }
    assert.deepEqual(f.emails[0].to, [`${scope}@example.invalid`]);
    assert.equal((f.stored[0].metadata.productInquiry as { variantId: string }).variantId, "variant1");
  }
});

test("missing products, foreign variants and rate limits never reach persistence or notification", async () => {
  for (const [options, patch, status] of [
    [{ missing: true }, {}, 404], [{}, { variantId: "foreign-variant" }, 400],
    [{ rateLimited: true }, {}, 429],
  ] as const) {
    const f = await fixture(options);
    assert.equal((await f.post(patch)).status, status);
    assert.equal(f.stored.length, 0);
    assert.equal(f.bot.length + f.telegram.length + f.emails.length, 0);
  }
});

test("general inquiries retain the vehicle requirement when no product was supplied", async () => {
  const f = await fixture();
  assert.equal((await f.post({ productSlug: undefined, variantId: undefined })).status, 400);
  assert.equal(f.stored.length, 0);
});
