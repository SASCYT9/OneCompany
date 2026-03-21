'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Copy, ExternalLink, PackageCheck, Truck } from 'lucide-react';

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
  shippingAddress: Record<string, unknown>;
  currency: string;
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  total: number;
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
      setOrder(data as OrderDetail);
      setNewStatus((data as OrderDetail).status);
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
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-5xl p-6">
        <Link
          href="/admin/shop/orders"
          className="mb-6 inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад до замовлень
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-mono text-xl font-semibold text-white">{order.orderNumber}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs capitalize ${statusBadgeClass(order.status)}`}>
                  {statusLabel(order.status)}
                </span>
                <span className="text-sm text-white/45">
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

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <SummaryCard label="Клієнт" value={order.customerName} detail={order.email} />
            <SummaryCard label="Зона доставки" value={order.shippingZoneName || 'Не визначено'} detail={order.shippingZoneId || '—'} />
            <SummaryCard label="Правило податку" value={order.taxRegionName || 'Не визначено'} detail={order.taxRegionId || '—'} />
            <SummaryCard label="Відправлення" value={String(order.shipments.length)} detail={`${order.events.length} подій у історії`} />
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
              <div>
                <span className="mb-1.5 block text-xs uppercase tracking-wider text-white/50">Примітка до статусу</span>
                <textarea
                  value={statusNote}
                  onChange={(event) => setStatusNote(event.target.value)}
                  rows={3}
                  placeholder="Необов'язкова примітка до історії замовлення"
                  className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
                />
              </div>
              <div>
                <span className="mb-1.5 block text-xs uppercase tracking-wider text-white/50">Зміна статусу вручну</span>
                <div className="flex items-center gap-3">
                  <select
                    value={newStatus}
                    onChange={(event) => setNewStatus(event.target.value)}
                    className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white"
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
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="mb-2 text-xs uppercase tracking-wider text-white/50">Контакт</p>
              <p className="text-white">{order.customerName}</p>
              <p className="mt-1 text-white/80">{order.email}</p>
              {order.phone ? <p className="mt-1 text-white/70">{order.phone}</p> : null}
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
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

          <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="mb-3 text-xs uppercase tracking-wider text-white/50">Позиції</p>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-white/5 pb-3 last:border-b-0 last:pb-0">
                  <div>
                    <div className="text-white">{item.title}</div>
                    <div className="mt-1 text-xs text-white/45">
                      {item.productSlug} · {item.quantity} × {formatMoney(item.price, order.currency)}
                    </div>
                  </div>
                  <div className="text-white/85">{formatMoney(item.total, order.currency)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4">
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

function SummaryCard({ label, value, detail }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
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
