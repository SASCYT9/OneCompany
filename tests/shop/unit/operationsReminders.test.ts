import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import type { PrismaClient } from "@prisma/client";

import { registerHooks } from "./testHooks.mjs";
import {
  buildOpsDueTodayNudge,
  buildOpsMorningDigest,
  buildOpsWeeklyReview,
  enqueueOpsMemberReminders,
  nextOpsNotifyTime,
  opsDueNudgeAt,
  opsLocalClock,
  opsSnoozeDueAt,
  type OpsReminderButtonFactory,
  type OpsReminderTask,
} from "../../../src/lib/operations/reminders";

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

const callbacksModule = import("../../../src/lib/operations/telegramCallbacks");
const jobsModule = import("../../../src/lib/operations/telegramJobs");

// Kyiv is UTC+3 in summer and October before the 25th.
const kyiv = (iso: string) => new Date(`${iso}+03:00`);

test("the bot only starts conversations between 09:00 and 21:00 local time", () => {
  assert.equal(
    nextOpsNotifyTime(kyiv("2026-10-13T12:00:00")).toISOString(),
    kyiv("2026-10-13T12:00:00").toISOString()
  );
  assert.equal(
    nextOpsNotifyTime(kyiv("2026-10-13T07:30:00")).toISOString(),
    kyiv("2026-10-13T09:00:00").toISOString()
  );
  assert.equal(
    nextOpsNotifyTime(kyiv("2026-10-13T21:00:00")).toISOString(),
    kyiv("2026-10-14T09:00:00").toISOString(),
    "an assignment at 21:00 waits for the morning"
  );
  assert.equal(opsLocalClock(kyiv("2026-10-16T10:00:00")).weekday, 5, "16 Oct 2026 is a Friday");
});

test("deadline nudges come two hours early, never for morning deadlines", () => {
  assert.equal(
    opsDueNudgeAt(kyiv("2026-10-13T15:36:00"))?.toISOString(),
    kyiv("2026-10-13T13:36:00").toISOString()
  );
  assert.equal(opsDueNudgeAt(kyiv("2026-10-13T10:00:00")), null, "covered by the 09:00 digest");
  assert.equal(
    opsDueNudgeAt(kyiv("2026-10-13T23:30:00"))?.toISOString(),
    kyiv("2026-10-13T19:00:00").toISOString(),
    "late deadlines are nudged by 19:00, inside quiet hours"
  );
  assert.equal(
    opsSnoozeDueAt("tomorrow", kyiv("2026-10-13T22:10:00")).toISOString(),
    kyiv("2026-10-14T18:00:00").toISOString()
  );
  assert.equal(
    opsSnoozeDueAt("week", kyiv("2026-10-16T10:00:00")).toISOString(),
    kyiv("2026-10-23T18:00:00").toISOString()
  );
});

type FakeTask = { id: string; externalId: string; title: string; dueAt: Date | null };

function plannerClient(input: { dueToday?: FakeTask[]; dueYesterday?: FakeTask[] }) {
  const jobs: Array<Record<string, unknown>> = [];
  const keys = new Set<string>();
  const client = {
    opsTask: {
      async findMany({ where }: { where: Record<string, unknown> }) {
        const due = where.dueAt as { gte?: Date } | undefined;
        if (due?.gte) {
          // Today's window starts later than yesterday's.
          const isToday = due.gte.getTime() >= kyiv("2026-10-13T00:00:00").getTime();
          return isToday ? (input.dueToday ?? []) : (input.dueYesterday ?? []);
        }
        if (where.isShared === false) return [{ id: "task_unassigned1" }];
        return [{ id: "task_stale00001" }];
      },
      async count({ where }: { where: Record<string, unknown> }) {
        return where.isShared === false ? 3 : 12;
      },
    },
    opsJob: {
      async createMany({ data }: { data: Array<Record<string, unknown>> }) {
        let count = 0;
        for (const job of data) {
          const key = String(job.idempotencyKey);
          if (keys.has(key)) continue;
          keys.add(key);
          jobs.push(job);
          count += 1;
        }
        return { count };
      },
    },
  } as unknown as PrismaClient;
  return { client, jobs };
}

