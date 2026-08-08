import assert from "node:assert/strict";
import test from "node:test";

import {
  buildShopKnowledgeEmbeddingContents,
  buildShopKnowledgeEmbeddingTaskConfig,
  buildShopKnowledgeQueryEmbeddingText,
  estimateShopKnowledgeEmbeddingDryRun,
  SHOP_KNOWLEDGE_CHUNK_EMBEDDING_DIMENSIONS,
  SHOP_KNOWLEDGE_EMBEDDING_FINALIZATION_BATCH_SIZE,
  SHOP_KNOWLEDGE_EMBEDDING_TRANSACTION_TIMEOUT_MS,
  runShopKnowledgeChunkEmbeddingBatch,
  runShopKnowledgeEmbeddingWorker,
  resolveShopKnowledgeWorkerDatabaseUrl,
  resolveShopKnowledgeEmbeddingRetryDelayMs,
  isShopKnowledgeEmbeddingDailyQuotaError,
  isShopKnowledgeEmbeddingQuotaError,
  resolveShopKnowledgeEmbeddingProviderModel,
  resolveShopKnowledgeEmbeddingStorageModel,
  type ShopKnowledgeChunkEmbeddingCandidate,
  type ShopKnowledgeChunkEmbeddingProvider,
  type ShopKnowledgeChunkEmbeddingRepository,
  type ShopKnowledgeChunkEmbeddingWrite,
} from "../../../src/lib/shopKnowledgeV2/embeddings";

test("embedding provider sends one explicit Content object per document", () => {
  assert.deepEqual(buildShopKnowledgeEmbeddingContents(["first", "second"]), [
    { role: "user", parts: [{ text: "title: none | text: first" }] },
    { role: "user", parts: [{ text: "title: none | text: second" }] },
  ]);
});

test("Gemini Embedding 2 uses instruction text and a versioned storage profile", () => {
  assert.equal(
    resolveShopKnowledgeEmbeddingStorageModel("models/gemini-embedding-2"),
    "gemini-embedding-2:search-v1"
  );
  assert.equal(
    resolveShopKnowledgeEmbeddingProviderModel("gemini-embedding-2:search-v1"),
    "gemini-embedding-2"
  );
  assert.equal(
    buildShopKnowledgeQueryEmbeddingText("BMW M5 G90 exhaust", "gemini-embedding-2"),
    "task: search result | query: BMW M5 G90 exhaust"
  );
  assert.deepEqual(buildShopKnowledgeEmbeddingTaskConfig("gemini-embedding-2", "query"), {});
  assert.deepEqual(buildShopKnowledgeEmbeddingTaskConfig("gemini-embedding-001", "document"), {
    taskType: "RETRIEVAL_DOCUMENT",
  });
});

test("external embedding worker prefers the direct database connection", () => {
  assert.equal(
    resolveShopKnowledgeWorkerDatabaseUrl({
      DIRECT_URL: "postgresql://direct",
      DATABASE_URL: "prisma://accelerate",
    }),
    "postgresql://direct"
  );
  assert.equal(
    resolveShopKnowledgeWorkerDatabaseUrl({ DATABASE_URL: "postgresql://fallback" }),
    "postgresql://fallback"
  );
  assert.throws(() => resolveShopKnowledgeWorkerDatabaseUrl({}), /DIRECT_URL or DATABASE_URL/);
});

test("embedding worker honors provider quota retry guidance", () => {
  const quotaError = Object.assign(
    new Error('RESOURCE_EXHAUSTED: Please retry in 22.796s. "retryDelay":"22s"'),
    { status: 429 }
  );
  assert.equal(resolveShopKnowledgeEmbeddingRetryDelayMs(quotaError), 23_796);
  assert.equal(resolveShopKnowledgeEmbeddingRetryDelayMs(new Error("invalid vector")), 0);
  assert.equal(isShopKnowledgeEmbeddingQuotaError(quotaError), true);
  assert.equal(isShopKnowledgeEmbeddingQuotaError(new Error("invalid vector")), false);
  assert.equal(
    isShopKnowledgeEmbeddingDailyQuotaError(
      new Error("EmbedContentRequestsPerDayPerUserPerProjectPerModel-FreeTier")
    ),
    true
  );
});

