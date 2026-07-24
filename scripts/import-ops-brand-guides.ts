import { OpsKnowledgeStatus, OpsTaskEventType } from "@prisma/client";
import { config as loadEnv } from "dotenv";

import catalogJson from "../src/data/operations/brand-guides.json";
import { operatorFacingReferenceText } from "../src/lib/operations/brandGuides";

if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  loadEnv({ path: ".env.ops-lab.local", override: true });
}
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

type CatalogEntry = (typeof catalogJson.brands)[number];

function groupLabel(value: string) {
  const labels: Record<string, string> = {
    usa: "США",
    europe: "Европа",
    moto: "Мото",
    oem: "OEM",
    racing: "Автоспорт",
    verified_rules: "Общее правило",
    "pdf-only": "Другое",
  };
  return (labels[value] ?? value) || "Не указана";
}

function articleContent(entry: CatalogEntry) {
  const formulaAvailable = Boolean(entry.retailFormula || entry.wholesaleFormula || entry.ourCost);
  const warning = formulaAvailable
    ? "Правило найдено в старом рабочем источнике. Перед расчётом проверьте актуальность цены, скидки, VAT/tax и доставки."
    : "Подтверждённая формула отсутствует. Не рассчитывайте цену автоматически — создайте задачу на проверку правила.";
  const sourceLink = entry.sourceUrl
    ? `[Открыть источник](${entry.sourceUrl})`
    : "Ссылка на источник не указана.";

  return `# ${entry.brand}

> ${warning}

## Карточка бренда

| Поле | Значение |
| --- | --- |
| Группа | ${groupLabel(entry.siteGroup)} |
| Страна | ${entry.country || "Не указана"} |
| Статус формулы | ${formulaAvailable ? "Есть исходное правило — требуется контроль" : "Формула не подтверждена"} |
| Источник | ${entry.source || "Импортированный справочник"} |

## Формула и условия

| Тип | Правило |
| --- | --- |
| Розница | ${operatorFacingReferenceText(entry.retailFormula || "Не указано")} |
| Опт / партнёр | ${operatorFacingReferenceText(entry.wholesaleFormula || "Не указано")} |
| Наша закупка | ${operatorFacingReferenceText(entry.ourCost || "Не указано")} |
| Логистика | ${operatorFacingReferenceText(entry.logisticsRule || "Не указано")} |

${entry.notes ? `## Важные заметки\n\n${operatorFacingReferenceText(entry.notes)}\n\n` : ""}## Следующее действие

${entry.nextAction || "Проверить формулу, источник цены, доставку, VAT/tax и скидку аккаунта."}

## Поиск и источник

- Другие названия: ${entry.aliases.length ? entry.aliases.join(", ") : "не указаны"}.
- Rule key: ${entry.ruleKey || "нет"}.
- ${sourceLink}`;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const imported = await import("../src/lib/prisma");
  const prisma = imported.prisma;
  const { buildKnowledgeSearchText } = await import("../src/lib/operations/knowledge");
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const author = await prisma.adminUser.findFirst({
    where: { isActive: true, ...(email ? { email } : {}) },
    select: { id: true, email: true, name: true },
  });
  if (!author) throw new Error(`Active admin${email ? ` ${email}` : ""} was not found`);

  const slugs = catalogJson.brands.map((entry) => `brand-${entry.guideKey}`);
  const existing = await prisma.opsKnowledgeArticle.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true },
  });
  const existingSlugs = new Set(existing.map((article) => article.slug));
  const pending = catalogJson.brands.filter(
    (entry) => !existingSlugs.has(`brand-${entry.guideKey}`)
  );
  const combinedSource = await prisma.opsKnowledgeArticle.findUnique({
    where: { slug: "top-level-pricing-source-review" },
    select: { id: true, archivedAt: true },
  });

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        totalCatalog: catalogJson.summary.total,
        topLevelPdfNames: catalogJson.summary.topLevelPdfNames,
        withFormula: catalogJson.summary.withFormula,
        create: pending.length,
        skippedExisting: existingSlugs.size,
        archiveCombinedSource: Boolean(combinedSource && !combinedSource.archivedAt),
      },
      null,
      2
    )
  );
  if (!apply) {
    await prisma.$disconnect();
    return;
  }

  const batchSize = 25;
  for (let offset = 0; offset < pending.length; offset += batchSize) {
    const batch = pending.slice(offset, offset + batchSize);
    await prisma.$transaction(async (tx) => {
      for (const entry of batch) {
        const contentMarkdown = articleContent(entry);
        const formulaAvailable = Boolean(
          entry.retailFormula || entry.wholesaleFormula || entry.ourCost
        );
        const tags = [
          "brand-guide",
          formulaAvailable ? "formula-available" : "formula-missing",
          `region-${entry.siteGroup}`,
          `record-${entry.recordType}`,
          ...(entry.ruleKey ? [`rule-${entry.ruleKey}`] : []),
        ];
        const excerpt =
          entry.retailFormula ||
          entry.wholesaleFormula ||
          "Формула не подтверждена. Нужна проверка владельцем.";
        const searchText = buildKnowledgeSearchText({
          title: entry.brand,
          excerpt,
          contentMarkdown,
          category: "prices-and-brands",
          brandKey: entry.guideKey,
          tags,
        });
        const article = await tx.opsKnowledgeArticle.create({
          data: {
            slug: `brand-${entry.guideKey}`,
            title: entry.brand,
            excerpt,
            contentMarkdown,
            locale: "ru",
            category: "prices-and-brands",
            brandKey: entry.guideKey,
            tags,
            searchText,
            status: OpsKnowledgeStatus.PUBLISHED,
            authorId: author.id,
            publishedById: author.id,
            publishedRevision: 1,
            publishedAt: new Date(),
            revisions: {
              create: {
                revision: 1,
                status: OpsKnowledgeStatus.PUBLISHED,
                title: entry.brand,
                excerpt,
                contentMarkdown,
                locale: "ru",
                category: "prices-and-brands",
                brandKey: entry.guideKey,
                tags,
                changeNote: "Структурированный импорт каталога брендов v1",
                changedById: author.id,
              },
            },
          },
        });
        await tx.adminAuditLog.create({
          data: {
            actorId: author.id,
            actorEmail: author.email,
            actorName: author.name,
            scope: "operations",
            action: "knowledge.brand_guide_import",
            entityType: "ops.knowledge",
            entityId: article.id,
            metadata: {
              brand: entry.brand,
              guideKey: entry.guideKey,
              formulaAvailable,
              topLevelPdf: entry.topLevelPdf,
            },
          },
        });
      }
    });
  }

  if (combinedSource && !combinedSource.archivedAt) {
    await prisma.$transaction(async (tx) => {
      const current = await tx.opsKnowledgeArticle.findUniqueOrThrow({
        where: { id: combinedSource.id },
        select: {
          id: true,
          version: true,
          title: true,
          excerpt: true,
          contentMarkdown: true,
          locale: true,
          category: true,
          brandKey: true,
          tags: true,
        },
      });
      await tx.opsKnowledgeArticle.update({
        where: { id: current.id },
        data: {
          status: OpsKnowledgeStatus.ARCHIVED,
          archivedAt: new Date(),
          version: { increment: 1 },
          revisions: {
            create: {
              revision: current.version + 1,
              status: OpsKnowledgeStatus.ARCHIVED,
              title: current.title,
              excerpt: current.excerpt,
              contentMarkdown: current.contentMarkdown,
              locale: current.locale,
              category: current.category,
              brandKey: current.brandKey,
              tags: current.tags,
              changeNote: "Заменено структурированным каталогом брендов",
              changedById: author.id,
            },
          },
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: author.id,
          actorEmail: author.email,
          actorName: author.name,
          scope: "operations",
          action: "knowledge.archive_replaced_source",
          entityType: "ops.knowledge",
          entityId: current.id,
          metadata: { replacement: "structured-brand-guides-v1" },
        },
      });
    });
  }

  const { linkMatchingBrandGuides } = await import("../src/lib/operations/brandGuides");
  const tasks = await prisma.opsTask.findMany({
    where: { archivedAt: null },
    select: {
      id: true,
      title: true,
      description: true,
      nextAction: true,
    },
  });
  let linkedTasks = 0;
  let linkedArticles = 0;
  for (let offset = 0; offset < tasks.length; offset += batchSize) {
    const batch = tasks.slice(offset, offset + batchSize);
    await prisma.$transaction(async (tx) => {
      for (const task of batch) {
        const linked = await linkMatchingBrandGuides(tx, {
          taskId: task.id,
          texts: [task.title, task.description, task.nextAction],
        });
        if (!linked.createdCount) continue;
        linkedTasks += 1;
        linkedArticles += linked.createdCount;
        await tx.opsTaskEvent.create({
          data: {
            taskId: task.id,
            type: OpsTaskEventType.UPDATED,
            actorId: author.id,
            idempotencyKey: `brand-guide-backfill-v1:${task.id}`,
            payload: {
              action: "brand_guides_linked",
              automatic: true,
              brandGuideKeys: linked.brandArticles.map((article) => article.brandKey),
              shippingReferenceLinked: linked.shippingArticles.length > 0,
              shippingEstimateKeys: linked.shippingEstimates.map((estimate) => estimate.key),
            },
          },
        });
      }
    });
  }
  await prisma.adminAuditLog.create({
    data: {
      actorId: author.id,
      actorEmail: author.email,
      actorName: author.name,
      scope: "operations",
      action: "knowledge.brand_guide_backfill",
      entityType: "ops.task",
      metadata: {
        catalogVersion: catalogJson.version,
        scannedTasks: tasks.length,
        linkedTasks,
        linkedArticles,
      },
    },
  });
  console.log(JSON.stringify({ scannedTasks: tasks.length, linkedTasks, linkedArticles }, null, 2));

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
