"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Download, RefreshCcw, Search, UserPlus, X } from "lucide-react";

import { AdminPage, AdminPageHeader, AdminTableShell } from "@/components/admin/AdminPrimitives";
import { useConfirm } from "@/components/admin/AdminConfirmDialog";
import { useToast } from "@/components/admin/AdminToast";
import { daysSince } from "@/components/admin/orders/orderFormat";
import { CustomerTypeBadge } from "@/components/admin/customers/CustomerTypeBadge";
import { cn } from "@/lib/utils";

type CustomerGroup = "B2C" | "B2B_PENDING" | "B2B_APPROVED";

type CustomerListItem = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  companyName: string | null;
  group: CustomerGroup;
  b2bDiscountPercent: number | null;
  isActive: boolean;
  archivedAt: string | null;
  lastOrderAt: string | null;
  createdAt: string;
  updatedAt: string;
  counts: { orders: number; carts: number; addresses: number };
};

const TABS = [
  { key: "all", label: "Усі" },
  { key: "b2b", label: "B2B-партнери" },
  { key: "pending", label: "Заявки B2B" },
  { key: "retail", label: "Роздріб" },
  { key: "buyers", label: "Купували" },
  { key: "inactive", label: "Вимкнені" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const SORTS = [
  { key: "new", label: "Спочатку нові" },
  { key: "lastOrder", label: "Останнє замовлення" },
  { key: "orders", label: "Більше замовлень" },
  { key: "name", label: "За ім’ям" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

const quietButton =
  "inline-flex items-center justify-center gap-2 border border-white/15 px-3 py-2 text-[13px] text-zinc-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50";

function isDisabled(customer: CustomerListItem) {
  return Boolean(customer.archivedAt) || !customer.isActive;
}

function matchesTab(customer: CustomerListItem, tab: TabKey) {
  if (tab === "inactive") return isDisabled(customer);
  if (isDisabled(customer)) return false;
  switch (tab) {
    case "b2b":
      return customer.group === "B2B_APPROVED";
    case "pending":
      return customer.group === "B2B_PENDING";
    case "retail":
      return customer.group === "B2C";
    case "buyers":
      return customer.counts.orders > 0;
    default:
      return true;
  }
}

export default function AdminShopCustomersPage() {
  return (
    <Suspense fallback={null}>
      <CustomersScreen />
    </Suspense>
  );
}

function CustomersScreen() {
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = (TABS.find((entry) => entry.key === searchParams.get("tab"))?.key ?? "all") as TabKey;

  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("new");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/shop/customers", { cache: "no-store" });
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        setError((data as { error?: string }).error || "Не вдалося завантажити клієнтів");
        return;
      }
      setCustomers(Array.isArray(data) ? (data as CustomerListItem[]) : []);
      setSelectedIds([]);
    } catch {
      setError("Немає зв’язку із сервером. Натисніть «Оновити».");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function setTab(next: TabKey) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") params.delete("tab");
    else params.set("tab", next);
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    setSelectedIds([]);
  }

  const counts = useMemo(
    () =>
      Object.fromEntries(
        TABS.map((entry) => [entry.key, customers.filter((customer) => matchesTab(customer, entry.key)).length])
      ) as Record<TabKey, number>,
    [customers]
  );

  const pending = useMemo(
    () => customers.filter((customer) => matchesTab(customer, "pending")),
    [customers]
  );

  const visible = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const filtered = customers.filter((customer) => {
      if (!matchesTab(customer, tab)) return false;
      if (!words.length) return true;
      const haystack = [customer.fullName, customer.email, customer.companyName, customer.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
    const time = (value: string | null) => (value ? new Date(value).getTime() : 0);
    return filtered.sort((left, right) => {
      switch (sort) {
        case "lastOrder":
          return time(right.lastOrderAt) - time(left.lastOrderAt);
        case "orders":
          return right.counts.orders - left.counts.orders;
        case "name":
          return (left.companyName || left.fullName).localeCompare(right.companyName || right.fullName, "uk");
        default:
          return time(right.createdAt) - time(left.createdAt);
      }
    });
  }, [customers, query, sort, tab]);

  async function runSingle(customer: CustomerListItem, action: "approve_b2b" | "revert_b2c") {
    const ok = await confirm(
      action === "approve_b2b"
        ? {
            title: `Затвердити ${customer.companyName || customer.fullName} як B2B-партнера?`,
            description:
              "Після входу на сайт клієнт бачитиме оптові ціни: знижку бренду або загальну B2B-знижку з налаштувань. Персональну знижку можна задати в картці клієнта.",
            confirmLabel: "Затвердити B2B",
          }
        : {
            title: `Відхилити заявку ${customer.companyName || customer.fullName}?`,
            description: "Клієнт лишиться роздрібним покупцем і бачитиме звичайні ціни.",
            confirmLabel: "Відхилити — лишити роздріб",
            tone: "warning",
          }
    );
    if (!ok) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/shop/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error("Не вдалося", (data as { error?: string }).error || "Спробуйте ще раз");
        return;
      }
      toast.success(action === "approve_b2b" ? "Клієнта затверджено як B2B-партнера" : "Заявку відхилено");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function runBulk(action: "approve_b2b" | "revert_b2c" | "activate" | "deactivate") {
    if (!selectedIds.length) return;
    const labels = {
      approve_b2b: "Затвердити як B2B-партнерів",
      revert_b2c: "Перевести в роздріб",
      activate: "Увімкнути акаунти",
      deactivate: "Вимкнути акаунти",
    } as const;
    const ok = await confirm({
      title: `${labels[action]}: ${selectedIds.length} клієнт.?`,
      description:
        action === "deactivate"
          ? "Вимкнені клієнти не зможуть увійти на сайт. Історія замовлень зберігається."
          : "Зміну буде записано в журнал дій.",
      confirmLabel: labels[action],
      tone: action === "deactivate" ? "warning" : "default",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/shop/customers/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error("Не вдалося", (data as { error?: string }).error || "Спробуйте ще раз");
        return;
      }
      const { updated = 0, skipped = [] as string[] } = data as { updated: number; skipped: string[] };
      toast.success(
        `Оновлено клієнтів: ${updated}`,
        skipped.length ? `${skipped.length} уже були в потрібному стані` : undefined
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const filtersJson = JSON.stringify({
        search: query,
        group:
          tab === "b2b" ? "B2B_APPROVED" : tab === "pending" ? "B2B_PENDING" : tab === "retail" ? "B2C" : "ALL",
        status: tab === "inactive" ? "INACTIVE" : "",
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
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ||
        "customers.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Клієнтів експортовано", `Завантажено ${anchor.download}`);
    } catch (cause) {
      toast.error("Експорт не вдався", (cause as Error).message);
    } finally {
      setExporting(false);
    }
  }

  const allSelected = visible.length > 0 && visible.every((customer) => selectedIds.includes(customer.id));

  return (
    <AdminPage wide className="space-y-4">
      <AdminPageHeader
        eyebrow="Клієнти"
        title="Клієнти"
        description={
          customers.length
            ? `${counts.all} акаунтів на сайті · ${counts.b2b} B2B-партнерів · ${counts.buyers} уже купували`
            : "Акаунти покупців і B2B-партнерів"
        }
        actions={
          <Link
            href="/admin/shop/customers/new"
            className="inline-flex items-center gap-2 bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-blue-500"
          >
            <UserPlus className="h-4 w-4" /> Новий клієнт
          </Link>
        }
      />

      {pending.length && tab !== "inactive" ? (
        <section
          aria-labelledby="pending-heading"
          className="border border-amber-400/30 bg-amber-400/[0.05]"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-amber-400/20 px-4 py-3">
            <h2 id="pending-heading" className="text-[14px] font-semibold text-amber-100">
              Заявки на оптові ціни · {pending.length}
            </h2>
            <span className="text-[12px] text-amber-100/70">
              Перевірте компанію й контакти, потім затвердіть або відхиліть
            </span>
          </div>
          <ul className="divide-y divide-amber-400/10">
            {pending.map((customer) => (
              <li
                key={customer.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
              >
                <Link href={`/admin/shop/customers/${customer.id}`} className="min-w-[200px] flex-1">
                  <span className="block text-[14px] font-medium text-white hover:text-blue-200">
                    {customer.companyName || customer.fullName}
                  </span>
                  <span className="block text-[12px] text-zinc-400">
                    {[customer.companyName ? customer.fullName : null, customer.email, customer.phone]
                      .filter(Boolean)
                      .join(" · ")}{" "}
                    · заявка {daysSince(customer.createdAt) === 0 ? "сьогодні" : `${daysSince(customer.createdAt)} дн. тому`}
                  </span>
                </Link>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runSingle(customer, "approve_b2b")}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" /> Затвердити
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runSingle(customer, "revert_b2c")}
                    className="border border-white/20 px-3 py-1.5 text-[13px] text-zinc-200 transition hover:bg-white/5 disabled:opacity-50"
                  >
                    Відхилити
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav
        aria-label="Групи клієнтів"
        className="no-scrollbar -mx-1 flex gap-px overflow-x-auto border-b border-white/10 px-1"
      >
        {TABS.map((entry) => {
          const active = entry.key === tab;
          return (
            <button
              key={entry.key}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => setTab(entry.key)}
              className={cn(
                "relative shrink-0 px-3.5 py-2.5 text-[13px] transition",
                active ? "text-white" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
              )}
            >
              {entry.label}
              {customers.length ? (
                <span
                  className={cn(
                    "ml-2 px-1.5 py-0.5 text-[11px] tabular-nums",
                    active ? "bg-blue-500/25 text-blue-100" : "bg-white/[0.06] text-zinc-400"
                  )}
                >
                  {counts[entry.key]}
                </span>
              ) : null}
              {active ? <span className="absolute inset-x-0 bottom-[-1px] h-[2px] bg-blue-400" /> : null}
            </button>
          );
        })}
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-[240px] flex-1 items-center gap-2 border border-white/15 bg-black/30 px-3 py-2 focus-within:border-blue-400/60">
          <Search className="h-4 w-4 text-zinc-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ім’я, компанія, телефон або email"
            className="w-full bg-transparent text-[14px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Очистити пошук"
              className="text-zinc-500 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </label>
        <label className="flex items-center gap-2 text-[13px] text-zinc-400">
          <span className="sr-only">Сортування</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="border border-white/15 bg-black/30 px-3 py-2 text-[13px] text-zinc-100 focus:outline-none"
          >
            {SORTS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void load()} className={quietButton}>
          <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} /> Оновити
        </button>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting}
          className={quietButton}
        >
          <Download className="h-4 w-4" /> {exporting ? "Експорт…" : "CSV"}
        </button>
      </div>

      {selectedIds.length ? (
        <div className="sticky top-14 z-30 flex flex-wrap items-center gap-2 border border-blue-500/30 bg-[#0f1620] px-4 py-2.5">
          <span className="mr-2 text-[13px] text-blue-100">Вибрано: {selectedIds.length}</span>
          <button type="button" disabled={busy} onClick={() => void runBulk("approve_b2b")} className="bg-emerald-600 px-3 py-1.5 text-[13px] text-white hover:bg-emerald-500 disabled:opacity-50">
            Затвердити B2B
          </button>
          <button type="button" disabled={busy} onClick={() => void runBulk("revert_b2c")} className="border border-white/20 px-3 py-1.5 text-[13px] text-zinc-200 hover:bg-white/5 disabled:opacity-50">
            У роздріб
          </button>
          {tab === "inactive" ? (
            <button type="button" disabled={busy} onClick={() => void runBulk("activate")} className="border border-white/20 px-3 py-1.5 text-[13px] text-zinc-200 hover:bg-white/5 disabled:opacity-50">
              Увімкнути
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={() => void runBulk("deactivate")} className="border border-red-500/40 px-3 py-1.5 text-[13px] text-red-200 hover:bg-red-500/10 disabled:opacity-50">
              Вимкнути
            </button>
          )}
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="ml-auto px-2 py-1.5 text-[13px] text-zinc-400 hover:text-white"
          >
            Зняти вибір
          </button>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="border-l-2 border-red-400 bg-red-500/[0.08] px-4 py-3 text-[13px] text-red-100">
          {error}
        </div>
      ) : null}

      {loading && !customers.length ? (
        <div className="border border-white/10 bg-[#151515] px-5 py-10 text-center text-[13px] text-zinc-500">
          Завантажуємо клієнтів…
        </div>
      ) : visible.length === 0 ? (
        <div className="border border-white/10 bg-[#151515] px-5 py-12 text-center text-[13px] text-zinc-500">
          {query ? "Нікого не знайдено. Перевірте написання або пошукайте у вкладці «Усі»." : "У цій групі поки немає клієнтів."}
        </div>
      ) : (
        <>
          <AdminTableShell className={cn("hidden lg:block", loading && "opacity-60")}>
            <table className="w-full table-fixed text-left text-[13px]">
              <colgroup>
                <col className="w-10" />
                <col />
                <col className="w-[24%]" />
                <col className="w-[170px]" />
                <col className="w-[150px]" />
                <col className="w-[110px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.1em] text-zinc-500">
                  <th className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label="Вибрати всіх у списку"
                      checked={allSelected}
                      onChange={() =>
                        setSelectedIds(allSelected ? [] : visible.map((customer) => customer.id))
                      }
                      className="accent-blue-600"
                    />
                  </th>
                  <th className="px-3 py-2.5 font-medium">Клієнт</th>
                  <th className="px-3 py-2.5 font-medium">Контакти</th>
                  <th className="px-3 py-2.5 font-medium">Тип</th>
                  <th className="px-3 py-2.5 font-medium">Замовлення</th>
                  <th className="px-3 py-2.5 font-medium">З нами з</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {visible.map((customer) => {
                  const lastOrderDays = customer.lastOrderAt ? daysSince(customer.lastOrderAt) : null;
                  return (
                    <tr
                      key={customer.id}
                      onClick={(event) => {
                        if ((event.target as HTMLElement).closest("a,button,input,label")) return;
                        router.push(`/admin/shop/customers/${customer.id}`);
                      }}
                      className={cn(
                        "cursor-pointer align-top transition hover:bg-white/[0.03]",
                        selectedIds.includes(customer.id) && "bg-blue-500/[0.06]",
                        isDisabled(customer) && "opacity-60"
                      )}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Вибрати ${customer.fullName}`}
                          checked={selectedIds.includes(customer.id)}
                          onChange={() =>
                            setSelectedIds((current) =>
                              current.includes(customer.id)
                                ? current.filter((id) => id !== customer.id)
                                : [...current, customer.id]
                            )
                          }
                          className="accent-blue-600"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/admin/shop/customers/${customer.id}`}
                          className="block truncate font-medium text-zinc-100 hover:text-blue-300"
                        >
                          {customer.companyName || customer.fullName || customer.email}
                        </Link>
                        {customer.companyName ? (
                          <div className="truncate text-[12px] text-zinc-400">{customer.fullName}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <div className="truncate text-zinc-200">{customer.phone || "—"}</div>
                        <div className="truncate text-[12px] text-zinc-500">{customer.email}</div>
                      </td>
                      <td className="px-3 py-3">
                        <CustomerTypeBadge group={customer.group} discount={customer.b2bDiscountPercent} />
                        {isDisabled(customer) ? (
                          <div className="mt-1 text-[11px] text-red-300">Вимкнений</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <div className={customer.counts.orders ? "text-zinc-100" : "text-zinc-500"}>
                          {customer.counts.orders ? `${customer.counts.orders} замовл.` : "Ще не купував"}
                        </div>
                        {lastOrderDays !== null ? (
                          <div className="text-[12px] text-zinc-500">
                            останнє {lastOrderDays === 0 ? "сьогодні" : `${lastOrderDays} дн. тому`}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-[12px] text-zinc-400">
                        {new Date(customer.createdAt).toLocaleDateString("uk-UA", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </AdminTableShell>

          <div className={cn("grid gap-2 sm:grid-cols-2 lg:hidden", loading && "opacity-60")}>
            {visible.map((customer) => (
              <Link
                key={customer.id}
                href={`/admin/shop/customers/${customer.id}`}
                className="block border border-white/10 bg-[#151515] px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium text-zinc-100">
                      {customer.companyName || customer.fullName}
                    </div>
                    <div className="truncate text-[12px] text-zinc-500">
                      {customer.phone || customer.email}
                    </div>
                  </div>
                  <CustomerTypeBadge group={customer.group} discount={customer.b2bDiscountPercent} />
                </div>
                <div className="mt-2 flex justify-between gap-2 text-[12px] text-zinc-400">
                  <span>
                    {customer.counts.orders ? `${customer.counts.orders} замовл.` : "Ще не купував"}
                    {customer.lastOrderAt ? ` · останнє ${daysSince(customer.lastOrderAt)} дн. тому` : ""}
                  </span>
                  {isDisabled(customer) ? <span className="text-red-300">Вимкнений</span> : null}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <p className="text-[12px] text-zinc-500">
        Тут лише покупці з акаунтом на сайті. Замовлення без реєстрації шукайте в розділі
        «Замовлення» за телефоном чи email.
      </p>
    </AdminPage>
  );
}
