"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  DollarSign,
  ExternalLink,
  FileText,
  Lock,
  Mail,
  Pencil,
  Printer,
  RotateCcw,
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
import { AdminInternationalDeliveryQuote } from "@/components/admin/AdminInternationalDeliveryQuote";
import { OrderProductLinks } from "@/components/admin/OrderProductLinks";
import { OrderCustomerBlock } from "@/components/admin/OrderCustomerBlock";
import { OrderStatusDialog } from "@/components/admin/orders/OrderStatusDialog";
import { OrderWorkflowPanel } from "@/components/admin/orders/OrderWorkflowPanel";
import { OrderEditPanel } from "@/components/admin/orders/OrderEditPanel";
import { OrderOpsTasksCard } from "@/components/admin/orders/OrderOpsTasksCard";
import {
  formatOrderDate,
  formatOrderMoney,
  paymentTone,
} from "@/components/admin/orders/orderFormat";
import {
  isInternationalDelivery,
  internationalDeliveryAgreementMatches,
  getAgreedInternationalShippingSource,
} from "@/lib/shopInternationalCheckout";
import { buildOrderPaymentUpdate } from "@/lib/admin/orderPaymentDraft";
import { defaultCurrencyForShopCountry } from "@/lib/shopCountryCurrency";
import {
  orderStatusLabel,
  orderStatusTone,
  type OrderStatusCode,
} from "@/lib/admin/orderWorkflow";
import {
  orderAddressText,
  orderPaymentLabel,
  orderPaymentMethodLabel,
} from "@/lib/shopOrderPresentation";
import { cn } from "@/lib/utils";

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

