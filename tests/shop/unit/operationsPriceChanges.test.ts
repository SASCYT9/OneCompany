import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import type { PrismaClient } from "@prisma/client";

import { registerHooks } from "./testHooks.mjs";

const serverOnlyStub = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")
).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: serverOnlyStub, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const changesModule = import("../../../src/lib/operations/priceChanges");

const RATES = { EUR: 1, USD: 1.14, UAH: 50.56, _uahReserve: 1, _rawUsdToUah: 45.03 };
const owner = {
  id: "owner-000000001",
  email: "owner@onecompany.global",
  name: "Owner",
  permissions: ["*"],
  roleKeys: ["owner"],
};
const igor = { ...owner, id: "igor-0000000001", roleKeys: ["superadmin"] };
const noButtons = async (_action: string, resourceId: string, label: string) => ({
  text: label,
  callback_data: `cb:${resourceId}`,
});

function product(sku: string, eur: number, extra: Record<string, unknown> = {}) {
  return {
    id: `p-${sku}`,
    sku,
    slug: sku.toLowerCase(),
    brand: "Brabus",
    titleEn: `Brabus ${sku}`,
    titleUa: "",
    priceEur: eur,
    priceUsd: null,
    priceUah: null,
    priceSourceCurrency: "EUR",
    compareAtEur: null,
    compareAtUsd: null,
    compareAtUah: null,
    variants: [
      {
        id: `v-${sku}`,
        sku,
        priceEur: eur,
        priceUsd: null,
        priceUah: null,
        priceSourceCurrency: "EUR",
        compareAtEur: null,
        compareAtUsd: null,
        compareAtUah: null,
      },
    ],
    ...extra,
  };
}

function fakeClient(products: ReturnType<typeof product>[], findings: unknown[] = []) {
  const changes: Array<Record<string, unknown>> = [];
  return {
    changes,
    client: {
      shopSettings: { findUnique: async () => ({ currencyRates: RATES }) },
      shopProduct: {
        findMany: async ({ where }: { where: Record<string, unknown> }) => {
          const json = JSON.stringify(where);
          if (json.includes('"brand"')) return products;
          const wanted = (json.match(/"(?:equals|in)":(\["[^\]]*"\]|"[^"]*")/g) ?? [])
            .join(" ")
            .toLowerCase();
          return products.filter((entry) => wanted.includes(entry.sku.toLowerCase()));
        },
      },
      opsPriceWatchSource: { findUnique: async () => ({ id: "src-brabus-0001" }) },
      opsPriceWatchRun: { findFirst: async () => ({ findings }) },
      opsPriceChange: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const row = { id: `chg-${String(changes.length + 1).padStart(10, "0")}`, ...data };
          changes.push(row);
          return row;
        },
        findUnique: async ({ where }: { where: { id: string } }) =>
          changes.find((row) => row.id === where.id) ?? null,
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const row = changes.find((entry) => entry.id === where.id)!;
          Object.assign(row, data);
          return row;
        },
      },
    } as unknown as PrismaClient,
  };
}

test("price commands from the chat", async () => {
  const { parsePriceCommand, looksLikeSku } = await changesModule;
  assert.deepEqual(parsePriceCommand("цена V167-678-63 9005.92"), {
    kind: "set",
    target: "V167-678-63",
    amount: 9005.92,
    currency: null,
  });
  assert.deepEqual(parsePriceCommand("Ціна 902-857-07  785,40 €"), {
    kind: "set",
    target: "902-857-07",
    amount: 785.4,
    currency: "EUR",
  });
  assert.deepEqual(parsePriceCommand("цена BW-X3M01 1 045 $"), {
    kind: "set",
    target: "BW-X3M01",
    amount: 1045,
    currency: "USD",
  });
  assert.deepEqual(parsePriceCommand("цена Brabus +5%"), {
    kind: "percent",
    target: "Brabus",
    percent: 5,
  });
  assert.deepEqual(parsePriceCommand("цена CT Carbon -3,5 %"), {
    kind: "percent",
    target: "CT Carbon",
    percent: -3.5,
  });
  assert.deepEqual(parsePriceCommand("цена Brabus по формуле"), {
    kind: "formula",
    target: "Brabus",
  });
  assert.deepEqual(parsePriceCommand("ціна brabus за формулою"), {
    kind: "formula",
    target: "brabus",
  });
  assert.deepEqual(parsePriceCommand("цена V167-678-63"), {
    kind: "lookup",
    target: "V167-678-63",
  });
  assert.deepEqual(parsePriceCommand("наличие D650-0010"), { kind: "lookup", target: "D650-0010" });
  assert.equal(parsePriceCommand("купить кофе на завтра"), null);
  assert.equal(looksLikeSku("V167-678-63"), true);
  assert.equal(looksLikeSku("готово"), false);
  assert.equal(looksLikeSku("перенеси на пятницу"), false);
});

