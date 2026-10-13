import {
  OpsJobStage,
  OpsJobStatus,
  OpsTaskSourceType,
  OpsTaskStatus,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";

import { OWNER_ROLE_KEY, SUPERADMIN_ROLE_KEY } from "@/lib/admin/adminPermissions";
import type { OpsNotificationRoleGrant } from "@/lib/operations/notificationAccess";
import type {
  OpsTelegramInlineButton,
  OpsTelegramReplyMarkup,
} from "@/lib/operations/notifications";
import {
  isWithinOpsNotifyWindow,
  OPS_OPEN_TASK_WHERE,
  OPS_UNASSIGNED_TASK_WHERE,
  opsLocalClock,
  type OpsReminderMember,
} from "@/lib/operations/reminders";
import { OPS_SHOP_TASK_SOURCE_PREFIX } from "@/lib/operations/shopOrderTasks";

/**
 * Owner-only messages, at most one of each:
 * - Monday 10:00 — how the week went;
 * - once a day — background jobs that failed and need a look in «Система».
 * They go to owners who actually run the admin (signed in within 30 days),
 * not to every account that happens to have the owner role.
 */
export const OPS_WEEKLY_SUMMARY_SCHEDULE = { weekday: 1, hour: 10 } as const;
export const OPS_OWNER_REPORT_ACTIVE_MS = 30 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export function opsRolesAreOwner(roles: readonly OpsNotificationRoleGrant[]) {
  return roles.some(({ role }) => role.key === OWNER_ROLE_KEY || role.key === SUPERADMIN_ROLE_KEY);
}

export function opsGetsOwnerReports(input: {
  roles: readonly OpsNotificationRoleGrant[];
  lastLoginAt: Date | null;
  now: Date;
}) {
  return (
    opsRolesAreOwner(input.roles) &&
    Boolean(input.lastLoginAt) &&
    input.now.getTime() - input.lastLoginAt!.getTime() <= OPS_OWNER_REPORT_ACTIVE_MS
  );
}

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function enqueueOpsOwnerReports(input: {
  client: PrismaClient;
  now: Date;
  member: OpsReminderMember;
  lastLoginAt: Date | null;
}) {
  const { client, now, member } = input;
  const result = { summaries: 0, alerts: 0 };
  if (
    !opsGetsOwnerReports({ roles: member.roles, lastLoginAt: input.lastLoginAt, now }) ||
    !isWithinOpsNotifyWindow(now, member.timezone)
  ) {
    return result;
  }
  const clock = opsLocalClock(now, member.timezone);
  const base = {
    recipientAdminUserId: member.adminUserId,
    telegramUserId: member.telegramUserId.toString(),
  };
  if (
    clock.weekday === OPS_WEEKLY_SUMMARY_SCHEDULE.weekday &&
    clock.hour === OPS_WEEKLY_SUMMARY_SCHEDULE.hour
  ) {
    const created = await client.opsJob.createMany({
      data: [
        {
          idempotencyKey: `summary:weekly:${member.adminUserId}:${clock.date}`,
          type: "telegram_internal_report",
          status: OpsJobStatus.QUEUED,
          stage: OpsJobStage.NOTIFY,
          payload: asJson({ ...base, reportPeriod: "weekly_summary", reportDate: clock.date }),
        },
      ],
      skipDuplicates: true,
    });
    result.summaries += created.count;
  }

  const lastAlert = await client.opsJob.findFirst({
    where: { idempotencyKey: { startsWith: `alert:system:${member.adminUserId}:` } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const since = new Date(Math.max(now.getTime() - DAY_MS, lastAlert?.createdAt.getTime() ?? 0));
  const failures = await client.opsJob.count({
    where: { status: OpsJobStatus.DEAD_LETTER, updatedAt: { gt: since } },
  });
  if (failures > 0) {
    const created = await client.opsJob.createMany({
      data: [
        {
          idempotencyKey: `alert:system:${member.adminUserId}:${clock.date}`,
          type: "telegram_internal_report",
          status: OpsJobStatus.QUEUED,
          stage: OpsJobStage.NOTIFY,
          payload: asJson({ ...base, reportPeriod: "system_alert", since: since.toISOString() }),
        },
      ],
      skipDuplicates: true,
    });
    result.alerts += created.count;
  }
  return result;
}

function firstName(person: { name: string | null; email: string }) {
  return person.name?.trim().split(/\s+/)[0] || person.email.split("@")[0];
}

function russianCount(count: number, one: string, few: string, many: string) {
  const lastTwo = Math.abs(count) % 100;
  const last = lastTwo % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

export async function buildOpsWeeklySummary(input: {
  client: Pick<PrismaClient, "opsTask">;
  now: Date;
  timeZone: string;
  triageUrl: string | null;
  miniAppUrl: string | null;
}): Promise<{ text: string; replyMarkup?: OpsTelegramReplyMarkup } | null> {
  const weekAgo = new Date(input.now.getTime() - WEEK_MS);
  const [closed, created, overdue, unassigned, stuck] = await Promise.all([
    input.client.opsTask.findMany({
      where: { status: OpsTaskStatus.DONE, completedAt: { gte: weekAgo, lt: input.now } },
      take: 500,
      select: {
        assignee: { select: { name: true, email: true } },
        assignees: { select: { adminUser: { select: { name: true, email: true } } } },
      },
    }),
    input.client.opsTask.findMany({
      where: { createdAt: { gte: weekAgo, lt: input.now } },
      take: 500,
      select: { sourceType: true, sourceKey: true },
    }),
    input.client.opsTask.count({ where: { ...OPS_OPEN_TASK_WHERE, dueAt: { lt: input.now } } }),
    input.client.opsTask.count({ where: { ...OPS_OPEN_TASK_WHERE, ...OPS_UNASSIGNED_TASK_WHERE } }),
    input.client.opsTask.count({ where: { ...OPS_OPEN_TASK_WHERE, updatedAt: { lt: weekAgo } } }),
  ]);
  if (!closed.length && !created.length && !overdue && !unassigned) return null;
  const byPerson = new Map<string, number>();
  for (const task of closed) {
    const names = new Set(task.assignees.map(({ adminUser }) => firstName(adminUser)));
    if (task.assignee) names.add(firstName(task.assignee));
    for (const name of names.size ? names : new Set(["без исполнителя"])) {
      byPerson.set(name, (byPerson.get(name) ?? 0) + 1);
    }
  }
  const people = Array.from(byPerson.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([name, count]) => `${name} ${count}`)
    .join(", ");
  const fromTelegram = created.filter(
    (task) => task.sourceType === OpsTaskSourceType.TELEGRAM
  ).length;
  const fromShop = created.filter((task) =>
    task.sourceKey?.startsWith(OPS_SHOP_TASK_SOURCE_PREFIX)
  ).length;
  const fromRepeat = created.filter((task) => task.sourceKey?.startsWith("repeat:")).length;
  const fromAdmin = created.length - fromTelegram - fromShop - fromRepeat;
  const sources = [
    fromTelegram ? `из Telegram ${fromTelegram}` : null,
    fromShop ? `из магазина ${fromShop}` : null,
    fromRepeat ? `повторы ${fromRepeat}` : null,
    fromAdmin > 0 ? `в админке ${fromAdmin}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const day = (date: Date) =>
    new Intl.DateTimeFormat("ru-RU", {
      timeZone: input.timeZone,
      day: "numeric",
      month: "short",
    }).format(date);
  const text = [
    `📊 Итоги недели (${day(weekAgo)} – ${day(new Date(input.now.getTime() - DAY_MS))})`,
    "",
    `✅ Закрыто: ${closed.length}${people ? ` — ${people}` : ""}`,
    `🆕 Новых: ${created.length}${sources ? ` (${sources})` : ""}`,
    `⚠️ Просрочено сейчас: ${overdue}`,
    `👤 Без исполнителя: ${unassigned}`,
    `🧊 Без движения больше недели: ${stuck}`,
    "",
    overdue || stuck
      ? "Зависшие удобно разобрать по одной карточке — кнопка ниже."
      : "Хорошая неделя — хвостов нет. 👌",
  ].join("\n");
  const rows: OpsTelegramInlineButton[][] = [];
  if (input.triageUrl && (overdue || stuck || unassigned)) {
    rows.push([{ text: `🗂 Разобрать (${overdue + unassigned})`, url: input.triageUrl }]);
  }
  if (input.miniAppUrl) rows.push([{ text: "📱 Мой день", web_app: { url: input.miniAppUrl } }]);
  return { text, ...(rows.length ? { replyMarkup: { inline_keyboard: rows } } : {}) };
}

const JOB_LABELS: Record<string, string> = {
  telegram_intake: "Разбор сообщения",
  telegram_batch: "Разбор подборки",
  telegram_task_assigned: "Уведомление о задаче",
  telegram_task_reminder: "Напоминание",
  telegram_internal_report: "Сводка",
};

const STAGE_LABELS: Partial<Record<OpsJobStage, string>> = {
  DOWNLOAD_MEDIA: "Загрузка файла",
  TRANSCRIBE: "Расшифровка",
  EXTRACT: "Разбор текста",
  NOTIFY: "Отправка в Telegram",
};

export async function buildOpsSystemAlert(input: {
  client: Pick<PrismaClient, "opsJob">;
  since: Date;
  systemUrl: string | null;
}): Promise<{ text: string; replyMarkup?: OpsTelegramReplyMarkup } | null> {
  const failed = await input.client.opsJob.findMany({
    where: { status: OpsJobStatus.DEAD_LETTER, updatedAt: { gt: input.since } },
    take: 50,
    select: { type: true, stage: true },
  });
  if (!failed.length) return null;
  const groups = new Map<string, number>();
  for (const job of failed) {
    const label = STAGE_LABELS[job.stage] ?? JOB_LABELS[job.type] ?? "Фоновая задача";
    groups.set(label, (groups.get(label) ?? 0) + 1);
  }
  const text = [
    `⚠️ Бот: ${failed.length} ${russianCount(failed.length, "сбой", "сбоя", "сбоев")} за последние сутки`,
    ...Array.from(groups.entries()).map(([label, count]) => `• ${label} — ${count}`),
    "",
    "Сообщения не потеряны: их можно повторить или закрыть в «Работа → Система».",
    "Следующий такой отчёт — не раньше чем через сутки.",
  ].join("\n");
  return {
    text,
    ...(input.systemUrl
      ? {
          replyMarkup: {
            inline_keyboard: [[{ text: "🛠 Открыть «Система»", url: input.systemUrl }]],
          },
        }
      : {}),
  };
}
