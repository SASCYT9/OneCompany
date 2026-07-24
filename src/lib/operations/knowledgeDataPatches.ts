import { OpsKnowledgeStatus, type PrismaClient } from "@prisma/client";

import {
  OPS_FORGED_WHEEL_SHIPPING_ESTIMATES,
  OPS_USA_UA_SHIPPING_ESTIMATES,
} from "@/data/operations/shipping-guides";
import { buildKnowledgeSearchText } from "@/lib/operations/knowledge";

const PATCH_KEY = "shipping-estimates-2026-07-24-uplift-10-round-up-5-v1";

const BODY_LABELS: Record<string, string[]> = {
  "front-lip": ["Губа / splitter", "Губа / сплиттер"],
  diffuser: ["Диффузор"],
  "side-skirts": ["Пороги"],
  "small-carbon": ["Канарды, зеркала, небольшие вставки", "Канарды / зеркала / мелкие вставки"],
  bumper: ["Бампер"],
  "small-spoiler": ["Малый спойлер"],
  "roof-spoiler": ["Спойлер на крышу"],
  "large-wing": ["Большое антикрыло"],
  "extra-large-wing": ["Очень большое антикрыло"],
  hood: ["Капот"],
  "performance-speed-shop-hood": ["Капот Performance Speed Shop"],
  winglets: ["Винглеты"],
  grille: ["Решётка / grille", "Решётка / гриль"],
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceTableAmount(content: string, label: string, amountUsd: number) {
  const pattern = new RegExp(
    `(^\\|\\s*${escapeRegExp(label)}\\s*\\|\\s*)([^|]*?)(\\s*\\|\\s*$)`,
    "gmu"
  );
  return content.replace(pattern, (_row, prefix: string, oldAmount: string, suffix: string) => {
    const formatted = oldAmount.includes("$") ? `≈ $${amountUsd}` : `${amountUsd} USD`;
    return `${prefix}${formatted}${suffix}`;
  });
}

export function applyShippingEstimateContentPatch(content: string) {
  let next = content;
  for (const estimate of OPS_USA_UA_SHIPPING_ESTIMATES) {
    for (const label of BODY_LABELS[estimate.key] ?? [estimate.label]) {
      next = replaceTableAmount(next, label, estimate.amountUsd);
    }
  }
  for (const estimate of OPS_FORGED_WHEEL_SHIPPING_ESTIMATES) {
    next = replaceTableAmount(next, estimate.size, estimate.amountUsd);
  }
  return next;
}

export async function applyOpsKnowledgeDataPatches(client: PrismaClient) {
  const existingMarker = await client.opsIdempotencyRecord.findUnique({
    where: { scope_key: { scope: "ops.knowledge.data_patch", key: PATCH_KEY } },
    select: { responseBody: true },
  });
  if (existingMarker) {
    return { applied: false, reason: "already_applied", result: existingMarker.responseBody };
  }

  const actor = await client.adminUser.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true },
  });
  if (!actor) return { applied: false, reason: "active_admin_not_found" };

  const articles = await client.opsKnowledgeArticle.findMany({
    where: {
      archivedAt: null,
      slug: { in: ["internal-product-weight-reference", "product-shipping-reference"] },
    },
  });
  const updates = articles
    .map((article) => ({
      article,
      contentMarkdown: applyShippingEstimateContentPatch(article.contentMarkdown),
    }))
    .filter(({ article, contentMarkdown }) => contentMarkdown !== article.contentMarkdown);

  const result = await client.$transaction(async (tx) => {
    const updated: Array<{ id: string; slug: string; revision: number }> = [];
    for (const { article, contentMarkdown } of updates) {
      const revision = article.version + 1;
      const searchText = buildKnowledgeSearchText({
        title: article.title,
        excerpt: article.excerpt,
        contentMarkdown,
        category: article.category,
        brandKey: article.brandKey,
        tags: article.tags,
      });
      const changed = await tx.opsKnowledgeArticle.updateMany({
        where: { id: article.id, version: article.version },
        data: {
          contentMarkdown,
          searchText,
          version: revision,
          ...(article.status === OpsKnowledgeStatus.PUBLISHED
            ? {
                publishedRevision: revision,
                publishedAt: new Date(),
                publishedById: actor.id,
              }
            : {}),
        },
      });
      if (changed.count !== 1) throw new Error(`Knowledge article ${article.slug} changed`);
      await tx.opsKnowledgeRevision.create({
        data: {
          articleId: article.id,
          revision,
          status: article.status,
          title: article.title,
          excerpt: article.excerpt,
          contentMarkdown,
          locale: article.locale,
          category: article.category,
          brandKey: article.brandKey,
          tags: article.tags,
          changeNote: "Ориентиры увеличены на 10% и округлены вверх до 5 USD",
          changedById: actor.id,
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: actor.id,
          actorEmail: actor.email,
          actorName: actor.name,
          scope: "operations",
          action: "knowledge.shipping_estimates_patch",
          entityType: "ops.knowledge",
          entityId: article.id,
          metadata: { patchKey: PATCH_KEY, slug: article.slug, revision },
        },
      });
      updated.push({ id: article.id, slug: article.slug, revision });
    }

    const responseBody = { updated };
    await tx.opsIdempotencyRecord.create({
      data: {
        scope: "ops.knowledge.data_patch",
        key: PATCH_KEY,
        requestHash: PATCH_KEY,
        responseBody,
        statusCode: 200,
        resourceType: "ops.knowledge.data_patch",
        expiresAt: new Date("2099-12-31T23:59:59.999Z"),
      },
    });
    return responseBody;
  });

  return { applied: true, result };
}
