import { hashKnowledgeValue } from "@/lib/shopKnowledgeV2/hash";
import type {
  KnowledgeLocale,
  KnowledgeSourceProduct,
  KnowledgeTextSource,
  ShopKnowledgeChunkDraft,
} from "@/lib/shopKnowledgeV2/types";

export const KNOWLEDGE_CHUNK_TARGET_TOKENS = 700;
export const KNOWLEDGE_CHUNK_MAX_TOKENS = 800;
export const KNOWLEDGE_CHUNK_OVERLAP_TOKENS = 70;

type TokenSpan = {
  start: number;
  end: number;
  value: string;
};

const BLOCK_END_TAG =
  /<\/(?:address|article|aside|blockquote|dd|div|dl|dt|figcaption|figure|footer|h[1-6]|header|li|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul)>/gi;

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  bull: "•",
  gt: ">",
  hellip: "…",
  laquo: "«",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  raquo: "»",
  rdquo: "”",
  rsquo: "’",
  trade: "™",
};

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z][\da-z]+);/gi, (entity, code: string) => {
    if (code.startsWith("#x")) {
      const point = Number.parseInt(code.slice(2), 16);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : entity;
    }
    if (code.startsWith("#")) {
      const point = Number.parseInt(code.slice(1), 10);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : entity;
    }
    return NAMED_HTML_ENTITIES[code.toLowerCase()] ?? entity;
  });
}

export function htmlToKnowledgeText(value: string | null | undefined): string {
  if (!value) return "";
  return decodeHtmlEntities(
    String(value)
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(
        /<(?:script|style|noscript|template)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript|template)>/gi,
        " "
      )
      .replace(/<\s*br\s*\/?\s*>/gi, "\n")
      .replace(/<\s*li\b[^>]*>/gi, "\n• ")
      .replace(BLOCK_END_TAG, "\n\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function tokenizeWithSpans(text: string): TokenSpan[] {
  return Array.from(
    text.matchAll(/[\p{L}\p{M}\p{N}]+(?:[.'’_/-][\p{L}\p{M}\p{N}]+)*|[^\s]/gu),
    (match) => ({
      start: match.index,
      end: match.index + match[0].length,
      value: match[0],
    })
  );
}

export function tokenizeKnowledgeText(text: string): string[] {
  return tokenizeWithSpans(text).map((token) => token.value);
}

export function estimateKnowledgeTokenCount(text: string): number {
  return tokenizeWithSpans(text).length;
}

export function chunkKnowledgeText(
  value: string,
  options: {
    targetTokens?: number;
    maxTokens?: number;
    overlapTokens?: number;
  } = {}
): Array<{ content: string; tokenCount: number }> {
  const text = htmlToKnowledgeText(value);
  if (!text) return [];

  const targetTokens = Math.min(
    options.maxTokens ?? KNOWLEDGE_CHUNK_MAX_TOKENS,
    options.targetTokens ?? KNOWLEDGE_CHUNK_TARGET_TOKENS
  );
  const maxTokens = options.maxTokens ?? KNOWLEDGE_CHUNK_MAX_TOKENS;
  const overlapTokens = options.overlapTokens ?? KNOWLEDGE_CHUNK_OVERLAP_TOKENS;
  if (targetTokens <= 0 || maxTokens <= 0 || targetTokens > maxTokens) {
    throw new Error("Knowledge chunk token limits are invalid");
  }
  if (overlapTokens < 0 || overlapTokens >= targetTokens) {
    throw new Error("Knowledge chunk overlap must be smaller than the target");
  }

  const tokens = tokenizeWithSpans(text);
  if (tokens.length === 0) return [];
  const chunks: Array<{ content: string; tokenCount: number }> = [];
  let start = 0;

  while (start < tokens.length) {
    const end = Math.min(start + targetTokens, tokens.length);
    const content = text.slice(tokens[start].start, tokens[end - 1].end).trim();
    chunks.push({ content, tokenCount: end - start });
    if (end >= tokens.length) break;
    start = end - overlapTokens;
  }

  return chunks;
}

function collectLocalizedJsonStrings(
  value: unknown,
  locale: Exclude<KnowledgeLocale, "neutral">
): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectLocalizedJsonStrings(item, locale));
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const localized = record[locale];
    const direct =
      typeof localized === "string" && htmlToKnowledgeText(localized)
        ? [htmlToKnowledgeText(localized)]
        : [];
    return [
      ...direct,
      ...Object.entries(record)
        .filter(([key]) => key !== "ua" && key !== "en")
        .flatMap(([, item]) => collectLocalizedJsonStrings(item, locale)),
    ];
  }
  return [];
}

function pushSource(
  sources: KnowledgeTextSource[],
  locale: KnowledgeLocale,
  sourceField: string,
  value: string | null | undefined,
  sourceOrdinal = 0,
  variantId: string | null = null
) {
  const text = htmlToKnowledgeText(value);
  if (!text) return;
  sources.push({ variantId, locale, sourceField, sourceOrdinal, text });
}

export function collectKnowledgeTextSources(
  product: KnowledgeSourceProduct
): KnowledgeTextSource[] {
  const sources: KnowledgeTextSource[] = [];
  const localizedFields = [
    ["title", product.titleUa, product.titleEn],
    ["category", product.categoryUa, product.categoryEn],
    ["shortDescription", product.shortDescUa, product.shortDescEn],
    ["longDescription", product.longDescUa, product.longDescEn],
    ["leadTime", product.leadTimeUa, product.leadTimeEn],
    ["collection", product.collectionUa, product.collectionEn],
    ["bodyHtml", product.bodyHtmlUa, product.bodyHtmlEn],
    ["seoTitle", product.seoTitleUa, product.seoTitleEn],
    ["seoDescription", product.seoDescriptionUa, product.seoDescriptionEn],
  ] as const;

  for (const [field, ua, en] of localizedFields) {
    pushSource(sources, "ua", field, ua);
    pushSource(sources, "en", field, en);
  }

  for (const locale of ["ua", "en"] as const) {
    collectLocalizedJsonStrings(product.highlights, locale).forEach((value, index) => {
      pushSource(sources, locale, "highlight", value, index);
    });
  }

  pushSource(
    sources,
    "neutral",
    "identity",
    [product.brand, product.vendor, product.sku, product.productType, product.productCategory]
      .filter(Boolean)
      .join(" | ")
  );
  pushSource(sources, "neutral", "tags", product.tags.join(" | "));

  product.options
    .slice()
    .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id))
    .forEach((option, index) => {
      pushSource(
        sources,
        "neutral",
        "option",
        [option.name, ...option.values].filter(Boolean).join(" | "),
        index
      );
    });

  product.variants
    .slice()
    .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id))
    .forEach((variant, index) => {
      pushSource(
        sources,
        "neutral",
        "variant",
        [
          variant.sku,
          variant.title,
          variant.option1Value,
          variant.option2Value,
          variant.option3Value,
        ]
          .filter(Boolean)
          .join(" | "),
        index,
        variant.id
      );
    });

  product.metafields
    .slice()
    .sort((left, right) =>
      `${left.namespace}.${left.key}`.localeCompare(`${right.namespace}.${right.key}`)
    )
    .forEach((metafield, index) => {
      pushSource(
        sources,
        "neutral",
        `metafield:${metafield.namespace}.${metafield.key}`,
        metafield.value,
        index
      );
    });

  return sources;
}

