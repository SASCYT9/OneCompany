"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Database,
  Download,
  ExternalLink,
  Eye,
  Mail,
  Phone,
  RefreshCcw,
  Search,
} from "lucide-react";

import {
  AdminActionBar,
  AdminEmptyState,
  AdminFilterBar,
  AdminInlineAlert,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminResponsiveTable,
  AdminStatusBadge,
  AdminTableShell,
} from "@/components/admin/AdminPrimitives";
import { AdminSkeletonKpiGrid, AdminSkeletonTable } from "@/components/admin/AdminSkeleton";
import { AdminSlideOver } from "@/components/admin/AdminSlideOver";
import { AdminSavedViewsBar, useSavedViews } from "@/components/admin/AdminSavedViews";
import { useToast } from "@/components/admin/AdminToast";
import { AdminMobileCard } from "@/components/admin/AdminMobileCard";

type CustomerGroup = "B2C" | "B2B_PENDING" | "B2B_APPROVED";

type CustomerListItem = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  companyName: string | null;
  group: CustomerGroup;
  isActive: boolean;
  preferredLocale: string;
  createdAt: string;
  updatedAt: string;
  notes: string | null;
  counts: {
    orders: number;
    carts: number;
    addresses: number;
  };
};

function groupTone(group: CustomerGroup): "default" | "success" | "warning" {
  switch (group) {
    case "B2B_APPROVED":
      return "success";
    case "B2B_PENDING":
      return "warning";
    default:
      return "default";
  }
}

