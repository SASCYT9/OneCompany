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

const commandsModule = import("../../../src/lib/operations/priceCommands");
const telegramModule = import("../../../src/lib/operations/telegram");
const botModule = import("../../../src/lib/operations/telegramBot");
const changesModule = import("../../../src/lib/operations/priceChanges");
const orderModule = import("../../../src/lib/operations/orderCard");
const notificationsModule = import("../../../src/lib/operations/notifications");

const RATES = { EUR: 1, USD: 1.14, UAH: 50.56, _uahReserve: 1, _rawUsdToUah: 45.03 };
const buttons = async (_action: string, resourceId: string, label: string) => ({
  text: label,
  callback_data: `cb:${resourceId}`,
});
const labelsOf = (
  reply: { replyMarkup?: { inline_keyboard: Array<Array<{ text: string }>> } } | null
) => reply?.replyMarkup?.inline_keyboard.flat().map((button) => button.text) ?? [];

test("order numbers, product links, «/product …» and answers to the bot's prompts", async () => {
  const {
    parseOrderCommand,
    parseProductLink,
    priceMessageAck,
    promptedCommandText,
    slashCommandText,
    OPS_ORDER_PROMPT,
    OPS_PRODUCT_PROMPT,
  } = await commandsModule;
  assert.equal(parseOrderCommand("OC-2026-00033"), "OC-2026-00033");
  assert.equal(parseOrderCommand("заказ oc-2026-00033"), "OC-2026-00033");
  assert.equal(parseOrderCommand("#OC-2026-00033"), "OC-2026-00033");
  assert.equal(
    parseOrderCommand("OC-2026-00033 клиент просит перезвонить"),
    null,
    "a message about an order stays a task"
  );
  assert.equal(
    parseProductLink(
      "https://onecompany.global/ua/shop/brabus/products/brabus-gle-v167-678-63?x=1"
    ),
    "brabus-gle-v167-678-63"
  );
  assert.equal(parseProductLink("товар https://onecompany.global/ua/shop/eve-g8x"), "eve-g8x");
  assert.equal(parseProductLink("https://onecompany.global/ua/blog/news"), null);
  assert.equal(parseProductLink("https://example.com/shop/eve"), null);
  assert.equal(priceMessageAck("OC-2026-00033"), "📦 Смотрю заказ…");
  assert.equal(priceMessageAck("https://onecompany.global/ua/shop/eve-g8x"), "🔎 Смотрю товар…");
  assert.equal(priceMessageAck("товар Akrapovic M3"), "🔎 Смотрю товар…");

  assert.equal(
    promptedCommandText(`${OPS_PRODUCT_PROMPT}.\nНапример…`, "Akrapovic M3"),
    "товар Akrapovic M3"
  );
  assert.equal(promptedCommandText(`${OPS_ORDER_PROMPT}.`, "OC-2026-00033"), "заказ OC-2026-00033");
  assert.equal(promptedCommandText("✅ Принял.", "готово"), "готово");
  assert.equal(slashCommandText("/order OC-2026-00033"), "заказ OC-2026-00033");
  assert.equal(slashCommandText("/product@one_ops_bot Akrapovic M3"), "товар Akrapovic M3");
  assert.equal(slashCommandText("/product"), "/product", "without words it opens the prompt");

  // The webhook reads an answer to the prompt as the command it answers.
  const { normalizeOpsTelegramUpdate } = await telegramModule;
  const reply = (text: string, prompt: string, fromBot = true) =>
    normalizeOpsTelegramUpdate({
      update_id: 1,
      message: {
        message_id: 2,
        from: { id: 7001 },
        chat: { id: 7001, type: "private" },
        text,
        reply_to_message: { message_id: 1, from: { id: 99, is_bot: fromBot }, text: prompt },
      },
    });
  assert.equal(reply("Akrapovic M3", `${OPS_PRODUCT_PROMPT}.`)?.text, "товар Akrapovic M3");
  assert.equal(reply("OC-2026-00033", `${OPS_ORDER_PROMPT}.`)?.text, "заказ OC-2026-00033");
  assert.equal(reply("готово", "Задача #12: позвонить клиенту")?.text, "готово");
  assert.equal(
    reply("Akrapovic M3", `${OPS_PRODUCT_PROMPT}.`, false)?.text,
    "Akrapovic M3",
    "only the bot's own prompt"
  );
});

