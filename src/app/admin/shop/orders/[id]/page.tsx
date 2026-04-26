'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Copy, DollarSign, ExternalLink, FileText, Package, PackageCheck, Printer, Save, Truck } from 'lucide-react';

import {
  AdminEntityToolbar,
  AdminInspectorCard,
  AdminKeyValueGrid,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminSplitDetailShell,
  AdminStatusBadge,
  AdminTableShell,
  AdminTimelineList,
} from '@/components/admin/AdminPrimitives';
import {
  AdminInputField,
  AdminSelectField,
  AdminTextareaField,
} from '@/components/admin/AdminFormFields';
import { useConfirm } from '@/components/admin/AdminConfirmDialog';
import { useToast } from '@/components/admin/AdminToast';
import { AdminActivityTimeline } from '@/components/admin/AdminActivityTimeline';
import { AdminNotes } from '@/components/admin/AdminNotes';
import { AdminTagInput } from '@/components/admin/AdminTagInput';
import { AdminMobileBottomBar } from '@/components/admin/AdminMobileCard';

type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PENDING_REVIEW'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

type ShipmentStatus =
  | 'LABEL_CREATED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED';

type ShipmentRecord = {
  id: string;
  orderId: string;
  carrier: string;
  serviceLevel: string | null;
  trackingNumber: string;
  trackingUrl: string | null;
  status: ShipmentStatus;
  notes: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ShipmentDraft = {
  carrier: string;
  serviceLevel: string;
  trackingNumber: string;
  trackingUrl: string;
  status: ShipmentStatus;
  notes: string;
  shippedAt: string;
  deliveredAt: string;
};

type OrderDetail = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  email: string;
  customerName: string;
  phone: string | null;
  customerGroupSnapshot?: string;
  b2bDiscountPercent?: number | null;
  discountNotes?: string | null;
  shippingAddress: Record<string, unknown>;
  currency: string;
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  total: number;
  paymentStatus: string;
  amountPaid: number;
  deliveryMethod: string | null;
  ttnNumber: string | null;
  shippingCalculatedCost: number | null;
  pricingSnapshot?: unknown;
  shippingZoneId: string | null;
  shippingZoneName: string | null;
  taxRegionId: string | null;
  taxRegionName: string | null;
  viewToken: string;
  createdAt: string;
  updatedAt: string;
  allowedTransitions: OrderStatus[];
  shipments: ShipmentRecord[];
  items: Array<{
    id: string;
    productSlug: string;
    title: string;
    quantity: number;
    price: number;
    total: number;
    image: string | null;
  }>;
  events: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    actorType: string;
    actorName: string | null;
    note: string | null;
    createdAt: string;
  }>;
};

const SHIPMENT_STATUS_OPTIONS: Array<{ value: ShipmentStatus; label: string }> = [
  { value: 'LABEL_CREATED', label: 'Створено етикетку' },
  { value: 'IN_TRANSIT', label: 'В дорозі' },
  { value: 'DELIVERED', label: 'Доставлено' },
  { value: 'CANCELLED', label: 'Скасовано' },
  { value: 'RETURNED', label: 'Повернено' },
];

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Очікує оплату',
  PENDING_REVIEW: 'На перевірці',
  CONFIRMED: 'Підтверджено',
  PROCESSING: 'В обробці',
  SHIPPED: 'Відправлено',
  DELIVERED: 'Доставлено',
  CANCELLED: 'Скасовано',
  REFUNDED: 'Повернено',
};

function emptyShipmentDraft(): ShipmentDraft {
  return {
    carrier: '',
    serviceLevel: '',
    trackingNumber: '',
    trackingUrl: '',
    status: 'LABEL_CREATED',
    notes: '',
    shippedAt: '',
    deliveredAt: '',
  };
}

function buildShipmentDraft(shipment: ShipmentRecord): ShipmentDraft {
  return {
    carrier: shipment.carrier,
    serviceLevel: shipment.serviceLevel ?? '',
    trackingNumber: shipment.trackingNumber,
    trackingUrl: shipment.trackingUrl ?? '',
    status: shipment.status,
    notes: shipment.notes ?? '',
    shippedAt: shipment.shippedAt ? shipment.shippedAt.slice(0, 16) : '',
    deliveredAt: shipment.deliveredAt ? shipment.deliveredAt.slice(0, 16) : '',
  };
}

