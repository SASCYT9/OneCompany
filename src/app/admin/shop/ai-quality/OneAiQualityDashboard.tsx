"use client";

import { useCallback, useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  Database,
  Layers3,
  MessageSquareWarning,
  PencilLine,
  RefreshCw,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";

import {
  AdminEmptyState,
  AdminInlineAlert,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableShell,
} from "@/components/admin/AdminPrimitives";
import type {
  OneAiFeedbackItem,
  OneAiIndexJob,
  OneAiQualitySnapshot,
  OneAiQueryTrace,
  OneAiReviewTask,
} from "@/lib/admin/oneAiQualityTypes";

import { OneAiQualityProductDrawer } from "./OneAiQualityProductDrawer";
import { OneAiQualityBulkPanel } from "./OneAiQualityBulkPanel";

type QualityTab = "overview" | "review" | "feedback" | "traces" | "jobs";

const TABS: Array<{ id: QualityTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "review", label: "Review queue" },
  { id: "feedback", label: "Feedback" },
  { id: "traces", label: "Query traces" },
  { id: "jobs", label: "Index jobs" },
];

function isQualitySnapshot(value: unknown): value is OneAiQualitySnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<OneAiQualitySnapshot>;
  return (
    typeof candidate.ready === "boolean" &&
    typeof candidate.checkedAt === "string" &&
    Array.isArray(candidate.missingTables) &&
    Boolean(candidate.overview) &&
    Array.isArray(candidate.reviewQueue) &&
    Array.isArray(candidate.feedback) &&
    Array.isArray(candidate.queryTraces) &&
    Array.isArray(candidate.indexJobs)
  );
}

function errorMessage(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const error = (value as { error?: unknown }).error;
  return typeof error === "string" ? error : null;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("uk-UA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPercent(value: number | null) {
  if (value === null) return "—";
  const normalized = value <= 1 ? value * 100 : value;
  return `${normalized.toFixed(1)}%`;
}

function statusTone(status: string) {
  if (["READY", "COMPLETED", "RESOLVED", "VERIFIED"].includes(status)) {
    return "success" as const;
  }
  if (["FAILED", "BLOCKED", "DEAD_LETTER", "REJECTED"].includes(status)) {
    return "danger" as const;
  }
  if (["NEEDS_REVIEW", "RETRY", "PENDING", "PROCESSING", "OPEN", "IN_REVIEW"].includes(status)) {
    return "warning" as const;
  }
  return "default" as const;
}

function priorityTone(priority: string) {
  if (priority === "CRITICAL") return "danger" as const;
  if (priority === "HIGH" || priority === "MEDIUM") return "warning" as const;
  return "default" as const;
}

export default function OneAiQualityDashboard() {
  const [data, setData] = useState<OneAiQualitySnapshot | null>(null);
  const [activeTab, setActiveTab] = useState<QualityTab>("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const load = useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    setError("");

    try {
      const response = await fetch("/api/admin/shop/ai-quality", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 403) {
          setError("Your admin role does not include shop.ai.read.");
        } else {
          setError(errorMessage(payload) ?? "Failed to load One AI quality data.");
        }
        return;
      }

      if (!isQualitySnapshot(payload)) {
        setError("One AI quality returned an invalid response.");
        return;
      }

      setData(payload);
    } catch {
      setError("One AI quality is temporarily unavailable. Try refreshing this page.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("initial");
  }, [load]);

  const closeProductEditor = useCallback(() => {
    setSelectedProductId(null);
  }, []);

  const handleProductChanged = useCallback(() => {
    void load("refresh");
  }, [load]);

  if (loading && !data) {
    return (
      <AdminPage className="space-y-4">
        <div className="h-24 motion-safe:animate-pulse border border-white/8 bg-white/3" />
        <div className="grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-28 motion-safe:animate-pulse border border-white/8 bg-white/3"
            />
          ))}
        </div>
        <div className="h-80 motion-safe:animate-pulse border border-white/8 bg-white/3" />
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6" wide>
      <AdminPageHeader
        eyebrow="Catalog intelligence"
        title="One AI Quality"
        description="Operational view of knowledge coverage, evidence, human review, customer feedback, retrieval traces, and revision-controlled corrections."
        actions={
          <>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-3 py-2 text-xs font-medium text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Revision-controlled
            </span>
            <button
              type="button"
              onClick={() => setBulkOpen((current) => !current)}
              className="inline-flex items-center gap-2 border border-blue-500/20 bg-blue-500/8 px-4 py-2 text-sm text-blue-200 transition hover:bg-blue-500/12"
            >
              <Layers3 className="h-4 w-4" />
              Controlled bulk
            </button>
            <button
              type="button"
              onClick={() => void load("refresh")}
              disabled={refreshing}
              className="inline-flex items-center gap-2 border border-white/10 bg-white/3 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/6 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "motion-safe:animate-spin" : ""}`} />
              Refresh
            </button>
          </>
        }
      />

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}

      {bulkOpen && data?.ready ? (
        <OneAiQualityBulkPanel
          onClose={() => setBulkOpen(false)}
          onApplied={() => void load("refresh")}
        />
      ) : null}

      {data ? (
        <>
          {!data.ready ? (
            <AdminInlineAlert tone="warning">
              Knowledge V2 is not ready in this database. No AI tables were queried and no data was
              changed.
            </AdminInlineAlert>
          ) : null}

          <QualityTabs activeTab={activeTab} onChange={setActiveTab} data={data} />

          {!data.ready ? (
            <MigrationNotReady data={data} activeTab={activeTab} />
          ) : (
            <TabContent activeTab={activeTab} data={data} onOpenProduct={setSelectedProductId} />
          )}

          <p className="text-right text-xs text-zinc-600">
            Snapshot checked {formatDate(data.checkedAt)} · latest 50 records per operational list
          </p>
        </>
      ) : (
        <AdminEmptyState
          title="One AI quality data is unavailable"
          description={error || "The read-only quality snapshot could not be loaded."}
        />
      )}

      <OneAiQualityProductDrawer
        productId={selectedProductId}
        onClose={closeProductEditor}
        onChanged={handleProductChanged}
      />
    </AdminPage>
  );
}

