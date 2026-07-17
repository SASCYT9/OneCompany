import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { redactShopAiText } from "@/lib/shopAiPrivacy";

export const SHOP_AI_TELEMETRY_MAX_MESSAGE_LENGTH = 800;
export const SHOP_AI_TELEMETRY_MAX_COMMENT_LENGTH = 500;
export const SHOP_AI_TELEMETRY_MAX_ERROR_LENGTH = 500;
export const SHOP_AI_TELEMETRY_MAX_CANDIDATES = 200;

const TELEMETRY_OWNER_KEY = "__ownerKeyHash";
const MAX_JSON_DEPTH = 5;
const MAX_JSON_ARRAY_ITEMS = 50;
const MAX_JSON_OBJECT_KEYS = 50;
const MAX_JSON_STRING_LENGTH = 800;
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/u;
const OWNER_KEY_PATTERN = /^[a-f0-9]{64}$/u;

export type ShopAiTelemetryJson =
  | null
  | boolean
  | number
  | string
  | ShopAiTelemetryJson[]
  | { [key: string]: ShopAiTelemetryJson };

export type ShopAiTelemetryLocale = "ua" | "en";
export type ShopAiTelemetryMode = "results" | "clarification" | "no_match";
export type ShopAiTelemetryMatchStatus = "exact" | "requires_verification" | "rejected";
export type ShopAiFeedbackRating = "up" | "down";
export type ShopAiFeedbackReason =
  | "wrong_fitment"
  | "wrong_category"
  | "irrelevant"
  | "missing_product"
  | "other";

export type ShopAiFeedbackPayload = {
  runId: string | null;
  conversationId: string | null;
  rating: ShopAiFeedbackRating;
  reason: ShopAiFeedbackReason | null;
  locale: ShopAiTelemetryLocale;
};

export type ParseShopAiFeedbackPayloadResult =
  | { ok: true; value: ShopAiFeedbackPayload }
  | { ok: false; error: string };

export type CreateShopAiRunInput = {
  requestId?: string | null;
  conversationId?: string | null;
  ownerKeyHash?: string | null;
  locale: ShopAiTelemetryLocale;
  currency: string;
  scope?: "auto" | "moto" | null;
  message: string;
  normalizedQuery?: string | null;
  constraints?: unknown;
  traceSampled?: boolean;
};

export type CompleteShopAiRunInput = {
  runId: string;
  mode: ShopAiTelemetryMode;
  response?: unknown;
  exactCount: number;
  verificationCount: number;
  candidateCount: number;
  acceptedCount: number;
  generationCalls: number;
  embeddingCalls: number;
  retrievalLatencyMs?: number | null;
  totalLatencyMs?: number | null;
  activeCpuMs?: number | null;
  degraded: boolean;
};

export type FailShopAiRunInput = {
  runId: string;
  errorCode: string;
  errorMessage?: string | null;
  totalLatencyMs?: number | null;
  activeCpuMs?: number | null;
  degraded?: boolean;
};

export type ShopAiCandidateDecisionInput = {
  productId: string;
  variantId?: string | null;
  vehicleApplicationId?: string | null;
  productSnapshot?: unknown;
  matchStatus: ShopAiTelemetryMatchStatus;
  rank?: number | null;
  lexicalScore?: number | null;
  semanticScore?: number | null;
  softScore?: number | null;
  totalScore?: number | null;
  reasonCodes?: string[];
  missingFacts?: string[];
  shown?: boolean;
};

export type RecordShopAiFeedbackInput = ShopAiFeedbackPayload & {
  ownerKeyHash?: string | null;
  comment?: string | null;
};

export type RecordShopAiNoResultInput = {
  runId?: string | null;
  conversationId?: string | null;
  ownerKeyHash?: string | null;
  locale: ShopAiTelemetryLocale;
};

export type ShopAiTelemetryResult<T> = {
  persisted: boolean;
  value: T | null;
};

