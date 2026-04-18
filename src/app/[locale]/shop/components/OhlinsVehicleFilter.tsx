"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Search, X, ChevronDown, SlidersHorizontal, ArrowRight, Activity } from "lucide-react";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct } from "@/lib/shopCatalog";
import { localizeShopProductTitle } from "@/lib/shopText";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { useMobileFilterDrawer } from "./useMobileFilterDrawer";

type Props = {
  locale: SupportedLocale;
  products: ShopProduct[];
  viewerContext?: ShopViewerPricingContext;
};

/* ─── SLUG PREFIX → CAR MAKE mapping ─── */
const SLUG_PREFIX_TO_MAKE: Record<string, string> = {
  aus: "Audi", auv: "Audi", alv: "Alpine",
  bms: "BMW", bmv: "BMW", bmz: "BMW",
  fos: "Ford", fov: "Ford",
  hos: "Honda", hov: "Honda",
  hys: "Hyundai",
  inv: "INEOS",
  isv: "Lexus",
  jev: "Jeep",
  les: "Lexus", lof: "Lotus", lov: "Lotus",
  mas: "Maserati",
  mcs: "Mini", mev: "Mercedes-Benz", mes: "Mercedes-Benz",
  mis: "Mitsubishi", mir: "Mitsubishi", miz: "Mitsubishi",
  nis: "Nissan", nir: "Nissan",
  pof: "Porsche", por: "Porsche", pos: "Porsche", pov: "Porsche", poz: "Porsche",
  sef: "SEAT",
  sur: "Subaru", sus: "Subaru", suv: "Suzuki",
  tes: "Tesla", tos: "Toyota", tov: "Toyota",
  vaf: "VW/Audi", vws: "Volkswagen",
};

/* ─── CATEGORY detection from title ─── */
const CATEGORY_PATTERNS: { match: RegExp; label: string; labelUa: string }[] = [
  { match: /road\s*[&]\s*track|койловер/i, label: "Road & Track", labelUa: "Road & Track" },
  { match: /advanced\s*track\s*day|trackday/i, label: "Advanced Trackday", labelUa: "Advanced Trackday" },
  { match: /motorsport|grp?\s*n|cup|tcr|race/i, label: "Motorsport", labelUa: "Motorsport" },
  { match: /off[\s-]*road|adventure|hilux|jimny|grenadier/i, label: "Off-Road & Adventure", labelUa: "Off-Road & Adventure" },
  { match: /електронн|electronic|edc|pasm/i, label: "Electronics (EDC)", labelUa: "Електроніка (EDC)" },
  { match: /верхня опора|top mount/i, label: "Top Mounts", labelUa: "Верхні опори" },
  { match: /пружин|spring/i, label: "Springs", labelUa: "Пружини" },
];

function detectMake(product: ShopProduct): string | null {
  // 1. Try slug prefix
  const slugBody = product.slug.replace(/^ohlins-/, "");
  const prefix = slugBody.split("-")[0]?.toLowerCase();
  if (prefix && SLUG_PREFIX_TO_MAKE[prefix]) return SLUG_PREFIX_TO_MAKE[prefix];

  // 2. Try title text matching for known brands
  const title = (product.title?.en || "") + " " + (product.title?.ua || "");
  const brands = [
    "BMW", "Porsche", "Audi", "Mercedes", "Ford", "Honda", "Nissan", "Toyota",
    "Subaru", "Mitsubishi", "Volkswagen", "VW", "Hyundai", "Lexus", "Mazda",
    "Mini", "Lotus", "Alpine", "Maserati", "Tesla", "SEAT", "Jeep", "Suzuki", "INEOS",
  ];
  for (const brand of brands) {
    if (title.toUpperCase().includes(brand.toUpperCase())) {
      if (brand === "VW") return "Volkswagen";
      if (brand === "Mercedes") return "Mercedes-Benz";
      return brand;
    }
  }
  return null;
}

function detectCategory(product: ShopProduct): { label: string; labelUa: string } | null {
  const text = `${product.title?.en ?? ""} ${product.title?.ua ?? ""} ${product.shortDescription?.en ?? ""}`;
  for (const pattern of CATEGORY_PATTERNS) {
    if (pattern.match.test(text)) return { label: pattern.label, labelUa: pattern.labelUa };
  }
  return null;
}