function QualityTabs({
  activeTab,
  onChange,
  data,
}: {
  activeTab: QualityTab;
  onChange: (tab: QualityTab) => void;
  data: OneAiQualitySnapshot;
}) {
  const counters: Partial<Record<QualityTab, number>> = {
    review: data.overview.openReviewTasks,
    feedback: data.overview.newFeedback,
    traces: data.queryTraces.length,
    jobs: data.overview.pendingJobs + data.overview.retryJobs + data.overview.deadLetterJobs,
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % TABS.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + TABS.length) % TABS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = TABS.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = TABS[nextIndex];
    onChange(nextTab.id);
    requestAnimationFrame(() => document.getElementById(`one-ai-tab-${nextTab.id}`)?.focus());
  };

  return (
    <div
      role="tablist"
      aria-label="One AI quality sections"
      className="flex gap-1 overflow-x-auto border-b border-white/8 pb-px"
    >
      {TABS.map((tab, index) => {
        const selected = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`one-ai-panel-${tab.id}`}
            id={`one-ai-tab-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm transition ${
              selected
                ? "border-blue-400 text-zinc-50"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab.label}
            {typeof counters[tab.id] === "number" ? (
              <span className="rounded-full border border-white/8 bg-white/4 px-2 py-0.5 text-[10px] tabular-nums">
                {counters[tab.id]}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function MigrationNotReady({
  data,
  activeTab,
}: {
  data: OneAiQualitySnapshot;
  activeTab: QualityTab;
}) {
  return (
    <section
      id={`one-ai-panel-${activeTab}`}
      role="tabpanel"
      aria-labelledby={`one-ai-tab-${activeTab}`}
      className="space-y-4"
    >
      <AdminMetricGrid className="xl:grid-cols-3">
        <AdminMetricCard
          label="Active published products"
          value={data.overview.activePublishedProducts.toLocaleString("uk-UA")}
          meta="Catalog records waiting for Knowledge V2 coverage"
          icon={<Database />}
        />
        <AdminMetricCard
          label="Knowledge coverage"
          value="0%"
          meta="V2 tables are not available"
          icon={<SearchCheck />}
        />
        <AdminMetricCard
          label="Missing tables"
          value={data.missingTables.length}
          meta="Migration must run in development/staging first"
          icon={<AlertTriangle />}
        />
      </AdminMetricGrid>

      <AdminEmptyState
        title="Knowledge V2 migration has not been applied"
        description="This screen intentionally stays read-only and returns a safe readiness state. Apply and verify the Knowledge V2 migration in development or staging before running a backfill."
        illustration={<Database className="h-12 w-12 text-blue-400" />}
        action={
          <div className="mx-auto max-w-3xl text-left">
            <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Missing database contracts
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.missingTables.map((table) => (
                <code
                  key={table}
                  className="border border-white/8 bg-black/25 px-2.5 py-1.5 text-xs text-zinc-400"
                >
                  {table}
                </code>
              ))}
            </div>
          </div>
        }
      />
    </section>
  );
}

function TabContent({
  activeTab,
  data,
  onOpenProduct,
}: {
  activeTab: QualityTab;
  data: OneAiQualitySnapshot;
  onOpenProduct: (productId: string) => void;
}) {
  const labelledBy = `one-ai-tab-${activeTab}`;
  const id = `one-ai-panel-${activeTab}`;

  return (
    <section id={id} role="tabpanel" aria-labelledby={labelledBy}>
      {activeTab === "overview" ? <OverviewPanel data={data} /> : null}
      {activeTab === "review" ? (
        <ReviewQueuePanel tasks={data.reviewQueue} onOpenProduct={onOpenProduct} />
      ) : null}
      {activeTab === "feedback" ? <FeedbackPanel feedback={data.feedback} /> : null}
      {activeTab === "traces" ? <QueryTracesPanel traces={data.queryTraces} /> : null}
      {activeTab === "jobs" ? <IndexJobsPanel jobs={data.indexJobs} /> : null}
    </section>
  );
}

function OverviewPanel({ data }: { data: OneAiQualitySnapshot }) {
  const overview = data.overview;
  const failedRunPercent =
    overview.runsLast24Hours > 0
      ? Math.round((overview.failedRunsLast24Hours / overview.runsLast24Hours) * 1000) / 10
      : 0;

  return (
    <div className="space-y-4">
      <AdminMetricGrid>
        <AdminMetricCard
          label="Knowledge coverage"
          value={`${overview.coveragePercent}%`}
          meta={`${overview.knowledgeRecords.toLocaleString("uk-UA")} of ${overview.activePublishedProducts.toLocaleString("uk-UA")} active products`}
          tone="accent"
          icon={<SearchCheck />}
        />
        <AdminMetricCard
          label="Ready knowledge"
          value={overview.readyKnowledge.toLocaleString("uk-UA")}
          meta={`${overview.needsReviewKnowledge.toLocaleString("uk-UA")} need review · ${overview.staleKnowledge.toLocaleString("uk-UA")} stale`}
          icon={<CheckCircle2 />}
        />
        <AdminMetricCard
          label="Runs · 24 hours"
          value={overview.runsLast24Hours.toLocaleString("uk-UA")}
          meta={`${overview.failedRunsLast24Hours} failed · ${failedRunPercent}% failure rate`}
          icon={<Activity />}
        />
        <AdminMetricCard
          label="Open operational work"
          value={(
            overview.openReviewTasks +
            overview.newFeedback +
            overview.pendingJobs +
            overview.retryJobs +
            overview.deadLetterJobs
          ).toLocaleString("uk-UA")}
          meta={`${overview.openReviewTasks} review · ${overview.newFeedback} feedback · ${overview.deadLetterJobs} dead-letter`}
          icon={<Clock3 />}
        />
      </AdminMetricGrid>

      <div className="grid gap-4 xl:grid-cols-3">
        <HealthCard
          icon={<Database />}
          title="Knowledge lifecycle"
          rows={[
            ["Ready", overview.readyKnowledge, "READY"],
            ["Needs review", overview.needsReviewKnowledge, "NEEDS_REVIEW"],
            ["Failed", overview.failedKnowledge, "FAILED"],
            ["Blocked", overview.blockedKnowledge, "BLOCKED"],
          ]}
        />
        <HealthCard
          icon={<RefreshCw />}
          title="Index queue"
          rows={[
            ["Pending", overview.pendingJobs, "PENDING"],
            ["Retry", overview.retryJobs, "RETRY"],
            ["Dead-letter", overview.deadLetterJobs, "DEAD_LETTER"],
            ["Stale records", overview.staleKnowledge, "NEEDS_REVIEW"],
          ]}
        />
        <div className="border border-white/8 bg-[#171717] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10 text-blue-300">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-medium text-zinc-100">Latest evaluation</h2>
              <p className="text-xs text-zinc-500">Golden-set release gate</p>
            </div>
          </div>
          {overview.lastEvaluation ? (
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-zinc-400">
                  {overview.lastEvaluation.suiteName} · {overview.lastEvaluation.suiteVersion}
                </span>
                <AdminStatusBadge tone={statusTone(overview.lastEvaluation.status)}>
                  {overview.lastEvaluation.status}
                </AdminStatusBadge>
              </div>
              <KeyValue
                label="Passed"
                value={`${overview.lastEvaluation.passedCases}/${overview.lastEvaluation.totalCases}`}
              />
              <KeyValue
                label="Recall@20"
                value={formatPercent(overview.lastEvaluation.recallAt20)}
              />
              <KeyValue
                label="No-match accuracy"
                value={formatPercent(overview.lastEvaluation.noMatchAccuracy)}
              />
              <KeyValue label="Completed" value={formatDate(overview.lastEvaluation.completedAt)} />
            </div>
          ) : (
            <p className="mt-5 text-sm leading-6 text-zinc-500">
              No evaluation run has been recorded yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function HealthCard({
  icon,
  title,
  rows,
}: {
  icon: ReactNode;
  title: string;
  rows: Array<[string, number, string]>;
}) {
  return (
    <div className="border border-white/8 bg-[#171717] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10 text-blue-300 [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </div>
        <h2 className="font-medium text-zinc-100">{title}</h2>
      </div>
      <div className="mt-5 divide-y divide-white/6">
        {rows.map(([label, value, status]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-3 first:pt-0">
            <span className="text-sm text-zinc-400">{label}</span>
            <div className="flex items-center gap-3">
              <span className="text-sm tabular-nums text-zinc-100">
                {value.toLocaleString("uk-UA")}
              </span>
              <AdminStatusBadge tone={statusTone(status)}>{status}</AdminStatusBadge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-white/6 pt-3 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right tabular-nums text-zinc-200">{value}</span>
    </div>
  );
}

function ReviewQueuePanel({
  tasks,
  onOpenProduct,
}: {
  tasks: OneAiReviewTask[];
  onOpenProduct: (productId: string) => void;
}) {
  if (tasks.length === 0) {
    return (
      <AdminEmptyState
        title="Review queue is clear"
        description="No open or in-review knowledge tasks were found."
        illustration={<CheckCircle2 className="h-12 w-12 text-emerald-400" />}
      />
    );
  }

  return (
    <QualityTable
      headings={["Priority", "Task", "Product", "Reasons", "Owner", "Created"]}
      rows={tasks.map((task) => (
        <tr key={task.id} className="border-t border-white/6 align-top">
          <td className="px-4 py-4">
            <AdminStatusBadge tone={priorityTone(task.priority)}>{task.priority}</AdminStatusBadge>
            <div className="mt-2">
              <AdminStatusBadge tone={statusTone(task.status)}>{task.status}</AdminStatusBadge>
            </div>
          </td>
          <td className="max-w-[360px] px-4 py-4">
            <div className="font-medium text-zinc-100">{task.title}</div>
            <div className="mt-1 text-xs text-zinc-500">{task.taskType}</div>
          </td>
          <td className="px-4 py-4">
            <div className="max-w-[280px] text-zinc-300">{task.productTitle}</div>
            <div className="mt-1 font-mono text-xs text-zinc-600">
              {task.productSku || task.productId}
            </div>
            {task.productId ? (
              <button
                type="button"
                onClick={() => onOpenProduct(task.productId!)}
                className="mt-3 inline-flex items-center gap-2 border border-blue-500/20 bg-blue-500/8 px-3 py-1.5 text-xs font-medium text-blue-300 transition hover:border-blue-500/35 hover:bg-blue-500/12 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
              >
                <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
                Review product
              </button>
            ) : (
              <div className="mt-2 text-[11px] text-zinc-600">
                No product is linked to this task.
              </div>
            )}
          </td>
          <td className="max-w-[300px] px-4 py-4">
            <ReasonCodes codes={task.reasonCodes} />
          </td>
          <td className="px-4 py-4 text-zinc-400">{task.assignedToId || "Unassigned"}</td>
          <td className="whitespace-nowrap px-4 py-4 text-zinc-500">
            {formatDate(task.createdAt)}
            {task.dueAt ? <div className="mt-1 text-xs">Due {formatDate(task.dueAt)}</div> : null}
          </td>
        </tr>
      ))}
    />
  );
}

function FeedbackPanel({ feedback }: { feedback: OneAiFeedbackItem[] }) {
  if (feedback.length === 0) {
    return (
      <AdminEmptyState
        title="No feedback recorded"
        description="Customer and manager quality signals will appear here after feedback capture is enabled."
        illustration={<MessageSquareWarning className="h-12 w-12 text-blue-400" />}
      />
    );
  }

  return (
    <QualityTable
      headings={["Signal", "Reason", "Query", "Comment", "Product", "Created"]}
      rows={feedback.map((item) => (
        <tr key={item.id} className="border-t border-white/6 align-top">
          <td className="px-4 py-4">
            <AdminStatusBadge tone={item.signal === "THUMBS_DOWN" ? "danger" : "default"}>
              {item.signal}
            </AdminStatusBadge>
            <div className="mt-2">
              <AdminStatusBadge tone={statusTone(item.status)}>{item.status}</AdminStatusBadge>
            </div>
          </td>
          <td className="px-4 py-4 text-zinc-300">{item.reason || "—"}</td>
          <td className="max-w-[320px] px-4 py-4 text-zinc-300">{item.redactedQuery || "—"}</td>
          <td className="max-w-[360px] px-4 py-4 text-zinc-400">{item.comment || "—"}</td>
          <td className="px-4 py-4 font-mono text-xs text-zinc-500">
            {item.productId || "No product"}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-zinc-500">
            {formatDate(item.createdAt)}
          </td>
        </tr>
      ))}
    />
  );
}

function QueryTracesPanel({ traces }: { traces: OneAiQueryTrace[] }) {
  if (traces.length === 0) {
    return (
      <AdminEmptyState
        title="No query traces"
        description="Sampled successful turns and all error/no-match turns will appear here."
        illustration={<Bot className="h-12 w-12 text-blue-400" />}
      />
    );
  }

  return (
    <QualityTable
      headings={["Query", "Result", "Candidates", "Latency", "Constraints", "Created"]}
      rows={traces.map((trace) => (
        <tr key={trace.id} className="border-t border-white/6 align-top">
          <td className="max-w-[360px] px-4 py-4">
            <div className="text-zinc-100">{trace.redactedQuery}</div>
            <div className="mt-1 text-xs text-zinc-500">
              {trace.locale.toUpperCase()} · {trace.scope || "all"} · {trace.requestId || trace.id}
            </div>
          </td>
          <td className="px-4 py-4">
            <AdminStatusBadge tone={statusTone(trace.status)}>{trace.status}</AdminStatusBadge>
            <div className="mt-2 text-xs text-zinc-500">
              {trace.mode || "—"}
              {trace.degraded ? " · degraded" : ""}
              {trace.errorCode ? ` · ${trace.errorCode}` : ""}
            </div>
          </td>
          <td className="px-4 py-4 text-sm tabular-nums text-zinc-300">
            <div>{trace.candidateCount} candidates</div>
            <div className="mt-1 text-xs text-zinc-500">
              {trace.exactCount} exact · {trace.verificationCount} verify · {trace.acceptedCount}{" "}
              accepted
            </div>
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-zinc-300">
            {trace.totalLatencyMs === null ? "—" : `${trace.totalLatencyMs} ms`}
            <div className="mt-1 text-xs text-zinc-500">
              retrieval {trace.retrievalLatencyMs === null ? "—" : `${trace.retrievalLatencyMs} ms`}
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              active CPU {trace.activeCpuMs === null ? "—" : `${trace.activeCpuMs} ms`}
            </div>
          </td>
          <td className="max-w-[380px] px-4 py-4">
            <code className="line-clamp-4 whitespace-pre-wrap break-all text-xs text-zinc-500">
              {JSON.stringify(trace.constraints)}
            </code>
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-zinc-500">
            {formatDate(trace.createdAt)}
          </td>
        </tr>
      ))}
    />
  );
}

function IndexJobsPanel({ jobs }: { jobs: OneAiIndexJob[] }) {
  if (jobs.length === 0) {
    return (
      <AdminEmptyState
        title="Index queue is empty"
        description="No pending, retry, dead-letter, or recently completed knowledge jobs were found."
        illustration={<Database className="h-12 w-12 text-blue-400" />}
      />
    );
  }

  return (
    <QualityTable
      headings={["Status", "Event", "Product", "Attempts", "Schedule", "Last error"]}
      rows={jobs.map((job) => (
        <tr key={job.id} className="border-t border-white/6 align-top">
          <td className="px-4 py-4">
            <AdminStatusBadge tone={statusTone(job.status)}>{job.status}</AdminStatusBadge>
          </td>
          <td className="px-4 py-4 text-zinc-300">{job.eventType}</td>
          <td className="max-w-[360px] px-4 py-4">
            <div className="text-zinc-200">{job.productTitle}</div>
            <div className="mt-1 font-mono text-xs text-zinc-600">{job.productId}</div>
          </td>
          <td className="px-4 py-4 tabular-nums text-zinc-300">
            {job.attempts}/{job.maxAttempts}
          </td>
          <td className="whitespace-nowrap px-4 py-4 text-zinc-400">
            <div>Available {formatDate(job.availableAt)}</div>
            <div className="mt-1 text-xs text-zinc-500">
              {job.processedAt
                ? `Processed ${formatDate(job.processedAt)}`
                : job.lockedAt
                  ? `Locked ${formatDate(job.lockedAt)}`
                  : `Updated ${formatDate(job.updatedAt)}`}
            </div>
          </td>
          <td className="max-w-[420px] px-4 py-4 text-zinc-400">{job.lastError || "—"}</td>
        </tr>
      ))}
    />
  );
}

function ReasonCodes({ codes }: { codes: string[] }) {
  if (codes.length === 0) return <span className="text-zinc-600">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {codes.map((code) => (
        <code
          key={code}
          className="rounded-full border border-white/8 bg-white/3 px-2 py-1 text-[10px] text-zinc-400"
        >
          {code}
        </code>
      ))}
    </div>
  );
}

function QualityTable({ headings, rows }: { headings: string[]; rows: ReactNode[] }) {
  return (
    <AdminTableShell>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/8 bg-white/3 text-[11px] uppercase tracking-wider text-zinc-500">
              {headings.map((heading) => (
                <th key={heading} className="px-4 py-3.5 font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </AdminTableShell>
  );
}
