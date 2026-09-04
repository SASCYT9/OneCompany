"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Copy,
  DollarSign,
  ExternalLink,
  FileText,
  PackageCheck,
  Printer,
  Save,
  Truck,
} from "lucide-react";

import {
  AdminInspectorCard,
  AdminKeyValueGrid,
  AdminPage,
  AdminSplitDetailShell,
  AdminStatusBadge,
  AdminTimelineList,
} from "@/components/admin/AdminPrimitives";
import {
  AdminInputField,
  AdminSelectField,
  AdminTextareaField,
} from "@/components/admin/AdminFormFields";
import { useConfirm } from "@/components/admin/AdminConfirmDialog";
import { useToast } from "@/components/admin/AdminToast";
import { AdminActivityTimeline } from "@/components/admin/AdminActivityTimeline";
import { AdminNotes } from "@/components/admin/AdminNotes";
import { AdminTagInput } from "@/components/admin/AdminTagInput";
import { AdminMobileBottomBar } from "@/components/admin/AdminMobileCard";

import styles from "./orderDetail.module.css";
import { buildOrderPaymentUpdate } from "@/lib/admin/orderPaymentDraft";
import {
  orderAddressText,
  orderPaymentLabel,
  orderPaymentMethodLabel,
} from "@/lib/shopOrderPresentation";

type OrderStatus =
  | "PENDING_PAYMENT"
  | "PENDING_REVIEW"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

type ShipmentStatus = "LABEL_CREATED" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED" | "RETURNED";

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

import { OrderProductLinks } from "@/components/admin/OrderProductLinks";
import { OrderCustomerBlock } from "@/components/admin/OrderCustomerBlock";

type OrderDetail = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  email: string;
  customerName: string;
  customerId?: string | null;
  companyName?: string | null;
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
  paymentMethod?: string;
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
    productId?: string | null;
    variantId?: string | null;
    variantTitle?: string | null;
    sku?: string | null;
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
  { value: "LABEL_CREATED", label: "Створено етикетку" },
  { value: "IN_TRANSIT", label: "В дорозі" },
  { value: "DELIVERED", label: "Доставлено" },
  { value: "CANCELLED", label: "Скасовано" },
  { value: "RETURNED", label: "Повернено" },
];

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Очікує оплату",
  PENDING_REVIEW: "На перевірці",
  CONFIRMED: "Підтверджено",
  PROCESSING: "В обробці",
  SHIPPED: "Відправлено",
  DELIVERED: "Доставлено",
  CANCELLED: "Скасовано",
  REFUNDED: "Повернено",
};

function emptyShipmentDraft(): ShipmentDraft {
  return {
    carrier: "",
    serviceLevel: "",
    trackingNumber: "",
    trackingUrl: "",
    status: "LABEL_CREATED",
    notes: "",
    shippedAt: "",
    deliveredAt: "",
  };
}

function buildShipmentDraft(shipment: ShipmentRecord): ShipmentDraft {
  return {
    carrier: shipment.carrier,
    serviceLevel: shipment.serviceLevel ?? "",
    trackingNumber: shipment.trackingNumber,
    trackingUrl: shipment.trackingUrl ?? "",
    status: shipment.status,
    notes: shipment.notes ?? "",
    shippedAt: shipment.shippedAt ? shipment.shippedAt.slice(0, 16) : "",
    deliveredAt: shipment.deliveredAt ? shipment.deliveredAt.slice(0, 16) : "",
  };
}

