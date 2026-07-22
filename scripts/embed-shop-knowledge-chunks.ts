import { GoogleGenAI } from "@google/genai";
import { config } from "dotenv";

import { prisma } from "../src/lib/prisma";
import {
  SHOP_KNOWLEDGE_CHUNK_EMBEDDING_DIMENSIONS,
  SHOP_KNOWLEDGE_CHUNK_EMBEDDING_MODEL,
  createPrismaShopKnowledgeChunkEmbeddingRepository,
  runShopKnowledgeEmbeddingWorker,
  type ShopKnowledgeChunkEmbeddingProvider,
} from "../src/lib/shopKnowledgeV2";

config({ path: ".env.local", override: false, quiet: true });

function parsePositiveInteger(
  argv: string[],
  name: string,
  fallback: number,
  maximum: number
): number {
  const raw = argv.find((argument) => argument.startsWith(`${name}=`))?.split("=")[1];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0 || value > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}`);
  }
  return value;
}

function parseModel(argv: string[]): string {
  const explicit = argv.find((argument) => argument.startsWith("--model="))?.split("=")[1];
  const model =
    explicit?.trim() ||
    process.env.SHOP_AI_EMBEDDING_MODEL?.trim() ||
    SHOP_KNOWLEDGE_CHUNK_EMBEDDING_MODEL;
  if (!model) throw new Error("Embedding model is required");
  return model;
}

function parsePositiveNumber(
  argv: string[],
  name: string,
  fallback: number,
  maximum: number
): number {
  const raw = argv.find((argument) => argument.startsWith(`${name}=`))?.split("=")[1];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > maximum) {
    throw new Error(`${name} must be greater than 0 and at most ${maximum}`);
  }
  return value;
}

function assertSafeCommitEnvironment() {
  if (process.env.VERCEL === "1") {
    throw new Error(
      "Knowledge V2 embedding worker cannot run in Vercel Build or a Vercel Function"
    );
  }
  if (
    (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") &&
    process.env.SHOP_KNOWLEDGE_EMBEDDING_PRODUCTION_ACK !== "1"
  ) {
    throw new Error(
      "Production embedding requires SHOP_KNOWLEDGE_EMBEDDING_PRODUCTION_ACK=1 in a controlled external worker"
    );
  }
}

function createGoogleEmbeddingProvider(apiKey: string): ShopKnowledgeChunkEmbeddingProvider {
  const client = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });
  return {
    async embedDocuments(input) {
      const response = await client.models.embedContent({
        model: input.model,
        // Every string is one complete 600-800-token knowledge chunk. Do not
        // truncate: contentHash and the stored vector must describe identical text.
        contents: input.contents,
        config: {
          taskType: "RETRIEVAL_DOCUMENT",
          outputDimensionality: input.dimensions,
          httpOptions: { timeout: 30_000 },
        },
      });
      return (response.embeddings ?? []).map((embedding) => embedding.values ?? []);
    },
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const commit = argv.includes("--commit");
  const limit = parsePositiveInteger(argv, "--limit", 100, 10_000);
  const batchSize = parsePositiveInteger(argv, "--batch", 20, 100);
  const maxProviderCalls = parsePositiveInteger(argv, "--max-calls", 50, 1_000);
  const maxAttemptsPerBatch = parsePositiveInteger(argv, "--attempts", 3, 8);
  const maxEstimatedCostUsd = parsePositiveNumber(
    argv,
    "--max-cost-usd",
    Number(process.env.SHOP_KNOWLEDGE_EMBEDDING_MAX_COST_USD || 5),
    10_000
  );
  const estimatedCostPerThousandTokensUsd = parsePositiveNumber(
    argv,
    "--cost-per-1k-tokens-usd",
    Number(process.env.SHOP_KNOWLEDGE_EMBEDDING_COST_PER_1K_TOKENS_USD || 0.0002),
    100
  );
  const model = parseModel(argv);
  const repository = createPrismaShopKnowledgeChunkEmbeddingRepository(prisma);
  const before = await repository.getEmbeddingBacklog(model);

  if (!commit) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          model,
          dimensions: SHOP_KNOWLEDGE_CHUNK_EMBEDDING_DIMENSIONS,
          limit,
          batchSize,
          maxProviderCalls,
          maxAttemptsPerBatch,
          maxEstimatedCostUsd,
          estimatedCostPerThousandTokensUsd,
          backlog: before,
        },
        null,
        2
      )
    );
    return;
  }

  assertSafeCommitEnvironment();
  const apiKey = (process.env.SHOP_AI_API_KEY || process.env.GEMINI_API_KEY)?.trim();
  if (!apiKey) throw new Error("SHOP_AI_API_KEY or GEMINI_API_KEY is required for --commit");
  const provider = createGoogleEmbeddingProvider(apiKey);
  const startedAt = new Date();
  const preparedKnowledge = await repository.prepareEmbeddingLifecycle(model, startedAt);
  let finalizedKnowledge = await repository.finalizeReadyKnowledge({
    model,
    finalizedAt: startedAt,
    limit: 5_000,
  });
  const afterPrepare = await repository.getEmbeddingBacklog(model);
  if (afterPrepare.chunks === 0) {
    console.log(
      JSON.stringify(
        {
          mode: "commit",
          model,
          dimensions: SHOP_KNOWLEDGE_CHUNK_EMBEDDING_DIMENSIONS,
          preparedKnowledge,
          selected: 0,
          embedded: 0,
          skippedStale: 0,
          finalizedKnowledge,
          remaining: afterPrepare,
        },
        null,
        2
      )
    );
    return;
  }

  const worker = await runShopKnowledgeEmbeddingWorker(repository, provider, {
    model,
    batchSize,
    maxChunks: limit,
    maxProviderCalls,
    maxAttemptsPerBatch,
    maxEstimatedCostUsd,
    estimatedCostPerThousandTokensUsd,
  });
  finalizedKnowledge += worker.finalizedKnowledge;

  finalizedKnowledge += await repository.finalizeReadyKnowledge({
    model,
    finalizedAt: new Date(),
    limit: 5_000,
  });
  const remaining = await repository.getEmbeddingBacklog(model);
  console.log(
    JSON.stringify(
      {
        mode: "commit",
        model,
        dimensions: SHOP_KNOWLEDGE_CHUNK_EMBEDDING_DIMENSIONS,
        preparedKnowledge,
        ...worker,
        finalizedKnowledge,
        remaining,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
