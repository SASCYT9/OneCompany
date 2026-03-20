'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileClock, RefreshCcw, Search } from 'lucide-react';

type AuditLogItem = {
  id: string;
  actorEmail: string;
  actorName: string | null;
  scope: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
};

export default function AdminShopAuditPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [entityType, setEntityType] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ scope: 'shop', take: '100' });
        if (entityType) params.set('entityType', entityType);

        const response = await fetch(`/api/admin/shop/audit?${params.toString()}`);
        const data = await response.json().catch(() => []);
        if (!response.ok) {
          setError((data as { error?: string }).error || 'Не вдалося завантажити журнал аудиту');
          return;
        }

        setLogs(data as AuditLogItem[]);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [entityType, reloadKey]);

  const entityTypes = useMemo(() => Array.from(new Set(logs.map((log) => log.entityType))).sort(), [logs]);

  const filteredLogs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return logs;

    return logs.filter((log) =>
      [
        log.actorEmail,
        log.actorName,
        log.scope,
        log.action,
        log.entityType,
        log.entityId,
        JSON.stringify(log.metadata),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [logs, query]);

  if (loading) {
    return (
      <div className="p-6 text-white/60 flex items-center gap-2">
        <FileClock className="h-5 w-5 animate-pulse" />
        Завантаження журналу аудиту…
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/admin/shop" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Назад до каталогу
            </Link>
            <h2 className="mt-3 text-2xl font-semibold text-white">Журнал аудиту магазину</h2>
            <p className="mt-2 text-sm text-white/45">
              Всі дії з каталогом, складом, цінами, налаштуваннями та замовленнями в адмінці магазину.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700"
          >
            <RefreshCcw className="h-4 w-4" />
            Оновити
          </button>
        </div>

        <div className="mb-4 grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[1fr_240px]">
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white">
            <Search className="h-4 w-4 text-white/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Пошук за виконавцем, дією, сутністю або метаданими"
              className="w-full bg-transparent text-white placeholder:text-white/25 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-white/50">Тип сутності</span>
            <select
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
            >
              <option value="">Усі типи</option>
              {entityTypes.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
          {filteredLogs.length} записів у журналі
        </div>

        {error ? <div className="mb-4 rounded-lg bg-red-900/20 p-3 text-sm text-red-300">{error}</div> : null}

        {filteredLogs.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-center text-white/45">
            Подій аудиту не знайдено.
          </div>
        ) : (
          <div className="space-y-3 pb-6">
            {filteredLogs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-white">{log.action}</div>
                    <div className="mt-1 text-xs text-white/45">
                      {log.entityType}
                      {log.entityId ? ` · ${log.entityId}` : ''}
                    </div>
                  </div>
                  <div className="text-xs text-white/45">{new Date(log.createdAt).toLocaleString()}</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/60">
                  <span>Виконавець: {log.actorName ? `${log.actorName} · ` : ''}{log.actorEmail}</span>
                  <span>Область: {log.scope}</span>
                </div>
                {log.metadata ? (
                  <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/65">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
