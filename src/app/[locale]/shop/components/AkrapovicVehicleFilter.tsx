"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, X, ChevronDown, SlidersHorizontal, ArrowRight } from "lucide-react";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct } from "@/lib/shopCatalog";
import {
  computeShopDisplayPrices,
  hasAnyShopPrice,
  pickShopSortableAmount,
} from "@/lib/shopDisplayPrices";
import { localizeShopProductTitle } from "@/lib/shopText";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";
import { useShopViewerContext } from "@/lib/useShopViewerContext";
import AkrapovicSpotlightGrid from "./AkrapovicSpotlightGrid";
import { useMobileFilterDrawer } from "./useMobileFilterDrawer";
import {
  BRAND_PATTERNS,
  LINE_PATTERNS,
  extractVehicleBrands,
  extractProductLine,
  extractVehicleModelsForBrand,
  extractVehicleModelNamesForBrand,
  extractChassisForBrandAndModel,
  compareVehicleModelKeys,
} from "@/lib/akrapovicFilterUtils";

type AkrapovicVehicleFilterProps = {
  locale: SupportedLocale;
  products: ShopProduct[];
  viewerContext?: ShopViewerPricingContext;
  productPathPrefix: string;
  filterOnly?: boolean;
  heroCompact?: boolean;
};

type SortOrder = "default" | "price_desc" | "price_asc";
const PAGE_SIZE = 30;

/* Brand/line constants imported from @/lib/akrapovicFilterUtils */

function formatPrice(locale: SupportedLocale, amount: number, currency: "EUR" | "USD" | "UAH") {
  const formatter = new Intl.NumberFormat(locale === "ua" ? "uk-UA" : "en-US", {
    maximumFractionDigits: 0,
  });
  const formatted = formatter.format(amount);
  if (locale === "ua" && currency === "UAH") return `${formatted} грн`;
  return locale === "ua" ? `${formatted} ${currency}` : `${currency} ${formatted}`;
}

function computeDisplayPrices(
  price: ShopProduct["price"],
  rates: { EUR: number; USD: number; UAH?: number } | null
) {
  return computeShopDisplayPrices(price, rates);
}

