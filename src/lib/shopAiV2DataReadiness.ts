import "server-only";

import { Prisma, type PrismaClient } from "@prisma/client";

import { getShopAiRetentionCutoffs } from "@/lib/shopAiRetention";
import {
  evaluateShopAiV2DataReadinessFacts,
  SHOP_AI_V2_DATA_READINESS_SCHEMA_VERSION,
  type ShopAiV2DataReadinessSnapshot,
} from "@/lib/shopAiV2DataReadinessContract";
import { SHOP_AI_V2_ROLLOUT_CATEGORIES } from "@/lib/shopAiV2RolloutContract";
import { readShopKnowledgeCatalogState } from "@/lib/shopKnowledgeV2/catalogState";
import { SHOP_KNOWLEDGE_CHUNK_EMBEDDING_MODEL } from "@/lib/shopKnowledgeV2/embeddings";
import { SHOP_KNOWLEDGE_V2_SCHEMA_VERSION } from "@/lib/shopKnowledgeV2/types";

type KnowledgeAggregateRow = {
  status: string;
  categoryGroup: string;
  count: bigint;
};

type EmbeddingAggregateRow = {
  totalChunks: bigint;
  currentChunks: bigint;
  pendingChunks: bigint;
};

type OutboxAggregateRow = {
  status: string;
  count: bigint;
};

type StaleRunAggregateRow = {
  count: bigint;
};

function safeCount(value: bigint | number | null | undefined, label: string) {
  const count = Number(value ?? 0);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(`${label} exceeded the supported readiness counter range`);
  }
  return count;
}