export function buildKnowledgeChunks(product: KnowledgeSourceProduct): ShopKnowledgeChunkDraft[] {
  const sources = collectKnowledgeTextSources(product);
  const productSources = sources.filter((source) => source.variantId === null);
  const variantSources = sources.filter((source) => source.variantId !== null);
  const compactProductSources = (["ua", "en", "neutral"] as const).flatMap((locale) => {
    const localized = productSources.filter((source) => source.locale === locale);
    if (localized.length === 0) return [];
    return [
      {
        variantId: null,
        locale,
        sourceField: `product:${locale}`,
        sourceOrdinal: 0,
        // Field labels preserve inspectability while avoiding one tiny embedding
        // chunk for every short catalog field. This keeps the full source text
        // but targets roughly three product chunks plus variant-owned chunks.
        text: localized
          .map(
            (source) =>
              `[${source.sourceField}${source.sourceOrdinal ? `:${source.sourceOrdinal}` : ""}]\n${source.text}`
          )
          .join("\n\n"),
      },
    ];
  });

  return [...compactProductSources, ...variantSources].flatMap((source) =>
    chunkKnowledgeText(source.text).map((chunk, ordinal) => {
      const identity = {
        productId: product.id,
        variantId: source.variantId,
        locale: source.locale,
        sourceField: source.sourceField,
        sourceOrdinal: source.sourceOrdinal,
        ordinal,
      };
      return {
        chunkKey: hashKnowledgeValue(identity),
        ...identity,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        contentHash: hashKnowledgeValue({ ...identity, content: chunk.content }),
      };
    })
  );
}
