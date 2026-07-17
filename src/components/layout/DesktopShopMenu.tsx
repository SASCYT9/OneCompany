"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ChevronDown,
  LayoutGrid,
  SlidersHorizontal,
  Tags,
  UserRound,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  getShopNavigationDestinations,
  type ShopNavigationDestinationKey,
} from "@/lib/shopNavigation";

type DesktopShopMenuProps = {
  locale: string;
  label: string;
  isActive: boolean;
  activeDestination: ShopNavigationDestinationKey | null;
  brandCatalog?: {
    href: string;
    label: string;
  } | null;
};

const DESTINATION_ICONS = {
  brands: Tags,
  catalog: LayoutGrid,
  selection: SlidersHorizontal,
} as const;

export function DesktopShopMenu({
  locale,
  label,
  isActive,
  activeDestination,
  brandCatalog,
}: DesktopShopMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const isUa = locale === "ua";
  const copy = {
    brands: {
      title: isUa ? "Бренди" : "Brands",
      description: isUa ? "Усі в одному магазині" : "All in one shop",
    },
    catalog: {
      title: isUa ? "Каталог товарів" : "Product catalog",
      description: isUa ? "Усі товари в одному пошуку" : "All products in one search",
    },
    selection: {
      title: isUa ? "Підбір за авто / мото" : "Vehicle finder",
      description: isUa ? "Допомога з вибором і сумісністю" : "Help with fitment and selection",
    },
  } as const;

  return (
    <div
      ref={menuRootRef}
      className="relative"
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => {
        if (!menuRootRef.current?.contains(document.activeElement)) setOpen(false);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          const trigger = triggerRef.current;
          const shouldMoveFocus = Boolean(trigger && document.activeElement !== trigger);
          setOpen(false);
          if (shouldMoveFocus) trigger?.focus();
        }
      }}
    >
      <div className="relative inline-flex items-center">
        <Link
          href={`/${locale}/shop`}
          className={cn(
            "whitespace-nowrap font-display text-xs uppercase tracking-[0.15em] text-foreground/60 transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/55 md:text-[13px] md:tracking-[0.2em]",
            isActive && "text-foreground"
          )}
        >
          {label}
        </Link>
        <button
          ref={triggerRef}
          type="button"
          aria-label={
            isUa
              ? open
                ? "Закрити меню магазину"
                : "Відкрити меню магазину"
              : open
                ? "Close shop menu"
                : "Open shop menu"
          }
          aria-expanded={open}
          aria-controls="desktop-shop-navigation"
          onClick={() => setOpen((current) => !current)}
          className="ml-0.5 inline-flex h-8 w-6 items-center justify-center text-foreground/55 transition hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/55"
        >
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
            strokeWidth={1.7}
            aria-hidden="true"
          />
        </button>
        {isActive ? (
          <motion.span
            layoutId="nav-active"
            className="absolute -bottom-2 left-0 block h-px w-full bg-linear-to-r from-primary via-primary/60 to-transparent"
          />
        ) : null}
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            id="desktop-shop-navigation"
            initial={{ opacity: 0, y: -8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.99 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute left-1/2 top-full w-[410px] -translate-x-1/2 pt-4"
          >
            <nav
              aria-label={isUa ? "Навігація магазину" : "Shop navigation"}
              className="overflow-hidden rounded-[24px] border border-foreground/12 bg-card p-2 text-foreground shadow-[0_24px_70px_rgba(0,0,0,0.18)] dark:border-white/10 dark:bg-[#080808] dark:shadow-[0_28px_80px_rgba(0,0,0,0.55)]"
            >
              {brandCatalog ? (
                <div className="mb-2 border-b border-foreground/10 px-1 pb-2">
                  <p className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.25em] text-foreground/40">
                    {isUa ? "Поточний бренд" : "Current brand"}
                  </p>
                  <Link
                    href={brandCatalog.href}
                    onClick={() => setOpen(false)}
                    className="group flex min-h-[52px] items-center justify-between gap-3 rounded-2xl bg-foreground/[0.055] px-4 py-3 transition hover:bg-foreground/[0.10] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/55"
                  >
                    <span className="font-display text-[11px] font-semibold uppercase tracking-[0.16em]">
                      {brandCatalog.label}
                    </span>
                    <ArrowRight
                      className="h-4 w-4 text-foreground/45 transition-transform group-hover:translate-x-0.5"
                      strokeWidth={1.7}
                      aria-hidden="true"
                    />
                  </Link>
                </div>
              ) : null}

              <div className="space-y-1">
                {getShopNavigationDestinations(locale).map((destination) => {
                  const Icon = DESTINATION_ICONS[destination.key];
                  const selected = destination.key === activeDestination;

                  return (
                    <Link
                      key={destination.key}
                      href={destination.href}
                      prefetch={destination.key === "catalog" ? false : undefined}
                      aria-current={selected ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "group flex min-h-[64px] items-center gap-3 rounded-[18px] px-3 py-2.5 transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/55",
                        selected ? "bg-foreground/[0.09]" : "hover:bg-foreground/[0.055]"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
                          destination.key === "catalog"
                            ? "border-primary/25 bg-primary/10 text-primary"
                            : "border-foreground/12 bg-foreground/[0.035] text-foreground/70"
                        )}
                      >
                        <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-[11px] font-semibold uppercase tracking-[0.16em]">
                          {copy[destination.key].title}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-foreground/50">
                          {copy[destination.key].description}
                        </span>
                      </span>
                      <ArrowRight
                        className="h-4 w-4 shrink-0 text-foreground/35 transition-transform group-hover:translate-x-0.5"
                        strokeWidth={1.7}
                        aria-hidden="true"
                      />
                    </Link>
                  );
                })}
              </div>

              <div className="mt-2 border-t border-foreground/10 pt-2">
                <Link
                  href={`/${locale}/shop/account`}
                  onClick={() => setOpen(false)}
                  className="flex min-h-[44px] items-center gap-3 rounded-2xl px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/55 transition hover:bg-foreground/[0.05] hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/55"
                >
                  <UserRound className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
                  {isUa ? "Акаунт" : "Account"}
                </Link>
              </div>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
