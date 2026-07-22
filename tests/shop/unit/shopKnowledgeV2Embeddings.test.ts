import assert from "node:assert/strict";
import test from "node:test";

import {
  SHOP_KNOWLEDGE_CHUNK_EMBEDDING_DIMENSIONS,
  runShopKnowledgeChunkEmbeddingBatch,
  runShopKnowledgeEmbeddingWorker,
  type ShopKnowledgeChunkEmbeddingCandidate,
  type ShopKnowledgeChunkEmbeddingProvider,
  type ShopKnowledgeChunkEmbeddingRepository,
  type ShopKnowledgeChunkEmbeddingWrite,
} from "../../../src/lib/shopKnowledgeV2/embeddings";

class FakeEmbeddingRepository implements ShopKnowledgeChunkEmbeddingRepository {
  candidates: ShopKnowledgeChunkEmbeddingCandidate[] = [];
  writes: ShopKnowledgeChunkEmbeddingWrite[] = [];
  prepared = 0;
  finalized = 0;

  async getEmbeddingBacklog() {
    return {
      chunks: this.candidates.length,
      products: new Set(this.candidates.map((candidate) => candidate.productId)).size,
      knowledgeRecords: new Set(this.candidates.map((candidate) => candidate.knowledgeId)).size,
    };
  }

  async prepareEmbeddingLifecycle() {
    return this.prepared;
  }

  async listPendingChunkEmbeddings(_model: string, limit: number) {
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

  const result = await runShopKnowledgeEmbeddingWorker(repository, provider, {
    model: "embedding-model-v2",
    batchSize: 1,
    maxChunks: 1,
    maxProviderCalls: 2,
    maxAttemptsPerBatch: 2,
    maxEstimatedCostUsd: 1,
    estimatedCostPerThousandTokensUsd: 0.001,
  });

  assert.equal(calls, 2);
  assert.equal(result.providerCalls, 2);
  assert.equal(result.selected, 1);
  assert.equal(result.embedded, 1);
  assert.equal(result.stoppedBy, "chunk_limit");
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
