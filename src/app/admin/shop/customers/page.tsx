"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, Check, Download, Plus, RefreshCcw, Search, X } from "lucide-react";

import { useConfirm } from "@/components/admin/AdminConfirmDialog";
import { useToast } from "@/components/admin/AdminToast";
import {
  CrmAvatar,
  CrmChip,
  CrmSurface,
  CrmTabs,
  crmAgo,
  crmButton,
  crmIconButton,
  crmPrimaryButton,
  crmStatusTone,
  customerTypeChip,
} from "@/components/admin/crm/CrmUi";
import { NewCustomerDrawer } from "@/components/admin/customers/NewCustomerDrawer";
import { formatOrderMoney } from "@/components/admin/orders/orderFormat";
import { orderStatusLabel, orderStatusTone } from "@/lib/admin/orderWorkflow";
import { isPlaceholderShopCustomerEmail } from "@/lib/shopCustomerEmail";
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
  canSignIn: boolean;
  lastLoginAt: string | null;
  tariffGroup: { id: string; name: string } | null;
  brandDiscounts: Array<{ brand: string; discountPct: number }>;
  createdAt: string;
  updatedAt: string;
  counts: { orders: number; carts: number; addresses: number };
};

type PeekDetail = {
  preferredLocale: string;
  vatNumber: string | null;
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    isDraft: boolean;
    currency: string;
    total: number;
    createdAt: string;
  }>;
};