test("brands and sources are found by any spelling; only owners may change prices", async () => {
  const { resolvePriceBrand, canChangePrices, nativePrice } = await changesModule;
  assert.equal(resolvePriceBrand("brabus")?.brands.join(), "Brabus");
  assert.equal(resolvePriceBrand("CT-carbon")?.brands.join(), "CT Carbon");
  assert.equal(resolvePriceBrand("akrapovic")?.brands.join(), "AKRAPOVIC");
  assert.equal(resolvePriceBrand("nothing like it"), null);
  assert.equal(canChangePrices(owner), true);
  assert.equal(
    canChangePrices(igor),
    false,
    "superadmin receives reports but does not change prices"
  );
  assert.equal(
    canChangePrices({ permissions: ["shop.pricing.write"], roleKeys: ["manager"] }),
    false
  );
  assert.deepEqual(
    nativePrice({ priceEur: 0, priceUsd: 815, priceUah: 37478, priceSourceCurrency: "USD" }),
    {
      currency: "USD",
      amount: 815,
    }
  );
  assert.deepEqual(
    nativePrice({ priceEur: 100, priceUsd: null, priceUah: null, priceSourceCurrency: null }),
    {
      currency: "EUR",
      amount: 100,
    }
  );
});

test("planning: one price, a brand by percent (sale prices kept), the formula of the last check", async () => {
  const { planPriceChange } = await changesModule;
  const { client } = fakeClient(
    [
      product("V167-678-63", 7827.82),
      product("464-270-99", 2853.62),
      product("SALE-1", 1000, { compareAtEur: 1200, variants: [] }),
    ],
    [
      { kind: "cheaper", sku: "V167-678-63", expected: 9005.92, currency: "EUR", ours: 7827.82 },
      { kind: "gone", sku: "c167-460-99", currency: "EUR" },
    ]
  );
  const single = await planPriceChange(client, {
    kind: "set",
    target: "V167-678-63",
    amount: 9005.92,
    currency: null,
  });
  assert.ok(single.ok);
  assert.deepEqual(
    single.ok
      ? single.items.map((item) => [
          item.sku,
          item.currency,
          item.before,
          item.after,
          item.deltaPct,
        ])
      : [],
    [["V167-678-63", "EUR", 7827.82, 9005.92, 15.1]]
  );
  const brand = await planPriceChange(client, { kind: "percent", target: "Brabus", percent: 5 });
  assert.ok(brand.ok);
  assert.deepEqual(brand.ok ? brand.items.map((item) => [item.sku, item.after]) : [], [
    ["V167-678-63", 8219.21],
    ["464-270-99", 2996.3],
  ]);
  assert.deepEqual(brand.ok ? brand.skipped : [], [{ sku: "SALE-1", reason: "акционная цена" }]);
  const tooMuch = await planPriceChange(client, { kind: "percent", target: "Brabus", percent: 80 });
  assert.equal(tooMuch.ok, false);
  const formula = await planPriceChange(client, { kind: "formula", target: "Brabus" });
  assert.ok(formula.ok);
  assert.deepEqual(formula.ok ? formula.items.map((item) => [item.sku, item.after]) : [], [
    ["V167-678-63", 9005.92],
  ]);
  const unknown = await planPriceChange(client, {
    kind: "set",
    target: "NOPE-1",
    amount: 10,
    currency: null,
  });
  assert.equal(unknown.ok, false);
});

