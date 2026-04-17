'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  TrendingUp, Package, CreditCard, ArrowRight,
  ExternalLink, DollarSign, ShoppingCart, BarChart3,
  ArrowDownRight, Database, Activity, Globe,
  AlertTriangle, Shield, Tag, Users, Zap, ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdminCurrency, type AdminCurrency } from '@/lib/admin/currencyContext';

// ═══════════════════════════════
// Type Definitions
// ═══════════════════════════════

interface DashboardResponse {
  shop: ShopMetrics;
  crm: CrmMetrics;
  system: SystemMetrics;
  period: 'monthly' | 'weekly' | 'daily';
}

interface ShopMetrics {
  totalRevenue: number;
  totalInvoiced: number;
  activeOrders: number;
  totalCustomers: number;
  aov: number;
  totalOrders: number;
  conversionFunnel: { status: string; count: number }[];
  monthlyRevenue: { month: string; revenue: number; paid: number; orders: number }[];
  paymentMethods: { method: string; count: number; revenue: number }[];
  recentOrders: ShopOrderSummary[];
  topProducts: { title: string; revenue: number; quantity: number; orderCount: number }[];
  lowStockItems: { id: string; sku: string; title: string; brand: string; stock: number }[];
}

interface ShopOrderSummary {
  id: string;
  displayId: string;
  total: number;
  currency: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  createdAt: string;
  amountPaid: number;
  customerName: string;
}

interface CrmMetrics {
  totalRevenue: number;
  totalProfit: number;
  totalCost: number;
  avgMargin: number;
  totalCustomers: number;
  totalOrders: number;
  activeOrders: number;
  totalDebt: number;
  statusDistribution: { status: string; count: number }[];
  monthlyRevenue: { month: string; revenue: number; profit: number; orders: number }[];
  brandBreakdown: { brand: string; revenue: number; profit: number; count: number }[];
  recentOrders: CrmOrderSummary[];
  topCustomers: TopCustomer[];
  debtors: { id: string; name: string; balance: number; totalSales: number }[];
}

interface CrmOrderSummary {
  id: string;
  number: number;
  name: string;
  orderStatus: string;
  paymentStatus: string;
  clientTotal: number;
  profit: number;
  orderDate: string | null;
  customerName: string;
}

interface TopCustomer {
  id: string;
  name: string;
  totalSales: number;
  totalProfit: number;
  balance: number;
  orderCount: number;
  tags: string[];
}

interface SystemMetrics {
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
}

// ═══════════════════════════════
// SVG Chart Components
// ═══════════════════════════════

