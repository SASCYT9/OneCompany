export const SHOP_KNOWLEDGE_CHUNK_EMBEDDING_DIMENSIONS = 768;
export const SHOP_KNOWLEDGE_CHUNK_EMBEDDING_MODEL = "gemini-embedding-2";

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

export interface ShopKnowledgeChunkEmbeddingRepository {
  getEmbeddingBacklog(model: string): Promise<ShopKnowledgeChunkEmbeddingBacklog>;
  prepareEmbeddingLifecycle(model: string, now: Date): Promise<number>;
  listPendingChunkEmbeddings(
    model: string,
    limit: number
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
};

export type ShopKnowledgeEmbeddingWorkerResult = ShopKnowledgeChunkEmbeddingStoreResult & {
  selected: number;
  providerCalls: number;
  estimatedTokens: number;
  estimatedCostUsd: number;
  batches: number;
  stoppedBy: "empty" | "chunk_limit" | "call_limit" | "cost_limit";
};

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
  }
): Promise<ShopKnowledgeChunkEmbeddingBatchResult> {
  const model = input.model.trim();
  if (!model) throw new Error("Knowledge chunk embedding model is required");
  if (!Number.isInteger(input.batchSize) || input.batchSize < 1 || input.batchSize > 100) {
    throw new Error("Knowledge chunk embedding batchSize must be between 1 and 100");
  }

  const candidates = await repository.listPendingChunkEmbeddings(model, input.batchSize);
  if (candidates.length === 0) {
    return {
      selected: 0,
      embedded: 0,
      skippedStale: 0,
      finalizedKnowledge: 0,
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
    maxEstimatedCostUsd: number;
    estimatedCostPerThousandTokensUsd: number;
    embeddedAt?: Date;
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
  let stoppedBy: ShopKnowledgeEmbeddingWorkerResult["stoppedBy"] = "empty";

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
            stoppedBy,
          };
        }
        if (attempts >= input.maxAttemptsPerBatch || providerCalls >= input.maxProviderCalls) {
          throw error;
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
    stoppedBy,
  };
}