test("a proposal shows what changes; big changes ask once more; cancel leaves prices alone", async () => {
  const { planPriceChange, proposePriceChange, confirmPriceChange, cancelPriceChange } =
    await changesModule;
  const { client, changes } = fakeClient([product("V167-678-63", 1000)]);
  const plan = await planPriceChange(client, {
    kind: "set",
    target: "V167-678-63",
    amount: 1500,
    currency: null,
  });
  assert.ok(plan.ok);
  const preview = await proposePriceChange({
    client,
    actor: owner,
    origin: "command",
    plan: plan as Extract<typeof plan, { ok: true }>,
    button: noButtons as never,
  });
  assert.match(preview.text, /Изменится: 1 цена · ⚠️ больше чем на 30 %: 1/);
  assert.match(preview.text, /1 000 € → <b>1 500 €<\/b> \(\+50,0 %\) ⚠️/);
  assert.equal(preview.replyMarkup?.inline_keyboard[0].length, 2);
  assert.equal(changes[0].status, "proposed");
  assert.equal(changes[0].bigChanges, 1);
  const again = await confirmPriceChange({
    client,
    actor: owner,
    changeId: String(changes[0].id),
    confirmedBig: false,
    button: noButtons as never,
  });
  assert.match(String(again.reply?.text), /меняются больше чем на 30 %/);
  assert.equal(changes[0].status, "proposed", "nothing applied before the second «да»");
  await assert.rejects(
    cancelPriceChange({ client, actor: igor, changeId: String(changes[0].id) }),
    /TELEGRAM_ACTION_FORBIDDEN/
  );
  const cancelled = await cancelPriceChange({
    client,
    actor: owner,
    changeId: String(changes[0].id),
  });
  assert.match(cancelled.message, /цены не менялись/);
  assert.equal(changes[0].status, "cancelled");
});

