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

const novaPoshtaModule = import("../../../src/lib/operations/novaPoshta");
const commandsModule = import("../../../src/lib/operations/priceCommands");
const changesModule = import("../../../src/lib/operations/priceChanges");
const orderModule = import("../../../src/lib/operations/orderCard");
const botModule = import("../../../src/lib/operations/telegramBot");

const RATES = { EUR: 1, USD: 1.14, UAH: 50.56, _uahReserve: 1, _rawUsdToUah: 45.03 };
const KYIV = "8d5a980d-391c-11dd-90d9-001a92567626";
const ODESA = { ref: "db5c88d0-391c-11dd-90d9-001a92567626", present: "м. Одеса, Одеська обл." };

type NpRequest = {
  apiKey: string;
  modelName: string;
  calledMethod: string;
  methodProperties: Record<string, unknown>;
};

/** Nova Poshta as its API answers: 200 ₴ to a branch, 290 ₴ to the door, +0.5 % of the declared value. */
function novaPoshta(options: { down?: boolean } = {}) {
  const requests: NpRequest[] = [];
  const fetchImpl = (async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as NpRequest;
    requests.push(body);
    if (options.down) return new Response("Bad gateway", { status: 502 });
    const ok = (data: unknown[]) =>
      new Response(JSON.stringify({ success: true, data, errors: [] }), { status: 200 });
    const props = body.methodProperties;
    if (body.calledMethod === "searchSettlements") {
      const known = /^(Одесса|Одеса)$/i.test(String(props.CityName));
      return ok([
        known
          ? { TotalCount: 1, Addresses: [{ Present: ODESA.present, DeliveryCity: ODESA.ref }] }
          : { TotalCount: 0, Addresses: [] },
      ]);
    }
    if (body.calledMethod === "getDocumentPrice") {
      const declared = Number(props.Cost);
      const base = props.ServiceType === "WarehouseDoors" ? 290 : 200;
      return ok([
        {
          Cost: base + (declared > 200 ? Math.round(declared * 0.005) : 0),
          AssessedCost: declared,
        },
      ]);
    }
    if (body.calledMethod === "getDocumentDeliveryDate") {
      return ok([
        { DeliveryDate: { date: "2026-10-23 15:00:00.000000", timezone: "Europe/Kiev" } },
      ]);
    }
    return ok([]);
  }) as unknown as typeof fetch;
  return { requests, fetchImpl };
}

const prices = (requests: NpRequest[]) =>
  requests.filter((request) => request.calledMethod === "getDocumentPrice");

const KW_BOX = {
  weight: 24.45,
  length: 74.9,
  width: 44.7,
  height: 15,
  isDimensionsEstimated: false,
};

function product(sku: string, extra: Record<string, unknown> = {}) {
  const money = {
    priceEur: 1000,
    priceUsd: null,
    priceUah: null,
    priceSourceCurrency: "EUR",
    compareAtEur: null,
    compareAtUsd: null,
    compareAtUah: null,
  };
  return {
    id: `p-${sku.replace(/\W/g, "")}`,
    sku,
    slug: sku.toLowerCase().replace(/\W+/g, "-"),
    brand: "KW Suspensions",
    titleEn: "Coilover kit V1 inox",
    titleUa: "",
    isPublished: true,
    ...money,
    variants: [{ id: `v-${sku.replace(/\W/g, "")}`, sku, ...money }],
    ...extra,
  };
}

function shopClient(input: {
  products: ReturnType<typeof product>[];
  measures?: Record<string, unknown>;
  order?: Record<string, unknown> | null;
  orderProducts?: unknown[];
}) {
  const measures = {
    weight: null,
    length: null,
    width: null,
    height: null,
    isDimensionsEstimated: false,
    scope: "auto",
    productType: "Suspension",
    categoryUa: null,
    categoryEn: null,
    category: null,
    leadTimeUa: null,
    leadTimeEn: null,
    vendor: null,
    tags: [],
    metafields: [],
    variants: [],
    ...input.measures,
  };
  return {
    adminUser: {
      findFirst: async () => ({
        id: "admin_mngr_00001",
        email: "i@x",
        name: "Ігор",
        roles: [{ role: { key: "manager", permissions: ["shop.orders.read"] } }],
      }),
    },
    shopSettings: { findUnique: async () => ({ currencyRates: RATES }) },
    shopProduct: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        if (input.orderProducts && "id" in where) return input.orderProducts;
        const or = (where.OR as Array<{ sku?: { equals?: string } }> | undefined) ?? [];
        const sku = String(or[0]?.sku?.equals ?? "").toLowerCase();
        return input.products.filter((entry) => entry.sku.toLowerCase() === sku);
      },
      findFirst: async () => input.products[0] ?? null,
      findUnique: async () => measures,
    },
    opsSupplierItem: { findMany: async () => [] },
    opsPriceWatchSource: { findUnique: async () => null, findMany: async () => [] },
    opsPriceWatchRun: { findFirst: async () => null },
    shopOrder: { findUnique: async () => input.order ?? null },
  } as unknown as PrismaClient;
}

