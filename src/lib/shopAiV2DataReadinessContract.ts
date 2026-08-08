import { SHOP_AI_V2_ROLLOUT_CATEGORIES } from "./shopAiV2RolloutContract";
import { SHOP_KNOWLEDGE_CHUNK_EMBEDDING_MODEL } from "./shopKnowledgeV2/embeddings";

export const SHOP_AI_V2_DATA_READINESS_SCHEMA_VERSION = 1;

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export type ShopAiV2DataReadinessSnapshot = {
  schemaVersion: typeof SHOP_AI_V2_DATA_READINESS_SCHEMA_VERSION;
  checkedAt: string;
  catalogStable: boolean;
  catalogFingerprint: string | null;
  catalogRevision: string | null;
  embeddingModel: string;
  knowledge: {
    total: number;
    ready: number;
    needsReview: number;
    pending: number;
    processing: number;
    failed: number;
    blocked: number;
    nonCanonical: number;
  };
  embeddings: {
    totalChunks: number;
    currentChunks: number;
    pendingChunks: number;
  };
  outbox: {
    pending: number;
    processing: number;
    retry: number;
    completed: number;
    deadLetter: number;
    backlog: number;
  };
  staleProcessingRuns: number;
  countsByCategory: Record<string, number>;
  passed: boolean;
  errors: string[];
};

