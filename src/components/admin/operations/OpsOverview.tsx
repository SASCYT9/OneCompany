"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  CircleUserRound,
  Clock3,
  FolderKanban,
  Inbox,
  ListTodo,
  Loader2,
  MessageSquareText,
  UserRoundPlus,
} from "lucide-react";

import { OPS_STATUS_LABELS, opsRu } from "@/lib/operations/i18n";
import { cn } from "@/lib/utils";

import { OpsPageHeader } from "./OpsPageHeader";
import { OpsSurface } from "./OpsSurface";
import { opsGet } from "./opsApi";
import type { OpsDemoData, OpsInboxItem, OpsProject, OpsTask } from "./types";

function isOverdue(task: OpsTask) {
  return Boolean(
    task.dueAt && new Date(task.dueAt) < new Date() && !["DONE", "CANCELLED"].includes(task.status)
  );
}

function isToday(task: OpsTask) {
  if (!task.dueAt) return false;
  const value = new Date(task.dueAt);
  const today = new Date();
  return value.toDateString() === today.toDateString();
}

export function OpsOverview({
  initialData,
  demoMode = false,
  permissions,
  currentAdminId,
  canReadInbox = false,
  canReadKnowledge = false,
}: {
  initialData?: OpsDemoData;
  demoMode?: boolean;
  permissions: readonly string[];
  currentAdminId: string;
  canReadInbox?: boolean;
  canReadKnowledge?: boolean;
}) {
  const [tasks, setTasks] = useState(initialData?.tasks ?? []);
  const [projects, setProjects] = useState(initialData?.projects ?? []);
  const [inbox, setInbox] = useState(canReadInbox ? (initialData?.inbox ?? []) : []);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData || demoMode) return;
    let active = true;
    void Promise.all([
      opsGet<{ tasks: OpsTask[] }>("/api/admin/operations/tasks?limit=100"),
      opsGet<{ projects: OpsProject[] }>("/api/admin/operations/projects?limit=20"),
      canReadInbox
        ? opsGet<{ items: OpsInboxItem[] }>("/api/admin/operations/inbox?limit=10")
        : Promise.resolve({ items: [] as OpsInboxItem[] }),
    ])
      .then(([taskResult, projectResult, inboxResult]) => {
        if (!active) return;
        setTasks(taskResult.tasks);
        setProjects(projectResult.projects);
        setInbox(inboxResult.items);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Не удалось загрузить обзор");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canReadInbox, demoMode, initialData]);

  const metrics = useMemo(
    () => [
      {
        label: "Мои активные",
        value: tasks.filter(
          (task) =>
            task.assignee?.id === currentAdminId && !["DONE", "CANCELLED"].includes(task.status)
        ).length,
        icon: ListTodo,
        tone: "blue",
        href: "/admin/operations/tasks?scope=mine",
      },
      {
        label: "Просрочено",
        value: tasks.filter(isOverdue).length,
        icon: AlertTriangle,
        tone: "red",
        href: "/admin/operations/tasks?scope=overdue",
      },
      {
        label: "На сегодня",
        value: tasks.filter(isToday).length,
        icon: CalendarClock,
        tone: "amber",
        href: "/admin/operations/tasks?scope=today",
      },
      {
        label: "Выполняет агент",
        value: tasks.filter((task) => task.status === "AGENT_RUNNING").length,
        icon: Bot,
        tone: "violet",
        href: "/admin/operations/tasks?status=AGENT_RUNNING",
      },
      {
        label: "Ждём сотрудника",
        value: tasks.filter((task) => task.status === "WAITING_HUMAN").length,
        icon: CircleUserRound,
        tone: "cyan",
        href: "/admin/operations/tasks?status=WAITING_HUMAN",
      },
      {
        label: "Нужно согласовать",
        value: tasks.filter((task) => task.status === "NEEDS_APPROVAL").length,
        icon: CheckCircle2,
        tone: "orange",
        href: "/admin/operations/tasks?status=NEEDS_APPROVAL",
      },
      {
        label: "Без исполнителя",
        value: tasks.filter(
          (task) => !task.assignee && !["DONE", "CANCELLED", "AGENT_RUNNING"].includes(task.status)
        ).length,
        icon: UserRoundPlus,
        tone: "slate",
        href: "/admin/operations/tasks?assignee=none",
      },
      {
        label: "Без следующего шага",
        value: tasks.filter(
          (task) => ["PLANNED", "IN_PROGRESS", "REVIEW"].includes(task.status) && !task.nextAction
        ).length,
        icon: Clock3,
        tone: "red",
        href: "/admin/operations/tasks?missingNextAction=1",
      },
    ],
    [currentAdminId, tasks]
  );

  const iconTone: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    cyan: "bg-cyan-50 text-cyan-600",
    orange: "bg-orange-50 text-orange-600",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <OpsSurface
      inboxCount={inbox.filter((item) => item.reviewStatus === "PENDING").length}
      permissions={permissions}
    >
      <OpsPageHeader
        title="Обзор работы"
        description={`Сегодня · ${new Intl.DateTimeFormat("ru-RU", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date())}`}
        actions={
          <>
            <Link
              href="/admin/operations/tasks"
              className="flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <ListTodo className="h-4 w-4" />
              Открыть задачи
            </Link>
            {canReadKnowledge ? (
              <Link
                href="/admin/operations/knowledge"
                className="flex h-11 items-center rounded-lg border border-blue-600 px-4 text-sm font-semibold text-blue-600 hover:bg-blue-50"
              >
                БАЗА
              </Link>
            ) : null}
          </>
        }
      />

      {loading ? (
        <div className="flex min-h-[65vh] items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          {opsRu.common.loading}
        </div>
      ) : (
        <div className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <Link
                  key={metric.label}
                  href={metric.href}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg",
                        iconTone[metric.tone]
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-2xl font-bold tabular-nums text-slate-950">
                      {metric.value}
                    </span>
                  </div>
                  <p className="mt-4 text-xs font-medium text-slate-600 sm:text-sm">
                    {metric.label}
                  </p>
                </Link>
              );
            })}
          </section>

          <div
            className={cn(
              "grid gap-6",
              canReadInbox && "xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,.6fr)]"
            )}
          >
            {canReadInbox ? (
              <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <header className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5">
                  <div>
                    <h2 className="font-bold text-slate-950">Сейчас требует внимания</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Просроченные и ожидающие решения
                    </p>
                  </div>
                  <Link
                    href="/admin/operations/tasks"
                    className="text-sm font-medium text-blue-600"
                  >
                    Все задачи
                  </Link>
                </header>
                <div className="divide-y divide-slate-100">
                  {tasks
                    .filter(
                      (task) =>
                        isOverdue(task) ||
                        ["BLOCKED", "NEEDS_APPROVAL", "WAITING_HUMAN"].includes(task.status)
                    )
                    .slice(0, 6)
                    .map((task) => (
                      <Link
                        key={task.id}
                        href={`/admin/operations/tasks/${task.id}`}
                        className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-slate-50 sm:px-5"
                      >
                        <span
                          className={cn(
                            "h-2.5 w-2.5 rounded-full",
                            isOverdue(task)
                              ? "bg-red-500"
                              : task.status === "NEEDS_APPROVAL"
                                ? "bg-amber-400"
                                : "bg-slate-400"
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-900">
                            {task.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {OPS_STATUS_LABELS[task.status]} ·{" "}
                            {task.assignee?.name || "Без исполнителя"}
                          </span>
                        </span>
                        <ArrowRight className="h-4 w-4 text-slate-400" />
                      </Link>
                    ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <header className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
                <div className="flex items-center gap-2">
                  <Inbox className="h-5 w-5 text-blue-600" />
                  <h2 className="font-bold text-slate-950">Последние из Telegram</h2>
                </div>
                <Link href="/admin/operations/inbox" className="text-sm font-medium text-blue-600">
                  Открыть
                </Link>
              </header>
              <div className="divide-y divide-slate-100">
                {inbox.slice(0, 4).map((item) => (
                  <Link
                    key={item.id}
                    href={`/admin/operations/inbox?selected=${item.id}`}
                    className="block px-4 py-3.5 hover:bg-slate-50"
                  >
                    <div className="flex items-start gap-3">
                      <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
                      <span className="min-w-0">
                        <span className="line-clamp-2 text-sm leading-5 text-slate-800">
                          {item.summary || item.originalMessage}
                        </span>
                        <span className="mt-1 block text-xs text-slate-400">
                          Уверенность {Math.round(Number(item.confidence ?? 0) * 100)}%
                        </span>
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5 text-blue-600" />
                <h2 className="font-bold text-slate-950">Активные проекты</h2>
              </div>
              <Link href="/admin/operations/projects" className="text-sm font-medium text-blue-600">
                Все проекты
              </Link>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {projects.slice(0, 3).map((project) => (
                <Link
                  key={project.id}
                  href={`/admin/operations/tasks?projectId=${project.id}`}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-slate-900">{project.title}</h3>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                      {project.status}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-500">
                    {project.nextAction || project.description}
                  </p>
                  <div className="mt-4 text-xs text-slate-400">
                    {project._count?.tasks ?? 0} задач · {project.owner?.name || "Без владельца"}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </OpsSurface>
  );
}
