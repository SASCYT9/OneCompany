"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  FolderKanban,
  ListTodo,
  Loader2,
  Plus,
  Search,
  Settings2,
  UserRound,
} from "lucide-react";

import { ADMIN_PERMISSIONS, matchesAdminPermission } from "@/lib/admin/adminPermissions";
import { OPS_PRIORITY_LABELS, opsRu } from "@/lib/operations/i18n";
import { cn } from "@/lib/utils";

import { OpsPageHeader } from "./OpsPageHeader";
import { OpsProjectForm } from "./OpsProjectForm";
import { OpsProjectTaskForm } from "./OpsProjectTaskForm";
import { OpsSurface } from "./OpsSurface";
import { opsGet } from "./opsApi";
import type { OpsPerson, OpsProject } from "./types";

const priorityTone = {
  LOW: "bg-slate-100 text-slate-600",
  NORMAL: "bg-blue-50 text-blue-700",
  HIGH: "bg-amber-50 text-amber-700",
  URGENT: "bg-red-50 text-red-700",
};

const projectStatusLabel: Record<string, string> = {
  ACTIVE: "Активный",
  PAUSED: "На паузе",
  COMPLETED: "Завершён",
  CANCELLED: "Отменён",
};

export function OpsProjects({
  initialProjects,
  demoMode = false,
  permissions,
  currentAdminId,
}: {
  initialProjects?: OpsProject[];
  demoMode?: boolean;
  permissions: readonly string[];
  currentAdminId: string;
}) {
  const [projects, setProjects] = useState(initialProjects ?? []);
  const [members, setMembers] = useState<OpsPerson[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(!initialProjects);
  const [error, setError] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState<OpsProject | null | undefined>(undefined);
  const [taskProject, setTaskProject] = useState<OpsProject | null>(null);

  const canWrite = matchesAdminPermission(permissions, ADMIN_PERMISSIONS.OPS_TASKS_WRITE);
  const canAssign = matchesAdminPermission(permissions, ADMIN_PERMISSIONS.OPS_TASKS_ASSIGN);

  useEffect(() => {
    if (initialProjects || demoMode) return;
    const controller = new AbortController();
    void opsGet<{ projects: OpsProject[] }>(
      "/api/admin/operations/projects?limit=100",
      controller.signal
    )
      .then((response) => setProjects(response.projects))
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Не удалось загрузить проекты");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [demoMode, initialProjects]);

  useEffect(() => {
    if (!canAssign || demoMode) return;
    const controller = new AbortController();
    void opsGet<{ members: OpsPerson[] }>("/api/admin/operations/members", controller.signal)
      .then((response) => setMembers(response.members))
      .catch(() => undefined);
    return () => controller.abort();
  }, [canAssign, demoMode]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return projects.filter(
      (project) =>
        !value ||
        [project.title, project.description, project.externalId, project.owner?.name].some(
          (field) =>
            String(field ?? "")
              .toLowerCase()
              .includes(value)
        )
    );
  }, [projects, query]);

  function saveProject(saved: OpsProject) {
    setProjects((current) => {
      const exists = current.some((project) => project.id === saved.id);
      return exists
        ? current.map((project) => (project.id === saved.id ? saved : project))
        : [saved, ...current];
    });
    setProjectForm(undefined);
  }

  function saveProjectTask() {
    if (!taskProject) return;
    setProjects((current) =>
      current.map((project) =>
        project.id === taskProject.id
          ? {
              ...project,
              _count: {
                tasks: (project._count?.tasks ?? 0) + 1,
                knowledgeArticles: project._count?.knowledgeArticles ?? 0,
              },
            }
          : project
      )
    );
    setTaskProject(null);
  }

  return (
    <OpsSurface permissions={permissions}>
      <OpsPageHeader
        title={opsRu.projects.title}
        description="Большие направления работы, которые объединяют несколько связанных задач."
        actions={
          canWrite ? (
            <button
              type="button"
              onClick={() => setProjectForm(null)}
              className="flex h-11 items-center gap-2 bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Создать проект
            </button>
          ) : null
        }
      />

      <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full max-w-xl">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по проектам и ответственным…"
              className="h-11 w-full border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <div className="text-sm text-slate-500">Проектов: {filtered.length}</div>
        </div>

        {loading ? (
          <div className="flex min-h-96 items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            {opsRu.common.loading}
          </div>
        ) : error ? (
          <div className="mt-6 border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : filtered.length ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((project) => (
              <article
                key={project.id}
                className="flex min-h-72 flex-col border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center bg-blue-50 text-blue-600">
                      <FolderKanban className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-mono text-[11px] text-slate-400">{project.externalId}</p>
                      <p className="mt-0.5 text-xs font-medium text-slate-600">
                        {projectStatusLabel[project.status] ?? project.status}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                      priorityTone[project.priority]
                    )}
                  >
                    {OPS_PRIORITY_LABELS[project.priority]}
                  </span>
                </div>

                <h2 className="mt-4 text-lg font-bold text-slate-950">{project.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm leading-5 text-slate-500">
                  {project.description || "Описание проекта пока не добавлено."}
                </p>

                <div className="mt-4 border-l-2 border-blue-500 bg-slate-50 px-3 py-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Следующее действие
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    {project.nextAction || "Не указано"}
                  </div>
                </div>

                <div className="mt-auto grid grid-cols-2 gap-3 pt-5 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <ListTodo className="h-4 w-4" />
                    {project._count?.tasks ?? 0} задач
                  </span>
                  <span className="flex items-center justify-end gap-1.5">
                    <UserRound className="h-4 w-4" />
                    {project.owner?.name || project.owner?.email || "Команда"}
                  </span>
                  {project.dueDate ? (
                    <span className="col-span-2 flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4" />
                      Срок:{" "}
                      {new Intl.DateTimeFormat("ru-RU", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }).format(new Date(project.dueDate))}
                    </span>
                  ) : null}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
                  <Link
                    href={`/admin/operations/tasks?projectId=${project.id}`}
                    className="col-span-2 flex h-10 items-center justify-between bg-slate-950 px-3 text-sm font-semibold text-white"
                  >
                    Открыть задачи <ArrowRight className="h-4 w-4" />
                  </Link>
                  {canWrite ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setTaskProject(project)}
                        className="flex h-10 items-center justify-center gap-2 border border-blue-200 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        <Plus className="h-4 w-4" />
                        Задача
                      </button>
                      {canAssign || project.owner?.id === currentAdminId ? (
                        <button
                          type="button"
                          onClick={() => setProjectForm(project)}
                          className="flex h-10 items-center justify-center gap-2 border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Settings2 className="h-4 w-4" />
                          Настроить
                        </button>
                      ) : (
                        <span className="flex h-10 items-center justify-center border border-slate-200 text-xs text-slate-400">
                          Только владелец
                        </span>
                      )}
                    </>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex min-h-96 flex-col items-center justify-center text-center">
            <FolderKanban className="h-10 w-10 text-slate-300" />
            <p className="mt-3 text-base font-semibold text-slate-800">Проектов пока нет</p>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              Создайте проект, если работа состоит из нескольких связанных задач.
            </p>
            {canWrite ? (
              <button
                type="button"
                onClick={() => setProjectForm(null)}
                className="mt-5 flex h-11 items-center gap-2 bg-blue-600 px-4 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" />
                Создать первый проект
              </button>
            ) : null}
          </div>
        )}
      </div>

      {projectForm !== undefined ? (
        <OpsProjectForm
          key={projectForm?.id ?? "new"}
          project={projectForm}
          members={members}
          canAssign={canAssign}
          demoMode={demoMode}
          onCancel={() => setProjectForm(undefined)}
          onSaved={saveProject}
        />
      ) : null}

      {taskProject ? (
        <OpsProjectTaskForm
          key={taskProject.id}
          project={taskProject}
          members={members}
          canAssign={canAssign}
          demoMode={demoMode}
          onCancel={() => setTaskProject(null)}
          onSaved={saveProjectTask}
        />
      ) : null}
    </OpsSurface>
  );
}