export async function collectShopAiV2DataReadiness(
  client: PrismaClient,
  now = new Date()
): Promise<ShopAiV2DataReadinessSnapshot> {
  const catalogBefore = await readShopKnowledgeCatalogState(client);
  const staleRunBefore = getShopAiRetentionCutoffs(now).abandonedRunBefore;
  const [knowledgeRows, embeddingRows, outboxRows, staleRunRows] = await Promise.all([
    client.$queryRaw<KnowledgeAggregateRow[]>(Prisma.sql`
      SELECT
        revision."status"::text AS "status",
        COALESCE(
          NULLIF(revision."snapshot"->>'categoryGroup', ''),
          knowledge."categoryGroup",
          'other'
        ) AS "categoryGroup",
        COUNT(*)::bigint AS "count"
      FROM "ShopProductKnowledge" knowledge
      JOIN "ShopKnowledgeRevision" revision
        ON revision."knowledgeId" = knowledge."id"
       AND revision."revision" = knowledge."revision"
      WHERE knowledge."schemaVersion" = ${SHOP_KNOWLEDGE_V2_SCHEMA_VERSION}
      GROUP BY revision."status", 2
    `),
    client.$queryRaw<EmbeddingAggregateRow[]>(Prisma.sql`
      SELECT
        COUNT(*)::bigint AS "totalChunks",
        COUNT(*) FILTER (
          WHERE chunk."embedding" IS NOT NULL
            AND chunk."embeddingModel" = ${SHOP_KNOWLEDGE_CHUNK_EMBEDDING_MODEL}
        )::bigint AS "currentChunks",
        COUNT(*) FILTER (
          WHERE chunk."embedding" IS NULL
             OR chunk."embeddingModel" IS DISTINCT FROM ${SHOP_KNOWLEDGE_CHUNK_EMBEDDING_MODEL}
        )::bigint AS "pendingChunks"
      FROM "ShopKnowledgeChunk" chunk
      JOIN "ShopProductKnowledge" knowledge
        ON knowledge."id" = chunk."knowledgeId"
       AND knowledge."revision" = chunk."revision"
      JOIN "ShopKnowledgeRevision" revision
        ON revision."knowledgeId" = chunk."knowledgeId"
       AND revision."revision" = chunk."revision"
      WHERE knowledge."schemaVersion" = ${SHOP_KNOWLEDGE_V2_SCHEMA_VERSION}
    `),
    client.$queryRaw<OutboxAggregateRow[]>(Prisma.sql`
      SELECT "status"::text AS "status", COUNT(*)::bigint AS "count"
      FROM "ShopKnowledgeOutbox"
      GROUP BY "status"
    `),
    client.$queryRaw<StaleRunAggregateRow[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count"
      FROM "ShopAiRun"
      WHERE "status" = 'PROCESSING'
        AND "createdAt" < ${staleRunBefore}
    `),
  ]);
  const catalogAfter = await readShopKnowledgeCatalogState(client);

  const statusCounts = {
    ready: 0,
    needsReview: 0,
    pending: 0,
    processing: 0,
    failed: 0,
    blocked: 0,
  };
  const countsByCategory = Object.fromEntries(
    SHOP_AI_V2_ROLLOUT_CATEGORIES.map((category) => [category, 0])
  ) as Record<string, number>;
  const canonicalCategories = new Set<string>(SHOP_AI_V2_ROLLOUT_CATEGORIES);
  let knowledgeTotal = 0;
  let nonCanonical = 0;
  for (const row of knowledgeRows) {
    const count = safeCount(row.count, `Knowledge ${row.status}`);
    knowledgeTotal += count;
    switch (row.status) {
      case "READY":
        statusCounts.ready += count;
        break;
      case "NEEDS_REVIEW":
        statusCounts.needsReview += count;
        break;
      case "PENDING":
        statusCounts.pending += count;
        break;
      case "PROCESSING":
        statusCounts.processing += count;
        break;
      case "FAILED":
        statusCounts.failed += count;
        break;
      case "BLOCKED":
        statusCounts.blocked += count;
        break;
      default:
        throw new Error(`Unsupported Knowledge V2 status in readiness query: ${row.status}`);
    }
    if (canonicalCategories.has(row.categoryGroup)) {
      countsByCategory[row.categoryGroup] += count;
    } else {
      nonCanonical += count;
    }
  }

  const embeddingRow = embeddingRows[0];
  const outbox = {
    pending: 0,
    processing: 0,
    retry: 0,
    completed: 0,
    deadLetter: 0,
    backlog: 0,
  };
  for (const row of outboxRows) {
    const count = safeCount(row.count, `Knowledge outbox ${row.status}`);
    switch (row.status) {
      case "PENDING":
        outbox.pending += count;
        break;
      case "PROCESSING":
        outbox.processing += count;
        break;
      case "RETRY":
        outbox.retry += count;
        break;
      case "COMPLETED":
        outbox.completed += count;
        break;
      case "DEAD_LETTER":
        outbox.deadLetter += count;
        break;
      default:
        throw new Error(`Unsupported Knowledge V2 outbox status in readiness query: ${row.status}`);
    }
  }
  outbox.backlog = outbox.pending + outbox.processing + outbox.retry;

  const catalogStable = Boolean(
    catalogBefore.available &&
      catalogAfter.available &&
      catalogBefore.fingerprint &&
      catalogBefore.fingerprint === catalogAfter.fingerprint &&
      catalogBefore.revision !== null &&
      catalogBefore.revision === catalogAfter.revision
  );
  const facts: Omit<ShopAiV2DataReadinessSnapshot, "passed" | "errors"> = {
    schemaVersion: SHOP_AI_V2_DATA_READINESS_SCHEMA_VERSION,
    checkedAt: now.toISOString(),
    catalogStable,
    catalogFingerprint: catalogAfter.fingerprint,
    catalogRevision: catalogAfter.revision?.toString() ?? null,
    embeddingModel: SHOP_KNOWLEDGE_CHUNK_EMBEDDING_MODEL,
    knowledge: {
      total: knowledgeTotal,
      ...statusCounts,
      nonCanonical,
    },
    embeddings: {
      totalChunks: safeCount(embeddingRow?.totalChunks, "Knowledge chunks"),
      currentChunks: safeCount(embeddingRow?.currentChunks, "Current embeddings"),
      pendingChunks: safeCount(embeddingRow?.pendingChunks, "Pending embeddings"),
    },
    outbox,
    staleProcessingRuns: safeCount(staleRunRows[0]?.count, "Stale OneAI runs"),
    countsByCategory,
  };
  const validation = evaluateShopAiV2DataReadinessFacts(facts, catalogAfter.fingerprint);

  return {
    ...facts,
    passed: validation.ok,
    errors: validation.errors,
  };
}
