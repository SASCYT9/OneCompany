'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Copy, ExternalLink, Plus, RefreshCcw, Search, Tag, Ticket } from 'lucide-react';

import {
  AdminEmptyState,
  AdminFilterBar,
  AdminInlineAlert,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminResponsiveTable,
  AdminStatusBadge,
  AdminTableShell,
} from '@/components/admin/AdminPrimitives';
import { AdminMobileCard } from '@/components/admin/AdminMobileCard';
import { AdminSkeletonKpiGrid, AdminSkeletonTable } from '@/components/admin/AdminSkeleton';
import { useToast } from '@/components/admin/AdminToast';

type DiscountStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'ARCHIVED';
type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING' | 'BUY_X_GET_Y';

type DiscountRow = {
  id: string;
  code: string;
  description: string | null;
  type: DiscountType;
  scope: string;
  status: DiscountStatus;
  value: number;
  currency: string | null;
  minOrderValue: number | null;
  usageLimit: number | null;
  usageLimitPerUser: number | null;
  usageCount: number;
  redemptionCount: number;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
};

function statusTone(status: DiscountStatus): 'default' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'DRAFT':
    case 'PAUSED':
      return 'warning';
    case 'EXPIRED':
    case 'ARCHIVED':
      return 'danger';
    default:
      return 'default';
  }
}

function typeLabel(type: DiscountType, value: number, currency: string | null): string {
  switch (type) {
    case 'PERCENTAGE':
      return `−${value}%`;
    case 'FIXED_AMOUNT':
      return `−${currency ?? '€'}${value}`;
    case 'FREE_SHIPPING':
      return 'Безкоштовна доставка';
    case 'BUY_X_GET_Y':
      return 'BOGO';
    default:
      return type;
  }
}

