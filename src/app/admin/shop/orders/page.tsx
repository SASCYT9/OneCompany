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
  'PENDING_REVIEW',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING_REVIEW', label: 'Pending review' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'REFUNDED', label: 'Refunded' },
] as const;

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ').toLowerCase();
}

function statusBadgeClass(status: string) {
  switch (status) {
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
          setError(data.error || 'Failed to load orders');
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
        `Updated ${data.updatedCount ?? 0} orders to ${statusLabel(String(data.status ?? bulkStatus))}.`
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
        Loading orders…
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Orders</h2>
            <p className="mt-2 text-sm text-white/45">
              Operational queue for review, fulfillment and delivery. Filters and bulk actions apply to the current result set.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setReloadKey((current) => current + 1)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
            <Link
              href="/admin/shop/audit"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700"
            >
              <FileClock className="h-4 w-4" />
              Audit
            </Link>
            <Link href="/admin/shop" className="text-sm text-white/60 hover:text-white">
              ← Shop products
            </Link>
          </div>
        </div>

        <div className="mb-4 grid gap-4 md:grid-cols-4">
          <SummaryCard label="Visible orders" value={String(stats.total)} detail={`${selectedIds.length} selected`} />
          <SummaryCard label="Pending review" value={String(stats.statusCounts.PENDING_REVIEW || 0)} detail="Needs confirmation" />
          <SummaryCard label="Processing" value={String(stats.statusCounts.PROCESSING || 0)} detail="Active fulfillment" />
          <SummaryCard label="Shipped" value={String(stats.statusCounts.SHIPPED || 0)} detail="In transit" />
        </div>

        <div className="mb-4 grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-5">
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white md:col-span-2">
            <Search className="h-4 w-4 text-white/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by order number, customer or email"
              className="w-full bg-transparent text-white placeholder:text-white/25 focus:outline-none"
            />
          </label>
          <SelectField label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label }))} />
          <SelectField
            label="Currency"
            value={currency}
            onChange={setCurrency}
            options={[
              { value: '', label: 'All currencies' },
              ...filterOptions.currencies.map((option) => ({
                value: option.value,
                label: `${option.label} (${option.count})`,
              })),
            ]}
          />
          <SelectField
            label="Shipping zone"
            value={shippingZone}
            onChange={setShippingZone}
            options={[
              { value: '', label: 'All shipping zones' },
              ...filterOptions.shippingZones.map((option) => ({
                value: option.value,
                label: `${option.label} (${option.count})`,
              })),
            ]}
          />
          <div className="md:col-span-5">
            <SelectField
              label="Tax rule"
              value={taxRegion}
              onChange={setTaxRegion}
              options={[
                { value: '', label: 'All tax rules' },
                ...filterOptions.taxRegions.map((option) => ({
                  value: option.value,
                  label: `${option.label} (${option.count})`,
                })),
              ]}
            />
          </div>
        </div>

        {selectedOrders.length ? (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-white/75">
                {selectedOrders.length} selected · {selectedOrders.map((order) => order.orderNumber).join(', ')}
              </div>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-xs text-white/45 hover:text-white"
              >
                Clear selection
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-[220px_1fr_auto]">
              <SelectField
                label="Bulk status"
                value={bulkStatus}
                onChange={setBulkStatus}
                options={[
                  { value: '', label: 'Choose status' },
                  ...commonBulkStatuses.map((candidate) => ({
                    value: candidate,
                    label: statusLabel(candidate),
                  })),
                ]}
              />
              <label className="block">
                <span className="mb-1.5 block text-xs text-white/50">Timeline note</span>
                <input
                  value={bulkNote}
                  onChange={(event) => setBulkNote(event.target.value)}
                  placeholder="Optional note for all selected orders"
                  className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleBulkUpdate}
                  disabled={!bulkStatus || !selectedIds.length || bulkUpdating}
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50"
                >
                  <ShoppingCart className="h-4 w-4" />
                  {bulkUpdating ? 'Applying…' : 'Apply bulk update'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {error ? <div className="mb-4 rounded-lg bg-red-900/20 p-3 text-sm text-red-300">{error}</div> : null}
        {success ? <div className="mb-4 rounded-lg bg-green-900/20 p-3 text-sm text-green-200">{success}</div> : null}

        {orders.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-center text-white/50">
            No orders found for the current filters.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={orders.length > 0 && selectedIds.length === orders.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-white/20 bg-zinc-950"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium text-white/60">Order</th>
                  <th className="px-4 py-3 font-medium text-white/60">Status</th>
                  <th className="px-4 py-3 font-medium text-white/60">Operations</th>
                  <th className="px-4 py-3 font-medium text-white/60">Total</th>
                  <th className="px-4 py-3 font-medium text-white/60">Created</th>
                  <th className="px-4 py-3 font-medium text-white/60">Open</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-white/5 align-top hover:bg-white/[0.03]">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(order.id)}
                        onChange={() => toggleSelected(order.id)}
                        className="h-4 w-4 rounded border-white/20 bg-zinc-950"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-mono text-sm text-white">{order.orderNumber}</div>
                      <div className="mt-1 text-white/75">{order.customerName}</div>
                      <div className="mt-1 text-xs text-white/45">{order.email}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs capitalize ${statusBadgeClass(order.status)}`}>
                        {statusLabel(order.status)}
                      </span>
                      <div className="mt-2 text-xs text-white/45">
                        {order.allowedTransitions.length
                          ? `Next: ${order.allowedTransitions.map(statusLabel).join(', ')}`
                          : 'No further transitions'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-white/80">
                        {order.shippingZoneName || 'No shipping zone'}
                      </div>
                      <div className="mt-1 text-xs text-white/45">
                        {order.taxRegionName || 'No tax rule'}
                      </div>
                      <div className="mt-1 text-xs text-white/45">
                        {order.itemCount} item{order.itemCount !== 1 ? 's' : ''} · {order.shipmentsCount} shipments · {order.timelineCount} events
                      </div>
                    </td>
                    <td className="px-4 py-4 text-white/80">
                      {formatMoney(order.total, order.currency)}
                    </td>
                    <td className="px-4 py-4 text-white/45">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/admin/shop/orders/${order.id}`}
                        className="inline-flex items-center gap-2 rounded border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
                      >
                        Open
                        <ChevronRight className="h-4 w-4 text-white/40" />
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
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-white/40">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-sm text-white/45">{detail}</div>
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
      <span className="mb-1.5 block text-xs text-white/50">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
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
