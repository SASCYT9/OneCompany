export const SHOP_KNOWLEDGE_CHUNK_EMBEDDING_DIMENSIONS = 768;
export const SHOP_KNOWLEDGE_CHUNK_EMBEDDING_PROVIDER_MODEL = "gemini-embedding-2";
export const SHOP_KNOWLEDGE_EMBEDDING_PROFILE_VERSION = "search-v1";

/**
 * Stored next to every vector. The profile suffix deliberately makes vectors
 * generated with the old taskType-based request stale: Gemini Embedding 2 uses
 * retrieval instructions in the input text and those spaces must never mix.
 */
export const SHOP_KNOWLEDGE_CHUNK_EMBEDDING_MODEL = `${SHOP_KNOWLEDGE_CHUNK_EMBEDDING_PROVIDER_MODEL}:${SHOP_KNOWLEDGE_EMBEDDING_PROFILE_VERSION}`;

// Prisma Accelerate rejects interactive transactions configured above 15s.
// Keep a margin so external workers behave the same through Accelerate and a
// direct PostgreSQL connection.
export const SHOP_KNOWLEDGE_EMBEDDING_TRANSACTION_TIMEOUT_MS = 14_000;
export const SHOP_KNOWLEDGE_EMBEDDING_FINALIZATION_BATCH_SIZE = 25;

export function resolveShopKnowledgeEmbeddingProviderModel(modelOrProfile: string) {
  const normalized = modelOrProfile.trim().replace(/^models\//, "");
  const profileSuffix = `:${SHOP_KNOWLEDGE_EMBEDDING_PROFILE_VERSION}`;
  return normalized.endsWith(profileSuffix)
    ? normalized.slice(0, -profileSuffix.length)
    : normalized;
}

export function resolveShopKnowledgeEmbeddingStorageModel(providerModel: string) {
  return `${resolveShopKnowledgeEmbeddingProviderModel(providerModel)}:${SHOP_KNOWLEDGE_EMBEDDING_PROFILE_VERSION}`;
}

export function isGeminiEmbedding2Model(modelOrProfile: string) {
  return resolveShopKnowledgeEmbeddingProviderModel(modelOrProfile) === "gemini-embedding-2";
}

export function buildShopKnowledgeDocumentEmbeddingText(
  text: string,
  modelOrProfile = SHOP_KNOWLEDGE_CHUNK_EMBEDDING_PROVIDER_MODEL
) {
  return isGeminiEmbedding2Model(modelOrProfile) ? `title: none | text: ${text}` : text;
}

export function buildShopKnowledgeQueryEmbeddingText(
  text: string,
  modelOrProfile = SHOP_KNOWLEDGE_CHUNK_EMBEDDING_PROVIDER_MODEL
) {
  return isGeminiEmbedding2Model(modelOrProfile) ? `task: search result | query: ${text}` : text;
}

export function buildShopKnowledgeEmbeddingTaskConfig(
  modelOrProfile: string,
  task: "document" | "query"
): { taskType?: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" } {
  if (isGeminiEmbedding2Model(modelOrProfile)) return {};
  return {
    taskType: task === "document" ? "RETRIEVAL_DOCUMENT" : "RETRIEVAL_QUERY",
  };
}

export function buildShopKnowledgeEmbeddingContents(
  contents: string[],
  modelOrProfile = SHOP_KNOWLEDGE_CHUNK_EMBEDDING_PROVIDER_MODEL
) {
  return contents.map((text) => ({
    role: "user" as const,
    parts: [{ text: buildShopKnowledgeDocumentEmbeddingText(text, modelOrProfile) }],
  }));
}

export function resolveShopKnowledgeWorkerDatabaseUrl(env: {
  DIRECT_URL?: string;
  DATABASE_URL?: string;
}): string {
  const directUrl = env.DIRECT_URL?.trim();
  if (directUrl) return directUrl;
  const databaseUrl = env.DATABASE_URL?.trim();
  if (databaseUrl) return databaseUrl;
  throw new Error("DIRECT_URL or DATABASE_URL is required for the embedding worker");
}

export function resolveShopKnowledgeEmbeddingRetryDelayMs(error: unknown): number {
  const candidate = error as { status?: unknown; message?: unknown } | null;
  const status = typeof candidate?.status === "number" ? candidate.status : null;
  const message = typeof candidate?.message === "string" ? candidate.message : String(error ?? "");
  const quotaLimited = status === 429 || /quota|resource_exhausted|rate.?limit/i.test(message);
  if (!quotaLimited) return status !== null && status >= 500 ? 1_000 : 0;

  const retrySeconds =
    Number(message.match(/retry\s+in\s+([0-9]+(?:\.[0-9]+)?)s/i)?.[1]) ||
    Number(message.match(/"retryDelay"\s*:\s*"([0-9]+(?:\.[0-9]+)?)s"/i)?.[1]) ||
    59;
  return Math.min(59_000, Math.max(1_000, Math.ceil(retrySeconds * 1_000) + 1_000));
}

export function isShopKnowledgeEmbeddingQuotaError(error: unknown): boolean {
  const candidate = error as { status?: unknown; message?: unknown } | null;
  const status = typeof candidate?.status === "number" ? candidate.status : null;
  const message = typeof candidate?.message === "string" ? candidate.message : String(error ?? "");
  return status === 429 || /quota|resource_exhausted|rate.?limit/i.test(message);
}

export function isShopKnowledgeEmbeddingDailyQuotaError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error ?? "");
  return /RequestsPerDay|PerDayPerUser|requests\s+per\s+day/i.test(message);
}

