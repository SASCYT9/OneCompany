'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  TrendingUp, Package, CreditCard, ArrowRight,
  ExternalLink, DollarSign, ShoppingCart, BarChart3,
  ArrowUpRight, ArrowDownRight, Database, Loader2, Activity, Globe
} from 'lucide-react';
import { motion } from 'framer-motion';

type DashboardData = {
  totalRevenue: string | number;
  activeOrders: number;
  totalDebt: string | number;
  totalCustomers: number;
  turn14Stats?: {
    total: number;
    syncing: number;
    idle: number;
    latestSync: string | null;
  };
  recentOrders: Array<{
    id: string;
    displayId: string;
    total: string | number;
    currency: string;
    status: string;
    paymentStatus: string;
    createdAt: string;
    customerName: string;
  }>;
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
};

type CrmCustomer = {
  id: string;
  name: string;
  balance: number;
  whoOwes: string;
  totalSales: number;
  orderCount: number;
};

type CrmDbStats = {
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

// ═══════════════════════════════
// SVG Chart Components (Inline)
// ═══════════════════════════════

function SparklineChart({ data, color = '#6366f1', height = 36, width = 110 }: { data: number[]; color?: string; height?: number; width?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
  return (
    <svg width={width} height={height} className="opacity-80">
      <defs>
        <linearGradient id={`sp-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
      <polygon fill={`url(#sp-${color.replace('#', '')})`} points={`0,${height} ${points} ${width},${height}`} />
    </svg>
  );
}

function MiniDonut({ segments, size = 100 }: { segments: { value: number; color: string }[]; size?: number }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;
  const cx = size / 2, cy = size / 2, r = size / 2 - 8;
  const circumference = 2 * Math.PI * r;
  let cumul = 0;
  return (
    <svg width={size} height={size} className="drop-shadow-xl">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={12} />
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const offset = circumference * cumul;
        const dash = circumference * pct;
        cumul += pct;
        return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={12}
          strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset}
          strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} className="transition-all duration-700" />;
      })}
      <text x={cx} y={cy + 5} textAnchor="middle" fill="white" fontSize="18" fontWeight="300" className="opacity-80">{total}</text>
    </svg>
  );
}

