import { OpsKnowledgeStatus, OpsTaskEventType } from "@prisma/client";
import { config as loadEnv } from "dotenv";

import { OPS_UK_UA_SHIPPING_ROUTE } from "../src/data/operations/shipping-guides";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });
if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  loadEnv({ path: ".env.ops-lab.local" });
}

function requiredEnv(name: string, apply: boolean) {
  const value = process.env[name]?.replace(/\u0000/g, "").trim();
  if (!value && apply) throw new Error(`${name} is required with --apply`);
  return value ?? "";
}

function buildArticleContent(input: {
  address: string;
  city: string;
  postalCode: string;
  contactName: string;
  phone: string;
}) {
  return `# Доставка из Великобритании через Medyka

> Рабочее правило для британских сайтов и брендов. Перед предложением клиенту проверьте актуальную цену, наличие, локальную доставку и фактический объём груза.

## Формула

${OPS_UK_UA_SHIPPING_ROUTE.formula}.

## Порядок расчёта

${OPS_UK_UA_SHIPPING_ROUTE.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}

## Адрес в Великобритании

Используйте склад **${OPS_UK_UA_SHIPPING_ROUTE.destinationReference}**:

${input.postalCode}  
${input.city}  
${input.address}  
Получатель: ${input.contactName}  
Телефон: ${input.phone}

Не копируйте этот адрес в описание задачи или публичные комментарии. В задачах указывайте только reference **${OPS_UK_UA_SHIPPING_ROUTE.destinationReference}**.

## Что обязательно уточнить

- доставка от продавца до адреса в Великобритании;
- количество коробок, габариты и объёмный вес;
- стоимость маршрута Великобритания → Medyka;
- стоимость маршрута Medyka → Украина;
- VAT/tax и валюта цены на сайте;
- не включена ли доставка продавцом заранее.

Формула является рабочим правилом, а не автоматическим checkout-калькулятором.`;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const address = requiredEnv("OPS_UK_WAREHOUSE_ADDRESS", apply);
  const city = requiredEnv("OPS_UK_WAREHOUSE_CITY", apply);
  const postalCode = requiredEnv("OPS_UK_WAREHOUSE_POSTAL_CODE", apply);
  const contactName = requiredEnv("OPS_UK_WAREHOUSE_CONTACT_NAME", apply);
  const phone = requiredEnv("OPS_UK_WAREHOUSE_PHONE", apply);
  const imported = await import("../src/lib/prisma");
  const prisma = imported.prisma;
  const { buildKnowledgeSearchText } = await import("../src/lib/operations/knowledge");
  const { linkMatchingBrandGuides } = await import("../src/lib/operations/brandGuides");
  const authorEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const author = await prisma.adminUser.findFirst({
    where: { isActive: true, ...(authorEmail ? { email: authorEmail } : {}) },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true },
  });
  if (!author) throw new Error("Active admin was not found");

  const existingWarehouse = await prisma.shopWarehouse.findUnique({
    where: { code: OPS_UK_UA_SHIPPING_ROUTE.warehouseCode },
    select: { id: true },
  });
  const existingArticle = await prisma.opsKnowledgeArticle.findUnique({
    where: { slug: OPS_UK_UA_SHIPPING_ROUTE.slug },
    select: { id: true, version: true, contentMarkdown: true },
  });
  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        route: OPS_UK_UA_SHIPPING_ROUTE.key,
        destinationReference: OPS_UK_UA_SHIPPING_ROUTE.destinationReference,
        warehouse: existingWarehouse ? "update" : "create",
        article: existingArticle ? "update" : "create",
      },
      null,
      2
    )
  );
  if (!apply) {
    await prisma.$disconnect();
    return;
  }

  const contentMarkdown = buildArticleContent({
    address,
    city,
    postalCode,
    contactName,
    phone,
  });
  const title = "Доставка из Великобритании через Medyka";
  const excerpt = OPS_UK_UA_SHIPPING_ROUTE.formula;
  const tags = [
    "shipping-reference",
    "uk-route",
    "delivery",
    "medyka",
    `destination:${OPS_UK_UA_SHIPPING_ROUTE.destinationReference}`,
  ];
  const searchText = buildKnowledgeSearchText({
    title,
    excerpt,
    contentMarkdown,
    category: "delivery",
    brandKey: null,
    tags,
  });

  const article = await prisma.$transaction(async (tx) => {
    await tx.shopWarehouse.upsert({
      where: { code: OPS_UK_UA_SHIPPING_ROUTE.warehouseCode },
      create: {
        code: OPS_UK_UA_SHIPPING_ROUTE.warehouseCode,
        name: "UK London Forwarder",
        nameUa: "Склад-перевізник у Лондоні",
        country: "GB",
        city,
        address,
        postalCode,
        contactName,
        phone,
        isActive: true,
        sortOrder: 20,
      },
      update: {
        name: "UK London Forwarder",
        nameUa: "Склад-перевізник у Лондоні",
        country: "GB",
        city,
        address,
        postalCode,
        contactName,
        phone,
        isActive: true,
      },
    });

    if (!existingArticle) {
      return tx.opsKnowledgeArticle.create({
        data: {
          slug: OPS_UK_UA_SHIPPING_ROUTE.slug,
          title,
          excerpt,
          contentMarkdown,
          locale: "ru",
          category: "delivery",
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
              title,
              excerpt,
              contentMarkdown,
              locale: "ru",
              category: "delivery",
              tags,
              changeNote: "Добавлено подтверждённое правило Великобритания → Medyka → Украина",
              changedById: author.id,
            },
          },
        },
        select: { id: true },
      });
    }

    if (existingArticle.contentMarkdown === contentMarkdown) {
      return { id: existingArticle.id };
    }
    const revision = existingArticle.version + 1;
    return tx.opsKnowledgeArticle.update({
      where: { id: existingArticle.id },
      data: {
        title,
        excerpt,
        contentMarkdown,
        locale: "ru",
        category: "delivery",
        tags,
        searchText,
        status: OpsKnowledgeStatus.PUBLISHED,
        publishedById: author.id,
        publishedRevision: revision,
        publishedAt: new Date(),
        archivedAt: null,
        version: { increment: 1 },
        revisions: {
          create: {
            revision,
            status: OpsKnowledgeStatus.PUBLISHED,
            title,
            excerpt,
            contentMarkdown,
            locale: "ru",
            category: "delivery",
            tags,
            changeNote: "Обновлено правило и адрес Великобритании",
            changedById: author.id,
          },
        },
      },
      select: { id: true },
    });
  });

  await prisma.adminAuditLog.create({
    data: {
      actorId: author.id,
      actorEmail: author.email,
      actorName: author.name,
      scope: "operations",
      action: "knowledge.uk_shipping_route.sync",
      entityType: "ops.knowledge",
      entityId: article.id,
      metadata: {
        routeKey: OPS_UK_UA_SHIPPING_ROUTE.key,
        warehouseCode: OPS_UK_UA_SHIPPING_ROUTE.warehouseCode,
        destinationReference: OPS_UK_UA_SHIPPING_ROUTE.destinationReference,
      },
    },
  });

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
      if (!linked.articles.some((item) => item.slug === OPS_UK_UA_SHIPPING_ROUTE.slug)) return;
      if (!linked.createdCount) return;
      linkedTasks += 1;
      await tx.opsTaskEvent.create({
        data: {
          taskId: task.id,
          type: OpsTaskEventType.UPDATED,
          actorId: author.id,
          idempotencyKey: `uk-route-backfill-v1:${task.id}`,
          payload: {
            action: "uk_shipping_route_linked",
            automatic: true,
            destinationReference: OPS_UK_UA_SHIPPING_ROUTE.destinationReference,
          },
        },
      });
    });
  }
  console.log(JSON.stringify({ articleId: article.id, scannedTasks: tasks.length, linkedTasks }));
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
