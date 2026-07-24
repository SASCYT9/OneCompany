import { OpsKnowledgeStatus, OpsTaskEventType } from "@prisma/client";
import { config as loadEnv } from "dotenv";

import {
  OPS_FORGED_WHEEL_SHIPPING_ESTIMATES,
  OPS_SHIPPING_REFERENCE_SLUG,
  OPS_USA_UA_SHIPPING_ESTIMATES,
} from "../src/data/operations/shipping-guides";

if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  loadEnv({ path: ".env.ops-lab.local", override: true });
}
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

function buildContent() {
  const rows = OPS_USA_UA_SHIPPING_ESTIMATES.map(
    (estimate) => `| ${estimate.label} | ≈ $${estimate.amountUsd} |`
  ).join("\n");
  const wheelRows = OPS_FORGED_WHEEL_SHIPPING_ESTIMATES.map(
    (estimate) => `| ${estimate.size} | ≈ $${estimate.amountUsd} |`
  ).join("\n");
  return `# Ориентиры доставки товаров

> Это рабочие ориентиры из проверенного legacy-источника, а не финальный тариф. Перед предложением клиенту подтвердите маршрут, вес/объём, локальную доставку, страховку и актуальную ставку.

## США → Украина: кузовные детали

| Категория | Исторический ориентир |
| --- | ---: |
${rows}

## Кованые диски

| Размер | Ориентир доставки комплекта |
| --- | ---: |
${wheelRows}

## Другие найденные ориентиры

| Маршрут / случай | Ориентир |
| --- | --- |
| Китай → Киев | $18/кг; при отправлении 10+ кг — $10/кг; срок 3–4 недели |
| Do88 → Medyka | 20–55 EUR в зависимости от размера |
| Akrapovic downpipes, Польша → Кипр | около $220 через Новую почту |
| FI Exhaust | обычно +1000–1200 USD на доставку и растаможку; для pipes в источнике встречается +500 USD логистики |
| Armytrix | DHL 600–800 USD; рабочий общий ориентир в источнике — +1100 USD |
| IPE | +1500–1600 USD; более медленный вариант около +800 USD, на 7–10 дней дольше |

## Что проверить

1. Страну и склад отправления.
2. Локальную доставку до склада/форвардера.
3. Фактический и объёмный вес.
4. Количество коробок и размеры.
5. VAT/tax, страховку, пошлину и срок.
6. Не включена ли доставка уже в checkout total.

Финальную стоимость нельзя выдавать автоматически только по этой таблице.`;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { prisma } = await import("../src/lib/prisma");
  const { buildKnowledgeSearchText } = await import("../src/lib/operations/knowledge");
  const existing = await prisma.opsKnowledgeArticle.findUnique({
    where: { slug: OPS_SHIPPING_REFERENCE_SLUG },
    select: { id: true },
  });
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const author = await prisma.adminUser.findFirst({
    where: { isActive: true, ...(email ? { email } : {}) },
    select: { id: true, email: true, name: true },
  });
  if (!author) throw new Error("Active admin was not found");

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        article: existing ? "exists" : "create",
        estimates: OPS_USA_UA_SHIPPING_ESTIMATES.length,
      },
      null,
      2
    )
  );
  if (!apply) {
    await prisma.$disconnect();
    return;
  }

  const contentMarkdown = buildContent();
  const title = "Ориентиры доставки товаров";
  const excerpt =
    "Удобная таблица исторических ориентиров доставки по типам товаров и маршрутам. Все суммы требуют актуальной проверки.";
  const tags = [
    "shipping-reference",
    "products",
    "delivery-estimates",
    "source-import",
    "needs-current-check",
  ];
  const articleId =
    existing?.id ??
    (
      await prisma.$transaction(async (tx) => {
        const article = await tx.opsKnowledgeArticle.create({
          data: {
            slug: OPS_SHIPPING_REFERENCE_SLUG,
            title,
            excerpt,
            contentMarkdown,
            locale: "ru",
            category: "delivery",
            tags,
            searchText: buildKnowledgeSearchText({
              title,
              excerpt,
              contentMarkdown,
              category: "delivery",
              brandKey: null,
              tags,
            }),
            status: OpsKnowledgeStatus.PUBLISHED,
            authorId: author.id,
            publishedById: author.id,
            publishedRevision: 1,
            publishedAt: new Date(),
            revisions: {
              create: {
                revision: 1,
                status: OpsKnowledgeStatus.PUBLISHED,
                title,
                excerpt,
                contentMarkdown,
                locale: "ru",
                category: "delivery",
                tags,
                changeNote: "Импорт безопасных ориентиров доставки v1",
                changedById: author.id,
              },
            },
          },
          select: { id: true },
        });
        await tx.adminAuditLog.create({
          data: {
            actorId: author.id,
            actorEmail: author.email,
            actorName: author.name,
            scope: "operations",
            action: "knowledge.shipping_reference_import",
            entityType: "ops.knowledge",
            entityId: article.id,
            metadata: { estimates: OPS_USA_UA_SHIPPING_ESTIMATES.length },
          },
        });
        return article;
      })
    ).id;

  const { linkMatchingBrandGuides } = await import("../src/lib/operations/brandGuides");
  const tasks = await prisma.opsTask.findMany({
    where: { archivedAt: null },
    select: { id: true, title: true, description: true, nextAction: true },
  });
  let linkedTasks = 0;
  for (const task of tasks) {
    await prisma.$transaction(async (tx) => {
      const linked = await linkMatchingBrandGuides(tx, {
        taskId: task.id,
        texts: [task.title, task.description, task.nextAction],
      });
      if (!linked.shippingArticles.some((article) => article.id === articleId)) return;
      if (!linked.createdCount) return;
      linkedTasks += 1;
      await tx.opsTaskEvent.create({
        data: {
          taskId: task.id,
          type: OpsTaskEventType.UPDATED,
          actorId: author.id,
          idempotencyKey: `shipping-reference-backfill-v1:${task.id}`,
          payload: {
            action: "shipping_reference_linked",
            automatic: true,
            shippingEstimateKeys: linked.shippingEstimates.map((estimate) => estimate.key),
          },
        },
      });
    });
  }
  console.log(JSON.stringify({ scannedTasks: tasks.length, linkedTasks }, null, 2));
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
