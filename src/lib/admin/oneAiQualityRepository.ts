import "server-only";

import type { PrismaClient } from "@prisma/client";

import type {
  OneAiFeedbackItem,
  OneAiIndexJob,
  OneAiCategoryMetric,
  OneAiQualityOverview,
  OneAiQualitySnapshot,
  OneAiQueryTrace,
  OneAiReviewTask,
} from "@/lib/admin/oneAiQualityTypes";
import { SHOP_KNOWLEDGE_CHUNK_EMBEDDING_MODEL } from "@/lib/shopKnowledgeV2/embeddings";

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
  pendingKnowledge: number;
  processingKnowledge: number;
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
  pipeline: string | null;
  retrievalPath: string | null;
  providerModel: string | null;
  plannerLatencyMs: number | null;
  degradedReason: string | null;
  retrievalLatencyMs: number | null;
  totalLatencyMs: number | null;
  activeCpuMs: number | null;
  errorCode: string | null;
  createdAt: Date;
};

type CategoryMetricRow = OneAiCategoryMetric;

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
    pendingKnowledge: 0,
    processingKnowledge: 0,
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
      WITH current_knowledge AS (
        SELECT
          knowledge."sourceUpdatedAt",
          product."updatedAt" AS "productUpdatedAt",
          revision."status"::text AS "currentStatus"
        FROM "ShopProductKnowledge" knowledge
        INNER JOIN "ShopProduct" product ON product."id" = knowledge."productId"
        INNER JOIN "ShopKnowledgeRevision" revision
          ON revision."knowledgeId" = knowledge."id"
         AND revision."revision" = knowledge."revision"
        WHERE product."isPublished" = true
          AND product."status" = 'ACTIVE'
          AND knowledge."schemaVersion" >= 2
      ),
      knowledge_overview AS (
        SELECT
          COUNT(*)::int AS "knowledgeRecords",
          COUNT(*) FILTER (WHERE "currentStatus" = 'READY')::int AS "readyKnowledge",
          COUNT(*) FILTER (WHERE "currentStatus" = 'NEEDS_REVIEW')::int AS "needsReviewKnowledge",
          COUNT(*) FILTER (WHERE "currentStatus" = 'PENDING')::int AS "pendingKnowledge",
          COUNT(*) FILTER (WHERE "currentStatus" = 'PROCESSING')::int AS "processingKnowledge",
          COUNT(*) FILTER (WHERE "currentStatus" = 'FAILED')::int AS "failedKnowledge",
          COUNT(*) FILTER (WHERE "currentStatus" = 'BLOCKED')::int AS "blockedKnowledge",
          COUNT(*) FILTER (
            WHERE "sourceUpdatedAt" IS NULL OR "sourceUpdatedAt" < "productUpdatedAt"
          )::int AS "staleKnowledge"
        FROM current_knowledge
      )
      SELECT
        knowledge_overview.*,
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
      FROM knowledge_overview
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
      "pipeline",
      "retrievalPath",
      "providerModel",
      "plannerLatencyMs",
      "degradedReason",
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