const owner = {
  timezone: "Europe/Kyiv",
  adminUser: {
    id: "admin_owner_0001",
    name: "Олександр",
    email: "o@x",
    roles: [{ role: { key: "owner", permissions: [] as string[] } }],
  },
};
const manager = {
  timezone: "Europe/Kyiv",
  adminUser: {
    id: "admin_mngr_00001",
    name: "Ігор",
    email: "i@x",
    roles: [{ role: { key: "manager", permissions: ["ops.tasks.write", "shop.orders.read"] } }],
  },
};

function botClient(member: typeof manager, extra: Record<string, unknown> = {}) {
  const callbacks: Array<Record<string, unknown>> = [];
  return {
    callbacks,
    client: {
      opsMemberProfile: { findFirst: async () => member },
      requestRateLimit: { upsert: async () => ({ count: 1 }) },
      opsTelegramUpdate: { create: async () => ({ id: "upd" }) },
      opsIdempotencyRecord: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          callbacks.push(data);
          return data;
        },
      },
      ...extra,
    } as unknown as PrismaClient,
  };
}

function message(text: string, id = 1) {
  return {
    update_id: 1_000 + id,
    message: { message_id: id, from: { id: 7001 }, chat: { id: 7001, type: "private" }, text },
  };
}

async function press(client: PrismaClient, text: string, id = 1) {
  const { handleOpsTelegramBotUpdate } = await botModule;
  const { normalizeOpsTelegramUpdate } = await telegramModule;
  return handleOpsTelegramBotUpdate({
    client,
    rawUpdate: message(text, id),
    update: normalizeOpsTelegramUpdate(message(text, id)),
    now: new Date("2026-10-22T10:00:00Z"),
  });
}

test("visible buttons, the «/» list and the help: product and order for all, prices for owners", async () => {
  const { buildOpsBotKeyboard, opsBotCommandList, buildOpsBotWelcome } = await botModule;
  assert.deepEqual(buildOpsBotKeyboard(null).keyboard[2], [
    { text: "🔎 Товар" },
    { text: "📦 Заказ" },
  ]);
  assert.deepEqual(buildOpsBotKeyboard(null).keyboard[3], [{ text: "🚚 Доставка" }]);
  assert.deepEqual(buildOpsBotKeyboard(null, true).keyboard[3], [
    { text: "🚚 Доставка" },
    { text: "💰 Цены" },
  ]);
  const team = opsBotCommandList(false).map((entry) => entry.command);
  assert.deepEqual(team, [
    "today",
    "my",
    "new",
    "product",
    "order",
    "delivery",
    "ask",
    "app",
    "help",
  ]);
  assert.ok(opsBotCommandList(true).some((entry) => entry.command === "prices"));
  for (const entry of opsBotCommandList(true)) {
    assert.match(entry.command, /^[a-z_]{1,32}$/, "Telegram command names");
    assert.ok(entry.description.length >= 3 && entry.description.length <= 256);
  }
  const help = buildOpsBotWelcome({ name: "Ігор", miniAppUrl: null });
  assert.match(help, /🔎 Товары и заказы/);
  assert.match(help, /«товар Akrapovic M3» или ссылка с сайта/);
  assert.match(help, /Номер заказа, например «OC-2026-00033»/);
  assert.doesNotMatch(help, /💰 Цены/);
  assert.match(
    buildOpsBotWelcome({ name: "О", miniAppUrl: null, canChangePrices: true }),
    /💰 Цены — только для владельцев/
  );

  // «🔎 Товар» and «📦 Заказ» ask with a reply prompt.
  const { OPS_ORDER_PROMPT, OPS_PRODUCT_PROMPT } = await commandsModule;
  const product = await press(botClient(manager).client, "🔎 Товар");
  const productBody = product?.body as { text: string; reply_markup: Record<string, unknown> };
  assert.ok(productBody.text.startsWith(OPS_PRODUCT_PROMPT));
  assert.equal(productBody.reply_markup.force_reply, true);
  const order = await press(botClient(manager).client, "/order", 2);
  assert.ok((order?.body as { text: string }).text.startsWith(OPS_ORDER_PROMPT));

  // «💰 Цены» is the owners'.
  const refused = await press(botClient(manager).client, "/prices", 3);
  assert.match((refused?.body as { text: string }).text, /Цены меняют только владельцы/);
});

