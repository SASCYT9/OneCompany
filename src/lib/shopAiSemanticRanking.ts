import "server-only";

import { GoogleGenAI } from "@google/genai";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { shouldUseShopAiSemanticReranking } from "@/lib/shopAiSemanticIntent";
import type { ShopAiPlan, ShopAiProduct } from "@/lib/shopAiAssistantTypes";
import { SHOP_AI_QUERY_EMBEDDING_TIMEOUT_MS } from "@/lib/shopAiProviderPolicy";
import {
  SHOP_KNOWLEDGE_CHUNK_EMBEDDING_PROVIDER_MODEL,
  buildShopKnowledgeEmbeddingTaskConfig,
  buildShopKnowledgeQueryEmbeddingText,
  resolveShopKnowledgeEmbeddingStorageModel,
} from "@/lib/shopKnowledgeV2/embeddings";

const EMBEDDING_PROVIDER_MODEL =
  process.env.SHOP_AI_EMBEDDING_MODEL || SHOP_KNOWLEDGE_CHUNK_EMBEDDING_PROVIDER_MODEL;
const EMBEDDING_STORAGE_MODEL = resolveShopKnowledgeEmbeddingStorageModel(EMBEDDING_PROVIDER_MODEL);
const EMBEDDING_DIMENSIONS = 768;

function buildSemanticQuery(message: string, plan: ShopAiPlan) {
  return [
    message,
    plan.intent,
    plan.goal,
    plan.category,
    plan.vehicle.type,
    plan.vehicle.make,
    plan.vehicle.model,
    plan.vehicle.chassis,
    plan.vehicle.year,
    plan.vehicle.engine,
    plan.vehicle.fuel,
    plan.vehicle.bodyStyle,
    plan.vehicle.drivetrain,
    plan.vehicle.transmission,
    plan.vehicle.market,
    plan.brand,
    plan.powerGainHp ? `requested gain +${plan.powerGainHp} hp` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

async function embedQuery(text: string) {
  const apiKey = (process.env.SHOP_AI_API_KEY || process.env.GEMINI_API_KEY)?.trim();
  if (!apiKey) return null;
  const client = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });
  const response = await client.models.embedContent({
    model: EMBEDDING_PROVIDER_MODEL,
    contents: buildShopKnowledgeQueryEmbeddingText(text, EMBEDDING_PROVIDER_MODEL),
    config: {
      ...buildShopKnowledgeEmbeddingTaskConfig(EMBEDDING_PROVIDER_MODEL, "query"),
      outputDimensionality: EMBEDDING_DIMENSIONS,
      httpOptions: { timeout: SHOP_AI_QUERY_EMBEDDING_TIMEOUT_MS },
    },
  });
  const values = response.embeddings?.[0]?.values;
  return values?.length === EMBEDDING_DIMENSIONS ? values : null;
}

/**
 * Reorders only candidates that already passed deterministic constraints.
 * Any provider, vector-extension, or migration problem degrades to lexical order.
 */
export async function rerankShopAiProductsSemantically(input: {
  products: ShopAiProduct[];
  message: string;
  plan: ShopAiPlan;
}) {
  if (
    process.env.SHOP_AI_SEMANTIC_RERANK !== "1" ||
    input.products.length < 2 ||
    !shouldUseShopAiSemanticReranking(input.message, input.plan)
  ) {
    return { products: input.products, usedEmbedding: false };
  }
  const hasProviderKey = Boolean(
    (process.env.SHOP_AI_API_KEY || process.env.GEMINI_API_KEY)?.trim()
  );
  if (!hasProviderKey) return { products: input.products, usedEmbedding: false };
  try {
    const embedding = await embedQuery(buildSemanticQuery(input.message, input.plan));
    if (!embedding) return { products: input.products, usedEmbedding: true };
    const ids = input.products.map((product) => product.id);
    const vector = `[${embedding.join(",")}]`;
    const rows = await prisma.$queryRaw<Array<{ productId: string; distance: number }>>(
      Prisma.sql`
        SELECT
          chunk."productId",
          MIN(chunk."embedding" <=> CAST(${vector} AS vector)) AS "distance"
        FROM "ShopKnowledgeChunk" chunk
        INNER JOIN "ShopProductKnowledge" knowledge
          ON knowledge."id" = chunk."knowledgeId"
        WHERE chunk."productId" IN (${Prisma.join(ids)})
          AND chunk."isActive" = true
          AND chunk."revision" = knowledge."activeRevision"
          AND chunk."embedding" IS NOT NULL
          AND chunk."embeddingModel" = ${EMBEDDING_STORAGE_MODEL}
          AND knowledge."schemaVersion" >= 2
          AND knowledge."status" IN ('READY', 'NEEDS_REVIEW')
        GROUP BY chunk."productId"
        ORDER BY "distance" ASC
      `
    );
    if (!rows.length) return { products: input.products, usedEmbedding: true };
    const distanceById = new Map(rows.map((row) => [row.productId, Number(row.distance)]));
    const products = [...input.products].sort((left, right) => {
      const leftDistance = distanceById.get(left.id) ?? Number.POSITIVE_INFINITY;
      const rightDistance = distanceById.get(right.id) ?? Number.POSITIVE_INFINITY;
      return leftDistance - rightDistance;
    });
    return { products, usedEmbedding: true };
  } catch (error) {
    console.warn("Shop AI semantic reranking unavailable", error);
    return { products: input.products, usedEmbedding: true };
  }
}
