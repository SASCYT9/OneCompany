'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Columns3, Download, ExternalLink, Eye, FileClock, List, Mail as MailIcon, Package, Phone, RefreshCcw, Save, Search, ShoppingCart, X } from 'lucide-react';

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
import { AdminSkeletonKpiGrid, AdminSkeletonTable } from '@/components/admin/AdminSkeleton';
import { AdminSlideOver } from '@/components/admin/AdminSlideOver';
import { AdminInlineSelect } from '@/components/admin/AdminInlineEdit';
import { AdminSavedViewsBar, useSavedViews } from '@/components/admin/AdminSavedViews';
import { useToast } from '@/components/admin/AdminToast';
import { AdminMobileCard } from '@/components/admin/AdminMobileCard';

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

const SMART_FILTER_LABELS: Record<string, { label: string; description: string }> = {
  all: { label: 'Усі', description: 'Поточна черга' },
  unpaid: { label: 'Неоплачено', description: 'Залишок до сплати' },
  no_shipment: { label: 'Без відправлення', description: 'Потребує відправки' },
  no_customer: { label: 'Без клієнта', description: 'Гість або без акаунта' },
  b2b: { label: 'B2B', description: 'B2B-група' },
  high_value: { label: 'Високий чек', description: '>= 1 000 у валюті замовлення' },
  delayed: { label: 'Затримано', description: 'Поза SLA' },
};

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
  { key: 'all', label: 'Усі', description: 'Поточна черга' },
  { key: 'unpaid', label: 'Неоплачено', description: 'Залишок до сплати' },
  { key: 'no_shipment', label: 'Без відправлення', description: 'Потребує відправки' },
  { key: 'no_customer', label: 'Без клієнта', description: 'Гість або без акаунта' },
  { key: 'b2b', label: 'B2B', description: 'B2B-група клієнтів' },
  { key: 'high_value', label: 'Високий чек', description: '>= 1 000 у валюті замовлення' },
  { key: 'delayed', label: 'Затримано', description: 'Поза SLA' },
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
  const toast = useToast();
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
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<OrderDetail | null>(null);
  const [activeOrderLoading, setActiveOrderLoading] = useState(false);
  const [activeOrderError, setActiveOrderError] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [smartFilter, setSmartFilter] = useState<SmartFilterKey>('all');
  const [exporting, setExporting] = useState(false);

  // Saved views — filter combinations stored in localStorage
  const savedViews = useSavedViews({
    scope: 'orders',
    currentValue: { status, currency, shippingZone, taxRegion, query, smartFilter },
    presets: [
      { name: 'Усі замовлення', value: { status: '', smartFilter: 'all' as SmartFilterKey, currency: '', shippingZone: '', taxRegion: '', query: '' } },
      { name: 'Неоплачені', value: { smartFilter: 'unpaid' as SmartFilterKey, status: '' } },
      { name: 'Очікують оплату', value: { status: 'PENDING_PAYMENT', smartFilter: 'all' as SmartFilterKey } },
      { name: 'B2B замовлення', value: { smartFilter: 'b2b' as SmartFilterKey, status: '' } },
      { name: 'Високий чек (1k+)', value: { smartFilter: 'high_value' as SmartFilterKey, status: '' } },
      { name: 'Затримані (>24г)', value: { smartFilter: 'delayed' as SmartFilterKey, status: '' } },
      { name: 'Без відправлення', value: { smartFilter: 'no_shipment' as SmartFilterKey, status: '' } },
    ],
    onApply: (v) => {
      setStatus((v.status as string) ?? '');
      setCurrency((v.currency as string) ?? '');
      setShippingZone((v.shippingZone as string) ?? '');
      setTaxRegion((v.taxRegion as string) ?? '');
      setQuery((v.query as string) ?? '');
      setSmartFilter((v.smartFilter as SmartFilterKey) ?? 'all');
    },
  });

  async function handleExport() {
    setExporting(true);
    try {
      const filtersJson = JSON.stringify({ status, currency, search: query });
      const filtersB64 = btoa(unescape(encodeURIComponent(filtersJson)));
      const response = await fetch(`/api/admin/export/orders?filters=${filtersB64}`, { cache: 'no-store' });
      if (!response.ok) {
        toast.error('Не вдалося експортувати замовлення');
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'orders.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Замовлення експортовано', `Завантажено ${a.download}`);
    } catch (e) {
      toast.error('Експорт не вдався', (e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  // Inline status change for a single order row
  async function changeOrderStatus(orderId: string, nextStatus: OrderStatus) {
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status === nextStatus) return;
    if (!order.allowedTransitions.includes(nextStatus)) {
      toast.warning('Зміна статусу не дозволена', `${statusLabel(order.status)} → ${statusLabel(nextStatus)} відсутня в робочому процесі.`);
      throw new Error('Invalid transition');
    }
    const response = await fetch('/api/admin/shop/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds: [orderId], status: nextStatus, note: 'Inline change from list' }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast.error('Не вдалося оновити статус', data.error || 'Спробуйте ще раз');
      throw new Error(data.error || 'Update failed');
    }
    toast.success(`Замовлення ${order.orderNumber} → ${statusLabel(nextStatus)}`);
    setReloadKey((k) => k + 1);
  }

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
        const msg = data.error || 'Bulk update failed';
        setError(msg);
        toast.error('Bulk update failed', msg);
        return;
      }

      const updated = data.updatedCount ?? 0;
      const newStatus = statusLabel(String(data.status ?? bulkStatus));
      setSuccess(`Оновлено замовлень: ${updated}. Новий статус: ${newStatus}.`);
      toast.success(
        `Updated ${updated} order${updated === 1 ? '' : 's'}`,
        `Status set to ${newStatus}`
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
      <AdminPage className="space-y-6">
        <div role="status" aria-live="polite" aria-busy="true" className="space-y-6">
          <span className="sr-only">Завантаження замовлень…</span>
          <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
            <div className="space-y-3">
              <div className="h-3 w-16 motion-safe:animate-pulse rounded bg-white/[0.06]" />
              <div className="h-9 w-72 motion-safe:animate-pulse rounded-md bg-white/[0.06]" />
              <div className="h-3.5 w-96 motion-safe:animate-pulse rounded bg-white/[0.04]" />
            </div>
            <div className="h-9 w-44 motion-safe:animate-pulse rounded-lg bg-white/[0.04]" />
          </div>
          <AdminSkeletonKpiGrid count={4} />
          <AdminSkeletonTable rows={8} cols={7} />
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Замовлення"
        title="Центр замовлень"
        description="Робоча черга замовлень: від перевірки і оплати до виконання, відправлення та контролю винятків."
        actions={
          <>
            <AdminSavedViewsBar {...savedViews} />
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {exporting ? 'Експорт…' : 'Експорт CSV'}
            </button>
            <Link
              href="/admin/shop/orders/create"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600"
            >
              B2B замовлення
            </Link>
            <Link
              href="/admin/shop/orders/new"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
            >
              Ручне замовлення
            </Link>
          </>
        }
      />

      <AdminMetricGrid>
        <AdminMetricCard label="Видимі замовлення" value={visibleOrders.length} meta={`${selectedIds.length} вибрано`} />
        <AdminMetricCard label="Гаряча черга" value={hotQueue.length} meta="Потребує дії зараз" tone="accent" />
        <AdminMetricCard label="Очікують оплату" value={stats.statusCounts.PENDING_PAYMENT || 0} meta="Потребують контролю оплати" tone="accent" />
        <AdminMetricCard label="На перевірці" value={stats.statusCounts.PENDING_REVIEW || 0} meta="Потребують підтвердження менеджером" />
      </AdminMetricGrid>

      <AdminActionBar>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={refreshOrders}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
          >
            <RefreshCcw className="h-4 w-4" />
            Оновити
          </button>
          <Link
            href="/admin/shop/audit"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
          >
            <FileClock className="h-4 w-4" />
            Аудит
          </Link>
          <div className="inline-flex overflow-hidden rounded-full border border-white/10 bg-white/5">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-2 px-3 py-2 text-sm transition ${viewMode === 'table' ? 'bg-zinc-100 text-black' : 'text-zinc-300 hover:bg-white/10'}`}
            >
              <List className="h-4 w-4" />
              Таблиця
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`inline-flex items-center gap-2 px-3 py-2 text-sm transition ${viewMode === 'kanban' ? 'bg-zinc-100 text-black' : 'text-zinc-300 hover:bg-white/10'}`}
            >
              <Columns3 className="h-4 w-4" />
              Канбан
            </button>
          </div>
        </div>
        <div className="text-sm text-zinc-500">
          Масові дії обмежені переходами, що дозволені для всіх вибраних замовлень.
        </div>
      </AdminActionBar>

      <AdminFilterBar>
        <label className="flex min-w-[280px] flex-1 items-center gap-2 rounded-[6px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200">
          <Search className="h-4 w-4 text-zinc-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Пошук за номером, клієнтом або email"
            className="w-full bg-transparent text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
        </label>
        <FilterSelect label="Статус" value={status} onChange={setStatus} options={STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label }))} />
        <FilterSelect
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
        <FilterSelect
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
        <FilterSelect
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
      </AdminFilterBar>

      <div className="flex flex-wrap gap-2">
        {SMART_FILTERS.map((filter) => {
          const count = filter.key === 'all' ? orders.length : orders.filter((order) => matchesSmartFilter(order, filter.key)).length;
          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => setSmartFilter(filter.key)}
              className={`rounded-[6px] border px-3 py-2 text-left transition ${
                smartFilter === filter.key
                  ? 'border-blue-500/30 bg-blue-500/[0.08] text-blue-300'
                  : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]'
              }`}
            >
              <span className="block text-sm font-medium">{filter.label} · {count}</span>
              <span className="block text-[11px] text-zinc-500">{filter.description}</span>
            </button>
          );
        })}
      </div>

      {selectedOrders.length ? (
        <AdminActionBar className="sticky top-4 z-30 bg-[#171717]/95 backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-300">
            <ShoppingCart className="h-4 w-4 text-blue-300" />
            {selectedOrders.length} вибрано
          </div>
          <div className="grid flex-1 gap-3 lg:grid-cols-[240px_minmax(0,1fr)_auto]">
            <FilterSelect
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
              <span className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-zinc-500">Масова нотатка</span>
              <input
                value={bulkNote}
                onChange={(event) => setBulkNote(event.target.value)}
                placeholder="Необов'язкова нотатка для історії замовлень"
                className="w-full rounded-[6px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-white/20 focus:outline-none"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleBulkUpdate}
                disabled={!bulkStatus || !selectedIds.length || bulkUpdating}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
              >
                {bulkUpdating ? 'Застосування…' : 'Застосувати'}
              </button>
            </div>
          </div>
        </AdminActionBar>
      ) : null}

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}
      {success ? <AdminInlineAlert tone="success">{success}</AdminInlineAlert> : null}

      {visibleOrders.length === 0 ? (
        <AdminEmptyState
          title="Немає замовлень за поточними фільтрами"
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
            <div className="rounded-[6px] border border-white/10 bg-black/25 p-4">
              {activeOrderLoading ? (
                <div className="rounded-[6px] border border-white/10 bg-[#171717] px-4 py-6 text-sm text-zinc-400">
                  Завантаження робочої панелі замовлення…
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
        <>
          {/* Mobile card view */}
          <div className="space-y-2 lg:hidden">
            {visibleOrders.map((order) => (
              <AdminMobileCard
                key={order.id}
                title={
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs">{order.orderNumber}</span>
                  </span>
                }
                subtitle={`${order.customerName} · ${order.email}`}
                badge={<AdminStatusBadge tone={statusTone(order.status)}>{statusLabel(order.status)}</AdminStatusBadge>}
                rows={[
                  { label: 'Сума', value: formatMoney(order.total, order.currency) },
                  { label: 'Залишок', value: formatMoney(order.outstandingAmount, order.currency) },
                  { label: 'Позицій', value: `${order.itemCount} · ${order.shipmentsCount} відпр.` },
                  { label: 'SLA', value: `${statusAgeHours(order)}год` },
                ]}
                footer={
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setQuickViewId(order.id)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-blue-500/25 bg-blue-500/[0.08] px-3 py-2.5 text-xs font-medium uppercase tracking-wider text-blue-300"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Швидкий перегляд
                    </button>
                    <Link
                      href={`/admin/shop/orders/${order.id}`}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-xs font-medium uppercase tracking-wider text-zinc-200"
                    >
                      Відкрити
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                }
              />
            ))}
          </div>

          {/* Desktop table */}
          <AdminTableShell className="hidden lg:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  <th className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={visibleOrders.length > 0 && selectedIds.length === visibleOrders.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-white/20 bg-zinc-950"
                    />
                  </th>
                  <th className="px-4 py-4 font-medium">Замовлення</th>
                  <th className="px-4 py-4 font-medium">Статус</th>
                  <th className="px-4 py-4 font-medium">Оплата</th>
                  <th className="px-4 py-4 font-medium">Логістика</th>
                  <th className="px-4 py-4 font-medium">Сума</th>
                  <th className="px-4 py-4 font-medium">Остання активність</th>
                  <th className="px-4 py-4 font-medium">Створено</th>
                  <th className="px-4 py-4 font-medium">Відкрити</th>
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
                        <div className="font-mono text-xs font-semibold tracking-wide text-zinc-100">{order.orderNumber}</div>
                        <div className="mt-1 text-sm font-medium text-zinc-200">{order.customerName}</div>
                        <div className="mt-1 text-xs text-zinc-500">{order.email}</div>
                      </td>
                      <td className="px-4 py-4">
                        <AdminInlineSelect<OrderStatus>
                          value={order.status}
                          display={
                            <AdminStatusBadge tone={statusTone(order.status)}>{statusLabel(order.status)}</AdminStatusBadge>
                          }
                          options={[
                            { value: order.status, label: statusLabel(order.status) },
                            ...order.allowedTransitions.map((t) => ({ value: t, label: statusLabel(t) })),
                          ]}
                          onSave={(next) => changeOrderStatus(order.id, next)}
                          disabled={order.allowedTransitions.length === 0}
                        />
                        <div className="mt-2 text-xs text-zinc-500">
                          {order.allowedTransitions.length
                            ? `Клікніть на статус щоб змінити · ${order.allowedTransitions.length} переходів доступно`
                            : 'Немає доступних переходів'}
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
                        <div className="mt-2 text-xs text-zinc-500">
                          Сплачено {formatMoney(order.amountPaid, order.currency)}
                        </div>
                        <div className={`mt-1 text-xs ${order.outstandingAmount > 0 ? 'text-amber-200' : 'text-emerald-300'}`}>
                          Залишок {formatMoney(order.outstandingAmount, order.currency)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-zinc-200">{order.shippingZoneName || 'Без зони'}</div>
                        <div className="mt-1 text-xs text-zinc-500">{order.taxRegionName || 'Без правила'}</div>
                        <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-zinc-600">
                          {order.itemCount} позицій · {order.shipmentsCount} відправлень
                        </div>
                      </td>
                      <td className="px-4 py-4 font-medium text-zinc-100">{formatMoney(order.total, order.currency)}</td>
                      <td className="px-4 py-4">
                        {order.latestEvent ? (
                          <div className="max-w-[180px]">
                            <div className="text-xs font-medium text-zinc-300">{statusLabel(order.latestEvent.toStatus)}</div>
                            <div className="mt-1 truncate text-xs text-zinc-500">{order.latestEvent.note || 'Зміна статусу'}</div>
                            <div className="mt-1 text-[11px] text-zinc-600">{new Date(order.latestEvent.createdAt).toLocaleDateString()}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-600">Немає історії</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs text-zinc-500">{new Date(order.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={() => setQuickViewId(order.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/25 bg-blue-500/[0.08] px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-blue-300 transition hover:border-blue-500/40 hover:bg-blue-500/[0.12]"
                            title="Швидкий перегляд (без переходу)"
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            Швидкий перегляд
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveOrderId((current) => (current === order.id ? null : order.id))}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-200 transition hover:border-white/15 hover:bg-white/[0.06]"
                          >
                            Робоча панель
                            <ChevronRight className={`h-3.5 w-3.5 transition ${activeOrderId === order.id ? 'rotate-90' : ''}`} aria-hidden="true" />
                          </button>
                          <Link
                            href={`/admin/shop/orders/${order.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-200 transition hover:border-white/15 hover:bg-white/[0.06]"
                          >
                            Детально
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                    {activeOrderId === order.id ? (
                      <tr>
                        <td colSpan={9} className="bg-black/20 px-4 py-5">
                          {activeOrderLoading ? (
                            <div className="rounded-[6px] border border-white/10 bg-[#171717] px-4 py-6 text-sm text-zinc-400">
                              Завантаження робочої панелі замовлення…
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
        </>
      )}

      {/* Quick-view slide-over */}
      <OrderQuickView
        order={visibleOrders.find((o) => o.id === quickViewId) ?? null}
        open={quickViewId !== null}
        onClose={() => setQuickViewId(null)}
        formatMoney={formatMoney}
      />
    </AdminPage>
  );
}

function OrderQuickView({
  order,
  open,
  onClose,
  formatMoney,
}: {
  order: OrderSummary | null;
  open: boolean;
  onClose: () => void;
  formatMoney: (value: number, currency: string) => string;
}) {
  return (
    <AdminSlideOver
      open={open}
      onClose={onClose}
      width="md"
      title={order ? `Замовлення ${order.orderNumber}` : 'Замовлення'}
      subtitle={order ? `Створено ${new Date(order.createdAt).toLocaleString('uk-UA')}` : undefined}
      footer={
        order ? (
          <div className="flex items-center justify-between gap-3">
            <Link
              href={`/admin/shop/orders/${order.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 transition hover:text-blue-300"
            >
              Відкрити повне замовлення
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.06]"
            >
              Закрити
            </button>
          </div>
        ) : undefined
      }
    >
      {order ? (
        <div className="space-y-5">
          {/* Status row */}
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge tone={statusTone(order.status)}>{statusLabel(order.status)}</AdminStatusBadge>
            <AdminStatusBadge tone={paymentTone(order.paymentStatus, order.outstandingAmount)}>
              {order.paymentStatus.replace(/_/g, ' ')}
            </AdminStatusBadge>
            <AdminStatusBadge tone={slaTone(statusAgeHours(order), order.status)}>SLA {statusAgeHours(order)}год</AdminStatusBadge>
          </div>

          {/* Customer */}
          <section className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Клієнт</div>
            <div className="rounded-xl border border-white/[0.05] bg-[#171717] p-4">
              <div className="text-base font-semibold text-zinc-50">{order.customerName}</div>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex items-center gap-2 text-zinc-400">
                  <MailIcon className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
                  <span className="truncate">{order.email}</span>
                </div>
                {order.customerGroupSnapshot ? (
                  <div className="flex items-center gap-2 text-zinc-500">
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      {order.customerGroupSnapshot}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {/* Totals */}
          <section className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Фінанси</div>
            <div className="grid grid-cols-3 gap-2">
              <QvStat label="Сума" value={formatMoney(order.total, order.currency)} tone="default" />
              <QvStat label="Сплачено" value={formatMoney(order.amountPaid, order.currency)} tone="success" />
              <QvStat
                label="Залишок"
                value={formatMoney(order.outstandingAmount, order.currency)}
                tone={order.outstandingAmount > 0 ? 'warning' : 'success'}
              />
            </div>
          </section>

          {/* Items + Shipments counts */}
          <section className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.05] bg-[#171717] p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Позицій</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-zinc-50">{order.itemCount}</div>
            </div>
            <div className="rounded-xl border border-white/[0.05] bg-[#171717] p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Відправлень</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-zinc-50">{order.shipmentsCount}</div>
            </div>
          </section>

          {/* Shipping zone & Tax */}
          <section className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Маршрутизація</div>
            <div className="space-y-1.5 text-sm">
              <QvRow label="Зона доставки" value={order.shippingZoneName ?? '—'} />
              <QvRow label="Податковий регіон" value={order.taxRegionName ?? '—'} />
            </div>
          </section>

          {/* Latest event */}
          {order.latestEvent ? (
            <section className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Остання активність</div>
              <div className="rounded-xl border border-white/[0.05] bg-[#171717] p-4">
                <div className="flex items-center gap-2">
                  <AdminStatusBadge tone={statusTone(order.latestEvent.toStatus)}>
                    {statusLabel(order.latestEvent.toStatus)}
                  </AdminStatusBadge>
                  <span className="text-[11px] text-zinc-500">
                    {new Date(order.latestEvent.createdAt).toLocaleString('uk-UA')}
                  </span>
                </div>
                {order.latestEvent.note ? (
                  <p className="mt-2 text-sm leading-6 text-zinc-300">{order.latestEvent.note}</p>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* Allowed transitions */}
          {order.allowedTransitions.length > 0 ? (
            <section className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Доступні переходи</div>
              <div className="flex flex-wrap gap-1.5">
                {order.allowedTransitions.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-blue-500/25 bg-blue-500/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-blue-300"
                  >
                    {statusLabel(t)}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </AdminSlideOver>
  );
}

function QvStat({ label, value, tone }: { label: string; value: string; tone: 'default' | 'success' | 'warning' | 'danger' }) {
  const cls =
    tone === 'success'
      ? 'border-green-500/20 bg-green-500/[0.05]'
      : tone === 'warning'
        ? 'border-amber-500/20 bg-amber-500/[0.05]'
        : tone === 'danger'
          ? 'border-red-500/20 bg-red-500/[0.05]'
          : 'border-white/[0.05] bg-[#171717]';
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 truncate text-base font-semibold tabular-nums text-zinc-50">{value}</div>
    </div>
  );
}

function QvRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.04] bg-black/25 px-3 py-2">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="truncate text-sm font-medium text-zinc-200">{value}</span>
    </div>
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
          <section key={status} className="min-h-[240px] rounded-[6px] border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-zinc-100">{statusLabel(status)}</div>
                <div className="text-xs text-zinc-500">{columnOrders.length} замовлень</div>
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
                    className={`w-full rounded-[6px] border p-3 text-left transition ${
                      activeOrderId === order.id
                        ? 'border-blue-500/25 bg-blue-500/[0.08]'
                        : 'border-white/10 bg-black/25 hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-mono text-xs font-semibold text-zinc-100">{order.orderNumber}</div>
                        <div className="mt-1 truncate text-sm text-zinc-200">{order.customerName}</div>
                        <div className="mt-1 truncate text-xs text-zinc-500">{order.email}</div>
                      </div>
                      <AdminStatusBadge tone={slaTone(hours, order.status)}>SLA {hours}год</AdminStatusBadge>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-zinc-500">{order.itemCount} позицій · {order.shipmentsCount} відправлень</span>
                      <span className={order.outstandingAmount > 0 ? 'text-amber-200' : 'text-emerald-300'}>
                        {formatMoney(order.outstandingAmount, order.currency)}
                      </span>
                    </div>
                  </button>
                );
              })}
              {!columnOrders.length ? (
                <div className="rounded-[6px] border border-white/10 bg-black/20 px-3 py-6 text-center text-sm text-zinc-600">
                  Порожньо
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
      <span className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[6px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/20 focus:outline-none"
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
    await patchOrder({ status, note: `Перехід через робочу панель до ${statusLabel(status)}` }, `Замовлення переведено в статус «${statusLabel(status)}».`);
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
      'Оплату та виконання збережено.'
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <AdminActionBar className="bg-[#171717]">
          <div className="min-w-0">
            <div className="font-mono text-sm font-semibold text-zinc-100">{order.orderNumber}</div>
            <div className="mt-1 text-sm text-zinc-400">
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
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10"
              aria-label="Закрити робочу панель замовлення"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </AdminActionBar>

        <AdminMetricGrid className="xl:grid-cols-4">
          <AdminMetricCard label="Підсумок" value={formatMoney(order.subtotal, order.currency)} />
          <AdminMetricCard label="Доставка" value={formatMoney(order.shippingCost, order.currency)} meta={order.shippingZoneName || 'Без зони'} />
          <AdminMetricCard label="Сплачено" value={formatMoney(parseFloat(amountPaid) || 0, order.currency)} />
          <AdminMetricCard label="Залишок" value={formatMoney(outstanding, order.currency)} tone={outstanding > 0 ? 'accent' : 'default'} />
        </AdminMetricGrid>

        <div className="grid gap-4 lg:grid-cols-2">
          <AdminInspectorCard title="Зміна статусу" description="Лише дозволені переходи з поточного статусу замовлення.">
            <div className="flex flex-wrap gap-2">
              {order.allowedTransitions.length ? (
                order.allowedTransitions.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => void updateStatus(status)}
                    disabled={Boolean(statusUpdating || saving)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
                  >
                    {statusUpdating === status ? 'Застосування…' : statusLabel(status)}
                  </button>
                ))
              ) : (
                <div className="text-sm text-zinc-500">Немає доступних переходів з поточного стану.</div>
              )}
            </div>
          </AdminInspectorCard>

          <AdminInspectorCard title="Оплата та доставка" description="Поля, які менеджеру зазвичай потрібні без переходу на детальну сторінку.">
            <div className="grid gap-3 md:grid-cols-2">
              <AdminSelectField
                label="Оплата"
                value={paymentStatus}
                onChange={setPaymentStatus}
                options={[
                  { value: 'UNPAID', label: 'Не оплачено' },
                  { value: 'PARTIALLY_PAID', label: 'Оплачено частково' },
                  { value: 'PAID', label: 'Оплачено повністю' },
                ]}
              />
              <AdminInputField label="Сума сплати" value={amountPaid} onChange={setAmountPaid} type="number" step="0.01" />
              <AdminSelectField
                label="Доставка"
                value={deliveryMethod}
                onChange={setDeliveryMethod}
                options={[
                  { value: '', label: 'Не обрано' },
                  { value: 'NOVA_POSHTA', label: 'Нова Пошта' },
                  { value: 'SPECIAL_DELIVERY', label: 'Спецдоставка' },
                  { value: 'PICKUP', label: 'Самовивіз' },
                ]}
              />
              <AdminInputField label="ТТН" value={ttnNumber} onChange={setTtnNumber} />
              <AdminInputField label="Вартість доставки (override)" value={shippingCalculatedCost} onChange={setShippingCalculatedCost} type="number" step="0.01" />
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => void savePaymentAndFulfillment()}
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Збереження…' : 'Зберегти'}
                </button>
              </div>
            </div>
          </AdminInspectorCard>
        </div>

        <AdminTableShell>
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-sm font-medium text-zinc-100">Позиції</h2>
            <p className="mt-1 text-xs text-zinc-500">Склад замовлення та суми по рядках.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  <th className="px-4 py-4 font-medium">Позиція</th>
                  <th className="px-4 py-4 font-medium">SKU</th>
                  <th className="px-4 py-4 font-medium">К-сть</th>
                  <th className="px-4 py-4 font-medium">Ціна</th>
                  <th className="px-4 py-4 font-medium">Сума</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {order.items.map((item) => (
                  <tr key={item.id} className="transition hover:bg-white/[0.03]">
                    <td className="px-4 py-4">
                      <div className="font-medium text-zinc-100">{item.title}</div>
                      <div className="mt-1 text-xs text-zinc-500">{item.brand || item.productSlug}</div>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-zinc-400">{item.sku || item.productSlug || '-'}</td>
                    <td className="px-4 py-4 text-zinc-300">{item.quantity}</td>
                    <td className="px-4 py-4 text-zinc-300">{formatMoney(item.price, order.currency)}</td>
                    <td className="px-4 py-4 font-medium text-zinc-100">{formatMoney(item.total, order.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminTableShell>
      </div>

      <aside className="space-y-4">
        <AdminInspectorCard title="Зведення замовлення" description="Клієнт, суми та маршрутизація.">
          <AdminKeyValueGrid
            rows={[
              { label: 'Клієнт', value: order.customerName },
              { label: 'Телефон', value: order.phone || '-' },
              { label: 'Група', value: order.customerGroupSnapshot || '-' },
              { label: 'Сума', value: formatMoney(order.total, order.currency) },
              { label: 'Оновлено', value: new Date(order.updatedAt).toLocaleString() },
            ]}
          />
        </AdminInspectorCard>

        <AdminInspectorCard title="Відправлення" description="Поточні записи відправлень для цього замовлення.">
          {order.shipments.length ? (
            <div className="space-y-3">
              {order.shipments.map((shipment) => (
                <div key={shipment.id} className="rounded-[6px] border border-white/10 bg-black/25 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-zinc-100">{shipment.trackingNumber}</div>
                    <AdminStatusBadge tone={shipment.status === 'DELIVERED' ? 'success' : shipment.status === 'CANCELLED' ? 'danger' : 'warning'}>
                      {shipment.status.replace(/_/g, ' ')}
                    </AdminStatusBadge>
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    {shipment.carrier}
                    {shipment.serviceLevel ? ` · ${shipment.serviceLevel}` : ''}
                  </div>
                  {shipment.trackingUrl ? (
                    <a href={shipment.trackingUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-blue-300 hover:text-blue-300">
                      Посилання для трекінгу
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[6px] border border-dashed border-white/10 px-4 py-8 text-sm text-zinc-500">
              Записів про відправлення поки немає.
            </div>
          )}
        </AdminInspectorCard>

        <AdminInspectorCard title="Остання історія" description="Останні події замовлення.">
          <div className="space-y-3">
            {order.events.slice(0, 4).map((event) => (
              <div key={event.id} className="rounded-[6px] border border-white/10 bg-black/25 px-3 py-3">
                <div className="text-sm font-medium text-zinc-100">
                  {event.fromStatus ? `${statusLabel(event.fromStatus)} -> ` : ''}
                  {statusLabel(event.toStatus)}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {event.actorName || event.actorType} · {new Date(event.createdAt).toLocaleString()}
                </div>
                {event.note ? <div className="mt-2 text-sm text-zinc-300">{event.note}</div> : null}
              </div>
            ))}
          </div>
        </AdminInspectorCard>
      </aside>
    </div>
  );
}
