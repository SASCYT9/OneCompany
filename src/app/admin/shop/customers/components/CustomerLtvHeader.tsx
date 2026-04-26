'use client';

import { useEffect, useState } from 'react';

import { Calendar, Coins, Loader2, ShoppingBag, TrendingDown, TrendingUp } from 'lucide-react';

/**
 * KPI strip for a customer detail page.
 * Computes LTV stats from order history + credit balance via /api/admin/customers/[id]/ltv.
 */

type LtvStats = {
  totalSpent: number;
  ordersCount: number;
  averageOrderValue: number;
  daysSinceLastOrder: number | null;
  lastOrderAt: string | null;
  firstOrderAt: string | null;
  retentionScore: number; // 0-100, based on order recency + frequency
  currency: string;
  creditBalance: number;
  paidOrdersCount: number;
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('uk-UA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

export function CustomerLtvHeader({ customerId }: { customerId: string }) {
  const [stats, setStats] = useState<LtvStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/customers/${customerId}/ltv`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setStats(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-none border border-white/[0.05] bg-[#171717] px-4 py-3 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
        Обчислення LTV…
      </div>
    );
  }

  if (!stats) return null;

  const churnRisk = stats.daysSinceLastOrder != null && stats.daysSinceLastOrder > 90;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <KpiCard
        icon={<Coins className="h-4 w-4" />}
        label="Загальна сума покупок"
        value={formatMoney(stats.totalSpent, stats.currency)}
        sub={`${stats.paidOrdersCount} оплачених замовлень`}
        accent="emerald"
      />
      <KpiCard
        icon={<ShoppingBag className="h-4 w-4" />}
        label="Всього замовлень"
        value={String(stats.ordersCount)}
        sub={`Середній чек ${formatMoney(stats.averageOrderValue, stats.currency)}`}
      />
      <KpiCard
        icon={<Calendar className="h-4 w-4" />}
        label="Останнє замовлення"
        value={stats.daysSinceLastOrder != null ? `${stats.daysSinceLastOrder}д тому` : 'Ніколи'}
        sub={stats.lastOrderAt ? new Date(stats.lastOrderAt).toLocaleDateString() : '—'}
        accent={churnRisk ? 'red' : undefined}
      />
      <KpiCard
        icon={churnRisk ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
        label="Утримання"
        value={`${stats.retentionScore}%`}
        sub={churnRisk ? 'Ризик відтоку' : stats.retentionScore > 70 ? 'Чудово' : 'Середньо'}
        accent={churnRisk ? 'red' : stats.retentionScore > 70 ? 'emerald' : undefined}
      />
      <KpiCard
        icon={<Coins className="h-4 w-4" />}
        label="Баланс кредиту"
        value={formatMoney(stats.creditBalance, stats.currency)}
        sub="Доступно для наступного замовлення"
        accent={stats.creditBalance > 0 ? 'blue' : undefined}
      />
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: 'emerald' | 'blue' | 'red';
}) {
  const accentClass =
    accent === 'emerald'
      ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
      : accent === 'blue'
        ? 'border-blue-500/25 bg-blue-500/[0.06]'
        : accent === 'red'
          ? 'border-red-500/25 bg-red-500/[0.04]'
          : 'border-white/[0.05] bg-[#171717]';

  const valueClass =
    accent === 'emerald'
      ? 'text-emerald-200'
      : accent === 'blue'
        ? 'text-blue-200'
        : accent === 'red'
          ? 'text-red-300'
          : 'text-zinc-50';

  return (
    <div className={`rounded-none border ${accentClass} p-3`}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        <span className="text-zinc-500">{icon}</span>
        {label}
      </div>
      <div className={`mt-1 text-lg font-bold tabular-nums ${valueClass}`}>{value}</div>
      {sub ? <div className="mt-0.5 truncate text-[11px] text-zinc-500">{sub}</div> : null}
    </div>
  );
}