type PersistedRunCreate = {
  requestId: string | null;
  conversationId: string | null;
  locale: ShopAiTelemetryLocale;
  currency: string;
  scope: "auto" | "moto" | null;
  redactedQuery: string;
  normalizedQuery: string | null;
  constraints: ShopAiTelemetryJson;
  traceSampled: boolean;
};

type PersistedRunComplete = {
  runId: string;
  mode: "RESULTS" | "CLARIFICATION" | "NO_MATCH";
  response: ShopAiTelemetryJson;
  exactCount: number;
  verificationCount: number;
  candidateCount: number;
  acceptedCount: number;
  generationCalls: number;
  embeddingCalls: number;
  retrievalLatencyMs: number | null;
  totalLatencyMs: number | null;
  activeCpuMs: number | null;
  degraded: boolean;
  traceSampled: boolean | null;
};

type PersistedRunFailure = {
  runId: string;
  errorCode: string;
  errorMessage: string | null;
  totalLatencyMs: number | null;
  activeCpuMs: number | null;
  degraded: boolean;
};

type PersistedCandidateDecision = {
  runId: string;
  productId: string;
  variantId: string | null;
  vehicleApplicationId: string | null;
  productSnapshot: ShopAiTelemetryJson;
  matchStatus: "EXACT" | "REQUIRES_VERIFICATION" | "REJECTED";
  rank: number | null;
  lexicalScore: number | null;
  semanticScore: number | null;
  softScore: number | null;
  totalScore: number | null;
  reasonCodes: string[];
  missingFacts: string[];
  shown: boolean;
};

type PersistedFeedback = {
  runId: string | null;
  conversationId: string | null;
  ownerKeyHash: string | null;
  signal: "THUMBS_UP" | "THUMBS_DOWN" | "NO_RESULT";
  reason: "WRONG_FITMENT" | "WRONG_CATEGORY" | "IRRELEVANT" | "MISSING_PRODUCT" | "OTHER" | null;
  comment: string | null;
  locale: ShopAiTelemetryLocale;
  createReviewTask: boolean;
};

export type PersistedShopAiFeedbackResult = {
  feedbackId: string;
  reviewTaskId: string | null;
  linkedToRun: boolean;
};

export type ShopAiTelemetryRepository = {
  createRun(input: PersistedRunCreate): Promise<string>;
  completeRun(input: PersistedRunComplete): Promise<boolean>;
  failRun(input: PersistedRunFailure): Promise<boolean>;
  createCandidateDecisions(input: PersistedCandidateDecision[]): Promise<number>;
  createFeedback(input: PersistedFeedback): Promise<PersistedShopAiFeedbackResult>;
};

function cleanObjectKey(value: string) {
  return value.replace(/[^\p{L}\p{N}_.:-]/gu, "").slice(0, 64);
}

function cleanInteger(value: number | null | undefined, maximum = 1_000_000) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(maximum, Math.max(0, Math.round(value ?? 0)));
}

function cleanOptionalInteger(value: number | null | undefined, maximum = 1_000_000) {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.min(maximum, Math.max(0, Math.round(value)));
}

function cleanOptionalScore(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(-1_000_000, Math.min(1_000_000, value));
}

function cleanStringList(values: string[] | undefined, maximum = 30) {
  if (!values) return [];
  return Array.from(
    new Set(values.map((value) => redactShopAiText(value, 100).text).filter(Boolean))
  ).slice(0, maximum);
}

