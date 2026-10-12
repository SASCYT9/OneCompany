"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";

import Link from "next/link";
import { Bell, Check, ChevronDown, ChevronRight, Menu, Plus, Search } from "lucide-react";

import type { AdminAttentionItem } from "@/lib/admin/adminAttention";
import type { AdminBreadcrumb } from "@/lib/admin/adminNavigation";
import { useAdminCurrency, type AdminCurrency } from "@/lib/admin/currencyContext";
import { shopUahSaleRate, type ShopPriceBookRates } from "@/lib/shopPriceBookCurrency";
import { cn } from "@/lib/utils";

import type { AdminShellAction } from "./adminShellActions";

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const iconButton =
  "relative flex h-9 w-9 items-center justify-center text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100";
const popoverPanel =
  "absolute right-0 top-full z-50 mt-2 border border-white/[0.08] bg-[#161616] shadow-[0_24px_60px_rgba(0,0,0,0.7)]";

export function AdminTopBar({
  breadcrumbs,
  onOpenMobileNav,
  onOpenPalette,
  shortcutLabel,
  createActions,
  showCurrency,
  attention,
  showBell,
  homeHref,
}: {
  breadcrumbs: AdminBreadcrumb[];
  onOpenMobileNav: () => void;
  onOpenPalette: () => void;
  shortcutLabel: string;
  createActions: AdminShellAction[];
  showCurrency: boolean;
  attention: AdminAttentionItem[];
  showBell: boolean;
  homeHref: string;
}) {
  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-2 border-b border-white/[0.06] bg-[#0A0A0A]/90 px-2 backdrop-blur-xl sm:gap-3 sm:px-5">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Відкрити меню"
        className={cn(iconButton, "lg:hidden")}
      >
        <Menu className="h-5 w-5" />
      </button>

      <nav aria-label="Ви тут" className="hidden min-w-0 shrink items-center md:flex">
        <ol className="flex min-w-0 items-center gap-1.5 text-[13px]">
          {breadcrumbs.map((crumb, index) => {
            const last = index === breadcrumbs.length - 1;
            return (
              <Fragment key={`${crumb.label}-${index}`}>
                {index > 0 ? (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-600" aria-hidden="true" />
                ) : null}
                <li className={cn("min-w-0", last ? "truncate" : "shrink-0")}>
                  {crumb.href && !last ? (
                    <Link
                      href={crumb.href}
                      className="text-zinc-500 transition hover:text-zinc-200"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      className={last ? "font-medium text-zinc-100" : "text-zinc-500"}
                      aria-current={last ? "page" : undefined}
                    >
                      {crumb.label}
                    </span>
                  )}
                </li>
              </Fragment>
            );
          })}
        </ol>
      </nav>

      <div className="flex min-w-0 flex-1 justify-center md:px-4">
        <button
          type="button"
          onClick={onOpenPalette}
          className="group flex h-9 w-full max-w-[460px] items-center gap-2.5 border border-white/[0.08] bg-white/[0.03] px-3 text-left text-[13px] text-zinc-500 transition hover:border-white/[0.16] hover:bg-white/[0.05] hover:text-zinc-300"
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate xl:hidden">Пошук…</span>
          <span className="hidden min-w-0 flex-1 truncate xl:block">
            Пошук замовлень, товарів, клієнтів, сторінок…
          </span>
          <kbd className="hidden shrink-0 border border-white/[0.1] bg-black/40 px-1.5 py-0.5 font-sans text-[10px] font-medium text-zinc-500 sm:inline">
            {shortcutLabel}
          </kbd>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        {createActions.length > 0 ? <CreateMenu actions={createActions} /> : null}
        {showCurrency ? <CurrencyMenu /> : null}
        {showBell ? <AttentionBell items={attention} homeHref={homeHref} /> : null}
      </div>
    </header>
  );
}

