'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Loader2, Package } from 'lucide-react';

import {
  AdminEmptyState,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableShell,
} from '@/components/admin/AdminPrimitives';

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

function getOrderTone(status: string) {
  if (status === 'Выполнен') return 'success' as const;
  if (status === 'Отменен') return 'danger' as const;
  if (status === 'В обработке' || status === 'Новый') return 'warning' as const;
  return 'default' as const;
}

export default function CrmOrderDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    void fetch(`/api/admin/crm/orders/${id}`)
      .then((response) => response.json())
      .then((data) => setOrder(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <AdminPage>
        <div className="flex items-center gap-3 rounded-[6px] border border-white/10 bg-[#171717] px-5 py-6 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
          Завантаження замовлення…
        </div>
      </AdminPage>
    );
  }

  if (!order) {
    return (
      <AdminPage>
        <AdminEmptyState
          title="Замовлення не знайдено"
          description="CRM order detail is unavailable for this identifier."
          action={
            <Link
              href="/admin/crm"
              className="inline-flex items-center gap-2 rounded-[6px] bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600"
            >
              Back to CRM
            </Link>
          }
        />
      </AdminPage>
    );
  }

  const profitTone = order.profit >= 0 ? 'success' : 'danger';

  return (
    <AdminPage className="space-y-6">
      <div className="space-y-4">
        <Link href="/admin/crm" className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-100">
          CRM Dashboard
        </Link>
        <AdminPageHeader
          eyebrow="CRM Order"
          title={`#${order.number} · ${order.name}`}
          description={
            order.customer
              ? `Customer: ${order.customer.name}`
              : 'Order economics, fulfillment status, and line-item profitability.'
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <AdminStatusBadge tone={getOrderTone(order.orderStatus)}>{order.orderStatus}</AdminStatusBadge>
              <AdminStatusBadge tone={order.paymentStatus === 'Оплачено' ? 'success' : 'warning'}>
                {order.paymentStatus}
              </AdminStatusBadge>
              {order.tag ? <AdminStatusBadge>{order.tag}</AdminStatusBadge> : null}
            </div>
          }
        />
      </div>

      <AdminMetricGrid className="xl:grid-cols-5">
        <AdminMetricCard label="Client total" value={`$${order.clientTotal.toLocaleString()}`} meta="Amount billed to customer" tone="accent" />
        <AdminMetricCard label="Purchase cost" value={`$${order.purchaseCost.toLocaleString()}`} meta="Supplier-side item purchase cost" />
        <AdminMetricCard label="Additional costs" value={`$${order.additionalCosts.toLocaleString()}`} meta="Non-item order costs" />
        <AdminMetricCard label="Profit" value={`$${order.profit.toLocaleString()}`} meta={`Margin ${(order.marginality * 100).toFixed(1)}%`} />
        <AdminMetricCard label="Items" value={order.itemCount} meta={order.orderDate ? new Date(order.orderDate).toLocaleDateString('uk-UA') : 'No order date'} />
      </AdminMetricGrid>

      {order.customer ? (
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/admin/crm/customers/${order.customer.airtableId}`}
            className="inline-flex items-center gap-2 rounded-[6px] border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/[0.06]"
          >
            Open customer
          </Link>
          {order.completionDate ? (
            <div className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-400">
              Completed {new Date(order.completionDate).toLocaleDateString('uk-UA')}
            </div>
          ) : null}
        </div>
      ) : null}

      <AdminTableShell>
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="text-sm font-medium text-zinc-100">Line items</h2>
          <p className="mt-1 text-xs text-zinc-500">Order composition with customer pricing, purchase cost, and profit per item.</p>
        </div>
        {order.items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-zinc-500">Item</th>
                  <th className="px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-zinc-500">Status</th>
                  <th className="px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-zinc-500 text-right">Qty</th>
                  <th className="px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-zinc-500 text-right">Client</th>
                  <th className="px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-zinc-500 text-right">Purchase</th>
                  <th className="px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-zinc-500 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {order.items.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.productName}
                            className="h-11 w-11 rounded-[6px] border border-white/10 object-cover"
                          />
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-[6px] border border-white/10 bg-white/[0.03]">
                            <Package className="h-4 w-4 text-zinc-500" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-medium text-zinc-100">{item.productName}</div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {item.sku || item.brand || 'No SKU'} · {item.category || 'No category'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <AdminStatusBadge tone={item.status === 'Получен' ? 'success' : item.status === 'Отвержен' ? 'danger' : 'warning'}>
                        {item.status || '—'}
                      </AdminStatusBadge>
                    </td>
                    <td className="px-5 py-4 text-right text-zinc-300">{item.quantity}</td>
                    <td className="px-5 py-4 text-right font-medium text-zinc-200">${item.clientTotal}</td>
                    <td className="px-5 py-4 text-right text-amber-200">${item.purchaseTotal}</td>
                    <td className={`px-5 py-4 text-right font-medium ${item.profitPerItem >= 0 ? 'text-emerald-300' : 'text-blue-300'}`}>
                      ${item.profitPerItem.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/[0.06] bg-white/[0.02]">
                  <td colSpan={3} className="px-5 py-4 text-right text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                    Totals
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-zinc-100">${order.clientTotal.toLocaleString()}</td>
                  <td className="px-5 py-4 text-right font-semibold text-amber-200">${order.purchaseCost.toLocaleString()}</td>
                  <td className={`px-5 py-4 text-right font-semibold ${profitTone === 'success' ? 'text-emerald-300' : 'text-blue-300'}`}>
                    ${order.profit.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <AdminEmptyState
            className="rounded-none border-0 bg-transparent"
            title="No line items"
            description="The order exists, but no CRM line items were returned for this record."
          />
        )}
      </AdminTableShell>
    </AdminPage>
  );
}