function statusLabel(status: string) {
  return ORDER_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

function statusTone(status: string): "default" | "success" | "warning" | "danger" {
  switch (status) {
    case "DELIVERED":
      return "success";
    case "CANCELLED":
    case "REFUNDED":
      return "danger";
    case "PENDING_PAYMENT":
    case "PENDING_REVIEW":
    case "PROCESSING":
    case "SHIPPED":
      return "warning";
    default:
      return "default";
  }
}

function shipmentTone(status: ShipmentStatus): "default" | "success" | "warning" | "danger" {
  switch (status) {
    case "DELIVERED":
      return "success";
    case "CANCELLED":
      return "danger";
    case "IN_TRANSIT":
      return "warning";
    default:
      return "default";
  }
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("");
  const [ttnNumber, setTtnNumber] = useState("");
  const [shippingCalculatedCost, setShippingCalculatedCost] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [copyState, setCopyState] = useState("");
  const [newShipment, setNewShipment] = useState<ShipmentDraft>(emptyShipmentDraft());
  const [shipmentDrafts, setShipmentDrafts] = useState<Record<string, ShipmentDraft>>({});
  const [shipmentSavingId, setShipmentSavingId] = useState<string | null>(null);
  const [shipmentDeletingId, setShipmentDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/admin/shop/orders/${id}`);
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setError("Unauthorized");
        return;
      }
      if (!response.ok) {
        setError(data.error || "Не вдалося завантажити замовлення");
        return;
      }
      const nextOrder = data as OrderDetail;
      setOrder(nextOrder);
      setNewStatus(nextOrder.status);
      setPaymentStatus(nextOrder.paymentStatus);
      setAmountPaid(String(nextOrder.amountPaid));
      setDeliveryMethod(nextOrder.deliveryMethod ?? "");
      setTtnNumber(nextOrder.ttnNumber ?? "");
      setShippingCalculatedCost(
        nextOrder.shippingCalculatedCost != null ? String(nextOrder.shippingCalculatedCost) : ""
      );
      setShipmentDrafts(
        Object.fromEntries(
          nextOrder.shipments.map((shipment) => [shipment.id, buildShipmentDraft(shipment)])
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
    if (!order || typeof window === "undefined") return "";
    return `${window.location.origin}/ua/shop/checkout/success?order=${encodeURIComponent(order.orderNumber)}&token=${encodeURIComponent(order.viewToken)}`;
  }, [order]);

  async function handleStatusChange(targetStatus?: string) {
    if (!id || !order) return;
    const nextStatus = targetStatus || newStatus;
    if (nextStatus === order.status) return;

    setUpdating(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/admin/shop/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, note: statusNote }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Не вдалося оновити");
        return;
      }
      await load();
      setStatusNote("");
      setSuccess(`Замовлення переведено в статус «${statusLabel(nextStatus)}».`);
    } finally {
      setUpdating(false);
    }
  }

  async function handlePaymentAndFulfillmentSave() {
    if (!id || !order) return;
    let patch;
    try {
      patch = buildOrderPaymentUpdate(order, {
        paymentStatus,
        amountPaid,
        deliveryMethod,
        ttnNumber,
        shippingCalculatedCost,
      });
    } catch (cause) {
      setError((cause as Error).message);
      return;
    }
    if (!Object.keys(patch).length) return;
    setUpdating(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/admin/shop/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Не вдалося оновити оплату/логістику");
        return;
      }
      await load();
      setSuccess("Оплату та доставку збережено.");
    } finally {
      setUpdating(false);
    }
  }

  async function copyConfirmationLink() {
    if (!confirmationUrl) return;
    try {
      await navigator.clipboard.writeText(confirmationUrl);
      setCopyState("Copied");
      window.setTimeout(() => setCopyState(""), 1500);
    } catch {
      setCopyState("Copy failed");
      window.setTimeout(() => setCopyState(""), 1500);
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
    setShipmentSavingId("new");
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/admin/shop/orders/${id}/shipments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildShipmentPayload(newShipment)),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Не вдалося створити відправлення");
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
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/admin/shop/shipments/${shipmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildShipmentPayload(draft)),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Не вдалося оновити відправлення");
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
      tone: "danger",
      title: "Видалити це відправлення?",
      description: "Запис відправлення буде видалено разом з трекінгом. Дію не можна скасувати.",
      confirmLabel: "Видалити",
    });
    if (!ok) return;
    setShipmentDeletingId(shipmentId);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/admin/shop/shipments/${shipmentId}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data.error || "Не вдалося видалити відправлення";
        setError(msg);
        toast.error("Не вдалося видалити", msg);
        return;
      }
      await load();
      setSuccess("Відправлення видалено.");
      toast.success("Відправлення видалено");
    } finally {
      setShipmentDeletingId(null);
    }
  }

  async function handleGenerateWhitepayFiatLink() {
    if (!id) return;
    setUpdating(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/admin/shop/orders/${id}/whitepay/fiat`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Не вдалося згенерувати Whitepay Fiat");
        return;
      }
      if (data.url) {
        await navigator.clipboard.writeText(data.url).catch(() => {});
        window.open(data.url, "_blank");
      }
      setSuccess("Whitepay Fiat link generated.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleGenerateWhitepayCryptoLink() {
    if (!id) return;
    setUpdating(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/admin/shop/orders/${id}/whitepay/crypto`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Не вдалося згенерувати Whitepay Crypto");
        return;
      }
      if (data.url) {
        await navigator.clipboard.writeText(data.url).catch(() => {});
        window.open(data.url, "_blank");
      }
      setSuccess("Whitepay Crypto link generated.");
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
        <div className="rounded-none border border-blue-500/20 bg-blue-950/20 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
        <Link
          href="/admin/shop/orders"
          className="inline-block text-sm text-zinc-300 hover:text-zinc-100"
        >
          До списку замовлень
        </Link>
      </AdminPage>
    );
  }

  if (!order) return null;

  const outstanding = Math.max(0, order.total - order.amountPaid);
  const paymentDirty =
    paymentStatus !== order.paymentStatus ||
    amountPaid !== String(order.amountPaid) ||
    deliveryMethod !== (order.deliveryMethod || "") ||
    ttnNumber !== (order.ttnNumber || "") ||
    shippingCalculatedCost !==
      (order.shippingCalculatedCost == null ? "" : String(order.shippingCalculatedCost));

  return (
    <AdminPage wide className={`space-y-5 ${styles.page}`}>
      <header className={styles.header}>
        <Link href="/admin/shop/orders" className={styles.back}>
          ← Усі замовлення
        </Link>
        <div className={styles.headingRow}>
          <div>
            <div className={styles.titleRow}>
              <h1>{order.orderNumber}</h1>
              <AdminStatusBadge tone={statusTone(order.status)}>
                {statusLabel(order.status)}
              </AdminStatusBadge>
            </div>
            <p>
              {new Date(order.createdAt).toLocaleString("uk-UA", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              · {order.customerName}
            </p>
          </div>
          <div className={styles.headerActions}>
            <a href="#payment">Оплата</a>
            <a href="#shipping">Доставка</a>
            <a href="#order-status">Статус</a>
            <a href={`/api/admin/pdf/proforma/${order.id}`} target="_blank" rel="noreferrer">
              <FileText size={15} /> Проформа
            </a>
          </div>
        </div>
      </header>
      <AdminSplitDetailShell
        className={styles.layout}
        main={
          <>
            {(error || success) && (
              <div
                className={`rounded-none border px-4 py-3 text-sm ${error ? "border-blue-500/20 bg-blue-950/20 text-red-200" : "border-emerald-500/20 bg-emerald-950/20 text-emerald-200"}`}
              >
                {error || success}
              </div>
            )}

            <div className={styles.mobileBuyer}>
              <AdminInspectorCard title="Покупець" description="Контакти з цього замовлення.">
                <OrderCustomerBlock order={order} />
                {(order.b2bDiscountPercent || order.discountNotes) && (
                  <p className="mt-3 text-xs text-zinc-400">
                    {order.b2bDiscountPercent ? `B2B знижка: ${order.b2bDiscountPercent}%` : ""}{" "}
                    {order.discountNotes}
                  </p>
                )}
                <div className={styles.address}>
                  <span>Адреса доставки</span>
                  <p>{orderAddressText(order.shippingAddress) || "Адресу не вказано"}</p>
                </div>
              </AdminInspectorCard>
            </div>
            <section className={styles.card} id="items">
              <div className={styles.sectionHeading}>
                <h2>Замовлені товари</h2>
                <span>{order.items.reduce((sum, item) => sum + item.quantity, 0)} шт.</span>
              </div>
              <div className={styles.itemList}>
                {order.items.map((item) => (
                  <div key={item.id} className={styles.item}>
                    <OrderProductLinks item={item} thumbnail />
                    <div className={styles.itemPrice}>
                      <strong>{formatMoney(item.total, order.currency)}</strong>
                      <span>
                        {item.quantity} × {formatMoney(item.price, order.currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {!order.items.length && (
                <p className="text-sm text-zinc-400">Товарів у замовленні немає.</p>
              )}
            </section>
            <section className={styles.card} id="payment">
              <div className={styles.sectionHeading}>
                <h2>Оплата</h2>
                <AdminStatusBadge tone={order.paymentStatus === "PAID" ? "success" : "warning"}>
                  {orderPaymentLabel(order.paymentStatus)}
                </AdminStatusBadge>
              </div>
              <p className="mb-4 text-xs text-zinc-400">
                {orderPaymentMethodLabel(order.paymentMethod)}
              </p>
              <dl className={styles.totals}>
                <div>
                  <dt>Товари</dt>
                  <dd>{formatMoney(order.subtotal, order.currency)}</dd>
                </div>
                <div>
                  <dt>Доставка</dt>
                  <dd>{formatMoney(order.shippingCost, order.currency)}</dd>
                </div>
                <div>
                  <dt>Податки</dt>
                  <dd>{formatMoney(order.taxAmount, order.currency)}</dd>
                </div>
                <div className={styles.total}>
                  <dt>Разом</dt>
                  <dd>{formatMoney(order.total, order.currency)}</dd>
                </div>
                <div>
                  <dt>Сплачено</dt>
                  <dd>{formatMoney(order.amountPaid, order.currency)}</dd>
                </div>
                <div className={styles.balance}>
                  <dt>До сплати</dt>
                  <dd>{formatMoney(outstanding, order.currency)}</dd>
                </div>
              </dl>
              <details className={styles.editPanel}>
                <summary>Редагувати оплату й умови доставки</summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <AdminSelectField
                    label="Статус оплати"
                    value={paymentStatus}
                    onChange={setPaymentStatus}
                    options={[
                      { value: "UNPAID", label: "Не оплачено" },
                      { value: "PARTIALLY_PAID", label: "Оплачено частково" },
                      { value: "PAID", label: "Оплачено повністю" },
                    ]}
                  />
                  <AdminInputField
                    label="Сплачена сума"
                    value={amountPaid}
                    onChange={setAmountPaid}
                    type="number"
                    step="0.01"
                  />
                  <AdminSelectField
                    label="Спосіб доставки"
                    value={deliveryMethod}
                    onChange={setDeliveryMethod}
                    options={[
                      { value: "", label: "Не обрано" },
                      { value: "NOVA_POSHTA", label: "Нова Пошта" },
                      { value: "SPECIAL_DELIVERY", label: "Спецдоставка (OneCompany)" },
                      { value: "PICKUP", label: "Самовивіз" },
                    ]}
                  />
                  <AdminInputField label="Номер ТТН" value={ttnNumber} onChange={setTtnNumber} />
                  <AdminInputField
                    label="Вартість доставки вручну"
                    value={shippingCalculatedCost}
                    onChange={setShippingCalculatedCost}
                    type="number"
                    step="0.01"
                  />
                  <button
                    type="button"
                    onClick={() => void handlePaymentAndFulfillmentSave()}
                    disabled={updating || !paymentDirty}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-linear-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    Зберегти оплату й доставку
                  </button>
                  {paymentDirty && (
                    <p className="text-xs text-amber-200" role="status">
                      Є незбережені зміни оплати або доставки.
                    </p>
                  )}
                </div>
              </details>{" "}
            </section>

            <section id="shipping" className="rounded-none border border-white/10 bg-[#171717] p-6">
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-zinc-100">Відправлення</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Відстеження посилок і статуси доставки.
                </p>
              </div>
              {!order.shipments.length && (
                <p className={styles.empty}>
                  Відправлень ще немає. Після передачі перевізнику додайте трек-номер для
                  відстеження.
                </p>
              )}
              <div className="space-y-4">
                {order.shipments.map((shipment) => {
                  const draft = shipmentDrafts[shipment.id];
                  if (!draft) return null;
                  return (
                    <div
                      key={shipment.id}
                      className="rounded-none border border-white/10 bg-black/25 px-4 py-4"
                    >
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <AdminStatusBadge tone={shipmentTone(shipment.status)}>
                            {shipment.status.replace(/_/g, " ")}
                          </AdminStatusBadge>
                          <span className="font-medium text-zinc-100">
                            {shipment.trackingNumber}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleUpdateShipment(shipment.id)}
                            disabled={shipmentSavingId === shipment.id}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
                          >
                            <Save className="h-3.5 w-3.5" />
                            Зберегти
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
                        <AdminInputField
                          label="Перевізник"
                          value={draft.carrier}
                          onChange={(value) =>
                            setShipmentDrafts((current) => ({
                              ...current,
                              [shipment.id]: { ...draft, carrier: value },
                            }))
                          }
                        />
                        <AdminInputField
                          label="Тип доставки"
                          value={draft.serviceLevel}
                          onChange={(value) =>
                            setShipmentDrafts((current) => ({
                              ...current,
                              [shipment.id]: { ...draft, serviceLevel: value },
                            }))
                          }
                        />
                        <AdminInputField
                          label="Трек-номер"
                          value={draft.trackingNumber}
                          onChange={(value) =>
                            setShipmentDrafts((current) => ({
                              ...current,
                              [shipment.id]: { ...draft, trackingNumber: value },
                            }))
                          }
                        />
                        <AdminInputField
                          label="Посилання відстеження"
                          value={draft.trackingUrl}
                          onChange={(value) =>
                            setShipmentDrafts((current) => ({
                              ...current,
                              [shipment.id]: { ...draft, trackingUrl: value },
                            }))
                          }
                        />
                        <AdminSelectField
                          label="Статус відправлення"
                          value={draft.status}
                          onChange={(value) =>
                            setShipmentDrafts((current) => ({
                              ...current,
                              [shipment.id]: { ...draft, status: value as ShipmentStatus },
                            }))
                          }
                          options={SHIPMENT_STATUS_OPTIONS}
                        />
                        <AdminInputField
                          label="Дата відправлення"
                          value={draft.shippedAt}
                          onChange={(value) =>
                            setShipmentDrafts((current) => ({
                              ...current,
                              [shipment.id]: { ...draft, shippedAt: value },
                            }))
                          }
                          type="datetime-local"
                        />
                        <AdminInputField
                          label="Delivered at"
                          value={draft.deliveredAt}
                          onChange={(value) =>
                            setShipmentDrafts((current) => ({
                              ...current,
                              [shipment.id]: { ...draft, deliveredAt: value },
                            }))
                          }
                          type="datetime-local"
                        />
                      </div>
                      <div className="mt-4">
                        <AdminTextareaField
                          label="Коментар до відправлення"
                          value={draft.notes}
                          onChange={(value) =>
                            setShipmentDrafts((current) => ({
                              ...current,
                              [shipment.id]: { ...draft, notes: value },
                            }))
                          }
                          rows={3}
                        />
                      </div>
                    </div>
                  );
                })}

                <details className={styles.editPanel}>
                  <summary>Додати відправлення</summary>
                  <div className="mb-4 flex items-center gap-2 text-zinc-100">
                    <Truck className="h-4 w-4 text-blue-300/60" />
                    <span className="font-medium">Створити відправлення</span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <AdminInputField
                      label="Перевізник"
                      value={newShipment.carrier}
                      onChange={(value) =>
                        setNewShipment((current) => ({ ...current, carrier: value }))
                      }
                    />
                    <AdminInputField
                      label="Тип доставки"
                      value={newShipment.serviceLevel}
                      onChange={(value) =>
                        setNewShipment((current) => ({ ...current, serviceLevel: value }))
                      }
                    />
                    <AdminInputField
                      label="Трек-номер"
                      value={newShipment.trackingNumber}
                      onChange={(value) =>
                        setNewShipment((current) => ({ ...current, trackingNumber: value }))
                      }
                    />
                    <AdminInputField
                      label="Посилання відстеження"
                      value={newShipment.trackingUrl}
                      onChange={(value) =>
                        setNewShipment((current) => ({ ...current, trackingUrl: value }))
                      }
                    />
                    <AdminSelectField
                      label="Статус відправлення"
                      value={newShipment.status}
                      onChange={(value) =>
                        setNewShipment((current) => ({
                          ...current,
                          status: value as ShipmentStatus,
                        }))
                      }
                      options={SHIPMENT_STATUS_OPTIONS}
                    />
                    <AdminInputField
                      label="Дата відправлення"
                      value={newShipment.shippedAt}
                      onChange={(value) =>
                        setNewShipment((current) => ({ ...current, shippedAt: value }))
                      }
                      type="datetime-local"
                    />
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <AdminTextareaField
                      label="Коментар до відправлення"
                      value={newShipment.notes}
                      onChange={(value) =>
                        setNewShipment((current) => ({ ...current, notes: value }))
                      }
                      rows={3}
                    />
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => void handleCreateShipment()}
                        disabled={shipmentSavingId === "new"}
                        className="inline-flex items-center gap-2 rounded-full bg-linear-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
                      >
                        Створити відправлення
                      </button>
                    </div>
                  </div>
                </details>
              </div>
            </section>

            <details className="rounded-none border border-white/10 bg-[#171717] p-6">
              <summary className="cursor-pointer">
                <h2 className="text-xl font-semibold text-zinc-100">Дані розрахунку ціни</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Технічні дані для перевірки розрахунку.
                </p>
              </summary>
              <pre className="overflow-x-auto rounded-none border border-white/10 bg-black/25 p-4 text-[11px] text-zinc-400">
                {JSON.stringify(order.pricingSnapshot ?? {}, null, 2)}
              </pre>
            </details>

            <section className="rounded-none border border-white/10 bg-[#171717] p-6">
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-zinc-100">Історія замовлення</h2>
                <p className="mt-1 text-sm text-zinc-500">Зміни статусу та коментарі менеджерів.</p>
              </div>
              <AdminTimelineList
                items={order.events.map((event) => ({
                  id: event.id,
                  title: `${event.fromStatus ? `${statusLabel(event.fromStatus)} → ` : ""}${statusLabel(event.toStatus)}`,
                  meta: `${event.actorName || event.actorType} · ${new Date(event.createdAt).toLocaleString()}`,
                  body: event.note || undefined,
                  tone:
                    event.toStatus === "DELIVERED"
                      ? "success"
                      : event.toStatus === "CANCELLED"
                        ? "danger"
                        : "warning",
                }))}
                empty="Історія поки порожня."
              />
            </section>
          </>
        }
        sidebar={
          <>
            <div className={styles.desktopBuyer}>
              <AdminInspectorCard title="Покупець" description="Контакти з цього замовлення.">
                <OrderCustomerBlock order={order} />
                {(order.b2bDiscountPercent || order.discountNotes) && (
                  <p className="mt-3 text-xs text-zinc-400">
                    {order.b2bDiscountPercent ? `B2B знижка: ${order.b2bDiscountPercent}%` : ""}{" "}
                    {order.discountNotes}
                  </p>
                )}
                <div className={styles.address}>
                  <span>Адреса доставки</span>
                  <p>{orderAddressText(order.shippingAddress) || "Адресу не вказано"}</p>
                </div>
              </AdminInspectorCard>
            </div>

            <div id="order-status" className={styles.statusPanel}>
              <AdminInspectorCard
                title="Статус замовлення"
                description="Оберіть наступний етап і підтвердьте зміну."
              >
                <div className="grid flex-1 gap-3 ">
                  <AdminSelectField
                    label="Статус"
                    value={newStatus}
                    onChange={setNewStatus}
                    options={[order.status, ...order.allowedTransitions].map((status) => ({
                      value: status,
                      label: statusLabel(status),
                    }))}
                  />
                  <AdminTextareaField
                    label="Коментар до зміни статусу"
                    value={statusNote}
                    onChange={setStatusNote}
                    rows={2}
                  />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleStatusChange()}
                    disabled={updating || newStatus === order.status}
                    className="inline-flex items-center gap-2 rounded-full bg-linear-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
                  >
                    <PackageCheck className="h-4 w-4" />
                    Застосувати статус
                  </button>
                </div>
              </AdminInspectorCard>
            </div>
            <details className={styles.card}>
              <summary>Дані замовлення</summary>
              <div className="mt-4">
                <AdminKeyValueGrid
                  rows={[
                    { label: "ID замовлення", value: order.id },
                    { label: "Створено", value: new Date(order.createdAt).toLocaleString() },
                    { label: "Оновлено", value: new Date(order.updatedAt).toLocaleString() },
                    { label: "Зона доставки", value: order.shippingZoneName || "—" },
                    { label: "Податкове правило", value: order.taxRegionName || "—" },
                  ]}
                />
              </div>
            </details>

            <details className={styles.card}>
              <summary>Теги</summary>
              <div className="mt-4">
                <AdminTagInput
                  entityType="shop.order"
                  entityId={order.id}
                  suggestions={[
                    "priority",
                    "wholesale",
                    "fragile",
                    "gift",
                    "rush",
                    "review-needed",
                  ]}
                />
              </div>
            </details>

            <AdminInspectorCard title="Нотатки" description="Внутрішні нотатки команди.">
              <AdminNotes entityType="shop.order" entityId={order.id} />
            </AdminInspectorCard>

            <details className={styles.card}>
              <summary>Історія змін</summary>
              <div className="mt-4">
                <AdminActivityTimeline
                  entityType="shop.order"
                  entityId={order.id}
                  emptyTitle="No activity logged"
                  emptyDescription="Status changes, payment edits and shipment updates will appear here."
                />
              </div>
            </details>

            <Link
              href={`/admin/shop/returns/new?orderId=${order.id}`}
              className={styles.returnLink}
            >
              Створити повернення ↗
            </Link>
            <AdminInspectorCard
              title="Документи"
              description="Рахунок і пакувальний лист для друку або збереження у PDF."
            >
              <div className="space-y-2">
                <a
                  href={`/api/admin/pdf/proforma/${order.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm"
                >
                  <FileText className="h-4 w-4" /> Проформа · PDF
                </a>
                <a
                  href={`/api/admin/pdf/invoice/${order.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/6 px-4 py-2 text-sm font-medium text-blue-300 transition hover:bg-blue-500/12"
                >
                  <FileText className="h-4 w-4" />
                  Рахунок (PDF)
                </a>
                <a
                  href={`/api/admin/pdf/packing-slip/${order.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
                >
                  <Printer className="h-4 w-4" />
                  Пакувальний лист
                </a>
              </div>
            </AdminInspectorCard>

            <AdminInspectorCard
              title="Посилання для покупця"
              description="Сторінка підтвердження замовлення та оплати."
            >
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => void copyConfirmationLink()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
                >
                  <Copy className="h-4 w-4" />
                  {copyState || "Копіювати посилання покупця"}
                </button>
                <a
                  href={confirmationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
                >
                  <ExternalLink className="h-4 w-4" />
                  Відкрити сторінку покупця
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
                  className="inline-flex w-full items-center justify-center gap-2 rounded-none border border-blue-500/25 bg-blue-500/6 px-4 py-2 text-sm font-bold uppercase tracking-wider text-red-200 transition hover:border-blue-500/40 hover:bg-blue-500/10 disabled:opacity-50"
                >
                  Whitepay Crypto
                </button>
              </div>
            </AdminInspectorCard>
          </>
        }
      />

      <AdminMobileBottomBar>
        <a href="#payment" className={styles.mobileAction}>
          Оплата
        </a>
        <a href="#shipping" className={styles.mobileAction}>
          Доставка
        </a>
        <Link href="/admin/shop/orders" className={styles.mobileAction}>
          До списку
        </Link>
      </AdminMobileBottomBar>
    </AdminPage>
  );
}