test("«💰 Цены» for an owner: what the latest checks ask for, as buttons", async () => {
  const previous = process.env.OPS_TELEGRAM_CALLBACK_SECRET;
  process.env.OPS_TELEGRAM_CALLBACK_SECRET = "test-secret-for-callbacks";
  try {
    const { client, callbacks } = botClient(owner, {
      $queryRaw: async () => [{ id: "run_brabus_01" }],
      opsPriceWatchRun: {
        findMany: async () => [
          {
            status: "findings",
            checked: 900,
            findingsCount: 2,
            newFindings: 2,
            summary: { matched: 900, counts: { cheaper: 2 } },
            findings: [
              {
                kind: "cheaper",
                sku: "v167-678-63",
                title: "Exhaust",
                currency: "EUR",
                expected: 9005.92,
              },
              {
                kind: "cheaper",
                sku: "c167-460-99",
                title: "Spoiler",
                currency: "EUR",
                expected: 2100,
              },
            ],
            finishedAt: new Date("2026-10-22T08:00:00Z"),
            source: { key: "brabus" },
          },
        ],
      },
      opsPriceWatchSource: { findMany: async () => [{ id: "src_brabus_0001", key: "brabus" }] },
      shopProduct: { findMany: async () => [] },
      opsSupplierItem: { findMany: async () => [] },
    });
    const handled = await press(client, "💰 Цены", 4);
    const body = handled?.body as {
      text: string;
      parse_mode: string;
      reply_markup: { inline_keyboard: Array<Array<{ text: string; url?: string }>> };
    };
    assert.equal(body.parse_mode, "HTML");
    assert.match(body.text, /💰 <b>Цены и сроки<\/b>/);
    assert.match(body.text, /✏️ Brabus: 2 не по формуле/);
    const labels = body.reply_markup.inline_keyboard.flat().map((button) => button.text);
    assert.ok(labels.includes("✏️ Brabus: по формуле (2)"));
    assert.ok(labels.includes("📊 Страница цен"));
    assert.equal(callbacks[0].resourceId, "src_brabus_0001");
  } finally {
    if (previous === undefined) delete process.env.OPS_TELEGRAM_CALLBACK_SECRET;
    else process.env.OPS_TELEGRAM_CALLBACK_SECRET = previous;
  }
});

const actorRow = (permissions: string[]) => ({
  id: "admin_mngr_00001",
  email: "i@x",
  name: "Ігор",
  roles: [{ role: { key: "manager", permissions } }],
});

function product(sku: string, title: string, extra: Record<string, unknown> = {}) {
  const prices = {
    priceEur: 1000,
    priceUsd: null,
    priceUah: null,
    priceSourceCurrency: "EUR",
    compareAtEur: null,
    compareAtUsd: null,
    compareAtUah: null,
  };
  return {
    id: `p-${sku}`,
    sku,
    slug: sku.toLowerCase(),
    brand: "Akrapovic",
    titleEn: title,
    titleUa: "",
    isPublished: true,
    ...prices,
    variants: [{ id: `v-${sku}`, sku, ...prices }],
    ...extra,
  };
}

function shopClient(input: {
  bySku?: ReturnType<typeof product>[];
  search?: ReturnType<typeof product>[];
  bySlug?: ReturnType<typeof product> | null;
  orders?: Record<string, unknown> | null;
  permissions?: string[];
}) {
  return {
    adminUser: { findFirst: async () => actorRow(input.permissions ?? ["shop.orders.read"]) },
    shopSettings: { findUnique: async () => ({ currencyRates: RATES }) },
    shopProduct: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        JSON.stringify(where).includes('"contains"') ? (input.search ?? []) : (input.bySku ?? []),
      findFirst: async () => input.bySlug ?? null,
      findUnique: async () => ({
        weight: null,
        length: null,
        width: null,
        height: null,
        isDimensionsEstimated: false,
        scope: "auto",
        productType: "Exhaust",
        categoryUa: null,
        categoryEn: null,
        category: null,
        leadTimeUa: null,
        leadTimeEn: null,
        vendor: null,
        tags: [],
        metafields: [],
        variants: [],
      }),
    },
    opsSupplierItem: { findMany: async () => [] },
    opsPriceWatchSource: { findUnique: async () => null, findMany: async () => [] },
    opsPriceWatchRun: { findFirst: async () => null },
    shopOrder: { findUnique: async () => input.orders ?? null },
  } as unknown as PrismaClient;
}

async function ask(client: PrismaClient, text: string) {
  const { handlePriceMessage } = await changesModule;
  return handlePriceMessage({
    client,
    actorAdminUserId: "admin_mngr_00001",
    text,
    telegramChatId: null,
    button: buttons as never,
  });
}

