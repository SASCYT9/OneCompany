"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  CalendarClock,
  ChevronDown,
  Inbox,
  ListTodo,
  Loader2,
  Send,
  UserRoundPlus,
  Users,
} from "lucide-react";

import { OPS_STATUS_LABELS, opsRu } from "@/lib/operations/i18n";
import { cn } from "@/lib/utils";

import { OpsPageHeader } from "./OpsPageHeader";
import { OpsSurface } from "./OpsSurface";
import { opsGet } from "./opsApi";
import type { OpsDemoData, OpsPerson, OpsTask } from "./types";

const CLOSED = new Set(["DONE", "CANCELLED"]);
const HELP_STORAGE_KEY = "ops-overview-help-open";

function isOpen(task: OpsTask) {
  return !CLOSED.has(task.status);
}

function startOfToday(now: Date) {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  return day;
}

function dueGroup(task: OpsTask, now: Date): "overdue" | "today" | "later" | "none" {
  if (!task.dueAt) return "none";
  const due = new Date(task.dueAt);
  if (due < now) return "overdue";
  const end = startOfToday(now);
  end.setDate(end.getDate() + 1);
  return due < end ? "today" : "later";
}

function taskPeople(task: OpsTask): OpsPerson[] {
  const people = (task.assignees ?? []).map((entry) =>
    "adminUser" in entry ? entry.adminUser : entry
  );
  if (!people.length && task.assignee) people.push(task.assignee);
  return Array.from(new Map(people.map((person) => [person.id, person])).values());
}

function isMine(task: OpsTask, adminUserId: string) {
  return task.isShared || taskPeople(task).some((person) => person.id === adminUserId);
}

function personName(person: OpsPerson) {
  return person.name?.trim() || person.email;
}

function dueLabel(task: OpsTask, now: Date) {
  if (!task.dueAt) return "без срока";
  const due = new Date(task.dueAt);
  const group = dueGroup(task, now);
  const time = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(due);
  if (group === "today") return `сегодня до ${time}`;
  const day = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(due);
  if (group === "overdue") {
    const days = Math.floor(
      (startOfToday(now).getTime() - startOfToday(due).getTime()) / 86_400_000
    );
    return days <= 0 ? `срок был в ${time}` : days === 1 ? "срок был вчера" : `просрочено с ${day}`;
  }
  return day;
}

