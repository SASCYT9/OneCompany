"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Braces,
  ChevronRight,
  FileText,
  Gauge,
  History,
  Layers3,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Tags,
  Wrench,
  X,
} from "lucide-react";

import {
  AdminEmptyState,
  AdminInlineAlert,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import type { OneAiQualityAction } from "@/lib/admin/oneAiQualityMutation";
import type {
  OneAiQualityAttributeValue,
  OneAiQualityMutationResult,
  OneAiQualityProductDetail,
  OneAiQualityVehicleApplication,
} from "@/lib/admin/oneAiQualityTypes";

import {
  OneAiQualityActionEditor,
  type OneAiQualityActionRequest,
} from "./OneAiQualityActionEditor";

type DetailTab =
  | "source"
  | "variants"
  | "fitment"
  | "attributes"
  | "evidence"
  | "history"
  | "actions";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function isProductDetail(value: unknown): value is OneAiQualityProductDetail {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<OneAiQualityProductDetail>;
  if (typeof candidate.ready !== "boolean") return false;
  if (!candidate.product || typeof candidate.product !== "object") return false;
  const product = candidate.product as { id?: unknown; variants?: unknown };
  return typeof product.id === "string" && Array.isArray(product.variants);
}

function isMutationResult(value: unknown): value is OneAiQualityMutationResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<OneAiQualityMutationResult>;
  return (
    typeof candidate.productId === "string" &&
    typeof candidate.revision === "number" &&
    typeof candidate.action === "string"
  );
}

