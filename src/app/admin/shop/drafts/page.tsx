'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Clock, ExternalLink, FileText, Plus, RefreshCcw, Search, Send } from 'lucide-react';

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
import { AdminSkeletonKpiGrid, AdminSkeletonTable } from '@/components/admin/AdminSkeleton';

type DraftRow = {
  id: string;
  orderNumber: string;
  customerId: string | null;
  customerName: string;
  email: string;
  currency: string;
  subtotal: number;
  total: number;
  itemsCount: number;
  draftQuoteToken: string | null;
  quoteSentAt: string | null;
  quoteAcceptedAt: string | null;
  quoteDeclinedAt: string | null;
  draftValidUntil: string | null;
  customerGroupSnapshot: string;
  createdAt: string;
  updatedAt: string;
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('uk-UA', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function quoteStage(d: DraftRow): { label: string; tone: 'default' | 'success' | 'warning' | 'danger' } {
  if (d.quoteAcceptedAt) return { label: 'Прийнято', tone: 'success' };
  if (d.quoteDeclinedAt) return { label: 'Відхилено', tone: 'danger' };
  if (d.quoteSentAt) return { label: 'Надіслано · очікуємо', tone: 'warning' };
  return { label: 'Чернетка', tone: 'default' };
}

export default function AdminDraftsPage() {
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);

        const response = await fetch(`/api/admin/shop/drafts?${params.toString()}`, { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(data.error || 'Не вдалося завантажити чернетки');
          return;
        }
        setDrafts(data.drafts || []);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [search, reloadKey]);

  const stats = useMemo(() => {
    return {
      total: drafts.length,
      sent: drafts.filter((d) => d.quoteSentAt && !d.quoteAcceptedAt && !d.quoteDeclinedAt).length,
      accepted: drafts.filter((d) => d.quoteAcceptedAt).length,
      pipeline: drafts.reduce((sum, d) => sum + d.total, 0),
    };
  }, [drafts]);

  if (loading) {
    return (
      <AdminPage className="space-y-6">
        <div role="status" aria-live="polite" aria-busy="true" className="space-y-6">
          <span className="sr-only">Завантаження чернеток…</span>
          <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
            <div className="space-y-3">
              <div className="h-3 w-20 motion-safe:animate-pulse rounded-none bg-white/[0.06]" />
              <div className="h-9 w-72 motion-safe:animate-pulse rounded-none bg-white/[0.06]" />
            </div>
          </div>
          <AdminSkeletonKpiGrid count={4} />
          <AdminSkeletonTable rows={6} cols={6} />
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Замовлення"
        title="Чернетки та котирування"
        description="Чернетки замовлень для B2B з гнучкими цінами. Зберіть котирування, надішліть дилеру, конвертуйте в активне замовлення після прийняття."
        actions={
          <>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
            >
              <RefreshCcw className="h-4 w-4" />
              Оновити
            </button>
            <Link
              href="/admin/shop/drafts/new"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600"
            >
              <Plus className="h-4 w-4" />
              Нова чернетка
            </Link>
          </>
        }
      />

      <AdminMetricGrid>
        <AdminMetricCard label="Всього чернеток" value={stats.total} meta="Активні та в обробці" tone="accent" />
        <AdminMetricCard label="Надіслано · очікуємо" value={stats.sent} meta="Котирування надіслане, без рішення" />
        <AdminMetricCard label="Прийнято" value={stats.accepted} meta="Конвертовано в замовлення" />
        <AdminMetricCard
          label="Pipeline котирувань"
          value={drafts.length > 0 ? formatMoney(stats.pipeline, drafts[0].currency) : '—'}
          meta="Сума чернеток (валюта першого рядка для показу)"
        />
      </AdminMetricGrid>

      <AdminFilterBar>
        <label className="flex min-w-[280px] flex-1 items-center gap-2 rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200">
          <Search className="h-4 w-4 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук за номером, клієнтом або email"
            className="w-full bg-transparent text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
        </label>
      </AdminFilterBar>

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}

      {drafts.length === 0 ? (
        <AdminEmptyState
          title="Поки немає чернеток"
          description="Створіть чернетку щоб скласти котирування для B2B-клієнта. Надішліть посилання — клієнт прийме і чернетка стане активним замовленням."
          action={
            <Link
              href="/admin/shop/drafts/new"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600"
            >
              <Plus className="h-4 w-4" />
              Створити першу чернетку
            </Link>
          }
        />
      ) : (
        <AdminTableShell>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  <th className="px-4 py-4 font-medium">Номер</th>
                  <th className="px-4 py-4 font-medium">Клієнт</th>
                  <th className="px-4 py-4 font-medium">Стан котирування</th>
                  <th className="px-4 py-4 font-medium">Позицій</th>
                  <th className="px-4 py-4 font-medium">Сума</th>
                  <th className="px-4 py-4 font-medium">Дійсність</th>
                  <th className="px-4 py-4 font-medium">Створено</th>
                  <th className="px-4 py-4 font-medium">Відкрити</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {drafts.map((d) => {
                  const stage = quoteStage(d);
                  const expired = d.draftValidUntil && new Date(d.draftValidUntil) < new Date();
                  return (
                    <tr key={d.id} className="align-top transition hover:bg-white/[0.03]">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-blue-400" aria-hidden="true" />
                          <span className="font-mono text-xs font-bold tracking-wide text-zinc-100">{d.orderNumber}</span>
                        </div>
                        {d.customerGroupSnapshot.startsWith('B2B') ? (
                          <div className="mt-1 inline-block rounded-full border border-blue-500/25 bg-blue-500/[0.08] px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider text-blue-300">
                            {d.customerGroupSnapshot.replace('B2B_', 'B2B ')}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-zinc-100">{d.customerName}</div>
                        <div className="mt-0.5 text-xs text-zinc-500">{d.email}</div>
                      </td>
                      <td className="px-4 py-4">
                        <AdminStatusBadge tone={stage.tone}>
                          {stage.tone === 'success' ? <Check className="mr-1 inline-block h-3 w-3" /> : null}
                          {stage.tone === 'warning' ? <Send className="mr-1 inline-block h-3 w-3" /> : null}
                          {stage.tone === 'default' ? <Clock className="mr-1 inline-block h-3 w-3" /> : null}
                          {stage.label}
                        </AdminStatusBadge>
                        {d.quoteSentAt && !d.quoteAcceptedAt ? (
                          <div className="mt-1 text-[11px] text-zinc-500">
                            Надіслано {new Date(d.quoteSentAt).toLocaleDateString()}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-zinc-300">{d.itemsCount}</td>
                      <td className="px-4 py-4 font-medium text-zinc-100 tabular-nums">{formatMoney(d.total, d.currency)}</td>
                      <td className="px-4 py-4 text-xs">
                        {d.draftValidUntil ? (
                          <span className={expired ? 'text-red-400' : 'text-zinc-400'}>
                            До {new Date(d.draftValidUntil).toLocaleDateString()}
                            {expired ? ' · сплив' : ''}
                          </span>
                        ) : (
                          <span className="text-zinc-600">Без терміну</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs text-zinc-500">{new Date(d.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/admin/shop/drafts/${d.id}`}
                          className="inline-flex items-center gap-1.5 rounded-none border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-200 transition hover:border-white/15 hover:bg-white/[0.06]"
                        >
                          Редагувати
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AdminTableShell>
      )}
    </AdminPage>
  );
}
