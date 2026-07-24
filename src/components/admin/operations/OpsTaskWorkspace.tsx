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
  UserRound,
  UserX,
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
import type { OpsKnowledgeArticle, OpsPerson, OpsPriority, OpsTask, OpsTaskStatus } from "./types";

type View = "list" | "board" | "calendar";
type Scope = "all" | "mine" | "today" | "overdue" | "waiting";

type TeamSummary = {
  members: OpsPerson[];
  sharedTaskCount: number;
  activeTaskCount: number;
};

const lanes: Array<{
  id: string;
  label: string;
  statuses: OpsTaskStatus[];
  target: OpsTaskStatus;
  tone: string;
}> = [
  {
    id: "lane-todo",
    label: "К выполнению",
    statuses: ["INBOX", "PLANNED"],
    target: "PLANNED",
    tone: "bg-indigo-500",
  },
  {
    id: "lane-work",
    label: "В работе",
    statuses: ["IN_PROGRESS", "AGENT_RUNNING"],
    target: "IN_PROGRESS",
    tone: "bg-blue-500",
  },
  {
    id: "lane-waiting",
    label: "Ожидание",
    statuses: ["WAITING_HUMAN", "WAITING_EXTERNAL", "NEEDS_APPROVAL", "BLOCKED"],
    target: "WAITING_HUMAN",
    tone: "bg-amber-400",
  },
  {
    id: "lane-done",
    label: "Готово",
    statuses: ["DONE"],
    target: "DONE",
    tone: "bg-emerald-500",
  },
];

const priorityDot: Record<OpsPriority, string> = {
  LOW: "bg-slate-300",
  NORMAL: "bg-amber-400",
  HIGH: "bg-red-500",
  URGENT: "bg-rose-600",
};

const memberTones = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-cyan-100 text-cyan-700",
  "bg-rose-100 text-rose-700",
] as const;

const statusTone: Record<OpsTaskStatus, string> = {
  INBOX: "text-slate-600",
  PLANNED: "text-blue-700",
  IN_PROGRESS: "text-blue-700",
  AGENT_RUNNING: "text-violet-700",
  WAITING_HUMAN: "text-amber-700",
  WAITING_EXTERNAL: "text-amber-700",
  NEEDS_APPROVAL: "text-orange-700",
  REVIEW: "text-violet-700",
  BLOCKED: "text-red-700",
  DONE: "text-emerald-700",
  CANCELLED: "text-slate-500",
};

function memberTone(id: string) {
  const hash = Array.from(id).reduce((total, character) => total + character.charCodeAt(0), 0);
  return memberTones[hash % memberTones.length];
}