export default function AdminShopCustomersPage() {
  const toast = useToast();
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [exporting, setExporting] = useState(false);

  // Saved views — filter combinations stored in localStorage
  const savedViews = useSavedViews({
    scope: "customers",
    currentValue: { query, group, status },
    presets: [
      { name: "Усі клієнти", value: { query: "", group: "ALL", status: "ALL" } },
      { name: "B2B на розгляді", value: { group: "B2B_PENDING", status: "ALL" } },
      { name: "B2B затверджені", value: { group: "B2B_APPROVED", status: "ALL" } },
      { name: "Лише B2C", value: { group: "B2C", status: "ALL" } },
      { name: "Неактивні", value: { status: "inactive", group: "ALL" } },
    ],
    onApply: (v) => {
      setQuery((v.query as string) ?? "");
      setGroup((v.group as string) ?? "ALL");
      setStatus((v.status as string) ?? "ALL");
    },
  });

  async function handleExport() {
    setExporting(true);
    try {
      const filtersJson = JSON.stringify({
        search: query,
        group,
        status: status === "active" ? "ACTIVE" : status === "inactive" ? "INACTIVE" : "",
      });
      const filtersB64 = btoa(unescape(encodeURIComponent(filtersJson)));
      const response = await fetch(`/api/admin/export/customers?filters=${filtersB64}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        toast.error("Не вдалося експортувати клієнтів");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ||
        "customers.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Клієнтів експортовано", `Завантажено ${a.download}`);
    } catch (e) {
      toast.error("Експорт не вдався", (e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  const filteredCustomers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return customers.filter((customer) => {
      if (group !== "ALL" && customer.group !== group) return false;
      if (status === "active" && !customer.isActive) return false;
      if (status === "inactive" && customer.isActive) return false;
      if (!needle) return true;
      return [customer.email, customer.fullName, customer.companyName, customer.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [customers, group, query, status]);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/admin/shop/customers");
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        setError((data as { error?: string }).error || "Failed to load customers");
        return;
      }
      setCustomers(Array.isArray(data) ? (data as CustomerListItem[]) : []);
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <AdminPage className="space-y-6">
        <div role="status" aria-live="polite" aria-busy="true" className="space-y-6">
          <span className="sr-only">Завантаження клієнтів…</span>
          <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
            <div className="space-y-3">
              <div className="h-3 w-20 motion-safe:animate-pulse rounded-none bg-white/6" />
              <div className="h-9 w-72 motion-safe:animate-pulse rounded-none bg-white/6" />
              <div className="h-3.5 w-96 motion-safe:animate-pulse rounded-none bg-white/4" />
            </div>
            <div className="h-9 w-44 motion-safe:animate-pulse rounded-none bg-white/4" />
          </div>
          <AdminSkeletonKpiGrid count={4} />
          <AdminSkeletonTable rows={8} cols={7} />
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Клієнти"
        title="Робота з клієнтами"
        description="B2C та B2B клієнти, стан затвердження, готовність акаунтів та активність замовлень в одному робочому центрі."
        actions={
          <>
            <AdminSavedViewsBar {...savedViews} />
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {exporting ? "Експорт…" : "Експорт CSV"}
            </button>
            <Link
              href="/admin/shop/customers/new"
              className="inline-flex items-center gap-2 rounded-full bg-linear-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600"
            >
              Новий клієнт
            </Link>
          </>
        }
      />

      <AdminMetricGrid>
        <AdminMetricCard
          label="Клієнтів"
          value={customers.length}
          meta="Публічні storefront-акаунти"
        />
        <AdminMetricCard
          label="B2B на розгляді"
          value={customers.filter((item) => item.group === "B2B_PENDING").length}
          meta="Потребують рішення"
          tone="accent"
        />
        <AdminMetricCard
          label="B2B затверджені"
          value={customers.filter((item) => item.group === "B2B_APPROVED").length}
          meta="Готові до оптової роботи"
        />
        <AdminMetricCard
          label="Активність замовлень"
          value={customers.reduce((sum, item) => sum + item.counts.orders, 0)}
          meta="Замовлень серед видимих клієнтів"
        />
      </AdminMetricGrid>

      <AdminActionBar>
        <div className="text-sm text-zinc-500">
          Використовуйте фільтри щоб виділити чергу на затвердження, неактивних або CRM-зв’язаних
          клієнтів.
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCcw className={`h-4 w-4 ${refreshing ? "motion-safe:animate-spin" : ""}`} />
          Оновити
        </button>
      </AdminActionBar>

      <AdminFilterBar>
        <label className="flex w-full min-w-0 flex-1 items-center gap-2 rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-200 md:min-w-[280px]">
          <Search className="h-4 w-4 text-zinc-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Пошук за email, ім'ям, компанією або телефоном"
            className="w-full bg-transparent text-zinc-100 placeholder:text-zinc-500 focus:outline-hidden"
          />
        </label>
        <FilterSelect
          label="Група"
          value={group}
          onChange={setGroup}
          options={[
            { value: "ALL", label: "Усі групи" },
            { value: "B2C", label: "B2C" },
            { value: "B2B_PENDING", label: "B2B на розгляді" },
            { value: "B2B_APPROVED", label: "B2B затверджені" },
          ]}
        />
        <FilterSelect
          label="Статус"
          value={status}
          onChange={setStatus}
          options={[
            { value: "ALL", label: "Усі статуси" },
            { value: "active", label: "Активні" },
            { value: "inactive", label: "Неактивні" },
          ]}
        />
      </AdminFilterBar>

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}

      {filteredCustomers.length === 0 ? (
        <AdminEmptyState
          title="Жоден клієнт не відповідає фільтрам"
          description="Спробуйте інший запит або створіть нового клієнта вручну."
        />
      ) : (
        <AdminResponsiveTable
          mobile={
            <div className="space-y-2">
              {filteredCustomers.map((customer) => (
                <AdminMobileCard
                  key={customer.id}
                  title={customer.fullName || customer.email}
                  subtitle={customer.email}
                  badge={
                    <AdminStatusBadge tone={groupTone(customer.group)}>
                      {customer.group.replace("B2B_", "B2B ")}
                    </AdminStatusBadge>
                  }
                  rows={[
                    { label: "Статус", value: customer.isActive ? "Активний" : "Неактивний" },
                    { label: "Замовлень", value: customer.counts.orders },
                    { label: "Компанія", value: customer.companyName || "—" },
                    { label: "Оновлено", value: new Date(customer.updatedAt).toLocaleDateString() },
                  ]}
                  footer={
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setQuickViewId(customer.id)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-none border border-blue-500/25 bg-blue-500/8 px-3 py-2.5 text-xs font-medium uppercase tracking-wider text-blue-300"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Швидкий перегляд
                      </button>
                      <Link
                        href={`/admin/shop/customers/${customer.id}`}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-none border border-white/8 bg-white/3 px-3 py-2.5 text-xs font-medium uppercase tracking-wider text-zinc-200"
                      >
                        Відкрити
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  }
                />
              ))}
            </div>
          }
          desktop={
            <AdminTableShell>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/3 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                      <th className="px-4 py-4 font-medium">Клієнт</th>
                      <th className="px-4 py-4 font-medium">Група</th>
                      <th className="px-4 py-4 font-medium">Статус</th>
                      <th className="px-4 py-4 font-medium">CRM</th>
                      <th className="px-4 py-4 font-medium">Активність</th>
                      <th className="px-4 py-4 font-medium">Оновлено</th>
                      <th className="px-4 py-4 font-medium">Відкрити</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/6">
                    {filteredCustomers.map((customer) => (
                      <tr key={customer.id} className="align-top transition hover:bg-white/3">
                        <td className="px-4 py-4">
                          <div className="font-medium text-zinc-100">{customer.fullName}</div>
                          <div className="mt-1 text-xs text-zinc-500">{customer.email}</div>
                          <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-zinc-600">
                            {[customer.companyName, customer.phone].filter(Boolean).join(" · ") ||
                              "—"}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <AdminStatusBadge tone={groupTone(customer.group)}>
                            {customer.group.replace("B2B_", "B2B ")}
                          </AdminStatusBadge>
                        </td>
                        <td className="px-4 py-4">
                          {customer.isActive ? (
                            <AdminStatusBadge tone="success">Активний</AdminStatusBadge>
                          ) : (
                            <AdminStatusBadge tone="default">Неактивний</AdminStatusBadge>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {customer.notes?.includes("[Airtable:") ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
                              <Database className="h-3.5 w-3.5" />
                              Зв&apos;язано
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-zinc-300">
                          <div className="font-medium">{customer.counts.orders} замовлень</div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {customer.counts.carts} кошиків · {customer.counts.addresses} адрес
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs text-zinc-500">
                          {new Date(customer.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1.5">
                            <button
                              type="button"
                              onClick={() => setQuickViewId(customer.id)}
                              className="inline-flex items-center gap-1.5 rounded-none border border-blue-500/25 bg-blue-500/8 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-blue-300 transition hover:border-blue-500/40 hover:bg-blue-500/12"
                              title="Швидкий перегляд (без переходу)"
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                              Швидкий перегляд
                            </button>
                            <Link
                              href={`/admin/shop/customers/${customer.id}`}
                              className="inline-flex items-center gap-1.5 rounded-none border border-white/8 bg-white/3 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-200 transition hover:border-white/15 hover:bg-white/6"
                            >
                              Детально
                              <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AdminTableShell>
          }
        />
      )}

      <CustomerQuickView
        customer={customers.find((c) => c.id === quickViewId) ?? null}
        open={quickViewId !== null}
        onClose={() => setQuickViewId(null)}
      />
    </AdminPage>
  );
}

function CustomerQuickView({
  customer,
  open,
  onClose,
}: {
  customer: CustomerListItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const initials = customer
    ? `${customer.firstName?.[0] ?? ""}${customer.lastName?.[0] ?? ""}`.toUpperCase() ||
      customer.email[0]?.toUpperCase() ||
      "OC"
    : "";
  return (
    <AdminSlideOver
      open={open}
      onClose={onClose}
      width="md"
      title={customer ? customer.fullName || customer.email : "Клієнт"}
      subtitle={
        customer
          ? `Створено ${new Date(customer.createdAt).toLocaleDateString("uk-UA")}`
          : undefined
      }
      footer={
        customer ? (
          <div className="flex items-center justify-between gap-3">
            <Link
              href={`/admin/shop/customers/${customer.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 transition hover:text-blue-300"
            >
              Відкрити повний профіль
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-none border border-white/10 bg-white/3 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/6"
            >
              Закрити
            </button>
          </div>
        ) : undefined
      }
    >
      {customer ? (
        <div className="space-y-5">
          {/* Avatar + name */}
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-base font-bold text-blue-300">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-zinc-50">
                {customer.fullName || customer.email}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <AdminStatusBadge tone={groupTone(customer.group)}>
                  {customer.group.replace("B2B_", "B2B ")}
                </AdminStatusBadge>
                <AdminStatusBadge tone={customer.isActive ? "success" : "default"}>
                  {customer.isActive ? "Активний" : "Неактивний"}
                </AdminStatusBadge>
              </div>
            </div>
          </div>

          {/* Contact rows */}
          <section className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Контакти
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 rounded-none border border-white/4 bg-black/25 px-3 py-2 text-sm">
                <Mail className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
                <span className="truncate text-zinc-200">{customer.email}</span>
              </div>
              {customer.phone ? (
                <div className="flex items-center gap-2.5 rounded-none border border-white/4 bg-black/25 px-3 py-2 text-sm">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
                  <span className="truncate text-zinc-200">{customer.phone}</span>
                </div>
              ) : null}
              {customer.companyName ? (
                <div className="flex items-center gap-2.5 rounded-none border border-white/4 bg-black/25 px-3 py-2 text-sm">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
                  <span className="truncate text-zinc-200">{customer.companyName}</span>
                </div>
              ) : null}
            </div>
          </section>

          {/* Activity stats */}
          <section className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Активність
            </div>
            <div className="grid grid-cols-3 gap-2">
              <CqStat label="Замовлень" value={customer.counts.orders.toString()} />
              <CqStat label="Кошиків" value={customer.counts.carts.toString()} />
              <CqStat label="Адрес" value={customer.counts.addresses.toString()} />
            </div>
          </section>

          {/* CRM linkage */}
          {customer.notes?.includes("[Airtable:") ? (
            <section>
              <div className="rounded-none border border-emerald-500/20 bg-emerald-500/4 px-3 py-2.5 text-xs">
                <div className="flex items-center gap-2 text-emerald-300">
                  <Database className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="font-semibold uppercase tracking-wider">
                    Пов&apos;язано з Airtable CRM
                  </span>
                </div>
                <div className="mt-1 text-zinc-500">Запис клієнта синхронізовано з базою CRM.</div>
              </div>
            </section>
          ) : null}

          {/* Notes */}
          {customer.notes ? (
            <section className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Нотатки
              </div>
              <div className="rounded-none border border-white/5 bg-[#171717] px-3 py-2.5 text-sm leading-6 text-zinc-300">
                {customer.notes}
              </div>
            </section>
          ) : null}

          {/* Updated */}
          <section className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Часові мітки
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between gap-3 rounded-none border border-white/4 bg-black/25 px-3 py-2">
                <span className="text-zinc-500">Створено</span>
                <span className="text-zinc-200">
                  {new Date(customer.createdAt).toLocaleString("uk-UA")}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-none border border-white/4 bg-black/25 px-3 py-2">
                <span className="text-zinc-500">Оновлено</span>
                <span className="text-zinc-200">
                  {new Date(customer.updatedAt).toLocaleString("uk-UA")}
                </span>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </AdminSlideOver>
  );
}

function CqStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-none border border-white/5 bg-[#171717] p-3 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums text-zinc-50">{value}</div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block min-w-[180px]">
      <span className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-none border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/20 focus:outline-hidden"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
