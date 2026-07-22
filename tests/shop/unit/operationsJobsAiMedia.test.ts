import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import {
  OpsAutomationStatus,
  OpsBlockerType,
  OpsInboxReviewStatus,
  OpsJobStage,
  OpsJobStatus,
  OpsProposalStatus,
  OpsTaskEventType,
  OpsTaskStatus,
  type OpsJob,
  type PrismaClient,
} from "@prisma/client";
import {
  nextOpsJobFailureState,
  opsJobBackoffMs,
  redactOpsJobErrorMessage,
} from "../../../src/lib/operations/jobs";
import { buildOpsInboxNotification } from "../../../src/lib/operations/notifications";
import {
  OPS_ATTACHMENT_MAX_BYTES,
  OPS_MEDIA_MONTHLY_UPLOAD_CAP_BYTES,
  assertOpsMediaMagicBytes,
  assertOpsMediaStorageBudget,
  createLocalPrivateOpsMediaStore,
  validateOpsTelegramMedia,
} from "../../../src/lib/operations/media";
import type { OpsAiBudget, OpsAiProvider } from "../../../src/lib/operations/ai";
import {
  createOpsMediaResponse,
  parseOpsMediaRange,
} from "../../../src/lib/operations/mediaResponse";

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
const notificationJobModules = Promise.all([
  import("../../../src/lib/operations/jobsWatchdog"),
  import("../../../src/lib/operations/telegramJobs"),
]);

test("local Ops media store keeps Lab attachments private and blocks path traversal", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "onecompany-ops-media-"));
  try {
    const store = createLocalPrivateOpsMediaStore(root);
    const body = new TextEncoder().encode("private voice fixture");
    const stored = await store.put({
      storageKey: "operations/telegram/inbox-1/voice.ogg",
      body,
      contentType: "audio/ogg",
    });
    assert.equal(stored.storageKey, "operations/telegram/inbox-1/voice.ogg");
    assert.deepEqual(await store.get(stored.storageKey), body);
    await assert.rejects(
      () =>
        store.put({
          storageKey: "../outside.ogg",
          body,
          contentType: "audio/ogg",
        }),
      /Invalid local attachment key/
    );
    await store.remove(stored.storageKey);
    await assert.rejects(() => store.get(stored.storageKey));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("protected Ops audio supports browser byte ranges", async () => {
  const body = new TextEncoder().encode("0123456789");
  assert.deepEqual(parseOpsMediaRange("bytes=2-5", body.byteLength), { start: 2, end: 5 });
  assert.deepEqual(parseOpsMediaRange("bytes=-3", body.byteLength), { start: 7, end: 9 });
  assert.equal(parseOpsMediaRange("bytes=99-100", body.byteLength), undefined);

  const partial = createOpsMediaResponse({
    body,
    fileName: "voice.ogg",
    mimeType: "audio/ogg",
    rangeHeader: "bytes=2-5",
  });
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get("accept-ranges"), "bytes");
  assert.equal(partial.headers.get("content-range"), "bytes 2-5/10");
  assert.equal(await partial.text(), "2345");

  const unsatisfied = createOpsMediaResponse({
    body,
    fileName: "voice.ogg",
    mimeType: "audio/ogg",
    rangeHeader: "bytes=99-100",
  });
  assert.equal(unsatisfied.status, 416);
  assert.equal(unsatisfied.headers.get("content-range"), "bytes */10");
});

