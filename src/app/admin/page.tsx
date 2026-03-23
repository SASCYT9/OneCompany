'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  TrendingUp, Package, CreditCard, ArrowRight,
  ExternalLink, DollarSign, ShoppingCart, BarChart3,
  ArrowUpRight, ArrowDownRight, Database, Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';

type DashboardData = {
  totalRevenue: string | number;
  activeOrders: number;
  totalDebt: string | number;
  totalCustomers: number;
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
    <svg width={width} height={height} className="opacity-60">
      <defs>
        <linearGradient id={`sp-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
      <polygon fill={`url(#sp-${color.replace('#', '')})`} points={`0,${height} ${points} ${width},${height}`} />
    </svg>
  );
}

function MiniDonut({ segments, size = 80 }: { segments: { value: number; color: string }[]; size?: number }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;
  const cx = size / 2, cy = size / 2, r = size / 2 - 6;
  const circumference = 2 * Math.PI * r;
  let cumul = 0;
  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={8} />
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const offset = circumference * cumul;
        const dash = circumference * pct;
        cumul += pct;
        return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={8}
          strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset}
          strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} className="transition-all duration-700" />;
      })}
      <text x={cx} y={cy + 1} textAnchor="middle" fill="white" fontSize="14" fontWeight="300">{total}</text>
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

  // Fire-and-forget background sync on first load + load CRM DB analytics
  useEffect(() => {
    fetch('/api/webhooks/airtable', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }).catch(() => {});
    fetch('/api/admin/crm/analytics?type=dashboard').then(r => r.json()).then(d => setCrmDbStats(d)).catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400/40" />
      </div>
    );
  }

  // Localize CRM status labels (Airtable uses Russian)
  const STATUS_LABELS: Record<string, string> = {
    'Новый': 'Новий', 'В обработке': 'В обробці', 'В производстве': 'У виробництві',
    'В пути': 'В дорозі', 'Выполнен': 'Виконано', 'Отменен': 'Скасовано',
  };
  const localizeStatus = (s: string) => STATUS_LABELS[s] || s;

  // Computed CRM stats
  const crmRevenue = crmOrders.reduce((s, o) => s + (o.clientTotal || 0), 0);
  const crmProfit = crmOrders.reduce((s, o) => s + (o.profit || 0), 0);
  const crmActiveOrders = crmOrders.filter(o => !['Выполнен', 'Отменен'].includes(o.orderStatus)).length;
  const crmDebtCustomers = crmCustomers.filter(c => c.balance < 0);
  const totalDebtAmount = crmDebtCustomers.reduce((s, c) => s + Math.abs(c.balance), 0);

  const STATUS_COLORS: Record<string, string> = {
    'Новий': '#3b82f6', 'В обробці': '#f59e0b', 'У виробництві': '#8b5cf6',
    'В дорозі': '#06b6d4', 'Виконано': '#22c55e', 'Скасовано': '#ef4444',
  };

  const statusCounts = crmOrders.reduce((acc, o) => {
    const localized = localizeStatus(o.orderStatus);
    acc[localized] = (acc[localized] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const donutSegments = Object.entries(statusCounts).map(([label, value]) => ({
    value, color: STATUS_COLORS[label] || '#6b7280',
  }));

  const revSparkline = crmOrders.slice(0, 15).reverse().map(o => o.clientTotal || 0);
  const profSparkline = crmOrders.slice(0, 15).reverse().map(o => o.profit || 0);

  const topClients = [...crmCustomers].sort((a, b) => b.totalSales - a.totalSales).slice(0, 5);

  return (
    <div className="w-full px-4 md:px-8 py-6 h-full overflow-auto text-white max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-light tracking-tight flex items-center gap-3">
            Огляд бізнесу
          </h1>
          <p className="text-xs text-white/30 mt-1">
            One Company · Shop + CRM · Airtable Live
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
            <div className="relative">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
              <div className="absolute inset-0 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping opacity-50" />
            </div>
            <span className="text-[9px] uppercase tracking-widest text-emerald-400 font-medium">LIVE</span>
          </div>
          {lastUpdated && (
            <span className="text-[9px] text-white/20">{lastUpdated.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          )}
        </div>
      </div>

      {/* ═══ KPI Row ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <KpiCard label="Дохід (Shop)" value={data ? `€${Number(data.totalRevenue).toLocaleString('en', { minimumFractionDigits: 0 })}` : '—'}
          icon={<DollarSign className="w-4 h-4" />} color="indigo" />
        <KpiCard label="CRM Виручка" value={`$${crmRevenue.toLocaleString()}`}
          icon={<TrendingUp className="w-4 h-4" />} color="emerald"
          sparkline={<SparklineChart data={revSparkline} color="#22c55e" />} />
        <KpiCard label="CRM Прибуток" value={`$${crmProfit.toLocaleString()}`}
          icon={<BarChart3 className="w-4 h-4" />} color="cyan"
          sparkline={<SparklineChart data={profSparkline} color="#06b6d4" />} />
        <KpiCard label="Активні" value={`${(data?.activeOrders || 0) + crmActiveOrders}`}
          icon={<Package className="w-4 h-4" />} color="amber"
          subtitle={`Shop: ${data?.activeOrders || 0} · CRM: ${crmActiveOrders}`} />
        <KpiCard label="Борги" value={totalDebtAmount > 0 ? `$${totalDebtAmount.toLocaleString()}` : '✓ $0'}
          icon={<CreditCard className="w-4 h-4" />}
          color={totalDebtAmount > 0 ? 'rose' : 'emerald'}
          subtitle={totalDebtAmount > 0 ? `${crmDebtCustomers.length} контрагентів` : 'Всі розрахунки ок'} />
      </div>

      {/* CRM DB Analytics Row */}
      {crmDbStats && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-2">
          {[
            { label: 'DB Клієнти', value: crmDbStats.kpis.totalCustomers },
            { label: 'DB Замовлення', value: crmDbStats.kpis.totalOrders },
            { label: 'DB Позиції', value: crmDbStats.kpis.totalItems },
            { label: 'DB Виручка', value: `$${crmDbStats.kpis.totalRevenue.toLocaleString()}` },
            { label: 'DB Прибуток', value: `$${crmDbStats.kpis.totalProfit.toLocaleString()}` },
            { label: 'Маржа', value: `${crmDbStats.kpis.avgMargin}%` },
          ].map(item => (
            <div key={item.label} className="bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2">
              <div className="text-[7px] uppercase tracking-widest text-white/20">{item.label}</div>
              <div className="text-xs font-light text-white/70 mt-0.5">{item.value}</div>
            </div>
          ))}
        </motion.div>
      )}

      {/* ═══ 3-Column Layout ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* ──── Left Column: Orders + CRM orders ──── */}
        <div className="lg:col-span-7 space-y-4">
          {/* Recent Shop Orders */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <h2 className="text-[10px] uppercase tracking-widest text-white/40 font-medium">Останні замовлення (Shop)</h2>
              <Link href="/admin/shop/orders" className="text-[9px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 uppercase tracking-widest">
                Всі <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <tbody>
                  {(data?.recentOrders || []).slice(0, 6).map((order, i) => (
                    <motion.tr key={order.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.03 * i }}
                      className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3 text-xs text-white/50 font-mono">{order.displayId}</td>
                      <td className="px-3 py-3 text-xs text-white/80 font-medium truncate max-w-[140px]">{order.customerName}</td>
                      <td className="px-3 py-3 text-xs text-white/60">{Number(order.total).toFixed(0)} {order.currency}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-medium ${order.paymentStatus === 'UNPAID' ? 'text-red-400' : 'text-emerald-400'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${order.paymentStatus === 'UNPAID' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                          {order.paymentStatus === 'UNPAID' ? 'БОРГ' : 'PAID'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link href={`/admin/shop/orders/${order.id}`} className="p-1.5 hover:bg-white/10 rounded text-white/30 hover:text-white inline-flex transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* CRM Orders */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <h2 className="text-[10px] uppercase tracking-widest text-white/40 font-medium flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-indigo-400" /> CRM Замовлення (Airtable)
              </h2>
              <Link href="/admin/crm" className="text-[9px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 uppercase tracking-widest">
                CRM <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <tbody>
                  {crmOrders.slice(0, 6).map((o, i) => (
                    <motion.tr key={o.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.03 * i }}
                      className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3 text-xs text-white/50 font-mono">#{o.number}</td>
                      <td className="px-3 py-3 text-xs text-white/80 truncate max-w-[160px]">{o.name}</td>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[o.orderStatus] || '#6b7280' }} />
                          <span className="text-[9px] text-white/40">{o.orderStatus}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-white/60 text-right">${o.clientTotal.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right">
                        <span className={`text-[10px] font-medium ${o.profit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {o.profit > 0 ? '+' : ''}${o.profit.toFixed(0)}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>

        {/* ──── Right Column: Charts + QuickActions ──── */}
        <div className="lg:col-span-5 space-y-4">
          {/* Status Distribution Mini */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
            <h3 className="text-[10px] uppercase tracking-widest text-white/40 font-medium mb-4">Статуси CRM</h3>
            <div className="flex items-center gap-6">
              <MiniDonut segments={donutSegments} size={90} />
              <div className="flex-1 space-y-1.5">
                {Object.entries(statusCounts).map(([label, count]) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[label] || '#6b7280' }} />
                      <span className="text-white/40">{label}</span>
                    </div>
                    <span className="text-white/60 font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Balances / Top клієнти */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
            <h3 className="text-[10px] uppercase tracking-widest text-white/40 font-medium mb-3">Топ клієнти (CRM)</h3>
            <div className="space-y-2.5">
              {topClients.map((c, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-[9px] font-medium text-white/30">{i + 1}</div>
                    <span className="text-xs text-white/60 truncate max-w-[120px]">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white/40">${c.totalSales.toLocaleString()}</span>
                    {c.balance !== 0 && (
                      <span className={`text-[10px] font-medium flex items-center gap-0.5 ${c.balance < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {c.balance < 0 ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        ${Math.abs(c.balance).toFixed(0)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {topClients.length === 0 && (
                <p className="text-xs text-white/20 text-center py-4">Немає даних CRM</p>
              )}
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
            <h3 className="text-[10px] uppercase tracking-widest text-white/40 font-medium mb-3">Швидкі дії</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: '/admin/shop/orders/create', label: 'Нове замовлення', icon: <ShoppingCart className="w-3.5 h-3.5" /> },
                { href: '/admin/shop/stock', label: 'Імпорт CSV', icon: <Database className="w-3.5 h-3.5" /> },
                { href: '/admin/backups', label: 'Бекап БД', icon: <Package className="w-3.5 h-3.5" /> },
                { href: '/admin/shop/turn14/markups', label: 'Маржа Turn14', icon: <DollarSign className="w-3.5 h-3.5" /> },
              ].map(action => (
                <Link key={action.href} href={action.href}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs text-white/40 hover:text-white hover:bg-white/[0.05] transition-all border border-white/5 hover:border-white/15">
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

function KpiCard({ label, value, icon, color, sparkline, subtitle }: {
  label: string; value: string; icon: React.ReactNode; color: string;
  sparkline?: React.ReactNode; subtitle?: string;
}) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-500/8 text-indigo-400 border-indigo-500/15',
    emerald: 'bg-emerald-500/8 text-emerald-400 border-emerald-500/15',
    cyan: 'bg-cyan-500/8 text-cyan-400 border-cyan-500/15',
    amber: 'bg-amber-500/8 text-amber-400 border-amber-500/15',
    rose: 'bg-red-500/8 text-red-400 border-red-500/15',
  };
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className={`${colors[color] || colors.indigo} border rounded-2xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[8px] uppercase tracking-widest font-medium opacity-60">{label}</span>
        {icon}
      </div>
      <div className="text-xl font-light tracking-tight">{value}</div>
      {subtitle && <p className="text-[8px] text-white/25 mt-0.5">{subtitle}</p>}
      {sparkline && <div className="mt-2">{sparkline}</div>}
    </motion.div>
  );
}

