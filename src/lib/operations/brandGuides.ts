import type { Prisma, PrismaClient } from "@prisma/client";

import catalogJson from "@/data/operations/brand-guides.json";
import {
  OPS_SHIPPING_REFERENCE_SLUG,
  OPS_UK_UA_SHIPPING_ROUTE,
  OPS_USA_UA_SHIPPING_ESTIMATES,
  type OpsShippingEstimate,
} from "@/data/operations/shipping-guides";

export type BrandGuideCatalogEntry = {
  brand: string;
  guideKey: string;
  ruleKey: string;
  country: string;
  siteGroup: string;
  formulaStatus: string;
  ruleTitle: string;
  ruleGroup: string;
  aliases: string[];
  retailFormula: string;
  wholesaleFormula: string;
  ourCost: string;
  logisticsRule: string;
  notes: string;
  nextAction: string;
  source: string;
  sourceUrl: string;
  topLevelPdf: boolean;
  recordType: "brand" | "rule_group" | "pdf_only";
};

export const brandGuideCatalog = catalogJson.brands as BrandGuideCatalogEntry[];
const catalog = brandGuideCatalog;

export function opsBrandProperNameHints() {
  const seen = new Set<string>();
  return catalog.flatMap((entry) =>
    [entry.brand, ...entry.aliases].flatMap((value) => {
      const clean = value
        .replace(/\u0000/g, "")
        .trim()
        .slice(0, 100);
      const key = clean.toLocaleLowerCase("en-US");
      if (!clean || clean.length < 2 || seen.has(key)) return [];
      seen.add(key);
      return [clean];
    })
  );
}

export async function opsBrandProperNameHintsForClient(client: PrismaClient) {
  const [articles, products] = await Promise.all([
    client.opsKnowledgeArticle.findMany({
      where: { status: "PUBLISHED", archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 500,
      select: { title: true, brandKey: true, tags: true },
    }),
    client.shopProduct.findMany({
      where: { brand: { not: null } },
      distinct: ["brand"],
      take: 1_000,
      select: { brand: true },
    }),
  ]);
  const seen = new Set<string>();
  return [
    ...opsBrandProperNameHints(),
    "CEIKA",
    ...articles.flatMap((article) => [
      article.title,
      article.brandKey,
      ...article.tags.filter((tag) => /^alias:/iu.test(tag)).map((tag) => tag.slice(6)),
    ]),
    ...products.map((product) => product.brand),
  ].flatMap((value) => {
    const clean = String(value ?? "")
      .replace(/\u0000/g, "")
      .trim()
      .slice(0, 100);
    const key = clean.toLocaleLowerCase("en-US");
    if (!clean || clean.length < 2 || seen.has(key)) return [];
    seen.add(key);
    return [clean];
  });
}

const genericAliases = new Set([
  "usa",
  "сша",
  "america",
  "америка",
  "europe",
  "other",
  "filters",
  "нулевики",
]);

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function operatorFacingReferenceText(value: string) {
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

function containsTerm(haystack: string, needle: string) {
  return Boolean(needle) && ` ${haystack} `.includes(` ${needle} `);
}

export function findMatchingBrandGuideKeys(texts: Array<string | null | undefined>) {
  const text = normalizeSearchText(texts.filter(Boolean).join("\n"));
  if (!text) return [];

  const matches = catalog
    .map((entry) => {
      const brand = normalizeSearchText(entry.brand);
      if (containsTerm(text, brand)) {
        return {
          guideKey: entry.guideKey,
          score: 1_000 + brand.length,
          formulaAvailable: Boolean(entry.retailFormula || entry.wholesaleFormula || entry.ourCost),
        };
      }
      const aliasScores = entry.aliases
        .map(normalizeSearchText)
        .filter((alias) => alias && !genericAliases.has(alias))
        .filter((alias) => containsTerm(text, alias))
        .map((alias) => 500 + alias.length);
      if (!aliasScores.length) return null;
      return {
        guideKey: entry.guideKey,
        score: Math.max(...aliasScores) + (entry.recordType === "rule_group" ? 100 : 0),
        formulaAvailable: Boolean(entry.retailFormula || entry.wholesaleFormula || entry.ourCost),
      };
    })
    .filter((match): match is NonNullable<typeof match> => Boolean(match))
    .sort(
      (left, right) =>
        right.score - left.score ||
        Number(right.formulaAvailable) - Number(left.formulaAvailable) ||
        left.guideKey.localeCompare(right.guideKey)
    );

  if (!matches.length) return [];
  const direct = matches.filter((match) => match.score >= 1_000);
  const selected = direct.length ? direct : [matches[0]];
  return Array.from(new Set(selected.map((match) => match.guideKey))).slice(0, 3);
}

export function getBrandGuideByKey(key: string) {
  return catalog.find((entry) => entry.guideKey === key) ?? null;
}

function markdownSection(content: string, heading: string) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    content
      .match(new RegExp(`##\\s+${escaped}\\s*\\n+([\\s\\S]*?)(?=\\n##\\s+|$)`, "iu"))?.[1]
      ?.trim() ?? ""
  );
}