function formatPrice(locale: SupportedLocale, amount: number, currency: "EUR" | "USD" | "UAH") {
  const formatter = new Intl.NumberFormat(locale === "ua" ? "uk-UA" : "en-US", {
    maximumFractionDigits: 0,
  });
  const formatted = formatter.format(amount);
  if (locale === "ua" && currency === "UAH") return `${formatted} грн`;
  return locale === "ua" ? `${formatted} ${currency}` : `${currency} ${formatted}`;
}

export default function OhlinsVehicleFilter({
  locale,
  products,
  viewerContext,
}: Props) {
  const isUa = locale === "ua";
  const { currency, rates } = useShopCurrency();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialMake = searchParams?.get("make") || "all";
  const initialCategory = searchParams?.get("category") || "all";
  const initialSort = (searchParams?.get("sort") as "default" | "price_desc" | "price_asc") || "default";
  const initialSearch = searchParams?.get("q") || "";

  const [activeMake, setActiveMake] = useState<string>(initialMake);
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [sortOrder, setSortOrder] = useState<"default" | "price_desc" | "price_asc">(initialSort);
  const [visibleCount, setVisibleCount] = useState(30);
  const { mobileFilterOpen, closeMobileFilter, toggleMobileFilter } = useMobileFilterDrawer();

  // Sync filter state to URL
  const syncToUrl = useCallback((make: string, cat: string, sort: string, q: string) => {
    const params = new URLSearchParams();
    if (make !== "all") params.set("make", make);
    if (cat !== "all") params.set("category", cat);
    if (sort !== "default") params.set("sort", sort);
    if (q.trim()) params.set("q", q);
    const qs = params.toString();
    const newPath = qs ? `${pathname}?${qs}` : pathname || "";
    router.replace(newPath, { scroll: false });
  }, [pathname, router]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      syncToUrl(activeMake, activeCategory, sortOrder, searchQuery);
    }, 300);
    return () => clearTimeout(timeout);
  }, [activeMake, activeCategory, sortOrder, searchQuery, syncToUrl]);

  useEffect(() => {
    setVisibleCount(30);
  }, [activeMake, activeCategory, searchQuery, sortOrder]);

  // Pre-compute makes and categories for each product
  const enrichedProducts = useMemo(() => {
    return products.map((p) => ({
      product: p,
      make: detectMake(p),
      category: detectCategory(p),
    }));
  }, [products]);

  // 1. EXTRACT ALL MAKES
  const availableMakes = useMemo(() => {
    const makes = new Map<string, number>();
    for (const ep of enrichedProducts) {
      if (!ep.make) continue;
      if (searchQuery && !localizeShopProductTitle(locale, ep.product).toLowerCase().includes(searchQuery.toLowerCase())) continue;
      if (activeCategory !== "all" && ep.category?.label !== activeCategory) continue;
      makes.set(ep.make, (makes.get(ep.make) || 0) + 1);
    }
    return [...makes.entries()]
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [enrichedProducts, searchQuery, locale, activeCategory]);

  // 2. EXTRACT ALL CATEGORIES
  const availableCategories = useMemo(() => {
    const cats = new Map<string, { count: number; labelUa: string }>();
    for (const ep of enrichedProducts) {
      if (!ep.category) continue;
      if (searchQuery && !localizeShopProductTitle(locale, ep.product).toLowerCase().includes(searchQuery.toLowerCase())) continue;
      if (activeMake !== "all" && ep.make !== activeMake) continue;
      const existing = cats.get(ep.category.label);
      cats.set(ep.category.label, {
        count: (existing?.count || 0) + 1,
        labelUa: ep.category.labelUa,
      });
    }
    return [...cats.entries()]
      .map(([key, val]) => ({ key, label: key, labelUa: val.labelUa, count: val.count }))
      .sort((a, b) => b.count - a.count);
  }, [enrichedProducts, searchQuery, locale, activeMake]);

  // 3. FILTER RESULTS
  const filtered = useMemo(() => {
    let list = enrichedProducts;

    if (activeMake !== "all") {
      list = list.filter((ep) => ep.make === activeMake);
    }
    if (activeCategory !== "all") {
      list = list.filter((ep) => ep.category?.label === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((ep) => {
        const title = localizeShopProductTitle(locale, ep.product).toLowerCase();
        return title.includes(q) || ep.product.sku?.toLowerCase().includes(q) || ep.product.slug.toLowerCase().includes(q);
      });
    }

    const sortedList = [...list].sort((a, b) => {
      const priceA = a.product.price?.eur || 0;
      const priceB = b.product.price?.eur || 0;
      if (sortOrder === "price_asc") return priceA - priceB;
      if (sortOrder === "price_desc") return priceB - priceA;
      return 0;
    });

    return sortedList;
  }, [enrichedProducts, activeMake, activeCategory, searchQuery, sortOrder, locale]);

  const displayedProducts = useMemo(() => {
    return filtered.slice(0, visibleCount);
  }, [filtered, visibleCount]);

  const getDisplayPrice = (p: ShopProduct) => {
    if (!mounted) return null;
    const pricing = viewerContext ? resolveShopProductPricing(p, viewerContext) : null;
    const ep = pricing?.effectivePrice;
    const priceUsd = ep?.usd ?? p.price.usd ?? 0;
    const priceEur = ep?.eur ?? p.price.eur ?? 0;
    const priceUah = ep?.uah ?? p.price.uah ?? 0;

    if (priceEur <= 0) return null;

    const usd = priceUsd > 0 ? priceUsd : (rates?.USD ? Math.round(priceEur * rates.USD) : 0);
    const uah = priceUah > 0 ? priceUah : (rates?.UAH ? Math.round(priceEur * rates.UAH) : 0);

    return {
      eur: formatPrice(locale, priceEur, "EUR"),
      usd: usd > 0 ? formatPrice(locale, usd, "USD") : null,
      uah: uah > 0 ? formatPrice(locale, uah, "UAH") : null,
      primary: currency === "USD" && usd > 0
        ? formatPrice(locale, usd, "USD")
        : currency === "UAH" && uah > 0
          ? formatPrice(locale, uah, "UAH")
          : formatPrice(locale, priceEur, "EUR"),
    };
  };

  if (!mounted) return null;

  /* Öhlins Gold accent */
  const GOLD = "#c29d59";
  const GOLD_DIM = "rgba(194,157,89,0.25)";
  const hasActiveFilters =
    activeMake !== "all" ||
    activeCategory !== "all" ||
    searchQuery.trim().length > 0 ||
    sortOrder !== "default";

  function resetFilters() {
    setActiveMake("all");
    setActiveCategory("all");
    setSearchQuery("");
    setSortOrder("default");
  }

  const filterControls = (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="relative border border-white/20 transition-colors hover:border-[#c29d59]/50">
          <select
            value={activeMake}
            onChange={(e) => setActiveMake(e.target.value)}
            className="appearance-none w-full rounded-none bg-[#0a0a0c] px-5 py-4 pr-10 text-[11px] font-light uppercase tracking-[0.1em] text-white outline-none"
          >
            <option value="all" className="bg-[#0a0a0c] font-light text-zinc-500">
              {isUa ? "Виберіть Марку" : "Select Make"}
            </option>
            {availableMakes.map((m) => (
              <option key={m.key} value={m.key} className="bg-[#0a0a0c] text-white">
                {m.label} ({m.count})
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
            <ChevronDown size={14} strokeWidth={1.5} />
          </div>
        </div>

        <div className="relative border border-white/20 transition-colors hover:border-[#c29d59]/50">
          <select
            value={activeCategory}
            onChange={(e) => setActiveCategory(e.target.value)}
            className="appearance-none w-full rounded-none bg-[#0a0a0c] px-5 py-4 pr-10 text-[11px] font-light uppercase tracking-[0.1em] text-white outline-none"
          >
            <option value="all" className="bg-[#0a0a0c] font-light text-zinc-500">
              {isUa ? "Усі Лінійки" : "All Lines"}
            </option>
            {availableCategories.map((c) => (
              <option key={c.key} value={c.key} className="bg-[#0a0a0c] text-white">
                {isUa ? c.labelUa : c.label} ({c.count})
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
            <ChevronDown size={14} strokeWidth={1.5} />
          </div>
        </div>

        <div className="relative border border-white/20 transition-colors hover:border-[#c29d59]/50">
          <Search
            size={14}
            strokeWidth={1.5}
            className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isUa ? "Пошук моделі..." : "Search Model..."}
            className="w-full rounded-none bg-[#0a0a0c] px-12 py-4 text-[11px] font-light tracking-[0.1em] text-white outline-none placeholder-zinc-500"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-5 top-1/2 -translate-y-1/2 transition-opacity"
              style={{ color: GOLD }}
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

        <div className="relative border border-white/20 transition-colors hover:border-[#c29d59]/50">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500">
            <SlidersHorizontal size={14} strokeWidth={1.5} />
          </div>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "default" | "price_desc" | "price_asc")}
            className="appearance-none w-full rounded-none bg-[#0a0a0c] py-4 pl-12 pr-10 text-[11px] font-light uppercase tracking-[0.1em] text-white outline-none"
          >
            <option value="default" className="bg-[#0a0a0c] text-white">
              {isUa ? "За замовчуванням" : "Default Sort"}
            </option>
            <option value="price_desc" className="bg-[#0a0a0c] text-white">
              {isUa ? "Спочатку дорожчі" : "Price: High to Low"}
            </option>
            <option value="price_asc" className="bg-[#0a0a0c] text-white">
              {isUa ? "Спочатку дешевші" : "Price: Low to High"}
            </option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
            <ChevronDown size={14} strokeWidth={1.5} />
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-[10px] font-light tracking-widest text-zinc-500 sm:text-xs">
          {filtered.length}{" "}
          {isUa
            ? `результат${filtered.length === 1 ? "" : filtered.length < 5 ? "и" : "ів"}`
            : `result${filtered.length === 1 ? "" : "s"}`}
          {hasActiveFilters ? (
            <>
              {" "}
              ·{" "}
              <button
                type="button"
                onClick={resetFilters}
                className="uppercase tracking-widest transition-colors hover:text-white"
                style={{ color: GOLD }}
              >
                {isUa ? "Скинути" : "Reset"}
              </button>
            </>
          ) : null}
        </p>
      </div>
    </>
  );

  return (
    <section className="bg-transparent text-white py-12 min-h-[90dvh] relative z-10 font-sans overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Top Gold Glow */}
      <div
        className="absolute -top-40 -right-40 w-[1000px] h-[1000px] rounded-full blur-3xl pointer-events-none"
        style={{ background: `radial-gradient(circle at center, rgba(194,157,89,0.04) 0%, transparent 70%)` }}
      />

      <div className="max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-20 relative z-20">
        <div className="flex flex-col gap-10">
          <div className="mb-4 flex items-center gap-3 lg:hidden">
            <button
              type="button"
              onClick={toggleMobileFilter}
              aria-expanded={mobileFilterOpen}
              aria-controls="ohlins-mobile-filters"
              className="flex items-center gap-2.5 border border-white/[0.14] bg-[#0a0a0c]/90 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:border-[#c29d59]/45"
            >
              <SlidersHorizontal size={13} />
              {isUa ? "Фільтри" : "Filters"}
              {hasActiveFilters ? (
                <span className="ml-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: GOLD }} />
              ) : null}
            </button>
            <p className="text-xs tracking-wide text-zinc-500">
              {filtered.length} {isUa ? "результатів" : "results"}
            </p>
          </div>

          {mobileFilterOpen ? (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/60 lg:hidden"
                onClick={closeMobileFilter}
              />
              <div
                id="ohlins-mobile-filters"
                className="fixed inset-y-0 left-0 z-50 w-[88vw] max-w-[360px] overflow-y-auto border-r border-white/10 bg-[#050505] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] shadow-2xl lg:hidden"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.26em]" style={{ color: GOLD }}>
                      Ohlins
                    </p>
                    <h2 className="mt-2 text-lg font-light uppercase tracking-[0.08em] text-white">
                      {isUa ? "Фільтри" : "Filters"}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={closeMobileFilter}
                    className="p-2 text-zinc-500 transition-colors hover:text-white"
                    aria-label="Close filters"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="mt-6">{filterControls}</div>
              </div>
            </>
          ) : null}

          {/* ─── TOP: COMMAND CENTER FILTER ─── */}
          <div className="relative z-30 mb-8 hidden max-w-5xl mx-auto w-full lg:block">
            <div className="flex flex-col items-center justify-center text-center mb-10">
              <h2 className="text-2xl lg:text-3xl font-light tracking-[0.05em] uppercase text-white/90">
                {isUa ? "ЗНАЙДІТЬ СВОЮ ПІДВІСКУ" : "FIND YOUR SUSPENSION"}
              </h2>
              <p className="mt-3 text-[10px] tracking-[0.3em] uppercase font-light flex items-center gap-2" style={{ color: GOLD }}>
                <Activity size={11} strokeWidth={2} style={{ color: GOLD }} />
                DFV · TTX · Road & Track
              </p>
            </div>
            {filterControls}
          </div>

          {/* ─── BOTTOM: PRODUCT GRID ─── */}
          <main className="w-full">

            {filtered.length === 0 ? (
              <div className="py-32 text-center bg-[#111] border border-zinc-900 rounded-2xl flex flex-col items-center shadow-2xl">
                <div
                  className="w-20 h-20 rounded-full bg-black flex items-center justify-center mb-6 border border-white/5"
                  style={{ boxShadow: `0 0 30px ${GOLD_DIM}` }}
                >
                  <Search className="w-8 h-8" style={{ color: `${GOLD}80` }} />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">
                  {isUa ? "Нічого не знайдено" : "No Components Found"}
                </h3>
                <p className="text-zinc-500 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                  {searchQuery
                    ? (isUa ? `На жаль, за запитом "${searchQuery}" ми нічого не знайшли.` : `No results for "${searchQuery}"`)
                    : (isUa ? "Компоненти для цієї комбінації відсутні." : "Components for this combination are currently unavailable.")}
                </p>
                <button
                  onClick={() => { setActiveMake("all"); setActiveCategory("all"); setSearchQuery(""); }}
                  className="px-8 py-3.5 text-black text-[12px] uppercase tracking-widest font-bold rounded-lg transition-all duration-300"
                  style={{ background: `linear-gradient(to right, ${GOLD}, #d4b271)`, boxShadow: `0 4px 15px ${GOLD_DIM}` }}
                >
                  {isUa ? "Скинути фільтри" : "Reset Filters"}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
                {displayedProducts.map(({ product, make, category }) => {
                  const productTitle = localizeShopProductTitle(locale, product);
                  const priceData = getDisplayPrice(product);

                  return (
                    <article key={product.slug} className="group relative bg-[#0a0a0c] rounded-none flex flex-col border border-white/[0.05] hover:border-white/20 transition-all duration-500 shadow-xl">
                      {/* Category Badge */}
                      {category && (
                        <div className="absolute top-4 right-4 z-20">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[8px] uppercase tracking-[0.2em] font-bold border rounded-sm backdrop-blur-sm"
                            style={{
                              background: `${GOLD}15`,
                              color: GOLD,
                              borderColor: `${GOLD}30`,
                            }}
                          >
                            <Activity size={10} strokeWidth={2.5} />
                            {isUa ? category.labelUa : category.label}
                          </span>
                        </div>
                      )}

                      {/* MAIN CLICKABLE LINK */}
                      <Link
                        href={`/${locale}/shop/ohlins/products/${product.slug}`}
                        className="flex flex-col flex-grow z-10"
                      >
                        {/* Square Image Canvas */}
                        <div className="relative aspect-square w-full overflow-hidden flex items-center justify-center bg-[#080809] border-b border-white/[0.05]">
                          {product.image ? (
                            <div className="absolute inset-0 p-8">
                              <Image
                                src={product.image}
                                alt={productTitle}
                                fill
                                sizes="(max-width: 768px) 100vw, 33vw"
                                className="object-contain opacity-80 transition-transform group-hover:scale-105 group-hover:opacity-100"
                                style={{ transitionDuration: '1s' }}
                              />
                            </div>
                          ) : (
                            <div className="w-16 h-16 opacity-20 text-white">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 6v6l4 2" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Card Body */}
                        <div className="px-6 pt-6 pb-2 flex flex-col flex-grow">
                          {/* Make tag */}
                          {make && (
                            <p className="text-[9px] uppercase tracking-[0.2em] font-light mb-2 line-clamp-1" style={{ color: GOLD }}>
                              {make}
                            </p>
                          )}
                          <h3 className="text-sm font-light leading-relaxed text-zinc-300 line-clamp-2 mb-4 group-hover:text-white transition-colors h-10">
                            {productTitle}
                          </h3>

                          {/* Price */}
                          <div className="mt-auto pt-2 pb-4">
                            <span className="text-lg tracking-widest font-thin text-white">
                              {priceData ? priceData.primary : (isUa ? "ОЧІКУЄТЬСЯ" : "PENDING")}
                            </span>
                            {priceData && (
                              <div className="flex items-center gap-2 mt-1.5 text-[9px] tracking-widest font-light text-zinc-600">
                                <span className={currency === "EUR" ? "text-zinc-400" : ""}>{priceData.eur}</span>
                                {priceData.usd && (<><span className="text-zinc-800">·</span><span className={currency === "USD" ? "text-zinc-400" : ""}>{priceData.usd}</span></>)}
                                {priceData.uah && (<><span className="text-zinc-800">·</span><span className={currency === "UAH" ? "text-zinc-400" : ""}>{priceData.uah}</span></>)}
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>

                      {/* Bottom Actions: View + Add To Cart */}
                      <div className="px-6 pb-6 pt-0 z-20 relative flex gap-3">
                        <Link
                          href={`/${locale}/shop/ohlins/products/${product.slug}`}
                          className="flex-1 flex items-center justify-center gap-2 py-3 border text-[10px] tracking-[0.3em] uppercase font-light hover:text-white transition-all duration-300 rounded-[2px]"
                          style={{
                            borderColor: `${GOLD}50`,
                            color: GOLD,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = GOLD;
                            e.currentTarget.style.borderColor = GOLD;
                            e.currentTarget.style.color = '#111';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.borderColor = `${GOLD}50`;
                            e.currentTarget.style.color = GOLD;
                          }}
                        >
                          {isUa ? "ПЕРЕЙТИ" : "VIEW"}
                          <ArrowRight size={12} strokeWidth={2} />
                        </Link>
                        <AddToCartButton
                          slug={product.slug}
                          variantId={null}
                          locale={locale}
                          redirect={true}
                          productName={productTitle}
                          label={isUa ? "КОШИК" : "CART"}
                          labelAdded={isUa ? "✓" : "✓"}
                          className="flex-1 flex items-center justify-center py-3 border border-white/10 text-[10px] tracking-[0.3em] uppercase font-light text-white hover:text-black hover:bg-white hover:border-white transition-all duration-300 rounded-[2px]"
                          variant="inline"
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* LOAD MORE BUTTON */}
            {filtered.length > 0 && visibleCount < filtered.length && (
              <div className="mt-16 flex justify-center w-full relative z-30">
                <button
                  onClick={() => setVisibleCount((prev) => prev + 30)}
                  className="px-12 py-4 border border-white/20 text-white text-[11px] tracking-[0.3em] uppercase font-light transition-all duration-300 rounded-[2px]"
                  style={{ boxShadow: `0 0 20px ${GOLD_DIM}` }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = GOLD;
                    e.currentTarget.style.borderColor = GOLD;
                    e.currentTarget.style.color = '#111';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                    e.currentTarget.style.color = '#fff';
                  }}
                >
                  {isUa ? "ЗАВАНТАЖИТИ ЩЕ" : "LOAD MORE"}
                </button>
              </div>
            )}

          </main>
        </div>
      </div>
    </section>
  );
}
