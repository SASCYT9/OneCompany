import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { OrderStatus, type PrismaClient } from "@prisma/client";

import { registerHooks } from "./testHooks.mjs";
import { extractOpsKnowledgeQuestion } from "../../../src/lib/operations/knowledgeQuestion";
import { verifyOpsMiniAppInitData } from "../../../src/lib/operations/miniApp";
import {
  nextOpsRepeatDueAt,
  opsRepeatRuleFromTags,
  parseOpsRepeatRule,
  spawnOpsRecurringTasks,
  withOpsRepeatRule,
} from "../../../src/lib/operations/recurrence";
import { buildOpsMorningDigest, type OpsReminderTask } from "../../../src/lib/operations/reminders";
import {
  buildOpsShopTaskDraft,
  isOpsShopTaskResolved,
  opsShopTaskSourceKey,
  syncOpsShopOrderTasks,
} from "../../../src/lib/operations/shopOrderTasks";
import {
  findOpsDuplicateTask,
  opsTaskSimilarity,
  suggestOpsAssignee,
} from "../../../src/lib/operations/taskSimilarity";

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

const botModule = import("../../../src/lib/operations/telegramBot");
const ownerModule = import("../../../src/lib/operations/ownerReports");
const knowledgeModule = import("../../../src/lib/operations/knowledgeAnswers");

// Kyiv is UTC+3 until the last Sunday of October.
const kyiv = (iso: string) => new Date(`${iso}+03:00`);
const NOW = kyiv("2026-10-13T11:00:00"); // Tuesday

test("menu buttons and slash commands are recognised; «/ask вопрос» goes to the knowledge base", async () => {
  const { parseOpsBotCommand, OPS_BOT_MENU } = await botModule;
  assert.equal(parseOpsBotCommand(OPS_BOT_MENU.today), "today");
  assert.equal(parseOpsBotCommand(OPS_BOT_MENU.mine), "mine");
  assert.equal(parseOpsBotCommand("/start"), "start");
  assert.equal(parseOpsBotCommand("/my@one_ops_bot"), "mine");
  assert.equal(parseOpsBotCommand("/ask"), "ask");
  assert.equal(parseOpsBotCommand("/ask доставка из UK"), null);
  assert.equal(parseOpsBotCommand("/whatever"), "help");
  assert.equal(parseOpsBotCommand("Купить фильтр для BMW"), null);

  // /help: the product card for everyone, the price commands for owners only.
  const { buildOpsBotWelcome } = await botModule;
  const team = buildOpsBotWelcome({ name: "Ігор", miniAppUrl: null });
  assert.match(team, /🔎 Товары и заказы/);
  assert.match(team, /«📝 Текст для клиента»/);
  assert.doesNotMatch(team, /цена Brabus/);
  const owners = buildOpsBotWelcome({ name: "Олександр", miniAppUrl: null, canChangePrices: true });
  assert.match(owners, /💰 Цены — только для владельцев/);
  assert.match(owners, /«цена V167-678-63 9005»/);
  assert.match(owners, /«цена Brabus \+5%»/);
  assert.match(owners, /«цена Brabus по формуле»/);
  assert.match(owners, /Excel или CSV в чат — прайс/);

  assert.equal(
    extractOpsKnowledgeQuestion("? доставка из Великобритании"),
    "доставка из Великобритании"
  );
  assert.equal(extractOpsKnowledgeQuestion("/ask скидки Brabus"), "скидки Brabus");
  assert.equal(extractOpsKnowledgeQuestion("❓ сроки KW"), "сроки KW");
  assert.equal(
    extractOpsKnowledgeQuestion("Что с заказом?"),
    null,
    "a plain question stays a task"
  );
  assert.equal(extractOpsKnowledgeQuestion("?"), null);
});

