import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import type { PrismaClient } from "@prisma/client";

import { registerHooks } from "./testHooks.mjs";
import {
  applyUsaFormulaGuideSection,
  applyUsaLogisticsRoutePatch,
  applyUsaShippingTableNote,
} from "../../../src/lib/operations/knowledgeDataPatches";
import {
  answerOpsUsaPriceQuestion,
  applyOpsUsaFormulaToBrandGuide,
  calculateOpsUsaPrice,
} from "../../../src/lib/operations/usaPricing";

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

test("the agreed US example: ($1,000 + $50) × 1.20 + $9 × 10 kg = $1,350", () => {
  assert.deepEqual(calculateOpsUsaPrice({ itemUsd: 1000, usShippingUsd: 50, weightKg: 10 }), {
    itemUsd: 1000,
    usShippingUsd: 50,
    weightKg: 10,
    markupUsd: 210,
    deliveryUsd: 90,
    totalUsd: 1350,
  });
});

test("«? США …» questions are calculated without AI, in any reasonable wording", () => {
  for (const question of [
    "США 1000 + 50 доставка, 10 кг",
    "сша: товар $1,000, доставка 50, вес 10 кг",
    "США доставка 50, товар 1000, 10кг",
    "США 1000 + 50 до Brooklyn 11223, 10 кг",
  ]) {
    const answer = answerOpsUsaPriceQuestion(question);
    assert.ok(answer, question);
    assert.match(answer, /Наценка 20%: \$210/, question);
    assert.match(answer, /Доставка в Киев 10 кг × \$9: \$90/, question);
    assert.match(answer, /Итого: \$1,350/, question);
  }
  const decimals = answerOpsUsaPriceQuestion("сша 1 000 + 40, 12,5 кг")!;
  assert.match(decimals, /Итого: \$1,360\.50/, "(1 040 × 1.2) + 12.5 × 9");

  const noShipping = answerOpsUsaPriceQuestion("США 1000, 10 кг")!;
  assert.match(noShipping, /Итого: \$1,290/);
  assert.match(noShipping, /Доставку по США не указали — посчитал \$0/);

  assert.match(answerOpsUsaPriceQuestion("США 1000")!, /нужен ещё вес в кг/);
  assert.match(
    answerOpsUsaPriceQuestion("формула США")!,
    /\(Цена товара \+ доставка по США\) × 1,20 \+ \$9 × вес \(кг\)/
  );
  assert.equal(answerOpsUsaPriceQuestion("доставка из Великобритании"), null);
});

test("the bot answers US prices instantly from the webhook", async () => {
  const { handleOpsTelegramBotUpdate } = await botModule;
  const { normalizeOpsTelegramUpdate } = await import("../../../src/lib/operations/telegram");
  const client = {
    opsMemberProfile: {
      async findFirst() {
        return {
          timezone: "Europe/Kyiv",
          adminUser: {
            id: "admin_12345678",
            name: "Olexandr Tsompel",
            email: "o@x",
            roles: [{ role: { key: "owner", permissions: [] } }],
          },
        };
      },
    },
    requestRateLimit: {
      async upsert() {
        return { count: 1 };
      },
    },
    opsTelegramUpdate: {
      async create() {
        return { id: "upd" };
      },
    },
  } as unknown as PrismaClient;
  const raw = {
    update_id: 990,
    message: {
      message_id: 7,
      from: { id: 7001 },
      chat: { id: 7001, type: "private" },
      text: "? США 1000 + 50 доставка, 10 кг",
    },
  };
  const handled = await handleOpsTelegramBotUpdate({
    client,
    rawUpdate: raw,
    update: normalizeOpsTelegramUpdate(raw),
  });
  const body = handled?.body as { method: string; text: string };
  assert.equal(body.method, "sendMessage");
  assert.match(body.text, /Итого: \$1,350/);
});

test("US brand guides switch to the general formula and keep the old rule as history", () => {
  const guide = `# American Racing Headers

> Правило найдено в старом рабочем источнике. Перед расчётом проверьте актуальность цены, скидки, VAT/tax и доставки.

## Карточка бренда

| Поле | Значение |
| --- | --- |
| Группа | США |
| Страна | USA |
| Статус формулы | Есть исходное правило — требуется контроль |
| Источник | onecompany.global |

## Формула и условия

| Тип | Правило |
| --- | --- |
| Розница | Сайт +10% + shipping до NY + вага в Україну |
| Опт / партнёр | Сайт/наша ціна + shipping до NY + вага в Україну +10% |
| Наша закупка | Не указано |
| Логистика | Не указано |

## Следующее действие

Use verified pricing rule; still verify price, shipping, VAT/tax, and availability per order.
`;
  const next = applyOpsUsaFormulaToBrandGuide(guide);
  assert.match(next, /^> С 03\.09\.2026 для товаров из США действует общая формула/m);
  assert.match(next, /\| Статус формулы \| Общая формула США \(03\.09\.2026\) \|/);
  assert.match(
    next,
    /\| Розница \| \(Цена товара \+ доставка по США\) × 1,20 \+ \$9 × вес \(кг\)\. Было до 03\.09\.2026: Сайт \+10% \+ shipping до NY \+ вага в Україну \|/
  );
  assert.match(
    next,
    /\| Опт \/ партнёр \| Сайт\/наша ціна \+ shipping до NY/,
    "partner rule untouched"
  );
  assert.match(next, /\| Логистика \| По США — до Brooklyn, NY 11223; США → Киев — \$9\/кг \|/);
  assert.match(next, /В боте: «\? США 1000 \+ 50 доставка, 10 кг»/);
  assert.equal(applyOpsUsaFormulaToBrandGuide(next), next, "applying twice changes nothing");
  assert.equal(
    applyOpsUsaFormulaToBrandGuide(guide.replace("| Группа | США |", "| Группа | Европа |")),
    guide.replace("| Группа | США |", "| Группа | Европа |"),
    "European brands are not touched"
  );
});

