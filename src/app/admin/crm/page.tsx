'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';

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

type CrmCustomer = {
  id: string;
  name: string;
  email: string | null;
  businessName: string | null;
  balance: number;
  whoOwes: string;
  totalSales: number;
  orderCount: number;
};

type CrmOrder = {
  id: string;
  number: number;
  name: string;
  orderStatus: string;
  paymentStatus: string;
  totalAmount: number;
  clientTotal: number;
  profit: number;
  marginality: number;
  orderDate: string | null;
  tag: string;
  itemCount: number;
  customerIds: string[];
  calculatedB2bTotal?: number;
};

type CrmDbAnalytics = {
  kpis: {
    totalCustomers: number;
    totalOrders: number;
    totalItems: number;
    totalRevenue: number;
    totalProfit: number;
    avgMargin: number;
  };
  lastSyncAt: string | null;
} | null;

const AUTO_REFRESH_INTERVAL = 30_000;

function fmtUsd(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getOrderStatusTone(status: string) {
  if (status === 'Выполнен') return 'success' as const;
  if (status === 'Отменен') return 'danger' as const;
  if (status === 'В обработке' || status === 'В производстве' || status === 'В пути') {
    return 'warning' as const;
  }
  return 'default' as const;
}

function getPaymentTone(status: string) {
  return status === 'Оплачено' ? ('success' as const) : ('warning' as const);
}

export default function CrmDashboardPage() {
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [orders, setOrders] = useState<CrmOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'orders'>('overview');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [dbAnalytics, setDbAnalytics] = useState<CrmDbAnalytics>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async (isFirstLoad = false) => {
    if (isFirstLoad) {
      setLoading(true);
    }

    try {
      const [customerResponse, orderResponse] = await Promise.all([
        fetch('/api/admin/crm/link-customer').then((response) => response.json()),
        fetch('/api/admin/crm?type=orders&maxRecords=100').then((response) => response.json()),
      ]);

      const clientList: CrmCustomer[] = customerResponse.data || [];
      const clientIds = new Set(clientList.map((customer) => customer.id));
      const allOrders: CrmOrder[] = orderResponse.data || [];

      setCustomers(clientList);
      setOrders(
        allOrders.filter((order) => {
          if (!order.customerIds?.length) {
            return false;
          }
          return order.customerIds.some((customerId) => clientIds.has(customerId));
        })
      );
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch CRM data:', error);
    } finally {
      if (isFirstLoad) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchData(true);

    intervalRef.current = setInterval(() => {
      void fetchData(false);
    }, AUTO_REFRESH_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData]);

  useEffect(() => {
    void fetch('/api/webhooks/airtable', {
      method: 'POST',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {});

    void fetch('/api/admin/crm/analytics?type=dashboard')
      .then((response) => response.json())
      .then((data) => setDbAnalytics(data))
      .catch(() => {});
  }, []);

  const handleFullSync = async () => {
    setSyncing(true);
    setSyncResult(null);

    try {
      const response = await fetch('/api/admin/crm/full-sync', { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      setSyncResult(
        `✓ Синхронізовано: ${data.customers?.synced || 0} клієнтів, ${data.orders?.synced || 0} замовлень`
      );

      void fetch('/api/admin/crm/analytics?type=dashboard')
        .then((analyticsResponse) => analyticsResponse.json())
        .then(setDbAnalytics)
        .catch(() => {});

      await fetchData(false);
    } catch (error) {
      setSyncResult(`✗ ${(error as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  const totalRevenue = useMemo(
    () => orders.reduce((sum, order) => sum + (order.clientTotal || 0), 0),
    [orders]
  );
  const totalProfit = useMemo(
    () => orders.reduce((sum, order) => sum + (order.profit || 0), 0),
    [orders]
  );
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const activeOrders = useMemo(
    () => orders.filter((order) => !['Выполнен', 'Отменен'].includes(order.orderStatus)).length,
    [orders]
  );
  const paidOrders = useMemo(
    () => orders.filter((order) => order.paymentStatus === 'Оплачено').length,
    [orders]
  );
  const unpaidOrders = orders.length - paidOrders;

  const topCustomers = useMemo(
    () => [...customers].sort((left, right) => right.totalSales - left.totalSales).slice(0, 8),
    [customers]
  );
  const recentOrders = useMemo(
    () => [...orders].sort((left, right) => (right.orderDate || '').localeCompare(left.orderDate || '')).slice(0, 10),
    [orders]
  );

  const filteredCustomers = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) {
      return customers;
    }

    return customers.filter((customer) =>
      [customer.name, customer.email, customer.businessName, customer.whoOwes]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [customers, searchQuery]);

  const filteredOrders = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) {
      return orders;
    }

    return orders.filter((order) =>
      [order.name, order.number, order.orderStatus, order.paymentStatus, order.tag]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [orders, searchQuery]);

  const statusSummary = useMemo(() => {
    const groups = new Map<string, number>();
    for (const order of orders) {
      const status = order.orderStatus || 'Unknown';
      groups.set(status, (groups.get(status) || 0) + 1);
    }
    return Array.from(groups.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((left, right) => right.count - left.count);
  }, [orders]);

  if (loading) {
    return (
      <AdminPage>
        <div className="flex items-center gap-3 rounded-[28px] border border-white/10 bg-[#101010] px-5 py-6 text-sm text-stone-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading CRM dashboard…
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="CRM"
        title="Customer operations"
        description="Linked Airtable customers, order profitability, balances, and manual sync tooling in one operational view."
        actions={
          <>
            <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200">
              LIVE · auto-refresh 30s
            </div>
            <button
              type="button"
              onClick={() => void handleFullSync()}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-2xl bg-stone-100 px-4 py-2.5 text-sm font-medium text-black transition hover:bg-white disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Синхронізація…' : 'Повна синхронізація'}
            </button>
          </>
        }
      />

      {syncResult ? (
        <AdminInlineAlert tone={syncResult.startsWith('✓') ? 'success' : 'error'}>
          {syncResult}
        </AdminInlineAlert>
      ) : null}

      <AdminMetricGrid>
        <AdminMetricCard
          label="Customers"
          value={dbAnalytics?.kpis.totalCustomers ?? customers.length}
          meta={`${customers.length} linked customers in current CRM view`}
          tone="accent"
        />
        <AdminMetricCard
          label="Orders"
          value={dbAnalytics?.kpis.totalOrders ?? orders.length}
          meta={`${activeOrders} active · ${paidOrders} paid`}
        />
        <AdminMetricCard
          label="Revenue"
          value={`$${fmtUsd(dbAnalytics?.kpis.totalRevenue ?? totalRevenue)}`}
          meta={`${orders.length} client orders in the current dataset`}
        />
        <AdminMetricCard
          label="Profit"
          value={`$${fmtUsd(dbAnalytics?.kpis.totalProfit ?? totalProfit)}`}
          meta={`Avg. margin ${((dbAnalytics?.kpis.avgMargin ?? avgMargin) || 0).toFixed(1)}%`}
        />
      </AdminMetricGrid>

      <AdminActionBar className="bg-[#101010]">
        <div className="flex flex-wrap gap-2">
          {([
            ['overview', 'Overview'],
            ['customers', 'Customers'],
            ['orders', 'Orders'],
          ] as const).map(([tabKey, label]) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setActiveTab(tabKey)}
              className={`rounded-2xl border px-4 py-2.5 text-sm transition ${
                activeTab === tabKey
                  ? 'border-white/15 bg-white/[0.08] text-stone-50'
                  : 'border-white/10 bg-white/[0.03] text-stone-400 hover:bg-white/[0.06] hover:text-stone-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="text-right text-xs text-stone-500">
          <div>Last refresh</div>
          <div className="mt-1 text-sm text-stone-300">
            {lastUpdated ? lastUpdated.toLocaleTimeString('uk-UA') : '—'}
          </div>
        </div>
      </AdminActionBar>

      {activeTab !== 'overview' ? (
        <AdminFilterBar>
          <label className="flex min-w-[280px] flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-stone-100">
            <Search className="h-4 w-4 text-stone-500" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={activeTab === 'customers' ? 'Пошук клієнта…' : 'Пошук замовлення…'}
              className="flex-1 bg-transparent text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none"
            />
          </label>
          <div className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-stone-400">
            {activeTab === 'customers' ? filteredCustomers.length : filteredOrders.length} visible
          </div>
        </AdminFilterBar>
      ) : null}

      {activeTab === 'overview' ? (
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <AdminTableShell>
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-sm font-medium text-stone-100">Recent orders</h2>
              <p className="mt-1 text-xs text-stone-500">Newest linked CRM orders with client totals and profit.</p>
            </div>
            {recentOrders.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <th className="px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-stone-500">Order</th>
                      <th className="px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-stone-500">Status</th>
                      <th className="px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-stone-500">Payment</th>
                      <th className="px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-stone-500 text-right">Revenue</th>
                      <th className="px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-stone-500 text-right">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {recentOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-white/[0.02]">
                        <td className="px-5 py-4">
                          <Link href={`/admin/crm/orders/${order.id}`} className="block">
                            <div className="font-medium text-stone-100">#{order.number}</div>
                            <div className="mt-1 text-xs text-stone-500">{order.name}</div>
                          </Link>
                        </td>
                        <td className="px-5 py-4">
                          <AdminStatusBadge tone={getOrderStatusTone(order.orderStatus)}>
                            {order.orderStatus || '—'}
                          </AdminStatusBadge>
                        </td>
                        <td className="px-5 py-4">
                          <AdminStatusBadge tone={getPaymentTone(order.paymentStatus)}>
                            {order.paymentStatus || '—'}
                          </AdminStatusBadge>
                        </td>
                        <td className="px-5 py-4 text-right font-medium text-stone-200">
                          ${fmtUsd(order.clientTotal)}
                        </td>
                        <td className={`px-5 py-4 text-right font-medium ${order.profit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                          ${fmtUsd(order.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <AdminEmptyState
                className="rounded-none border-0 bg-transparent"
                title="No CRM orders yet"
                description="Once linked orders arrive, they will appear here with profitability and payment state."
              />
            )}
          </AdminTableShell>

          <div className="space-y-6">
            <AdminTableShell>
              <div className="border-b border-white/10 px-5 py-4">
                <h2 className="text-sm font-medium text-stone-100">Top customers</h2>
                <p className="mt-1 text-xs text-stone-500">Customers ranked by total sales in the linked CRM set.</p>
              </div>
              {topCustomers.length ? (
                <div className="divide-y divide-white/[0.04]">
                  {topCustomers.map((customer) => (
                    <Link
                      key={customer.id}
                      href={`/admin/crm/customers/${customer.id}`}
                      className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/[0.02]"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-stone-100">{customer.name}</div>
                        <div className="mt-1 text-xs text-stone-500">
                          {customer.orderCount} orders · {customer.businessName || customer.email || 'No company info'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-stone-200">${fmtUsd(customer.totalSales)}</div>
                        <div className={`mt-1 text-xs ${customer.balance >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                          balance ${fmtUsd(customer.balance)}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <AdminEmptyState
                  className="rounded-none border-0 bg-transparent"
                  title="No linked customers"
                  description="Run the CRM sync to populate customer sales and balance summaries."
                />
              )}
            </AdminTableShell>

            <AdminTableShell>
              <div className="border-b border-white/10 px-5 py-4">
                <h2 className="text-sm font-medium text-stone-100">Operational summary</h2>
                <p className="mt-1 text-xs text-stone-500">Status distribution and payment posture across current CRM orders.</p>
              </div>
              <div className="space-y-5 px-5 py-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Active</div>
                    <div className="mt-2 text-2xl font-semibold text-stone-100">{activeOrders}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Paid</div>
                    <div className="mt-2 text-2xl font-semibold text-emerald-300">{paidOrders}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Pending payment</div>
                    <div className="mt-2 text-2xl font-semibold text-amber-200">{unpaidOrders}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {statusSummary.map((entry) => (
                    <div key={entry.status} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                      <AdminStatusBadge tone={getOrderStatusTone(entry.status)}>{entry.status}</AdminStatusBadge>
                      <span className="text-sm font-medium text-stone-200">{entry.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </AdminTableShell>
          </div>
        </div>
      ) : null}

      {activeTab === 'customers' ? (
        filteredCustomers.length ? (
          <AdminTableShell>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th className="px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-stone-500">Customer</th>
                    <th className="px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-stone-500">Business</th>
                    <th className="px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-stone-500 text-right">Sales</th>
                    <th className="px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-stone-500 text-right">Orders</th>
                    <th className="px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-stone-500 text-right">Balance</th>
                    <th className="px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-stone-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-4">
                        <div className="font-medium text-stone-100">{customer.name}</div>
                        <div className="mt-1 text-xs text-stone-500">{customer.email || 'No email'}</div>
                      </td>
                      <td className="px-5 py-4 text-stone-300">
                        {customer.businessName || '—'}
                      </td>
                      <td className="px-5 py-4 text-right font-medium text-stone-200">
                        ${fmtUsd(customer.totalSales)}
                      </td>
                      <td className="px-5 py-4 text-right text-stone-300">{customer.orderCount}</td>
                      <td className={`px-5 py-4 text-right font-medium ${customer.balance >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                        ${fmtUsd(customer.balance)}
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/admin/crm/customers/${customer.id}`}
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-stone-200 transition hover:bg-white/[0.06]"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminTableShell>
        ) : (
          <AdminEmptyState
            title="No matching customers"
            description="Try a different search term or run CRM sync to bring in linked customer records."
          />
        )
      ) : null}

      {activeTab === 'orders' ? (
        filteredOrders.length ? (
          <AdminTableShell>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th className="px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-stone-500">Order</th>
                    <th className="px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-stone-500">Status</th>
                    <th className="px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-stone-500">Payment</th>
                    <th className="px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-stone-500 text-right">Items</th>
                    <th className="px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-stone-500 text-right">Revenue</th>
                    <th className="px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-stone-500 text-right">Profit</th>
                    <th className="px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-stone-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-4">
                        <div className="font-medium text-stone-100">#{order.number}</div>
                        <div className="mt-1 text-xs text-stone-500">{order.name}</div>
                      </td>
                      <td className="px-5 py-4">
                        <AdminStatusBadge tone={getOrderStatusTone(order.orderStatus)}>
                          {order.orderStatus || '—'}
                        </AdminStatusBadge>
                      </td>
                      <td className="px-5 py-4">
                        <AdminStatusBadge tone={getPaymentTone(order.paymentStatus)}>
                          {order.paymentStatus || '—'}
                        </AdminStatusBadge>
                      </td>
                      <td className="px-5 py-4 text-right text-stone-300">{order.itemCount}</td>
                      <td className="px-5 py-4 text-right font-medium text-stone-200">
                        ${fmtUsd(order.clientTotal)}
                      </td>
                      <td className={`px-5 py-4 text-right font-medium ${order.profit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                        ${fmtUsd(order.profit)}
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/admin/crm/orders/${order.id}`}
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-stone-200 transition hover:bg-white/[0.06]"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminTableShell>
        ) : (
          <AdminEmptyState
            title="No matching orders"
            description="Adjust the search term or sync CRM orders to rebuild the order dataset."
          />
        )
      ) : null}
    </AdminPage>
  );
}