test("«товар …» by words: one match opens the card, several give buttons, a link opens its product", async () => {
  const several = await ask(
    shopClient({
      search: [
        product("S-BM/T/6H", "AKRAPOVIC Slip-On Line (Titanium) for BMW M3 (G80) / M4 (G82)"),
        product(
          "E-BM/T/9",
          "AKRAPOVIC Evolution Line (Titanium) for BMW M3 (G80) / M4 (G82) 2021+"
        ),
      ],
    }),
    "товар Akrapovic M3"
  );
  assert.match(String(several?.text), /🔎 «Akrapovic M3»: нашёл 2\. Выберите товар:/);
  const picks = labelsOf(several);
  assert.equal(picks.length, 2);
  assert.ok(picks[0].startsWith("S-BM/T/6H · AKRAPOVIC Slip-On Line (Titanium) for BMW M3"));
  assert.ok(picks[1].startsWith("E-BM/T/9 · AKRAPOVIC Evolution Line (Titanium)"));
  assert.ok(
    picks.every((label) => label.length <= 60 && label.endsWith("…")),
    "long titles are cut to fit a button"
  );

  const one = await ask(
    shopClient({
      search: [product("S-BM/T/6H", "AKRAPOVIC Slip-On Line (Titanium) for BMW M3 (G80)")],
      bySlug: product("S-BM/T/6H", "AKRAPOVIC Slip-On Line (Titanium) for BMW M3 (G80)"),
    }),
    "товар slip-on m3 g80"
  );
  assert.match(String(one?.text), /🔎 <b>S-BM\/T\/6H<\/b> · Akrapovic/);
  assert.ok(labelsOf(one).includes("🛒 На сайте"), "the card opens our product page too");

  const none = await ask(shopClient({}), "товар несуществующая деталь");
  assert.match(String(none?.text), /Не нашёл товар «несуществующая деталь»/);

  const link = await ask(
    shopClient({ bySlug: product("E-BM/T/9", "AKRAPOVIC Evolution Line for BMW M3 (G80)") }),
    "https://onecompany.global/ua/shop/e-bm-t-9"
  );
  assert.match(String(link?.text), /🔎 <b>E-BM\/T\/9<\/b>/);

  // A bare word that is not a SKU stays an ordinary message.
  assert.equal(await ask(shopClient({}), "BMW-M3"), null);
});

const ORDER = {
  id: "ord_0000000001",
  orderNumber: "OC-2026-00033",
  status: "PROCESSING",
  paymentStatus: "PAID",
  paymentMethod: "MONOBANK",
  currency: "UAH",
  total: 149_900,
  amountPaid: 149_900,
  customerName: "Іван Петренко",
  shippingAddress: { city: "Київ", line1: "Відділення №12" },
  deliveryMethod: "NOVA_POSHTA",
  ttnNumber: null,
  isDraft: false,
  createdAt: new Date("2026-10-22T11:05:00Z"),
  items: [
    {
      title: "Карбоновий впуск Eventuri для BMW M3 G80",
      quantity: 1,
      total: 149_900,
    },
  ],
  shipments: [],
};

test("an order by its number: payment, delivery, items and what to do next", async () => {
  const card = await ask(shopClient({ orders: ORDER }), "OC-2026-00033");
  const text = String(card?.text);
  assert.match(text, /📦 <b>OC-2026-00033<\/b> · В обробці/);
  assert.match(text, /Іван Петренко/);
  assert.match(text, /Сумма: <b>149\s900\s₴<\/b> · Оплачено/);
  assert.match(text, /Доставка: Нова Пошта · Київ, Відділення №12 · ТТН ещё нет/);
  assert.match(text, /• Карбоновий впуск Eventuri для BMW M3 G80 × 1 — 149\s900\s₴/);
  assert.match(text, /➡️ отправить: ТТН ещё нет/);
  assert.ok(labelsOf(card).includes("📝 Текст для клиента"));
  assert.ok(labelsOf(card).includes("🛠 В админке"));

  const shipped = await ask(
    shopClient({ orders: { ...ORDER, status: "SHIPPED", ttnNumber: "20450123456789" } }),
    "заказ OC-2026-00033"
  );
  assert.match(String(shipped?.text), /ТТН 20450123456789/);
  assert.match(String(shipped?.text), /➡️ ждём доставку/);
  assert.ok(labelsOf(shipped).includes("🚚 Отследить"));

  const missing = await ask(shopClient({ orders: null }), "OC-2026-99999");
  assert.match(String(missing?.text), /Не нашёл заказ «OC-2026-99999»/);
  const closed = await ask(
    shopClient({ orders: ORDER, permissions: ["ops.tasks.write"] }),
    "OC-2026-00033"
  );
  assert.match(String(closed?.text), /только тем, у кого есть доступ к заказам/);

  const { orderClientText } = await orderModule;
  const forClient = await orderClientText({
    client: shopClient({ orders: { ...ORDER, status: "SHIPPED", ttnNumber: "20450123456789" } }),
    orderId: ORDER.id,
    actor: { permissions: ["shop.orders.read"] },
  });
  const clientText = forClient.reply.text;
  assert.match(clientText, /^Замовлення OC-2026-00033\nСтатус: відправлено/);
  assert.match(clientText, /ТТН: 20450123456789/);
  assert.match(
    clientText,
    /Відстежити: https:\/\/novaposhta\.ua\/tracking\/\?cargo_number=20450123456789/
  );
  assert.doesNotMatch(clientText, /Петренко/, "the customer knows who they are");
});

