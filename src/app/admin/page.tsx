'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import {
  Loader2,
  RefreshCw,
} from 'lucide-react';

import {
  AdminActionBar,
  AdminBarList,
  AdminDashboardSection,
  AdminEmptyState,
  AdminFunnelChart,
  AdminInlineAlert,
  AdminInsightPanel,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminQuickActionCard,
  AdminQuickActionGrid,
  AdminStatusBadge,
  AdminTimelineList,
  AdminTrendChart,
} from '@/components/admin/AdminPrimitives';
import { useAdminCurrency } from '@/lib/admin/currencyContext';

type RevenuePeriod = 'monthly' | 'weekly' | 'daily';

type DashboardResponse = {
  shop: {
    totalRevenue: number;
    totalInvoiced: number;
    activeOrders: number;
    totalCustomers: number;
    aov: number;
    totalOrders: number;
    recentOrders: Array<{
      id: string;
      displayId: string;
      total: number;
      currency: string;
      status: string;
      paymentStatus: string;
      createdAt: string;
      customerName: string;
    }>;
    topProducts: Array<{
      title: string;
      revenue: number;
      quantity: number;
      orderCount: number;
    }>;
    conversionFunnel: Array<{
      status: string;
      count: number;
    }>;
    monthlyRevenue: Array<{
      month: string;
      revenue: number;
      paid: number;
      orders: number;
    }>;
    paymentMethods: Array<{
      method: string;
      count: number;
      revenue: number;
    }>;
    lowStockItems: Array<{
      id: string;
      sku: string;
      title: string;
      brand: string;
      stock: number;
    }>;
  };
  crm: {
    totalRevenue: number;
    totalProfit: number;
    totalCustomers: number;
    totalOrders: number;
    activeOrders: number;
    totalDebt: number;
    recentOrders: Array<{
      id: string;
      number: number;
      orderStatus: string;
      clientTotal: number;
      profit: number;
      orderDate: string | null;
      customerName: string;
    }>;
    topCustomers: Array<{
      id: string;
      name: string;
      totalSales: number;
      totalProfit: number;
      balance: number;
      orderCount: number;
    }>;
    statusDistribution: Array<{
      status: string;
      count: number;
    }>;
    monthlyRevenue: Array<{
      month: string;
      revenue: number;
      profit: number;
      orders: number;
    }>;
    brandBreakdown: Array<{
      brand: string;
      revenue: number;
      profit: number;
      count: number;
    }>;
    debtors: Array<{
      id: string;
      name: string;
      balance: number;
      totalSales: number;
    }>;
  };
  system: {
    turn14Stats: {
      total: number;
      syncing: number;
      idle: number;
      latestSync: string | null;
    };
    lastCrmSyncAt: string | null;
    dataQuality: {
      ordersWithoutCustomer: number;
      ordersWithZeroTotal: number;
      crmOrdersWithoutDate: number;
      totalShopOrders: number;
      totalCrmOrders: number;
      score: number;
    };
    catalogQuality: {
      score: number;
      totalProducts: number;
      issueProducts: number;
      issueCounts: {
        NO_IMAGE: number;
        NO_UA_TITLE: number;
        NO_EN_TITLE: number;
        NO_PRICE: number;
        INACTIVE_IN_COLLECTION: number;
        ACTIVE_WITHOUT_STOCK: number;
        BAD_SEO: number;
      };
    };
    operationalRisks: Array<{
      id: string;
      label: string;
      count: number;
      severity: 'success' | 'warning' | 'danger';
      href: string;
      description: string;
    }>;
  };
  period: RevenuePeriod;
};

const PERIOD_OPTIONS: Array<{ value: RevenuePeriod; label: string }> = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'daily', label: 'Daily' },
];

const SHOP_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Pending payment',
  PENDING_REVIEW: 'Pending review',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
};

