"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Columns3,
  GripVertical,
  List,
  Loader2,
  MessageSquarePlus,
  Plus,
  Search,
  Send,
  UsersRound,
  Volume2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { OPS_STATUS_LABELS, opsRu } from "@/lib/operations/i18n";
import { ADMIN_PERMISSIONS, matchesAdminPermission } from "@/lib/admin/adminPermissions";
import { cn } from "@/lib/utils";

import { OpsPageHeader } from "./OpsPageHeader";
import { OpsSurface } from "./OpsSurface";
import { OpsTaskDetail } from "./OpsTaskDetail";
import { opsGet, opsMutation } from "./opsApi";
import type { OpsKnowledgeArticle, OpsPriority, OpsTask, OpsTaskStatus } from "./types";

type View = "list" | "board" | "calendar";
type Scope = "all" | "mine" | "today" | "overdue" | "waiting";

const lanes: Array<{
  id: string;
  label: string;
  statuses: OpsTaskStatus[];
  target: OpsTaskStatus;
  tone: string;
}> = [
  {
    id: "lane-inbox",
    label: "Входящие",
    statuses: ["INBOX"],
    target: "INBOX",
    tone: "bg-slate-400",
  },
  {
    id: "lane-planned",
    label: "Запланировано",
    statuses: ["PLANNED"],
    target: "PLANNED",
    tone: "bg-blue-400",
  },
  {
    id: "lane-work",
    label: "В работе",
    statuses: ["IN_PROGRESS", "AGENT_RUNNING"],
    target: "IN_PROGRESS",
    tone: "bg-blue-600",
  },
  {
    id: "lane-waiting",
    label: "Ожидание",
    statuses: ["WAITING_HUMAN", "WAITING_EXTERNAL", "NEEDS_APPROVAL"],
    target: "WAITING_HUMAN",
    tone: "bg-amber-400",
  },
  {
    id: "lane-review",
    label: "Проверка / Блок",
    statuses: ["REVIEW", "BLOCKED"],
    target: "REVIEW",
    tone: "bg-violet-500",
  },
  { id: "lane-done", label: "Готово", statuses: ["DONE"], target: "DONE", tone: "bg-emerald-500" },
];

const priorityDot: Record<OpsPriority, string> = {
  LOW: "bg-slate-300",
  NORMAL: "bg-amber-400",
  HIGH: "bg-red-500",
  URGENT: "bg-rose-600",
};

function initials(name?: string | null) {
  if (!name) return "—";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function dueText(date?: string | null) {
  if (!date) return "Без срока";
  const value = new Date(date);
  const today = new Date();
  const isToday =
    value.getDate() === today.getDate() &&
    value.getMonth() === today.getMonth() &&
    value.getFullYear() === today.getFullYear();
  if (isToday) return "Сегодня";
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(value);
}

function taskGroup(task: OpsTask) {
  if (!task.dueAt) return "Следующие";
  const due = new Date(task.dueAt);
  const now = new Date();
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  if (due < now && !["DONE", "CANCELLED"].includes(task.status)) return "Просрочено";
  if (due <= end) return "Сегодня";
  return "Следующие";
}

function TaskListRow({
  task,
  selected,
  onSelect,
}: {
  task: OpsTask;
  selected?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group grid w-full grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-100 px-3 py-3 text-left transition last:border-0 hover:bg-slate-50 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-blue-500 sm:grid-cols-[12px_minmax(0,1fr)_36px_96px_auto]",
        selected && "rounded-lg bg-blue-50 ring-1 ring-inset ring-blue-500"
      )}
    >
      <span className={cn("h-2.5 w-2.5 rounded-full", priorityDot[task.priority])} />
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-5 text-slate-900">{task.title}</span>
        <span className="mt-1 block truncate text-xs text-slate-500 sm:hidden">
          {OPS_STATUS_LABELS[task.status]} · {dueText(task.dueAt)}
        </span>
      </span>
      <span className="hidden h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[11px] text-slate-700 sm:flex">
        {task.isShared ? "ВСЕ" : initials(task.assignee?.name)}
      </span>
      <span
        className={cn(
          "hidden items-center gap-1.5 text-xs sm:flex",
          taskGroup(task) === "Просрочено" ? "text-red-600" : "text-slate-500"
        )}
      >
        <CalendarDays className="h-4 w-4" />
        {dueText(task.dueAt)}
      </span>
      <span className="flex items-center gap-1 text-slate-400">
        {task.sourceType === "TELEGRAM" || task.attachments?.length ? (
          <>
            <Send className="hidden h-4 w-4 text-blue-500 sm:block" />
            {task.attachments?.some(({ attachment }) =>
              attachment.mimeType.startsWith("audio/")
            ) ? (
              <Volume2 className="hidden h-4 w-4 text-blue-500 sm:block" />
            ) : null}
          </>
        ) : null}
        <ChevronRight className="h-4 w-4 group-hover:text-blue-600" />
      </span>
    </button>
  );
}