const TABS = [
  { key: "all", label: "Усі" },
  { key: "b2b", label: "B2B-партнери" },
  { key: "pending", label: "Заявки B2B" },
  { key: "retail", label: "Роздріб" },
  { key: "buyers", label: "Купували" },
  { key: "noEmail", label: "Без email" },
  { key: "inactive", label: "Вимкнені" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const SORTS = [
  { key: "new", label: "Спочатку нові" },
  { key: "lastOrder", label: "Останнє замовлення" },
  { key: "orders", label: "Більше замовлень" },
  { key: "name", label: "За назвою" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

function isDisabled(customer: CustomerListItem) {
  return Boolean(customer.archivedAt) || !customer.isActive;
}

function displayName(customer: CustomerListItem) {
  return customer.companyName || customer.fullName || customer.email;
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
    case "noEmail":
      return isPlaceholderShopCustomerEmail(customer.email);
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
  const drawerOpen = searchParams.get("new") === "1";

  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("new");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [peekId, setPeekId] = useState<string | null>(null);
  const [peekDetail, setPeekDetail] = useState<PeekDetail | null>(null);
  const [peekLoading, setPeekLoading] = useState(false);
  const peekCache = useRef(new Map<string, PeekDetail>());

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
      peekCache.current.clear();
    } catch {
      setError("Немає зв’язку із сервером. Натисніть «Оновити».");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function replaceParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  function setTab(next: TabKey) {
    replaceParams((params) => (next === "all" ? params.delete("tab") : params.set("tab", next)));
    setSelectedIds([]);
  }

  const setDrawer = useCallback(
    (open: boolean) => {
      const params = new URLSearchParams(searchParams.toString());
      if (open) params.set("new", "1");
      else params.delete("new");
      const search = params.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );
  const closeDrawer = useCallback(() => setDrawer(false), [setDrawer]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        TABS.map((entry) => [
          entry.key,
          customers.filter((customer) => matchesTab(customer, entry.key)).length,
        ])
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
          return displayName(left).localeCompare(displayName(right), "uk");
        default:
          return time(right.createdAt) - time(left.createdAt);
      }
    });
  }, [customers, query, sort, tab]);

  const peek = customers.find((customer) => customer.id === peekId) ?? null;

  useEffect(() => {
    if (!peekId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPeekId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [peekId]);

  useEffect(() => {
    if (!peek) {
      setPeekDetail(null);
      return;
    }
    const cached = peekCache.current.get(peek.id);
    if (cached) {
      setPeekDetail(cached);
      return;
    }
    let active = true;
    setPeekDetail(null);
    setPeekLoading(true);
    const timer = window.setTimeout(() => {
      fetch(`/api/admin/shop/customers/${peek.id}`, { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: PeekDetail | null) => {
          if (!data) return;
          peekCache.current.set(peek.id, data);
          if (active) setPeekDetail(data);
        })
        .catch(() => {})
        .finally(() => {
          if (active) setPeekLoading(false);
        });
    }, 120);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [peek]);

  async function runSingle(customer: CustomerListItem, action: "approve_b2b" | "revert_b2c") {
    const ok = await confirm(
      action === "approve_b2b"
        ? {
            title: `Затвердити ${displayName(customer)} як B2B-партнера?`,
            description: "Знижки на бренди задаються на картці партнера.",
            confirmLabel: "Затвердити B2B",
          }
        : {
            title: `Відхилити заявку ${displayName(customer)}?`,
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
      toast.success(
        action === "approve_b2b" ? "Клієнта затверджено як B2B-партнера" : "Заявку відхилено"
      );
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
      const { updated = 0, skipped = [] as string[] } = data as {
        updated: number;
        skipped: string[];
      };
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
          tab === "b2b"
            ? "B2B_APPROVED"
            : tab === "pending"
              ? "B2B_PENDING"
              : tab === "retail"
                ? "B2C"
                : "ALL",
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

  const allSelected =
    visible.length > 0 && visible.every((customer) => selectedIds.includes(customer.id));

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );
  }

  return (
    <CrmSurface className="flex min-h-full flex-col bg-[#0A0A0B]">
      <header className="flex flex-wrap items-center gap-3 border-b border-[#1F2125] px-4 py-3 sm:px-5">
        <h1 className="crm-title text-[20px] font-semibold text-white">Клієнти</h1>
        <span className="crm-mono text-[12px] text-zinc-500">
          {customers.length ? `${counts.all} · ${counts.b2b} партнерів` : ""}
        </span>
        <label className="order-last flex h-8 min-w-[220px] flex-1 items-center gap-2 border border-[#24262B] bg-[#111113] px-2.5 focus-within:border-[#3B82F6] sm:order-none sm:max-w-[420px]">
          <Search className="h-3.5 w-3.5 text-zinc-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ім’я, компанія, телефон або email"
            aria-label="Пошук клієнтів"
            className="w-full bg-transparent text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Очистити пошук"
              className="text-zinc-500 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Оновити"
            title="Оновити"
            className={crmIconButton}
          >
            <RefreshCcw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting}
            className={crmButton}
          >
            <Download className="h-3.5 w-3.5" /> {exporting ? "Експорт…" : "CSV"}
          </button>
          <button type="button" onClick={() => setDrawer(true)} className={crmPrimaryButton}>
            <Plus className="h-3.5 w-3.5" /> Новий клієнт
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-x-4 border-b border-[#1F2125] px-2 sm:px-3">
        <CrmTabs
          label="Групи клієнтів"
          tabs={TABS.map((entry) => ({
            key: entry.key,
            label: entry.label,
            count: customers.length ? counts[entry.key] : null,
          }))}
          active={tab}
          onChange={setTab}
        />
        <label className="flex items-center gap-2 py-1.5 text-zinc-500">
          <span className="hidden sm:inline">Сортування</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="h-7 border border-[#24262B] bg-[#0A0A0B] px-2 text-[12px] text-zinc-200 focus:outline-none"
          >
            {SORTS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {pending.length && tab !== "inactive" && tab !== "pending" ? (
        <section
          aria-label="Заявки на оптові ціни"
          className="border-b border-[#3A2E14] bg-[#17130A]"
        >
          {pending.map((customer) => (
            <div
              key={customer.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-5"
            >
              <CrmChip tone="amber">Заявка B2B</CrmChip>
              <Link
                href={`/admin/shop/customers/${customer.id}`}
                className="min-w-[180px] flex-1 text-[#F5DDA6] hover:text-white"
              >
                <span className="font-medium">{displayName(customer)}</span>
                <span className="text-[#C9A869]">
                  {" · "}
                  {[customer.companyName ? customer.fullName : null, customer.phone]
                    .filter(Boolean)
                    .join(" · ")}
                  {" · "}подана {crmAgo(customer.createdAt)}
                </span>
              </Link>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runSingle(customer, "approve_b2b")}
                className={crmPrimaryButton}
              >
                <Check className="h-3.5 w-3.5" /> Затвердити
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runSingle(customer, "revert_b2c")}
                className={crmButton}
              >
                Відхилити
              </button>
            </div>
          ))}
        </section>
      ) : null}

      {selectedIds.length ? (
        <div className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-[#203A66] bg-[#0F1620] px-4 py-2 sm:px-5">
          <span className="mr-2 text-[#9CC0FF]">Вибрано: {selectedIds.length}</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runBulk("approve_b2b")}
            className={crmButton}
          >
            Затвердити B2B
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runBulk("revert_b2c")}
            className={crmButton}
          >
            У роздріб
          </button>
          {tab === "inactive" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void runBulk("activate")}
              className={crmButton}
            >
              Увімкнути
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void runBulk("deactivate")}
              className={cn(crmButton, "border-[#5B2323] text-[#F19B9B]")}
            >
              Вимкнути
            </button>
          )}
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="ml-auto px-2 text-zinc-400 hover:text-white"
          >
            Зняти вибір
          </button>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="border-b border-[#5B2323] bg-[#1F0E0E] px-5 py-2.5 text-[#F19B9B]"
        >
          {error}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-wrap items-stretch">
        <div
          className={cn(
            "min-w-0 flex-[999_1_640px]",
            loading && customers.length > 0 && "opacity-60"
          )}
        >
          {loading && !customers.length ? (
            <div className="px-5 py-12 text-center text-zinc-500">Завантажуємо клієнтів…</div>
          ) : visible.length === 0 ? (
            <div className="px-5 py-12 text-center text-zinc-500">
              {query
                ? "Нікого не знайдено. Перевірте написання або пошукайте у вкладці «Усі»."
                : "У цій групі поки немає клієнтів."}
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[900px] table-fixed border-collapse text-left">
                  <colgroup>
                    <col className="w-9" />
                    <col />
                    <col className="w-[108px]" />
                    <col className="w-[210px]" />
                    <col className="w-[200px]" />
                    <col className="w-[120px]" />
                    <col className="w-[130px]" />
                  </colgroup>
                  <thead>
                    <tr className="h-[34px] whitespace-nowrap border-b border-[#1F2125] text-zinc-500">
                      <th className="w-9 pl-5 font-normal">
                        <input
                          type="checkbox"
                          aria-label="Вибрати всіх у списку"
                          checked={allSelected}
                          onChange={() =>
                            setSelectedIds(
                              allSelected ? [] : visible.map((customer) => customer.id)
                            )
                          }
                          className="accent-[#2563EB]"
                        />
                      </th>
                      <th className="px-3 font-normal">Клієнт</th>
                      <th className="px-3 font-normal">Тип</th>
                      <th className="px-3 font-normal">Контакти</th>
                      <th className="px-3 font-normal">Знижки на бренди</th>
                      <th className="px-3 font-normal">Замовлення</th>
                      <th className="pl-3 pr-5 font-normal">Вхід на сайт</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((customer) => {
                      const active = peek?.id === customer.id;
                      const missingEmail = isPlaceholderShopCustomerEmail(customer.email);
                      return (
                        <tr
                          key={customer.id}
                          onClick={(event) => {
                            if ((event.target as HTMLElement).closest("a,button,input,label"))
                              return;
                            setPeekId((current) => (current === customer.id ? null : customer.id));
                          }}
                          onDoubleClick={() => router.push(`/admin/shop/customers/${customer.id}`)}
                          className={cn(
                            "h-12 cursor-pointer border-b border-[#17181B] transition",
                            active
                              ? "bg-[#121A2B] shadow-[inset_2px_0_0_#3B82F6]"
                              : "hover:bg-[#141518]",
                            selectedIds.includes(customer.id) && !active && "bg-[#0F1620]",
                            isDisabled(customer) && "opacity-55"
                          )}
                        >
                          <td className="pl-5">
                            <input
                              type="checkbox"
                              aria-label={`Вибрати ${displayName(customer)}`}
                              checked={selectedIds.includes(customer.id)}
                              onChange={() => toggleSelected(customer.id)}
                              className="accent-[#2563EB]"
                            />
                          </td>
                          <td className="px-3">
                            <div className="flex items-center gap-2.5">
                              <CrmAvatar
                                name={displayName(customer)}
                                partner={customer.group !== "B2C"}
                              />
                              <div className="min-w-0">
                                <Link
                                  href={`/admin/shop/customers/${customer.id}`}
                                  className="block truncate font-medium text-zinc-100 hover:text-[#9CC0FF]"
                                >
                                  {displayName(customer)}
                                </Link>
                                {customer.companyName &&
                                customer.fullName !== customer.companyName ? (
                                  <div className="truncate text-[12px] text-zinc-500">
                                    {customer.fullName}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-3">{customerTypeChip(customer.group)}</td>
                          <td className="px-3">
                            <div className="crm-mono truncate text-[12px] text-zinc-200">
                              {customer.phone || <span className="text-zinc-600">—</span>}
                            </div>
                            <div className="truncate text-[12px]">
                              {missingEmail ? (
                                <span className="text-[#F5C46B]">Немає email</span>
                              ) : (
                                <span className="text-zinc-500">{customer.email}</span>
                              )}
                            </div>
                          </td>
                          <td className="overflow-hidden px-3">
                            {customer.tariffGroup || customer.brandDiscounts.length ? (
                              <div className="flex gap-1 overflow-hidden">
                                {customer.tariffGroup ? (
                                  <CrmChip tone="blue">{customer.tariffGroup.name}</CrmChip>
                                ) : null}
                                {customer.brandDiscounts
                                  .slice(0, customer.tariffGroup ? 1 : 2)
                                  .map((rule) => (
                                    <CrmChip key={rule.brand} tone="green">
                                      {rule.brand} −{rule.discountPct}%
                                    </CrmChip>
                                  ))}
                                {customer.brandDiscounts.length > (customer.tariffGroup ? 1 : 2) ? (
                                  <CrmChip>
                                    +
                                    {customer.brandDiscounts.length -
                                      (customer.tariffGroup ? 1 : 2)}
                                  </CrmChip>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-zinc-600">—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3">
                            {customer.counts.orders ? (
                              <>
                                <div className="crm-mono text-[12px] text-zinc-100">
                                  {customer.counts.orders}
                                </div>
                                <div className="text-[12px] text-zinc-500">
                                  {crmAgo(customer.lastOrderAt) ?? "—"}
                                </div>
                              </>
                            ) : (
                              <span className="text-zinc-600">Ще не було</span>
                            )}
                          </td>
                          <td className="pl-3 pr-5">
                            {isDisabled(customer) ? (
                              <CrmChip tone="red">Вимкнений</CrmChip>
                            ) : customer.canSignIn ? (
                              <CrmChip tone="green">Є пароль</CrmChip>
                            ) : (
                              <CrmChip tone="amber">Немає пароля</CrmChip>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <ul className="divide-y divide-[#17181B] lg:hidden">
                {visible.map((customer) => (
                  <li key={customer.id}>
                    <Link
                      href={`/admin/shop/customers/${customer.id}`}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <CrmAvatar
                        name={displayName(customer)}
                        partner={customer.group !== "B2C"}
                        size={32}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-zinc-100">
                          {displayName(customer)}
                        </span>
                        <span className="block truncate text-[12px] text-zinc-500">
                          {customer.phone ||
                            (isPlaceholderShopCustomerEmail(customer.email)
                              ? "Немає email"
                              : customer.email)}
                          {customer.counts.orders ? ` · ${customer.counts.orders} замовл.` : ""}
                        </span>
                      </span>
                      {customerTypeChip(customer.group)}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {peek ? (
          <aside
            aria-label="Швидкий перегляд клієнта"
            className="fixed bottom-0 right-0 top-14 z-40 hidden w-[400px] flex-col overflow-y-auto border-l border-[#2A2C31] bg-[#0E0F11] shadow-[-24px_0_48px_rgba(0,0,0,0.5)] lg:flex"
          >
            <div className="flex items-center gap-3 border-b border-[#1F2125] px-5 py-4">
              <CrmAvatar name={displayName(peek)} partner={peek.group !== "B2C"} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold text-white">
                  {displayName(peek)}
                </div>
                <div className="truncate text-[12px] text-zinc-500">
                  {peek.companyName && peek.fullName !== peek.companyName
                    ? peek.fullName
                    : "Клієнт"}
                </div>
              </div>
              <Link href={`/admin/shop/customers/${peek.id}`} className={crmButton}>
                Відкрити <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => setPeekId(null)}
                aria-label="Закрити перегляд"
                className={crmIconButton}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 border-b border-[#1F2125] px-5 py-3">
              {customerTypeChip(peek.group)}
              {peek.canSignIn ? (
                <CrmChip tone="green">Є пароль</CrmChip>
              ) : (
                <CrmChip tone="amber">Немає пароля</CrmChip>
              )}
              {isDisabled(peek) ? <CrmChip tone="red">Вимкнений</CrmChip> : null}
            </div>

            <dl className="grid grid-cols-[110px_minmax(0,1fr)] border-b border-[#1F2125] px-5 py-2">
              <dt className="py-1.5 text-zinc-500">Телефон</dt>
              <dd className="crm-mono py-1.5 text-[12px]">{peek.phone || "—"}</dd>
              <dt className="py-1.5 text-zinc-500">Email</dt>
              <dd className="truncate py-1.5">
                {isPlaceholderShopCustomerEmail(peek.email) ? (
                  <span className="text-[#F5C46B]">Немає email</span>
                ) : (
                  peek.email
                )}
              </dd>
              <dt className="py-1.5 text-zinc-500">Останній вхід</dt>
              <dd className="py-1.5">{crmAgo(peek.lastLoginAt) ?? "Не входив"}</dd>
              <dt className="py-1.5 text-zinc-500">З нами з</dt>
              <dd className="py-1.5">{new Date(peek.createdAt).toLocaleDateString("uk-UA")}</dd>
            </dl>

            <div className="border-b border-[#1F2125] px-5 py-3">
              <div className="mb-2 text-zinc-500">Знижки на бренди</div>
              {peek.tariffGroup ? (
                <div className="mb-2">
                  Тарифна група: <CrmChip tone="blue">{peek.tariffGroup.name}</CrmChip>
                </div>
              ) : null}
              {peek.brandDiscounts.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {peek.brandDiscounts.map((rule) => (
                    <CrmChip key={rule.brand} tone="green">
                      {rule.brand} −{rule.discountPct}%
                    </CrmChip>
                  ))}
                </div>
              ) : (
                <span className="text-zinc-500">
                  {peek.group !== "B2B_APPROVED"
                    ? "Бачить роздрібні ціни"
                    : peek.tariffGroup
                      ? "Винятків немає — діють знижки групи"
                      : "Своїх немає — діють знижки брендів для всіх"}
                </span>
              )}
            </div>

            <div className="flex-1 px-5 py-3">
              <div className="mb-2 flex items-baseline justify-between text-zinc-500">
                <span>Замовлення</span>
                <span className="crm-mono text-[11px]">{peek.counts.orders}</span>
              </div>
              {peekLoading && !peekDetail ? (
                <p className="text-zinc-600">Завантажуємо…</p>
              ) : peekDetail?.orders.length ? (
                <ul className="divide-y divide-[#17181B] border-y border-[#17181B]">
                  {peekDetail.orders.slice(0, 5).map((order) => (
                    <li key={order.id}>
                      <Link
                        href={
                          order.isDraft
                            ? `/admin/shop/drafts/${order.id}`
                            : `/admin/shop/orders/${order.id}`
                        }
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-2 hover:bg-white/[0.02]"
                      >
                        <span className="crm-mono truncate text-[12px] text-[#9CC0FF]">
                          {order.orderNumber}
                        </span>
                        <span className="crm-mono text-right text-[12px]">
                          {formatOrderMoney(order.total, order.currency)}
                        </span>
                        <span className="text-[12px] text-zinc-500">{crmAgo(order.createdAt)}</span>
                        <span className="text-right">
                          {order.isDraft ? (
                            <CrmChip>Чернетка</CrmChip>
                          ) : (
                            <CrmChip tone={crmStatusTone(orderStatusTone(order.status))}>
                              {orderStatusLabel(order.status)}
                            </CrmChip>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-zinc-600">Через акаунт замовлень ще не було.</p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-1.5">
                <Link
                  href={`/admin/shop/orders/create?customerId=${peek.id}`}
                  className={crmButton}
                >
                  Нове замовлення
                </Link>
                <Link href={`/admin/shop/customers/${peek.id}?tab=discounts`} className={crmButton}>
                  Знижки
                </Link>
              </div>
            </div>
          </aside>
        ) : null}
      </div>

      <p className="border-t border-[#1F2125] px-5 py-3 text-[12px] text-zinc-500">
        Клік по рядку — швидкий перегляд збоку (Esc закриває), подвійний клік або назва — картка.
        Тут лише покупці з акаунтом на сайті; замовлення без реєстрації шукайте в «Замовленнях» за
        телефоном чи email.
      </p>

      <NewCustomerDrawer open={drawerOpen} onClose={closeDrawer} customers={customers} />
    </CrmSurface>
  );
}
