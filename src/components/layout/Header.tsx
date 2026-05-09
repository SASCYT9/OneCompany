"use client";

import Link from "next/link";
import { useParams, usePathname, useSelectedLayoutSegments } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { Menu, X } from "lucide-react";
import { CartIconLink } from "./CartIconLink";
import { useShopCurrency } from "@/components/shop/CurrencyContext";

const navItems = [
  { key: "automotive", href: "/auto" },
  { key: "moto", href: "/moto" },
  { key: "shop", href: "/shop" },
  { key: "blog", href: "/blog" },
  { key: "contact", href: "/contact" },
];

export function Header() {
  const params = useParams();
  const pathname = usePathname();
  const segments = useSelectedLayoutSegments();
  const locale = (params?.locale as string) || "en";
  const isUa = locale === "ua";
  const tNav = useTranslations("nav");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isShopRoute = segments[0] === "shop";

  const currentBrand = segments[1];
  const isBrandPortal =
    currentBrand && !["stock", "account", "cart", "checkout"].includes(currentBrand);

  const formatBrandName = (brand: string) => {
    if (brand.toLowerCase() === "do88") return "do88";
    if (brand.toLowerCase() === "vf-engineering") return "VF Engineering";
    if (brand.toLowerCase() === "kw-suspension") return "KW Suspension";
    if (brand.toLowerCase() === "burger") return "Burger Motorsports";
    if (brand.toLowerCase() === "racechip") return "RaceChip";
    if (brand.toLowerCase() === "akrapovic") return "Akrapovič";
    if (brand.toLowerCase() === "csf") return "CSF Racing";
    if (brand.toLowerCase() === "ohlins") return "Öhlins";
    if (brand.toLowerCase() === "girodisc") return "GiroDisc";
    if (brand.toLowerCase() === "ipe") return "iPE Exhaust";
    return brand
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  const { data: sessionData } = useSession();
  const isB2bApproved = sessionData?.user?.group === "B2B_APPROVED";

  const shopNavItems = [
    {
      key: "home",
      href: `/${locale}`,
      label: isUa ? "Головна" : "Home",
    },
    {
      key: "stores",
      href: `/${locale}/shop`,
      label: isUa ? "Магазини" : "Stores",
    },
    ...(isBrandPortal
      ? [
          {
            key: "brand-catalog",
            href:
              currentBrand === "racechip"
                ? `/${locale}/shop/racechip/catalog`
                : currentBrand === "girodisc"
                  ? `/${locale}/shop/girodisc/catalog`
                  : ["brabus", "burger", "urban"].includes(currentBrand)
                    ? `/${locale}/shop/${currentBrand}/products`
                    : ["do88", "akrapovic", "adro", "csf", "ipe"].includes(currentBrand)
                      ? `/${locale}/shop/${currentBrand}/collections`
                      : `/${locale}/shop/${currentBrand}#catalog`,
            label: isUa
              ? `Каталог ${formatBrandName(currentBrand)}`
              : `${formatBrandName(currentBrand)} Catalog`,
          },
        ]
      : []),
    ...(isB2bApproved
      ? [
          {
            key: "stock",
            href: `/${locale}/shop/stock`,
            label: isUa
              ? isBrandPortal
                ? "B2B Склад"
                : "B2B Каталог"
              : isBrandPortal
                ? "B2B Stock"
                : "B2B Catalog",
          },
        ]
      : []),
    {
      key: "account",
      href: `/${locale}/shop/account`,
      label: isUa ? "Акаунт" : "Account",
    },
  ];

  const renderedNavItems = isShopRoute
    ? shopNavItems
    : navItems.map((item) => ({
        key: item.key,
        href: `/${locale}${item.href}`,
        label: tNav(item.key),
      }));
  const logoHref = `/${locale}`;
  const { region, setRegion } = useShopCurrency();

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only absolute top-2 left-2 z-50 rounded-md bg-card/90 px-3 py-2 text-sm text-card-foreground"
      >
        Skip to content
      </a>
      <header className="fixed top-0 left-0 right-0 z-50 px-3 pt-2 sm:px-4 sm:pt-4">
        <div
          className={cn(
            "relative mx-auto flex w-full items-center rounded-2xl border backdrop-blur-3xl px-3 py-2.5 sm:rounded-[32px] sm:px-4 sm:py-3 md:px-8",
            isShopRoute
              ? "max-w-7xl border-obsidian-border bg-obsidian-panel/80 shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
              : "max-w-6xl border-obsidian-border bg-obsidian/80 shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
          )}
        >
          <Link
            href={logoHref}
            suppressHydrationWarning
            className="absolute left-1/2 -translate-x-1/2 md:relative md:left-auto md:translate-x-0 z-10 inline-flex items-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-foreground/40"
            aria-label="ONE COMPANY home"
          >
            <Logo className="w-20 sm:w-28 md:w-32" priority tone="auto" size="compact" />
            <span className="absolute -bottom-1 left-0 h-px w-8 bg-linear-to-r from-foreground to-transparent sm:-bottom-2 sm:w-10" />
          </Link>
          <nav className="ml-6 hidden flex-1 items-center gap-3 md:ml-8 md:gap-5 lg:flex">
            {renderedNavItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  suppressHydrationWarning
                  className={cn(
                    "relative whitespace-nowrap font-display text-xs uppercase tracking-[0.15em] text-foreground/60 transition-colors md:text-[13px] md:tracking-[0.2em]",
                    isActive && "text-foreground"
                  )}
                >
                  {item.label}
                  {isActive && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute -bottom-2 left-0 block h-px w-full bg-linear-to-r from-foreground to-transparent"
                    />
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {segments[0] === "shop" ? <CartIconLink locale={locale} /> : null}
            {segments[0] === "shop" ? (
              <div className="hidden items-center gap-1 rounded-full border border-foreground/20 bg-foreground/5 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-foreground/70 md:flex">
                <button
                  type="button"
                  onClick={() => setRegion("EU")}
                  className={cn(
                    "px-2 py-1 rounded-full transition",
                    region === "EU" && "bg-foreground text-background"
                  )}
                >
                  € EUR
                </button>
                <button
                  type="button"
                  onClick={() => setRegion("US")}
                  className={cn(
                    "px-2 py-1 rounded-full transition",
                    region === "US" && "bg-foreground text-background"
                  )}
                >
                  $ USD
                </button>
                <button
                  type="button"
                  onClick={() => setRegion("UA")}
                  className={cn(
                    "px-2 py-1 rounded-full transition",
                    region === "UA" && "bg-foreground text-background"
                  )}
                >
                  ₴ UAH
                </button>
              </div>
            ) : null}
            <LocaleSwitcher className="hidden shrink-0 md:ml-2 md:flex" />
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
            {!isShopRoute ? (
              <Link
                href={`/${locale}/partnership`}
                className="group hidden items-center gap-2 rounded-full border border-foreground/20 bg-foreground/10 px-3 py-1.5 font-display text-[10px] font-semibold uppercase tracking-[0.25em] text-foreground transition hover:border-foreground hover:bg-foreground hover:text-background sm:inline-flex sm:gap-2 sm:px-4 sm:py-1.5 sm:text-[11px] sm:tracking-[0.28em]"
              >
                <span className="hidden sm:inline">{tNav("bookAtelier")}</span>
                <span className="sm:hidden">Book</span>
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-background/40 text-foreground transition group-hover:bg-background">
                  →
                </span>
              </Link>
            ) : null}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-foreground/20 bg-foreground/10 text-foreground transition hover:border-foreground hover:bg-foreground/20 lg:hidden"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "fixed inset-x-0 top-16 z-40 mx-2 rounded-2xl border bg-card/95 backdrop-blur-xl p-6 sm:top-20 sm:mx-auto sm:max-w-md",
                isShopRoute ? "border-foreground/15" : "border-foreground/10"
              )}
            >
              <nav className="flex flex-col gap-2 text-center">
                {renderedNavItems
                  /* The shop's "account" key is rendered as a prominent CTA below — skip it here to avoid duplication. */
                  .filter((item) => !(isShopRoute && item.key === "account"))
                  .map((item) => {
                    const isActive =
                      pathname === item.href || pathname?.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "relative font-display flex min-h-[44px] items-center justify-center border-b border-foreground/10 px-3 text-sm uppercase tracking-[0.25em] text-foreground/60 transition-colors",
                          isActive && "text-foreground"
                        )}
                      >
                        {item.label}
                        {isActive && (
                          <span className="absolute bottom-0 left-0 block h-px w-12 bg-linear-to-r from-foreground to-transparent" />
                        )}
                      </Link>
                    );
                  })}
                <div className="mt-2 flex flex-col items-center gap-4 border-t border-foreground/10 pt-4">
                  <div className="flex items-center gap-3">
                    <LocaleSwitcher />
                    <ThemeToggle />
                  </div>
                  {segments[0] === "shop" ? (
                    <Link
                      href={`/${locale}/shop/account`}
                      onClick={() => setMobileMenuOpen(false)}
                      suppressHydrationWarning
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-foreground/20 bg-foreground/10 px-5 py-3 text-xs uppercase tracking-[0.3em] text-foreground transition"
                    >
                      {isUa ? "Акаунт" : "Account"}
                    </Link>
                  ) : null}
                  {segments[0] !== "shop" ? (
                    <Link
                      href={`/${locale}/partnership`}
                      onClick={() => setMobileMenuOpen(false)}
                      suppressHydrationWarning
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-foreground/20 bg-foreground px-5 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-background transition"
                    >
                      {tNav("bookAtelier")}
                    </Link>
                  ) : null}
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}