function statusLabel(status: string) {
  return ORDER_STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

function statusTone(status: string): 'default' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'DELIVERED':
      return 'success';
    case 'CANCELLED':
    case 'REFUNDED':
      return 'danger';
    case 'PENDING_PAYMENT':
    case 'PENDING_REVIEW':
    case 'PROCESSING':
    case 'SHIPPED':
      return 'warning';
    default:
      return 'default';
  }
}

function shipmentTone(status: ShipmentStatus): 'default' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'DELIVERED':
      return 'success';
    case 'CANCELLED':
      return 'danger';
    case 'IN_TRANSIT':
      return 'warning';
    default:
      return 'default';
  }
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function AdminOrderDetailPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const params = useParams();
  const id = params?.id as string;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('');
  const [ttnNumber, setTtnNumber] = useState('');
  const [shippingCalculatedCost, setShippingCalculatedCost] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [copyState, setCopyState] = useState('');
  const [newShipment, setNewShipment] = useState<ShipmentDraft>(emptyShipmentDraft());
  const [shipmentDrafts, setShipmentDrafts] = useState<Record<string, ShipmentDraft>>({});
  const [shipmentSavingId, setShipmentSavingId] = useState<string | null>(null);
  const [shipmentDeletingId, setShipmentDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/shop/orders/${id}`);
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setError('Unauthorized');
        return;
      }
      if (!response.ok) {
        setError(data.error || 'Не вдалося завантажити замовлення');
        return;
      }
      const nextOrder = data as OrderDetail;
      setOrder(nextOrder);
      setNewStatus(nextOrder.status);
      setPaymentStatus(nextOrder.paymentStatus);
      setAmountPaid(String(nextOrder.amountPaid));
      setDeliveryMethod(nextOrder.deliveryMethod ?? '');
      setTtnNumber(nextOrder.ttnNumber ?? '');
      setShippingCalculatedCost(
        nextOrder.shippingCalculatedCost != null ? String(nextOrder.shippingCalculatedCost) : ''
      );
      setShipmentDrafts(
        Object.fromEntries(nextOrder.shipments.map((shipment) => [shipment.id, buildShipmentDraft(shipment)]))
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    void load();
  }, [id, load]);

  const confirmationUrl = useMemo(() => {
    if (!order || typeof window === 'undefined') return '';
    return `${window.location.origin}/ua/shop/checkout/success?order=${encodeURIComponent(order.orderNumber)}&token=${encodeURIComponent(order.viewToken)}`;
  }, [order]);

  async function handleStatusChange(targetStatus?: string) {
    if (!id || !order) return;
    const nextStatus = targetStatus || newStatus;
    if (nextStatus === order.status) return;

    setUpdating(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/shop/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, note: statusNote }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Не вдалося оновити');
        return;
      }
      await load();
      setStatusNote('');
      setSuccess(`Замовлення переведено в статус «${statusLabel(nextStatus)}».`);
    } finally {
      setUpdating(false);
    }
  }

  async function handlePaymentAndFulfillmentSave() {
    if (!id || !order) return;
    setUpdating(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/shop/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentStatus,
          amountPaid: parseFloat(amountPaid) || 0,
          deliveryMethod,
          ttnNumber,
          shippingCalculatedCost: shippingCalculatedCost ? parseFloat(shippingCalculatedCost) : null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Не вдалося оновити оплату/логістику');
        return;
      }
      await load();
      setSuccess('Оплату та fulfillment збережено.');
    } finally {
      setUpdating(false);
    }
  }

  async function copyConfirmationLink() {
    if (!confirmationUrl) return;
    try {
      await navigator.clipboard.writeText(confirmationUrl);
      setCopyState('Copied');
      window.setTimeout(() => setCopyState(''), 1500);
    } catch {
      setCopyState('Copy failed');
      window.setTimeout(() => setCopyState(''), 1500);
    }
  }

  function buildShipmentPayload(draft: ShipmentDraft) {
    return {
      carrier: draft.carrier,
      serviceLevel: draft.serviceLevel || null,
      trackingNumber: draft.trackingNumber,
      trackingUrl: draft.trackingUrl || null,
      status: draft.status,
      notes: draft.notes || null,
      shippedAt: draft.shippedAt || null,
      deliveredAt: draft.deliveredAt || null,
    };
  }

  async function handleCreateShipment() {
    if (!id) return;
    setShipmentSavingId('new');
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/shop/orders/${id}/shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildShipmentPayload(newShipment)),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Не вдалося створити відправлення');
        return;
      }
      setNewShipment(emptyShipmentDraft());
      await load();
      setSuccess(`Відправлення ${data.trackingNumber} створено.`);
    } finally {
      setShipmentSavingId(null);
    }
  }

  async function handleUpdateShipment(shipmentId: string) {
    const draft = shipmentDrafts[shipmentId];
    if (!draft) return;
    setShipmentSavingId(shipmentId);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/shop/shipments/${shipmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildShipmentPayload(draft)),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Не вдалося оновити відправлення');
        return;
      }
      await load();
      setSuccess(`Відправлення ${data.trackingNumber} оновлено.`);
    } finally {
      setShipmentSavingId(null);
    }
  }

  async function handleDeleteShipment(shipmentId: string) {
    const ok = await confirm({
      tone: 'danger',
      title: 'Видалити це відправлення?',
      description: 'Запис відправлення буде видалено разом з трекінгом. Дію не можна скасувати.',
      confirmLabel: 'Видалити',
    });
    if (!ok) return;
    setShipmentDeletingId(shipmentId);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/shop/shipments/${shipmentId}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data.error || 'Не вдалося видалити відправлення';
        setError(msg);
        toast.error('Не вдалося видалити', msg);
        return;
      }
      await load();
      setSuccess('Відправлення видалено.');
      toast.success('Відправлення видалено');
    } finally {
      setShipmentDeletingId(null);
    }
  }

  async function handleGenerateWhitepayFiatLink() {
    if (!id) return;
    setUpdating(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/shop/orders/${id}/whitepay/fiat`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Не вдалося згенерувати Whitepay Fiat');
        return;
      }
      if (data.url) {
        await navigator.clipboard.writeText(data.url).catch(() => {});
        window.open(data.url, '_blank');
      }
      setSuccess('Whitepay Fiat link generated.');
    } finally {
      setUpdating(false);
    }
  }

  async function handleGenerateWhitepayCryptoLink() {
    if (!id) return;
    setUpdating(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/shop/orders/${id}/whitepay/crypto`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Не вдалося згенерувати Whitepay Crypto');
        return;
      }
      if (data.url) {
        await navigator.clipboard.writeText(data.url).catch(() => {});
        window.open(data.url, '_blank');
      }
      setSuccess('Whitepay Crypto link generated.');
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <AdminPage>
        <div className="rounded-none border border-white/10 bg-[#171717] px-5 py-6 text-sm text-zinc-400">
          Завантаження замовлення…
        </div>
      </AdminPage>
    );
  }

  if (error && !order) {
    return (
      <AdminPage className="space-y-4">
        <div className="rounded-none border border-blue-500/20 bg-blue-950/20 px-4 py-3 text-sm text-red-200">{error}</div>
        <Link href="/admin/shop/orders" className="inline-block text-sm text-zinc-300 hover:text-zinc-100">
          Back to orders
        </Link>
      </AdminPage>
    );
  }

  if (!order) return null;

  const address = order.shippingAddress as Record<string, string>;
  const outstanding = Math.max(0, order.total - order.amountPaid);

  return (
    <AdminPage className="space-y-6 pb-24 lg:pb-0">
      <AdminPageHeader
        eyebrow="Order Detail"
        title={order.orderNumber}
        description={`${order.customerName} · ${order.email}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge tone={statusTone(order.status)}>{statusLabel(order.status)}</AdminStatusBadge>
            <AdminStatusBadge tone={outstanding > 0 ? 'warning' : 'success'}>
              {outstanding > 0 ? `Outstanding ${formatMoney(outstanding, order.currency)}` : 'Paid or balanced'}
            </AdminStatusBadge>
            <Link
              href={`/admin/shop/returns/new?orderId=${order.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/[0.08] px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:border-amber-500/40 hover:bg-amber-500/[0.12]"
            >
              <Package className="h-3.5 w-3.5" />
              Create return
            </Link>
          </div>
        }
      />

      <AdminEntityToolbar>
        <div className="grid flex-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
          <AdminSelectField
            label="Status"
            value={newStatus}
            onChange={setNewStatus}
            options={[order.status, ...order.allowedTransitions].map((status) => ({
              value: status,
              label: statusLabel(status),
            }))}
          />
          <AdminTextareaField
            label="Status note"
            value={statusNote}
            onChange={setStatusNote}
            rows={2}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleStatusChange()}
            disabled={updating || newStatus === order.status}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
          >
            <PackageCheck className="h-4 w-4" />
            Apply status
          </button>
          {order.allowedTransitions.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => void handleStatusChange(status)}
              disabled={updating}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              {statusLabel(status)}
            </button>
          ))}
        </div>
      </AdminEntityToolbar>

      <AdminMetricGrid>
        <AdminMetricCard label="Subtotal" value={formatMoney(order.subtotal, order.currency)} />
        <AdminMetricCard label="Shipping" value={formatMoney(order.shippingCost, order.currency)} meta={order.shippingZoneName || 'No zone'} />
        <AdminMetricCard label="Tax" value={formatMoney(order.taxAmount, order.currency)} meta={order.taxRegionName || 'No tax rule'} />
        <AdminMetricCard label="Total" value={formatMoney(order.total, order.currency)} meta={`${order.items.length} items`} tone="accent" />
      </AdminMetricGrid>

      <AdminSplitDetailShell
        main={
          <>
            {(error || success) && (
              <div className={`rounded-none border px-4 py-3 text-sm ${error ? 'border-blue-500/20 bg-blue-950/20 text-red-200' : 'border-emerald-500/20 bg-emerald-950/20 text-emerald-200'}`}>
                {error || success}
              </div>
            )}

            <section className="rounded-none border border-white/10 bg-[#171717] p-6">
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-zinc-100">Customer and shipping snapshot</h2>
                <p className="mt-1 text-sm text-zinc-500">Контакт, B2B context і адреса доставки для поточного fulfillment.</p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-none border border-white/10 bg-black/25 px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Customer</div>
                  <div className="mt-3 space-y-2 text-sm text-zinc-300">
                    <div className="text-lg font-medium text-zinc-100">{order.customerName}</div>
                    <div>{order.email}</div>
                    {order.phone ? <div>{order.phone}</div> : null}
                    {order.customerGroupSnapshot ? (
                      <div className="text-xs text-zinc-500">
                        {order.customerGroupSnapshot}
                        {order.b2bDiscountPercent ? ` · ${order.b2bDiscountPercent}% discount` : ''}
                        {order.discountNotes ? ` · ${order.discountNotes}` : ''}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-none border border-white/10 bg-black/25 px-4 py-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Shipping address</div>
                  <div className="mt-3 space-y-1 text-sm text-zinc-300">
                    <div>{address.line1 || '—'}</div>
                    {address.line2 ? <div>{address.line2}</div> : null}
                    <div>{[address.city, address.region, address.postcode].filter(Boolean).join(', ') || '—'}</div>
                    <div>{address.country || '—'}</div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-none border border-white/10 bg-[#171717] p-6">
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-zinc-100">Items</h2>
                <p className="mt-1 text-sm text-zinc-500">Current order composition and pricing at line level.</p>
              </div>
              <AdminTableShell>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                        <th className="px-4 py-4 font-medium">Item</th>
                        <th className="px-4 py-4 font-medium">SKU</th>
                        <th className="px-4 py-4 font-medium">Qty</th>
                        <th className="px-4 py-4 font-medium">Price</th>
                        <th className="px-4 py-4 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/6">
                      {order.items.map((item) => (
                        <tr key={item.id} className="transition hover:bg-white/[0.03]">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              {item.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={item.image} alt={item.title} className="h-10 w-10 rounded-none border border-white/10 object-cover" />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-none border border-white/10 bg-black/25">
                                  <Package className="h-4 w-4 text-zinc-600" />
                                </div>
                              )}
                              <div>
                                <div className="font-medium text-zinc-100">{item.title}</div>
                                {item.productSlug ? <div className="mt-1 text-xs text-zinc-500">{item.productSlug}</div> : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 font-mono text-xs text-zinc-400">{item.productSlug || '—'}</td>
                          <td className="px-4 py-4 text-zinc-300">{item.quantity}</td>
                          <td className="px-4 py-4 text-zinc-300">{formatMoney(item.price, order.currency)}</td>
                          <td className="px-4 py-4 font-medium text-zinc-100">{formatMoney(item.total, order.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </AdminTableShell>
            </section>

            <section className="rounded-none border border-white/10 bg-[#171717] p-6">
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-zinc-100">Shipments</h2>
                <p className="mt-1 text-sm text-zinc-500">Tracking records and shipment state transitions tied to the order.</p>
              </div>
              <div className="space-y-4">
                {order.shipments.map((shipment) => {
                  const draft = shipmentDrafts[shipment.id];
                  if (!draft) return null;
                  return (
                    <div key={shipment.id} className="rounded-none border border-white/10 bg-black/25 px-4 py-4">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <AdminStatusBadge tone={shipmentTone(shipment.status)}>{shipment.status.replace(/_/g, ' ')}</AdminStatusBadge>
                          <span className="font-medium text-zinc-100">{shipment.trackingNumber}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleUpdateShipment(shipment.id)}
                            disabled={shipmentSavingId === shipment.id}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
                          >
                            <Save className="h-3.5 w-3.5" />
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteShipment(shipment.id)}
                            disabled={shipmentDeletingId === shipment.id}
                            className="rounded-full border border-blue-500/20 bg-blue-950/20 px-3 py-2 text-xs text-red-200 transition hover:bg-blue-950/30 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <AdminInputField label="Carrier" value={draft.carrier} onChange={(value) => setShipmentDrafts((current) => ({ ...current, [shipment.id]: { ...draft, carrier: value } }))} />
                        <AdminInputField label="Service level" value={draft.serviceLevel} onChange={(value) => setShipmentDrafts((current) => ({ ...current, [shipment.id]: { ...draft, serviceLevel: value } }))} />
                        <AdminInputField label="Tracking number" value={draft.trackingNumber} onChange={(value) => setShipmentDrafts((current) => ({ ...current, [shipment.id]: { ...draft, trackingNumber: value } }))} />
                        <AdminInputField label="Tracking URL" value={draft.trackingUrl} onChange={(value) => setShipmentDrafts((current) => ({ ...current, [shipment.id]: { ...draft, trackingUrl: value } }))} />
                        <AdminSelectField
                          label="Shipment status"
                          value={draft.status}
                          onChange={(value) => setShipmentDrafts((current) => ({ ...current, [shipment.id]: { ...draft, status: value as ShipmentStatus } }))}
                          options={SHIPMENT_STATUS_OPTIONS}
                        />
                        <AdminInputField label="Shipped at" value={draft.shippedAt} onChange={(value) => setShipmentDrafts((current) => ({ ...current, [shipment.id]: { ...draft, shippedAt: value } }))} type="datetime-local" />
                        <AdminInputField label="Delivered at" value={draft.deliveredAt} onChange={(value) => setShipmentDrafts((current) => ({ ...current, [shipment.id]: { ...draft, deliveredAt: value } }))} type="datetime-local" />
                      </div>
                      <div className="mt-4">
                        <AdminTextareaField
                          label="Shipment notes"
                          value={draft.notes}
                          onChange={(value) => setShipmentDrafts((current) => ({ ...current, [shipment.id]: { ...draft, notes: value } }))}
                          rows={3}
                        />
                      </div>
                    </div>
                  );
                })}

                <div className="rounded-none border border-dashed border-white/10 px-4 py-4">
                  <div className="mb-4 flex items-center gap-2 text-zinc-100">
                    <Truck className="h-4 w-4 text-blue-300/60" />
                    <span className="font-medium">Create shipment</span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <AdminInputField label="Carrier" value={newShipment.carrier} onChange={(value) => setNewShipment((current) => ({ ...current, carrier: value }))} />
                    <AdminInputField label="Service level" value={newShipment.serviceLevel} onChange={(value) => setNewShipment((current) => ({ ...current, serviceLevel: value }))} />
                    <AdminInputField label="Tracking number" value={newShipment.trackingNumber} onChange={(value) => setNewShipment((current) => ({ ...current, trackingNumber: value }))} />
                    <AdminInputField label="Tracking URL" value={newShipment.trackingUrl} onChange={(value) => setNewShipment((current) => ({ ...current, trackingUrl: value }))} />
                    <AdminSelectField label="Shipment status" value={newShipment.status} onChange={(value) => setNewShipment((current) => ({ ...current, status: value as ShipmentStatus }))} options={SHIPMENT_STATUS_OPTIONS} />
                    <AdminInputField label="Shipped at" value={newShipment.shippedAt} onChange={(value) => setNewShipment((current) => ({ ...current, shippedAt: value }))} type="datetime-local" />
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <AdminTextareaField label="Shipment notes" value={newShipment.notes} onChange={(value) => setNewShipment((current) => ({ ...current, notes: value }))} rows={3} />
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => void handleCreateShipment()}
                        disabled={shipmentSavingId === 'new'}
                        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
                      >
                        Create shipment
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-none border border-white/10 bg-[#171717] p-6">
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-zinc-100">Pricing snapshot</h2>
                <p className="mt-1 text-sm text-zinc-500">Stored pricing snapshot for audit and manual review.</p>
              </div>
              <pre className="overflow-x-auto rounded-none border border-white/10 bg-black/25 p-4 text-[11px] text-zinc-400">
                {JSON.stringify(order.pricingSnapshot ?? {}, null, 2)}
              </pre>
            </section>

            <section className="rounded-none border border-white/10 bg-[#171717] p-6">
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-zinc-100">Timeline</h2>
                <p className="mt-1 text-sm text-zinc-500">Status transitions and admin notes captured on the order.</p>
              </div>
              <AdminTimelineList
                items={order.events.map((event) => ({
                  id: event.id,
                  title: `${event.fromStatus ? `${statusLabel(event.fromStatus)} → ` : ''}${statusLabel(event.toStatus)}`,
                  meta: `${event.actorName || event.actorType} · ${new Date(event.createdAt).toLocaleString()}`,
                  body: event.note || undefined,
                  tone: event.toStatus === 'DELIVERED' ? 'success' : event.toStatus === 'CANCELLED' ? 'danger' : 'warning',
                }))}
                empty="No order events yet."
              />
            </section>
          </>
        }
        sidebar={
          <>
            <AdminInspectorCard
              title="Order meta"
              description="Identifiers, created dates and routing context."
            >
              <AdminKeyValueGrid
                rows={[
                  { label: 'Order id', value: order.id },
                  { label: 'Created', value: new Date(order.createdAt).toLocaleString() },
                  { label: 'Updated', value: new Date(order.updatedAt).toLocaleString() },
                  { label: 'Shipping zone', value: order.shippingZoneName || '—' },
                  { label: 'Tax rule', value: order.taxRegionName || '—' },
                ]}
              />
            </AdminInspectorCard>

            <AdminInspectorCard
              title="Payment and fulfillment"
              description="Manager-controlled payment state and manual logistics override."
            >
              <div className="space-y-4">
                <AdminSelectField
                  label="Payment status"
                  value={paymentStatus}
                  onChange={setPaymentStatus}
                  options={[
                    { value: 'UNPAID', label: 'Не оплачено' },
                    { value: 'PARTIALLY_PAID', label: 'Оплачено частково' },
                    { value: 'PAID', label: 'Оплачено повністю' },
                  ]}
                />
                <AdminInputField label="Amount paid" value={amountPaid} onChange={setAmountPaid} type="number" step="0.01" />
                <AdminSelectField
                  label="Delivery method"
                  value={deliveryMethod}
                  onChange={setDeliveryMethod}
                  options={[
                    { value: '', label: 'Не обрано' },
                    { value: 'NOVA_POSHTA', label: 'Нова Пошта' },
                    { value: 'SPECIAL_DELIVERY', label: 'Спецдоставка (OneCompany)' },
                    { value: 'PICKUP', label: 'Самовивіз' },
                  ]}
                />
                <AdminInputField label="TTN number" value={ttnNumber} onChange={setTtnNumber} />
                <AdminInputField
                  label="Shipping override"
                  value={shippingCalculatedCost}
                  onChange={setShippingCalculatedCost}
                  type="number"
                  step="0.01"
                />
                <button
                  type="button"
                  onClick={() => void handlePaymentAndFulfillmentSave()}
                  disabled={updating}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  Save payment & fulfillment
                </button>
              </div>
            </AdminInspectorCard>

            <AdminInspectorCard
              title="Tags"
              description="Internal labels for filtering and ops workflows."
            >
              <AdminTagInput
                entityType="shop.order"
                entityId={order.id}
                suggestions={['priority', 'wholesale', 'fragile', 'gift', 'rush', 'review-needed']}
              />
            </AdminInspectorCard>

            <AdminInspectorCard
              title="Notes"
              description="Internal notes (visible to admins only)."
            >
              <AdminNotes entityType="shop.order" entityId={order.id} />
            </AdminInspectorCard>

            <AdminInspectorCard
              title="Activity"
              description="All admin mutations on this order, newest first."
            >
              <AdminActivityTimeline
                entityType="shop.order"
                entityId={order.id}
                emptyTitle="No activity logged"
                emptyDescription="Status changes, payment edits and shipment updates will appear here."
              />
            </AdminInspectorCard>

            <AdminInspectorCard
              title="Documents"
              description="Print-ready invoice and packing slip. Use browser Save as PDF."
            >
              <div className="space-y-2">
                <a
                  href={`/api/admin/pdf/invoice/${order.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/[0.06] px-4 py-2 text-sm font-medium text-blue-300 transition hover:bg-blue-500/[0.12]"
                >
                  <FileText className="h-4 w-4" />
                  Invoice (PDF)
                </a>
                <a
                  href={`/api/admin/pdf/packing-slip/${order.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
                >
                  <Printer className="h-4 w-4" />
                  Packing slip
                </a>
              </div>
            </AdminInspectorCard>

            <AdminInspectorCard
              title="Customer link"
              description="Customer-facing order confirmation and payment shortcuts."
            >
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => void copyConfirmationLink()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
                >
                  <Copy className="h-4 w-4" />
                  {copyState || 'Copy customer link'}
                </button>
                <a
                  href={confirmationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open customer view
                </a>
                <button
                  type="button"
                  onClick={() => void handleGenerateWhitepayFiatLink()}
                  disabled={updating}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm text-red-200 transition hover:bg-blue-500/15 disabled:opacity-50"
                >
                  <DollarSign className="h-4 w-4" />
                  Whitepay Fiat
                </button>
                <button
                  type="button"
                  onClick={() => void handleGenerateWhitepayCryptoLink()}
                  disabled={updating}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-none border border-blue-500/25 bg-blue-500/[0.06] px-4 py-2 text-sm font-bold uppercase tracking-wider text-red-200 transition hover:border-blue-500/40 hover:bg-blue-500/[0.1] disabled:opacity-50"
                >
                  Whitepay Crypto
                </button>
              </div>
            </AdminInspectorCard>
          </>
        }
      />

      {/* Mobile bottom bar — primary save action follows scroll */}
      <AdminMobileBottomBar>
        <button
          type="button"
          onClick={() => void handlePaymentAndFulfillmentSave()}
          disabled={updating}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {updating ? 'Saving…' : 'Save'}
        </button>
        <a
          href={`/api/admin/pdf/invoice/${order.id}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-zinc-200"
          aria-label="Invoice PDF"
        >
          <FileText className="h-4 w-4" />
        </a>
      </AdminMobileBottomBar>
    </AdminPage>
  );
}