export default function AdminDiscountsPage() {
  const toast = useToast();
  const [discounts, setDiscounts] = useState<DiscountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (statusFilter) params.set('status', statusFilter);
        if (typeFilter) params.set('type', typeFilter);

        const response = await fetch(`/api/admin/shop/discounts?${params.toString()}`, { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(data.error || 'Не вдалося завантажити промокоди');
          return;
        }
        setDiscounts(data.discounts || []);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [search, statusFilter, typeFilter, reloadKey]);

  const stats = useMemo(() => {
    return {
      active: discounts.filter((d) => d.status === 'ACTIVE').length,
      draft: discounts.filter((d) => d.status === 'DRAFT').length,
      totalRedemptions: discounts.reduce((sum, d) => sum + d.redemptionCount, 0),
      total: discounts.length,
    };
  }, [discounts]);

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Код скопійовано', code);
    } catch {
      toast.error('Не вдалося скопіювати код');
    }
  }

  if (loading) {
    return (
      <AdminPage className="space-y-6">
        <div role="status" aria-live="polite" aria-busy="true" className="space-y-6">
          <span className="sr-only">Завантаження промокодів…</span>
          <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
            <div className="space-y-3">
              <div className="h-3 w-20 motion-safe:animate-pulse rounded-none bg-white/[0.06]" />
              <div className="h-9 w-72 motion-safe:animate-pulse rounded-none bg-white/[0.06]" />
              <div className="h-3.5 w-96 motion-safe:animate-pulse rounded-none bg-white/[0.04]" />
            </div>
            <div className="h-9 w-44 motion-safe:animate-pulse rounded-none bg-white/[0.04]" />
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
        eyebrow="Маркетинг"
        title="Промокоди"
        description="Промокоди, BOGO-правила, безкоштовна доставка та B2B-кампанії. Кожне використання фіксується в історії замовлення."
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
              href="/admin/shop/discounts/new"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600"
            >
              <Plus className="h-4 w-4" />
              Новий код
            </Link>
          </>
        }
      />

      <AdminMetricGrid>
        <AdminMetricCard label="Всього кодів" value={stats.total} meta="Усі кампанії, включно з чернетками" />
        <AdminMetricCard label="Активні" value={stats.active} meta="Доступні для використання" tone="accent" />
        <AdminMetricCard label="Чернетки" value={stats.draft} meta="Чекають на активацію" />
        <AdminMetricCard label="Всього використань" value={stats.totalRedemptions} meta="За весь час" />
      </AdminMetricGrid>

      <AdminFilterBar>
        <label className="flex w-full min-w-0 flex-1 items-center gap-2 rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200 md:min-w-[280px]">
          <Search className="h-4 w-4 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук за кодом або описом"
            className="w-full bg-transparent text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
        </label>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/20 focus:outline-none"
        >
          <option value="">Усі статуси</option>
          <option value="ACTIVE">Активний</option>
          <option value="DRAFT">Чернетка</option>
          <option value="PAUSED">Призупинено</option>
          <option value="EXPIRED">Сплив термін</option>
          <option value="ARCHIVED">В архіві</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/20 focus:outline-none"
        >
          <option value="">Усі типи</option>
          <option value="PERCENTAGE">Відсоток</option>
          <option value="FIXED_AMOUNT">Фіксована знижка</option>
          <option value="FREE_SHIPPING">Безкоштовна доставка</option>
          <option value="BUY_X_GET_Y">BOGO</option>
        </select>
      </AdminFilterBar>

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}

      {discounts.length === 0 ? (
        <AdminEmptyState
          title="Поки немає промокодів"
          description="Створіть промокоди для B2C-кампаній або індивідуальні B2B-знижки. Кожен код можна обмежити за використаннями, групою клієнтів або переліком товарів."
          action={
            <Link
              href="/admin/shop/discounts/new"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600"
            >
              <Plus className="h-4 w-4" />
              Створити перший код
            </Link>
          }
        />
      ) : (
        <AdminResponsiveTable
          mobile={
            <div className="space-y-2">
              {discounts.map((d) => (
                <AdminMobileCard
                  key={d.id}
                  title={
                    <span className="flex items-center gap-2">
                      <Ticket className="h-4 w-4 text-blue-400" aria-hidden="true" />
                      <span className="font-mono">{d.code}</span>
                    </span>
                  }
                  subtitle={d.description || undefined}
                  badge={<AdminStatusBadge tone={statusTone(d.status)}>{d.status}</AdminStatusBadge>}
                  rows={[
                    { label: 'Тип', value: typeLabel(d.type, d.value, d.currency) },
                    { label: 'Викор.', value: d.usageLimit != null ? `${d.usageCount} / ${d.usageLimit}` : d.usageCount },
                    {
                      label: 'Дійсність',
                      value:
                        d.validUntil
                          ? `до ${new Date(d.validUntil).toLocaleDateString()}`
                          : d.validFrom
                            ? `від ${new Date(d.validFrom).toLocaleDateString()}`
                            : 'Завжди',
                    },
                  ]}
                  href={`/admin/shop/discounts/${d.id}`}
                />
              ))}
            </div>
          }
          desktop={
        <AdminTableShell>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  <th className="px-4 py-4 font-medium">Код</th>
                  <th className="px-4 py-4 font-medium">Тип</th>
                  <th className="px-4 py-4 font-medium">Статус</th>
                  <th className="px-4 py-4 font-medium">Умови</th>
                  <th className="px-4 py-4 font-medium">Використання</th>
                  <th className="px-4 py-4 font-medium">Дійсність</th>
                  <th className="px-4 py-4 font-medium">Відкрити</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {discounts.map((d) => (
                  <tr key={d.id} className="align-top transition hover:bg-white/[0.03]">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Ticket className="h-4 w-4 shrink-0 text-blue-400" aria-hidden="true" />
                        <span className="font-mono text-sm font-bold tracking-wide text-zinc-100">{d.code}</span>
                        <button
                          type="button"
                          onClick={() => void copyCode(d.code)}
                          className="rounded-none p-1 text-zinc-600 transition hover:bg-white/[0.06] hover:text-zinc-300"
                          aria-label={`Скопіювати ${d.code}`}
                          title="Скопіювати"
                        >
                          <Copy className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </div>
                      {d.description ? (
                        <div className="mt-1 max-w-xs truncate text-xs text-zinc-500">{d.description}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-zinc-200">{typeLabel(d.type, d.value, d.currency)}</div>
                      <div className="mt-0.5 text-[11px] uppercase tracking-wider text-zinc-600">{d.scope}</div>
                    </td>
                    <td className="px-4 py-4">
                      <AdminStatusBadge tone={statusTone(d.status)}>{d.status}</AdminStatusBadge>
                    </td>
                    <td className="px-4 py-4 text-xs text-zinc-400">
                      {d.minOrderValue != null ? <div>Мін. замовлення: {d.minOrderValue}</div> : null}
                      {d.usageLimitPerUser != null ? <div>На клієнта: {d.usageLimitPerUser}</div> : null}
                      {!d.minOrderValue && !d.usageLimitPerUser ? <span className="text-zinc-600">Без обмежень</span> : null}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-zinc-200 tabular-nums">
                        {d.usageCount}
                        {d.usageLimit != null ? ` / ${d.usageLimit}` : ''}
                      </div>
                      {d.usageLimit != null ? (
                        <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.04]">
                          <div
                            className="h-full bg-blue-500"
                            style={{
                              width: `${Math.min(100, (d.usageCount / d.usageLimit) * 100)}%`,
                            }}
                          />
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-xs text-zinc-400">
                      {d.validFrom ? (
                        <div>Від {new Date(d.validFrom).toLocaleDateString()}</div>
                      ) : (
                        <div className="text-zinc-600">Завжди</div>
                      )}
                      {d.validUntil ? (
                        <div className={new Date(d.validUntil) < new Date() ? 'text-red-400' : ''}>
                          До {new Date(d.validUntil).toLocaleDateString()}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/admin/shop/discounts/${d.id}`}
                        className="inline-flex items-center gap-1.5 rounded-none border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-200 transition hover:border-white/15 hover:bg-white/[0.06]"
                      >
                        Редагувати
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminTableShell>
          }
        />
      )}
    </AdminPage>
  );
}
