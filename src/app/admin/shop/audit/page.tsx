'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, RefreshCcw } from 'lucide-react';

import {
  AdminEmptyState,
  AdminFilterBar,
  AdminInlineAlert,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableShell,
} from '@/components/admin/AdminPrimitives';

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

function resolveAuditEntityHref(log: AuditLogItem) {
  if (!log.entityId) return null;

  const entityType = log.entityType.toLowerCase();
  if (entityType.includes('order')) return `/admin/shop/orders/${log.entityId}`;
  if (entityType.includes('customer')) return `/admin/shop/customers/${log.entityId}`;
  if (entityType.includes('import')) return `/admin/shop/import/jobs/${log.entityId}`;
  if (entityType.includes('product')) return `/admin/shop/${log.entityId}`;
  return null;
}

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

  const groupedLogs = useMemo(() => {
    return filteredLogs.reduce<Record<string, AuditLogItem[]>>((accumulator, log) => {
      const key = log.entityType || 'unknown';
      accumulator[key] = accumulator[key] ? [...accumulator[key], log] : [log];
      return accumulator;
    }, {});
  }, [filteredLogs]);

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="System Traceability"
        title="Shop Audit Trail"
        description="Структурований журнал змін по каталогу, цінам, імпортам і замовленням. Тут зручно шукати хто, що і коли змінював."
        actions={
          <button
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:border-white/25 hover:text-zinc-100"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? 'motion-safe:animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <AdminMetricGrid>
        <AdminMetricCard label="Audit events" value={filteredLogs.length} meta="Поточний фільтр" />
        <AdminMetricCard label="Entity types" value={Object.keys(groupedLogs).length} meta="Групи сутностей у видачі" />
        <AdminMetricCard
          label="Latest event"
          value={filteredLogs[0] ? filteredLogs[0].action : '—'}
          meta={filteredLogs[0] ? new Date(filteredLogs[0].createdAt).toLocaleString() : 'Подій ще немає'}
        />
        <AdminMetricCard
          label="Latest actor"
          value={filteredLogs[0] ? filteredLogs[0].actorName || filteredLogs[0].actorEmail : '—'}
          meta={filteredLogs[0]?.entityType ?? '—'}
        />
      </AdminMetricGrid>

      <AdminFilterBar>
        <label className="min-w-[260px] flex-1">
          <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="actor, action, entity, metadata"
            className="w-full rounded-[6px] border border-white/10 bg-[#0F0F0F] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-white/20 focus:outline-none"
          />
        </label>

        <label className="w-full md:w-[260px]">
          <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Entity type</span>
          <select
            value={entityType}
            onChange={(event) => setEntityType(event.target.value)}
            className="w-full rounded-[6px] border border-white/10 bg-[#0F0F0F] px-4 py-3 text-sm text-zinc-100 focus:border-white/20 focus:outline-none"
          >
            <option value="">Усі типи</option>
            {entityTypes.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>
      </AdminFilterBar>

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}

      {loading ? (
        <AdminEmptyState
          title="Завантаження аудиту"
          description="Підтягуємо останні дії адміністраторів, імпортів, замовлень і каталогу."
        />
      ) : filteredLogs.length === 0 ? (
        <AdminEmptyState
          title="Подій аудиту не знайдено"
          description="Спробуйте скинути фільтри або перевірте пізніше, коли з’являться нові операційні події."
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedLogs).map(([group, groupItems]) => (
            <section key={group} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-zinc-100">{group}</h2>
                  <p className="text-sm text-zinc-500">{groupItems.length} подій у цій групі</p>
                </div>
                <AdminStatusBadge>{groupItems.length} records</AdminStatusBadge>
              </div>

              <AdminTableShell>
                <table className="min-w-full text-left text-sm text-zinc-200">
                  <thead className="bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Action</th>
                      <th className="px-4 py-3 font-medium">Actor</th>
                      <th className="px-4 py-3 font-medium">Entity</th>
                      <th className="px-4 py-3 font-medium">Timestamp</th>
                      <th className="px-4 py-3 font-medium text-right">Trace</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupItems.map((log) => {
                      const entityHref = resolveAuditEntityHref(log);
                      return (
                        <tr key={log.id} className="border-t border-white/8 align-top">
                          <td className="px-4 py-4">
                            <div className="font-medium text-zinc-100">{log.action}</div>
                            {log.metadata ? (
                              <pre className="mt-2 max-h-40 overflow-auto rounded-[6px] border border-white/10 bg-black/25 p-3 text-[11px] text-zinc-500">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            ) : null}
                          </td>
                          <td className="px-4 py-4 text-zinc-300">
                            <div>{log.actorName ? `${log.actorName}` : log.actorEmail}</div>
                            <div className="mt-1 text-xs text-zinc-500">{log.actorEmail}</div>
                          </td>
                          <td className="px-4 py-4 text-zinc-300">
                            <div>{log.entityType}</div>
                            <div className="mt-1 text-xs text-zinc-500">{log.entityId || '—'}</div>
                          </td>
                          <td className="px-4 py-4 text-zinc-400">{new Date(log.createdAt).toLocaleString()}</td>
                          <td className="px-4 py-4">
                            <div className="flex justify-end">
                              {entityHref ? (
                                <Link
                                  href={entityHref}
                                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-zinc-300 transition hover:border-white/25 hover:text-zinc-100"
                                >
                                  Open entity
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Link>
                              ) : (
                                <span className="text-xs text-zinc-600">No entity route</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </AdminTableShell>
            </section>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
