"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { BarChart3, Briefcase, DollarSign, Package, RefreshCw, Target } from "lucide-react";

import { AdminInlineAlert, AdminPage } from "@/components/admin/AdminPrimitives";
import { AdminSkeletonCard, AdminSkeletonKpiGrid } from "@/components/admin/AdminSkeleton";
import { useAdminCurrency } from "@/lib/admin/currencyContext";
import { useToast } from "@/components/admin/AdminToast";
import { cn } from "@/lib/utils";
import { DashboardKpiCard } from "./components/DashboardKpiCard";
import {
  DashboardRecentOrdersTable,
  DashboardSalesChart,
  DashboardTopBrands,
  DashboardTopProducts,
  ViewAllLink,
  WidgetCard,
  type RichOrderRow,
} from "./components/DashboardWidgets";
import {
  DashboardOpsHealthBanner,
  type HealthLevel,
  type HealthLight,
} from "./components/DashboardOpsHealthBanner";
import { DashboardOrderPipeline, type PipelineStage } from "./components/DashboardOrderPipeline";
import { DashboardActionRequired, type ActionItem } from "./components/DashboardActionRequired";

type RevenuePeriod = "monthly" | "weekly" | "daily";

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
      severity: "success" | "warning" | "danger";
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
  analytics: {
    activeUsers: number;
    sessions: number;
    periodDays: number;
  } | null;
  period: RevenuePeriod;
};

const PERIOD_OPTIONS: Array<{ value: RevenuePeriod; label: string }> = [
  { value: "monthly", label: "Місяць" },
  { value: "weekly", label: "Тиждень" },
  { value: "daily", label: "День" },
];

const SHOP_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Очікує оплату",
  PENDING_REVIEW: "На перевірці",
  CONFIRMED: "Підтверджено",
  PROCESSING: "В обробці",
  SHIPPED: "Відправлено",
  DELIVERED: "Доставлено",
  CANCELLED: "Скасовано",
  REFUNDED: "Повернено",
};