test("Inbox notifications stay concise and leave navigation to the action button", () => {
  const text = buildOpsInboxNotification({
    taskCount: 1,
    summary: "Проверить предложение",
    inboxItemId: "inbox/item 1",
    adminBaseUrl: "https://admin.example/",
    previewOnly: true,
    sourceKind: "message",
  });
  assert.match(text, /Сообщение обработано/);
  assert.doesNotMatch(text, /Голосовое обработано/);
  assert.doesNotMatch(text, /https:\/\//);
});

test("Inbox preview notifications describe voice and forwarded batches accurately", () => {
  const voice = buildOpsInboxNotification({
    taskCount: 1,
    summary: null,
    inboxItemId: "voice-inbox",
    previewOnly: true,
    sourceKind: "voice",
  });
  const batch = buildOpsInboxNotification({
    taskCount: 1,
    summary: null,
    inboxItemId: "batch-inbox",
    previewOnly: true,
    sourceKind: "batch",
  });

  assert.match(voice, /Голосовое обработано/);
  assert.match(batch, /Подборка сообщений обработана/);
  assert.doesNotMatch(batch, /Голосовое обработано/);
});

test("auto-created task notifications identify tasks without raw URLs", () => {
  const text = buildOpsInboxNotification({
    taskCount: 2,
    summary: "Проверить совместимость и доставку",
    inboxItemId: "inbox-1",
    adminBaseUrl: "https://admin.example/",
    previewOnly: false,
    autoAppliedTasks: [
      { id: "task/one", externalId: "TSK-1", title: "Проверить совместимость" },
      { id: "task-two", externalId: "TSK-2", title: "Рассчитать доставку" },
    ],
  });
  assert.match(text, /Зафиксировал 2 задачи/);
  assert.match(text, /TSK-1 — Проверить совместимость/);
  assert.doesNotMatch(text, /https:\/\//);
  assert.doesNotMatch(text, /admin\/operations\/inbox/);
});

test("Telegram hybrid auto-create defaults to preview and rejects unsafe or ambiguous input", async () => {
  const [{ decideOpsTelegramAutoCreate }, { normalizeOpsExtraction }] = await Promise.all([
    notificationJobModules.then(([, telegramJobs]) => telegramJobs),
    aiModule,
  ]);
  const safe = {
    enabled: true,
    hasExplicitText: true,
    hasMedia: false,
    previewOnly: false,
    isUntrustedForward: false,
    intent: "task" as const,
    taskCount: 1,
    confidence: "0.95",
    requiresApproval: false,
    ambiguityCount: 0,
    unresolvedAssignee: false,
    unresolvedContext: false,
  };
  assert.equal(decideOpsTelegramAutoCreate({ ...safe, enabled: false }).reason, "disabled");
  assert.equal(decideOpsTelegramAutoCreate(safe).eligible, true);
  assert.equal(
    decideOpsTelegramAutoCreate({ ...safe, hasMedia: true, previewOnly: true }).reason,
    "media_preview_only"
  );
  assert.equal(
    decideOpsTelegramAutoCreate({ ...safe, isUntrustedForward: true }).reason,
    "untrusted_forward"
  );
  assert.equal(decideOpsTelegramAutoCreate({ ...safe, ambiguityCount: 1 }).reason, "ambiguous");
  assert.equal(
    decideOpsTelegramAutoCreate({ ...safe, unresolvedAssignee: true }).reason,
    "unresolved_assignee"
  );
  assert.equal(
    decideOpsTelegramAutoCreate({ ...safe, unresolvedContext: true }).reason,
    "unresolved_context"
  );
  assert.equal(
    decideOpsTelegramAutoCreate({ ...safe, confidence: "0.89" }).reason,
    "low_confidence"
  );
  assert.equal(decideOpsTelegramAutoCreate({ ...safe, taskCount: 0 }).reason, "invalid_task_count");

  const unsafe = normalizeOpsExtraction({
    intent: "task",
    summary: "Unsafe",
    project_candidates: [],
    order_candidates: [],
    confidence: "0.99",
    ambiguities: [],
    requires_approval: false,
    tasks: [{ title: "Оплатити замовлення", priority: "urgent", executor_type: "automation" }],
  });
  assert.equal(unsafe.requires_approval, true);
  assert.equal(
    decideOpsTelegramAutoCreate({ ...safe, requiresApproval: unsafe.requires_approval }).reason,
    "requires_approval"
  );

  const tooMany = normalizeOpsExtraction({
    intent: "task",
    summary: "Too many",
    project_candidates: [],
    order_candidates: [],
    confidence: "0.99",
    ambiguities: [],
    requires_approval: false,
    tasks: Array.from({ length: 6 }, (_, index) => ({
      title: `Task ${index + 1}`,
      priority: "normal",
      executor_type: "human",
    })),
  });
  assert.equal(tooMany.tasks.length, 5);
  assert.equal(tooMany.requires_approval, true);
  assert.ok(tooMany.ambiguities.length > 0);
});

test("Telegram auto-apply retry reuses the applied Inbox and never duplicates tasks", async () => {
  const [, telegramJobs] = await notificationJobModules;
  const proposal: {
    id: string;
    ordinal: number;
    status: OpsProposalStatus;
    payload: Record<string, unknown>;
  } = {
    id: "proposal-1",
    ordinal: 0,
    status: OpsProposalStatus.PENDING,
    payload: {
      title: "Проверить совместимость",
      description: null,
      status: "INBOX",
      priority: "NORMAL",
      executorType: "HUMAN",
      dueAt: null,
      nextAction: null,
      definitionOfDone: null,
      assigneeId: null,
      projectId: null,
      shopOrderId: null,
      parentTaskId: null,
      sourceType: "TELEGRAM",
      sourceId: "inbox-1",
      sourceKey: "telegram:1001:task:0",
    },
  };
  const state = {
    reviewStatus: OpsInboxReviewStatus.PENDING as OpsInboxReviewStatus,
    appliedTaskIds: [] as string[],
    tasks: [] as Array<{
      id: string;
      externalId: string;
      title: string;
      sourceKey: string;
    }>,
    events: 0,
    audits: 0,
  };
  const tx = {
    opsInboxItem: {
      async findUnique() {
        return {
          id: "inbox-1",
          reviewStatus: state.reviewStatus,
          appliedTaskIds: [...state.appliedTaskIds],
          requiresApproval: false,
          ambiguities: [],
          attachments: [],
          proposals: state.reviewStatus === OpsInboxReviewStatus.PENDING ? [proposal] : [],
        };
      },
      async update({ data }: { data: Record<string, unknown> }) {
        if (data.reviewStatus) {
          state.reviewStatus = data.reviewStatus as OpsInboxReviewStatus;
        }
        if (Array.isArray(data.appliedTaskIds)) {
          state.appliedTaskIds = data.appliedTaskIds.map(String);
        }
        return { id: "inbox-1" };
      },
    },
    adminUser: {
      async findFirst() {
        return {
          id: "admin-1",
          email: "owner@example.com",
          name: "Owner",
          roles: [{ role: { permissions: ["ops.tasks.write"] } }],
        };
      },
    },
    opsTask: {
      async findUnique({ where }: { where: { sourceKey?: string } }) {
        return state.tasks.find((task) => task.sourceKey === where.sourceKey) ?? null;
      },
      async create({ data }: { data: Record<string, unknown> }) {
        const task = {
          id: `task-${state.tasks.length + 1}`,
          externalId: String(data.externalId),
          title: String(data.title),
          sourceKey: String(data.sourceKey),
        };
        state.tasks.push(task);
        return task;
      },
      async findMany() {
        return state.tasks.map(({ id, externalId, title }) => ({ id, externalId, title }));
      },
    },
    opsTaskEvent: {
      async create() {
        state.events += 1;
        return { id: "event-1" };
      },
    },
    opsInboxProposal: {
      async update() {
        proposal.status = OpsProposalStatus.APPLIED;
        return proposal;
      },
    },
    opsTaskAttachment: {
      async createMany() {
        return { count: 0 };
      },
    },
    opsAttachment: {
      async updateMany() {
        return { count: 0 };
      },
    },
    adminAuditLog: {
      async create() {
        state.audits += 1;
        return { id: "audit-1" };
      },
    },
  };
  const client = {
    async $transaction(callback: (transaction: typeof tx) => Promise<unknown>) {
      return callback(tx);
    },
  } as unknown as PrismaClient;
  const extraction = {
    intent: "task" as const,
    summary: "One safe task",
    project_candidates: [],
    order_candidates: [],
    confidence: "0.95",
    ambiguities: [],
    requires_approval: false,
    tasks: [
      {
        title: "Проверить совместимость",
        description: null,
        priority: "normal" as const,
        due_at: null,
        assignee_ref: null,
        next_action: null,
        definition_of_done: null,
        executor_type: "human" as const,
        project_ref: null,
        order_ref: null,
      },
    ],
  };
  const payload = {
    schemaVersion: 1,
    actorAdminUserId: "admin-1",
    telegramUpdateId: "1001",
    chatId: "7001",
    telegramUserId: "7001",
    messageId: 41,
    messageThreadId: null,
    replyToMessageId: null,
    text: "Проверь совместимость",
    callbackData: null,
    media: null,
    isUntrustedForward: false,
    previewOnly: false,
    extraction,
    context: {
      source: "none" as const,
      projectId: null,
      taskId: null,
      shopOrderId: null,
    },
  };
  const job = opsJobFromCreateInput(
    {
      type: "telegram_intake",
      stage: OpsJobStage.CREATE_PREVIEW_OR_ENTITIES,
      payload,
    },
    { inboxItemId: "inbox-1" }
  );

  const first = await telegramJobs.autoApplyTelegramTaskProposals({
    client,
    job,
    payload,
    autoCreateEnabled: true,
  });
  const retry = await telegramJobs.autoApplyTelegramTaskProposals({
    client,
    job,
    payload,
    autoCreateEnabled: true,
  });
  assert.equal(first.autoApplied, true);
  assert.equal(retry.autoApplied, true);
  assert.equal(retry.decision, "already_reviewed");
  assert.equal(state.tasks.length, 1);
  assert.equal(state.events, 1);
  assert.equal(state.audits, 1);
  assert.deepEqual(state.appliedTaskIds, ["task-1"]);
});

test("Telegram task-number updates are explicit and keep the factual status text", async () => {
  const [, telegramJobs] = await notificationJobModules;
  assert.deepEqual(
    telegramJobs.parseTelegramTaskDescriptionUpdate(
      "по задаче #1433 уже провели оплату и доставили на склад США"
    ),
    {
      number: 1433,
      update: "уже провели оплату и доставили на склад США",
    }
  );
  assert.deepEqual(
    telegramJobs.parseTelegramTaskDescriptionUpdate(
      "@OneCompanyOpenClawBot по задачі 1007: товар отримано"
    ),
    { number: 1007, update: "товар отримано" }
  );
  assert.deepEqual(
    telegramJobs.parseTelegramTaskDescriptionUpdate("#1433 оплатили, ждём склад США"),
    { number: 1433, update: "оплатили, ждём склад США" }
  );
  assert.equal(telegramJobs.parseTelegramTaskDescriptionUpdate("создай новую задачу"), null);

  const source = fs.readFileSync(path.resolve("src/lib/operations/telegramJobs.ts"), "utf8");
  assert.match(source, /telegram\.inbox\.draft_materialize/);
  assert.match(source, /keepInboxPending: true/);
  assert.match(source, /telegram:task-update:/);
  assert.match(source, /processedAttachments/);
  assert.match(source, /context\?\.source === "reply"/);
  assert.match(source, /kind: "progress_update"/);
  assert.match(source, /opsTaskAttachment\.createMany/);
  assert.match(source, /Отменить обновление/);

  const callbacks = fs.readFileSync(
    path.resolve("src/lib/operations/telegramCallbacks.ts"),
    "utf8"
  );
  assert.match(callbacks, /"undo_task_update"/);
  assert.match(callbacks, /telegram\.task\.progress_update_undo/);
});

test("job retry uses bounded backoff and the fourth failure is dead-letter", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 20].map(opsJobBackoffMs),
    [15_000, 60_000, 300_000, 900_000, 900_000]
  );
  const now = new Date("2026-07-19T10:00:00.000Z");
  const retry = nextOpsJobFailureState({ attempts: 0, maxAttempts: 4, now });
  assert.equal(retry.attempts, 1);
  assert.equal(retry.status, OpsJobStatus.QUEUED);
  assert.equal(retry.availableAt.toISOString(), "2026-07-19T10:00:15.000Z");

  const dead = nextOpsJobFailureState({ attempts: 3, maxAttempts: 4, now });
  assert.equal(dead.attempts, 4);
  assert.equal(dead.status, OpsJobStatus.DEAD_LETTER);
  assert.equal(dead.finishedAt?.toISOString(), now.toISOString());
});

