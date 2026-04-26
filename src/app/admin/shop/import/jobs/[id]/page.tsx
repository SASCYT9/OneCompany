'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ExternalLink, RefreshCw } from 'lucide-react';

import {
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
  AdminTimelineList,
} from '@/components/admin/AdminPrimitives';

type ImportConflictMode = 'SKIP' | 'UPDATE' | 'CREATE';
type ImportAction = 'DRY_RUN' | 'COMMIT';
type ImportStatus = 'COMPLETED' | 'FAILED';

type ImportJobDetail = {
  id: string;
  sourceType: string;
  sourceFilename: string | null;
  supplierName: string | null;
  templateId: string | null;
  template: { id: string; name: string; supplierName: string | null } | null;
  action: ImportAction;
  status: ImportStatus;
  conflictMode: ImportConflictMode;
  actorEmail: string;
  actorName: string | null;
  totalRows: number;
  productsCount: number;
  variantsCount: number;
  validProducts: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  columns: string[] | null;
  templateSnapshot: unknown;
  summary: unknown;
  createdAt: string;
  updatedAt: string;
  rowErrors: Array<{
    id: string;
    rowNumber: number;
    handle: string | null;
    message: string;
    payload: unknown;
    createdAt: string;
  }>;
};

function formatAction(action: ImportAction) {
  return action === 'DRY_RUN' ? 'Dry run' : 'Commit';
}

