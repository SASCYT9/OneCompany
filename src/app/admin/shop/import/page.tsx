'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  ExternalLink,
  FileCheck,
  FileClock,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';

import {
  AdminActionBar,
  AdminEditorSection,
  AdminEmptyState,
  AdminInlineAlert,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableShell,
} from '@/components/admin/AdminPrimitives';

type ImportConflictMode = 'SKIP' | 'UPDATE' | 'CREATE';
type ImportAction = 'DRY_RUN' | 'COMMIT';
type ImportStatus = 'COMPLETED' | 'FAILED';

type ImportTemplate = {
  id: string;
  name: string;
  supplierName: string | null;
  sourceType: string;
  notes: string | null;
  fieldMapping: Record<string, string> | null;
  defaultConflictMode: ImportConflictMode;
  jobsCount: number;
  createdAt: string;
  updatedAt: string;
};

type ImportJobSummary = {
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
  createdAt: string;
  updatedAt: string;
};

type MappingRow = { id: string; source: string; target: string };

type TemplateDraft = {
  id: string | null;
  name: string;
  supplierName: string;
  notes: string;
  defaultConflictMode: ImportConflictMode;
  mappingRows: MappingRow[];
};

const CONFLICT_MODE_COPY: Record<ImportConflictMode, string> = {
  UPDATE: 'Оновлювати існуючі товари',
  SKIP: 'Пропускати існуючі товари',
  CREATE: 'Конфлікт як помилка',
};

function buildMappingRows(fieldMapping: Record<string, string> | null | undefined): MappingRow[] {
  const rows = Object.entries(fieldMapping ?? {}).map(([source, target]) => ({
    id: crypto.randomUUID(),
    source,
    target,
  }));
  return rows.length ? rows : [{ id: crypto.randomUUID(), source: '', target: '' }];
}

function buildTemplateDraft(template?: ImportTemplate | null): TemplateDraft {
  if (!template) {
    return {
      id: null,
      name: '',
      supplierName: '',
      notes: '',
      defaultConflictMode: 'UPDATE',
      mappingRows: [{ id: crypto.randomUUID(), source: '', target: '' }],
    };
  }

  return {
    id: template.id,
    name: template.name,
    supplierName: template.supplierName ?? '',
    notes: template.notes ?? '',
    defaultConflictMode: template.defaultConflictMode,
    mappingRows: buildMappingRows(template.fieldMapping),
  };
}

function mappingRowsToObject(rows: MappingRow[]) {
  return rows.reduce<Record<string, string>>((accumulator, row) => {
    const source = row.source.trim();
    const target = row.target.trim();
    if (!source || !target) {
      return accumulator;
    }
    accumulator[source] = target;
    return accumulator;
  }, {});
}

function formatAction(action: ImportAction) {
  return action === 'DRY_RUN' ? 'Dry run' : 'Commit';
}

