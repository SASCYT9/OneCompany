import { buildShopKnowledgeV2 } from "@/lib/shopKnowledgeV2/builders";
import type {
  KnowledgeCurrentRecord,
  KnowledgeIndexCommit,
  KnowledgeIndexOutcome,
  KnowledgeOutboxJob,
  KnowledgeSourceProduct,
  ShopKnowledgeBuild,
} from "@/lib/shopKnowledgeV2/types";

export type ClaimKnowledgeOutboxInput = {
  workerId: string;
  limit: number;
  now: Date;
  staleBefore: Date;
};

export type ClaimKnowledgeOutboxJobByIdInput = {
  jobId: string;
  workerId: string;
  now: Date;
  staleBefore: Date;
};

export type RetryKnowledgeOutboxInput = {
  jobId: string;
  error: string;
  availableAt: Date;
  attempts: number;
  workerId?: string;
};

export interface ShopKnowledgeV2Repository {
  loadSourceProduct(productId: string): Promise<KnowledgeSourceProduct | null>;
  getCurrentKnowledge(productId: string): Promise<KnowledgeCurrentRecord | null>;
  touchKnowledgeSource?(productId: string, sourceUpdatedAt: Date, checkedAt: Date): Promise<void>;
  commitKnowledgeIndex(input: KnowledgeIndexCommit): Promise<void>;
  claimOutboxJobs(input: ClaimKnowledgeOutboxInput): Promise<KnowledgeOutboxJob[]>;
  claimOutboxJobById?(input: ClaimKnowledgeOutboxJobByIdInput): Promise<KnowledgeOutboxJob | null>;
  completeOutboxJob(jobId: string, processedAt: Date, workerId?: string): Promise<void>;
  retryOutboxJob(input: RetryKnowledgeOutboxInput): Promise<void>;
  deadLetterOutboxJob(
    jobId: string,
    error: string,
    attempts: number,
    workerId?: string
  ): Promise<void>;
}

export class StaleKnowledgeCommitError extends Error {
  constructor(productId: string) {
    super(`Knowledge source changed while indexing product ${productId}`);
    this.name = "StaleKnowledgeCommitError";
  }
}

function outcomeFor(
  build: ShopKnowledgeBuild,
  mode: KnowledgeIndexOutcome["mode"],
  result: KnowledgeIndexOutcome["result"],
  revision: number
): KnowledgeIndexOutcome {
  return {
    productId: build.productId,
    mode,
    result,
    revision,
    contentHash: build.contentHash,
    status: build.status,
    chunks: build.chunks.length,
    applications: build.applications.length,
    variants: build.variants.length,
    qualityFlags: build.qualityFlags,
  };
}

export function previewShopKnowledgeProduct(
  product: KnowledgeSourceProduct
): KnowledgeIndexOutcome {
  const build = buildShopKnowledgeV2(product);
  return outcomeFor(build, "dry-run", build.status === "BLOCKED" ? "blocked" : "created", 1);
}

export async function indexShopKnowledgeProduct(
  repository: ShopKnowledgeV2Repository,
  product: KnowledgeSourceProduct,
  now = new Date()
): Promise<KnowledgeIndexOutcome> {
  const build = buildShopKnowledgeV2(product);
  const current = await repository.getCurrentKnowledge(product.id);
  const isActiveRevision =
    current?.status === build.status && current.activeRevision === current.revision;
  const isPendingEmbeddingRevision = current?.status === "PROCESSING";
  if (
    current?.contentHash === build.contentHash &&
    (isActiveRevision || isPendingEmbeddingRevision)
  ) {
    await repository.touchKnowledgeSource?.(product.id, product.updatedAt, now);
    return outcomeFor(build, "commit", "unchanged", current.revision);
  }

  const revision = (current?.revision ?? 0) + 1;
  await repository.commitKnowledgeIndex({
    build,
    revision,
    previous: current,
    indexedAt: now,
  });
  return outcomeFor(
    build,
    "commit",
    build.status === "BLOCKED" ? "blocked" : current ? "updated" : "created",
    revision
  );
}

export type KnowledgeOutboxWorkerOptions = {
  workerId: string;
  batchSize?: number;
  maxAttempts?: number;
  staleLockMs?: number;
  baseRetryMs?: number;
  maxRetryMs?: number;
  now?: Date;
};

export type KnowledgeOutboxWorkerResult = {
  claimed: number;
  completed: number;
  unchanged: number;
  retried: number;
  deadLettered: number;
  missingProducts: number;
};

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").trim().slice(0, 2_000) || "Unknown indexing error";
}

export function calculateKnowledgeRetryAt(
  now: Date,
  attempts: number,
  baseRetryMs = 30_000,
  maxRetryMs = 15 * 60_000
): Date {
  const exponent = Math.max(0, attempts - 1);
  const delay = Math.min(maxRetryMs, baseRetryMs * 2 ** exponent);
  return new Date(now.getTime() + delay);
}

