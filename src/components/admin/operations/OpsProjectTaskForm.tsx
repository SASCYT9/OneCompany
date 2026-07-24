"use client";

import { useState } from "react";
import { Loader2, UsersRound, X } from "lucide-react";

import type { OpsPerson, OpsPriority, OpsProject, OpsTask } from "./types";
import { opsMutation } from "./opsApi";

export function OpsProjectTaskForm({
  project,
  members,
  canAssign,
  demoMode,
  onCancel,
  onSaved,
}: {
  project: OpsProject;
  members: OpsPerson[];
  canAssign: boolean;
  demoMode: boolean;
  onCancel: () => void;
  onSaved: (task: OpsTask) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<OpsPriority>("NORMAL");
  const [dueAt, setDueAt] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [isShared, setIsShared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError(null);
    const body = {
      title: title.trim(),
      description: description.trim() || null,
      status: "INBOX",
      priority,
      projectId: project.id,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      isShared,
      assigneeIds: isShared ? [] : assigneeIds,
    };
    try {
      if (demoMode) {
        const selectedAssignees = members.filter((member) => assigneeIds.includes(member.id));
        onSaved({
          id: `demo-task-${Date.now()}`,
          externalId: `TSK-${Date.now().toString().slice(-6)}`,
          title: body.title,
          description: body.description,
          status: "INBOX",
          priority: body.priority,
          dueAt: body.dueAt,
          isShared,
          version: 1,
          project: { id: project.id, externalId: project.externalId, title: project.title },
          assignee: selectedAssignees[0] ?? null,
          assignees: selectedAssignees,
        });
        return;
      }
      const response = await opsMutation<{ task: OpsTask }>({
        path: "/api/admin/operations/tasks",
        body,
        scope: `project-task-create:${project.id}`,
      });
      onSaved(response.task);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось создать задачу");
    } finally {
      setSaving(false);
    }
  }

  const fieldClass =
    "mt-1.5 h-11 w-full border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <div
      className="fixed inset-0 z-[85] flex items-end bg-slate-950/50 sm:items-center sm:justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ops-project-task-title"
    >
      <form
        className="max-h-[94dvh] w-full overflow-y-auto bg-white p-5 shadow-2xl sm:max-w-xl sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="ops-project-task-title" className="text-xl font-bold text-slate-950">
              Новая задача
            </h2>
            <p className="mt-1 text-sm text-slate-500">Проект: {project.title}</p>
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
          Что нужно сделать
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Описание
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            className="mt-1.5 w-full border border-slate-300 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
            Срок
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              className={fieldClass}
            />
          </label>
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3 border border-blue-200 bg-blue-50 p-4">
          <input
            type="checkbox"
            checked={isShared}
            onChange={(event) => {
              setIsShared(event.target.checked);
              if (event.target.checked) setAssigneeIds([]);
            }}
            className="mt-1 h-4 w-4 accent-blue-600"
          />
          <span>
            <span className="flex items-center gap-2 font-semibold text-slate-950">
              <UsersRound className="h-4 w-4 text-blue-600" />
              Общая задача для всей команды
            </span>
            <span className="mt-1 block text-xs leading-5 text-slate-600">
              Все участники с доступом к доске смогут изменять статус, добавлять комментарии и
              доводить задачу до результата.
            </span>
          </span>
        </label>

        {canAssign && !isShared ? (
          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-slate-700">Исполнители</legend>
            <p className="mt-1 text-xs text-slate-500">
              Можно назначить одного или нескольких участников.
            </p>
            <div className="mt-2 grid max-h-52 gap-2 overflow-y-auto border border-slate-200 p-2 sm:grid-cols-2">
              {members.map((member) => {
                const checked = assigneeIds.includes(member.id);
                return (
                  <label
                    key={member.id}
                    className={`flex min-w-0 cursor-pointer items-center gap-2 border px-3 py-2.5 text-sm transition ${
                      checked
                        ? "border-blue-500 bg-blue-50 text-blue-900"
                        : "border-slate-200 bg-white text-slate-700 hover:border-blue-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setAssigneeIds((current) =>
                          checked
                            ? current.filter((id) => id !== member.id)
                            : [...current, member.id]
                        )
                      }
                      className="h-4 w-4 shrink-0 accent-blue-600"
                    />
                    <span className="min-w-0 truncate">{member.name || member.email}</span>
                  </label>
                );
              })}
            </div>
            {assigneeIds.length ? (
              <p className="mt-2 text-xs font-medium text-blue-700">
                Выбрано: {assigneeIds.length}
              </p>
            ) : null}
          </fieldset>
        ) : null}

        <div className="mt-6 flex justify-end gap-2 pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 border border-slate-300 px-4 text-sm font-medium"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={!title.trim() || saving}
            className="flex h-11 items-center gap-2 bg-blue-600 px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Создать задачу
          </button>
        </div>
      </form>
    </div>
  );
}