test("applying: variant and product prices through the catalog path; a price changed meanwhile is kept", async () => {
  const { applyPriceChangeChunk, PRICE_CHANGE_UNDO_MS } = await changesModule;
  const priced = (eur: number | null, usd: number | null, source: string) => ({
    priceEur: eur,
    priceUsd: usd,
    priceUah: null,
    priceSourceCurrency: source,
    compareAtEur: null,
    compareAtUsd: null,
    compareAtUah: null,
  });
  const products: Record<string, Record<string, unknown>> = {
    "p-a": {
      id: "p-a",
      sku: "A-1",
      slug: "a-1",
      brand: "Brabus",
      vendor: null,
      tags: [],
      titleEn: "A",
      titleUa: "",
      ...priced(1000, null, "EUR"),
      variants: [{ id: "v-a", sku: "A-1", ...priced(1000, null, "EUR") }],
    },
    "p-b": {
      id: "p-b",
      sku: "B-1",
      slug: "b-1",
      brand: "Remus",
      vendor: null,
      tags: [],
      titleEn: "B",
      titleUa: "",
      ...priced(null, 500, "USD"),
      variants: [],
    },
    "p-c": {
      id: "p-c",
      sku: "C-1",
      slug: "c-1",
      brand: "Brabus",
      vendor: null,
      tags: [],
      titleEn: "C",
      titleUa: "",
      ...priced(210, null, "EUR"),
      variants: [{ id: "v-c", sku: "C-1", ...priced(210, null, "EUR") }],
    },
  };
  const change: Record<string, unknown> = {
    id: "chg-0000000001",
    status: "applying",
    origin: "command",
    title: "test",
    requestedById: owner.id,
    cursor: 0,
    appliedCount: 0,
    failedCount: 0,
    items: [
      {
        productId: "p-a",
        variantId: "v-a",
        sku: "A-1",
        title: "A",
        currency: "EUR",
        before: 1000,
        after: 1100,
        deltaPct: 10,
        big: false,
      },
      {
        productId: "p-b",
        variantId: null,
        sku: "B-1",
        title: "B",
        currency: "USD",
        before: 500,
        after: 550,
        deltaPct: 10,
        big: false,
      },
      {
        productId: "p-c",
        variantId: "v-c",
        sku: "C-1",
        title: "C",
        currency: "EUR",
        before: 200,
        after: 220,
        deltaPct: 10,
        big: false,
      },
    ],
  };
  const audits: Array<Record<string, unknown>> = [];
  const productUpdates: Array<Record<string, unknown>> = [];
  const variantPatches: Array<Record<string, unknown>> = [];
  const published: number[] = [];
  const revalidated: string[] = [];
  const client = {
    opsPriceChange: {
      findUnique: async () => change,
      update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(change, data),
    },
    adminUser: {
      findFirst: async () => ({
        ...owner,
        roles: [{ role: { key: "owner", permissions: ["*"] } }],
      }),
    },
    shopSettings: { findUnique: async () => ({ currencyRates: RATES }) },
  } as unknown as PrismaClient;
  const tx = (productId: string) => ({
    shopProduct: {
      findUnique: async () => products[productId],
      update: async ({ data }: { data: Record<string, unknown> }) =>
        productUpdates.push({ productId, ...data }),
    },
    adminUser: { findUnique: async () => ({ id: owner.id }) },
    adminAuditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => audits.push(data),
    },
  });
  const result = await applyPriceChangeChunk({
    client,
    changeId: "chg-0000000001",
    limit: 10,
    deadline: Date.now() + 10_000,
    writer: {
      mutate: (async (
        _client: unknown,
        input: {
          productId: string;
          mutateAndSnapshot: (tx: unknown, version: string) => Promise<unknown>;
        }
      ) => {
        await input.mutateAndSnapshot(tx(input.productId), "2");
        return { productId: input.productId };
      }) as never,
      snapshot: (async () => ({})) as never,
      patchVariant: (async (_tx: unknown, patch: Record<string, unknown>) => {
        variantPatches.push(patch);
        return { updatedCount: 1, productIds: [patch.productId] };
      }) as never,
      publish: async (count) => published.push(count),
      revalidate: ((product: { slug: string }) => revalidated.push(product.slug)) as never,
    },
  });
  assert.equal(result.done, true);
  assert.deepEqual(variantPatches, [{ productId: "p-a", variantIds: ["v-a"], priceEur: 1100 }]);
  assert.equal(productUpdates.length, 1);
  assert.deepEqual(
    {
      id: productUpdates[0].productId,
      usd: productUpdates[0].priceUsd,
      source: productUpdates[0].priceSourceCurrency,
    },
    { id: "p-b", usd: 550, source: "USD" }
  );
  assert.ok(
    Number(productUpdates[0].priceEur) > 0 && Number(productUpdates[0].priceUah) > 0,
    "other currencies follow"
  );
  const items = change.items as Array<{ sku: string; status: string; note?: string }>;
  assert.deepEqual(
    items.map((item) => [item.sku, item.status]),
    [
      ["A-1", "applied"],
      ["B-1", "applied"],
      ["C-1", "skipped"],
    ]
  );
  assert.equal(items[2].note, "цена уже изменилась");
  assert.equal(audits.length, 2, "one audit record per changed product");
  assert.equal(audits[0].action, "pricing.telegram");
  assert.deepEqual(published, [2]);
  assert.deepEqual(revalidated, ["a-1", "b-1"]);
  assert.equal(change.status, "applied");
  assert.equal(change.appliedCount, 2);
  const undoWindow = (change.undoUntil as Date).getTime() - Date.now();
  assert.ok(undoWindow > PRICE_CHANGE_UNDO_MS - 5_000 && undoWindow <= PRICE_CHANGE_UNDO_MS);
});