export function OpsOverview({
  initialData,
  demoMode = false,
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
  const [needsDecision, setNeedsDecision] = useState(
    canReadInbox
      ? (initialData?.inbox ?? []).filter((item) => item.reviewStatus === "PENDING").length
      : 0
  );
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(true);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(HELP_STORAGE_KEY);
      if (saved !== null) setHelpOpen(saved === "1");
    } catch {
      // Private mode: keep the default.
    }
  }, []);

  useEffect(() => {
    if (initialData || demoMode) return;
    let active = true;
    void Promise.all([
      opsGet<{ tasks: OpsTask[] }>("/api/admin/operations/tasks?limit=100"),
      canReadInbox
        ? opsGet<{ needsDecision?: number }>("/api/admin/operations/inbox?needsDecision=1&limit=1")
        : Promise.resolve({ needsDecision: 0 }),
    ])
      .then(([taskResult, inboxResult]) => {
        if (!active) return;
        setTasks(taskResult.tasks);
        setNeedsDecision(inboxResult.needsDecision ?? 0);
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

  const now = useMemo(() => new Date(), []);
  const open = useMemo(() => tasks.filter(isOpen), [tasks]);
  const mine = useMemo(
    () =>
      open
        .filter((task) => isMine(task, currentAdminId))
        .sort((a, b) => {
          const order = { overdue: 0, today: 1, later: 2, none: 3 } as const;
          const byGroup = order[dueGroup(a, now)] - order[dueGroup(b, now)];
          if (byGroup) return byGroup;
          return (
            (a.dueAt ? new Date(a.dueAt).getTime() : Infinity) -
            (b.dueAt ? new Date(b.dueAt).getTime() : Infinity)
          );
        }),
    [currentAdminId, now, open]
  );
  const unassigned = useMemo(
    () => open.filter((task) => !task.isShared && taskPeople(task).length === 0),
    [open]
  );
  const team = useMemo(() => {
    const byPerson = new Map<string, { person: OpsPerson; open: number; overdue: number }>();
    for (const task of open) {
      for (const person of taskPeople(task)) {
        const entry = byPerson.get(person.id) ?? { person, open: 0, overdue: 0 };
        entry.open += 1;
        if (dueGroup(task, now) === "overdue") entry.overdue += 1;
        byPerson.set(person.id, entry);
      }
    }
    return Array.from(byPerson.values()).sort((a, b) => b.overdue - a.overdue || b.open - a.open);
  }, [now, open]);

  const myOverdue = mine.filter((task) => dueGroup(task, now) === "overdue").length;
  const myToday = mine.filter((task) => dueGroup(task, now) === "today").length;

  const tiles = [
    {
      label: "Мои просроченные",
      value: myOverdue,
      hint: "Закройте, перенесите или отдайте другому",
      href: "/admin/operations/tasks?scope=overdue",
      icon: AlertTriangle,
      tone: "red" as const,
    },
    {
      label: "Мой срок сегодня",
      value: myToday,
      hint: "Бот напомнит за 2 часа до срока",
      href: "/admin/operations/tasks?scope=today",
      icon: CalendarClock,
      tone: "blue" as const,
    },
    {
      label: "Без исполнителя",
      value: unassigned.length,
      hint: "Никто не отвечает — назначьте",
      href: "/admin/operations/tasks?assignee=none",
      icon: UserRoundPlus,
      tone: "amber" as const,
    },
    ...(canReadInbox
      ? [
          {
            label: "Из Telegram ждут решения",
            value: needsDecision,
            hint: "Бот не понял, что из этого сделать",
            href: "/admin/operations/inbox",
            icon: Inbox,
            tone: "blue" as const,
          },
        ]
      : []),
  ];

  function toggleHelp() {
    setHelpOpen((value) => {
      try {
        window.localStorage.setItem(HELP_STORAGE_KEY, value ? "0" : "1");
      } catch {
        // Private mode: the toggle just is not remembered.
      }
      return !value;
    });
  }

  return (
    <OpsSurface>
      <OpsPageHeader
        title="Мой день"
        description={new Intl.DateTimeFormat("ru-RU", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(now)}
        actions={
          <>
            <Link
              href="/admin/operations/tasks"
              className="flex h-10 items-center gap-2 bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500"
            >
              <ListTodo className="h-4 w-4" />
              Все задачи
            </Link>
            {canReadKnowledge ? (
              <Link
                href="/admin/operations/knowledge"
                className="flex h-10 items-center border border-white/15 px-4 text-sm font-semibold text-zinc-200 hover:bg-white/5"
              >
                БАЗА
              </Link>
            ) : null}
          </>
        }
      />

      {loading ? (
        <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          {opsRu.common.loading}
        </div>
      ) : (
        <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">
          {error ? (
            <div className="border-l-2 border-red-400 bg-red-500/[0.08] px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <section aria-labelledby="ops-now-heading">
            <h2 id="ops-now-heading" className="mb-3 text-[15px] font-semibold text-white">
              Что сделать сейчас
            </h2>
            <div
              className={cn(
                "grid grid-cols-2 gap-px border border-white/10 bg-white/10",
                tiles.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"
              )}
            >
              {tiles.map((tile) => {
                const Icon = tile.icon;
                const active = tile.value > 0;
                return (
                  <Link
                    key={tile.label}
                    href={tile.href}
                    className={cn(
                      "group relative flex min-h-[116px] flex-col justify-between bg-[#141414] px-4 py-3.5 transition hover:bg-[#1b1b1b]",
                      active && "bg-[#151a22]"
                    )}
                  >
                    {active ? (
                      <span
                        className={cn(
                          "absolute inset-y-0 left-0 w-[3px]",
                          tile.tone === "red"
                            ? "bg-red-500"
                            : tile.tone === "amber"
                              ? "bg-amber-400"
                              : "bg-blue-500"
                        )}
                      />
                    ) : null}
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          "flex items-center gap-2 text-[13px] leading-5",
                          active ? "font-medium text-zinc-100" : "text-zinc-500"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {tile.label}
                      </span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-600 transition group-hover:text-white" />
                    </div>
                    <div>
                      <div
                        className={cn(
                          "text-[30px] font-semibold leading-none tabular-nums",
                          active ? "text-white" : "text-zinc-600"
                        )}
                      >
                        {tile.value}
                      </div>
                      <div className="mt-1.5 text-[11px] leading-4 text-zinc-500">
                        {active ? tile.hint : "Всё чисто"}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
            <section
              aria-labelledby="ops-mine-heading"
              className="border border-white/10 bg-[#141414]"
            >
              <header className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
                <h2 id="ops-mine-heading" className="text-[15px] font-semibold text-white">
                  Мои задачи
                  <span className="ml-2 text-[12px] font-normal text-zinc-500">{mine.length}</span>
                </h2>
                <Link
                  href="/admin/operations/tasks?scope=mine"
                  className="text-[13px] font-medium text-blue-400 hover:text-blue-300"
                >
                  Открыть все
                </Link>
              </header>
              {mine.length ? (
                <ul className="divide-y divide-white/5">
                  {mine.slice(0, 8).map((task) => {
                    const group = dueGroup(task, now);
                    return (
                      <li key={task.id}>
                        <Link
                          href={`/admin/operations/tasks/${task.id}`}
                          className="flex items-center gap-3 px-5 py-3 transition hover:bg-white/[0.03]"
                        >
                          <span
                            className={cn(
                              "h-2 w-2 shrink-0",
                              group === "overdue"
                                ? "bg-red-500"
                                : group === "today"
                                  ? "bg-blue-500"
                                  : "bg-zinc-600"
                            )}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-zinc-100">
                              {task.number ? (
                                <span className="mr-1.5 text-zinc-500">#{task.number}</span>
                              ) : null}
                              {task.title}
                            </span>
                            <span className="mt-0.5 block text-xs text-zinc-500">
                              {OPS_STATUS_LABELS[task.status]}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "shrink-0 text-xs",
                              group === "overdue" ? "text-red-300" : "text-zinc-400"
                            )}
                          >
                            {dueLabel(task, now)}
                          </span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-zinc-600" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-5 py-8 text-center text-sm text-zinc-500">
                  На вас сейчас ничего нет. Новые задачи приходят из Telegram и от коллег.
                </p>
              )}
            </section>

            <section
              aria-labelledby="ops-team-heading"
              className="border border-white/10 bg-[#141414]"
            >
              <header className="flex items-center gap-2 border-b border-white/10 px-5 py-3.5">
                <Users className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                <h2 id="ops-team-heading" className="text-[15px] font-semibold text-white">
                  Кто чем занят
                </h2>
              </header>
              <ul className="divide-y divide-white/5">
                {team.map((entry) => (
                  <li key={entry.person.id}>
                    <Link
                      href={`/admin/operations/tasks?assignee=${encodeURIComponent(entry.person.id)}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 text-sm transition hover:bg-white/[0.03]"
                    >
                      <span className="truncate text-zinc-200">
                        {personName(entry.person)}
                        {entry.person.id === currentAdminId ? (
                          <span className="ml-1.5 text-xs text-zinc-500">вы</span>
                        ) : null}
                      </span>
                      <span className="flex shrink-0 items-center gap-3 tabular-nums">
                        <span className="text-zinc-400">{entry.open} в работе</span>
                        {entry.overdue ? (
                          <span className="text-red-300">{entry.overdue} просроч.</span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                ))}
                {unassigned.length ? (
                  <li>
                    <Link
                      href="/admin/operations/tasks?assignee=none"
                      className="flex items-center justify-between gap-3 px-5 py-3 text-sm transition hover:bg-white/[0.03]"
                    >
                      <span className="text-amber-200">Без исполнителя</span>
                      <span className="tabular-nums text-amber-200">{unassigned.length}</span>
                    </Link>
                  </li>
                ) : null}
                {!team.length && !unassigned.length ? (
                  <li className="px-5 py-8 text-center text-sm text-zinc-500">
                    Открытых задач нет.
                  </li>
                ) : null}
              </ul>
            </section>
          </div>

          <section
            className="border border-white/10 bg-[#141414]"
            aria-labelledby="ops-help-heading"
          >
            <button
              type="button"
              onClick={toggleHelp}
              aria-expanded={helpOpen}
              className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
            >
              <span
                id="ops-help-heading"
                className="flex items-center gap-2 text-[15px] font-semibold text-white"
              >
                <BellRing className="h-4 w-4 text-blue-400" aria-hidden="true" />
                Как работает бот и напоминания
              </span>
              <ChevronDown
                className={cn("h-4 w-4 text-zinc-500 transition", helpOpen && "rotate-180")}
                aria-hidden="true"
              />
            </button>
            {helpOpen ? (
              <div className="grid gap-px border-t border-white/10 bg-white/10 md:grid-cols-3">
                <HelpBlock
                  icon={Send}
                  title="Поставить задачу"
                  lines={[
                    "Напишите боту в Telegram: текстом, голосом или перешлите сообщение.",
                    "Бот сам сформулирует задачу и срок. Если непонятно, кому, — спросит кнопками.",
                  ]}
                />
                <HelpBlock
                  icon={BellRing}
                  title="Когда бот напомнит"
                  lines={[
                    "09:00 — утренняя сводка, только если есть срок сегодня или вчера.",
                    "За 2 часа до срока — одно напоминание. Потом не повторяет.",
                    "Пятница 10:00 — разбор зависших задач. С 21:00 до 09:00 бот молчит.",
                  ]}
                />
                <HelpBlock
                  icon={ListTodo}
                  title="Ответить не открывая админку"
                  lines={[
                    "Под каждым напоминанием кнопки: ✅ Готово, ⏰ Завтра, 🗑 Не нужно, 🙋 Беру.",
                    "Всё, что нажато в Telegram, сразу видно здесь и в истории задачи.",
                  ]}
                />
              </div>
            ) : null}
          </section>
        </div>
      )}
    </OpsSurface>
  );
}

function HelpBlock({
  icon: Icon,
  title,
  lines,
}: {
  icon: typeof Send;
  title: string;
  lines: string[];
}) {
  return (
    <div className="bg-[#141414] px-5 py-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
        <Icon className="h-4 w-4 text-zinc-500" aria-hidden="true" />
        {title}
      </h3>
      <ul className="mt-2 space-y-1.5 text-[13px] leading-5 text-zinc-400">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
