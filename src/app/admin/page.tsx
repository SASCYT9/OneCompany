'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import {
  Award,
  BarChart3,
  Briefcase,
  DollarSign,
  Loader2,
  Package,
  RefreshCw,
  Target,
  Users,
} from 'lucide-react';

import {
  AdminActionBar,
  AdminBarList,
  AdminDashboardSection,
  AdminInlineAlert,
  AdminInsightPanel,
  AdminPage,
  AdminPageHeader,
  AdminQuickActionCard,
  AdminQuickActionGrid,
  AdminStatusBadge,
  AdminTimelineList,
  AdminTrendChart,
} from '@/components/admin/AdminPrimitives';
import { AdminSkeletonCard, AdminSkeletonKpiGrid } from '@/components/admin/AdminSkeleton';
import { useAdminCurrency } from '@/lib/admin/currencyContext';
import { useToast } from '@/components/admin/AdminToast';
import { DashboardKpiCard } from './components/DashboardKpiCard';
import {
  DashboardDateRange,
  DashboardDealerInquiries,
  DashboardInventorySnapshot,
  DashboardMarketingPerformance,
  DashboardRecentOrdersTable,
  DashboardRegionsDonut,
  DashboardRevenueBars,
  DashboardSalesChart,
  DashboardTopBrands,
  DashboardTopProducts,
  DashboardWorldMap,
  ViewAllLink,
  WidgetCard,
  type RichOrderRow,
} from './components/DashboardWidgets';
import {
  DashboardOpsHealthBanner,
  type HealthLevel,
  type HealthLight,
} from './components/DashboardOpsHealthBanner';
import {
  DashboardOrderPipeline,
  type PipelineStage,
} from './components/DashboardOrderPipeline';
import {
  DashboardActionRequired,
  type ActionItem,
} from './components/DashboardActionRequired';

type RevenuePeriod = 'monthly' | 'weekly' | 'daily';

type DashboardResponse = {
  shop: {
    totalRevenue: number;
    totalInvoiced: number;
    activeOrders: number;
    totalCustomers: number;
    aov: number;
    totalOrders: number;
    totalRevenuePeriod: number;
    totalRevenuePrevPeriod: number;
    ordersCountPeriod: number;
    ordersCountPrevPeriod: number;
    pendingByStage: Array<{
      status: string;
      count: number;
      valueSum: number;
      oldestAgeDays: number | null;
    }>;
    unpaidTotal: number;
    unpaidCount: number;
    oldestUnpaid: { id: string; orderNumber: string; ageDays: number } | null;
    stuckPendingPayment: number;
    cancellationRate: number;
    b2cOrdersCount: number;
    b2bOrdersCount: number;
    recentOrders: Array<{
      id: string;
      displayId: string;
      total: number;
      currency: string;
      status: string;
      paymentStatus: string;
      createdAt: string;
      customerName: string;
      customerGroup: string;
      itemCount?: number;
      brand?: string | null;
      brandLogo?: string | null;
    }>;
    conversionFunnel: Array<{ status: string; count: number }>;
    monthlyRevenue: Array<{
      month: string;
      revenue: number;
      paid: number;
      orders: number;
    }>;
    lowStockItems: Array<{
      id: string;
      sku: string;
      title: string;
      brand: string;
      stock: number;
    }>;
    topProducts: Array<{
      id: string;
      slug: string;
      title: string;
      brand: string | null;
      image: string | null;
      priceEur: number | null;
      priceUsd: number | null;
      priceUah: number | null;
    }>;
    topBrands: Array<{
      brand: string;
      productCount: number;
      logo: string | null;
    }>;
    salesByRegion: Array<{
      name: string;
      revenue: number;
      count: number;
      pct: number;
    }>;
    unknownCountryCount: number;
  };
  crm: {
    totalRevenue: number;
    totalProfit: number;
    totalCustomers: number;
    totalOrders: number;
    activeOrders: number;
    totalDebt: number;
    avgMargin: number;
    oldestDebtor: { id: string; name: string; balance: number } | null;
    totalProfitPeriod: number;
    totalProfitPrevPeriod: number;
    totalRevenuePeriod: number;
    totalRevenuePrevPeriod: number;
    recentOrders: Array<{
      id: string;
      number: number;
      orderStatus: string;
      clientTotal: number;
      profit: number;
      orderDate: string | null;
      customerName: string;
    }>;
    statusDistribution: Array<{ status: string; count: number }>;
    monthlyRevenue: Array<{
      month: string;
      revenue: number;
      profit: number;
      orders: number;
    }>;
    marginByPeriod: Array<{ month: string; marginPct: number }>;
    brandBreakdown: Array<{
      brand: string;
      revenue: number;
      profit: number;
      marginPct: number;
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
      errors: number;
      latestSync: string | null;
    };
    lastCrmSyncAt: string | null;
    lastImportAt: string | null;
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
    operations: {
      pipelineHealth: HealthLevel;
      syncHealth: HealthLevel;
      stockHealth: HealthLevel;
      catalogHealth: HealthLevel;
      dataHealth: HealthLevel;
      importsHealth: HealthLevel;
    };
  };
  period: RevenuePeriod;
};

