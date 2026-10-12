"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Check,
  FilePlus2,
  Package,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";

import { AdminPage, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import {
  dashboardTrend,
  type DashboardOverview,
} from "@/lib/admin/dashboardOverview";
import { orderStatusLabel, orderStatusTone } from "@/lib/admin/orderWorkflow";
import { orderPaymentLabel } from "@/lib/shopOrderPresentation";
import { cn } from "@/lib/utils";

const UAH = new Intl.NumberFormat("uk-UA", {
  style: "currency",
  currency: "UAH",
  maximumFractionDigits: 0,
});

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("uk-UA", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "UAH" ? 0 : 2,
    }).format(value);
  } catch {
    return `${value.toLocaleString("uk-UA")} ${currency}`;
  }
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Kyiv",
  }).format(new Date(value));
}

function Trend({ current, previous }: { current: number; previous: number }) {
  const trend = dashboardTrend(current, previous);
  if (trend === null) return <span className="text-zinc-500">немає з чим порівняти</span>;
  return (
    <span className={trend >= 0 ? "text-emerald-300" : "text-red-300"}>
      {trend >= 0 ? "+" : ""}
      {trend}% до попередніх 30 днів
    </span>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/dashboard?view=overview", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Сесія завершилася. Оновіть сторінку та увійдіть знову."
            : response.status === 403
              ? "Немає доступу до огляду."
              : "Не вдалося оновити дані. Спробуйте ще раз."
        );
      const payload: DashboardOverview = await response.json();
      if (!controller.signal.aborted) setData(payload);
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(reason instanceof Error ? reason.message : "Помилка завантаження.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 120_000);
    return () => {
      window.clearInterval(timer);
      requestRef.current?.abort();
    };
  }, [refresh]);

  const attention = data?.attention;
  const tasks = attention
    ? [
        {
          label: "Нові замовлення",
          hint: "Перевірити й підтвердити",
          value: attention.newOrders,
          href: "/admin/shop/orders?tab=new",
        },
        {
          label: "Чекають оплату",
          hint: "Нагадати клієнту або дати посилання",
          value: attention.awaitingPayment,
          href: "/admin/shop/orders?tab=payment",
        },
        {
          label: "Зібрати й відправити",
          hint: "Підтверджені та в обробці",
          value: attention.toFulfil,
          href:
            attention.confirmed > 0
              ? "/admin/shop/orders?tab=confirmed"
              : "/admin/shop/orders?tab=processing",
        },
        {
          label: "В дорозі",
          hint: "Закрити, коли клієнт отримає",
          value: attention.inTransit,
          href: "/admin/shop/orders?tab=shipped",
        },
        {
          label: "Заявки B2B",
          hint: "Вирішити щодо оптових цін",
          value: attention.b2bPending,
          href: "/admin/shop/customers?tab=pending",
        },
        {
          label: "Запити на повернення",
          hint: "Погодити або відхилити",
          value: attention.returnsOpen,
          href: "/admin/shop/returns",
        },
      ]
    : [];
  const totalTasks = tasks.reduce((sum, task) => sum + task.value, 0);
  const moneyData = data?.money;
  const maxDay = Math.max(1, ...(moneyData?.daily.map((day) => day.ordered) ?? [1]));
  const otherCurrencies = moneyData?.byCurrency.filter((entry) => entry.currency !== "UAH") ?? [];

  return (
    <AdminPage wide className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-400">
            Огляд
          </div>
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-white">Робочий стіл</h1>
          <p className="mt-1 text-[13px] text-zinc-400" aria-live="polite">
            {data
              ? `${new Intl.DateTimeFormat("uk-UA", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Kyiv" }).format(new Date(data.updatedAt))} · оновлено о ${new Date(data.updatedAt).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kyiv" })}`
              : loading
                ? "Завантажуємо огляд…"
                : "Огляд недоступний"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            aria-label="Оновити огляд"
            className="inline-flex items-center justify-center border border-white/15 px-3 py-2 text-zinc-300 transition hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
          <Link
            href="/admin/shop/orders/new"
            className="inline-flex items-center gap-2 bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" /> Нове замовлення
          </Link>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 border-l-2 border-red-400 bg-red-500/[0.08] px-4 py-3 text-[13px] text-red-100"
        >
          <AlertCircle className="h-4 w-4" />
          <span className="flex-1">
            {error}
            {data ? " Нижче — останні завантажені дані." : ""}
          </span>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="border border-red-300/30 px-3 py-1 text-[12px] hover:bg-red-500/10"
          >
            Повторити
          </button>
        </div>
      ) : null}

      <section aria-labelledby="tasks-heading">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="tasks-heading" className="text-[15px] font-semibold text-white">
            Що зробити зараз
          </h2>
          <span className="text-[12px] text-zinc-500">
            {data ? (totalTasks ? `${totalTasks} справ у роботі` : "Усе опрацьовано") : ""}
          </span>
        </div>
        {attention && attention.stale > 0 ? (
          <Link
            href="/admin/shop/orders?stale=1"
            className="mb-3 flex items-center gap-3 border-l-2 border-amber-400 bg-amber-400/[0.07] px-4 py-3 text-[13px] text-amber-100 transition hover:bg-amber-400/[0.12]"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              <strong className="font-semibold">{attention.stale} замовл.</strong> висять у «На
              перевірці» чи «Очікує оплату» понад 30 днів — закрийте або скасуйте їх.
            </span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </Link>
        ) : null}
        <div className="grid grid-cols-2 gap-px border border-white/10 bg-white/10 md:grid-cols-3 xl:grid-cols-6">
          {(tasks.length ? tasks : Array.from({ length: 6 }, () => null)).map((task, index) =>
            task ? (
              <Link
                key={task.label}
                href={task.href}
                className={cn(
                  "group relative flex min-h-[112px] flex-col justify-between bg-[#141414] px-4 py-3.5 transition hover:bg-[#1b1b1b]",
                  task.value > 0 && "bg-[#151a22]"
                )}
              >
                {task.value > 0 ? (
                  <span className="absolute inset-y-0 left-0 w-[3px] bg-blue-500" />
                ) : null}
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      "text-[13px] leading-5",
                      task.value > 0 ? "font-medium text-zinc-100" : "text-zinc-500"
                    )}
                  >
                    {task.label}
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-600 transition group-hover:text-white" />
                </div>
                <div>
                  <div
                    className={cn(
                      "text-[30px] font-semibold leading-none tabular-nums",
                      task.value > 0 ? "text-white" : "text-zinc-600"
                    )}
                  >
                    {task.value}
                  </div>
                  <div className="mt-1.5 text-[11px] leading-4 text-zinc-500">
                    {task.value > 0 ? task.hint : "Немає"}
                  </div>
                </div>
              </Link>
            ) : (
              <div key={index} className="min-h-[112px] bg-[#141414] motion-safe:animate-pulse" />
            )
          )}
        </div>
      </section>

      <section aria-labelledby="money-heading" className="border border-white/10 bg-[#141414]">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 px-5 py-3.5">
          <h2 id="money-heading" className="text-[15px] font-semibold text-white">
            Продажі за 30 днів
          </h2>
          <span className="text-[12px] text-zinc-500">
            у гривнях за курсом магазину · без скасованих
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-px bg-white/[0.06] lg:grid-cols-4">
          {[
            {
              label: "Замовлено на суму",
              value: moneyData ? UAH.format(moneyData.current.ordered) : "—",
              sub: moneyData ? (
                <Trend current={moneyData.current.ordered} previous={moneyData.previous.ordered} />
              ) : null,
            },
            {
              label: "З них оплачено",
              value: moneyData ? UAH.format(moneyData.current.paid) : "—",
              sub:
                moneyData && moneyData.current.ordered > 0
                  ? `${Math.round((moneyData.current.paid / moneyData.current.ordered) * 100)}% від замовленого`
                  : null,
            },
            {
              label: "Замовлень",
              value: moneyData ? String(moneyData.current.orders) : "—",
              sub: moneyData ? (
                <Trend current={moneyData.current.orders} previous={moneyData.previous.orders} />
              ) : null,
            },
            {
              label: "Середній чек",
              value: moneyData ? UAH.format(moneyData.current.averageOrder) : "—",
              sub: null,
            },
          ].map((metric) => (
            <div key={metric.label} className="bg-[#141414] px-5 py-4">
              <dt className="text-[11px] uppercase tracking-[0.1em] text-zinc-500">{metric.label}</dt>
              <dd className="mt-1.5 text-[22px] font-semibold tabular-nums text-white">{metric.value}</dd>
              {metric.sub ? <dd className="mt-1 text-[12px]">{metric.sub}</dd> : null}
            </div>
          ))}
        </dl>

        <div className="px-5 pb-4 pt-5">
          {moneyData ? (
            <>
              <div
                className="flex h-28 items-end gap-[3px]"
                role="img"
                aria-label="Сума замовлень по днях за останні 30 днів"
              >
                {moneyData.daily.map((day) => {
                  const height = (day.ordered / maxDay) * 100;
                  const paidShare = day.ordered > 0 ? (day.paid / day.ordered) * 100 : 0;
                  return (
                    <div
                      key={day.date}
                      className="group relative flex h-full flex-1 flex-col justify-end"
                      title={`${shortDate(day.date)}: ${day.orders} замовл. на ${UAH.format(day.ordered)}, оплачено ${UAH.format(day.paid)}`}
                    >
                      <div
                        className={cn(
                          "relative w-full bg-blue-500/30 transition group-hover:bg-blue-400/50",
                          day.orders === 0 && "bg-white/[0.06]"
                        )}
                        style={{ height: day.orders ? `${Math.max(height, 4)}%` : "2px" }}
                      >
                        <div
                          className="absolute inset-x-0 bottom-0 bg-blue-500"
                          style={{ height: `${paidShare}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-zinc-500">
                <span>{shortDate(moneyData.daily[0]?.date ?? data!.windowStart)}</span>
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 bg-blue-500" /> оплачено
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 bg-blue-500/30" /> замовлено
                  </span>
                </span>
                <span>сьогодні</span>
              </div>
            </>
          ) : (
            <div className="h-28 bg-white/[0.03] motion-safe:animate-pulse" />
          )}
        </div>

        {moneyData ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-3 text-[12px] text-zinc-400">
            <span>
              {otherCurrencies.length
                ? `Включно з ${otherCurrencies
                    .map((entry) => `${entry.orders} замовл. у ${entry.currency} (${money(entry.ordered, entry.currency)})`)
                    .join(", ")}.`
                : "Усі замовлення в гривнях."}
              {moneyData.unconverted.length
                ? ` Без перерахунку: ${moneyData.unconverted.join(", ")}.`
                : ""}
            </span>
            {moneyData.outstanding > 0 ? (
              <Link
                href="/admin/shop/orders?tab=payment"
                className="inline-flex items-center gap-1.5 text-amber-200 hover:text-amber-100"
              >
                Ще не оплачено по відкритих замовленнях:{" "}
                <strong className="font-semibold">{UAH.format(moneyData.outstanding)}</strong>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="orders-heading" className="min-w-0 border border-white/10 bg-[#141414]">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5">
            <h2 id="orders-heading" className="text-[15px] font-semibold text-white">
              Останні замовлення
            </h2>
            <Link
              href="/admin/shop/orders?tab=all"
              className="inline-flex items-center gap-1 text-[12px] text-zinc-400 hover:text-white"
            >
              Усі <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {!data ? (
            <div className="px-5 py-8 text-[13px] text-zinc-500">
              {loading ? "Завантажуємо замовлення…" : "Замовлення недоступні"}
            </div>
          ) : data.orders.recent.length === 0 ? (
            <div className="px-5 py-8 text-[13px] text-zinc-500">Замовлень ще немає.</div>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {data.orders.recent.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/shop/orders/${order.id}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-5 py-3 transition hover:bg-white/[0.03] sm:grid-cols-[minmax(0,1fr)_130px_150px]"
                  >
                    <span className="min-w-0">
                      <span className="flex items-baseline gap-2">
                        <span className="font-mono text-[13px] font-semibold text-zinc-100">
                          {order.number}
                        </span>
                        <span className="text-[11px] text-zinc-500">{shortDate(order.createdAt)}</span>
                      </span>
                      <span className="block truncate text-[13px] text-zinc-400">
                        {order.customer || "Клієнт без імені"} · {order.itemCount} поз.
                      </span>
                    </span>
                    <span className="hidden sm:block">
                      <AdminStatusBadge tone={orderStatusTone(order.status)}>
                        {orderStatusLabel(order.status)}
                      </AdminStatusBadge>
                    </span>
                    <span className="text-right">
                      <span className="block whitespace-nowrap text-[14px] font-semibold text-white">
                        {money(order.total, order.currency)}
                      </span>
                      <span className="block text-[11px] text-zinc-500">
                        {orderPaymentLabel(order.paymentStatus)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="min-w-0 space-y-6">
          <section aria-labelledby="b2b-heading" className="border border-white/10 bg-[#141414]">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5">
              <h2 id="b2b-heading" className="text-[15px] font-semibold text-white">
                Заявки B2B
              </h2>
              <span className="bg-white/[0.06] px-2 py-0.5 text-[12px] tabular-nums text-zinc-300">
                {data ? data.customers.pendingCount : "—"}
              </span>
            </div>
            {!data ? (
              <p className="px-5 py-6 text-[13px] text-zinc-500">{loading ? "Завантаження…" : "—"}</p>
            ) : data.customers.pending.length === 0 ? (
              <p className="flex items-center gap-2 px-5 py-6 text-[13px] text-zinc-500">
                <Check className="h-4 w-4 text-emerald-400" /> Нових заявок немає
              </p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {data.customers.pending.map((customer) => (
                  <li key={customer.id}>
                    <Link
                      href={`/admin/shop/customers/${customer.id}`}
                      className="flex items-center gap-3 px-5 py-3 transition hover:bg-white/[0.03]"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-amber-400/15 text-[13px] font-semibold text-amber-200">
                        {(customer.company || customer.name || "B").slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-zinc-100">
                          {customer.company || customer.name}
                        </span>
                        <span className="block text-[11px] text-zinc-500">
                          {customer.company ? `${customer.name} · ` : ""}заявка від{" "}
                          {shortDate(customer.createdAt)}
                        </span>
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-zinc-500" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="catalog-heading" className="border border-white/10 bg-[#141414]">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5">
              <h2 id="catalog-heading" className="text-[15px] font-semibold text-white">
                Каталог
              </h2>
              <Link
                href="/admin/shop"
                className="inline-flex items-center gap-1 text-[12px] text-zinc-400 hover:text-white"
              >
                Товари <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <dl className="grid grid-cols-2 gap-px bg-white/[0.06]">
              <div className="bg-[#141414] px-5 py-3">
                <dt className="text-[11px] uppercase tracking-[0.1em] text-zinc-500">На сайті</dt>
                <dd className="mt-1 text-[20px] font-semibold tabular-nums text-white">
                  {data ? data.catalog.published.toLocaleString("uk-UA") : "—"}
                </dd>
              </div>
              <div className="bg-[#141414] px-5 py-3">
                <dt className="text-[11px] uppercase tracking-[0.1em] text-zinc-500">Приховано</dt>
                <dd className="mt-1 text-[20px] font-semibold tabular-nums text-zinc-300">
                  {data ? data.catalog.unpublished.toLocaleString("uk-UA") : "—"}
                </dd>
              </div>
            </dl>
            <ul className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
              {data?.catalog.recent.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/admin/shop/${product.id}`}
                    className="flex items-center gap-3 px-5 py-2.5 transition hover:bg-white/[0.03]"
                  >
                    <Package className="h-4 w-4 shrink-0 text-zinc-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-zinc-200">{product.title}</span>
                      <span className="block text-[11px] text-zinc-500">
                        {product.brand || "Без бренду"} · змінено {shortDate(product.updatedAt)}
                        {product.published ? "" : " · приховано"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Швидкі дії" className="grid gap-px border border-white/10 bg-white/10">
            {[
              { title: "Додати товар", href: "/admin/shop/new", icon: Plus },
              { title: "Створити проформу", href: "/admin/shop/drafts/new", icon: FilePlus2 },
              { title: "Клієнти", href: "/admin/shop/customers", icon: Users },
            ].map(({ title, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 bg-[#141414] px-5 py-3 text-[13px] text-zinc-200 transition hover:bg-[#1b1b1b]"
              >
                <Icon className="h-4 w-4 text-zinc-500" />
                <span className="flex-1">{title}</span>
                <ArrowRight className="h-4 w-4 text-zinc-600" />
              </Link>
            ))}
          </section>
        </aside>
      </div>
    </AdminPage>
  );
}