test("embedding transactions stay within Prisma Accelerate's production limit", () => {
  assert.ok(SHOP_KNOWLEDGE_EMBEDDING_TRANSACTION_TIMEOUT_MS > 0);
  assert.ok(SHOP_KNOWLEDGE_EMBEDDING_TRANSACTION_TIMEOUT_MS <= 15_000);
  assert.ok(SHOP_KNOWLEDGE_EMBEDDING_FINALIZATION_BATCH_SIZE > 0);
  assert.ok(SHOP_KNOWLEDGE_EMBEDDING_FINALIZATION_BATCH_SIZE <= 25);
});

test("dry-run estimate respects scope backlog, chunk limit and cost ceiling", () => {
  assert.deepEqual(
    estimateShopKnowledgeEmbeddingDryRun({
      backlog: {
        chunks: 100,
        products: 25,
        knowledgeRecords: 25,
        estimatedTokens: 80_000,
      },
      maxChunks: 25,
      batchSize: 10,
      estimatedCostPerThousandTokensUsd: 0.01,
      maxEstimatedCostUsd: 0.1,
    }),
    {
      plannedChunks: 25,
      plannedProviderCalls: 3,
      plannedEstimatedTokens: 20_000,
      plannedEstimatedCostUsd: 0.2,
      withinCostCeiling: false,
    }
  );
});

test("dry-run estimate cannot plan more chunks than the provider call ceiling", () => {
  assert.deepEqual(
    estimateShopKnowledgeEmbeddingDryRun({
      backlog: {
        chunks: 10_000,
        products: 2_500,
        knowledgeRecords: 2_500,
        estimatedTokens: 8_000_000,
      },
      maxChunks: 10_000,
      batchSize: 20,
      maxProviderCalls: 50,
      estimatedCostPerThousandTokensUsd: 0.0002,
      maxEstimatedCostUsd: 5,
    }),
    {
      plannedChunks: 1_000,
      plannedProviderCalls: 50,
      plannedEstimatedTokens: 800_000,
      plannedEstimatedCostUsd: 0.16,
      withinCostCeiling: true,
    }
  );
});

class FakeEmbeddingRepository implements ShopKnowledgeChunkEmbeddingRepository {
  candidates: ShopKnowledgeChunkEmbeddingCandidate[] = [];
  writes: ShopKnowledgeChunkEmbeddingWrite[] = [];
  prepared = 0;
  finalized = 0;
  lastScope: { productIds?: string[]; categoryGroups?: string[] } | undefined;

  async getEmbeddingBacklog() {
    return {
      chunks: this.candidates.length,
      products: new Set(this.candidates.map((candidate) => candidate.productId)).size,
      knowledgeRecords: new Set(this.candidates.map((candidate) => candidate.knowledgeId)).size,
      estimatedTokens: this.candidates.reduce(
        (sum, candidate) => sum + Math.max(1, Math.ceil(candidate.content.length / 4)),
        0
      ),
    };
  }

  async prepareEmbeddingLifecycle() {
    return this.prepared;
  }

  async listPendingChunkEmbeddings(
    _model: string,
    limit: number,
    scope?: { productIds?: string[]; categoryGroups?: string[] }
  ) {
    this.lastScope = scope;
    return this.candidates.slice(0, limit);
  }

  async storeChunkEmbeddings(input: { writes: ShopKnowledgeChunkEmbeddingWrite[] }) {
    this.writes.push(...input.writes);
    return {
      embedded: input.writes.length,
      skippedStale: 0,
      finalizedKnowledge: this.finalized,
    };
  }

  async finalizeReadyKnowledge() {
    return this.finalized;
  }
}

