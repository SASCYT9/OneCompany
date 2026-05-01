"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Search, X, ChevronDown, SlidersHorizontal, ArrowRight, Activity } from "lucide-react";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct } from "@/lib/shopCatalog";
import {
  detectOhlinsCategory,
  detectOhlinsMake,
  matchesOhlinsModelChassis,
  type OhlinsHeroVehicleMake,
} from "@/lib/ohlinsCatalog";
import { computeShopDisplayPrices, hasAnyShopPrice, pickShopSortableAmount } from "@/lib/shopDisplayPrices";
import { localizeShopProductTitle } from "@/lib/shopText";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { useShopViewerContext } from "@/lib/useShopViewerContext";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";
import {
  buildShopSearchText,
  matchesShopSearchQuery,
  type ShopAlternativeSearchItem,
} from "@/lib/shopSearch";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { useMobileFilterDrawer } from "./useMobileFilterDrawer";

type Props = {
  locale: SupportedLocale;
  products: ShopProduct[];
  vehicles?: OhlinsHeroVehicleMake[];
  alternativeSearchItems?: ShopAlternativeSearchItem[];
  viewerContext?: ShopViewerPricingContext;
};

function formatPrice(locale: SupportedLocale, amount: number, currency: "EUR" | "USD" | "UAH") {
  const formatter = new Intl.NumberFormat(locale === "ua" ? "uk-UA" : "en-US", {
    maximumFractionDigits: 0,
  });
  const formatted = formatter.format(amount);
  if (locale === "ua" && currency === "UAH") return `${formatted} грн`;
  return locale === "ua" ? `${formatted} ${currency}` : `${currency} ${formatted}`;
}

function formatResultCount(locale: SupportedLocale, count: number) {
  if (locale !== "ua") {
    return `${count} result${count === 1 ? "" : "s"}`;
  }

  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  const suffix =
    lastDigit === 1 && lastTwoDigits !== 11
      ? ""
      : lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)
        ? "и"
        : "ів";

  return `${count} результат${suffix}`;
}

