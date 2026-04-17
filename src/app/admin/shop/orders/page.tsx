'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  FileClock,
  Package,
  RefreshCcw,
  Search,
  ShoppingCart,
} from 'lucide-react';

type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PENDING_REVIEW'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

type OrderSummary = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  email: string;
  customerName: string;
  currency: string;
  total: number;
  createdAt: string;
  itemCount: number;
  shipmentsCount: number;
  timelineCount: number;
  allowedTransitions: OrderStatus[];
  shippingZoneId: string | null;
  shippingZoneName: string | null;
  taxRegionId: string | null;
  taxRegionName: string | null;
};

type OrdersResponse = {
  orders: OrderSummary[];
  stats: {
    total: number;
    statusCounts: Record<string, number>;
    currencyCounts: Record<string, number>;
  };
  filters: {
    currencies: Array<{ value: string; label: string; count: number }>;
    shippingZones: Array<{ value: string; label: string; count: number }>;
    taxRegions: Array<{ value: string; label: string; count: number }>;
  };
};

const ALL_ORDER_STATUSES: OrderStatus[] = [
  'PENDING_PAYMENT',
  'PENDING_REVIEW',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

const STATUS_OPTIONS = [
  { value: '', label: 'Усі статуси' },
  { value: 'PENDING_PAYMENT', label: 'Очікує оплату' },
  { value: 'PENDING_REVIEW', label: 'На перевірці' },
  { value: 'CONFIRMED', label: 'Підтверджено' },
  { value: 'PROCESSING', label: 'В обробці' },
  { value: 'SHIPPED', label: 'Відправлено' },
  { value: 'DELIVERED', label: 'Доставлено' },
  { value: 'CANCELLED', label: 'Скасовано' },
  { value: 'REFUNDED', label: 'Повернено' },
] as const;

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Очікує оплату',
  PENDING_REVIEW: 'На перевірці',
  CONFIRMED: 'Підтверджено',
  PROCESSING: 'В обробці',
  SHIPPED: 'Відправлено',
  DELIVERED: 'Доставлено',
  CANCELLED: 'Скасовано',
  REFUNDED: 'Повернено',
}

