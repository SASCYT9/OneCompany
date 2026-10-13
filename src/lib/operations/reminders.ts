import {
  OpsJobStage,
  OpsJobStatus,
  OpsTaskStatus,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";

import {
  ADMIN_PERMISSIONS,
  matchesAdminPermission,
  OWNER_ROLE_KEY,
  SUPERADMIN_ROLE_KEY,
} from "@/lib/admin/adminPermissions";
import type { OpsNotificationRoleGrant } from "@/lib/operations/notificationAccess";
import type {
  OpsTelegramInlineButton,
  OpsTelegramReplyMarkup,
} from "@/lib/operations/notifications";

/**
 * Gentle Telegram reminders (owner decision 2026-10-13):
 * - one morning digest, only when something is due today or went overdue yesterday;
 * - one nudge two hours before a same-day deadline (the digest covers morning ones);
 * - a Friday review of tasks that have been stuck for days, then no daily repeats;
 * - the bot starts conversations only between 09:00 and 21:00 local time.
 */
export const OPS_NOTIFY_WINDOW = { startHour: 9, endHour: 21 } as const;
export const OPS_DIGEST_HOUR = 9;
export const OPS_REVIEW_SCHEDULE = { weekday: 5, hour: 10 } as const;
export const OPS_DUE_NUDGE_LEAD_MS = 2 * 60 * 60 * 1000;
/** Deadlines before noon are already in the 09:00 digest; no extra nudge. */
export const OPS_DUE_NUDGE_FROM_HOUR = 12;
export const OPS_DUE_NUDGE_LATEST_HOUR = 19;
export const OPS_SNOOZE_HOUR = 18;
export const OPS_STALE_TASK_DAYS = 7;
const DIGEST_TASK_LIMIT = 6;
const REVIEW_TASK_LIMIT = 8;
const REVIEW_UNASSIGNED_LIMIT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export const OPS_OPEN_TASK_STATUSES = Object.values(OpsTaskStatus).filter(
  (status) => status !== OpsTaskStatus.DONE && status !== OpsTaskStatus.CANCELLED
);

export type OpsLocalClock = {
  date: string;
  hour: number;
  minute: number;
  /** ISO weekday: 1 = Monday … 7 = Sunday. */
  weekday: number;
};

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function opsLocalClock(now: Date, timeZone = "Europe/Kyiv"): OpsLocalClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${value.year}-${value.month}-${value.day}`,
    hour: Number(value.hour),
    minute: Number(value.minute),
    weekday: WEEKDAYS[value.weekday] ?? 1,
  };
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const representedAsUtc = Date.UTC(
    Number(value.year),
    Number(value.month) - 1,
    Number(value.day),
    Number(value.hour),
    Number(value.minute),
    Number(value.second)
  );
  return representedAsUtc - date.getTime();
}

/** The instant of `hour`:00 on the local calendar date `date` (YYYY-MM-DD). */
export function opsLocalTime(date: string, hour: number, timeZone = "Europe/Kyiv") {
  const [year, month, day] = date.split("-").map(Number);
  const asUtc = Date.UTC(year, month - 1, day, hour);
  return new Date(asUtc - timeZoneOffsetMs(new Date(asUtc), timeZone));
}

export function addOpsLocalDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function opsLocalDayBounds(date: string, timeZone = "Europe/Kyiv") {
  return {
    start: opsLocalTime(date, 0, timeZone),
    end: opsLocalTime(addOpsLocalDays(date, 1), 0, timeZone),
  };
}

export function isWithinOpsNotifyWindow(now: Date, timeZone = "Europe/Kyiv") {
  const { hour } = opsLocalClock(now, timeZone);
  return hour >= OPS_NOTIFY_WINDOW.startHour && hour < OPS_NOTIFY_WINDOW.endHour;
}

/** Now, if the bot may write; otherwise the next 09:00 local. */
export function nextOpsNotifyTime(now: Date, timeZone = "Europe/Kyiv") {
  if (isWithinOpsNotifyWindow(now, timeZone)) return now;
  const clock = opsLocalClock(now, timeZone);
  const date =
    clock.hour < OPS_NOTIFY_WINDOW.startHour ? clock.date : addOpsLocalDays(clock.date, 1);
  return opsLocalTime(date, OPS_NOTIFY_WINDOW.startHour, timeZone);
}

/** When to nudge about a deadline later today, or null when the digest covers it. */
export function opsDueNudgeAt(dueAt: Date, timeZone = "Europe/Kyiv") {
  const due = opsLocalClock(dueAt, timeZone);
  if (due.hour < OPS_DUE_NUDGE_FROM_HOUR) return null;
  const latest = opsLocalTime(due.date, OPS_DUE_NUDGE_LATEST_HOUR, timeZone);
  const nudge = new Date(dueAt.getTime() - OPS_DUE_NUDGE_LEAD_MS);
  return nudge < latest ? nudge : latest;
}

export type OpsSnoozeKind = "tomorrow" | "week";

/** «⏰ Завтра» → tomorrow 18:00, «📅 +неделя» → in seven days 18:00, local time. */
export function opsSnoozeDueAt(kind: OpsSnoozeKind, now: Date, timeZone = "Europe/Kyiv") {
  const { date } = opsLocalClock(now, timeZone);
  return opsLocalTime(
    addOpsLocalDays(date, kind === "tomorrow" ? 1 : 7),
    OPS_SNOOZE_HOUR,
    timeZone
  );
}

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function opsAssignedTo(adminUserId: string): Prisma.OpsTaskWhereInput {
  return {
    OR: [
      { assignees: { some: { adminUserId } } },
      // Compatibility for tasks created before the participant migration.
      { assigneeId: adminUserId },
    ],
  };
}

const OPEN_TASK_WHERE = {
  archivedAt: null,
  status: { in: OPS_OPEN_TASK_STATUSES },
} satisfies Prisma.OpsTaskWhereInput;

function opsRolesGrant(roles: readonly OpsNotificationRoleGrant[], permission: string) {
  const keys = roles.map(({ role }) => role.key);
  return (
    keys.includes(OWNER_ROLE_KEY) ||
    keys.includes(SUPERADMIN_ROLE_KEY) ||
    matchesAdminPermission(
      roles.flatMap(({ role }) => role.permissions),
      permission
    )
  );
}

export function opsRolesCanAssign(roles: readonly OpsNotificationRoleGrant[]) {
  return opsRolesGrant(roles, ADMIN_PERMISSIONS.OPS_TASKS_ASSIGN);
}

export function opsRolesCanWrite(roles: readonly OpsNotificationRoleGrant[]) {
  return opsRolesGrant(roles, ADMIN_PERMISSIONS.OPS_TASKS_WRITE);
}

export type OpsReminderMember = {
  adminUserId: string;
  telegramUserId: bigint;
  timezone: string;
  roles: readonly OpsNotificationRoleGrant[];
};

/**
 * Queues the member's digest, deadline nudges and Friday review. Idempotency
 * keys make the 15-minute cron safe: each message is created once per day.
 */
export async function enqueueOpsMemberReminders(input: {
  client: PrismaClient;
  now: Date;
  member: OpsReminderMember;
}) {
  const { client, now, member } = input;
  const result = { digests: 0, nudges: 0, reviews: 0 };
  if (!isWithinOpsNotifyWindow(now, member.timezone)) return result;
  const clock = opsLocalClock(now, member.timezone);
  const today = opsLocalDayBounds(clock.date, member.timezone);
  const yesterday = opsLocalDayBounds(addOpsLocalDays(clock.date, -1), member.timezone);
  const mine = { ...OPEN_TASK_WHERE, ...opsAssignedTo(member.adminUserId) };
  const base = {
    recipientAdminUserId: member.adminUserId,
    telegramUserId: member.telegramUserId.toString(),
  };

  const dueToday = await client.opsTask.findMany({
    where: { ...mine, dueAt: { gte: today.start, lt: today.end } },
    orderBy: { dueAt: "asc" },
    take: 50,
    select: { id: true, externalId: true, title: true, dueAt: true },
  });

  if (clock.hour === OPS_DIGEST_HOUR) {
    const dueYesterday = await client.opsTask.findMany({
      where: { ...mine, dueAt: { gte: yesterday.start, lt: yesterday.end } },
      orderBy: { dueAt: "asc" },
      take: 50,
      select: { id: true },
    });
    if (dueToday.length || dueYesterday.length) {
      const olderOverdueCount = await client.opsTask.count({
        where: { ...mine, dueAt: { lt: yesterday.start } },
      });
      const created = await client.opsJob.createMany({
        data: [
          {
            idempotencyKey: `digest:morning:${member.adminUserId}:${clock.date}`,
            type: "telegram_internal_report",
            status: OpsJobStatus.QUEUED,
            stage: OpsJobStage.NOTIFY,
            payload: asJson({
              ...base,
              reportPeriod: "morning_digest",
              reportDate: clock.date,
              todayTaskIds: dueToday.map((task) => task.id),
              yesterdayTaskIds: dueYesterday.map((task) => task.id),
              olderOverdueCount,
            }),
          },
        ],
        skipDuplicates: true,
      });
      result.digests += created.count;
    }
  }

  const nudgeDue = dueToday.filter((task) => {
    if (!task.dueAt || task.dueAt <= now) return false;
    const nudgeAt = opsDueNudgeAt(task.dueAt, member.timezone);
    return Boolean(nudgeAt && now >= nudgeAt);
  });
  if (nudgeDue.length) {
    const created = await client.opsJob.createMany({
      data: nudgeDue.map((task) => ({
        // The due date is part of the key, so a snoozed task is nudged again.
        idempotencyKey: `reminder:due-today:${task.id}:${member.adminUserId}:${clock.date}`,
        taskId: task.id,
        type: "telegram_task_reminder",
        status: OpsJobStatus.QUEUED,
        stage: OpsJobStage.NOTIFY,
        payload: asJson({
          ...base,
          reminderKind: "due_today",
          taskId: task.id,
          externalId: task.externalId,
          title: task.title,
          dueAt: task.dueAt?.toISOString() ?? null,
        }),
      })),
      skipDuplicates: true,
    });
    result.nudges += created.count;
  }

  if (clock.weekday === OPS_REVIEW_SCHEDULE.weekday && clock.hour === OPS_REVIEW_SCHEDULE.hour) {
    const staleWhere: Prisma.OpsTaskWhereInput = {
      ...mine,
      AND: [
        {
          OR: [
            { dueAt: { lt: yesterday.start } },
            { updatedAt: { lt: new Date(now.getTime() - OPS_STALE_TASK_DAYS * DAY_MS) } },
          ],
        },
      ],
    };
    const [stale, staleTotal] = await Promise.all([
      client.opsTask.findMany({
        where: staleWhere,
        orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
        take: REVIEW_TASK_LIMIT,
        select: { id: true },
      }),
      client.opsTask.count({ where: staleWhere }),
    ]);
    let unassigned: Array<{ id: string }> = [];
    let unassignedTotal = 0;
    if (opsRolesCanAssign(member.roles)) {
      const unassignedWhere: Prisma.OpsTaskWhereInput = {
        ...OPEN_TASK_WHERE,
        ...OPS_UNASSIGNED_TASK_WHERE,
        createdAt: { lt: new Date(now.getTime() - DAY_MS) },
      };
      [unassigned, unassignedTotal] = await Promise.all([
        client.opsTask.findMany({
          where: unassignedWhere,
          orderBy: { createdAt: "asc" },
          take: REVIEW_UNASSIGNED_LIMIT,
          select: { id: true },
        }),
        client.opsTask.count({ where: unassignedWhere }),
      ]);
    }
    if (stale.length || unassigned.length) {
      const created = await client.opsJob.createMany({
        data: [
          {
            idempotencyKey: `review:weekly:${member.adminUserId}:${clock.date}`,
            type: "telegram_internal_report",
            status: OpsJobStatus.QUEUED,
            stage: OpsJobStage.NOTIFY,
            payload: asJson({
              ...base,
              reportPeriod: "weekly_review",
              reportDate: clock.date,
              staleTaskIds: stale.map((task) => task.id),
              staleTotal,
              unassignedTaskIds: unassigned.map((task) => task.id),
              unassignedTotal,
            }),
          },
        ],
        skipDuplicates: true,
      });
      result.reviews += created.count;
    }
  }
  return result;
}

export type OpsReminderTask = {
  id: string;
  number: number;
  externalId: string;
  title: string;
  dueAt: Date | null;
};

/** Re-reads tasks at send time, in the queued order, dropping closed or reassigned ones. */
export async function loadOpsReminderTasks(
  client: Pick<PrismaClient, "opsTask">,
  ids: unknown,
  where: Prisma.OpsTaskWhereInput
): Promise<OpsReminderTask[]> {
  const wanted = (Array.isArray(ids) ? ids : [])
    .map((id) => String(id))
    .filter((id) => /^[a-zA-Z0-9_-]{8,40}$/.test(id))
    .slice(0, 50);
  if (!wanted.length) return [];
  const tasks = await client.opsTask.findMany({
    where: { ...OPEN_TASK_WHERE, ...where, id: { in: wanted } },
    select: { id: true, number: true, externalId: true, title: true, dueAt: true },
  });
  const byId = new Map(tasks.map((task) => [task.id, task]));
  return wanted.flatMap((id) => {
    const task = byId.get(id);
    return task ? [task] : [];
  });
}

export const OPS_UNASSIGNED_TASK_WHERE = {
  isShared: false,
  assigneeId: null,
  assignees: { none: {} },
} satisfies Prisma.OpsTaskWhereInput;

/** Creates one single-use callback button, or null when callbacks are not configured. */
export type OpsReminderButtonFactory = (
  action: "done" | "snooze_tomorrow" | "snooze_week" | "cancel_task" | "take",
  taskId: string,
  text: string
) => Promise<OpsTelegramInlineButton | null>;

function shortTitle(task: OpsReminderTask, max = 70) {
  const title = task.title.trim().replace(/\s+/g, " ");
  return `#${task.number} ${title.length > max ? `${title.slice(0, max - 1)}…` : title}`;
}

function localTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function localDay(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("ru-RU", { timeZone, day: "numeric", month: "short" }).format(
    date
  );
}

async function buttonRow(
  button: OpsReminderButtonFactory,
  specs: Array<Parameters<OpsReminderButtonFactory>>
) {
  const row: OpsTelegramInlineButton[] = [];
  for (const spec of specs) {
    const created = await button(...spec);
    if (created) row.push(created);
  }
  return row;
}

function withLink(rows: OpsTelegramInlineButton[][], text: string, url: string | null) {
  return url ? [...rows, [{ text, url } satisfies OpsTelegramInlineButton]] : rows;
}

export async function buildOpsMorningDigest(input: {
  today: OpsReminderTask[];
  yesterday: OpsReminderTask[];
  olderOverdueCount: number;
  timeZone: string;
  now: Date;
  tasksUrl: string | null;
  button: OpsReminderButtonFactory;
}): Promise<{ text: string; replyMarkup?: OpsTelegramReplyMarkup } | null> {
  const listed = [...input.yesterday, ...input.today].slice(0, DIGEST_TASK_LIMIT);
  if (!listed.length) return null;
  const numberOf = new Map(listed.map((task, index) => [task.id, index + 1]));
  const line = (task: OpsReminderTask) => {
    const due = task.dueAt ? localTime(task.dueAt, input.timeZone) : null;
    const note =
      task.dueAt && task.dueAt < input.now ? `срок был в ${due}` : due ? `до ${due}` : "";
    return `${numberOf.get(task.id)}. ${shortTitle(task)}${note ? ` — ${note}` : ""}`;
  };
  const yesterday = input.yesterday.filter((task) => numberOf.has(task.id));
  const today = input.today.filter((task) => numberOf.has(task.id));
  const hidden = input.today.length + input.yesterday.length - listed.length;
  const text = [
    "☀️ Доброе утро! Что важно сегодня:",
    yesterday.length ? `\n⚠️ Вчера истёк срок:\n${yesterday.map(line).join("\n")}` : null,
    today.length ? `\n📌 Срок сегодня:\n${today.map(line).join("\n")}` : null,
    hidden > 0 ? `\nИ ещё ${hidden} — в админке.` : null,
    input.olderOverdueCount > 0
      ? `\nЕщё ${input.olderOverdueCount} давно просроченных — разберём в пятницу, сейчас не отвлекаю.`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
  const rows: OpsTelegramInlineButton[][] = [];
  for (const task of listed) {
    const row = await buttonRow(input.button, [
      ["done", task.id, `✅ ${numberOf.get(task.id)}. Готово`],
      ["snooze_tomorrow", task.id, `⏰ ${numberOf.get(task.id)}. Завтра`],
    ]);
    if (row.length) rows.push(row);
  }
  const keyboard = withLink(rows, "📋 Все мои задачи", input.tasksUrl);
  return { text, ...(keyboard.length ? { replyMarkup: { inline_keyboard: keyboard } } : {}) };
}

export async function buildOpsDueTodayNudge(input: {
  task: OpsReminderTask;
  timeZone: string;
  taskUrl: string | null;
  button: OpsReminderButtonFactory;
}) {
  const due = input.task.dueAt ? localTime(input.task.dueAt, input.timeZone) : null;
  const text = [
    `⏰ Сегодня${due ? ` до ${due}` : ""}: ${shortTitle(input.task, 120)}`,
    "Успеваете? Если нет — перенесите, напоминать снова не буду.",
  ].join("\n");
  const row = await buttonRow(input.button, [
    ["done", input.task.id, "✅ Готово"],
    ["snooze_tomorrow", input.task.id, "⏰ На завтра"],
  ]);
  const keyboard = withLink(row.length ? [row] : [], "📋 Открыть задачу", input.taskUrl);
  return { text, ...(keyboard.length ? { replyMarkup: { inline_keyboard: keyboard } } : {}) };
}

export async function buildOpsWeeklyReview(input: {
  stale: OpsReminderTask[];
  staleTotal: number;
  unassigned: OpsReminderTask[];
  unassignedTotal: number;
  timeZone: string;
  now: Date;
  tasksUrl: string | null;
  button: OpsReminderButtonFactory;
}): Promise<{ text: string; replyMarkup?: OpsTelegramReplyMarkup } | null> {
  if (!input.stale.length && !input.unassigned.length) return null;
  const all = [...input.stale, ...input.unassigned];
  const numberOf = new Map(all.map((task, index) => [task.id, index + 1]));
  const line = (task: OpsReminderTask) => {
    const overdueDays =
      task.dueAt && task.dueAt < input.now
        ? Math.floor((input.now.getTime() - task.dueAt.getTime()) / DAY_MS)
        : 0;
    const note =
      overdueDays >= 1
        ? `срок прошёл ${localDay(task.dueAt!, input.timeZone)}`
        : "давно без движения";
    return `${numberOf.get(task.id)}. ${shortTitle(task)} — ${note}`;
  };
  const moreStale = input.staleTotal - input.stale.length;
  const moreUnassigned = input.unassignedTotal - input.unassigned.length;
  const text = [
    "🗂 Пятничный разбор. Эти задачи зависли — ещё актуальны?",
    input.stale.length ? `\nВаши:\n${input.stale.map(line).join("\n")}` : null,
    moreStale > 0 ? `И ещё ${moreStale} — в админке.` : null,
    input.unassigned.length ? `\nБез исполнителя:\n${input.unassigned.map(line).join("\n")}` : null,
    moreUnassigned > 0 ? `И ещё ${moreUnassigned} без исполнителя — в админке.` : null,
    "\nОтметьте кнопками: сделано, не нужно или перенести на неделю.",
  ]
    .filter(Boolean)
    .join("\n");
  const rows: OpsTelegramInlineButton[][] = [];
  for (const task of input.stale) {
    const n = numberOf.get(task.id);
    const row = await buttonRow(input.button, [
      ["done", task.id, `✅ ${n}`],
      ["cancel_task", task.id, `🗑 ${n} не нужно`],
      ["snooze_week", task.id, `📅 ${n} +неделя`],
    ]);
    if (row.length) rows.push(row);
  }
  for (const task of input.unassigned) {
    const n = numberOf.get(task.id);
    const row = await buttonRow(input.button, [
      ["take", task.id, `🙋 ${n} беру`],
      ["cancel_task", task.id, `🗑 ${n} не нужно`],
    ]);
    if (row.length) rows.push(row);
  }
  const keyboard = withLink(rows, "📋 Разобрать в админке", input.tasksUrl);
  return { text, ...(keyboard.length ? { replyMarkup: { inline_keyboard: keyboard } } : {}) };
}