function waitForShopKnowledgeEmbeddingRetry(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ShopKnowledgeChunkEmbeddingCandidate = {
  id: string;
  knowledgeId: string;
  productId: string;
  revision: number;
  contentHash: string;
  content: string;
};

export type ShopKnowledgeChunkEmbeddingBacklog = {
  chunks: number;
  products: number;
  knowledgeRecords: number;
  estimatedTokens: number;
};

export type ShopKnowledgeChunkEmbeddingWrite = {
  chunkId: string;
  knowledgeId: string;
  revision: number;
  contentHash: string;
  values: number[];
};

export type ShopKnowledgeChunkEmbeddingStoreResult = {
  embedded: number;
  skippedStale: number;
  finalizedKnowledge: number;
};

/** Optional scope for controlled embedding rollouts (for example one brand). */
export type ShopKnowledgeChunkEmbeddingScope = {
  /** `undefined` means the whole catalog; an empty array means no products. */
  productIds?: string[];
  /** `undefined` means every canonical category; an empty array means no categories. */
  categoryGroups?: string[];
};

export interface ShopKnowledgeChunkEmbeddingRepository {
  getEmbeddingBacklog(
    model: string,
    scope?: ShopKnowledgeChunkEmbeddingScope
  ): Promise<ShopKnowledgeChunkEmbeddingBacklog>;
  prepareEmbeddingLifecycle(
    model: string,
    now: Date,
    scope?: ShopKnowledgeChunkEmbeddingScope
  ): Promise<number>;
  listPendingChunkEmbeddings(
    model: string,
    limit: number,
    scope?: ShopKnowledgeChunkEmbeddingScope
  ): Promise<ShopKnowledgeChunkEmbeddingCandidate[]>;
  storeChunkEmbeddings(input: {
    model: string;
    embeddedAt: Date;
    writes: ShopKnowledgeChunkEmbeddingWrite[];
  }): Promise<ShopKnowledgeChunkEmbeddingStoreResult>;
  finalizeReadyKnowledge(input: {
    model: string;
    finalizedAt: Date;
    limit?: number;
    knowledgeIds?: string[];
    scope?: ShopKnowledgeChunkEmbeddingScope;
  }): Promise<number>;
}

export interface ShopKnowledgeChunkEmbeddingProvider {
  embedDocuments(input: {
    model: string;
    dimensions: typeof SHOP_KNOWLEDGE_CHUNK_EMBEDDING_DIMENSIONS;
    contents: string[];
  }): Promise<number[][]>;
}

export type ShopKnowledgeChunkEmbeddingBatchResult = ShopKnowledgeChunkEmbeddingStoreResult & {
  selected: number;
  checkpoint: {
    chunkId: string;
    knowledgeId: string;
    productId: string;
  } | null;
};

export type ShopKnowledgeEmbeddingCheckpoint = {
  batch: number;
  selected: number;
  embedded: number;
  skippedStale: number;
  finalizedKnowledge: number;
  providerCalls: number;
  estimatedTokens: number;
  estimatedCostUsd: number;
  lastChunkId: string | null;
  lastKnowledgeId: string | null;
  lastProductId: string | null;
};

export type ShopKnowledgeEmbeddingWorkerResult = ShopKnowledgeChunkEmbeddingStoreResult & {
  selected: number;
  providerCalls: number;
  estimatedTokens: number;
  estimatedCostUsd: number;
  batches: number;
  lastCheckpoint: ShopKnowledgeEmbeddingCheckpoint | null;
  stoppedBy: "empty" | "chunk_limit" | "call_limit" | "cost_limit" | "quota_limit";
};

export function estimateShopKnowledgeEmbeddingDryRun(input: {
  backlog: ShopKnowledgeChunkEmbeddingBacklog;
  maxChunks: number;
  batchSize: number;
  maxProviderCalls?: number;
  estimatedCostPerThousandTokensUsd: number;
  maxEstimatedCostUsd: number;
}) {
  const callLimitedChunks =
    input.maxProviderCalls === undefined
      ? Number.POSITIVE_INFINITY
      : Math.max(0, Math.floor(input.maxProviderCalls)) * Math.max(0, input.batchSize);
  const plannedChunks = Math.min(
    Math.max(0, input.maxChunks),
    input.backlog.chunks,
    callLimitedChunks
  );
  const plannedEstimatedTokens =
    input.backlog.chunks > 0
      ? Math.ceil(input.backlog.estimatedTokens * (plannedChunks / input.backlog.chunks))
      : 0;
  const plannedEstimatedCostUsd =
    (plannedEstimatedTokens / 1_000) * input.estimatedCostPerThousandTokensUsd;
  return {
    plannedChunks,
    plannedProviderCalls: input.batchSize > 0 ? Math.ceil(plannedChunks / input.batchSize) : 0,
    plannedEstimatedTokens,
    plannedEstimatedCostUsd,
    withinCostCeiling: plannedEstimatedCostUsd <= input.maxEstimatedCostUsd,
  };
}

function validateEmbedding(values: number[], chunkId: string): void {
  if (values.length !== SHOP_KNOWLEDGE_CHUNK_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Invalid embedding dimensions for ${chunkId}: expected ${SHOP_KNOWLEDGE_CHUNK_EMBEDDING_DIMENSIONS}, received ${values.length}`
    );
  }
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error(`Embedding for ${chunkId} contains a non-finite value`);
  }
}

export async function runShopKnowledgeChunkEmbeddingBatch(
  repository: ShopKnowledgeChunkEmbeddingRepository,
  provider: ShopKnowledgeChunkEmbeddingProvider,
  input: {
    model: string;
    batchSize: number;
    embeddedAt?: Date;
    scope?: ShopKnowledgeChunkEmbeddingScope;
  }
): Promise<ShopKnowledgeChunkEmbeddingBatchResult> {
  const model = input.model.trim();
  if (!model) throw new Error("Knowledge chunk embedding model is required");
  if (!Number.isInteger(input.batchSize) || input.batchSize < 1 || input.batchSize > 100) {
    throw new Error("Knowledge chunk embedding batchSize must be between 1 and 100");
  }

  const candidates = await repository.listPendingChunkEmbeddings(
    model,
    input.batchSize,
    input.scope
  );
  if (candidates.length === 0) {
    return {
      selected: 0,
      embedded: 0,
      skippedStale: 0,
      finalizedKnowledge: 0,
      checkpoint: null,
    };
  }

  // Chunks are already bounded to 600-800 tokens by the indexer. Pass the full
  // content so semantic indexing never silently reintroduces the legacy 12k cap.
  const vectors = await provider.embedDocuments({
    model,
    dimensions: SHOP_KNOWLEDGE_CHUNK_EMBEDDING_DIMENSIONS,
    contents: candidates.map((candidate) => candidate.content),
  });
  if (vectors.length !== candidates.length) {
    throw new Error(
      `Embedding count mismatch: expected ${candidates.length}, received ${vectors.length}`
    );
  }

  const writes = candidates.map((candidate, index) => {
    const values = vectors[index] ?? [];
    validateEmbedding(values, candidate.id);
    return {
      chunkId: candidate.id,
      knowledgeId: candidate.knowledgeId,
      revision: candidate.revision,
      contentHash: candidate.contentHash,
      values,
    };
  });
  const stored = await repository.storeChunkEmbeddings({
    model,
    embeddedAt: input.embeddedAt ?? new Date(),
    writes,
  });
  return {
    selected: candidates.length,
    checkpoint: {
      chunkId: candidates.at(-1)?.id ?? "",
      knowledgeId: candidates.at(-1)?.knowledgeId ?? "",
      productId: candidates.at(-1)?.productId ?? "",
    },
    ...stored,
  };
}

export async function runShopKnowledgeEmbeddingWorker(
  repository: ShopKnowledgeChunkEmbeddingRepository,
  provider: ShopKnowledgeChunkEmbeddingProvider,
  input: {
    model: string;
    batchSize: number;
    maxChunks: number;
    maxProviderCalls: number;
    maxAttemptsPerBatch: number;
    minProviderCallIntervalMs?: number;
    maxEstimatedCostUsd: number;
    estimatedCostPerThousandTokensUsd: number;
    embeddedAt?: Date;
    scope?: ShopKnowledgeChunkEmbeddingScope;
    onProgress?: (checkpoint: ShopKnowledgeEmbeddingCheckpoint) => void | Promise<void>;
    sleep?: (ms: number) => Promise<void>;
  }
): Promise<ShopKnowledgeEmbeddingWorkerResult> {
  if (!Number.isInteger(input.maxChunks) || input.maxChunks < 1 || input.maxChunks > 10_000) {
    throw new Error("Knowledge embedding maxChunks must be between 1 and 10000");
  }
  if (
    !Number.isInteger(input.maxProviderCalls) ||
    input.maxProviderCalls < 1 ||
    input.maxProviderCalls > 1_000
  ) {
    throw new Error("Knowledge embedding maxProviderCalls must be between 1 and 1000");
  }
  if (
    !Number.isInteger(input.maxAttemptsPerBatch) ||
    input.maxAttemptsPerBatch < 1 ||
    input.maxAttemptsPerBatch > 8
  ) {
    throw new Error("Knowledge embedding maxAttemptsPerBatch must be between 1 and 8");
  }
  if (
    input.minProviderCallIntervalMs !== undefined &&
    (!Number.isInteger(input.minProviderCallIntervalMs) ||
      input.minProviderCallIntervalMs < 0 ||
      input.minProviderCallIntervalMs > 60_000)
  ) {
    throw new Error("Knowledge embedding minProviderCallIntervalMs must be between 0 and 60000");
  }
  if (!Number.isFinite(input.maxEstimatedCostUsd) || input.maxEstimatedCostUsd <= 0) {
    throw new Error("Knowledge embedding maxEstimatedCostUsd must be positive");
  }
  if (
    !Number.isFinite(input.estimatedCostPerThousandTokensUsd) ||
    input.estimatedCostPerThousandTokensUsd < 0
  ) {
    throw new Error("Knowledge embedding estimated token cost must be non-negative");
  }

  let selected = 0;
  let embedded = 0;
  let skippedStale = 0;
  let finalizedKnowledge = 0;
  let providerCalls = 0;
  let estimatedTokens = 0;
  let estimatedCostUsd = 0;
  let batches = 0;
  let lastCheckpoint: ShopKnowledgeEmbeddingCheckpoint | null = null;
  let stoppedBy: ShopKnowledgeEmbeddingWorkerResult["stoppedBy"] = "empty";
  let lastProviderCallStartedAt = 0;
  const sleep = input.sleep ?? waitForShopKnowledgeEmbeddingRetry;

  while (selected < input.maxChunks) {
    const remainingCalls = input.maxProviderCalls - providerCalls;
    if (remainingCalls <= 0) {
      stoppedBy = "call_limit";
      break;
    }
    const batchSize = Math.min(input.batchSize, input.maxChunks - selected);
    let attempts = 0;
    let batch: ShopKnowledgeChunkEmbeddingBatchResult | null = null;
    while (attempts < input.maxAttemptsPerBatch && providerCalls < input.maxProviderCalls) {
      attempts += 1;
      try {
        const budgetedProvider: ShopKnowledgeChunkEmbeddingProvider = {
          async embedDocuments(request) {
            const tokens = request.contents.reduce(
              (sum, content) => sum + Math.max(1, Math.ceil(content.length / 4)),
              0
            );
            const cost = (tokens / 1_000) * input.estimatedCostPerThousandTokensUsd;
            if (estimatedCostUsd + cost > input.maxEstimatedCostUsd) {
              const error = new Error("Knowledge embedding cost limit reached");
              error.name = "KnowledgeEmbeddingCostLimitError";
              throw error;
            }
            const minInterval = input.minProviderCallIntervalMs ?? 0;
            const waitMs = Math.max(0, lastProviderCallStartedAt + minInterval - Date.now());
            if (waitMs > 0) await sleep(waitMs);
            lastProviderCallStartedAt = Date.now();
            providerCalls += 1;
            estimatedTokens += tokens;
            estimatedCostUsd += cost;
            return provider.embedDocuments(request);
          },
        };
        batch = await runShopKnowledgeChunkEmbeddingBatch(repository, budgetedProvider, {
          model: input.model,
          batchSize,
          embeddedAt: input.embeddedAt,
          scope: input.scope,
        });
        break;
      } catch (error) {
        if (error instanceof Error && error.name === "KnowledgeEmbeddingCostLimitError") {
          stoppedBy = "cost_limit";
          return {
            selected,
            embedded,
            skippedStale,
            finalizedKnowledge,
            providerCalls,
            estimatedTokens,
            estimatedCostUsd,
            batches,
            lastCheckpoint,
            stoppedBy,
          };
        }
        if (isShopKnowledgeEmbeddingDailyQuotaError(error)) {
          stoppedBy = "quota_limit";
          return {
            selected,
            embedded,
            skippedStale,
            finalizedKnowledge,
            providerCalls,
            estimatedTokens,
            estimatedCostUsd,
            batches,
            lastCheckpoint,
            stoppedBy,
          };
        }
        if (
          (attempts >= input.maxAttemptsPerBatch || providerCalls >= input.maxProviderCalls) &&
          isShopKnowledgeEmbeddingQuotaError(error)
        ) {
          stoppedBy = "quota_limit";
          return {
            selected,
            embedded,
            skippedStale,
            finalizedKnowledge,
            providerCalls,
            estimatedTokens,
            estimatedCostUsd,
            batches,
            lastCheckpoint,
            stoppedBy,
          };
        }
        if (attempts >= input.maxAttemptsPerBatch || providerCalls >= input.maxProviderCalls) {
          throw error;
        }
        const retryDelayMs = resolveShopKnowledgeEmbeddingRetryDelayMs(error);
        if (retryDelayMs > 0) {
          await sleep(retryDelayMs);
        }
      }
    }
    if (!batch || batch.selected === 0) {
      stoppedBy = "empty";
      break;
    }
    batches += 1;
    selected += batch.selected;
    embedded += batch.embedded;
    skippedStale += batch.skippedStale;
    finalizedKnowledge += batch.finalizedKnowledge;
    lastCheckpoint = {
      batch: batches,
      selected,
      embedded,
      skippedStale,
      finalizedKnowledge,
      providerCalls,
      estimatedTokens,
      estimatedCostUsd,
      lastChunkId: batch.checkpoint?.chunkId ?? null,
      lastKnowledgeId: batch.checkpoint?.knowledgeId ?? null,
      lastProductId: batch.checkpoint?.productId ?? null,
    };
    await input.onProgress?.(lastCheckpoint);
    stoppedBy = selected >= input.maxChunks ? "chunk_limit" : "empty";
  }

  return {
    selected,
    embedded,
    skippedStale,
    finalizedKnowledge,
    providerCalls,
    estimatedTokens,
    estimatedCostUsd,
    batches,
    lastCheckpoint,
    stoppedBy,
  };
}