function markdownTableValue(content: string, label: string) {
  const normalizedLabel = normalizeSearchText(label);
  for (const line of content.split(/\r?\n/u)) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 2 || normalizeSearchText(cells[0]) !== normalizedLabel) continue;
    return cells.slice(1).join(" | ").trim();
  }
  return "";
}

export function hydrateBrandGuideFromArticle(
  fallback: BrandGuideCatalogEntry,
  article?: { title: string; contentMarkdown: string } | null
): BrandGuideCatalogEntry {
  if (!article?.contentMarkdown.trim()) return fallback;
  const content = article.contentMarkdown;
  const aliasesLine = content.match(/-\s*Другие названия:\s*([^\n.]+)/iu)?.[1]?.trim();
  const sourceLink = content.match(/\[[^\]]+\]\((https?:\/\/[^)]+)\)/iu)?.[1]?.trim();
  const aliases =
    aliasesLine && !/^не указаны$/iu.test(aliasesLine)
      ? aliasesLine
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];
  const articleValue = (label: string, current: string) => {
    const value = markdownTableValue(content, label);
    if (!value) return current;
    return /^не указан[оа]$/iu.test(value) ? "" : operatorFacingReferenceText(value);
  };

  return {
    ...fallback,
    brand: article.title.trim() || fallback.brand,
    country: articleValue("Страна", fallback.country),
    ruleGroup: articleValue("Группа", fallback.ruleGroup),
    retailFormula: articleValue("Розница", fallback.retailFormula),
    wholesaleFormula: articleValue("Опт / партнёр", fallback.wholesaleFormula),
    ourCost: articleValue("Наша закупка", fallback.ourCost),
    logisticsRule: articleValue("Логистика", fallback.logisticsRule),
    notes: markdownSection(content, "Важные заметки"),
    nextAction: markdownSection(content, "Следующее действие"),
    aliases,
    sourceUrl: sourceLink || "",
  };
}

export function parseShippingEstimatesFromMarkdown(
  contentMarkdown: string | null | undefined
): OpsShippingEstimate[] {
  const source = String(contentMarkdown ?? "");
  const content = markdownSection(source, "США → Украина: кузовные детали") || source;
  const parsed: OpsShippingEstimate[] = [];
  for (const line of content.split(/\r?\n/u)) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 2 || /^(?:категория|---)/iu.test(cells[0])) continue;
    const amount = cells[1].match(/(?:≈\s*)?(?:\$|USD\s*)?([0-9]+(?:[.,][0-9]+)?)/iu)?.[1];
    if (!amount) continue;
    const amountUsd = Number(amount.replace(",", "."));
    if (!Number.isFinite(amountUsd) || amountUsd < 0) continue;
    const existing = OPS_USA_UA_SHIPPING_ESTIMATES.find(
      (estimate) => normalizeSearchText(estimate.label) === normalizeSearchText(cells[0])
    );
    const generatedKey = normalizeSearchText(cells[0]).replace(/\s+/gu, "-").slice(0, 80);
    const key = existing?.key ?? (generatedKey || `shipping-${parsed.length + 1}`);
    parsed.push({
      key,
      label: cells[0],
      amountUsd,
      terms: existing?.terms ?? [cells[0]],
      ...(existing?.note ? { note: existing.note } : {}),
    });
  }
  return parsed.length ? parsed : OPS_USA_UA_SHIPPING_ESTIMATES;
}