const STATUS_BAR_ORDER = ['PENDING_PAYMENT','PENDING_REVIEW','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED','REFUNDED'];
const STATUS_BAR_COLORS: Record<string, string> = {
  PENDING_PAYMENT: '#f97316', PENDING_REVIEW: '#f59e0b', CONFIRMED: '#3b82f6',
  PROCESSING: '#8b5cf6', SHIPPED: '#06b6d4', DELIVERED: '#22c55e',
  CANCELLED: '#ef4444', REFUNDED: '#71717a',
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function statusLabel(status: string) {
  return ORDER_STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'PENDING_PAYMENT':
      return 'border-orange-500/30 bg-orange-500/10 text-orange-100';
    case 'PENDING_REVIEW':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
    case 'CONFIRMED':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-100';
    case 'PROCESSING':
      return 'border-violet-500/30 bg-violet-500/10 text-violet-100';
    case 'SHIPPED':
      return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100';
    case 'DELIVERED':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100';
    case 'CANCELLED':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-100';
    case 'REFUNDED':
      return 'border-zinc-500/30 bg-zinc-500/10 text-zinc-100';
    default:
      return 'border-white/15 bg-white/5 text-white/70';
  }
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [stats, setStats] = useState<OrdersResponse['stats']>({
    total: 0,
    statusCounts: {},
    currencyCounts: {},
  });
  const [filterOptions, setFilterOptions] = useState<OrdersResponse['filters']>({
    currencies: [],
    shippingZones: [],
    taxRegions: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [status, setStatus] = useState('');
  const [currency, setCurrency] = useState('');
  const [shippingZone, setShippingZone] = useState('');
  const [taxRegion, setTaxRegion] = useState('');
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkNote, setBulkNote] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    async function run() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (currency) params.set('currency', currency);
        if (shippingZone) params.set('shippingZone', shippingZone);
        if (taxRegion) params.set('taxRegion', taxRegion);
        if (query.trim()) params.set('q', query.trim());

        const response = await fetch(`/api/admin/shop/orders${params.toString() ? `?${params.toString()}` : ''}`);
        const data = (await response.json().catch(() => ({}))) as Partial<OrdersResponse> & { error?: string };
        if (response.status === 401) {
          setError('Unauthorized');
          return;
        }
        if (!response.ok) {
          setError(data.error || 'Не вдалося завантажити замовлення');
          return;
        }

        setOrders(data.orders || []);
        setStats(
          data.stats || {
            total: 0,
            statusCounts: {},
            currencyCounts: {},
          }
        );
        setFilterOptions(
          data.filters || {
            currencies: [],
            shippingZones: [],
            taxRegions: [],
          }
        );
      } finally {
        setLoading(false);
      }
    }

    void run();
  }, [currency, query, reloadKey, shippingZone, status, taxRegion]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => orders.some((order) => order.id === id)));
  }, [orders]);

  const selectedOrders = useMemo(
    () => orders.filter((order) => selectedIds.includes(order.id)),
    [orders, selectedIds]
  );

  const commonBulkStatuses = useMemo(() => {
    if (!selectedOrders.length) {
      return [] as OrderStatus[];
    }

    return ALL_ORDER_STATUSES.filter((candidate) =>
      selectedOrders.every((order) => order.status === candidate || order.allowedTransitions.includes(candidate))
    );
  }, [selectedOrders]);

  useEffect(() => {
    if (!bulkStatus || commonBulkStatuses.includes(bulkStatus as OrderStatus)) {
      return;
    }
    setBulkStatus('');
  }, [bulkStatus, commonBulkStatuses]);

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );
  }

  function toggleSelectAll() {
    if (selectedIds.length === orders.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(orders.map((order) => order.id));
  }

  async function handleBulkUpdate() {
    if (!selectedIds.length || !bulkStatus) return;

    setBulkUpdating(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/admin/shop/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: selectedIds,
          status: bulkStatus,
          note: bulkNote,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Bulk update failed');
        return;
      }

      setSuccess(
        `Оновлено замовлень: ${data.updatedCount ?? 0}. Новий статус: ${statusLabel(String(data.status ?? bulkStatus))}.`
      );
      setBulkNote('');
      setBulkStatus('');
      setSelectedIds([]);
      setReloadKey((current) => current + 1);
    } finally {
      setBulkUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-white/60">
        <Package className="h-5 w-5 animate-pulse" />
        Завантаження замовлень…
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto text-white">
      <div className="w-full px-4 py-8 md:px-8 lg:px-12">
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Замовлення</h2>
            <p className="mt-2 text-sm text-white/45">
              Черга замовлень для перевірки, виконання та доставки. Фільтри та масові дії застосовуються до поточного списку.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/shop/orders/create"
              className="inline-flex items-center gap-2 rounded-none bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-200 hover:shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all duration-300"
            >
              + B2B замовлення
            </Link>
            <Link
              href="/admin/shop/orders/new"
              className="inline-flex items-center gap-2 rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10 transition-all duration-300"
            >
              Створити власноруч
            </Link>
            <button
              type="button"
              onClick={() => setReloadKey((current) => current + 1)}
              className="inline-flex items-center gap-2 rounded-none border border-white/[0.08] bg-transparent hover:bg-white/5 transition-all duration-300 px-4 py-2 text-sm font-medium text-white/80 hover:text-white"
            >
              <RefreshCcw className="h-4 w-4 text-white/50" />
              Оновити
            </button>
            <Link
              href="/admin/shop/audit"
              className="inline-flex items-center gap-2 rounded-none border border-white/[0.08] bg-transparent hover:bg-white/5 transition-all duration-300 px-4 py-2 text-sm font-medium text-white/80 hover:text-white"
            >
              <FileClock className="h-4 w-4 text-white/50" />
              Аудит
            </Link>
            <Link href="/admin/shop" className="text-sm text-white/40 hover:text-white transition-colors ml-2">
              ← Каталог товарів
            </Link>
          </div>
        </div>

        <div className="mb-4 grid gap-4 md:grid-cols-4">
          <SummaryCard label="Видимих замовлень" value={String(stats.total)} detail={`Обрано: ${selectedIds.length}`} />
          <SummaryCard label="Очікує оплату" value={String(stats.statusCounts.PENDING_PAYMENT || 0)} detail="Whitepay / ФОП / Crypto" />
          <SummaryCard label="На перевірці" value={String(stats.statusCounts.PENDING_REVIEW || 0)} detail="Потребують підтвердження" />
          <SummaryCard label="В обробці" value={String(stats.statusCounts.PROCESSING || 0)} detail="Активне виконання" />
          <SummaryCard label="Відправлено" value={String(stats.statusCounts.SHIPPED || 0)} detail="В дорозі" />
        </div>

        {/* Status Distribution Bar */}
        {stats.total > 0 && (
          <div className="mb-6 px-1">
            <div className="flex h-2 w-full overflow-hidden rounded-none-full bg-white/[0.03]">
              {STATUS_BAR_ORDER.map(s => {
                const count = stats.statusCounts[s] || 0;
                if (count === 0) return null;
                const pct = (count / stats.total) * 100;
                return (
                  <div key={s} title={`${statusLabel(s)}: ${count}`}
                    style={{ width: `${pct}%`, backgroundColor: STATUS_BAR_COLORS[s] || '#6b7280' }}
                    className="transition-all duration-500 first:rounded-none-l-full last:rounded-none-r-full" />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {STATUS_BAR_ORDER.map(s => {
                const count = stats.statusCounts[s] || 0;
                if (count === 0) return null;
                return (
                  <div key={s} className="flex items-center gap-1.5 text-[9px] text-white/35">
                    <div className="w-1.5 h-1.5 rounded-none-full" style={{ backgroundColor: STATUS_BAR_COLORS[s] }} />
                    {statusLabel(s)} ({count})
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-6 grid gap-4 rounded-none border border-white/[0.08] bg-black/60 shadow-2xl backdrop-blur-2xl p-6 md:grid-cols-5">
          <label className="flex items-center gap-2 rounded-none border border-white/[0.08] bg-black/40 px-4 py-2.5 text-sm text-white md:col-span-2 transition-colors focus-within:border-indigo-500/50">
            <Search className="h-4 w-4 text-white/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Пошук за номером, клієнтом або email"
              className="w-full bg-transparent text-white placeholder:text-white/25 focus:outline-none"
            />
          </label>
          <SelectField label="Статус" value={status} onChange={setStatus} options={STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label }))} />
          <SelectField
            label="Валюта"
            value={currency}
            onChange={setCurrency}
            options={[
              { value: '', label: 'Усі валюти' },
              ...filterOptions.currencies.map((option) => ({
                value: option.value,
                label: `${option.label} (${option.count})`,
              })),
            ]}
          />
          <SelectField
            label="Зона доставки"
            value={shippingZone}
            onChange={setShippingZone}
            options={[
              { value: '', label: 'Усі зони доставки' },
              ...filterOptions.shippingZones.map((option) => ({
                value: option.value,
                label: `${option.label} (${option.count})`,
              })),
            ]}
          />
          <div className="md:col-span-5">
            <SelectField
              label="Правило податку"
              value={taxRegion}
              onChange={setTaxRegion}
              options={[
                { value: '', label: 'Усі правила податку' },
                ...filterOptions.taxRegions.map((option) => ({
                  value: option.value,
                  label: `${option.label} (${option.count})`,
                })),
              ]}
            />
          </div>
        </div>

        {selectedOrders.length ? (
          <div className="mb-6 rounded-none border border-indigo-500/20 bg-zinc-100 text-black/5 backdrop-blur-xl p-6 shadow-[0_0_20px_rgba(99,102,241,0.05)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-white/75">
                {selectedOrders.length} обрано · {selectedOrders.map((order) => order.orderNumber).join(', ')}
              </div>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-xs text-white/45 hover:text-white"
              >
                Зняти вибір
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-[220px_1fr_auto]">
              <SelectField
                label="Масовий статус"
                value={bulkStatus}
                onChange={setBulkStatus}
                options={[
                  { value: '', label: 'Обрати статус' },
                  ...commonBulkStatuses.map((candidate) => ({
                    value: candidate,
                    label: statusLabel(candidate),
                  })),
                ]}
              />
              <label className="block">
                <span className="mb-1.5 block text-xs text-white/50">Нотатка до масового оновлення</span>
                <input
                  value={bulkNote}
                  onChange={(event) => setBulkNote(event.target.value)}
                  placeholder="Необов'язкова нотатка для обраних замовлень"
                  className="w-full rounded-none border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleBulkUpdate}
                  disabled={!bulkStatus || !selectedIds.length || bulkUpdating}
                  className="inline-flex items-center gap-2 rounded-none bg-white px-4 py-2.5 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50"
                >
                  <ShoppingCart className="h-4 w-4" />
                  {bulkUpdating ? 'Застосовуємо…' : 'Застосувати масове оновлення'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {error ? <div className="mb-4 rounded-none bg-red-900/20 p-3 text-sm text-red-300">{error}</div> : null}
        {success ? <div className="mb-4 rounded-none bg-green-900/20 p-3 text-sm text-green-200">{success}</div> : null}

        {orders.length === 0 ? (
          <div className="rounded-none border border-white/[0.08] bg-black/40 py-24 text-center text-white/40 tracking-wider text-sm shadow-2xl backdrop-blur-sm">
            За обраними фільтрами замовлень не знайдено.
          </div>
        ) : (
          <div className="overflow-hidden rounded-none border border-white/[0.08] bg-black/60 backdrop-blur-2xl shadow-2xl">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="px-5 py-4">
                    <input
                      type="checkbox"
                      checked={orders.length > 0 && selectedIds.length === orders.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded-none border-white/20 bg-zinc-950"
                    />
                  </th>
                  <th className="px-5 py-4 font-medium text-[10px] tracking-[0.15em] uppercase text-white/40">Замовлення</th>
                  <th className="px-5 py-4 font-medium text-[10px] tracking-[0.15em] uppercase text-white/40">Статус</th>
                  <th className="px-5 py-4 font-medium text-[10px] tracking-[0.15em] uppercase text-white/40">Операції</th>
                  <th className="px-5 py-4 font-medium text-[10px] tracking-[0.15em] uppercase text-white/40">Всього</th>
                  <th className="px-5 py-4 font-medium text-[10px] tracking-[0.15em] uppercase text-white/40">Створено</th>
                  <th className="px-5 py-4 font-medium text-[10px] tracking-[0.15em] uppercase text-white/40">Відкрити</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-white/5 align-top hover:bg-white/[0.03]">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(order.id)}
                        onChange={() => toggleSelected(order.id)}
                        className="h-4 w-4 rounded-none border-white/20 bg-zinc-950"
                      />
                    </td>
                    <td className="px-5 py-5 max-w-[220px]">
                      <div className="font-mono text-xs font-semibold tracking-wide text-white drop-border border-white/5">{order.orderNumber}</div>
                      <div className="mt-1 text-sm font-medium text-white/80 truncate">{order.customerName}</div>
                      <div className="mt-1 text-xs text-white/40 truncate">{order.email}</div>
                    </td>
                    <td className="px-5 py-5">
                      <span className={`inline-flex rounded-none-full border px-2.5 py-1 text-xs capitalize ${statusBadgeClass(order.status)}`}>
                        {statusLabel(order.status)}
                      </span>
                      <div className="mt-2 text-xs text-white/45">
                        {order.allowedTransitions.length
                          ? `Далі: ${order.allowedTransitions.map(statusLabel).join(', ')}`
                          : 'Немає доступних переходів'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-white/80">
                        {order.shippingZoneName || 'Без зони'}
                      </div>
                      <div className="mt-1 text-xs text-white/45">
                        {order.taxRegionName || 'Без правила'}
                      </div>
                      <div className="mt-1.5 text-[11px] text-white/30 uppercase tracking-widest font-medium">
                        {order.itemCount} поз. · {order.shipmentsCount} відпр. · {order.timelineCount} лог
                      </div>
                    </td>
                    <td className="px-5 py-5 text-white/90 font-medium tracking-wide">
                      {formatMoney(order.total, order.currency)}
                    </td>
                    <td className="px-5 py-5 text-[13px] text-white/40 tracking-wider">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-5">
                      <Link
                        href={`/admin/shop/orders/${order.id}`}
                        className="inline-flex items-center gap-2 rounded-none border border-white/[0.08] bg-transparent hover:bg-white/5 px-3 py-2 text-xs font-medium uppercase tracking-widest text-white/70 hover:text-white transition-all duration-300"
                      >
                        Відкрити
                        <ChevronRight className="h-3.5 w-3.5 text-white/40" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

type SummaryCardProps = {
  label: string;
  value: string;
  detail: string;
};

function SummaryCard({ label, value, detail }: SummaryCardProps) {
  return (
    <div className="rounded-none border border-white/[0.08] bg-black/60 shadow-2xl backdrop-blur-2xl p-5 hover:border-indigo-500/30 hover:shadow-[0_0_20px_rgba(99,102,241,0.1)] transition-all duration-300 group">
      <div className="text-[11px] uppercase tracking-[0.2em] font-medium text-white/40 mb-4">{label}</div>
      <div className="mt-3 text-3xl font-light text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">{value}</div>
      <div className="mt-2 text-[13px] font-light text-white/40">{detail}</div>
    </div>
  );
}

type SelectFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
};

function SelectField({ label, value, onChange, options }: SelectFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-wider font-medium text-white/40">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-none border border-white/[0.08] bg-black/40 px-3 py-2.5 text-[13px] text-white/80 focus:border-indigo-500/50 focus:outline-none transition-colors"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value || option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
