import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import {
  createOpsTelegramWebhookReply,
  intakeOpsTelegramUpdate,
  isOpsTelegramGroupAllowed,
  normalizeOpsTelegramUpdate,
  type OpsTelegramIntakeRepository,
  verifyOpsTelegramWebhookSecret,
} from "../../../src/lib/operations/telegram";
import {
  createOpsTelegramCallbackState,
  executeOpsTelegramCallback,
} from "../../../src/lib/operations/telegramCallbacks";
import {
  collectOpsTelegramBatchForward,
  createOpsTelegramBatchCallbackData,
  isOpsTelegramBatchForward,
  parseOpsTelegramBatchCallbackData,
  syncOpsTelegramBatchStatus,
} from "../../../src/lib/operations/telegramBatch";

const privateUpdate = {
  update_id: 1001,
  message: {
    message_id: 41,
    from: { id: 7001, username: "manager" },
    chat: { id: 7001, type: "private" },
    text: "Підготуй пропозицію для замовлення",
  },
};

function repository(
  overrides: Partial<OpsTelegramIntakeRepository> = {}
): OpsTelegramIntakeRepository {
  return {
    async resolveMember() {
      return {
        adminUserId: "admin-1",
        email: "owner@example.com",
        name: "Owner",
      };
    },
    async consumeRateLimit() {
      return true;
    },
    async persist() {
      return {
        accepted: true,
        duplicate: false,
        inboxItemId: "inbox-1",
        jobId: "job-1",
      };
    },
    ...overrides,
  };
}

test("Telegram webhook secret comparison fails closed", () => {
  assert.equal(verifyOpsTelegramWebhookSecret("secret", "secret"), true);
  assert.equal(verifyOpsTelegramWebhookSecret("wrong", "secret"), false);
  assert.equal(verifyOpsTelegramWebhookSecret(null, "secret"), false);
  assert.equal(verifyOpsTelegramWebhookSecret("secret", ""), false);
});

test("private update is normalized and accepted through the linked admin allowlist", async () => {
  const normalized = normalizeOpsTelegramUpdate(privateUpdate, {
    botUsername: "ops_manager_bot",
  });
  assert.ok(normalized);
  assert.equal(normalized.telegramUpdateId, BigInt(1001));
  assert.equal(normalized.telegramUserId, BigInt(7001));
  assert.equal(isOpsTelegramGroupAllowed(normalized), true);

  const result = await intakeOpsTelegramUpdate({
    rawUpdate: privateUpdate,
    repository: repository(),
  });
  assert.equal(result.outcome, "accepted");
  if (result.outcome === "accepted") {
    assert.deepEqual(createOpsTelegramWebhookReply(result), {
      method: "sendMessage",
      chat_id: "7001",
      text: "✅ Принял. Разбираю сообщение и подготовлю задачи.",
      reply_parameters: {
        message_id: 41,
        allow_sending_without_reply: true,
      },
    });
  }
});

test("group messages require mention or reply to the Lab bot", async () => {
  const ignored = await intakeOpsTelegramUpdate({
    rawUpdate: {
      update_id: 1002,
      message: {
        message_id: 42,
        from: { id: 7001 },
        chat: { id: -100500, type: "supergroup" },
        text: "звичайне повідомлення групи",
      },
    },
    botUsername: "ops_manager_bot",
    repository: repository({
      async persist() {
        assert.fail("irrelevant group messages must not be persisted");
      },
    }),
  });
  assert.equal(ignored.outcome, "ignored");
  if (ignored.outcome === "ignored") {
    assert.equal(ignored.reason, "group_requires_mention_or_reply");
  }

  const mentioned = await intakeOpsTelegramUpdate({
    rawUpdate: {
      update_id: 1003,
      message: {
        message_id: 43,
        from: { id: 7001 },
        chat: { id: -100500, type: "supergroup" },
        text: "@ops_manager_bot створи задачу",
      },
    },
    botUsername: "ops_manager_bot",
    repository: repository(),
  });
  assert.equal(mentioned.outcome, "accepted");
});

