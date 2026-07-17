"use client";

import { ArrowRight, CheckCircle2, Loader2, ShieldAlert, X } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminInlineAlert, AdminStatusBadge } from "@/components/admin/AdminPrimitives";

type BulkAction = "verify_and_reindex" | "mark_universal" | "block_strict" | "needs_source";

type PreviewRow = {
  productId: string;
  slug: string;
  title: string;
  before: {
    revision: number;
    activeRevision: number;
    status: string;
    qualityFlags: string[];
    fitmentStatus: string;
    applications: unknown[];
  };
  after: {
    revision: number;
    activeRevision: number;
    status: string;
    qualityFlags: string[];
    fitmentStatus: string;
    applications: unknown[];
    reindexQueued: boolean;
  };
};

type BulkPreview = {
  previewToken: string;
  expiresAt: string;
  homogeneous: {
    scope: "auto" | "moto";
    categoryGroup: string | null;
    productKind: string | null;
  };
  action: BulkAction;
  mutation: Record<string, unknown>;
  productCount: number;
  products: PreviewRow[];
};

type BulkApplyResult = {
  batchId: string;
  replayed: boolean;
  appliedAt: string;
  products: Array<{ productId: string; revision: number; status: string }>;
  reindexOutboxIds: string[];
};

function errorFrom(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") return fallback;
  const error = (value as { error?: unknown }).error;
  return typeof error === "string" ? error : fallback;
}

function statusTone(status: string) {
  if (status === "READY" || status === "COMPLETED") return "success" as const;
  if (status === "BLOCKED" || status === "FAILED") return "danger" as const;
  return "warning" as const;
}

function optionalYear(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : Number.NaN;
}

