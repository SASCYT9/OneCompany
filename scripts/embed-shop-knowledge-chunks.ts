import { GoogleGenAI } from "@google/genai";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

import {
  SHOP_KNOWLEDGE_CHUNK_EMBEDDING_DIMENSIONS,
  SHOP_KNOWLEDGE_CHUNK_EMBEDDING_PROVIDER_MODEL,
  buildShopKnowledgeEmbeddingTaskConfig,
  buildShopKnowledgeEmbeddingContents,
  createPrismaShopKnowledgeChunkEmbeddingRepository,
  estimateShopKnowledgeEmbeddingDryRun,
  resolveShopKnowledgeEmbeddingStorageModel,
  resolveShopKnowledgeWorkerDatabaseUrl,
  runShopKnowledgeEmbeddingWorker,
  type ShopKnowledgeChunkEmbeddingProvider,
} from "../src/lib/shopKnowledgeV2";
import {
  SHOP_STOCK_CATEGORY_GROUPS,
  type ShopStockCategoryGroupId,
} from "../src/lib/shopStockTaxonomy";

config({ path: ".env.local", override: false, quiet: true });

// Long-running writes must bypass Prisma Accelerate's interactive transaction
// limits. Keep this client isolated from the storefront's warm-instance client.
const prisma = new PrismaClient({
  datasourceUrl: resolveShopKnowledgeWorkerDatabaseUrl(process.env),
});

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

function parseNonNegativeInteger(
  argv: string[],
  name: string,
  fallback: number,
  maximum: number
): number {
  const raw = argv.find((argument) => argument.startsWith(`${name}=`))?.split("=")[1];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > maximum) {
    throw new Error(`${name} must be an integer between 0 and ${maximum}`);
  }
  return value;
}

function parseModel(argv: string[]): string {
  const explicit = argv.find((argument) => argument.startsWith("--model="))?.split("=")[1];
  const model =
    explicit?.trim() ||
    process.env.SHOP_AI_EMBEDDING_MODEL?.trim() ||
    SHOP_KNOWLEDGE_CHUNK_EMBEDDING_PROVIDER_MODEL;
  if (!model) throw new Error("Embedding model is required");
  return model;
}

