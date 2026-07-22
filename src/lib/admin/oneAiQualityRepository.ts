import "server-only";

import type { PrismaClient } from "@prisma/client";

import type {
  OneAiFeedbackItem,
  OneAiIndexJob,
  OneAiQualityOverview,
  OneAiQualitySnapshot,
  OneAiQueryTrace,
  OneAiReviewTask,
} from "@/lib/admin/oneAiQualityTypes";

const REQUIRED_TABLES = [
  "ShopProductKnowledge",
  "ShopVehicleApplication",
  "ShopVariantKnowledge",
  "ShopKnowledgeChunk",
  "ShopProductAttributeDefinition",
  "ShopProductAttributeValue",
  "VehicleGeneration",
  "VehicleAlias",
  "ShopKnowledgeEvidence",
  "ShopKnowledgeRevision",
  "ShopKnowledgeOutbox",
  "ShopKnowledgeReviewTask",
  "ShopAiRun",
  "ShopAiCandidateDecision",
  "ShopAiFeedback",
  "ShopAiEvaluationRun",
] as const;

type CountRow = {
  count: number;
};

type MissingTableRow = {
  name: string;
};

type OverviewRow = {
  knowledgeRecords: number;
  readyKnowledge: number;
  needsReviewKnowledge: number;
  failedKnowledge: number;
  blockedKnowledge: number;
  staleKnowledge: number;
  openReviewTasks: number;
  newFeedback: number;
  runsLast24Hours: number;
  failedRunsLast24Hours: number;
  pendingJobs: number;
  retryJobs: number;
  deadLetterJobs: number;
};

type EvaluationRow = {
  suiteName: string;
  suiteVersion: string;
  status: string;
  passedCases: number;
  totalCases: number;
  recallAt20: number | null;
  noMatchAccuracy: number | null;
  completedAt: Date | null;
};

type ReviewTaskRow = {
  id: string;
  taskType: string;
  status: string;
  priority: string;
  title: string;
  reasonCodes: string[];
  productId: string | null;
  productTitle: string;
  productSku: string | null;
  assignedToId: string | null;
  createdAt: Date;
  dueAt: Date | null;
};

type FeedbackRow = {
  id: string;
  signal: string;
  reason: string | null;
  status: string;
  comment: string | null;
  productId: string | null;
  runId: string | null;
  redactedQuery: string | null;
  createdAt: Date;
};

type QueryTraceRow = {
  id: string;
  requestId: string | null;
  locale: string;
  scope: string | null;
  redactedQuery: string;
  status: string;
  mode: string | null;
  constraints: unknown;
  exactCount: number;
  verificationCount: number;
  candidateCount: number;
  acceptedCount: number;
  degraded: boolean;
  retrievalLatencyMs: number | null;
  totalLatencyMs: number | null;
  activeCpuMs: number | null;
  errorCode: string | null;
  createdAt: Date;
};

type IndexJobRow = {
  id: string;
  eventType: string;
  status: string;
  productId: string;
  productTitle: string;
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  lockedAt: Date | null;
  processedAt: Date | null;
  lastError: string | null;
  updatedAt: Date;
};

function emptyOverview(activePublishedProducts: number): OneAiQualityOverview {
  return {
    activePublishedProducts,
    knowledgeRecords: 0,
    readyKnowledge: 0,
    needsReviewKnowledge: 0,
    failedKnowledge: 0,
    blockedKnowledge: 0,
    coveragePercent: 0,
    staleKnowledge: 0,
    openReviewTasks: 0,
    newFeedback: 0,
    runsLast24Hours: 0,
    failedRunsLast24Hours: 0,
    pendingJobs: 0,
    retryJobs: 0,
    deadLetterJobs: 0,
    lastEvaluation: null,
  };
}