test("logistics references move from ~$11/kg to the agreed $9/kg", () => {
  const routes =
    "| США → Украина | Ориентир 11 USD/кг | Перевозчика, объёмный вес и категорийный тариф для кузовных деталей |";
  const patched = applyUsaLogisticsRoutePatch(routes);
  assert.equal(
    patched,
    "| США → Украина | $9/кг до Киева — формула США с 03.09.2026; по США — до Brooklyn, NY 11223 (было: Ориентир 11 USD/кг) | Перевозчика, объёмный вес и категорийный тариф для кузовных деталей |"
  );
  assert.equal(applyUsaLogisticsRoutePatch(patched), patched);

  const table = "## США → Украина: кузовные детали\n\n| Категория | Исторический ориентир |\n";
  const noted = applyUsaShippingTableNote(table);
  assert.match(noted, /С 03\.09\.2026 доставку США → Киев считаем по \$9\/кг/);
  assert.equal(applyUsaShippingTableNote(noted), noted);

  const guide = applyUsaFormulaGuideSection("# Как читать внутренние формулы цен\n");
  assert.match(guide, /## США\n\nДля товаров из США с 03\.09\.2026 действует общая формула/);
  assert.equal(applyUsaFormulaGuideSection(guide), guide);
});

test("US suppliers filed under another group switch too; CT Carbon and Maxton get the bot's formula", async () => {
  const { applyBotObservedFormulaSection } = await import(
    "../../../src/lib/operations/knowledgeDataPatches"
  );
  const adro = `# ADRO

> Правило найдено в старом рабочем источнике.

| Поле | Значение |
| --- | --- |
| Группа | Европа |
| Статус формулы | Есть исходное правило — требуется контроль |

| Тип | Правило |
| --- | --- |
| Розница | Американський сайт без скидки + 5% + shipping до NY + вага в Україну |
| Логистика | Не указано |
`;
  assert.equal(
    applyOpsUsaFormulaToBrandGuide(adro),
    adro,
    "without forceUsa a European card is kept"
  );
  const forced = applyOpsUsaFormulaToBrandGuide(adro, { forceUsa: true });
  assert.match(forced, /\| Группа \| США \|/);
  assert.match(forced, /Было до 03\.09\.2026: Американський сайт без скидки \+ 5%/);

  const ct = "# CT Carbon\n\n## Следующее действие\n\nПроверить.\n";
  const withBot = applyBotObservedFormulaSection(ct, "CT Carbon");
  assert.match(
    withBot,
    /## Как считает бот @OneCompany1_bot \(проверено 13\.10\.2026\)\n\nРозница: цена сайта в £ \(с VAT\) × 1,15/
  );
  assert.ok(withBot.indexOf("## Как считает бот") < withBot.indexOf("## Следующее действие"));
  assert.equal(applyBotObservedFormulaSection(withBot, "CT Carbon"), withBot);
  assert.equal(applyBotObservedFormulaSection(ct, "Unknown"), ct);
});

test("knowledge search ranks title matches first instead of an arbitrary slice", async () => {
  const { findOpsKnowledgeForQuestion } = await import(
    "../../../src/lib/operations/knowledgeAnswers"
  );
  const rows = [
    { id: "kb_onecompany1", title: "Что такое One Company" },
    { id: "kb_medyka00001", title: "Доставка из Великобритании через Medyka" },
    { id: "kb_routes00001", title: "Маршруты и ориентиры логистики" },
  ];
  const client = {
    opsKnowledgeArticle: {
      async findMany({ where }: { where: Record<string, unknown> }) {
        if ("id" in where) {
          const ids = (where.id as { in: string[] }).in;
          return rows
            .filter((row) => ids.includes(row.id))
            .map((row) => ({ ...row, contentMarkdown: `# ${row.title}` }));
        }
        if ("AND" in where) return [rows[1], rows[2]];
        return rows;
      },
    },
  } as unknown as PrismaClient;
  const found = await findOpsKnowledgeForQuestion(client, "доставка из Великобритании");
  assert.equal(found[0].title, "Доставка из Великобритании через Medyka");
  assert.equal(found[0].content, "# Доставка из Великобритании через Medyka");
});