export type ShopAiV2DataReadinessValidation = {
  ok: boolean;
  errors: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeFingerprint(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return SHA256_PATTERN.test(normalized) ? normalized : null;
}

function isCanonicalIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function readCount(
  record: Record<string, unknown> | null,
  field: string,
  label: string,
  errors: string[]
) {
  const value = record?.[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    errors.push(`${label} must be a non-negative safe integer`);
    return null;
  }
  return value;
}

/**
 * Independently evaluates the factual readiness fields. It intentionally does
 * not trust the endpoint's `passed` or `errors` fields; marker issuance calls
 * this evaluator again over the persisted release report.
 */
export function evaluateShopAiV2DataReadinessFacts(
  value: unknown,
  expectedCatalogFingerprint?: string | null
): ShopAiV2DataReadinessValidation {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { ok: false, errors: ["data readiness snapshot must be an object"] };
  }

  if (value.schemaVersion !== SHOP_AI_V2_DATA_READINESS_SCHEMA_VERSION) {
    errors.push(`data readiness schemaVersion must be ${SHOP_AI_V2_DATA_READINESS_SCHEMA_VERSION}`);
  }
  if (!isCanonicalIsoDate(value.checkedAt)) {
    errors.push("data readiness checkedAt must be a canonical UTC timestamp");
  }
  if (value.catalogStable !== true) {
    errors.push("Knowledge V2 catalog changed while data readiness was being measured");
  }

  const fingerprint = normalizeFingerprint(value.catalogFingerprint);
  const expectedFingerprint = normalizeFingerprint(expectedCatalogFingerprint);
  if (!fingerprint) {
    errors.push("data readiness is missing a valid Knowledge V2 catalog fingerprint");
  } else if (expectedCatalogFingerprint !== undefined && fingerprint !== expectedFingerprint) {
    errors.push("data readiness was measured against a different catalog fingerprint");
  }
  if (typeof value.catalogRevision !== "string" || !/^[1-9][0-9]*$/.test(value.catalogRevision)) {
    errors.push("data readiness is missing a valid positive catalog revision");
  }
  if (value.embeddingModel !== SHOP_KNOWLEDGE_CHUNK_EMBEDDING_MODEL) {
    errors.push(`data readiness embedding model must be ${SHOP_KNOWLEDGE_CHUNK_EMBEDDING_MODEL}`);
  }

  const knowledge = isRecord(value.knowledge) ? value.knowledge : null;
  const knowledgeTotal = readCount(knowledge, "total", "knowledge.total", errors);
  const ready = readCount(knowledge, "ready", "knowledge.ready", errors);
  const needsReview = readCount(knowledge, "needsReview", "knowledge.needsReview", errors);
  const pending = readCount(knowledge, "pending", "knowledge.pending", errors);
  const processing = readCount(knowledge, "processing", "knowledge.processing", errors);
  const failed = readCount(knowledge, "failed", "knowledge.failed", errors);
  const blocked = readCount(knowledge, "blocked", "knowledge.blocked", errors);
  const nonCanonical = readCount(knowledge, "nonCanonical", "knowledge.nonCanonical", errors);
  const statusCounts = [ready, needsReview, pending, processing, failed, blocked];
  if (knowledgeTotal !== null && knowledgeTotal < 1) {
    errors.push("data readiness must include at least one current Knowledge V2 revision");
  }
  if (
    knowledgeTotal !== null &&
    statusCounts.every((count) => count !== null) &&
    statusCounts.reduce((sum, count) => sum + Number(count), 0) !== knowledgeTotal
  ) {
    errors.push("current Knowledge V2 status counts do not add up to knowledge.total");
  }
  if (
    knowledgeTotal !== null &&
    ready !== null &&
    needsReview !== null &&
    ready + needsReview !== knowledgeTotal
  ) {
    errors.push("all current Knowledge V2 revisions must be READY or NEEDS_REVIEW");
  }
  for (const [label, count] of [
    ["PENDING", pending],
    ["PROCESSING", processing],
    ["FAILED", failed],
    ["BLOCKED", blocked],
  ] as const) {
    if (count !== null && count !== 0) {
      errors.push(`current Knowledge V2 ${label} count must be zero`);
    }
  }
  if (nonCanonical !== null && nonCanonical !== 0) {
    errors.push("non-canonical and `other` records must not be enabled in Knowledge V2");
  }

  const embeddings = isRecord(value.embeddings) ? value.embeddings : null;
  const totalChunks = readCount(embeddings, "totalChunks", "embeddings.totalChunks", errors);
  const currentChunks = readCount(embeddings, "currentChunks", "embeddings.currentChunks", errors);
  const pendingChunks = readCount(embeddings, "pendingChunks", "embeddings.pendingChunks", errors);
  if (totalChunks !== null && totalChunks < 1) {
    errors.push("data readiness must include current Knowledge V2 chunks");
  }
  if (
    totalChunks !== null &&
    currentChunks !== null &&
    pendingChunks !== null &&
    currentChunks + pendingChunks !== totalChunks
  ) {
    errors.push("embedding counts do not add up to embeddings.totalChunks");
  }
  if (pendingChunks !== null && pendingChunks !== 0) {
    errors.push("current Knowledge V2 embedding backlog must be zero");
  }

  const outbox = isRecord(value.outbox) ? value.outbox : null;
  const outboxPending = readCount(outbox, "pending", "outbox.pending", errors);
  const outboxProcessing = readCount(outbox, "processing", "outbox.processing", errors);
  const outboxRetry = readCount(outbox, "retry", "outbox.retry", errors);
  readCount(outbox, "completed", "outbox.completed", errors);
  const deadLetter = readCount(outbox, "deadLetter", "outbox.deadLetter", errors);
  const backlog = readCount(outbox, "backlog", "outbox.backlog", errors);
  if (
    backlog !== null &&
    outboxPending !== null &&
    outboxProcessing !== null &&
    outboxRetry !== null &&
    backlog !== outboxPending + outboxProcessing + outboxRetry
  ) {
    errors.push("outbox backlog does not match PENDING + PROCESSING + RETRY");
  }
  if (backlog !== null && backlog !== 0) {
    errors.push("Knowledge V2 outbox backlog must be zero");
  }
  if (deadLetter !== null && deadLetter !== 0) {
    errors.push("Knowledge V2 DEAD_LETTER count must be zero");
  }

  const staleProcessingRuns =
    typeof value.staleProcessingRuns === "number" &&
    Number.isSafeInteger(value.staleProcessingRuns) &&
    value.staleProcessingRuns >= 0
      ? value.staleProcessingRuns
      : null;
  if (staleProcessingRuns === null) {
    errors.push("staleProcessingRuns must be a non-negative safe integer");
  } else if (staleProcessingRuns !== 0) {
    errors.push("stale OneAI PROCESSING runs must be finalized before release");
  }

  const countsByCategory = isRecord(value.countsByCategory) ? value.countsByCategory : null;
  if (!countsByCategory) {
    errors.push("data readiness is missing per-category Knowledge V2 counts");
  } else {
    const expectedCategories = new Set<string>(SHOP_AI_V2_ROLLOUT_CATEGORIES);
    const unexpectedCategories = Object.keys(countsByCategory).filter(
      (category) => !expectedCategories.has(category)
    );
    if (unexpectedCategories.length > 0) {
      errors.push("data readiness contains unexpected non-canonical category counters");
    }
    let categoryTotal = 0;
    let categoriesValid = true;
    for (const category of SHOP_AI_V2_ROLLOUT_CATEGORIES) {
      const count = readCount(countsByCategory, category, `countsByCategory.${category}`, errors);
      if (count === null) {
        categoriesValid = false;
      } else {
        categoryTotal += count;
        if (count < 1) {
          errors.push(`Knowledge V2 category ${category} must contain at least one current record`);
        }
      }
    }
    if (
      categoriesValid &&
      knowledgeTotal !== null &&
      nonCanonical !== null &&
      categoryTotal + nonCanonical !== knowledgeTotal
    ) {
      errors.push("per-category Knowledge V2 counts do not add up to knowledge.total");
    }
  }

  return { ok: errors.length === 0, errors: Array.from(new Set(errors)) };
}

export function validateShopAiV2DataReadinessSnapshot(
  value: unknown,
  expectedCatalogFingerprint?: string | null
): ShopAiV2DataReadinessValidation {
  const validation = evaluateShopAiV2DataReadinessFacts(value, expectedCatalogFingerprint);
  if (!isRecord(value)) return validation;

  const errors = [...validation.errors];
  if (value.passed !== true) {
    errors.push("data readiness snapshot did not pass");
  }
  if (!Array.isArray(value.errors) || value.errors.length > 0) {
    errors.push("data readiness snapshot contains reported errors");
  }
  return { ok: errors.length === 0, errors: Array.from(new Set(errors)) };
}
