import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { OpsJobStage, OpsJobStatus, type OpsJob, type PrismaClient } from "@prisma/client";

import { registerHooks } from "./testHooks.mjs";
import {
  OPS_TELEGRAM_RECIPIENT_UNAVAILABLE,
  OpsNotificationError,
  sendOpsTelegramNotification,
} from "../../../src/lib/operations/notifications";
import { formatOpsWhen } from "../../../src/lib/operations/i18n";

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

const aiModule = import("../../../src/lib/operations/ai");
const recipientsModule = import("../../../src/lib/operations/telegramRecipients");
const watchdogModule = import("../../../src/lib/operations/jobsWatchdog");
const jobsModule = import("../../../src/lib/operations/telegramJobs");

async function withNotificationsEnabled<T>(run: () => Promise<T>) {
  const previous = {
    enabled: process.env.OPS_TELEGRAM_NOTIFICATIONS_ENABLED,
    token: process.env.OPS_TELEGRAM_BOT_TOKEN,
  };
  process.env.OPS_TELEGRAM_NOTIFICATIONS_ENABLED = "1";
  process.env.OPS_TELEGRAM_BOT_TOKEN = "test-token-not-a-production-secret";
  try {
    return await run();
  } finally {
    for (const [key, value] of [
      ["OPS_TELEGRAM_NOTIFICATIONS_ENABLED", previous.enabled],
      ["OPS_TELEGRAM_BOT_TOKEN", previous.token],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function telegramResponse(status: number, description: string) {
  return (async () =>
    new Response(JSON.stringify({ ok: false, error_code: status, description }), {
      status,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
}

test("a blocked bot or missing chat is reported as an unavailable recipient", async () => {
  await withNotificationsEnabled(async () => {
    for (const [status, description] of [
      [403, "Forbidden: bot was blocked by the user"],
      [400, "Bad Request: chat not found"],
    ] as const) {
      await assert.rejects(
        sendOpsTelegramNotification({
          chatId: BigInt(42),
          text: "test",
          fetchImpl: telegramResponse(status, description),
        }),
        (error: unknown) =>
          error instanceof OpsNotificationError && error.code === OPS_TELEGRAM_RECIPIENT_UNAVAILABLE
      );
    }
    await assert.rejects(
      sendOpsTelegramNotification({
        chatId: BigInt(42),
        text: "test",
        fetchImpl: telegramResponse(500, "Internal Server Error"),
      }),
      (error: unknown) =>
        error instanceof OpsNotificationError && error.code === "TELEGRAM_SEND_FAILED"
    );
  });
});

test("an unavailable recipient finishes the job at once instead of dead-lettering", async () => {
  const { createOpsJobStageExecutor } = await jobsModule;
  await withNotificationsEnabled(async () => {
    const client = {
      opsMemberProfile: {
        async findFirst() {
          return {
            id: "profile-1",
            adminUserId: "admin-1",
            timezone: "Europe/Kyiv",
            adminUser: {
              name: "Игорь",
              roles: [{ role: { key: "task_member", permissions: ["ops.tasks.read"] } }],
            },
          };
        },
      },
    } as unknown as PrismaClient;
    const execute = createOpsJobStageExecutor({
      client,
      dependencies: { fetchImpl: telegramResponse(403, "Forbidden: bot was blocked by the user") },
    });
    const now = new Date("2026-10-13T06:00:00.000Z");
    const job = {
      id: "job-1",
      idempotencyKey: "report:morning:admin-1:2026-10-13",
      inboxItemId: null,
      taskId: null,
      type: "telegram_internal_report",
      status: OpsJobStatus.RUNNING,
      stage: OpsJobStage.NOTIFY,
      payload: {
        recipientAdminUserId: "admin-1",
        telegramUserId: "42",
        reportPeriod: "morning",
        overdueCount: 1,
        counts: { IN_PROGRESS: 1 },
      },
      result: null,
      errorType: null,
      errorMessage: null,
      attempts: 0,
      maxAttempts: 4,
      availableAt: now,
      leaseOwner: "test-worker",
      leaseExpiresAt: new Date(now.getTime() + 120_000),
      heartbeatAt: now,
      cancelRequestedAt: null,
      startedAt: now,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    } as OpsJob;
    const outcome = await execute({
      job,
      workerId: "test-worker",
      signal: new AbortController().signal,
    });
    assert.equal(outcome.outcome, "succeeded");
    assert.deepEqual(outcome.result, { notification: "recipient_unavailable" });
  });
});

function recipientsClient(input: {
  failures: Array<{ recipientAdminUserId: string; finishedAt: Date }>;
  lastDeliveredAt?: Date;
  wroteSince?: number;
}) {
  return {
    opsJob: {
      async findMany() {
        return input.failures.map((failure) => ({
          payload: { recipientAdminUserId: failure.recipientAdminUserId },
          finishedAt: failure.finishedAt,
        }));
      },
      async findFirst() {
        return input.lastDeliveredAt ? { finishedAt: input.lastDeliveredAt } : null;
      },
    },
    opsTelegramUpdate: {
      async count() {
        return input.wroteSince ?? 0;
      },
    },
  } as unknown as PrismaClient;
}

test("a member who blocked the bot stays paused until they write again or are re-saved", async () => {
  const { findPausedOpsTelegramRecipients } = await recipientsModule;
  const blockedAt = new Date("2026-09-09T06:45:00.000Z");
  const member = {
    adminUserId: "admin-1",
    telegramUserId: BigInt(42),
    updatedAt: new Date("2026-07-22T10:00:00.000Z"),
  };
  const failures = [{ recipientAdminUserId: "admin-1", finishedAt: blockedAt }];

  const paused = await findPausedOpsTelegramRecipients(recipientsClient({ failures }), [member]);
  assert.deepEqual([...paused.values()], [{ adminUserId: "admin-1", pausedAt: blockedAt }]);

  assert.equal(
    (await findPausedOpsTelegramRecipients(recipientsClient({ failures, wroteSince: 1 }), [member]))
      .size,
    0,
    "writing to the bot again resumes notifications"
  );
  assert.equal(
    (
      await findPausedOpsTelegramRecipients(recipientsClient({ failures }), [
        { ...member, updatedAt: new Date("2026-10-13T08:00:00.000Z") },
      ])
    ).size,
    0,
    "re-saving the member's Telegram settings resumes notifications"
  );
  assert.equal(
    (
      await findPausedOpsTelegramRecipients(
        recipientsClient({ failures, lastDeliveredAt: new Date("2026-09-10T06:45:00.000Z") }),
        [member]
      )
    ).size,
    0,
    "a later successful delivery means the chat works again"
  );
  assert.equal(
    (await findPausedOpsTelegramRecipients(recipientsClient({ failures: [] }), [member])).size,
    0
  );

  const streak = await findPausedOpsTelegramRecipients(
    recipientsClient({
      failures: [
        { recipientAdminUserId: "admin-1", finishedAt: new Date("2026-10-12T06:45:00.000Z") },
        { recipientAdminUserId: "admin-1", finishedAt: new Date("2026-09-09T06:45:00.000Z") },
        { recipientAdminUserId: "admin-1", finishedAt: new Date("2026-08-01T06:45:00.000Z") },
      ],
      lastDeliveredAt: new Date("2026-09-08T06:00:00.000Z"),
    }),
    [member]
  );
  assert.equal(
    streak.get("admin-1")?.pausedAt.toISOString(),
    "2026-09-09T06:45:00.000Z",
    "the pause dates from the first failure after the last delivered message"
  );
});

test("paused members get no morning report, everyone else still does", async () => {
  const { enqueueOpsInternalNotifications } = await watchdogModule;
  const created: Array<Record<string, unknown>> = [];
  const profile = (adminUserId: string, telegramUserId: number) => ({
    adminUserId,
    telegramUserId: BigInt(telegramUserId),
    timezone: "Europe/Kyiv",
    updatedAt: new Date("2026-07-22T10:00:00.000Z"),
    adminUser: {
      roles: [{ role: { key: "task_member", permissions: ["ops.tasks.read"] } }],
    },
  });
  const client = {
    opsMemberProfile: {
      async findMany() {
        return [profile("admin-blocked", 42), profile("admin-ok", 43)];
      },
    },
    opsTask: {
      async findMany() {
        return [
          {
            id: "task-1",
            externalId: "TSK-1",
            title: "Проверить заказ",
            dueAt: new Date("2026-10-13T12:00:00.000Z"),
          },
        ];
      },
      async count() {
        return 0;
      },
    },
    opsJob: {
      async findMany() {
        return [
          {
            payload: { recipientAdminUserId: "admin-blocked" },
            finishedAt: new Date("2026-09-09T06:45:00.000Z"),
          },
        ];
      },
      async findFirst() {
        return null;
      },
      async createMany(args: { data: Array<Record<string, unknown>> }) {
        created.push(...args.data);
        return { count: args.data.length };
      },
    },
    opsTelegramUpdate: {
      async count() {
        return 0;
      },
    },
  } as unknown as PrismaClient;

  const result = await enqueueOpsInternalNotifications({
    client,
    // 09:00 in Kyiv, when morning reports are queued.
    now: new Date("2026-10-13T06:00:00.000Z"),
  });
  assert.equal(result.pausedRecipients, 1);
  assert.equal(result.reports, 1);
  assert.deepEqual(
    created.map((job) => (job.payload as Record<string, unknown>).recipientAdminUserId),
    ["admin-ok"]
  );
});

test("AI confidence accepts numbers, percentages and words instead of collapsing to 0", async () => {
  const { normalizedConfidence } = await aiModule;
  assert.equal(normalizedConfidence(0.82), "0.82");
  assert.equal(normalizedConfidence("0,7"), "0.70");
  assert.equal(normalizedConfidence("85%"), "0.85");
  assert.equal(normalizedConfidence(90), "0.90");
  assert.equal(normalizedConfidence("high"), "0.85");
  assert.equal(normalizedConfidence("Very high"), "0.95");
  assert.equal(normalizedConfidence("medium"), "0.60");
  assert.equal(normalizedConfidence("very low"), "0.15");
  assert.equal(normalizedConfidence("низкая"), "0.30");
  assert.equal(normalizedConfidence(""), "0.00");
  assert.equal(normalizedConfidence(null), "0.00");
  assert.equal(normalizedConfidence(250), "1.00");
});

test("inbox dates always say which day a message came in", () => {
  const now = new Date(2026, 9, 13, 12, 0);
  assert.match(formatOpsWhen(new Date(2026, 9, 13, 9, 5), now), /^сегодня, 09:05$/);
  assert.match(formatOpsWhen(new Date(2026, 9, 12, 16, 18), now), /^вчера, 16:18$/);
  assert.match(formatOpsWhen(new Date(2026, 6, 29, 16, 18), now), /^29 июл\.?, 16:18$/);
  assert.match(formatOpsWhen(new Date(2025, 11, 1, 8, 0), now), /2025/);
  assert.equal(formatOpsWhen("not a date", now), "—");
});