test("job errors redact Telegram tokens and bearer credentials", () => {
  const redacted = redactOpsJobErrorMessage(
    "fetch https://api.telegram.org/bot123456789:abcdefghijklmnopqrstuvwxyz/getFile Bearer abc.def.ghi"
  );
  assert.doesNotMatch(redacted, /abcdefghijklmnopqrstuvwxyz|abc\.def\.ghi/);
  assert.match(redacted, /\[REDACTED\]/);
});

test("media policy accepts supported voice and rejects size, duration, archives and macros", () => {
  const valid = validateOpsTelegramMedia({
    kind: "voice",
    fileId: "voice-1",
    fileUniqueId: "voice-u1",
    fileSize: 1024,
    durationSeconds: 30,
    mimeType: "audio/ogg",
    fileName: null,
  });
  assert.equal(valid.mimeType, "audio/ogg");
  assert.match(valid.safeFileName, /\.ogg$/);

  assert.throws(
    () =>
      validateOpsTelegramMedia({
        ...valid,
        fileSize: OPS_ATTACHMENT_MAX_BYTES + 1,
      }),
    /at most/
  );
  assert.throws(() => validateOpsTelegramMedia({ ...valid, durationSeconds: 601 }), /600 seconds/);
  assert.throws(
    () =>
      validateOpsTelegramMedia({
        ...valid,
        kind: "document",
        mimeType: "application/pdf",
        fileName: "payload.zip",
      }),
    /not accepted/
  );
  assert.throws(
    () =>
      validateOpsTelegramMedia({
        ...valid,
        kind: "document",
        mimeType: "application/pdf",
        fileName: "price-list.xlsm",
      }),
    /not accepted/
  );
  assert.doesNotThrow(() =>
    assertOpsMediaMagicBytes(new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0, 0, 0, 0]), "audio/ogg")
  );
  assert.throws(
    () =>
      assertOpsMediaMagicBytes(new TextEncoder().encode("<script>not audio</script>"), "audio/ogg"),
    /do not match/
  );
});

test("media budget blocks uploads above the monthly cap before storage", async () => {
  let aggregateCall = 0;
  const client = {
    opsAttachment: {
      async aggregate() {
        aggregateCall += 1;
        return {
          _sum: {
            sizeBytes:
              aggregateCall === 1 ? OPS_MEDIA_MONTHLY_UPLOAD_CAP_BYTES - BigInt(100) : BigInt(0),
          },
        };
      },
    },
  } as unknown as PrismaClient;
  await assert.rejects(
    () => assertOpsMediaStorageBudget({ client, incomingBytes: 101 }),
    /monthly operations upload cap/
  );
});

test("AI normalization marks RU/UA payment, purchase, and checkout tasks for human approval", async () => {
  const { normalizeOpsExtraction } = await aiModule;
  for (const title of [
    "Оплатити замовлення карткою",
    "Купить товар у поставщика",
    "Завершить чекаут",
    "Провести оплату постачальнику",
  ]) {
    const result = normalizeOpsExtraction({
      intent: "task",
      summary: "Unsafe request",
      project_candidates: [],
      order_candidates: [],
      confidence: "0.99",
      ambiguities: [],
      requires_approval: false,
      tasks: [
        {
          title,
          priority: "urgent",
          executor_type: "automation",
        },
      ],
    });
    assert.equal(result.requires_approval, true, title);
    assert.equal(result.tasks[0].executor_type, "human", title);
  }
});