export function extractOpsSourceUrls(texts: Array<string | null | undefined>) {
  const matches = texts
    .filter(Boolean)
    .flatMap((text) => String(text).match(/https?:\/\/[^\s<>"']+/giu) ?? [])
    .map((url) => url.replace(/[),.;!?]+$/u, ""))
    .filter((url) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    });
  return Array.from(new Set(matches)).slice(0, 20);
}

export function appendOpsSourceUrls(
  description: string | null | undefined,
  texts: Array<string | null | undefined>
) {
  const urls = extractOpsSourceUrls(texts).filter(
    (url) => !String(description ?? "").includes(url)
  );
  if (!urls.length) return description ?? null;
  return [description?.trim(), "Ссылки из исходного сообщения:", ...urls.map((url) => `• ${url}`)]
    .filter(Boolean)
    .join("\n");
}

function normalizeProductText(texts: Array<string | null | undefined>) {
  return normalizeSearchText(texts.filter(Boolean).join("\n"));
}

export function findShippingEstimates(texts: Array<string | null | undefined>) {
  const text = normalizeProductText(texts);
  if (!text) return [];
  return OPS_USA_UA_SHIPPING_ESTIMATES.filter((estimate) =>
    estimate.terms.some((term) => text.includes(normalizeSearchText(term)))
  )
    .sort((left, right) => {
      const leftSpecific = left.key === "performance-speed-shop-hood" ? 1 : 0;
      const rightSpecific = right.key === "performance-speed-shop-hood" ? 1 : 0;
      return rightSpecific - leftSpecific;
    })
    .slice(0, 3);
}

export function isProductRelatedTask(texts: Array<string | null | undefined>) {
  const joined = texts.filter(Boolean).join("\n");
  const text = normalizeProductText(texts);
  if (!text) return false;
  return Boolean(
    findMatchingBrandGuideKeys(texts).length ||
      extractOpsSourceUrls(texts).some((url) => /\/(?:products?|shop|catalog)\//iu.test(url)) ||
      /\b[A-ZА-ЯІЇЄҐ]{2,}[A-ZА-ЯІЇЄҐ0-9]*-\d[A-ZА-ЯІЇЄҐ0-9-]*\b/u.test(joined) ||
      [
        "товар",
        "деталь",
        "комплект",
        "артикул",
        "sku",
        "сплиттер",
        "диффузор",
        "дифузор",
        "пороги",
        "капот",
        "бампер",
        "спойлер",
        "выхлоп",
        "вихлоп",
        "диски",
        "интеркулер",
        "інтеркулер",
      ].some((term) => text.includes(term))
  );
}

export function isUkShippingRelatedTask(texts: Array<string | null | undefined>) {
  const text = normalizeProductText(texts);
  if (!text) return false;
  if (
    OPS_UK_UA_SHIPPING_ROUTE.terms.some((term) => containsTerm(text, normalizeSearchText(term)))
  ) {
    return true;
  }
  const guideKeys = new Set(findMatchingBrandGuideKeys(texts));
  return catalog.some(
    (entry) => guideKeys.has(entry.guideKey) && entry.country.trim().toUpperCase() === "UK"
  );
}

export async function linkMatchingBrandGuides(
  tx: Prisma.TransactionClient,
  input: {
    taskId: string;
    texts: Array<string | null | undefined>;
  }
) {
  const guideKeys = findMatchingBrandGuideKeys(input.texts);
  const includeShipping = isProductRelatedTask(input.texts);
  const includeUkShipping = isUkShippingRelatedTask(input.texts);
  if (!guideKeys.length && !includeShipping && !includeUkShipping) {
    return {
      articles: [],
      brandArticles: [],
      shippingArticles: [],
      shippingEstimates: [],
      createdCount: 0,
    };
  }

  const articles = await tx.opsKnowledgeArticle.findMany({
    where: {
      archivedAt: null,
      publishedRevision: { not: null },
      OR: [
        ...(guideKeys.length
          ? [{ brandKey: { in: guideKeys }, tags: { has: "brand-guide" } }]
          : []),
        ...(includeShipping ? [{ slug: OPS_SHIPPING_REFERENCE_SLUG }] : []),
        ...(includeUkShipping ? [{ slug: OPS_UK_UA_SHIPPING_ROUTE.slug }] : []),
      ],
    },
    select: {
      id: true,
      brandKey: true,
      title: true,
      slug: true,
      tags: true,
      contentMarkdown: true,
    },
  });
  if (!articles.length) {
    return {
      articles: [],
      brandArticles: [],
      shippingArticles: [],
      shippingEstimates: findShippingEstimates(input.texts),
      createdCount: 0,
    };
  }

  const created = await tx.opsTaskKnowledgeLink.createMany({
    data: articles.map((article) => ({
      taskId: input.taskId,
      articleId: article.id,
    })),
    skipDuplicates: true,
  });
  const brandArticles = articles.filter((article) => article.tags.includes("brand-guide"));
  const shippingArticles = articles.filter((article) =>
    article.tags.includes("shipping-reference")
  );
  const editableShippingEstimates = parseShippingEstimatesFromMarkdown(
    shippingArticles.find((article) => article.slug === OPS_SHIPPING_REFERENCE_SLUG)
      ?.contentMarkdown
  );
  const matchedShippingEstimates = editableShippingEstimates
    .filter((estimate) =>
      estimate.terms.some((term) =>
        normalizeProductText(input.texts).includes(normalizeSearchText(term))
      )
    )
    .slice(0, 3);
  return {
    articles,
    brandArticles,
    shippingArticles,
    shippingEstimates: matchedShippingEstimates,
    createdCount: created.count,
  };
}
