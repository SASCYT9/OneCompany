'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Columns3, FileClock, List, Package, RefreshCcw, Save, Search, ShoppingCart, X } from 'lucide-react';

import {
  AdminActionBar,
  AdminEmptyState,
  AdminFilterBar,
  AdminInlineAlert,
  AdminInspectorCard,
  AdminKeyValueGrid,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableShell,
} from '@/components/admin/AdminPrimitives';
import { AdminInputField, AdminSelectField } from '@/components/admin/AdminFormFields';

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
  customerId: string | null;
  customerGroupSnapshot: string;
  currency: string;
  total: number;
  paymentStatus: string;
  amountPaid: number;
  outstandingAmount: number;
  createdAt: string;
  itemCount: number;
  shipmentsCount: number;
  timelineCount: number;
  latestEvent: {
    toStatus: OrderStatus;
    note: string | null;
    createdAt: string;
  } | null;
  allowedTransitions: OrderStatus[];
  shippingZoneId: string | null;
  shippingZoneName: string | null;
  taxRegionId: string | null;
  taxRegionName: string | null;
};

type OrderDetail = OrderSummary & {
  phone: string | null;
  customerGroupSnapshot?: string;
  b2bDiscountPercent?: number | null;
  discountNotes?: string | null;
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  deliveryMethod: string | null;
  ttnNumber: string | null;
  shippingCalculatedCost: number | null;
  viewToken: string;
  updatedAt: string;
  items: Array<{
    id: string;
    productSlug: string;
    title: string;
    quantity: number;
    price: number;
    total: number;
    image: string | null;
    sku?: string | null;
    brand?: string | null;
  }>;
  shipments: Array<{
    id: string;
    carrier: string;
    serviceLevel: string | null;
    trackingNumber: string;
    trackingUrl: string | null;
    status: string;
    shippedAt: string | null;
    deliveredAt: string | null;
  }>;
  events: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    actorType: string;
    actorName: string | null;
    note: string | null;
    createdAt: string;
  }>;
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

type SmartFilterKey = 'all' | 'unpaid' | 'no_shipment' | 'no_customer' | 'b2b' | 'high_value' | 'delayed';

const SMART_FILTERS: Array<{ key: SmartFilterKey; label: string; description: string }> = [
  { key: 'all', label: 'All', description: 'Visible queue' },
  { key: 'unpaid', label: 'Unpaid', description: 'Outstanding balance' },
  { key: 'no_shipment', label: 'No shipment', description: 'Needs fulfillment' },
  { key: 'no_customer', label: 'No customer', description: 'Guest or missing account' },
  { key: 'b2b', label: 'B2B', description: 'B2B customer group' },
  { key: 'high_value', label: 'High value', description: '>= 1,000 in order currency' },
  { key: 'delayed', label: 'Delayed', description: 'Status age over SLA' },
];

const KANBAN_STATUSES: OrderStatus[] = ['PENDING_PAYMENT', 'PENDING_REVIEW', 'PROCESSING', 'SHIPPED'];

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

function paymentTone(status: string, outstandingAmount?: number): 'default' | 'success' | 'warning' | 'danger' {
  if (status === 'PAID' || outstandingAmount === 0) return 'success';
  if (status === 'PARTIALLY_PAID') return 'warning';
  if (status === 'UNPAID') return 'danger';
  return 'default';
}

function statusAgeHours(order: OrderSummary) {
  const from = order.latestEvent?.createdAt || order.createdAt;
  const diff = Date.now() - new Date(from).getTime();
  return Math.max(0, Math.floor(diff / 36e5));
}

function slaTone(hours: number, status: OrderStatus): 'default' | 'success' | 'warning' | 'danger' {
  if (status === 'DELIVERED' || status === 'CANCELLED' || status === 'REFUNDED') return 'default';
  if (hours >= 72) return 'danger';
  if (hours >= 24) return 'warning';
  return 'success';
}

