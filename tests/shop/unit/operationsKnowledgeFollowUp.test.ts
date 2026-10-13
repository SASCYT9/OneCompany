import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import type { OpsJob, PrismaClient } from "@prisma/client";

import { registerHooks } from "./testHooks.mjs";

const serverOnlyStub = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")
).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: serverOnlyStub, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const followUpModule = import("../../../src/lib/operations/knowledgeFollowUp");
const jobsModule = import("../../../src/lib/operations/jobs");

const OVERLOADED = '{"error":{"code":503,"message":"high demand","status":"UNAVAILABLE"}}';

function fakeClient(created: unknown[] = []) {
  const client = {
    opsJob: {
      async createMany(input: { data: unknown[] }) {
        created.push(...input.data);
        return { count: input.data.length };
      },
    },
    opsInboxItem: {
      async findUnique() {
        return {
          telegramUpdate: { chatId: BigInt(555), telegramUserId: BigInt(777), messageId: 42 },
        };
      },
    },
    opsMemberProfile: {
      async findFirst() {
        return { id: "member_1" };
      },
    },
    opsKnowledgeArticle: {
      async findMany() {
        return [
          {
            id: "kb_medyka0001",
            title: "Доставка из Великобритании через Medyka",
            contentMarkdown: "Срок 7–10 дней.",
          },
        ];
      },
    },
    opsUsageBucket: {
      async upsert() {
        return { id: "bucket", costMicros: BigInt(0), hardStopMicros: BigInt(2_000_000) };
      },
      async update() {
        return {};
      },
    },
    async $transaction(run: (tx: unknown) => Promise<unknown>) {
      return run(client);
    },
  };
  return client as unknown as PrismaClient;
}

function provider(
  answer: () => Promise<{ value: unknown; usage: { inputTokens: number; outputTokens: number } }>
) {
  return {
    async extract(): Promise<never> {
      throw new Error("unused");
    },
    async transcribe(): Promise<never> {
      throw new Error("unused");
    },
    answer,
  };
}

const followUpJob = (attempts: number) =>
  ({
    id: "job_followup",
    type: "telegram_knowledge_followup",
    inboxItemId: "inbox_1",
    attempts,
    maxAttempts: 4,
    payload: { question: "сколько идет доставка из Великобритании" },
  }) as unknown as OpsJob;

test("an overloaded «?» answer schedules one follow-up ~40 s later", async () => {
  const { enqueueOpsKnowledgeFollowUp, OPS_KNOWLEDGE_FOLLOW_UP_JOB } = await followUpModule;
  const created: Array<Record<string, unknown>> = [];
  const now = new Date("2026-10-13T14:12:00Z");
  const queued = await enqueueOpsKnowledgeFollowUp({
    client: fakeClient(created),
    sourceJobId: "job_intake",
    inboxItemId: "inbox_1",
    question: "доставка из Великобритании",
    now,
  });
  assert.equal(queued, true);
  assert.equal(created.length, 1);
  assert.equal(created[0].type, OPS_KNOWLEDGE_FOLLOW_UP_JOB);
  assert.equal(created[0].idempotencyKey, "knowledge:followup:job_intake");
  assert.equal((created[0].availableAt as Date).getTime() - now.getTime(), 40_000);
  assert.equal(
    await enqueueOpsKnowledgeFollowUp({
      client: fakeClient(),
      sourceJobId: "job_intake",
      inboxItemId: null,
      question: "x",
    }),
    false,
    "nowhere to reply without the inbox item"
  );
});

test("the follow-up sends the AI answer as a reply, retries an overload, then gives up quietly", async () => {
  const { executeOpsKnowledgeFollowUpJob } = await followUpModule;
  const previousEnabled = process.env.OPS_TELEGRAM_NOTIFICATIONS_ENABLED;
  const previousToken = process.env.OPS_TELEGRAM_BOT_TOKEN;
  process.env.OPS_TELEGRAM_NOTIFICATIONS_ENABLED = "1";
  process.env.OPS_TELEGRAM_BOT_TOKEN = "test-token";
  const sent: Array<Record<string, unknown>> = [];
  const fetchImpl = (async (_url: string, init: { body: string }) => {
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ ok: true, result: { message_id: 99 } }), { status: 200 });
  }) as unknown as typeof fetch;
  try {
    const answered = await executeOpsKnowledgeFollowUpJob({
      client: fakeClient(),
      job: followUpJob(0),
      fetchImpl,
      overloadPauseMs: 1,
      provider: provider(async () => ({
        value: { found: true, answer: "7–10 дней через Medyka.", source_ids: ["kb_medyka0001"] },
        usage: { inputTokens: 100, outputTokens: 20 },
      })),
    });
    assert.equal(answered.outcome, "succeeded");
    assert.equal((answered.result as { followUp: string }).followUp, "sent");
    assert.equal(sent.length, 1);
    assert.match(String(sent[0].text), /^💡 7–10 дней через Medyka\./);
    assert.deepEqual(sent[0].reply_parameters, {
      message_id: 42,
      allow_sending_without_reply: true,
    });

    const overloaded = provider(async () => {
      throw new Error(OVERLOADED);
    });
    await assert.rejects(
      executeOpsKnowledgeFollowUpJob({
        client: fakeClient(),
        job: followUpJob(0),
        fetchImpl,
        overloadPauseMs: 1,
        provider: overloaded,
      }),
      /OPS_KNOWLEDGE_AI_OVERLOADED/,
      "still overloaded: the queue retries with backoff"
    );
    const gaveUp = await executeOpsKnowledgeFollowUpJob({
      client: fakeClient(),
      job: followUpJob(3),
      fetchImpl,
      overloadPauseMs: 1,
      provider: overloaded,
    });
    assert.equal((gaveUp.result as { followUp: string }).followUp, "gave_up");
    assert.equal(sent.length, 1, "nothing extra is sent when giving up");
  } finally {
    if (previousEnabled === undefined) delete process.env.OPS_TELEGRAM_NOTIFICATIONS_ENABLED;
    else process.env.OPS_TELEGRAM_NOTIFICATIONS_ENABLED = previousEnabled;
    if (previousToken === undefined) delete process.env.OPS_TELEGRAM_BOT_TOKEN;
    else process.env.OPS_TELEGRAM_BOT_TOKEN = previousToken;
  }
});

test("after the webhook, a follow-up due soon is waited for and run", async () => {
  const { drainSoonDueOpsJobs } = await jobsModule;
  const dueAt = new Date(Date.now() + 40_000);
  const lookups: unknown[] = [null, null];
  let firstLookup = true;
  const sleeps: number[] = [];
  const client = {
    opsJob: {
      async findFirst(input: { where: { type?: { in: string[] } } }) {
        if (firstLookup) {
          firstLookup = false;
          assert.deepEqual(input.where.type, { in: ["telegram_knowledge_followup"] });
          return { availableAt: dueAt };
        }
        return lookups.shift() ?? null;
      },
    },
  } as unknown as PrismaClient;
  const result = await drainSoonDueOpsJobs({
    client,
    execute: async () => ({ outcome: "succeeded" }),
    types: ["telegram_knowledge_followup"],
    deadlineAt: Date.now() + 150_000,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  assert.equal(result.runs, 1);
  assert.equal(sleeps.length, 1);
  assert.ok(sleeps[0] > 35_000 && sleeps[0] <= 40_000, `waited ${sleeps[0]} ms`);
});
