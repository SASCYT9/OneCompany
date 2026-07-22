"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";

import type { OpsPerson, OpsPriority, OpsProject } from "./types";
import { opsMutation } from "./opsApi";

type ProjectStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";

function dateInputValue(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function apiDate(value: string) {
  return value ? `${value}T00:00:00.000Z` : null;
}

export function OpsProjectForm({
  project,
  members,
  canAssign,
  demoMode,
  onCancel,
  onSaved,
}: {
  project?: OpsProject | null;
  members: OpsPerson[];
  canAssign: boolean;
  demoMode: boolean;
  onCancel: () => void;
  onSaved: (project: OpsProject) => void;
}) {
  const [title, setTitle] = useState(project?.title ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(
    (project?.status as ProjectStatus | undefined) ?? "ACTIVE"
  );
  const [priority, setPriority] = useState<OpsPriority>(project?.priority ?? "NORMAL");
  const [ownerId, setOwnerId] = useState(project?.owner?.id ?? "");
  const [startDate, setStartDate] = useState(dateInputValue(project?.startDate));
  const [dueDate, setDueDate] = useState(dateInputValue(project?.dueDate));
  const [nextAction, setNextAction] = useState(project?.nextAction ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError(null);
    const body = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      ...(canAssign ? { ownerId: ownerId || null } : {}),
      startDate: apiDate(startDate),
      dueDate: apiDate(dueDate),
      nextAction: nextAction.trim() || null,
    };
    try {
      if (demoMode) {
        onSaved({
          id: project?.id ?? `demo-project-${Date.now()}`,
          externalId: project?.externalId ?? `PRJ-${Date.now().toString().slice(-6)}`,
          ...body,
          version: (project?.version ?? 0) + 1,
          owner: members.find((member) => member.id === ownerId) ?? project?.owner ?? null,
          _count: project?._count ?? { tasks: 0, knowledgeArticles: 0 },
        });
        return;
      }
      const response = await opsMutation<{ project: OpsProject }>({
        path: project
          ? `/api/admin/operations/projects/${project.id}`
          : "/api/admin/operations/projects",
        method: project ? "PATCH" : "POST",
        body,
        version: project?.version,
        scope: project ? `project-edit:${project.id}` : "project-create",
      });
      onSaved(response.project);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить проект");
    } finally {
      setSaving(false);
    }
  }

  const fieldClass =
    "mt-1.5 h-11 w-full border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end bg-slate-950/50 sm:items-center sm:justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ops-project-form-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <form
        className="max-h-[94dvh] w-full overflow-y-auto bg-white p-5 shadow-2xl sm:max-w-2xl sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="ops-project-form-title" className="text-xl font-bold text-slate-950">
              {project ? "Настроить проект" : "Новый проект"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Объедините связанные задачи в одно рабочее направление.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error ? (
          <div className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <label className="mt-5 block text-sm font-medium text-slate-700">
          Название проекта
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={fieldClass}
            placeholder="Например: Заказ BMW Competition 2026"
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Описание
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            className="mt-1.5 w-full resize-y border border-slate-300 bg-white p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="Цель проекта и важный контекст"
          />
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Статус
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as ProjectStatus)}
              className={fieldClass}
            >
              <option value="ACTIVE">Активный</option>
              <option value="PAUSED">На паузе</option>
              <option value="COMPLETED">Завершён</option>
              <option value="CANCELLED">Отменён</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Приоритет
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as OpsPriority)}
              className={fieldClass}
            >
              <option value="LOW">Низкий</option>
              <option value="NORMAL">Обычный</option>
              <option value="HIGH">Высокий</option>
              <option value="URGENT">Срочный</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Начало
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Срок
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className={fieldClass}
            />
          </label>
        </div>

        {canAssign ? (
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Ответственный за проект
            <select
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
              className={fieldClass}
            >
              <option value="">Без одного ответственного</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name || member.email}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Следующее действие
          <textarea
            value={nextAction}
            onChange={(event) => setNextAction(event.target.value)}
            rows={2}
            className="mt-1.5 w-full resize-y border border-slate-300 bg-white p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="Что конкретно нужно сделать дальше"
          />
        </label>

        <div className="sticky bottom-0 -mx-5 mt-6 flex justify-end gap-2 border-t border-slate-200 bg-white px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:-mx-6 sm:px-6">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 border border-slate-300 px-4 text-sm font-medium text-slate-700"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={!title.trim() || saving}
            className="flex h-11 items-center gap-2 bg-blue-600 px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {project ? "Сохранить" : "Создать проект"}
          </button>
        </div>
      </form>
    </div>
  );
}