test("short replies to a task become actions, longer progress notes do not", async () => {
  const { parseOpsQuickCommand } = await botModule;
  const parse = (text: string) => parseOpsQuickCommand(text, NOW);
  assert.deepEqual(parse("Готово"), { kind: "done", note: null });
  assert.deepEqual(parse("зроблено!"), { kind: "done", note: null });
  assert.deepEqual(parse("готово, отправил ТТН 2045"), { kind: "done", note: "отправил ТТН 2045" });
  assert.equal(parse("сделал запрос поставщику, ждём ответ"), null, "progress, not done");
  assert.deepEqual(parse("не нужно"), { kind: "cancel" });
  assert.deepEqual(parse("беру"), { kind: "take" });
  assert.deepEqual(parse("передай мне"), { kind: "take" });
  assert.deepEqual(parse("передай Игорю"), { kind: "hand_over", reference: "Игорю" });
  assert.deepEqual(parse("повторять каждую неделю"), { kind: "repeat", rule: "weekly" });
  assert.deepEqual(parse("не повторять"), { kind: "repeat", rule: null });
  assert.equal(parse("Завтра позвоню клиенту"), null);

  const friday = parse("перенеси на пятницу");
  assert.equal(friday?.kind, "snooze_to");
  assert.equal(
    friday?.kind === "snooze_to" && friday.dueAt.toISOString(),
    kyiv("2026-10-16T18:00:00").toISOString()
  );
  const tomorrow = parse("завтра в 15");
  assert.equal(
    tomorrow?.kind === "snooze_to" && tomorrow.dueAt.toISOString(),
    kyiv("2026-10-14T15:00:00").toISOString()
  );
  const date = parse("перенеси на 20.10 в 12:30");
  assert.equal(
    date?.kind === "snooze_to" && date.dueAt.toISOString(),
    kyiv("2026-10-20T12:30:00").toISOString()
  );
  const inDays = parse("через 3 дня");
  assert.equal(
    inDays?.kind === "snooze_to" && inDays.dueAt.toISOString(),
    kyiv("2026-10-16T18:00:00").toISOString()
  );
  const tuesday = parse("во вторник");
  assert.equal(
    tuesday?.kind === "snooze_to" && tuesday.dueAt.toISOString(),
    kyiv("2026-10-20T18:00:00").toISOString(),
    "today's weekday means next week"
  );
});

test("dates without a year roll over; past moments are rejected", async () => {
  const { parseOpsDueText } = await botModule;
  assert.equal(
    parseOpsDueText("05.01", NOW)?.toISOString(),
    new Date("2027-01-05T16:00:00.000Z").toISOString(),
    "5 January next year, 18:00 Kyiv (UTC+2 in winter)"
  );
  assert.equal(parseOpsDueText("сегодня в 9", NOW), null, "09:00 already passed");
  assert.equal(parseOpsDueText("на 32.13", NOW), null);
});

test("repeating tasks keep the time of day and skip missed occurrences", () => {
  assert.equal(parseOpsRepeatRule("каждый понедельник проверять прайс"), "weekly");
  assert.equal(parseOpsRepeatRule("щомісяця звірка"), "monthly");
  assert.equal(parseOpsRepeatRule("по будням"), "weekdays");
  assert.equal(parseOpsRepeatRule("купить фильтр"), null);
  assert.deepEqual(withOpsRepeatRule(["brand:KW", "repeat:daily"], "weekly"), [
    "brand:KW",
    "repeat:weekly",
  ]);
  assert.equal(opsRepeatRuleFromTags(["brand:KW", "repeat:monthly"]), "monthly");

  const due = kyiv("2026-10-09T15:30:00"); // Friday
  assert.equal(
    nextOpsRepeatDueAt("weekly", due, NOW).toISOString(),
    kyiv("2026-10-16T15:30:00").toISOString()
  );
  assert.equal(
    nextOpsRepeatDueAt(
      "weekdays",
      kyiv("2026-10-16T10:00:00"),
      kyiv("2026-10-16T12:00:00")
    ).toISOString(),
    kyiv("2026-10-19T10:00:00").toISOString(),
    "Friday → Monday"
  );
  assert.equal(
    nextOpsRepeatDueAt(
      "monthly",
      new Date("2027-01-31T10:00:00Z"),
      new Date("2027-02-01T00:00:00Z")
    ).toISOString(),
    new Date("2027-02-28T10:00:00Z").toISOString(),
    "31 Jan → 28 Feb"
  );
  assert.equal(
    nextOpsRepeatDueAt("daily", kyiv("2026-10-01T09:00:00"), NOW).toISOString(),
    kyiv("2026-10-14T09:00:00").toISOString(),
    "a long-missed daily task comes back once, not twelve times"
  );
});

