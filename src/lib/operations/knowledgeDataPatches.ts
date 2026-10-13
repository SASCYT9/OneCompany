import { OpsKnowledgeStatus, type PrismaClient } from "@prisma/client";

import {
  OPS_FORGED_WHEEL_SHIPPING_ESTIMATES,
  OPS_USA_UA_SHIPPING_ESTIMATES,
} from "@/data/operations/shipping-guides";
import { buildKnowledgeSearchText } from "@/lib/operations/knowledge";
import {
  applyOpsUsaFormulaToBrandGuide,
  buildOpsUsaFormulaArticle,
  isOpsUsaBrandGuide,
  OPS_USA_FORMULA_STATUS,
  OPS_USA_FORMULA_TEXT,
  OPS_USA_PRICE_FORMULA,
} from "@/lib/operations/usaPricing";

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

/** One-off knowledge fixes, each applied once (idempotency marker) by the jobs cron. */
export async function applyOpsKnowledgeDataPatches(client: PrismaClient) {
  const shippingEstimates = await applyShippingEstimatesPatch(client);
  const usaFormula = await applyUsaFormulaPatch(client);
  return { ...shippingEstimates, usaFormula };
}

async function applyShippingEstimatesPatch(client: PrismaClient) {
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

const USA_PATCH_KEY = "usa-price-formula-2026-09-03-v1";
const USA_FORMULA_SLUG = "usa-price-formula";
const USA_FORMULA_TITLE = `Формула цены США (с ${OPS_USA_PRICE_FORMULA.agreedOn})`;
const USA_CHANGE_NOTE = `Новая формула США от ${OPS_USA_PRICE_FORMULA.agreedOn}: ${OPS_USA_FORMULA_TEXT}`;
const USA_SHIPPING_NOTE = `> С ${OPS_USA_PRICE_FORMULA.agreedOn} доставку США → Киев считаем по $${OPS_USA_PRICE_FORMULA.perKgUsd}/кг в общей формуле США (статья «Формула цены США»). Таблица ниже — исторические ориентиры для крупных кузовных деталей.`;

/** «| США → Украина | Ориентир 11 USD/кг | … |» → the agreed $9/kg. */
export function applyUsaLogisticsRoutePatch(content: string) {
  return content.replace(
    /^(\|\s*США → Украина\s*\|\s*)([^|]*?)(\s*\|.*)$/mu,
    (_row, prefix: string, current: string, suffix: string) =>
      current.includes(`$${OPS_USA_PRICE_FORMULA.perKgUsd}/кг`)
        ? `${prefix}${current}${suffix}`
        : `${prefix}$${OPS_USA_PRICE_FORMULA.perKgUsd}/кг до Киева — формула США с ${OPS_USA_PRICE_FORMULA.agreedOn}; по США — до Brooklyn, NY 11223 (было: ${current.trim()})${suffix}`
  );
}

/** Puts the $9/kg note under the US body-part tables. */
export function applyUsaShippingTableNote(content: string) {
  if (content.includes(USA_SHIPPING_NOTE)) return content;
  return content.replace(
    /^(## (?:США → Украина: кузовные детали|Кузовные детали из США))\n/mu,
    `$1\n\n${USA_SHIPPING_NOTE}\n`
  );
}

export function applyUsaFormulaGuideSection(content: string) {
  if (content.includes("## США")) return content;
  return `${content.trimEnd()}

## США

Для товаров из США с ${OPS_USA_PRICE_FORMULA.agreedOn} действует общая формула: **${OPS_USA_FORMULA_TEXT}**. Подробно и с примером — статья «Формула цены США». В Telegram бот посчитает сам: «? США 1000 + 50 доставка, 10 кг».
`;
}

type PatchActor = { id: string; email: string; name: string | null };

async function findPatchActor(client: PrismaClient): Promise<PatchActor | null> {
  return client.adminUser.findFirst({
    where: { isActive: true },
    orderBy: [{ lastLoginAt: { sort: "desc", nulls: "last" } }, { createdAt: "asc" }],
    select: { id: true, email: true, name: true },
  });
}

/**
 * New US price formula (03.09.2026): a published «Формула цены США» article,
 * $9/kg in the logistics references, and every US brand guide switched to
 * the general formula (the old brand rule stays visible as history).
 */
async function applyUsaFormulaPatch(client: PrismaClient) {
  const existingMarker = await client.opsIdempotencyRecord.findUnique({
    where: { scope_key: { scope: "ops.knowledge.data_patch", key: USA_PATCH_KEY } },
    select: { responseBody: true },
  });
  if (existingMarker) {
    return { applied: false, reason: "already_applied", result: existingMarker.responseBody };
  }
  const actor = await findPatchActor(client);
  if (!actor) return { applied: false, reason: "active_admin_not_found" };

  const formulaContent = buildOpsUsaFormulaArticle();
  const formulaArticle = await client.opsKnowledgeArticle.findUnique({
    where: { slug: USA_FORMULA_SLUG },
    select: { id: true },
  });
  let createdFormulaArticle = false;
  if (!formulaArticle) {
    const excerpt = `${OPS_USA_FORMULA_TEXT}. Доставка по США — до Brooklyn, NY 11223.`;
    const tags = ["pricing", "usa", "formula-available"];
    const category = "prices-and-brands";
    await client.$transaction(async (tx) => {
      const article = await tx.opsKnowledgeArticle.create({
        data: {
          slug: USA_FORMULA_SLUG,
          title: USA_FORMULA_TITLE,
          excerpt,
          contentMarkdown: formulaContent,
          locale: "ru",
          category,
          tags,
          searchText: buildKnowledgeSearchText({
            title: USA_FORMULA_TITLE,
            excerpt,
            contentMarkdown: formulaContent,
            category,
            brandKey: null,
            tags,
          }),
          status: OpsKnowledgeStatus.PUBLISHED,
          authorId: actor.id,
          publishedById: actor.id,
          publishedRevision: 1,
          publishedAt: new Date(),
          version: 1,
        },
        select: { id: true },
      });
      await tx.opsKnowledgeRevision.create({
        data: {
          articleId: article.id,
          revision: 1,
          status: OpsKnowledgeStatus.PUBLISHED,
          title: USA_FORMULA_TITLE,
          excerpt,
          contentMarkdown: formulaContent,
          locale: "ru",
          category,
          brandKey: null,
          tags,
          changeNote: USA_CHANGE_NOTE,
          changedById: actor.id,
        },
      });
    });
    createdFormulaArticle = true;
  }

  const candidates = await client.opsKnowledgeArticle.findMany({
    where: {
      archivedAt: null,
      OR: [
        {
          slug: {
            in: [
              "internal-logistics-routes-reference",
              "product-shipping-reference",
              "internal-product-weight-reference",
              "internal-pricing-formula-reading-guide",
            ],
          },
        },
        { brandKey: { not: null }, contentMarkdown: { contains: "| Группа | США |" } },
      ],
    },
  });
  const updates = candidates
    .map((article) => {
      let contentMarkdown = article.contentMarkdown;
      let tags = article.tags;
      let excerpt = article.excerpt;
      if (article.slug === "internal-logistics-routes-reference") {
        contentMarkdown = applyUsaLogisticsRoutePatch(contentMarkdown);
      } else if (
        article.slug === "product-shipping-reference" ||
        article.slug === "internal-product-weight-reference"
      ) {
        contentMarkdown = applyUsaShippingTableNote(contentMarkdown);
      } else if (article.slug === "internal-pricing-formula-reading-guide") {
        contentMarkdown = applyUsaFormulaGuideSection(contentMarkdown);
      } else if (isOpsUsaBrandGuide(contentMarkdown)) {
        contentMarkdown = applyOpsUsaFormulaToBrandGuide(contentMarkdown);
        tags = Array.from(
          new Set(tags.map((tag) => (tag === "formula-missing" ? "formula-available" : tag)))
        );
        excerpt = `${OPS_USA_FORMULA_STATUS}: ${OPS_USA_FORMULA_TEXT}`;
      }
      return { article, contentMarkdown, tags, excerpt };
    })
    .filter(({ article, contentMarkdown }) => contentMarkdown !== article.contentMarkdown);

  const updated: Array<{ slug: string; revision: number }> = [];
  for (let offset = 0; offset < updates.length; offset += 20) {
    const batch = updates.slice(offset, offset + 20);
    await client.$transaction(
      async (tx) => {
        for (const { article, contentMarkdown, tags, excerpt } of batch) {
          const revision = article.version + 1;
          const changed = await tx.opsKnowledgeArticle.updateMany({
            where: { id: article.id, version: article.version },
            data: {
              contentMarkdown,
              tags,
              excerpt,
              searchText: buildKnowledgeSearchText({
                title: article.title,
                excerpt,
                contentMarkdown,
                category: article.category,
                brandKey: article.brandKey,
                tags,
              }),
              version: revision,
              ...(article.status === OpsKnowledgeStatus.PUBLISHED
                ? { publishedRevision: revision, publishedAt: new Date(), publishedById: actor.id }
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
              excerpt,
              contentMarkdown,
              locale: article.locale,
              category: article.category,
              brandKey: article.brandKey,
              tags,
              changeNote: USA_CHANGE_NOTE,
              changedById: actor.id,
            },
          });
          updated.push({ slug: article.slug, revision });
        }
      },
      { timeout: 60_000 }
    );
  }

  const responseBody = { createdFormulaArticle, updatedCount: updated.length, updated };
  await client.$transaction([
    client.adminAuditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        actorName: actor.name,
        scope: "operations",
        action: "knowledge.usa_formula_patch",
        entityType: "ops.knowledge",
        entityId: USA_FORMULA_SLUG,
        metadata: { patchKey: USA_PATCH_KEY, createdFormulaArticle, updatedCount: updated.length },
      },
    }),
    client.opsIdempotencyRecord.create({
      data: {
        scope: "ops.knowledge.data_patch",
        key: USA_PATCH_KEY,
        requestHash: USA_PATCH_KEY,
        responseBody,
        statusCode: 200,
        resourceType: "ops.knowledge.data_patch",
        expiresAt: new Date("2099-12-31T23:59:59.999Z"),
      },
    }),
  ]);
  return { applied: true, result: responseBody };
}