function SortableTaskCard({
  task,
  onOpen,
  onQuickComment,
  canWrite,
}: {
  task: OpsTask;
  onOpen: () => void;
  onQuickComment: () => void;
  canWrite: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
    disabled: !canWrite || ["AGENT_RUNNING", "DONE", "CANCELLED"].includes(task.status),
  });

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      role="button"
      tabIndex={0}
      aria-label={`Открыть задачу ${task.title}`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "cursor-pointer rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:border-blue-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-blue-500",
        isDragging && "opacity-40"
      )}
    >
      <div>
        <div className="flex items-start gap-2">
          <span
            className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", priorityDot[task.priority])}
          />
          <h3 className="min-w-0 flex-1 text-sm font-semibold leading-5 text-slate-900">
            {task.title}
          </h3>
        </div>
        {task.project ? (
          <p className="mt-2 truncate text-[11px] text-slate-500">{task.project.title}</p>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
        <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[10px]">
          {task.isShared ? "ВСЕ" : initials(task.assignee?.name)}
        </span>
        <div className="flex items-center gap-2">
          {canWrite ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onQuickComment();
              }}
              aria-label={`Добавить заметку к задаче ${task.title}`}
              className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-500"
            >
              <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
          <span
            className={cn(
              "text-[11px]",
              taskGroup(task) === "Просрочено" ? "font-medium text-red-600" : "text-slate-500"
            )}
          >
            {dueText(task.dueAt)}
          </span>
          <button
            type="button"
            onClick={(event) => event.stopPropagation()}
            aria-label={`Переместить задачу ${task.title}. Используйте пробел и стрелки.`}
            disabled={!canWrite || ["AGENT_RUNNING", "DONE", "CANCELLED"].includes(task.status)}
            className="cursor-grab touch-none rounded-md px-2 py-1 text-xs font-bold text-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

function Lane({
  lane,
  tasks,
  onOpen,
  onQuickComment,
  canWriteTask,
}: {
  lane: (typeof lanes)[number];
  tasks: OpsTask[];
  onOpen: (task: OpsTask) => void;
  onQuickComment: (task: OpsTask) => void;
  canWriteTask: (task: OpsTask) => boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: lane.id,
    data: { type: "lane", status: lane.target },
  });
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex min-h-[520px] w-[280px] shrink-0 flex-col rounded-2xl border border-slate-200 bg-slate-50/80 p-3",
        isOver && "border-blue-400 bg-blue-50"
      )}
    >
      <header className="mb-3 flex items-center gap-2 px-1">
        <span className={cn("h-2.5 w-2.5 rounded-full", lane.tone)} />
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600">{lane.label}</h2>
        <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-500 shadow-sm">
          {tasks.length}
        </span>
      </header>
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2.5">
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              onOpen={() => onOpen(task)}
              onQuickComment={() => onQuickComment(task)}
              canWrite={canWriteTask(task)}
            />
          ))}
        </div>
      </SortableContext>
      {!tasks.length ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">
          {tasks.some(canWriteTask) ? "Перетащите задачу сюда" : "Нет задач"}
        </div>
      ) : null}
    </section>
  );
}

