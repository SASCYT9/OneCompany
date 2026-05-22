"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import {
  AdminActionBar,
  AdminButton,
  AdminEmptyState,
  AdminFilterBar,
  AdminInlineAlert,
  AdminInspectorCard,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminResponsiveTable,
  AdminStatusBadge,
  AdminTableShell,
} from "@/components/admin/AdminPrimitives";
import { AdminMobileCard } from "@/components/admin/AdminMobileCard";

type ForgedReferenceStatus = "approved-seed" | "needs-model-page-review";

type ForgedReferenceItem = {
  ocSlug: string;
  ocName: string;
  originalReferenceLabel: string;
  sourceBrand: string;
  sourceModel: string;
  sourceUrl: string;
  status: ForgedReferenceStatus;
  priority: 1 | 2 | 3;
  construction: string;
  verifiedAsOf: string;
  geometryBrief: string;
  qaNotes: string[];
  generation: {
    generationStatus: "idle" | "queued" | "staged" | "approved" | "rejected" | "failed" | "blocked";
    lastGeneratedAt: string | null;
    approvedAssetSet: string | null;
    qaIssues: string[];
    stagedAssetSet?: string | null;
    rejectedAt?: string | null;
    approvedAt?: string | null;
  };
  catalogEntry: {
    present: boolean;
    visible: boolean;
    family: string | null;
    basePriceEur: number | null;
    leadTimeWeeksAl: number | null;
    isReplicaStyle: boolean | null;
  };
  assetCoverage: {
    designAssets: {
      expected: number;
      existing: number;
      missing: string[];
    };
    stagedDesignAssets: {
      expected: number;
      existing: number;
      missing: string[];
    };
    renders: {
      carCount: number;
      fileCount: number;
    };
  };
};

type ForgedReferenceResponse = {
  summary: {
    total: number;
    approvedSeed: number;
    needsReview: number;
    withCatalogEntry: number;
    visibleCatalogEntries: number;
    withAnyDesignAssets: number;
    withAnyStagedDesignAssets: number;
    withAnyCarRenders: number;
    queued: number;
    staged: number;
    rejected: number;
  };
  items: ForgedReferenceItem[];
};

const STATUS_OPTIONS: Array<{ value: "ALL" | ForgedReferenceStatus; label: string }> = [
  { value: "ALL", label: "All statuses" },
  { value: "approved-seed", label: "Approved seed" },
  { value: "needs-model-page-review", label: "Needs model review" },
];

function statusTone(status: ForgedReferenceStatus) {
  return status === "approved-seed" ? "success" : "warning";
}

function assetTone(existing: number, expected: number) {
  if (expected === 0 || existing === 0) return "danger" as const;
  if (existing < expected) return "warning" as const;
  return "success" as const;
}

function generationTone(status: ForgedReferenceItem["generation"]["generationStatus"]) {
  if (status === "approved") return "success" as const;
  if (status === "queued" || status === "staged") return "warning" as const;
  if (status === "rejected" || status === "failed" || status === "blocked")
    return "danger" as const;
  return "default" as const;
}