function CreateMenu({ actions }: { actions: AdminShellAction[] }) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 items-center gap-1.5 bg-blue-600 px-2.5 text-[13px] font-medium text-white transition hover:bg-blue-500 sm:px-3"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Створити</span>
        <ChevronDown className="hidden h-3.5 w-3.5 opacity-70 sm:block" aria-hidden="true" />
      </button>
      {open ? (
        <div role="menu" className={cn(popoverPanel, "w-72 py-1.5")}>
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                role="menuitem"
                href={action.href}
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 px-3 py-2 transition hover:bg-white/[0.05]"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-zinc-100">
                    {action.label}
                  </span>
                  <span className="block truncate text-[12px] text-zinc-500">
                    {action.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

const CURRENCY_OPTIONS: { value: AdminCurrency; label: string; symbol: string }[] = [
  { value: "UAH", label: "Гривня", symbol: "₴" },
  { value: "EUR", label: "Євро", symbol: "€" },
  { value: "USD", label: "Долар", symbol: "$" },
];

function safeSaleRate(currency: "USD" | "EUR", rates: ShopPriceBookRates) {
  try {
    return shopUahSaleRate(currency, rates).toFixed(2);
  } catch {
    return "—";
  }
}

function CurrencyMenu() {
  const { currency, setCurrency, rates, ratesLoading } = useAdminCurrency();
  const { open, setOpen, ref } = usePopover();
  const [shopRates, setShopRates] = useState<ShopPriceBookRates | null>(null);
  const current = CURRENCY_OPTIONS.find((option) => option.value === currency);

  useEffect(() => {
    if (!open || shopRates) return;
    let cancelled = false;
    fetch("/api/shop/currency-rates", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data?.currencyRates) setShopRates(data.currencyRates);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, shopRates]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Валюта відображення: ${currency}`}
        title="Валюта відображення сум"
        className="flex h-9 items-center gap-1.5 px-2 text-[13px] font-medium text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
      >
        <span className="text-zinc-500">{current?.symbol}</span>
        {currency}
        <ChevronDown className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
      </button>
      {open ? (
        <div role="menu" className={cn(popoverPanel, "w-72")}>
          <div className="px-3 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
            Показувати суми в
          </div>
          <div className="py-1">
            {CURRENCY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={currency === option.value}
                onClick={() => {
                  setCurrency(option.value);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] text-zinc-200 transition hover:bg-white/[0.05]"
              >
                <span className="w-4 text-center text-zinc-500">{option.symbol}</span>
                <span className="flex-1">
                  {option.value} · {option.label}
                </span>
                {currency === option.value ? (
                  <Check className="h-4 w-4 text-blue-400" aria-hidden="true" />
                ) : null}
              </button>
            ))}
          </div>
          <div className="space-y-1.5 border-t border-white/[0.06] px-3 py-2.5 text-[12px] tabular-nums">
            <RateRow
              label="Курс сайту"
              value={
                shopRates
                  ? `1$ = ${safeSaleRate("USD", shopRates)}₴ · 1€ = ${safeSaleRate("EUR", shopRates)}₴`
                  : "Завантаження…"
              }
              strong
            />
            {!ratesLoading && rates.updatedAt ? (
              <RateRow
                label={rates.rateDate ? `НБУ ${rates.rateDate}` : "Базовий курс"}
                value={`1$ = ${rates.USD.toFixed(2)}₴ · 1€ = ${rates.EUR.toFixed(2)}₴`}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RateRow({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={strong ? "text-zinc-300" : "text-zinc-500"}>{label}</span>
      <span className={strong ? "text-zinc-100" : "text-zinc-500"}>{value}</span>
    </div>
  );
}

function AttentionBell({ items, homeHref }: { items: AdminAttentionItem[]; homeHref: string }) {
  const { open, setOpen, ref } = usePopover();
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={total > 0 ? `Потребує уваги: ${total}` : "Сповіщення"}
        className={iconButton}
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
        {total > 0 ? (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-[#0A0A0A] bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
            {total > 99 ? "99+" : total}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className={cn(popoverPanel, "w-[min(360px,calc(100vw-1rem))]")}>
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <span className="text-[13px] font-semibold text-zinc-100">Потребує уваги</span>
            {total > 0 ? (
              <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-300">
                {total}
              </span>
            ) : null}
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-zinc-500">
              Усе спокійно — нових задач немає.
            </div>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto py-1">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-2.5 transition hover:bg-white/[0.04]"
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        item.tone === "red" ? "bg-red-500" : "bg-amber-400"
                      )}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-zinc-100">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-zinc-500">{item.detail}</span>
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-zinc-200">
                      {item.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-white/[0.06] px-4 py-2.5">
            <Link
              href={homeHref}
              onClick={() => setOpen(false)}
              className="block text-center text-[12px] font-medium text-blue-400 hover:text-blue-300"
            >
              Відкрити робочий стіл
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