type OrderDetail = {
  id: string;
  orderNumber: string;
  status: OrderStatusCode;
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
  paymentMethod: string;
  monobankBlockReason?: string | null;
  monobankCanReplaceProvider?: boolean;
  monobankLink?: { url: string; expiresAt: string | null } | null;
  amountLock?: { code: string; text: string } | null;
  isDraft?: boolean;
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
  customerEmailsEnabled?: boolean;
  allowedTransitions: OrderStatusCode[];
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

const cardClass = "border border-white/10 bg-[#151515]";
const primaryButton =
  "inline-flex items-center justify-center gap-2 bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";
const quietButton =
  "inline-flex items-center justify-center gap-2 border border-white/15 px-3 py-2 text-[13px] text-zinc-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50";

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

function SectionHeading({
  title,
  aside,
}: {
  title: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-[15px] font-semibold text-zinc-50">{title}</h2>
      {aside}
    </div>
  );
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
  const [paymentStatus, setPaymentStatus] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("");
  const [ttnNumber, setTtnNumber] = useState("");
  const [shippingCalculatedCost, setShippingCalculatedCost] = useState("");
  const [monoPaymentUrl, setMonoPaymentUrl] = useState("");
  const [monoLoading, setMonoLoading] = useState(false);
  const [monoNotice, setMonoNotice] = useState("");
  const [monoError, setMonoError] = useState("");
  const [monoEmailSending, setMonoEmailSending] = useState(false);
  // Kept across retries until a send succeeds, so a retry cannot email the link twice.
  const monoEmailAttemptKey = useRef<string | null>(null);
  const [newShipment, setNewShipment] = useState<ShipmentDraft>(emptyShipmentDraft());
  const [shipmentDrafts, setShipmentDrafts] = useState<Record<string, ShipmentDraft>>({});
  const [shipmentSavingId, setShipmentSavingId] = useState<string | null>(null);
  const [shipmentDeletingId, setShipmentDeletingId] = useState<string | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ target: OrderStatusCode | null; key: number } | null>(
    null
  );
  const [editOpen, setEditOpen] = useState(false);
  const [editKey, setEditKey] = useState(0);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const response = await fetch(`/api/admin/shop/orders/${id}`, { cache: "no-store" });
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

  /** When the order entered its current status — from the newest real status change. */
  const statusSince = useMemo(() => {
    if (!order) return null;
    const entered = order.events.find(
      (event) => event.toStatus === order.status && event.fromStatus !== event.toStatus
    );
    return entered?.createdAt ?? order.createdAt;
  }, [order]);

  function openStatusDialog(target: OrderStatusCode | null) {
    setStatusDialog({ target, key: Date.now() });
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

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(label);
    } catch {
      toast.error("Не вдалося скопіювати", "Виділіть текст вручну.");
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

  async function handleEmailMonobankLink() {
    if (!id || !order || monoEmailSending) return;
    const ok = await confirm({
      title: "Надіслати посилання на оплату клієнту?",
      description: `Лист із посиланням mono піде на ${order.email}. Запис з'явиться в історії замовлення.`,
      confirmLabel: "Надіслати",
    });
    if (!ok) return;
    setMonoEmailSending(true);
    setMonoError("");
    monoEmailAttemptKey.current ??= crypto.randomUUID();
    try {
      const response = await fetch(`/api/admin/shop/orders/${id}/monobank/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptKey: monoEmailAttemptKey.current }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errors: Record<string, string> = {
          PAYMENT_LINK_MISSING: "Спершу створіть чинне посилання mono.",
          ORDER_EMAIL_MISSING: "У замовленні немає email клієнта.",
          ORDER_NOT_PAYABLE:
            "Замовлення вже оплачене, закрите або має інший спосіб оплати — посилання не надсилаємо.",
          EMAIL_NOT_CONFIGURED: "Пошта сайту не налаштована (ключ Resend).",
          EMAIL_SEND_FAILED: "Сервіс пошти не прийняв лист. Спробуйте ще раз або надішліть посилання вручну.",
        };
        setMonoError(errors[data.error] || "Не вдалося надіслати лист. Спробуйте ще раз.");
        return;
      }
      monoEmailAttemptKey.current = null;
      toast.success(
        data.recorded === false
          ? `Посилання надіслано на ${data.email ?? order.email} (запис в історію не збережено)`
          : `Посилання надіслано на ${data.email ?? order.email}`
      );
      await load();
    } catch {
      setMonoError("Немає зв'язку із сервером. Спробуйте ще раз.");
    } finally {
      setMonoEmailSending(false);
    }
  }

  async function handleGenerateMonobankLink(replacePreviousProvider = false) {
    if (!id || updating || monoLoading) return;
    if (replacePreviousProvider) {
      const ok = await confirm({
        title: "Видати mono-посилання замість попереднього способу оплати?",
        description:
          "Підтвердіть, що ви перевірили кабінет попереднього сервісу (Whitepay) і оплати там немає. Ваше підтвердження буде записане в історію замовлення. Якщо клієнт все ж оплатить обома способами — потрібне повернення.",
        confirmLabel: "Оплати немає — видати mono",
        tone: "warning",
      });
      if (!ok) return;
    }
    setMonoLoading(true);
    setMonoError("");
    setSuccess("");
    setMonoNotice("");
    try {
      const response = await fetch(`/api/admin/shop/orders/${id}/monobank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: "ua", replacePreviousProvider }),
        // The server waits at most ~45 s for Mono; never leave the manager guessing.
        signal: AbortSignal.timeout(65_000),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errors: Record<string, string> = {
          MONOBANK_ORDER_NOT_PAYABLE: "Замовлення вже оплачене або не допускає повторної оплати.",
          PREVIOUS_PAYMENT_UNVERIFIED:
            "Клієнт обрав інший спосіб оплати. Перевірте, що там оплати немає, і скористайтеся кнопкою заміни нижче.",
          MONOBANK_DRAFT_NOT_ACCEPTED:
            "Спочатку погодьте пропозицію та перетворіть чернетку на замовлення.",
          MONOBANK_RECONCILIATION_REQUIRED:
            "Є фінансова зміна старого mono-рахунку. Потрібна звірка оплат у бізнес-кабінеті.",
          MONOBANK_REQUIRES_UAH_QUOTE: "Спочатку погодьте суму у гривні.",
          INTERNATIONAL_DELIVERY_NOT_AGREED:
            "Спочатку погодьте доставку та загальну суму з клієнтом.",
          MONOBANK_INVOICE_CLOSED:
            "Рахунок mono закритий. Перевірте його в бізнес-кабінеті перед заміною.",
          MONOBANK_NOT_CONFIGURED: "Підключення mono не налаштоване для цього середовища сайту.",
          MONOBANK_REQUEST_UNCERTAIN:
            "Mono зараз не відповідає. Нічого страшного: натисніть ще раз за хвилину — другий рахунок не створиться.",
          MONOBANK_PAYMENT_PENDING:
            "Попередній запит до mono ще обробляється. Зачекайте 1–2 хвилини і натисніть ще раз.",
          MONOBANK_CONCURRENT_UPDATE: "Замовлення щойно змінилося. Натисніть ще раз.",
          MONOBANK_PAYMENT_UNAVAILABLE:
            "Сервер не зміг підготувати платіж. Натисніть ще раз за хвилину.",
        };
        const errorCode = typeof data.error === "string" ? data.error : "";
        setMonoError(
          errors[errorCode] ||
            (errorCode.startsWith("MONOBANK_HTTP_5") || errorCode === "MONOBANK_HTTP_429"
              ? "Mono тимчасово перевантажений. Натисніть ще раз за хвилину — другий рахунок не створиться."
              : errorCode && /^[A-Z0-9_]+$/.test(errorCode)
                ? `Не вдалося підготувати mono-посилання. Код: ${errorCode}.`
                : "Не вдалося підготувати mono-посилання. Натисніть ще раз.")
        );
        return;
      }
      setMonoPaymentUrl(data.url);
      if (data.statusVerified === false) {
        setMonoNotice(
          "Mono зараз не відповідає на перевірку статусу, тому показано чинне посилання, видане раніше. Його безпечно надсилати: один рахунок не можна оплатити двічі."
        );
      }
      await load();
      setSuccess("Посилання mono готове — скопіюйте й надішліть клієнту.");
    } catch (requestError) {
      setMonoError(
        (requestError as Error).name === "TimeoutError"
          ? "Mono відповідає надто довго. Натисніть ще раз за хвилину — якщо рахунок уже створився, ви отримаєте те саме посилання."
          : "Немає зв’язку із сервером. Перевірте інтернет і натисніть ще раз."
      );
    } finally {
      setMonoLoading(false);
    }
  }

  async function handleGenerateWhitepayLink(kind: "fiat" | "crypto") {
    if (!id) return;
    setUpdating(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/admin/shop/orders/${id}/whitepay/${kind}`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          data.error ||
            (kind === "fiat"
              ? "Не вдалося згенерувати Whitepay Fiat"
              : "Не вдалося згенерувати Whitepay Crypto")
        );
        return;
      }
      if (data.url) {
        await navigator.clipboard.writeText(data.url).catch(() => {});
        window.open(data.url, "_blank");
      }
      await load();
      setSuccess(
        kind === "fiat"
          ? "Посилання Whitepay Fiat створено й скопійовано."
          : "Посилання Whitepay Crypto створено й скопійовано."
      );
    } finally {
      setUpdating(false);
    }
  }

  if (loading && !order) {
    return (
      <AdminPage>
        <div className="border border-white/10 bg-[#171717] px-5 py-6 text-sm text-zinc-400">
          Завантаження замовлення…
        </div>
      </AdminPage>
    );
  }

  if (error && !order) {
    return (
      <AdminPage className="space-y-4">
        <div className="border-l-2 border-red-400 bg-red-500/[0.08] px-4 py-3 text-sm text-red-100">
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
  const paymentNeedsAgreement =
    isInternationalDelivery(String(order.shippingAddress?.country ?? "")) &&
    !internationalDeliveryAgreementMatches(order.pricingSnapshot, order.currency, order.total);

  const outstanding = Math.max(0, order.total - order.amountPaid);
  const monoBlockReason = order.monobankBlockReason;
  const paymentDirty =
    paymentStatus !== order.paymentStatus ||
    amountPaid !== String(order.amountPaid) ||
    deliveryMethod !== (order.deliveryMethod || "") ||
    ttnNumber !== (order.ttnNumber || "") ||
    shippingCalculatedCost !==
      (order.shippingCalculatedCost == null ? "" : String(order.shippingCalculatedCost));
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const addressText = orderAddressText(order.shippingAddress);

  function renderPaymentActions(blocked = false) {
    const currentLink = monoPaymentUrl || order!.monobankLink?.url || "";
    const linkExpiresAt = order!.monobankLink?.expiresAt
      ? new Date(order!.monobankLink.expiresAt)
      : null;
    const notPayable =
      order!.amountPaid > 0 ||
      ["PAID", "REFUNDED", "PARTIALLY_REFUNDED", "PARTIALLY_PAID"].includes(order!.paymentStatus) ||
      order!.isDraft ||
      !["PENDING_REVIEW", "PENDING_PAYMENT"].includes(order!.status);
    const canReplace = Boolean(order!.monobankCanReplaceProvider) && !notPayable;
    const monoDisabled =
      blocked ||
      updating ||
      monoLoading ||
      paymentNeedsAgreement ||
      notPayable ||
      Boolean(monoBlockReason);
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {currentLink ? (
          <div className="space-y-2 border border-blue-500/30 bg-blue-500/[0.06] p-3 sm:col-span-2">
            <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-blue-300">
              <span>Посилання mono для клієнта</span>
              {linkExpiresAt ? (
                <span className="font-normal normal-case tracking-normal text-zinc-400">
                  дійсне до{" "}
                  {linkExpiresAt.toLocaleString("uk-UA", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/Kyiv",
                  })}
                </span>
              ) : null}
            </div>
            <div className="break-all font-mono text-[12px] text-zinc-100">{currentLink}</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyText(currentLink, "Посилання скопійовано")}
                className="inline-flex items-center gap-1.5 bg-blue-600 px-3 py-2 text-[13px] font-medium text-white transition hover:bg-blue-500"
              >
                <Copy className="h-4 w-4" /> Копіювати
              </button>
              <a
                href={currentLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 border border-white/15 px-3 py-2 text-[13px] text-zinc-200 transition hover:bg-white/5"
              >
                <ExternalLink className="h-4 w-4" /> Відкрити
              </a>
              <button
                type="button"
                onClick={() => void handleEmailMonobankLink()}
                disabled={monoEmailSending || notPayable}
                className="inline-flex items-center gap-1.5 border border-white/15 px-3 py-2 text-[13px] text-zinc-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Mail className="h-4 w-4" />{" "}
                {monoEmailSending ? "Надсилаємо…" : "Надіслати на email"}
              </button>
            </div>
            {monoNotice ? (
              <p className="text-[12px] leading-5 text-amber-200">{monoNotice}</p>
            ) : null}
          </div>
        ) : null}
        {monoError ? (
          <div
            role="alert"
            className="border-l-2 border-red-400 bg-red-500/[0.08] px-3 py-2 text-[13px] leading-5 text-red-100 sm:col-span-2"
          >
            {monoError}
          </div>
        ) : null}
        {canReplace ? (
          <div className="space-y-2 border-l-2 border-amber-400 bg-amber-400/[0.06] px-3 py-3 text-[13px] leading-5 text-amber-100 sm:col-span-2">
            <p>
              Клієнт обрав оплату «{orderPaymentMethodLabel(order!.paymentMethod)}». Якщо він там не
              оплатив і хоче платити карткою — перевірте кабінет Whitepay і видайте mono-посилання.
            </p>
            <button
              type="button"
              onClick={() => void handleGenerateMonobankLink(true)}
              disabled={blocked || updating || monoLoading || paymentNeedsAgreement}
              className="inline-flex w-full items-center justify-center gap-2 bg-amber-400 px-4 py-2.5 text-[13px] font-semibold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {monoLoading ? "Створюємо посилання…" : "Оплати там немає — видати mono-посилання"}
            </button>
          </div>
        ) : monoBlockReason === "PREVIOUS_PAYMENT_UNVERIFIED" ? (
          <div className="border-l-2 border-amber-400 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-100 sm:col-span-2">
            Є незавершена оплата через Stripe. Спершу звірте її в кабінеті Stripe.
          </div>
        ) : null}
        {!canReplace ? (
          <button
            type="button"
            onClick={() => void handleGenerateMonobankLink()}
            disabled={monoDisabled}
            className="inline-flex w-full items-center justify-center gap-2 border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm text-blue-100 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-zinc-400 sm:col-span-2"
          >
            {monoLoading
              ? "Створюємо посилання… (до хвилини)"
              : currentLink
                ? "Перевірити оплату й оновити посилання mono"
                : "Створити mono-посилання"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void handleGenerateWhitepayLink("fiat")}
          disabled={
            blocked || updating || paymentNeedsAgreement || order!.paymentMethod === "MONOBANK"
          }
          className="inline-flex w-full items-center justify-center gap-2 border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-zinc-400"
        >
          <DollarSign className="h-4 w-4" /> Whitepay Fiat
        </button>
        <button
          type="button"
          onClick={() => void handleGenerateWhitepayLink("crypto")}
          disabled={
            blocked || updating || paymentNeedsAgreement || order!.paymentMethod === "MONOBANK"
          }
          className="inline-flex w-full items-center justify-center border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:text-zinc-400"
        >
          Whitepay Crypto
        </button>
      </div>
    );
  }

  return (
    <AdminPage wide className="max-w-[1400px] space-y-4">
      <header className="space-y-3">
        <Link
          href="/admin/shop/orders"
          className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Усі замовлення
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-[24px] font-semibold tracking-tight text-white">
                {order.orderNumber}
              </h1>
              <AdminStatusBadge tone={orderStatusTone(order.status)}>
                {orderStatusLabel(order.status)}
              </AdminStatusBadge>
              <AdminStatusBadge tone={paymentTone(order.paymentStatus, outstanding)}>
                {orderPaymentLabel(order.paymentStatus)}
              </AdminStatusBadge>
            </div>
            <p className="mt-1.5 text-[13px] text-zinc-400">
              {formatOrderDate(order.createdAt, true)} · {order.customerName} ·{" "}
              <span className="font-semibold text-zinc-200">
                {formatOrderMoney(order.total, order.currency)}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setEditKey((current) => current + 1);
                setEditOpen(true);
              }}
              className={primaryButton}
            >
              <Pencil className="h-4 w-4" /> Редагувати замовлення
            </button>
            <a
              href={`/api/admin/pdf/proforma/${order.id}`}
              target="_blank"
              rel="noreferrer"
              className={quietButton}
            >
              <FileText className="h-4 w-4" /> Проформа
            </a>
          </div>
        </div>
      </header>

      {error || success ? (
        <div
          role={error ? "alert" : "status"}
          className={cn(
            "border-l-2 px-4 py-2.5 text-[13px]",
            error
              ? "border-red-400 bg-red-500/[0.08] text-red-100"
              : "border-emerald-400 bg-emerald-500/[0.08] text-emerald-100"
          )}
        >
          {error || success}
        </div>
      ) : null}

      <OrderWorkflowPanel
        order={order}
        statusSince={statusSince}
        disabled={updating}
        onMove={(target) => openStatusDialog(target)}
        onChoose={() => openStatusDialog(null)}
      />

      <AdminSplitDetailShell
        className="gap-4 lg:grid-cols-[minmax(0,1fr)_320px]"
        main={
          <>
            <section className={cn(cardClass, "p-5")} id="items">
              <SectionHeading
                title={`Товари · ${itemCount} шт.`}
                aside={
                  order.amountLock ? (
                    <span
                      className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500"
                      title={order.amountLock.text}
                    >
                      <Lock className="h-3.5 w-3.5" /> Суму змінити не можна
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditKey((current) => current + 1);
                        setEditOpen(true);
                      }}
                      className={quietButton}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Змінити товари
                    </button>
                  )
                }
              />
              <div className="divide-y divide-white/[0.06]">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <OrderProductLinks item={item} thumbnail />
                    <div className="text-right">
                      <div className="whitespace-nowrap text-[14px] font-semibold text-zinc-100">
                        {formatOrderMoney(item.total, order.currency)}
                      </div>
                      <div className="whitespace-nowrap text-[12px] text-zinc-500">
                        {item.quantity} × {formatOrderMoney(item.price, order.currency)}
                      </div>
                    </div>
                  </div>
                ))}
                {!order.items.length && (
                  <p className="text-sm text-zinc-400">Товарів у замовленні немає.</p>
                )}
              </div>
              {order.amountLock ? (
                <p className="mt-4 border-t border-white/[0.06] pt-3 text-[12px] leading-5 text-zinc-500">
                  {order.amountLock.text}
                </p>
              ) : null}
            </section>

            <section className={cn(cardClass, "p-5")} id="payment">
              <SectionHeading
                title="Оплата"
                aside={
                  <span className="text-[12px] text-zinc-400">
                    {orderPaymentMethodLabel(order.paymentMethod)}
                  </span>
                }
              />
              <dl className="grid gap-px bg-white/[0.06] text-[13px] sm:grid-cols-3">
                {[
                  ["Товари", formatOrderMoney(order.subtotal, order.currency)],
                  ["Доставка", formatOrderMoney(order.shippingCost, order.currency)],
                  ["Податки", formatOrderMoney(order.taxAmount, order.currency)],
                  ["Разом", formatOrderMoney(order.total, order.currency)],
                  ["Сплачено", formatOrderMoney(order.amountPaid, order.currency)],
                  ["До сплати", formatOrderMoney(outstanding, order.currency)],
                ].map(([label, value]) => (
                  <div key={label} className="bg-[#151515] px-3 py-2.5">
                    <dt className="text-[11px] uppercase tracking-[0.1em] text-zinc-500">{label}</dt>
                    <dd
                      className={cn(
                        "mt-0.5 font-semibold",
                        label === "До сплати" && outstanding > 0
                          ? "text-amber-200"
                          : label === "Разом"
                            ? "text-white"
                            : "text-zinc-200"
                      )}
                    >
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5">
                {order.paymentMethod === "MANAGER_QUOTE" ? (
                  <AdminInternationalDeliveryQuote
                    key={order.updatedAt}
                    orderId={order.id}
                    savedCurrency={order.currency}
                    savedShippingCost={order.shippingCost}
                    shippingSource={getAgreedInternationalShippingSource(order.pricingSnapshot)}
                    savedTotal={order.total}
                    regionCurrency={defaultCurrencyForShopCountry(
                      String(order.shippingAddress?.country ?? "")
                    )}
                    isAgreed={internationalDeliveryAgreementMatches(
                      order.pricingSnapshot,
                      order.currency,
                      order.total
                    )}
                    onSaved={load}
                    paymentActions={(ready) => renderPaymentActions(!ready)}
                  />
                ) : (
                  <>
                    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                      Посилання на оплату
                    </h3>
                    {renderPaymentActions()}
                  </>
                )}
              </div>
              <details className="mt-5 border-t border-white/[0.06] pt-4">
                <summary className="cursor-pointer text-[13px] text-zinc-300 hover:text-white">
                  Позначити оплату вручну / змінити умови доставки
                </summary>
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
                    disabled={["MONOBANK", "MANAGER_QUOTE"].includes(order.paymentMethod ?? "")}
                    helper={
                      order.paymentMethod === "MONOBANK"
                        ? "Суму доставки зафіксовано для платежу mono."
                        : order.paymentMethod === "MANAGER_QUOTE"
                          ? "Погодьте суму через блок міжнародної доставки."
                          : undefined
                    }
                  />
                  <div className="flex flex-col justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => void handlePaymentAndFulfillmentSave()}
                      disabled={updating || !paymentDirty}
                      className={primaryButton}
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
                </div>
              </details>
            </section>

            <section id="shipping" className={cn(cardClass, "p-5")}>
              <SectionHeading
                title="Відправлення"
                aside={
                  order.ttnNumber ? (
                    <button
                      type="button"
                      onClick={() => void copyText(order.ttnNumber!, "ТТН скопійовано")}
                      className="inline-flex items-center gap-1.5 font-mono text-[12px] text-zinc-300 hover:text-white"
                    >
                      ТТН {order.ttnNumber} <Copy className="h-3.5 w-3.5" />
                    </button>
                  ) : null
                }
              />
              {!order.shipments.length && (
                <p className="mb-4 text-[13px] text-zinc-500">
                  Відправлень ще немає. Після передачі перевізнику додайте трек-номер для
                  відстеження.
                </p>
              )}
              <div className="space-y-3">
                {order.shipments.map((shipment) => {
                  const draft = shipmentDrafts[shipment.id];
                  if (!draft) return null;
                  const setDraft = (patch: Partial<ShipmentDraft>) =>
                    setShipmentDrafts((current) => ({
                      ...current,
                      [shipment.id]: { ...draft, ...patch },
                    }));
                  return (
                    <div key={shipment.id} className="border border-white/10 bg-black/20 p-4">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <AdminStatusBadge tone={shipmentTone(shipment.status)}>
                            {SHIPMENT_STATUS_OPTIONS.find((option) => option.value === shipment.status)
                              ?.label ?? shipment.status}
                          </AdminStatusBadge>
                          <span className="font-mono text-[13px] text-zinc-100">
                            {shipment.trackingNumber}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleUpdateShipment(shipment.id)}
                            disabled={shipmentSavingId === shipment.id}
                            className={quietButton}
                          >
                            <Save className="h-3.5 w-3.5" />
                            Зберегти
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteShipment(shipment.id)}
                            disabled={shipmentDeletingId === shipment.id}
                            className="border border-red-500/25 px-3 py-2 text-[13px] text-red-200 transition hover:bg-red-500/10 disabled:opacity-50"
                          >
                            Видалити
                          </button>
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <AdminInputField
                          label="Перевізник"
                          value={draft.carrier}
                          onChange={(value) => setDraft({ carrier: value })}
                        />
                        <AdminInputField
                          label="Тип доставки"
                          value={draft.serviceLevel}
                          onChange={(value) => setDraft({ serviceLevel: value })}
                        />
                        <AdminInputField
                          label="Трек-номер"
                          value={draft.trackingNumber}
                          onChange={(value) => setDraft({ trackingNumber: value })}
                        />
                        <AdminInputField
                          label="Посилання відстеження"
                          value={draft.trackingUrl}
                          onChange={(value) => setDraft({ trackingUrl: value })}
                        />
                        <AdminSelectField
                          label="Статус відправлення"
                          value={draft.status}
                          onChange={(value) => setDraft({ status: value as ShipmentStatus })}
                          options={SHIPMENT_STATUS_OPTIONS}
                        />
                        <AdminInputField
                          label="Дата відправлення"
                          value={draft.shippedAt}
                          onChange={(value) => setDraft({ shippedAt: value })}
                          type="datetime-local"
                        />
                        <AdminInputField
                          label="Дата доставки"
                          value={draft.deliveredAt}
                          onChange={(value) => setDraft({ deliveredAt: value })}
                          type="datetime-local"
                        />
                      </div>
                      <div className="mt-4">
                        <AdminTextareaField
                          label="Коментар до відправлення"
                          value={draft.notes}
                          onChange={(value) => setDraft({ notes: value })}
                          rows={2}
                        />
                      </div>
                    </div>
                  );
                })}

                <details className="border border-dashed border-white/15 p-4">
                  <summary className="flex cursor-pointer items-center gap-2 text-[13px] text-zinc-200">
                    <Truck className="h-4 w-4 text-blue-300" /> Додати відправлення
                  </summary>
                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                      rows={2}
                    />
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => void handleCreateShipment()}
                        disabled={shipmentSavingId === "new"}
                        className={primaryButton}
                      >
                        Створити відправлення
                      </button>
                    </div>
                  </div>
                </details>
              </div>
            </section>

            <section className={cn(cardClass, "p-5")}>
              <SectionHeading title="Історія замовлення" />
              <AdminTimelineList
                items={order.events.map((event) => {
                  const edit = event.fromStatus === event.toStatus;
                  return {
                    id: event.id,
                    title: edit
                      ? "Зміни в замовленні"
                      : `${event.fromStatus ? `${orderStatusLabel(event.fromStatus)} → ` : ""}${orderStatusLabel(event.toStatus)}`,
                    meta: `${event.actorName || event.actorType} · ${formatOrderDate(event.createdAt, true)}`,
                    body: event.note || undefined,
                    tone: edit
                      ? "default"
                      : event.toStatus === "DELIVERED"
                        ? "success"
                        : event.toStatus === "CANCELLED" || event.toStatus === "REFUNDED"
                          ? "danger"
                          : "warning",
                  };
                })}
                empty="Історія поки порожня."
              />
            </section>
          </>
        }
        sidebar={
          <>
            <AdminInspectorCard title="Покупець" description="Контакти з цього замовлення.">
              <OrderCustomerBlock order={order} />
              {(order.b2bDiscountPercent || order.discountNotes) && (
                <p className="mt-3 text-xs text-zinc-400">
                  {order.b2bDiscountPercent ? `B2B знижка: ${order.b2bDiscountPercent}%` : ""}{" "}
                  {order.discountNotes}
                </p>
              )}
              <div className="mt-4 border-t border-white/[0.06] pt-3">
                <div className="text-[11px] uppercase tracking-[0.1em] text-zinc-500">
                  Адреса доставки
                </div>
                <p className="mt-1 text-[13px] leading-5 text-zinc-200">
                  {addressText || "Адресу не вказано"}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditKey((current) => current + 1);
                    setEditOpen(true);
                  }}
                  className={quietButton}
                >
                  <Pencil className="h-3.5 w-3.5" /> Змінити контакти
                </button>
                {order.phone ? (
                  <button
                    type="button"
                    onClick={() => void copyText(order.phone!, "Телефон скопійовано")}
                    className={quietButton}
                  >
                    <Copy className="h-3.5 w-3.5" /> Телефон
                  </button>
                ) : null}
              </div>
            </AdminInspectorCard>

            <OrderOpsTasksCard orderId={order.id} orderNumber={order.orderNumber} />

            <AdminInspectorCard title="Нотатки" description="Внутрішні нотатки команди.">
              <AdminNotes entityType="shop.order" entityId={order.id} />
            </AdminInspectorCard>

            <AdminInspectorCard title="Документи й посилання">
              <div className="grid gap-2">
                <a
                  href={`/api/admin/pdf/invoice/${order.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className={quietButton}
                >
                  <FileText className="h-4 w-4" /> Рахунок (PDF)
                </a>
                <a
                  href={`/api/admin/pdf/packing-slip/${order.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className={quietButton}
                >
                  <Printer className="h-4 w-4" /> Пакувальний лист
                </a>
                <button
                  type="button"
                  onClick={() => void copyText(confirmationUrl, "Посилання для покупця скопійовано")}
                  className={quietButton}
                >
                  <Copy className="h-4 w-4" /> Посилання на замовлення для клієнта
                </button>
                <Link
                  href={`/admin/shop/returns/new?orderId=${order.id}`}
                  className={quietButton}
                >
                  <RotateCcw className="h-4 w-4" /> Оформити повернення
                </Link>
              </div>
            </AdminInspectorCard>

            <details className={cn(cardClass, "p-4")}>
              <summary className="cursor-pointer text-[13px] text-zinc-300">Теги</summary>
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

            <details className={cn(cardClass, "p-4")}>
              <summary className="cursor-pointer text-[13px] text-zinc-300">
                Технічні дані
              </summary>
              <div className="mt-4 space-y-4">
                <AdminKeyValueGrid
                  rows={[
                    { label: "ID замовлення", value: order.id },
                    { label: "Створено", value: formatOrderDate(order.createdAt, true) },
                    { label: "Оновлено", value: formatOrderDate(order.updatedAt, true) },
                    { label: "Зона доставки", value: order.shippingZoneName || "—" },
                    { label: "Податкове правило", value: order.taxRegionName || "—" },
                  ]}
                />
                <pre className="max-h-80 overflow-auto border border-white/10 bg-black/25 p-3 text-[11px] text-zinc-400">
                  {JSON.stringify(order.pricingSnapshot ?? {}, null, 2)}
                </pre>
              </div>
            </details>

            <details className={cn(cardClass, "p-4")}>
              <summary className="cursor-pointer text-[13px] text-zinc-300">Журнал дій</summary>
              <div className="mt-4">
                <AdminActivityTimeline
                  entityType="shop.order"
                  entityId={order.id}
                  emptyTitle="Журнал порожній"
                  emptyDescription="Тут з’являться зміни статусу, оплати й відправлень."
                />
              </div>
            </details>
          </>
        }
      />

      {statusDialog ? (
        <OrderStatusDialog
          key={statusDialog.key}
          open
          orders={[order]}
          target={statusDialog.target}
          customerEmailsEnabled={Boolean(order.customerEmailsEnabled)}
          onClose={() => setStatusDialog(null)}
          onDone={(message) => {
            setStatusDialog(null);
            setError("");
            setSuccess(message);
            toast.success(message);
            void load();
          }}
        />
      ) : null}

      {editOpen ? (
        <OrderEditPanel
          key={editKey}
          order={order}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={(message) => {
            setEditOpen(false);
            setError("");
            setSuccess(message);
            toast.success(message);
            void load();
          }}
        />
      ) : null}

      <AdminMobileBottomBar>
        <a href="#payment" className="flex-1 px-3 py-2 text-center text-[13px] text-zinc-200">
          Оплата
        </a>
        <a href="#shipping" className="flex-1 px-3 py-2 text-center text-[13px] text-zinc-200">
          Доставка
        </a>
        <Link
          href="/admin/shop/orders"
          className="flex-1 px-3 py-2 text-center text-[13px] text-zinc-200"
        >
          До списку
        </Link>
      </AdminMobileBottomBar>
    </AdminPage>
  );
}
