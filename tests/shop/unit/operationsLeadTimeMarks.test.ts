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

const marksModule = import("../../../src/lib/operations/leadTimeMarks");

const owner = {
  id: "owner-000000001",
  email: "owner@onecompany.global",
  name: "Owner",
  permissions: ["*"],
  roleKeys: ["owner"],
};
const manager = { ...owner, id: "manager-0000001", roleKeys: ["manager"] };
const buttons = async (_action: string, resourceId: string, label: string) => ({
  text: label,
  callback_data: `cb:${resourceId}`,
});

const display = (availability: "inStock" | "preOrder") => [
  {
    namespace: "onecompany",
    key: "storefront_display",
    value: JSON.stringify({
      availability,
      showInStock: availability === "inStock",
      showInCarousel: false,
    }),
  },
];

function product(
  sku: string,
  extra: { leadTimeUa?: string | null; availability?: "inStock" | "preOrder" } = {}
) {
  return {
    id: `p-${sku}`,
    sku,
    slug: sku.toLowerCase(),
    titleEn: `Brabus ${sku}`,
    titleUa: "",
    leadTimeUa: extra.leadTimeUa ?? null,
    leadTimeEn: null,
    variants: [{ sku }],
    metafields: display(extra.availability ?? "preOrder"),
  };
}

const RUNS = [
  {
    sourceKey: "brabus",
    findings: [
      { kind: "sold_out", sku: "A-1" },
      // Of a product with two variants only one is sold out: its lead time stays.
      { kind: "sold_out", sku: "V-1-S" },
      { kind: "gone", sku: "A-2" },
      { kind: "sold_out", sku: "A-3" },
      { kind: "sold_out", sku: "A-4" },
      { kind: "cheaper", sku: "A-5" },
      { kind: "sold_out", sku: "M-3" },
    ],
  },
  // A competitor's sold-out item says nothing about the manufacturer.
  { sourceKey: "competitor-adrenalin", findings: [{ kind: "sold_out", sku: "A-6" }] },
];

function planClient() {
  const out = [
    product("A-1"),
    product("A-2"),
    product("A-3", { availability: "inStock" }),
    product("A-4", { leadTimeUa: "4–6 тижнів" }),
    product("A-6"),
    { ...product("V-1"), variants: [{ sku: "V-1-S" }, { sku: "V-1-L" }] },
  ];
  const marked = [
    product("M-1", { leadTimeUa: "Уточнюйте у менеджера" }),
    product("M-2", { leadTimeUa: "Уточнюйте у менеджера" }),
    product("M-3", { leadTimeUa: "Уточнюйте у менеджера" }),
  ];
  return {
    shopProduct: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        if ("leadTimeUa" in where) return marked;
        const wanted = JSON.stringify(where).toLowerCase();
        return out.filter((entry) =>
          [entry.sku, ...entry.variants.map((variant) => variant.sku)].some((sku) =>
            wanted.includes(`"${sku.toLowerCase()}"`)
          )
        );
      },
    },
    opsSupplierItem: {
      findMany: async () => [
        { productId: "p-M-1", sourceKey: "brabus" },
        { productId: "p-M-2", sourceKey: "competitor-adrenalin" },
        { productId: "p-M-3", sourceKey: "brabus" },
      ],
    },
  } as unknown as PrismaClient;
}

test("the plan: sold out or gone at the manufacturer, on order with the usual lead time", async () => {
  const { planLeadTimeMarks, leadTimeDigestLines, leadTimeButtonLabels } = await marksModule;
  const plan = await planLeadTimeMarks(planClient(), RUNS);
  assert.deepEqual(
    plan.mark.map((item) => item.sku),
    ["A-1"],
    "gone from the supplier's site (A-2) is for a person to check; our own stock (A-3) and a lead time set by hand (A-4) stay; a competitor proves nothing (A-6)"
  );
  assert.deepEqual(
    plan.clear.map((item) => item.sku),
    ["M-1"],
    "back only by the manufacturer's own check (not M-2's competitor), and not sold out again (M-3)"
  );
  const lines = leadTimeDigestLines(plan);
  assert.match(
    lines[0],
    /^🕓 Закончились у производителя, а на сайте «под заказ ≈ 3 недели»: 1 — A-1$/
  );
  assert.match(lines[1], /^🔄 Снова есть у производителя, а на сайте «срок уточняйте»: 1 — M-1$/);
  assert.deepEqual(leadTimeButtonLabels(plan), {
    mark: "🕓 Срок «уточняйте у менеджера» (1)",
    clear: "🔄 Вернуть обычный срок (1)",
  });
  assert.deepEqual(leadTimeDigestLines({ mark: [], clear: [] }), []);
});