function isSchemaNotReadyError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const candidate = error as {
    code?: string;
    message?: string;
    meta?: { code?: string; message?: string };
  };
  const message = `${candidate.message ?? ""} ${candidate.meta?.message ?? ""}`.toLowerCase();

  return (
    candidate.code === "P2021" ||
    candidate.meta?.code === "42P01" ||
    message.includes("does not exist") ||
    message.includes("undefined table")
  );
}

async function getActivePublishedProductCount(client: PrismaClient) {
  const rows = await client.$queryRaw<CountRow[]>`
    SELECT COUNT(*)::int AS "count"
    FROM "ShopProduct"
    WHERE "isPublished" = true
      AND "status" = 'ACTIVE'
  `;

  return rows[0]?.count ?? 0;
}

async function findMissingTables(client: PrismaClient) {
  const rows = await client.$queryRaw<MissingTableRow[]>`
    SELECT required."name"
    FROM unnest(ARRAY[
      'ShopProductKnowledge',
      'ShopVehicleApplication',
      'ShopVariantKnowledge',
      'ShopKnowledgeChunk',
      'ShopProductAttributeDefinition',
      'ShopProductAttributeValue',
      'VehicleGeneration',
      'VehicleAlias',
      'ShopKnowledgeEvidence',
      'ShopKnowledgeRevision',
      'ShopKnowledgeOutbox',
      'ShopKnowledgeReviewTask',
      'ShopAiRun',
      'ShopAiCandidateDecision',
      'ShopAiFeedback',
      'ShopAiEvaluationRun'
    ]) AS required("name")
    WHERE to_regclass(format('%I', required."name")) IS NULL
    ORDER BY required."name"
  `;

  const knownTables = new Set<string>(REQUIRED_TABLES);
  return rows.map((row) => row.name).filter((name) => knownTables.has(name));
}

