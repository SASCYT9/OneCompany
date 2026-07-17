import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateKnowledgeRetryAt,
  indexShopKnowledgeProduct,
  runShopKnowledgeOutboxJobById,
  runShopKnowledgeOutboxWorker,
  StaleKnowledgeCommitError,
  type ShopKnowledgeV2Repository,
} from "../../../src/lib/shopKnowledgeV2/indexer";
import type {
  KnowledgeCurrentRecord,
  KnowledgeIndexCommit,
  KnowledgeOutboxJob,
  KnowledgeSourceProduct,
} from "../../../src/lib/shopKnowledgeV2/types";
import { knowledgeSourceProduct } from "./shopKnowledgeV2TestFixture";

class FakeKnowledgeRepository implements ShopKnowledgeV2Repository {
  product: KnowledgeSourceProduct | null = knowledgeSourceProduct();
  current: KnowledgeCurrentRecord | null = null;
  commits: KnowledgeIndexCommit[] = [];
  jobs: KnowledgeOutboxJob[] = [];
  completed: string[] = [];
  retries: Array<{ jobId: string; attempts: number; availableAt: Date }> = [];
  deadLetters: string[] = [];
  failCommit = false;

  async loadSourceProduct() {
    return this.product;
  }

  async getCurrentKnowledge() {
    return this.current;
  }

  async commitKnowledgeIndex(input: KnowledgeIndexCommit) {
    if (this.failCommit) throw new Error("synthetic database failure");
    this.commits.push(input);
    this.current = {
      knowledgeId: "knowledge-1",
      productId: input.build.productId,
      revision: input.revision,
      activeRevision: input.revision,
      contentHash: input.build.contentHash,
      status: input.build.status,
    };
  }

  async claimOutboxJobs() {
    return this.jobs;
  }

  async claimOutboxJobById(input: { jobId: string }) {
    return this.jobs.find((job) => job.id === input.jobId) ?? null;
  }

  async completeOutboxJob(jobId: string) {
    this.completed.push(jobId);
  }

  async retryOutboxJob(input: { jobId: string; attempts: number; availableAt: Date }) {
    this.retries.push(input);
  }

  async deadLetterOutboxJob(jobId: string) {
    this.deadLetters.push(jobId);
  }
}

test("idempotent indexer does not create a revision for unchanged content", async () => {
  const repository = new FakeKnowledgeRepository();
  const first = await indexShopKnowledgeProduct(
    repository,
    knowledgeSourceProduct(),
    new Date("2026-07-17T11:00:00.000Z")
  );
  const second = await indexShopKnowledgeProduct(
    repository,
    knowledgeSourceProduct({ updatedAt: new Date("2026-07-18T11:00:00.000Z") }),
    new Date("2026-07-18T11:00:00.000Z")
  );

  assert.equal(first.result, "created");
  assert.equal(first.revision, 1);
  assert.equal(second.result, "unchanged");
  assert.equal(second.revision, 1);
  assert.equal(repository.commits.length, 1);
});

test("changed source content activates the next revision", async () => {
  const repository = new FakeKnowledgeRepository();
  await indexShopKnowledgeProduct(repository, knowledgeSourceProduct());
  const outcome = await indexShopKnowledgeProduct(
    repository,
    knowledgeSourceProduct({ shortDescEn: "Changed indexed description" })
  );

  assert.equal(outcome.result, "updated");
  assert.equal(outcome.revision, 2);
  assert.equal(repository.commits.length, 2);
});

test("same content does not create another revision while embeddings are pending", async () => {
  const repository = new FakeKnowledgeRepository();
  await indexShopKnowledgeProduct(repository, knowledgeSourceProduct());
  assert.ok(repository.current);
  repository.current = {
    ...repository.current,
    activeRevision: 0,
    status: "PROCESSING",
  };
  repository.commits = [];

  const outcome = await indexShopKnowledgeProduct(repository, knowledgeSourceProduct());

  assert.equal(outcome.result, "unchanged");
  assert.equal(outcome.revision, 1);
  assert.equal(repository.commits.length, 0);
});