export function OneAiQualityBulkPanel({
  onClose,
  onApplied,
}: {
  onClose: () => void;
  onApplied: () => void;
}) {
  const [idsText, setIdsText] = useState("");
  const [action, setAction] = useState<BulkAction>("needs_source");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [sourceRef, setSourceRef] = useState("");
  const [scope, setScope] = useState<"auto" | "moto">("auto");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [generation, setGeneration] = useState("");
  const [chassisCode, setChassisCode] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [engine, setEngine] = useState("");
  const [opfGpf, setOpfGpf] = useState<"with" | "without" | "unknown">("unknown");
  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState<"preview" | "apply" | null>(null);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState<BulkApplyResult | null>(null);

  const productIds = useMemo(
    () =>
      Array.from(
        new Set(
          idsText
            .split(/[\s,;]+/u)
            .map((value) => value.trim())
            .filter(Boolean)
        )
      ),
    [idsText]
  );

  function resetPreview() {
    setPreview(null);
    setConfirmed(false);
    setApplied(null);
    setIdempotencyKey("");
  }

  async function requestPreview() {
    setError("");
    setApplied(null);
    if (productIds.length < 2 || productIds.length > 25) {
      setError("Paste 2-25 exact product IDs.");
      return;
    }
    const parsedYearFrom = optionalYear(yearFrom);
    const parsedYearTo = optionalYear(yearTo);
    if (Number.isNaN(parsedYearFrom) || Number.isNaN(parsedYearTo)) {
      setError("Years must be whole numbers.");
      return;
    }
    if (action === "verify_and_reindex" && !make.trim()) {
      setError("Verified bulk fitment requires a make.");
      return;
    }
    if ((action === "verify_and_reindex" || action === "mark_universal") && !evidence.trim()) {
      setError("Verified or universal changes require evidence.");
      return;
    }
    if ((action === "block_strict" || action === "needs_source") && !reason.trim()) {
      setError("This action requires a reason.");
      return;
    }

    const body: Record<string, unknown> = {
      productIds,
      action,
      reason: reason.trim() || undefined,
    };
    if (action === "verify_and_reindex" || action === "mark_universal") {
      body.evidence = {
        excerpt: evidence.trim(),
        sourceRef: sourceRef.trim() || undefined,
      };
    }
    if (action === "verify_and_reindex") {
      body.application = {
        applicationId: null,
        variantId: null,
        scope,
        vehicleType: scope === "moto" ? "motorcycle" : "car",
        make: make.trim(),
        model: model.trim() || null,
        generation: generation.trim() || null,
        chassisCode: chassisCode.trim() || null,
        yearFrom: parsedYearFrom,
        yearTo: parsedYearTo,
        engine: engine.trim() || null,
        fuel: null,
        bodyStyle: null,
        drivetrain: null,
        transmission: null,
        market: null,
        opfGpf,
        categoryGroup: null,
        productKind: null,
        material: null,
      };
    }

    setLoading("preview");
    try {
      const response = await fetch("/api/admin/shop/ai-quality/bulk/preview", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(errorFrom(payload, "Failed to build bulk preview."));
        return;
      }
      const nextPreview = payload as BulkPreview;
      if (typeof nextPreview.previewToken !== "string" || !Array.isArray(nextPreview.products)) {
        setError("Bulk preview returned an invalid response.");
        return;
      }
      setPreview(nextPreview);
      setIdempotencyKey(crypto.randomUUID());
      setConfirmed(false);
    } catch {
      setError("Bulk preview is temporarily unavailable.");
    } finally {
      setLoading(null);
    }
  }

  async function applyPreview() {
    if (!preview || !confirmed || !idempotencyKey) return;
    setLoading("apply");
    setError("");
    try {
      const response = await fetch("/api/admin/shop/ai-quality/bulk/apply", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewToken: preview.previewToken,
          idempotencyKey,
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(errorFrom(payload, "Failed to apply bulk update."));
        if (response.status === 409 || response.status === 410) resetPreview();
        return;
      }
      setApplied(payload as BulkApplyResult);
      setConfirmed(false);
      onApplied();
    } catch {
      setError("Bulk apply is temporarily unavailable. Reuse the same idempotency key.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="border border-blue-500/20 bg-[#151719]">
      <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
            <ShieldAlert className="h-4 w-4 text-blue-300" />
            Controlled bulk correction
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500">
            Exact IDs only. Preview is signed for five minutes; apply is all-or-nothing and checks
            every product revision again.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close bulk correction"
          className="p-2 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Exact product IDs ({productIds.length})
            </span>
            <textarea
              value={idsText}
              onChange={(event) => {
                setIdsText(event.target.value);
                resetPreview();
              }}
              rows={6}
              placeholder={"product_id_1\nproduct_id_2"}
              className="mt-2 w-full resize-y border border-white/10 bg-black/25 px-3 py-2 font-mono text-xs text-zinc-200 outline-hidden focus:border-blue-500/50"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Homogeneous action
            </span>
            <select
              value={action}
              onChange={(event) => {
                setAction(event.target.value as BulkAction);
                resetPreview();
              }}
              className="mt-2 w-full border border-white/10 bg-[#111] px-3 py-2 text-sm text-zinc-200 outline-hidden focus:border-blue-500/50"
            >
              <option value="needs_source">Needs source</option>
              <option value="block_strict">Block from strict matching</option>
              <option value="mark_universal">Mark universal</option>
              <option value="verify_and_reindex">Verify shared fitment</option>
            </select>
          </label>

          {action === "verify_and_reindex" ? (
            <div className="grid gap-3 border border-white/8 bg-black/15 p-3 sm:grid-cols-2">
              <select
                value={scope}
                onChange={(event) => {
                  setScope(event.target.value as "auto" | "moto");
                  resetPreview();
                }}
                className="border border-white/10 bg-[#111] px-3 py-2 text-sm text-zinc-200"
              >
                <option value="auto">Auto</option>
                <option value="moto">Moto</option>
              </select>
              <input
                value={make}
                onChange={(event) => {
                  setMake(event.target.value);
                  resetPreview();
                }}
                placeholder="Make *"
                className="border border-white/10 bg-black/25 px-3 py-2 text-sm text-zinc-200"
              />
              <input
                value={model}
                onChange={(event) => {
                  setModel(event.target.value);
                  resetPreview();
                }}
                placeholder="Model"
                className="border border-white/10 bg-black/25 px-3 py-2 text-sm text-zinc-200"
              />
              <input
                value={generation}
                onChange={(event) => {
                  setGeneration(event.target.value);
                  resetPreview();
                }}
                placeholder="Generation"
                className="border border-white/10 bg-black/25 px-3 py-2 text-sm text-zinc-200"
              />
              <input
                value={chassisCode}
                onChange={(event) => {
                  setChassisCode(event.target.value);
                  resetPreview();
                }}
                placeholder="Chassis"
                className="border border-white/10 bg-black/25 px-3 py-2 text-sm text-zinc-200"
              />
              <input
                value={engine}
                onChange={(event) => {
                  setEngine(event.target.value);
                  resetPreview();
                }}
                placeholder="Engine"
                className="border border-white/10 bg-black/25 px-3 py-2 text-sm text-zinc-200"
              />
              <input
                value={yearFrom}
                onChange={(event) => {
                  setYearFrom(event.target.value);
                  resetPreview();
                }}
                inputMode="numeric"
                placeholder="Year from"
                className="border border-white/10 bg-black/25 px-3 py-2 text-sm text-zinc-200"
              />
              <input
                value={yearTo}
                onChange={(event) => {
                  setYearTo(event.target.value);
                  resetPreview();
                }}
                inputMode="numeric"
                placeholder="Year to"
                className="border border-white/10 bg-black/25 px-3 py-2 text-sm text-zinc-200"
              />
              <select
                value={opfGpf}
                onChange={(event) => {
                  setOpfGpf(event.target.value as "with" | "without" | "unknown");
                  resetPreview();
                }}
                className="border border-white/10 bg-[#111] px-3 py-2 text-sm text-zinc-200 sm:col-span-2"
              >
                <option value="unknown">OPF/GPF unknown</option>
                <option value="with">With OPF/GPF</option>
                <option value="without">Without OPF/GPF</option>
              </select>
            </div>
          ) : null}

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              {action === "verify_and_reindex" || action === "mark_universal"
                ? "Evidence *"
                : "Reason *"}
            </span>
            <textarea
              value={
                action === "verify_and_reindex" || action === "mark_universal" ? evidence : reason
              }
              onChange={(event) => {
                if (action === "verify_and_reindex" || action === "mark_universal") {
                  setEvidence(event.target.value);
                } else {
                  setReason(event.target.value);
                }
                resetPreview();
              }}
              rows={3}
              className="mt-2 w-full resize-y border border-white/10 bg-black/25 px-3 py-2 text-sm text-zinc-200 outline-hidden focus:border-blue-500/50"
            />
          </label>

          {action === "verify_and_reindex" || action === "mark_universal" ? (
            <input
              value={sourceRef}
              onChange={(event) => {
                setSourceRef(event.target.value);
                resetPreview();
              }}
              placeholder="Evidence source reference (optional)"
              className="w-full border border-white/10 bg-black/25 px-3 py-2 text-sm text-zinc-200"
            />
          ) : null}

          <button
            type="button"
            onClick={() => void requestPreview()}
            disabled={loading !== null}
            className="inline-flex items-center gap-2 bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-400 disabled:opacity-50"
          >
            {loading === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Build exact preview
          </button>
        </div>

        <div className="min-w-0 space-y-4">
          {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}
          {applied ? (
            <AdminInlineAlert tone="success">
              Applied {applied.products.length} products atomically. Batch {applied.batchId};{" "}
              {applied.reindexOutboxIds.length} targeted reindex jobs scheduled.
            </AdminInlineAlert>
          ) : null}

          {preview ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-zinc-500">
                  {preview.homogeneous.scope} ·{" "}
                  {preview.homogeneous.categoryGroup || "unknown category"} ·{" "}
                  {preview.homogeneous.productKind || "unknown product kind"} · expires{" "}
                  {new Date(preview.expiresAt).toLocaleTimeString("uk-UA")}
                </div>
                <AdminStatusBadge tone="warning">Not applied</AdminStatusBadge>
              </div>
              <details className="border border-white/8 bg-black/15 px-3 py-2 text-xs text-zinc-400">
                <summary className="cursor-pointer font-medium text-zinc-300">
                  Exact signed mutation
                </summary>
                <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-5 text-zinc-500">
                  {JSON.stringify(preview.mutation, null, 2)}
                </pre>
              </details>
              <div className="max-h-[430px] overflow-auto border border-white/8">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="sticky top-0 bg-[#1b1d1f] text-zinc-500">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Product</th>
                      <th className="px-3 py-2.5 font-medium">Before</th>
                      <th className="w-10 px-2 py-2.5" />
                      <th className="px-3 py-2.5 font-medium">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.products.map((product) => (
                      <tr key={product.productId} className="border-t border-white/6 align-top">
                        <td className="max-w-[280px] px-3 py-3">
                          <div className="font-medium text-zinc-200">{product.title}</div>
                          <div className="mt-1 break-all font-mono text-[10px] text-zinc-600">
                            {product.productId}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-zinc-400">
                          <AdminStatusBadge tone={statusTone(product.before.status)}>
                            {product.before.status}
                          </AdminStatusBadge>
                          <div className="mt-2">
                            rev {product.before.revision} · {product.before.fitmentStatus}
                          </div>
                          <div className="mt-1">
                            {product.before.applications.length} applications
                          </div>
                        </td>
                        <td className="px-2 py-4 text-zinc-600">
                          <ArrowRight className="h-4 w-4" />
                        </td>
                        <td className="px-3 py-3 text-zinc-300">
                          <AdminStatusBadge tone={statusTone(product.after.status)}>
                            {product.after.status}
                          </AdminStatusBadge>
                          <div className="mt-2">
                            rev {product.after.revision} · {product.after.fitmentStatus}
                          </div>
                          <div className="mt-1">
                            {product.after.applications.length} applications
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <details className="border border-white/8 bg-black/15 px-3 py-2 text-xs text-zinc-400">
                <summary className="cursor-pointer font-medium text-zinc-300">
                  Inspect every exact before/after payload
                </summary>
                <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-5 text-zinc-500">
                  {JSON.stringify(preview.products, null, 2)}
                </pre>
              </details>
              <label className="flex items-start gap-3 border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-zinc-400">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  className="mt-0.5"
                />
                I reviewed the exact product list and every before/after state. Apply only if none
                of these revisions changed.
              </label>
              <button
                type="button"
                onClick={() => void applyPreview()}
                disabled={!confirmed || loading !== null}
                className="inline-flex items-center gap-2 bg-emerald-500 px-4 py-2.5 text-sm font-medium text-black transition hover:bg-emerald-400 disabled:opacity-40"
              >
                {loading === "apply" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Apply atomically
              </button>
            </>
          ) : (
            <div className="flex min-h-[260px] items-center justify-center border border-dashed border-white/10 bg-black/10 p-8 text-center text-sm leading-6 text-zinc-600">
              The signed preview table will show the exact products, revisions, fitment state and
              proposed result before any write.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