function singleCandidateFromRunResponse(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const products = (value as Record<string, Prisma.JsonValue>).products;
  if (!Array.isArray(products) || products.length !== 1) return null;
  const product = products[0];
  if (!product || typeof product !== "object" || Array.isArray(product)) return null;
  const source = product as Record<string, Prisma.JsonValue>;
  const productId = cleanShopAiTelemetryId(source.productId);
  if (!productId) return null;
  const matchStatus = source.matchStatus === "exact" ? "EXACT" : "REQUIRES_VERIFICATION";
  return {
    id: null as string | null,
    productId,
    variantId: cleanShopAiTelemetryId(source.variantId),
    vehicleApplicationId: cleanShopAiTelemetryId(source.vehicleApplicationId),
    matchStatus,
    missingFacts: Array.isArray(source.missingFacts)
      ? source.missingFacts.filter((item): item is string => typeof item === "string").slice(0, 20)
      : [],
  };
}

export function cleanShopAiTelemetryId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return SAFE_ID_PATTERN.test(cleaned) ? cleaned : null;
}

export function cleanShopAiOwnerKeyHash(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().toLowerCase();
  return OWNER_KEY_PATTERN.test(cleaned) ? cleaned : null;
}

export function sanitizeShopAiTelemetryJson(value: unknown, depth = 0): ShopAiTelemetryJson {
  if (value == null) return null;
  if (typeof value === "string") {
    return redactShopAiText(value, MAX_JSON_STRING_LENGTH).text;
  }
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_JSON_DEPTH) return null;
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_JSON_ARRAY_ITEMS)
      .map((item) => sanitizeShopAiTelemetryJson(item, depth + 1));
  }
  if (typeof value === "object") {
    const output: { [key: string]: ShopAiTelemetryJson } = {};
    for (const [rawKey, item] of Object.entries(value).slice(0, MAX_JSON_OBJECT_KEYS)) {
      if (typeof item === "undefined" || typeof item === "function" || typeof item === "symbol") {
        continue;
      }
      const key = cleanObjectKey(rawKey);
      if (!key) continue;
      output[key] = sanitizeShopAiTelemetryJson(item, depth + 1);
    }
    return output;
  }
  return null;
}

function withTelemetryOwner(
  constraints: unknown,
  ownerKeyHash: string | null
): ShopAiTelemetryJson {
  const sanitized = sanitizeShopAiTelemetryJson(constraints);
  const objectValue =
    sanitized && typeof sanitized === "object" && !Array.isArray(sanitized) ? sanitized : {};
  if (ownerKeyHash) {
    return { ...objectValue, [TELEMETRY_OWNER_KEY]: ownerKeyHash };
  }
  return objectValue;
}

function getTelemetryOwner(constraints: Prisma.JsonValue): string | null {
  if (!constraints || typeof constraints !== "object" || Array.isArray(constraints)) {
    return null;
  }
  return cleanShopAiOwnerKeyHash((constraints as Record<string, unknown>)[TELEMETRY_OWNER_KEY]);
}

export function canLinkShopAiRun(input: {
  runConversationId: string | null;
  runConstraints: Prisma.JsonValue;
  validatedConversationId: string | null;
  ownerKeyHash: string | null;
}) {
  const ownerMatches =
    Boolean(input.ownerKeyHash) && getTelemetryOwner(input.runConstraints) === input.ownerKeyHash;
  const conversationMatches =
    Boolean(input.validatedConversationId) &&
    input.runConversationId === input.validatedConversationId;
  return ownerMatches || conversationMatches;
}

export function shouldCreateShopAiFeedbackReviewTask(input: {
  signal: "THUMBS_UP" | "THUMBS_DOWN" | "NO_RESULT";
  reason: PersistedFeedback["reason"];
  linkedCandidateCount: number;
}) {
  if (input.signal === "NO_RESULT") {
    return input.reason === "MISSING_PRODUCT";
  }
  return (
    input.signal === "THUMBS_DOWN" &&
    (input.reason === "WRONG_FITMENT" ||
      input.reason === "WRONG_CATEGORY" ||
      input.reason === "MISSING_PRODUCT")
  );
}

