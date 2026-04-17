'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Package, DollarSign, TrendingUp, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

type OrderDetail = {
  id: string;
  airtableId: string;
  number: number;
  name: string;
  orderStatus: string;
  paymentStatus: string;
  orderDate: string | null;
  completionDate: string | null;
  purchaseCost: number;
  additionalCosts: number;
  fullCost: number;
  totalAmount: number;
  clientTotal: number;
  profit: number;
  marginality: number;
  tag: string;
  allShipped: string;
  itemCount: number;
  customer: { id: string; name: string; airtableId: string } | null;
  items: Array<{
    id: string;
    positionNumber: number;
    productName: string;
    brand: string;
    category: string;
    quantity: number;
    rrpPerUnit: number;
    clientPricePerUnit: number;
    clientTotal: number;
    actualSalePrice: number;
    purchasePrice: number;
    purchaseTotal: number;
    profitPerItem: number;
    marginality: number;
    status: string;
    source: string;
    sku: string | null;
    imageUrl: string | null;
  }>;
};

const STATUS_COLORS: Record<string, string> = {
  'Выполнен': 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5',
  'Новый': 'border-blue-500/20 text-zinc-400 bg-zinc-100 text-black/5',
  'В обработке': 'border-amber-500/20 text-amber-400 bg-amber-500/5',
  'Отменен': 'border-red-500/20 text-red-400 bg-red-950/30 border border-red-900/50 text-red-500/5',
  'Оплачено': 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5',
  'Не оплачено': 'border-red-500/20 text-red-400 bg-red-950/30 border border-red-900/50 text-red-500/5',
  'Частично': 'border-amber-500/20 text-amber-400 bg-amber-500/5',
};

const ITEM_STATUS_ICONS: Record<string, React.ReactNode> = {
  'Нужен': <AlertCircle className="w-3.5 h-3.5 text-amber-400" />,
  'В обработке': <Clock className="w-3.5 h-3.5 text-zinc-400" />,
  'Отправлен': <Package className="w-3.5 h-3.5 text-zinc-400" />,
  'Получен': <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
  'Отвержен': <AlertCircle className="w-3.5 h-3.5 text-red-400" />,
};