test("finishing a repeating task creates the next one exactly once", async () => {
  const created: Array<Record<string, unknown>> = [];
  const client = {
    opsTask: {
      async findMany({ where }: { where: Record<string, unknown> }) {
        if ("sourceKey" in where) return created.map((task) => ({ sourceKey: task.sourceKey }));
        return [
          {
            id: "task_repeat001",
            title: "Проверить прайс do88",
            description: null,
            tags: ["repeat:weekly"],
            priority: "NORMAL",
            projectId: null,
            shopOrderId: null,
            nextAction: null,
            definitionOfDone: null,
            isShared: false,
            assigneeId: "admin_12345678",
            createdById: "admin_12345678",
            requestedById: null,
            dueAt: kyiv("2026-10-09T15:30:00"),
            completedAt: kyiv("2026-10-12T10:00:00"),
            assignees: [{ adminUserId: "admin_12345678", assignedById: "admin_12345678" }],
          },
        ];
      },
      async create({ data }: { data: Record<string, unknown> }) {
        created.push(data);
        return { id: "task_next0001" };
      },
    },
    opsTaskEvent: {
      async create() {
        return {};
      },
    },
    async $transaction(run: (tx: unknown) => Promise<unknown>) {
      return run(client);
    },
  } as unknown as PrismaClient;
  assert.deepEqual(await spawnOpsRecurringTasks({ client, now: NOW }), { created: 1 });
  assert.equal(created[0].sourceKey, "repeat:task_repeat001");
  assert.equal(created[0].status, "PLANNED");
  assert.equal((created[0].dueAt as Date).toISOString(), kyiv("2026-10-16T15:30:00").toISOString());
  assert.deepEqual(await spawnOpsRecurringTasks({ client, now: NOW }), { created: 0 });
});

test("Telegram mini app trusts only correctly signed, fresh init data", () => {
  const botToken = "123456:test-token-not-a-production-secret";
  const sign = (fields: Record<string, string>) => {
    const check = Object.keys(fields)
      .sort()
      .map((key) => `${key}=${fields[key]}`)
      .join("\n");
    const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const hash = crypto.createHmac("sha256", secret).update(check).digest("hex");
    return new URLSearchParams({ ...fields, hash }).toString();
  };
  const authDate = String(Math.floor(NOW.getTime() / 1000) - 60);
  const valid = sign({
    auth_date: authDate,
    user: JSON.stringify({ id: 7001, first_name: "Саша" }),
  });
  assert.equal(
    verifyOpsMiniAppInitData(valid, { botToken, now: NOW })?.telegramUserId,
    BigInt(7001)
  );
  assert.equal(
    verifyOpsMiniAppInitData(valid.replace("7001", "7002"), { botToken, now: NOW }),
    null
  );
  assert.equal(verifyOpsMiniAppInitData(valid, { botToken: "other:token", now: NOW }), null);
  assert.equal(
    verifyOpsMiniAppInitData(valid, { botToken, now: new Date(NOW.getTime() + 13 * 3_600_000) }),
    null,
    "older than 12 hours"
  );
});

