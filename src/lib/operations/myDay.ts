import type { OpsPriority, OpsTaskStatus, PrismaClient } from "@prisma/client";

import { opsRepeatRuleFromTags, type OpsRepeatRule } from "@/lib/operations/recurrence";
import {
  OPS_OPEN_TASK_WHERE,
  OPS_UNASSIGNED_TASK_WHERE,
  opsAssignedTo,
  opsLocalClock,
  opsLocalDayBounds,
} from "@/lib/operations/reminders";

export type OpsMyDayTask = {
  id: string;
  number: number;
  title: string;
  status: OpsTaskStatus;
  priority: OpsPriority;
  dueAt: Date | null;
  nextAction: string | null;
  orderNumber: string | null;
  repeat: OpsRepeatRule | null;
  assigneeNames: string[];
};

export type OpsMyDay = {
  overdue: OpsMyDayTask[];
  today: OpsMyDayTask[];
  upcoming: OpsMyDayTask[];
  noDue: OpsMyDayTask[];
  unassigned: OpsMyDayTask[];
  counts: { overdue: number; today: number; open: number; unassigned: number };
};

const TASK_SELECT = {
  id: true,
  number: true,
  title: true,
  status: true,
  priority: true,
  dueAt: true,
  nextAction: true,
  tags: true,
  shopOrder: { select: { orderNumber: true } },
  assignee: { select: { name: true, email: true } },
  assignees: { select: { adminUser: { select: { name: true, email: true } } } },
} as const;

type TaskRow = {
  id: string;
  number: number;
  title: string;
  status: OpsTaskStatus;
  priority: OpsPriority;
  dueAt: Date | null;
  nextAction: string | null;
  tags: string[];
  shopOrder: { orderNumber: string } | null;
  assignee: { name: string | null; email: string } | null;
  assignees: Array<{ adminUser: { name: string | null; email: string } }>;
};

function personName(person: { name: string | null; email: string }) {
  return person.name?.trim().split(/\s+/)[0] || person.email.split("@")[0];
}

function toMyDayTask(row: TaskRow): OpsMyDayTask {
  const names = new Set(row.assignees.map(({ adminUser }) => personName(adminUser)));
  if (row.assignee) names.add(personName(row.assignee));
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    status: row.status,
    priority: row.priority,
    dueAt: row.dueAt,
    nextAction: row.nextAction,
    orderNumber: row.shopOrder?.orderNumber ?? null,
    repeat: opsRepeatRuleFromTags(row.tags),
    assigneeNames: Array.from(names),
  };
}

/** One person's open tasks grouped the way «Мой день» and the bot show them. */
export async function loadOpsMyDay(input: {
  client: Pick<PrismaClient, "opsTask">;
  adminUserId: string;
  canAssign: boolean;
  now: Date;
  timeZone?: string;
}): Promise<OpsMyDay> {
  const timeZone = input.timeZone ?? "Europe/Kyiv";
  const today = opsLocalDayBounds(opsLocalClock(input.now, timeZone).date, timeZone);
  const [mine, unassigned, unassignedCount] = await Promise.all([
    input.client.opsTask.findMany({
      where: { ...OPS_OPEN_TASK_WHERE, ...opsAssignedTo(input.adminUserId) },
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      take: 80,
      select: TASK_SELECT,
    }) as Promise<TaskRow[]>,
    input.canAssign
      ? (input.client.opsTask.findMany({
          where: { ...OPS_OPEN_TASK_WHERE, ...OPS_UNASSIGNED_TASK_WHERE },
          orderBy: { createdAt: "asc" },
          take: 10,
          select: TASK_SELECT,
        }) as Promise<TaskRow[]>)
      : Promise.resolve([] as TaskRow[]),
    input.canAssign
      ? input.client.opsTask.count({
          where: { ...OPS_OPEN_TASK_WHERE, ...OPS_UNASSIGNED_TASK_WHERE },
        })
      : Promise.resolve(0),
  ]);
  const tasks = mine.map(toMyDayTask);
  const overdue = tasks.filter((task) => task.dueAt && task.dueAt < today.start);
  const dueToday = tasks.filter(
    (task) => task.dueAt && task.dueAt >= today.start && task.dueAt < today.end
  );
  const upcoming = tasks.filter((task) => task.dueAt && task.dueAt >= today.end);
  const noDue = tasks.filter((task) => !task.dueAt);
  return {
    overdue,
    today: dueToday,
    upcoming,
    noDue,
    unassigned: unassigned.map(toMyDayTask),
    counts: {
      overdue: overdue.length,
      today: dueToday.length,
      open: tasks.length,
      unassigned: unassignedCount,
    },
  };
}