test("embeds complete chunk content and preserves hash/revision compare-and-set metadata", async () => {
  const repository = new FakeEmbeddingRepository();
  const completeContent = `prefix-${"x".repeat(13_000)}-suffix`;
  repository.candidates = [
    {
      id: "chunk-1",
      knowledgeId: "knowledge-1",
      productId: "product-1",
      revision: 3,
      contentHash: "content-hash-3",
      content: completeContent,
    },
  ];
  const receivedContents: string[][] = [];
  const provider: ShopKnowledgeChunkEmbeddingProvider = {
    async embedDocuments(input) {
      receivedContents.push(input.contents);
      return [Array.from({ length: input.dimensions }, () => 0.25)];
    },
  };

  const result = await runShopKnowledgeChunkEmbeddingBatch(repository, provider, {
    model: "embedding-model-v2",
    batchSize: 20,
    embeddedAt: new Date("2026-07-17T16:00:00.000Z"),
  });

  assert.equal(receivedContents[0][0], completeContent);
  assert.equal(receivedContents[0][0].endsWith("-suffix"), true);
  assert.deepEqual(
    {
      chunkId: repository.writes[0].chunkId,
      knowledgeId: repository.writes[0].knowledgeId,
      revision: repository.writes[0].revision,
      contentHash: repository.writes[0].contentHash,
    },
    {
      chunkId: "chunk-1",
      knowledgeId: "knowledge-1",
      revision: 3,
      contentHash: "content-hash-3",
    }
  );
  assert.equal(repository.writes[0].values.length, SHOP_KNOWLEDGE_CHUNK_EMBEDDING_DIMENSIONS);
  assert.deepEqual(result, {
    selected: 1,
    embedded: 1,
    skippedStale: 0,
    finalizedKnowledge: 0,
    checkpoint: {
      chunkId: "chunk-1",
      knowledgeId: "knowledge-1",
      productId: "product-1",
    },
  });
});

test("rejects malformed vectors before writing any chunk", async () => {
  const repository = new FakeEmbeddingRepository();
  repository.candidates = [
    {
      id: "chunk-invalid",
      knowledgeId: "knowledge-1",
      productId: "product-1",
      revision: 1,
      contentHash: "content-hash",
      content: "Complete chunk",
    },
  ];
  const provider: ShopKnowledgeChunkEmbeddingProvider = {
    async embedDocuments() {
      return [[0.1, 0.2]];
    },
  };

  await assert.rejects(
    runShopKnowledgeChunkEmbeddingBatch(repository, provider, {
      model: "embedding-model-v2",
      batchSize: 20,
    }),
    /Invalid embedding dimensions/
  );
  assert.equal(repository.writes.length, 0);
});

test("empty embedding batch never calls the provider", async () => {
  const repository = new FakeEmbeddingRepository();
  let providerCalls = 0;
  const provider: ShopKnowledgeChunkEmbeddingProvider = {
    async embedDocuments() {
      providerCalls += 1;
      return [];
    },
  };

  const result = await runShopKnowledgeChunkEmbeddingBatch(repository, provider, {
    model: "embedding-model-v2",
    batchSize: 20,
  });

  assert.equal(providerCalls, 0);
  assert.deepEqual(result, {
    selected: 0,
    embedded: 0,
    skippedStale: 0,
    finalizedKnowledge: 0,
    checkpoint: null,
  });
});

test("bounded worker retries provider failures and stops at the chunk limit", async () => {
  const repository = new FakeEmbeddingRepository();
  repository.candidates = [
    {
      id: "chunk-retry",
      knowledgeId: "knowledge-1",
      productId: "product-1",
      revision: 2,
      contentHash: "hash-2",
      content: "A".repeat(800),
    },
  ];
  let calls = 0;
  const provider: ShopKnowledgeChunkEmbeddingProvider = {
    async embedDocuments(input) {
      calls += 1;
      if (calls === 1) throw new Error("temporary provider outage");
      repository.candidates = [];
      return input.contents.map(() =>
        Array.from({ length: SHOP_KNOWLEDGE_CHUNK_EMBEDDING_DIMENSIONS }, () => 0.2)
      );
    },
  };

  const checkpoints: Array<{ lastChunkId: string | null }> = [];
  const result = await runShopKnowledgeEmbeddingWorker(repository, provider, {
    model: "embedding-model-v2",
    batchSize: 1,
    maxChunks: 1,
    maxProviderCalls: 2,
    maxAttemptsPerBatch: 2,
    maxEstimatedCostUsd: 1,
    estimatedCostPerThousandTokensUsd: 0.001,
    scope: { categoryGroups: ["exhaust"] },
    onProgress(checkpoint) {
      checkpoints.push(checkpoint);
    },
  });

  assert.equal(calls, 2);
  assert.equal(result.providerCalls, 2);
  assert.equal(result.selected, 1);
  assert.equal(result.embedded, 1);
  assert.equal(result.stoppedBy, "chunk_limit");
  assert.deepEqual(repository.lastScope, { categoryGroups: ["exhaust"] });
  assert.equal(result.lastCheckpoint?.lastChunkId, "chunk-retry");
  assert.deepEqual(
    checkpoints.map((checkpoint) => checkpoint.lastChunkId),
    ["chunk-retry"]
  );
});