async function loadOverview(client: PrismaClient, activePublishedProducts: number) {
  const [overviewRows, evaluationRows] = await Promise.all([
    client.$queryRaw<OverviewRow[]>`
      SELECT
        (
          SELECT COUNT(*)::int
          FROM "ShopProductKnowledge" knowledge
          INNER JOIN "ShopProduct" product ON product."id" = knowledge."productId"
          WHERE product."isPublished" = true
            AND product."status" = 'ACTIVE'
            AND knowledge."schemaVersion" >= 2
        ) AS "knowledgeRecords",
        (
          SELECT COUNT(*)::int
          FROM "ShopProductKnowledge" knowledge
          INNER JOIN "ShopProduct" product ON product."id" = knowledge."productId"
          WHERE product."isPublished" = true
            AND product."status" = 'ACTIVE'
            AND knowledge."schemaVersion" >= 2
            AND knowledge."status" = 'READY'
        ) AS "readyKnowledge",
        (
          SELECT COUNT(*)::int
          FROM "ShopProductKnowledge" knowledge
          INNER JOIN "ShopProduct" product ON product."id" = knowledge."productId"
          WHERE product."isPublished" = true
            AND product."status" = 'ACTIVE'
            AND knowledge."schemaVersion" >= 2
            AND knowledge."status" = 'NEEDS_REVIEW'
        ) AS "needsReviewKnowledge",
        (
          SELECT COUNT(*)::int
          FROM "ShopProductKnowledge" knowledge
          INNER JOIN "ShopProduct" product ON product."id" = knowledge."productId"
          WHERE product."isPublished" = true
            AND product."status" = 'ACTIVE'
            AND knowledge."schemaVersion" >= 2
            AND knowledge."status" = 'FAILED'
        ) AS "failedKnowledge",
        (
          SELECT COUNT(*)::int
          FROM "ShopProductKnowledge" knowledge
          INNER JOIN "ShopProduct" product ON product."id" = knowledge."productId"
          WHERE product."isPublished" = true
            AND product."status" = 'ACTIVE'
            AND knowledge."schemaVersion" >= 2
            AND knowledge."status" = 'BLOCKED'
        ) AS "blockedKnowledge",
        (
          SELECT COUNT(*)::int
          FROM "ShopProductKnowledge" knowledge
          INNER JOIN "ShopProduct" product ON product."id" = knowledge."productId"
          WHERE product."isPublished" = true
            AND product."status" = 'ACTIVE'
            AND knowledge."schemaVersion" >= 2
            AND (
              knowledge."sourceUpdatedAt" IS NULL
              OR knowledge."sourceUpdatedAt" < product."updatedAt"
            )
        ) AS "staleKnowledge",
        (
          SELECT COUNT(*)::int
          FROM "ShopKnowledgeReviewTask"
          WHERE "status" IN ('OPEN', 'IN_REVIEW')
        ) AS "openReviewTasks",
        (SELECT COUNT(*)::int FROM "ShopAiFeedback" WHERE "status" = 'NEW') AS "newFeedback",
        (
          SELECT COUNT(*)::int
          FROM "ShopAiRun"
          WHERE "createdAt" >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
        ) AS "runsLast24Hours",
        (
          SELECT COUNT(*)::int
          FROM "ShopAiRun"
          WHERE "createdAt" >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
            AND "status" = 'FAILED'
        ) AS "failedRunsLast24Hours",
        (SELECT COUNT(*)::int FROM "ShopKnowledgeOutbox" WHERE "status" = 'PENDING') AS "pendingJobs",
        (SELECT COUNT(*)::int FROM "ShopKnowledgeOutbox" WHERE "status" = 'RETRY') AS "retryJobs",
        (SELECT COUNT(*)::int FROM "ShopKnowledgeOutbox" WHERE "status" = 'DEAD_LETTER') AS "deadLetterJobs"
    `,
    client.$queryRaw<EvaluationRow[]>`
      SELECT
        "suiteName",
        "suiteVersion",
        "status"::text AS "status",
        "passedCases",
        "totalCases",
        "recallAt20",
        "noMatchAccuracy",
        "completedAt"
      FROM "ShopAiEvaluationRun"
      ORDER BY COALESCE("completedAt", "createdAt") DESC
      LIMIT 1
    `,
  ]);

  const row = overviewRows[0];
  if (!row) return emptyOverview(activePublishedProducts);

  return {
    activePublishedProducts,
    ...row,
    coveragePercent:
      activePublishedProducts > 0
        ? Math.min(100, Math.round((row.knowledgeRecords / activePublishedProducts) * 10_000) / 100)
        : 100,
    lastEvaluation: evaluationRows[0]
      ? {
          ...evaluationRows[0],
          completedAt: evaluationRows[0].completedAt?.toISOString() ?? null,
        }
      : null,
  } satisfies OneAiQualityOverview;
}

async function loadReviewQueue(client: PrismaClient): Promise<OneAiReviewTask[]> {
  const rows = await client.$queryRaw<ReviewTaskRow[]>`
    SELECT
      task."id",
      task."taskType",
      task."status"::text AS "status",
      task."priority"::text AS "priority",
      task."title",
      task."reasonCodes",
      task."productId",
      COALESCE(
        NULLIF(product."titleUa", ''),
        NULLIF(product."titleEn", ''),
        task."productId",
        'Запит без прив’язаного товару'
      ) AS "productTitle",
      product."sku" AS "productSku",
      task."assignedToId",
      task."createdAt",
      task."dueAt"
    FROM "ShopKnowledgeReviewTask" task
    LEFT JOIN "ShopProduct" product ON product."id" = task."productId"
    WHERE task."status" IN ('OPEN', 'IN_REVIEW')
    ORDER BY
      CASE task."priority"
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        ELSE 4
      END,
      task."createdAt" ASC
    LIMIT 50
  `;

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    dueAt: row.dueAt?.toISOString() ?? null,
  }));
}

