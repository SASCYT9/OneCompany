'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, FileClock, Package, RefreshCcw, Search, ShoppingCart } from 'lucide-react';

import {
  AdminActionBar,
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

function statusTone(status: string): 'default' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'DELIVERED':
      return 'success';
    case 'CANCELLED':
    case 'REFUNDED':
      return 'danger';
    case 'PENDING_PAYMENT':
    case 'PENDING_REVIEW':
    case 'PROCESSING':
    case 'SHIPPED':
      return 'warning';
    default:
      return 'default';
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
      <AdminPage>
        <div className="flex items-center gap-3 rounded-[28px] border border-white/10 bg-[#101010] px-5 py-6 text-sm text-stone-400">
          <Package className="h-4 w-4 animate-pulse" />
          Завантаження замовлень…
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Orders"
        title="Order Center"
        description="Робоча черга замовлень: від перевірки і оплати до виконання, відправлення та контролю винятків."
        actions={
          <>
            <Link
              href="/admin/shop/orders/create"
              className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-4 py-2 text-sm font-medium text-black transition hover:bg-stone-200"
            >
              B2B order
            </Link>
            <Link
              href="/admin/shop/orders/new"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-stone-200 transition hover:bg-white/10"
            >
              Manual order
            </Link>
          </>
        }
      />

      <AdminMetricGrid>
        <AdminMetricCard label="Visible orders" value={stats.total} meta={`${selectedIds.length} selected`} />
        <AdminMetricCard label="Pending payment" value={stats.statusCounts.PENDING_PAYMENT || 0} meta="Need payment follow-up" tone="accent" />
        <AdminMetricCard label="Pending review" value={stats.statusCounts.PENDING_REVIEW || 0} meta="Need manager validation" />
        <AdminMetricCard label="Processing + shipped" value={(stats.statusCounts.PROCESSING || 0) + (stats.statusCounts.SHIPPED || 0)} meta="Active operational queue" />
      </AdminMetricGrid>

      <AdminActionBar>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-stone-200 transition hover:bg-white/10"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
          <Link
            href="/admin/shop/audit"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-stone-200 transition hover:bg-white/10"
          >
            <FileClock className="h-4 w-4" />
            Audit
          </Link>
        </div>
        <div className="text-sm text-stone-500">
          Bulk actions are limited to transitions valid for the currently selected orders.
        </div>
      </AdminActionBar>

      <AdminFilterBar>
        <label className="flex min-w-[280px] flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-stone-200">
          <Search className="h-4 w-4 text-stone-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Пошук за номером, клієнтом або email"
            className="w-full bg-transparent text-stone-100 placeholder:text-stone-500 focus:outline-none"
          />
        </label>
        <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label }))} />
        <FilterSelect
          label="Currency"
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
        <FilterSelect
          label="Shipping zone"
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
        <FilterSelect
          label="Tax rule"
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
      </AdminFilterBar>

      {selectedOrders.length ? (
        <AdminActionBar>
          <div className="flex flex-wrap items-center gap-3 text-sm text-stone-300">
            <ShoppingCart className="h-4 w-4 text-amber-100/70" />
            {selectedOrders.length} selected
          </div>
          <div className="grid flex-1 gap-3 lg:grid-cols-[240px_minmax(0,1fr)_auto]">
            <FilterSelect
              label="Bulk status"
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
              <span className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-stone-500">Bulk note</span>
              <input
                value={bulkNote}
                onChange={(event) => setBulkNote(event.target.value)}
                placeholder="Необов'язкова нотатка для історії замовлень"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500 focus:border-white/20 focus:outline-none"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleBulkUpdate}
                disabled={!bulkStatus || !selectedIds.length || bulkUpdating}
                className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-4 py-2 text-sm font-medium text-black transition hover:bg-stone-200 disabled:opacity-50"
              >
                {bulkUpdating ? 'Applying…' : 'Apply'}
              </button>
            </div>
          </div>
        </AdminActionBar>
      ) : null}

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}
      {success ? <AdminInlineAlert tone="success">{success}</AdminInlineAlert> : null}

      {orders.length === 0 ? (
        <AdminEmptyState
          title="No orders for current filters"
          description="Змініть фільтри або створіть нове замовлення, щоб почати роботу з чергою."
        />
      ) : (
        <AdminTableShell>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-stone-500">
                  <th className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={orders.length > 0 && selectedIds.length === orders.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-white/20 bg-zinc-950"
                    />
                  </th>
                  <th className="px-4 py-4 font-medium">Order</th>
                  <th className="px-4 py-4 font-medium">Status</th>
                  <th className="px-4 py-4 font-medium">Operations</th>
                  <th className="px-4 py-4 font-medium">Total</th>
                  <th className="px-4 py-4 font-medium">Created</th>
                  <th className="px-4 py-4 font-medium">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {orders.map((order) => (
                  <tr key={order.id} className="align-top transition hover:bg-white/[0.03]">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(order.id)}
                        onChange={() => toggleSelected(order.id)}
                        className="h-4 w-4 rounded border-white/20 bg-zinc-950"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-mono text-xs font-semibold tracking-wide text-stone-100">{order.orderNumber}</div>
                      <div className="mt-1 text-sm font-medium text-stone-200">{order.customerName}</div>
                      <div className="mt-1 text-xs text-stone-500">{order.email}</div>
                    </td>
                    <td className="px-4 py-4">
                      <AdminStatusBadge tone={statusTone(order.status)}>{statusLabel(order.status)}</AdminStatusBadge>
                      <div className="mt-2 text-xs text-stone-500">
                        {order.allowedTransitions.length
                          ? `Next: ${order.allowedTransitions.map(statusLabel).join(', ')}`
                          : 'No available transitions'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-stone-200">{order.shippingZoneName || 'Без зони'}</div>
                      <div className="mt-1 text-xs text-stone-500">{order.taxRegionName || 'Без правила'}</div>
                      <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-stone-600">
                        {order.itemCount} items · {order.shipmentsCount} shipments · {order.timelineCount} events
                      </div>
                    </td>
                    <td className="px-4 py-4 font-medium text-stone-100">{formatMoney(order.total, order.currency)}</td>
                    <td className="px-4 py-4 text-xs text-stone-500">{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/admin/shop/orders/${order.id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] text-stone-200 transition hover:bg-white/10"
                      >
                        Open
                        <ChevronRight className="h-3.5 w-3.5 text-stone-500" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminTableShell>
      )}
    </AdminPage>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block min-w-[180px]">
      <span className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-stone-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-stone-100 focus:border-white/20 focus:outline-none"
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
