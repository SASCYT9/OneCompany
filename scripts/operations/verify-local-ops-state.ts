import { OpsAttachmentState, OpsKnowledgeStatus, PrismaClient } from "@prisma/client";

import catalogJson from "../../src/data/operations/brand-guides.json";

const LOCAL_DATABASE_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function localDatabaseUrl() {
  const value = String(process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "").trim();
  if (!value) throw new Error("DIRECT_URL or DATABASE_URL is required");
  const url = new URL(value);
  if (!LOCAL_DATABASE_HOSTS.has(url.hostname)) {
    throw new Error("Local Ops verification refused a non-local database");
  }
  return value;
}

async function main() {
  const prisma = new PrismaClient({
    datasourceUrl: localDatabaseUrl(),
  });

  try {
    const [
      tasks,
      taskEvents,
      attachments,
      readyAttachments,
      taskKnowledgeLinks,
      publishedBrandArticles,
    ] = await Promise.all([
      prisma.opsTask.count(),
      prisma.opsTaskEvent.count(),
      prisma.opsAttachment.count(),
      prisma.opsAttachment.count({ where: { state: OpsAttachmentState.READY } }),
      prisma.opsTaskKnowledgeLink.count(),
      prisma.opsKnowledgeArticle.count({
        where: {
          status: OpsKnowledgeStatus.PUBLISHED,
          tags: { has: "brand-guide" },
          archivedAt: null,
        },
      }),
    ]);

    const sourceBrandGuides = catalogJson.brands.length;
    const brandsSynchronized = publishedBrandArticles === sourceBrandGuides;
    console.log(
      JSON.stringify(
        {
          ok: brandsSynchronized,
          board: {
            tasks,
            appendOnlyEvents: taskEvents,
          },
          knowledge: {
            sourceBrandGuides,
            publishedBrandArticles,
            taskKnowledgeLinks,
            brandsSynchronized,
          },
          media: {
            attachments,
            readyAttachments,
          },
        },
        null,
        2
      )
    );
    if (!brandsSynchronized) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown Ops state verification error",
    })
  );
  process.exitCode = 1;
});
