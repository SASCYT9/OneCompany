"use client";

import { useCallback, useEffect, useState } from "react";

import Link from "next/link";
import { Loader2, Plus } from "lucide-react";

import { AdminInspectorCard } from "@/components/admin/AdminPrimitives";
import { OpsApiError, opsGet, opsMutation } from "@/components/admin/operations/opsApi";
import type { OpsPerson, OpsTask } from "@/components/admin/operations/types";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  INBOX: "Нова",
  PLANNED: "Заплановано",
  IN_PROGRESS: "В роботі",
  AGENT_RUNNING: "Виконується",
  WAITING_HUMAN: "Чекає",
  WAITING_EXTERNAL: "Чекає відповіді",
  NEEDS_APPROVAL: "Погодження",
  REVIEW: "На перевірці",
  BLOCKED: "Заблоковано",
  DONE: "Готово",
  CANCELLED: "Скасовано",
};

const CLOSED = new Set(["DONE", "CANCELLED"]);

function people(task: OpsTask) {
  const list = (task.assignees ?? []).map((entry) =>
    "adminUser" in entry ? entry.adminUser : entry
  );
  if (!list.length && task.assignee) list.push(task.assignee);
  return list.map((person) => person.name?.trim().split(/\s+/)[0] || person.email.split("@")[0]);
}

function dueAt(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(18, 0, 0, 0);
  return date.toISOString();
}

/**
 * «Задачі команди» on an order: what the team is doing about it (including
 * tasks the bot created automatically) and a quick way to add one.
 */
export function OrderOpsTasksCard({
  orderId,
  orderNumber,
}: {
  orderId: string;
  orderNumber: string;
}) {
  const [tasks, setTasks] = useState<OpsTask[] | null>(null);
  const [hidden, setHidden] = useState(false);
  const [members, setMembers] = useState<OpsPerson[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [days, setDays] = useState(1);
  const [assigneeId, setAssigneeId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await opsGet<{ tasks: OpsTask[] }>(
        `/api/admin/operations/tasks?shopOrderId=${encodeURIComponent(orderId)}&limit=20`
      );
      setTasks(response.tasks);
    } catch (cause) {
      // No access to «Работа» (or it is switched off): show nothing.
      if (cause instanceof OpsApiError && [401, 403, 404].includes(cause.status)) setHidden(true);
      else setTasks([]);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openForm() {
    setFormOpen(true);
    setTitle(`Замовлення ${orderNumber}: `);
    if (!members.length) {
      const response = await opsGet<{ members: OpsPerson[] }>(
        "/api/admin/operations/members"
      ).catch(() => ({ members: [] as OpsPerson[] }));
      setMembers(response.members);
    }
  }

  async function create() {
    if (saving || title.trim().length < 3) return;
    setSaving(true);
    setError(null);
    try {
      await opsMutation({
        path: "/api/admin/operations/tasks",
        body: {
          title: title.trim(),
          shopOrderId: orderId,
          dueAt: dueAt(days),
          assigneeIds: assigneeId ? [assigneeId] : [],
          tags: ["process:order"],
        },
        scope: `order-task:${orderId}`,
      });
      setFormOpen(false);
      setAssigneeId("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не вдалося створити задачу");
    } finally {
      setSaving(false);
    }
  }

  if (hidden) return null;
  const open = (tasks ?? []).filter((task) => !CLOSED.has(task.status));
  const closed = (tasks ?? []).filter((task) => CLOSED.has(task.status));

  return (
    <AdminInspectorCard
      title="Задачі команди"
      description="Що робимо по замовленню. Бот сам ставить задачу, якщо оплачене замовлення не відправили за добу або замовлення не оплатили 3 дні."
    >
      <div className="space-y-3" data-order-ops-tasks>
        {tasks === null ? (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Завантаження…
          </div>
        ) : !tasks.length ? (
          <p className="text-[13px] text-zinc-500">Задач по цьому замовленню немає.</p>
        ) : (
          <ul className="divide-y divide-white/5 border border-white/10">
            {[...open, ...closed].map((task) => (
              <li key={task.id}>
                <Link
                  href={`/admin/operations/tasks/${task.id}`}
                  className="block px-3 py-2.5 hover:bg-white/[0.03]"
                >
                  <span
                    className={cn(
                      "block text-[13px] leading-snug",
                      CLOSED.has(task.status) ? "text-zinc-500 line-through" : "text-zinc-100"
                    )}
                  >
                    {task.number ? (
                      <span className="mr-1 text-zinc-500">#{task.number}</span>
                    ) : null}
                    {task.title}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-zinc-500">
                    <span>{STATUS_LABELS[task.status] ?? task.status}</span>
                    {task.dueAt && !CLOSED.has(task.status) ? (
                      <span
                        className={new Date(task.dueAt) < new Date() ? "text-red-300" : undefined}
                      >
                        до{" "}
                        {new Intl.DateTimeFormat("uk-UA", {
                          day: "numeric",
                          month: "short",
                        }).format(new Date(task.dueAt))}
                      </span>
                    ) : null}
                    <span>{people(task).join(", ") || "без виконавця"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {formOpen ? (
          <div className="space-y-2 border border-white/10 bg-[#0A0A0A] p-3">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-9 w-full border border-white/10 bg-[#141414] px-2.5 text-[13px] text-zinc-100 outline-none focus:border-blue-500"
              aria-label="Що зробити"
              autoFocus
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
                className="h-9 border border-white/10 bg-[#141414] px-2 text-[13px] text-zinc-100"
                aria-label="Строк"
              >
                <option value={0}>Сьогодні</option>
                <option value={1}>Завтра</option>
                <option value={3}>Через 3 дні</option>
                <option value={7}>Через тиждень</option>
              </select>
              <select
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
                className="h-9 border border-white/10 bg-[#141414] px-2 text-[13px] text-zinc-100"
                aria-label="Виконавець"
              >
                <option value="">Без виконавця</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name || member.email}
                  </option>
                ))}
              </select>
            </div>
            {error ? <p className="text-xs text-red-300">{error}</p> : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void create()}
                disabled={saving || title.trim().length < 3}
                className="h-9 flex-1 border border-blue-500 bg-blue-600 text-[13px] font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {saving ? "Створюю…" : "Створити задачу"}
              </button>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="h-9 border border-white/10 px-3 text-[13px] text-zinc-300 hover:bg-white/5"
              >
                Скасувати
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void openForm()}
            className="inline-flex h-9 w-full items-center justify-center gap-2 border border-white/10 text-[13px] text-zinc-200 hover:bg-white/5"
          >
            <Plus className="h-4 w-4" /> Поставити задачу
          </button>
        )}
      </div>
    </AdminInspectorCard>
  );
}