test("AI extraction requires factual execution fields and preserves typed task tags", async () => {
  const { normalizeOpsExtraction } = await aiModule;
  const complete = normalizeOpsExtraction({
    intent: "task",
    summary: "Check a product",
    project_candidates: [],
    order_candidates: [],
    confidence: "0.98",
    ambiguities: [],
    requires_approval: false,
    tasks: [
      {
        title: "Проверить комплект Maxton для BMW G20",
        description: "Нужно проверить совместимость указанного комплекта с BMW G20.",
        priority: "normal",
        due_at: null,
        assignee_ref: null,
        next_action: "Открыть карточку комплекта и сверить совместимость.",
        definition_of_done: "Совместимость подтверждена или указана причина несовместимости.",
        executor_type: "human",
        project_ref: null,
        order_ref: null,
        brand_tags: ["Maxton"],
        product_tags: ["BMW G20"],
        process_tags: ["catalog"],
      },
    ],
  });
  assert.equal(complete.requires_approval, false);
  assert.deepEqual(complete.tasks[0].brand_tags, ["Maxton"]);
  assert.deepEqual(complete.tasks[0].product_tags, ["BMW G20"]);
  assert.deepEqual(complete.tasks[0].process_tags, ["catalog"]);

  const incomplete = normalizeOpsExtraction({
    ...complete,
    tasks: [{ title: "Проверить товар", priority: "normal", executor_type: "human" }],
  });
  assert.equal(incomplete.requires_approval, true);
  assert.ok(incomplete.ambiguities.some((ambiguity) => ambiguity.includes("описание")));

  const aiSource = fs.readFileSync(path.resolve("src/lib/operations/ai.ts"), "utf8");
  assert.match(aiSource, /Do not translate, summarize, improve grammar/);
  assert.match(aiSource, /Use \[неразборчиво\]/);
  assert.match(aiSource, /brand_tags/);
  assert.match(aiSource, /definition of done/);

  const jobSource = fs.readFileSync(path.resolve("src/lib/operations/telegramJobs.ts"), "utf8");
  assert.match(jobSource, /processedAttachments/);
  assert.match(jobSource, /transcriptionModel: response\.model/);
  assert.match(jobSource, /tags: extractedTaskTags\(extracted\)/);
});

test("Ops AI uses Gemini 3.5 Flash-Lite pricing and no deprecated sampling parameters", async () => {
  const { calculateOpsAiCostMicros, OPS_AI_PRIMARY_MODEL } = await aiModule;
  assert.equal(OPS_AI_PRIMARY_MODEL, "gemini-3.5-flash-lite");
  assert.equal(
    calculateOpsAiCostMicros({
      inputTokens: 1_000,
      outputTokens: 100,
      includesAudio: true,
      model: "gemini-3.5-flash-lite",
    }),
    BigInt(550)
  );
  assert.equal(
    calculateOpsAiCostMicros({
      inputTokens: 1_000,
      outputTokens: 100,
      includesAudio: false,
      model: "gemini-3.5-flash",
    }),
    BigInt(2_400)
  );
  const source = fs.readFileSync(path.resolve("src/lib/operations/ai.ts"), "utf8");
  assert.doesNotMatch(source, /\b(?:temperature|topP|topK|top_p|top_k)\s*:/);
});

test("AI budget stops exactly at the hard cap and provider fallback runs at most once", async () => {
  const { canReserveOpsAiBudget, extractOpsProposalWithAi, OPS_AI_HARD_STOP_MICROS } =
    await aiModule;
  assert.equal(
    canReserveOpsAiBudget({
      currentCostMicros: OPS_AI_HARD_STOP_MICROS - BigInt(1),
      estimatedCostMicros: BigInt(1),
    }),
    true
  );
  assert.equal(
    canReserveOpsAiBudget({
      currentCostMicros: OPS_AI_HARD_STOP_MICROS,
      estimatedCostMicros: BigInt(1),
    }),
    false
  );

  let calls = 0;
  const provider: OpsAiProvider = {
    async extract() {
      calls += 1;
      if (calls === 1) throw new Error("primary unavailable");
      return {
        value: {
          intent: "task",
          summary: "One task",
          project_candidates: [],
          order_candidates: [],
          confidence: "0.90",
          ambiguities: [],
          requires_approval: false,
          tasks: [
            {
              title: "Перевірити сумісність",
              priority: "normal",
              executor_type: "human",
            },
          ],
        },
        usage: { inputTokens: 100, outputTokens: 50 },
      };
    },
    async transcribe() {
      throw new Error("not used");
    },
  };
  const reservations: bigint[] = [];
  const budget: OpsAiBudget = {
    async reserve(amount) {
      reservations.push(amount);
    },
    async record() {},
  };
  const result = await extractOpsProposalWithAi({
    text: "Перевірити сумісність",
    context: {},
    budget,
    provider,
  });
  assert.equal(calls, 2);
  assert.equal(reservations.length, 2);
  assert.equal(result.value.tasks.length, 1);
});