function relativeTime(value: string | null): string {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "щойно";
  if (m < 60) return `${m} хв тому`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} год тому`;
  const d = Math.floor(h / 24);
  return `${d} д тому`;
}

export default function AdminDashboardPage() {
  const { formatMoney } = useAdminCurrency();
  const toast = useToast();
  const [period, setPeriod] = useState<RevenuePeriod>("monthly");
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDashboard = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);

      try {
        const response = await fetch(`/api/admin/dashboard?period=${period}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as DashboardResponse & {
          error?: string;
        };

        if (!response.ok) throw new Error(payload.error || "Failed to load dashboard");

        setData(payload);
        setError(null);
        setLastUpdated(new Date());
        if (mode === "refresh") {
          toast.success(
            "Дашборд оновлено",
            new Date().toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })
          );
        }
      } catch (fetchError) {
        const message =
          fetchError instanceof Error ? fetchError.message : "Failed to load dashboard";
        setError(message);
        if (mode === "refresh") {
          toast.error("Не вдалося оновити", message);
        }
      } finally {
        if (mode === "initial") setLoading(false);
        else setRefreshing(false);
      }
    },
    [period, toast]
  );

  useEffect(() => {
    void fetchDashboard("initial");
    // Auto-refresh every 2 minutes — was 1 minute which was wasteful.
    const timer = window.setInterval(() => void fetchDashboard("refresh"), 120_000);
    return () => window.clearInterval(timer);
  }, [fetchDashboard]);

  const periodLabel =
    period === "monthly" ? "за місяць" : period === "weekly" ? "за тиждень" : "за день";

  const pipelineStages: PipelineStage[] = useMemo(() => {
    if (!data) return [];
    return data.shop.pendingByStage.map((s) => ({
      status: s.status,
      label: SHOP_STATUS_LABELS[s.status] ?? s.status,
      count: s.count,
      valueSum: s.valueSum,
      oldestAgeDays: s.oldestAgeDays,
      warnAgeDays: s.status === "PENDING_PAYMENT" || s.status === "PENDING_REVIEW" ? 7 : undefined,
    }));
  }, [data]);

  const healthLights: HealthLight[] = useMemo(() => {
    if (!data) return [];
    const ops = data.system.operations;
    return [
      {
        id: "pipeline",
        label: "Pipeline",
        level: ops.pipelineHealth,
        detail:
          data.shop.stuckPendingPayment > 0
            ? `${data.shop.stuckPendingPayment} stuck >7d`
            : `${data.shop.activeOrders} active`,
        href: "/admin/shop/orders",
      },
      {
        id: "sync",
        label: "Turn14",
        level: ops.syncHealth,
        detail:
          data.system.turn14Stats.errors > 0
            ? `${data.system.turn14Stats.errors} errors`
            : data.system.turn14Stats.syncing > 0
              ? `${data.system.turn14Stats.syncing} syncing`
              : `last ${relativeTime(data.system.turn14Stats.latestSync)}`,
        href: "/admin/shop/turn14",
      },
      {
        id: "catalog",
        label: "Каталог",
        level: ops.catalogHealth,
        detail: `${data.system.catalogQuality.score}% (${data.system.catalogQuality.issueProducts} проблем)`,
        href: "/admin/shop/quality",
      },
      {
        id: "data",
        label: "Дані",
        level: ops.dataHealth,
        detail: `${data.system.dataQuality.score}% чисто`,
        href: "/admin/shop/audit",
      },
      {
        id: "imports",
        label: "Імпорти",
        level: ops.importsHealth,
        detail: data.system.lastImportAt
          ? `last ${relativeTime(data.system.lastImportAt)}`
          : "немає",
        href: "/admin/shop/import",
      },
      {
        id: "stock",
        label: "Склад",
        level: ops.stockHealth,
        detail:
          data.shop.lowStockItems.length > 0
            ? `${data.shop.lowStockItems.length} критичних`
            : "у нормі",
        href: "/admin/shop/inventory",
      },
    ];
  }, [data]);

  const actionItems: ActionItem[] = useMemo(() => {
    if (!data) return [];
    const items: ActionItem[] = [];

    for (const risk of data.system.operationalRisks) {
      if (risk.count === 0) continue;
      items.push({
        id: risk.id,
        severity:
          risk.severity === "danger" ? "red" : risk.severity === "warning" ? "amber" : "green",
        label: risk.label,
        count: risk.count,
        detail: risk.description,
        href: risk.href,
      });
    }

    if (data.shop.stuckPendingPayment > 0) {
      items.push({
        id: "stuck-pending",
        severity: "red",
        label: "Stuck pending payment >7d",
        count: data.shop.stuckPendingPayment,
        detail: "Замовлення в PENDING_PAYMENT понад тиждень.",
        href: "/admin/shop/orders?status=PENDING_PAYMENT",
      });
    }

    if (data.crm.debtors.length > 0) {
      items.push({
        id: "debtors",
        severity: "amber",
        label: "Клієнти з заборгованістю",
        count: data.crm.debtors.length,
        detail: data.crm.oldestDebtor
          ? `${data.crm.oldestDebtor.name} винен ${formatMoney(Math.abs(data.crm.oldestDebtor.balance), "USD")}`
          : "B2B клієнти з негативним балансом.",
        href: "/admin/crm",
      });
    }

    if (data.system.turn14Stats.errors > 0) {
      items.push({
        id: "turn14-errors",
        severity: "red",
        label: "Помилки синхронізації Turn14",
        count: data.system.turn14Stats.errors,
        detail: "Збої постачальника блокують оновлення залишків.",
        href: "/admin/shop/turn14",
      });
    }

    if (data.shop.lowStockItems.length > 0) {
      items.push({
        id: "low-stock",
        severity: "amber",
        label: "Низькі залишки",
        count: data.shop.lowStockItems.length,
        detail: `Топ: ${data.shop.lowStockItems[0]?.title?.slice(0, 60) ?? "—"}`,
        href: "/admin/shop/inventory",
      });
    }

    return items;
  }, [data, formatMoney]);

  const recentOrdersRich: RichOrderRow[] = useMemo(() => {
    if (!data) return [];
    return data.shop.recentOrders.slice(0, 6).map((o) => {
      const status: RichOrderRow["status"] =
        o.status === "DELIVERED"
          ? "delivered"
          : o.status === "SHIPPED"
            ? "shipped"
            : o.status === "CANCELLED" || o.status === "REFUNDED"
              ? "cancelled"
              : o.status === "PROCESSING" || o.status === "CONFIRMED"
                ? "processing"
                : "pending";
      return {
        id: o.id,
        displayId: o.displayId,
        customer: o.customerName,
        brand: o.brand ?? (o.customerGroup?.startsWith("B2B") ? "B2B" : "Retail"),
        brandLogo: o.brandLogo ?? undefined,
        items: o.itemCount ?? 1,
        total: formatMoney(o.total, "UAH"),
        status,
        date: new Date(o.createdAt).toLocaleDateString("uk-UA", {
          month: "short",
          day: "numeric",
        }),
      };
    });
  }, [data, formatMoney]);

  const topBrandsList = useMemo(() => {
    if (!data) return [];
    return data.shop.topBrands.slice(0, 6).map((b) => ({
      name: b.brand,
      logo: b.logo ?? undefined,
      revenue: `${b.productCount.toLocaleString()} артикулів`,
    }));
  }, [data]);

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
              : "Ціна за запитом";
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

  const periodMarginPct = useMemo(() => {
    if (!data) return null;
    const last = data.crm.marginByPeriod[data.crm.marginByPeriod.length - 1];
    return last?.marginPct ?? null;
  }, [data]);

  if (loading) {
    return (
      <AdminPage className="space-y-5 md:space-y-6">
        <div role="status" aria-live="polite" aria-busy="true" className="space-y-5 md:space-y-6">
          <span className="sr-only">Завантаження дашборду…</span>
          <div className="flex flex-wrap items-end justify-between gap-3 pb-2">
            <div className="space-y-2">
              <div className="h-7 w-44 motion-safe:animate-pulse rounded-none bg-white/6" />
              <div className="h-3.5 w-64 motion-safe:animate-pulse rounded-none bg-white/4" />
            </div>
            <div className="h-8 w-36 motion-safe:animate-pulse rounded-none bg-white/4" />
          </div>
          <AdminSkeletonKpiGrid count={4} />
          <AdminSkeletonCard rows={8} />
          <div className="grid gap-4 lg:grid-cols-2">
            <AdminSkeletonCard rows={6} />
            <AdminSkeletonCard rows={6} />
          </div>
        </div>
      </AdminPage>
    );
  }

  if (!data) {
    return (
      <AdminPage>
        <AdminInlineAlert tone="error">{error ?? "Немає даних."}</AdminInlineAlert>
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-5 md:space-y-6">
      {/* Compact header — mobile-first */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="font-display mb-1 flex items-center gap-2 text-[11px] font-medium text-blue-400">
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              <span className="absolute inset-0 rounded-full bg-blue-500 motion-safe:animate-ping" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-blue-500" />
            </span>
            Операційна консоль · live
          </div>
          <h1 className="font-display truncate text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
            Дашборд
          </h1>
          <p className="font-display mt-0.5 text-sm text-zinc-500">Огляд бізнесу {periodLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Період"
            className="flex items-center rounded-none border border-white/8 bg-black/30 p-0.5"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPeriod(opt.value)}
                aria-pressed={period === opt.value}
                className={cn(
                  "font-display rounded-none px-2.5 py-1.5 text-xs font-medium transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500/40",
                  period === opt.value
                    ? "bg-blue-600 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void fetchDashboard("refresh")}
            disabled={refreshing}
            aria-label="Оновити"
            className="font-display inline-flex items-center gap-1.5 rounded-none border border-white/10 bg-white/3 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-blue-500/30 hover:bg-blue-500/5 hover:text-blue-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-50"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", refreshing && "motion-safe:animate-spin")}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">Оновити</span>
          </button>
        </div>
      </header>

      {error ? <AdminInlineAlert tone="warning">{error}</AdminInlineAlert> : null}

      {/* KPI strip — 2 cols mobile, 4 cols desktop. No fake "Active brands" anymore. */}
      <div className="grid auto-rows-fr grid-cols-2 gap-2.5 md:gap-3 lg:grid-cols-4">
        <DashboardKpiCard
          primary
          icon={<DollarSign />}
          label="Дохід"
          value={formatMoney(data.shop.totalRevenuePeriod, "UAH")}
          current={data.shop.totalRevenuePeriod}
          previous={data.shop.totalRevenuePrevPeriod}
          meta={`Середній чек ${formatMoney(data.shop.aov, "UAH")}`}
          spark={data.shop.monthlyRevenue.slice(-12).map((m) => m.paid)}
        />
        <DashboardKpiCard
          icon={<Package />}
          label="Замовлення"
          value={(data.shop.activeOrders + data.crm.activeOrders).toLocaleString()}
          current={data.shop.ordersCountPeriod}
          previous={data.shop.ordersCountPrevPeriod}
          meta={`${data.shop.activeOrders} магазин · ${data.crm.activeOrders} CRM`}
          spark={data.shop.monthlyRevenue.slice(-12).map((m) => m.orders)}
        />
        <DashboardKpiCard
          tone="accent"
          icon={<DollarSign />}
          label="Прибуток CRM"
          value={formatMoney(data.crm.totalProfitPeriod, "USD")}
          current={data.crm.totalProfitPeriod}
          previous={data.crm.totalProfitPrevPeriod}
          meta={periodMarginPct != null ? `Маржа ${periodMarginPct}%` : undefined}
          spark={data.crm.monthlyRevenue.slice(-12).map((m) => m.profit)}
        />
        <DashboardKpiCard
          icon={<Briefcase />}
          label="Заборгованість"
          value={formatMoney(data.crm.totalDebt + data.shop.unpaidTotal, "USD")}
          invertDelta
          meta={`${data.crm.debtors.length} боржників · ${data.shop.unpaidCount} неоплачено`}
        />
      </div>

      {/* GA4 row — only when actually connected (no '—' placeholders). */}
      {data.analytics ? (
        <div className="grid auto-rows-fr grid-cols-2 gap-2.5 md:gap-3 lg:grid-cols-4">
          <DashboardKpiCard
            icon={<BarChart3 />}
            label="Трафік"
            value={data.analytics.activeUsers.toLocaleString("uk-UA")}
            meta={`Активних за ${data.analytics.periodDays} дн`}
          />
          <DashboardKpiCard
            icon={<Target />}
            label="Конверсія"
            value={
              data.analytics.activeUsers > 0
                ? `${((data.shop.ordersCountPeriod / data.analytics.activeUsers) * 100).toFixed(2)}%`
                : "—"
            }
            meta="Замовлення / користувачі"
          />
        </div>
      ) : null}

      {/* Hero sales chart — full width */}
      <WidgetCard
        title="Аналітика продажів"
        action={
          <span className="text-xs text-zinc-500">
            Останні {Math.min(data.shop.monthlyRevenue.length, 14)} періодів
          </span>
        }
      >
        <DashboardSalesChart
          data={data.shop.monthlyRevenue.slice(-14).map((m) => ({
            label: m.month.slice(-2) + (m.month.length > 7 ? "" : " " + m.month.slice(0, 4)),
            primary: m.revenue,
            secondary: m.orders,
          }))}
          primaryLabel="Дохід"
          secondaryLabel="Замовлення"
          currencySymbol="₴"
        />
      </WidgetCard>

      {/* Pipeline + Action Required side-by-side on desktop, stacked mobile */}
      <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <DashboardOrderPipeline
          stages={pipelineStages}
          formatMoney={(v) => formatMoney(v, "UAH")}
          b2cCount={data.shop.b2cOrdersCount}
          b2bCount={data.shop.b2bOrdersCount}
          cancellationRatePct={data.shop.cancellationRate}
        />
        <DashboardActionRequired items={actionItems} />
      </div>

      {/* Recent orders + side lists. Mobile: stacks. Desktop: 2/3 + 1/3. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <WidgetCard
          title="Останні замовлення"
          action={<ViewAllLink href="/admin/shop/orders" />}
          className="lg:col-span-2"
          contentClassName="p-0"
        >
          <DashboardRecentOrdersTable orders={recentOrdersRich} />
        </WidgetCard>

        <div className="space-y-4">
          <WidgetCard title="Топ бренди" action={<ViewAllLink href="/admin/shop" label="Усі" />}>
            <DashboardTopBrands brands={topBrandsList} />
          </WidgetCard>
          <WidgetCard title="Топ товари" action={<ViewAllLink href="/admin/shop" label="Усі" />}>
            <DashboardTopProducts products={topProductsList} />
          </WidgetCard>
        </div>
      </div>

      {/* Operations health — footer banner */}
      <DashboardOpsHealthBanner lights={healthLights} />

      {lastUpdated ? (
        <div className="font-display flex items-center justify-center gap-2 pt-2 text-[12px] text-zinc-500">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden="true" />
          <span>
            Оновлено{" "}
            <span className="tabular-nums">
              {lastUpdated.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}
            </span>{" "}
            · автооновлення кожні 2 хв
          </span>
        </div>
      ) : null}
    </AdminPage>
  );
}