function formatDate(value: string | null) {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDataQualityTone(score: number) {
  if (score >= 90) {
    return 'success' as const;
  }
  if (score >= 75) {
    return 'warning' as const;
  }
  return 'danger' as const;
}

function getOrderStatusTone(status: string) {
  if (status === 'DELIVERED' || status === 'Выполнен') {
    return 'success' as const;
  }
  if (status === 'CANCELLED' || status === 'REFUNDED' || status === 'Отменен') {
    return 'danger' as const;
  }
  if (status === 'PENDING_PAYMENT' || status === 'PENDING_REVIEW' || status === 'PROCESSING' || status === 'SHIPPED') {
    return 'warning' as const;
  }
  return 'default' as const;
}

function statusLabel(status: string) {
  return SHOP_STATUS_LABELS[status] ?? (status || 'Unknown');
}

export default function AdminDashboardPage() {
  const { formatMoney } = useAdminCurrency();
  const [period, setPeriod] = useState<RevenuePeriod>('monthly');
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDashboard = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const response = await fetch(`/api/admin/dashboard?period=${period}`, { cache: 'no-store' });
        const payload = (await response.json().catch(() => ({}))) as DashboardResponse & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load dashboard');
        }

        setData(payload);
        setError(null);
        setLastUpdated(new Date());
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load dashboard');
      } finally {
        if (mode === 'initial') {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [period]
  );

  useEffect(() => {
    void fetchDashboard('initial');

    const timer = window.setInterval(() => {
      void fetchDashboard('refresh');
    }, 60_000);

    return () => window.clearInterval(timer);
  }, [fetchDashboard]);

  const activityItems = useMemo(() => {
    if (!data) {
      return [];
    }

    return [
      ...data.shop.recentOrders.map((order) => ({
        id: `shop-${order.id}`,
        createdAt: order.createdAt,
        title: `Shop ${order.displayId} · ${order.customerName}`,
        meta: `${formatMoney(order.total, 'UAH')} · ${order.status} · ${order.paymentStatus}`,
        body: 'Customer order entered the storefront pipeline.',
        tone: order.paymentStatus === 'UNPAID' ? ('warning' as const) : ('default' as const),
      })),
      ...data.crm.recentOrders.map((order) => ({
        id: `crm-${order.id}`,
        createdAt: order.orderDate ?? new Date(0).toISOString(),
        title: `CRM #${order.number} · ${order.customerName}`,
        meta: `${formatMoney(order.clientTotal, 'USD')} · ${order.orderStatus}`,
        body: `Profit ${formatMoney(order.profit, 'USD')}`,
        tone: order.profit >= 0 ? ('success' as const) : ('warning' as const),
      })),
    ]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 10);
  }, [data, formatMoney]);

  const exceptionItems = useMemo(() => {
    if (!data) {
      return [];
    }

    const items = [];

    for (const product of data.shop.lowStockItems.slice(0, 4)) {
      items.push({
        id: `stock-${product.id}`,
        title: `${product.brand} · ${product.title}`,
        meta: `${product.sku || 'No SKU'} · ${product.stock} left`,
        body: 'Inventory is below the safe threshold for new orders.',
        tone: 'warning' as const,
      });
    }

    for (const debtor of data.crm.debtors.slice(0, 3)) {
      items.push({
        id: `debtor-${debtor.id}`,
        title: debtor.name,
        meta: `${formatMoney(Math.abs(debtor.balance), 'USD')} outstanding`,
        body: `Customer has ${formatMoney(debtor.totalSales, 'USD')} in recorded sales.`,
        tone: 'danger' as const,
      });
    }

    if (data.system.dataQuality.ordersWithoutCustomer > 0 || data.system.dataQuality.ordersWithZeroTotal > 0) {
      items.push({
        id: 'data-quality',
        title: `Data quality score ${data.system.dataQuality.score}%`,
        meta: `Shop gaps ${data.system.dataQuality.ordersWithoutCustomer} · Zero totals ${data.system.dataQuality.ordersWithZeroTotal}`,
        body: 'Catalog and order data need review before the next operational cycle.',
        tone: getDataQualityTone(data.system.dataQuality.score) === 'danger' ? ('danger' as const) : ('warning' as const),
      });
    }

    if (data.system.catalogQuality.issueProducts > 0) {
      items.push({
        id: 'catalog-quality',
        title: `Catalog quality ${data.system.catalogQuality.score}%`,
        meta: `${data.system.catalogQuality.issueProducts} products need review`,
        body: 'Open the quality center to fix images, prices, translations, stock state, and SEO.',
        tone: data.system.catalogQuality.score < 75 ? ('danger' as const) : ('warning' as const),
      });
    }

    if (data.system.turn14Stats.syncing > 0) {
      items.push({
        id: 'turn14-sync',
        title: `Turn14 sync in progress`,
        meta: `${data.system.turn14Stats.syncing} brands syncing`,
        body: `Latest sync ${formatDate(data.system.turn14Stats.latestSync)}`,
        tone: 'warning' as const,
      });
    }

    return items;
  }, [data, formatMoney]);

  const shopRevenueTrend = useMemo(
    () =>
      data?.shop.monthlyRevenue.map((entry) => ({
        label: entry.month,
        value: entry.revenue,
        secondaryValue: entry.paid,
      })) ?? [],
    [data]
  );

  const crmRevenueTrend = useMemo(
    () =>
      data?.crm.monthlyRevenue.map((entry) => ({
        label: entry.month,
        value: entry.revenue,
        secondaryValue: entry.profit,
      })) ?? [],
    [data]
  );

  const shopFunnel = useMemo(
    () =>
      data?.shop.conversionFunnel.map((entry) => ({
        label: statusLabel(entry.status),
        value: entry.count,
        tone: getOrderStatusTone(entry.status),
      })) ?? [],
    [data]
  );

  const crmStatuses = useMemo(
    () =>
      data?.crm.statusDistribution.map((entry) => ({
        label: entry.status || 'Unknown',
        value: entry.count,
        tone: getOrderStatusTone(entry.status),
      })) ?? [],
    [data]
  );

  if (loading && !data) {
    return (
      <AdminPage>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-stone-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading control layer…
          </div>
        </div>
      </AdminPage>
    );
  }

  if (!data) {
    return (
      <AdminPage>
        <AdminEmptyState
          title="Dashboard is unavailable"
          description={error || 'The control layer could not load current business telemetry.'}
          action={
            <button
              type="button"
              onClick={() => void fetchDashboard('initial')}
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-stone-200 transition hover:bg-white/[0.06]"
            >
              Retry
            </button>
          }
        />
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Overview"
        title="Company control layer"
        description="Company-wide commerce pulse for shop, CRM, and systems. Exceptions, revenue posture, and operational shortcuts live in one screen."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge tone={getDataQualityTone(data.system.dataQuality.score)}>
              Data quality {data.system.dataQuality.score}%
            </AdminStatusBadge>
            <AdminStatusBadge tone={data.system.turn14Stats.syncing > 0 ? 'warning' : 'success'}>
              Turn14 {data.system.turn14Stats.syncing > 0 ? 'syncing' : 'stable'}
            </AdminStatusBadge>
          </div>
        }
      />

      <AdminActionBar>
        <div className="flex flex-wrap items-center gap-2">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPeriod(option.value)}
              className={`rounded-full border px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] transition ${
                period === option.value
                  ? 'border-amber-100/15 bg-amber-100/[0.06] text-amber-100'
                  : 'border-white/10 bg-white/[0.02] text-stone-400 hover:text-stone-100'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
          <span>Last refresh {lastUpdated ? formatDate(lastUpdated.toISOString()) : '—'}</span>
          <button
            type="button"
            onClick={() => void fetchDashboard('refresh')}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs uppercase tracking-[0.18em] text-stone-300 transition hover:text-stone-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </AdminActionBar>

      {error ? <AdminInlineAlert tone="warning">{error}</AdminInlineAlert> : null}

      <AdminMetricGrid className="xl:grid-cols-4">
        <AdminMetricCard label="Shop revenue" value={formatMoney(data.shop.totalRevenue, 'UAH')} meta={`Invoiced ${formatMoney(data.shop.totalInvoiced, 'UAH')}`} tone="accent" />
        <AdminMetricCard label="Shop orders" value={data.shop.activeOrders.toString()} meta={`${data.shop.totalOrders} total · AOV ${formatMoney(data.shop.aov, 'UAH')}`} />
        <AdminMetricCard label="CRM profit" value={formatMoney(data.crm.totalProfit, 'USD')} meta={`Revenue ${formatMoney(data.crm.totalRevenue, 'USD')}`} tone="accent" />
        <AdminMetricCard label="CRM debt" value={formatMoney(data.crm.totalDebt, 'USD')} meta={`${data.crm.activeOrders} active CRM orders`} />
        <AdminMetricCard label="Shop customers" value={data.shop.totalCustomers.toString()} meta="Storefront customer accounts" />
        <AdminMetricCard label="CRM customers" value={data.crm.totalCustomers.toString()} meta="Tracked CRM relationships" />
        <AdminMetricCard label="Turn14 brands" value={data.system.turn14Stats.total.toString()} meta={`${data.system.turn14Stats.syncing} syncing now`} />
        <AdminMetricCard label="System quality" value={`${data.system.dataQuality.score}%`} meta={`Last CRM sync ${formatDate(data.system.lastCrmSyncAt)}`} />
      </AdminMetricGrid>

      <AdminDashboardSection
        title="Revenue and order shape"
        description="Trend and distribution views from the selected period, using shop and CRM telemetry already collected by the dashboard API."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <AdminInsightPanel title="Shop revenue trend" description="Invoiced revenue against actual paid amount in the selected period.">
            <AdminTrendChart
              data={shopRevenueTrend}
              valueLabel="Invoiced"
              secondaryLabel="Paid"
            />
          </AdminInsightPanel>

          <AdminInsightPanel title="CRM revenue trend" description="Client revenue against CRM profit in the selected period.">
            <AdminTrendChart
              data={crmRevenueTrend}
              valueLabel="Revenue"
              secondaryLabel="Profit"
            />
          </AdminInsightPanel>
        </div>
      </AdminDashboardSection>

      <AdminDashboardSection
        title="Operational distribution"
        description="Readable status and source mix for daily triage."
      >
        <div className="grid gap-4 xl:grid-cols-4">
          <AdminInsightPanel title="Shop funnel" description="Storefront order states." className="xl:col-span-1">
            <AdminFunnelChart data={shopFunnel} />
          </AdminInsightPanel>

          <AdminInsightPanel title="Payment mix" description="Shop payment methods by captured revenue." className="xl:col-span-1">
            <AdminBarList
              data={data.shop.paymentMethods.map((entry) => ({
                label: entry.method || 'Unknown',
                value: entry.revenue,
                meta: `${entry.count} orders`,
                tone: 'accent' as const,
              }))}
              valueFormatter={(value) => formatMoney(value, 'UAH')}
            />
          </AdminInsightPanel>

          <AdminInsightPanel title="CRM statuses" description="Airtable CRM order status split." className="xl:col-span-1">
            <AdminFunnelChart data={crmStatuses} />
          </AdminInsightPanel>

          <AdminInsightPanel title="CRM brands" description="Top revenue contributors extracted from CRM items." className="xl:col-span-1">
            <AdminBarList
              data={data.crm.brandBreakdown.slice(0, 6).map((entry) => ({
                label: entry.brand,
                value: entry.revenue,
                meta: `${entry.count} items · Profit ${formatMoney(entry.profit, 'USD')}`,
                tone: entry.profit >= 0 ? ('success' as const) : ('warning' as const),
              }))}
              valueFormatter={(value) => formatMoney(value, 'USD')}
            />
          </AdminInsightPanel>
        </div>
      </AdminDashboardSection>

      <AdminDashboardSection
        title="Top operational risks"
        description="Actionable admin queue for payment, catalog, imports, and B2B approvals."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {data.system.operationalRisks.map((risk) => (
            <Link
              key={risk.id}
              href={risk.href}
              className="rounded-[24px] border border-white/10 bg-[#101010] px-4 py-4 transition hover:border-amber-100/20 hover:bg-amber-100/[0.04]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-stone-100">{risk.label}</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-stone-50">{risk.count}</div>
                </div>
                <AdminStatusBadge tone={risk.severity}>{risk.severity}</AdminStatusBadge>
              </div>
              <div className="mt-3 text-xs leading-5 text-stone-500">{risk.description}</div>
            </Link>
          ))}
        </div>
      </AdminDashboardSection>

      <AdminDashboardSection
        title="Exceptions"
        description="What needs attention before the next operational pass."
      >
        <div className="grid gap-4 xl:grid-cols-3">
          <AdminInsightPanel
            title="Low-stock pressure"
            description="Storefront items that are below the safe inventory threshold."
            tone="warning"
          >
            <AdminTimelineList
              items={data.shop.lowStockItems.slice(0, 5).map((item) => ({
                id: item.id,
                title: `${item.brand} · ${item.title}`,
                meta: `${item.sku || 'No SKU'} · ${item.stock} left`,
                body: 'Restock or review publish state before the next campaign.',
                tone: 'warning' as const,
              }))}
              empty="No low-stock items currently require action."
            />
          </AdminInsightPanel>

          <AdminInsightPanel
            title="Receivables watch"
            description="Customers with the largest outstanding CRM balances."
            tone="warning"
          >
            <AdminTimelineList
              items={data.crm.debtors.slice(0, 5).map((debtor) => ({
                id: debtor.id,
                title: debtor.name,
                meta: `${formatMoney(Math.abs(debtor.balance), 'USD')} outstanding`,
                body: `Total sales ${formatMoney(debtor.totalSales, 'USD')}`,
                tone: 'danger' as const,
              }))}
              empty="No debtor alerts are open."
            />
          </AdminInsightPanel>

          <AdminInsightPanel
            title="System posture"
            description="Data quality, sync health, and internal exceptions."
            tone={data.system.dataQuality.score >= 90 ? 'success' : 'warning'}
          >
            <AdminTimelineList
              items={exceptionItems}
              empty="No system or data quality exceptions are open."
            />
          </AdminInsightPanel>
        </div>
      </AdminDashboardSection>

      <AdminDashboardSection
        title="Recent activity"
        description="Latest storefront orders and CRM movement in a single operational feed."
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
          <AdminInsightPanel title="Unified activity feed" description="Most recent order activity across shop and CRM.">
            <AdminTimelineList
              items={activityItems}
              empty="No recent shop or CRM activity is available."
            />
          </AdminInsightPanel>

          <div className="space-y-4">
            <AdminInsightPanel title="Top products" description="Highest storefront revenue contributors in the selected period.">
              <div className="space-y-3">
                {data.shop.topProducts.slice(0, 5).map((product, index) => (
                  <div key={`${product.title}-${index}`} className="rounded-2xl border border-white/8 bg-black/25 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-stone-100">{product.title}</div>
                        <div className="mt-1 text-xs text-stone-500">
                          {product.quantity} units · {product.orderCount} orders
                        </div>
                      </div>
                      <div className="text-sm font-medium text-stone-200">{formatMoney(product.revenue, 'UAH')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </AdminInsightPanel>

            <AdminInsightPanel title="Top customers" description="CRM relationships with the strongest revenue profile.">
              <div className="space-y-3">
                {data.crm.topCustomers.slice(0, 5).map((customer) => (
                  <div key={customer.id} className="rounded-2xl border border-white/8 bg-black/25 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-stone-100">{customer.name}</div>
                        <div className="mt-1 text-xs text-stone-500">
                          {customer.orderCount} orders · Profit {formatMoney(customer.totalProfit, 'USD')}
                        </div>
                      </div>
                      <div className="text-sm font-medium text-stone-200">{formatMoney(customer.totalSales, 'USD')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </AdminInsightPanel>
          </div>
        </div>
      </AdminDashboardSection>

      <AdminDashboardSection
        title="Quick actions"
        description="Direct paths into daily order, customer, import, and recovery workflows."
      >
        <AdminQuickActionGrid>
          <AdminQuickActionCard
            href="/admin/shop/orders"
            eyebrow="Orders"
            title="Order center"
            description="Review current storefront orders, payment posture, and shipment flow."
          />
          <AdminQuickActionCard
            href="/admin/shop/customers"
            eyebrow="Customers"
            title="Customer workbench"
            description="Inspect approvals, account health, pricing context, and recent customer activity."
          />
          <AdminQuickActionCard
            href="/admin/shop/import"
            eyebrow="Imports"
            title="Import center"
            description="Run dry-runs, inspect job history, and validate catalog template commits."
          />
          <AdminQuickActionCard
            href="/admin/shop/turn14"
            eyebrow="Supplier"
            title="Turn14 workspace"
            description="Search supplier inventory, sync brands, and manage markups without leaving the ops shell."
          />
          <AdminQuickActionCard
            href="/admin/backups"
            eyebrow="Recovery"
            title="Backups"
            description="Check runtime policy, create local dumps, and verify recovery posture."
          />
          <AdminQuickActionCard
            href="/admin/settings"
            eyebrow="System"
            title="Global settings"
            description="Adjust business defaults, SEO, security, and UI configuration in one structured shell."
          />
        </AdminQuickActionGrid>
      </AdminDashboardSection>
    </AdminPage>
  );
}