test("Telegram Lab source has no imports from the old production bot", () => {
  const files = [
    "src/lib/operations/telegram.ts",
    "src/lib/operations/telegramCallbacks.ts",
    "src/lib/operations/telegramJobs.ts",
    "src/app/api/operations/telegram-manager/webhook/route.ts",
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.resolve(file), "utf8");
    assert.doesNotMatch(source, /@\/lib\/bot|webhook-grammy|deleteWebhook|startPolling/);
  }
  const callbacks = fs.readFileSync(
    path.resolve("src/lib/operations/telegramCallbacks.ts"),
    "utf8"
  );
  assert.match(callbacks, /OpsTaskStatus\.CANCELLED/);
  assert.doesNotMatch(callbacks, /\.delete\(|\.deleteMany\(/);

  const envExample = fs.readFileSync(path.resolve(".env.example"), "utf8");
  assert.match(envExample, /^OPS_BLOB_READ_WRITE_TOKEN=$/m);
  assert.match(envExample, /^OPS_BLOB_STORE_ID=$/m);
  assert.match(envExample, /^OPS_TELEGRAM_CALLBACK_SECRET=$/m);
  assert.doesNotMatch(envExample, /^OPS_PRIVATE_BLOB_READ_WRITE_TOKEN=/m);

  const attachmentAccess = fs.readFileSync(
    path.resolve(
      "src/app/api/admin/operations/tasks/[id]/attachments/[attachmentId]/access/route.ts"
    ),
    "utf8"
  );
  assert.match(attachmentAccess, /issueSignedToken/);
  assert.match(attachmentAccess, /presignUrl/);
  assert.match(attachmentAccess, /Date\.now\(\) \+ 60_000/);
  assert.doesNotMatch(attachmentAccess, /new Response\(blob\.stream/);
});

function opsJobFromCreateInput(
  input: Record<string, unknown>,
  overrides: Partial<OpsJob> = {}
): OpsJob {
  const now = new Date("2026-07-20T09:00:00.000Z");
  return {
    id: "job-1",
    idempotencyKey: String(input.idempotencyKey ?? "job-key"),
    inboxItemId: null,
    taskId: input.taskId ? String(input.taskId) : null,
    type: String(input.type),
    status: OpsJobStatus.RUNNING,
    stage: (input.stage as OpsJobStage) ?? OpsJobStage.NOTIFY,
    payload: (input.payload ?? {}) as OpsJob["payload"],
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
    ...overrides,
  };
}

test("Telegram notification permission is rechecked after enqueue and role revocation", async () => {
  const [{ enqueueOpsInternalNotifications }, { createOpsJobStageExecutor }] =
    await notificationJobModules;
  const now = new Date("2026-07-20T06:00:00.000Z");
  let livePermissions = ["ops.tasks.read"];
  const createdJobs: Record<string, unknown>[] = [];
  const enqueueClient = {
    opsMemberProfile: {
      async findMany() {
        return [
          {
            adminUserId: "admin-1",
            telegramUserId: BigInt(42),
            timezone: "Europe/Kyiv",
            adminUser: {
              name: "Игорь",
              roles: [
                {
                  role: {
                    key: "task_member",
                    permissions: [...livePermissions],
                  },
                },
              ],
            },
          },
        ];
      },
    },
    opsTask: {
      async findMany() {
        return [];
      },
      async groupBy() {
        return [{ status: "IN_PROGRESS", _count: { _all: 1 } }];
      },
      async count() {
        return 1;
      },
    },
    opsJob: {
      async createMany(args: { data: Record<string, unknown>[] }) {
        createdJobs.push(...args.data);
        return { count: args.data.length };
      },
    },
  } as unknown as PrismaClient;

  const enqueued = await enqueueOpsInternalNotifications({
    client: enqueueClient,
    now,
  });
  assert.equal(enqueued.reminders, 0);
  assert.equal(enqueued.reports, 1);
  assert.equal(createdJobs.length, 1);
  assert.equal((createdJobs[0].payload as Record<string, unknown>).recipientAdminUserId, "admin-1");

  // The role is revoked after the durable job is created but before its NOTIFY
  // stage runs. The worker must resolve the current database grants.
  livePermissions = [];
  const afterRevocation = await enqueueOpsInternalNotifications({
    client: enqueueClient,
    now: new Date("2026-07-21T06:00:00.000Z"),
  });
  assert.equal(afterRevocation.reminders, 0);
  assert.equal(afterRevocation.reports, 0);
  assert.equal(createdJobs.length, 1);

  let sends = 0;
  const sendClient = {
    opsMemberProfile: {
      async findFirst() {
        return {
          id: "profile-1",
          adminUserId: "admin-1",
          adminUser: {
            roles: [
              {
                role: {
                  key: "task_member",
                  permissions: [...livePermissions],
                },
              },
            ],
          },
        };
      },
    },
    opsTask: {
      async findFirst() {
        throw new Error("task lookup must not run after permission revocation");
      },
    },
  } as unknown as PrismaClient;
  const execute = createOpsJobStageExecutor({
    client: sendClient,
    dependencies: {
      fetchImpl: (async () => {
        sends += 1;
        return new Response();
      }) as typeof fetch,
    },
  });
  const outcome = await execute({
    job: opsJobFromCreateInput(createdJobs[0]),
    workerId: "test-worker",
    signal: new AbortController().signal,
  });
  assert.equal(outcome.outcome, "succeeded");
  assert.deepEqual(outcome.result, {
    notification: "skipped_recipient_permission_revoked",
  });
  assert.equal(sends, 0);
});

test("an overdue task queues only one Telegram reminder per assignee", async () => {
  const [{ enqueueOpsInternalNotifications }] = await notificationJobModules;
  const keys = new Set<string>();
  const createdJobs: Record<string, unknown>[] = [];
  const client = {
    opsMemberProfile: {
      async findMany() {
        return [
          {
            adminUserId: "admin-1",
            telegramUserId: BigInt(42),
            timezone: "Europe/Kyiv",
            adminUser: {
              roles: [
                {
                  role: {
                    key: "task_member",
                    permissions: ["ops.tasks.read"],
                  },
                },
              ],
            },
          },
        ];
      },
    },
    opsTask: {
      async findMany() {
        return [
          {
            id: "task-1",
            externalId: "TSK-1",
            title: "Проверить заказ",
            dueAt: new Date("2026-07-22T06:00:00.000Z"),
          },
        ];
      },
    },
    opsJob: {
      async createMany(args: { data: Record<string, unknown>[] }) {
        let count = 0;
        for (const job of args.data) {
          const key = String(job.idempotencyKey);
          if (keys.has(key)) continue;
          keys.add(key);
          createdJobs.push(job);
          count += 1;
        }
        return { count };
      },
    },
  } as unknown as PrismaClient;

  const now = new Date("2026-07-22T07:30:00.000Z");
  const first = await enqueueOpsInternalNotifications({ client, now });
  const second = await enqueueOpsInternalNotifications({ client, now });

  assert.equal(first.reminders, 1);
  assert.equal(second.reminders, 0);
  assert.equal(createdJobs.length, 1);
  assert.equal(createdJobs[0].idempotencyKey, "reminder:due-once:task-1:admin-1");
});

test("an active task reader still receives an internal Telegram report", async () => {
  const [, { createOpsJobStageExecutor }] = await notificationJobModules;
  const previousEnabled = process.env.OPS_TELEGRAM_NOTIFICATIONS_ENABLED;
  const previousToken = process.env.OPS_TELEGRAM_BOT_TOKEN;
  process.env.OPS_TELEGRAM_NOTIFICATIONS_ENABLED = "1";
  process.env.OPS_TELEGRAM_BOT_TOKEN = "test-token-not-a-production-secret";
  try {
    let sends = 0;
    const client = {
      opsMemberProfile: {
        async findFirst() {
          return {
            id: "profile-1",
            adminUserId: "admin-1",
            adminUser: {
              roles: [
                {
                  role: {
                    key: "task_member",
                    permissions: ["ops.tasks.read"],
                  },
                },
              ],
            },
          };
        },
      },
    } as unknown as PrismaClient;
    const execute = createOpsJobStageExecutor({
      client,
      dependencies: {
        fetchImpl: (async () => {
          sends += 1;
          return new Response(
            JSON.stringify({
              ok: true,
              result: { message_id: 7, chat: { id: 42 } },
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          );
        }) as typeof fetch,
      },
    });
    const outcome = await execute({
      job: opsJobFromCreateInput({
        idempotencyKey: "report-1",
        type: "telegram_internal_report",
        stage: OpsJobStage.NOTIFY,
        payload: {
          recipientAdminUserId: "admin-1",
          telegramUserId: "42",
          reportPeriod: "morning",
          overdueCount: 1,
          counts: { IN_PROGRESS: 2 },
        },
      }),
      workerId: "test-worker",
      signal: new AbortController().signal,
    });
    assert.equal(outcome.outcome, "succeeded");
    assert.deepEqual(outcome.result, {
      notification: "sent",
      telegramMessageId: 7,
    });
    assert.equal(sends, 1);
  } finally {
    if (previousEnabled === undefined) {
      delete process.env.OPS_TELEGRAM_NOTIFICATIONS_ENABLED;
    } else {
      process.env.OPS_TELEGRAM_NOTIFICATIONS_ENABLED = previousEnabled;
    }
    if (previousToken === undefined) {
      delete process.env.OPS_TELEGRAM_BOT_TOKEN;
    } else {
      process.env.OPS_TELEGRAM_BOT_TOKEN = previousToken;
    }
  }
});

test("a durable assignment job sends one actionable Telegram notification", async () => {
  const [, { createOpsJobStageExecutor }] = await notificationJobModules;
  const previous = {
    enabled: process.env.OPS_TELEGRAM_NOTIFICATIONS_ENABLED,
    token: process.env.OPS_TELEGRAM_BOT_TOKEN,
    callbackSecret: process.env.OPS_TELEGRAM_CALLBACK_SECRET,
    baseUrl: process.env.OPS_ADMIN_BASE_URL,
  };
  process.env.OPS_TELEGRAM_NOTIFICATIONS_ENABLED = "1";
  process.env.OPS_TELEGRAM_BOT_TOKEN = "test-token-not-a-production-secret";
  process.env.OPS_TELEGRAM_CALLBACK_SECRET = "test_callback_secret";
  process.env.OPS_ADMIN_BASE_URL = "https://admin.example.test";
  try {
    const requestBodies: Record<string, unknown>[] = [];
    const client = {
      opsMemberProfile: {
        async findFirst() {
          return {
            id: "profile-1",
            adminUserId: "admin-1",
            timezone: "Europe/Kyiv",
            adminUser: {
              name: "Игорь",
              roles: [
                {
                  role: {
                    key: "task_member",
                    permissions: ["ops.tasks.read", "ops.tasks.write"],
                  },
                },
              ],
            },
          };
        },
      },
      opsTask: {
        async findFirst() {
          return { id: "task-123456" };
        },
      },
      opsIdempotencyRecord: {
        async create() {
          return {};
        },
      },
      opsTelegramDelivery: {
        async upsert() {
          return {};
        },
      },
    } as unknown as PrismaClient;
    const execute = createOpsJobStageExecutor({
      client,
      dependencies: {
        fetchImpl: (async (_url, init) => {
          requestBodies.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
          return new Response(
            JSON.stringify({
              ok: true,
              result: { message_id: 8, chat: { id: 42 } },
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            }
          );
        }) as typeof fetch,
      },
    });
    const outcome = await execute({
      job: opsJobFromCreateInput({
        idempotencyKey: "assignment-1",
        taskId: "task-123456",
        type: "telegram_task_assigned",
        stage: OpsJobStage.NOTIFY,
        payload: {
          taskId: "task-123456",
          recipientAdminUserId: "admin-1",
          telegramUserId: "42",
          externalId: "TSK-42",
          title: "Проверить цены Burger",
          assignedByName: "Саша Цомпель",
          dueAt: null,
        },
      }),
      workerId: "test-worker",
      signal: new AbortController().signal,
    });
    assert.equal(outcome.outcome, "succeeded");
    const requestBody = requestBodies[0];
    assert.ok(requestBody);
    assert.match(String(requestBody.text), /Вам назначена задача/u);
    assert.match(String(requestBody.text), /ИСПОЛНИТЕЛЬ: Игорь/u);
    assert.match(String(requestBody.text), /Поставил: Саша Цомпель/u);
    const markup = requestBody.reply_markup as {
      inline_keyboard: Array<
        Array<{
          text: string;
          url?: string;
          callback_data?: string;
          style?: "primary" | "success" | "danger";
        }>
      >;
    };
    assert.deepEqual(
      markup.inline_keyboard.flat().map((button) => button.text),
      ["📋 Открыть задачу", "▶️ Взять в работу", "🙋 Не моя задача"]
    );
    assert.deepEqual(
      markup.inline_keyboard.flat().map((button) => button.style),
      ["primary", "success", "danger"]
    );
  } finally {
    for (const [key, value] of Object.entries({
      OPS_TELEGRAM_NOTIFICATIONS_ENABLED: previous.enabled,
      OPS_TELEGRAM_BOT_TOKEN: previous.token,
      OPS_TELEGRAM_CALLBACK_SECRET: previous.callbackSecret,
      OPS_ADMIN_BASE_URL: previous.baseUrl,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

type CatalogAutomationHarness = {
  client: PrismaClient;
  task: {
    status: OpsTaskStatus;
    version: number;
    nextAction: string | null;
    blockerType: OpsBlockerType | null;
    blockerDescription: string | null;
    attemptCount: number;
  };
  run: {
    status: OpsAutomationStatus;
    stage: string | null;
    attempts: number;
    result: unknown;
  };
  events: Array<{ type: OpsTaskEventType; payload: unknown }>;
  audits: Array<{ action: string; metadata: unknown }>;
  catalogReads: () => number;
};

function createCatalogAutomationHarness(
  product: {
    id: string;
    sku: string | null;
    slug: string;
    brand: string | null;
    titleUa: string;
    titleEn: string;
    categoryUa: string | null;
    categoryEn: string | null;
    image: string | null;
    isPublished: boolean;
    status: string;
    stock: string;
    updatedAt: Date;
  } | null
): CatalogAutomationHarness {
  const task: CatalogAutomationHarness["task"] & {
    id: string;
    archivedAt: Date | null;
  } = {
    id: "task-catalog-1",
    status: OpsTaskStatus.IN_PROGRESS,
    version: 3,
    archivedAt: null as Date | null,
    nextAction: "Check the catalog",
    blockerType: null as OpsBlockerType | null,
    blockerDescription: null as string | null,
    attemptCount: 0,
  };
  const run: CatalogAutomationHarness["run"] & {
    id: string;
    taskId: string;
    automationType: string;
    inputSnapshot: unknown;
  } = {
    id: "run-catalog-1",
    taskId: task.id,
    automationType: "catalog_check",
    status: OpsAutomationStatus.QUEUED,
    inputSnapshot: {
      type: "catalog_check",
      input: { productId: "product-1", sku: "SKU-1" },
    },
    result: null as unknown,
    stage: null as string | null,
    attempts: 0,
  };
  const events: Array<{ type: OpsTaskEventType; payload: unknown }> = [];
  const audits: Array<{ action: string; metadata: unknown }> = [];
  let reads = 0;
  const rawClient = {
    async $transaction<T>(callback: (tx: PrismaClient) => Promise<T>): Promise<T> {
      return callback(client);
    },
    opsAutomationRun: {
      async findUnique() {
        return {
          ...run,
          task: {
            id: task.id,
            status: task.status,
            version: task.version,
            archivedAt: task.archivedAt,
          },
        };
      },
      async update({ data }: { data: Record<string, unknown> }) {
        if (data.status) run.status = data.status as OpsAutomationStatus;
        if ("stage" in data) run.stage = data.stage as string | null;
        if ("result" in data) run.result = data.result;
        if (data.attempts && typeof data.attempts === "object") {
          run.attempts += Number((data.attempts as { increment?: unknown }).increment ?? 0);
        }
        return run;
      },
    },
    opsTask: {
      async updateMany({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) {
        if (
          ("version" in where && where.version !== task.version) ||
          ("status" in where && where.status !== task.status)
        ) {
          return { count: 0 };
        }
        if (data.status) task.status = data.status as OpsTaskStatus;
        if ("nextAction" in data) task.nextAction = data.nextAction as string | null;
        if ("blockerType" in data) {
          task.blockerType = data.blockerType as OpsBlockerType | null;
        }
        if ("blockerDescription" in data) {
          task.blockerDescription = data.blockerDescription as string | null;
        }
        if (data.version && typeof data.version === "object") {
          task.version += Number((data.version as { increment?: unknown }).increment ?? 0);
        }
        if (data.attemptCount && typeof data.attemptCount === "object") {
          task.attemptCount += Number(
            (data.attemptCount as { increment?: unknown }).increment ?? 0
          );
        }
        return { count: 1 };
      },
    },
    opsTaskEvent: {
      async create({ data }: { data: { type: OpsTaskEventType; payload: unknown } }) {
        events.push({ type: data.type, payload: data.payload });
        return { id: `event-${events.length}` };
      },
    },
    adminAuditLog: {
      async create({ data }: { data: { action: string; metadata: unknown } }) {
        audits.push({ action: data.action, metadata: data.metadata });
        return { id: `audit-${audits.length}` };
      },
    },
    shopProduct: {
      async findFirst() {
        reads += 1;
        return product;
      },
    },
  };
  const client = rawClient as unknown as PrismaClient;
  return {
    client,
    task,
    run,
    events,
    audits,
    catalogReads: () => reads,
  };
}

test("catalog_check is a read-only catalog lookup and finishes the Ops task in review", async () => {
  const [, { createOpsJobStageExecutor }] = await notificationJobModules;
  const previousEnabled = process.env.OPS_AUTOMATIONS_ENABLED;
  process.env.OPS_AUTOMATIONS_ENABLED = "true";
  try {
    const harness = createCatalogAutomationHarness({
      id: "product-1",
      sku: "SKU-1",
      slug: "maxton-sku-1",
      brand: "Maxton",
      titleUa: "Спойлер",
      titleEn: "Spoiler",
      categoryUa: "Спойлери",
      categoryEn: "Spoilers",
      image: "https://example.invalid/catalog/product-1.jpg",
      isPublished: true,
      status: "ACTIVE",
      stock: "inStock",
      updatedAt: new Date("2026-07-20T11:00:00.000Z"),
    });
    const execute = createOpsJobStageExecutor({ client: harness.client });
    const job = opsJobFromCreateInput(
      {
        idempotencyKey: "catalog-check-1",
        taskId: "task-catalog-1",
        type: "automation:catalog_check",
        stage: OpsJobStage.EXECUTE_AUTOMATIONS,
        payload: {
          automationRunId: "run-catalog-1",
          type: "catalog_check",
        },
      },
      { id: "job-catalog-1" }
    );
    const outcome = await execute({
      job,
      workerId: "test-worker",
      signal: new AbortController().signal,
    });

    assert.equal(outcome.outcome, "succeeded");
    assert.equal(harness.catalogReads(), 1);
    assert.equal(harness.run.status, OpsAutomationStatus.SUCCEEDED);
    assert.equal(harness.run.stage, "review");
    assert.equal(harness.run.attempts, 1);
    assert.equal(harness.task.status, OpsTaskStatus.REVIEW);
    assert.equal(harness.task.version, 5);
    assert.equal(harness.task.attemptCount, 1);
    assert.match(harness.task.nextAction ?? "", /Проверить результат/);
    assert.deepEqual(
      harness.events.map((entry) => entry.type),
      [OpsTaskEventType.AUTOMATION_STARTED, OpsTaskEventType.AUTOMATION_FINISHED]
    );
    assert.deepEqual(
      harness.audits.map((entry) => entry.action),
      ["automation.catalog_check.running", "automation.catalog_check.finish"]
    );
    const result = harness.run.result as {
      outcome: string;
      readOnly: boolean;
      effectExecuted: boolean;
      product: { id: string };
    };
    assert.equal(result.outcome, "found");
    assert.equal(result.readOnly, true);
    assert.equal(result.effectExecuted, false);
    assert.equal(result.product.id, "product-1");

    // A restart after the run transaction commits but before the job is marked
    // succeeded must observe the terminal run and avoid another catalog read,
    // task transition, event, or audit row.
    const replay = await execute({
      job,
      workerId: "restarted-worker",
      signal: new AbortController().signal,
    });
    assert.equal(replay.outcome, "succeeded");
    assert.equal(harness.catalogReads(), 1);
    assert.equal(harness.events.length, 2);
    assert.equal(harness.audits.length, 2);
    assert.equal(harness.task.version, 5);
  } finally {
    if (previousEnabled === undefined) delete process.env.OPS_AUTOMATIONS_ENABLED;
    else process.env.OPS_AUTOMATIONS_ENABLED = previousEnabled;
  }
});

test("text intake remains manually actionable when AI is not configured", async () => {
  const { createManualOpsExtraction, matchOpsAssigneeCandidate } =
    await notificationJobModules.then(([, telegramJobs]) => telegramJobs);
  const extraction = createManualOpsExtraction(
    "Створи задачу для Ігоря щоб він Do88 замовив на Volvo ICM-710",
    "AI_NOT_CONFIGURED"
  );

  assert.equal(extraction.intent, "task");
  assert.equal(extraction.tasks.length, 1);
  assert.equal(extraction.tasks[0].title, "Замовити Do88 ICM-710 для Volvo");
  assert.equal(extraction.tasks[0].assignee_ref, "Ігоря");
  assert.equal(extraction.confidence, "0.70");
  assert.deepEqual(extraction.ambiguities, []);

  const assigneeId = matchOpsAssigneeCandidate("Ігоря", [
    {
      id: "igor-id",
      name: "Игорь",
      email: "igor@example.com",
      permissions: ["ops.tasks.read", "ops.tasks.write"],
    },
    {
      id: "catalog-id",
      name: "Ігор Каталог",
      email: "catalog@example.com",
      permissions: ["shop.products.write"],
    },
  ]);
  assert.equal(assigneeId, "igor-id");

  const directory = [
    {
      id: "sasha-tsompel-id",
      name: "Саша Цомпель",
      email: "owner@example.com",
      permissions: ["ops.tasks.read"],
    },
    {
      id: "sasha-ignatochkin-id",
      name: "Саша Игнаточкин",
      email: "sasha@example.com",
      permissions: ["ops.tasks.read"],
    },
  ];
  assert.equal(
    matchOpsAssigneeCandidate("sasha-ignatochkin-id", directory),
    "sasha-ignatochkin-id"
  );
  assert.equal(matchOpsAssigneeCandidate("Саша", directory), null);
});

test("manual extraction turns a forwarded chat and product URL into a concise task", async () => {
  const { createManualOpsExtraction } = await notificationJobModules.then(
    ([, telegramJobs]) => telegramJobs
  );
  const extraction = createManualOpsExtraction(
    [
      "[18.07.2026 13:45] Саня Цомпель: За вольво до88 скинув бабки , уточню в вані чи прийшли і можна замовляти",
      "[18.07.2026 13:48] Саня Цомпель: Icm-170",
      "[18.07.2026 13:48] Саня Цомпель: https://onecompany.global/ua/shop/do88/products/do88-icm-170",
    ].join("\n"),
    "AI_NOT_CONFIGURED"
  );

  assert.equal(
    extraction.tasks[0].title,
    "Уточнити у Вані надходження оплати та замовити Do88 ICM-170 для Volvo"
  );
  assert.equal(extraction.tasks[0].assignee_ref, null);
  assert.match(extraction.tasks[0].description ?? "", /do88-icm-170/);
  assert.deepEqual(extraction.ambiguities, []);
});

test("catalog_check worker has no commerce mutation, raw SQL, browser, or external-call path", () => {
  const worker = fs.readFileSync(path.resolve("src/lib/operations/telegramJobs.ts"), "utf8");
  const start = worker.indexOf("async function executeCatalogCheckAutomation");
  const end = worker.indexOf("async function executeAutomationJob", start);
  assert.ok(start >= 0 && end > start);
  const catalogExecutor = worker.slice(start, end);
  assert.match(catalogExecutor, /shopProduct\.findFirst/);
  assert.doesNotMatch(catalogExecutor, /shopProduct\.(?:create|update|delete|upsert)/);
  assert.doesNotMatch(catalogExecutor, /shopOrder\.(?:create|update|delete|upsert)/);
  assert.doesNotMatch(catalogExecutor, /\$(?:executeRaw|queryRaw)/);
  assert.doesNotMatch(catalogExecutor, /\bfetch\s*\(/);
  assert.doesNotMatch(catalogExecutor, /playwright|child_process|sendMessage/);
});

test("catalog_check waits for a human when its resolved product no longer exists", async () => {
  const [, { createOpsJobStageExecutor }] = await notificationJobModules;
  const previousEnabled = process.env.OPS_AUTOMATIONS_ENABLED;
  process.env.OPS_AUTOMATIONS_ENABLED = "true";
  try {
    const harness = createCatalogAutomationHarness(null);
    const execute = createOpsJobStageExecutor({ client: harness.client });
    const outcome = await execute({
      job: opsJobFromCreateInput(
        {
          idempotencyKey: "catalog-check-missing-1",
          taskId: "task-catalog-1",
          type: "automation:catalog_check",
          stage: OpsJobStage.EXECUTE_AUTOMATIONS,
          payload: {
            automationRunId: "run-catalog-1",
            type: "catalog_check",
          },
        },
        { id: "job-catalog-missing-1" }
      ),
      workerId: "test-worker",
      signal: new AbortController().signal,
    });

    assert.equal(outcome.outcome, "waiting_human");
    assert.equal(harness.run.status, OpsAutomationStatus.WAITING_HUMAN);
    assert.equal(harness.task.status, OpsTaskStatus.WAITING_HUMAN);
    assert.equal(harness.task.nextAction, null);
    assert.equal(harness.task.blockerType, OpsBlockerType.INFORMATION);
    assert.match(harness.task.blockerDescription ?? "", /ручной выбор товара/);
  } finally {
    if (previousEnabled === undefined) delete process.env.OPS_AUTOMATIONS_ENABLED;
    else process.env.OPS_AUTOMATIONS_ENABLED = previousEnabled;
  }
});

test("unimplemented research and document helpers remain explicitly waiting for human review", async () => {
  const [, { createOpsJobStageExecutor }] = await notificationJobModules;
  const previousEnabled = process.env.OPS_AUTOMATIONS_ENABLED;
  process.env.OPS_AUTOMATIONS_ENABLED = "true";
  try {
    for (const type of ["research_draft", "document_summary"] as const) {
      const updates: Array<Record<string, unknown>> = [];
      const client = {
        opsAutomationRun: {
          async update({ data }: { data: Record<string, unknown> }) {
            updates.push(data);
            return { id: `run-${type}` };
          },
        },
      } as unknown as PrismaClient;
      const execute = createOpsJobStageExecutor({ client });
      const outcome = await execute({
        job: opsJobFromCreateInput(
          {
            idempotencyKey: `helper-${type}`,
            taskId: "task-helper-1",
            type: `automation:${type}`,
            stage: OpsJobStage.EXECUTE_AUTOMATIONS,
            payload: {
              automationRunId: `run-${type}`,
              type,
            },
          },
          { id: `job-${type}` }
        ),
        workerId: "test-worker",
        signal: new AbortController().signal,
      });
      assert.equal(outcome.outcome, "waiting_human");
      assert.equal(updates[0]?.status, OpsAutomationStatus.WAITING_HUMAN);
      assert.equal(updates[0]?.stage, "typed_helper_pending");
    }
  } finally {
    if (previousEnabled === undefined) delete process.env.OPS_AUTOMATIONS_ENABLED;
    else process.env.OPS_AUTOMATIONS_ENABLED = previousEnabled;
  }
});
