import { GoogleGenAI, JobState, type BatchJob } from "@google/genai";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  SHOP_KNOWLEDGE_CHUNK_EMBEDDING_DIMENSIONS,
  SHOP_KNOWLEDGE_CHUNK_EMBEDDING_PROVIDER_MODEL,
  buildShopKnowledgeDocumentEmbeddingText,
  buildShopKnowledgeEmbeddingContents,
  buildShopKnowledgeEmbeddingTaskConfig,
  createPrismaShopKnowledgeChunkEmbeddingRepository,
  resolveShopKnowledgeEmbeddingStorageModel,
  resolveShopKnowledgeWorkerDatabaseUrl,
  type ShopKnowledgeChunkEmbeddingCandidate,
  type ShopKnowledgeChunkEmbeddingScope,
} from "../src/lib/shopKnowledgeV2";
import {
  SHOP_STOCK_CATEGORY_GROUPS,
  type ShopStockCategoryGroupId,
} from "../src/lib/shopStockTaxonomy";

config({ path: ".env.local", override: false, quiet: true });

const STATE_PATH = path.resolve(".tmp", "shop-ai-embedding-batch-state.json");
const LEDGER_PATH = path.resolve(".tmp", "shop-ai-embedding-batch-ledger.json");
const BATCH_COST_PER_1K_TOKENS_USD = 0.0001;
const TERMINAL_STATES = new Set<JobState>([
  JobState.JOB_STATE_SUCCEEDED,
  JobState.JOB_STATE_FAILED,
  JobState.JOB_STATE_CANCELLED,
  JobState.JOB_STATE_EXPIRED,
]);

type PersistedCandidate = Omit<ShopKnowledgeChunkEmbeddingCandidate, "content">;

type PersistedBatchState = {
  schemaVersion: 1;
  jobName: string;
  displayName: string;
  providerModel: string;
  storageModel: string;
  dimensions: number;
  categoryGroups: ShopStockCategoryGroupId[];
  estimatedTokens: number;
  estimatedCostUsd: number;
  costSettled: boolean;
  createdAt: string;
  candidates: PersistedCandidate[];
};

type CostLedger = {
  schemaVersion: 1;
  budgetUsd: number;
  estimatedSpentUsd: number;
  updatedAt: string;
};

function parsePositiveNumber(argv: string[], name: string, fallback: number, maximum: number) {
  const raw = argv.find((argument) => argument.startsWith(`${name}=`))?.split("=")[1];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > maximum) {
    throw new Error(`${name} must be greater than 0 and at most ${maximum}`);
  }
  return value;
}

