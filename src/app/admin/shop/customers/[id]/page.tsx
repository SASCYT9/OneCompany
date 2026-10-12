"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  KeyRound,
  Mail,
  Plus,
  Power,
  Save,
  UserRound,
} from "lucide-react";

import {
  AdminInspectorCard,
  AdminKeyValueGrid,
  AdminPage,
  AdminSplitDetailShell,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { useConfirm } from "@/components/admin/AdminConfirmDialog";
import { useToast } from "@/components/admin/AdminToast";
import { AdminActivityTimeline } from "@/components/admin/AdminActivityTimeline";
import { AdminNotes } from "@/components/admin/AdminNotes";
import { AdminTagInput } from "@/components/admin/AdminTagInput";
import { CustomerTypeBadge } from "@/components/admin/customers/CustomerTypeBadge";
import { formatOrderDate, formatOrderMoney } from "@/components/admin/orders/orderFormat";
import { CustomerCreditPanel } from "@/app/admin/shop/customers/components/CustomerCreditPanel";
import { CustomerBrandDiscountsPanel } from "@/app/admin/shop/customers/components/CustomerBrandDiscountsPanel";
import { orderStatusLabel, orderStatusTone } from "@/lib/admin/orderWorkflow";
import { orderPaymentLabel } from "@/lib/shopOrderPresentation";
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
  isActive: boolean;
  notes: string | null;
  preferredLocale: string;
  createdAt: string;
  updatedAt: string;
  account: { lastLoginAt: string | null; emailVerifiedAt: string | null; hasPassword: boolean } | null;
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
};