test("group command preserves the replied human as an assignee candidate", () => {
  const normalized = normalizeOpsTelegramUpdate(
    {
      update_id: 1010,
      message: {
        message_id: 50,
        from: { id: 7001 },
        chat: { id: -100500, type: "supergroup" },
        text: "@ops_manager_bot проверь наличие",
        reply_to_message: {
          message_id: 49,
          from: { id: 7002, is_bot: false },
        },
      },
    },
    { botUsername: "ops_manager_bot" }
  );
  assert.ok(normalized);
  assert.equal(normalized.telegramUserId, BigInt(7001));
  assert.equal(normalized.replyToTelegramUserId, BigInt(7002));
});

test("group command uses media from the replied voice message", () => {
  const normalized = normalizeOpsTelegramUpdate(
    {
      update_id: 1011,
      message: {
        message_id: 52,
        from: { id: 7001 },
        chat: { id: -100500, type: "supergroup" },
        text: "@ops_manager_bot сформируй задачу",
        reply_to_message: {
          message_id: 51,
          from: { id: 7002, is_bot: false },
          voice: {
            file_id: "voice-file-1",
            file_unique_id: "voice-unique-1",
            duration: 18,
            mime_type: "audio/ogg",
            file_size: 320_000,
          },
        },
      },
    },
    { botUsername: "ops_manager_bot" }
  );
  assert.ok(normalized);
  assert.equal(normalized.mediaSource, "reply");
  assert.equal(normalized.media?.kind, "voice");
  assert.equal(normalized.media?.fileId, "voice-file-1");
  assert.equal(normalized.replyToTelegramUserId, BigInt(7002));
});

test("private forwarded messages enter a collection before task processing", () => {
  const normalized = normalizeOpsTelegramUpdate({
    update_id: 1012,
    message: {
      message_id: 53,
      from: { id: 7001 },
      chat: { id: 7001, type: "private" },
      forward_origin: {
        type: "user",
        sender_user: {
          id: 7002,
          first_name: "Игорь",
          username: "igor_onecompany",
        },
      },
      voice: {
        file_id: "batch-voice-1",
        file_unique_id: "batch-voice-unique-1",
        duration: 12,
        mime_type: "audio/ogg",
        file_size: 210_000,
      },
    },
  });
  assert.ok(normalized);
  assert.equal(isOpsTelegramBatchForward(normalized), true);
  assert.deepEqual(normalized.forwardedFrom, {
    telegramUserId: "7002",
    displayName: "Игорь",
  });
});

test("batch callback data is signed and tampering fails closed", () => {
  const previous = process.env.OPS_TELEGRAM_CALLBACK_SECRET;
  process.env.OPS_TELEGRAM_CALLBACK_SECRET = "batch-test-secret";
  try {
    const callbackData = createOpsTelegramBatchCallbackData("one", "batch_12345678");
    assert.ok(callbackData);
    assert.deepEqual(parseOpsTelegramBatchCallbackData(callbackData), {
      action: "one",
      batchId: "batch_12345678",
    });
    assert.equal(parseOpsTelegramBatchCallbackData(callbackData.replace(":one:", ":clear:")), null);
  } finally {
    if (previous === undefined) delete process.env.OPS_TELEGRAM_CALLBACK_SECRET;
    else process.env.OPS_TELEGRAM_CALLBACK_SECRET = previous;
  }
});

test("batch collection retries a serializable write conflict", async () => {
  let attempts = 0;
  const expected = {
    id: "batch-retried",
    itemCount: 2,
    statusMessageId: null,
    chatId: BigInt(7001),
    status: "OPEN",
    duplicate: false,
  };
  const client = {
    async $transaction() {
      attempts += 1;
      if (attempts === 1) {
        throw Object.assign(new Error("write conflict"), { code: "P2034" });
      }
      return expected;
    },
  } as unknown as PrismaClient;

  const result = await collectOpsTelegramBatchForward({
    client,
    update: {} as never,
    member: {
      adminUserId: "admin-1",
      email: "owner@example.com",
      name: "Owner",
    },
    now: new Date("2026-07-21T12:00:00.000Z"),
  });

  assert.equal(attempts, 2);
  assert.deepEqual(result, expected);
});

