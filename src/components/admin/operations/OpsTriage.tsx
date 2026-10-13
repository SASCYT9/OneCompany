"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  Loader2,
  SkipForward,
  Trash2,
  UserRoundPlus,
} from "lucide-react";

import { OPS_STATUS_LABELS, formatOpsWhen } from "@/lib/operations/i18n";
import { cn } from "@/lib/utils";

import { OpsPageHeader } from "./OpsPageHeader";
import { OpsSurface } from "./OpsSurface";
import { opsGet, opsMutation } from "./opsApi";
import type { OpsPerson, OpsTask } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_DAYS = 7;
const OPEN_STATUSES =
  "INBOX,PLANNED,IN_PROGRESS,WAITING_HUMAN,WAITING_EXTERNAL,NEEDS_APPROVAL,REVIEW,BLOCKED";

type Reason = "overdue" | "unassigned" | "stale";

const REASON_LABELS: Record<Reason, string> = {
  overdue: "Срок прошёл",
  unassigned: "Нет исполнителя",
  stale: "Неделю без движения",
};

function taskPeople(task: OpsTask): OpsPerson[] {
  const people = (task.assignees ?? []).map((entry) =>
    "adminUser" in entry ? entry.adminUser : entry
  );
  if (!people.length && task.assignee) people.push(task.assignee);
  return Array.from(new Map(people.map((person) => [person.id, person])).values());
}

function startOfToday(now: Date) {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  return day;
}

/** Why this task is in the «разбор» queue, or null when it is fine. */
export function opsTriageReason(task: OpsTask, now: Date): Reason | null {
  if (task.dueAt && new Date(task.dueAt) < startOfToday(now)) return "overdue";
  if (
    !task.isShared &&
    !taskPeople(task).length &&
    task.createdAt &&
    now.getTime() - new Date(task.createdAt).getTime() > DAY_MS
  ) {
    return "unassigned";
  }
  if (task.updatedAt && now.getTime() - new Date(task.updatedAt).getTime() > STALE_DAYS * DAY_MS) {
    return "stale";
  }
  return null;
}

function tomorrowAt18(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(18, 0, 0, 0);
  return date;
}

function firstName(person: OpsPerson) {
  return person.name?.trim().split(/\s+/)[0] || person.email.split("@")[0];
}