test("bounded worker refuses an embedding call that would exceed the cost ceiling", async () => {
  const repository = new FakeEmbeddingRepository();
  repository.candidates = [
    {
      id: "chunk-expensive",
      knowledgeId: "knowledge-1",
      productId: "product-1",
      revision: 2,
      contentHash: "hash-expensive",
      content: "A".repeat(4_000),
    },
  ];
  let calls = 0;
  const provider: ShopKnowledgeChunkEmbeddingProvider = {
    async embedDocuments() {
      calls += 1;
      return [];
    },
  };

  const result = await runShopKnowledgeEmbeddingWorker(repository, provider, {
    model: "embedding-model-v2",
    batchSize: 1,
    maxChunks: 10,
    maxProviderCalls: 2,
    maxAttemptsPerBatch: 2,
    maxEstimatedCostUsd: 0.0001,
    estimatedCostPerThousandTokensUsd: 1,
  });

  assert.equal(calls, 0);
  assert.equal(result.providerCalls, 0);
  assert.equal(result.selected, 0);
  assert.equal(result.stoppedBy, "cost_limit");
});

test("bounded worker rejects an invalid provider call interval", async () => {
  const repository = new FakeEmbeddingRepository();
  const provider: ShopKnowledgeChunkEmbeddingProvider = {
    async embedDocuments() {
      return [];
    },
  };

  await assert.rejects(
    runShopKnowledgeEmbeddingWorker(repository, provider, {
      model: "embedding-model-v2",
      batchSize: 1,
      maxChunks: 1,
      maxProviderCalls: 1,
      maxAttemptsPerBatch: 1,
      minProviderCallIntervalMs: 60_001,
      maxEstimatedCostUsd: 1,
      estimatedCostPerThousandTokensUsd: 0.001,
    }),
    /minProviderCallIntervalMs/
  );
});

test("bounded worker stops immediately when the daily provider quota is exhausted", async () => {
  const repository = new FakeEmbeddingRepository();
  repository.candidates = [
    {
      id: "chunk-daily-quota",
      knowledgeId: "knowledge-1",
      productId: "product-1",
      revision: 1,
      contentHash: "hash-daily-quota",
      content: "quota test",
    },
  ];
  let calls = 0;
  let sleeps = 0;
  const provider: ShopKnowledgeChunkEmbeddingProvider = {
    async embedDocuments() {
      calls += 1;
      throw Object.assign(
        new Error("EmbedContentRequestsPerDayPerUserPerProjectPerModel-FreeTier"),
        { status: 429 }
      );
    },
  };

  const result = await runShopKnowledgeEmbeddingWorker(repository, provider, {
    model: "embedding-model-v2",
    batchSize: 1,
    maxChunks: 1,
    maxProviderCalls: 3,
    maxAttemptsPerBatch: 3,
    maxEstimatedCostUsd: 1,
    estimatedCostPerThousandTokensUsd: 0.001,
    async sleep() {
      sleeps += 1;
    },
  });

  assert.equal(calls, 1);
  assert.equal(sleeps, 0);
  assert.equal(result.selected, 0);
  assert.equal(result.stoppedBy, "quota_limit");
});

test("bounded worker reports minute quota cleanly when retries are disabled", async () => {
  const repository = new FakeEmbeddingRepository();
  repository.candidates = [
    {
      id: "chunk-minute-quota",
      knowledgeId: "knowledge-1",
      productId: "product-1",
      revision: 1,
      contentHash: "hash-minute-quota",
      content: "quota test",
    },
  ];
  const provider: ShopKnowledgeChunkEmbeddingProvider = {
    async embedDocuments() {
      throw Object.assign(new Error("RESOURCE_EXHAUSTED: rate limit exceeded"), { status: 429 });
    },
  };

  const result = await runShopKnowledgeEmbeddingWorker(repository, provider, {
    model: "embedding-model-v2",
    batchSize: 1,
    maxChunks: 1,
    maxProviderCalls: 1,
    maxAttemptsPerBatch: 1,
    maxEstimatedCostUsd: 1,
    estimatedCostPerThousandTokensUsd: 0.001,
  });

  assert.equal(result.providerCalls, 1);
  assert.equal(result.embedded, 0);
  assert.equal(result.stoppedBy, "quota_limit");
});