type ProfileForm = {
  firstName: string;
  lastName: string;
  phone: string;
  companyName: string;
  vatNumber: string;
  notes: string;
  b2bDiscountPercent: string;
  preferredLocale: string;
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

type CrmOrder = { id: string; number: number; name: string; clientTotal: number; itemCount: number };

function formFrom(customer: CustomerDetail): ProfileForm {
  return {
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone ?? "",
    companyName: customer.companyName ?? "",
    vatNumber: customer.vatNumber ?? "",
    notes: customer.notes ?? "",
    b2bDiscountPercent:
      customer.b2bDiscountPercent != null ? String(customer.b2bDiscountPercent) : "",
    preferredLocale: customer.preferredLocale === "ua" ? "ua" : "en",
  };
}

const inputClass =
  "w-full border border-white/15 bg-black/40 px-3 py-2 text-[14px] text-zinc-100 placeholder:text-zinc-600 focus:border-blue-400/60 focus:outline-none";
const quietButton =
  "inline-flex items-center justify-center gap-2 border border-white/15 px-3 py-2 text-[13px] text-zinc-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50";
const cardClass = "border border-white/10 bg-[#151515]";

function Field({
  label,
  hint,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", wide && "sm:col-span-2")}>
      <span className="mb-1.5 block text-[12px] text-zinc-400">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[12px] text-zinc-500">{hint}</span> : null}
    </label>
  );
}

export default function AdminShopCustomerDetailPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const params = useParams();
  const id = params?.id as string;
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [ltv, setLtv] = useState<LtvStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [setupLink, setSetupLink] = useState<{ url: string; expiresAt: string | null } | null>(null);
  const [crmOrders, setCrmOrders] = useState<CrmOrder[] | null>(null);
  const [crmLoading, setCrmLoading] = useState(false);

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
      setForm(formFrom(data as CustomerDetail));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const airtableId = customer?.notes?.match(/\[Airtable:(rec[a-zA-Z0-9]+)\]/)?.[1] ?? null;

  async function loadCrmOrders() {
    if (!airtableId || crmOrders || crmLoading) return;
    setCrmLoading(true);
    try {
      const response = await fetch(
        `/api/admin/crm?type=orders&maxRecords=50&filter=${encodeURIComponent(`FIND("${airtableId}", ARRAYJOIN({Клиент}))`)}`
      );
      const data = await response.json();
      setCrmOrders(
        (data.records || []).map((record: { id: string; fields?: Record<string, unknown> }) => ({
          id: record.id,
          number: Number(record.fields?.["Номер"] ?? 0),
          name: String(record.fields?.["Название"] ?? ""),
          clientTotal: Number(record.fields?.["Итого к оплате клиентом"] ?? 0),
          itemCount: Number(record.fields?.["Кол-во позиций"] ?? 0),
        }))
      );
    } catch {
      setCrmOrders([]);
    } finally {
      setCrmLoading(false);
    }
  }

  const dirty = useMemo(() => {
    if (!customer || !form) return false;
    const base = formFrom(customer);
    return (Object.keys(base) as Array<keyof ProfileForm>).some((key) => base[key] !== form[key]);
  }, [customer, form]);

  async function save(overrides: { isActive?: boolean } = {}) {
    if (!customer || !form) return;
    const discount = form.b2bDiscountPercent.trim();
    if (discount && !(Number(discount) >= 0 && Number(discount) <= 100)) {
      setError("Знижка має бути числом від 0 до 100.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // The endpoint replaces the whole profile, so every field is sent every time.
      const response = await fetch(`/api/admin/shop/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          b2bDiscountPercent: discount,
          isActive: overrides.isActive ?? customer.isActive,
          group: customer.group,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError((data as { error?: string }).error || "Не вдалося зберегти клієнта");
        return;
      }
      setCustomer(data as CustomerDetail);
      setForm(formFrom(data as CustomerDetail));
      toast.success(
        overrides.isActive === false
          ? "Акаунт вимкнено"
          : overrides.isActive
            ? "Акаунт увімкнено"
            : "Зміни збережено"
      );
    } finally {
      setSaving(false);
    }
  }

  async function runAction(
    action: "approve_b2b" | "revert_b2c" | "create_setup_link" | "send_password_reset"
  ) {
    if (!customer) return;
    const name = customer.companyName || customer.fullName;
    const confirmations = {
      approve_b2b: {
        title: `Затвердити ${name} як B2B-партнера?`,
        description:
          "Після входу на сайт клієнт бачитиме оптові ціни. Розмір знижки — у блоці «Ціни для клієнта».",
        confirmLabel: "Затвердити B2B",
      },
      revert_b2c: {
        title:
          customer.group === "B2B_PENDING"
            ? `Відхилити заявку ${name}?`
            : `Перевести ${name} у роздріб?`,
        description: "Клієнт бачитиме звичайні роздрібні ціни. Персональні знижки збережуться.",
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
      setForm(formFrom(data as CustomerDetail));
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
          toast.error("Лист не надіслався", "Скористайтеся посиланням для входу замість листа.");
        else toast.success("Лист надіслано", result.passwordResetTo);
      } else {
        toast.success(
          action === "approve_b2b" ? "Клієнта затверджено як B2B-партнера" : "Клієнт тепер роздрібний"
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function startImpersonation() {
    if (!customer) return;
    const ok = await confirm({
      title: "Відкрити кабінет клієнта?",
      description:
        "Ви побачите сайт так, як бачить його клієнт: його ціни, кошик і замовлення. Нічого не оформлюйте від його імені без домовленості.",
      confirmLabel: "Відкрити кабінет",
    });
    if (!ok) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/shop/customers/${customer.id}/impersonate`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError((data as { error?: string }).error || "Не вдалося відкрити кабінет клієнта");
        return;
      }
      window.location.href = `/${customer.preferredLocale === "ua" ? "ua" : "en"}/shop/account`;
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!customer) return;
    if (customer.isActive) {
      const ok = await confirm({
        title: "Вимкнути акаунт клієнта?",
        description: "Клієнт не зможе увійти на сайт. Замовлення й історія збережуться.",
        confirmLabel: "Вимкнути",
        tone: "warning",
      });
      if (!ok) return;
    }
    await save({ isActive: !customer.isActive });
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(label);
    } catch {
      toast.error("Не вдалося скопіювати");
    }
  }

  function update<K extends keyof ProfileForm>(field: K, value: ProfileForm[K]) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
  }

  if (loading) {
    return (
      <AdminPage>
        <div className="flex items-center gap-3 border border-white/10 bg-[#171717] px-5 py-6 text-sm text-zinc-400">
          <UserRound className="h-4 w-4 animate-pulse" /> Завантажуємо клієнта…
        </div>
      </AdminPage>
    );
  }

  if (!customer || !form) {
    return (
      <AdminPage className="space-y-4">
        <div className="border-l-2 border-red-400 bg-red-500/[0.08] px-4 py-3 text-sm text-red-100">
          {error || "Клієнта не знайдено"}
        </div>
        <Link href="/admin/shop/customers" className="text-sm text-zinc-300 hover:text-white">
          ← До клієнтів
        </Link>
      </AdminPage>
    );
  }

  const title = customer.companyName || customer.fullName || customer.email;
  const placedOrders = customer.orders.filter((order) => !order.isDraft);

  return (
    <AdminPage wide className="max-w-[1400px] space-y-4">
      <header className="space-y-3">
        <Link
          href="/admin/shop/customers"
          className="inline-flex items-center gap-1.5 text-[12px] text-zinc-400 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Клієнти
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[24px] font-semibold tracking-tight text-white">{title}</h1>
              <CustomerTypeBadge group={customer.group} discount={customer.b2bDiscountPercent} />
              {!customer.isActive ? <AdminStatusBadge tone="danger">Акаунт вимкнено</AdminStatusBadge> : null}
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-zinc-400">
              {customer.companyName ? <span>{customer.fullName}</span> : null}
              {customer.phone ? (
                <button
                  type="button"
                  onClick={() => void copy(customer.phone!, "Телефон скопійовано")}
                  className="inline-flex items-center gap-1 hover:text-white"
                >
                  {customer.phone} <Copy className="h-3 w-3" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void copy(customer.email, "Email скопійовано")}
                className="inline-flex items-center gap-1 hover:text-white"
              >
                {customer.email} <Copy className="h-3 w-3" />
              </button>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || saving}
              className="inline-flex items-center gap-2 bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save className="h-4 w-4" /> {saving ? "Зберігаємо…" : "Зберегти зміни"}
            </button>
            <Link href={`/admin/shop/orders/create?customerId=${customer.id}`} className={quietButton}>
              <Plus className="h-4 w-4" /> Замовлення для клієнта
            </Link>
          </div>
        </div>
      </header>

      {error ? (
        <div role="alert" className="border-l-2 border-red-400 bg-red-500/[0.08] px-4 py-2.5 text-[13px] text-red-100">
          {error}
        </div>
      ) : null}
      {dirty ? (
        <div role="status" className="border-l-2 border-amber-400 bg-amber-400/[0.07] px-4 py-2 text-[13px] text-amber-100">
          Є незбережені зміни — натисніть «Зберегти зміни».
        </div>
      ) : null}

      {customer.group === "B2B_PENDING" ? (
        <section className="flex flex-wrap items-center justify-between gap-3 border border-amber-400/30 bg-amber-400/[0.06] px-5 py-4">
          <div>
            <div className="text-[15px] font-semibold text-amber-100">Заявка на оптові ціни</div>
            <p className="mt-0.5 text-[13px] text-amber-100/75">
              Подана {formatOrderDate(customer.createdAt, true)}. Перевірте компанію, ЄДРПОУ і
              контакти — потім вирішіть.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void runAction("approve_b2b")}
              className="inline-flex items-center gap-1.5 bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> Затвердити B2B
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void runAction("revert_b2c")}
              className="border border-white/20 px-4 py-2 text-[13px] text-zinc-100 hover:bg-white/5 disabled:opacity-50"
            >
              Відхилити
            </button>
          </div>
        </section>
      ) : null}

      <dl className="grid grid-cols-2 gap-px border border-white/10 bg-white/10 lg:grid-cols-4">
        {[
          { label: "Замовлень", value: ltv ? String(ltv.ordersCount) : String(placedOrders.length) },
          {
            label: "Оплачено всього",
            value: ltv?.paidOrdersCount ? formatOrderMoney(ltv.totalSpent, ltv.currency) : "—",
            sub: ltv?.paidOrdersCount ? `${ltv.paidOrdersCount} оплачених замовл.` : undefined,
          },
          {
            label: "Середній чек",
            value: ltv && ltv.paidOrdersCount ? formatOrderMoney(ltv.averageOrderValue, ltv.currency) : "—",
          },
          {
            label: "Останнє замовлення",
            value:
              ltv?.daysSinceLastOrder == null
                ? "Ще не було"
                : ltv.daysSinceLastOrder === 0
                  ? "Сьогодні"
                  : `${ltv.daysSinceLastOrder} дн. тому`,
            sub:
              ltv && ltv.creditBalance > 0
                ? `Кредит: ${formatOrderMoney(ltv.creditBalance, ltv.currency)}`
                : undefined,
          },
        ].map((metric) => (
          <div key={metric.label} className="bg-[#151515] px-4 py-3">
            <dt className="text-[11px] uppercase tracking-[0.1em] text-zinc-500">{metric.label}</dt>
            <dd className="mt-1 text-[18px] font-semibold tabular-nums text-white">{metric.value}</dd>
            {metric.sub ? <dd className="text-[12px] text-zinc-500">{metric.sub}</dd> : null}
          </div>
        ))}
      </dl>

      <AdminSplitDetailShell
        className="gap-4 lg:grid-cols-[minmax(0,1fr)_330px]"
        main={
          <>
            <section className={cn(cardClass, "p-5")}>
              <h2 className="mb-4 text-[15px] font-semibold text-white">Контакти й компанія</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Ім’я">
                  <input value={form.firstName} onChange={(event) => update("firstName", event.target.value)} className={inputClass} />
                </Field>
                <Field label="Прізвище">
                  <input value={form.lastName} onChange={(event) => update("lastName", event.target.value)} className={inputClass} />
                </Field>
                <Field label="Телефон">
                  <input value={form.phone} onChange={(event) => update("phone", event.target.value)} inputMode="tel" className={inputClass} />
                </Field>
                <Field label="Email (логін)" hint="Змінити email може лише сам клієнт у кабінеті.">
                  <input value={customer.email} readOnly className={cn(inputClass, "text-zinc-400")} />
                </Field>
                <Field label="Компанія">
                  <input value={form.companyName} onChange={(event) => update("companyName", event.target.value)} className={inputClass} />
                </Field>
                <Field label="ЄДРПОУ / VAT">
                  <input value={form.vatNumber} onChange={(event) => update("vatNumber", event.target.value)} className={inputClass} />
                </Field>
                <Field label="Мова листів і кабінету">
                  <select
                    value={form.preferredLocale}
                    onChange={(event) => update("preferredLocale", event.target.value)}
                    className={inputClass}
                  >
                    <option value="ua">Українська</option>
                    <option value="en">English</option>
                  </select>
                </Field>
                <Field label="Примітка до клієнта" wide>
                  <textarea
                    value={form.notes}
                    onChange={(event) => update("notes", event.target.value)}
                    rows={3}
                    className={cn(inputClass, "resize-y")}
                    placeholder="Видно лише команді"
                  />
                </Field>
              </div>
            </section>

            <section className={cn(cardClass, "p-5")}>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[15px] font-semibold text-white">Ціни для клієнта</h2>
                {customer.group === "B2B_APPROVED" ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void runAction("revert_b2c")}
                    className="text-[12px] text-zinc-400 hover:text-white"
                  >
                    Перевести в роздріб
                  </button>
                ) : null}
              </div>
              {customer.group === "B2C" ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-white/[0.02] px-4 py-3">
                  <p className="text-[13px] leading-5 text-zinc-300">
                    Роздрібний клієнт бачить звичайні ціни сайту. Щоб дати оптові ціни — затвердіть
                    його як B2B-партнера.
                  </p>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void runAction("approve_b2b")}
                    className={quietButton}
                  >
                    <Check className="h-4 w-4" /> Затвердити B2B
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <ol className="grid gap-px border border-white/10 bg-white/10 text-[12px] sm:grid-cols-4">
                    {[
                      ["1", "Знижка на бренд для цього клієнта", "нижче"],
                      ["2", "Знижка бренду для всіх B2B", "Ціни → бренди"],
                      ["3", "Персональна знижка клієнта", "поле нижче"],
                      ["4", "Загальна B2B-знижка", "Налаштування"],
                    ].map(([step, text, where]) => (
                      <li key={step} className="bg-[#151515] px-3 py-2.5">
                        <span className="mr-1.5 font-semibold text-blue-300">{step}.</span>
                        <span className="text-zinc-200">{text}</span>
                        <span className="block text-zinc-500">{where}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="-mt-2 text-[12px] text-zinc-500">
                    Сайт бере першу знижку зі списку, яка задана. Якщо в товару вказана своя оптова
                    ціна — діє вона.
                    {customer.group === "B2B_PENDING" ? " Діятиме після затвердження заявки." : ""}
                  </p>
                  <Field
                    label="Персональна знижка на всі бренди, %"
                    hint="Порожньо — діє загальна B2B-знижка з налаштувань."
                  >
                    <input
                      value={form.b2bDiscountPercent}
                      onChange={(event) => update("b2bDiscountPercent", event.target.value)}
                      inputMode="decimal"
                      placeholder="напр. 10"
                      className={cn(inputClass, "max-w-[180px]")}
                    />
                  </Field>
                  <div className="border-t border-white/[0.06] pt-5">
                    <CustomerBrandDiscountsPanel
                      embedded
                      customerId={customer.id}
                      globalDiscountPct={customer.b2bDiscountPercent}
                    />
                  </div>
                </div>
              )}
            </section>

            <section className={cardClass}>
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5">
                <h2 className="text-[15px] font-semibold text-white">Замовлення</h2>
                <Link
                  href={`/admin/shop/orders?tab=all&q=${encodeURIComponent(customer.phone || customer.email)}`}
                  className="text-[12px] text-zinc-400 hover:text-white"
                >
                  Шукати всі за контактами →
                </Link>
              </div>
              {customer.orders.length ? (
                <ul className="divide-y divide-white/[0.06]">
                  {customer.orders.map((order) => (
                    <li key={order.id}>
                      <Link
                        href={
                          order.isDraft
                            ? `/admin/shop/drafts/${order.id}`
                            : `/admin/shop/orders/${order.id}`
                        }
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3 transition hover:bg-white/[0.03] sm:grid-cols-[minmax(0,1fr)_140px_140px]"
                      >
                        <span className="min-w-0">
                          <span className="font-mono text-[13px] font-semibold text-zinc-100">
                            {order.orderNumber}
                          </span>
                          <span className="ml-2 text-[12px] text-zinc-500">
                            {formatOrderDate(order.createdAt, true)}
                            {order.itemCount ? ` · ${order.itemCount} шт.` : ""}
                          </span>
                        </span>
                        <span className="hidden sm:block">
                          {order.isDraft ? (
                            <AdminStatusBadge>Чернетка</AdminStatusBadge>
                          ) : (
                            <AdminStatusBadge tone={orderStatusTone(order.status)}>
                              {orderStatusLabel(order.status)}
                            </AdminStatusBadge>
                          )}
                        </span>
                        <span className="text-right">
                          <span className="block whitespace-nowrap text-[14px] font-semibold text-white">
                            {formatOrderMoney(order.total, order.currency)}
                          </span>
                          <span className="block text-[11px] text-zinc-500">
                            {orderPaymentLabel(order.paymentStatus)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-6 text-[13px] text-zinc-500">
                  Через акаунт замовлень ще не було.
                  <Link href={`/admin/shop/orders/create?customerId=${customer.id}`} className={quietButton}>
                    <Plus className="h-4 w-4" /> Створити замовлення
                  </Link>
                </div>
              )}
            </section>

            {airtableId ? (
              <details className={cn(cardClass, "p-5")} onToggle={() => void loadCrmOrders()}>
                <summary className="cursor-pointer text-[13px] text-zinc-300">
                  Замовлення зі старої CRM (Airtable)
                </summary>
                <div className="mt-4 space-y-2">
                  {crmLoading || crmOrders === null ? (
                    <p className="text-[13px] text-zinc-500">Завантажуємо…</p>
                  ) : crmOrders.length ? (
                    crmOrders.map((order) => (
                      <div key={order.id} className="flex justify-between gap-3 border border-white/10 px-4 py-3 text-[13px]">
                        <span>
                          <span className="text-zinc-100">#{order.number}</span>
                          <span className="ml-2 text-zinc-500">{order.name}</span>
                        </span>
                        <span className="text-zinc-200">
                          ${order.clientTotal.toLocaleString("uk-UA")} · {order.itemCount} поз.
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[13px] text-zinc-500">Замовлень у CRM не знайдено.</p>
                  )}
                </div>
              </details>
            ) : null}
          </>
        }
        sidebar={
          <>
            <AdminInspectorCard title="Вхід у кабінет">
              <AdminKeyValueGrid
                rows={[
                  {
                    label: "Пароль",
                    value: customer.account?.hasPassword ? "Налаштовано" : "Ще не задано",
                  },
                  {
                    label: "Останній вхід",
                    value: customer.account?.lastLoginAt
                      ? formatOrderDate(customer.account.lastLoginAt, true)
                      : "Не входив",
                  },
                  {
                    label: "Email підтверджено",
                    value: customer.account?.emailVerifiedAt ? "Так" : "Ні",
                  },
                  { label: "Акаунт створено", value: formatOrderDate(customer.createdAt, true) },
                ]}
              />
              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void runAction("create_setup_link")}
                  className={quietButton}
                >
                  <KeyRound className="h-4 w-4" /> Посилання для входу
                </button>
                {setupLink ? (
                  <div className="border border-blue-500/30 bg-blue-500/[0.06] p-3">
                    <div className="break-all font-mono text-[11px] text-zinc-200">{setupLink.url}</div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-zinc-500">
                        {setupLink.expiresAt ? `до ${formatOrderDate(setupLink.expiresAt)}` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => void copy(setupLink.url, "Посилання скопійовано")}
                        className="inline-flex items-center gap-1 bg-blue-600 px-2.5 py-1.5 text-[12px] text-white hover:bg-blue-500"
                      >
                        <Copy className="h-3.5 w-3.5" /> Копіювати
                      </button>
                    </div>
                  </div>
                ) : customer.passwordSetup ? (
                  <p className="text-[12px] text-zinc-500">
                    Попереднє посилання дійсне до {formatOrderDate(customer.passwordSetup.expiresAt)}.
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void runAction("send_password_reset")}
                  className={quietButton}
                >
                  <Mail className="h-4 w-4" /> Лист для зміни пароля
                </button>
                <button
                  type="button"
                  disabled={saving || !customer.isActive}
                  onClick={() => void startImpersonation()}
                  className={quietButton}
                >
                  <Eye className="h-4 w-4" /> Подивитися сайт як клієнт
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void toggleActive()}
                  className={cn(
                    quietButton,
                    customer.isActive ? "border-red-500/30 text-red-200 hover:bg-red-500/10" : ""
                  )}
                >
                  <Power className="h-4 w-4" />
                  {customer.isActive ? "Вимкнути акаунт" : "Увімкнути акаунт"}
                </button>
              </div>
            </AdminInspectorCard>

            <AdminInspectorCard title="Адреси">
              {customer.addresses.length ? (
                <ul className="space-y-2">
                  {customer.addresses.map((address) => (
                    <li key={address.id} className="text-[13px] leading-5 text-zinc-300">
                      <span className="text-zinc-100">{address.label || "Адреса"}</span>
                      {address.isDefaultShipping ? (
                        <span className="ml-2 text-[11px] text-blue-300">основна</span>
                      ) : null}
                      <span className="block text-zinc-400">
                        {[address.country, address.region, address.city, address.line1, address.line2, address.postcode]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-zinc-500">Адрес не збережено.</p>
              )}
              {customer.carts.length ? (
                <p className="mt-3 border-t border-white/[0.06] pt-3 text-[12px] text-zinc-500">
                  Кошик на сайті: {customer.carts[0].itemCount} шт., змінено{" "}
                  {formatOrderDate(customer.carts[0].updatedAt)}
                </p>
              ) : null}
            </AdminInspectorCard>

            <AdminInspectorCard title="Нотатки команди">
              <AdminNotes entityType="shop.customer" entityId={customer.id} />
            </AdminInspectorCard>

            <CustomerCreditPanel customerId={customer.id} preferredCurrency="EUR" />

            <details className={cn(cardClass, "p-4")}>
              <summary className="cursor-pointer text-[13px] text-zinc-300">Теги</summary>
              <div className="mt-4">
                <AdminTagInput
                  entityType="shop.customer"
                  entityId={customer.id}
                  suggestions={["vip", "bad-payer", "wholesale", "champion", "churn-risk", "do-not-contact"]}
                />
              </div>
            </details>

            <details className={cn(cardClass, "p-4")}>
              <summary className="cursor-pointer text-[13px] text-zinc-300">Журнал дій</summary>
              <div className="mt-4">
                <AdminActivityTimeline
                  entityType="shop.customer"
                  entityId={customer.id}
                  emptyTitle="Журнал порожній"
                  emptyDescription="Тут з’являться зміни профілю, знижок і доступу."
                />
              </div>
            </details>
          </>
        }
      />
    </AdminPage>
  );
}
