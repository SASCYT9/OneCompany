'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, User, DollarSign, ShoppingCart, TrendingUp, Package, Loader2, Tag } from 'lucide-react';

type CustomerDetail = {
  id: string;
  airtableId: string;
  name: string;
  businessName: string | null;
  tags: string[];
  totalProfit: number;
  totalSales: number;
  totalPayments: number;
  balance: number;
  whoOwes: string | null;
  markup: { markupPct: number; notes: string | null } | null;
  orders: Array<{
    id: string;
    airtableId: string;
    number: number;
    name: string;
    orderStatus: string;
    paymentStatus: string;
    orderDate: string | null;
    clientTotal: number;
    profit: number;
    marginality: number;
    itemCount: number;
    items: Array<{
      id: string;
      productName: string;
      status: string;
      clientTotal: number;
      profitPerItem: number;
    }>;
  }>;
  topProducts: Array<{ name: string; totalQty: number; totalRevenue: number; totalProfit: number }>;
};

const STATUS_COLORS: Record<string, string> = {
  'Выполнен': 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5',
  'Новый': 'border-blue-500/20 text-blue-400 bg-blue-500/5',
  'В обработке': 'border-amber-500/20 text-amber-400 bg-amber-500/5',
  'Отменен': 'border-red-500/20 text-red-400 bg-red-500/5',
};

export default function CrmCustomerDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/admin/crm/customers/${id}`)
      .then(r => r.json())
      .then(d => setCustomer(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-white/30"><Loader2 className="w-6 h-6 animate-spin mr-3" /> Завантаження...</div>;
  }

  if (!customer) {
    return <div className="p-8 text-white/40">Клієнта не знайдено.</div>;
  }

  const balanceColor = customer.balance > 0 ? 'text-emerald-400' : customer.balance < 0 ? 'text-red-400' : 'text-white/40';

  return (
    <div className="relative h-full w-full overflow-auto bg-black text-white">
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/8 blur-[120px]" />

      <div className="w-full px-4 py-8 md:px-8 lg:px-12 max-w-[1920px] mx-auto">
        <Link href="/admin/crm" className="group mb-6 inline-flex items-center gap-2 text-[13px] font-medium tracking-wide text-white/40 hover:text-white transition-all">
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" /> CRM Dashboard
        </Link>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-light tracking-tight text-white flex items-center gap-3">
              <User className="h-8 w-8 text-violet-500/80 drop-shadow-[0_0_15px_rgba(139,92,246,0.5)]" />
              {customer.name}
            </h1>
            {customer.businessName && <p className="mt-1 text-sm text-white/40">{customer.businessName}</p>}
            <div className="mt-3 flex items-center flex-wrap gap-2">
              {customer.tags.map(tag => (
                <span key={tag} className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-violet-500/20 text-violet-400 bg-violet-500/5">
                  {tag}
                </span>
              ))}
              {customer.whoOwes && (
                <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${customer.balance < 0 ? 'border-red-500/20 text-red-400 bg-red-500/5' : 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5'}`}>
                  {customer.whoOwes}
                </span>
              )}
            </div>
          </div>
          {customer.markup && (
            <Link href="/admin/shop/pricing" className="rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.02] px-5 py-3 hover:bg-emerald-500/[0.05] transition-colors">
              <div className="text-[10px] uppercase tracking-widest text-emerald-400/50 mb-1">Персональна націнка</div>
              <div className="text-2xl font-light text-emerald-400">{customer.markup.markupPct}%</div>
              {customer.markup.notes && <div className="text-[10px] text-white/20 mt-1">{customer.markup.notes}</div>}
            </Link>
          )}
        </div>

        {/* Financial KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {[
            { label: 'Виручка', value: `$${customer.totalSales.toLocaleString()}`, icon: <DollarSign className="w-4 h-4" />, color: 'text-white' },
            { label: 'Прибуток', value: `$${customer.totalProfit.toLocaleString()}`, icon: <TrendingUp className="w-4 h-4" />, color: 'text-emerald-400' },
            { label: 'Оплати', value: `$${customer.totalPayments.toLocaleString()}`, icon: <ShoppingCart className="w-4 h-4" />, color: 'text-blue-400' },
            { label: 'Баланс', value: `$${customer.balance.toLocaleString()}`, icon: <DollarSign className="w-4 h-4" />, color: balanceColor },
            { label: 'Замовлень', value: String(customer.orders.length), icon: <Package className="w-4 h-4" />, color: 'text-white' },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-2xl border border-white/[0.08] bg-black/60 p-4">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/30 mb-1.5">
                {kpi.icon} {kpi.label}
              </div>
              <div className={`text-xl font-light ${kpi.color}`}>{kpi.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Orders */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-sm font-medium text-white/50 uppercase tracking-widest mb-3">Замовлення</h2>
            {customer.orders.map(o => (
              <Link key={o.id} href={`/admin/crm/orders/${o.airtableId}`}
                className="block rounded-2xl border border-white/[0.08] bg-black/60 p-5 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-white">#{o.number}</span>
                    <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${STATUS_COLORS[o.orderStatus] || 'border-white/10 text-white/30'}`}>{o.orderStatus}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-white">${o.clientTotal.toLocaleString()}</span>
                    <span className={`ml-2 text-xs ${o.profit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>+${o.profit.toFixed(0)}</span>
                  </div>
                </div>
                <p className="text-xs text-white/40 truncate">{o.name}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-white/20">{o.orderDate ? new Date(o.orderDate).toLocaleDateString('uk-UA') : '—'}</span>
                  <span className="text-[10px] text-white/20">{o.itemCount} позицій · маржа {(o.marginality * 100).toFixed(1)}%</span>
                </div>
              </Link>
            ))}
            {customer.orders.length === 0 && (
              <div className="rounded-2xl border border-white/[0.08] bg-black/60 p-8 text-center text-white/20 text-sm">Немає замовлень</div>
            )}
          </div>

          {/* Top Products */}
          <div>
            <h2 className="text-sm font-medium text-white/50 uppercase tracking-widest mb-3">Топ Товари</h2>
            <div className="rounded-2xl border border-white/[0.08] bg-black/60 overflow-hidden">
              {customer.topProducts.length > 0 ? customer.topProducts.map((p, i) => (
                <div key={p.name} className={`p-4 ${i > 0 ? 'border-t border-white/[0.04]' : ''}`}>
                  <div className="text-sm text-white font-medium truncate">{p.name}</div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-white/20">{p.totalQty} шт</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/50">${p.totalRevenue.toLocaleString()}</span>
                      <span className={`text-xs ${p.totalProfit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>+${p.totalProfit.toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="p-6 text-center text-white/20 text-sm">Немає товарів</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