// ═══════════════════════════════
// Main Dashboard
// ═══════════════════════════════

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [crmOrders, setCrmOrders] = useState<CrmOrder[]>([]);
  const [crmCustomers, setCrmCustomers] = useState<CrmCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [crmDbStats, setCrmDbStats] = useState<CrmDbStats>(null);

  const fetchAll = useCallback(async (isFirst = false) => {
    if (isFirst) setLoading(true);
    try {
      const [dashRes, ordRes, custRes] = await Promise.allSettled([
        fetch('/api/admin/dashboard').then(r => r.ok ? r.json() : null),
        fetch('/api/admin/crm?type=orders&maxRecords=50').then(r => r.json()),
        fetch('/api/admin/crm/link-customer').then(r => r.json()),
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value) setData(dashRes.value);
      if (ordRes.status === 'fulfilled') setCrmOrders(ordRes.value?.data || []);
      if (custRes.status === 'fulfilled') setCrmCustomers(custRes.value?.data || []);
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Dashboard fetch error', e);
    } finally {
      if (isFirst) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll(true);
    intervalRef.current = setInterval(() => fetchAll(false), 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchAll]);

  useEffect(() => {
    fetch('/api/webhooks/airtable', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }).catch(() => {});
    fetch('/api/admin/crm/analytics?type=dashboard').then(r => r.json()).then(d => setCrmDbStats(d)).catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center relative z-20">
        <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-indigo-500 animate-spin mb-6 shadow-[0_0_20px_rgba(99,102,241,0.4)]"></div>
        <p className="text-indigo-400 uppercase tracking-widest text-sm font-bold animate-pulse">Збір Телеметрії...</p>
      </div>
    );
  }

  const STATUS_LABELS: Record<string, string> = {
    'Новый': 'Новий', 'В обработке': 'В обробці', 'В производстве': 'У виробництві',
    'В пути': 'В дорозі', 'Выполнен': 'Виконано', 'Отменен': 'Скасовано',
  };
  const localizeStatus = (s: string) => STATUS_LABELS[s] || s;

  const crmRevenue = crmOrders.reduce((s, o) => s + (o.clientTotal || 0), 0);
  const crmProfit = crmOrders.reduce((s, o) => s + (o.profit || 0), 0);
  const crmActiveOrders = crmOrders.filter(o => !['Выполнен', 'Отменен'].includes(o.orderStatus)).length;
  const crmDebtCustomers = crmCustomers.filter(c => c.balance < 0);
  const totalDebtAmount = crmDebtCustomers.reduce((s, c) => s + Math.abs(c.balance), 0);

  const STATUS_COLORS: Record<string, string> = {
    'Новий': '#60a5fa', 'В обробці': '#fbbf24', 'У виробництві': '#818cf8',
    'В дорозі': '#22d3ee', 'Виконано': '#34d399', 'Скасовано': '#f87171',
  };

  const statusCounts = crmOrders.reduce((acc, o) => {
    const localized = localizeStatus(o.orderStatus);
    acc[localized] = (acc[localized] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const donutSegments = Object.entries(statusCounts).map(([label, value]) => ({
    value, color: STATUS_COLORS[label] || '#9ca3af',
  }));

  const revSparkline = crmOrders.slice(0, 15).reverse().map(o => o.clientTotal || 0);
  const profSparkline = crmOrders.slice(0, 15).reverse().map(o => o.profit || 0);
  const topClients = [...crmCustomers].sort((a, b) => b.totalSales - a.totalSales).slice(0, 5);

  return (
    <div className="w-full px-6 md:px-10 py-8 h-full overflow-auto text-white max-w-[1600px] mx-auto z-20 relative">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-10 gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-[10px] uppercase font-bold tracking-widest text-indigo-400">
            <Activity className="w-3 h-3" /> One Company Live
          </div>
          <h1 className="text-4xl lg:text-5xl font-light tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-500">
            Огляд Бізнесу
          </h1>
          <p className="text-sm text-zinc-400 mt-3 max-w-xl leading-relaxed">
            Глобальні фінансові показники інтегровані з Shop + CRM (Airtable Live).
          </p>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-black/40 border border-white/[0.08] backdrop-blur-md">
            <div className="relative flex items-center justify-center">
              <div className="w-2 h-2 bg-emerald-400 rounded-full" />
              <div className="absolute inset-0 w-2 h-2 bg-emerald-400 rounded-full animate-ping opacity-70" />
            </div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-400 font-bold">Синхронізовано</span>
            {lastUpdated && (
              <span className="text-[10px] text-zinc-500 ml-2 font-mono">{lastUpdated.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            )}
          </div>
        </div>
      </div>

      {/* ═══ KPI Row ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <KpiCard title="Дохід (Shop)" value={data ? `€${Number(data.totalRevenue).toLocaleString('en', { minimumFractionDigits: 0 })}` : '—'}
          icon={<DollarSign className="w-5 h-5" />} color="indigo" />
          
        <KpiCard title="CRM Виручка" value={`$${crmRevenue.toLocaleString()}`}
          icon={<TrendingUp className="w-5 h-5" />} color="emerald"
          sparkline={<SparklineChart data={revSparkline} color="#34d399" />} />
          
        <KpiCard title="CRM Прибуток" value={`$${crmProfit.toLocaleString()}`}
          icon={<BarChart3 className="w-5 h-5" />} color="cyan"
          sparkline={<SparklineChart data={profSparkline} color="#22d3ee" />} />
          
        <KpiCard title="Активні" value={`${(data?.activeOrders || 0) + crmActiveOrders}`}
          icon={<Package className="w-5 h-5" />} color="amber"
          subtitle={`Shop: ${data?.activeOrders || 0} · CRM: ${crmActiveOrders}`} />
          
        <KpiCard title="Борги" value={totalDebtAmount > 0 ? `$${totalDebtAmount.toLocaleString()}` : '✓ $0'}
          icon={<CreditCard className="w-5 h-5" />}
          color={totalDebtAmount > 0 ? 'rose' : 'emerald'}
          subtitle={totalDebtAmount > 0 ? `${crmDebtCustomers.length} контрагентів` : 'Всі розрахунки ок'} />
      </div>

      {/* CRM DB Analytics Row */}
      {crmDbStats && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-10 p-5 rounded-3xl bg-black/30 border border-white/[0.06] backdrop-blur-xl">
          {[
            { label: 'DB Клієнти', value: crmDbStats.kpis.totalCustomers },
            { label: 'DB Замовлення', value: crmDbStats.kpis.totalOrders },
            { label: 'DB Позиції', value: crmDbStats.kpis.totalItems },
            { label: 'DB Виручка', value: `$${crmDbStats.kpis.totalRevenue.toLocaleString()}` },
            { label: 'DB Прибуток', value: `$${crmDbStats.kpis.totalProfit.toLocaleString()}` },
            { label: 'Маржа', value: `${crmDbStats.kpis.avgMargin}%`, isHighlight: true },
          ].map(item => (
            <div key={item.label} className={`rounded-2xl border px-4 py-3 bg-white/[0.02] transition-colors hover:bg-white/[0.05] flex flex-col justify-center ${
              item.isHighlight ? 'border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'border-white/[0.04]'
            }`}>
              <div className="text-[9px] uppercase tracking-widest text-zinc-500 mb-1">{item.label}</div>
              <div className={`text-xl font-light ${item.isHighlight ? 'text-indigo-400' : 'text-zinc-200'}`}>
                {item.value}
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* ═══ 3-Column Layout ═══ */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* ──── Left Column: Orders + CRM orders ──── */}
        <div className="xl:col-span-8 space-y-6">
          {/* CRM Orders */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="rounded-3xl border border-white/[0.08] bg-black/40 shadow-2xl backdrop-blur-2xl overflow-hidden hover:border-indigo-500/20 transition-all">
            <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.05] bg-white/[0.01]">
              <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-bold flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-400" /> Airtable CRM · Останні Угоди
              </h2>
              <Link href="/admin/crm" className="text-[10px] text-white hover:text-indigo-400 px-3 py-1.5 rounded-lg border border-white/10 hover:border-indigo-500/30 bg-black/50 transition-all flex items-center gap-1.5 uppercase font-bold tracking-widest">
                Всі Угоди <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <tbody>
                  {crmOrders.slice(0, 6).map((o, i) => (
                    <motion.tr key={o.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.03 * i }}
                      className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors group">
                      <td className="px-8 py-4 text-xs text-zinc-500 font-mono">#{o.number}</td>
                      <td className="px-4 py-4 text-sm text-zinc-200 font-medium truncate max-w-[180px]">{o.name}</td>
                      <td className="px-4 py-4">
                        <span className="flex items-center gap-2 px-2.5 py-1 w-fit rounded-full border border-white/5 bg-black/50">
                          <span className="w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: STATUS_COLORS[o.orderStatus] || '#9ca3af', color: STATUS_COLORS[o.orderStatus] || '#9ca3af' }} />
                          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">{o.orderStatus}</span>
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-300 font-mono text-right">${o.clientTotal.toLocaleString()}</td>
                      <td className="px-8 py-4 text-right">
                        <span className={`inline-flex px-2 py-1 rounded bg-black/50 text-xs font-mono font-bold border ${o.profit > 0 ? 'text-emerald-400 border-emerald-500/20' : 'text-rose-400 border-rose-500/20'}`}>
                          {o.profit > 0 ? '+' : ''}${o.profit.toFixed(0)}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Recent Shop Orders */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-white/[0.08] bg-black/40 shadow-2xl backdrop-blur-2xl overflow-hidden hover:border-emerald-500/20 transition-all">
            <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.05] bg-white/[0.01]">
              <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-bold flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-400" /> Сайт · Останні Кошики
              </h2>
              <Link href="/admin/shop/orders" className="text-[10px] text-white hover:text-emerald-400 px-3 py-1.5 rounded-lg border border-white/10 hover:border-emerald-500/30 bg-black/50 transition-all flex items-center gap-1.5 uppercase font-bold tracking-widest">
                Всі Замовлення <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <tbody>
                  {(data?.recentOrders || []).slice(0, 6).map((order, i) => (
                    <motion.tr key={order.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.03 * i }}
                      className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors group">
                      <td className="px-8 py-4 text-xs text-zinc-500 font-mono">{order.displayId}</td>
                      <td className="px-4 py-4 text-sm text-zinc-200 font-medium truncate max-w-[160px]">{order.customerName}</td>
                      <td className="px-4 py-4 text-sm text-zinc-300 font-mono">{Number(order.total).toFixed(0)} {order.currency}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-2 px-2.5 py-1 w-fit rounded-full border border-white/5 bg-black/50 text-[10px] uppercase font-bold tracking-wider ${order.paymentStatus === 'UNPAID' ? 'text-rose-400' : 'text-emerald-400'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor] ${order.paymentStatus === 'UNPAID' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                          {order.paymentStatus === 'UNPAID' ? 'БОРГ' : 'ОПЛАЧЕНО'}
                        </span>
                      </td>
                      <td className="px-8 py-4 text-right">
                        <Link href={`/admin/shop/orders/${order.id}`} className="p-2 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-white/50 hover:text-white inline-flex transition-all">
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>

        {/* ──── Right Column: Charts + QuickActions ──── */}
        <div className="xl:col-span-4 space-y-6">
          {/* Turn14 Sync Status */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="rounded-3xl border border-white/[0.08] bg-black/40 shadow-2xl backdrop-blur-2xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Globe className="w-16 h-16 text-indigo-500" />
            </div>
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 font-bold mb-5 flex items-center gap-2">
              <Activity className={`w-3 h-3 ${data?.turn14Stats?.syncing ? 'text-emerald-400 animate-pulse' : 'text-zinc-500'}`} />
              Turn14 Sync Status
            </h3>
            
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                <div className="text-[9px] uppercase tracking-widest text-zinc-500 mb-1">Брендів</div>
                <div className="text-2xl font-light text-white">{data?.turn14Stats?.total || 0}</div>
              </div>
              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                <div className="text-[9px] uppercase tracking-widest text-zinc-500 mb-1">Активні</div>
                <div className="text-2xl font-light text-emerald-400">{data?.turn14Stats?.syncing || 0}</div>
              </div>
            </div>

            {data?.turn14Stats?.latestSync && (
              <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-indigo-500 shadow-[0_0_5px_rgba(99,102,241,0.5)]" />
                Last Update: {new Date(data.turn14Stats.latestSync).toLocaleString('uk-UA')}
              </div>
            )}
            
            <Link href="/admin/shop/turn14" className="mt-5 block w-full py-2.5 text-center rounded-xl bg-white/[0.03] border border-white/10 text-[10px] uppercase font-bold tracking-widest hover:bg-white/10 hover:border-indigo-500/30 transition-all text-zinc-300">
              Database Manager
            </Link>
          </motion.div>

          {/* Status Distribution Mini */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="rounded-3xl border border-white/[0.08] bg-black/40 shadow-2xl backdrop-blur-2xl p-6">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 font-bold mb-6">Pipeline Аналітика</h3>
            <div className="flex flex-col items-center gap-6">
              <MiniDonut segments={donutSegments} size={140} />
              <div className="w-full space-y-2">
                {Object.entries(statusCounts).map(([label, count]) => (
                  <div key={label} className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/[0.03]">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded shadow-[0_0_8px_currentColor]" style={{ backgroundColor: STATUS_COLORS[label] || '#9ca3af', color: STATUS_COLORS[label] || '#9ca3af' }} />
                      <span className="text-zinc-300 text-xs font-semibold uppercase tracking-wider">{label}</span>
                    </div>
                    <span className="text-white font-mono">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Top Clients */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="rounded-3xl border border-white/[0.08] bg-black/40 shadow-2xl backdrop-blur-2xl p-6">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 font-bold mb-5">VIP Акаунти</h3>
            <div className="space-y-3">
              {topClients.map((c, i) => (
                <div key={i} className="flex flex-col p-3 rounded-2xl bg-white/[0.02] border border-white/[0.03] hover:bg-white/[0.05] transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-[10px] font-bold text-indigo-400">{i + 1}</div>
                      <span className="text-sm text-zinc-200 font-medium truncate max-w-[150px]">{c.name}</span>
                    </div>
                    <span className="text-sm text-white font-mono">${c.totalSales.toLocaleString()}</span>
                  </div>
                  {c.balance !== 0 && (
                    <div className="flex justify-end">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest flex items-center gap-1 ${c.balance < 0 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                        {c.balance < 0 ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        БОРГ ${Math.abs(c.balance).toFixed(0)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
              {topClients.length === 0 && (
                <p className="text-xs text-zinc-500 text-center py-6 font-medium uppercase tracking-widest">Немає даних CRM</p>
              )}
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="rounded-3xl border border-amber-500/20 bg-amber-500/5 shadow-2xl backdrop-blur-2xl p-6">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-amber-500/70 font-bold mb-4">Навігатор Дій</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: '/admin/shop/orders/create', label: 'Новий Чек', icon: <ShoppingCart className="w-4 h-4" /> },
                { href: '/admin/shop/stock', label: 'CSV Імпорт', icon: <Database className="w-4 h-4" /> },
                { href: '/admin/backups', label: 'Створити БД Бекап', icon: <Package className="w-4 h-4" /> },
                { href: '/admin/shop/turn14/markups', label: 'ROI (Націнки)', icon: <DollarSign className="w-4 h-4" /> },
              ].map(action => (
                <Link key={action.href} href={action.href}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-black/40 border border-white/[0.06] text-zinc-400 hover:text-amber-400 hover:border-amber-500/40 hover:bg-black/60 transition-all font-semibold uppercase tracking-widest text-[9px] text-center shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                  {action.icon}
                  <span>{action.label}</span>
                </Link>
              ))}
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════
// Components
// ═══════════════════════════════

function KpiCard({ title, value, icon, color, sparkline, subtitle }: {
  title: string; value: string; icon: React.ReactNode; color: string;
  sparkline?: React.ReactNode; subtitle?: string;
}) {
  const colors: Record<string, { bg: string, border: string, text: string, iconBg: string }> = {
    indigo: { bg: 'bg-black/40', border: 'border-indigo-500/20 hover:border-indigo-500/40', text: 'text-indigo-400', iconBg: 'bg-indigo-500/10 border-indigo-500/20' },
    emerald: { bg: 'bg-black/40', border: 'border-emerald-500/20 hover:border-emerald-500/40', text: 'text-emerald-400', iconBg: 'bg-emerald-500/10 border-emerald-500/20' },
    cyan: { bg: 'bg-black/40', border: 'border-cyan-500/20 hover:border-cyan-500/40', text: 'text-cyan-400', iconBg: 'bg-cyan-500/10 border-cyan-500/20' },
    amber: { bg: 'bg-black/40', border: 'border-amber-500/20 hover:border-amber-500/40', text: 'text-amber-400', iconBg: 'bg-amber-500/10 border-amber-500/20' },
    rose: { bg: 'bg-black/40', border: 'border-rose-500/20 hover:border-rose-500/40', text: 'text-rose-400', iconBg: 'bg-rose-500/10 border-rose-500/20' },
  };

  const scheme = colors[color] || colors.indigo;

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
      className={`relative group overflow-hidden rounded-3xl border border-white/[0.08] backdrop-blur-xl p-5 md:p-6 transition-all shadow-2xl ${scheme.bg} ${scheme.border}`}>
      
      {/* Subtle background glow */}
      <div className={`absolute inset-0 bg-gradient-to-br from-${color}-500/5 to-transparent pointer-events-none`} />
      
      <div className="relative flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${scheme.iconBg}`}>
          <div className={scheme.text}>{icon}</div>
        </div>
      </div>
      
      <h3 className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mb-1">{title}</h3>
      <div className="text-3xl font-light text-white tracking-tight mb-1">{value}</div>
      
      {subtitle && <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mt-2">{subtitle}</p>}
      
      {sparkline && (
        <div className="mt-4 -mx-2 -mb-2 overflow-hidden flex justify-center opacity-80 group-hover:opacity-100 transition-opacity">
          {sparkline}
        </div>
      )}
    </motion.div>
  );
}