test("parallel batch updates create one Telegram counter message", async () => {
  const previousEnabled = process.env.OPS_TELEGRAM_NOTIFICATIONS_ENABLED;
  const previousToken = process.env.OPS_TELEGRAM_BOT_TOKEN;
  process.env.OPS_TELEGRAM_NOTIFICATIONS_ENABLED = "1";
  process.env.OPS_TELEGRAM_BOT_TOKEN = "test-token";
  let statusMessageId: number | null = null;
  let sendCount = 0;
  const client = {
    opsTelegramBatch: {
      async findUnique() {
        return {
          id: "batch-race",
          chatId: BigInt(7001),
          itemCount: 31,
          status: "OPEN",
          statusMessageId,
        };
      },
      async updateMany(input: {
        where: { statusMessageId?: number | null };
        data: { statusMessageId: number | null };
      }) {
        if (input.data.statusMessageId === -1) {
          if (statusMessageId !== null) return { count: 0 };
          statusMessageId = -1;
          return { count: 1 };
        }
        const expected = input.where.statusMessageId;
        if (expected === null && statusMessageId !== null) return { count: 0 };
        if (typeof expected === "number" && statusMessageId !== expected) {
          return { count: 0 };
        }
        statusMessageId = input.data.statusMessageId;
        return { count: 1 };
      },
    },
  } as unknown as PrismaClient;
  const fetchImpl = (async (url: string | URL | Request) => {
    const method = String(url).includes("/sendMessage") ? "send" : "edit";
    if (method === "send") sendCount += 1;
    return new Response(
      JSON.stringify({
        ok: true,
        result: {
          message_id: 9001,
          chat: { id: 7001 },
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }) as typeof fetch;
  try {
    await Promise.all([
      syncOpsTelegramBatchStatus({ client, batchId: "batch-race", fetchImpl }),
      syncOpsTelegramBatchStatus({ client, batchId: "batch-race", fetchImpl }),
    ]);
    assert.equal(sendCount, 1);
    assert.equal(statusMessageId, 9001);
  } finally {
    if (previousEnabled === undefined) {
      delete process.env.OPS_TELEGRAM_NOTIFICATIONS_ENABLED;
    } else {
      process.env.OPS_TELEGRAM_NOTIFICATIONS_ENABLED = previousEnabled;
    }
    if (previousToken === undefined) delete process.env.OPS_TELEGRAM_BOT_TOKEN;
    else process.env.OPS_TELEGRAM_BOT_TOKEN = previousToken;
  }
});

test("unlinked/deactivated Telegram user is ignored without persistence", async () => {
  const result = await intakeOpsTelegramUpdate({
    rawUpdate: privateUpdate,
    repository: repository({
      async resolveMember() {
        return null;
      },
      async persist() {
        assert.fail("unlinked user must not reach persistence");
      },
    }),
  });
  assert.equal(result.outcome, "ignored");
  if (result.outcome === "ignored") assert.equal(result.reason, "unlinked_user");
});

test("duplicate update returns prior result and does not create another job", async () => {
  let persistCalls = 0;
  const result = await intakeOpsTelegramUpdate({
    rawUpdate: privateUpdate,
    repository: repository({
      async persist() {
        persistCalls += 1;
        return {
          accepted: false,
          duplicate: true,
          inboxItemId: "existing-inbox",
          jobId: "existing-job",
        };
      },
    }),
  });
  assert.equal(persistCalls, 1);
  assert.equal(result.outcome, "duplicate");
  if (result.outcome === "duplicate") {
    assert.equal(result.inboxItemId, "existing-inbox");
    assert.equal(result.jobId, "existing-job");
  }
});

test("database failure propagates so the route can return 503 and Telegram can retry", async () => {
  await assert.rejects(
    () =>
      intakeOpsTelegramUpdate({
        rawUpdate: privateUpdate,
        repository: repository({
          async persist() {
            throw new Error("postgres unavailable");
          },
        }),
      }),
    /postgres unavailable/
  );
});

test("callback query gets immediate answerCallbackQuery response", async () => {
  const result = await intakeOpsTelegramUpdate({
    rawUpdate: {
      update_id: 1004,
      callback_query: {
        id: "callback-query-1",
        from: { id: 7001 },
        data: "signed-callback-placeholder",
        message: {
          message_id: 44,
          from: { id: 8622, is_bot: true, username: "ops_manager_bot" },
          chat: { id: 7001, type: "private" },
        },
      },
    },
    botUsername: "ops_manager_bot",
    repository: repository(),
  });
  assert.equal(result.outcome, "accepted");
  if (result.outcome === "accepted") {
    assert.deepEqual(createOpsTelegramWebhookReply(result), {
      method: "answerCallbackQuery",
      callback_query_id: "callback-query-1",
      text: "Действие принято",
    });
  }
});

test("opaque callback state is author-bound, expiring, and single-use", async () => {
  const previousSecret = process.env.OPS_TELEGRAM_CALLBACK_SECRET;
  process.env.OPS_TELEGRAM_CALLBACK_SECRET = "opaque-state-secret";
  let record:
    | {
        id: string;
        scope: string;
        key: string;
        requestHash: string;
        responseBody: unknown;
        statusCode: number;
        expiresAt: Date;
      }
    | undefined;
  const client = {
    adminUser: {
      async findFirst({ where }: { where: { id: string } }) {
        return {
          id: where.id,
          email: "member@example.com",
          name: "Member",
          roles: [
            {
              role: {
                key: "task_member",
                permissions: ["ops.tasks.read", "ops.tasks.write"],
              },
            },
          ],
        };
      },
    },
    opsIdempotencyRecord: {
      async create({ data }: { data: typeof record }) {
        record = { ...data, id: "callback-state-1" } as NonNullable<typeof record>;
        return record;
      },
      async findUnique() {
        return record;
      },
      async updateMany({
        where,
        data,
      }: {
        where: { statusCode: number };
        data: { statusCode: number };
      }) {
        if (!record || record.statusCode !== where.statusCode) return { count: 0 };
        record.statusCode = data.statusCode;
        return { count: 1 };
      },
      async update({ data }: { data: { statusCode: number; responseBody: unknown } }) {
        if (!record) throw new Error("missing state");
        record.statusCode = data.statusCode;
        record.responseBody = data.responseBody;
        return record;
      },
    },
    opsTask: {
      async findUnique() {
        return {
          id: "task_12345678",
          externalId: "TSK-20260719-ABCD1234",
          assigneeId: "admin_12345678",
          createdById: "admin_12345678",
        };
      },
    },
  } as unknown as PrismaClient;
  try {
    const callbackData = await createOpsTelegramCallbackState({
      client,
      action: "open",
      resourceId: "task_12345678",
      actorAdminUserId: "admin_12345678",
      ttlMs: 60_000,
    });
    assert.ok(callbackData);
    assert.ok(Buffer.byteLength(callbackData, "utf8") <= 64);
    assert.doesNotMatch(callbackData, /task_12345678|admin_12345678/);
    const tamperedCallback = `${callbackData.slice(0, -1)}${
      callbackData.endsWith("a") ? "b" : "a"
    }`;
    await assert.rejects(
      () =>
        executeOpsTelegramCallback({
          client,
          actorAdminUserId: "admin_12345678",
          callbackData: tamperedCallback,
        }),
      /CALLBACK_INVALID/
    );

    await assert.rejects(
      () =>
        executeOpsTelegramCallback({
          client,
          actorAdminUserId: "other_12345678",
          callbackData,
        }),
      /AUTHOR_MISMATCH/
    );
    const first = await executeOpsTelegramCallback({
      client,
      actorAdminUserId: "admin_12345678",
      callbackData,
    });
    assert.match(first.message, /TSK-20260719-ABCD1234/);
    await assert.rejects(
      () =>
        executeOpsTelegramCallback({
          client,
          actorAdminUserId: "admin_12345678",
          callbackData,
        }),
      /ALREADY_USED/
    );
  } finally {
    if (previousSecret === undefined) delete process.env.OPS_TELEGRAM_CALLBACK_SECRET;
    else process.env.OPS_TELEGRAM_CALLBACK_SECRET = previousSecret;
  }
});