const member = {
  adminUserId: "admin_12345678",
  telegramUserId: BigInt(42),
  timezone: "Europe/Kyiv",
  roles: [{ role: { key: "task_member", permissions: ["ops.tasks.read", "ops.tasks.write"] } }],
};

test("the morning digest is sent once and only when something is due", async () => {
  const empty = plannerClient({});
  const none = await enqueueOpsMemberReminders({
    client: empty.client,
    now: kyiv("2026-10-13T09:05:00"),
    member,
  });
  assert.deepEqual(none, { digests: 0, nudges: 0, reviews: 0 }, "nothing due: no message");

  const { client, jobs } = plannerClient({
    dueToday: [
      {
        id: "task_today0001",
        externalId: "T1",
        title: "Сегодня",
        dueAt: kyiv("2026-10-13T11:00:00"),
      },
    ],
    dueYesterday: [
      {
        id: "task_yday00001",
        externalId: "T2",
        title: "Вчера",
        dueAt: kyiv("2026-10-12T15:00:00"),
      },
    ],
  });
  for (const minute of ["09:00", "09:15", "09:30"]) {
    await enqueueOpsMemberReminders({ client, now: kyiv(`2026-10-13T${minute}:00`), member });
  }
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].idempotencyKey, "digest:morning:admin_12345678:2026-10-13");
  const payload = jobs[0].payload as Record<string, unknown>;
  assert.equal(payload.reportPeriod, "morning_digest");
  assert.deepEqual(payload.todayTaskIds, ["task_today0001"]);
  assert.deepEqual(payload.yesterdayTaskIds, ["task_yday00001"]);
  assert.equal(payload.olderOverdueCount, 12);
});

test("nothing is queued at night, even with work due", async () => {
  const { client, jobs } = plannerClient({
    dueToday: [
      { id: "task_today0001", externalId: "T1", title: "Ночь", dueAt: kyiv("2026-10-13T23:30:00") },
    ],
  });
  await enqueueOpsMemberReminders({ client, now: kyiv("2026-10-13T21:30:00"), member });
  assert.equal(jobs.length, 0);
});

test("the Friday review lists stuck tasks, and unassigned ones for people who assign", async () => {
  const friday = kyiv("2026-10-16T10:00:00");
  const plain = plannerClient({});
  const result = await enqueueOpsMemberReminders({ client: plain.client, now: friday, member });
  assert.equal(result.reviews, 1);
  const review = plain.jobs[0].payload as Record<string, unknown>;
  assert.equal(review.reportPeriod, "weekly_review");
  assert.deepEqual(review.staleTaskIds, ["task_stale00001"]);
  assert.deepEqual(review.unassignedTaskIds, [], "a regular member does not triage the team");

  const owner = plannerClient({});
  await enqueueOpsMemberReminders({
    client: owner.client,
    now: friday,
    member: { ...member, roles: [{ role: { key: "owner", permissions: [] } }] },
  });
  const ownerReview = owner.jobs[0].payload as Record<string, unknown>;
  assert.deepEqual(ownerReview.unassignedTaskIds, ["task_unassigned1"]);
  assert.equal(ownerReview.unassignedTotal, 3);

  const thursday = plannerClient({});
  await enqueueOpsMemberReminders({
    client: thursday.client,
    now: kyiv("2026-10-15T10:00:00"),
    member,
  });
  assert.equal(thursday.jobs.length, 0, "no review outside Friday 10:00");
});

const fakeButton: OpsReminderButtonFactory = async (action, taskId, text) => ({
  text,
  callback_data: `${action}:${taskId}`,
});

function task(overrides: Partial<OpsReminderTask> & { id: string }): OpsReminderTask {
  return {
    number: 1016,
    externalId: "TSK-1",
    title: "Уточнить ETA по Dinan Suspension Link Kit",
    dueAt: null,
    ...overrides,
  };
}