export default function AdminShopImportPage() {
  const router = useRouter();
  const [csvText, setCsvText] = useState('');
  const [sourceFilename, setSourceFilename] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [conflictMode, setConflictMode] = useState<ImportConflictMode>('UPDATE');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [jobs, setJobs] = useState<ImportJobSummary[]>([]);
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>(() => buildTemplateDraft());
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates]
  );

  useEffect(() => {
    if (!selectedTemplate) return;
    setSupplierName((current) => current || selectedTemplate.supplierName || '');
    setConflictMode(selectedTemplate.defaultConflictMode);
  }, [selectedTemplate]);

  const refreshCenter = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      const [templatesResponse, jobsResponse] = await Promise.all([
        fetch('/api/admin/shop/imports/templates'),
        fetch('/api/admin/shop/imports'),
      ]);
      const [templatesData, jobsData] = await Promise.all([
        templatesResponse.json().catch(() => []),
        jobsResponse.json().catch(() => []),
      ]);

      if (!templatesResponse.ok) {
        throw new Error(templatesData.error || 'Не вдалося завантажити шаблони імпорту');
      }
      if (!jobsResponse.ok) {
        throw new Error(jobsData.error || 'Не вдалося завантажити історію імпортів');
      }

      setTemplates(templatesData as ImportTemplate[]);
      setJobs(jobsData as ImportJobSummary[]);
    } catch (refreshError) {
      setError((refreshError as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshCenter();
  }, [refreshCenter]);

  async function runImport(action: 'dry-run' | 'commit') {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/admin/shop/imports/csv/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText,
          sourceFilename: sourceFilename || null,
          supplierName: supplierName || null,
          templateId: selectedTemplateId || null,
          conflictMode,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Запит імпорту не виконано');
      }

      await refreshCenter();
      setSuccess(action === 'dry-run' ? 'Пробний прогон завершено.' : 'Імпорт виконано.');

      if (data.job?.id) {
        router.push(`/admin/shop/import/jobs/${data.job.id}`);
      }
    } catch (runError) {
      setError((runError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSourceFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ''));
    reader.readAsText(file);
  }

  function resetTemplateDraft() {
    setTemplateDraft(buildTemplateDraft());
  }

  function editTemplate(template: ImportTemplate) {
    setTemplateDraft(buildTemplateDraft(template));
  }

  function setTemplateDraftField<Key extends keyof TemplateDraft>(key: Key, value: TemplateDraft[Key]) {
    setTemplateDraft((current) => ({ ...current, [key]: value }));
  }

  function updateMappingRow(rowId: string, patch: Partial<MappingRow>) {
    setTemplateDraft((current) => ({
      ...current,
      mappingRows: current.mappingRows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    }));
  }

  function addMappingRow() {
    setTemplateDraft((current) => ({
      ...current,
      mappingRows: [...current.mappingRows, { id: crypto.randomUUID(), source: '', target: '' }],
    }));
  }

  function removeMappingRow(rowId: string) {
    setTemplateDraft((current) => {
      const nextRows = current.mappingRows.filter((row) => row.id !== rowId);
      return {
        ...current,
        mappingRows: nextRows.length ? nextRows : [{ id: crypto.randomUUID(), source: '', target: '' }],
      };
    });
  }

  async function saveTemplate() {
    setSavingTemplate(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        name: templateDraft.name,
        supplierName: templateDraft.supplierName || null,
        notes: templateDraft.notes || null,
        sourceType: 'shopify_csv',
        defaultConflictMode: templateDraft.defaultConflictMode,
        fieldMapping: mappingRowsToObject(templateDraft.mappingRows),
      };

      const response = await fetch(
        templateDraft.id ? `/api/admin/shop/imports/templates/${templateDraft.id}` : '/api/admin/shop/imports/templates',
        {
          method: templateDraft.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Не вдалося зберегти шаблон');
      }

      setSuccess(templateDraft.id ? 'Шаблон оновлено.' : 'Шаблон створено.');
      resetTemplateDraft();
      await refreshCenter();
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setSavingTemplate(false);
    }
  }

  async function deleteTemplate(templateId: string) {
    if (!confirm('Видалити цей шаблон імпорту?')) return;
    setDeletingTemplateId(templateId);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/admin/shop/imports/templates/${templateId}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Не вдалося видалити шаблон');
      }

      if (selectedTemplateId === templateId) {
        setSelectedTemplateId('');
      }
      if (templateDraft.id === templateId) {
        resetTemplateDraft();
      }

      setSuccess('Шаблон видалено.');
      await refreshCenter();
    } catch (deleteError) {
      setError((deleteError as Error).message);
    } finally {
      setDeletingTemplateId(null);
    }
  }

  const failedJobs = jobs.filter((job) => job.status === 'FAILED').length;
  const lastJob = jobs[0] ?? null;
  const templateCount = templates.length;

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Imports & Integrations"
        title="CSV Import Center"
        description="Операційний центр для dry-run, commit, шаблонів мапінгу і журналу попередніх імпортів. Результат кожного запуску відкривається окремим job review."
        actions={
          <>
            <Link
              href="/admin/shop/audit"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:border-white/25 hover:text-zinc-100"
            >
              <FileClock className="h-4 w-4" />
              Audit trail
            </Link>
            <button
              type="button"
              onClick={() => void refreshCenter()}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:border-white/25 hover:text-zinc-100"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'motion-safe:animate-spin' : ''}`} />
              Refresh
            </button>
          </>
        }
      />

      <AdminMetricGrid>
        <AdminMetricCard label="Templates" value={templateCount} meta="Збережені supplier mappings" />
        <AdminMetricCard label="Import jobs" value={jobs.length} meta="Останні прогони з журналу" />
        <AdminMetricCard label="Failed jobs" value={failedJobs} meta="Потребують review" tone={failedJobs ? 'accent' : 'default'} />
        <AdminMetricCard
          label="Last run"
          value={lastJob ? formatAction(lastJob.action) : '—'}
          meta={lastJob ? new Date(lastJob.createdAt).toLocaleString() : 'Запусків ще не було'}
        />
      </AdminMetricGrid>

      <AdminActionBar>
        <div className="space-y-1">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Ops flow</div>
          <div className="text-sm text-zinc-300">
            1. Завантажити CSV. 2. Вибрати шаблон і conflict policy. 3. Зробити dry-run. 4. Відкрити job review. 5. Commit після перевірки.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminStatusBadge tone={csvText.trim() ? 'success' : 'warning'}>
            {csvText.trim() ? 'CSV loaded' : 'CSV required'}
          </AdminStatusBadge>
          <AdminStatusBadge tone={selectedTemplateId ? 'default' : 'warning'}>
            {selectedTemplate ? selectedTemplate.name : 'Template optional'}
          </AdminStatusBadge>
          <AdminStatusBadge tone={failedJobs ? 'warning' : 'success'}>
            {failedJobs ? `${failedJobs} failed` : 'No failed jobs'}
          </AdminStatusBadge>
        </div>
      </AdminActionBar>

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}
      {success ? <AdminInlineAlert tone="success">{success}</AdminInlineAlert> : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminEditorSection
          id="run-import"
          title="Run import"
          description="Dry-run і commit використовують той самий payload. Різниця лише в режимі виконання та наступному job review."
        >
          <div className="space-y-5">
            <Field label="Source file">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 px-4 py-2.5 text-sm text-zinc-200 transition hover:border-white/25">
                  <Upload className="h-4 w-4" />
                  Upload CSV
                  <input type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
                </label>
                <span className="text-sm text-zinc-400">{sourceFilename || 'Файл ще не вибраний'}</span>
              </div>
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Template">
                <select
                  value={selectedTemplateId}
                  onChange={(event) => setSelectedTemplateId(event.target.value)}
                  className="w-full rounded-[6px] border border-white/10 bg-[#0F0F0F] px-4 py-3 text-sm text-zinc-100 focus:border-white/20 focus:outline-none"
                >
                  <option value="">Без шаблону</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Conflict mode">
                <select
                  value={conflictMode}
                  onChange={(event) => setConflictMode(event.target.value as ImportConflictMode)}
                  className="w-full rounded-[6px] border border-white/10 bg-[#0F0F0F] px-4 py-3 text-sm text-zinc-100 focus:border-white/20 focus:outline-none"
                >
                  {Object.entries(CONFLICT_MODE_COPY).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Supplier name">
                <input
                  value={supplierName}
                  onChange={(event) => setSupplierName(event.target.value)}
                  className="w-full rounded-[6px] border border-white/10 bg-[#0F0F0F] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-white/20 focus:outline-none"
                  placeholder="Urban, GP Portal, supplier alias..."
                />
              </Field>

              <Field label="Source filename override">
                <input
                  value={sourceFilename}
                  onChange={(event) => setSourceFilename(event.target.value)}
                  className="w-full rounded-[6px] border border-white/10 bg-[#0F0F0F] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-white/20 focus:outline-none"
                  placeholder="catalog.csv"
                />
              </Field>
            </div>

            <Field label="CSV payload">
              <textarea
                value={csvText}
                onChange={(event) => setCsvText(event.target.value)}
                rows={16}
                className="w-full rounded-[6px] border border-white/10 bg-[#0F0F0F] px-4 py-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-white/20 focus:outline-none"
                placeholder="Вставте CSV тут або завантажте файл вище."
              />
            </Field>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void runImport('dry-run')}
                disabled={loading || !csvText.trim()}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:border-white/25 disabled:opacity-50"
              >
                <FileCheck className="h-4 w-4" />
                {loading ? 'Запуск...' : 'Dry run'}
              </button>
              <button
                type="button"
                onClick={() => void runImport('commit')}
                disabled={loading || !csvText.trim()}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {loading ? 'Запуск...' : 'Commit import'}
              </button>
            </div>
          </div>
        </AdminEditorSection>

        <AdminEditorSection
          id="templates"
          title="Templates"
          description="Збережені field mappings дозволяють швидко повторювати dry-run/commit для конкретного supplier format."
        >
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Template name">
                <input
                  value={templateDraft.name}
                  onChange={(event) => setTemplateDraftField('name', event.target.value)}
                  className="w-full rounded-[6px] border border-white/10 bg-[#0F0F0F] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-white/20 focus:outline-none"
                  placeholder="Urban supplier feed"
                />
              </Field>
              <Field label="Default conflict mode">
                <select
                  value={templateDraft.defaultConflictMode}
                  onChange={(event) =>
                    setTemplateDraftField('defaultConflictMode', event.target.value as ImportConflictMode)
                  }
                  className="w-full rounded-[6px] border border-white/10 bg-[#0F0F0F] px-4 py-3 text-sm text-zinc-100 focus:border-white/20 focus:outline-none"
                >
                  {Object.entries(CONFLICT_MODE_COPY).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Supplier name">
                <input
                  value={templateDraft.supplierName}
                  onChange={(event) => setTemplateDraftField('supplierName', event.target.value)}
                  className="w-full rounded-[6px] border border-white/10 bg-[#0F0F0F] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-white/20 focus:outline-none"
                  placeholder="Optional supplier alias"
                />
              </Field>
              <Field label="Notes">
                <input
                  value={templateDraft.notes}
                  onChange={(event) => setTemplateDraftField('notes', event.target.value)}
                  className="w-full rounded-[6px] border border-white/10 bg-[#0F0F0F] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-white/20 focus:outline-none"
                  placeholder="Коли застосовувати цей mapping"
                />
              </Field>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-zinc-100">Field mapping</div>
                <button
                  type="button"
                  onClick={addMappingRow}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-zinc-300 transition hover:border-white/25"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add mapping
                </button>
              </div>

              <div className="space-y-3">
                {templateDraft.mappingRows.map((row) => (
                  <div key={row.id} className="grid gap-3 rounded-[6px] border border-white/10 bg-black/20 p-4 md:grid-cols-[1fr_1fr_auto]">
                    <input
                      value={row.source}
                      onChange={(event) => updateMappingRow(row.id, { source: event.target.value })}
                      className="w-full rounded-[6px] border border-white/10 bg-[#0F0F0F] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-white/20 focus:outline-none"
                      placeholder="supplier_column"
                    />
                    <input
                      value={row.target}
                      onChange={(event) => updateMappingRow(row.id, { target: event.target.value })}
                      className="w-full rounded-[6px] border border-white/10 bg-[#0F0F0F] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-white/20 focus:outline-none"
                      placeholder="shop_field"
                    />
                    <button
                      type="button"
                      onClick={() => removeMappingRow(row.id)}
                      className="inline-flex items-center justify-center rounded-full border border-white/10 px-3 py-3 text-zinc-400 transition hover:border-blue-500/30 hover:text-red-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void saveTemplate()}
                disabled={savingTemplate || !templateDraft.name.trim()}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {savingTemplate ? 'Збереження...' : templateDraft.id ? 'Оновити шаблон' : 'Створити шаблон'}
              </button>
              <button
                type="button"
                onClick={resetTemplateDraft}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-3 text-sm text-zinc-300 transition hover:border-white/25"
              >
                Reset draft
              </button>
            </div>

            {templates.length ? (
              <AdminTableShell>
                <table className="min-w-full text-left text-sm text-zinc-200">
                  <thead className="bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Template</th>
                      <th className="px-4 py-3 font-medium">Supplier</th>
                      <th className="px-4 py-3 font-medium">Jobs</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((template) => (
                      <tr key={template.id} className="border-t border-white/8">
                        <td className="px-4 py-4">
                          <div className="font-medium text-zinc-100">{template.name}</div>
                          <div className="mt-1 text-xs text-zinc-500">{CONFLICT_MODE_COPY[template.defaultConflictMode]}</div>
                        </td>
                        <td className="px-4 py-4 text-zinc-400">{template.supplierName || '—'}</td>
                        <td className="px-4 py-4 text-zinc-300">{template.jobsCount}</td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => editTemplate(template)}
                              className="rounded-full border border-white/10 px-3 py-2 text-xs text-zinc-300 transition hover:border-white/25"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteTemplate(template.id)}
                              disabled={deletingTemplateId === template.id}
                              className="rounded-full border border-white/10 px-3 py-2 text-xs text-zinc-300 transition hover:border-blue-500/30 hover:text-red-200 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AdminTableShell>
            ) : (
              <AdminEmptyState
                title="Шаблонів поки немає"
                description="Створіть mapping template для supplier CSV, щоб менеджер не налаштовував поля заново кожного разу."
              />
            )}
          </div>
        </AdminEditorSection>
      </div>

      <AdminEditorSection
        id="history"
        title="History"
        description="Кожен run створює окремий job. Детальна верифікація row errors, template snapshot і summary відкривається на окремій сторінці."
      >
        {jobs.length ? (
          <AdminTableShell>
            <table className="min-w-full text-left text-sm text-zinc-200">
              <thead className="bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Run</th>
                  <th className="px-4 py-3 font-medium">Template</th>
                  <th className="px-4 py-3 font-medium">Result</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium text-right">Review</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-t border-white/8">
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <AdminStatusBadge tone={job.status === 'FAILED' ? 'danger' : job.action === 'COMMIT' ? 'success' : 'default'}>
                          {formatAction(job.action)}
                        </AdminStatusBadge>
                        <AdminStatusBadge tone={job.status === 'FAILED' ? 'danger' : 'success'}>{job.status}</AdminStatusBadge>
                      </div>
                      <div className="mt-2 font-medium text-zinc-100">{job.sourceFilename || 'Імпорт без назви'}</div>
                      <div className="mt-1 text-xs text-zinc-500">{new Date(job.createdAt).toLocaleString()}</div>
                    </td>
                    <td className="px-4 py-4 text-zinc-300">
                      <div>{job.template?.name ?? 'Без шаблону'}</div>
                      <div className="mt-1 text-xs text-zinc-500">{job.supplierName ?? 'Supplier not set'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-zinc-100">
                        {job.createdCount} created · {job.updatedCount} updated
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {job.validProducts} valid · {job.skippedCount} skipped · {job.errorCount} errors
                      </div>
                    </td>
                    <td className="px-4 py-4 text-zinc-400">{job.actorName || job.actorEmail}</td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end">
                        <Link
                          href={`/admin/shop/import/jobs/${job.id}`}
                          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-zinc-300 transition hover:border-white/25 hover:text-zinc-100"
                        >
                          Review
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableShell>
        ) : (
          <AdminEmptyState
            title="Історія порожня"
            description="Після першого dry-run або commit тут з’являться job records з переходом у детальний review."
          />
        )}
      </AdminEditorSection>
    </AdminPage>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">{props.label}</span>
      {props.children}
    </label>
  );
}