const buttons = async (action: string, resourceId: string, label: string) => ({
  text: label,
  callback_data: `${action}:${resourceId}`,
});

async function ask(client: PrismaClient, text: string, fetchImpl: typeof fetch) {
  const { handlePriceMessage } = await changesModule;
  return handlePriceMessage({
    client,
    actorAdminUserId: "admin_mngr_00001",
    text,
    telegramChatId: null,
    button: buttons as never,
    fetchImpl,
  });
}

test("Nova Poshta prices our box from Kyiv: branch, door, insured, and when", async () => {
  const { quoteNovaPoshta, findNovaPoshtaCity, exactSeat, novaPoshtaCardLine } =
    await novaPoshtaModule;
  const api = novaPoshta();
  const city = await findNovaPoshtaCity("Одесса", api.fetchImpl);
  assert.deepEqual(city, { ref: ODESA.ref, name: ODESA.present }, "Russian names find the city");
  assert.equal(await findNovaPoshtaCity("Варшава", api.fetchImpl), null);

  const seat = exactSeat(KW_BOX);
  assert.deepEqual(seat, { weightKg: 24.45, box: [74.9, 44.7, 15] });
  assert.equal(
    exactSeat({ ...KW_BOX, isDimensionsEstimated: true }),
    null,
    "an estimate prices nothing"
  );
  assert.deepEqual(exactSeat({ ...KW_BOX, height: null }), { weightKg: 24.45, box: null });

  const quote = await quoteNovaPoshta({
    cityRef: ODESA.ref,
    seats: [seat!],
    declaredUah: 60_000,
    doors: true,
    fetchImpl: api.fetchImpl,
  });
  assert.deepEqual(quote, {
    warehouse: 200,
    doors: 290,
    insured: 500,
    declaredUah: 60_000,
    deliveryDate: "2026-10-23",
  });
  const [branch] = prices(api.requests);
  assert.equal(branch.apiKey, "", "the public API needs no key");
  assert.equal(branch.methodProperties.CitySender, KYIV);
  assert.equal(branch.methodProperties.CargoType, "Parcel");
  assert.equal(branch.methodProperties.Weight, "24.45");
  assert.deepEqual(branch.methodProperties.OptionsSeat, [
    { weight: "24.45", volumetricLength: "74.9", volumetricWidth: "44.7", volumetricHeight: "15" },
  ]);
  assert.match(
    novaPoshtaCardLine(quote),
    /^🚚 Новая почта по Украине: 200\s₴ до отделения, со страховкой на 60\s000\s₴ — 500\s₴; доставка пт, 23 окт\.$/
  );

  // Heavier than a parcel goes as cargo; two boxes are two seats.
  const heavy = novaPoshta();
  await quoteNovaPoshta({
    cityRef: ODESA.ref,
    seats: [
      { weightKg: 36.3, box: [76.2, 45.7, 15.2] },
      { weightKg: 2.27, box: null },
    ],
    declaredUah: null,
    fetchImpl: heavy.fetchImpl,
  });
  const [cargo] = prices(heavy.requests);
  assert.equal(cargo.methodProperties.CargoType, "Cargo");
  assert.equal(cargo.methodProperties.SeatsAmount, "2");
  assert.equal(cargo.methodProperties.OptionsSeat, undefined, "a box without sides: weight only");
  assert.equal(prices(heavy.requests).length, 1, "no declared value, no insured price");

  await assert.rejects(
    quoteNovaPoshta({
      cityRef: ODESA.ref,
      seats: [seat!],
      declaredUah: null,
      fetchImpl: novaPoshta({ down: true }).fetchImpl,
    }),
    /NOVA_POSHTA_HTTP_502/
  );
});

