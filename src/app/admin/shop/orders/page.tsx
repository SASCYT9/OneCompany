"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  MoreHorizontal,
  Package,
  RefreshCcw,
  Search,
  X,
} from "lucide-react";

import {
  AdminPage,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableShell,
} from "@/components/admin/AdminPrimitives";
import { useToast } from "@/components/admin/AdminToast";
import { OrderStatusDialog } from "@/components/admin/orders/OrderStatusDialog";
import {
  daysSince,
  formatOrderDate,
  formatOrderMoney,
  paymentTone,
} from "@/components/admin/orders/orderFormat";
import {
  isStaleOrder,
  ORDER_LIST_TABS,
  ORDER_STALE_DAYS,
  orderListTab,
  orderNextStep,
  orderStatusLabel,
  orderStatusTone,
  type OrderListTab,
  type OrderStatusCode,
} from "@/lib/admin/orderWorkflow";
import { orderPaymentLabel, orderPaymentMethodLabel } from "@/lib/shopOrderPresentation";
import { cn } from "@/lib/utils";
import type { AdminOrderListRow } from "@/lib/shopAdminOrders";

type OrdersResponse = {
  orders: AdminOrderListRow[];
  total: number;
  page: number;
  pages: number;
  pageSize: number;
  tab: OrderListTab;
  tabCounts: Record<OrderListTab, number>;
  staleCount: number;
  customerEmailsEnabled: boolean;
};

/** Short verbs for the row button; the order card shows the full sentence. */
const ROW_ACTION_LABEL: Partial<Record<OrderStatusCode, string>> = {
  CONFIRMED: "Підтвердити",
  PROCESSING: "В роботу",
  SHIPPED: "Відправлено",
  DELIVERED: "Отримано",
  PENDING_REVIEW: "Відновити",
};

const ACTIVE_STATUSES = ["PENDING_REVIEW", "PENDING_PAYMENT", "CONFIRMED", "PROCESSING", "SHIPPED"];

const buttonQuiet =
  "inline-flex items-center justify-center gap-2 border border-white/15 px-3 py-2 text-[13px] text-zinc-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50";

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersScreen />
    </Suspense>
  );
}

