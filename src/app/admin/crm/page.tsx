'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw, Users, ShoppingCart, DollarSign, TrendingUp,
  Link2, Check, AlertCircle, ArrowUpRight, ArrowDownRight,
  Database, BarChart3, Loader2, ExternalLink, Search, Wifi
} from 'lucide-react';

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
};

const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds

// Standardized USD formatting: $XX,XXX.XX
function fmtUsd(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ═══════════════════════════════════════
// SVG Mini-Chart Components
// ═══════════════════════════════════════

function SparklineChart({ data, color = '#6366f1', height = 40, width = 120 }: { data: number[]; color?: string; height?: number; width?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);

  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');

  return (
    <svg width={width} height={height} className="opacity-60">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
      <polygon
        fill={`url(#grad-${color.replace('#', '')})`}
        points={`0,${height} ${points} ${width},${height}`}
      />
    </svg>
  );
}

function DonutChart({ segments, size = 120 }: { segments: { value: number; color: string; label: string }[]; size?: number }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  const strokeWidth = 12;
  let cumulativePercent = 0;

  const circumference = 2 * Math.PI * r;

  return (
    <svg width={size} height={size}>
      {/* Background ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
      {segments.map((seg, i) => {
        const percent = seg.value / total;
        const offset = circumference * cumulativePercent;
        const dashLength = circumference * percent;
        cumulativePercent += percent;

        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            className="transition-all duration-700"
          />
        );
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fontSize="18" fontWeight="300">{total}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9" letterSpacing="0.1em">TOTAL</text>
    </svg>
  );
}

function BarChartSvg({ data, height = 120, width = 280 }: { data: { label: string; value: number; color: string }[]; height?: number; width?: number }) {
  const max = Math.max(...data.map(d => d.value)) || 1;
  const barWidth = Math.min(24, (width - data.length * 4) / data.length);
  const chartHeight = height - 24;

  return (
    <svg width={width} height={height} className="mx-auto">
      {data.map((d, i) => {
        const barH = (d.value / max) * chartHeight;
        const x = i * (barWidth + 8) + 4;
        const y = chartHeight - barH;

        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={barH} fill={d.color} rx="2" className="transition-all duration-500" opacity="0.8" />
            <text x={x + barWidth / 2} y={height - 4} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="7" letterSpacing="0.05em">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════
// Main CRM Dashboard
// ═══════════════════════════════════════

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

export default function CrmDashboardPage() {
  const [customers, setCustomers] = useState<CrmCustomer[]>([]);
  const [orders, setOrders] = useState<CrmOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'orders'>('overview');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLive, setIsLive] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [dbAnalytics, setDbAnalytics] = useState<CrmDbAnalytics>(null);

  const fetchData = useCallback(async (isFirstLoad = false) => {
    if (isFirstLoad) setLoading(true);
    try {
      const [custRes, ordRes] = await Promise.all([
        fetch('/api/admin/crm/link-customer').then(r => r.json()),
        fetch('/api/admin/crm?type=orders&maxRecords=100').then(r => r.json()),
      ]);
      const clientList: CrmCustomer[] = custRes.data || [];
      setCustomers(clientList);

      // Filter orders: only show orders from actual clients (not suppliers)
      // Cross-reference order customerIds with known client IDs
      const clientIds = new Set(clientList.map(c => c.id));
      const allOrders: CrmOrder[] = ordRes.data || [];
      const clientOrders = allOrders.filter(o => {
        if (!o.customerIds || o.customerIds.length === 0) return false;
        return o.customerIds.some(cid => clientIds.has(cid));
      });
      setOrders(clientOrders);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch CRM data:', err);
    } finally {
      if (isFirstLoad) setLoading(false);
    }
  }, []);

  // Initial load + auto-refresh every 30s
  useEffect(() => {
    fetchData(true);

    intervalRef.current = setInterval(() => {
      fetchData(false);
    }, AUTO_REFRESH_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  // Also trigger background DB sync on first load + load DB analytics
  useEffect(() => {
    fetch('/api/webhooks/airtable', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } })
      .catch(() => {}); // fire-and-forget
    fetch('/api/admin/crm/analytics?type=dashboard')
      .then(r => r.json())
      .then(data => setDbAnalytics(data))
      .catch(() => {});
  }, []);

  const handleFullSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/admin/crm/full-sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setSyncResult(`✓ Синхронізовано: ${data.customers?.synced || 0} клієнтів, ${data.orders?.synced || 0} замовлень`);
      // Reload analytics
      fetch('/api/admin/crm/analytics?type=dashboard').then(r => r.json()).then(setDbAnalytics).catch(() => {});
      await fetchData(false);
    } catch (err: any) {
      setSyncResult(`✗ ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // Computed stats
  const totalRevenue = orders.reduce((s, o) => s + (o.clientTotal || 0), 0);
  const totalProfit = orders.reduce((s, o) => s + (o.profit || 0), 0);
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const paidOrders = orders.filter(o => o.paymentStatus === 'Оплачено').length;
  const unpaidOrders = orders.filter(o => o.paymentStatus !== 'Оплачено').length;
  const activeOrders = orders.filter(o => !['Выполнен', 'Отменен'].includes(o.orderStatus)).length;

  // Order status distribution
  const statusGroups = orders.reduce((acc, o) => {
    const s = o.orderStatus || 'Unknown';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const STATUS_COLORS: Record<string, string> = {
    'Новый': '#3b82f6',
    'В обработке': '#f59e0b',
    'В производстве': '#8b5cf6',
    'В пути': '#06b6d4',
    'Выполнен': '#22c55e',
    'Отменен': '#ef4444',
  };

  const statusSegments = Object.entries(statusGroups).map(([label, value]) => ({
    label,
    value,
    color: STATUS_COLORS[label] || '#6b7280',
  }));

  // Monthly revenue sparkline (from last 12 orders)
  const revenueSparkline = orders.slice(0, 12).reverse().map(o => o.clientTotal || 0);
  const profitSparkline = orders.slice(0, 12).reverse().map(o => o.profit || 0);

  // Top customers by sales
  const topCustomers = [...customers]
    .sort((a, b) => b.totalSales - a.totalSales)
    .slice(0, 8);

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredOrders = orders.filter(o =>
    o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.number.toString().includes(searchQuery)
  );

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-white flex items-center gap-3">
            <Database className="w-6 h-6 text-indigo-400" />
            CRM Dashboard
          </h1>
          <p className="text-xs text-white/30 mt-1 tracking-wide">
            Airtable · Tuning Delivery Database · {customers.length} клієнтів · {orders.length} замовлень
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Full Sync */}
          <button
            onClick={handleFullSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-500/20 bg-indigo-500/5 text-sm text-indigo-400 hover:bg-indigo-500/10 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Синхронізація...' : 'Повна синхронізація'}
          </button>
          {/* Live indicator */}
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
            <div className="relative">
              <div className="w-2 h-2 bg-emerald-400 rounded-full" />
              <div className="absolute inset-0 w-2 h-2 bg-emerald-400 rounded-full animate-ping opacity-50" />
            </div>
            <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-medium">LIVE</span>
          </div>
          {lastUpdated && (
            <span className="text-[10px] text-white/20">
              {lastUpdated.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <span className="text-[9px] text-white/15">auto-refresh 30s</span>
        </div>
      </div>

      {/* Sync Result */}
      {syncResult && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm ${syncResult.startsWith('✓') ? 'bg-emerald-900/20 text-emerald-300' : 'bg-red-900/20 text-red-300'}`}>
          {syncResult}
        </div>
      )}

      {/* DB Analytics Row */}
      {dbAnalytics && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-6 gap-2">
          <div className="bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2">
            <div className="text-[8px] uppercase tracking-widest text-white/25">DB Клієнти</div>
            <div className="text-sm font-light text-white mt-0.5">{dbAnalytics.kpis.totalCustomers}</div>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2">
            <div className="text-[8px] uppercase tracking-widest text-white/25">DB Замовлення</div>
            <div className="text-sm font-light text-white mt-0.5">{dbAnalytics.kpis.totalOrders}</div>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2">
            <div className="text-[8px] uppercase tracking-widest text-white/25">DB Позицій</div>
            <div className="text-sm font-light text-white mt-0.5">{dbAnalytics.kpis.totalItems}</div>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2">
            <div className="text-[8px] uppercase tracking-widest text-white/25">DB Виручка</div>
            <div className="text-sm font-light text-white mt-0.5">${dbAnalytics.kpis.totalRevenue.toLocaleString()}</div>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2">
            <div className="text-[8px] uppercase tracking-widest text-white/25">DB Прибуток</div>
            <div className="text-sm font-light text-emerald-400 mt-0.5">${dbAnalytics.kpis.totalProfit.toLocaleString()}</div>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2">
            <div className="text-[8px] uppercase tracking-widest text-white/25">Остання синхр.</div>
            <div className="text-[10px] font-light text-white/50 mt-0.5">{dbAnalytics.lastSyncAt ? new Date(dbAnalytics.lastSyncAt).toLocaleString('uk-UA') : 'Ніколи'}</div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 bg-white/[0.02] rounded-xl p-1 mb-8 border border-white/5">
        {(['overview', 'customers', 'orders'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-xs uppercase tracking-widest font-medium rounded-lg transition-all ${
              activeTab === tab
                ? 'bg-white/10 text-white shadow-lg'
                : 'text-white/30 hover:text-white/60'
            }`}
          >
            {tab === 'overview' ? '📊 Огляд' : tab === 'customers' ? '👥 Клієнти' : '📦 Замовлення'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-40">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400/40" />
        </div>
      ) : (
        <>
          {/* ═══════ OVERVIEW TAB ═══════ */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard
                  label="Виручка"
                  value={`$${fmtUsd(totalRevenue)}`}
                  icon={<DollarSign className="w-4 h-4" />}
                  color="indigo"
                  sparkline={<SparklineChart data={revenueSparkline} color="#6366f1" />}
                />
                <KpiCard
                  label="Прибуток"
                  value={`$${fmtUsd(totalProfit)}`}
                  icon={<TrendingUp className="w-4 h-4" />}
                  color="emerald"
                  sparkline={<SparklineChart data={profitSparkline} color="#22c55e" />}
                />
                <KpiCard
                  label="Маржинальність"
                  value={`${avgMargin.toFixed(1)}%`}
                  icon={<BarChart3 className="w-4 h-4" />}
                  color="amber"
                />
                <KpiCard
                  label="Активні замовлення"
                  value={activeOrders.toString()}
                  icon={<ShoppingCart className="w-4 h-4" />}
                  color="cyan"
                  subtitle={`${paidOrders} оплачено · ${unpaidOrders} очікують`}
                />
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Order Status Donut */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white/[0.02] border border-white/5 rounded-2xl p-6"
                >
                  <h3 className="text-[10px] uppercase tracking-widest text-white/40 font-medium mb-4">Статуси замовлень</h3>
                  <div className="flex items-center justify-center py-2">
                    <DonutChart segments={statusSegments} size={140} />
                  </div>
                  <div className="mt-4 space-y-2">
                    {statusSegments.map((seg, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
                          <span className="text-white/50">{seg.label}</span>
                        </div>
                        <span className="text-white/70 font-medium">{seg.value}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Top Customers */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white/[0.02] border border-white/5 rounded-2xl p-6"
                >
                  <h3 className="text-[10px] uppercase tracking-widest text-white/40 font-medium mb-4">Топ клієнти (продажі)</h3>
                  <div className="flex items-end justify-center py-2">
                    <BarChartSvg
                      data={topCustomers.map(c => ({
                        label: c.name.substring(0, 5),
                        value: c.totalSales,
                        color: '#6366f1',
                      }))}
                      height={130}
                      width={260}
                    />
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {topCustomers.slice(0, 4).map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-white/50 truncate max-w-[120px]">{c.name}</span>
                        <span className="text-white/70 font-medium">${fmtUsd(c.totalSales)}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Balance Overview */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white/[0.02] border border-white/5 rounded-2xl p-6"
                >
                  <h3 className="text-[10px] uppercase tracking-widest text-white/40 font-medium mb-4">Баланси контрагентів</h3>
                  <div className="space-y-3 mt-4">
                    {customers.filter(c => c.balance !== 0).slice(0, 6).map((c, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-xs text-white/50 truncate max-w-[120px]">{c.name}</span>
                        <div className="flex items-center gap-1.5">
                          {c.balance < 0 ? (
                            <ArrowDownRight className="w-3 h-3 text-red-400" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                          )}
                          <span className={`text-xs font-medium ${c.balance < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            ${fmtUsd(Math.abs(c.balance))}
                          </span>
                        </div>
                      </div>
                    ))}
                    {customers.filter(c => c.balance !== 0).length === 0 && (
                      <p className="text-xs text-white/20 text-center py-8">Усі взаєморозрахунки завершені ✓</p>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* Recent Orders Table */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white/[0.02] border border-white/5 rounded-2xl p-6"
              >
                <h3 className="text-[10px] uppercase tracking-widest text-white/40 font-medium mb-4">Останні замовлення</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left text-[9px] uppercase tracking-widest text-white/30 font-medium pb-3 pr-4">№</th>
                        <th className="text-left text-[9px] uppercase tracking-widest text-white/30 font-medium pb-3 pr-4">Назва</th>
                        <th className="text-left text-[9px] uppercase tracking-widest text-white/30 font-medium pb-3 pr-4">Статус</th>
                        <th className="text-left text-[9px] uppercase tracking-widest text-white/30 font-medium pb-3 pr-4">Оплата</th>
                        <th className="text-right text-[9px] uppercase tracking-widest text-white/30 font-medium pb-3 pr-4">Сума</th>
                        <th className="text-right text-[9px] uppercase tracking-widest text-white/30 font-medium pb-3">Прибуток</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.slice(0, 10).map((o, i) => (
                        <motion.tr
                          key={o.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.05 * i }}
                          className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-3 pr-4 text-xs text-white/60 font-mono">#{o.number}</td>
                          <td className="py-3 pr-4 text-xs text-white/80 max-w-[200px] truncate">{o.name}</td>
                          <td className="py-3 pr-4">
                            <StatusBadge status={o.orderStatus} />
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`text-[10px] uppercase tracking-widest font-medium ${o.paymentStatus === 'Оплачено' ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {o.paymentStatus === 'Оплачено' ? '✓ Paid' : '○ Pending'}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-right text-xs text-white/70 font-medium">${fmtUsd(o.clientTotal)}</td>
                          <td className="py-3 text-right">
                            <span className={`text-xs font-medium ${o.profit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {o.profit > 0 ? '+' : ''}${fmtUsd(o.profit)}
                            </span>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </div>
          )}

          {/* ═══════ CUSTOMERS TAB ═══════ */}
          {activeTab === 'customers' && (
            <div>
              <div className="mb-6 flex items-center gap-4">
                <div className="flex-1 flex items-center border border-white/10 bg-white/[0.02] rounded-xl px-4">
                  <Search className="w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Пошук клієнта..."
                    className="w-full bg-transparent text-sm text-white placeholder-white/20 focus:outline-none py-3 px-3"
                  />
                </div>
                <span className="text-[10px] uppercase tracking-widest text-white/30">{filteredCustomers.length} клієнтів</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredCustomers.map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.02 * i }}
                    className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-sm font-medium text-white">{c.name}</h4>
                        {c.email && <p className="text-[10px] text-indigo-400/60 font-mono">{c.email}</p>}
                        {c.businessName && <p className="text-[10px] text-white/30">{c.businessName}</p>}
                      </div>
                      <div className={`text-[9px] uppercase tracking-widest font-bold px-2 py-1 rounded ${c.balance < 0 ? 'bg-red-500/10 text-red-400' : c.balance > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-white/30'}`}>
                        ${fmtUsd(Math.abs(c.balance))}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center border-t border-white/5 pt-3">
                      <div>
                        <div className="text-xs font-medium text-white/70">${fmtUsd(c.totalSales)}</div>
                        <div className="text-[8px] uppercase tracking-widest text-white/30 mt-0.5">Продажі</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-white/70">{c.orderCount}</div>
                        <div className="text-[8px] uppercase tracking-widest text-white/30 mt-0.5">Замовлення</div>
                      </div>
                      <div>
                        <div className={`text-xs font-medium ${c.whoOwes.includes('Нам') ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {c.whoOwes.includes('завершены') ? '✓' : c.whoOwes.includes('Нам') ? '⚠' : '—'}
                        </div>
                        <div className="text-[8px] uppercase tracking-widest text-white/30 mt-0.5">Борг</div>
                      </div>
                    </div>
                    <button className="mt-3 w-full text-[9px] uppercase tracking-widest text-white/30 border border-white/5 py-2 rounded-lg hover:bg-white/5 hover:text-white/60 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                      <Link2 className="w-3 h-3" /> Зв'язати з акаунтом
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════ ORDERS TAB ═══════ */}
          {activeTab === 'orders' && (
            <div>
              <div className="mb-6 flex items-center gap-4">
                <div className="flex-1 flex items-center border border-white/10 bg-white/[0.02] rounded-xl px-4">
                  <Search className="w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Пошук замовлення..."
                    className="w-full bg-transparent text-sm text-white placeholder-white/20 focus:outline-none py-3 px-3"
                  />
                </div>
                <span className="text-[10px] uppercase tracking-widest text-white/30">{filteredOrders.length} замовлень</span>
              </div>
              <div className="space-y-2">
                {filteredOrders.map((o, i) => (
                  <motion.div
                    key={o.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.02 * i }}
                    className="bg-white/[0.02] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-all flex items-center gap-4"
                  >
                    <div className="w-12 h-12 bg-white/[0.03] rounded-lg flex items-center justify-center text-xs font-mono text-white/40">
                      #{o.number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm text-white/80 truncate">{o.name}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <StatusBadge status={o.orderStatus} />
                        <span className="text-[9px] text-white/20">{o.itemCount} позицій</span>
                        {o.tag && <span className="text-[9px] text-white/20 bg-white/5 px-2 py-0.5 rounded">{o.tag}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-medium text-white/70">${fmtUsd(o.clientTotal)}</div>
                      <div className={`text-[10px] font-medium ${o.profit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {o.profit > 0 ? '+' : ''}${fmtUsd(o.profit)} ({(o.marginality * 100).toFixed(0)}%)
                      </div>
                    </div>
                    <div className="shrink-0">
                      <span className={`text-[10px] uppercase tracking-widest font-medium px-3 py-1.5 rounded-lg ${
                        o.paymentStatus === 'Оплачено'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {o.paymentStatus === 'Оплачено' ? 'PAID' : 'PENDING'}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// Reusable Components
// ═══════════════════════════════════════

function KpiCard({ label, value, icon, color, sparkline, subtitle }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  sparkline?: React.ReactNode;
  subtitle?: string;
}) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${colorMap[color] || colorMap.indigo} border rounded-2xl p-5`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-[9px] uppercase tracking-widest font-medium opacity-60">{label}</div>
        {icon}
      </div>
      <div className="text-2xl font-light tracking-tight">{value}</div>
      {subtitle && <p className="text-[9px] text-white/30 mt-1">{subtitle}</p>}
      {sparkline && <div className="mt-3">{sparkline}</div>}
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    'Новый': 'bg-blue-500',
    'В обработке': 'bg-amber-500',
    'В производстве': 'bg-purple-500',
    'В пути': 'bg-cyan-500',
    'Выполнен': 'bg-emerald-500',
    'Отменен': 'bg-red-500',
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-1.5 h-1.5 rounded-full ${colorMap[status] || 'bg-gray-500'}`} />
      <span className="text-[10px] text-white/50">{status}</span>
    </div>
  );
}