test("«доставка …», the «🚚 Доставка» prompts and «/delivery»", async () => {
  const {
    parseDeliveryCommand,
    promptedCommandText,
    slashCommandText,
    priceMessageAck,
    deliveryPromptFor,
    OPS_DELIVERY_PROMPT,
  } = await commandsModule;
  assert.equal(parseDeliveryCommand("доставка 1021000B Одесса"), "1021000B Одесса");
  assert.equal(parseDeliveryCommand("Доставка  0006 55SR   Біла Церква"), "0006 55SR Біла Церква");
  assert.equal(parseDeliveryCommand("доставка"), null);
  assert.equal(priceMessageAck("доставка 1021000B Одесса"), "🚚 Считаю доставку…");
  assert.equal(priceMessageAck("доставка завтра в 10"), null, "an ordinary message stays a task");
  assert.equal(slashCommandText("/delivery 1021000B Одесса"), "доставка 1021000B Одесса");
  assert.equal(slashCommandText("/delivery"), "/delivery", "without words it opens the prompt");
  assert.equal(
    promptedCommandText(`${OPS_DELIVERY_PROMPT}.\nНапример…`, "1021000B Одесса"),
    "доставка 1021000B Одесса"
  );
  assert.equal(
    promptedCommandText(`${deliveryPromptFor("0006 55SR")}.\nНапример: «Одесса».`, "Одесса"),
    "доставка 0006 55SR Одесса"
  );

  const { parseOpsBotCommand } = await botModule;
  assert.equal(parseOpsBotCommand("🚚 Доставка"), "delivery");
  assert.equal(parseOpsBotCommand("/delivery"), "delivery");
});

test("the bot prices delivery for a SKU and a city; never from an estimate", async () => {
  const kw = product("1021000B");
  const client = shopClient({ products: [kw], measures: KW_BOX });
  const api = novaPoshta();
  const reply = await ask(client, "доставка 1021000B Одесса", api.fetchImpl);
  const text = String(reply?.text);
  assert.match(text, /^🚚 <b>1021000B<\/b> → м\. Одеса, Одеська обл\./);
  assert.match(text, /Новая почта из Киева · 24,5 кг · коробка 74,9 × 44,7 × 15 см:/);
  assert.match(text, /• 200\s₴ до отделения, со страховкой на [\d\s]+₴ — \d+\s₴/);
  assert.match(text, /• до дверей — 290\s₴/);
  assert.match(text, /Доставка: пт, 23 окт\./);
  assert.match(text, /Укрпошту, Meest и DHL посчитаю, когда будут ключи их API\./);
  const insured = prices(api.requests).find((request) => request.methodProperties.Cost !== "200");
  assert.ok(Number(insured?.methodProperties.Cost) > 40_000, "insured for our price in hryvnias");

  // Without a city: across Ukraine, to a branch only.
  const countrywide = await ask(client, "доставка 1021000B", novaPoshta().fetchImpl);
  assert.match(String(countrywide?.text), /^🚚 <b>1021000B<\/b> → по Украине/);
  assert.doesNotMatch(String(countrywide?.text), /до дверей/);

  // A SKU with a space and a city of two words.
  const remus = shopClient({ products: [product("0006 55SR")], measures: KW_BOX });
  const spaced = await ask(remus, "доставка 0006 55SR Одеса", novaPoshta().fetchImpl);
  assert.match(String(spaced?.text), /^🚚 <b>0006 55SR<\/b> → м\. Одеса/);

  const abroad = await ask(client, "доставка 1021000B Варшава", novaPoshta().fetchImpl);
  assert.match(String(abroad?.text), /Не нашёл «Варшава» среди городов Украины/);
  assert.match(String(abroad?.text), /DHL/);

  const estimated = shopClient({
    products: [kw],
    measures: { ...KW_BOX, isDimensionsEstimated: true },
  });
  const guess = await ask(estimated, "доставка 1021000B Одесса", novaPoshta().fetchImpl);
  assert.match(String(guess?.text), /в карточке нет точного веса — Новая почта не посчитает/);

  const down = await ask(client, "доставка 1021000B Одесса", novaPoshta({ down: true }).fetchImpl);
  assert.match(String(down?.text), /Новая почта сейчас не отвечает/);

  assert.match(
    String((await ask(client, "доставка ZZZ-404 Одесса", novaPoshta().fetchImpl))?.text),
    /Не нашёл товар «ZZZ-404»/
  );
  assert.equal(
    await ask(client, "доставка завтра в 10", novaPoshta().fetchImpl),
    null,
    "an ordinary message about a delivery stays a task"
  );
});

