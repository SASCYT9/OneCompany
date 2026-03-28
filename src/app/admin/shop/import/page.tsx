'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  FileCheck,
  FileClock,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';

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
  CREATE: 'Тільки створення, конфлікти як помилки',
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

export default function AdminShopImportPage() {
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
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedJob, setSelectedJob] = useState<ImportJobSummary | null>(null);
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

  const loadJobDetail = useCallback(async (jobId: string) => {
    const response = await fetch(`/api/admin/shop/imports/${jobId}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Не вдалося завантажити імпорт');
    }
    setSelectedJob(data as ImportJobSummary);
  }, []);

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
        throw new Error(jobsData.error || 'Не вдалося завантажити список імпортів');
      }

      const templateItems = templatesData as ImportTemplate[];
      const jobItems = jobsData as ImportJobSummary[];
      setTemplates(templateItems);
      setJobs(jobItems);

      const nextSelectedJobId =
        selectedJobId && jobItems.some((item) => item.id === selectedJobId)
          ? selectedJobId
          : jobItems[0]?.id || '';

      setSelectedJobId(nextSelectedJobId);
      if (nextSelectedJobId) {
        await loadJobDetail(nextSelectedJobId);
      } else {
        setSelectedJob(null);
      }
    } catch (refreshError) {
      setError((refreshError as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [loadJobDetail, selectedJobId]);

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

      if (data.job?.id) {
        setSelectedJobId(String(data.job.id));
        setSelectedJob(data.job as ImportJobSummary);
      }

      await refreshCenter();
      setSuccess(action === 'dry-run' ? 'Пробний прогон завершено.' : 'Імпорт виконано.');
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
        templateDraft.id
          ? `/api/admin/shop/imports/templates/${templateDraft.id}`
          : '/api/admin/shop/imports/templates',
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

  return (
    <div className="h-full overflow-auto">
      <div className="w-full px-6 md:px-12 py-6">
        <Link href="/admin/shop" className="inline-flex items-center gap-2 text-sm text-white/60 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Назад до каталогу
        </Link>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold text-white">Центр імпорту CSV</h2>
            <p className="mt-2 max-w-[1920px] text-sm text-white/45">
              Пробний прогон та імпорт з CSV (формат Shopify), збереження мапінгу колонок по постачальниках,
              перегляд минулих імпортів та помилок по рядках.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshCenter()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white transition hover:bg-zinc-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Оновити
          </button>
        </div>

        {error ? <div className="mt-5 rounded-xl bg-red-900/25 px-4 py-3 text-sm text-red-200">{error}</div> : null}
        {success ? <div className="mt-5 rounded-xl bg-emerald-900/20 px-4 py-3 text-sm text-emerald-200">{success}</div> : null}

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 text-white">
              <Upload className="h-4 w-4" />
              <h3 className="text-lg font-medium">Запуск імпорту</h3>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <Field label="Завантажити CSV-файл">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFile}
                  className="block w-full text-sm text-white/70 file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-white"
                />
              </Field>
              <Field label="Ім'я файлу джерела">
                <input
                  value={sourceFilename}
                  onChange={(event) => setSourceFilename(event.target.value)}
                  placeholder="products_export_urban.csv"
                  className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-3 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
                />
              </Field>
              <Field label="Постачальник / джерело">
                <input
                  value={supplierName}
                  onChange={(event) => setSupplierName(event.target.value)}
                  placeholder="Urban Automotive"
                  className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-3 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
                />
              </Field>
              <Field label="Шаблон">
                <select
                  value={selectedTemplateId}
                  onChange={(event) => setSelectedTemplateId(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-3 text-sm text-white focus:border-white/30 focus:outline-none"
                >
                  <option value="">Без шаблону</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Режим при конфлікті">
                <div className="grid gap-2 md:grid-cols-3">
                  {(Object.keys(CONFLICT_MODE_COPY) as ImportConflictMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setConflictMode(mode)}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${
                        conflictMode === mode
                          ? 'border-white/30 bg-white/10 text-white'
                          : 'border-white/10 bg-zinc-950 text-white/60 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      <div className="text-xs uppercase tracking-[0.2em]">{mode}</div>
                      <div className="mt-2 text-sm">{CONFLICT_MODE_COPY[mode]}</div>
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Вміст CSV">
                <textarea
                  value={csvText}
                  onChange={(event) => setCsvText(event.target.value)}
                  rows={18}
                  className="w-full rounded-2xl border border-white/10 bg-zinc-950 px-3 py-3 font-mono text-xs text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
                  placeholder="Вставте сюди CSV (формат Shopify) або завантажте файл."
                />
              </Field>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void runImport('dry-run')}
                disabled={loading || !csvText.trim()}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-800 px-4 py-2.5 text-sm text-white transition hover:bg-zinc-700 disabled:opacity-50"
              >
                <FileCheck className="h-4 w-4" />
                {loading ? 'Виконуємо…' : 'Пробний прогон'}
              </button>
              <button
                type="button"
                onClick={() => void runImport('commit')}
                disabled={loading || !csvText.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {loading ? 'Виконуємо…' : 'Виконати імпорт'}
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-white">
                <Save className="h-4 w-4" />
                <h3 className="text-lg font-medium">Шаблони імпорту</h3>
              </div>
              <button
                type="button"
                onClick={resetTemplateDraft}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-white transition hover:bg-zinc-700"
              >
                <Plus className="h-4 w-4" />
                Новий
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {templates.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-white/45">
                  Шаблонів ще немає. Додайте шаблон для мапінгу колонок по постачальнику.
                </div>
              ) : (
                templates.map((template) => (
                  <div
                    key={template.id}
                    className={`rounded-2xl border px-4 py-3 ${
                      selectedTemplateId === template.id ? 'border-white/30 bg-white/8' : 'border-white/10 bg-zinc-950/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <button
                          type="button"
                          onClick={() => setSelectedTemplateId(template.id)}
                          className="text-left text-sm font-medium text-white transition hover:text-white/80"
                        >
                          {template.name}
                        </button>
                        <div className="mt-1 text-xs text-white/45">
                          {(template.supplierName || 'Без постачальника') + ' · ' + template.defaultConflictMode}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => editTemplate(template)}
                          className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/70 transition hover:border-white/25 hover:text-white"
                        >
                          Редагувати
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteTemplate(template.id)}
                          disabled={deletingTemplateId === template.id}
                          className="rounded-lg border border-red-500/25 px-2 py-1 text-xs text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                        >
                          Видалити
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
              <div className="text-sm font-medium text-white">
                {templateDraft.id ? 'Редагувати шаблон' : 'Створити шаблон'}
              </div>
              <div className="mt-4 grid gap-4">
                <Field label="Назва шаблону">
                  <input
                    value={templateDraft.name}
                    onChange={(event) => setTemplateDraftField('name', event.target.value)}
                    placeholder="Urban supplier remap"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
                  />
                </Field>
                <Field label="Назва постачальника">
                  <input
                    value={templateDraft.supplierName}
                    onChange={(event) => setTemplateDraftField('supplierName', event.target.value)}
                    placeholder="Urban Automotive"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
                  />
                </Field>
                <Field label="Режим при конфлікті за замовч.">
                  <select
                    value={templateDraft.defaultConflictMode}
                    onChange={(event) =>
                      setTemplateDraftField('defaultConflictMode', event.target.value as ImportConflictMode)
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white focus:border-white/30 focus:outline-none"
                  >
                    {(Object.keys(CONFLICT_MODE_COPY) as ImportConflictMode[]).map((mode) => (
                      <option key={mode} value={mode}>
                        {mode} — {CONFLICT_MODE_COPY[mode]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Примітки">
                  <textarea
                    value={templateDraft.notes}
                    onChange={(event) => setTemplateDraftField('notes', event.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
                    placeholder="Використовуйте цей шаблон, коли назви колонок постачальника відрізняються від стандартного експорту Shopify."
                  />
                </Field>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-xs uppercase tracking-[0.2em] text-white/45">
                      Мапінг колонок
                    </span>
                    <button
                      type="button"
                      onClick={addMappingRow}
                      className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/70 transition hover:border-white/25 hover:text-white"
                    >
                      Додати рядок
                    </button>
                  </div>
                  <div className="space-y-2">
                    {templateDraft.mappingRows.map((row) => (
                      <div key={row.id} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                        <input
                          value={row.source}
                          onChange={(event) => updateMappingRow(row.id, { source: event.target.value })}
                          placeholder="Колонка в CSV"
                          className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
                        />
                        <input
                          value={row.target}
                          onChange={(event) => updateMappingRow(row.id, { target: event.target.value })}
                          placeholder="Поле в системі (Shopify)"
                          className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeMappingRow(row.id)}
                          className="rounded-xl border border-white/10 px-3 py-3 text-white/60 transition hover:border-red-500/25 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void saveTemplate()}
                    disabled={savingTemplate}
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {savingTemplate ? 'Зберігаємо…' : templateDraft.id ? 'Зберегти шаблон' : 'Створити шаблон'}
                  </button>
                  {templateDraft.id ? (
                    <button
                      type="button"
                      onClick={resetTemplateDraft}
                      className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 transition hover:border-white/25 hover:text-white"
                    >
                      Скасувати редагування
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 text-white">
              <FileClock className="h-4 w-4" />
              <h3 className="text-lg font-medium">Історія імпортів</h3>
            </div>

            <div className="mt-5 space-y-3">
              {jobs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-white/45">
                  Імпортів поки немає.
                </div>
              ) : (
                jobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => {
                      setSelectedJobId(job.id);
                      void loadJobDetail(job.id).catch((loadError) => setError((loadError as Error).message));
                    }}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                      selectedJobId === job.id
                        ? 'border-white/30 bg-white/8'
                        : 'border-white/10 bg-zinc-950/40 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                          {job.action.replace('_', ' ')} · {job.status}
                        </div>
                        <div className="mt-2 text-sm font-medium text-white">
                          {job.sourceFilename || 'Імпорт без назви'}
                        </div>
                        <div className="mt-1 text-xs text-white/45">
                          {(job.template?.name || 'Без шаблону') + ' · ' + job.conflictMode}
                        </div>
                      </div>
                      <div className="text-right text-xs text-white/45">
                        <div>{new Date(job.createdAt).toLocaleString()}</div>
                        <div className="mt-1">
                          {job.createdCount} створено · {job.updatedCount} оновлено
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-white/60">
                      <MetricBox label="Рядків" value={job.totalRows} />
                      <MetricBox label="Товарів" value={job.productsCount} />
                      <MetricBox label="Валідних" value={job.validProducts} />
                      <MetricBox label="Помилок" value={job.errorCount} />
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 text-white">
              <FileCheck className="h-4 w-4" />
              <h3 className="text-lg font-medium">Деталі імпорту</h3>
            </div>

            {!selectedJob ? (
              <div className="mt-5 rounded-2xl border border-dashed border-white/10 px-4 py-8 text-sm text-white/45">
                Оберіть імпорт зі списку, щоб переглянути підсумок, виявлені колонки та помилки по рядках.
              </div>
            ) : (
              <div className="mt-5 space-y-5">
                <div className="grid gap-3 md:grid-cols-4">
                  <MetricCard label="Рядків" value={selectedJob.totalRows} />
                  <MetricCard label="Товарів" value={selectedJob.productsCount} />
                  <MetricCard label="Варіантів" value={selectedJob.variantsCount} />
                  <MetricCard label="Помилок" value={selectedJob.errorCount} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <InfoPanel
                    title="Виконання"
                    rows={[
                      ['Дія', selectedJob.action],
                      ['Статус', selectedJob.status],
                      ['Режим при конфлікті', selectedJob.conflictMode],
                      ['Шаблон', selectedJob.template?.name ?? 'Без шаблону'],
                      ['Постачальник', selectedJob.supplierName ?? '—'],
                      ['Виконавець', selectedJob.actorName || selectedJob.actorEmail],
                    ]}
                  />
                  <InfoPanel
                    title="Результат"
                    rows={[
                      ['Валідних товарів', String(selectedJob.validProducts)],
                      ['Створено', String(selectedJob.createdCount)],
                      ['Оновлено', String(selectedJob.updatedCount)],
                      ['Пропущено', String(selectedJob.skippedCount)],
                      ['Помилок', String(selectedJob.errorCount)],
                      ['Створено о', new Date(selectedJob.createdAt).toLocaleString()],
                    ]}
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
                  <div className="text-sm font-medium text-white">Виявлені колонки</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(selectedJob.columns ?? []).map((column) => (
                      <span
                        key={column}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/65"
                      >
                        {column}
                      </span>
                    ))}
                    {!selectedJob.columns?.length ? (
                      <span className="text-sm text-white/45">Дані про колонки не збережено.</span>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
<div className="text-sm font-medium text-white">Помилки по рядках</div>
              {!selectedJob.rowErrors.length ? (
                <div className="mt-3 text-sm text-emerald-200">Помилок по рядках для цього імпорту не збережено.</div>
                  ) : (
                    <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 text-white/60">
                          <tr>
                            <th className="px-3 py-2 font-medium">Рядок</th>
                            <th className="px-3 py-2 font-medium">Handle</th>
                            <th className="px-3 py-2 font-medium">Повідомлення</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedJob.rowErrors.map((rowError) => (
                            <tr key={rowError.id} className="border-t border-white/5 align-top">
                              <td className="px-3 py-3 text-white/70">{rowError.rowNumber}</td>
                              <td className="px-3 py-3 text-white/55">{rowError.handle || '—'}</td>
                              <td className="px-3 py-3 text-white/75">
                                <div>{rowError.message}</div>
                                {rowError.payload ? (
                                  <pre className="mt-2 overflow-auto rounded-xl border border-white/10 bg-black/35 p-2 text-[11px] text-white/45">
                                    {JSON.stringify(rowError.payload, null, 2)}
                                  </pre>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-white/45">
        {props.label}
      </span>
      {props.children}
    </label>
  );
}

function MetricBox(props: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">{props.label}</div>
      <div className="mt-1 text-sm text-white">{props.value}</div>
    </div>
  );
}

function MetricCard(props: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-white/40">{props.label}</div>
      <div className="mt-2 text-2xl font-light text-white">{props.value}</div>
    </div>
  );
}

function InfoPanel(props: { title: string; rows: Array<[string, string]> }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
      <div className="text-sm font-medium text-white">{props.title}</div>
      <div className="mt-3 space-y-2">
        {props.rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 text-sm">
            <span className="text-white/45">{label}</span>
            <span className="text-right text-white/75">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