function StatusBadge({ status, type = 'order' }: { status: string; type?: string }) {
  const cls = STATUS_COLORS[status] || 'border-white/10 text-white/40 bg-white/[0.02]';
  return (
    <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-none-full border ${cls}`}>
      {status || 'N/A'}
    </span>
  );
}

export default function CrmOrderDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/admin/crm/orders/${id}`)
      .then(r => r.json())
      .then(d => setOrder(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-white/30"><Loader2 className="w-6 h-6 animate-spin mr-3" /> Завантаження...</div>;
  }

  if (!order) {
    return <div className="p-8 text-white/40">Замовлення не знайдено.</div>;
  }

  const profitColor = order.profit > 0 ? 'text-emerald-400' : order.profit < 0 ? 'text-red-400' : 'text-white/40';

  return (
    <div className="relative h-full w-full overflow-auto bg-black text-white">
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-none-full bg-zinc-100 text-black/8 blur-[120px]" />

      <div className="w-full px-4 py-8 md:px-8 lg:px-12 max-w-[1920px] mx-auto">
        <Link href="/admin/crm" className="group mb-6 inline-flex items-center gap-2 text-[13px] font-medium tracking-wide text-white/40 hover:text-white transition-all">
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" /> CRM Dashboard
        </Link>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-light tracking-tight text-white flex items-center gap-3">
              <span className="text-white/30 font-mono">#{order.number}</span>
              {order.name}
            </h1>
            <div className="mt-3 flex items-center flex-wrap gap-2">
              <StatusBadge status={order.orderStatus} />
              <StatusBadge status={order.paymentStatus} />
              {order.tag && <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-none-full border border-white/10 text-white/30">{order.tag}</span>}
              {order.allShipped === 'Да' && <span className="text-[9px] px-2 py-0.5 rounded-none-full border border-emerald-500/20 text-emerald-400 bg-emerald-500/5">✓ Відвантажено</span>}
            </div>
            {order.customer && (
              <Link href={`/admin/crm/customers/${order.customer.airtableId}`} className="mt-2 block text-sm text-zinc-400/60 hover:text-zinc-400">
                → {order.customer.name}
              </Link>
            )}
          </div>
          <div className="text-right text-sm text-white/40">
            {order.orderDate && <div>Дата: {new Date(order.orderDate).toLocaleDateString('uk-UA')}</div>}
            {order.completionDate && <div>Завершено: {new Date(order.completionDate).toLocaleDateString('uk-UA')}</div>}
          </div>
        </div>

        {/* Financial KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {[
            { label: 'Клієнт платить', value: `$${order.clientTotal.toLocaleString()}`, color: 'text-white' },
            { label: 'Закупка', value: `$${order.purchaseCost.toLocaleString()}`, color: 'text-amber-400' },
            { label: 'Додаткові', value: `$${order.additionalCosts.toLocaleString()}`, color: 'text-white/40' },
            { label: 'Прибуток', value: `$${order.profit.toLocaleString()}`, color: profitColor },
            { label: 'Маржа', value: `${(order.marginality * 100).toFixed(1)}%`, color: order.marginality > 0.2 ? 'text-emerald-400' : 'text-amber-400' },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-none border border-white/[0.08] bg-black/60 p-4">
              <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1">{kpi.label}</div>
              <div className={`text-xl font-light ${kpi.color}`}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Items Table */}
        <div className="rounded-none border border-white/[0.08] bg-black/60 backdrop-blur-2xl shadow-2xl overflow-hidden mb-8">
          <div className="px-5 py-4 border-b border-white/[0.06] bg-white/[0.02]">
            <h2 className="text-sm font-medium text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-zinc-400" />
              Позиції товарів ({order.items.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-3 text-[9px] uppercase tracking-[0.15em] text-white/30">#</th>
                  <th className="px-4 py-3 text-[9px] uppercase tracking-[0.15em] text-white/30">Товар</th>
                  <th className="px-4 py-3 text-[9px] uppercase tracking-[0.15em] text-white/30">Статус</th>
                  <th className="px-4 py-3 text-[9px] uppercase tracking-[0.15em] text-white/30 text-right">К-ть</th>
                  <th className="px-4 py-3 text-[9px] uppercase tracking-[0.15em] text-white/30 text-right">РРЦ</th>
                  <th className="px-4 py-3 text-[9px] uppercase tracking-[0.15em] text-white/30 text-right">Клієнт $</th>
                  <th className="px-4 py-3 text-[9px] uppercase tracking-[0.15em] text-white/30 text-right">Закупка $</th>
                  <th className="px-4 py-3 text-[9px] uppercase tracking-[0.15em] text-white/30 text-right">Прибуток $</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {order.items.map(item => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-white/30 font-mono text-xs">{item.positionNumber}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.imageUrl ? (
                          <div className="w-10 h-10 rounded-none bg-white/5 border border-white/10 overflow-hidden flex-shrink-0">
                            <img src={item.imageUrl} alt={item.productName} className="object-cover w-full h-full" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-none bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                            <Package className="w-4 h-4 text-white/20" />
                          </div>
                        )}
                        <div>
                          <div className="text-sm text-white font-medium truncate max-w-[250px]">{item.productName}</div>
                          {item.sku && <div className="text-[10px] text-zinc-400 font-mono tracking-wider mt-0.5">{item.sku}</div>}
                          {!item.sku && item.brand && <div className="text-[10px] text-white/20 mt-0.5">{item.brand}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {ITEM_STATUS_ICONS[item.status] || <Clock className="w-3.5 h-3.5 text-white/20" />}
                        <span className="text-xs text-white/50">{item.status || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-white/60">{item.quantity}</td>
                    <td className="px-4 py-3 text-right font-mono text-white/30">${item.rrpPerUnit}</td>
                    <td className="px-4 py-3 text-right font-mono text-white">${item.clientTotal}</td>
                    <td className="px-4 py-3 text-right font-mono text-amber-400/70">${item.purchaseTotal}</td>
                    <td className={`px-4 py-3 text-right font-mono ${item.profitPerItem > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      ${item.profitPerItem.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10 bg-white/[0.02]">
                  <td colSpan={5} className="px-4 py-3 text-[10px] uppercase tracking-widest text-white/30 text-right">Разом:</td>
                  <td className="px-4 py-3 text-right font-mono text-white font-medium">${order.clientTotal.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono text-amber-400">${order.purchaseCost.toLocaleString()}</td>
                  <td className={`px-4 py-3 text-right font-mono font-medium ${profitColor}`}>${order.profit.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