function writeClient(state: Map<string, { leadTimeUa: string | null; leadTimeEn: string | null }>) {
  const changes: Array<Record<string, unknown>> = [];
  const audit: Array<Record<string, unknown>> = [];
  const tx = {
    shopProduct: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const current = state.get(where.id);
        return current
          ? { slug: where.id, brand: "Brabus", vendor: null, tags: [], ...current }
          : null;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { leadTimeUa: string | null; leadTimeEn: string | null };
      }) => {
        state.set(where.id, { leadTimeUa: data.leadTimeUa, leadTimeEn: data.leadTimeEn });
        return {};
      },
    },
    adminUser: { findUnique: async () => ({ id: owner.id }) },
    adminAuditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        audit.push(data);
        return data;
      },
    },
  };
  const published: number[] = [];
  const writer = {
    mutate: async (
      _client: unknown,
      input: { mutateAndSnapshot: (tx: unknown, version: string) => Promise<unknown> }
    ) => input.mutateAndSnapshot(tx, "2"),
    snapshot: async () => ({}),
    patchVariant: async () => undefined,
    publish: async (count: number) => published.push(count),
    revalidate: () => undefined,
  };
  const client = {
    opsPriceChange: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `chg-${String(changes.length + 1).padStart(10, "0")}`, ...data };
        changes.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        changes.find((row) => row.id === where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = changes.find((entry) => entry.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
    },
  } as unknown as PrismaClient;
  return { client, writer: writer as never, changes, audit, published };
}

test("an owner sets «уточняйте у менеджера», a lead time set meanwhile stays, undo puts it back", async () => {
  const { applyLeadTimeMarks, undoLeadTimeMarks } = await marksModule;
  const state = new Map([
    ["p-A-1", { leadTimeUa: null, leadTimeEn: null }],
    // Somebody typed a lead time after the digest was sent.
    ["p-A-2", { leadTimeUa: "8 тижнів", leadTimeEn: null }],
  ]);
  const { client, writer, changes, audit, published } = writeClient(state);
  const plan = {
    mark: [
      { productId: "p-A-1", sku: "A-1", title: "Brabus A-1" },
      { productId: "p-A-2", sku: "A-2", title: "Brabus A-2" },
    ],
    clear: [],
  };
  await assert.rejects(
    applyLeadTimeMarks({
      client,
      actor: manager,
      mode: "mark",
      plan,
      telegramChatId: null,
      button: buttons as never,
      writer,
    }),
    /TELEGRAM_ACTION_FORBIDDEN/
  );
  const done = await applyLeadTimeMarks({
    client,
    actor: owner,
    mode: "mark",
    plan,
    telegramChatId: null,
    button: buttons as never,
    writer,
  });
  assert.deepEqual(state.get("p-A-1"), {
    leadTimeUa: "Уточнюйте у менеджера",
    leadTimeEn: "On request",
  });
  assert.deepEqual(state.get("p-A-2"), { leadTimeUa: "8 тижнів", leadTimeEn: null });
  assert.equal(changes[0].origin, "lead_time");
  assert.equal(changes[0].status, "applied");
  assert.equal(changes[0].appliedCount, 1);
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, "lead_time.telegram");
  assert.deepEqual(published, [1]);
  const text = String(done.reply?.text);
  assert.match(text, /🕓 На сайте теперь «срок уточняйте у менеджера»: 1 товар/);
  assert.match(text, /• A-1/);
  assert.match(text, /Пропущено 1: срок уже поменяли вручную\./);
  assert.ok(done.reply?.replyMarkup?.inline_keyboard.flat().some((b) => b.text === "↩️ Отменить"));

  const undone = await undoLeadTimeMarks({
    client,
    actor: owner,
    changeId: String(changes[0].id),
    writer,
  });
  assert.deepEqual(state.get("p-A-1"), { leadTimeUa: null, leadTimeEn: null });
  assert.deepEqual(state.get("p-A-2"), { leadTimeUa: "8 тижнів", leadTimeEn: null });
  assert.equal(changes[0].status, "undone");
  assert.match(String(undone.reply?.text), /↩️ Сроки вернул как было: 1 товар/);
  await assert.rejects(
    undoLeadTimeMarks({ client, actor: owner, changeId: String(changes[0].id), writer }),
    /CALLBACK_RESOURCE_NOT_FOUND/,
    "undo works once"
  );
});

test("nothing to change, and more than one press worth", async () => {
  const { applyLeadTimeMarks, LEAD_TIME_MARKS_PER_PRESS } = await marksModule;
  const { client, writer } = writeClient(new Map());
  const none = await applyLeadTimeMarks({
    client,
    actor: owner,
    mode: "clear",
    plan: { mark: [], clear: [] },
    telegramChatId: null,
    button: buttons as never,
    writer,
  });
  assert.equal(none.message, "Менять уже нечего — сроки актуальны.");

  const many = Array.from({ length: LEAD_TIME_MARKS_PER_PRESS + 3 }, (_, index) => ({
    productId: `p-B-${index}`,
    sku: `B-${index}`,
    title: `Brabus B-${index}`,
  }));
  const state = new Map(
    many.map((item) => [item.productId, { leadTimeUa: "Уточнюйте у менеджера", leadTimeEn: null }])
  );
  const bulk = writeClient(state);
  const reply = await applyLeadTimeMarks({
    client: bulk.client,
    actor: owner,
    mode: "clear",
    plan: { mark: [], clear: many },
    telegramChatId: null,
    button: buttons as never,
    writer: bulk.writer,
  });
  const text = String(reply.reply?.text);
  // One press: as many as a price change applies inline (20), the list folded after 12.
  assert.match(text, /🔄 На сайте снова обычный срок: 20 товаров/);
  assert.match(text, /…и ещё 8/);
  assert.match(text, /Осталось 3 — нажмите кнопку в отчёте ещё раз\./);
  assert.equal(
    [...state.values()].filter((value) => value.leadTimeUa === null).length,
    LEAD_TIME_MARKS_PER_PRESS
  );
});