test("the client text goes with the product photo; a photo Telegram cannot take falls back to text", async () => {
  const { sendOpsTelegramPhoto, OpsNotificationError } = await notificationsModule;
  const previous = {
    enabled: process.env.OPS_TELEGRAM_NOTIFICATIONS_ENABLED,
    token: process.env.OPS_TELEGRAM_BOT_TOKEN,
  };
  process.env.OPS_TELEGRAM_NOTIFICATIONS_ENABLED = "1";
  process.env.OPS_TELEGRAM_BOT_TOKEN = "test-token";
  try {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const ok = (async (url: string, init: { body: string }) => {
      requests.push({ url, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ ok: true, result: { message_id: 77 } }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
    const sent = await sendOpsTelegramPhoto({
      chatId: BigInt(7001),
      photoUrl: "https://cdn.onecompany.global/eve.jpg",
      caption: "Карбоновий впуск…",
      fetchImpl: ok,
    });
    assert.equal(sent.messageId, 77);
    assert.match(requests[0].url, /\/sendPhoto$/);
    assert.equal(requests[0].body.photo, "https://cdn.onecompany.global/eve.jpg");
    assert.equal(requests[0].body.caption, "Карбоновий впуск…");

    const refused = (async () =>
      new Response(JSON.stringify({ ok: false, description: "wrong file identifier" }), {
        status: 400,
      })) as unknown as typeof fetch;
    await assert.rejects(
      sendOpsTelegramPhoto({
        chatId: BigInt(7001),
        photoUrl: "https://cdn.onecompany.global/eve.webp",
        caption: "…",
        fetchImpl: refused,
      }),
      (error: unknown) =>
        error instanceof OpsNotificationError && error.code === "TELEGRAM_PHOTO_FAILED"
    );
    await assert.rejects(
      sendOpsTelegramPhoto({
        chatId: BigInt(7001),
        photoUrl: "https://x/y.jpg",
        caption: "x".repeat(1_100),
        fetchImpl: ok,
      }),
      (error: unknown) =>
        error instanceof OpsNotificationError && error.code === "TELEGRAM_PHOTO_UNSUITABLE",
      "a caption over Telegram's limit goes as text"
    );
  } finally {
    for (const [key, value] of [
      ["OPS_TELEGRAM_NOTIFICATIONS_ENABLED", previous.enabled],
      ["OPS_TELEGRAM_BOT_TOKEN", previous.token],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  const { clientTextForProduct } = await changesModule;
  const withPhoto = await clientTextForProduct({
    client: {
      shopSettings: { findUnique: async () => ({ currencyRates: RATES }) },
      shopProduct: {
        findFirst: async () => ({
          ...product("EVE-G8XMV2-CF-INT", "Carbon Fiber Intake System"),
          titleUa: "Карбоновий впуск Eventuri",
          image: "https://cdn.onecompany.global/eve.jpg",
          scope: "auto",
          productType: "Intake Systems",
          categoryUa: null,
          categoryEn: null,
          category: null,
          leadTimeUa: null,
          leadTimeEn: null,
          vendor: null,
          tags: [],
          metafields: [],
        }),
      },
    } as unknown as PrismaClient,
    productId: "p-EVE-G8XMV2-CF-INT",
    variantId: null,
  });
  assert.equal(withPhoto.reply.photoUrl, "https://cdn.onecompany.global/eve.jpg");
});