export default function OhlinsVehicleFilter({
  locale,
  products,
  vehicles = [],
  alternativeSearchItems = [],
  viewerContext: ssrViewerContext,
}: Props) {
  const viewerContext = useShopViewerContext(ssrViewerContext);
  const isUa = locale === "ua";
  const { currency, rates } = useShopCurrency();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialMake = searchParams?.get("make") || "all";
  const initialModel = searchParams?.get("model") || "";
  const initialChassis = searchParams?.get("chassis") || "";
  const initialCategory = searchParams?.get("category") || "all";
  const initialSort = (searchParams?.get("sort") as "default" | "price_desc" | "price_asc") || "default";
  const initialSearch = searchParams?.get("q") || "";

  const [activeMake, setActiveMake] = useState<string>(initialMake);
  const [activeModel, setActiveModel] = useState<string>(initialModel);
  const [activeChassis, setActiveChassis] = useState<string>(initialChassis);
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [sortOrder, setSortOrder] = useState<"default" | "price_desc" | "price_asc">(initialSort);
  const [visibleCount, setVisibleCount] = useState(30);
  const { mobileFilterOpen, closeMobileFilter, toggleMobileFilter } = useMobileFilterDrawer();

  // Sync filter state to URL
  const syncToUrl = useCallback((
    make: string,
    model: string,
    chassis: string,
    cat: string,
    sort: string,
    q: string,
  ) => {
    const params = new URLSearchParams();
    if (make !== "all") params.set("make", make);
    if (model) params.set("model", model);
    if (chassis) params.set("chassis", chassis);
    if (cat !== "all") params.set("category", cat);
    if (sort !== "default") params.set("sort", sort);
    if (q.trim()) params.set("q", q);
    const qs = params.toString();
    const newPath = qs ? `${pathname}?${qs}` : pathname || "";
    router.replace(newPath, { scroll: false });
  }, [pathname, router]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      syncToUrl(activeMake, activeModel, activeChassis, activeCategory, sortOrder, searchQuery);
    }, 300);
    return () => clearTimeout(timeout);
  }, [activeMake, activeModel, activeChassis, activeCategory, sortOrder, searchQuery, syncToUrl]);

  useEffect(() => {
    setVisibleCount(30);
  }, [activeMake, activeModel, activeChassis, activeCategory, searchQuery, sortOrder]);

  // Cascade resets — when make changes, clear model and chassis. When model
  // changes, clear chassis. Triggered via dedicated handlers below to avoid
  // racing the URL-sync effect.
  function onMakeChange(value: string) {
    setActiveMake(value);
    setActiveModel("");
    setActiveChassis("");
  }
  function onModelChange(value: string) {
    setActiveModel(value);
    setActiveChassis("");
  }

  // Pre-compute makes and categories for each product
  const enrichedProducts = useMemo(() => {
    return products.map((p) => {
      const make = detectOhlinsMake(p);
      const category = detectOhlinsCategory(p);
      const collectionParts = p.collections?.flatMap((collection) => [
        collection.handle,
        collection.title.ua,
        collection.title.en,
        collection.brand ?? "",
      ]) ?? [];

      return {
        product: p,
        make,
        category,
        searchText: buildShopSearchText([
          localizeShopProductTitle("ua", p),
          localizeShopProductTitle("en", p),
          p.title.ua,
          p.title.en,
          p.sku,
          p.slug,
          p.brand,
          p.vendor,
          p.productType,
          p.category.ua,
          p.category.en,
          p.collection.ua,
          p.collection.en,
          p.shortDescription.ua,
          p.shortDescription.en,
          make ?? "",
          category?.label ?? "",
          category?.labelUa ?? "",
          ...collectionParts,
          ...(p.tags ?? []),
        ]),
      };
    });
  }, [products]);

  // 1. EXTRACT ALL MAKES
  const availableMakes = useMemo(() => {
    const makes = new Map<string, number>();
    for (const ep of enrichedProducts) {
      if (!ep.make) continue;
      if (searchQuery && !matchesShopSearchQuery(ep.searchText, searchQuery)) continue;
      if (activeCategory !== "all" && ep.category?.label !== activeCategory) continue;
      makes.set(ep.make, (makes.get(ep.make) || 0) + 1);
    }
    return [...makes.entries()]
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [enrichedProducts, searchQuery, activeCategory]);

  // 2. AVAILABLE MODELS — pulled from the curated vehicle tree, scoped to make
  const availableModels = useMemo(() => {
    if (activeMake === "all") return [];
    return vehicles.find((v) => v.make === activeMake)?.models ?? [];
  }, [vehicles, activeMake]);

  // 3. AVAILABLE CHASSIS — only for selected (make, model)
  const availableChassis = useMemo(() => {
    if (!activeModel) return [];
    return availableModels.find((m) => m.name === activeModel)?.chassis ?? [];
  }, [availableModels, activeModel]);

  // 4. EXTRACT ALL CATEGORIES
  const availableCategories = useMemo(() => {
    const cats = new Map<string, { count: number; labelUa: string }>();
    for (const ep of enrichedProducts) {
      if (!ep.category) continue;
      if (searchQuery && !matchesShopSearchQuery(ep.searchText, searchQuery)) continue;
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
  }, [enrichedProducts, searchQuery, activeMake]);

  // 5. FILTER RESULTS
  const filtered = useMemo(() => {
    let list = enrichedProducts;

    if (activeMake !== "all") {
      list = list.filter((ep) => ep.make === activeMake);
    }
    if (activeModel || activeChassis) {
      list = list.filter((ep) => {
        const title = `${ep.product.title?.en ?? ""} ${ep.product.title?.ua ?? ""}`;
        return matchesOhlinsModelChassis(
          title,
          activeModel || null,
          activeChassis || null,
        );
      });
    }
    if (activeCategory !== "all") {
      list = list.filter((ep) => ep.category?.label === activeCategory);
    }
    if (searchQuery.trim()) {
      list = list.filter((ep) => matchesShopSearchQuery(ep.searchText, searchQuery));
    }

    const sortedList = [...list].sort((a, b) => {
      const priceA = pickShopSortableAmount(
        viewerContext ? resolveShopProductPricing(a.product, viewerContext).effectivePrice : a.product.price,
        currency,
        rates && { EUR: rates.EUR, USD: rates.USD, UAH: rates.UAH }
      );
      const priceB = pickShopSortableAmount(
        viewerContext ? resolveShopProductPricing(b.product, viewerContext).effectivePrice : b.product.price,
        currency,
        rates && { EUR: rates.EUR, USD: rates.USD, UAH: rates.UAH }
      );
      if (sortOrder === "price_asc") return priceA - priceB;
      if (sortOrder === "price_desc") return priceB - priceA;
      return 0;
    });

    return sortedList;
  }, [enrichedProducts, activeMake, activeModel, activeChassis, activeCategory, searchQuery, sortOrder, viewerContext, currency, rates]);

  const alternativeMatches = useMemo(() => {
    if (!searchQuery.trim() || filtered.length > 0) {
      return [];
    }

    return alternativeSearchItems
      .filter((item) => matchesShopSearchQuery(item.searchText, searchQuery))
      .slice(0, 8);
  }, [alternativeSearchItems, filtered.length, searchQuery]);

  const displayedProducts = useMemo(() => {
    return filtered.slice(0, visibleCount);
  }, [filtered, visibleCount]);

  const getDisplayPrice = (p: ShopProduct) => {
    if (!mounted) return null;
    const pricing = viewerContext ? resolveShopProductPricing(p, viewerContext) : null;
    const displayRates = rates && { EUR: rates.EUR, USD: rates.USD, UAH: rates.UAH };
    const price = pricing?.effectivePrice ?? p.price;
    const computed = computeShopDisplayPrices(price, displayRates);

    if (!hasAnyShopPrice(price, displayRates)) return null;

    const primary =
      currency === "USD" && computed.usd > 0
        ? formatPrice(locale, computed.usd, "USD")
        : currency === "UAH" && computed.uah > 0
          ? formatPrice(locale, computed.uah, "UAH")
          : currency === "EUR" && computed.eur > 0
            ? formatPrice(locale, computed.eur, "EUR")
            : computed.uah > 0
              ? formatPrice(locale, computed.uah, "UAH")
              : computed.usd > 0
                ? formatPrice(locale, computed.usd, "USD")
                : formatPrice(locale, computed.eur, "EUR");

    return {
      eur: computed.eur > 0 ? formatPrice(locale, computed.eur, "EUR") : null,
      usd: computed.usd > 0 ? formatPrice(locale, computed.usd, "USD") : null,
      uah: computed.uah > 0 ? formatPrice(locale, computed.uah, "UAH") : null,
      primary,
    };
  };

  if (!mounted) return null;

  /* Öhlins Gold accent */
  const GOLD = "#c29d59";
  const GOLD_DIM = "rgba(194,157,89,0.25)";
  const hasActiveFilters =
    activeMake !== "all" ||
    activeModel !== "" ||
    activeChassis !== "" ||
    activeCategory !== "all" ||
    searchQuery.trim().length > 0 ||
    sortOrder !== "default";

  function resetFilters() {
    setActiveMake("all");
    setActiveModel("");
    setActiveChassis("");
    setActiveCategory("all");
    setSearchQuery("");
    setSortOrder("default");
  }

  const filterControls = (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <div className="relative border border-white/20 transition-colors hover:border-[#c29d59]/50">
          <select
            value={activeMake}
            onChange={(e) => onMakeChange(e.target.value)}
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

        <div
          className={`relative border transition-colors ${
            activeMake === "all"
              ? "border-white/10 opacity-50"
              : "border-white/20 hover:border-[#c29d59]/50"
          }`}
        >
          <select
            value={activeModel}
            onChange={(e) => onModelChange(e.target.value)}
            disabled={activeMake === "all" || availableModels.length === 0}
            aria-disabled={activeMake === "all" || availableModels.length === 0}
            className="appearance-none w-full rounded-none bg-[#0a0a0c] px-5 py-4 pr-10 text-[11px] font-light uppercase tracking-[0.1em] text-white outline-none disabled:cursor-not-allowed"
          >
            <option value="" className="bg-[#0a0a0c] font-light text-zinc-500">
              {activeMake === "all"
                ? isUa
                  ? "Спочатку марка"
                  : "Pick make first"
                : availableModels.length === 0
                  ? isUa
                    ? "Немає моделей"
                    : "No models"
                  : isUa
                    ? "Виберіть Модель"
                    : "Select Model"}
            </option>
            {availableModels.map((m) => (
              <option key={m.name} value={m.name} className="bg-[#0a0a0c] text-white">
                {m.name}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
            <ChevronDown size={14} strokeWidth={1.5} />
          </div>
        </div>

        <div
          className={`relative border transition-colors ${
            !activeModel || availableChassis.length === 0
              ? "border-white/10 opacity-50"
              : "border-white/20 hover:border-[#c29d59]/50"
          }`}
        >
          <select
            value={activeChassis}
            onChange={(e) => setActiveChassis(e.target.value)}
            disabled={!activeModel || availableChassis.length === 0}
            aria-disabled={!activeModel || availableChassis.length === 0}
            className="appearance-none w-full rounded-none bg-[#0a0a0c] px-5 py-4 pr-10 text-[11px] font-light uppercase tracking-[0.1em] text-white outline-none disabled:cursor-not-allowed"
          >
            <option value="" className="bg-[#0a0a0c] font-light text-zinc-500">
              {activeMake === "all"
                ? isUa
                  ? "Спочатку марка"
                  : "Pick make first"
                : !activeModel
                  ? isUa
                    ? "Спочатку модель"
                    : "Pick model first"
                  : availableChassis.length === 0
                    ? isUa
                      ? "Без кузовів"
                      : "No chassis"
                    : isUa
                      ? "Виберіть Кузов"
                      : "Select Chassis"}
            </option>
            {availableChassis.map((code) => (
              <option key={code} value={code} className="bg-[#0a0a0c] text-white">
                {code}
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
            placeholder={isUa ? "Модель, SKU або код шасі..." : "Model, SKU or chassis code..."}
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
          {formatResultCount(locale, filtered.length)}
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
              {formatResultCount(locale, filtered.length)}
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
          <div className="relative z-30 mb-8 hidden w-full lg:block">
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
              <div className="flex flex-col items-center border border-zinc-900 bg-[#111] px-5 py-24 text-center shadow-2xl sm:px-8">
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
                  {searchQuery && alternativeMatches.length > 0
                    ? (isUa
                      ? `У каталозі Öhlins немає результатів за "${searchQuery}", але є збіги в інших брендах.`
                      : `No Öhlins results for "${searchQuery}", but there are matches from other brands.`)
                    : searchQuery
                      ? (isUa
                        ? `У каталозі Öhlins немає результатів за "${searchQuery}". Спробуйте марку авто, SKU або продуктовий тип.`
                        : `No Öhlins results for "${searchQuery}". Try a vehicle make, SKU, or product type.`)
                    : (isUa ? "Компоненти для цієї комбінації відсутні." : "Components for this combination are currently unavailable.")}
                </p>

                {alternativeMatches.length > 0 ? (
                  <div className="mb-8 w-full max-w-3xl text-left">
                    <div className="mb-3 flex items-center justify-between gap-4">
                      <p className="text-[10px] font-light uppercase tracking-[0.24em]" style={{ color: GOLD }}>
                        {isUa ? "Альтернативи" : "Alternatives"}
                      </p>
                      <p className="text-[10px] font-light uppercase tracking-[0.18em] text-zinc-600">
                        {alternativeMatches.length} {isUa ? "збігів" : "matches"}
                      </p>
                    </div>
                    <div className="border-y border-white/10">
                      {alternativeMatches.map((item) => {
                        const alternativeTitle = item.title[locale] || item.title.en || item.title.ua;
                        return (
                          <Link
                            key={item.slug}
                            href={item.href}
                            className="grid min-h-[88px] grid-cols-[64px_1fr] items-center gap-4 border-b border-white/10 py-4 transition-colors last:border-b-0 hover:bg-white/[0.03] sm:grid-cols-[72px_1fr_auto]"
                          >
                            <div className="relative h-16 w-16 overflow-hidden bg-black/50">
                              {item.image ? (
                                <div
                                  aria-label={alternativeTitle}
                                  className="absolute inset-2 bg-contain bg-center bg-no-repeat opacity-85"
                                  role="img"
                                  style={{ backgroundImage: `url(${item.image})` }}
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center border border-white/5 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                                  {item.brand.slice(0, 3)}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: GOLD }}>
                                {item.brand}
                              </p>
                              <h4 className="mt-1 line-clamp-2 text-sm font-light leading-snug text-zinc-200">
                                {alternativeTitle}
                              </h4>
                              {item.sku ? (
                                <p className="mt-1 truncate text-[10px] uppercase tracking-[0.12em] text-zinc-600">
                                  {item.sku}
                                </p>
                              ) : null}
                            </div>
                            <span
                              className="col-span-2 inline-flex items-center justify-center gap-2 border px-4 py-2 text-[10px] font-light uppercase tracking-[0.24em] transition-colors sm:col-span-1"
                              style={{ borderColor: `${GOLD}50`, color: GOLD }}
                            >
                              {isUa ? "Дивитися" : "View"}
                              <ArrowRight size={12} strokeWidth={2} />
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <button
                  onClick={resetFilters}
                  className="px-8 py-3.5 text-black text-[12px] uppercase tracking-widest font-bold rounded-[2px] transition-all duration-300"
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
                            <div className="absolute inset-0 p-8">
                              <Image
                                src="/images/shop/ohlins/catalog-fallback.jpg"
                                alt={productTitle}
                                fill
                                sizes="(max-width: 768px) 100vw, 33vw"
                                className="object-contain opacity-70 transition-transform group-hover:scale-105 group-hover:opacity-90"
                                style={{ transitionDuration: '1s' }}
                              />
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
                                {priceData.eur ? <span className={currency === "EUR" ? "text-zinc-400" : ""}>{priceData.eur}</span> : null}
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