function TaskCalendar({ tasks, onOpen }: { tasks: OpsTask[]; onOpen: (task: OpsTask) => void }) {
  const days = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - start.getDay() + 1);
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, []);

  return (
    <div className="grid min-w-[860px] grid-cols-7 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {days.map((day) => {
        const matches = tasks.filter((task) => {
          if (!task.dueAt) return false;
          const due = new Date(task.dueAt);
          return due.toDateString() === day.toDateString();
        });
        return (
          <section
            key={day.toISOString()}
            className="min-h-44 border-b border-r border-slate-200 p-2.5"
          >
            <div className="text-xs font-semibold text-slate-500">
              {new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric" }).format(day)}
            </div>
            <div className="mt-2 space-y-1.5">
              {matches.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onOpen(task)}
                  className="block w-full rounded-lg bg-blue-50 px-2 py-1.5 text-left text-[11px] font-medium leading-4 text-blue-900 hover:bg-blue-100"
                >
                  {task.title}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function OpsTaskWorkspace({
  initialTasks,
  demoMode = false,
  initialSelectedId,
  inboxCount = 0,
  canLinkKnowledge = false,
  initialKnowledge,
  permissions,
  currentAdminId,
  canWrite = false,
  canManageAll = false,
  initialScope = "all",
  initialStatus,
  initialProjectId,
  initialAssigneeNone = false,
  initialMissingNextAction = false,
  automationsEnabled = false,
  canRunAutomation = false,
  canDecideApprovals = false,
}: {
  initialTasks?: OpsTask[];
  demoMode?: boolean;
  initialSelectedId?: string;
  inboxCount?: number;
  canLinkKnowledge?: boolean;
  initialKnowledge?: OpsKnowledgeArticle[];
  permissions: readonly string[];
  currentAdminId: string;
  canWrite?: boolean;
  canManageAll?: boolean;
  initialScope?: Scope;
  initialStatus?: string;
  initialProjectId?: string;
  initialAssigneeNone?: boolean;
  initialMissingNextAction?: boolean;
  automationsEnabled?: boolean;
  canRunAutomation?: boolean;
  canDecideApprovals?: boolean;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<OpsTask[]>(initialTasks ?? []);
  const [selectedId, setSelectedId] = useState(initialSelectedId ?? initialTasks?.[0]?.id ?? null);
  const [view, setView] = useState<View>("list");
  const [scope, setScope] = useState<Scope>(initialScope);
  const [statusFilter, setStatusFilter] = useState<OpsTaskStatus | null>(
    initialStatus && initialStatus in OPS_STATUS_LABELS ? (initialStatus as OpsTaskStatus) : null
  );
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const [assigneeNone, setAssigneeNone] = useState(initialAssigneeNone);
  const [missingNextAction, setMissingNextAction] = useState(initialMissingNextAction);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(!initialTasks);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailRefresh, setDetailRefresh] = useState(0);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTaskShared, setNewTaskShared] = useState(false);
  const [creating, setCreating] = useState(false);
  const [quickCommentTaskId, setQuickCommentTaskId] = useState<string | null>(null);
  const [quickCommentText, setQuickCommentText] = useState("");
  const [quickCommentSaving, setQuickCommentSaving] = useState(false);
  const [boardDetailOpen, setBoardDetailOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadTasks = useCallback(async () => {
    if (demoMode) return;
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (scope === "mine") params.set("mine", "1");
      if (scope === "today") params.set("today", "1");
      if (scope === "overdue") params.set("overdue", "1");
      if (query.trim()) params.set("search", query.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (projectId) params.set("projectId", projectId);
      if (assigneeNone) params.set("assignee", "none");
      if (missingNextAction) params.set("missingNextAction", "1");
      if (scope === "waiting") {
        params.set("status", "WAITING_HUMAN,WAITING_EXTERNAL,NEEDS_APPROVAL,BLOCKED");
      }
      const response = await opsGet<{ tasks: OpsTask[] }>(
        `/api/admin/operations/tasks?${params.toString()}`
      );
      setTasks(response.tasks);
      setDetailRefresh((value) => value + 1);
      setSelectedId((current) =>
        current && response.tasks.some((task) => task.id === current)
          ? current
          : (response.tasks[0]?.id ?? null)
      );
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : opsRu.tasks.loadError);
    } finally {
      setLoading(false);
    }
  }, [assigneeNone, demoMode, missingNextAction, projectId, query, scope, statusFilter]);

  useEffect(() => {
    if (initialTasks) return;
    const timer = window.setTimeout(() => void loadTasks(), 180);
    return () => window.clearTimeout(timer);
  }, [initialTasks, loadTasks]);

  useEffect(() => {
    if (!selectedId || demoMode) return;
    const controller = new AbortController();
    void opsGet<{ task: OpsTask }>(`/api/admin/operations/tasks/${selectedId}`, controller.signal)
      .then(({ task }) => {
        setTasks((current) => current.map((item) => (item.id === task.id ? task : item)));
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setLoadError(
          cause instanceof Error ? cause.message : "Не удалось загрузить подробности задачи."
        );
      });
    return () => controller.abort();
  }, [demoMode, detailRefresh, selectedId]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (task.status === "CANCELLED") return false;
      if (
        normalized &&
        ![task.title, task.description, task.externalId, task.project?.title]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized))
      ) {
        return false;
      }
      if (scope === "overdue" && taskGroup(task) !== "Просрочено") return false;
      if (scope === "today" && !["Сегодня", "Просрочено"].includes(taskGroup(task))) {
        return false;
      }
      if (
        scope === "waiting" &&
        !["WAITING_HUMAN", "WAITING_EXTERNAL", "NEEDS_APPROVAL", "BLOCKED"].includes(task.status)
      ) {
        return false;
      }
      if (scope === "mine" && task.assignee?.id !== currentAdminId && !task.isShared) return false;
      if (statusFilter && task.status !== statusFilter) return false;
      if (projectId && task.project?.id !== projectId) return false;
      if (assigneeNone && (task.assignee || task.isShared)) return false;
      if (missingNextAction && task.nextAction) return false;
      return true;
    });
  }, [
    assigneeNone,
    currentAdminId,
    missingNextAction,
    projectId,
    query,
    scope,
    statusFilter,
    tasks,
  ]);

  const groups = useMemo(
    () =>
      ["Просрочено", "Сегодня", "Следующие"]
        .map((label) => ({ label, tasks: filtered.filter((task) => taskGroup(task) === label) }))
        .filter((group) => group.tasks.length),
    [filtered]
  );

  const selected = tasks.find((task) => task.id === selectedId) ?? null;
  const dragged = tasks.find((task) => task.id === draggedId) ?? null;
  const canWriteTask = useCallback(
    (task: OpsTask) =>
      canWrite &&
      (canManageAll ||
        task.isShared ||
        task.assignee?.id === currentAdminId ||
        task.createdBy?.id === currentAdminId),
    [canManageAll, canWrite, currentAdminId]
  );

  function openTask(task: OpsTask) {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      router.push(`/admin/operations/tasks/${task.id}`);
      return;
    }
    setSelectedId(task.id);
    if (view === "board") setBoardDetailOpen(true);
  }

  async function transitionTask(task: OpsTask, target: OpsTaskStatus) {
    if (
      !canWriteTask(task) ||
      task.status === target ||
      ["AGENT_RUNNING", "DONE", "CANCELLED"].includes(task.status)
    ) {
      return;
    }
    const waiting = ["WAITING_HUMAN", "WAITING_EXTERNAL", "NEEDS_APPROVAL", "BLOCKED"].includes(
      target
    );
    const nextAction = waiting ? null : task.nextAction || null;
    const blockerDescription = waiting ? task.blockerDescription || null : null;
    const previous = tasks;
    const optimistic = tasks.map((item) =>
      item.id === task.id
        ? {
            ...item,
            status: target,
            nextAction,
            blockerType: waiting
              ? blockerDescription
                ? target === "NEEDS_APPROVAL"
                  ? "APPROVAL"
                  : target === "WAITING_HUMAN"
                    ? "HUMAN"
                    : target === "WAITING_EXTERNAL"
                      ? "EXTERNAL"
                      : "OTHER"
                : null
              : null,
            blockerDescription,
            version: item.version + 1,
          }
        : item
    );
    setTasks(optimistic);
    setTransitionError(null);
    try {
      if (demoMode) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        return;
      }
      const response = await opsMutation<{ task: OpsTask }>({
        path: `/api/admin/operations/tasks/${task.id}/transition`,
        body: {
          status: target,
          nextAction,
          ...(waiting && blockerDescription
            ? {
                blockerType:
                  target === "NEEDS_APPROVAL"
                    ? "APPROVAL"
                    : target === "WAITING_HUMAN"
                      ? "HUMAN"
                      : target === "WAITING_EXTERNAL"
                        ? "EXTERNAL"
                        : "OTHER",
                blockerDescription,
              }
            : {}),
        },
        version: task.version,
        scope: `kanban:${task.id}`,
      });
      setTasks((current) => current.map((item) => (item.id === task.id ? response.task : item)));
    } catch (cause) {
      setTasks(previous);
      setTransitionError(cause instanceof Error ? cause.message : opsRu.tasks.transitionError);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setDraggedId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggedId(null);
    if (!event.over) return;
    const task = tasks.find((item) => item.id === String(event.active.id));
    if (!task) return;
    const overId = String(event.over.id);
    const lane =
      lanes.find((item) => item.id === overId) ??
      lanes.find((item) =>
        item.statuses.includes(tasks.find((candidate) => candidate.id === overId)?.status as never)
      );
    if (!lane) return;
    void transitionTask(task, lane.target);
  }

  async function createTask() {
    const title = newTitle.trim();
    if (!title || creating) return;
    setCreating(true);
    try {
      if (demoMode) {
        const task: OpsTask = {
          id: `demo-${Date.now()}`,
          externalId: `TSK-${Math.floor(Math.random() * 9000) + 1000}`,
          title,
          status: "INBOX",
          priority: "NORMAL",
          isShared: newTaskShared,
          version: 1,
        };
        setTasks((current) => [task, ...current]);
        setSelectedId(task.id);
      } else {
        const response = await opsMutation<{ task: OpsTask }>({
          path: "/api/admin/operations/tasks",
          body: { title, status: "INBOX", priority: "NORMAL", isShared: newTaskShared },
          scope: "task-create",
        });
        setTasks((current) => [response.task, ...current]);
        setSelectedId(response.task.id);
      }
      setNewTitle("");
      setNewTaskShared(false);
      setCreateOpen(false);
    } catch (cause) {
      setTransitionError(cause instanceof Error ? cause.message : "Не удалось создать задачу");
    } finally {
      setCreating(false);
    }
  }

  async function addQuickComment() {
    const text = quickCommentText.trim();
    const task = tasks.find((item) => item.id === quickCommentTaskId);
    if (!task || !text || quickCommentSaving || !canWriteTask(task)) return;
    setQuickCommentSaving(true);
    setTransitionError(null);
    try {
      if (!demoMode) {
        await opsMutation({
          path: `/api/admin/operations/tasks/${task.id}/comments`,
          body: { text },
          scope: `kanban-comment:${task.id}`,
        });
      }
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id
            ? {
                ...item,
                _count: {
                  children: item._count?.children ?? 0,
                  attachments: item._count?.attachments ?? 0,
                  comments: (item._count?.comments ?? 0) + 1,
                },
              }
            : item
        )
      );
      setQuickCommentTaskId(null);
      setQuickCommentText("");
      if (selectedId === task.id) setDetailRefresh((value) => value + 1);
    } catch (cause) {
      setTransitionError(cause instanceof Error ? cause.message : "Не удалось добавить заметку");
    } finally {
      setQuickCommentSaving(false);
    }
  }

  const scopeButtons: Array<{ value: Scope; label: string; count?: number }> = [
    { value: "all", label: "Все" },
    {
      value: "today",
      label: "Сегодня",
      count: tasks.filter((task) => ["Сегодня", "Просрочено"].includes(taskGroup(task))).length,
    },
    {
      value: "overdue",
      label: "Просрочено",
      count: tasks.filter((task) => taskGroup(task) === "Просрочено").length,
    },
    {
      value: "waiting",
      label: "Ожидание",
      count: tasks.filter((task) =>
        ["WAITING_HUMAN", "WAITING_EXTERNAL", "NEEDS_APPROVAL", "BLOCKED"].includes(task.status)
      ).length,
    },
  ];

  return (
    <OpsSurface inboxCount={inboxCount} permissions={permissions}>
      <OpsPageHeader
        title={opsRu.tasks.title}
        description={`${opsRu.tasks.subtitle} · ${new Intl.DateTimeFormat("ru-RU", {
          day: "numeric",
          month: "long",
        }).format(new Date())}`}
        actions={
          <>
            {canWrite ? (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <Plus className="h-5 w-5" />
                <span className="hidden sm:inline">{opsRu.tasks.create}</span>
                <span className="sm:hidden">Задача</span>
              </button>
            ) : null}
            {matchesAdminPermission(permissions, ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ) ? (
              <Link
                href="/admin/operations/knowledge"
                className="hidden h-11 items-center gap-2 rounded-lg border border-blue-600 px-4 text-sm font-semibold text-blue-600 hover:bg-blue-50 sm:flex"
              >
                БАЗА
              </Link>
            ) : null}
            <div className="hidden items-center rounded-lg border border-slate-200 bg-white p-1 lg:flex">
              {(
                [
                  ["list", List, opsRu.tasks.views.list],
                  ["board", Columns3, opsRu.tasks.views.board],
                  ["calendar", CalendarDays, opsRu.tasks.views.calendar],
                ] as const
              ).map(([value, Icon, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setView(value);
                    if (value !== "board") setBoardDetailOpen(false);
                  }}
                  aria-pressed={view === value}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-slate-600",
                    view === value && "bg-blue-600 text-white shadow-sm"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </>
        }
      />

      <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative block min-w-0 flex-1 lg:max-w-lg">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск задач…"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            <button
              type="button"
              onClick={() => setScope("mine")}
              className={cn(
                "h-10 shrink-0 rounded-lg border px-3 text-sm font-medium",
                scope === "mine"
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600"
              )}
            >
              Мои
              <span
                className={cn(
                  "ml-2 rounded-full px-1.5 py-0.5 text-xs",
                  scope === "mine" ? "bg-white/20" : "bg-slate-100 text-slate-700"
                )}
              >
                {
                  tasks.filter(
                    (task) =>
                      (task.assignee?.id === currentAdminId || task.isShared) &&
                      !["DONE", "CANCELLED"].includes(task.status)
                  ).length
                }
              </span>
            </button>
            {scopeButtons.map((button) => (
              <button
                key={button.value}
                type="button"
                onClick={() => setScope(button.value)}
                className={cn(
                  "flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium",
                  scope === button.value
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-600"
                )}
              >
                {button.label}
                {typeof button.count === "number" ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-xs",
                      scope === button.value ? "bg-white/20" : "bg-slate-100 text-slate-700"
                    )}
                  >
                    {button.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          {statusFilter || projectId || assigneeNone || missingNextAction ? (
            <button
              type="button"
              onClick={() => {
                setStatusFilter(null);
                setProjectId("");
                setAssigneeNone(false);
                setMissingNextAction(false);
              }}
              className="h-10 shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-medium text-blue-700"
            >
              Сбросить дополнительный фильтр
            </button>
          ) : null}
        </div>
      </div>

      {transitionError ? (
        <div
          role="alert"
          className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 sm:mx-6 lg:mx-8"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{transitionError}</span>
          <button type="button" onClick={() => setTransitionError(null)} aria-label="Закрыть">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-96 items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          {opsRu.common.loading}
        </div>
      ) : loadError ? (
        <div className="flex min-h-96 flex-col items-center justify-center px-6 text-center">
          <CircleAlert className="h-8 w-8 text-red-500" />
          <h2 className="mt-3 font-semibold text-slate-900">{opsRu.tasks.loadError}</h2>
          <p className="mt-1 max-w-md text-sm text-slate-500">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadTasks()}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            {opsRu.common.retry}
          </button>
        </div>
      ) : view === "board" ? (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDraggedId(null)}
          >
            <div className="hidden overflow-x-auto p-5 lg:block lg:px-8">
              <div className="flex min-w-max gap-4 pb-4">
                {lanes.map((lane) => (
                  <Lane
                    key={lane.id}
                    lane={lane}
                    tasks={filtered.filter((task) => lane.statuses.includes(task.status))}
                    onOpen={openTask}
                    onQuickComment={(task) => {
                      setQuickCommentTaskId(task.id);
                      setQuickCommentText("");
                    }}
                    canWriteTask={canWriteTask}
                  />
                ))}
              </div>
            </div>
            <DragOverlay>
              {dragged ? (
                <div className="w-[272px] rotate-1 border border-blue-300 bg-white p-3 shadow-2xl">
                  <div className="text-sm font-semibold">{dragged.title}</div>
                  <div className="mt-2 text-xs text-slate-500">
                    {OPS_STATUS_LABELS[dragged.status]}
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {boardDetailOpen && selected ? (
            <div
              className="fixed inset-0 z-[74] hidden bg-slate-950/35 lg:block"
              role="dialog"
              aria-modal="true"
              aria-label={`Задача: ${selected.title}`}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setBoardDetailOpen(false);
              }}
            >
              <aside className="absolute inset-y-0 right-0 w-full max-w-[760px] overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
                <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
                  <span className="truncate text-sm font-semibold text-slate-700">
                    Подробности задачи
                  </span>
                  <button
                    type="button"
                    onClick={() => setBoardDetailOpen(false)}
                    aria-label="Закрыть подробности"
                    className="flex h-10 w-10 items-center justify-center text-slate-500 hover:bg-slate-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <OpsTaskDetail
                  key={selected.id}
                  task={selected}
                  compact
                  demoMode={demoMode}
                  canLinkKnowledge={canLinkKnowledge}
                  initialKnowledge={initialKnowledge}
                  canWrite={canWriteTask(selected)}
                  canAssign={canManageAll}
                  canReadKnowledge={matchesAdminPermission(
                    permissions,
                    ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ
                  )}
                  automationsEnabled={automationsEnabled}
                  canRunAutomation={canRunAutomation && canWriteTask(selected)}
                  canDecideApprovals={canDecideApprovals}
                  onTaskChange={(updated) =>
                    setTasks((current) =>
                      current.map((item) => (item.id === updated.id ? updated : item))
                    )
                  }
                />
              </aside>
            </div>
          ) : null}
        </>
      ) : view === "calendar" ? (
        <div className="hidden overflow-x-auto p-5 lg:block lg:px-8">
          <TaskCalendar tasks={filtered} onOpen={openTask} />
        </div>
      ) : (
        <div className="grid min-h-[620px] grid-cols-1 bg-white lg:grid-cols-[minmax(390px,43%)_minmax(0,1fr)]">
          <div className="border-r border-slate-200 bg-white px-3 py-4 sm:px-5">
            {groups.length ? (
              <div className="space-y-5">
                {groups.map((group) => (
                  <section key={group.label}>
                    <header className="mb-1 flex items-center gap-2 px-2 py-1.5">
                      <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        {group.label}
                      </h2>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px]",
                          group.label === "Просрочено"
                            ? "bg-red-50 text-red-600"
                            : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {group.tasks.length}
                      </span>
                    </header>
                    <div>
                      {group.tasks.map((task) => (
                        <TaskListRow
                          key={task.id}
                          task={task}
                          selected={task.id === selectedId}
                          onSelect={() => openTask(task)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
                <List className="h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-medium text-slate-700">{opsRu.tasks.empty}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Измените фильтр или создайте новую задачу.
                </p>
              </div>
            )}
          </div>
          <div className="hidden min-w-0 bg-white lg:block">
            {selected ? (
              <OpsTaskDetail
                key={selected.id}
                task={selected}
                compact
                demoMode={demoMode}
                canLinkKnowledge={canLinkKnowledge}
                initialKnowledge={initialKnowledge}
                canWrite={canWriteTask(selected)}
                canAssign={canManageAll}
                canReadKnowledge={matchesAdminPermission(
                  permissions,
                  ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ
                )}
                automationsEnabled={automationsEnabled}
                canRunAutomation={canRunAutomation && canWriteTask(selected)}
                canDecideApprovals={canDecideApprovals}
                onTaskChange={(updated) =>
                  setTasks((current) =>
                    current.map((item) => (item.id === updated.id ? updated : item))
                  )
                }
              />
            ) : (
              <div className="flex h-full min-h-96 flex-col items-center justify-center text-center">
                <List className="h-9 w-9 text-slate-300" />
                <h2 className="mt-3 font-semibold text-slate-800">Выберите задачу</h2>
                <p className="mt-1 text-sm text-slate-500">Детали откроются здесь.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {quickCommentTaskId ? (
        <div
          className="fixed inset-0 z-[76] flex items-end bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ops-quick-comment-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !quickCommentSaving) {
              setQuickCommentTaskId(null);
            }
          }}
        >
          <div className="w-full rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="ops-quick-comment-title" className="text-lg font-bold text-slate-950">
                  Быстрая заметка
                </h2>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                  {tasks.find((task) => task.id === quickCommentTaskId)?.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickCommentTaskId(null)}
                disabled={quickCommentSaving}
                aria-label="Закрыть"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="mt-5 block">
              <span className="text-sm font-medium text-slate-700">Что изменилось?</span>
              <textarea
                autoFocus
                value={quickCommentText}
                onChange={(event) => setQuickCommentText(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                    void addQuickComment();
                  }
                }}
                rows={3}
                placeholder="Например: ОПЛАТИЛ"
                className="mt-2 w-full resize-y rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="mt-4 flex cursor-pointer items-start gap-3 border border-blue-200 bg-blue-50 p-3">
              <input
                type="checkbox"
                checked={newTaskShared}
                onChange={(event) => setNewTaskShared(event.target.checked)}
                className="mt-1 h-4 w-4 accent-blue-600"
              />
              <span>
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <UsersRound className="h-4 w-4 text-blue-600" />
                  Общая задача для всей команды
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-600">
                  Все участники доски смогут изменять её, добавлять комментарии и завершить работу.
                </span>
              </span>
            </label>
            <p className="mt-2 text-xs text-slate-500">
              Заметка сохранится в комментариях и истории задачи.
            </p>
            <div className="mt-5 flex justify-end gap-2 pb-[env(safe-area-inset-bottom)]">
              <button
                type="button"
                onClick={() => setQuickCommentTaskId(null)}
                disabled={quickCommentSaving}
                className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-medium disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void addQuickComment()}
                disabled={!quickCommentText.trim() || quickCommentSaving}
                className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {quickCommentSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquarePlus className="h-4 w-4" />
                )}
                Сохранить
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {createOpen && canWrite ? (
        <div
          className="fixed inset-0 z-[70] flex items-end bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ops-create-task-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCreateOpen(false);
          }}
        >
          <div className="w-full rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 id="ops-create-task-title" className="text-lg font-bold text-slate-950">
                Новая задача
              </h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="Закрыть"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="mt-5 block">
              <span className="text-sm font-medium text-slate-700">Название</span>
              <textarea
                autoFocus
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") void createTask();
                }}
                rows={3}
                placeholder="Что нужно сделать?"
                className="mt-2 w-full resize-none rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <p className="mt-2 text-xs text-slate-500">
              Новая задача попадёт во «Входящие». Детали можно добавить после создания.
            </p>
            <div className="mt-5 flex justify-end gap-2 pb-[env(safe-area-inset-bottom)]">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-medium"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void createTask()}
                disabled={!newTitle.trim() || creating}
                className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Создать
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </OpsSurface>
  );
}
