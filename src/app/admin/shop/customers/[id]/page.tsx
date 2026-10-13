"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronDown,
  Copy,
  Eye,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  UserRound,
  X,
} from "lucide-react";

import { useConfirm } from "@/components/admin/AdminConfirmDialog";
import { useToast } from "@/components/admin/AdminToast";
import { AdminNotes } from "@/components/admin/AdminNotes";
import { AdminTagInput } from "@/components/admin/AdminTagInput";
import {
  CrmAvatar,
  CrmChip,
  CrmSurface,
  CrmTabs,
  crmAgo,
  crmButton,
  crmIconButton,
  crmInput,
  crmPrimaryButton,
  crmStatusTone,
  customerTypeChip,
} from "@/components/admin/crm/CrmUi";
import { formatOrderDate, formatOrderMoney } from "@/components/admin/orders/orderFormat";
import { CustomerCreditPanel } from "@/app/admin/shop/customers/components/CustomerCreditPanel";
import { CustomerBrandDiscountsPanel } from "@/app/admin/shop/customers/components/CustomerBrandDiscountsPanel";
import { CustomerTariffGroupPanel } from "@/app/admin/shop/customers/components/CustomerTariffGroupPanel";
import { useB2bTariffGroups } from "@/components/admin/b2b/useB2bTariffGroups";
import { orderStatusLabel, orderStatusTone } from "@/lib/admin/orderWorkflow";
import { orderPaymentLabel } from "@/lib/shopOrderPresentation";
import {
  isPlaceholderShopCustomerEmail,
  isUsableShopCustomerEmail,
  normalizeShopCustomerEmail,
} from "@/lib/shopCustomerEmail";
import { cn } from "@/lib/utils";

type CustomerGroup = "B2C" | "B2B_PENDING" | "B2B_APPROVED";

type CustomerDetail = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  companyName: string | null;
  vatNumber: string | null;
  group: CustomerGroup;
  b2bDiscountPercent: number | null;
  tariffGroup: { id: string; name: string } | null;
  isActive: boolean;
  notes: string | null;
  preferredLocale: string;
  createdAt: string;
  updatedAt: string;
  account: {
    lastLoginAt: string | null;
    emailVerifiedAt: string | null;
    hasPassword: boolean;
  } | null;
  passwordSetup: { expiresAt: string; createdAt: string } | null;
  addresses: Array<{
    id: string;
    label: string;
    line1: string;
    line2: string | null;
    city: string;
    region: string | null;
    postcode: string | null;
    country: string;
    isDefaultShipping: boolean;
  }>;
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    isDraft: boolean;
    currency: string;
    total: number;
    createdAt: string;
    itemCount: number;
  }>;
  carts: Array<{ id: string; updatedAt: string; itemCount: number }>;
  auditLog: Array<{
    id: string;
    actorEmail: string;
    actorName: string | null;
    action: string;
    metadata: unknown;
    createdAt: string;
  }>;
};

type LtvStats = {
  totalSpent: number;
  ordersCount: number;
  paidOrdersCount: number;
  averageOrderValue: number;
  daysSinceLastOrder: number | null;
  currency: string;
  creditBalance: number;
};

type Note = {
  id: string;
  authorName: string | null;
  authorEmail: string;
  content: string;
  createdAt: string;
};

type FieldKey =
  | "firstName"
  | "lastName"
  | "phone"
  | "email"
  | "preferredLocale"
  | "companyName"
  | "vatNumber"
  | "notes"
  | "b2bDiscountPercent";

