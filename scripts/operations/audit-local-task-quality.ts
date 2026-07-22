import { prisma } from "../../src/lib/prisma";

const CLOSED = new Set(["DONE", "CANCELLED"]);
const WAITING = new Set(["WAITING_HUMAN", "WAITING_EXTERNAL", "BLOCKED"]);

function redact(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu, "[email]")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/gu, "[phone]")
    .trim();
}

async function main() {
  const tasks = await prisma.opsTask.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      assignee: { select: { name: true, email: true } },
      attachments: { select: { attachmentId: true } },
    },
  });
  const active = tasks.filter((task) => !CLOSED.has(task.status));
  const titleCounts = new Map<string, number>();
  for (const task of tasks) {
    const key = task.title.trim().toLocaleLowerCase("ru-RU");
    titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
  }
  const rows = tasks.map((task) => {
    const problems = [];
    if (!task.assigneeId) problems.push("unassigned");
    if (task.title.length > 120) problems.push("title_too_long");
    if ((titleCounts.get(task.title.trim().toLocaleLowerCase("ru-RU")) ?? 0) > 1) {
      problems.push("duplicate_title");
    }
    if (!CLOSED.has(task.status)) {
      if (WAITING.has(task.status)) {
        if (!task.blockerDescription?.trim()) problems.push("missing_blocker");
      } else if (!task.nextAction?.trim()) {
        problems.push("missing_next_action");
      }
    }
    if (!task.description?.trim()) problems.push("missing_description");
    return {
      id: task.id,
      title: redact(task.title).slice(0, 180),
      status: task.status,
      assignee: task.assignee?.name ?? task.assignee?.email ?? null,
      nextAction: redact(task.nextAction).slice(0, 160) || null,
      problems,
    };
  });

  console.log(
    JSON.stringify(
      {
        totals: {
          all: tasks.length,
          active: active.length,
          assigned: tasks.filter((task) => task.assigneeId).length,
          withDescription: tasks.filter((task) => task.description?.trim()).length,
          fromTelegram: tasks.filter((task) => task.sourceType === "TELEGRAM").length,
          withSourceId: tasks.filter((task) => task.sourceId).length,
          withAttachments: tasks.filter((task) => task.attachments.length > 0).length,
          attachmentLinks: tasks.reduce((sum, task) => sum + task.attachments.length, 0),
          problematic: rows.filter((row) => row.problems.length).length,
        },
        problemCounts: rows
          .flatMap((row) => row.problems)
          .reduce<Record<string, number>>((result, problem) => {
            result[problem] = (result[problem] ?? 0) + 1;
            return result;
          }, {}),
        problemTasks: rows
          .filter((row) => row.problems.length)
          .map((row) => ({
            id: row.id,
            title: row.title.slice(0, 100),
            status: row.status,
            assignee: row.assignee,
            problems: row.problems,
          })),
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Task quality audit failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