function parseCategoryGroups(argv: string[]): ShopStockCategoryGroupId[] | undefined {
  const raw = argv.find((argument) => argument.startsWith("--category="))?.split("=")[1];
  if (raw === undefined) return undefined;
  const allowed = new Set<string>(
    SHOP_STOCK_CATEGORY_GROUPS.map((group) => group.id).filter((category) => category !== "other")
  );
  const categories = Array.from(
    new Set(
      raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
  if (categories.length === 0 || categories.some((category) => !allowed.has(category))) {
    throw new Error(`--category must contain canonical groups: ${Array.from(allowed).join(", ")}`);
  }
  return categories as ShopStockCategoryGroupId[];
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

function createGoogleEmbeddingProvider(
  apiKey: string,
  providerModel: string
): ShopKnowledgeChunkEmbeddingProvider {
  const client = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });
  return {
    async embedDocuments(input) {
      const response = await client.models.embedContent({
        model: providerModel,
        // Every string is one complete 600-800-token knowledge chunk. Do not
        // truncate: contentHash and the stored vector must describe identical text.
        // A string[] is normalized by @google/genai into multiple parts of one
        // Content and therefore produces one aggregate vector. Explicit Content
        // objects preserve the required one-document/one-vector contract.
        contents: buildShopKnowledgeEmbeddingContents(input.contents, providerModel),
        config: {
          ...buildShopKnowledgeEmbeddingTaskConfig(providerModel, "document"),
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
  const quiet = argv.includes("--quiet");
  const limit = parsePositiveInteger(argv, "--limit", 100, 10_000);
  const batchSize = parsePositiveInteger(argv, "--batch", 20, 100);
  const maxProviderCalls = parsePositiveInteger(argv, "--max-calls", 50, 1_000);
  const maxAttemptsPerBatch = parsePositiveInteger(argv, "--attempts", 3, 8);
  const minProviderCallIntervalMs = parseNonNegativeInteger(
    argv,
    "--min-call-interval-ms",
    Number(process.env.SHOP_KNOWLEDGE_EMBEDDING_MIN_CALL_INTERVAL_MS || 0),
    60_000
  );
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
  const providerModel = parseModel(argv);
  const model = resolveShopKnowledgeEmbeddingStorageModel(providerModel);
  const categoryGroups = parseCategoryGroups(argv);
  const brand = argv
    .find((argument) => argument.startsWith("--brand="))
    ?.split("=")[1]
    ?.trim();
  const scopedProductIds = brand
    ? (
        await prisma.shopProduct.findMany({
          where: { brand },
          select: { id: true },
        })
      ).map((product) => product.id)
    : undefined;
  const scope = { productIds: scopedProductIds, categoryGroups };
  const repository = createPrismaShopKnowledgeChunkEmbeddingRepository(prisma);
  const before = await repository.getEmbeddingBacklog(model, scope);
  const estimate = estimateShopKnowledgeEmbeddingDryRun({
    backlog: before,
    maxChunks: limit,
    batchSize,
    maxProviderCalls,
    estimatedCostPerThousandTokensUsd,
    maxEstimatedCostUsd,
  });

  if (!commit) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          model,
          providerModel,
          dimensions: SHOP_KNOWLEDGE_CHUNK_EMBEDDING_DIMENSIONS,
          limit,
          batchSize,
          maxProviderCalls,
          maxAttemptsPerBatch,
          minProviderCallIntervalMs,
          maxEstimatedCostUsd,
          estimatedCostPerThousandTokensUsd,
          brand: brand ?? null,
          categoryGroups: categoryGroups ?? null,
          scopedProducts: scopedProductIds?.length ?? null,
          backlog: before,
          estimate,
        },
        null,
        2
      )
    );
    return;
  }

  assertSafeCommitEnvironment();
  const apiKey = (
    process.env.SHOP_AI_EMBEDDING_API_KEY ||
    process.env.OPS_GEMINI_API_KEY ||
    process.env.SHOP_AI_API_KEY ||
    process.env.GEMINI_API_KEY
  )?.trim();
  if (!apiKey) {
    throw new Error(
      "SHOP_AI_EMBEDDING_API_KEY, OPS_GEMINI_API_KEY, SHOP_AI_API_KEY, or GEMINI_API_KEY is required for --commit"
    );
  }
  const provider = createGoogleEmbeddingProvider(apiKey, providerModel);
  const startedAt = new Date();
  const preparedKnowledge = await repository.prepareEmbeddingLifecycle(model, startedAt, scope);
  let finalizedKnowledge = await repository.finalizeReadyKnowledge({
    model,
    finalizedAt: startedAt,
    limit: 5_000,
    scope,
  });
  const afterPrepare = await repository.getEmbeddingBacklog(model, scope);
  if (afterPrepare.chunks === 0) {
    console.log(
      JSON.stringify(
        {
          mode: "commit",
          model,
          providerModel,
          dimensions: SHOP_KNOWLEDGE_CHUNK_EMBEDDING_DIMENSIONS,
          brand: brand ?? null,
          categoryGroups: categoryGroups ?? null,
          scopedProducts: scopedProductIds?.length ?? null,
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
    minProviderCallIntervalMs,
    maxEstimatedCostUsd,
    estimatedCostPerThousandTokensUsd,
    scope,
    onProgress(checkpoint) {
      if (!quiet) {
        console.log(JSON.stringify({ type: "embedding_checkpoint", ...checkpoint }));
      }
    },
  });
  finalizedKnowledge += worker.finalizedKnowledge;

  finalizedKnowledge += await repository.finalizeReadyKnowledge({
    model,
    finalizedAt: new Date(),
    limit: 5_000,
    scope,
  });
  const remaining = await repository.getEmbeddingBacklog(model, scope);
  console.log(
    JSON.stringify(
      {
        mode: "commit",
        model,
        providerModel,
        dimensions: SHOP_KNOWLEDGE_CHUNK_EMBEDDING_DIMENSIONS,
        brand: brand ?? null,
        categoryGroups: categoryGroups ?? null,
        scopedProducts: scopedProductIds?.length ?? null,
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
