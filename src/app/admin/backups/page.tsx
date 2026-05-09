"use client";

import { useEffect, useMemo, useState } from "react";

import { Database, Loader2, RefreshCw } from "lucide-react";

import {
  AdminActionBar,
  AdminEmptyState,
  AdminInlineAlert,
  AdminInspectorCard,
  AdminKeyValueGrid,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminSplitDetailShell,
  AdminStatusBadge,
  AdminTableShell,
} from "@/components/admin/AdminPrimitives";

type BackupItem = {
  filename: string;
  sizeBytes: number;
  createdAt: string;
};

type BackupsResponse = {
  items?: BackupItem[];
  managedExternally?: boolean;
  message?: string;
  error?: string;
};

function formatBytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("uk-UA");
}

export default function AdminBackupsPage() {
  const [items, setItems] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [managedExternally, setManagedExternally] = useState(false);
  const [managedMessage, setManagedMessage] = useState("");

  const loadBackups = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/backups", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as BackupsResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Failed to load backups");
      }

      setItems(Array.isArray(payload.items) ? payload.items : []);
      setManagedExternally(Boolean(payload.managedExternally));
      setManagedMessage(payload.message || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load backups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBackups();
  }, []);

  const createBackup = async () => {
    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/backups", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as BackupsResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Failed to create backup");
      }

      setSuccess("Backup created successfully.");
      await loadBackups();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create backup");
    } finally {
      setCreating(false);
    }
  };

  const totalSize = useMemo(() => items.reduce((sum, item) => sum + item.sizeBytes, 0), [items]);

  const latestBackup = items[0] ?? null;

  const policyTone = managedExternally
    ? "warning"
    : error
      ? "danger"
      : items.length
        ? "success"
        : "default";

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="System"
        title="Backups and recovery"
        description="Operational recovery workspace for local database dumps, runtime backup policy, and restore guardrails."
        actions={
          <AdminStatusBadge
            tone={
              managedExternally
                ? "warning"
                : error
                  ? "danger"
                  : items.length
                    ? "success"
                    : "default"
            }
          >
            {managedExternally
              ? "Managed externally"
              : error
                ? "Needs attention"
                : items.length
                  ? "Local backups ready"
                  : "No backups yet"}
          </AdminStatusBadge>
        }
      />

      <AdminMetricGrid>
        <AdminMetricCard
          label="Backup files"
          value={items.length.toString()}
          meta="Local dump files discovered in the workspace"
          tone="accent"
        />
        <AdminMetricCard
          label="Total size"
          value={formatBytes(totalSize)}
          meta="Combined size of currently available local dumps"
        />
        <AdminMetricCard
          label="Latest backup"
          value={latestBackup ? formatDate(latestBackup.createdAt) : "—"}
          meta={latestBackup ? latestBackup.filename : "No local backup recorded"}
        />
        <AdminMetricCard
          label="Policy"
          value={managedExternally ? "External" : "Local"}
          meta={
            managedExternally
              ? "Runtime backup creation is disabled here"
              : "Local backup creation is available"
          }
        />
      </AdminMetricGrid>

      <AdminActionBar>
        <div className="flex flex-wrap items-center gap-2">
          {error ? <AdminInlineAlert tone="warning">{error}</AdminInlineAlert> : null}
          {success ? <AdminInlineAlert tone="success">{success}</AdminInlineAlert> : null}
          {!error && !success && managedExternally && managedMessage ? (
            <AdminInlineAlert tone="warning">{managedMessage}</AdminInlineAlert>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadBackups()}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/3 px-3 py-2 text-xs uppercase tracking-[0.18em] text-zinc-300 transition hover:text-zinc-100"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload
          </button>
          <button
            type="button"
            onClick={() => void createBackup()}
            disabled={creating || managedExternally}
            className="inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/8 px-4 py-2 text-xs uppercase tracking-[0.18em] text-blue-300 transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {creating ? (
              <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" />
            ) : (
              <Database className="h-3.5 w-3.5" />
            )}
            {managedExternally
              ? "Externally managed"
              : creating
                ? "Creating backup"
                : "Create backup now"}
          </button>
        </div>
      </AdminActionBar>

      <AdminSplitDetailShell
        main={
          loading ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-none border border-white/10 bg-[#171717] text-sm text-zinc-400">
              <Loader2 className="mr-3 h-4 w-4 motion-safe:animate-spin" />
              Loading backups…
            </div>
          ) : items.length === 0 ? (
            <AdminEmptyState
              title={
                managedExternally
                  ? "Backups are managed outside the runtime"
                  : "No local backups yet"
              }
              description={
                managedExternally
                  ? managedMessage ||
                    "This environment expects backup automation to run outside the app runtime."
                  : "Create the first local backup to capture a recoverable database snapshot before the next risky catalog or import operation."
              }
            />
          ) : (
            <AdminTableShell>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-white/10 bg-white/3 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    <tr>
                      <th className="px-5 py-4 font-medium">Filename</th>
                      <th className="px-5 py-4 font-medium">Size</th>
                      <th className="px-5 py-4 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.filename} className="border-b border-white/6 hover:bg-white/3">
                        <td className="px-5 py-4 font-mono text-xs text-zinc-200">
                          {item.filename}
                        </td>
                        <td className="px-5 py-4 text-zinc-400">{formatBytes(item.sizeBytes)}</td>
                        <td className="px-5 py-4 text-zinc-400">{formatDate(item.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AdminTableShell>
          )
        }
        sidebar={
          <>
            <AdminInspectorCard
              title="Runtime policy"
              description="Backup creation policy derived from the current runtime and environment configuration."
            >
              <div className="space-y-4">
                <AdminStatusBadge tone={policyTone}>
                  {managedExternally
                    ? "Production managed externally"
                    : error
                      ? "Backup creation failed"
                      : items.length
                        ? "Local backups available"
                        : "No backups yet"}
                </AdminStatusBadge>
                <AdminKeyValueGrid
                  rows={[
                    {
                      label: "Latest backup",
                      value: latestBackup ? formatDate(latestBackup.createdAt) : "—",
                    },
                    { label: "Managed externally", value: managedExternally ? "Yes" : "No" },
                    {
                      label: "Workspace retention",
                      value: "Controlled by runtime policy and local pruning",
                    },
                  ]}
                />
                {managedMessage ? (
                  <div className="text-xs leading-5 text-zinc-500">{managedMessage}</div>
                ) : null}
              </div>
            </AdminInspectorCard>

            <AdminInspectorCard
              title="Recovery notes"
              description="Operational reminders for backup handling and restore readiness."
            >
              <AdminKeyValueGrid
                rows={[
                  {
                    label: "Runtime limit",
                    value: "Vercel runtimes do not ship pg_dump in production.",
                  },
                  {
                    label: "Prod strategy",
                    value: "Use external automation and storage for production dumps.",
                  },
                  {
                    label: "Restore path",
                    value: "Use psql or pg_restore after taking a fresh safety dump.",
                  },
                ]}
              />
            </AdminInspectorCard>
          </>
        }
      />
    </AdminPage>
  );
}
