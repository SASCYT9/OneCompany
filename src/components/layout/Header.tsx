"use client";

import Link from "next/link";
import { useParams, usePathname, useSelectedLayoutSegments, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { ChevronDown, Menu, X } from "lucide-react";
import { CartIconLink } from "./CartIconLink";
import { DesktopShopMenu } from "./DesktopShopMenu";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import { ShopCountrySearchList } from "@/components/shop/ShopCountryCombobox";
import { SHOP_COUNTRIES } from "@/lib/shopCountries";
import { getShopNavigationActiveKey } from "@/lib/shopNavigation";
import { STOREFRONT_ROUTE_REGISTRY } from "@/lib/storefrontRouteRegistry";

const navItems = [
  { key: "automotive", href: "/auto" },
  { key: "moto", href: "/moto" },
  { key: "shop", href: "/shop" },
  { key: "blog", href: "/blog" },
  { key: "contact", href: "/contact" },
];

type HeaderCurrencyCode = "EUR" | "USD" | "UAH";

const SHOP_CURRENCIES: Array<{
  value: HeaderCurrencyCode;
  label: string;
}> = [
  { value: "EUR", label: "EUR" },
  { value: "USD", label: "USD" },
  { value: "UAH", label: "UAH" },
];

export function Header() {
  const params = useParams();
  const pathname = usePathname();
  const segments = useSelectedLayoutSegments();
  const locale = (params?.locale as string) || "en";
  const isUa = locale === "ua";
  const tNav = useTranslations("nav");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [shopSelectorOpen, setShopSelectorOpen] = useState(false);
  const shopSelectorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!shopSelectorOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!shopSelectorRef.current?.contains(event.target as Node)) {
        setShopSelectorOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setShopSelectorOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [shopSelectorOpen]);

  const isShopRoute = segments[0] === "shop";

  const router = useRouter();
  const [segmentParam, setSegmentParam] = useState<string | null>(null);
  const [scopeParam, setScopeParam] = useState<string | null>(null);

  useEffect(() => {
    const syncQueryState = () => {
      const params = new URLSearchParams(window.location.search);
      setSegmentParam(params.get("segment"));
      setScopeParam(params.get("scope"));
    };

    syncQueryState();
    window.addEventListener("popstate", syncQueryState);
    return () => window.removeEventListener("popstate", syncQueryState);
  }, [pathname]);

  const handleSegmentChange = (seg: string | null) => {
    const newParams = new URLSearchParams(window.location.search);
    if (seg) {
      newParams.set("segment", seg);
    } else {
      newParams.delete("segment");
    }
    setSegmentParam(seg);
    router.push(`${pathname}?${newParams.toString()}`);
  };

  const currentBrand = segments[1];
  const isBrandPortal = Boolean(
    currentBrand && STOREFRONT_ROUTE_REGISTRY.some((route) => route.segment === currentBrand)
  );

  const formatBrandName = (brand: string) => {
    if (brand.toLowerCase() === "do88") return "do88";
    if (brand.toLowerCase() === "vf-engineering") return "VF Engineering";
    if (brand.toLowerCase() === "kw-suspension") return "KW Suspension";
    if (brand.toLowerCase() === "burger") return "Burger Motorsports";
    if (brand.toLowerCase() === "racechip") return "RaceChip";
    if (brand.toLowerCase() === "ilmberger") return "Ilmberger Carbon";
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

  const globalNavItems = navItems.map((item) => ({
    key: item.key,
    href: `/${locale}${item.href}`,
    label: tNav(item.key),
  }));

  const brandCatalogHref =
    isBrandPortal && currentBrand
      ? currentBrand === "racechip"
        ? `/${locale}/shop/racechip/catalog`
        : currentBrand === "girodisc"
          ? `/${locale}/shop/girodisc/catalog`
          : ["brabus", "burger", "urban"].includes(currentBrand)
            ? `/${locale}/shop/${currentBrand}/products`
            : currentBrand === "akrapovic"
              ? `/${locale}/shop/akrapovic/collections${
                  segmentParam === "moto" || scopeParam === "moto" ? "?scope=moto" : ""
                }`
              : ["do88", "adro", "csf", "ipe", "ilmberger"].includes(currentBrand)
                ? `/${locale}/shop/${currentBrand}/collections`
                : `/${locale}/shop/${currentBrand}#catalog`
      : null;
  const brandCatalog =
    brandCatalogHref && currentBrand
      ? {
          href: brandCatalogHref,
          label: isUa
            ? `Каталог ${formatBrandName(currentBrand)}`
            : `${formatBrandName(currentBrand)} Catalog`,
        }
      : null;
  const shopNavigationActiveKey = getShopNavigationActiveKey(pathname, locale);
  const logoHref = `/${locale}`;
  const { country, currency, setCountry, setCurrency } = useShopCurrency();
  const activeCountry = SHOP_COUNTRIES.find((item) => item.value === country) ?? SHOP_COUNTRIES[0];
  const activeCountryLabel = isUa ? activeCountry.ua : activeCountry.en;

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
            "relative mx-auto flex w-full items-center rounded-2xl border backdrop-blur-xl md:backdrop-blur-3xl px-3 py-2.5 sm:rounded-[32px] sm:px-4 sm:py-3 md:px-8",
            "border-foreground/10 bg-card/65 shadow-[0_8px_30px_rgba(0,0,0,0.06)]",
            "dark:border-obsidian-border dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)]",
            "max-w-7xl",
            isShopRoute ? "dark:bg-obsidian-panel/80" : "dark:bg-obsidian/80"
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
            {globalNavItems.map((item) => {
              const isActive =
                item.key === "shop"
                  ? isShopRoute
                  : pathname === item.href || pathname?.startsWith(`${item.href}/`);

              if (item.key === "shop") {
                return (
                  <DesktopShopMenu
                    key={item.key}
                    locale={locale}
                    label={item.label}
                    isActive={isActive}
                    activeDestination={shopNavigationActiveKey}
                    brandCatalog={brandCatalog}
                  />
                );
              }

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
                      className="absolute -bottom-2 left-0 block h-px w-full bg-linear-to-r from-primary via-primary/60 to-transparent"
                    />
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {segments[0] === "shop" ? <CartIconLink locale={locale} /> : null}
            {segments[0] === "shop" ? (
              <div ref={shopSelectorRef} className="relative hidden md:block">
                <button
                  type="button"
                  onClick={() => setShopSelectorOpen((value) => !value)}
                  aria-expanded={shopSelectorOpen}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-foreground/20 bg-foreground/5 px-3 text-[10px] font-medium uppercase tracking-[0.16em] text-foreground/75 transition hover:border-foreground/35 hover:bg-foreground/10"
                >
                  <span
                    className="max-w-[112px] truncate normal-case tracking-normal"
                    suppressHydrationWarning
                  >
                    {mounted ? activeCountryLabel : isUa ? "Країна" : "Country"}
                  </span>
                  <span className="h-3 w-px bg-foreground/20" />
                  <span suppressHydrationWarning>{mounted ? currency : "EUR"}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      shopSelectorOpen && "rotate-180"
                    )}
                    strokeWidth={1.8}
                  />
                </button>
                <AnimatePresence>
                  {shopSelectorOpen ? (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-72 rounded-2xl border border-foreground/12 bg-card/95 p-3 text-foreground shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#080808]/95"
                    >
                      <div>
                        <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground/45">
                          {isUa ? "Країна" : "Country"}
                        </p>
                        <ShopCountrySearchList
                          locale={locale}
                          value={country}
                          onChange={setCountry}
                          autoFocus
                          className="mt-2"
                          listClassName="max-h-72"
                        />
                      </div>
                      <div className="mt-3 border-t border-foreground/10 pt-3">
                        <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground/45">
                          {isUa ? "Валюта" : "Currency"}
                        </p>
                        <div className="mt-2 grid grid-cols-3 gap-1">
                          {SHOP_CURRENCIES.map((option) => {
                            const selected = mounted && currency === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  setCurrency(option.value);
                                  setShopSelectorOpen(false);
                                }}
                                className={cn(
                                  "rounded-lg px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] transition",
                                  selected
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-foreground/5 text-foreground/75 hover:bg-foreground/10 hover:text-foreground"
                                )}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
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

          {/* Akrapovič Dynamic Island Switcher */}
          {currentBrand === "akrapovic" && (segmentParam === "auto" || segmentParam === "moto") && (
            <div className="ak-dynamic-island">
              <button
                type="button"
                onClick={() => handleSegmentChange(null)}
                className="ak-dynamic-island__back"
                title={isUa ? "Вибір розділу" : "Select Division"}
                aria-label={isUa ? "Вибір розділу" : "Select Division"}
              >
                ←
              </button>
              <div className="ak-dynamic-island__divider" />
              <button
                type="button"
                onClick={() => handleSegmentChange("auto")}
                className={cn("ak-dynamic-island__btn", segmentParam === "auto" && "active")}
              >
                {isUa ? "Авто" : "Auto"}
              </button>
              <button
                type="button"
                onClick={() => handleSegmentChange("moto")}
                className={cn("ak-dynamic-island__btn", segmentParam === "moto" && "active")}
              >
                {isUa ? "Мото" : "Moto"}
              </button>
            </div>
          )}
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "fixed inset-x-0 top-16 z-40 mx-2 max-h-[calc(100vh-5rem)] overflow-y-auto rounded-2xl border bg-card/95 p-6 backdrop-blur-xl sm:top-20 sm:mx-auto sm:max-w-md",
                isShopRoute ? "border-foreground/15" : "border-foreground/10"
              )}
            >
              <nav className="flex flex-col gap-2 text-center">
                {globalNavItems.map((item) => {
                  const isActive =
                    item.key === "shop"
                      ? isShopRoute
                      : pathname === item.href || pathname?.startsWith(`${item.href}/`);
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
                        <span className="absolute bottom-0 left-0 block h-px w-12 bg-linear-to-r from-primary to-transparent" />
                      )}
                    </Link>
                  );
                })}
                {isShopRoute ? (
                  <div className="mt-2 grid gap-2 border-t border-foreground/10 pt-3">
                    {brandCatalog ? (
                      <Link
                        href={brandCatalog.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex min-h-[44px] items-center justify-center rounded-xl bg-foreground/[0.055] px-3 font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground"
                      >
                        {brandCatalog.label}
                      </Link>
                    ) : null}
                    <Link
                      href={`/${locale}/shop/catalog`}
                      prefetch={false}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex min-h-[44px] items-center justify-center rounded-xl border border-primary/20 bg-primary/10 px-3 font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-primary"
                    >
                      {isUa ? "Каталог товарів" : "Product catalog"}
                    </Link>
                  </div>
                ) : null}
                <div className="mt-2 flex flex-col items-center gap-4 border-t border-foreground/10 pt-4">
                  <div className="flex items-center gap-3">
                    <LocaleSwitcher />
                    <ThemeToggle />
                  </div>
                  {segments[0] === "shop" ? (
                    <div className="w-full rounded-2xl border border-foreground/10 bg-foreground/5 p-3 text-left">
                      <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground/45">
                        {isUa ? "Країна" : "Country"}
                      </p>
                      <ShopCountrySearchList
                        locale={locale}
                        value={country}
                        onChange={setCountry}
                        className="mt-2"
                        listClassName="max-h-48"
                      />
                      <div className="mt-3 border-t border-foreground/10 pt-3">
                        <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground/45">
                          {isUa ? "Валюта" : "Currency"}
                        </p>
                        <div className="mt-2 grid grid-cols-3 gap-1">
                          {SHOP_CURRENCIES.map((option) => {
                            const selected = mounted && currency === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => setCurrency(option.value)}
                                className={cn(
                                  "rounded-lg px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] transition",
                                  selected
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-foreground/5 text-foreground/75 hover:bg-foreground/10 hover:text-foreground"
                                )}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}
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