async function loadCategoryMetrics(client: PrismaClient): Promise<OneAiCategoryMetric[]> {
  return client.$queryRaw<CategoryMetricRow[]>`
    WITH categories("categoryGroup") AS (
      VALUES
        ('chipTuning'), ('exhaust'), ('brakes'), ('suspension'),
        ('cooling'), ('performance'), ('motoCarbon'), ('carbonAero'),
        ('wheels'), ('lighting'), ('interior'), ('accessories'), ('merch')
    ),
    current_knowledge AS (
      SELECT
        knowledge."id",
        knowledge."revision",
        COALESCE(
          NULLIF(revision."snapshot"->>'categoryGroup', ''),
          knowledge."categoryGroup",
          'other'
        ) AS "categoryGroup",
        revision."status"::text AS "status"
      FROM "ShopProductKnowledge" knowledge
      JOIN "ShopKnowledgeRevision" revision
        ON revision."knowledgeId" = knowledge."id"
       AND revision."revision" = knowledge."revision"
      JOIN "ShopProduct" product ON product."id" = knowledge."productId"
      WHERE product."isPublished" = true
        AND product."status"::text = 'ACTIVE'
        AND knowledge."schemaVersion" >= 2
    ),
    knowledge_metrics AS (
      SELECT
        knowledge."categoryGroup",
        COUNT(*) FILTER (WHERE knowledge."status"::text = 'READY')::int AS "readyKnowledge",
        COUNT(*) FILTER (WHERE knowledge."status"::text = 'NEEDS_REVIEW')::int AS "needsReviewKnowledge"
      FROM current_knowledge knowledge
      WHERE knowledge."categoryGroup" <> 'other'
      GROUP BY knowledge."categoryGroup"
    ),
    embedding_metrics AS (
      SELECT
        knowledge."categoryGroup",
        COUNT(*)::int AS "embeddingBacklog"
      FROM "ShopKnowledgeChunk" chunk
      JOIN current_knowledge knowledge
        ON knowledge."id" = chunk."knowledgeId"
       AND knowledge."revision" = chunk."revision"
      WHERE knowledge."categoryGroup" <> 'other'
        AND (
          chunk."embedding" IS NULL
          OR chunk."embeddingModel" IS DISTINCT FROM ${SHOP_KNOWLEDGE_CHUNK_EMBEDDING_MODEL}
        )
      GROUP BY knowledge."categoryGroup"
    ),
    application_metrics AS (
      SELECT
        knowledge."categoryGroup",
        COUNT(*)::int AS "verifiedApplications"
      FROM "ShopVehicleApplication" application
      JOIN "ShopProductKnowledge" knowledge ON knowledge."id" = application."knowledgeId"
      WHERE application."revision" = knowledge."activeRevision"
        AND application."isActive" = true
        AND application."verificationStatus"::text = 'VERIFIED'
        AND application."source"::text IN ('MANAGER', 'MANUAL_OVERRIDE', 'SUPPLIER')
        AND EXISTS (
          SELECT 1
          FROM "ShopKnowledgeEvidence" evidence
          WHERE evidence."vehicleApplicationId" = application."id"
            AND evidence."knowledgeId" = knowledge."id"
            AND evidence."revision" = knowledge."activeRevision"
            AND evidence."isActive" = true
            AND (
              (
                application."source"::text = 'MANAGER'
                AND evidence."source"::text = 'MANAGER'
                AND evidence."isManagerVerified" = true
                AND evidence."verifiedById" IS NOT NULL
                AND evidence."verifiedAt" IS NOT NULL
                AND evidence."fieldPath" LIKE 'vehicleApplications.%'
                AND evidence."extractorVersion" LIKE 'admin-%'
              )
              OR (
                application."source"::text = 'MANUAL_OVERRIDE'
                AND evidence."source"::text = 'MANUAL_OVERRIDE'
                AND evidence."verifiedById" IS NOT NULL
                AND evidence."verifiedAt" IS NOT NULL
              )
              OR (
                application."source"::text = 'SUPPLIER'
                AND evidence."source"::text = 'SUPPLIER'
              )
            )
        )
        AND knowledge."categoryGroup" <> 'other'
      GROUP BY knowledge."categoryGroup"
    ),
    run_base AS (
      SELECT
        run."id",
        run."constraints"->>'category' AS "categoryGroup",
        run."mode"::text AS "mode",
        run."exactCount",
        run."verificationCount",
        run."degraded",
        run."totalLatencyMs"
      FROM "ShopAiRun" run
      WHERE run."createdAt" >= CURRENT_TIMESTAMP - INTERVAL '30 days'
        AND run."status"::text IN ('COMPLETED', 'FAILED')
    ),
    run_events AS (
      SELECT
        feedback."runId",
        BOOL_OR(feedback."signal"::text = 'CLICK') AS "clicked",
        BOOL_OR(feedback."signal"::text = 'MANAGER_HANDOFF') AS "handedOff",
        BOOL_OR(feedback."signal"::text = 'ADD_TO_CART') AS "addedToCart",
        BOOL_OR(feedback."signal"::text = 'ORDER_COMPLETED') AS "ordered"
      FROM "ShopAiFeedback" feedback
      WHERE feedback."runId" IS NOT NULL
        AND feedback."createdAt" >= CURRENT_TIMESTAMP - INTERVAL '30 days'
      GROUP BY feedback."runId"
    ),
    run_metrics AS (
      SELECT
        run."categoryGroup",
        COUNT(*)::int AS "runs",
        (
          COUNT(*) FILTER (WHERE run."exactCount" > 0)::double precision
          / NULLIF(COUNT(*), 0)
        ) AS "exactRate",
        (
          COUNT(*) FILTER (WHERE run."verificationCount" > 0)::double precision
          / NULLIF(COUNT(*), 0)
        ) AS "reviewableRate",
        (
          COUNT(*) FILTER (WHERE run."mode" = 'NO_MATCH')::double precision
          / NULLIF(COUNT(*), 0)
        ) AS "noMatchRate",
        (
          COUNT(*) FILTER (WHERE run."degraded")::double precision
          / NULLIF(COUNT(*), 0)
        ) AS "degradedRate",
        (
          percentile_cont(0.5) WITHIN GROUP (ORDER BY run."totalLatencyMs")
            FILTER (WHERE run."totalLatencyMs" IS NOT NULL)
        )::double precision AS "p50LatencyMs",
        (
          percentile_cont(0.95) WITHIN GROUP (ORDER BY run."totalLatencyMs")
            FILTER (WHERE run."totalLatencyMs" IS NOT NULL)
        )::double precision AS "p95LatencyMs",
        (
          COUNT(*) FILTER (WHERE COALESCE(events."clicked", false))::double precision
          / NULLIF(COUNT(*), 0)
        ) AS "ctr",
        (
          COUNT(*) FILTER (WHERE COALESCE(events."handedOff", false))::double precision
          / NULLIF(COUNT(*), 0)
        ) AS "handoffRate",
        (
          COUNT(*) FILTER (WHERE COALESCE(events."addedToCart", false))::double precision
          / NULLIF(COUNT(*), 0)
        ) AS "addToCartRate",
        (
          COUNT(*) FILTER (WHERE COALESCE(events."ordered", false))::double precision
          / NULLIF(COUNT(*) FILTER (WHERE COALESCE(events."addedToCart", false)), 0)
        ) AS "orderConversionRate"
      FROM run_base run
      LEFT JOIN run_events events ON events."runId" = run."id"
      GROUP BY run."categoryGroup"
    )
    SELECT
      categories."categoryGroup",
      COALESCE(knowledge."readyKnowledge", 0)::int AS "readyKnowledge",
      COALESCE(knowledge."needsReviewKnowledge", 0)::int AS "needsReviewKnowledge",
      COALESCE(embedding."embeddingBacklog", 0)::int AS "embeddingBacklog",
      COALESCE(applications."verifiedApplications", 0)::int AS "verifiedApplications",
      COALESCE(runs."runs", 0)::int AS "runs",
      runs."exactRate",
      runs."reviewableRate",
      runs."noMatchRate",
      runs."degradedRate",
      runs."p50LatencyMs",
      runs."p95LatencyMs",
      runs."ctr",
      runs."handoffRate",
      runs."addToCartRate",
      runs."orderConversionRate"
    FROM categories
    LEFT JOIN knowledge_metrics knowledge
      ON knowledge."categoryGroup" = categories."categoryGroup"
    LEFT JOIN embedding_metrics embedding
      ON embedding."categoryGroup" = categories."categoryGroup"
    LEFT JOIN application_metrics applications
      ON applications."categoryGroup" = categories."categoryGroup"
    LEFT JOIN run_metrics runs
      ON runs."categoryGroup" = categories."categoryGroup"
    ORDER BY categories."categoryGroup"
  `;
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
      categoryMetrics: [],
    };
  }

  try {
    const [overview, reviewQueue, feedback, queryTraces, indexJobs, categoryMetrics] =
      await Promise.all([
        loadOverview(client, activePublishedProducts),
        loadReviewQueue(client),
        loadFeedback(client),
        loadQueryTraces(client),
        loadIndexJobs(client),
        loadCategoryMetrics(client),
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
      categoryMetrics,
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
      categoryMetrics: [],
    };
  }
}