export default function AkrapovicVehicleFilter({
  locale,
  products,
  viewerContext: ssrViewerContext,
  productPathPrefix,
  filterOnly = false,
  heroCompact = false,
}: AkrapovicVehicleFilterProps) {
  // SSR receives an anonymous viewer context (so the page is ISR-cached);
  // the live B2B-aware context is hydrated client-side from the session.
  const viewerContext = useShopViewerContext(ssrViewerContext);
  const isUa = locale === "ua";
  const { currency, rates } = useShopCurrency();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [activeBrand, setActiveBrand] = useState<string>(() => searchParams.get("brand") || "all");
  const [activeModel, setActiveModel] = useState<string>(() => searchParams.get("model") || "all");
  const [activeBody, setActiveBody] = useState<string>(() => searchParams.get("body") || "all");
  const [activeLine, setActiveLine] = useState<string>(() => searchParams.get("line") || "all");
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("q") || "");
  const [sortOrder, setSortOrder] = useState<SortOrder>("default");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const { mobileFilterOpen, closeMobileFilter, toggleMobileFilter } = useMobileFilterDrawer();
  const didInitializeBrand = useRef(false);
  const didInitializeModel = useRef(false);

  const productBrandMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of products) {
      const title = p.title?.en || localizeShopProductTitle("en", p);
      const brands = extractVehicleBrands(title);
      if (brands.length > 0) map.set(p.slug, brands);
    }
    return map;
  }, [products]);

  const availableBrands = useMemo(() => {
    const counts = new Map<string, number>();
    for (const brands of productBrandMap.values()) {
      for (const brand of brands) {
        counts.set(brand, (counts.get(brand) || 0) + 1);
      }
    }
    const brandOrder = BRAND_PATTERNS.map((b) => b.key);
    return [...counts.entries()]
      .sort(
        (a, b) =>
          (brandOrder.indexOf(a[0]) === -1 ? 99 : brandOrder.indexOf(a[0])) -
          (brandOrder.indexOf(b[0]) === -1 ? 99 : brandOrder.indexOf(b[0]))
      )
      .map(([key, count]) => ({ key, label: key, count }));
  }, [productBrandMap]);

  const availableLines = useMemo(() => {
    const lines = new Map<string, number>();
    for (const p of products) {
      if (activeBrand !== "all" && !productBrandMap.get(p.slug)?.includes(activeBrand)) continue;
      const title = p.title?.en || localizeShopProductTitle("en", p);
      const line = extractProductLine(title);
      if (line) lines.set(line, (lines.get(line) || 0) + 1);
    }
    return [...lines.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({
        key,
        label: LINE_PATTERNS.find((l) => l.key === key)?.label ?? key,
        count,
      }));
  }, [activeBrand, products, productBrandMap]);

  const availableModels = useMemo(() => {
    if (activeBrand === "all") return [];
    const models = new Map<string, number>();
    for (const p of products) {
      if (!productBrandMap.get(p.slug)?.includes(activeBrand)) continue;
      const title = p.title?.en || localizeShopProductTitle("en", p);
      for (const model of extractVehicleModelNamesForBrand(title, activeBrand)) {
        if (model) models.set(model, (models.get(model) || 0) + 1);
      }
    }
    return [...models.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, count]) => ({ key, label: key, count }));
  }, [activeBrand, products, productBrandMap]);

  const availableBodies = useMemo(() => {
    if (activeBrand === "all") return [];
    const bodies = new Map<string, number>();
    for (const p of products) {
      if (!productBrandMap.get(p.slug)?.includes(activeBrand)) continue;
      const title = p.title?.en || localizeShopProductTitle("en", p);
      if (
        activeModel !== "all" &&
        !extractVehicleModelNamesForBrand(title, activeBrand).includes(activeModel)
      )
        continue;
      // When a model is selected, attribute chassis per-segment so that products
      // covering multiple models don't leak (e.g. BMW M2 (F87) / M3 (G80) only
      // contributes F87 under M2 and G80 under M3).
      const codes =
        activeModel !== "all"
          ? extractChassisForBrandAndModel(title, activeBrand, activeModel)
          : extractVehicleModelsForBrand(title, activeBrand);
      for (const body of codes) {
        if (body && body !== "Other") bodies.set(body, (bodies.get(body) || 0) + 1);
      }
    }
    return [...bodies.entries()]
      .sort((a, b) => compareVehicleModelKeys(a[0], b[0]))
      .map(([key, count]) => ({ key, label: key, count }));
  }, [activeBrand, activeModel, products, productBrandMap]);

  useEffect(() => {
    if (!didInitializeBrand.current) {
      didInitializeBrand.current = true;
      return;
    }
    setActiveLine("all");
    setActiveModel("all");
    setActiveBody("all");
  }, [activeBrand]);

  useEffect(() => {
    if (!didInitializeModel.current) {
      didInitializeModel.current = true;
      return;
    }
    setActiveBody("all");
  }, [activeModel]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeBrand, activeModel, activeBody, activeLine, searchQuery, sortOrder]);

  const filteredProducts = useMemo(() => {
    let result = products;
    if (activeBrand !== "all")
      result = result.filter((p) => productBrandMap.get(p.slug)?.includes(activeBrand));
    if (activeModel !== "all" && activeBrand !== "all")
      result = result.filter((p) => {
        const t = p.title?.en || localizeShopProductTitle("en", p);
        return extractVehicleModelNamesForBrand(t, activeBrand).includes(activeModel);
      });
    if (activeBody !== "all" && activeBrand !== "all")
      result = result.filter((p) => {
        const t = p.title?.en || localizeShopProductTitle("en", p);
        const codes =
          activeModel !== "all"
            ? extractChassisForBrandAndModel(t, activeBrand, activeModel)
            : extractVehicleModelsForBrand(t, activeBrand);
        return codes.includes(activeBody);
      });
    if (activeLine !== "all")
      result = result.filter((p) => {
        const t = p.title?.en || localizeShopProductTitle("en", p);
        return extractProductLine(t) === activeLine;
      });
    if (searchQuery.trim()) {
      const words = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
      result = result.filter((p) => {
        const haystack = [
          localizeShopProductTitle(locale, p),
          p.title?.en || "",
          p.title?.ua || "",
          p.shortDescription?.en || "",
          p.shortDescription?.ua || "",
          p.longDescription?.en || "",
          p.longDescription?.ua || "",
          p.category?.en || "",
          p.category?.ua || "",
          p.sku || "",
          ...(p.tags || []),
        ]
          .join(" ")
          .toLowerCase();
        return words.every((w) => haystack.includes(w));
      });
    }
    result = [...result].sort((a, b) => {
      const priceA = pickShopSortableAmount(
        viewerContext ? resolveShopProductPricing(a, viewerContext).effectivePrice : a.price,
        currency,
        rates && { EUR: rates.EUR, USD: rates.USD, UAH: rates.UAH }
      );
      const priceB = pickShopSortableAmount(
        viewerContext ? resolveShopProductPricing(b, viewerContext).effectivePrice : b.price,
        currency,
        rates && { EUR: rates.EUR, USD: rates.USD, UAH: rates.UAH }
      );
      if (sortOrder === "price_desc") return priceB - priceA;
      if (sortOrder === "price_asc") return priceA - priceB;
      const hasImgA = a.image && a.image.length > 5 ? 1 : 0;
      const hasImgB = b.image && b.image.length > 5 ? 1 : 0;
      if (hasImgA !== hasImgB) return hasImgB - hasImgA;
      return priceB - priceA;
    });
    return result;
  }, [
    activeBrand,
    activeModel,
    activeBody,
    activeLine,
    searchQuery,
    sortOrder,
    products,
    productBrandMap,
    locale,
    viewerContext,
    currency,
    rates,
  ]);

  const totalCount = products.length;
  const displayedProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount]
  );

  const hasActiveFilters =
    activeBrand !== "all" ||
    activeLine !== "all" ||
    activeModel !== "all" ||
    activeBody !== "all" ||
    searchQuery.trim() !== "";
  const catalogHref = useMemo(() => {
    const params = new URLSearchParams();
    if (activeBrand !== "all") params.set("brand", activeBrand);
    if (activeModel !== "all") params.set("model", activeModel);
    if (activeBody !== "all") params.set("body", activeBody);
    if (activeLine !== "all") params.set("line", activeLine);
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    const query = params.toString();
    return `/${locale}/shop/akrapovic/collections${query ? `?${query}` : ""}`;
  }, [activeBrand, activeModel, activeBody, activeLine, searchQuery, locale]);

  if (!mounted) return null;

  if (filterOnly && heroCompact) {
    return (
      <div
        className="ak-hero-filter"
        role="search"
        aria-label={isUa ? "Підбір Akrapovič" : "Akrapovič finder"}
      >
        <div className="ak-hero-filter__select-wrap">
          <select
            value={activeBrand}
            onChange={(e) => setActiveBrand(e.target.value)}
            className="ak-hero-filter__field"
            aria-label={isUa ? "Оберіть марку" : "Choose brand"}
          >
            <option value="all">{isUa ? "Оберіть марку" : "Choose brand"}</option>
            {availableBrands.map((brand) => (
              <option key={brand.key} value={brand.key}>
                {brand.label}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="ak-hero-filter__chevron" />
        </div>

        <div className="ak-hero-filter__select-wrap">
          <select
            value={activeModel}
            onChange={(e) => setActiveModel(e.target.value)}
            className="ak-hero-filter__field"
            aria-label={isUa ? "Оберіть модель" : "Choose model"}
            disabled={activeBrand === "all" || availableModels.length === 0}
          >
            <option value="all">{isUa ? "Оберіть модель" : "Choose model"}</option>
            {availableModels.map((model) => (
              <option key={model.key} value={model.key}>
                {model.label}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="ak-hero-filter__chevron" />
        </div>

        <div className="ak-hero-filter__select-wrap">
          <select
            value={activeBody}
            onChange={(e) => setActiveBody(e.target.value)}
            className="ak-hero-filter__field"
            aria-label={isUa ? "Оберіть кузов" : "Choose chassis"}
            disabled={activeBrand === "all" || availableBodies.length === 0}
          >
            <option value="all">{isUa ? "Оберіть кузов" : "Choose chassis"}</option>
            {availableBodies.map((body) => (
              <option key={body.key} value={body.key}>
                {body.label}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="ak-hero-filter__chevron" />
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="ak-hero-filter__field ak-hero-filter__search"
          placeholder="BMW F10, Slip-On…"
          aria-label={isUa ? "Пошук" : "Search"}
        />

        <Link href={catalogHref} className="ak-hero-filter__cta">
          {isUa ? `Показати ${filteredProducts.length}` : `Show ${filteredProducts.length}`}
          <ArrowRight size={13} aria-hidden />
        </Link>
      </div>
    );
  }

  /* ── Shared select-style CSS for dark dropdowns ── */
  const selectCls =
    "appearance-none bg-[#0a0a0a] border border-white/10 text-white text-xs px-4 py-2.5 pr-9 rounded-lg outline-hidden focus:border-[#e50000]/50 cursor-pointer w-full";

  /* ── Filter dropdowns (reused in desktop bar & mobile drawer) ── */
  const filterDropdowns = () => (
    <>
      {/* Brand select */}
      <div>
        <label className="text-[10px] text-white/50 uppercase tracking-widest mb-1.5 font-medium block">
          {isUa ? "Марка авто" : "Vehicle Brand"}
        </label>
        <div className="relative">
          <select
            value={activeBrand}
            onChange={(e) => setActiveBrand(e.target.value)}
            className={selectCls}
          >
            <option value="all">
              {isUa ? `Всі марки (${totalCount})` : `All Brands (${totalCount})`}
            </option>
            {availableBrands.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label} ({b.count})
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40"
          />
        </div>
      </div>

      {/* Model select (marketing name: 911, M3, RS6, Cayenne…) */}
      {availableModels.length > 0 && (
        <div>
          <label className="text-[10px] text-white/50 uppercase tracking-widest mb-1.5 font-medium block">
            {isUa ? "Модель" : "Model"}
          </label>
          <div className="relative">
            <select
              value={activeModel}
              onChange={(e) => setActiveModel(e.target.value)}
              className={selectCls}
            >
              <option value="all">{isUa ? "Всі моделі" : "All Models"}</option>
              {availableModels.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label} ({m.count})
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40"
            />
          </div>
        </div>
      )}

      {/* Body / Chassis select (generation code: 992, G80, C8…) */}
      {availableBodies.length > 0 && (
        <div>
          <label className="text-[10px] text-white/50 uppercase tracking-widest mb-1.5 font-medium block">
            {isUa ? "Кузов" : "Chassis"}
          </label>
          <div className="relative">
            <select
              value={activeBody}
              onChange={(e) => setActiveBody(e.target.value)}
              className={selectCls}
            >
              <option value="all">{isUa ? "Всі кузови" : "All Chassis"}</option>
              {availableBodies.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label} ({b.count})
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40"
            />
          </div>
        </div>
      )}

      {/* Product line select */}
      {availableLines.length > 0 && (
        <div>
          <label className="text-[10px] text-white/50 uppercase tracking-widest mb-1.5 font-medium block">
            {isUa ? "Тип продукції" : "Product Type"}
          </label>
          <div className="relative">
            <select
              value={activeLine}
              onChange={(e) => setActiveLine(e.target.value)}
              className={selectCls}
            >
              <option value="all">{isUa ? "Всі типи" : "All Types"}</option>
              {availableLines.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label} ({l.count})
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40"
            />
          </div>
        </div>
      )}
    </>
  );

  return (
    <section
      id="catalog"
      className={`bg-transparent text-white relative z-30 ${filterOnly ? "" : "min-h-screen"}`}
    >
      <div
        className={`max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 ${filterOnly ? "pb-8 pt-4" : "pb-20 pt-4"}`}
      >
        {/* ═══ DESKTOP: Horizontal top filter bar ═══ */}
        <div className="hidden lg:flex flex-col gap-4 mb-8 bg-[#050505]/70 backdrop-blur-md border border-white/4 rounded-2xl p-5 shadow-2xl">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-light tracking-widest uppercase whitespace-nowrap">
                {filterOnly
                  ? isUa
                    ? "Підбір системи"
                    : "System Finder"
                  : isUa
                    ? "Каталог"
                    : "Catalog"}
              </h2>
              <span className="text-white/40 text-xs tracking-wide whitespace-nowrap">
                {filteredProducts.length} {isUa ? "з" : "of"} {totalCount}
              </span>
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setActiveBrand("all");
                    setActiveLine("all");
                    setActiveModel("all");
                    setActiveBody("all");
                    setSearchQuery("");
                    setSortOrder("default");
                  }}
                  className="text-[10px] uppercase tracking-widest text-[#e50000] hover:text-white transition-colors font-medium whitespace-nowrap"
                >
                  {isUa ? "Скинути" : "Reset"}
                </button>
              )}
            </div>
            <div className="relative w-[260px]">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isUa ? "BMW F10, Slip-On, 911..." : "BMW F10, Slip-On, 911..."}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg pl-9 pr-8 py-2.5 text-xs text-white placeholder-white/30 focus:outline-hidden focus:border-[#e50000]/50 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
          {/* Dropdown row */}
          <div className="grid gap-4 grid-cols-5">
            {filterDropdowns()}
            {filterOnly ? (
              <div className="flex items-end">
                <Link
                  href={catalogHref}
                  className="w-full flex items-center justify-center gap-2 bg-[#e50000] text-white text-[10px] uppercase tracking-[0.28em] font-semibold px-5 py-3 rounded-lg hover:bg-white hover:text-black transition-colors"
                >
                  {isUa ? "Показати" : "Show"} {filteredProducts.length}
                  <ArrowRight size={13} />
                </Link>
              </div>
            ) : (
              <div>
                <label className="text-[10px] text-white/50 uppercase tracking-widest mb-1.5 font-medium block">
                  {isUa ? "Сортування" : "Sort"}
                </label>
                <div className="relative">
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                    className={selectCls}
                  >
                    <option value="default">{isUa ? "За замовчуванням" : "Default"}</option>
                    <option value="price_desc">{isUa ? "Ціна ↓" : "Price ↓"}</option>
                    <option value="price_asc">{isUa ? "Ціна ↑" : "Price ↑"}</option>
                  </select>
                  <ChevronDown
                    size={14}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ MOBILE: Burger button + sort ═══ */}
        <div className="lg:hidden sticky top-[72px] z-30 -mx-3 mb-5 flex items-center justify-between gap-3 border-y border-white/6 bg-black/75 px-3 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleMobileFilter}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#050505]/80 backdrop-blur-md border border-white/8 rounded-lg text-white text-[10px] uppercase tracking-[0.15em] font-semibold hover:border-[#e50000]/40 transition-colors shadow-xl"
            >
              <SlidersHorizontal size={13} />
              {isUa ? "Фільтри" : "Filters"}
              {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-[#e50000] ml-1" />}
            </button>
            <span className="text-white/40 text-xs">
              {filteredProducts.length} / {totalCount}
            </span>
          </div>
          {filterOnly ? (
            <Link
              href={catalogHref}
              className="px-4 py-2.5 bg-[#e50000] text-white text-[10px] uppercase tracking-[0.15em] font-semibold rounded-lg"
            >
              {isUa ? "Показати" : "Show"}
            </Link>
          ) : (
            <div className="relative">
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className="appearance-none bg-[#050505]/80 border border-white/10 text-white text-[10px] uppercase tracking-[0.15em] font-semibold px-4 py-2.5 pr-8 rounded-lg outline-hidden cursor-pointer"
              >
                <option value="default">{isUa ? "Сортування" : "Sort"}</option>
                <option value="price_desc">{isUa ? "Ціна ↓" : "Price ↓"}</option>
                <option value="price_asc">{isUa ? "Ціна ↑" : "Price ↑"}</option>
              </select>
              <ChevronDown
                size={12}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-white/50"
              />
            </div>
          )}
        </div>

        {/* ═══ MOBILE: Drawer overlay ═══ */}
        {mobileFilterOpen && (
          <div className="lg:hidden fixed inset-0 z-40 bg-black/60" onClick={closeMobileFilter} />
        )}
        <div
          className={`lg:hidden fixed inset-y-0 left-0 z-50 w-[88vw] max-w-[360px] bg-[#050505] border-r border-white/8 shadow-2xl transform transition-transform duration-300 ${mobileFilterOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex flex-col gap-5 h-full overflow-y-auto px-5 py-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-light tracking-widest uppercase">
                {isUa ? "Фільтри" : "Filters"}
              </h2>
              <button onClick={closeMobileFilter} className="p-1.5 text-white/40 hover:text-white">
                <X size={18} />
              </button>
            </div>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setActiveBrand("all");
                  setActiveLine("all");
                  setActiveModel("all");
                  setActiveBody("all");
                  setSearchQuery("");
                  closeMobileFilter();
                }}
                className="text-[10px] uppercase tracking-widest text-[#e50000] hover:text-white transition-colors font-medium self-start"
              >
                {isUa ? "Скинути все" : "Reset All"}
              </button>
            )}
            {/* Search */}
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isUa ? "BMW F10, Slip-On..." : "BMW F10, Slip-On..."}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg pl-9 pr-8 py-2.5 text-xs text-white placeholder-white/30 focus:outline-hidden focus:border-[#e50000]/50 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {filterDropdowns()}
          </div>
        </div>

        {/* ═══ DESKTOP: Sort row (hidden, sort is in top bar) ═══ */}

        {filterOnly ? null : (
          <>
            {/* ═══ Product Grid ═══ */}
            {filteredProducts.length === 0 ? (
              <div className="py-32 text-center bg-black/40 backdrop-blur-xs border border-white/5 rounded-2xl flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6">
                  <Search className="w-6 h-6 text-white/20" />
                </div>
                <h3 className="text-xl font-light text-white mb-3">
                  {isUa ? "Нічого не знайдено" : "No Components Found"}
                </h3>
                <p className="text-white/50 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                  {searchQuery
                    ? isUa
                      ? `Нічого не знайдено за запитом "${searchQuery}"`
                      : `No results for "${searchQuery}"`
                    : isUa
                      ? "Продукція відсутня."
                      : "Components are currently unavailable."}
                </p>
                <button
                  onClick={() => {
                    setActiveBrand("all");
                    setActiveLine("all");
                    setActiveModel("all");
                    setActiveBody("all");
                    setSearchQuery("");
                    setSortOrder("default");
                  }}
                  className="px-8 py-3 bg-[#e50000]/15 border border-[#e50000]/40 text-white text-[10px] uppercase tracking-widest hover:bg-[#e50000]/25 hover:border-[#e50000]/70 transition-all duration-500 rounded-md font-medium"
                >
                  {isUa ? "Скинути фільтри" : "Reset Filters"}
                </button>
              </div>
            ) : (
              <>
                <AkrapovicSpotlightGrid className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
                  {displayedProducts.map((product) => {
                    const pricing = viewerContext
                      ? resolveShopProductPricing(product, viewerContext)
                      : {
                          effectivePrice: product.price,
                          effectiveCompareAt: product.compareAt,
                          audience: "b2c",
                          b2bVisible: false,
                        };
                    const displayRates = rates && {
                      EUR: rates.EUR,
                      USD: rates.USD,
                      UAH: rates.UAH,
                    };
                    const computed = computeDisplayPrices(pricing.effectivePrice, displayRates);
                    const hasPrice = hasAnyShopPrice(pricing.effectivePrice, displayRates);
                    const primaryPrice =
                      currency === "USD" && computed.usd > 0
                        ? formatPrice(locale, computed.usd, "USD")
                        : currency === "EUR" && computed.eur > 0
                          ? formatPrice(locale, computed.eur, "EUR")
                          : currency === "UAH" && computed.uah > 0
                            ? formatPrice(locale, computed.uah, "UAH")
                            : computed.uah > 0
                              ? formatPrice(locale, computed.uah, "UAH")
                              : computed.usd > 0
                                ? formatPrice(locale, computed.usd, "USD")
                                : computed.eur > 0
                                  ? formatPrice(locale, computed.eur, "EUR")
                                  : null;
                    const productTitle = localizeShopProductTitle(locale, product);
                    return (
                      <article
                        key={product.slug}
                        className="group relative bg-[#050505]/60 backdrop-blur-xl overflow-hidden flex flex-col hover:bg-[rgba(10,10,10,0.85)] transition-all duration-500 border border-white/4 shadow-2xl"
                      >
                        <Link
                          href={`${productPathPrefix}/${product.slug}`}
                          className="flex flex-col grow z-10"
                        >
                          <div className="relative aspect-square sm:aspect-4/3 bg-transparent overflow-hidden flex items-center justify-center p-2.5 sm:p-6 border-b border-white/2">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(229,0,0,0.1)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                            {product.image && product.image.length > 5 ? (
                              <Image
                                src={product.image}
                                alt={productTitle}
                                fill
                                sizes="(max-width: 768px) 100vw, 25vw"
                                className="object-contain p-2 sm:p-5 md:p-6 drop-shadow-2xl transition-transform duration-700 group-hover:scale-110 relative z-10"
                                onError={(e) => {
                                  const img = e.target as HTMLImageElement;
                                  img.style.display = "none";
                                  const fallback = img.parentElement?.querySelector(
                                    ".fallback-img"
                                  ) as HTMLImageElement | null;
                                  if (fallback) fallback.style.display = "block";
                                }}
                              />
                            ) : null}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src="/images/shop/akrapovic/factory-fallback.jpg"
                              alt=""
                              className={`absolute inset-0 w-full h-full object-contain p-4 sm:p-8 opacity-30 fallback-img ${product.image && product.image.length > 5 ? "hidden" : "block"}`}
                            />
                          </div>
                          <div className="px-3 pb-3 pt-3 sm:px-5 sm:pb-5 sm:pt-4 flex flex-col grow">
                            <p className="text-[8px] sm:text-[9px] uppercase tracking-[0.16em] sm:tracking-[0.2em] font-bold text-[#e50000] mb-1.5">
                              {product.brand}
                            </p>
                            <h3 className="text-[11px] sm:text-[13px] font-light leading-snug text-white line-clamp-3 sm:line-clamp-2 mb-2 sm:mb-3">
                              {productTitle}
                            </h3>
                            <div className="mt-auto">
                              {!hasPrice || !primaryPrice ? (
                                <span className="text-[9px] sm:text-[11px] tracking-wider uppercase font-medium text-white/50">
                                  {isUa ? "Ціна за запитом" : "Price on Request"}
                                </span>
                              ) : (
                                <span className="text-[11px] sm:text-sm tracking-wider sm:tracking-widest font-light text-white">
                                  {primaryPrice}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent via-[#e50000] to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                        </Link>
                        <div className="px-3 pb-3 pt-0 sm:px-5 sm:pb-5 z-20 relative flex gap-2">
                          <Link
                            href={`${productPathPrefix}/${product.slug}`}
                            className="flex-1 flex min-w-0 items-center justify-center gap-1.5 py-2 sm:py-2.5 border border-[#e50000]/30 text-[9px] sm:text-[10px] tracking-widest sm:tracking-[0.3em] uppercase font-light text-[#e50000] hover:text-white hover:bg-[#e50000] hover:border-[#e50000] transition-all duration-300"
                          >
                            {isUa ? "Деталі" : "View"}{" "}
                            <ArrowRight
                              size={11}
                              strokeWidth={2}
                              className="hidden min-[390px]:block"
                            />
                          </Link>
                          <AddToCartButton
                            slug={product.slug}
                            variantId={null}
                            locale={locale}
                            redirect={true}
                            productName={productTitle}
                            label={isUa ? "КОШИК" : "CART"}
                            labelAdded={isUa ? "✓" : "✓"}
                            className="flex-1 flex min-w-0 items-center justify-center py-2 sm:py-2.5 border border-white/10 text-[9px] sm:text-[10px] tracking-widest sm:tracking-[0.3em] uppercase font-light text-white hover:text-black hover:bg-white hover:border-white transition-all duration-300"
                            variant="inline"
                          />
                        </div>
                      </article>
                    );
                  })}
                </AkrapovicSpotlightGrid>
                {visibleCount < filteredProducts.length ? (
                  <div className="mt-8 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
                      className="rounded-full border border-[#e50000]/35 bg-[#e50000]/10 px-7 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition hover:border-[#e50000]/70 hover:bg-[#e50000]/20"
                    >
                      {isUa ? "Показати ще" : "Show more"} ({filteredProducts.length - visibleCount}
                      )
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