function RevenueChart({ shopData, crmData, period, crmValueKey = 'revenue' }: {
  shopData: { month: string; revenue: number }[];
  crmData: { month: string; revenue: number; profit: number }[];
  period: 'monthly' | 'weekly' | 'daily';
  crmValueKey?: 'revenue' | 'profit';
}) {
  const months = new Set([...shopData.map(d => d.month), ...crmData.map(d => d.month)]);
  const sortedMonths = Array.from(months).sort();
  const maxBars = period === 'daily' ? 30 : period === 'weekly' ? 13 : 12;
  const last = sortedMonths.slice(-maxBars);

  if (last.length === 0) return <div className="text-zinc-600 text-xs text-center py-8">Немає даних</div>;

  const shopMap = new Map(shopData.map(d => [d.month, d.revenue]));
  const crmMap = new Map(crmData.map(d => [d.month, crmValueKey === 'profit' ? d.profit : d.revenue]));

  const combined = last.map(m => ({
    month: m,
    shop: shopMap.get(m) || 0,
    crm: crmMap.get(m) || 0,
  }));

  const maxVal = Math.max(...combined.map(d => Math.max(d.shop, d.crm)), 1);
  const chartH = 160;
  const padB = 24;
  const barGroupW = period === 'daily' ? 30 : 50;

  const formatLabel = (key: string) => {
    if (period === 'daily') {
      // "2026-04-17" → "17.04"
      const parts = key.split('-');
      return `${parts[2]}.${parts[1]}`;
    }
    if (period === 'weekly') {
      // "2026-04-14" (Monday) → "14.04"
      const parts = key.split('-');
      return `${parts[2]}.${parts[1]}`;
    }
    // monthly: "2026-04" → "04"
    return key.slice(5);
  };

  return (
    <svg viewBox={`0 0 ${last.length * barGroupW} ${chartH + padB}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="shopGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id="crmGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map(pct => (
        <line key={pct} x1="0" y1={chartH - chartH * pct} x2={last.length * barGroupW} y2={chartH - chartH * pct}
          stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" />
      ))}

      {combined.map((d, i) => {
        const x = i * barGroupW;
        const shopH = (d.shop / maxVal) * chartH;
        const crmH = (d.crm / maxVal) * chartH;
        const barW = period === 'daily' ? 10 : 16;
        const gap = period === 'daily' ? 2 : 4;
        const offset = period === 'daily' ? 3 : 6;

        return (
          <g key={d.month}>
            {/* CRM bar */}
            <rect x={x + offset} y={chartH - crmH} width={barW} height={Math.max(crmH, 1)}
              fill="url(#crmGrad)" rx="2" className="transition-all duration-500" />
            {/* Shop bar */}
            <rect x={x + offset + barW + gap} y={chartH - shopH} width={barW} height={Math.max(shopH, 1)}
              fill="url(#shopGrad)" rx="2" className="transition-all duration-500" />
            {/* Label */}
            {(period !== 'daily' || i % 2 === 0) && (
              <text x={x + barGroupW / 2} y={chartH + 16} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={period === 'daily' ? '7' : '8'} fontFamily="monospace">
                {formatLabel(d.month)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function FunnelChart({ data }: { data: { status: string; count: number }[] }) {
  const FUNNEL_ORDER = ['PENDING_REVIEW', 'PENDING_PAYMENT', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
  const FUNNEL_COLORS: Record<string, string> = {
    PENDING_REVIEW: '#fbbf24',
    PENDING_PAYMENT: '#f97316',
    CONFIRMED: '#60a5fa',
    PROCESSING: '#818cf8',
    SHIPPED: '#22d3ee',
    DELIVERED: '#34d399',
    CANCELLED: '#f87171',
    REFUNDED: '#fb923c',
  };
  const FUNNEL_LABELS: Record<string, string> = {
    PENDING_REVIEW: 'Очікує',
    PENDING_PAYMENT: 'Оплата',
    CONFIRMED: 'Підтв.',
    PROCESSING: 'Обробка',
    SHIPPED: 'Доставл.',
    DELIVERED: 'Готово',
    CANCELLED: 'Скасов.',
    REFUNDED: 'Повер.',
  };

  const statusMap = new Map(data.map(d => [d.status, d.count]));
  const ordered = FUNNEL_ORDER.map(s => ({
    status: s,
    count: statusMap.get(s) || 0,
    color: FUNNEL_COLORS[s] || '#6b7280',
    label: FUNNEL_LABELS[s] || s,
  }));

  // Add cancelled/refunded at the end
  const cancelled = statusMap.get('CANCELLED') || 0;
  const refunded = statusMap.get('REFUNDED') || 0;

  const maxCount = Math.max(...ordered.map(s => s.count), 1);

  return (
    <div className="space-y-2">
      {ordered.map((s) => (
        <div key={s.status} className="flex items-center gap-3">
          <div className="w-16 text-[9px] uppercase tracking-widest text-zinc-500 font-bold text-right shrink-0">{s.label}</div>
          <div className="flex-1 h-6 rounded-none bg-white/[0.03] overflow-hidden relative group">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max((s.count / maxCount) * 100, s.count > 0 ? 8 : 0)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-none flex items-center justify-end px-2"
              style={{ backgroundColor: s.color + '40', borderLeft: `3px solid ${s.color}` }}
            >
              {s.count > 0 && (
                <span className="text-[10px] font-mono font-bold text-white/80">{s.count}</span>
              )}
            </motion.div>
          </div>
        </div>
      ))}
      {(cancelled > 0 || refunded > 0) && (
        <div className="flex items-center gap-3 mt-1 pt-2 border-t border-white/[0.04]">
          {cancelled > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-none bg-rose-500/10 border border-rose-500/20 text-[10px] font-bold text-rose-400">
              ✕ Скасовано: {cancelled}
            </span>
          )}
          {refunded > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-none bg-orange-500/10 border border-orange-500/20 text-[10px] font-bold text-orange-400">
              ↩ Повернуто: {refunded}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function BrandBreakdownChart({ data, formatMoney }: { data: { brand: string; revenue: number; profit: number; count: number }[]; formatMoney: (amount: number, sourceCurrency: AdminCurrency) => string }) {
  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);

  return (
    <div className="space-y-2.5">
      {data.slice(0, 8).map((b, i) => (
        <div key={b.brand} className="group">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-none bg-zinc-100 text-black/20 border border-indigo-500/30 flex items-center justify-center text-[9px] font-bold text-zinc-400 shrink-0">{i + 1}</span>
              <span className="text-xs text-zinc-300 font-medium truncate max-w-[130px]">{b.brand}</span>
            </div>
            <span className="text-xs text-zinc-400 font-mono">{formatMoney(b.revenue, 'USD')}</span>
          </div>
          <div className="h-2 rounded-none-full bg-white/[0.03] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(b.revenue / maxRevenue) * 100}%` }}
              transition={{ duration: 0.6, delay: 0.05 * i }}
              className="h-full rounded-none-full"
              style={{
                background: `linear-gradient(90deg, rgba(129,140,248,0.6), rgba(129,140,248,0.2))`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DataQualityBadge({ dq }: { dq: SystemMetrics['dataQuality'] }) {
  const score = dq.score;
  const color = score >= 90 ? 'emerald' : score >= 70 ? 'amber' : 'rose';
  const icon = score >= 90 ? <Shield className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />;
  const label = score >= 90 ? 'Відмінно' : score >= 70 ? 'Увага' : 'Критично';

  const colorClasses: Record<string, { border: string; bg: string; text: string }> = {
    emerald: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
    amber: { border: 'border-amber-500/30', bg: 'bg-amber-500/10', text: 'text-amber-400' },
    rose: { border: 'border-rose-500/30', bg: 'bg-rose-500/10', text: 'text-rose-400' },
  };
  const scheme = colorClasses[color];

  return (
    <div className={`rounded-none border ${scheme.border} ${scheme.bg} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={scheme.text}>{icon}</div>
          <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Якість Даних</span>
        </div>
        <div className={`text-xl font-light ${scheme.text}`}>{score}%</div>
      </div>
      <div className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">{label}</div>

      {(dq.ordersWithoutCustomer > 0 || dq.ordersWithZeroTotal > 0 || dq.crmOrdersWithoutDate > 0) && (
        <div className="space-y-1 pt-1">
          {dq.ordersWithoutCustomer > 0 && (
            <div className="flex justify-between text-[10px] text-zinc-500">
              <span>Без клієнта (Shop):</span>
              <span className="text-amber-400 font-mono">{dq.ordersWithoutCustomer}</span>
            </div>
          )}
          {dq.ordersWithZeroTotal > 0 && (
            <div className="flex justify-between text-[10px] text-zinc-500">
              <span>Нульова сума (Shop):</span>
              <span className="text-rose-400 font-mono">{dq.ordersWithZeroTotal}</span>
            </div>
          )}
          {dq.crmOrdersWithoutDate > 0 && (
            <div className="flex justify-between text-[10px] text-zinc-500">
              <span>Без дати (CRM):</span>
              <span className="text-amber-400 font-mono">{dq.crmOrdersWithoutDate}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════
// KPI Card
// ═══════════════════════════════

function KpiCard({ title, value, icon, color, subtitle, source }: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
  source?: { label: string; color: string };
}) {
  const colors: Record<string, { border: string; text: string; iconBg: string }> = {
    indigo: { border: 'border-indigo-500/20 hover:border-indigo-500/40', text: 'text-zinc-400', iconBg: 'bg-zinc-100 text-black/10 border-indigo-500/20' },
    emerald: { border: 'border-emerald-500/20 hover:border-emerald-500/40', text: 'text-emerald-400', iconBg: 'bg-emerald-500/10 border-emerald-500/20' },
    cyan: { border: 'border-cyan-500/20 hover:border-cyan-500/40', text: 'text-cyan-400', iconBg: 'bg-cyan-500/10 border-cyan-500/20' },
    amber: { border: 'border-amber-500/20 hover:border-amber-500/40', text: 'text-amber-400', iconBg: 'bg-amber-500/10 border-amber-500/20' },
    rose: { border: 'border-rose-500/20 hover:border-rose-500/40', text: 'text-rose-400', iconBg: 'bg-rose-500/10 border-rose-500/20' },
  };
  const scheme = colors[color] || colors.indigo;

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
      className={`relative group overflow-hidden rounded-none border border-white/[0.08] backdrop-blur-xl p-5 md:p-6 transition-all shadow-2xl bg-black/40 ${scheme.border}`}>
      <div className="relative flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-none border flex items-center justify-center ${scheme.iconBg}`}>
          <div className={scheme.text}>{icon}</div>
        </div>
        {source && (
          <span className={`px-2 py-0.5 rounded-none text-[8px] uppercase font-bold tracking-[0.15em] border ${source.color}`}>
            {source.label}
          </span>
        )}
      </div>
      <h3 className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mb-1">{title}</h3>
      <div className="text-2xl lg:text-3xl font-light text-white tracking-tight">{value}</div>
      {subtitle && <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mt-2">{subtitle}</p>}
    </motion.div>
  );
}

// ═══════════════════════════════
// Status Helpers
// ═══════════════════════════════

const CRM_STATUS_COLORS: Record<string, string> = {
  'Новый': '#60a5fa', 'В обработке': '#fbbf24', 'В производстве': '#818cf8',
  'В пути': '#22d3ee', 'Выполнен': '#34d399', 'Отменен': '#f87171',
};

// ═══════════════════════════════
// Main Dashboard
// ═══════════════════════════════

export default function AdminDashboardPage() {
  const { formatMoney, symbol, currency } = useAdminCurrency();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [revenuePeriod, setRevenuePeriod] = useState<'monthly' | 'weekly' | 'daily'>('monthly');
  const [crmViewMode, setCrmViewMode] = useState<'revenue' | 'profit'>('revenue');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAll = useCallback(async (isFirst = false) => {
    if (isFirst) setLoading(true);
    try {
      const res = await fetch(`/api/admin/dashboard?period=${revenuePeriod}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastUpdated(new Date());
      }
    } catch (e) {
      console.error('Dashboard fetch error', e);
    } finally {
      if (isFirst) setLoading(false);
    }
  }, [revenuePeriod]);

  useEffect(() => {
    fetchAll(true);
    intervalRef.current = setInterval(() => fetchAll(false), 60000); // every 60s
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchAll]);

  if (loading || !data) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center relative z-20">
        <div className="w-12 h-12 rounded-none-full border-2 border-white/10 border-t-indigo-500 animate-spin mb-6 shadow-[0_0_20px_rgba(99,102,241,0.4)]" />
        <p className="text-zinc-400 uppercase tracking-widest text-sm font-bold animate-pulse">Збір Телеметрії...</p>
      </div>
    );
  }

  const { shop, crm, system } = data;

  return (
    <div className="w-full px-6 md:px-10 py-8 h-full overflow-auto text-white max-w-[1600px] mx-auto z-20 relative">

      {/* ═══ Header ═══ */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-10 gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-none-full border border-indigo-500/30 bg-zinc-100 text-black/10 text-[10px] uppercase font-bold tracking-widest text-zinc-400">
            <Activity className="w-3 h-3" /> Командний Центр
          </div>
          <h1 className="text-4xl lg:text-5xl font-light tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-500">
            Огляд Бізнесу
          </h1>
          <p className="text-sm text-zinc-400 mt-3 max-w-xl leading-relaxed">
            Real-time аналітика з Shop (₴) + Airtable CRM ($) · Відображення в {symbol()}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-none bg-black/40 border border-white/[0.08] backdrop-blur-md">
            <div className="relative flex items-center justify-center">
              <div className="w-2 h-2 bg-emerald-400 rounded-none-full" />
              <div className="absolute inset-0 w-2 h-2 bg-emerald-400 rounded-none-full animate-ping opacity-70" />
            </div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-400 font-bold">Синхронізовано</span>
            {lastUpdated && (
              <span className="text-[10px] text-zinc-500 ml-2 font-mono">{lastUpdated.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Header Actions ═══ */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
        <div className="flex rounded-none overflow-hidden border border-white/[0.08] bg-black/60 w-fit">
          <button onClick={() => setCrmViewMode('revenue')}
            className={`px-4 py-2 text-[10px] uppercase tracking-widest font-bold transition-all ${
              crmViewMode === 'revenue' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
            }`}>
            Виручка (Revenue)
          </button>
          <button onClick={() => setCrmViewMode('profit')}
            className={`px-4 py-2 text-[10px] uppercase tracking-widest font-bold transition-all ${
              crmViewMode === 'profit' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
            }`}>
            Прибуток (Profit)
          </button>
        </div>
      </div>

      {/* ═══ KPI Row ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard title="Виручка (Shop)" value={formatMoney(shop.totalRevenue, 'UAH')}
          icon={<DollarSign className="w-5 h-5" />} color="indigo"
          source={{ label: `Shop ${symbol()}`, color: 'border-indigo-500/30 text-zinc-400 bg-zinc-100 text-black/10' }}
          subtitle={`${shop.totalOrders} замовлень`} />

        <KpiCard title={crmViewMode === 'revenue' ? "CRM Виручка" : "CRM Прибуток"} 
          value={formatMoney(crmViewMode === 'revenue' ? crm.totalRevenue : crm.totalProfit, 'USD')}
          icon={crmViewMode === 'revenue' ? <TrendingUp className="w-5 h-5" /> : <BarChart3 className="w-5 h-5" />} 
          color={crmViewMode === 'revenue' ? "emerald" : "cyan"}
          source={{ label: `CRM ${symbol()}`, color: crmViewMode === 'revenue' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10' }}
          subtitle={crmViewMode === 'revenue' ? `${crm.totalOrders} угод` : `Маржа: ${crm.avgMargin}%`} />

        <KpiCard title="Середній Чек (AOV)" value={formatMoney(shop.aov, 'UAH')}
          icon={<ShoppingCart className="w-5 h-5" />} color="amber"
          source={{ label: `Shop ${symbol()}`, color: 'border-amber-500/30 text-amber-400 bg-amber-500/10' }}
          subtitle={`${shop.activeOrders + crm.activeOrders} активних`} />

        <KpiCard title="Борги (CRM)" value={crm.totalDebt > 0 ? formatMoney(crm.totalDebt, 'USD') : `✓ ${symbol()}0`}
          icon={<CreditCard className="w-5 h-5" />}
          color={crm.totalDebt > 0 ? 'rose' : 'emerald'}
          subtitle={crm.totalDebt > 0 ? `${crm.debtors.length} контрагентів` : 'Всі розрахунки ок'} />
      </div>

      {/* ═══ Revenue Chart ═══ */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-none border border-white/[0.08] bg-black/40 shadow-2xl backdrop-blur-2xl p-6 mb-8 hover:border-indigo-500/15 transition-all">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-bold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-zinc-400" /> Динаміка Виручки
          </h2>
          <div className="flex items-center gap-2">
            {/* Period Switcher */}
            <div className="flex rounded-none overflow-hidden border border-white/[0.08] bg-black/60">
              {(['daily', 'weekly', 'monthly'] as const).map(p => (
                <button key={p} onClick={() => setRevenuePeriod(p)}
                  className={`px-3 py-1.5 text-[9px] uppercase tracking-widest font-bold transition-all ${
                    revenuePeriod === p
                      ? 'bg-zinc-100 text-black/20 text-zinc-400 border-indigo-500/30'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
                  }`}>
                  {p === 'daily' ? 'День' : p === 'weekly' ? 'Тиждень' : 'Місяць'}
                </button>
              ))}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 ml-4">
              <div className="flex items-center gap-1.5">
                <div className={`w-3 h-2 rounded-none ${crmViewMode === 'revenue' ? 'bg-emerald-400/60' : 'bg-cyan-400/60'}`} />
                <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">CRM {crmViewMode === 'profit' ? '(Прибуток)' : ''} ({symbol()})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-2 rounded-none bg-indigo-400/60" />
                <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">Shop ({symbol()})</span>
              </div>
            </div>
          </div>
        </div>
        <RevenueChart shopData={shop.monthlyRevenue} crmData={crm.monthlyRevenue} period={revenuePeriod} crmValueKey={crmViewMode} />
      </motion.div>

      {/* ═══ 2-Column: Funnel + Brands ═══ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        {/* Conversion Funnel */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-none border border-white/[0.08] bg-black/40 shadow-2xl backdrop-blur-2xl p-6 hover:border-amber-500/15 transition-all">
          <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-bold flex items-center gap-2 mb-6">
            <Zap className="w-4 h-4 text-amber-400" /> Конверсійна Воронка (Shop)
          </h2>
          <FunnelChart data={shop.conversionFunnel} />
        </motion.div>

        {/* Brand Breakdown */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          className="rounded-none border border-white/[0.08] bg-black/40 shadow-2xl backdrop-blur-2xl p-6 hover:border-emerald-500/15 transition-all">
          <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-bold flex items-center gap-2 mb-6">
            <Tag className="w-4 h-4 text-emerald-400" /> Дохід по Брендах (CRM)
          </h2>
          {crm.brandBreakdown.length > 0 ? (
            <BrandBreakdownChart data={crm.brandBreakdown} formatMoney={formatMoney} />
          ) : (
            <p className="text-xs text-zinc-600 text-center py-8">Немає даних по брендах</p>
          )}
        </motion.div>
      </div>

      {/* ═══ 3-Column Layout: Orders + Sidebar ═══ */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* ──── Left Column: Orders ──── */}
        <div className="xl:col-span-8 space-y-6">
          {/* CRM Orders */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="rounded-none border border-white/[0.08] bg-black/40 shadow-2xl backdrop-blur-2xl overflow-hidden hover:border-indigo-500/20 transition-all">
            <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.05] bg-white/[0.01]">
              <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-bold flex items-center gap-2">
                <Database className="w-4 h-4 text-zinc-400" /> CRM · Останні Угоди
                <span className="ml-2 px-2 py-0.5 rounded-none text-[8px] border border-emerald-500/30 text-emerald-400 bg-emerald-500/10 font-bold">PostgreSQL</span>
              </h2>
              <Link href="/admin/crm" className="text-[10px] text-white hover:text-zinc-400 px-3 py-1.5 rounded-none border border-white/10 hover:border-indigo-500/30 bg-black/50 transition-all flex items-center gap-1.5 uppercase font-bold tracking-widest">
                Всі Угоди <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    <th className="px-8 py-3 text-[9px] uppercase tracking-widest text-zinc-600 font-bold">№</th>
                    <th className="px-4 py-3 text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Клієнт</th>
                    <th className="px-4 py-3 text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Статус</th>
                    <th className="px-4 py-3 text-[9px] uppercase tracking-widest text-zinc-600 font-bold text-right">Сума</th>
                    <th className="px-8 py-3 text-[9px] uppercase tracking-widest text-zinc-600 font-bold text-right">Маржа</th>
                  </tr>
                </thead>
                <tbody>
                  {crm.recentOrders.slice(0, 6).map((o, i) => (
                    <motion.tr key={o.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.03 * i }}
                      className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                      <td className="px-8 py-4 text-xs text-zinc-500 font-mono">#{o.number}</td>
                      <td className="px-4 py-4 text-sm text-zinc-200 font-medium truncate max-w-[180px]">{o.customerName}</td>
                      <td className="px-4 py-4">
                        <span className="flex items-center gap-2 px-2.5 py-1 w-fit rounded-none-full border border-white/5 bg-black/50">
                          <span className="w-1.5 h-1.5 rounded-none-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: CRM_STATUS_COLORS[o.orderStatus] || '#9ca3af', color: CRM_STATUS_COLORS[o.orderStatus] || '#9ca3af' }} />
                          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">{o.orderStatus}</span>
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-300 font-mono text-right">{formatMoney(o.clientTotal, 'USD')}</td>
                      <td className="px-8 py-4 text-right">
                        <span className={`inline-flex px-2 py-1 rounded-none bg-black/50 text-xs font-mono font-bold border ${o.profit > 0 ? 'text-emerald-400 border-emerald-500/20' : 'text-rose-400 border-rose-500/20'}`}>
                          {o.profit > 0 ? '+' : ''}{formatMoney(o.profit, 'USD')}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Shop Orders */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="rounded-none border border-white/[0.08] bg-black/40 shadow-2xl backdrop-blur-2xl overflow-hidden hover:border-emerald-500/20 transition-all">
            <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.05] bg-white/[0.01]">
              <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-bold flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-400" /> Shop · Замовлення з Сайту
                <span className="ml-2 px-2 py-0.5 rounded-none text-[8px] border border-indigo-500/30 text-zinc-400 bg-zinc-100 text-black/10 font-bold">Shop {symbol()}</span>
              </h2>
              <Link href="/admin/shop/orders" className="text-[10px] text-white hover:text-emerald-400 px-3 py-1.5 rounded-none border border-white/10 hover:border-emerald-500/30 bg-black/50 transition-all flex items-center gap-1.5 uppercase font-bold tracking-widest">
                Всі Замовлення <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    <th className="px-8 py-3 text-[9px] uppercase tracking-widest text-zinc-600 font-bold">ID</th>
                    <th className="px-4 py-3 text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Клієнт</th>
                    <th className="px-4 py-3 text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Сума</th>
                    <th className="px-4 py-3 text-[9px] uppercase tracking-widest text-zinc-600 font-bold">Оплата</th>
                    <th className="px-8 py-3 text-[9px] uppercase tracking-widest text-zinc-600 font-bold text-right">Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {shop.recentOrders.slice(0, 6).map((order, i) => (
                    <motion.tr key={order.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.03 * i }}
                      className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                      <td className="px-8 py-4 text-xs text-zinc-500 font-mono">{order.displayId}</td>
                      <td className="px-4 py-4 text-sm text-zinc-200 font-medium truncate max-w-[160px]">{order.customerName}</td>
                      <td className="px-4 py-4 text-sm text-zinc-300 font-mono">{formatMoney(order.total, 'UAH')}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-2 px-2.5 py-1 w-fit rounded-none-full border border-white/5 bg-black/50 text-[10px] uppercase font-bold tracking-wider ${order.paymentStatus === 'UNPAID' ? 'text-rose-400' : 'text-emerald-400'}`}>
                          <span className={`w-1.5 h-1.5 rounded-none-full shadow-[0_0_8px_currentColor] ${order.paymentStatus === 'UNPAID' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                          {order.paymentStatus === 'UNPAID' ? 'БОРГ' : 'ОПЛАЧЕНО'}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-right">
                        <Link href={`/admin/shop/orders/${order.id}`} className="p-2 rounded-none bg-white/5 hover:bg-white/15 border border-white/10 text-white/50 hover:text-white inline-flex transition-all">
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Top Products */}
          {shop.topProducts.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="rounded-none border border-white/[0.08] bg-black/40 shadow-2xl backdrop-blur-2xl p-6 hover:border-cyan-500/15 transition-all">
              <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-bold flex items-center gap-2 mb-5">
                <TrendingUp className="w-4 h-4 text-cyan-400" /> Топ Продукти (Shop)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {shop.topProducts.slice(0, 6).map((p, i) => (
                  <div key={p.title} className="flex items-center gap-3 p-3 rounded-none bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] transition-colors">
                    <span className="w-7 h-7 rounded-none bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-[10px] font-bold text-cyan-400 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-300 font-medium truncate">{p.title}</p>
                      <p className="text-[10px] text-zinc-500 font-mono">{p.quantity} шт · {p.orderCount} замовл.</p>
                    </div>
                    <span className="text-sm text-white font-mono shrink-0">{formatMoney(p.revenue, 'UAH')}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Low Stock Alerts */}
          {shop.lowStockItems && shop.lowStockItems.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
              className="rounded-none border border-rose-500/20 bg-rose-500/5 shadow-2xl backdrop-blur-2xl p-6 hover:border-rose-500/30 transition-all">
              <h2 className="text-xs uppercase tracking-widest text-rose-400 font-bold flex items-center gap-2 mb-5">
                <AlertTriangle className="w-4 h-4" /> Критичні Залишки (Склад)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {shop.lowStockItems.map((item) => (
                  <div key={item.id} className="flex flex-col gap-1.5 p-3 rounded-none bg-black/40 border border-white/[0.04]">
                    <div className="flex justify-between items-start">
                      <span className="text-[9px] uppercase tracking-widest text-zinc-500">{item.brand}</span>
                      <span className="text-[9px] font-mono text-zinc-600 bg-white/5 px-1.5 py-0.5 rounded-none">{item.sku}</span>
                    </div>
                    <div className="text-xs text-zinc-300 font-medium line-clamp-1">{item.title}</div>
                    <div className="text-[10px] uppercase font-bold mt-1 text-rose-400 tracking-widest flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      Залишок: {item.stock} шт
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* ──── Right Column ──── */}
        <div className="xl:col-span-4 space-y-6">

          {/* Data Quality */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <DataQualityBadge dq={system.dataQuality} />
          </motion.div>

          {/* Turn14 Sync */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="rounded-none border border-white/[0.08] bg-black/40 shadow-2xl backdrop-blur-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Globe className="w-16 h-16 text-zinc-200" />
            </div>
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 font-bold mb-5 flex items-center gap-2">
              <Activity className={`w-3 h-3 ${system.turn14Stats.syncing ? 'text-emerald-400 animate-pulse' : 'text-zinc-500'}`} />
              Turn14 Sync
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="p-3 rounded-none bg-white/[0.02] border border-white/[0.04]">
                <div className="text-[9px] uppercase tracking-widest text-zinc-500 mb-1">Брендів</div>
                <div className="text-2xl font-light text-white">{system.turn14Stats.total}</div>
              </div>
              <div className="p-3 rounded-none bg-white/[0.02] border border-white/[0.04]">
                <div className="text-[9px] uppercase tracking-widest text-zinc-500 mb-1">Синхронізуються</div>
                <div className="text-2xl font-light text-emerald-400">{system.turn14Stats.syncing}</div>
              </div>
            </div>
            {system.turn14Stats.latestSync && (
              <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-2">
                <span className="w-1 h-1 rounded-none-full bg-zinc-100 text-black shadow-[0_0_5px_rgba(99,102,241,0.5)]" />
                Oновлено: {new Date(system.turn14Stats.latestSync).toLocaleString('uk-UA')}
              </div>
            )}
            <Link href="/admin/shop/turn14" className="mt-5 block w-full py-2.5 text-center rounded-none bg-white/[0.03] border border-white/10 text-[10px] uppercase font-bold tracking-widest hover:bg-white/10 hover:border-indigo-500/30 transition-all text-zinc-300">
              Database Manager
            </Link>
          </motion.div>

          {/* VIP Customers */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="rounded-none border border-white/[0.08] bg-black/40 shadow-2xl backdrop-blur-2xl p-6">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 font-bold mb-5 flex items-center gap-2">
              <Users className="w-4 h-4 text-zinc-400" /> VIP Акаунти (CRM)
            </h3>
            <div className="space-y-3">
              {crm.topCustomers.slice(0, 5).map((c, i) => (
                <div key={c.id} className="flex flex-col p-3 rounded-none bg-white/[0.02] border border-white/[0.03] hover:bg-white/[0.05] transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-none bg-zinc-100 text-black/20 border border-indigo-500/30 flex items-center justify-center text-[10px] font-bold text-zinc-400">{i + 1}</div>
                      <span className="text-sm text-zinc-200 font-medium truncate max-w-[130px]">{c.name}</span>
                    </div>
                    <span className="text-sm text-white font-mono">{formatMoney(c.totalSales, 'USD')}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-zinc-500 font-mono">{c.orderCount} замовл.</span>
                    {c.balance !== 0 && (
                      <span className={`inline-flex px-2 py-0.5 rounded-none text-[10px] uppercase font-bold tracking-widest items-center gap-1 ${c.balance < 0 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                        <ArrowDownRight className="w-3 h-3" />
                        {formatMoney(Math.abs(c.balance), 'USD')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {crm.topCustomers.length === 0 && (
                <p className="text-xs text-zinc-500 text-center py-6 font-medium uppercase tracking-widest">Немає даних CRM</p>
              )}
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="rounded-none border border-amber-500/20 bg-amber-500/5 shadow-2xl backdrop-blur-2xl p-6">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-amber-500/70 font-bold mb-4">Навігатор Дій</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: '/admin/shop/orders/create', label: 'Новий Чек', icon: <ShoppingCart className="w-4 h-4" /> },
                { href: '/admin/shop/stock', label: 'CSV Імпорт', icon: <Database className="w-4 h-4" /> },
                { href: '/admin/backups', label: 'БД Бекап', icon: <Package className="w-4 h-4" /> },
                { href: '/admin/shop/turn14/markups', label: 'ROI (Націнки)', icon: <DollarSign className="w-4 h-4" /> },
                { href: '/admin/crm', label: 'CRM Угоди', icon: <BarChart3 className="w-4 h-4" /> },
                { href: '/admin/shop/orders', label: 'Shop Замов.', icon: <Package className="w-4 h-4" /> },
              ].map(action => (
                <Link key={action.href} href={action.href}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-none bg-black/40 border border-white/[0.06] text-zinc-400 hover:text-amber-400 hover:border-amber-500/40 hover:bg-black/60 transition-all font-semibold uppercase tracking-widest text-[9px] text-center shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                  {action.icon}
                  <span>{action.label}</span>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* CRM Sync Info */}
          {system.lastCrmSyncAt && (
            <div className="text-center text-[10px] text-zinc-600 font-mono">
              CRM Sync: {new Date(system.lastCrmSyncAt).toLocaleString('uk-UA')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
