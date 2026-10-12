"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  ArrowRight,
  Clock3,
  CornerDownLeft,
  Loader2,
  Package,
  Search,
  ShoppingBag,
  User,
  type LucideIcon,
} from "lucide-react";

import type { AdminNavItemDefinition } from "@/lib/admin/adminNavigation";
import { cn } from "@/lib/utils";

import type { AdminShellAction } from "./adminShellActions";
import { ADMIN_NAV_ICONS } from "./adminShellIcons";

type NavItem = AdminNavItemDefinition & { sectionLabel: string };

type GlobalSearchResponse = {
  total: number;
  results: {
    orders: Array<{
      id: string;
      orderNumber: string;
      customerName: string;
      status: string;
      paymentStatus: string;
      outstandingAmount: number;
      currency: string;
    }>;
    products: Array<{
      id: string;
      slug: string;
      sku: string | null;
      brand: string | null;
      titleUa: string;
      titleEn: string;
      status: string;
    }>;
    customers: Array<{
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      companyName: string | null;
      group: string;
    }>;
  };
};

type PaletteEntry = {
  key: string;
  group: string;
  href: string;
  title: string;
  meta?: string;
  badge?: string;
  icon: LucideIcon;
};

function normalize(value: string) {
  return value.toLocaleLowerCase("uk-UA").replace(/[’'`]/g, "").trim();
}

function matches(needle: string, ...haystack: Array<string | undefined>) {
  const words = normalize(needle).split(/\s+/).filter(Boolean);
  const text = normalize(haystack.filter(Boolean).join(" "));
  return words.every((word) => text.includes(word));
}

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("uk-UA", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(value)} ${currency}`;
  }
}

export function AdminCommandPalette({
  open,
  onClose,
  onNavigate,
  navItems,
  actions,
  recent,
  canSearchEntities,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (href: string) => void;
  navItems: NavItem[];
  actions: AdminShellAction[];
  recent: string[];
  canSearchEntities: boolean;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [search, setSearch] = useState<GlobalSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const trimmed = query.trim();

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSearch(null);
    setActiveIndex(0);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = original;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !canSearchEntities || trimmed.length < 2) {
      setSearch(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/admin/search?q=${encodeURIComponent(trimmed)}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: GlobalSearchResponse | null) => setSearch(data))
        .catch((error) => {
          if ((error as Error).name !== "AbortError") setSearch(null);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [canSearchEntities, open, trimmed]);

  const entries = useMemo<PaletteEntry[]>(() => {
    const navEntry = (item: NavItem, group: string): PaletteEntry => ({
      key: `${group}:${item.href}`,
      group,
      href: item.href,
      title: item.label,
      meta: item.sectionLabel,
      icon: ADMIN_NAV_ICONS[item.icon],
    });
    const actionEntry = (action: AdminShellAction): PaletteEntry => ({
      key: `action:${action.href}`,
      group: "Створити",
      href: action.href,
      title: action.label,
      meta: action.description,
      icon: action.icon,
    });

    if (!trimmed) {
      const recentItems = recent
        .map((href) => navItems.find((item) => item.href === href))
        .filter((item): item is NavItem => Boolean(item))
        .map((item) => ({ ...navEntry(item, "Нещодавні"), icon: Clock3 }));
      return [
        ...recentItems,
        ...actions.slice(0, 4).map(actionEntry),
        ...navItems
          .filter((item) => !recent.includes(item.href))
          .slice(0, 8)
          .map((item) => navEntry(item, "Розділи")),
      ];
    }

    const result: PaletteEntry[] = [];
    if (search) {
      for (const order of search.results.orders) {
        result.push({
          key: `order:${order.id}`,
          group: "Замовлення",
          href: `/admin/shop/orders/${order.id}`,
          title: `${order.orderNumber} · ${order.customerName}`,
          meta:
            order.outstandingAmount > 0
              ? `Борг ${money(order.outstandingAmount, order.currency)}`
              : order.paymentStatus,
          badge: order.status.replace(/_/g, " "),
          icon: Package,
        });
      }
      for (const product of search.results.products) {
        result.push({
          key: `product:${product.id}`,
          group: "Товари",
          href: `/admin/shop/${product.id}`,
          title: product.titleUa || product.titleEn,
          meta: [product.brand, product.sku || product.slug].filter(Boolean).join(" · "),
          badge: product.status,
          icon: ShoppingBag,
        });
      }
      for (const customer of search.results.customers) {
        result.push({
          key: `customer:${customer.id}`,
          group: "Клієнти",
          href: `/admin/shop/customers/${customer.id}`,
          title: `${customer.firstName} ${customer.lastName}`.trim() || customer.email,
          meta: [customer.companyName, customer.email].filter(Boolean).join(" · "),
          badge: customer.group.replace(/_/g, " "),
          icon: User,
        });
      }
    }
    result.push(
      ...navItems
        .filter((item) => matches(trimmed, item.label, item.description, item.sectionLabel))
        .slice(0, 8)
        .map((item) => navEntry(item, "Сторінки"))
    );
    result.push(
      ...actions
        .filter((action) => matches(trimmed, action.label, action.description, action.keywords))
        .map(actionEntry)
    );
    return result;
  }, [actions, navItems, recent, search, trimmed]);

  useEffect(() => setActiveIndex(0), [trimmed, search]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-palette-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (entries.length ? (index + 1) % entries.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        entries.length ? (index - 1 + entries.length) % entries.length : 0
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const entry = entries[activeIndex];
      if (entry) onNavigate(entry.href);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  const groups: Array<{ name: string; items: Array<PaletteEntry & { index: number }> }> = [];
  entries.forEach((entry, index) => {
    const group = groups.find((candidate) => candidate.name === entry.group);
    if (group) group.items.push({ ...entry, index });
    else groups.push({ name: entry.group, items: [{ ...entry, index }] });
  });

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-black/70 px-3 pt-[10vh] backdrop-blur-xs"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Пошук і команди"
    >
      <div
        className="flex max-h-[72vh] w-full max-w-[640px] flex-col border border-white/[0.1] bg-[#141414] shadow-[0_40px_120px_rgba(0,0,0,0.8)]"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4">
          {loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-400" aria-hidden="true" />
          ) : (
            <Search className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              canSearchEntities
                ? "Номер замовлення, SKU, назва товару, email клієнта або сторінка…"
                : "Назва сторінки або дії…"
            }
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-zinc-100 placeholder:text-zinc-500 focus:outline-hidden"
            role="combobox"
            aria-expanded="true"
            aria-controls="admin-palette-results"
            aria-activedescendant={entries[activeIndex] ? `palette-${activeIndex}` : undefined}
          />
          <kbd className="shrink-0 border border-white/[0.1] px-1.5 py-0.5 font-sans text-[10px] text-zinc-500">
            Esc
          </kbd>
        </div>

        <div
          ref={listRef}
          id="admin-palette-results"
          role="listbox"
          className="min-h-0 flex-1 overflow-y-auto py-2"
        >
          {groups.length === 0 ? (
            <div className="px-4 py-10 text-center text-[13px] text-zinc-500">
              {loading
                ? "Шукаємо…"
                : trimmed.length < 2 && canSearchEntities
                  ? "Введіть щонайменше 2 символи."
                  : "Нічого не знайдено. Спробуйте номер замовлення, SKU або email."}
            </div>
          ) : (
            groups.map((group) => (
              <PaletteGroup key={group.name} title={group.name}>
                {group.items.map((entry) => {
                  const Icon = entry.icon;
                  const active = entry.index === activeIndex;
                  return (
                    <button
                      key={entry.key}
                      id={`palette-${entry.index}`}
                      data-palette-index={entry.index}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseMove={() => setActiveIndex(entry.index)}
                      onClick={() => onNavigate(entry.href)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2 text-left transition-colors",
                        active ? "bg-blue-600/15" : "hover:bg-white/[0.03]"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center border",
                          active
                            ? "border-blue-500/40 text-blue-300"
                            : "border-white/[0.07] text-zinc-500"
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block truncate text-[13px] font-medium",
                            active ? "text-white" : "text-zinc-200"
                          )}
                        >
                          {entry.title}
                        </span>
                        {entry.meta ? (
                          <span className="block truncate text-[12px] text-zinc-500">
                            {entry.meta}
                          </span>
                        ) : null}
                      </span>
                      {entry.badge ? (
                        <span className="shrink-0 border border-white/[0.08] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                          {entry.badge}
                        </span>
                      ) : null}
                      {active ? (
                        <ArrowRight className="h-4 w-4 shrink-0 text-blue-300" aria-hidden="true" />
                      ) : null}
                    </button>
                  );
                })}
              </PaletteGroup>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-white/[0.07] px-4 py-2 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> вибір
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>
              <CornerDownLeft className="h-3 w-3" aria-hidden="true" />
            </Kbd>
            відкрити
          </span>
          <span className="ml-auto hidden sm:inline">
            Шукає замовлення, товари, клієнтів і розділи адмінки
          </span>
        </div>
      </div>
    </div>
  );
}

function PaletteGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pb-1">
      <div className="px-4 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
        {title}
      </div>
      {children}
    </section>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center border border-white/[0.1] px-1 font-sans text-[10px] text-zinc-400">
      {children}
    </kbd>
  );
}