export default function AdminForgedReferencesPage() {
  const [data, setData] = useState<ForgedReferenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ForgedReferenceStatus>("ALL");
  const [brandFilter, setBrandFilter] = useState("ALL");
  const [copiedSlug, setCopiedSlug] = useState("");
  const [busySlug, setBusySlug] = useState("");

  async function load(mode: "initial" | "refresh" = "initial") {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    setError("");

    try {
      const response = await fetch("/api/admin/shop/forged/references", { cache: "no-store" });
      const payload = (await response
        .json()
        .catch(() => ({}))) as Partial<ForgedReferenceResponse> & {
        error?: string;
      };
      if (!response.ok || !payload.items || !payload.summary) {
        setError(payload.error || "Failed to load forged references");
        return;
      }
      setData({ items: payload.items, summary: payload.summary });
    } catch {
      setError("Failed to load forged references");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load("initial");
  }, []);

  const brandOptions = useMemo(() => {
    const brands = new Set(data?.items.map((item) => item.sourceBrand) ?? []);
    return ["ALL", ...Array.from(brands).sort((left, right) => left.localeCompare(right))];
  }, [data]);

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.items ?? []).filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (brandFilter !== "ALL" && item.sourceBrand !== brandFilter) return false;
      if (!needle) return true;
      return [
        item.ocSlug,
        item.ocName,
        item.originalReferenceLabel,
        item.sourceBrand,
        item.sourceModel,
        item.sourceUrl,
        item.geometryBrief,
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [brandFilter, data, query, statusFilter]);

  async function copySourceUrl(item: ForgedReferenceItem) {
    try {
      await navigator.clipboard.writeText(item.sourceUrl);
      setCopiedSlug(item.ocSlug);
      window.setTimeout(() => setCopiedSlug(""), 1400);
    } catch {
      setCopiedSlug("");
    }
  }

  async function runGenerationAction(
    item: ForgedReferenceItem,
    action: "generate" | "regenerate" | "approve" | "reject"
  ) {
    setBusySlug(`${item.ocSlug}:${action}`);
    setError("");
    try {
      const response = await fetch(`/api/admin/shop/forged/references/${item.ocSlug}/generation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          qaIssues: action === "reject" ? ["Rejected by admin QA."] : undefined,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || `Failed to ${action} forged generation`);
        return;
      }
      await load("refresh");
    } catch {
      setError(`Failed to ${action} forged generation`);
    } finally {
      setBusySlug("");
    }
  }

  if (loading && !data) {
    return (
      <AdminPage>
        <div className="grid gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="h-28 motion-safe:animate-pulse rounded-none border border-white/10 bg-white/3"
            />
          ))}
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6" wide>
      <AdminPageHeader
        eyebrow="Private forged QA"
        title="Forged Reference Access"
        description="Internal source model register for OC-branded forged catalog entries and render QA. Source brands stay private to admin only."
        actions={
          <AdminButton
            variant="secondary"
            icon={<RefreshCw className={refreshing ? "motion-safe:animate-spin" : ""} />}
            onClick={() => void load("refresh")}
            disabled={refreshing}
          >
            Refresh
          </AdminButton>
        }
      />

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}

      {data ? (
        <>
          <AdminMetricGrid className="xl:grid-cols-8">
            <AdminMetricCard
              label="References"
              value={data.summary.total}
              meta="Official source rows"
              icon={<ShieldCheck />}
            />
            <AdminMetricCard
              label="Approved"
              value={data.summary.approvedSeed}
              meta="Can seed OC renders"
              tone="accent"
            />
            <AdminMetricCard
              label="Needs review"
              value={data.summary.needsReview}
              meta="Blocked before generation"
            />
            <AdminMetricCard
              label="Catalog entries"
              value={data.summary.withCatalogEntry}
              meta={`${data.summary.visibleCatalogEntries} visible`}
            />
            <AdminMetricCard
              label="Design assets"
              value={data.summary.withAnyDesignAssets}
              meta="Have files on disk"
            />
            <AdminMetricCard
              label="Staged"
              value={data.summary.withAnyStagedDesignAssets}
              meta={`${data.summary.queued} queued / ${data.summary.rejected} rejected`}
            />
            <AdminMetricCard
              label="Car renders"
              value={data.summary.withAnyCarRenders}
              meta="Have vehicle composites"
            />
            <AdminMetricCard
              label="Public naming"
              value="OC"
              meta="No source brands in storefront"
            />
          </AdminMetricGrid>

          <AdminActionBar>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-4 w-4 text-blue-300" />
              <div>
                <div className="text-sm font-medium text-zinc-100">Access boundary</div>
                <div className="text-sm leading-6 text-zinc-500">
                  This surface is for production QA only. Public UI and asset naming must remain
                  OC-branded.
                </div>
              </div>
            </div>
            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
              Role: Forged Reference QA / shop.forged.references.read
            </div>
          </AdminActionBar>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <AdminFilterBar>
                <label className="flex w-full min-w-0 flex-1 items-center gap-2 rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200 md:min-w-[300px]">
                  <Search className="h-4 w-4 text-zinc-500" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search OC name, source model, URL, geometry"
                    className="w-full bg-transparent text-zinc-100 placeholder:text-zinc-500 focus:outline-hidden"
                  />
                </label>
                <SelectFilter
                  label="Status"
                  value={statusFilter}
                  onChange={(value) => setStatusFilter(value as "ALL" | ForgedReferenceStatus)}
                  options={STATUS_OPTIONS}
                />
                <SelectFilter
                  label="Source brand"
                  value={brandFilter}
                  onChange={setBrandFilter}
                  options={brandOptions.map((brand) => ({
                    value: brand,
                    label: brand === "ALL" ? "All brands" : brand,
                  }))}
                />
              </AdminFilterBar>

              {visibleItems.length ? (
                <AdminResponsiveTable
                  desktop={
                    <AdminTableShell>
                      <table className="w-full min-w-[1480px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-white/10 bg-white/3 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                            <th className="px-4 py-4 font-medium">OC entry</th>
                            <th className="px-4 py-4 font-medium">Original wheels</th>
                            <th className="px-4 py-4 font-medium">Status</th>
                            <th className="px-4 py-4 font-medium">Catalog</th>
                            <th className="px-4 py-4 font-medium">Assets</th>
                            <th className="px-4 py-4 font-medium">Generation</th>
                            <th className="px-4 py-4 font-medium">Geometry brief</th>
                            <th className="px-4 py-4 font-medium">Source</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/6">
                          {visibleItems.map((item) => (
                            <tr key={item.ocSlug} className="align-top transition hover:bg-white/3">
                              <td className="px-4 py-4">
                                <div className="font-medium text-zinc-100">{item.ocName}</div>
                                <div className="mt-1 text-xs text-zinc-500">{item.ocSlug}</div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="font-medium text-zinc-100">
                                  {item.originalReferenceLabel}
                                </div>
                                <div className="mt-1 text-xs text-zinc-500">
                                  Private: {item.sourceBrand} / {item.sourceModel}
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <AdminStatusBadge tone={statusTone(item.status)}>
                                  {item.status}
                                </AdminStatusBadge>
                                <div className="mt-2 text-xs text-zinc-500">
                                  P{item.priority} / verified {item.verifiedAsOf}
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <AdminStatusBadge
                                  tone={item.catalogEntry.present ? "success" : "danger"}
                                >
                                  {item.catalogEntry.present ? "present" : "missing"}
                                </AdminStatusBadge>
                                <div className="mt-2 text-xs text-zinc-500">
                                  {item.catalogEntry.family ?? "No family"} /{" "}
                                  {item.catalogEntry.visible ? "visible" : "hidden"}
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex flex-wrap gap-1.5">
                                  <AdminStatusBadge
                                    tone={assetTone(
                                      item.assetCoverage.designAssets.existing,
                                      item.assetCoverage.designAssets.expected
                                    )}
                                  >
                                    {item.assetCoverage.designAssets.existing}/
                                    {item.assetCoverage.designAssets.expected} design
                                  </AdminStatusBadge>
                                  <AdminStatusBadge
                                    tone={assetTone(
                                      item.assetCoverage.stagedDesignAssets.existing,
                                      item.assetCoverage.stagedDesignAssets.expected
                                    )}
                                  >
                                    {item.assetCoverage.stagedDesignAssets.existing}/
                                    {item.assetCoverage.stagedDesignAssets.expected} staged
                                  </AdminStatusBadge>
                                  <AdminStatusBadge
                                    tone={
                                      item.assetCoverage.renders.carCount > 0 ? "success" : "danger"
                                    }
                                  >
                                    {item.assetCoverage.renders.carCount} cars
                                  </AdminStatusBadge>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <AdminStatusBadge
                                  tone={generationTone(item.generation.generationStatus)}
                                >
                                  {item.generation.generationStatus}
                                </AdminStatusBadge>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <AdminButton
                                    size="sm"
                                    icon={<Play />}
                                    loading={busySlug === `${item.ocSlug}:generate`}
                                    disabled={item.status !== "approved-seed"}
                                    onClick={() => void runGenerationAction(item, "generate")}
                                  >
                                    Generate
                                  </AdminButton>
                                  <AdminButton
                                    size="sm"
                                    icon={<CheckCircle2 />}
                                    loading={busySlug === `${item.ocSlug}:approve`}
                                    disabled={
                                      item.assetCoverage.stagedDesignAssets.existing <
                                      item.assetCoverage.stagedDesignAssets.expected
                                    }
                                    onClick={() => void runGenerationAction(item, "approve")}
                                  >
                                    Approve
                                  </AdminButton>
                                  <AdminButton
                                    size="sm"
                                    variant="danger"
                                    icon={<XCircle />}
                                    loading={busySlug === `${item.ocSlug}:reject`}
                                    onClick={() => void runGenerationAction(item, "reject")}
                                  >
                                    Reject
                                  </AdminButton>
                                </div>
                                {item.generation.qaIssues.length ? (
                                  <div className="mt-2 max-w-[240px] text-xs leading-5 text-amber-300/80">
                                    {item.generation.qaIssues[0]}
                                  </div>
                                ) : null}
                              </td>
                              <td className="max-w-[360px] px-4 py-4 text-xs leading-5 text-zinc-400">
                                {item.geometryBrief}
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex flex-wrap gap-2">
                                  <a
                                    href={item.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/25 bg-blue-500/8 px-3 py-1.5 text-xs font-medium text-blue-300 transition hover:bg-blue-500/12"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    Open
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => void copySourceUrl(item)}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/3 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/6"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                    {copiedSlug === item.ocSlug ? "Copied" : "Copy"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </AdminTableShell>
                  }
                  mobile={
                    <div className="space-y-2">
                      {visibleItems.map((item) => (
                        <AdminMobileCard
                          key={item.ocSlug}
                          title={item.ocName}
                          subtitle={`Original: ${item.originalReferenceLabel}`}
                          badge={
                            <AdminStatusBadge tone={statusTone(item.status)}>
                              {item.status}
                            </AdminStatusBadge>
                          }
                          rows={[
                            { label: "Slug", value: item.ocSlug },
                            { label: "Verified", value: item.verifiedAsOf },
                            { label: "Generation", value: item.generation.generationStatus },
                            {
                              label: "Design assets",
                              value: `${item.assetCoverage.designAssets.existing}/${item.assetCoverage.designAssets.expected}`,
                            },
                            {
                              label: "Staged",
                              value: `${item.assetCoverage.stagedDesignAssets.existing}/${item.assetCoverage.stagedDesignAssets.expected}`,
                            },
                            { label: "Car renders", value: item.assetCoverage.renders.carCount },
                          ]}
                          footer={
                            <div className="flex flex-wrap gap-2 pr-6">
                              <AdminButton
                                size="sm"
                                icon={<Play />}
                                disabled={item.status !== "approved-seed"}
                                loading={busySlug === `${item.ocSlug}:generate`}
                                onClick={() => void runGenerationAction(item, "generate")}
                              >
                                Generate
                              </AdminButton>
                              <AdminButton
                                size="sm"
                                icon={<CheckCircle2 />}
                                disabled={
                                  item.assetCoverage.stagedDesignAssets.existing <
                                  item.assetCoverage.stagedDesignAssets.expected
                                }
                                loading={busySlug === `${item.ocSlug}:approve`}
                                onClick={() => void runGenerationAction(item, "approve")}
                              >
                                Approve
                              </AdminButton>
                              <a
                                href={item.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/25 bg-blue-500/8 px-3 py-1.5 text-xs font-medium text-blue-300"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Open source
                              </a>
                              <button
                                type="button"
                                onClick={() => void copySourceUrl(item)}
                                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/3 px-3 py-1.5 text-xs font-medium text-zinc-300"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                {copiedSlug === item.ocSlug ? "Copied" : "Copy"}
                              </button>
                            </div>
                          }
                        />
                      ))}
                    </div>
                  }
                />
              ) : (
                <AdminEmptyState
                  title="No forged references match these filters"
                  description="Adjust status, brand, or search text to inspect another reference."
                />
              )}
            </div>

            <aside className="space-y-4">
              <AdminInspectorCard
                title="QA rule"
                description="Generation remains blocked until a model-level official source is verified."
              >
                <div className="space-y-3 text-sm leading-6 text-zinc-400">
                  <p>
                    Approved seed entries may be used for OC-branded render work. Needs-review
                    entries stay research-only.
                  </p>
                  <p>
                    Carbon assets must be dedicated carbon-composite renders, not darkened
                    aluminium.
                  </p>
                  <p>
                    Every approved wheel must carry the One Company carbon center cap and no
                    third-party cap, lip, barrel, or spoke branding.
                  </p>
                </div>
              </AdminInspectorCard>

              <AdminInspectorCard title="Needs model review" description="Blocked source rows.">
                <div className="space-y-2">
                  {data.items
                    .filter((item) => item.status === "needs-model-page-review")
                    .map((item) => (
                      <div
                        key={item.ocSlug}
                        className="rounded-none border border-amber-500/20 bg-amber-500/5 px-3 py-3"
                      >
                        <div className="text-sm font-medium text-zinc-100">{item.ocName}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {item.sourceBrand} / {item.sourceModel}
                        </div>
                      </div>
                    ))}
                  {data.summary.needsReview === 0 ? (
                    <div className="rounded-none border border-white/8 bg-black/20 px-3 py-6 text-sm text-zinc-500">
                      No blocked references.
                    </div>
                  ) : null}
                </div>
              </AdminInspectorCard>

              <AdminInspectorCard
                title="Asset gaps"
                description="Reference-led slugs missing files."
              >
                <div className="space-y-2">
                  {data.items
                    .filter((item) => item.assetCoverage.designAssets.existing === 0)
                    .map((item) => (
                      <div
                        key={item.ocSlug}
                        className="rounded-none border border-red-500/20 bg-red-500/5 px-3 py-3"
                      >
                        <div className="text-sm font-medium text-zinc-100">{item.ocSlug}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {item.assetCoverage.designAssets.expected} expected design assets /{" "}
                          {item.assetCoverage.renders.carCount} car render sets
                        </div>
                      </div>
                    ))}
                </div>
              </AdminInspectorCard>
            </aside>
          </div>
        </>
      ) : (
        <AdminEmptyState
          title="Forged references are unavailable"
          description={error || "The protected reference API did not return data."}
        />
      )}
    </AdminPage>
  );
}

function SelectFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block min-w-[190px]">
      <span className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/20 focus:outline-hidden"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