test("the preview of a whole brand stays within Telegram's limit", async () => {
  const { renderPriceChangePreview } = await changesModule;
  const items = Array.from({ length: 900 }, (_, index) => ({
    productId: `p${index}`,
    variantId: null,
    sku: `SKU-${index}-LONG-PART-NUMBER`,
    title: "Item",
    currency: "EUR" as const,
    before: 100,
    after: 105,
    deltaPct: 5,
    big: false,
  }));
  const text = renderPriceChangePreview({
    title: "Brabus: +5 % ко всем ценам",
    items,
    skipped: [],
  });
  assert.ok(text.length <= 3_900);
  assert.match(text, /Изменится: 900 цен/);
  assert.match(text, /<blockquote expandable>…и ещё 888/);
});

test("the product card: our price, the formula, the supplier's stock, weight and box, a competitor", async () => {
  const { buildProductCard } = await changesModule;
  const brabus = product("V167-678-63", 7827.82);
  const facts = [
    {
      sourceKey: "brabus",
      price: 8187.2,
      currency: "EUR",
      available: true,
      availability: "https://schema.org/InStock",
      weightKg: 12.5,
      lengthCm: 120,
      widthCm: 60,
      heightCm: 40.5,
      url: "https://www.brabus.com/de-de/v167-678-63",
      lastSeenAt: new Date("2026-10-21T09:00:00Z"),
    },
    {
      sourceKey: "competitor-adrenalin",
      price: 480_000,
      currency: "UAH",
      available: true,
      availability: null,
      weightKg: null,
      lengthCm: null,
      widthCm: null,
      heightCm: null,
      url: "https://shop.a-drive.com.ua/products/brabus-v167",
      lastSeenAt: new Date("2026-10-21T09:00:00Z"),
    },
  ];
  const client = {
    shopSettings: { findUnique: async () => ({ currencyRates: RATES }) },
    shopProduct: { findMany: async () => [brabus] },
    opsSupplierItem: { findMany: async () => facts },
    opsPriceWatchSource: { findUnique: async () => ({ id: "src-brabus-0001" }) },
    opsPriceWatchRun: {
      findFirst: async () => ({
        findings: [
          {
            kind: "cheaper",
            sku: "V167-678-63",
            expected: 9005.92,
            currency: "EUR",
            deltaPct: -13.1,
          },
        ],
      }),
    },
  } as unknown as PrismaClient;
  const card = await buildProductCard({
    client,
    sku: "v167-678-63",
    actor: owner,
    button: noButtons as never,
  });
  const text = String(card?.text);
  assert.match(text, /🔎 <b>V167-678-63<\/b> · Brabus/);
  assert.match(text, /На сайте: <b>7\s827,82\s€<\/b> · 403\s602\s₴/);
  assert.match(text, /По формуле: 9\s005,92\s€ — у нас дешевле на 13,1\s%/);
  assert.match(text, /У поставщика: 8\s187,20\s€ · в наличии · проверено/);
  assert.match(text, /Для доставки: 12,5 кг · коробка 120 × 60 × 40,5 см/);
  assert.match(text, /Adrenalin Drive: 480\s000\s₴ \(мы дешевле на 15,9\s%\)/);
  const labels = card?.replyMarkup?.inline_keyboard.flat().map((button) => button.text) ?? [];
  assert.ok(labels.includes("🌐 У поставщика"));
  assert.ok(
    labels.some((label) => label.startsWith("✏️ Поставить 9")),
    "an owner can fix the price from the card"
  );
  const forIgor = await buildProductCard({
    client,
    sku: "V167-678-63",
    actor: igor,
    button: noButtons as never,
  });
  assert.ok(
    !forIgor?.replyMarkup?.inline_keyboard.flat().some((button) => button.text.startsWith("✏️")),
    "superadmin sees the card without the price button"
  );
});