const TABS = [
  { key: "activity", label: "Активність" },
  { key: "orders", label: "Замовлення" },
  { key: "discounts", label: "Знижки на бренди" },
  { key: "notes", label: "Нотатки" },
  { key: "credit", label: "Кредит" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/** The PATCH endpoint replaces the whole profile, so every field is sent each time. */
function profileBody(customer: CustomerDetail) {
  return {
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone ?? "",
    companyName: customer.companyName ?? "",
    vatNumber: customer.vatNumber ?? "",
    notes: customer.notes ?? "",
    b2bDiscountPercent:
      customer.b2bDiscountPercent != null ? String(customer.b2bDiscountPercent) : "",
    preferredLocale: customer.preferredLocale === "ua" ? "ua" : "en",
    isActive: customer.isActive,
    group: customer.group,
  };
}

function metaText(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)[key];
  return value == null ? null : String(value);
}

type FeedItem = {
  id: string;
  at: string;
  mark: string;
  tone: "green" | "blue" | "gray" | "amber";
  title: string;
  detail?: string;
  href?: string;
  multiline?: boolean;
};

function auditToFeed(entry: CustomerDetail["auditLog"][number]): FeedItem | null {
  const base = {
    id: `audit-${entry.id}`,
    at: entry.createdAt,
    detail: entry.actorName || entry.actorEmail,
  };
  const brand = metaText(entry.metadata, "brand");
  switch (entry.action) {
    case "customer.create":
      return { ...base, mark: "+", tone: "blue", title: "Клієнта створено в адмінці" };
    case "customer.update": {
      const previous = metaText(entry.metadata, "previousEmail");
      return {
        ...base,
        mark: "✎",
        tone: "gray",
        title: previous
          ? `Email змінено: ${previous} → ${metaText(entry.metadata, "email")}`
          : "Профіль змінено",
      };
    }
    case "customer.b2b.apply":
      return {
        ...base,
        mark: "B",
        tone: "amber",
        title: "Подав заявку на оптові ціни",
        detail: "Сам клієнт на сайті",
      };
    case "customer.b2b.approve":
      return { ...base, mark: "✓", tone: "blue", title: "Затверджено як B2B-партнера" };
    case "customer.b2b.revert":
      return { ...base, mark: "↩", tone: "gray", title: "Переведено в роздріб" };
    case "customer.brand_discount.upsert":
      return {
        ...base,
        mark: "%",
        tone: "green",
        title: `Знижка на ${brand}: −${metaText(entry.metadata, "discountPct")}%`,
      };
    case "customer.brand_discount.delete":
      return { ...base, mark: "%", tone: "gray", title: `Знижку на ${brand} прибрано` };
    case "customer.tariff_group.assign": {
      const groupName = metaText(entry.metadata, "groupName");
      return {
        ...base,
        mark: "%",
        tone: groupName ? "blue" : "gray",
        title: groupName ? `Тарифна група: ${groupName}` : "Прибрано з тарифної групи",
      };
    }
    case "customer.password_setup.create":
      return { ...base, mark: "→", tone: "gray", title: "Створено посилання для входу" };
    case "customer.password_reset.send":
      return { ...base, mark: "@", tone: "gray", title: "Надіслано лист для зміни пароля" };
    case "customer.impersonation.start":
      return { ...base, mark: "◉", tone: "gray", title: "Перегляд сайту очима клієнта" };
    case "customer.credit.issue":
      return { ...base, mark: "₴", tone: "green", title: "Нараховано кредит" };
    case "customer.credit.redeem":
      return { ...base, mark: "₴", tone: "gray", title: "Використано кредит" };
    case "customer.archive":
      return { ...base, mark: "⏻", tone: "amber", title: "Акаунт вимкнено" };
    case "customer.restore":
      return { ...base, mark: "⏻", tone: "green", title: "Акаунт увімкнено" };
    default:
      return null;
  }
}

const MARK_TONES: Record<FeedItem["tone"], string> = {
  green: "bg-[#0F1A13] text-[#86E0A3]",
  blue: "bg-[#0F1A2E] text-[#9CC0FF]",
  amber: "bg-[#22190A] text-[#F5C46B]",
  gray: "bg-[#1C1D21] text-[#C9CBD0]",
};

type AttrProps = {
  field?: FieldKey;
  label: string;
  value?: string;
  display?: ReactNode;
  mono?: boolean;
  multiline?: boolean;
  options?: Array<[string, string]>;
  hint?: ReactNode;
  locked?: boolean;
};

export default function AdminShopCustomerDetailPage() {
  return (
    <Suspense fallback={null}>
      <CustomerRecord />
    </Suspense>
  );
}

function CustomerRecord() {
  const toast = useToast();
  const confirm = useConfirm();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [ltv, setLtv] = useState<LtvStats | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [setupLink, setSetupLink] = useState<{ url: string; expiresAt: string | null } | null>(
    null
  );
  const [tab, setTab] = useState<TabKey>(
    () => (TABS.find((entry) => entry.key === searchParams.get("tab"))?.key ?? "activity") as TabKey
  );
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [draft, setDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [postingNote, setPostingNote] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { groups: tariffGroups, loading: tariffGroupsLoading } = useB2bTariffGroups();

  const load = useCallback(async () => {
    if (!id) return;
    setError("");
    try {
      const response = await fetch(`/api/admin/shop/customers/${id}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError((data as { error?: string }).error || "Не вдалося завантажити клієнта");
        return;
      }
      setCustomer(data as CustomerDetail);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadNotes = useCallback(async () => {
    if (!id) return;
    try {
      const response = await fetch(`/api/admin/notes/shop.customer/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const data = response.ok ? await response.json().catch(() => ({})) : {};
      setNotes(((data as { notes?: Note[] }).notes ?? []) as Note[]);
    } catch {
      setNotes([]);
    }
  }, [id]);

  useEffect(() => {
    void load();
    void loadNotes();
  }, [load, loadNotes]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetch(`/api/admin/customers/${id}/ltv`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data) setLtv(data as LtvStats);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, customer?.updatedAt]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const feed = useMemo<FeedItem[]>(() => {
    if (!customer) return [];
    const orderItems: FeedItem[] = customer.orders.map((order) => ({
      id: `order-${order.id}`,
      at: order.createdAt,
      mark: order.isDraft ? "П" : "#",
      tone: order.paymentStatus === "PAID" ? "green" : order.isDraft ? "gray" : "blue",
      title: `${order.isDraft ? "Проформа" : "Замовлення"} ${order.orderNumber} · ${formatOrderMoney(order.total, order.currency)}`,
      detail: order.isDraft
        ? `${order.itemCount} поз.`
        : `${orderStatusLabel(order.status)} · ${orderPaymentLabel(order.paymentStatus)}`,
      href: order.isDraft ? `/admin/shop/drafts/${order.id}` : `/admin/shop/orders/${order.id}`,
    }));
    const noteItems: FeedItem[] = notes.map((note) => ({
      id: `note-${note.id}`,
      at: note.createdAt,
      mark: "N",
      tone: "gray",
      title: note.content,
      detail: note.authorName || note.authorEmail,
      multiline: true,
    }));
    const auditItems = customer.auditLog
      .map(auditToFeed)
      .filter((item): item is FeedItem => Boolean(item));
    const created: FeedItem = {
      id: "created",
      at: customer.createdAt,
      mark: "★",
      tone: "gray",
      title: "Клієнт з’явився в базі",
    };
    return [...orderItems, ...noteItems, ...auditItems, created].sort(
      (left, right) => new Date(right.at).getTime() - new Date(left.at).getTime()
    );
  }, [customer, notes]);

  async function patchProfile(body: Record<string, unknown>, successText = "Збережено") {
    if (!customer) return false;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/shop/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profileBody(customer), ...body }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error((data as { error?: string }).error || "Не вдалося зберегти");
        return false;
      }
      setCustomer(data as CustomerDetail);
      toast.success(successText);
      return true;
    } finally {
      setSaving(false);
    }
  }

  function startEdit(key: FieldKey, value: string) {
    setEditing(key);
    setDraft(value);
  }

  async function commitEdit() {
    if (!customer || !editing) return;
    let value = draft.trim();
    if (editing === "firstName" && !value) {
      toast.error("Ім’я не може бути порожнім");
      return;
    }
    if (editing === "email") {
      value = normalizeShopCustomerEmail(value);
      if (!isUsableShopCustomerEmail(value)) {
        toast.error("Вкажіть справжній email клієнта");
        return;
      }
    }
    if (editing === "b2bDiscountPercent") {
      value = value.replace(",", ".");
      if (value && !(Number(value) >= 0 && Number(value) <= 100)) {
        toast.error("Знижка має бути від 0 до 100%");
        return;
      }
    }
    if (value === String(profileBody(customer)[editing] ?? "")) {
      setEditing(null);
      return;
    }
    if (await patchProfile({ [editing]: value })) setEditing(null);
  }

  async function runAction(
    action: "approve_b2b" | "revert_b2c" | "create_setup_link" | "send_password_reset"
  ) {
    if (!customer) return;
    setMenuOpen(false);
    const name = customer.companyName || customer.fullName;
    const confirmations = {
      approve_b2b: {
        title: `Затвердити ${name} як B2B-партнера?`,
        description: "Тарифну групу й знижки на бренди задають на вкладці «Знижки на бренди».",
        confirmLabel: "Затвердити B2B",
      },
      revert_b2c: {
        title:
          customer.group === "B2B_PENDING"
            ? `Відхилити заявку ${name}?`
            : `Перевести ${name} у роздріб?`,
        description: "Клієнт бачитиме звичайні роздрібні ціни. Знижки на бренди збережуться.",
        confirmLabel: customer.group === "B2B_PENDING" ? "Відхилити заявку" : "Перевести в роздріб",
        tone: "warning" as const,
      },
      send_password_reset: {
        title: `Надіслати лист для зміни пароля на ${customer.email}?`,
        description: "Клієнт отримає посилання, щоб задати новий пароль.",
        confirmLabel: "Надіслати лист",
      },
    } as const;
    if (action !== "create_setup_link" && !(await confirm(confirmations[action]))) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/shop/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError((data as { error?: string }).error || "Дія не виконалась");
        return;
      }
      setCustomer(data as CustomerDetail);
      const result = data as {
        setupLinkUrl?: string;
        setupLinkExpiresAt?: string;
        passwordResetSent?: boolean;
        passwordResetTo?: string;
      };
      if (result.setupLinkUrl) {
        setSetupLink({ url: result.setupLinkUrl, expiresAt: result.setupLinkExpiresAt ?? null });
        toast.success("Посилання для входу готове", "Скопіюйте його й надішліть клієнту");
      } else if (action === "send_password_reset") {
        if (result.passwordResetSent === false)
          toast.error("Лист не надіслався", "Скористайтеся посиланням для входу.");
        else toast.success("Лист надіслано", result.passwordResetTo);
      } else {
        toast.success(
          action === "approve_b2b"
            ? "Клієнта затверджено як B2B-партнера"
            : "Клієнт тепер роздрібний"
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function startImpersonation() {
    if (!customer) return;
    const ok = await confirm({
      title: "Відкрити сайт очима клієнта?",
      description:
        "Ви побачите його ціни, кошик і замовлення. Нічого не оформлюйте від його імені без домовленості.",
      confirmLabel: "Відкрити",
    });
    if (!ok) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/shop/customers/${customer.id}/impersonate`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError((data as { error?: string }).error || "Не вдалося відкрити сайт очима клієнта");
        return;
      }
      window.location.href = `/${customer.preferredLocale === "ua" ? "ua" : "en"}/shop/account`;
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!customer) return;
    setMenuOpen(false);
    if (customer.isActive) {
      const ok = await confirm({
        title: "Вимкнути акаунт клієнта?",
        description: "Клієнт не зможе увійти на сайт. Замовлення й історія збережуться.",
        confirmLabel: "Вимкнути",
        tone: "warning",
      });
      if (!ok) return;
    }
    await patchProfile(
      { isActive: !customer.isActive },
      customer.isActive ? "Акаунт вимкнено" : "Акаунт увімкнено"
    );
  }

  async function addNote() {
    if (!noteText.trim() || !id) return;
    setPostingNote(true);
    try {
      const response = await fetch(`/api/admin/notes/shop.customer/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteText.trim() }),
      });
      if (!response.ok) {
        toast.error("Нотатка не зберіглась");
        return;
      }
      setNoteText("");
      await loadNotes();
    } finally {
      setPostingNote(false);
    }
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(label);
    } catch {
      toast.error("Не вдалося скопіювати");
    }
  }

  // Plain render helpers (not components): a component declared inside this
  // one would remount on every keystroke and drop the input's focus.
  function attr({
    field,
    label,
    value,
    display,
    mono,
    multiline,
    options,
    hint,
    locked,
  }: AttrProps) {
    const isEditing = Boolean(field) && editing === field;
    const editable = Boolean(field) && !locked;
    const shown = display ?? (value ? value : null);
    return (
      <div
        key={label}
        className="group grid grid-cols-[118px_minmax(0,1fr)] items-start gap-x-2 px-5 py-0.5 hover:bg-[#141518]"
      >
        <span className="py-1.5 text-zinc-500">{label}</span>
        <div className="min-w-0">
          {isEditing ? (
            <div className="flex items-start gap-1 py-0.5">
              {options ? (
                <select
                  autoFocus
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className={crmInput}
                >
                  {options.map(([optionValue, optionLabel]) => (
                    <option key={optionValue} value={optionValue}>
                      {optionLabel}
                    </option>
                  ))}
                </select>
              ) : multiline ? (
                <textarea
                  autoFocus
                  rows={4}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setEditing(null);
                    if (event.key === "Enter" && (event.ctrlKey || event.metaKey))
                      void commitEdit();
                  }}
                  className={cn(crmInput, "h-auto resize-y py-1.5")}
                />
              ) : (
                <input
                  autoFocus
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setEditing(null);
                    if (event.key === "Enter") void commitEdit();
                  }}
                  className={cn(crmInput, mono && "crm-mono text-[12px]")}
                />
              )}
              <button
                type="button"
                aria-label="Зберегти"
                disabled={saving}
                onClick={() => void commitEdit()}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center bg-[#2563EB] text-white hover:bg-[#3B74F0] disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Скасувати"
                onClick={() => setEditing(null)}
                className={cn(crmIconButton, "shrink-0")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : editable ? (
            <button
              type="button"
              onClick={() => startEdit(field!, value ?? "")}
              className={cn(
                "flex w-full items-start justify-between gap-2 py-1.5 text-left",
                shown ? "text-zinc-100" : "text-zinc-600",
                mono && shown && "crm-mono text-[12px]"
              )}
            >
              <span className={cn("min-w-0 break-words", multiline && "whitespace-pre-line")}>
                {shown ?? "Додати"}
              </span>
              <Pencil className="mt-0.5 h-3 w-3 shrink-0 text-zinc-600 opacity-0 transition group-hover:opacity-100" />
            </button>
          ) : (
            <div
              className={cn(
                "py-1.5",
                shown ? "text-zinc-100" : "text-zinc-600",
                mono && "crm-mono text-[12px]"
              )}
            >
              {shown ?? "—"}
            </div>
          )}
          {hint ? <div className="pb-1 text-[12px] leading-5">{hint}</div> : null}
        </div>
      </div>
    );
  }

  function section(title: string, children: ReactNode) {
    return (
      <section key={title} className="border-b border-[#1F2125] py-2">
        <h2 className="flex items-center gap-1.5 px-5 py-1 text-[12px] font-medium text-zinc-500">
          <ChevronDown className="h-3 w-3" /> {title}
        </h2>
        {children}
      </section>
    );
  }

  if (loading) {
    return (
      <CrmSurface className="min-h-full bg-[#0A0A0B] p-6">
        <div className="flex items-center gap-2 text-zinc-500">
          <UserRound className="h-4 w-4 animate-pulse" /> Завантажуємо клієнта…
        </div>
      </CrmSurface>
    );
  }

  if (!customer) {
    return (
      <CrmSurface className="min-h-full space-y-3 bg-[#0A0A0B] p-6">
        <div className="border-l-2 border-red-400 bg-red-500/[0.08] px-4 py-3 text-red-100">
          {error || "Клієнта не знайдено"}
        </div>
        <Link href="/admin/shop/customers" className="text-zinc-300 hover:text-white">
          ← До клієнтів
        </Link>
      </CrmSurface>
    );
  }

  const title = customer.companyName || customer.fullName || customer.email;
  const placeholderEmail = isPlaceholderShopCustomerEmail(customer.email);
  const emailLocked = Boolean(customer.account?.hasPassword);
  const placedOrders = customer.orders.filter((order) => !order.isDraft);
  const tabCounts: Record<TabKey, number | null> = {
    activity: null,
    orders: customer.orders.length,
    discounts: null,
    notes: notes.length,
    credit: null,
  };
  const metrics = [
    { label: "Замовлень", value: String(ltv?.ordersCount ?? placedOrders.length), mono: true },
    {
      label: "Оплачено",
      value: ltv?.paidOrdersCount ? formatOrderMoney(ltv.totalSpent, ltv.currency) : "—",
      mono: true,
    },
    {
      label: "Середній чек",
      value: ltv?.paidOrdersCount ? formatOrderMoney(ltv.averageOrderValue, ltv.currency) : "—",
      mono: true,
    },
    {
      label: "Останнє замовлення",
      value:
        ltv?.daysSinceLastOrder == null
          ? "Ще не було"
          : ltv.daysSinceLastOrder === 0
            ? "Сьогодні"
            : `${ltv.daysSinceLastOrder} дн. тому`,
      mono: false,
    },
    {
      label: "Кредит",
      value: ltv ? formatOrderMoney(ltv.creditBalance, ltv.currency) : "—",
      mono: true,
    },
  ];

  return (
    <CrmSurface className="flex min-h-full flex-col bg-[#0A0A0B]">
      <section className="flex flex-wrap items-start gap-4 border-b border-[#1F2125] px-5 pb-4 pt-5 sm:px-6">
        <CrmAvatar name={title} partner={customer.group !== "B2C"} size={52} />
        <div className="min-w-[240px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="crm-title text-[22px] font-semibold text-white">{title}</h1>
            {customerTypeChip(customer.group)}
            {customer.tariffGroup && customer.group !== "B2C" ? (
              <CrmChip tone="blue">{customer.tariffGroup.name}</CrmChip>
            ) : null}
            {customer.account?.hasPassword ? (
              <CrmChip tone="green">Є пароль</CrmChip>
            ) : (
              <CrmChip tone="amber">Немає пароля</CrmChip>
            )}
            {!customer.isActive ? <CrmChip tone="red">Акаунт вимкнено</CrmChip> : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-zinc-400">
            {customer.companyName && customer.fullName !== customer.companyName ? (
              <span>{customer.fullName}</span>
            ) : null}
            {customer.phone ? (
              <button
                type="button"
                onClick={() => void copy(customer.phone!, "Телефон скопійовано")}
                className="crm-mono inline-flex items-center gap-1 text-[12px] hover:text-white"
              >
                {customer.phone} <Copy className="h-3 w-3" />
              </button>
            ) : null}
            {placeholderEmail ? (
              <span className="text-[#F5C46B]">Немає справжнього email</span>
            ) : (
              <button
                type="button"
                onClick={() => void copy(customer.email, "Email скопійовано")}
                className="inline-flex items-center gap-1 hover:text-white"
              >
                {customer.email} <Copy className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`/admin/shop/orders/create?customerId=${customer.id}`}
            className={crmPrimaryButton}
          >
            <Plus className="h-3.5 w-3.5" /> Нове замовлення
          </Link>
          <button
            type="button"
            disabled={saving || placeholderEmail}
            onClick={() => void runAction("create_setup_link")}
            title={placeholderEmail ? "Спершу впишіть справжній email" : undefined}
            className={crmButton}
          >
            <KeyRound className="h-3.5 w-3.5" /> Посилання для входу
          </button>
          <button
            type="button"
            disabled={saving || !customer.isActive}
            onClick={() => void startImpersonation()}
            className={crmButton}
          >
            <Eye className="h-3.5 w-3.5" /> Як бачить клієнт
          </button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label="Інші дії"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className={crmIconButton}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-9 z-30 w-60 border border-[#2A2C31] bg-[#111113] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
              >
                <button
                  type="button"
                  role="menuitem"
                  disabled={placeholderEmail}
                  onClick={() => void runAction("send_password_reset")}
                  className="block w-full px-3 py-2 text-left hover:bg-[#1C1D21] disabled:opacity-40"
                >
                  Лист для зміни пароля
                </button>
                {customer.group === "B2B_APPROVED" ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void runAction("revert_b2c")}
                    className="block w-full px-3 py-2 text-left hover:bg-[#1C1D21]"
                  >
                    Перевести в роздріб
                  </button>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void runAction("approve_b2b")}
                    className="block w-full px-3 py-2 text-left hover:bg-[#1C1D21]"
                  >
                    Затвердити як B2B-партнера
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void toggleActive()}
                  className={cn(
                    "block w-full px-3 py-2 text-left hover:bg-[#1C1D21]",
                    customer.isActive && "text-[#F19B9B]"
                  )}
                >
                  {customer.isActive ? "Вимкнути акаунт" : "Увімкнути акаунт"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {error ? (
        <div
          role="alert"
          className="border-b border-[#5B2323] bg-[#1F0E0E] px-6 py-2.5 text-[#F19B9B]"
        >
          {error}
        </div>
      ) : null}

      {setupLink ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-[#203A66] bg-[#0F1620] px-6 py-2.5">
          <span className="text-[#9CC0FF]">
            Посилання для входу
            {setupLink.expiresAt ? ` (до ${formatOrderDate(setupLink.expiresAt)})` : ""}:
          </span>
          <span className="crm-mono min-w-0 flex-1 truncate text-[12px] text-zinc-200">
            {setupLink.url}
          </span>
          <button
            type="button"
            onClick={() => void copy(setupLink.url, "Посилання скопійовано")}
            className={crmPrimaryButton}
          >
            <Copy className="h-3.5 w-3.5" /> Копіювати
          </button>
          <button
            type="button"
            aria-label="Сховати"
            onClick={() => setSetupLink(null)}
            className={crmIconButton}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {customer.group === "B2B_PENDING" ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-[#3A2E14] bg-[#17130A] px-6 py-3">
          <span className="flex-1 text-[#F5DDA6]">
            Заявка на оптові ціни, подана {crmAgo(customer.createdAt)}. Перевірте компанію, ЄДРПОУ і
            контакти.
          </span>
          <button
            type="button"
            disabled={saving}
            onClick={() => void runAction("approve_b2b")}
            className={crmPrimaryButton}
          >
            <Check className="h-3.5 w-3.5" /> Затвердити B2B
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void runAction("revert_b2c")}
            className={crmButton}
          >
            Відхилити
          </button>
        </div>
      ) : null}

      <dl className="grid grid-cols-2 border-b border-[#1F2125] sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="border-b border-r border-[#1F2125] px-5 py-2.5 sm:px-6 lg:border-b-0"
          >
            <dt className="text-[12px] text-zinc-500">{metric.label}</dt>
            <dd className={cn("mt-0.5 text-[15px] text-white", metric.mono && "crm-mono")}>
              {metric.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-1 flex-wrap items-stretch">
        <aside
          aria-label="Дані клієнта"
          className="min-w-0 flex-[1_1_340px] border-r border-[#1F2125] pb-6 lg:max-w-[400px]"
        >
          {section(
            "Контакти",
            <>
              {attr({ field: "firstName", label: "Ім’я", value: customer.firstName })}
              {attr({ field: "lastName", label: "Прізвище", value: customer.lastName })}
              {attr({ field: "phone", label: "Телефон", value: customer.phone ?? "", mono: true })}
              {attr({
                field: "email",
                label: "Email (логін)",
                value: placeholderEmail ? "" : customer.email,
                display: placeholderEmail ? (
                  <span className="text-[#F5C46B]">Вписати справжній email</span>
                ) : (
                  customer.email
                ),
                locked: emailLocked,
                hint: emailLocked ? (
                  <span className="text-zinc-600">
                    Є пароль — email змінює сам клієнт у кабінеті
                  </span>
                ) : placeholderEmail ? (
                  <span className="text-[#C9A869]">
                    Зараз заглушка зі старої CRM — з нею клієнт не увійде
                  </span>
                ) : null,
              })}
              {attr({
                field: "preferredLocale",
                label: "Мова",
                value: customer.preferredLocale === "ua" ? "ua" : "en",
                display: customer.preferredLocale === "ua" ? "Українська" : "English",
                options: [
                  ["ua", "Українська"],
                  ["en", "English"],
                ],
              })}
            </>
          )}
          {section(
            "Компанія",
            <>
              {attr({ field: "companyName", label: "Назва", value: customer.companyName ?? "" })}
              {attr({
                field: "vatNumber",
                label: "ЄДРПОУ / VAT",
                value: customer.vatNumber ?? "",
                mono: true,
              })}
              {attr({ label: "Тип", display: customerTypeChip(customer.group) })}
              {customer.group !== "B2C"
                ? attr({
                    label: "Тарифна група",
                    display: (
                      <button
                        type="button"
                        onClick={() => setTab("discounts")}
                        className={cn(
                          "text-left hover:text-white",
                          customer.tariffGroup ? "text-[#9CC0FF]" : "text-zinc-600"
                        )}
                      >
                        {customer.tariffGroup?.name ?? "Без групи"}
                      </button>
                    ),
                  })
                : null}
              {attr({
                field: "notes",
                label: "Примітка",
                value: customer.notes ?? "",
                multiline: true,
              })}
            </>
          )}
          {section(
            "Вхід на сайт",
            <>
              {attr({
                label: "Пароль",
                display: customer.account?.hasPassword ? "Налаштовано" : "Ще не задано",
              })}
              {attr({
                label: "Останній вхід",
                display: customer.account?.lastLoginAt
                  ? formatOrderDate(customer.account.lastLoginAt, true)
                  : "Не входив",
              })}
              {attr({
                label: "Email підтверджено",
                display: customer.account?.emailVerifiedAt ? "Так" : "Ні",
              })}
              {attr({
                label: "Посилання",
                display: customer.passwordSetup
                  ? `Дійсне до ${formatOrderDate(customer.passwordSetup.expiresAt)}`
                  : "Не створювали",
              })}
              {attr({ label: "У базі з", display: formatOrderDate(customer.createdAt, true) })}
            </>
          )}
          {section(
            "Адреси",
            <>
              {customer.addresses.length ? (
                <ul className="space-y-2 px-5 py-1">
                  {customer.addresses.map((address) => (
                    <li key={address.id} className="leading-5">
                      <span className="text-zinc-100">{address.label || "Адреса"}</span>
                      {address.isDefaultShipping ? (
                        <span className="ml-2 text-[11px] text-[#9CC0FF]">основна</span>
                      ) : null}
                      <span className="block text-zinc-500">
                        {[
                          address.country,
                          address.region,
                          address.city,
                          address.line1,
                          address.line2,
                          address.postcode,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-1 text-zinc-600">Адрес не збережено</p>
              )}
              {customer.carts.length ? (
                <p className="px-5 pt-2 text-[12px] text-zinc-500">
                  Кошик на сайті: {customer.carts[0].itemCount} шт., змінено{" "}
                  {crmAgo(customer.carts[0].updatedAt)}
                </p>
              ) : null}
            </>
          )}
          {section(
            "Теги",
            <div className="px-5 py-1">
              <AdminTagInput
                entityType="shop.customer"
                entityId={customer.id}
                suggestions={[
                  "vip",
                  "bad-payer",
                  "wholesale",
                  "champion",
                  "churn-risk",
                  "do-not-contact",
                ]}
              />
            </div>
          )}
          <p className="px-5 pt-3 text-[12px] leading-5 text-zinc-600">
            Клікніть на значення, щоб змінити. Enter — зберегти, Esc — скасувати.
          </p>
        </aside>

        <section className="flex min-w-0 flex-[999_1_520px] flex-col">
          <CrmTabs
            label="Розділи картки"
            className="border-b border-[#1F2125] px-3"
            tabs={TABS.map((entry) => ({
              key: entry.key,
              label: entry.label,
              count: tabCounts[entry.key],
            }))}
            active={tab}
            onChange={setTab}
          />

          {tab === "activity" ? (
            <div className="space-y-4 px-5 py-4 sm:px-6">
              <div className="border border-[#24262B] bg-[#0E0F11]">
                <label
                  htmlFor="customer-note"
                  className="block px-3 pt-2.5 text-[12px] text-zinc-500"
                >
                  Нотатка для команди
                </label>
                <textarea
                  id="customer-note"
                  rows={2}
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) void addNote();
                  }}
                  placeholder="Про що домовились, що пообіцяли, кому передзвонити…"
                  className="w-full resize-y bg-transparent px-3 pb-2 pt-1 text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                />
                {noteText.trim() ? (
                  <div className="flex justify-end gap-2 border-t border-[#1F2125] px-3 py-2">
                    <button type="button" onClick={() => setNoteText("")} className={crmButton}>
                      Скасувати
                    </button>
                    <button
                      type="button"
                      disabled={postingNote}
                      onClick={() => void addNote()}
                      className={crmPrimaryButton}
                    >
                      {postingNote ? "Зберігаємо…" : "Додати нотатку"}
                    </button>
                  </div>
                ) : null}
              </div>
              <ol className="divide-y divide-[#17181B]">
                {feed.map((item) => {
                  const body = (
                    <>
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex h-7 w-7 items-center justify-center text-[12px] font-semibold",
                          MARK_TONES[item.tone]
                        )}
                      >
                        {item.mark}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block break-words text-zinc-100",
                            item.multiline && "whitespace-pre-line"
                          )}
                        >
                          {item.title}
                        </span>
                        {item.detail ? (
                          <span className="mt-0.5 block text-[12px] text-zinc-500">
                            {item.detail}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className="whitespace-nowrap text-[12px] text-zinc-500"
                        title={formatOrderDate(item.at, true)}
                      >
                        {crmAgo(item.at)}
                      </span>
                    </>
                  );
                  return (
                    <li key={item.id}>
                      {item.href ? (
                        <Link
                          href={item.href}
                          className="grid grid-cols-[28px_minmax(0,1fr)_auto] gap-3 py-2.5 hover:bg-white/[0.02]"
                        >
                          {body}
                        </Link>
                      ) : (
                        <div className="grid grid-cols-[28px_minmax(0,1fr)_auto] gap-3 py-2.5">
                          {body}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}

          {tab === "orders" ? (
            customer.orders.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] border-collapse text-left">
                  <thead>
                    <tr className="h-[34px] border-b border-[#1F2125] text-zinc-500">
                      <th className="px-6 font-normal">Номер</th>
                      <th className="px-3 font-normal">Дата</th>
                      <th className="px-3 font-normal">Статус</th>
                      <th className="px-3 font-normal">Оплата</th>
                      <th className="px-6 text-right font-normal">Сума</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.orders.map((order) => (
                      <tr
                        key={order.id}
                        className="h-11 border-b border-[#17181B] hover:bg-[#141518]"
                      >
                        <td className="px-6">
                          <Link
                            href={
                              order.isDraft
                                ? `/admin/shop/drafts/${order.id}`
                                : `/admin/shop/orders/${order.id}`
                            }
                            className="crm-mono text-[12px] text-[#9CC0FF] hover:text-white"
                          >
                            {order.orderNumber}
                          </Link>
                        </td>
                        <td className="px-3 text-zinc-400">
                          {formatOrderDate(order.createdAt, true)}
                        </td>
                        <td className="px-3">
                          {order.isDraft ? (
                            <CrmChip>Проформа</CrmChip>
                          ) : (
                            <CrmChip tone={crmStatusTone(orderStatusTone(order.status))}>
                              {orderStatusLabel(order.status)}
                            </CrmChip>
                          )}
                        </td>
                        <td className="px-3 text-zinc-400">
                          {orderPaymentLabel(order.paymentStatus)}
                        </td>
                        <td className="crm-mono px-6 text-right text-[12px]">
                          {formatOrderMoney(order.total, order.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-8 text-zinc-500">
                Через акаунт замовлень ще не було.
                <Link
                  href={`/admin/shop/orders/create?customerId=${customer.id}`}
                  className={crmButton}
                >
                  <Plus className="h-3.5 w-3.5" /> Створити замовлення
                </Link>
              </div>
            )
          ) : null}

          {tab === "discounts" ? (
            <div className="space-y-5 px-5 py-4 sm:px-6">
              {customer.group === "B2C" ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border border-[#24262B] px-4 py-3">
                  <span className="text-zinc-300">
                    Роздрібний клієнт бачить звичайні ціни. Щоб давати знижки на бренди — затвердьте
                    його як B2B-партнера.
                  </span>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void runAction("approve_b2b")}
                    className={crmButton}
                  >
                    <Check className="h-3.5 w-3.5" /> Затвердити B2B
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-zinc-400">
                      {customer.group === "B2B_PENDING"
                        ? "Заявку ще не затверджено — група й винятки запрацюють після затвердження."
                        : "Ціну партнера складають тарифна група і винятки нижче."}
                    </p>
                    <Link
                      href={`/admin/shop/customers/b2b-pricing?tab=check&customer=${customer.id}`}
                      className={crmButton}
                    >
                      Перевірити ціни партнера
                    </Link>
                  </div>
                  <CustomerTariffGroupPanel
                    customerId={customer.id}
                    value={customer.tariffGroup}
                    groups={tariffGroups}
                    loading={tariffGroupsLoading}
                    onChanged={(next) =>
                      setCustomer((current) =>
                        current ? { ...current, tariffGroup: next } : current
                      )
                    }
                  />
                  <CustomerBrandDiscountsPanel
                    customerId={customer.id}
                    globalDiscountPct={customer.b2bDiscountPercent}
                    groupName={customer.tariffGroup?.name ?? null}
                    groupDiscounts={
                      tariffGroups.find((group) => group.id === customer.tariffGroup?.id)
                        ?.brandDiscounts
                    }
                  />
                  <div className="-mx-5 border-t border-[#1F2125] pt-2 sm:-mx-6">
                    {attr({
                      field: "b2bDiscountPercent",
                      label: "Інші бренди, %",
                      value:
                        customer.b2bDiscountPercent != null
                          ? String(customer.b2bDiscountPercent)
                          : "",
                      display:
                        customer.b2bDiscountPercent != null
                          ? `−${customer.b2bDiscountPercent}%`
                          : undefined,
                      hint: (
                        <span className="text-zinc-600">
                          Зазвичай порожньо: діє на бренди без знижки партнера й без знижки для
                          всіх.
                        </span>
                      ),
                    })}
                  </div>
                </>
              )}
            </div>
          ) : null}

          {tab === "notes" ? (
            <div className="px-5 py-4 sm:px-6">
              <AdminNotes entityType="shop.customer" entityId={customer.id} />
            </div>
          ) : null}

          {tab === "credit" ? (
            <div className="max-w-xl px-5 py-4 sm:px-6">
              <CustomerCreditPanel customerId={customer.id} preferredCurrency="EUR" />
            </div>
          ) : null}
        </section>
      </div>
    </CrmSurface>
  );
}
