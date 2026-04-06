'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Copy, ExternalLink, PackageCheck, Truck, Plus, Pencil, Trash2, Save, X, Package, DollarSign, AlertCircle } from 'lucide-react';

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
function statusLabel(status: string) {
  return ORDER_STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'PENDING_PAYMENT':
      return 'border-orange-500/30 bg-orange-500/10 text-orange-100';
    case 'PENDING_REVIEW':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
    case 'CONFIRMED':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-100';
    case 'PROCESSING':
      return 'border-violet-500/30 bg-violet-500/10 text-violet-100';
    case 'SHIPPED':
      return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100';
    case 'DELIVERED':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100';
    case 'CANCELLED':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-100';
    case 'REFUNDED':
      return 'border-zinc-500/30 bg-zinc-500/10 text-zinc-100';
    default:
      return 'border-white/15 bg-white/5 text-white/70';
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

  // Item editing state
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editQty, setEditQty] = useState('');
  const [itemSaving, setItemSaving] = useState(false);

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
      setOrder(data as OrderDetail);
      setNewStatus((data as OrderDetail).status);
      setPaymentStatus((data as OrderDetail).paymentStatus);
      setAmountPaid(String((data as OrderDetail).amountPaid));
      setDeliveryMethod((data as OrderDetail).deliveryMethod ?? '');
      setTtnNumber((data as OrderDetail).ttnNumber ?? '');
      setShippingCalculatedCost((data as OrderDetail).shippingCalculatedCost != null ? String((data as OrderDetail).shippingCalculatedCost) : '');
      setShipmentDrafts(
        Object.fromEntries(
          (data as OrderDetail).shipments.map((shipment) => [
            shipment.id,
            buildShipmentDraft(shipment),
          ])
        )
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
    if (!order || typeof window === 'undefined') {
      return '';
    }
    const locale = 'ua';
    return `${window.location.origin}/${locale}/shop/checkout/success?order=${encodeURIComponent(order.orderNumber)}&token=${encodeURIComponent(order.viewToken)}`;
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

  // Payment modal state
  const [showPayModal, setShowPayModal] = useState(false);
  const [payModalAmount, setPayModalAmount] = useState('');
  const [payModalMode, setPayModalMode] = useState<'add' | 'set'>('add');

  async function handleRecordPayment() {
    if (!id || !order) return;
    const inputAmount = parseFloat(payModalAmount);
    if (isNaN(inputAmount) || inputAmount === 0) { setError('Введіть коректну суму'); return; }

    let newAmountPaid: number;
    if (payModalMode === 'add') {
      newAmountPaid = (order.amountPaid || 0) + inputAmount;
    } else {
      newAmountPaid = inputAmount;
    }

    // Determine payment status
    let newPaymentStatus = 'UNPAID';
    if (newAmountPaid >= order.total) newPaymentStatus = 'PAID';
    else if (newAmountPaid > 0) newPaymentStatus = 'PARTIALLY_PAID';

    setUpdating(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/shop/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentStatus: newPaymentStatus,
          amountPaid: Math.max(0, newAmountPaid),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Не вдалося записати оплату');
        return;
      }
      setAmountPaid(String(Math.max(0, newAmountPaid)));
      setPaymentStatus(newPaymentStatus);
      await load();
      setShowPayModal(false);
      setPayModalAmount('');
      if (newPaymentStatus === 'PAID') setSuccess('Борг повністю погашено!');
      else if (payModalMode === 'add' && inputAmount > 0) setSuccess(`Записано оплату ${formatMoney(inputAmount, order.currency)}`);
      else if (payModalMode === 'add' && inputAmount < 0) setSuccess(`Додано борг ${formatMoney(Math.abs(inputAmount), order.currency)}`);
      else setSuccess('Суму оплати оновлено');
    } finally {
      setUpdating(false);
    }
  }

  async function handleLogisticsUpdate() {
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
        setError(data.error || 'Не вдалося оновити логістику/оплату');
        return;
      }
      await load();
      setSuccess('Дані логістики і оплати збережено.');
    } finally {
      setUpdating(false);
    }
  }

  async function copyConfirmationLink() {
    if (!confirmationUrl) return;
    try {
      await navigator.clipboard.writeText(confirmationUrl);
      setCopyState('Скопійовано');
      window.setTimeout(() => setCopyState(''), 1500);
    } catch {
      setCopyState('Помилка копіювання');
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
    if (!confirm('Видалити це відправлення?')) return;

    setShipmentDeletingId(shipmentId);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/shop/shipments/${shipmentId}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Не вдалося видалити відправлення');
        return;
      }

      await load();
      setSuccess('Відправлення видалено.');
    } finally {
      setShipmentDeletingId(null);
    }
  }

  async function handleGenerateHutkoLink() {
    if (!id || !order) return;
    setUpdating(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/shop/orders/${id}/hutko`, {
        method: 'POST',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Не вдалося згенерувати посилання');
        return;
      }
      await load();
      setSuccess('Посилання на оплату Hutko успішно згенеровано та СКОПІЙОВАНО в буфер обміну!');
      if (data.url) {
        navigator.clipboard.writeText(data.url).catch(() => {});
        window.open(data.url, '_blank');
      }
    } finally {
      setUpdating(false);
    }
  }

  async function handleGenerateStripeLink() {
    if (!id || !order) return;
    setUpdating(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/shop/orders/${id}/stripe`, {
        method: 'POST',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Не вдалося згенерувати Stripe посилання');
        return;
      }
      await load();
      setSuccess('Посилання на оплату Stripe успішно згенеровано та СКОПІЙОВАНО в буфер обміну!');
      if (data.url) {
        navigator.clipboard.writeText(data.url).catch(() => {});
        window.open(data.url, '_blank');
      }
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-white/60">Завантаження замовлення…</div>;
  }

  if (error && !order) {
    return (
      <div className="p-6">
        <p className="text-amber-400">{error}</p>
        <Link href="/admin/shop/orders" className="mt-4 inline-block text-white/70 hover:text-white">
          ← Назад до замовлень
        </Link>
      </div>
    );
  }

  if (!order) return null;

  const addr = order.shippingAddress as Record<string, string>;

  return (
    <div className="relative min-h-full overflow-auto pb-20">
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/8 blur-[120px]" />
      <div className="mx-auto max-w-[1920px] p-6 lg:p-10">
        <Link
          href="/admin/shop/orders"
          className="mb-6 inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад до замовлень
        </Link>

        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 backdrop-blur-md">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(order.orderNumber);
                    setSuccess('Номер замовлення скопійовано!');
                    setTimeout(() => setSuccess(''), 2000);
                  }}
                  className="font-mono text-xl font-semibold text-white hover:text-blue-300 transition-colors cursor-pointer"
                  title="Натисніть щоб скопіювати"
                >
                  {order.orderNumber}
                </button>
                <Copy className="h-3.5 w-3.5 text-white/20" />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs capitalize ${statusBadgeClass(order.status)}`}>
                  {statusLabel(order.status)}
                </span>
                {order.amountPaid != null && (
                  order.amountPaid >= order.total
                    ? <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">Оплачено</span>
                    : <span className="inline-flex rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-300">
                        Борг: {formatMoney(order.total - order.amountPaid, order.currency)}
                      </span>
                )}
                <button
                  type="button"
                  onClick={() => { setPayModalAmount(''); setPayModalMode('add'); setShowPayModal(true); }}
                  className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300 shadow-[0_0_15px_-3px_rgba(99,102,241,0.2)] transition-all hover:border-indigo-500/50 hover:bg-indigo-500/20"
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  Внести платіж
                </button>
                <span className="text-sm font-light text-white/40">
                  Створено {new Date(order.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={copyConfirmationLink}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800"
              >
                <Copy className="h-4 w-4" />
                {copyState || 'Копіювати посилання для клієнта'}
              </button>
              <a
                href={confirmationUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800"
              >
                <ExternalLink className="h-4 w-4" />
                Відкрити перегляд для клієнта
              </a>
            </div>
          </div>

          {error ? <div className="mt-4 rounded-lg bg-red-900/20 p-3 text-sm text-red-300">{error}</div> : null}
          {success ? <div className="mt-4 rounded-lg bg-green-900/20 p-3 text-sm text-green-200">{success}</div> : null}

          <PaymentModal
            order={order}
            show={showPayModal}
            onClose={() => setShowPayModal(false)}
            amount={payModalAmount}
            setAmount={setPayModalAmount}
            mode={payModalMode}
            setMode={setPayModalMode}
            onSubmit={() => void handleRecordPayment()}
            updating={updating}
          />


          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <SummaryCard label="Клієнт" value={order.customerName} detail={order.email} />
            <SummaryCard label="Зона доставки" value={order.shippingZoneName || 'Не визначено'} detail={order.shippingZoneId || '—'} />
            {order.amountPaid != null && order.amountPaid < order.total ? (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 shadow-[0_0_20px_-5px_rgba(244,63,94,0.15)]">
                <div className="flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-rose-400">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Неоплачений борг
                </div>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <div className="text-xl font-bold text-rose-300">{formatMoney(order.total - order.amountPaid, order.currency)}</div>
                  <div className="text-xs text-rose-300/50">з {formatMoney(order.total, order.currency)}</div>
                </div>
                <div className="mt-1 text-xs text-rose-300/60">
                  Сплачено: {formatMoney(order.amountPaid, order.currency)}
                </div>
              </div>
            ) : (
              <SummaryCard
                label="Оплата"
                value={order.amountPaid != null ? formatMoney(order.amountPaid, order.currency) : '—'}
                detail={'Оплачено повністю'}
              />
            )}
            <SummaryCard label="Відправлення" value={String(order.shipments.length)} detail={`${order.events.length} подій у історії`} />
          </div>

          <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-4 backdrop-blur-md">
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <div>
                <span className="mb-1.5 block text-xs uppercase tracking-wider text-white/50">Примітка до статусу</span>
                <textarea
                  value={statusNote}
                  onChange={(event) => setStatusNote(event.target.value)}
                  rows={3}
                  placeholder="Необов'язкова примітка до історії замовлення"
                  className="box-border w-full resize-none rounded-lg border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
                />
              </div>
              <div>
                <span className="mb-1.5 block text-xs uppercase tracking-wider text-white/50">Зміна статусу вручну</span>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <select
                    value={newStatus}
                    onChange={(event) => setNewStatus(event.target.value)}
                    className="flex-1 rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white"
                  >
                    {[order.status, ...order.allowedTransitions].map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleStatusChange()}
                    disabled={updating || newStatus === order.status}
                    className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
                  >
                    {updating ? 'Зберігаємо…' : 'Застосувати'}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <span className="mb-2 block text-xs uppercase tracking-wider text-white/50">Швидкі переходи</span>
              <div className="flex flex-wrap gap-2">
                {order.allowedTransitions.length ? (
                  order.allowedTransitions.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => void handleStatusChange(status)}
                      disabled={updating}
                      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 disabled:opacity-50"
                    >
                      <PackageCheck className="h-3.5 w-3.5" />
                      {statusLabel(status)}
                    </button>
                  ))
                ) : (
                  <span className="text-xs text-white/35">Немає доступних переходів</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 backdrop-blur-md">
              <p className="mb-2 text-xs uppercase tracking-wider text-white/50">Контакт</p>
              <p className="text-white text-lg font-medium">{order.customerName}</p>
              <p className="mt-1 text-white/80">{order.email}</p>
              {order.phone ? <p className="mt-1 text-white/70">{order.phone}</p> : null}
              {order.customerGroupSnapshot && order.customerGroupSnapshot !== 'B2C' && (
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs font-medium text-indigo-300">
                  <span>💎 Група: {order.customerGroupSnapshot}</span>
                  {order.b2bDiscountPercent ? (
                    <>
                      <span className="text-white/20">•</span>
                      <span>Знижка: {order.b2bDiscountPercent}%</span>
                    </>
                  ) : null}
                  {order.discountNotes && (
                    <>
                      <span className="text-white/20">•</span>
                      <span className="text-indigo-400/60 font-mono truncate max-w-[200px]" title={order.discountNotes}>{order.discountNotes}</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 backdrop-blur-md">
              <p className="mb-2 text-xs uppercase tracking-wider text-white/50">Адреса доставки</p>
              <p className="text-white/90">{addr.line1}</p>
              {addr.line2 ? <p className="text-white/80">{addr.line2}</p> : null}
              <p className="text-white/90">
                {addr.city}
                {addr.region ? `, ${addr.region}` : ''} {addr.postcode ?? ''}
              </p>
              <p className="text-white/90">{addr.country}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 backdrop-blur-md">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-wider text-white/50">Оплата та Борг</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleGenerateStripeLink()}
                    disabled={updating || !['EUR', 'USD'].includes(order.currency)}
                    className="rounded-lg bg-violet-500/20 px-3 py-1 text-xs text-violet-300 hover:bg-violet-500/30 disabled:opacity-50 transition-colors shadow-[0_0_10px_-2px_rgba(139,92,246,0.2)]"
                    title={!['EUR', 'USD'].includes(order.currency) ? 'Stripe підтримує тільки EUR та USD' : 'Генерувати Stripe Checkout Link'}
                  >
                    Stripe Лінк (Міжнар)
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleGenerateHutkoLink()}
                    disabled={updating}
                    className="rounded-lg bg-indigo-500/20 px-3 py-1 text-xs text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-50 transition-colors shadow-[0_0_10px_-2px_rgba(99,102,241,0.2)]"
                  >
                    Whitepay Лінк (UAH)
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleLogisticsUpdate()}
                    disabled={updating}
                    className="rounded-lg bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20 disabled:opacity-50 transition-colors"
                  >
                    Зберегти
                  </button>
                </div>
              </div>
              <div className="grid gap-3">
                <label className="text-sm">
                  <span className="mb-1 block text-white/70">Статус оплати</span>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-white focus:border-white/30"
                  >
                    <option value="UNPAID">Не оплачено</option>
                    <option value="PARTIALLY_PAID">Оплачено частково</option>
                    <option value="PAID">Оплачено повністю</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-white/70">Сплачена сума (з можливих {formatMoney(order.total, order.currency)})</span>
                  <input
                    type="number"
                    step="0.01"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-white focus:border-white/30"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 backdrop-blur-md">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-white/50">Спецдоставка / ТТН</p>
                <button
                  type="button"
                  onClick={() => void handleLogisticsUpdate()}
                  disabled={updating}
                  className="rounded-lg bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20 disabled:opacity-50"
                >
                  Зберегти
                </button>
              </div>
              <div className="grid gap-3">
                <label className="text-sm">
                  <span className="mb-1 block text-white/70">Тип доставки</span>
                  <select
                    value={deliveryMethod}
                    onChange={(e) => setDeliveryMethod(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-white focus:border-white/30"
                  >
                    <option value="">Не обрано</option>
                    <option value="NOVA_POSHTA">Нова Пошта</option>
                    <option value="SPECIAL_DELIVERY">Спецдоставка (OneCompany)</option>
                    <option value="PICKUP">Самовивіз</option>
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    <span className="mb-1 block text-white/70">Номер ТТН</span>
                    <input
                      type="text"
                      value={ttnNumber}
                      onChange={(e) => setTtnNumber(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-white focus:border-white/30"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-white/70">Розрахована вартість</span>
                    <input
                      type="number"
                      step="0.01"
                      value={shippingCalculatedCost}
                      onChange={(e) => setShippingCalculatedCost(e.target.value)}
                      placeholder="Авто/Вручну"
                      className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-white focus:border-white/30"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-4 backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-white/50">Позиції ({order.items.length})</p>
              <button
                type="button"
                onClick={() => setShowAddItem(!showAddItem)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10 transition-colors"
              >
                <Plus className="h-3 w-3" /> Додати позицію
              </button>
            </div>

            {/* Add Item Form */}
            {showAddItem && (
              <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4">
                <p className="mb-3 text-xs uppercase tracking-wider text-emerald-400/70">Нова позиція</p>
                <div className="grid gap-3 sm:grid-cols-[1fr_100px_80px_auto]">
                  <input
                    type="text" placeholder="Назва товару" value={newItemTitle}
                    onChange={e => setNewItemTitle(e.target.value)}
                    className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                  />
                  <input
                    type="number" step="0.01" placeholder="Ціна" value={newItemPrice}
                    onChange={e => setNewItemPrice(e.target.value)}
                    className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                  />
                  <input
                    type="number" min="1" placeholder="К-ть" value={newItemQty}
                    onChange={e => setNewItemQty(e.target.value)}
                    className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={itemSaving || !newItemTitle || !newItemPrice}
                      onClick={async () => {
                        setItemSaving(true);
                        setError('');
                        try {
                          const res = await fetch(`/api/admin/shop/orders/${id}/items`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ title: newItemTitle, price: parseFloat(newItemPrice), quantity: parseInt(newItemQty) || 1 }),
                          });
                          if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
                          setNewItemTitle(''); setNewItemPrice(''); setNewItemQty('1'); setShowAddItem(false);
                          await load();
                          setSuccess('Позицію додано.');
                        } catch (e: any) { setError(e.message); }
                        finally { setItemSaving(false); }
                      }}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => setShowAddItem(false)} className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/20">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {order.items.map((item) => {
                const snap = order.pricingSnapshot as any;
                const itemDetails = snap?.itemDetails as any[] | undefined;
                const detail = itemDetails?.find((d: any) => d.partNumber === item.productSlug?.replace(/^(admin-|turn14-|draft-)/, '') || d.title === item.title?.replace(/\s*\(.*\)\s*$/, ''));
                const isEditing = editingItemId === item.id;

                return (
                  <div key={item.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    {isEditing ? (
                      <div className="grid gap-3 sm:grid-cols-[1fr_100px_80px_auto]">
                        <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                          className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none" />
                        <input type="number" step="0.01" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                          className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none" />
                        <input type="number" min="1" value={editQty} onChange={e => setEditQty(e.target.value)}
                          className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none" />
                        <div className="flex gap-2">
                          <button type="button" disabled={itemSaving}
                            onClick={async () => {
                              setItemSaving(true); setError('');
                              try {
                                const res = await fetch(`/api/admin/shop/orders/${id}/items`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ itemId: item.id, title: editTitle, price: parseFloat(editPrice), quantity: parseInt(editQty) }),
                                });
                                if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
                                setEditingItemId(null); await load(); setSuccess('Позицію оновлено.');
                              } catch (e: any) { setError(e.message); }
                              finally { setItemSaving(false); }
                            }}
                            className="rounded-lg bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
                          ><Save className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => setEditingItemId(null)} className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/20">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex min-w-0 flex-1 items-start gap-4">
                          {item.image ? (
                            <div className="w-12 h-12 rounded bg-white/5 border border-white/10 overflow-hidden flex-shrink-0 relative">
                              <img src={item.image} alt={item.title} className="object-cover w-full h-full" />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                              <Package className="w-5 h-5 text-white/20" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-white font-medium truncate max-w-[400px]">{item.title}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-white/45">
                              {detail?.partNumber ? (
                                <span className="text-indigo-400 font-mono tracking-wider">{detail.partNumber}</span>
                              ) : item.productSlug && (
                                <span className="text-indigo-400 font-mono tracking-wider">
                                  {item.productSlug.replace(/^(admin-|turn14-|draft-|crm-)\d*-?/, '').replace(/-[a-z0-9]{6,}$/, '') || item.productSlug}
                                </span>
                              )}
                              {detail?.brand && <span className="text-white/40">{detail.brand}</span>}
                              <span className="text-white/30 px-1">•</span>
                              <span className="text-white/60">{item.quantity} × {formatMoney(item.price, order.currency)}</span>
                              {detail?.turn14Id && <span className="text-white/25">T14: {detail.turn14Id}</span>}
                            </div>
                            {detail && (
                              <div className="mt-2 flex flex-wrap gap-3 text-[10px] uppercase tracking-wider">
                                {detail.baseCostUsd != null && (
                                  <span className="rounded border border-blue-500/15 bg-blue-500/5 px-2 py-0.5 text-blue-300">Закупка: ${detail.baseCostUsd}</span>
                                )}
                                {detail.markupPct != null && (
                                  <span className="rounded border border-amber-500/15 bg-amber-500/5 px-2 py-0.5 text-amber-300">Націнка: {detail.markupPct}%</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-white font-medium">{formatMoney(item.total, order.currency)}</div>
                          </div>
                          <div className="flex gap-1">
                            <button type="button" title="Редагувати"
                              onClick={() => { setEditingItemId(item.id); setEditTitle(item.title); setEditPrice(String(item.price)); setEditQty(String(item.quantity)); }}
                              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                            ><Pencil className="h-3 w-3" /></button>
                            <button type="button" title="Видалити"
                              onClick={async () => {
                                if (!confirm('Видалити цю позицію?')) return;
                                setItemSaving(true); setError('');
                                try {
                                  const res = await fetch(`/api/admin/shop/orders/${id}/items`, {
                                    method: 'DELETE',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ itemId: item.id }),
                                  });
                                  if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
                                  await load(); setSuccess('Позицію видалено.');
                                } catch (e: any) { setError(e.message); }
                                finally { setItemSaving(false); }
                              }}
                              className="rounded-lg border border-red-500/20 bg-red-500/5 p-1.5 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            ><Trash2 className="h-3 w-3" /></button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {order.items.length === 0 && (
                <div className="py-8 text-center text-sm text-white/30">
                  Немає позицій. Натисніть «Додати позицію» щоб внести товари.
                </div>
              )}
            </div>
          </div>

          {/* Pricing breakdown from snapshot */}
          {order.pricingSnapshot ? (() => {
            const snap = order.pricingSnapshot as Record<string, any>;
            const shippingCalc = snap?.shippingCalc;
            return (
            <div className="mt-4 rounded-xl border border-indigo-500/10 bg-indigo-500/[0.02] p-4">
              <p className="mb-3 text-xs uppercase tracking-wider text-indigo-400/60">Розрахунок ціни (Pricing Snapshot)</p>
                <div className="grid gap-3 md:grid-cols-2 text-xs">
                    {snap?.source && (
                      <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                        <div className="text-white/40 mb-1">Джерело</div>
                        <div className="text-white/80">{snap.source === 'admin_manual' ? 'Створено адміном' : snap.source === 'turn14_catalog' ? 'Turn14 каталог' : String(snap.source)}</div>
                        {snap.zone && <div className="text-white/50 mt-1">Зона: {String(snap.zone)}</div>}
                        {snap.customerDiscount != null && Number(snap.customerDiscount) > 0 && (
                          <div className="text-emerald-400/70 mt-1">Знижка клієнта: {String(snap.customerDiscount)}%</div>
                        )}
                      </div>
                    )}
                    {shippingCalc && (
                      <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                        <div className="text-white/40 mb-1">Доставка (розрахунок)</div>
                        <div className="space-y-0.5 text-white/70">
                          {shippingCalc.totalWeightKg != null && <div>Факт. вага: {Number(shippingCalc.totalWeightKg).toFixed(2)} кг</div>}
                          {shippingCalc.totalVolWeightKg != null && <div>Об&apos;ємна вага: {Number(shippingCalc.totalVolWeightKg).toFixed(2)} кг</div>}
                          {shippingCalc.volSurchargeKg != null && Number(shippingCalc.volSurchargeKg) > 0 && (
                            <div>Об&apos;ємна доплата: {Number(shippingCalc.volSurchargeKg).toFixed(2)} кг</div>
                          )}
                          {shippingCalc.ratePerKg != null && <div>Ставка: ${String(shippingCalc.ratePerKg)}/кг</div>}
                          {shippingCalc.volSurchargePerKg != null && <div>Об&apos;ємна ставка: ${String(shippingCalc.volSurchargePerKg)}/кг</div>}
                          {shippingCalc.autoShippingTotal != null && (
                            <div className="pt-1 border-t border-white/10 font-medium text-white/90">
                              Авто-розрахунок: ${Number(shippingCalc.autoShippingTotal).toFixed(2)}
                              {shippingCalc.overridden && <span className="text-amber-400/70 ml-2">(перевизначено)</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {snap?.notes && (
                      <div className="rounded-lg border border-white/10 bg-black/30 p-3 md:col-span-2">
                        <div className="text-white/40 mb-1">Примітки</div>
                        <div className="text-white/70">{String(snap.notes)}</div>
                      </div>
                    )}
                  </div>
            </div>
            );
          })() : null}

          <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-4 backdrop-blur-md">
            <div className="grid gap-3 text-sm">
              <SummaryRow label="Підсумок" value={formatMoney(order.subtotal, order.currency)} />
              <SummaryRow label="Доставка" value={formatMoney(order.shippingCost, order.currency)} />
              <SummaryRow label="Податок" value={formatMoney(order.taxAmount, order.currency)} />
              <SummaryRow label="Всього" value={formatMoney(order.total, order.currency)} strong />
            </div>
            <div className="mt-4 text-xs text-white/40">
              Оновлено {new Date(order.updatedAt).toLocaleString()}
            </div>
          </div>

          <div className="mt-6 border-t border-white/10 pt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-wider text-white/50">Відправлення</p>
              <span className="text-xs text-white/40">
                Оновлення відстеження можуть автоматично змінювати статус замовлення.
              </span>
            </div>

            <div className="space-y-4">
              {order.shipments.map((shipment) => {
                const draft = shipmentDrafts[shipment.id] ?? buildShipmentDraft(shipment);
                return (
                  <div key={shipment.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-white">
                          {shipment.carrier} · {shipment.trackingNumber}
                        </div>
                        <div className="mt-1 text-xs text-white/45">
                          Створено {new Date(shipment.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {shipment.trackingUrl ? (
                          <a
                            href={shipment.trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white hover:bg-zinc-800"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Посилання на відстеження
                          </a>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void handleDeleteShipment(shipment.id)}
                          disabled={shipmentDeletingId === shipment.id}
                          className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-200 hover:bg-red-500/15 disabled:opacity-50"
                        >
                          Видалити
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Перевізник">
                        <input
                          value={draft.carrier}
                          onChange={(event) =>
                            setShipmentDrafts((current) => ({
                              ...current,
                              [shipment.id]: { ...draft, carrier: event.target.value },
                            }))
                          }
                          className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                        />
                      </Field>
                      <Field label="Рівень сервісу">
                        <input
                          value={draft.serviceLevel}
                          onChange={(event) =>
                            setShipmentDrafts((current) => ({
                              ...current,
                              [shipment.id]: { ...draft, serviceLevel: event.target.value },
                            }))
                          }
                          className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                        />
                      </Field>
                      <Field label="Номер відстеження">
                        <input
                          value={draft.trackingNumber}
                          onChange={(event) =>
                            setShipmentDrafts((current) => ({
                              ...current,
                              [shipment.id]: { ...draft, trackingNumber: event.target.value },
                            }))
                          }
                          className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                        />
                      </Field>
                      <Field label="URL відстеження">
                        <input
                          value={draft.trackingUrl}
                          onChange={(event) =>
                            setShipmentDrafts((current) => ({
                              ...current,
                              [shipment.id]: { ...draft, trackingUrl: event.target.value },
                            }))
                          }
                          className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                        />
                      </Field>
                      <Field label="Shipment status">
                        <select
                          value={draft.status}
                          onChange={(event) =>
                            setShipmentDrafts((current) => ({
                              ...current,
                              [shipment.id]: { ...draft, status: event.target.value as ShipmentStatus },
                            }))
                          }
                          className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                        >
                          {SHIPMENT_STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Дата відправлення">
                        <input
                          type="datetime-local"
                          value={draft.shippedAt}
                          onChange={(event) =>
                            setShipmentDrafts((current) => ({
                              ...current,
                              [shipment.id]: { ...draft, shippedAt: event.target.value },
                            }))
                          }
                          className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                        />
                      </Field>
                      <Field label="Дата доставки">
                        <input
                          type="datetime-local"
                          value={draft.deliveredAt}
                          onChange={(event) =>
                            setShipmentDrafts((current) => ({
                              ...current,
                              [shipment.id]: { ...draft, deliveredAt: event.target.value },
                            }))
                          }
                          className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                        />
                      </Field>
                      <Field label="Примітки">
                        <input
                          value={draft.notes}
                          onChange={(event) =>
                            setShipmentDrafts((current) => ({
                              ...current,
                              [shipment.id]: { ...draft, notes: event.target.value },
                            }))
                          }
                          className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                        />
                      </Field>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => void handleUpdateShipment(shipment.id)}
                        disabled={shipmentSavingId === shipment.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50"
                      >
                        <Truck className="h-4 w-4" />
                        {shipmentSavingId === shipment.id ? 'Зберігаємо…' : 'Зберегти відправлення'}
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-white">Нове відправлення</div>
                    <div className="mt-1 text-xs text-white/45">
                      Add carrier and tracking data for this order.
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Перевізник">
                    <input
                      value={newShipment.carrier}
                      onChange={(event) =>
                        setNewShipment((current) => ({ ...current, carrier: event.target.value }))
                      }
                      className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                    />
                  </Field>
                  <Field label="Рівень сервісу">
                    <input
                      value={newShipment.serviceLevel}
                      onChange={(event) =>
                        setNewShipment((current) => ({ ...current, serviceLevel: event.target.value }))
                      }
                      className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                    />
                  </Field>
                  <Field label="Номер відстеження">
                    <input
                      value={newShipment.trackingNumber}
                      onChange={(event) =>
                        setNewShipment((current) => ({ ...current, trackingNumber: event.target.value }))
                      }
                      className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                    />
                  </Field>
                  <Field label="URL відстеження">
                    <input
                      value={newShipment.trackingUrl}
                      onChange={(event) =>
                        setNewShipment((current) => ({ ...current, trackingUrl: event.target.value }))
                      }
                      className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                    />
                  </Field>
                  <Field label="Shipment status">
                    <select
                      value={newShipment.status}
                      onChange={(event) =>
                        setNewShipment((current) => ({
                          ...current,
                          status: event.target.value as ShipmentStatus,
                        }))
                      }
                      className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                    >
                      {SHIPMENT_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Дата відправлення">
                    <input
                      type="datetime-local"
                      value={newShipment.shippedAt}
                      onChange={(event) =>
                        setNewShipment((current) => ({ ...current, shippedAt: event.target.value }))
                      }
                      className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                    />
                  </Field>
                  <Field label="Дата доставки">
                    <input
                      type="datetime-local"
                      value={newShipment.deliveredAt}
                      onChange={(event) =>
                        setNewShipment((current) => ({ ...current, deliveredAt: event.target.value }))
                      }
                      className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                    />
                  </Field>
                  <Field label="Примітки">
                    <input
                      value={newShipment.notes}
                      onChange={(event) =>
                        setNewShipment((current) => ({ ...current, notes: event.target.value }))
                      }
                      className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                    />
                  </Field>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleCreateShipment()}
                    disabled={shipmentSavingId === 'new'}
                    className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50"
                  >
                    <Truck className="h-4 w-4" />
                    {shipmentSavingId === 'new' ? 'Створюємо…' : 'Створити відправлення'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-white/10 pt-6">
            <p className="mb-3 text-xs uppercase tracking-wider text-white/50">Історія</p>
            <div className="space-y-3">
              {order.events.length ? (
                order.events.map((event) => (
                  <div key={event.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm text-white">
                        {event.fromStatus
                          ? `${statusLabel(event.fromStatus)} → ${statusLabel(event.toStatus)}`
                          : statusLabel(event.toStatus)}
                      </div>
                      <div className="text-xs text-white/45">{new Date(event.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="mt-2 text-xs text-white/45">
                      {event.actorType}
                      {event.actorName ? ` · ${event.actorName}` : ''}
                    </div>
                    {event.note ? <div className="mt-2 text-sm text-white/75">{event.note}</div> : null}
                  </div>
                ))
              ) : (
                <div className="text-sm text-white/45">Подій поки немає.</div>
              )}
            </div>
          </div>

          {order.pricingSnapshot ? (
            <div className="mt-6 border-t border-white/10 pt-6">
              <p className="mb-3 text-xs uppercase tracking-wider text-white/50">Знімок розрахунку</p>
              <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-4 text-xs text-white/65">
                {JSON.stringify(order.pricingSnapshot, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type FieldProps = {
  label: string;
  children: React.ReactNode;
};

function Field({ label, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-white/50">{label}</span>
      {children}
    </label>
  );
}

type SummaryCardProps = {
  label: string;
  value: string;
  detail: string;
};

function PaymentModal({ order, show, onClose, amount, setAmount, mode, setMode, onSubmit, updating }: {
  order: OrderDetail;
  show: boolean;
  onClose: () => void;
  amount: string;
  setAmount: (v: string) => void;
  mode: 'add' | 'set';
  setMode: (v: 'add' | 'set') => void;
  onSubmit: () => void;
  updating: boolean;
}) {
  if (!show) return null;
  const currentPaid = order.amountPaid || 0;
  const debt = order.total - currentPaid;
  const paidPct = order.total > 0 ? Math.min(100, Math.round((currentPaid / order.total) * 100)) : 0;

  const presets = [
    { label: '25%', value: Math.round(debt * 0.25 * 100) / 100 },
    { label: '50%', value: Math.round(debt * 0.5 * 100) / 100 },
    { label: '100%', value: Math.round(debt * 100) / 100 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-md mx-4 rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 text-white/40 hover:text-white transition-colors">✕</button>

        <h3 className="text-lg font-medium text-white mb-1">Записати оплату</h3>
        <p className="text-sm text-white/50 mb-5">
          Замовлення {order.orderNumber} · {formatMoney(order.total, order.currency)}
        </p>

        {/* Progress bar */}
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs text-white/50 mb-2">
            <span>Оплачено: {formatMoney(currentPaid, order.currency)}</span>
            <span>{paidPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: paidPct + '%',
                background: paidPct >= 100
                  ? 'linear-gradient(90deg, #22c55e, #10b981)'
                  : paidPct > 0
                    ? 'linear-gradient(90deg, #3b82f6, #6366f1)'
                    : 'transparent',
              }}
            />
          </div>
          {debt > 0 && (
            <p className="text-xs text-amber-400 mt-1.5">Залишок боргу: {formatMoney(debt, order.currency)}</p>
          )}
        </div>

        {/* Mode selector */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMode('add')}
            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${mode === 'add' ? 'border-blue-500/50 bg-blue-500/15 text-blue-300' : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10'}`}
          >
            + Додати суму
          </button>
          <button
            type="button"
            onClick={() => setMode('set')}
            className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${mode === 'set' ? 'border-blue-500/50 bg-blue-500/15 text-blue-300' : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10'}`}
          >
            = Встановити суму
          </button>
        </div>

        {/* Amount input */}
        <div className="mb-4">
          <label className="block text-xs text-white/60 mb-1.5">
            {mode === 'add' ? 'Сума платежу (+ додати / − зняти)' : 'Нова загальна сплачена сума'}
          </label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={mode === 'add' ? 'Наприклад: 5000' : String(order.total)}
            className="w-full rounded-xl border border-white/15 bg-black/60 px-4 py-3 text-lg text-white placeholder-white/20 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-colors"
            autoFocus
          />
        </div>

        {/* Quick presets (only in add mode and with debt) */}
        {mode === 'add' && debt > 0 && (
          <div className="flex gap-2 mb-4">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setAmount(String(p.value))}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              >
                {p.label} ({formatMoney(p.value, order.currency)})
              </button>
            ))}
          </div>
        )}

        {/* Preview */}
        {amount && !isNaN(parseFloat(amount)) && (
          <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/60">
            {(() => {
              const val = parseFloat(amount);
              const newPaid = mode === 'add' ? currentPaid + val : val;
              const newDebt = order.total - Math.max(0, newPaid);
              return (
                <>
                  <div className="flex justify-between mb-1">
                    <span>Нова сплачена сума:</span>
                    <span className="text-white font-medium">{formatMoney(Math.max(0, newPaid), order.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Залишок боргу:</span>
                    <span className={newDebt <= 0 ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                      {newDebt <= 0 ? 'Погашено' : formatMoney(newDebt, order.currency)}
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/70 hover:bg-white/10 transition-colors"
          >
            Скасувати
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={updating || !amount || isNaN(parseFloat(amount))}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 transition-colors"
          >
            {updating ? 'Зберігаю…' : 'Записати'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, detail }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 backdrop-blur-md">
      <div className="text-xs uppercase tracking-[0.18em] text-white/40">{label}</div>
      <div className="mt-3 text-lg font-semibold text-white">{value}</div>
      <div className="mt-1 text-sm text-white/45">{detail}</div>
    </div>
  );
}

type SummaryRowProps = {
  label: string;
  value: string;
  strong?: boolean;
};

function SummaryRow({ label, value, strong = false }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={`text-white/55 ${strong ? 'font-medium' : ''}`}>{label}</span>
      <span className={strong ? 'font-semibold text-white' : 'text-white/80'}>{value}</span>
    </div>
  );
}