function OrdersScreen() {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = orderListTab(searchParams.get("tab")).key;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const stale = searchParams.get("stale") === "1";
  const urlQuery = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(urlQuery);
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [dialog, setDialog] = useState<{
    orders: AdminOrderListRow[];
    target: OrderStatusCode | null;
    key: number;
  } | null>(null);

  const updateUrl = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const search = next.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Typing waits a moment before searching; the query lives in the URL so «Back» keeps it.
  useEffect(() => {
    const value = query.trim();
    if (value === urlQuery.trim()) return;
    const timer = window.setTimeout(() => updateUrl({ q: value || null, page: null }), 300);
    return () => window.clearTimeout(timer);
  }, [query, updateUrl, urlQuery]);

  useEffect(() => {
    const controller = new AbortController();
    async function run() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ tab, page: String(page) });
        if (urlQuery.trim()) params.set("q", urlQuery.trim());
        if (stale) params.set("stale", "1");
        const response = await fetch(`/api/admin/shop/orders?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(body.error || "Не вдалося завантажити замовлення");
          return;
        }
        setData(body as OrdersResponse);
        setSelectedIds([]);
      } catch (cause) {
        if ((cause as Error).name !== "AbortError")
          setError("Немає зв’язку із сервером. Натисніть «Оновити».");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void run();
    return () => controller.abort();
  }, [tab, page, stale, urlQuery, reloadKey]);

  useEffect(() => {
    if (!menuFor) return;
    const close = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest("[data-row-menu]")) setMenuFor(null);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menuFor]);

  const orders = useMemo(() => data?.orders ?? [], [data]);
  const selectedOrders = orders.filter((order) => selectedIds.includes(order.id));
  const allSelected = orders.length > 0 && selectedIds.length === orders.length;

  function openDialog(rows: AdminOrderListRow[], target: OrderStatusCode | null) {
    setMenuFor(null);
    setDialog({ orders: rows, target, key: Date.now() });
  }

  async function handleExport() {
    setExporting(true);
    try {
      const statuses = orderListTab(tab).statuses;
      const filtersJson = JSON.stringify({
        status: statuses.length === 1 ? statuses[0] : "",
        search: urlQuery.trim(),
      });
      const filtersB64 = btoa(unescape(encodeURIComponent(filtersJson)));
      const response = await fetch(`/api/admin/export/orders?filters=${filtersB64}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        toast.error("Не вдалося експортувати замовлення");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ||
        "orders.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Замовлення експортовано", `Завантажено ${anchor.download}`);
    } catch (cause) {
      toast.error("Експорт не вдався", (cause as Error).message);
    } finally {
      setExporting(false);
    }
  }

  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 50;
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);

  return (
    <AdminPage wide className="space-y-4">
      <AdminPageHeader
        eyebrow="Продажі"
        title="Замовлення"
        description={
          data
            ? `Усього ${data.tabCounts.all} · потребують дії ${data.tabCounts.active}`
            : "Замовлення магазину"
        }
        actions={
          <>
            <Link
              href="/admin/shop/orders/new"
              className="inline-flex items-center gap-2 bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-blue-500"
            >
              Нове замовлення
            </Link>
            <Link href="/admin/shop/orders/create" className={buttonQuiet}>
              B2B замовлення
            </Link>
          </>
        }
      />

      {data && data.staleCount > 0 && !stale ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-amber-400 bg-amber-400/[0.07] px-4 py-3 text-[13px] text-amber-100">
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {data.staleCount} замовл. висять у «На перевірці» чи «Очікує оплату» понад{" "}
            {ORDER_STALE_DAYS} днів і засмічують список.
          </span>
          <button
            type="button"
            onClick={() => updateUrl({ stale: "1", page: null })}
            className="border border-amber-300/40 px-3 py-1.5 text-[13px] font-medium text-amber-100 transition hover:bg-amber-300/10"
          >
            Розібрати їх
          </button>
        </div>
      ) : null}
      {stale ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-amber-400 bg-amber-400/[0.07] px-4 py-3 text-[13px] text-amber-100">
          <span>
            Старі необроблені замовлення (понад {ORDER_STALE_DAYS} днів). Неоплачені й неактуальні —
            виберіть і натисніть «Скасувати» з причиною. Оплачені, які вже віддали клієнту, —
            «Змінити статус» → «Доставлено».
          </span>
          <button
            type="button"
            onClick={() => updateUrl({ stale: null, page: null })}
            className="inline-flex items-center gap-1.5 border border-white/20 px-3 py-1.5 text-[13px] text-zinc-100 transition hover:bg-white/5"
          >
            <X className="h-3.5 w-3.5" /> До всіх замовлень
          </button>
        </div>
      ) : null}

      <nav
        aria-label="Етапи замовлень"
        className={cn(
          "no-scrollbar -mx-1 flex gap-px overflow-x-auto border-b border-white/10 px-1",
          stale && "pointer-events-none opacity-40"
        )}
      >
        {ORDER_LIST_TABS.map((entry) => {
          const active = entry.key === tab && !stale;
          const count = data?.tabCounts[entry.key];
          return (
            <button
              key={entry.key}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => updateUrl({ tab: entry.key === "active" ? null : entry.key, page: null })}
              className={cn(
                "relative shrink-0 px-3.5 py-2.5 text-[13px] transition",
                active ? "text-white" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
              )}
            >
              {entry.label}
              {count !== undefined ? (
                <span
                  className={cn(
                    "ml-2 px-1.5 py-0.5 text-[11px] tabular-nums",
                    active ? "bg-blue-500/25 text-blue-100" : "bg-white/[0.06] text-zinc-400"
                  )}
                >
                  {count}
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
            placeholder="Номер, ім’я, телефон, email, ТТН або товар"
            className="w-full bg-transparent text-[14px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-zinc-500 hover:text-white"
              aria-label="Очистити пошук"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </label>
        <button
          type="button"
          onClick={() => setReloadKey((current) => current + 1)}
          className={buttonQuiet}
        >
          <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} /> Оновити
        </button>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting}
          className={buttonQuiet}
          title="Завантажити замовлення поточної вкладки в CSV"
        >
          <Download className="h-4 w-4" />
          {exporting ? "Експорт…" : "CSV"}
        </button>
      </div>

      {selectedOrders.length ? (
        <div className="sticky top-14 z-30 flex flex-wrap items-center gap-2 border border-blue-500/30 bg-[#0f1620] px-4 py-2.5">
          <span className="mr-2 text-[13px] text-blue-100">Вибрано: {selectedOrders.length}</span>
          <button
            type="button"
            onClick={() => openDialog(selectedOrders, null)}
            className="bg-blue-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-blue-500"
          >
            Змінити статус…
          </button>
          <button
            type="button"
            onClick={() => openDialog(selectedOrders, "CANCELLED")}
            disabled={selectedOrders.some(
              (order) => !order.allowedTransitions.includes("CANCELLED")
            )}
            className="border border-red-500/40 px-3 py-1.5 text-[13px] text-red-200 hover:bg-red-500/10 disabled:opacity-40"
            title="Скасувати обрані з причиною"
          >
            Скасувати…
          </button>
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

      {!data && loading ? (
        <div className="border border-white/10 bg-[#151515] px-5 py-10 text-center text-[13px] text-zinc-500">
          Завантажуємо замовлення…
        </div>
      ) : orders.length === 0 && data ? (
        <div className="border border-white/10 bg-[#151515] px-5 py-12 text-center">
          <Package className="mx-auto h-6 w-6 text-zinc-600" />
          <p className="mt-3 text-[14px] text-zinc-200">
            {urlQuery ? "Нічого не знайдено" : "Тут поки порожньо"}
          </p>
          <p className="mt-1 text-[13px] text-zinc-500">
            {urlQuery
              ? "Перевірте номер чи телефон або пошукайте у вкладці «Усі»."
              : "Замовлення з’являться тут, щойно дійдуть до цього етапу."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <AdminTableShell className={cn("hidden lg:block", loading && "opacity-60")}>
            <table className="w-full table-fixed text-left text-[13px]">
              <colgroup>
                <col className="w-10" />
                <col className="w-[220px]" />
                <col />
                <col className="w-[150px]" />
                <col className="w-[150px]" />
                <col className="w-[136px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-[0.1em] text-zinc-500">
                  <th className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label="Вибрати всі на сторінці"
                      checked={allSelected}
                      onChange={() =>
                        setSelectedIds(allSelected ? [] : orders.map((order) => order.id))
                      }
                      className="accent-blue-600"
                    />
                  </th>
                  <th className="px-3 py-2.5 font-medium">Замовлення · покупець</th>
                  <th className="px-3 py-2.5 font-medium">Товари</th>
                  <th className="px-3 py-2.5 text-right font-medium">Сума</th>
                  <th className="px-3 py-2.5 font-medium">Статус</th>
                  <th className="px-3 py-2.5 font-medium">
                    <span className="sr-only">Дії</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {orders.map((order) => {
                  const next = orderNextStep(order).primary;
                  const staleRow = isStaleOrder(order);
                  const waited = daysSince(order.statusSince);
                  return (
                    <tr
                      key={order.id}
                      onClick={(event) => {
                        if ((event.target as HTMLElement).closest("button,a,input,label")) return;
                        router.push(`/admin/shop/orders/${order.id}`);
                      }}
                      className={cn(
                        "cursor-pointer align-top transition hover:bg-white/[0.03]",
                        selectedIds.includes(order.id) && "bg-blue-500/[0.06]"
                      )}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Вибрати ${order.orderNumber}`}
                          checked={selectedIds.includes(order.id)}
                          onChange={() =>
                            setSelectedIds((current) =>
                              current.includes(order.id)
                                ? current.filter((id) => id !== order.id)
                                : [...current, order.id]
                            )
                          }
                          className="accent-blue-600"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-baseline gap-2">
                          <Link
                            href={`/admin/shop/orders/${order.id}`}
                            className="shrink-0 whitespace-nowrap font-mono text-[13px] font-semibold text-zinc-100 hover:text-blue-300"
                          >
                            {order.orderNumber}
                          </Link>
                          <span className="min-w-0 truncate text-[11px] text-zinc-500">
                            {formatOrderDate(order.createdAt)}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-zinc-200">{order.customerName || "—"}</div>
                        {order.companyName ? (
                          <div className="truncate text-[12px] text-zinc-400">{order.companyName}</div>
                        ) : null}
                        <div className="truncate text-[12px] text-zinc-500">
                          {order.phone || order.email}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="line-clamp-2 leading-5 text-zinc-200">
                          {order.items[0]?.title ?? "Товари не додано"}
                        </div>
                        <div className="mt-0.5 text-[12px] text-zinc-500">
                          {order.itemCount} шт.
                          {order.itemLines > 1 ? ` · ще ${order.itemLines - 1} позиц.` : ""}
                          {order.ttnNumber ? ` · ТТН ${order.ttnNumber}` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="whitespace-nowrap font-semibold text-zinc-100">
                          {formatOrderMoney(order.total, order.currency)}
                        </div>
                        <div className="mt-1 flex justify-end">
                          <AdminStatusBadge tone={paymentTone(order.paymentStatus, order.outstandingAmount)}>
                            {orderPaymentLabel(order.paymentStatus)}
                          </AdminStatusBadge>
                        </div>
                        <div
                          className="mt-1 truncate text-[11px] text-zinc-500"
                          title={orderPaymentMethodLabel(order.paymentMethod)}
                        >
                          {orderPaymentMethodLabel(order.paymentMethod)}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <AdminStatusBadge tone={orderStatusTone(order.status)}>
                          {orderStatusLabel(order.status)}
                        </AdminStatusBadge>
                        {ACTIVE_STATUSES.includes(order.status) ? (
                          <div
                            className={cn(
                              "mt-1.5 text-[12px]",
                              staleRow ? "text-amber-300" : waited >= 3 ? "text-zinc-300" : "text-zinc-500"
                            )}
                          >
                            {waited === 0 ? "з сьогодні" : `${waited} дн. у статусі`}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1" data-row-menu>
                          {next ? (
                            <button
                              type="button"
                              onClick={() => openDialog([order], next.to)}
                              className="whitespace-nowrap border border-blue-500/40 bg-blue-500/10 px-2.5 py-1.5 text-[12px] font-medium text-blue-100 transition hover:bg-blue-500/25"
                            >
                              {ROW_ACTION_LABEL[next.to] ?? next.label}
                            </button>
                          ) : null}
                          <div className="relative">
                            <button
                              type="button"
                              aria-label={`Інші дії з ${order.orderNumber}`}
                              aria-expanded={menuFor === order.id}
                              onClick={() => setMenuFor((current) => (current === order.id ? null : order.id))}
                              className="p-1.5 text-zinc-400 transition hover:bg-white/5 hover:text-white"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {menuFor === order.id ? (
                              <div className="absolute right-0 top-full z-40 mt-1 w-52 border border-white/15 bg-[#121212] py-1 shadow-xl">
                                <Link
                                  href={`/admin/shop/orders/${order.id}`}
                                  className="block px-3 py-2 text-[13px] text-zinc-200 hover:bg-white/5"
                                >
                                  Відкрити замовлення
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => openDialog([order], null)}
                                  className="block w-full px-3 py-2 text-left text-[13px] text-zinc-200 hover:bg-white/5"
                                >
                                  Змінити статус…
                                </button>
                                {order.allowedTransitions.includes("CANCELLED") ? (
                                  <button
                                    type="button"
                                    onClick={() => openDialog([order], "CANCELLED")}
                                    className="block w-full px-3 py-2 text-left text-[13px] text-red-300 hover:bg-red-500/10"
                                  >
                                    Скасувати…
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </AdminTableShell>

          {/* Mobile */}
          <div className={cn("grid gap-2 lg:hidden", loading && "opacity-60")}>
            {orders.map((order) => {
              const next = orderNextStep(order).primary;
              const waited = daysSince(order.statusSince);
              return (
                <div key={order.id} className="border border-white/10 bg-[#151515]">
                  <Link href={`/admin/shop/orders/${order.id}`} className="block px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono text-[13px] font-semibold text-zinc-100">
                          {order.orderNumber}
                        </div>
                        <div className="mt-0.5 truncate text-[13px] text-zinc-300">
                          {order.customerName} {order.phone ? `· ${order.phone}` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="whitespace-nowrap text-[14px] font-semibold text-white">
                          {formatOrderMoney(order.total, order.currency)}
                        </div>
                        <div className="text-[11px] text-zinc-500">{orderPaymentLabel(order.paymentStatus)}</div>
                      </div>
                    </div>
                    <div className="mt-2 line-clamp-1 text-[12px] text-zinc-400">
                      {order.items[0]?.title}
                      {order.itemLines > 1 ? ` + ще ${order.itemLines - 1}` : ""}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <AdminStatusBadge tone={orderStatusTone(order.status)}>
                        {orderStatusLabel(order.status)}
                      </AdminStatusBadge>
                      {ACTIVE_STATUSES.includes(order.status) ? (
                        <span className={cn("text-[12px]", isStaleOrder(order) ? "text-amber-300" : "text-zinc-500")}>
                          {waited === 0 ? "з сьогодні" : `${waited} дн.`}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                  <div className="flex border-t border-white/[0.06]">
                    {next ? (
                      <button
                        type="button"
                        onClick={() => openDialog([order], next.to)}
                        className="flex-1 px-3 py-2.5 text-[13px] font-medium text-blue-200 hover:bg-blue-500/10"
                      >
                        {ROW_ACTION_LABEL[next.to] ?? next.label}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openDialog([order], null)}
                      className="flex-1 border-l border-white/[0.06] px-3 py-2.5 text-[13px] text-zinc-300 hover:bg-white/5"
                    >
                      Статус…
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {data && data.pages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-zinc-400">
              <span>
                {from}–{to} з {total}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => updateUrl({ page: page - 1 > 1 ? String(page - 1) : null })}
                  className={buttonQuiet}
                >
                  <ChevronLeft className="h-4 w-4" /> Попередні
                </button>
                <span className="px-3 tabular-nums">
                  {page} / {data.pages}
                </span>
                <button
                  type="button"
                  disabled={page >= data.pages || loading}
                  onClick={() => updateUrl({ page: String(page + 1) })}
                  className={buttonQuiet}
                >
                  Наступні <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      {dialog ? (
        <OrderStatusDialog
          key={dialog.key}
          open
          orders={dialog.orders}
          target={dialog.target}
          customerEmailsEnabled={Boolean(data?.customerEmailsEnabled)}
          onClose={() => setDialog(null)}
          onDone={(message) => {
            setDialog(null);
            toast.success(message);
            setReloadKey((current) => current + 1);
          }}
        />
      ) : null}
    </AdminPage>
  );
}