function matchesSmartFilter(order: OrderSummary, filter: SmartFilterKey) {
  switch (filter) {
    case 'unpaid':
      return order.outstandingAmount > 0 || order.paymentStatus !== 'PAID';
    case 'no_shipment':
      return order.shipmentsCount === 0 && !['CANCELLED', 'REFUNDED'].includes(order.status);
    case 'no_customer':
      return !order.customerId;
    case 'b2b':
      return order.customerGroupSnapshot.startsWith('B2B');
    case 'high_value':
      return order.total >= 1000;
    case 'delayed':
      return statusAgeHours(order) >= 24 && !['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(order.status);
    default:
      return true;
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
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<OrderDetail | null>(null);
  const [activeOrderLoading, setActiveOrderLoading] = useState(false);
  const [activeOrderError, setActiveOrderError] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [smartFilter, setSmartFilter] = useState<SmartFilterKey>('all');

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
    setActiveOrderId((current) => (current && orders.some((order) => order.id === current) ? current : null));
  }, [orders]);

  useEffect(() => {
    if (!activeOrderId) {
      setActiveOrder(null);
      setActiveOrderError('');
      return;
    }

    let cancelled = false;
    async function loadActiveOrder() {
      setActiveOrderLoading(true);
      setActiveOrderError('');
      try {
        const response = await fetch(`/api/admin/shop/orders/${activeOrderId}`, { cache: 'no-store' });
        const data = (await response.json().catch(() => ({}))) as OrderDetail & { error?: string };
        if (!response.ok) {
          throw new Error(data.error || 'Не вдалося завантажити робочу панель замовлення');
        }
        if (!cancelled) {
          setActiveOrder(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setActiveOrder(null);
          setActiveOrderError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити робочу панель замовлення');
        }
      } finally {
        if (!cancelled) {
          setActiveOrderLoading(false);
        }
      }
    }

    void loadActiveOrder();
    return () => {
      cancelled = true;
    };
  }, [activeOrderId, reloadKey]);

  const selectedOrders = useMemo(
    () => orders.filter((order) => selectedIds.includes(order.id)),
    [orders, selectedIds]
  );

  const visibleOrders = useMemo(
    () => orders.filter((order) => matchesSmartFilter(order, smartFilter)),
    [orders, smartFilter]
  );

  const hotQueue = useMemo(
    () =>
      orders
        .filter((order) => matchesSmartFilter(order, 'unpaid') || matchesSmartFilter(order, 'no_shipment') || matchesSmartFilter(order, 'delayed'))
        .sort((left, right) => statusAgeHours(right) - statusAgeHours(left)),
    [orders]
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
    if (selectedIds.length === visibleOrders.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(visibleOrders.map((order) => order.id));
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

  function refreshOrders() {
    setReloadKey((current) => current + 1);
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
        <AdminMetricCard label="Visible orders" value={visibleOrders.length} meta={`${selectedIds.length} selected`} />
        <AdminMetricCard label="Hot queue" value={hotQueue.length} meta="Need action now" tone="accent" />
        <AdminMetricCard label="Pending payment" value={stats.statusCounts.PENDING_PAYMENT || 0} meta="Need payment follow-up" tone="accent" />
        <AdminMetricCard label="Pending review" value={stats.statusCounts.PENDING_REVIEW || 0} meta="Need manager validation" />
      </AdminMetricGrid>

      <AdminActionBar>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={refreshOrders}
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
          <div className="inline-flex overflow-hidden rounded-full border border-white/10 bg-white/5">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-2 px-3 py-2 text-sm transition ${viewMode === 'table' ? 'bg-stone-100 text-black' : 'text-stone-300 hover:bg-white/10'}`}
            >
              <List className="h-4 w-4" />
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`inline-flex items-center gap-2 px-3 py-2 text-sm transition ${viewMode === 'kanban' ? 'bg-stone-100 text-black' : 'text-stone-300 hover:bg-white/10'}`}
            >
              <Columns3 className="h-4 w-4" />
              Kanban
            </button>
          </div>
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

      <div className="flex flex-wrap gap-2">
        {SMART_FILTERS.map((filter) => {
          const count = filter.key === 'all' ? orders.length : orders.filter((order) => matchesSmartFilter(order, filter.key)).length;
          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => setSmartFilter(filter.key)}
              className={`rounded-2xl border px-3 py-2 text-left transition ${
                smartFilter === filter.key
                  ? 'border-amber-100/20 bg-amber-100/[0.08] text-amber-100'
                  : 'border-white/10 bg-white/[0.03] text-stone-300 hover:bg-white/[0.06]'
              }`}
            >
              <span className="block text-sm font-medium">{filter.label} · {count}</span>
              <span className="block text-[11px] text-stone-500">{filter.description}</span>
            </button>
          );
        })}
      </div>

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

      {visibleOrders.length === 0 ? (
        <AdminEmptyState
          title="No orders for current filters"
          description="Змініть фільтри або створіть нове замовлення, щоб почати роботу з чергою."
        />
      ) : viewMode === 'kanban' ? (
        <>
          <OrdersKanban
            orders={visibleOrders}
            activeOrderId={activeOrderId}
            onOpen={setActiveOrderId}
          />
          {activeOrderId ? (
            <div className="rounded-[28px] border border-white/10 bg-black/25 p-4">
              {activeOrderLoading ? (
                <div className="rounded-[24px] border border-white/10 bg-[#101010] px-4 py-6 text-sm text-stone-400">
                  Loading order workbench...
                </div>
              ) : activeOrderError ? (
                <AdminInlineAlert tone="error">{activeOrderError}</AdminInlineAlert>
              ) : activeOrder ? (
                <OrderInlineWorkbench
                  order={activeOrder}
                  onClose={() => setActiveOrderId(null)}
                  onReload={refreshOrders}
                  setPageError={setError}
                  setPageSuccess={setSuccess}
                />
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <AdminTableShell>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-stone-500">
                  <th className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={visibleOrders.length > 0 && selectedIds.length === visibleOrders.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-white/20 bg-zinc-950"
                    />
                  </th>
                  <th className="px-4 py-4 font-medium">Order</th>
                  <th className="px-4 py-4 font-medium">Status</th>
                  <th className="px-4 py-4 font-medium">Payment</th>
                  <th className="px-4 py-4 font-medium">Operations</th>
                  <th className="px-4 py-4 font-medium">Total</th>
                  <th className="px-4 py-4 font-medium">Latest</th>
                  <th className="px-4 py-4 font-medium">Created</th>
                  <th className="px-4 py-4 font-medium">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {visibleOrders.map((order) => (
                  <Fragment key={order.id}>
                    <tr className={`align-top transition hover:bg-white/[0.03] ${activeOrderId === order.id ? 'bg-amber-100/[0.03]' : ''}`}>
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
                        <div className="mt-2">
                          <AdminStatusBadge tone={slaTone(statusAgeHours(order), order.status)}>
                            SLA {statusAgeHours(order)}h
                          </AdminStatusBadge>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <AdminStatusBadge tone={paymentTone(order.paymentStatus, order.outstandingAmount)}>
                          {order.paymentStatus.replace(/_/g, ' ')}
                        </AdminStatusBadge>
                        <div className="mt-2 text-xs text-stone-500">
                          Paid {formatMoney(order.amountPaid, order.currency)}
                        </div>
                        <div className={`mt-1 text-xs ${order.outstandingAmount > 0 ? 'text-amber-200' : 'text-emerald-300'}`}>
                          Outstanding {formatMoney(order.outstandingAmount, order.currency)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-stone-200">{order.shippingZoneName || 'Без зони'}</div>
                        <div className="mt-1 text-xs text-stone-500">{order.taxRegionName || 'Без правила'}</div>
                        <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-stone-600">
                          {order.itemCount} items · {order.shipmentsCount} shipments
                        </div>
                      </td>
                      <td className="px-4 py-4 font-medium text-stone-100">{formatMoney(order.total, order.currency)}</td>
                      <td className="px-4 py-4">
                        {order.latestEvent ? (
                          <div className="max-w-[180px]">
                            <div className="text-xs font-medium text-stone-300">{statusLabel(order.latestEvent.toStatus)}</div>
                            <div className="mt-1 truncate text-xs text-stone-500">{order.latestEvent.note || 'Status update'}</div>
                            <div className="mt-1 text-[11px] text-stone-600">{new Date(order.latestEvent.createdAt).toLocaleDateString()}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-stone-600">No timeline</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs text-stone-500">{new Date(order.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveOrderId((current) => (current === order.id ? null : order.id))}
                            className="inline-flex items-center gap-2 rounded-full border border-amber-100/15 bg-amber-100/[0.06] px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] text-amber-100 transition hover:bg-amber-100/[0.1]"
                          >
                            Workbench
                            <ChevronRight className={`h-3.5 w-3.5 transition ${activeOrderId === order.id ? 'rotate-90' : ''}`} />
                          </button>
                          <Link
                            href={`/admin/shop/orders/${order.id}`}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] text-stone-200 transition hover:bg-white/10"
                          >
                            Detail
                          </Link>
                        </div>
                      </td>
                    </tr>
                    {activeOrderId === order.id ? (
                      <tr>
                        <td colSpan={9} className="bg-black/20 px-4 py-5">
                          {activeOrderLoading ? (
                            <div className="rounded-[24px] border border-white/10 bg-[#101010] px-4 py-6 text-sm text-stone-400">
                              Loading order workbench...
                            </div>
                          ) : activeOrderError ? (
                            <AdminInlineAlert tone="error">{activeOrderError}</AdminInlineAlert>
                          ) : activeOrder ? (
                            <OrderInlineWorkbench
                              order={activeOrder}
                              onClose={() => setActiveOrderId(null)}
                              onReload={refreshOrders}
                              setPageError={setError}
                              setPageSuccess={setSuccess}
                            />
                          ) : null}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </AdminTableShell>
      )}
    </AdminPage>
  );
}

function OrdersKanban({
  orders,
  activeOrderId,
  onOpen,
}: {
  orders: OrderSummary[];
  activeOrderId: string | null;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {KANBAN_STATUSES.map((status) => {
        const columnOrders = orders.filter((order) => order.status === status);
        return (
          <section key={status} className="min-h-[240px] rounded-[28px] border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-stone-100">{statusLabel(status)}</div>
                <div className="text-xs text-stone-500">{columnOrders.length} orders</div>
              </div>
              <AdminStatusBadge tone={statusTone(status)}>{status.replace(/_/g, ' ')}</AdminStatusBadge>
            </div>

            <div className="space-y-2">
              {columnOrders.map((order) => {
                const hours = statusAgeHours(order);
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => onOpen(order.id)}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      activeOrderId === order.id
                        ? 'border-amber-100/25 bg-amber-100/[0.08]'
                        : 'border-white/10 bg-black/25 hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-mono text-xs font-semibold text-stone-100">{order.orderNumber}</div>
                        <div className="mt-1 truncate text-sm text-stone-200">{order.customerName}</div>
                        <div className="mt-1 truncate text-xs text-stone-500">{order.email}</div>
                      </div>
                      <AdminStatusBadge tone={slaTone(hours, order.status)}>SLA {hours}h</AdminStatusBadge>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-stone-500">{order.itemCount} items · {order.shipmentsCount} shipments</span>
                      <span className={order.outstandingAmount > 0 ? 'text-amber-200' : 'text-emerald-300'}>
                        {formatMoney(order.outstandingAmount, order.currency)}
                      </span>
                    </div>
                  </button>
                );
              })}
              {!columnOrders.length ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-6 text-center text-sm text-stone-600">
                  Empty
                </div>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
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

function OrderInlineWorkbench({
  order,
  onClose,
  onReload,
  setPageError,
  setPageSuccess,
}: {
  order: OrderDetail;
  onClose: () => void;
  onReload: () => void;
  setPageError: (value: string) => void;
  setPageSuccess: (value: string) => void;
}) {
  const [paymentStatus, setPaymentStatus] = useState(order.paymentStatus);
  const [amountPaid, setAmountPaid] = useState(String(order.amountPaid));
  const [deliveryMethod, setDeliveryMethod] = useState(order.deliveryMethod ?? '');
  const [ttnNumber, setTtnNumber] = useState(order.ttnNumber ?? '');
  const [shippingCalculatedCost, setShippingCalculatedCost] = useState(
    order.shippingCalculatedCost != null ? String(order.shippingCalculatedCost) : ''
  );
  const [saving, setSaving] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState('');

  const outstanding = Math.max(0, order.total - (parseFloat(amountPaid) || 0));

  async function patchOrder(payload: Record<string, unknown>, successMessage: string) {
    setSaving(true);
    setPageError('');
    setPageSuccess('');
    try {
      const response = await fetch(`/api/admin/shop/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPageError(data.error || 'Не вдалося оновити замовлення');
        return false;
      }
      setPageSuccess(successMessage);
      onReload();
      return true;
    } finally {
      setSaving(false);
      setStatusUpdating('');
    }
  }

  async function updateStatus(status: OrderStatus) {
    setStatusUpdating(status);
    await patchOrder({ status, note: `Inline workbench transition to ${statusLabel(status)}` }, `Замовлення переведено в статус «${statusLabel(status)}».`);
  }

  async function savePaymentAndFulfillment() {
    await patchOrder(
      {
        paymentStatus,
        amountPaid: parseFloat(amountPaid) || 0,
        deliveryMethod,
        ttnNumber,
        shippingCalculatedCost: shippingCalculatedCost ? parseFloat(shippingCalculatedCost) : null,
      },
      'Оплату та fulfillment збережено.'
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <AdminActionBar className="bg-[#101010]">
          <div className="min-w-0">
            <div className="font-mono text-sm font-semibold text-stone-100">{order.orderNumber}</div>
            <div className="mt-1 text-sm text-stone-400">
              {order.customerName} · {order.email}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge tone={statusTone(order.status)}>{statusLabel(order.status)}</AdminStatusBadge>
            <AdminStatusBadge tone={paymentTone(paymentStatus, outstanding)}>
              {paymentStatus.replace(/_/g, ' ')}
            </AdminStatusBadge>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-stone-300 transition hover:bg-white/10"
              aria-label="Close order workbench"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </AdminActionBar>

        <AdminMetricGrid className="xl:grid-cols-4">
          <AdminMetricCard label="Subtotal" value={formatMoney(order.subtotal, order.currency)} />
          <AdminMetricCard label="Shipping" value={formatMoney(order.shippingCost, order.currency)} meta={order.shippingZoneName || 'No zone'} />
          <AdminMetricCard label="Paid" value={formatMoney(parseFloat(amountPaid) || 0, order.currency)} />
          <AdminMetricCard label="Outstanding" value={formatMoney(outstanding, order.currency)} tone={outstanding > 0 ? 'accent' : 'default'} />
        </AdminMetricGrid>

        <div className="grid gap-4 lg:grid-cols-2">
          <AdminInspectorCard title="Status transitions" description="Only valid next states from the existing order transition rules.">
            <div className="flex flex-wrap gap-2">
              {order.allowedTransitions.length ? (
                order.allowedTransitions.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => void updateStatus(status)}
                    disabled={Boolean(statusUpdating || saving)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-stone-200 transition hover:bg-white/10 disabled:opacity-50"
                  >
                    {statusUpdating === status ? 'Applying...' : statusLabel(status)}
                  </button>
                ))
              ) : (
                <div className="text-sm text-stone-500">No available transitions for the current state.</div>
              )}
            </div>
          </AdminInspectorCard>

          <AdminInspectorCard title="Payment and fulfillment" description="Edit the fields managers usually need without opening the detail page.">
            <div className="grid gap-3 md:grid-cols-2">
              <AdminSelectField
                label="Payment"
                value={paymentStatus}
                onChange={setPaymentStatus}
                options={[
                  { value: 'UNPAID', label: 'Не оплачено' },
                  { value: 'PARTIALLY_PAID', label: 'Оплачено частково' },
                  { value: 'PAID', label: 'Оплачено повністю' },
                ]}
              />
              <AdminInputField label="Amount paid" value={amountPaid} onChange={setAmountPaid} type="number" step="0.01" />
              <AdminSelectField
                label="Delivery"
                value={deliveryMethod}
                onChange={setDeliveryMethod}
                options={[
                  { value: '', label: 'Не обрано' },
                  { value: 'NOVA_POSHTA', label: 'Нова Пошта' },
                  { value: 'SPECIAL_DELIVERY', label: 'Спецдоставка' },
                  { value: 'PICKUP', label: 'Самовивіз' },
                ]}
              />
              <AdminInputField label="TTN" value={ttnNumber} onChange={setTtnNumber} />
              <AdminInputField label="Shipping override" value={shippingCalculatedCost} onChange={setShippingCalculatedCost} type="number" step="0.01" />
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => void savePaymentAndFulfillment()}
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-100 px-4 py-2 text-sm font-medium text-black transition hover:bg-stone-200 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </AdminInspectorCard>
        </div>

        <AdminTableShell>
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-sm font-medium text-stone-100">Items</h2>
            <p className="mt-1 text-xs text-stone-500">Order composition and line totals.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-stone-500">
                  <th className="px-4 py-4 font-medium">Item</th>
                  <th className="px-4 py-4 font-medium">SKU</th>
                  <th className="px-4 py-4 font-medium">Qty</th>
                  <th className="px-4 py-4 font-medium">Price</th>
                  <th className="px-4 py-4 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {order.items.map((item) => (
                  <tr key={item.id} className="transition hover:bg-white/[0.03]">
                    <td className="px-4 py-4">
                      <div className="font-medium text-stone-100">{item.title}</div>
                      <div className="mt-1 text-xs text-stone-500">{item.brand || item.productSlug}</div>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-stone-400">{item.sku || item.productSlug || '-'}</td>
                    <td className="px-4 py-4 text-stone-300">{item.quantity}</td>
                    <td className="px-4 py-4 text-stone-300">{formatMoney(item.price, order.currency)}</td>
                    <td className="px-4 py-4 font-medium text-stone-100">{formatMoney(item.total, order.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminTableShell>
      </div>

      <aside className="space-y-4">
        <AdminInspectorCard title="Order snapshot" description="Customer, totals and routing context.">
          <AdminKeyValueGrid
            rows={[
              { label: 'Customer', value: order.customerName },
              { label: 'Phone', value: order.phone || '-' },
              { label: 'Group', value: order.customerGroupSnapshot || '-' },
              { label: 'Total', value: formatMoney(order.total, order.currency) },
              { label: 'Updated', value: new Date(order.updatedAt).toLocaleString() },
            ]}
          />
        </AdminInspectorCard>

        <AdminInspectorCard title="Shipments" description="Current shipment records tied to this order.">
          {order.shipments.length ? (
            <div className="space-y-3">
              {order.shipments.map((shipment) => (
                <div key={shipment.id} className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-stone-100">{shipment.trackingNumber}</div>
                    <AdminStatusBadge tone={shipment.status === 'DELIVERED' ? 'success' : shipment.status === 'CANCELLED' ? 'danger' : 'warning'}>
                      {shipment.status.replace(/_/g, ' ')}
                    </AdminStatusBadge>
                  </div>
                  <div className="mt-2 text-xs text-stone-500">
                    {shipment.carrier}
                    {shipment.serviceLevel ? ` · ${shipment.serviceLevel}` : ''}
                  </div>
                  {shipment.trackingUrl ? (
                    <a href={shipment.trackingUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-amber-100/75 hover:text-amber-100">
                      Tracking URL
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-sm text-stone-500">
              No shipment records yet.
            </div>
          )}
        </AdminInspectorCard>

        <AdminInspectorCard title="Latest timeline" description="Most recent order events.">
          <div className="space-y-3">
            {order.events.slice(0, 4).map((event) => (
              <div key={event.id} className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                <div className="text-sm font-medium text-stone-100">
                  {event.fromStatus ? `${statusLabel(event.fromStatus)} -> ` : ''}
                  {statusLabel(event.toStatus)}
                </div>
                <div className="mt-1 text-xs text-stone-500">
                  {event.actorName || event.actorType} · {new Date(event.createdAt).toLocaleString()}
                </div>
                {event.note ? <div className="mt-2 text-sm text-stone-300">{event.note}</div> : null}
              </div>
            ))}
          </div>
        </AdminInspectorCard>
      </aside>
    </div>
  );
}
