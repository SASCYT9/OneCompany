import "server-only";

import { GoogleGenAI } from "@google/genai";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { ShopAiPlan, ShopAiProduct } from "@/lib/shopAiAssistantTypes";

const EMBEDDING_MODEL = process.env.SHOP_AI_EMBEDDING_MODEL || "gemini-embedding-2";
const EMBEDDING_DIMENSIONS = 768;

function buildSemanticQuery(message: string, plan: ShopAiPlan) {
  return [
    message,
    plan.intent,
    plan.category,
    plan.vehicle.type,
    plan.vehicle.make,
    plan.vehicle.model,
    plan.vehicle.chassis,
    plan.vehicle.year,
    plan.vehicle.engine,
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
    model: EMBEDDING_MODEL,
    contents: text,
    config: {
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: EMBEDDING_DIMENSIONS,
      httpOptions: { timeout: 8_000 },
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
  if (process.env.SHOP_AI_SEMANTIC_RERANK !== "1" || input.products.length < 2) {
    return input.products;
  }
  try {
    const embedding = await embedQuery(buildSemanticQuery(input.message, input.plan));
    if (!embedding) return input.products;
    const ids = input.products.map((product) => product.id);
    const vector = `[${embedding.join(",")}]`;
    const rows = await prisma.$queryRaw<Array<{ productId: string; distance: number }>>(
      Prisma.sql`
        SELECT "productId", ("embedding" <=> CAST(${vector} AS vector)) AS "distance"
        FROM "ShopProductKnowledge"
        WHERE "productId" IN (${Prisma.join(ids)})
          AND "embedding" IS NOT NULL
          AND "embeddingModel" = ${EMBEDDING_MODEL}
        ORDER BY "distance" ASC
      `
    );
    if (!rows.length) return input.products;
    const distanceById = new Map(rows.map((row) => [row.productId, Number(row.distance)]));
    return [...input.products].sort((left, right) => {
      const leftDistance = distanceById.get(left.id) ?? Number.POSITIVE_INFINITY;
      const rightDistance = distanceById.get(right.id) ?? Number.POSITIVE_INFINITY;
      return leftDistance - rightDistance;
    });
  } catch (error) {
    console.warn("Shop AI semantic reranking unavailable", error);
    return input.products;
  }
}