function payloadError(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const error = (value as { error?: unknown }).error;
  return typeof error === "string" ? error : null;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("uk-UA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusTone(status: string) {
  if (["READY", "VERIFIED", "COMPLETED", "ACTIVE"].includes(status)) {
    return "success" as const;
  }
  if (["FAILED", "BLOCKED", "DEAD_LETTER"].includes(status)) {
    return "danger" as const;
  }
  if (["NEEDS_REVIEW", "PENDING", "PROCESSING", "RETRY", "OPEN"].includes(status)) {
    return "warning" as const;
  }
  return "default" as const;
}

function compactJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function OneAiQualityProductDrawer({
  productId,
  onClose,
  onChanged,
}: {
  productId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const open = Boolean(productId);
  const reducedMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [detail, setDetail] = useState<OneAiQualityProductDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState<DetailTab>("source");
  const [submittingAction, setSubmittingAction] = useState<OneAiQualityAction | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [conflict, setConflict] = useState<{
    expectedRevision: number;
    currentRevision: number;
  } | null>(null);

  const loadProduct = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setLoadError("");

    try {
      const response = await fetch(
        `/api/admin/shop/ai-quality/products/${encodeURIComponent(productId)}`,
        {
          cache: "no-store",
          credentials: "same-origin",
        }
      );
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 403) {
          setLoadError(
            "Your admin role does not include shop.ai.review, so product evidence cannot be opened."
          );
        } else {
          setLoadError(payloadError(payload) ?? "Failed to load this product quality record.");
        }
        return;
      }
      if (!isProductDetail(payload)) {
        setLoadError("The product quality endpoint returned an invalid response.");
        return;
      }
      setDetail(payload);
    } catch {
      setLoadError("The product quality record is temporarily unavailable. Try reloading it.");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (!open) {
      setDetail(null);
      setLoadError("");
      setActionError("");
      setActionSuccess("");
      setConflict(null);
      setActiveTab("source");
      return;
    }
    setDetail(null);
    setActionError("");
    setActionSuccess("");
    setConflict(null);
    setActiveTab("source");
    void loadProduct();
  }, [loadProduct, open]);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 30);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(
        (element) =>
          !element.hasAttribute("disabled") &&
          element.getAttribute("aria-hidden") !== "true" &&
          element.offsetParent !== null
      );
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!panelRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = originalOverflow;
      returnFocusRef.current?.focus();
    };
  }, [onClose, open]);

  async function submitAction(request: OneAiQualityActionRequest) {
    const knowledge = detail?.product.knowledge;
    if (!productId || !knowledge) return;

    const expectedRevision = knowledge.revision;
    setSubmittingAction(request.action);
    setActionError("");
    setActionSuccess("");
    setConflict(null);

    try {
      const response = await fetch(
        `/api/admin/shop/ai-quality/products/${encodeURIComponent(productId)}`,
        {
          method: "PATCH",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...request,
            expectedRevision,
          }),
        }
      );
      const payload: unknown = await response.json().catch(() => null);
      if (response.status === 409) {
        const candidate =
          payload && typeof payload === "object"
            ? (payload as {
                code?: unknown;
                currentRevision?: unknown;
                expectedRevision?: unknown;
              })
            : null;
        if (
          candidate?.code === "REVISION_CONFLICT" &&
          typeof candidate.currentRevision === "number" &&
          typeof candidate.expectedRevision === "number"
        ) {
          setConflict({
            expectedRevision: candidate.expectedRevision,
            currentRevision: candidate.currentRevision,
          });
          return;
        }
      }
      if (!response.ok) {
        if (response.status === 403) {
          setActionError(
            "Your admin role does not include shop.ai.manage. This record was not changed."
          );
        } else {
          setActionError(payloadError(payload) ?? "The manager action could not be applied.");
        }
        return;
      }
      if (!isMutationResult(payload)) {
        setActionError("The mutation endpoint returned an invalid response.");
        return;
      }

      await loadProduct();
      onChanged();
      const successMessage =
        request.action === "undo" && typeof payload.restoredFromRevision === "number"
          ? `Revision ${payload.restoredFromRevision} was restored as new revision ${payload.revision}.`
          : `${request.action} saved as revision ${payload.revision}.`;
      setActionSuccess(
        payload.reindexQueued ? `${successMessage} Reindex is queued.` : successMessage
      );
    } catch {
      setActionError(
        "The manager action failed before confirmation. No success was assumed; reload the record before retrying."
      );
    } finally {
      setSubmittingAction(null);
    }
  }

  async function reloadLatest() {
    setConflict(null);
    setActionError("");
    setActionSuccess("");
    await loadProduct();
  }

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-100" aria-live="off">
          <motion.button
            type="button"
            aria-label="Close product quality editor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.18 }}
            onClick={onClose}
            className="absolute inset-0 h-full w-full cursor-default bg-black/65 backdrop-blur-xs"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={-1}
            initial={{ x: reducedMotion ? 0 : "100%", opacity: reducedMotion ? 1 : 0.85 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: reducedMotion ? 0 : "100%", opacity: reducedMotion ? 1 : 0.85 }}
            transition={
              reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 34 }
            }
            className="absolute inset-y-0 right-0 flex w-full max-w-[1180px] flex-col overflow-hidden border-l border-white/8 bg-[#0f0f0f] shadow-[-32px_0_90px_rgba(0,0,0,0.75)] outline-hidden"
          >
            <header className="shrink-0 border-b border-white/6 bg-[#171717] px-4 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-400">
                      Single-product quality editor
                    </span>
                    {detail?.product.knowledge ? (
                      <AdminStatusBadge tone={statusTone(detail.product.knowledge.status)}>
                        {detail.product.knowledge.status}
                      </AdminStatusBadge>
                    ) : null}
                  </div>
                  <h2
                    id={titleId}
                    className="mt-2 truncate text-lg font-semibold tracking-tight text-zinc-50 sm:text-xl"
                  >
                    {detail?.product.titleUa || detail?.product.titleEn || "Product quality"}
                  </h2>
                  <p id={descriptionId} className="mt-1 truncate text-xs text-zinc-500">
                    {detail
                      ? [detail.product.brand, detail.product.sku, detail.product.slug]
                          .filter(Boolean)
                          .join(" · ")
                      : productId}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void reloadLatest()}
                    disabled={loading || submittingAction !== null}
                    aria-label="Reload product quality"
                    className="inline-flex h-9 w-9 items-center justify-center border border-white/8 bg-white/3 text-zinc-400 transition hover:border-white/15 hover:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${loading ? "motion-safe:animate-spin" : ""}`}
                      aria-hidden="true"
                    />
                  </button>
                  <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={onClose}
                    aria-label="Close product quality editor"
                    className="inline-flex h-9 w-9 items-center justify-center border border-white/8 bg-white/3 text-zinc-400 transition hover:border-white/15 hover:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </header>

            {detail ? (
              <DetailTabs activeTab={activeTab} onChange={setActiveTab} detail={detail} />
            ) : null}

            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
              {loading && !detail ? <DrawerLoading /> : null}
              {loadError ? (
                <div className="space-y-4">
                  <AdminInlineAlert tone="error">{loadError}</AdminInlineAlert>
                  <button
                    type="button"
                    onClick={() => void loadProduct()}
                    className="inline-flex h-9 items-center gap-2 border border-white/10 bg-white/3 px-4 text-sm text-zinc-100 transition hover:bg-white/6 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Try again
                  </button>
                </div>
              ) : null}
              {detail ? (
                <div className="mx-auto max-w-[1080px]">
                  <div hidden={activeTab !== "source"}>
                    <SourcePanel detail={detail} />
                  </div>
                  <div hidden={activeTab !== "variants"}>
                    <VariantsPanel detail={detail} />
                  </div>
                  <div hidden={activeTab !== "fitment"}>
                    <FitmentPanel detail={detail} />
                  </div>
                  <div hidden={activeTab !== "attributes"}>
                    <AttributesPanel detail={detail} />
                  </div>
                  <div hidden={activeTab !== "evidence"}>
                    <EvidencePanel detail={detail} />
                  </div>
                  <div hidden={activeTab !== "history"}>
                    <HistoryPanel
                      key={`${detail.product.id}:history:${detail.product.knowledge?.revision ?? 0}`}
                      detail={detail}
                      busy={submittingAction !== null}
                      submitting={submittingAction === "undo"}
                      error={actionError}
                      success={actionSuccess}
                      conflict={conflict}
                      onReload={() => void reloadLatest()}
                      onUndo={async (targetRevisionId, reason) => {
                        await submitAction({
                          action: "undo",
                          targetRevisionId,
                          reason,
                        });
                      }}
                    />
                  </div>
                  <div hidden={activeTab !== "actions"}>
                    <OneAiQualityActionEditor
                      key={`${detail.product.id}:${detail.product.knowledge?.revision ?? 0}`}
                      detail={detail}
                      submittingAction={submittingAction}
                      error={actionError}
                      success={actionSuccess}
                      conflict={conflict}
                      onReload={() => void reloadLatest()}
                      onSubmit={submitAction}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

function DetailTabs({
  activeTab,
  onChange,
  detail,
}: {
  activeTab: DetailTab;
  onChange: (tab: DetailTab) => void;
  detail: OneAiQualityProductDetail;
}) {
  const knowledge = detail.product.knowledge;
  const tabs: Array<{
    id: DetailTab;
    label: string;
    count?: number;
    icon: typeof FileText;
  }> = [
    { id: "source", label: "Source", icon: FileText },
    {
      id: "variants",
      label: "Variants",
      count: detail.product.variants.length,
      icon: Layers3,
    },
    {
      id: "fitment",
      label: "Applications",
      count: knowledge?.vehicleApplications.length ?? 0,
      icon: Wrench,
    },
    {
      id: "attributes",
      label: "Attributes",
      count: knowledge?.attributeValues.length ?? 0,
      icon: Tags,
    },
    {
      id: "evidence",
      label: "Evidence",
      count: knowledge?.evidence.length ?? 0,
      icon: ShieldCheck,
    },
    {
      id: "history",
      label: "Revisions",
      count: knowledge?.revisions.length ?? 0,
      icon: History,
    },
    { id: "actions", label: "Manager actions", icon: Gauge },
  ];

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : event.key === "ArrowRight"
            ? (currentIndex + 1) % tabs.length
            : (currentIndex - 1 + tabs.length) % tabs.length;
    const next = tabs[nextIndex];
    onChange(next.id);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-tab-id="${next.id}"]`)?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Product quality details"
      onKeyDown={onKeyDown}
      className="flex shrink-0 gap-0 overflow-x-auto border-b border-white/6 bg-[#121212] px-3 sm:px-5"
    >
      {tabs.map((tab) => {
        const selected = tab.id === activeTab;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-tab-id={tab.id}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`relative inline-flex shrink-0 items-center gap-2 px-3 py-3 text-xs font-medium transition focus:outline-hidden focus:ring-2 focus:ring-inset focus:ring-blue-500/30 ${
              selected ? "text-zinc-50" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Icon
              className={`h-3.5 w-3.5 ${selected ? "text-blue-400" : "text-zinc-600"}`}
              aria-hidden="true"
            />
            {tab.label}
            {typeof tab.count === "number" ? (
              <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] tabular-nums text-zinc-500">
                {tab.count}
              </span>
            ) : null}
            <span
              aria-hidden="true"
              className={`absolute inset-x-2 bottom-0 h-0.5 ${
                selected ? "bg-blue-500" : "bg-transparent"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

function SourcePanel({ detail }: { detail: OneAiQualityProductDetail }) {
  const product = detail.product;
  const knowledge = product.knowledge;
  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Knowledge revision"
          value={
            knowledge
              ? `${knowledge.activeRevision} active / ${knowledge.revision} latest`
              : "Not indexed"
          }
          icon={<History />}
        />
        <Metric
          label="Completeness"
          value={knowledge ? `${Math.round(knowledge.completenessScore)}%` : "—"}
          icon={<Gauge />}
        />
        <Metric
          label="Fitment"
          value={knowledge ? `${knowledge.fitmentStatus} · ${knowledge.fitmentSource}` : "—"}
          icon={<Wrench />}
        />
        <Metric
          label="Indexed records"
          value={
            knowledge
              ? `${knowledge._count.chunks} chunks · ${knowledge._count.evidence} evidence`
              : "—"
          }
          icon={<Braces />}
        />
      </section>

      {!detail.ready ? (
        <AdminInlineAlert tone="warning">
          This product exists, but its Knowledge V2 backfill is incomplete. Manager writes stay
          disabled.
        </AdminInlineAlert>
      ) : null}
      {knowledge?.qualityFlags.length ? (
        <section className="border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Quality flags
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {knowledge.qualityFlags.map((flag) => (
              <code
                key={flag}
                className="rounded-full border border-amber-400/15 bg-amber-400/5 px-2.5 py-1 text-[10px] text-amber-100/80"
              >
                {flag}
              </code>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <LocalizedSourceCard
          locale="UA"
          title={product.titleUa}
          category={product.categoryUa}
          shortDescription={product.shortDescUa}
          longDescription={product.longDescUa}
          bodyHtml={product.bodyHtmlUa}
        />
        <LocalizedSourceCard
          locale="EN"
          title={product.titleEn}
          category={product.categoryEn}
          shortDescription={product.shortDescEn}
          longDescription={product.longDescEn}
          bodyHtml={product.bodyHtmlEn}
        />
      </div>

      <section className="border border-white/8 bg-[#171717] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-zinc-100">Source metadata</h3>
          <AdminStatusBadge tone={product.isPublished ? "success" : "warning"}>
            {product.isPublished ? "Published" : "Hidden"}
          </AdminStatusBadge>
        </div>
        <dl className="mt-4 grid gap-2 sm:grid-cols-2">
          <Definition label="Brand" value={product.brand || "—"} />
          <Definition label="Scope" value={product.scope} />
          <Definition label="SKU" value={product.sku || "—"} mono />
          <Definition label="Updated" value={formatDate(product.updatedAt)} />
          <Definition label="Slug" value={product.slug} mono />
          <Definition label="Catalog status" value={product.status} />
        </dl>
        <div className="mt-4 border-t border-white/6 pt-4">
          <div className="text-xs font-medium text-zinc-500">Tags</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {product.tags.length ? (
              product.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/8 bg-white/3 px-2.5 py-1 text-[10px] text-zinc-400"
                >
                  {tag}
                </span>
              ))
            ) : (
              <span className="text-xs text-zinc-600">No source tags</span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function VariantsPanel({ detail }: { detail: OneAiQualityProductDetail }) {
  if (!detail.product.variants.length) {
    return (
      <AdminEmptyState
        title="No variants"
        description="This product has no variant rows."
        illustration={<Layers3 className="h-12 w-12 text-blue-400" />}
      />
    );
  }
  return (
    <div className="space-y-3">
      {detail.product.variants.map((variant) => (
        <section key={variant.id} className="border border-white/8 bg-[#171717] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                {variant.title || "Default variant"}
              </h3>
              <div className="mt-1 font-mono text-xs text-zinc-500">
                {variant.sku || variant.id}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <AdminStatusBadge>stock {variant.inventoryQty}</AdminStatusBadge>
              {variant.knowledge ? (
                <AdminStatusBadge tone={statusTone(variant.knowledge.status)}>
                  {variant.knowledge.status} · r{variant.knowledge.revision}
                </AdminStatusBadge>
              ) : (
                <AdminStatusBadge tone="warning">Not indexed</AdminStatusBadge>
              )}
            </div>
          </div>
          <dl className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Definition label="Option 1" value={variant.option1Value || "—"} />
            <Definition label="Option 2" value={variant.option2Value || "—"} />
            <Definition label="Option 3" value={variant.option3Value || "—"} />
            <Definition label="Updated" value={formatDate(variant.updatedAt)} />
          </dl>
          {variant.knowledge?.qualityFlags.length ? (
            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-white/6 pt-3">
              {variant.knowledge.qualityFlags.map((flag) => (
                <code
                  key={flag}
                  className="rounded-full border border-amber-400/15 px-2 py-1 text-[10px] text-amber-300/80"
                >
                  {flag}
                </code>
              ))}
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function FitmentPanel({ detail }: { detail: OneAiQualityProductDetail }) {
  const applications = detail.product.knowledge?.vehicleApplications ?? [];
  if (!applications.length) {
    return (
      <AdminEmptyState
        title="No canonical applications"
        description="This product cannot become an exact vehicle match until a correlated application is verified."
        illustration={<Wrench className="h-12 w-12 text-amber-400" />}
      />
    );
  }
  return (
    <div className="space-y-3">
      {applications.map((application) => (
        <ApplicationCard
          key={application.id}
          application={application}
          variants={detail.product.variants}
        />
      ))}
    </div>
  );
}

function ApplicationCard({
  application,
  variants,
}: {
  application: OneAiQualityVehicleApplication;
  variants: OneAiQualityProductDetail["product"]["variants"];
}) {
  const variant = variants.find((item) => item.id === application.variantId);
  return (
    <section
      className={`border p-4 ${
        application.isActive
          ? application.verificationStatus === "VERIFIED"
            ? "border-emerald-500/20 bg-emerald-500/4"
            : "border-amber-500/20 bg-amber-500/4"
          : "border-white/6 bg-[#151515] opacity-75"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-100">
              {application.isUniversal
                ? "Universal application"
                : [application.make, application.model, application.chassisCode]
                    .filter(Boolean)
                    .join(" ") || "Incomplete application"}
            </h3>
            <AdminStatusBadge tone={statusTone(application.verificationStatus)}>
              {application.verificationStatus}
            </AdminStatusBadge>
            {!application.isActive ? <AdminStatusBadge>Inactive</AdminStatusBadge> : null}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {application.source} priority {application.sourcePriority} · confidence{" "}
            {Math.round(application.confidence * 100)}% · revision {application.revision}
          </div>
        </div>
        <div className="text-right text-xs text-zinc-500">
          <div>{application.scope.toUpperCase()}</div>
          <div className="mt-1 font-mono">
            {variant?.sku || application.variantId || "All variants"}
          </div>
        </div>
      </div>

      <dl className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Definition label="Generation" value={application.generation || "—"} />
        <Definition
          label="Years"
          value={
            application.yearFrom ? `${application.yearFrom}–${application.yearTo ?? "open"}` : "—"
          }
        />
        <Definition label="Engine" value={application.engine || "—"} />
        <Definition label="Fuel" value={application.fuel || "—"} />
        <Definition label="Body" value={application.bodyStyle || "—"} />
        <Definition label="Drivetrain" value={application.drivetrain || "—"} />
        <Definition label="Transmission" value={application.transmission || "—"} />
        <Definition label="Market" value={application.market || "—"} />
        <Definition label="OPF / GPF" value={application.opfGpf || "unknown"} />
        <Definition label="Category" value={application.categoryGroup || "—"} />
        <Definition label="Product kind" value={application.productKind || "—"} />
        <Definition label="Material" value={application.material || "—"} />
      </dl>
      <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-white/6 pt-3 text-[11px] text-zinc-600">
        <code>{application.id}</code>
        <span>
          verified {formatDate(application.verifiedAt)} · updated{" "}
          {formatDate(application.updatedAt)}
        </span>
      </div>
    </section>
  );
}

function AttributesPanel({ detail }: { detail: OneAiQualityProductDetail }) {
  const attributes = detail.product.knowledge?.attributeValues ?? [];
  if (!attributes.length) {
    return (
      <AdminEmptyState
        title="No indexed attributes"
        description="Category adapters have not produced filterable values for this product."
        illustration={<Tags className="h-12 w-12 text-amber-400" />}
      />
    );
  }
  return (
    <div className="overflow-x-auto border border-white/8 bg-[#171717]">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/8 bg-white/3 text-[10px] uppercase tracking-wider text-zinc-500">
            <th className="px-4 py-3 font-medium">Attribute</th>
            <th className="px-4 py-3 font-medium">Value</th>
            <th className="px-4 py-3 font-medium">Variant</th>
            <th className="px-4 py-3 font-medium">Source</th>
            <th className="px-4 py-3 font-medium">Constraint</th>
          </tr>
        </thead>
        <tbody>
          {attributes.map((attribute) => (
            <tr key={attribute.id} className="border-t border-white/6">
              <td className="px-4 py-3">
                <div className="font-medium text-zinc-100">
                  {attribute.definition.nameUa ||
                    attribute.definition.nameEn ||
                    attribute.definition.key}
                </div>
                <code className="mt-1 block text-[10px] text-zinc-600">
                  {attribute.definition.key}
                </code>
              </td>
              <td className="max-w-[320px] px-4 py-3 text-zinc-300">
                {attributeValue(attribute)}
                {attribute.unit ? (
                  <span className="ml-1 text-zinc-500">{attribute.unit}</span>
                ) : null}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                {attribute.variantId || "All"}
              </td>
              <td className="px-4 py-3">
                <AdminStatusBadge tone={statusTone(attribute.verificationStatus)}>
                  {attribute.source} · {attribute.verificationStatus}
                </AdminStatusBadge>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {attribute.definition.isHardConstraint ? (
                    <AdminStatusBadge tone="warning">Hard</AdminStatusBadge>
                  ) : (
                    <AdminStatusBadge>Soft</AdminStatusBadge>
                  )}
                  {attribute.definition.isRequired ? (
                    <AdminStatusBadge>Required</AdminStatusBadge>
                  ) : null}
                  {attribute.definition.isFilterable ? (
                    <AdminStatusBadge>Filter</AdminStatusBadge>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EvidencePanel({ detail }: { detail: OneAiQualityProductDetail }) {
  const evidence = detail.product.knowledge?.evidence ?? [];
  if (!evidence.length) {
    return (
      <AdminEmptyState
        title="No evidence records"
        description="This product has no field-level provenance yet."
        illustration={<ShieldCheck className="h-12 w-12 text-amber-400" />}
      />
    );
  }
  return (
    <div className="space-y-3">
      {evidence.map((item) => (
        <section
          key={item.id}
          className={`border p-4 ${
            item.isActive ? "border-white/8 bg-[#171717]" : "border-white/5 bg-[#141414] opacity-70"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <code className="text-xs text-zinc-300">{item.fieldPath}</code>
                {item.isManagerVerified ? (
                  <AdminStatusBadge tone="success">Manager verified</AdminStatusBadge>
                ) : null}
                {!item.isActive ? <AdminStatusBadge>Inactive</AdminStatusBadge> : null}
              </div>
              <div className="mt-1 text-[11px] text-zinc-600">
                {item.source} · confidence {Math.round(item.confidence * 100)}% · revision{" "}
                {item.revision}
              </div>
            </div>
            <div className="text-right text-[11px] text-zinc-600">
              <div>{formatDate(item.verifiedAt)}</div>
              <div className="mt-1">{item.extractorVersion || "no extractor"}</div>
            </div>
          </div>
          <blockquote className="mt-4 whitespace-pre-wrap break-words border-l-2 border-blue-500/35 bg-black/20 px-4 py-3 text-sm leading-6 text-zinc-300">
            {item.excerpt || "No excerpt stored"}
          </blockquote>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Definition label="Source reference" value={item.sourceRef || "—"} mono />
            <Definition label="Source hash" value={item.sourceHash} mono />
          </div>
        </section>
      ))}
    </div>
  );
}

function HistoryPanel({
  detail,
  busy,
  submitting,
  error,
  success,
  conflict,
  onReload,
  onUndo,
}: {
  detail: OneAiQualityProductDetail;
  busy: boolean;
  submitting: boolean;
  error: string;
  success: string;
  conflict: { expectedRevision: number; currentRevision: number } | null;
  onReload: () => void;
  onUndo: (targetRevisionId: string, reason: string | null) => Promise<void>;
}) {
  const [undoTargetId, setUndoTargetId] = useState<string | null>(null);
  const [undoReason, setUndoReason] = useState("");
  const knowledge = detail.product.knowledge;
  const revisions = detail.product.knowledge?.revisions ?? [];
  const tasks = detail.product.knowledge?.reviewTasks ?? [];
  const undoTarget = revisions.find((revision) => revision.id === undoTargetId) ?? null;
  if (!revisions.length && !tasks.length) {
    return (
      <AdminEmptyState
        title="No quality history"
        description="Revisions and review tasks will appear here."
        illustration={<History className="h-12 w-12 text-blue-400" />}
      />
    );
  }
  return (
    <div className="space-y-4">
      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}
      {success ? <AdminInlineAlert tone="success">{success}</AdminInlineAlert> : null}
      {conflict ? (
        <AdminInlineAlert tone="warning">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              This record changed from revision {conflict.expectedRevision} to{" "}
              {conflict.currentRevision}. Reload before creating the undo revision.
            </span>
            <button
              type="button"
              onClick={onReload}
              className="inline-flex h-8 items-center gap-2 border border-amber-400/25 bg-amber-400/8 px-3 text-xs font-medium text-amber-100 transition hover:bg-amber-400/15 focus:outline-hidden focus:ring-2 focus:ring-amber-400/30"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Reload latest
            </button>
          </div>
        </AdminInlineAlert>
      ) : null}

      {undoTarget && knowledge ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onUndo(undoTarget.id, undoReason.trim() || null);
          }}
          className="border border-blue-500/25 bg-blue-500/6 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-100">
                <RotateCcw className="h-4 w-4 text-blue-400" aria-hidden="true" />
                Restore revision {undoTarget.revision} as revision {knowledge.revision + 1}
              </div>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-400">
                This never deletes or rewrites history. The supported canonical application and
                strict-matching state are copied into a new manager revision with fresh evidence,
                audit data and reindexing.
              </p>
            </div>
            <AdminStatusBadge>Immutable undo</AdminStatusBadge>
          </div>
          <label className="mt-4 block text-xs font-medium text-zinc-400">
            Manager note
            <textarea
              value={undoReason}
              onChange={(event) => setUndoReason(event.target.value)}
              disabled={busy}
              maxLength={500}
              placeholder={`Why revision ${undoTarget.revision} is the correct state to restore`}
              className="mt-1.5 min-h-20 w-full resize-y border border-white/8 bg-black/25 px-3 py-2.5 text-sm leading-6 text-zinc-100 outline-hidden transition placeholder:text-zinc-600 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-white/6 pt-4">
            <button
              type="button"
              onClick={() => {
                setUndoTargetId(null);
                setUndoReason("");
              }}
              disabled={busy}
              className="inline-flex h-9 items-center border border-white/10 bg-white/3 px-4 text-xs font-medium text-zinc-300 transition hover:bg-white/6 focus:outline-hidden focus:ring-2 focus:ring-white/15 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-9 items-center gap-2 bg-blue-600 px-4 text-xs font-semibold text-white transition hover:bg-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
              ) : (
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              )}
              Create undo revision
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Immutable revisions
          </div>
          {revisions.map((revision) => {
            const canUndo = Boolean(knowledge && revision.revision < knowledge.revision && !busy);
            return (
              <details key={revision.id} className="group border border-white/8 bg-[#171717]">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-4 focus:outline-hidden focus:ring-2 focus:ring-inset focus:ring-blue-500/25">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-100">
                        Revision {revision.revision}
                      </span>
                      <AdminStatusBadge tone={statusTone(revision.status)}>
                        {revision.status}
                      </AdminStatusBadge>
                      <AdminStatusBadge>{revision.source}</AdminStatusBadge>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {revision.changeType} · {formatDate(revision.createdAt)}
                      {revision.activatedAt
                        ? ` · activated ${formatDate(revision.activatedAt)}`
                        : " · not active"}
                    </div>
                    {revision.reason ? (
                      <p className="mt-2 text-xs leading-5 text-zinc-400">{revision.reason}</p>
                    ) : null}
                  </div>
                  <ChevronRight
                    className="mt-1 h-4 w-4 shrink-0 text-zinc-600 transition group-open:rotate-90"
                    aria-hidden="true"
                  />
                </summary>
                <div className="border-t border-white/6 p-4">
                  <div className="grid gap-3 lg:grid-cols-2">
                    <JsonBlock label="Diff" value={revision.diff} />
                    <JsonBlock label="Snapshot" value={revision.snapshot} />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/6 pt-4">
                    <p className="max-w-2xl text-[11px] leading-5 text-zinc-500">
                      {revision.revision === knowledge?.revision
                        ? "This is the current revision and cannot be its own undo target."
                        : "Restoring creates another immutable revision; this record remains unchanged."}
                    </p>
                    <button
                      type="button"
                      disabled={!canUndo}
                      onClick={() => {
                        setUndoTargetId(revision.id);
                        setUndoReason("");
                      }}
                      className="inline-flex h-9 items-center gap-2 border border-blue-500/25 bg-blue-500/8 px-3 text-xs font-semibold text-blue-100 transition hover:bg-blue-500/15 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:border-white/6 disabled:bg-white/2 disabled:text-zinc-600"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      Restore as new revision
                    </button>
                  </div>
                </div>
              </details>
            );
          })}
        </div>

        <aside className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Review tasks
          </div>
          {tasks.length ? (
            tasks.map((task) => (
              <section key={task.id} className="border border-white/8 bg-[#171717] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <AdminStatusBadge tone={statusTone(task.status)}>{task.status}</AdminStatusBadge>
                  <AdminStatusBadge tone={statusTone(task.priority)}>
                    {task.priority}
                  </AdminStatusBadge>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-zinc-100">{task.title}</h3>
                <div className="mt-1 text-xs text-zinc-500">{task.taskType}</div>
                {task.reasonCodes.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {task.reasonCodes.map((reason) => (
                      <code
                        key={reason}
                        className="rounded-full border border-white/8 px-2 py-1 text-[10px] text-zinc-500"
                      >
                        {reason}
                      </code>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 text-[11px] text-zinc-600">
                  Created {formatDate(task.createdAt)}
                </div>
              </section>
            ))
          ) : (
            <div className="border border-dashed border-white/8 p-4 text-xs text-zinc-600">
              No review tasks for this product.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: ReactNode; icon: ReactNode }) {
  return (
    <div className="border border-white/8 bg-[#171717] p-4">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span className="text-blue-400 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-zinc-100">{value}</div>
    </div>
  );
}

function LocalizedSourceCard({
  locale,
  title,
  category,
  shortDescription,
  longDescription,
  bodyHtml,
}: {
  locale: "UA" | "EN";
  title: string;
  category: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  bodyHtml: string | null;
}) {
  return (
    <section className="border border-white/8 bg-[#171717] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-100">{locale} source</h3>
        <AdminStatusBadge
          tone={title && (shortDescription || longDescription || bodyHtml) ? "success" : "warning"}
        >
          {title && (shortDescription || longDescription || bodyHtml) ? "Present" : "Incomplete"}
        </AdminStatusBadge>
      </div>
      <dl className="mt-4 space-y-2">
        <Definition label="Title" value={title || "—"} />
        <Definition label="Category" value={category || "—"} />
      </dl>
      <SourceText label="Short description" value={shortDescription} />
      <SourceText label="Long description" value={longDescription} />
      <details className="group mt-3 border border-white/6 bg-black/20">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-inset focus:ring-blue-500/25">
          Raw body HTML
          <ChevronRight
            className="h-3.5 w-3.5 text-zinc-600 transition group-open:rotate-90"
            aria-hidden="true"
          />
        </summary>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words border-t border-white/6 px-3 py-3 text-[11px] leading-5 text-zinc-500">
          {bodyHtml || "No HTML source"}
        </pre>
      </details>
    </section>
  );
}

function SourceText({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="mt-3 border-t border-white/6 pt-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">{label}</div>
      <div className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-zinc-400">
        {value || "—"}
      </div>
    </div>
  );
}

function Definition({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-3 border border-white/5 bg-black/15 px-3 py-2">
      <dt className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">{label}</dt>
      <dd className={`min-w-0 break-words text-xs text-zinc-300 ${mono ? "font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
        {label}
      </div>
      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all border border-white/6 bg-black/25 p-3 text-[10px] leading-5 text-zinc-500">
        {compactJson(value)}
      </pre>
    </div>
  );
}

function attributeValue(attribute: OneAiQualityAttributeValue) {
  if (attribute.valueText !== null) return attribute.valueText;
  if (attribute.valueNumber !== null) return attribute.valueNumber.toString();
  if (attribute.valueBoolean !== null) {
    return attribute.valueBoolean ? "true" : "false";
  }
  if (attribute.normalizedValue) return attribute.normalizedValue;
  return compactJson(attribute.valueJson);
}

function DrawerLoading() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center text-center">
      <Loader2 className="h-7 w-7 motion-safe:animate-spin text-blue-400" aria-hidden="true" />
      <div className="mt-4 text-sm font-medium text-zinc-200">
        Loading canonical product knowledge
      </div>
      <div className="mt-1 text-xs text-zinc-600">
        Source, variants, applications and evidence are read together.
      </div>
    </div>
  );
}