test("a task sent twice is recognised; different tasks are not", async () => {
  assert.ok(
    opsTaskSimilarity(
      { title: "Уточнить сроки по пневме CEIKA", tags: ["product:Цейка"] },
      { title: "Уточнить сроки по пневме CEIKA", tags: ["brand:brand:CEIKA"] }
    ) >= 0.6
  );
  assert.equal(
    opsTaskSimilarity(
      { title: "Связаться с Seadoo Parts House по поводу запчасти" },
      { title: "Связаться с Spool Performance по поводу гарантийной претензии" }
    ),
    0
  );
  const client = {
    opsTask: {
      async findMany() {
        return [
          { id: "task_ceika0001", number: 1006, title: "Уточнить сроки по пневме CEIKA", tags: [] },
          { id: "task_other0001", number: 1020, title: "Рассчитать шины Vitour", tags: [] },
        ];
      },
    },
  } as unknown as PrismaClient;
  const duplicate = await findOpsDuplicateTask({
    client,
    task: { id: "task_new00001", title: "уточнить сроки пневмы CEIKA", tags: [] },
    now: NOW,
  });
  assert.equal(duplicate?.number, 1006);
});

test("the person who handled similar tasks is suggested first", async () => {
  const client = {
    opsTask: {
      async findMany() {
        return [
          {
            title: "Заказать Akrapovic для BMW M3",
            tags: ["brand:Akrapovic"],
            assigneeId: "igor_12345678",
            assignees: [],
          },
          {
            title: "Узнать сроки Akrapovic Evolution",
            tags: ["brand:Akrapovic"],
            assigneeId: "igor_12345678",
            assignees: [],
          },
          { title: "Рассчитать шины Vitour", tags: [], assigneeId: "denis_1234567", assignees: [] },
        ];
      },
    },
  } as unknown as PrismaClient;
  const suggestion = await suggestOpsAssignee({
    client,
    task: {
      id: "task_new00001",
      title: "Проверить наличие Akrapovic для BMW M4",
      tags: ["brand:Akrapovic"],
    },
    now: NOW,
  });
  assert.equal(suggestion?.adminUserId, "igor_12345678");
});

test("shop orders: paid-not-shipped and unpaid orders become tasks once and close themselves", async () => {
  assert.equal(
    isOpsShopTaskResolved("paid-not-shipped", {
      status: OrderStatus.CONFIRMED,
      paymentStatus: "PAID",
      ttnNumber: "20450000000000",
      shipments: 0,
    }),
    true
  );
  assert.equal(
    isOpsShopTaskResolved("unpaid", {
      status: OrderStatus.PENDING_PAYMENT,
      paymentStatus: "PENDING",
      ttnNumber: null,
      shipments: 0,
    }),
    false
  );
  const order = {
    id: "order_paid0001",
    orderNumber: "OC-2026-00029",
    customerName: "Клиент",
    phone: null,
    total: 12500,
    currency: "UAH",
    paymentMethod: "MONOBANK",
    createdAt: kyiv("2026-09-25T12:00:00"),
  };
  const draft = buildOpsShopTaskDraft("paid-not-shipped", order as never);
  assert.match(draft.title, /Отправить заказ OC-2026-00029: оплачен, ТТН нет/);
  assert.equal(draft.priority, "HIGH");

  const tasks: Array<Record<string, unknown>> = [];
  const orderQueries: Array<Record<string, unknown>> = [];
  const client = {
    adminUser: {
      async findFirst() {
        return { id: "owner_1234567" };
      },
    },
    opsTask: {
      async findMany({ where }: { where: Record<string, unknown> }) {
        if ("sourceType" in where) return [];
        return tasks.map((task) => ({ sourceKey: task.sourceKey }));
      },
      async create({ data }: { data: Record<string, unknown> }) {
        tasks.push(data);
        return { id: `task_shop000${tasks.length}` };
      },
    },
    opsTaskEvent: {
      async create() {
        return {};
      },
    },
    shopOrder: {
      async findMany({ where }: { where: Record<string, unknown> }) {
        orderQueries.push(where);
        return where.paymentStatus === "PAID" ? [order] : [];
      },
    },
    async $transaction(run: (tx: unknown) => Promise<unknown>) {
      return run(client);
    },
  } as unknown as PrismaClient;
  const now = kyiv("2026-10-13T11:00:00");
  assert.deepEqual(await syncOpsShopOrderTasks({ client, now, env: {} }), {
    created: 1,
    resolved: 0,
    disabled: false,
  });
  assert.equal(tasks[0].sourceKey, opsShopTaskSourceKey("order_paid0001", "paid-not-shipped"));
  assert.equal((tasks[0].dueAt as Date).toISOString(), kyiv("2026-10-13T18:00:00").toISOString());
  assert.deepEqual(tasks[0].tags, ["process:order", "source:shop"]);
  const unpaidWindow = orderQueries.find((where) => where.paymentStatus !== "PAID")!.createdAt as {
    gte: Date;
    lte: Date;
  };
  assert.equal(
    (now.getTime() - unpaidWindow.gte.getTime()) / 86_400_000,
    10,
    "older unpaid orders are never flooded in"
  );
  assert.deepEqual(await syncOpsShopOrderTasks({ client, now, env: {} }), {
    created: 0,
    resolved: 0,
    disabled: false,
  });
  assert.equal(
    (await syncOpsShopOrderTasks({ client, now, env: { OPS_SHOP_TASKS_ENABLED: "false" } }))
      .disabled,
    true
  );
});

