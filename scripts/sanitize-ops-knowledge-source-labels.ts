import { config as loadEnv } from "dotenv";

if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  loadEnv({ path: ".env.ops-lab.local", override: true });
}
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

function sanitize(value: string | null) {
  if (!value) return value;
  return value
    .replace(/Прайс\s+PDF/giu, "Прайс поставщика")
    .replace(/из\s+Top[\s-]*Level(?:\.pdf|\s+PDF)?/giu, "из внутреннего источника")
    .replace(/Top[\s-]*Level(?:\.pdf|\s+PDF)?/giu, "внутренний источник")
    .replace(/\bPDF\b/giu, "документ")
    .replace(/Прайс\s+документ/giu, "Прайс поставщика")
    .replace(/из\s+внутренний источник/giu, "из внутреннего источника")
    .replace(/[ \t]{2,}/gu, " ")
    .trim();
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { prisma } = await import("../src/lib/prisma");
  const { buildKnowledgeSearchText } = await import("../src/lib/operations/knowledge");
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const actor = await prisma.adminUser.findFirst({
    where: { isActive: true, ...(email ? { email } : {}) },
    select: { id: true, email: true, name: true },
  });
  if (!actor) throw new Error("Active admin was not found");

  const articles = await prisma.opsKnowledgeArticle.findMany({
    where: {
      OR: [
        { title: { contains: "Top Level", mode: "insensitive" } },
        { excerpt: { contains: "Top Level", mode: "insensitive" } },
        { contentMarkdown: { contains: "Top Level", mode: "insensitive" } },
        { title: { contains: "PDF", mode: "insensitive" } },
        { excerpt: { contains: "PDF", mode: "insensitive" } },
        { contentMarkdown: { contains: "PDF", mode: "insensitive" } },
        { title: { contains: "Прайс документ", mode: "insensitive" } },
        { excerpt: { contains: "Прайс документ", mode: "insensitive" } },
        { contentMarkdown: { contains: "Прайс документ", mode: "insensitive" } },
        { title: { contains: "из внутренний источник", mode: "insensitive" } },
        { excerpt: { contains: "из внутренний источник", mode: "insensitive" } },
        {
          contentMarkdown: {
            contains: "из внутренний источник",
            mode: "insensitive",
          },
        },
      ],
    },
    select: {
      id: true,
      version: true,
      status: true,
      title: true,
      excerpt: true,
      contentMarkdown: true,
      locale: true,
      category: true,
      brandKey: true,
      tags: true,
      publishedRevision: true,
    },
  });

  console.log(
    JSON.stringify({ mode: apply ? "apply" : "dry-run", articles: articles.length }, null, 2)
  );
  if (!apply) {
    await prisma.$disconnect();
    return;
  }

  for (const article of articles) {
    const title = sanitize(article.title) ?? article.title;
    const excerpt = sanitize(article.excerpt);
    const contentMarkdown = sanitize(article.contentMarkdown) ?? article.contentMarkdown;
    const nextRevision = article.version + 1;
    await prisma.$transaction(async (tx) => {
      await tx.opsKnowledgeArticle.update({
        where: { id: article.id },
        data: {
          title,
          excerpt,
          contentMarkdown,
          searchText: buildKnowledgeSearchText({
            title,
            excerpt,
            contentMarkdown,
            category: article.category,
            brandKey: article.brandKey,
            tags: article.tags,
          }),
          version: { increment: 1 },
          ...(article.publishedRevision ? { publishedRevision: nextRevision } : {}),
          revisions: {
            create: {
              revision: nextRevision,
              status: article.status,
              title,
              excerpt,
              contentMarkdown,
              locale: article.locale,
              category: article.category,
              brandKey: article.brandKey,
              tags: article.tags,
              changeNote: "Убраны внутренние названия источников из пользовательского текста",
              changedById: actor.id,
            },
          },
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: actor.id,
          actorEmail: actor.email,
          actorName: actor.name,
          scope: "operations",
          action: "knowledge.source_labels_sanitized",
          entityType: "ops.knowledge",
          entityId: article.id,
          metadata: { previousVersion: article.version, version: nextRevision },
        },
      });
    });
  }
  console.log(JSON.stringify({ updated: articles.length }, null, 2));
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