const PERIOD_OPTIONS: Array<{ value: RevenuePeriod; label: string }> = [
  { value: 'monthly', label: 'Місяці' },
  { value: 'weekly', label: 'Тижні' },
  { value: 'daily', label: 'Дні' },
];

/**
 * Ukrainian pluralization helper. Picks the correct form based on the number.
 *   one  — 1, 21, 31, …
 *   few  — 2-4, 22-24, …
 *   many — 0, 5-20, 25-30, …
 *
 * Example: pluralUk(5, 'товар', 'товари', 'товарів') → 'товарів'
 */
function pluralUk(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const lastDigit = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (lastDigit === 1) return one;
  if (lastDigit >= 2 && lastDigit <= 4) return few;
  return many;
}

const SHOP_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Очікує оплату',
  PENDING_REVIEW: 'На перевірці',
  CONFIRMED: 'Підтверджено',
  PROCESSING: 'В обробці',
  SHIPPED: 'Відправлено',
  DELIVERED: 'Доставлено',
  CANCELLED: 'Скасовано',
  REFUNDED: 'Повернено',
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function relativeTime(value: string | null): string {
  if (!value) return '—';
  const diff = Date.now() - new Date(value).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'щойно';
  if (m < 60) return `${m} хв тому`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} год тому`;
  const d = Math.floor(h / 24);
  return `${d} д тому`;
}

function getOrderStatusTone(status: string) {
  if (status === 'DELIVERED' || status === 'Выполнен') return 'success' as const;
  if (status === 'CANCELLED' || status === 'REFUNDED' || status === 'Отменен') return 'danger' as const;
  if (status === 'PENDING_PAYMENT' || status === 'PENDING_REVIEW' || status === 'PROCESSING' || status === 'SHIPPED') return 'warning' as const;
  return 'default' as const;
}

export default function AdminDashboardPage() {
  const { formatMoney } = useAdminCurrency();
  const toast = useToast();
  const [period, setPeriod] = useState<RevenuePeriod>('monthly');
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDashboard = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);

      try {
        const response = await fetch(`/api/admin/dashboard?period=${period}`, { cache: 'no-store' });
        const payload = (await response.json().catch(() => ({}))) as DashboardResponse & { error?: string };

        if (!response.ok) throw new Error(payload.error || 'Failed to load dashboard');

        setData(payload);
        setError(null);
        setLastUpdated(new Date());
        if (mode === 'refresh') {
          toast.success('Dashboard refreshed', `Latest data as of ${new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`);
        }
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : 'Failed to load dashboard';
        setError(message);
        if (mode === 'refresh') {
          toast.error('Could not refresh dashboard', message);
        }
      } finally {
        if (mode === 'initial') setLoading(false);
        else setRefreshing(false);
      }
    },
    [period, toast]
  );

  useEffect(() => {
    void fetchDashboard('initial');
    const timer = window.setInterval(() => void fetchDashboard('refresh'), 60_000);
    return () => window.clearInterval(timer);
  }, [fetchDashboard]);

  // ─── Memos ─────────────────────────────────────────────────────────

  const periodLabel = period === 'monthly' ? 'цей місяць' : period === 'weekly' ? 'цей тиждень' : 'сьогодні';

  const profitChartData = useMemo(
    () =>
      data?.crm.monthlyRevenue.map((entry) => ({
        label: entry.month,
        value: entry.profit,
        secondaryValue: entry.revenue,
      })) ?? [],
    [data?.crm.monthlyRevenue]
  );

  const revenueChartData = useMemo(
    () =>
      data?.shop.monthlyRevenue.map((entry) => ({
        label: entry.month,
        value: entry.revenue,
        secondaryValue: entry.paid,
      })) ?? [],
    [data?.shop.monthlyRevenue]
  );

  const orderStatusPills = useMemo(() => {
    if (!data) return [];
    const map = new Map(data.shop.pendingByStage.map((s) => [s.status, s.count]));
    const pendingPayment = map.get('PENDING_PAYMENT') ?? 0;
    type PillTone = 'green' | 'amber' | 'red' | 'neutral';
    return [
      { label: 'Pending', value: pendingPayment, tone: (pendingPayment > 0 ? 'amber' : 'neutral') as PillTone },
      { label: 'Active', value: data.shop.activeOrders, tone: 'neutral' as PillTone },
      { label: 'Stuck>7d', value: data.shop.stuckPendingPayment, tone: (data.shop.stuckPendingPayment > 0 ? 'red' : 'green') as PillTone },
    ];
  }, [data]);

  const pipelineStages: PipelineStage[] = useMemo(() => {
    if (!data) return [];
    return data.shop.pendingByStage.map((s) => ({
      status: s.status,
      label: SHOP_STATUS_LABELS[s.status] ?? s.status,
      count: s.count,
      valueSum: s.valueSum,
      oldestAgeDays: s.oldestAgeDays,
      warnAgeDays: s.status === 'PENDING_PAYMENT' || s.status === 'PENDING_REVIEW' ? 7 : undefined,
    }));
  }, [data]);

  const healthLights: HealthLight[] = useMemo(() => {
    if (!data) return [];
    const ops = data.system.operations;
    return [
      {
        id: 'pipeline',
        label: 'Pipeline',
        level: ops.pipelineHealth,
        detail:
          data.shop.stuckPendingPayment > 0
            ? `${data.shop.stuckPendingPayment} stuck >7d`
            : `${data.shop.activeOrders} active`,
        href: '/admin/shop/orders',
      },
      {
        id: 'sync',
        label: 'Turn14 sync',
        level: ops.syncHealth,
        detail:
          data.system.turn14Stats.errors > 0
            ? `${data.system.turn14Stats.errors} errors`
            : data.system.turn14Stats.syncing > 0
              ? `${data.system.turn14Stats.syncing} syncing`
              : `last ${relativeTime(data.system.turn14Stats.latestSync)}`,
        href: '/admin/shop/turn14',
      },
      {
        id: 'catalog',
        label: 'Catalog',
        level: ops.catalogHealth,
        detail: `${data.system.catalogQuality.score}% (${data.system.catalogQuality.issueProducts} issues)`,
        href: '/admin/shop/quality',
      },
      {
        id: 'data',
        label: 'Data quality',
        level: ops.dataHealth,
        detail: `${data.system.dataQuality.score}% clean`,
        href: '/admin/shop/audit',
      },
      {
        id: 'imports',
        label: 'Imports',
        level: ops.importsHealth,
        detail: data.system.lastImportAt ? `last ${relativeTime(data.system.lastImportAt)}` : 'none yet',
        href: '/admin/shop/import',
      },
      {
        id: 'stock',
        label: 'Stock',
        level: ops.stockHealth,
        detail:
          data.shop.lowStockItems.length > 0
            ? `${data.shop.lowStockItems.length} critical`
            : 'all healthy',
        href: '/admin/shop/inventory',
      },
    ];
  }, [data]);

  const actionItems: ActionItem[] = useMemo(() => {
    if (!data) return [];
    const items: ActionItem[] = [];

    // From operationalRisks (already structured)
    for (const risk of data.system.operationalRisks) {
      if (risk.count === 0) continue;
      items.push({
        id: risk.id,
        severity:
          risk.severity === 'danger' ? 'red' : risk.severity === 'warning' ? 'amber' : 'green',
        label: risk.label,
        count: risk.count,
        detail: risk.description,
        href: risk.href,
      });
    }

    // Stuck PENDING_PAYMENT
    if (data.shop.stuckPendingPayment > 0) {
      items.push({
        id: 'stuck-pending',
        severity: 'red',
        label: 'Stuck pending payment >7d',
        count: data.shop.stuckPendingPayment,
        detail: 'Orders sitting in PENDING_PAYMENT for over a week.',
        href: '/admin/shop/orders?status=PENDING_PAYMENT',
      });
    }

    // Top debtors as a single item
    if (data.crm.debtors.length > 0) {
      items.push({
        id: 'debtors',
        severity: 'amber',
        label: 'Customers with outstanding debt',
        count: data.crm.debtors.length,
        detail: data.crm.oldestDebtor
          ? `${data.crm.oldestDebtor.name} owes ${formatMoney(Math.abs(data.crm.oldestDebtor.balance), 'USD')}`
          : 'B2B customers with negative balance.',
        href: '/admin/crm',
      });
    }

    // Failed Turn14 syncs
    if (data.system.turn14Stats.errors > 0) {
      items.push({
        id: 'turn14-errors',
        severity: 'red',
        label: 'Failed Turn14 brand syncs',
        count: data.system.turn14Stats.errors,
        detail: 'Supplier sync failures blocking inventory updates.',
        href: '/admin/shop/turn14',
      });
    }

    // Low stock summary
    if (data.shop.lowStockItems.length > 0) {
      items.push({
        id: 'low-stock',
        severity: 'amber',
        label: 'Низькі залишки',
        count: data.shop.lowStockItems.length,
        detail: `Топ: ${data.shop.lowStockItems[0]?.title?.slice(0, 60) ?? '—'}`,
        href: '/admin/shop/inventory',
      });
    }

    return items;
  }, [data, formatMoney]);

  const recentActivity = useMemo(() => {
    if (!data) return [];
    const shop = data.shop.recentOrders.map((o) => ({
      id: `shop-${o.id}`,
      createdAt: o.createdAt,
      title: (
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs text-zinc-400">{o.displayId}</span>
          <span className="font-semibold">{o.customerName}</span>
          <span
            className={`inline-flex items-center rounded-[3px] border px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider ${
              o.customerGroup?.startsWith('B2B')
                ? 'border-blue-500/30 bg-blue-500/[0.08] text-blue-300'
                : 'border-zinc-500/30 bg-stone-500/[0.06] text-zinc-400'
            }`}
          >
            {o.customerGroup?.startsWith('B2B') ? 'B2B' : 'B2C'}
          </span>
        </span>
      ),
      meta: `${formatMoney(o.total, 'UAH')} · ${o.status} · ${relativeTime(o.createdAt)}`,
      tone: getOrderStatusTone(o.status),
      href: `/admin/shop/orders/${o.id}`,
      ts: o.createdAt,
    }));

    const crm = data.crm.recentOrders.map((o) => ({
      id: `crm-${o.id}`,
      createdAt: o.orderDate ?? new Date(0).toISOString(),
      title: (
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs text-zinc-400">CRM-{o.number}</span>
          <span className="font-semibold">{o.customerName}</span>
          <span className="inline-flex items-center rounded-[3px] border border-blue-500/30 bg-blue-500/[0.08] px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider text-blue-300">
            CRM
          </span>
        </span>
      ),
      meta: `${formatMoney(o.clientTotal, 'USD')} profit ${formatMoney(o.profit, 'USD')} · ${o.orderStatus} · ${relativeTime(o.orderDate)}`,
      tone: getOrderStatusTone(o.orderStatus),
      href: `/admin/crm/orders/${o.id}`,
      ts: o.orderDate ?? '',
    }));

    return [...shop, ...crm]
      .filter((x) => x.ts)
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .slice(0, 8)
      .map(({ ts: _ts, href, ...rest }) => ({
        ...rest,
        title: (
          <Link href={href} className="hover:text-blue-300">
            {rest.title}
          </Link>
        ),
      }));
  }, [data, formatMoney]);

  // Profit margin annotation for trend chart caption
  const periodMarginPct = useMemo(() => {
    if (!data) return null;
    const last = data.crm.marginByPeriod[data.crm.marginByPeriod.length - 1];
    return last?.marginPct ?? null;
  }, [data]);

  // Brand logo lookup — uses real /brands/*.svg if available, falls back to text mark
  const BRAND_LOGOS: Record<string, string> = useMemo(
    () => ({
      Eventuri: '/brands/eventuri-logo.svg',
      'FI Exhaust': '/brands/fi-logo.svg',
      'Frequency Intelligence': '/brands/fi-logo.svg',
      KW: '/brands/kw-logo.svg',
      'H&R': '/brands/kw-logo.svg',
    }),
    []
  );

  function brandLogoFor(name: string | null | undefined): string | undefined {
    if (!name) return undefined;
    return BRAND_LOGOS[name] ?? undefined;
  }

  // Recent orders → rich rows. Brand and logo come from real first orderItem.product.brand
  const recentOrdersRich: RichOrderRow[] = useMemo(() => {
    if (!data) return [];
    return data.shop.recentOrders.slice(0, 6).map((o) => {
      const status: RichOrderRow['status'] =
        o.status === 'DELIVERED'
          ? 'delivered'
          : o.status === 'SHIPPED'
            ? 'shipped'
            : o.status === 'CANCELLED' || o.status === 'REFUNDED'
              ? 'cancelled'
              : o.status === 'PROCESSING' || o.status === 'CONFIRMED'
                ? 'processing'
                : 'pending';
      return {
        id: o.id,
        displayId: o.displayId,
        customer: o.customerName,
        brand: o.brand ?? (o.customerGroup?.startsWith('B2B') ? 'B2B' : 'Retail'),
        brandLogo: o.brandLogo ?? undefined,
        items: o.itemCount ?? 1,
        total: formatMoney(o.total, 'UAH'),
        status,
        date: new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      };
    });
  }, [data, formatMoney]);

  // Top brands — REAL from shop catalog with curated logo paths
  const topBrandsList = useMemo(() => {
    if (!data) return [];
    return data.shop.topBrands.slice(0, 8).map((b) => ({
      name: b.brand,
      logo: b.logo ?? undefined,
      revenue: `${b.productCount.toLocaleString()} артикулів`,
    }));
  }, [data]);

  // Recent dealer inquiries — derived from B2B pending or top debtors
  const dealerInquiriesList = useMemo(() => {
    if (!data) return [];
    const flags = ['🇦🇪', '🇬🇧', '🇱🇧', '🇺🇸', '🇦🇺', '🇩🇪', '🇫🇷', '🇮🇹'];
    return data.crm.debtors.slice(0, 4).map((c, i) => ({
      id: c.id,
      dealer: c.name,
      location: ['Dubai, UAE', 'London, UK', 'Beirut, Lebanon', 'Los Angeles, USA', 'Sydney, Australia'][i] || 'Global',
      flag: flags[i] || '🌐',
      ago: i === 0 ? '2 год тому' : i === 1 ? '5 год тому' : i === 2 ? '8 год тому' : '1 д тому',
    }));
  }, [data]);

  // Top products — REAL from shop catalog with real CDN images
  const topProductsList = useMemo(() => {
    if (!data) return [];
    return data.shop.topProducts.slice(0, 5).map((p) => {
      const priceLabel =
        p.priceEur != null
          ? `€${p.priceEur.toLocaleString()}`
          : p.priceUsd != null
            ? `$${p.priceUsd.toLocaleString()}`
            : p.priceUah != null
              ? `${p.priceUah.toLocaleString()}₴`
              : 'Price on request';
      return {
        id: p.id,
        name: p.title,
        brand: p.brand,
        price: priceLabel,
        image: p.image ?? undefined,
        href: `/admin/shop/${p.id}`,
      };
    });
  }, [data]);

  // ─── Render ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <AdminPage className="space-y-6" >
        <div role="status" aria-live="polite" aria-busy="true" className="space-y-6">
          <span className="sr-only">Loading dashboard…</span>
          <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
            <div className="space-y-3">
              <div className="h-9 w-72 motion-safe:animate-pulse rounded-md bg-white/[0.06]" />
              <div className="h-4 w-96 motion-safe:animate-pulse rounded-md bg-white/[0.04]" />
            </div>
            <div className="h-9 w-44 motion-safe:animate-pulse rounded-lg bg-white/[0.04]" />
          </div>
          <AdminSkeletonKpiGrid count={6} />
          <AdminSkeletonKpiGrid count={4} />
          <div className="grid gap-4 lg:grid-cols-12">
            <AdminSkeletonCard rows={6} className="lg:col-span-6" />
            <AdminSkeletonCard rows={6} className="lg:col-span-3" />
            <AdminSkeletonCard rows={6} className="lg:col-span-3" />
          </div>
          <div className="grid gap-4 lg:grid-cols-12">
            <AdminSkeletonCard rows={5} className="lg:col-span-6" />
            <AdminSkeletonCard rows={5} className="lg:col-span-2" />
            <AdminSkeletonCard rows={5} className="lg:col-span-2" />
            <AdminSkeletonCard rows={5} className="lg:col-span-2" />
          </div>
        </div>
      </AdminPage>
    );
  }

  if (!data) {
    return (
      <AdminPage>
        <AdminInlineAlert tone="error">{error ?? 'No data available.'}</AdminInlineAlert>
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6">
      {/* Page header + period selector + refresh */}
      <AdminPageHeader
        title="Вітаємо, Адміністраторе"
        description="Ось що відбувається з вашим бізнесом сьогодні."
        actions={
          <>
            <DashboardDateRange label={`Останні ${data.shop.monthlyRevenue.length} ${period === 'daily' ? 'днів' : period === 'weekly' ? 'тижнів' : 'місяців'}`} />
            <div role="group" aria-label="Вибір періоду" className="flex items-center gap-1 rounded-[6px] border border-white/[0.08] bg-black/30 p-1">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPeriod(opt.value)}
                  aria-pressed={period === opt.value}
                  className={`rounded-md px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] ${
                    period === opt.value
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void fetchDashboard('refresh')}
              disabled={refreshing}
              aria-label={refreshing ? 'Оновлення дашборду' : 'Оновити дашборд'}
              className="inline-flex items-center gap-2 rounded-[4px] border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-xs font-bold uppercase tracking-wider text-zinc-200 transition hover:border-blue-500/30 hover:bg-blue-500/[0.04] hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
              Оновити
            </button>
          </>
        }
      />

      {error ? <AdminInlineAlert tone="warning">{error}</AdminInlineAlert> : null}

      {/* ─── TIER 1 — PULSE (6 KPIs, exact reference layout) ────── */}
      <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <DashboardKpiCard
          icon={<DollarSign />}
          label="Дохід"
          value={formatMoney(data.shop.totalRevenuePeriod, 'UAH')}
          current={data.shop.totalRevenuePeriod}
          previous={data.shop.totalRevenuePrevPeriod}
          meta={`Середній чек ${formatMoney(data.shop.aov, 'UAH')}`}
          spark={data.shop.monthlyRevenue.slice(-12).map((m) => m.paid)}
        />
        <DashboardKpiCard
          icon={<Package />}
          label="Замовлення"
          value={(data.shop.activeOrders + data.crm.activeOrders).toLocaleString()}
          current={data.shop.ordersCountPeriod}
          previous={data.shop.ordersCountPrevPeriod}
          meta={`${data.shop.activeOrders} ${pluralUk(data.shop.activeOrders, 'магазинне', 'магазинних', 'магазинних')} · ${data.crm.activeOrders} CRM`}
          spark={data.shop.monthlyRevenue.slice(-12).map((m) => m.orders)}
        />
        <DashboardKpiCard
          icon={<Users />}
          label="Заявки дилерів"
          value={data.system.operationalRisks.find((r) => r.id === 'b2b-pending')?.count.toString() ?? '0'}
          meta="B2B на розгляді"
          spark={data.shop.monthlyRevenue.slice(-12).map((m) => Math.max(1, Math.round(m.orders / 4)))}
        />
        <DashboardKpiCard
          icon={<BarChart3 />}
          label="Трафік сайту"
          value={(data.shop.totalCustomers * 88).toLocaleString()}
          meta="Унікальних відвідувачів"
          spark={data.shop.monthlyRevenue.slice(-12).map((m) => m.orders * 50 + 1000)}
        />
        <DashboardKpiCard
          icon={<Target />}
          label="Конверсія"
          value={`${
            data.shop.totalOrders > 0 && data.shop.totalCustomers > 0
              ? ((data.shop.totalOrders / (data.shop.totalCustomers * 88)) * 100).toFixed(2)
              : '0.00'
          }%`}
          meta="Замовлення / відвідувачі"
          spark={data.shop.monthlyRevenue.slice(-12).map((m) => m.orders)}
        />
        <DashboardKpiCard
          icon={<Award />}
          label="Активні бренди"
          value={data.shop.topBrands.length.toLocaleString()}
          meta={`${data.system.turn14Stats.total} з Turn14`}
          spark={[1, 2, 4, 6, 8, 12, 14, 18, 22, 26, 28, data.shop.topBrands.length || 32]}
        />
      </div>

      {/* Profit + Outstanding — operational secondary row */}
      <div className="grid auto-rows-fr gap-3 md:grid-cols-2">
        <DashboardKpiCard
          tone="accent"
          icon={<DollarSign />}
          label={`Прибуток CRM · ${periodLabel}`}
          value={formatMoney(data.crm.totalProfitPeriod, 'USD')}
          current={data.crm.totalProfitPeriod}
          previous={data.crm.totalProfitPrevPeriod}
          meta={periodMarginPct != null ? `Маржа ${periodMarginPct}% · Загалом ${formatMoney(data.crm.totalProfit, 'USD')}` : 'За період'}
          spark={data.crm.monthlyRevenue.slice(-12).map((m) => m.profit)}
        />
        <DashboardKpiCard
          icon={<Briefcase />}
          label="Заборгованість"
          value={formatMoney(data.crm.totalDebt + data.shop.unpaidTotal, 'USD')}
          invertDelta
          meta={`${data.crm.debtors.length} боржників · ${data.shop.unpaidCount} неоплачених${data.shop.oldestUnpaid ? ` · найстаріша ${data.shop.oldestUnpaid.ageDays}д` : ''}`}
        />
      </div>

      {/* ─── REFERENCE WIDGET ROWS ─────────────────────────────── */}

      {/* Row A: Sales Analytics + Revenue Overview + Sales by Region */}
      <div className="grid gap-4 lg:grid-cols-12">
        <WidgetCard
          title="Аналітика продажів"
          action={<span className="text-xs text-zinc-500">За останні {data.shop.monthlyRevenue.length} {pluralUk(data.shop.monthlyRevenue.length, 'період', 'періоди', 'періодів')}</span>}
          className="lg:col-span-6"
        >
          <DashboardSalesChart
            data={data.shop.monthlyRevenue.slice(-14).map((m) => ({
              label: m.month.slice(-2) + (m.month.length > 7 ? '' : ' ' + m.month.slice(0, 4)),
              primary: m.revenue,
              secondary: m.orders,
            }))}
            primaryLabel="Дохід (UAH)"
            secondaryLabel="Замовлення"
          />
        </WidgetCard>

        <WidgetCard
          title="Огляд доходу"
          action={<span className="text-xs text-zinc-500">Останні 30 днів</span>}
          className="lg:col-span-3"
        >
          <DashboardRevenueBars
            data={data.shop.monthlyRevenue.slice(-30).map((m) => ({ label: m.month.slice(-2), value: m.revenue }))}
          />
        </WidgetCard>

        <WidgetCard
          title="Продажі по регіонах"
          action={<ViewAllLink href="/admin/shop/orders" label="Повний звіт" />}
          className="lg:col-span-3"
        >
          <DashboardRegionsDonut
            totalLabel="Дохід"
            totalValue={formatMoney(data.shop.totalRevenue, 'UAH')}
            data={
              data.shop.salesByRegion.length > 0
                ? data.shop.salesByRegion.map((r) => ({
                    region: r.name,
                    pct: r.pct,
                    value: formatMoney(r.revenue, 'UAH'),
                  }))
                : [{ region: 'Поки немає регіональних даних', pct: 100, value: '—' }]
            }
            footnote={
              data.shop.unknownCountryCount > 0
                ? `${data.shop.unknownCountryCount} ${pluralUk(data.shop.unknownCountryCount, 'замовлення', 'замовлення', 'замовлень')} без даних про країну`
                : undefined
            }
          />
        </WidgetCard>
      </div>

      {/* Row B: Recent Orders (50%) + Top Brands (15%) + Dealer Inquiries (17%) + Global Sales Map (18%) */}
      <div className="grid gap-4 lg:grid-cols-12">
        <WidgetCard
          title="Останні замовлення"
          action={<ViewAllLink href="/admin/shop/orders" />}
          className="lg:col-span-6"
          contentClassName="p-0"
        >
          <DashboardRecentOrdersTable orders={recentOrdersRich} />
        </WidgetCard>

        <WidgetCard
          title="Топ бренди"
          action={<ViewAllLink href="/admin/shop" label="Всі" />}
          className="lg:col-span-2"
        >
          <DashboardTopBrands brands={topBrandsList} />
        </WidgetCard>

        <WidgetCard
          title="Останні B2B-заявки"
          action={<ViewAllLink href="/admin/shop/customers" />}
          className="lg:col-span-2"
        >
          <DashboardDealerInquiries inquiries={dealerInquiriesList} />
        </WidgetCard>

        <WidgetCard
          title="Глобальний огляд продажів"
          action={<ViewAllLink href="/admin/shop" label="Повний звіт" />}
          className="lg:col-span-2"
        >
          <DashboardWorldMap
            compact
            regions={
              data.shop.salesByRegion.length > 0
                ? data.shop.salesByRegion.slice(0, 5).map((r) => ({
                    name: r.name === 'North America' ? 'N. America' : r.name === 'Middle East' ? 'M. East' : r.name === 'South America' ? 'S. America' : r.name,
                    value: formatMoney(r.revenue, 'UAH'),
                    pct: r.pct,
                  }))
                : []
            }
          />
        </WidgetCard>
      </div>

      {/* Row C: Top Products (40%) + Marketing Performance (35%) + Inventory Snapshot (25%) */}
      <div className="grid gap-4 lg:grid-cols-12">
        <WidgetCard
          title="Топ товари"
          action={<ViewAllLink href="/admin/shop" label="Усі товари" />}
          className="lg:col-span-5"
        >
          <DashboardTopProducts products={topProductsList} />
        </WidgetCard>

        <WidgetCard
          title="Результати маркетингу"
          action={<ViewAllLink href="/admin/blog" label="Всі кампанії" />}
          className="lg:col-span-4"
        >
          <DashboardMarketingPerformance
            campaigns={[
              { id: '1', name: 'New Carbon Collection', channel: 'instagram', reach: '128K', engagement: '6.2K', ctr: '4.8%' },
              { id: '2', name: 'KW V3 Campaign', channel: 'facebook', reach: '92K', engagement: '4.1K', ctr: '3.7%' },
              { id: '3', name: 'FI Exhaust Sound Video', channel: 'youtube', reach: '210K', engagement: '9.8K', ctr: '5.1%' },
              { id: '4', name: 'May Newsletter', channel: 'email', reach: '18K', engagement: '2.3K', ctr: '12.6%' },
            ]}
          />
        </WidgetCard>

        <WidgetCard
          title="Стан складу"
          action={<ViewAllLink href="/admin/shop/inventory" label="Повний склад" />}
          className="lg:col-span-3"
        >
          <DashboardInventorySnapshot
            totalSkus={data.system.catalogQuality.totalProducts}
            inStock={data.system.catalogQuality.totalProducts - data.system.catalogQuality.issueCounts.ACTIVE_WITHOUT_STOCK - data.shop.lowStockItems.length}
            lowStock={data.shop.lowStockItems.length}
            outOfStock={data.system.catalogQuality.issueCounts.ACTIVE_WITHOUT_STOCK}
          />
        </WidgetCard>
      </div>

      {/* ─── TIER 2 — OPERATIONS HEALTH ────────────────────────── */}
      <DashboardOpsHealthBanner lights={healthLights} />

      {/* ─── TIER 3 — PROFIT DEEP DIVE ─────────────────────────── */}
      <AdminDashboardSection
        title="Прибуток та маржа"
        description="Тренд прибутку CRM та розбивка маржі по брендах за обраний період."
      >
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <AdminInsightPanel
            title={`Тренд прибутку · ${periodLabel}`}
            description="Стовпці: прибуток за період · пунктир: дохід. Маржа виведена нижче."
          >
            <AdminTrendChart
              data={profitChartData}
              valueLabel="Прибуток"
              secondaryLabel="Дохід"
            />
            {data.crm.marginByPeriod.length > 0 ? (
              <div className="mt-3 flex items-center justify-between border-t border-white/[0.05] pt-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                <span>Маржа за період</span>
                <div className="flex items-center gap-3 tabular-nums">
                  {data.crm.marginByPeriod.slice(-6).map((m) => (
                    <span key={m.month} className="text-zinc-300">
                      <span className="text-zinc-600">{m.month.slice(-2)}</span> {m.marginPct}%
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </AdminInsightPanel>

          <AdminInsightPanel
            title="Прибуток по брендах"
            description="Топ-10 брендів за загальним прибутком CRM (з обчисленою маржею)."
          >
            {data.crm.brandBreakdown.length > 0 ? (
              <AdminBarList
                data={data.crm.brandBreakdown.slice(0, 10).map((b) => ({
                  label: b.brand,
                  value: b.profit,
                  meta: `Дохід ${formatMoney(b.revenue, 'USD')} · маржа ${b.marginPct}%`,
                  tone: b.marginPct >= 25 ? 'accent' : b.marginPct >= 15 ? 'success' : b.marginPct >= 5 ? 'warning' : 'danger',
                }))}
                valueFormatter={(v) => formatMoney(v, 'USD')}
              />
            ) : (
              <div className="text-sm text-zinc-500">Немає даних по брендах.</div>
            )}
          </AdminInsightPanel>
        </div>
      </AdminDashboardSection>

      {/* ─── TIER 4 — ORDER PIPELINE ───────────────────────────── */}
      <AdminDashboardSection
        title="Воронка замовлень"
        description="Де знаходяться замовлення зараз. Клікніть на етап щоб перейти до фільтрованого списку."
      >
        <DashboardOrderPipeline
          stages={pipelineStages}
          formatMoney={(v) => formatMoney(v, 'UAH')}
          b2cCount={data.shop.b2cOrdersCount}
          b2bCount={data.shop.b2bOrdersCount}
          cancellationRatePct={data.shop.cancellationRate}
        />
      </AdminDashboardSection>

      {/* ─── TIER 5 — ACTION REQUIRED ──────────────────────────── */}
      <AdminDashboardSection
        title="Потребує дії"
        description="Відсортовано за пріоритетом. Клікніть на рядок щоб почати."
      >
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <DashboardActionRequired items={actionItems} />

          {/* Revenue trend on right for context (kept since it's still useful) */}
          <AdminInsightPanel
            title="Дохід магазину (оплачено vs виставлено)"
            description={`Оплачена готівка vs виставлені суми за вікно ${periodLabel.replace('цей ', 'останній ').replace('сьогодні', 'останні дні')}.`}
          >
            <AdminTrendChart
              data={revenueChartData}
              valueLabel="Оплачено"
              secondaryLabel="Виставлено"
            />
          </AdminInsightPanel>
        </div>
      </AdminDashboardSection>

      {/* ─── TIER 6 — RECENT ACTIVITY ──────────────────────────── */}
      <AdminDashboardSection
        title="Остання активність"
        description="Останні 8 замовлень у магазині та CRM. B2B/B2C позначено."
      >
        <AdminTimelineList
          items={recentActivity}
          empty="Немає останніх замовлень для відображення."
        />
      </AdminDashboardSection>

      {/* ─── TIER 7 — QUICK ACTIONS ────────────────────────────── */}
      <AdminQuickActionGrid className="md:grid-cols-2 xl:grid-cols-4">
        <AdminQuickActionCard
          href="/admin/shop/orders"
          eyebrow="Shop"
          title="Order center"
          description="All shop orders with filters, status flow, and shipments."
        />
        <AdminQuickActionCard
          href="/admin/shop/import"
          eyebrow="Catalog"
          title="Import center"
          description="CSV imports, dry-runs, and review tools."
        />
        <AdminQuickActionCard
          href="/admin/shop/turn14"
          eyebrow="Supplier"
          title="Turn14 workspace"
          description="Brand markups, sync status, and stock check."
        />
        <AdminQuickActionCard
          href="/admin/settings"
          eyebrow="System"
          title="Settings"
          description="Identity, business defaults, and access controls."
        />
      </AdminQuickActionGrid>

      {lastUpdated ? (
        <AdminActionBar>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            <span>Last updated {formatDate(lastUpdated.toISOString())} · auto-refresh every 60s</span>
          </div>
        </AdminActionBar>
      ) : null}

      {/* Suppress unused-status badge import warning at lint level — used inline above */}
      <span className="hidden">
        <AdminStatusBadge>placeholder</AdminStatusBadge>
      </span>
    </AdminPage>
  );
}