export default function AdminImportJobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = String(params?.id ?? '');

  const [job, setJob] = useState<ImportJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadJob = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/shop/imports/${jobId}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Не вдалося завантажити import job');
      }
      setJob(data as ImportJobDetail);
    } catch (loadError) {
      setError((loadError as Error).message);
      setJob(null);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void loadJob();
  }, [loadJob]);

  const timelineItems = useMemo<
    Array<{
      id: string;
      title: string;
      meta: string;
      body: string;
      tone: 'default' | 'success' | 'warning' | 'danger';
    }>
  >(() => {
    if (!job) return [];

    const items: Array<{
      id: string;
      title: string;
      meta: string;
      body: string;
      tone: 'default' | 'success' | 'warning' | 'danger';
    }> = [
      {
        id: `${job.id}-created`,
        title: `${formatAction(job.action)} started`,
        meta: new Date(job.createdAt).toLocaleString(),
        body: `${job.totalRows} rows · ${job.validProducts} valid products · ${job.productsCount} products`,
        tone: job.status === 'FAILED' ? 'warning' : 'default',
      },
      {
        id: `${job.id}-result`,
        title: job.status === 'FAILED' ? 'Job finished with failures' : 'Job completed',
        meta: new Date(job.updatedAt).toLocaleString(),
        body: `${job.createdCount} created · ${job.updatedCount} updated · ${job.skippedCount} skipped · ${job.errorCount} errors`,
        tone: job.status === 'FAILED' ? 'danger' : 'success',
      },
    ];

    return items.concat(
      job.rowErrors.slice(0, 10).map((rowError) => ({
        id: rowError.id,
        title: `Row ${rowError.rowNumber}${rowError.handle ? ` · ${rowError.handle}` : ''}`,
        meta: rowError.createdAt ? new Date(rowError.createdAt).toLocaleString() : 'Row error',
        body: rowError.message,
        tone: 'danger' as const,
      }))
    );
  }, [job]);

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Imports & Integrations"
        title={job ? job.sourceFilename || 'Import job review' : 'Import job review'}
        description="Job-level review для dry-run або commit: summary metrics, template snapshot, source metadata і row errors в окремій detail surface."
        actions={
          <>
            <Link
              href="/admin/shop/import"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:border-white/25 hover:text-zinc-100"
            >
              Back to import center
            </Link>
            <button
              type="button"
              onClick={() => void loadJob()}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:border-white/25 hover:text-zinc-100"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'motion-safe:animate-spin' : ''}`} />
              Refresh
            </button>
          </>
        }
      />

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}

      {loading ? (
        <AdminEmptyState
          title="Завантаження job detail"
          description="Підтягуємо summary, template snapshot і row errors для цього запуску імпорту."
        />
      ) : !job ? (
        <AdminEmptyState
          title="Import job не знайдено"
          description="Або запис було видалено, або ідентифікатор некоректний. Поверніться в import center і відкрийте job ще раз."
          action={
            <Link
              href="/admin/shop/import"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:border-white/25 hover:text-zinc-100"
            >
              Open import center
            </Link>
          }
        />
      ) : (
        <>
          <AdminMetricGrid>
            <AdminMetricCard label="Rows" value={job.totalRows} meta="Усі отримані рядки" />
            <AdminMetricCard label="Valid products" value={job.validProducts} meta={`${job.productsCount} products · ${job.variantsCount} variants`} />
            <AdminMetricCard label="Created / Updated" value={`${job.createdCount} / ${job.updatedCount}`} meta={`${job.skippedCount} skipped`} />
            <AdminMetricCard label="Errors" value={job.errorCount} meta={job.status} tone={job.errorCount ? 'accent' : 'default'} />
          </AdminMetricGrid>

          <AdminSplitDetailShell
            main={
              <>
                <AdminInspectorCard
                  title="Execution summary"
                  description="Огляд виконання, source metadata і template context для цього job."
                >
                  <AdminKeyValueGrid
                    rows={[
                      { label: 'Action', value: formatAction(job.action) },
                      {
                        label: 'Status',
                        value: (
                          <div className="flex flex-wrap gap-2">
                            <AdminStatusBadge tone={job.status === 'FAILED' ? 'danger' : 'success'}>{job.status}</AdminStatusBadge>
                            <AdminStatusBadge tone={job.action === 'COMMIT' ? 'success' : 'default'}>{job.action}</AdminStatusBadge>
                          </div>
                        ),
                      },
                      { label: 'Conflict mode', value: job.conflictMode },
                      { label: 'Template', value: job.template?.name ?? 'Без шаблону' },
                      { label: 'Supplier', value: job.supplierName ?? '—' },
                      { label: 'Actor', value: job.actorName || job.actorEmail },
                    ]}
                  />
                </AdminInspectorCard>

                <AdminInspectorCard
                  title="Detected columns"
                  description="Збережені заголовки CSV для швидкої діагностики mapping issues."
                >
                  {!job.columns?.length ? (
                    <div className="text-sm text-zinc-500">Дані про колонки не збережено.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {job.columns.map((column) => (
                        <span key={column} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300">
                          {column}
                        </span>
                      ))}
                    </div>
                  )}
                </AdminInspectorCard>

                <AdminInspectorCard
                  title="Row errors"
                  description="Структурований список row-level failures. Повний payload залишається доступним нижче."
                >
                  <AdminTimelineList
                    items={timelineItems}
                    empty="У цьому запуску немає таймлайну або row-level помилок."
                  />
                </AdminInspectorCard>

                <AdminInspectorCard
                  title="Detailed row payloads"
                  description="Сирі повідомлення і payload snapshot для тих випадків, коли dry-run виявив mapping або validation проблему."
                >
                  {!job.rowErrors.length ? (
                    <div className="text-sm text-emerald-200">Помилок по рядках для цього імпорту не збережено.</div>
                  ) : (
                    <AdminTableShell>
                      <table className="min-w-full text-left text-sm text-zinc-200">
                        <thead className="bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                          <tr>
                            <th className="px-4 py-3 font-medium">Row</th>
                            <th className="px-4 py-3 font-medium">Handle</th>
                            <th className="px-4 py-3 font-medium">Message</th>
                            <th className="px-4 py-3 font-medium">Payload</th>
                          </tr>
                        </thead>
                        <tbody>
                          {job.rowErrors.map((rowError) => (
                            <tr key={rowError.id} className="border-t border-white/8 align-top">
                              <td className="px-4 py-4 text-zinc-300">{rowError.rowNumber}</td>
                              <td className="px-4 py-4 text-zinc-400">{rowError.handle || '—'}</td>
                              <td className="px-4 py-4 text-zinc-200">{rowError.message}</td>
                              <td className="px-4 py-4">
                                {rowError.payload ? (
                                  <pre className="max-h-48 overflow-auto rounded-none border border-white/10 bg-black/30 p-3 text-[11px] text-zinc-400">
                                    {JSON.stringify(rowError.payload, null, 2)}
                                  </pre>
                                ) : (
                                  <span className="text-zinc-500">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </AdminTableShell>
                  )}
                </AdminInspectorCard>
              </>
            }
            sidebar={
              <>
                <AdminInspectorCard
                  title="Source metadata"
                  description="Операційний контекст для повторного запуску або audit follow-up."
                >
                  <AdminKeyValueGrid
                    rows={[
                      { label: 'Job ID', value: job.id },
                      { label: 'Source type', value: job.sourceType },
                      { label: 'Source filename', value: job.sourceFilename ?? '—' },
                      { label: 'Created at', value: new Date(job.createdAt).toLocaleString() },
                      { label: 'Updated at', value: new Date(job.updatedAt).toLocaleString() },
                    ]}
                  />
                </AdminInspectorCard>

                <AdminInspectorCard
                  title="Template snapshot"
                  description="Знімок конфігурації, з якою реально виконувався job."
                >
                  {job.templateSnapshot ? (
                    <pre className="max-h-[420px] overflow-auto rounded-none border border-white/10 bg-black/30 p-3 text-[11px] text-zinc-400">
                      {JSON.stringify(job.templateSnapshot, null, 2)}
                    </pre>
                  ) : (
                    <div className="text-sm text-zinc-500">Template snapshot не збережено.</div>
                  )}
                </AdminInspectorCard>

                <AdminInspectorCard
                  title="Next step"
                  description="Перехід назад у import center або перевірка audit trail для повного операційного сліду."
                >
                  <div className="space-y-2">
                    <Link
                      href="/admin/shop/import"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 px-4 py-3 text-sm text-zinc-300 transition hover:border-white/25 hover:text-zinc-100"
                    >
                      Back to import center
                    </Link>
                    <Link
                      href="/admin/shop/audit"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 px-4 py-3 text-sm text-zinc-300 transition hover:border-white/25 hover:text-zinc-100"
                    >
                      Open audit
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                </AdminInspectorCard>
              </>
            }
          />
        </>
      )}
    </AdminPage>
  );
}