export function parseShopAiFeedbackPayload(value: unknown): ParseShopAiFeedbackPayloadResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Invalid request body" };
  }
  const source = value as Record<string, unknown>;
  if (source.rating !== "up" && source.rating !== "down") {
    return { ok: false, error: "rating must be up or down" };
  }
  if (source.locale !== "ua" && source.locale !== "en") {
    return { ok: false, error: "locale must be ua or en" };
  }
  const reasons = new Set<ShopAiFeedbackReason>([
    "wrong_fitment",
    "wrong_category",
    "irrelevant",
    "missing_product",
    "other",
  ]);
  if (
    source.reason != null &&
    (typeof source.reason !== "string" || !reasons.has(source.reason as ShopAiFeedbackReason))
  ) {
    return { ok: false, error: "Invalid feedback reason" };
  }
  const runId = source.runId == null ? null : cleanShopAiTelemetryId(source.runId);
  const conversationId =
    source.conversationId == null ? null : cleanShopAiTelemetryId(source.conversationId);
  if (source.runId != null && !runId) {
    return { ok: false, error: "Invalid runId" };
  }
  if (source.conversationId != null && !conversationId) {
    return { ok: false, error: "Invalid conversationId" };
  }
  return {
    ok: true,
    value: {
      runId,
      conversationId,
      rating: source.rating,
      reason:
        source.rating === "down" && typeof source.reason === "string"
          ? (source.reason as ShopAiFeedbackReason)
          : null,
      locale: source.locale,
    },
  };
}

function toPrismaJson(value: ShopAiTelemetryJson) {
  return value as Prisma.InputJsonValue;
}