test("the digest names tasks and offers Готово / Завтра buttons", async () => {
  const digest = await buildOpsMorningDigest({
    today: [task({ id: "task_today0001", number: 1020, dueAt: kyiv("2026-10-13T15:36:00") })],
    yesterday: [task({ id: "task_yday00001", number: 1016, dueAt: kyiv("2026-10-12T18:00:00") })],
    olderOverdueCount: 9,
    timeZone: "Europe/Kyiv",
    now: kyiv("2026-10-13T09:00:00"),
    tasksUrl: "https://onecompany.global/admin/operations/tasks?mine=1",
    button: fakeButton,
  });
  assert.ok(digest);
  assert.match(digest.text, /Вчера истёк срок:\n1\. #1016/);
  assert.match(digest.text, /Срок сегодня:\n2\. #1020 .* — до 15:36/);
  assert.match(digest.text, /Ещё 9 давно просроченных — разберём в пятницу/);
  const rows = digest.replyMarkup!.inline_keyboard;
  assert.deepEqual(
    rows[0].map((button) => ("callback_data" in button ? button.callback_data : button.url)),
    ["done:task_yday00001", "snooze_tomorrow:task_yday00001"]
  );
  assert.equal(rows.at(-1)![0].text, "📋 Все мои задачи");

  assert.equal(
    await buildOpsMorningDigest({
      today: [],
      yesterday: [],
      olderOverdueCount: 9,
      timeZone: "Europe/Kyiv",
      now: kyiv("2026-10-13T09:00:00"),
      tasksUrl: null,
      button: fakeButton,
    }),
    null,
    "old overdue tasks alone do not trigger a daily message"
  );
});

test("the nudge and the Friday review promise not to nag", async () => {
  const nudge = await buildOpsDueTodayNudge({
    task: task({ id: "task_today0001", dueAt: kyiv("2026-10-13T15:36:00") }),
    timeZone: "Europe/Kyiv",
    taskUrl: null,
    button: fakeButton,
  });
  assert.match(nudge.text, /Сегодня до 15:36: #1016/);
  assert.match(nudge.text, /напоминать снова не буду/);

  const review = await buildOpsWeeklyReview({
    stale: [task({ id: "task_stale00001", dueAt: kyiv("2026-07-29T18:00:00") })],
    staleTotal: 10,
    unassigned: [task({ id: "task_unassigned1", number: 1022 })],
    unassignedTotal: 1,
    timeZone: "Europe/Kyiv",
    now: kyiv("2026-10-16T10:00:00"),
    tasksUrl: "https://onecompany.global/admin/operations/tasks",
    button: fakeButton,
  });
  assert.ok(review);
  assert.match(review.text, /срок прошёл 29 июл/);
  assert.match(review.text, /И ещё 9 — в админке/);
  const actions = review.replyMarkup!.inline_keyboard.flatMap((row) =>
    row.flatMap((button) => ("callback_data" in button ? [button.callback_data.split(":")[0]] : []))
  );
  assert.deepEqual(actions, ["done", "cancel_task", "snooze_week", "take", "cancel_task"]);
});

const memberRoles = [
  { role: { key: "task_member", permissions: ["ops.tasks.read", "ops.tasks.write"] } },
];

function callbackClient(
  taskState: Record<string, unknown>,
  actorRoles: Array<{ role: { key: string; permissions: string[] } }> = memberRoles
) {
  let record:
    | {
        id: string;
        requestHash: string;
        responseBody: unknown;
        statusCode: number;
        expiresAt: Date;
      }
    | undefined;
  const writes: Array<{ kind: string; data: Record<string, unknown> }> = [];
  const adminUser = {
    async findFirst({ where }: { where: { id: string } }) {
      if (where.id === "admin_12345678") {
        return { id: where.id, email: "member@example.com", name: "Member", roles: actorRoles };
      }
      if (where.id === "igor_12345678") {
        return { id: where.id, email: "igor@example.com", name: "Igor Semynozhenko" };
      }
      return null;
    },
  };
  const tx = {
    adminUser,
    opsMemberProfile: {
      async findMany() {
        return [
          {
            adminUserId: "igor_12345678",
            telegramUserId: BigInt(77),
            timezone: "Europe/Kyiv",
            updatedAt: new Date("2026-07-22T10:00:00.000Z"),
          },
        ];
      },
      async findUnique() {
        return { timezone: "Europe/Kyiv" };
      },
    },
    opsJob: {
      async findMany() {
        return [];
      },
      async createMany({ data }: { data: Array<Record<string, unknown>> }) {
        for (const job of data) writes.push({ kind: "job", data: job });
        return { count: data.length };
      },
    },
    opsTask: {
      async findUnique() {
        return taskState;
      },
      async updateMany({ data }: { data: Record<string, unknown> }) {
        writes.push({ kind: "task", data });
        return { count: 1 };
      },
    },
    opsTaskAssignee: {
      async create({ data }: { data: Record<string, unknown> }) {
        writes.push({ kind: "assignee", data });
        return data;
      },
    },
    opsTaskEvent: {
      async create({ data }: { data: Record<string, unknown> }) {
        writes.push({ kind: "event", data });
        return data;
      },
    },
    adminAuditLog: {
      async create({ data }: { data: Record<string, unknown> }) {
        writes.push({ kind: "audit", data });
        return data;
      },
    },
  };
  const client = {
    ...tx,
    async $transaction<T>(run: (inner: typeof tx) => Promise<T>) {
      return run(tx);
    },
    opsIdempotencyRecord: {
      async create({ data }: { data: NonNullable<typeof record> }) {
        record = { ...data, id: "callback-state-1" };
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
  } as unknown as PrismaClient;
  return { client, writes };
}

async function pressButton(
  action: "snooze_tomorrow" | "snooze_week" | "cancel_task" | "take" | "assign_to",
  taskState: Record<string, unknown>,
  options: { value?: string; actorRoles?: Parameters<typeof callbackClient>[1] } = {}
) {
  const { createOpsTelegramCallbackState, executeOpsTelegramCallback } = await callbacksModule;
  const { client, writes } = callbackClient(taskState, options.actorRoles);
  const previousSecret = process.env.OPS_TELEGRAM_CALLBACK_SECRET;
  process.env.OPS_TELEGRAM_CALLBACK_SECRET = "test-callback-secret-0123456789";
  try {
    const callbackData = await createOpsTelegramCallbackState({
      client,
      action,
      resourceId: "task_12345678",
      actorAdminUserId: "admin_12345678",
      value: options.value,
    });
    assert.ok(callbackData);
    const result = await executeOpsTelegramCallback({
      client,
      actorAdminUserId: "admin_12345678",
      callbackData,
    });
    return { result, writes };
  } finally {
    if (previousSecret === undefined) delete process.env.OPS_TELEGRAM_CALLBACK_SECRET;
    else process.env.OPS_TELEGRAM_CALLBACK_SECRET = previousSecret;
  }
}

const openTask = {
  id: "task_12345678",
  number: 1016,
  status: "INBOX",
  version: 3,
  dueAt: new Date("2026-07-29T15:00:00.000Z"),
  assigneeId: "admin_12345678",
  assignees: [{ adminUserId: "admin_12345678" }],
  createdById: "admin_12345678",
  isShared: false,
};

test("«⏰ Завтра» moves the deadline and records who did it", async () => {
  const { result, writes } = await pressButton("snooze_tomorrow", openTask);
  assert.match(result.message, /#1016: новый срок/);
  const update = writes.find((write) => write.kind === "task")!.data;
  assert.ok(update.dueAt instanceof Date);
  assert.equal(opsLocalClock(update.dueAt as Date).hour, 18);
  assert.ok(writes.some((write) => write.kind === "event"));
  assert.ok(writes.some((write) => write.kind === "audit"));
});

test("«🗑 не нужно» cancels an open task, never a closed one", async () => {
  const cancelled = await pressButton("cancel_task", openTask);
  assert.match(cancelled.result.message, /закрыта как неактуальная/);
  assert.equal(cancelled.writes.find((write) => write.kind === "task")!.data.status, "CANCELLED");

  const closed = await pressButton("cancel_task", { ...openTask, status: "DONE" });
  assert.match(closed.result.message, /уже закрыта/);
  assert.equal(closed.writes.length, 0);
});

test("«🙋 беру» assigns an unassigned task to the person who pressed it", async () => {
  const taken = await pressButton("take", {
    ...openTask,
    assigneeId: null,
    assignees: [],
  });
  assert.match(taken.result.message, /теперь ваша/);
  assert.equal(
    taken.writes.find((write) => write.kind === "task")!.data.assigneeId,
    "admin_12345678"
  );
  assert.ok(taken.writes.some((write) => write.kind === "assignee"));

  const already = await pressButton("take", {
    ...openTask,
    assigneeId: "someone_else01",
    assignees: [{ adminUserId: "someone_else01" }],
  });
  assert.match(already.result.message, /уже взял кто-то другой/);
  assert.equal(already.writes.length, 0);
});

test("«👤 Igor» assigns the task to that teammate and queues their notice", async () => {
  const unassigned = {
    ...openTask,
    externalId: "TSK-1016",
    title: "Задача",
    assigneeId: null,
    assignees: [],
  };
  const owner = [{ role: { key: "owner", permissions: [] } }];
  const assigned = await pressButton("assign_to", unassigned, {
    value: "igor_12345678",
    actorRoles: owner,
  });
  assert.match(assigned.result.message, /поручена: Igor Semynozhenko/);
  assert.equal(
    assigned.writes.find((write) => write.kind === "task")!.data.assigneeId,
    "igor_12345678"
  );
  const notice = assigned.writes.find((write) => write.kind === "job")!.data;
  assert.equal(notice.type, "telegram_task_assigned");
  assert.ok(notice.availableAt instanceof Date, "assignment notices respect quiet hours");

  await assert.rejects(
    () => pressButton("assign_to", unassigned, { value: "igor_12345678" }),
    /TELEGRAM_ACTION_FORBIDDEN/,
    "a regular member cannot hand tasks to others"
  );
});

test("a new unassigned task offers «🙋 Мне» and teammates who can take tasks", async () => {
  const { buildOpsAssigneeChoiceRows } = await jobsModule;
  const previousSecret = process.env.OPS_TELEGRAM_CALLBACK_SECRET;
  process.env.OPS_TELEGRAM_CALLBACK_SECRET = "test-callback-secret-0123456789";
  const reader = [{ role: { key: "task_member", permissions: ["ops.tasks.read"] } }];
  const client = (actorRoles: typeof reader, assigneeId: string | null = null) =>
    ({
      opsTask: {
        async findUnique() {
          return { assigneeId, isShared: false, _count: { assignees: assigneeId ? 1 : 0 } };
        },
      },
      adminUser: {
        async findFirst() {
          return { roles: actorRoles };
        },
      },
      opsMemberProfile: {
        async findMany() {
          return [
            {
              adminUserId: "igor_12345678",
              adminUser: { name: "Igor Semynozhenko", email: "i@x", roles: reader },
            },
            { adminUserId: "guest_1234567", adminUser: { name: "Guest", email: "g@x", roles: [] } },
          ];
        },
      },
      opsIdempotencyRecord: {
        async create() {
          return {};
        },
      },
    }) as unknown as PrismaClient;
  try {
    const ownerRows = await buildOpsAssigneeChoiceRows({
      client: client([{ role: { key: "owner", permissions: [] } }]),
      taskId: "task_12345678",
      actorAdminUserId: "admin_12345678",
    });
    assert.deepEqual(
      ownerRows.flat().map((button) => button.text),
      ["🙋 Мне", "👤 Igor"],
      "teammates without task access are not offered"
    );

    const writer = [
      { role: { key: "task_member", permissions: ["ops.tasks.read", "ops.tasks.write"] } },
    ];
    const memberRows = await buildOpsAssigneeChoiceRows({
      client: client(writer),
      taskId: "task_12345678",
      actorAdminUserId: "admin_12345678",
    });
    assert.deepEqual(
      memberRows.flat().map((button) => button.text),
      ["🙋 Мне"]
    );

    const readerRows = await buildOpsAssigneeChoiceRows({
      client: client(reader),
      taskId: "task_12345678",
      actorAdminUserId: "admin_12345678",
    });
    assert.deepEqual(readerRows, [], "read-only members get no buttons they cannot use");

    const assignedRows = await buildOpsAssigneeChoiceRows({
      client: client(reader, "igor_12345678"),
      taskId: "task_12345678",
      actorAdminUserId: "admin_12345678",
    });
    assert.deepEqual(assignedRows, [], "nothing to ask when the task already has an owner");
  } finally {
    if (previousSecret === undefined) delete process.env.OPS_TELEGRAM_CALLBACK_SECRET;
    else process.env.OPS_TELEGRAM_CALLBACK_SECRET = previousSecret;
  }
});