export async function runShopKnowledgeOutboxWorker(
  repository: ShopKnowledgeV2Repository,
  options: KnowledgeOutboxWorkerOptions
): Promise<KnowledgeOutboxWorkerResult> {
  const now = options.now ?? new Date();
  const batchSize = options.batchSize ?? 20;
  const fallbackMaxAttempts = options.maxAttempts ?? 8;
  const staleLockMs = options.staleLockMs ?? 15 * 60_000;
  if (!options.workerId.trim()) throw new Error("Knowledge outbox workerId is required");
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) {
    throw new Error("Knowledge outbox batchSize must be between 1 and 100");
  }

  const jobs = await repository.claimOutboxJobs({
    workerId: options.workerId,
    limit: batchSize,
    now,
    staleBefore: new Date(now.getTime() - staleLockMs),
  });
  const result: KnowledgeOutboxWorkerResult = {
    claimed: jobs.length,
    completed: 0,
    unchanged: 0,
    retried: 0,
    deadLettered: 0,
    missingProducts: 0,
  };

  for (const job of jobs) {
    try {
      const product = await repository.loadSourceProduct(job.productId);
      if (!product) {
        result.missingProducts += 1;
        await repository.completeOutboxJob(job.id, now, options.workerId);
        result.completed += 1;
        continue;
      }
      const outcome = await indexShopKnowledgeProduct(repository, product, now);
      if (outcome.result === "unchanged") result.unchanged += 1;
      await repository.completeOutboxJob(job.id, now, options.workerId);
      result.completed += 1;
    } catch (error) {
      if (error instanceof StaleKnowledgeCommitError) {
        await repository.completeOutboxJob(job.id, now, options.workerId);
        result.completed += 1;
        result.unchanged += 1;
        continue;
      }
      const attempts = job.attempts;
      const message = safeErrorMessage(error);
      const maxAttempts = job.maxAttempts ?? fallbackMaxAttempts;
      if (attempts >= maxAttempts) {
        await repository.deadLetterOutboxJob(job.id, message, attempts, options.workerId);
        result.deadLettered += 1;
        continue;
      }
      await repository.retryOutboxJob({
        jobId: job.id,
        error: message,
        attempts,
        workerId: options.workerId,
        availableAt: calculateKnowledgeRetryAt(
          now,
          attempts,
          options.baseRetryMs,
          options.maxRetryMs
        ),
      });
      result.retried += 1;
    }
  }

  return result;
}

export async function runShopKnowledgeOutboxJobById(
  repository: ShopKnowledgeV2Repository,
  jobId: string,
  options: Omit<KnowledgeOutboxWorkerOptions, "batchSize">
): Promise<KnowledgeOutboxWorkerResult> {
  const now = options.now ?? new Date();
  const fallbackMaxAttempts = options.maxAttempts ?? 8;
  const staleLockMs = options.staleLockMs ?? 15 * 60_000;
  if (!options.workerId.trim()) throw new Error("Knowledge outbox workerId is required");
  if (!jobId.trim()) throw new Error("Knowledge outbox jobId is required");
  if (!repository.claimOutboxJobById) {
    throw new Error("Targeted knowledge outbox claiming is not supported");
  }

  const job = await repository.claimOutboxJobById({
    jobId,
    workerId: options.workerId,
    now,
    staleBefore: new Date(now.getTime() - staleLockMs),
  });
  const result: KnowledgeOutboxWorkerResult = {
    claimed: job ? 1 : 0,
    completed: 0,
    unchanged: 0,
    retried: 0,
    deadLettered: 0,
    missingProducts: 0,
  };
  if (!job) return result;

  try {
    const product = await repository.loadSourceProduct(job.productId);
    if (!product) {
      result.missingProducts = 1;
      await repository.completeOutboxJob(job.id, now, options.workerId);
      result.completed = 1;
      return result;
    }
    const outcome = await indexShopKnowledgeProduct(repository, product, now);
    if (outcome.result === "unchanged") result.unchanged = 1;
    await repository.completeOutboxJob(job.id, now, options.workerId);
    result.completed = 1;
  } catch (error) {
    if (error instanceof StaleKnowledgeCommitError) {
      await repository.completeOutboxJob(job.id, now, options.workerId);
      result.completed = 1;
      result.unchanged = 1;
      return result;
    }
    const attempts = job.attempts;
    const message = safeErrorMessage(error);
    const maxAttempts = job.maxAttempts ?? fallbackMaxAttempts;
    if (attempts >= maxAttempts) {
      await repository.deadLetterOutboxJob(job.id, message, attempts, options.workerId);
      result.deadLettered = 1;
      return result;
    }
    await repository.retryOutboxJob({
      jobId: job.id,
      error: message,
      attempts,
      workerId: options.workerId,
      availableAt: calculateKnowledgeRetryAt(
        now,
        attempts,
        options.baseRetryMs,
        options.maxRetryMs
      ),
    });
    result.retried = 1;
  }
  return result;
}