test("an applied price list becomes current; undo brings its old dates back", async () => {
  const { applyPriceChangeChunk, undoPriceChange } = await changesModule;
  const changes: Array<Record<string, unknown>> = [
    {
      id: "chg-0000000001",
      status: "applying",
      origin: "price_list:dinan",
      title: "Dinan: новый прайс",
      requestedById: owner.id,
      cursor: 0,
      itemCount: 1,
      appliedCount: 0,
      failedCount: 0,
      telegramChatId: null,
      items: [
        // A product priced for the first time: nothing to put back on undo.
        {
          productId: "p-d",
          variantId: null,
          sku: "D193-3201",
          title: "Dinan",
          currency: "USD",
          before: null,
          after: 184,
          deltaPct: null,
          big: false,
        },
      ],
    },
  ];
  const sourceUpdates: Array<{ where: unknown; data: Record<string, unknown> }> = [];
  const client = {
    opsPriceChange: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        changes.find((row) => row.id === where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
        Object.assign(changes.find((row) => row.id === where.id)!, data),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `chg-${String(changes.length + 1).padStart(10, "0")}`, ...data };
        changes.push(row);
        return row;
      },
    },
    opsPriceWatchSource: {
      findUnique: async () => ({
        priceListDate: new Date("2026-10-19T00:00:00Z"),
        nextReminderAt: new Date("2027-01-17T00:00:00Z"),
      }),
      updateMany: async (args: { where: unknown; data: Record<string, unknown> }) => {
        sourceUpdates.push(args);
        return { count: 1 };
      },
    },
    opsJob: { createMany: async () => ({ count: 1 }) },
    adminUser: {
      findFirst: async () => ({
        ...owner,
        roles: [{ role: { key: "owner", permissions: ["*"] } }],
      }),
    },
    shopSettings: { findUnique: async () => ({ currencyRates: RATES }) },
  } as unknown as PrismaClient;
  const product = {
    id: "p-d",
    sku: "D193-3201",
    slug: "d193-3201",
    brand: "Dinan",
    vendor: null,
    tags: [],
    titleEn: "Dinan",
    titleUa: "",
    priceEur: null,
    priceUsd: null,
    priceUah: null,
    priceSourceCurrency: null,
    compareAtEur: null,
    compareAtUsd: null,
    compareAtUah: null,
    variants: [],
  };
  await applyPriceChangeChunk({
    client,
    changeId: "chg-0000000001",
    limit: 10,
    deadline: Date.now() + 10_000,
    writer: {
      mutate: (async (
        _client: unknown,
        input: { mutateAndSnapshot: (tx: unknown, version: string) => Promise<unknown> }
      ) =>
        input.mutateAndSnapshot(
          {
            shopProduct: { findUnique: async () => product, update: async () => product },
            adminUser: { findUnique: async () => ({ id: owner.id }) },
            adminAuditLog: { create: async () => ({}) },
          },
          "2"
        )) as never,
      snapshot: (async () => ({})) as never,
      patchVariant: (async () => ({})) as never,
      publish: async () => undefined,
      revalidate: (() => undefined) as never,
    },
  });
  assert.equal(changes[0].status, "applied");
  assert.equal(sourceUpdates.length, 1, "the Dinan price list is current now");
  assert.equal(
    (sourceUpdates[0].data.priceListDate as Date).getTime() > Date.parse("2026-10-21"),
    true
  );
  assert.deepEqual(changes[0].previousPriceList, {
    priceListDate: "2026-10-19T00:00:00.000Z",
    nextReminderAt: "2027-01-17T00:00:00.000Z",
  });
  await undoPriceChange({
    client,
    actor: owner,
    changeId: "chg-0000000001",
    button: noButtons as never,
  });
  assert.equal(changes[0].status, "undone");
  assert.deepEqual(sourceUpdates[1], {
    where: { key: "dinan" },
    data: {
      priceListDate: new Date("2026-10-19T00:00:00Z"),
      nextReminderAt: new Date("2027-01-17T00:00:00Z"),
    },
  });
});