test("the morning digest lists new shop tasks once with «🙋 Беру»", async () => {
  const task = (id: string, number: number, title: string): OpsReminderTask => ({
    id,
    number,
    externalId: `ONE-${number}`,
    title,
    dueAt: null,
  });
  const digest = await buildOpsMorningDigest({
    today: [],
    yesterday: [],
    shop: [task("task_shop0001", 1029, "Отправить заказ OC-2026-00029: оплачен, ТТН нет")],
    olderOverdueCount: 0,
    timeZone: "Europe/Kyiv",
    now: NOW,
    tasksUrl: "https://onecompany.global/admin/operations/tasks?mine=1",
    miniAppUrl: "https://onecompany.global/ops-app",
    button: async (action, taskId, text) => ({ text, callback_data: `${action}:${taskId}` }),
  });
  assert.ok(digest);
  assert.match(digest.text, /🛒 Из магазина, никто не взял:\n1\. #1029/);
  const rows = digest.replyMarkup!.inline_keyboard;
  assert.deepEqual(rows[0], [{ text: "🙋 1. Беру", callback_data: "take:task_shop0001" }]);
  assert.deepEqual(
    rows.at(-1)!.map((button) => button.text),
    ["📋 Все мои задачи", "📱 Мой день"]
  );
});

test("owner reports: weekly summary numbers and a once-a-day failure alert", async () => {
  const { buildOpsWeeklySummary, buildOpsSystemAlert, opsGetsOwnerReports } = await ownerModule;
  const owner = [{ role: { key: "owner", permissions: [] } }];
  assert.equal(
    opsGetsOwnerReports({ roles: owner, lastLoginAt: kyiv("2026-10-12T10:00:00"), now: NOW }),
    true
  );
  assert.equal(
    opsGetsOwnerReports({ roles: owner, lastLoginAt: kyiv("2026-07-22T10:00:00"), now: NOW }),
    false,
    "owners who stopped using the admin are not messaged"
  );
  assert.equal(
    opsGetsOwnerReports({
      roles: [{ role: { key: "task_member", permissions: [] } }],
      lastLoginAt: NOW,
      now: NOW,
    }),
    false
  );
  const client = {
    opsTask: {
      async findMany({ where }: { where: Record<string, unknown> }) {
        if (where.status === "DONE") {
          return [
            { assignee: { name: "Igor Semynozhenko", email: "i@x" }, assignees: [] },
            { assignee: { name: "Igor Semynozhenko", email: "i@x" }, assignees: [] },
            { assignee: null, assignees: [{ adminUser: { name: "Denis Gubanov", email: "d@x" } }] },
          ];
        }
        return [
          { sourceType: "TELEGRAM", sourceKey: "telegram:1:task:0" },
          { sourceType: "AUTOMATION", sourceKey: "shop:order:o1:unpaid" },
        ];
      },
      async count() {
        return 2;
      },
    },
  } as unknown as PrismaClient;
  const summary = await buildOpsWeeklySummary({
    client,
    now: NOW,
    timeZone: "Europe/Kyiv",
    triageUrl: "https://onecompany.global/admin/operations/triage",
    miniAppUrl: null,
  });
  assert.ok(summary);
  assert.match(summary.text, /✅ Закрыто: 3 — Igor 2, Denis 1/);
  assert.match(summary.text, /🆕 Новых: 2 \(из Telegram 1, из магазина 1\)/);
  assert.equal(summary.replyMarkup!.inline_keyboard[0][0].text, "🗂 Разобрать (4)");

  const alert = await buildOpsSystemAlert({
    client: {
      opsJob: {
        async findMany() {
          return [
            { type: "telegram_intake", stage: "DOWNLOAD_MEDIA" },
            { type: "telegram_internal_report", stage: "NOTIFY" },
            { type: "telegram_task_reminder", stage: "NOTIFY" },
          ];
        },
      },
    } as unknown as PrismaClient,
    since: new Date(NOW.getTime() - 86_400_000),
    systemUrl: "https://onecompany.global/admin/operations/system",
  });
  assert.match(alert!.text, /3 сбоя за последние сутки/);
  assert.match(alert!.text, /• Загрузка файла — 1/);
  assert.match(alert!.text, /• Отправка в Telegram — 2/);
});

test("knowledge questions are answered from articles, with a plain fallback without AI", async () => {
  const { answerOpsKnowledgeQuestion, opsKnowledgeQuestionTerms } = await knowledgeModule;
  assert.deepEqual(opsKnowledgeQuestionTerms("Какая доставка из Великобритании?"), [
    "достав",
    "великобритан",
  ]);
  const client = {
    opsKnowledgeArticle: {
      async findMany() {
        return [
          {
            id: "kb_medyka0001",
            title: "Доставка из Великобритании через Medyka",
            searchText: "доставка великобритания medyka",
            contentMarkdown: "Срок 7–10 дней. Подтвердите цену перед предложением клиенту.",
            brandKey: null,
          },
        ];
      },
    },
    opsUsageBucket: {
      async upsert() {
        return { id: "bucket", costMicros: BigInt(0), hardStopMicros: BigInt(2_000_000) };
      },
      async update() {
        return {};
      },
    },
    async $transaction(run: (tx: unknown) => Promise<unknown>) {
      return run(client);
    },
  } as unknown as PrismaClient;
  const answered = await answerOpsKnowledgeQuestion({
    client,
    question: "доставка из Великобритании",
    provider: {
      async extract() {
        throw new Error("unused");
      },
      async transcribe() {
        throw new Error("unused");
      },
      async answer() {
        return {
          value: { found: true, answer: "Через Medyka, 7–10 дней.", source_ids: ["kb_medyka0001"] },
          usage: { inputTokens: 100, outputTokens: 20 },
        };
      },
    },
  });
  assert.match(answered.text, /^💡 Через Medyka, 7–10 дней\./);
  assert.match(answered.text, /Источник: «Доставка из Великобритании через Medyka»/);
  assert.equal(answered.aiUsed, true);

  const previousKey = process.env.OPS_GEMINI_API_KEY;
  delete process.env.OPS_GEMINI_API_KEY;
  try {
    const fallback = await answerOpsKnowledgeQuestion({
      client,
      question: "доставка из Великобритании",
    });
    assert.match(fallback.text, /Вот что есть в базе/);
    assert.equal(fallback.aiUsed, false);
  } finally {
    if (previousKey !== undefined) process.env.OPS_GEMINI_API_KEY = previousKey;
  }
});

test("menu commands answer from the webhook; strangers get silence", async () => {
  const { handleOpsTelegramBotUpdate } = await botModule;
  const updates: unknown[] = [];
  const member = {
    timezone: "Europe/Kyiv",
    adminUser: {
      id: "admin_12345678",
      name: "Olexandr Tsompel",
      email: "o@x",
      roles: [{ role: { key: "owner", permissions: [] } }],
    },
  };
  const client = (linked: boolean) =>
    ({
      opsMemberProfile: {
        async findFirst() {
          return linked ? member : null;
        },
      },
      requestRateLimit: {
        async upsert() {
          return { count: 1 };
        },
      },
      opsTelegramUpdate: {
        async create({ data }: { data: unknown }) {
          updates.push(data);
          return { id: "upd" };
        },
      },
      opsTask: {
        async findMany() {
          return [];
        },
        async count() {
          return 0;
        },
      },
    }) as unknown as PrismaClient;
  const message = (text: string, id = 1) => ({
    update_id: 900 + id,
    message: { message_id: id, from: { id: 7001 }, chat: { id: 7001, type: "private" }, text },
  });
  const { normalizeOpsTelegramUpdate } = await import("../../../src/lib/operations/telegram");
  const handled = await handleOpsTelegramBotUpdate({
    client: client(true),
    rawUpdate: message("📌 Сегодня"),
    update: normalizeOpsTelegramUpdate(message("📌 Сегодня")),
    now: NOW,
  });
  assert.equal((handled?.body as { method: string }).method, "sendMessage");
  assert.match((handled?.body as { text: string }).text, /На сегодня ничего не горит/);
  assert.equal(updates.length, 1, "the update is recorded so a returning member un-pauses");

  const start = await handleOpsTelegramBotUpdate({
    client: client(true),
    rawUpdate: message("/start", 2),
    update: normalizeOpsTelegramUpdate(message("/start", 2)),
    now: NOW,
  });
  const body = start?.body as { text: string; reply_markup: { keyboard: unknown[][] } };
  assert.match(body.text, /^👋 Olexandr/);
  assert.doesNotMatch(body.text, /@/, "no inline mode / @-mentions any more");
  assert.equal(
    body.reply_markup.keyboard.length,
    4,
    "today/mine, new/ask, product/order/prices, «Мой день»"
  );
  assert.deepEqual(
    body.reply_markup.keyboard[2],
    [{ text: "🔎 Товар" }, { text: "📦 Заказ" }, { text: "💰 Цены" }],
    "the owner also gets «💰 Цены»"
  );
  assert.deepEqual(
    body.reply_markup.keyboard[3],
    [{ text: "📱 Мой день" }],
    "keyboard web apps get no signed init data, so this is a plain button"
  );
  assert.ok(start?.menuButtonChatId, "/start also puts «Мой день» on the chat menu button");
  assert.deepEqual(start?.commands, { chatId: BigInt(7001), owner: true }, "and sets the «/» list");

  const app = await handleOpsTelegramBotUpdate({
    client: client(true),
    rawUpdate: message("📱 Мой день", 5),
    update: normalizeOpsTelegramUpdate(message("📱 Мой день", 5)),
    now: NOW,
  });
  const appMarkup = (
    app?.body as { reply_markup: { inline_keyboard: Array<Array<Record<string, unknown>>> } }
  ).reply_markup.inline_keyboard;
  assert.deepEqual(appMarkup[0][0].web_app, { url: "https://onecompany.global/ops-app" });

  const stranger = await handleOpsTelegramBotUpdate({
    client: client(false),
    rawUpdate: message("/start", 3),
    update: normalizeOpsTelegramUpdate(message("/start", 3)),
    now: NOW,
  });
  assert.deepEqual(stranger?.body, { ok: true });

  assert.equal(
    await handleOpsTelegramBotUpdate({
      client: client(true),
      rawUpdate: message("Купить фильтр для BMW", 4),
      update: normalizeOpsTelegramUpdate(message("Купить фильтр для BMW", 4)),
      now: NOW,
    }),
    null,
    "ordinary messages still become tasks through the pipeline"
  );
});