export function OpsTriage({
  currentAdminId,
  canManageAll,
}: {
  currentAdminId: string;
  canManageAll: boolean;
}) {
  const [queue, setQueue] = useState<Array<{ task: OpsTask; reason: Reason }>>([]);
  const [members, setMembers] = useState<OpsPerson[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<"due" | "assignee" | null>(null);
  const [customDate, setCustomDate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const scope = canManageAll ? "" : "&mine=1";
      const [{ tasks }, membersResponse] = await Promise.all([
        opsGet<{ tasks: OpsTask[] }>(
          `/api/admin/operations/tasks?status=${OPEN_STATUSES}&limit=100${scope}`
        ),
        opsGet<{ members: OpsPerson[] }>("/api/admin/operations/members").catch(() => ({
          members: [] as OpsPerson[],
        })),
      ]);
      const now = new Date();
      const order: Record<Reason, number> = { overdue: 0, unassigned: 1, stale: 2 };
      const next = tasks
        .flatMap((task) => {
          const reason = opsTriageReason(task, now);
          return reason ? [{ task, reason }] : [];
        })
        .sort(
          (left, right) =>
            order[left.reason] - order[right.reason] ||
            new Date(left.task.dueAt ?? left.task.createdAt ?? 0).getTime() -
              new Date(right.task.dueAt ?? right.task.createdAt ?? 0).getTime()
        );
      setQueue(next);
      setMembers(membersResponse.members);
      setIndex(0);
      setDone({});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить задачи");
    } finally {
      setLoading(false);
    }
  }, [canManageAll]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = queue[index] ?? null;
  const handled = Object.keys(done).length;

  const advance = useCallback(
    (label: string) => {
      if (!current) return;
      setDone((previous) => ({ ...previous, [current.task.id]: label }));
      setPicker(null);
      setCustomDate("");
      setIndex((value) => value + 1);
    },
    [current]
  );

  async function run(label: string, action: () => Promise<unknown>) {
    if (!current || pending) return;
    setPending(true);
    setError(null);
    try {
      await action();
      advance(label);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить");
    } finally {
      setPending(false);
    }
  }

  const transition = (status: "DONE" | "CANCELLED", label: string) =>
    run(label, () =>
      opsMutation({
        path: `/api/admin/operations/tasks/${current!.task.id}/transition`,
        body: { status, nextAction: null, reopen: false, comment: null },
        version: current!.task.version,
        scope: `triage-transition:${current!.task.id}`,
      })
    );

  const patch = (body: Record<string, unknown>, label: string) =>
    run(label, () =>
      opsMutation({
        path: `/api/admin/operations/tasks/${current!.task.id}`,
        method: "PATCH",
        body,
        version: current!.task.version,
        scope: `triage-patch:${current!.task.id}`,
      })
    );

  const summary = useMemo(() => {
    const counts = { done: 0, cancelled: 0, moved: 0, assigned: 0 };
    for (const label of Object.values(done)) {
      if (label === "Готово") counts.done += 1;
      else if (label === "Не нужна") counts.cancelled += 1;
      else if (label.startsWith("Срок")) counts.moved += 1;
      else if (label.startsWith("Поручено")) counts.assigned += 1;
    }
    return counts;
  }, [done]);

  return (
    <OpsSurface>
      <OpsPageHeader
        title="Разбор зависших"
        description="По одной задаче: сделано, не нужно, перенести или поручить. Пропустить можно всегда."
        actions={
          <Link
            href="/admin/operations"
            className="inline-flex h-10 items-center gap-2 border border-white/10 px-4 text-sm text-zinc-300 hover:bg-white/5"
          >
            <ArrowLeft className="h-4 w-4" /> Мой день
          </Link>
        }
      />
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6" data-ops-triage>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Собираю зависшие задачи…
          </div>
        ) : !queue.length ? (
          <div className="border border-white/10 bg-[#171717] p-6 text-sm text-zinc-300">
            👌 Разбирать нечего: нет просроченных, брошенных или забытых задач.
          </div>
        ) : !current ? (
          <div className="space-y-4 border border-white/10 bg-[#171717] p-6" data-ops-triage-done>
            <h2 className="text-lg font-semibold text-zinc-50">Разобрано: {handled}</h2>
            <p className="text-sm text-zinc-400">
              Готово {summary.done} · не нужно {summary.cancelled} · перенесено {summary.moved} ·
              поручено {summary.assigned} · пропущено{" "}
              {handled - summary.done - summary.cancelled - summary.moved - summary.assigned}
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-10 items-center border border-white/10 px-4 text-sm text-zinc-200 hover:bg-white/5"
            >
              Проверить ещё раз
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
              <span>
                {index + 1} из {queue.length}
              </span>
              <div className="h-1 flex-1 bg-white/10">
                <div
                  className="h-1 bg-blue-600 transition-all"
                  style={{ width: `${(index / queue.length) * 100}%` }}
                />
              </div>
            </div>

            <article className="border border-white/10 bg-[#171717]" data-ops-triage-card>
              <div className="border-b border-white/10 px-5 py-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={cn(
                      "px-2 py-0.5 font-medium",
                      current.reason === "overdue"
                        ? "bg-red-500/15 text-red-300"
                        : current.reason === "unassigned"
                          ? "bg-amber-500/15 text-amber-300"
                          : "bg-white/[0.06] text-zinc-300"
                    )}
                  >
                    {REASON_LABELS[current.reason]}
                  </span>
                  <span className="text-zinc-500">
                    #{current.task.number ?? current.task.externalId} ·{" "}
                    {OPS_STATUS_LABELS[current.task.status] ?? current.task.status}
                  </span>
                </div>
                <Link
                  href={`/admin/operations/tasks/${current.task.id}`}
                  className="mt-2 block text-lg font-semibold leading-snug text-zinc-50 hover:text-blue-300"
                >
                  {current.task.title}
                </Link>
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div className="flex gap-2">
                    <dt className="text-zinc-500">Срок:</dt>
                    <dd className="text-zinc-200">
                      {current.task.dueAt ? formatOpsWhen(current.task.dueAt) : "не задан"}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-zinc-500">Исполнитель:</dt>
                    <dd className="text-zinc-200">
                      {taskPeople(current.task).map(firstName).join(", ") || "никто"}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-zinc-500">Создана:</dt>
                    <dd className="text-zinc-200">
                      {current.task.createdAt ? formatOpsWhen(current.task.createdAt) : "—"}
                    </dd>
                  </div>
                  {current.task.shopOrder ? (
                    <div className="flex gap-2">
                      <dt className="text-zinc-500">Заказ:</dt>
                      <dd>
                        <Link
                          href={`/admin/shop/orders/${current.task.shopOrder.id}`}
                          className="text-blue-300 hover:underline"
                        >
                          {current.task.shopOrder.orderNumber}
                        </Link>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
              {current.task.nextAction || current.task.description ? (
                <div className="space-y-2 px-5 py-4 text-sm leading-relaxed text-zinc-400">
                  {current.task.nextAction ? (
                    <p>
                      <span className="text-zinc-500">Дальше: </span>
                      <span className="text-zinc-200">{current.task.nextAction}</span>
                    </p>
                  ) : null}
                  {current.task.description ? (
                    <p className="line-clamp-4 whitespace-pre-line">{current.task.description}</p>
                  ) : null}
                </div>
              ) : null}
            </article>

            {error ? (
              <p className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <button
                type="button"
                disabled={pending}
                onClick={() => void transition("DONE", "Готово")}
                className="inline-flex h-12 items-center justify-center gap-2 border border-blue-500 bg-blue-600 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> Готово
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => void transition("CANCELLED", "Не нужна")}
                className="inline-flex h-12 items-center justify-center gap-2 border border-red-500/30 bg-red-500/10 text-sm text-red-200 hover:bg-red-500/20 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" /> Не нужна
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setPicker(picker === "due" ? null : "due")}
                className={cn(
                  "inline-flex h-12 items-center justify-center gap-2 border text-sm hover:bg-white/5 disabled:opacity-50",
                  picker === "due"
                    ? "border-blue-500 text-zinc-50"
                    : "border-white/10 text-zinc-200"
                )}
              >
                <CalendarClock className="h-4 w-4" /> Перенести
              </button>
              {canManageAll ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setPicker(picker === "assignee" ? null : "assignee")}
                  className={cn(
                    "inline-flex h-12 items-center justify-center gap-2 border text-sm hover:bg-white/5 disabled:opacity-50",
                    picker === "assignee"
                      ? "border-blue-500 text-zinc-50"
                      : "border-white/10 text-zinc-200"
                  )}
                >
                  <UserRoundPlus className="h-4 w-4" /> Кому
                </button>
              ) : null}
              <button
                type="button"
                disabled={pending}
                onClick={() => advance("Пропущено")}
                className="inline-flex h-12 items-center justify-center gap-2 border border-white/10 text-sm text-zinc-400 hover:bg-white/5 disabled:opacity-50"
              >
                <SkipForward className="h-4 w-4" /> Пропустить
              </button>
            </div>

            {picker === "due" ? (
              <div className="flex flex-wrap items-center gap-2 border border-white/10 bg-[#141414] p-3">
                {(
                  [
                    ["Завтра", 1],
                    ["Через 3 дня", 3],
                    ["Через неделю", 7],
                  ] as const
                ).map(([label, days]) => (
                  <button
                    key={label}
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      void patch({ dueAt: tomorrowAt18(days).toISOString() }, `Срок: ${label}`)
                    }
                    className="h-10 border border-white/10 px-3 text-sm text-zinc-200 hover:bg-white/5"
                  >
                    {label}
                  </button>
                ))}
                <input
                  type="date"
                  value={customDate}
                  onChange={(event) => setCustomDate(event.target.value)}
                  className="h-10 border border-white/10 bg-[#0A0A0A] px-3 text-sm text-zinc-100"
                  aria-label="Своя дата"
                />
                <button
                  type="button"
                  disabled={pending || !customDate}
                  onClick={() => {
                    const date = new Date(`${customDate}T18:00:00`);
                    void patch({ dueAt: date.toISOString() }, `Срок: ${customDate}`);
                  }}
                  className="h-10 border border-blue-500 px-3 text-sm text-blue-200 hover:bg-blue-500/10 disabled:opacity-40"
                >
                  Сохранить дату
                </button>
              </div>
            ) : null}

            {picker === "assignee" ? (
              <div className="flex flex-wrap gap-2 border border-white/10 bg-[#141414] p-3">
                {members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      void patch(
                        { assigneeIds: [member.id], isShared: false },
                        `Поручено: ${firstName(member)}`
                      )
                    }
                    className={cn(
                      "h-10 border px-3 text-sm hover:bg-white/5",
                      member.id === currentAdminId
                        ? "border-blue-500/40 text-blue-200"
                        : "border-white/10 text-zinc-200"
                    )}
                  >
                    {member.id === currentAdminId ? "🙋 Мне" : firstName(member)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </OpsSurface>
  );
}