function parsePositiveInteger(argv: string[], name: string, fallback: number, maximum: number) {
  const value = parsePositiveNumber(argv, name, fallback, maximum);
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer`);
  return value;
}

function parseCategoryGroups(argv: string[]): ShopStockCategoryGroupId[] {
  const canonical = SHOP_STOCK_CATEGORY_GROUPS.map((group) => group.id).filter(
    (category) => category !== "other"
  ) as ShopStockCategoryGroupId[];
  const raw = argv.find((argument) => argument.startsWith("--category="))?.split("=")[1];
  if (raw === undefined) return canonical;
  const allowed = new Set<string>(canonical);
  const categories = Array.from(
    new Set(
      raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
  if (categories.length === 0 || categories.some((category) => !allowed.has(category))) {
    throw new Error(`--category must contain canonical groups: ${canonical.join(", ")}`);
  }
  return categories as ShopStockCategoryGroupId[];
}

function assertSafeCommitEnvironment() {
  if (process.env.VERCEL === "1") {
    throw new Error("Knowledge V2 batch worker cannot run in a Vercel Build or Function");
  }
  if (
    (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") &&
    process.env.SHOP_KNOWLEDGE_EMBEDDING_PRODUCTION_ACK !== "1"
  ) {
    throw new Error(
      "Production batch embedding requires SHOP_KNOWLEDGE_EMBEDDING_PRODUCTION_ACK=1"
    );
  }
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw error;
  }
}

async function writeJsonAtomic(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}

async function loadLedger(budgetUsd: number, initialSpendUsd: number): Promise<CostLedger> {
  const existing = await readJson<CostLedger>(LEDGER_PATH);
  if (existing) {
    if (existing.schemaVersion !== 1) throw new Error("Unsupported batch cost ledger version");
    if (existing.estimatedSpentUsd > existing.budgetUsd) {
      throw new Error("Stored batch cost ledger already exceeds its budget");
    }
    return existing;
  }
  const ledger: CostLedger = {
    schemaVersion: 1,
    budgetUsd,
    estimatedSpentUsd: initialSpendUsd,
    updatedAt: new Date().toISOString(),
  };
  if (ledger.estimatedSpentUsd > ledger.budgetUsd) {
    throw new Error("Initial estimated spend exceeds the embedding budget");
  }
  await writeJsonAtomic(LEDGER_PATH, ledger);
  return ledger;
}

async function settleBatchCost(state: PersistedBatchState, ledger: CostLedger) {
  if (state.costSettled) return ledger;
  const next: CostLedger = {
    ...ledger,
    estimatedSpentUsd: ledger.estimatedSpentUsd + state.estimatedCostUsd,
    updatedAt: new Date().toISOString(),
  };
  if (next.estimatedSpentUsd > next.budgetUsd + Number.EPSILON) {
    throw new Error("Completed batch would exceed the persisted cost budget");
  }
  await writeJsonAtomic(LEDGER_PATH, next);
  state.costSettled = true;
  await writeJsonAtomic(STATE_PATH, state);
  return next;
}

function selectBatch(
  candidates: ShopKnowledgeChunkEmbeddingCandidate[],
  providerModel: string,
  maxTokens: number
) {
  const selected: ShopKnowledgeChunkEmbeddingCandidate[] = [];
  let estimatedTokens = 0;
  for (const candidate of candidates) {
    const document = buildShopKnowledgeDocumentEmbeddingText(candidate.content, providerModel);
    const tokens = Math.max(1, Math.ceil(document.length / 4));
    if (selected.length > 0 && estimatedTokens + tokens > maxTokens) break;
    selected.push(candidate);
    estimatedTokens += tokens;
  }
  return { selected, estimatedTokens };
}

function batchDigest(candidates: ShopKnowledgeChunkEmbeddingCandidate[]) {
  const hash = createHash("sha256");
  for (const candidate of candidates) {
    hash.update(candidate.id);
    hash.update(candidate.contentHash);
  }
  return hash.digest("hex").slice(0, 16);
}

async function pollBatch(
  client: GoogleGenAI,
  jobName: string,
  pollMs: number,
  maxWaitMs: number
): Promise<BatchJob | null> {
  const startedAt = Date.now();
  let previousState: JobState | undefined;
  let polls = 0;
  while (true) {
    const job = await client.batches.get({ name: jobName });
    polls += 1;
    if (job.state !== previousState || polls % 6 === 0) {
      console.log(
        JSON.stringify({
          type: "embedding_batch_checkpoint",
          jobName,
          state: job.state ?? null,
          waitedSeconds: Math.round((Date.now() - startedAt) / 1_000),
        })
      );
      previousState = job.state;
    }
    if (job.state && TERMINAL_STATES.has(job.state)) return job;
    if (Date.now() - startedAt >= maxWaitMs) return null;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

async function main() {
  const argv = process.argv.slice(2);
  assertSafeCommitEnvironment();

  const providerModel =
    process.env.SHOP_AI_EMBEDDING_MODEL?.trim() || SHOP_KNOWLEDGE_CHUNK_EMBEDDING_PROVIDER_MODEL;
  const storageModel = resolveShopKnowledgeEmbeddingStorageModel(providerModel);
  const categoryGroups = parseCategoryGroups(argv);
  const maxChunks = parsePositiveInteger(argv, "--max-chunks", 1_000, 5_000);
  const maxTokens = parsePositiveInteger(argv, "--max-tokens", 450_000, 500_000);
  const pollMs = parsePositiveInteger(argv, "--poll-ms", 10_000, 60_000);
  const maxWaitSeconds = parsePositiveInteger(argv, "--max-wait-seconds", 3_600, 86_400);
  const maxJobs = parsePositiveInteger(argv, "--max-jobs", 1, 100);
  const budgetUsd = parsePositiveNumber(argv, "--budget-usd", 2, 10_000);
  const initialSpendUsd = parsePositiveNumber(argv, "--initial-spend-usd", 0.15, budgetUsd);
  const apiKey = (
    process.env.SHOP_AI_EMBEDDING_API_KEY ||
    process.env.OPS_GEMINI_API_KEY ||
    process.env.SHOP_AI_API_KEY ||
    process.env.GEMINI_API_KEY
  )?.trim();
  if (!apiKey) {
    throw new Error(
      "SHOP_AI_EMBEDDING_API_KEY or another configured Gemini API key is required for batch embeddings"
    );
  }

  const prisma = new PrismaClient({
    datasourceUrl: resolveShopKnowledgeWorkerDatabaseUrl(process.env),
  });
  const repository = createPrismaShopKnowledgeChunkEmbeddingRepository(prisma);
  const client = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });
  let ledger = await loadLedger(budgetUsd, initialSpendUsd);
  let completedJobs = 0;

  try {
    while (completedJobs < maxJobs) {
      let state = await readJson<PersistedBatchState>(STATE_PATH);
      let scope: ShopKnowledgeChunkEmbeddingScope;

      if (!state) {
        scope = { categoryGroups };
        await repository.prepareEmbeddingLifecycle(storageModel, new Date(), scope);
        const candidates = await repository.listPendingChunkEmbeddings(
          storageModel,
          maxChunks,
          scope
        );
        const batch = selectBatch(candidates, providerModel, maxTokens);
        if (batch.selected.length === 0) {
          const finalizedKnowledge = await repository.finalizeReadyKnowledge({
            model: storageModel,
            finalizedAt: new Date(),
            limit: 5_000,
            scope,
          });
          console.log(
            JSON.stringify({
              mode: "batch",
              stoppedBy: "empty",
              completedJobs,
              finalizedKnowledge,
              ledger,
              remaining: await repository.getEmbeddingBacklog(storageModel, scope),
            })
          );
          return;
        }

        const estimatedCostUsd = (batch.estimatedTokens / 1_000) * BATCH_COST_PER_1K_TOKENS_USD;
        if (ledger.estimatedSpentUsd + estimatedCostUsd > ledger.budgetUsd) {
          console.log(
            JSON.stringify({
              mode: "batch",
              stoppedBy: "cost_limit",
              completedJobs,
              nextBatchEstimatedCostUsd: estimatedCostUsd,
              ledger,
            })
          );
          return;
        }

        const displayName = `oneai-v2-${batchDigest(batch.selected)}`;
        const created = await client.batches.createEmbeddings({
          model: providerModel,
          src: {
            inlinedRequests: {
              contents: buildShopKnowledgeEmbeddingContents(
                batch.selected.map((candidate) => candidate.content),
                providerModel
              ),
              config: {
                ...buildShopKnowledgeEmbeddingTaskConfig(providerModel, "document"),
                outputDimensionality: SHOP_KNOWLEDGE_CHUNK_EMBEDDING_DIMENSIONS,
              },
            },
          },
          config: {
            displayName,
            httpOptions: { timeout: 30_000 },
          },
        });
        if (!created.name) throw new Error("Embedding batch API did not return a job name");
        state = {
          schemaVersion: 1,
          jobName: created.name,
          displayName,
          providerModel,
          storageModel,
          dimensions: SHOP_KNOWLEDGE_CHUNK_EMBEDDING_DIMENSIONS,
          categoryGroups,
          estimatedTokens: batch.estimatedTokens,
          estimatedCostUsd,
          costSettled: false,
          createdAt: new Date().toISOString(),
          candidates: batch.selected.map((candidate) => ({
            id: candidate.id,
            knowledgeId: candidate.knowledgeId,
            productId: candidate.productId,
            revision: candidate.revision,
            contentHash: candidate.contentHash,
          })),
        };
        await writeJsonAtomic(STATE_PATH, state);
        console.log(
          JSON.stringify({
            type: "embedding_batch_submitted",
            jobName: state.jobName,
            displayName,
            chunks: state.candidates.length,
            estimatedTokens: state.estimatedTokens,
            estimatedCostUsd: state.estimatedCostUsd,
            ledger,
          })
        );
      } else {
        if (state.schemaVersion !== 1) throw new Error("Unsupported batch state version");
        scope = { categoryGroups: state.categoryGroups };
      }

      const completed = await pollBatch(client, state.jobName, pollMs, maxWaitSeconds * 1_000);
      if (!completed) {
        console.log(
          JSON.stringify({
            mode: "batch",
            stoppedBy: "wait_timeout",
            completedJobs,
            state,
            ledger,
          })
        );
        return;
      }

      ledger = await settleBatchCost(state, ledger);
      if (completed.state !== JobState.JOB_STATE_SUCCEEDED) {
        throw new Error(
          `Embedding batch ${state.jobName} ended as ${completed.state}: ${completed.error?.message ?? "unknown error"}`
        );
      }
      const responses = completed.dest?.inlinedEmbedContentResponses ?? [];
      if (responses.length !== state.candidates.length) {
        throw new Error(
          `Embedding batch output count ${responses.length} did not match ${state.candidates.length}`
        );
      }
      const writes = responses.map((response, index) => {
        if (response.error) {
          throw new Error(
            `Embedding batch item ${index} failed: ${response.error.message ?? response.error.code ?? "unknown error"}`
          );
        }
        const values = response.response?.embedding?.values ?? [];
        if (values.length !== SHOP_KNOWLEDGE_CHUNK_EMBEDDING_DIMENSIONS) {
          throw new Error(
            `Embedding batch item ${index} returned ${values.length} dimensions instead of ${SHOP_KNOWLEDGE_CHUNK_EMBEDDING_DIMENSIONS}`
          );
        }
        const candidate = state.candidates[index];
        return {
          chunkId: candidate.id,
          knowledgeId: candidate.knowledgeId,
          revision: candidate.revision,
          contentHash: candidate.contentHash,
          values,
        };
      });
      const stored = await repository.storeChunkEmbeddings({
        model: state.storageModel,
        embeddedAt: new Date(),
        writes,
      });
      const finalizedKnowledge =
        stored.finalizedKnowledge +
        (await repository.finalizeReadyKnowledge({
          model: state.storageModel,
          finalizedAt: new Date(),
          limit: 5_000,
          scope,
        }));
      await rm(STATE_PATH, { force: true });
      completedJobs += 1;
      console.log(
        JSON.stringify({
          type: "embedding_batch_stored",
          jobName: state.jobName,
          selected: state.candidates.length,
          ...stored,
          finalizedKnowledge,
          completedJobs,
          ledger,
          remaining: await repository.getEmbeddingBacklog(state.storageModel, scope),
        })
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (/FAILED_PRECONDITION|Precondition check failed/i.test(message)) {
    console.error(
      "Gemini Batch API rejected the project precondition. Configure a billing-enabled paid-tier key in SHOP_AI_EMBEDDING_API_KEY and retry; no batch job was created."
    );
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
