'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Plus, RefreshCcw, Search, Trash2, Users } from 'lucide-react';

import {
  AdminEmptyState,
  AdminInlineAlert,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminTableShell,
} from '@/components/admin/AdminPrimitives';
import { AdminSkeletonKpiGrid, AdminSkeletonTable } from '@/components/admin/AdminSkeleton';
import { useToast } from '@/components/admin/AdminToast';
import { useConfirm } from '@/components/admin/AdminConfirmDialog';

type SegmentRow = {
  id: string;
  name: string;
  description: string | null;
  rulesJson: { match: 'all' | 'any'; conditions: Array<{ field: string; operator: string; value: unknown }> };
  customerCount: number;
  lastComputedAt: string | null;
  createdAt: string;
};

export default function AdminSegmentsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [recomputing, setRecomputing] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/admin/shop/segments', { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(data.error || 'Не вдалося завантажити');
          return;
        }
        setSegments(data.segments || []);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [reloadKey]);

  const filtered = useMemo(() => {
    if (!search.trim()) return segments;
    const needle = search.toLowerCase();
    return segments.filter((s) =>
      [s.name, s.description].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle))
    );
  }, [segments, search]);

  const stats = useMemo(() => {
    return {
      total: segments.length,
      totalMembers: segments.reduce((sum, s) => sum + s.customerCount, 0),
      largest: segments.length > 0 ? Math.max(...segments.map((s) => s.customerCount)) : 0,
    };
  }, [segments]);

  async function recompute(id: string) {
    setRecomputing(id);
    try {
      const response = await fetch(`/api/admin/shop/segments/${id}?action=recompute`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) {
        toast.error('Перерахунок не вдався');
        return;
      }
      toast.success('Сегмент перераховано');
      setReloadKey((k) => k + 1);
    } finally {
      setRecomputing(null);
    }
  }

  async function deleteSegment(s: SegmentRow) {
    const ok = await confirm({
      tone: 'danger',
      title: `Видалити сегмент «${s.name}»?`,
      description: 'Це лише визначення сегмента — записи клієнтів не зміняться. Визначення відновити не можна.',
      confirmLabel: 'Видалити',
    });
    if (!ok) return;
    const response = await fetch(`/api/admin/shop/segments/${s.id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.error('Не вдалося видалити');
      return;
    }
    toast.success('Сегмент видалено');
    setReloadKey((k) => k + 1);
  }

  if (loading) {
    return (
      <AdminPage className="space-y-6">
        <div className="space-y-3">
          <div className="h-9 w-72 motion-safe:animate-pulse rounded-md bg-white/[0.06]" />
        </div>
        <AdminSkeletonKpiGrid count={3} />
        <AdminSkeletonTable rows={6} cols={5} />
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Клієнти"
        title="Сегменти клієнтів"
        description="Збережені правила, які групують клієнтів за категорією, країною, тегами, сумою покупок та свіжістю замовлень. Використовуйте у email-тригерах та таргетингу промокодів."
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
              href="/admin/shop/customers/segments/new"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600"
            >
              <Plus className="h-4 w-4" />
              Новий сегмент
            </Link>
          </>
        }
      />

      <AdminMetricGrid>
        <AdminMetricCard label="Всього сегментів" value={stats.total} meta="Усі збережені правила" tone="accent" />
        <AdminMetricCard label="Всього входжень" value={stats.totalMembers} meta="Сума по всіх сегментах" />
        <AdminMetricCard label="Найбільший сегмент" value={stats.largest} meta="Кількість клієнтів" />
      </AdminMetricGrid>

      <label className="flex max-w-md items-center gap-2 rounded-[6px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200">
        <Search className="h-4 w-4 text-zinc-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Пошук сегментів за назвою"
          className="w-full bg-transparent text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
        />
      </label>

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}

      {filtered.length === 0 ? (
        <AdminEmptyState
          title="Поки немає сегментів"
          description="Створіть сегмент: B2B клієнти, що пішли; постійні з високим LTV; B2C з Німеччини тощо. Використовуйте як цільові групи для email-тригерів і промокодів."
          action={
            <Link
              href="/admin/shop/customers/segments/new"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white"
            >
              <Plus className="h-4 w-4" />
              Створити перший сегмент
            </Link>
          }
        />
      ) : (
        <AdminTableShell>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                <th className="px-4 py-4 font-medium">Сегмент</th>
                <th className="px-4 py-4 font-medium">Правила</th>
                <th className="px-4 py-4 font-medium">Клієнтів</th>
                <th className="px-4 py-4 font-medium">Останній перерахунок</th>
                <th className="px-4 py-4 font-medium">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {filtered.map((s) => (
                <tr key={s.id} className="align-top transition hover:bg-white/[0.03]">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 shrink-0 text-blue-400" />
                      <span className="font-medium text-zinc-100">{s.name}</span>
                    </div>
                    {s.description ? (
                      <div className="mt-1 max-w-md truncate text-xs text-zinc-500">{s.description}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 text-xs text-zinc-400">
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-1.5 py-0 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      {s.rulesJson?.match === 'any' ? 'Будь-яка з умов' : 'Усі умови'}
                    </span>
                    <div className="mt-1 text-[10px] text-zinc-600">
                      {s.rulesJson?.conditions?.length ?? 0} умов
                    </div>
                  </td>
                  <td className="px-4 py-4 font-medium text-zinc-100 tabular-nums">{s.customerCount}</td>
                  <td className="px-4 py-4 text-xs text-zinc-500">
                    {s.lastComputedAt ? new Date(s.lastComputedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void recompute(s.id)}
                        disabled={recomputing === s.id}
                        className="rounded p-1.5 text-zinc-500 hover:bg-white/[0.06] hover:text-blue-300 disabled:opacity-50"
                        aria-label="Перерахувати"
                        title="Перерахувати"
                      >
                        <RefreshCcw className="h-3.5 w-3.5" />
                      </button>
                      <Link
                        href={`/admin/shop/customers/segments/${s.id}`}
                        className="rounded p-1.5 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200"
                        aria-label="Відкрити"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => void deleteSegment(s)}
                        className="rounded p-1.5 text-zinc-500 hover:bg-red-500/[0.1] hover:text-red-400"
                        aria-label="Видалити"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableShell>
      )}
    </AdminPage>
  );
}