function initials(name?: string | null) {
  if (!name) return "—";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function taskAssignees(task: OpsTask): OpsPerson[] {
  const people = (task.assignees ?? []).map((entry) =>
    "adminUser" in entry ? entry.adminUser : entry
  );
  if (!people.length && task.assignee) people.push(task.assignee);

  return Array.from(new Map(people.map((person) => [person.id, person])).values());
}

function taskHasAssignee(task: OpsTask, adminUserId: string) {
  return taskAssignees(task).some((person) => person.id === adminUserId);
}

function AssigneeMark({
  task,
  showName = false,
  compact = false,
}: {
  task: OpsTask;
  showName?: boolean;
  compact?: boolean;
}) {
  const people = taskAssignees(task);
  const primary = people[0];
  const extraCount = Math.max(0, people.length - 1);
  const label = task.isShared
    ? "Вся команда"
    : people.length
      ? people.map((person) => person.name || person.email).join(", ")
      : "Не назначен";

  return (
    <span className="flex min-w-0 items-center gap-1.5" title={label} aria-label={label}>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full font-bold",
          compact ? "h-6 min-w-6 px-1 text-[9px]" : "h-7 min-w-7 px-1.5 text-[10px]",
          task.isShared
            ? "bg-blue-600 text-white"
            : primary
              ? memberTone(primary.id)
              : "bg-slate-100 text-slate-500"
        )}
      >
        {task.isShared ? "ВСЕ" : initials(primary?.name)}
      </span>
      {!task.isShared && extraCount ? (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-slate-800 font-bold text-white",
            compact ? "h-5 min-w-5 px-1 text-[9px]" : "h-6 min-w-6 px-1.5 text-[10px]"
          )}
        >
          +{extraCount}
        </span>
      ) : null}
      {showName ? (
        <span className="min-w-0 truncate">
          {task.isShared
            ? "Вся команда"
            : primary
              ? `${primary.name?.split(" ")[0] || primary.email}${extraCount ? ` +${extraCount}` : ""}`
              : "Не назначен"}
        </span>
      ) : null}
    </span>
  );
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
  showAssignee,
  onSelect,
}: {
  task: OpsTask;
  selected?: boolean;
  showAssignee?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group grid w-full grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-3 border-b border-l-2 border-b-slate-100 border-l-transparent px-3 py-3 text-left transition last:border-b-0 hover:bg-slate-50 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-blue-500",
        selected && "border-l-blue-600 bg-blue-50/80"
      )}
    >
      <span className={cn("h-2.5 w-2.5 rounded-full", priorityDot[task.priority])} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-5 text-slate-900">
          {task.number ? <span className="mr-1.5 text-blue-600">#{task.number}</span> : null}
          {task.title}
        </span>
        {task.nextAction ? (
          <span className="mt-0.5 hidden truncate text-xs text-slate-500 sm:block">
            {task.nextAction}
          </span>
        ) : null}
        <span className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          {showAssignee ? (
            <span className="flex max-w-36 min-w-0 items-center gap-1.5 border-r border-slate-200 pr-2">
              <AssigneeMark task={task} showName compact />
            </span>
          ) : null}
          <span className={cn("shrink-0 font-medium", statusTone[task.status])}>
            {OPS_STATUS_LABELS[task.status]}
          </span>
          <span
            className={cn(
              "flex shrink-0 items-center gap-1",
              taskGroup(task) === "Просрочено" && "font-medium text-red-600"
            )}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            {dueText(task.dueAt)}
          </span>
        </span>
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

function TeamRail({
  members,
  currentAdminId,
  selectedMemberId,
  assigneeNone,
  activeTaskCount,
  scope,
  onSelect,
  onScopeChange,
}: {
  members: OpsPerson[];
  currentAdminId: string;
  selectedMemberId: string | null;
  assigneeNone: boolean;
  activeTaskCount: number;
  scope?: Scope;
  onSelect: (memberId: string | null | "none") => void;
  onScopeChange?: (scope: Scope) => void;
}) {
  const current = members.find((member) => member.id === currentAdminId);
  const others = members.filter((member) => member.id !== currentAdminId);
  const maxCount = Math.max(1, ...members.map((member) => member.activeTaskCount ?? 0));

  const memberButton = (member: OpsPerson, mine = false) => {
    const selected = selectedMemberId === member.id && !assigneeNone;
    return (
      <button
        key={mine ? `mine-${member.id}` : member.id}
        type="button"
        onClick={() => onSelect(member.id)}
        aria-pressed={selected}
        className={cn(
          "grid w-full grid-cols-[36px_minmax(0,1fr)_30px] items-center gap-2 border-l-2 border-transparent px-3 py-3 text-left transition hover:bg-slate-50",
          selected && "border-l-blue-600 bg-blue-50"
        )}
      >
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold",
            memberTone(member.id)
          )}
        >
          {initials(member.name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-slate-800">
            {mine ? "Мои задачи" : member.name || member.email}
          </span>
          <span className="mt-1 block h-1 overflow-hidden bg-slate-100">
            <span
              className="block h-full bg-blue-600"
              style={{ width: `${Math.max(8, ((member.activeTaskCount ?? 0) / maxCount) * 100)}%` }}
            />
          </span>
        </span>
        <span className="text-right text-xs font-semibold text-slate-600">
          {member.activeTaskCount ?? 0}
        </span>
      </button>
    );
  };

  return (
    <aside className="hidden border-r border-slate-200 bg-white lg:block">
      <div className="sticky top-0 py-4">
        <h2 className="px-4 pb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
          Участники
        </h2>
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-pressed={!selectedMemberId && !assigneeNone}
          className={cn(
            "grid w-full grid-cols-[36px_minmax(0,1fr)_30px] items-center gap-2 border-l-2 border-transparent px-3 py-3 text-left transition hover:bg-slate-50",
            !selectedMemberId && !assigneeNone && "border-l-blue-600 bg-blue-50"
          )}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white">
            <UsersRound className="h-4 w-4" />
          </span>
          <span className="truncate text-sm font-medium text-slate-800">Все задачи</span>
          <span className="text-right text-xs font-semibold text-slate-600">{activeTaskCount}</span>
        </button>
        {current ? memberButton(current, true) : null}
        <div className="my-1 border-t border-slate-100" />
        {others.map((member) => memberButton(member))}
        <button
          type="button"
          onClick={() => onSelect("none")}
          aria-pressed={assigneeNone}
          className={cn(
            "mt-1 flex w-full items-center gap-3 border-l-2 border-transparent px-4 py-3 text-left text-sm text-slate-600 hover:bg-slate-50",
            assigneeNone && "border-l-blue-600 bg-blue-50 text-slate-900"
          )}
        >
          <UserX className="h-4 w-4 text-slate-400" />
          Без исполнителя
        </button>
        {onScopeChange ? (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <h2 className="px-4 pb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              Представления
            </h2>
            {(
              [
                ["today", "Сегодня", CalendarDays],
                ["overdue", "Просрочено", CircleAlert],
                ["waiting", "Ожидание", Loader2],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => onScopeChange(value)}
                aria-pressed={scope === value}
                className={cn(
                  "flex w-full items-center gap-3 border-l-2 border-transparent px-4 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-50",
                  scope === value && "border-l-blue-600 bg-blue-50 font-medium text-blue-700"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
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
        "cursor-pointer rounded-none border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-blue-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-blue-500",
        isDragging && "opacity-40"
      )}
    >
      <div>
        <div className="flex items-start gap-2">
          <span
            className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", priorityDot[task.priority])}
          />
          <h3 className="min-w-0 flex-1 text-sm font-semibold leading-5 text-slate-900">
            {task.number ? <span className="mr-1.5 text-blue-600">#{task.number}</span> : null}
            {task.title}
          </h3>
        </div>
        {task.project ? (
          <p className="mt-2 truncate text-[11px] text-slate-500">{task.project.title}</p>
        ) : null}
        {task.nextAction || task.blockerDescription ? (
          <p className="mt-2 line-clamp-2 text-xs leading-4 text-slate-500">
            {task.nextAction || task.blockerDescription}
          </p>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
        <AssigneeMark task={task} />
        <div className="flex items-center gap-2">
          {canWrite ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onQuickComment();
              }}
              aria-label={`Добавить заметку к задаче ${task.title}`}
              className="rounded-none p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-500"
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
            className="cursor-grab touch-none rounded-none px-2 py-1 text-xs font-bold text-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 active:cursor-grabbing"
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
        "flex min-h-[620px] min-w-[190px] flex-col bg-slate-50/70 px-2.5 py-3",
        isOver && "bg-blue-50"
      )}
    >
      <header className="mb-3 flex items-center gap-2 border-b border-slate-200 px-1 pb-3">
        <span className={cn("h-2.5 w-2.5 rounded-full", lane.tone)} />
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600">{lane.label}</h2>
        <span className="ml-auto bg-white px-2 py-0.5 text-[11px] text-slate-500">
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
        <div className="flex flex-1 items-start justify-center border-t border-dashed border-slate-200 px-3 pt-8 text-center text-xs text-slate-400">
          Нет задач
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
                  {task.number ? `#${task.number} ` : ""}
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
  initialAssigneeId,
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
  initialAssigneeId?: string;
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
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(
    initialScope === "mine" ? currentAdminId : (initialAssigneeId ?? null)
  );
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
  const [teamSummary, setTeamSummary] = useState<TeamSummary>({
    members: [],
    sharedTaskCount: 0,
    activeTaskCount:
      initialTasks?.filter((task) => !["DONE", "CANCELLED"].includes(task.status)).length ?? 0,
  });

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
      if (selectedMemberId) params.set("assignee", selectedMemberId);
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
  }, [
    assigneeNone,
    demoMode,
    missingNextAction,
    projectId,
    query,
    scope,
    selectedMemberId,
    statusFilter,
  ]);

  useEffect(() => {
    if (demoMode) {
      const byId = new Map<string, OpsPerson>();
      for (const task of initialTasks ?? []) {
        for (const assignee of taskAssignees(task)) {
          const existing = byId.get(assignee.id);
          byId.set(assignee.id, {
            ...assignee,
            activeTaskCount:
              (existing?.activeTaskCount ?? 0) +
              (!["DONE", "CANCELLED"].includes(task.status) ? 1 : 0),
          });
        }
      }
      setTeamSummary((current) => ({ ...current, members: Array.from(byId.values()) }));
      return;
    }
    const controller = new AbortController();
    void opsGet<TeamSummary>("/api/admin/operations/members", controller.signal)
      .then(setTeamSummary)
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setTransitionError(
          cause instanceof Error ? cause.message : "Не удалось загрузить участников"
        );
      });
    return () => controller.abort();
  }, [demoMode, initialTasks]);

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
      if (scope === "mine" && !taskHasAssignee(task, currentAdminId) && !task.isShared)
        return false;
      if (selectedMemberId && !taskHasAssignee(task, selectedMemberId) && !task.isShared)
        return false;
      if (statusFilter && task.status !== statusFilter) return false;
      if (projectId && task.project?.id !== projectId) return false;
      if (assigneeNone && (taskAssignees(task).length || task.isShared)) return false;
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
    selectedMemberId,
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

  useEffect(() => {
    setSelectedId((current) =>
      current && filtered.some((task) => task.id === current) ? current : (filtered[0]?.id ?? null)
    );
  }, [filtered]);

  const selected = tasks.find((task) => task.id === selectedId) ?? null;
  const selectedMember =
    teamSummary.members.find((member) => member.id === selectedMemberId) ?? null;
  const dragged = tasks.find((task) => task.id === draggedId) ?? null;
  const canWriteTask = useCallback(
    (task: OpsTask) =>
      canWrite &&
      (canManageAll ||
        task.isShared ||
        taskHasAssignee(task, currentAdminId) ||
        task.createdBy?.id === currentAdminId),
    [canManageAll, canWrite, currentAdminId]
  );

  function openTask(task: OpsTask) {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      router.push(`/admin/operations/tasks/${task.id}`);
      return;
    }
    setSelectedId(task.id);
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

  function selectTeamMember(memberId: string | null | "none") {
    const nextMemberId = memberId === "none" ? null : memberId;
    setSelectedMemberId(nextMemberId);
    setAssigneeNone(memberId === "none");
    setScope("all");
    const params = new URLSearchParams(window.location.search);
    if (memberId) params.set("assignee", memberId);
    else params.delete("assignee");
    params.delete("scope");
    const queryString = params.toString();
    window.history.replaceState(
      null,
      "",
      queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname
    );
  }

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
                  onClick={() => setView(value)}
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
          <label className={cn("relative min-w-0", view === "list" ? "lg:hidden" : "lg:w-64")}>
            <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              value={assigneeNone ? "none" : (selectedMemberId ?? "")}
              onChange={(event) => selectTeamMember(event.target.value || null)}
              aria-label="Фильтр по участнику"
              className="h-11 w-full appearance-none border border-slate-300 bg-white pl-10 pr-8 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Все участники</option>
              {teamSummary.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.id === currentAdminId ? "Мои задачи" : member.name || member.email} ·{" "}
                  {member.activeTaskCount ?? 0}
                </option>
              ))}
              <option value="none">Без исполнителя</option>
            </select>
          </label>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
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
          {statusFilter || projectId || selectedMemberId || assigneeNone || missingNextAction ? (
            <button
              type="button"
              onClick={() => {
                setStatusFilter(null);
                setProjectId("");
                selectTeamMember(null);
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
        <div className="hidden min-h-[650px] grid-cols-[minmax(720px,1fr)_480px] bg-white lg:grid xl:grid-cols-[minmax(760px,1fr)_500px] 2xl:grid-cols-[minmax(820px,1fr)_540px]">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDraggedId(null)}
          >
            <div className="min-w-0 overflow-x-auto border-r border-slate-200 bg-slate-50/70">
              <div className="grid min-w-[720px] grid-cols-4 divide-x divide-slate-200">
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
                <div className="w-[240px] rotate-1 border border-blue-300 bg-white p-3 shadow-2xl">
                  <div className="text-sm font-semibold">{dragged.title}</div>
                  <div className="mt-2 text-xs text-slate-500">
                    {OPS_STATUS_LABELS[dragged.status]}
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
          <aside className="min-w-0 overflow-y-auto bg-white">
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
              <div className="flex min-h-[620px] items-center justify-center px-8 text-center text-sm text-slate-500">
                Выберите задачу на доске, чтобы открыть подробности.
              </div>
            )}
          </aside>
        </div>
      ) : view === "calendar" ? (
        <div className="hidden overflow-x-auto p-5 lg:block lg:px-8">
          <TaskCalendar tasks={filtered} onOpen={openTask} />
        </div>
      ) : (
        <div className="grid min-h-[620px] grid-cols-1 bg-white lg:grid-cols-[210px_minmax(390px,38%)_minmax(0,1fr)] xl:grid-cols-[230px_460px_minmax(0,1fr)] 2xl:grid-cols-[240px_520px_minmax(0,1fr)]">
          <TeamRail
            members={teamSummary.members}
            currentAdminId={currentAdminId}
            selectedMemberId={selectedMemberId}
            assigneeNone={assigneeNone}
            activeTaskCount={teamSummary.activeTaskCount}
            scope={scope}
            onSelect={selectTeamMember}
            onScopeChange={setScope}
          />
          <div className="border-r border-slate-200 bg-white px-3 py-4 sm:px-5">
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-200 px-2 pb-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold text-slate-950">
                  {assigneeNone
                    ? "Задачи без исполнителя"
                    : selectedMember
                      ? `Задачи · ${selectedMember.name || selectedMember.email}`
                      : "Все задачи команды"}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {filtered.length} {filtered.length === 1 ? "задача" : "задач"}
                </p>
              </div>
              {selectedMember ? (
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                    memberTone(selectedMember.id)
                  )}
                >
                  {initials(selectedMember.name)}
                </span>
              ) : null}
            </div>
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
                          showAssignee={!selectedMemberId && !assigneeNone}
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