function isPrismaCode(error: unknown, code: string) {
  return (
    error != null &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

export function isShopAiTelemetrySchemaUnavailable(error: unknown) {
  if (isPrismaCode(error, "P2021") || isPrismaCode(error, "P2022")) return true;
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return (
    /\b42P01\b/u.test(message) ||
    /\b42703\b/u.test(message) ||
    /relation .+ does not exist/iu.test(message) ||
    /table .+ does not exist/iu.test(message)
  );
}

function mapMode(mode: ShopAiTelemetryMode): PersistedRunComplete["mode"] {
  if (mode === "clarification") return "CLARIFICATION";
  if (mode === "no_match") return "NO_MATCH";
  return "RESULTS";
}

function mapMatchStatus(
  status: ShopAiTelemetryMatchStatus
): PersistedCandidateDecision["matchStatus"] {
  if (status === "requires_verification") return "REQUIRES_VERIFICATION";
  if (status === "rejected") return "REJECTED";
  return "EXACT";
}

function mapFeedbackReason(reason: ShopAiFeedbackReason | null): PersistedFeedback["reason"] {
  if (reason === "wrong_fitment") return "WRONG_FITMENT";
  if (reason === "wrong_category") return "WRONG_CATEGORY";
  if (reason === "irrelevant") return "IRRELEVANT";
  if (reason === "missing_product") return "MISSING_PRODUCT";
  if (reason === "other") return "OTHER";
  return null;
}

function buildReviewTitle(reason: PersistedFeedback["reason"]) {
  if (reason === "WRONG_FITMENT") return "One AI: reported wrong fitment";
  if (reason === "WRONG_CATEGORY") return "One AI: reported wrong category";
  if (reason === "MISSING_PRODUCT") return "One AI: no suitable product found";
  return "One AI: feedback requires review";
}

const prismaTelemetryRepository: ShopAiTelemetryRepository = {
  async createRun(input) {
    let conversationId: string | null = null;
    if (input.conversationId) {
      const conversation = await prisma.shopAiConversation.findUnique({
        where: { id: input.conversationId },
        select: { id: true },
      });
      conversationId = conversation?.id ?? null;
    }

    if (input.requestId) {
      const existing = await prisma.shopAiRun.findUnique({
        where: { requestId: input.requestId },
        select: { id: true },
      });
      if (existing) return existing.id;
    }

    try {
      const run = await prisma.shopAiRun.create({
        data: {
          requestId: input.requestId,
          conversationId,
          locale: input.locale,
          currency: input.currency,
          scope: input.scope,
          redactedQuery: input.redactedQuery,
          normalizedQuery: input.normalizedQuery,
          constraints: toPrismaJson(input.constraints),
          traceSampled: input.traceSampled,
        },
        select: { id: true },
      });
      return run.id;
    } catch (error) {
      if (input.requestId && isPrismaCode(error, "P2002")) {
        const existing = await prisma.shopAiRun.findUnique({
          where: { requestId: input.requestId },
          select: { id: true },
        });
        if (existing) return existing.id;
      }
      throw error;
    }
  },

  async completeRun(input) {
    const result = await prisma.shopAiRun.updateMany({
      where: { id: input.runId },
      data: {
        status: "COMPLETED",
        mode: input.mode,
        response: toPrismaJson(input.response),
        exactCount: input.exactCount,
        verificationCount: input.verificationCount,
        candidateCount: input.candidateCount,
        acceptedCount: input.acceptedCount,
        generationCalls: input.generationCalls,
        embeddingCalls: input.embeddingCalls,
        retrievalLatencyMs: input.retrievalLatencyMs,
        totalLatencyMs: input.totalLatencyMs,
        activeCpuMs: input.activeCpuMs,
        degraded: input.degraded,
        ...(input.traceSampled == null ? {} : { traceSampled: input.traceSampled }),
        completedAt: new Date(),
      },
    });
    return result.count > 0;
  },

  async failRun(input) {
    const result = await prisma.shopAiRun.updateMany({
      where: { id: input.runId },
      data: {
        status: "FAILED",
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        totalLatencyMs: input.totalLatencyMs,
        activeCpuMs: input.activeCpuMs,
        degraded: input.degraded,
        traceSampled: true,
        completedAt: new Date(),
      },
    });
    return result.count > 0;
  },

  async createCandidateDecisions(input) {
    if (input.length === 0) return 0;
    const result = await prisma.shopAiCandidateDecision.createMany({
      data: input.map((candidate) => ({
        ...candidate,
        productSnapshot: toPrismaJson(candidate.productSnapshot),
      })),
    });
    return result.count;
  },

  async createFeedback(input) {
    const requestedRun = input.runId
      ? await prisma.shopAiRun.findUnique({
          where: { id: input.runId },
          select: {
            id: true,
            conversationId: true,
            constraints: true,
            response: true,
            traceSampled: true,
            candidateDecisions: {
              where: { shown: true },
              orderBy: [{ rank: "asc" }, { createdAt: "asc" }],
              take: 2,
              select: {
                id: true,
                productId: true,
                variantId: true,
                vehicleApplicationId: true,
              },
            },
          },
        })
      : null;
    const run =
      requestedRun &&
      canLinkShopAiRun({
        runConversationId: requestedRun.conversationId,
        runConstraints: requestedRun.constraints,
        validatedConversationId: input.conversationId,
        ownerKeyHash: input.ownerKeyHash,
      })
        ? requestedRun
        : null;
    const candidate =
      run?.candidateDecisions.length === 1
        ? {
            ...run.candidateDecisions[0],
            matchStatus: null,
            missingFacts: [] as string[],
          }
        : run
          ? singleCandidateFromRunResponse(run.response)
          : null;

    return prisma.$transaction(async (transaction) => {
      if (run && input.createReviewTask) {
        await transaction.shopAiRun.updateMany({
          where: { id: run.id, traceSampled: false },
          data: { traceSampled: true },
        });
      }
      let candidateDecisionId = candidate?.id ?? null;
      if (run && candidate && !candidateDecisionId && input.createReviewTask) {
        const recoveredDecision = await transaction.shopAiCandidateDecision.create({
          data: {
            runId: run.id,
            productId: candidate.productId,
            variantId: candidate.variantId,
            vehicleApplicationId: candidate.vehicleApplicationId,
            productSnapshot: { recoveredFromRunResponse: true },
            matchStatus: candidate.matchStatus === "EXACT" ? "EXACT" : "REQUIRES_VERIFICATION",
            rank: 1,
            reasonCodes: ["feedback_promoted_trace"],
            missingFacts: candidate.missingFacts,
            shown: true,
          },
          select: { id: true },
        });
        candidateDecisionId = recoveredDecision.id;
      }
      const feedback = await transaction.shopAiFeedback.create({
        data: {
          runId: run?.id ?? null,
          conversationId: run?.conversationId ?? null,
          candidateDecisionId,
          productId: candidate?.productId ?? null,
          variantId: candidate?.variantId ?? null,
          signal: input.signal,
          reason: input.reason,
          comment: input.comment,
          metadata: {
            locale: input.locale,
            linkageRejected: Boolean(input.runId && !run),
          },
        },
        select: { id: true },
      });

      let reviewTaskId: string | null = null;
      const shouldCreateReviewTask =
        Boolean(run) &&
        input.createReviewTask &&
        shouldCreateShopAiFeedbackReviewTask({
          signal: input.signal,
          reason: input.reason,
          linkedCandidateCount: candidate ? 1 : 0,
        });
      if (shouldCreateReviewTask) {
        const knowledge = candidate
          ? await transaction.shopProductKnowledge.findUnique({
              where: { productId: candidate.productId },
              select: { id: true },
            })
          : null;
        const application =
          knowledge && candidate?.vehicleApplicationId
            ? await transaction.shopVehicleApplication.findFirst({
                where: {
                  id: candidate.vehicleApplicationId,
                  productId: candidate.productId,
                  knowledgeId: knowledge.id,
                  isActive: true,
                },
                select: { id: true },
              })
            : null;
        const reviewTask = await transaction.shopKnowledgeReviewTask.create({
          data: {
            knowledgeId: knowledge?.id ?? null,
            productId: candidate?.productId ?? null,
            variantId: candidate?.variantId ?? null,
            vehicleApplicationId: application?.id ?? null,
            aiRunId: run?.id ?? null,
            feedbackId: feedback.id,
            taskType: `AI_FEEDBACK_${input.reason ?? "OTHER"}`,
            priority: input.reason === "WRONG_FITMENT" ? "HIGH" : "MEDIUM",
            title: buildReviewTitle(input.reason),
            details: {
              source: input.signal === "NO_RESULT" ? "one_ai_no_result" : "one_ai_feedback",
              locale: input.locale,
              linkedCandidate: Boolean(candidate),
            },
            reasonCodes: input.reason ? [input.reason] : [],
          },
          select: { id: true },
        });
        reviewTaskId = reviewTask.id;
      }

      return {
        feedbackId: feedback.id,
        reviewTaskId,
        linkedToRun: Boolean(run),
      };
    });
  },
};

function reportTelemetryError(operation: string, error: unknown) {
  if (isShopAiTelemetrySchemaUnavailable(error)) return;
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "unknown")
      : "unknown";
  console.warn(`One AI telemetry ${operation} unavailable`, { code });
}

function getSuccessfulTraceSampleRate() {
  const value = Number(process.env.SHOP_AI_TRACE_SUCCESS_SAMPLE_RATE ?? "0.1");
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.1;
}

export function createShopAiTelemetry(repository: ShopAiTelemetryRepository) {
  async function createRun(
    input: CreateShopAiRunInput
  ): Promise<ShopAiTelemetryResult<{ runId: string; traceSampled: boolean }>> {
    const requestId = input.requestId == null ? null : cleanShopAiTelemetryId(input.requestId);
    const conversationId =
      input.conversationId == null ? null : cleanShopAiTelemetryId(input.conversationId);
    const ownerKeyHash = cleanShopAiOwnerKeyHash(input.ownerKeyHash);
    const redactedQuery = redactShopAiText(
      input.message,
      SHOP_AI_TELEMETRY_MAX_MESSAGE_LENGTH
    ).text;
    const normalizedQuery = input.normalizedQuery
      ? redactShopAiText(input.normalizedQuery, SHOP_AI_TELEMETRY_MAX_MESSAGE_LENGTH).text
      : null;
    try {
      const traceSampled = input.traceSampled ?? Math.random() < getSuccessfulTraceSampleRate();
      const runId = await repository.createRun({
        requestId,
        conversationId,
        locale: input.locale,
        currency: redactShopAiText(input.currency, 10).text || "EUR",
        scope: input.scope === "auto" || input.scope === "moto" ? input.scope : null,
        redactedQuery,
        normalizedQuery,
        constraints: withTelemetryOwner(input.constraints, ownerKeyHash),
        traceSampled,
      });
      return { persisted: true, value: { runId, traceSampled } };
    } catch (error) {
      reportTelemetryError("create run", error);
      return { persisted: false, value: null };
    }
  }

  async function completeRun(
    input: CompleteShopAiRunInput
  ): Promise<ShopAiTelemetryResult<{ runId: string }>> {
    const runId = cleanShopAiTelemetryId(input.runId);
    if (!runId) return { persisted: false, value: null };
    try {
      const updated = await repository.completeRun({
        runId,
        mode: mapMode(input.mode),
        response: sanitizeShopAiTelemetryJson(input.response),
        exactCount: cleanInteger(input.exactCount),
        verificationCount: cleanInteger(input.verificationCount),
        candidateCount: cleanInteger(input.candidateCount),
        acceptedCount: cleanInteger(input.acceptedCount),
        generationCalls: cleanInteger(input.generationCalls, 10),
        embeddingCalls: cleanInteger(input.embeddingCalls, 10),
        retrievalLatencyMs: cleanOptionalInteger(input.retrievalLatencyMs, 60_000),
        totalLatencyMs: cleanOptionalInteger(input.totalLatencyMs, 120_000),
        activeCpuMs: cleanOptionalInteger(input.activeCpuMs, 120_000),
        degraded: Boolean(input.degraded),
        traceSampled: input.mode === "no_match" ? true : null,
      });
      return updated ? { persisted: true, value: { runId } } : { persisted: false, value: null };
    } catch (error) {
      reportTelemetryError("complete run", error);
      return { persisted: false, value: null };
    }
  }

  async function failRun(
    input: FailShopAiRunInput
  ): Promise<ShopAiTelemetryResult<{ runId: string }>> {
    const runId = cleanShopAiTelemetryId(input.runId);
    if (!runId) return { persisted: false, value: null };
    try {
      const updated = await repository.failRun({
        runId,
        errorCode: redactShopAiText(input.errorCode, 64).text.toUpperCase() || "UNKNOWN_ERROR",
        errorMessage: input.errorMessage
          ? redactShopAiText(input.errorMessage, SHOP_AI_TELEMETRY_MAX_ERROR_LENGTH).text
          : null,
        totalLatencyMs: cleanOptionalInteger(input.totalLatencyMs, 120_000),
        activeCpuMs: cleanOptionalInteger(input.activeCpuMs, 120_000),
        degraded: input.degraded ?? true,
      });
      return updated ? { persisted: true, value: { runId } } : { persisted: false, value: null };
    } catch (error) {
      reportTelemetryError("fail run", error);
      return { persisted: false, value: null };
    }
  }

  async function createCandidateDecisions(
    runIdValue: string,
    candidates: ShopAiCandidateDecisionInput[]
  ): Promise<ShopAiTelemetryResult<{ count: number }>> {
    const runId = cleanShopAiTelemetryId(runIdValue);
    if (!runId || candidates.length === 0) {
      return { persisted: false, value: null };
    }
    const values = candidates
      .slice(0, SHOP_AI_TELEMETRY_MAX_CANDIDATES)
      .flatMap<PersistedCandidateDecision>((candidate) => {
        const productId = cleanShopAiTelemetryId(candidate.productId);
        if (!productId) return [];
        return [
          {
            runId,
            productId,
            variantId: cleanShopAiTelemetryId(candidate.variantId),
            vehicleApplicationId: cleanShopAiTelemetryId(candidate.vehicleApplicationId),
            productSnapshot: sanitizeShopAiTelemetryJson(candidate.productSnapshot),
            matchStatus: mapMatchStatus(candidate.matchStatus),
            rank: cleanOptionalInteger(candidate.rank, 10_000),
            lexicalScore: cleanOptionalScore(candidate.lexicalScore),
            semanticScore: cleanOptionalScore(candidate.semanticScore),
            softScore: cleanOptionalScore(candidate.softScore),
            totalScore: cleanOptionalScore(candidate.totalScore),
            reasonCodes: cleanStringList(candidate.reasonCodes),
            missingFacts: cleanStringList(candidate.missingFacts),
            shown: Boolean(candidate.shown),
          },
        ];
      });
    if (values.length === 0) return { persisted: false, value: null };
    try {
      const count = await repository.createCandidateDecisions(values);
      return { persisted: true, value: { count } };
    } catch (error) {
      reportTelemetryError("record candidates", error);
      return { persisted: false, value: null };
    }
  }

  async function recordFeedback(
    input: RecordShopAiFeedbackInput
  ): Promise<ShopAiTelemetryResult<PersistedShopAiFeedbackResult>> {
    const signal = input.rating === "up" ? "THUMBS_UP" : "THUMBS_DOWN";
    const reason = input.rating === "down" ? mapFeedbackReason(input.reason) : null;
    try {
      const result = await repository.createFeedback({
        runId: cleanShopAiTelemetryId(input.runId),
        conversationId: cleanShopAiTelemetryId(input.conversationId),
        ownerKeyHash: cleanShopAiOwnerKeyHash(input.ownerKeyHash),
        signal,
        reason,
        comment: input.comment
          ? redactShopAiText(input.comment, SHOP_AI_TELEMETRY_MAX_COMMENT_LENGTH).text || null
          : null,
        locale: input.locale,
        createReviewTask:
          signal === "THUMBS_DOWN" &&
          (reason === "WRONG_FITMENT" ||
            reason === "WRONG_CATEGORY" ||
            reason === "MISSING_PRODUCT"),
      });
      return { persisted: true, value: result };
    } catch (error) {
      reportTelemetryError("record feedback", error);
      return { persisted: false, value: null };
    }
  }

  async function recordNoResult(
    input: RecordShopAiNoResultInput
  ): Promise<ShopAiTelemetryResult<PersistedShopAiFeedbackResult>> {
    try {
      const result = await repository.createFeedback({
        runId: cleanShopAiTelemetryId(input.runId),
        conversationId: cleanShopAiTelemetryId(input.conversationId),
        ownerKeyHash: cleanShopAiOwnerKeyHash(input.ownerKeyHash),
        signal: "NO_RESULT",
        reason: "MISSING_PRODUCT",
        comment: null,
        locale: input.locale,
        createReviewTask: true,
      });
      return { persisted: true, value: result };
    } catch (error) {
      reportTelemetryError("record no-result", error);
      return { persisted: false, value: null };
    }
  }

  return {
    createRun,
    completeRun,
    failRun,
    createCandidateDecisions,
    recordFeedback,
    recordNoResult,
  };
}

const telemetry = createShopAiTelemetry(prismaTelemetryRepository);

export const createShopAiRun = telemetry.createRun;
export const completeShopAiRun = telemetry.completeRun;
export const failShopAiRun = telemetry.failRun;
export const recordShopAiCandidateDecisions = telemetry.createCandidateDecisions;
export const recordShopAiFeedback = telemetry.recordFeedback;
export const recordShopAiNoResult = telemetry.recordNoResult;