test("the product card shows Nova Poshta's own price and offers «🚚 Доставка в город»", async () => {
  const { buildProductCard, deliveryPromptForProduct } = await changesModule;
  const { promptedCommandText } = await commandsModule;
  const kw = product("1021000B");
  const api = novaPoshta();
  const card = await buildProductCard({
    client: shopClient({ products: [kw], measures: KW_BOX }),
    sku: "1021000B",
    actor: null,
    button: buttons as never,
    fetchImpl: api.fetchImpl,
  });
  const text = String(card?.text);
  assert.match(
    text,
    /🚚 Новая почта по Украине: 200\s₴ до отделения, со страховкой на [\d\s]+₴ — \d+\s₴; доставка пт, 23 окт\./
  );
  assert.doesNotMatch(text, /≈ 800/, "the size-class estimate gives way to the real price");
  assert.match(text, /Вес и коробка: 24,5 кг · коробка 74,9 × 44,7 × 15 см \(из карточки\)/);
  const labels = card?.replyMarkup?.inline_keyboard.flat().map((button) => button.text) ?? [];
  assert.ok(labels.includes("🚚 Доставка в город"));

  const prompt = await deliveryPromptForProduct({
    client: shopClient({ products: [kw] }),
    productId: kw.id,
    variantId: null,
  });
  assert.deepEqual(prompt.reply.forceReply, { placeholder: "Город" });
  assert.match(prompt.reply.text, /^🚚 Доставка 1021000B — пришлите город\./);
  assert.equal(promptedCommandText(prompt.reply.text, "Одесса"), "доставка 1021000B Одесса");

  // An estimated box: the size class as before, no Nova Poshta request, no button.
  const quiet = novaPoshta();
  const estimated = await buildProductCard({
    client: shopClient({ products: [kw], measures: { ...KW_BOX, isDimensionsEstimated: true } }),
    sku: "1021000B",
    actor: null,
    button: buttons as never,
    fetchImpl: quiet.fetchImpl,
  });
  assert.match(String(estimated?.text), /Доставка по Украине: Нова Пошта ≈ [\d\s]+₴/);
  assert.equal(quiet.requests.length, 0);
  assert.ok(
    !estimated?.replyMarkup?.inline_keyboard.flat().some((button) => button.text.startsWith("🚚")),
    "no city prompt without a real weight"
  );

  // Nova Poshta down: the card still opens, with the estimate.
  const down = await buildProductCard({
    client: shopClient({ products: [kw], measures: KW_BOX }),
    sku: "1021000B",
    actor: null,
    button: buttons as never,
    fetchImpl: novaPoshta({ down: true }).fetchImpl,
  });
  assert.match(String(down?.text), /Доставка по Украине: Нова Пошта ≈/);
});

test("the order card prices Nova Poshta to the customer's city until it ships", async () => {
  const { buildOrderCard } = await orderModule;
  const order = {
    id: "ord_0000000001",
    orderNumber: "OC-2026-00034",
    status: "PROCESSING",
    paymentStatus: "PAID",
    paymentMethod: "MONOBANK",
    currency: "UAH",
    total: 158_000,
    amountPaid: 158_000,
    customerName: "Іван Петренко",
    shippingAddress: { city: "Одеса", line1: "Відділення №5" },
    deliveryMethod: "NOVA_POSHTA",
    ttnNumber: null,
    isDraft: false,
    createdAt: new Date("2026-10-22T11:05:00Z"),
    items: [
      {
        title: "GiroDisc A1-001",
        quantity: 2,
        total: 158_000,
        productId: "p-giro",
        variantId: null,
      },
    ],
    shipments: [],
  };
  const giro = {
    id: "p-giro",
    weight: 13.61,
    length: 38.1,
    width: 38.1,
    height: 20.3,
    isDimensionsEstimated: false,
    variants: [],
  };
  const actor = { permissions: ["shop.orders.read"] };
  const api = novaPoshta();
  const card = await buildOrderCard({
    client: shopClient({ products: [], order, orderProducts: [giro] }),
    orderNumber: "OC-2026-00034",
    actor,
    button: buttons as never,
    fetchImpl: api.fetchImpl,
  });
  assert.match(
    String(card?.text),
    /🚚 Новая почта до м\. Одеса, Одеська обл\.: 200\s₴ до отделения, со страховкой на 158\s000\s₴ — 990\s₴/
  );
  const [branch] = prices(api.requests);
  assert.equal(branch.methodProperties.SeatsAmount, "2", "two rotor kits are two boxes");
  assert.equal(branch.methodProperties.Weight, "27.22");

  const noWeight = await buildOrderCard({
    client: shopClient({
      products: [],
      order,
      orderProducts: [{ ...giro, weight: null }],
    }),
    orderNumber: "OC-2026-00034",
    actor,
    button: buttons as never,
    fetchImpl: novaPoshta().fetchImpl,
  });
  assert.match(String(noWeight?.text), /🚚 Новая почта: нет веса у 1 из 1 товара — не посчитать\./);

  const quiet = novaPoshta();
  const shipped = await buildOrderCard({
    client: shopClient({
      products: [],
      order: { ...order, status: "SHIPPED", ttnNumber: "20450123456789" },
      orderProducts: [giro],
    }),
    orderNumber: "OC-2026-00034",
    actor,
    button: buttons as never,
    fetchImpl: quiet.fetchImpl,
  });
  assert.doesNotMatch(String(shipped?.text), /Новая почта до/, "after it ships the price is moot");
  assert.equal(quiet.requests.length, 0);
});