test("empty outbox exits without product or persistence work", async () => {
  const repository = new FakeKnowledgeRepository();
  const result = await runShopKnowledgeOutboxWorker(repository, {
    workerId: "worker-1",
    now: new Date("2026-07-17T12:00:00.000Z"),
  });

  assert.deepEqual(result, {
    claimed: 0,
    completed: 0,
    unchanged: 0,
    retried: 0,
    deadLettered: 0,
    missingProducts: 0,
  });
  assert.equal(repository.commits.length, 0);
});

test("targeted outbox processing claims only the requested admin event", async () => {
  const repository = new FakeKnowledgeRepository();
  repository.jobs = [
    {
      id: "older-unrelated-job",
      productId: "another-product",
      dedupeKey: "another-product:SOURCE_CHANGED",
      status: "PROCESSING",
      attempts: 1,
    },
    {
      id: "admin-source-job",
      productId: "product-knowledge-v2",
      dedupeKey: "product-knowledge-v2:SOURCE_CHANGED",
      status: "PROCESSING",
      attempts: 1,
    },
  ];

  const result = await runShopKnowledgeOutboxJobById(repository, "admin-source-job", {
    workerId: "after-response-worker",
    now: new Date("2026-07-17T12:00:00.000Z"),
  });

  assert.equal(result.claimed, 1);
  assert.equal(result.completed, 1);
  assert.deepEqual(repository.completed, ["admin-source-job"]);
  assert.equal(repository.commits.length, 1);
});

test("outbox uses exponential retry and dead-letters the eighth failed attempt", async () => {
  const retryRepository = new FakeKnowledgeRepository();
  retryRepository.failCommit = true;
  retryRepository.jobs = [
    {
      id: "retry-job",
      productId: "product-knowledge-v2",
      dedupeKey: "product-knowledge-v2:1",
      status: "PROCESSING",
      attempts: 3,
    },
  ];
  const now = new Date("2026-07-17T12:00:00.000Z");
  const retryResult = await runShopKnowledgeOutboxWorker(retryRepository, {
    workerId: "worker-1",
    now,
  });

  assert.equal(retryResult.retried, 1);
  assert.equal(retryRepository.retries[0].attempts, 3);
  assert.equal(
    retryRepository.retries[0].availableAt.toISOString(),
    calculateKnowledgeRetryAt(now, 3).toISOString()
  );

  const deadRepository = new FakeKnowledgeRepository();
  deadRepository.failCommit = true;
  deadRepository.jobs = [
    {
      id: "dead-job",
      productId: "product-knowledge-v2",
      dedupeKey: "product-knowledge-v2:2",
      status: "PROCESSING",
      attempts: 8,
    },
  ];
  const deadResult = await runShopKnowledgeOutboxWorker(deadRepository, {
    workerId: "worker-2",
    now,
  });

  assert.equal(deadResult.deadLettered, 1);
  assert.deepEqual(deadRepository.deadLetters, ["dead-job"]);
  assert.equal(deadRepository.retries.length, 0);
});

test("a stale source CAS is completed without overwriting or retrying newer work", async () => {
  const repository = new FakeKnowledgeRepository();
  repository.jobs = [
    {
      id: "stale-job",
      productId: "product-knowledge-v2",
      dedupeKey: "product-knowledge-v2:SOURCE_CHANGED",
      status: "PROCESSING",
      attempts: 1,
    },
  ];
  repository.commitKnowledgeIndex = async () => {
    throw new StaleKnowledgeCommitError("product-knowledge-v2");
  };

  const result = await runShopKnowledgeOutboxWorker(repository, {
    workerId: "worker-cas",
    now: new Date("2026-07-17T12:00:00.000Z"),
  });

  assert.equal(result.completed, 1);
  assert.equal(result.unchanged, 1);
  assert.equal(result.retried, 0);
  assert.equal(result.deadLettered, 0);
  assert.deepEqual(repository.completed, ["stale-job"]);
});