async function loadFeedback(client: PrismaClient): Promise<OneAiFeedbackItem[]> {
  const rows = await client.$queryRaw<FeedbackRow[]>`
    SELECT
      feedback."id",
      feedback."signal"::text AS "signal",
      feedback."reason"::text AS "reason",
      feedback."status"::text AS "status",
      LEFT(feedback."comment", 500) AS "comment",
      feedback."productId",
      feedback."runId",
      run."redactedQuery",
      feedback."createdAt"
    FROM "ShopAiFeedback" feedback
    LEFT JOIN "ShopAiRun" run ON run."id" = feedback."runId"
    ORDER BY
      CASE feedback."status"
        WHEN 'NEW' THEN 1
        WHEN 'REVIEWED' THEN 2
        ELSE 3
      END,
      feedback."createdAt" DESC
    LIMIT 50
  `;

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

async function loadQueryTraces(client: PrismaClient): Promise<OneAiQueryTrace[]> {
  const rows = await client.$queryRaw<QueryTraceRow[]>`
    SELECT
      "id",
      "requestId",
      "locale",
      "scope",
      "redactedQuery",
      "status"::text AS "status",
      "mode"::text AS "mode",
      "constraints",
      "exactCount",
      "verificationCount",
      "candidateCount",
      "acceptedCount",
      "degraded",
      "retrievalLatencyMs",
      "totalLatencyMs",
      "activeCpuMs",
      "errorCode",
      "createdAt"
    FROM "ShopAiRun"
    ORDER BY "createdAt" DESC
    LIMIT 50
  `;

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

async function loadIndexJobs(client: PrismaClient): Promise<OneAiIndexJob[]> {
  const rows = await client.$queryRaw<IndexJobRow[]>`
    SELECT
      job."id",
      job."eventType",
      job."status"::text AS "status",
      job."productId",
      COALESCE(NULLIF(product."titleUa", ''), product."titleEn", job."productId") AS "productTitle",
      job."attempts",
      job."maxAttempts",
      job."availableAt",
      job."lockedAt",
      job."processedAt",
      LEFT(job."lastError", 500) AS "lastError",
      job."updatedAt"
    FROM "ShopKnowledgeOutbox" job
    INNER JOIN "ShopProduct" product ON product."id" = job."productId"
    ORDER BY
      CASE job."status"
        WHEN 'DEAD_LETTER' THEN 1
        WHEN 'RETRY' THEN 2
        WHEN 'PENDING' THEN 3
        WHEN 'PROCESSING' THEN 4
        ELSE 5
      END,
      job."updatedAt" DESC
    LIMIT 50
  `;

  return rows.map((row) => ({
    ...row,
    availableAt: row.availableAt.toISOString(),
    lockedAt: row.lockedAt?.toISOString() ?? null,
    processedAt: row.processedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function getOneAiQualitySnapshot(client: PrismaClient): Promise<OneAiQualitySnapshot> {
  const checkedAt = new Date().toISOString();
  const activePublishedProducts = await getActivePublishedProductCount(client);
  const missingTables = await findMissingTables(client);

  if (missingTables.length > 0) {
    return {
      ready: false,
      checkedAt,
      missingTables,
      overview: emptyOverview(activePublishedProducts),
      reviewQueue: [],
      feedback: [],
      queryTraces: [],
      indexJobs: [],
    };
  }

  try {
    const [overview, reviewQueue, feedback, queryTraces, indexJobs] = await Promise.all([
      loadOverview(client, activePublishedProducts),
      loadReviewQueue(client),
      loadFeedback(client),
      loadQueryTraces(client),
      loadIndexJobs(client),
    ]);

    return {
      ready: true,
      checkedAt,
      missingTables: [],
      overview,
      reviewQueue,
      feedback,
      queryTraces,
      indexJobs,
    };
  } catch (error) {
    if (!isSchemaNotReadyError(error)) throw error;

    return {
      ready: false,
      checkedAt,
      missingTables: [...REQUIRED_TABLES],
      overview: emptyOverview(activePublishedProducts),
      reviewQueue: [],
      feedback: [],
      queryTraces: [],
      indexJobs: [],
    };
  }
}
