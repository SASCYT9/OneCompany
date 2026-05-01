"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Search, X, ChevronDown, SlidersHorizontal, ArrowRight, Zap } from "lucide-react";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct } from "@/lib/shopCatalog";
import { localizeShopProductTitle } from "@/lib/shopText";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { useShopViewerContext } from "@/lib/useShopViewerContext";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { useMobileFilterDrawer } from "./useMobileFilterDrawer";
import RacechipSelect from "./RacechipSelect";
import {
  formatRacechipMake,
  formatRacechipModelLabel,
  formatRacechipEngine,
} from "@/lib/racechipFormat";

type Props = {
  locale: SupportedLocale;
  products: ShopProduct[];
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

export default function RacechipVehicleFilter({
  locale,
  products,
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

  // Restore filter state from URL params on mount
  const initialMake = searchParams?.get("make") || "all";
  const initialModel = searchParams?.get("model") || "all";
  const initialEngine = searchParams?.get("engine") || "all";
  const initialSort = (searchParams?.get("sort") as "default" | "price_desc" | "price_asc") || "default";

  const [activeMake, setActiveMake] = useState<string>(initialMake);
  const [activeModel, setActiveModel] = useState<string>(initialModel);
  const [activeEngine, setActiveEngine] = useState<string>(initialEngine);
  const [sortOrder, setSortOrder] = useState<"default" | "price_desc" | "price_asc">(initialSort);
  const { mobileFilterOpen, closeMobileFilter, toggleMobileFilter } = useMobileFilterDrawer();
  const previousMakeRef = useRef(activeMake);
  const previousModelRef = useRef(activeModel);

  // Pagination to restrict the number of visible DOM elements
  const [visibleCount, setVisibleCount] = useState(30);

  // Sync filter state to URL search params (shallow, no re-render of server component)
  const syncToUrl = useCallback((make: string, model: string, engine: string, sort: string) => {
    const params = new URLSearchParams();
    if (make !== "all") params.set("make", make);
    if (model !== "all") params.set("model", model);
    if (engine !== "all") params.set("engine", engine);
    if (sort !== "default") params.set("sort", sort);
    const qs = params.toString();
    const newPath = qs ? `${pathname}?${qs}` : pathname || "";
    router.replace(newPath, { scroll: false });
  }, [pathname, router]);

  // Debounced URL sync (kept debounced for batching though no per-keystroke source remains)
  useEffect(() => {
    const timeout = setTimeout(() => {
      syncToUrl(activeMake, activeModel, activeEngine, sortOrder);
    }, 100);
    return () => clearTimeout(timeout);
  }, [activeMake, activeModel, activeEngine, sortOrder, syncToUrl]);

  // Reset visible limit whenever a filter changes
  useEffect(() => {
    setVisibleCount(30);
  }, [activeMake, activeModel, activeEngine, sortOrder]);

  // 1. EXTRACT ALL MAKES
  const availableMakes = useMemo(() => {
    const makes = new Map<string, number>();
    for (const p of products) {
      for (const tag of p.tags || []) {
        if (tag.startsWith("car_make:")) {
          const make = tag.slice(9);
          makes.set(make, (makes.get(make) || 0) + 1);
        }
      }
    }
    return [...makes.entries()]
      .map(([key, count]) => ({ key, label: formatRacechipMake(key), count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [products]);

  // 2. EXTRACT ALL MODELS FOR THE GIVEN MAKE
  const availableModels = useMemo(() => {
    if (activeMake === "all") return [];
    const models = new Map<string, number>();
    for (const p of products) {
        if (!p.tags?.includes(`car_make:${activeMake}`)) continue;

        for (const tag of p.tags || []) {
            if (tag.startsWith("car_model:")) {
            const model = tag.slice(10);
            models.set(model, (models.get(model) || 0) + 1);
            }
        }
    }
    return [...models.entries()]
      .map(([key, count]) => ({ key, label: formatRacechipModelLabel(key), count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [products, activeMake]);

  // 3. EXTRACT ENGINES FOR THE GIVEN MAKE+MODEL
  const availableEngines = useMemo(() => {
    if (activeMake === "all" || activeModel === "all") return [];
    const engines = new Map<string, number>();
    for (const p of products) {
      if (!p.tags?.includes(`car_make:${activeMake}`)) continue;
      if (!p.tags?.includes(`car_model:${activeModel}`)) continue;
      for (const tag of p.tags || []) {
        if (tag.startsWith("car_engine:")) {
          const engine = tag.slice(11);
          engines.set(engine, (engines.get(engine) || 0) + 1);
        }
      }
    }
    return [...engines.entries()]
      .map(([key, count]) => ({ key, label: formatRacechipEngine(key), count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [products, activeMake, activeModel]);

  // Cascading reset: changing make resets model + engine; changing model resets engine.
  useEffect(() => {
    if (previousMakeRef.current === activeMake) return;
    previousMakeRef.current = activeMake;
    setActiveModel("all");
    setActiveEngine("all");
  }, [activeMake]);

  useEffect(() => {
    if (previousModelRef.current === activeModel) return;
    previousModelRef.current = activeModel;
    setActiveEngine("all");
  }, [activeModel]);

  // 4. FILTER RESULTS
  const filtered = useMemo(() => {
    let list = products;

    if (activeMake !== "all") {
      list = list.filter(p => p.tags?.includes(`car_make:${activeMake}`));
    }
    if (activeModel !== "all") {
      list = list.filter(p => p.tags?.includes(`car_model:${activeModel}`));
    }
    if (activeEngine !== "all") {
      list = list.filter(p => p.tags?.includes(`car_engine:${activeEngine}`));
    }

    list = [...list].sort((a, b) => {
      const priceA = a.price?.eur || 0;
      const priceB = b.price?.eur || 0;
      if (sortOrder === "price_asc") return priceA - priceB;
      if (sortOrder === "price_desc") return priceB - priceA;
      return 0; // Default leaves it as DB imported order (usually by engine size)
    });

    return list;
  }, [products, activeMake, activeModel, activeEngine, sortOrder]);

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

  const hasActiveFilters =
    activeMake !== "all" ||
    activeModel !== "all" ||
    activeEngine !== "all" ||
    sortOrder !== "default";

  function resetFilters() {
    setActiveMake("all");
    setActiveModel("all");
    setActiveEngine("all");
    setSortOrder("default");
  }

  const filterControls = (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <RacechipSelect
          label={isUa ? "Марка" : "Make"}
          placeholder={isUa ? "Виберіть марку" : "Select make"}
          value={activeMake === "all" ? "" : activeMake}
          options={availableMakes.map((m) => ({ value: m.key, label: m.label, count: m.count }))}
          onChange={(v) => setActiveMake(v || "all")}
        />

        <RacechipSelect
          label={isUa ? "Модель" : "Model"}
          placeholder={
            activeMake === "all"
              ? isUa ? "Спочатку марка" : "Pick make first"
              : isUa ? "Виберіть модель" : "Select model"
          }
          value={activeModel === "all" ? "" : activeModel}
          options={availableModels.map((m) => ({ value: m.key, label: m.label, count: m.count }))}
          disabled={activeMake === "all" || availableModels.length === 0}
          onChange={(v) => setActiveModel(v || "all")}
        />

        <RacechipSelect
          label={isUa ? "Двигун" : "Engine"}
          placeholder={
            activeMake === "all" || activeModel === "all"
              ? isUa ? "Спочатку модель" : "Pick model first"
              : isUa ? "Виберіть двигун" : "Select engine"
          }
          value={activeEngine === "all" ? "" : activeEngine}
          options={availableEngines.map((e) => ({ value: e.key, label: e.label, count: e.count }))}
          disabled={activeMake === "all" || activeModel === "all" || availableEngines.length === 0}
          onChange={(v) => setActiveEngine(v || "all")}
        />

        <div className="relative border border-white/20 transition-colors hover:border-[#ff4a00]/50 self-end">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500">
            <SlidersHorizontal size={14} strokeWidth={1.5} />
          </div>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "default" | "price_desc" | "price_asc")}
            className="appearance-none w-full h-[2.875rem] rounded-none bg-[#080808] pl-12 pr-10 text-[11px] font-light uppercase tracking-[0.1em] text-white outline-none"
          >
            <option value="default" className="bg-[#080808] text-white">
              {isUa ? "За замовчуванням" : "Default Sort"}
            </option>
            <option value="price_desc" className="bg-[#080808] text-white">
              {isUa ? "Спочатку дорожчі" : "Price: High to Low"}
            </option>
            <option value="price_asc" className="bg-[#080808] text-white">
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
                className="text-[#ff4a00] uppercase tracking-widest transition-colors hover:text-white"
              >
                {isUa ? "Скинути" : "Reset"}
              </button>
            </>
          ) : null}
        </p>
      </div>
    </>
  );

  if (!mounted) return null;

  return (
    <section className="bg-transparent text-white py-12 min-h-[90dvh] relative z-10 selection:bg-[#ff4a00] selection:text-white font-sans overflow-hidden">
      {/* Top Right Orange Glow Only */}
      <div className="absolute -top-40 -right-40 w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_center,rgba(255,74,0,0.06)_0%,transparent_70%)] rounded-full blur-3xl pointer-events-none" />
      
      <div className="max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-20 relative z-20">
        
        <div className="flex flex-col gap-10">
          <div className="mb-4 flex items-center gap-3 lg:hidden">
            <button
              type="button"
              onClick={toggleMobileFilter}
              aria-expanded={mobileFilterOpen}
              aria-controls="racechip-mobile-filters"
              className="flex items-center gap-2.5 border border-white/[0.14] bg-[#080808]/90 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:border-[#ff4a00]/45"
            >
              <SlidersHorizontal size={13} />
              {isUa ? "Фільтри" : "Filters"}
              {hasActiveFilters ? (
                <span className="ml-1 h-1.5 w-1.5 rounded-full bg-[#ff4a00]" />
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
                id="racechip-mobile-filters"
                className="fixed inset-y-0 left-0 z-50 w-[88vw] max-w-[360px] overflow-y-auto border-r border-white/10 bg-[#050505] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] shadow-2xl lg:hidden"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.26em] text-[#ff4a00]">
                      RaceChip
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
                {isUa ? "НАЛАШТУЙТЕ СВІЙ АВТОМОБІЛЬ" : "CONFIGURE YOUR VEHICLE"}
              </h2>
              <p className="mt-3 text-[10px] tracking-[0.3em] uppercase text-zinc-500 font-light flex items-center gap-2">
                <Zap size={11} strokeWidth={2} className="text-[#ff4a00]" />
                GTS 5 + App Control
              </p>
            </div>
            {filterControls}
          </div>

          {/* ─── BOTTOM: PRODUCT GRID ─── */}
          <main className="w-full">

            {filtered.length === 0 ? (
               <div className="py-32 text-center bg-[#111] border border-zinc-900 rounded-2xl flex flex-col items-center shadow-2xl">
                 <div className="w-20 h-20 rounded-full bg-black flex items-center justify-center mb-6 border border-white/5 shadow-[0_0_30px_rgba(255,74,0,0.1)]">
                   <Search className="w-8 h-8 text-[#ff4a00]/50" />
                 </div>
                 <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">
                   {isUa ? "Нічого не знайдено" : "No Components Found"}
                 </h3>
                 <p className="text-zinc-500 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                   {isUa ? "Компоненти для цієї комбінації відсутні." : "Components for this combination are currently unavailable."}
                 </p>
                 <button
                   onClick={resetFilters}
                   className="px-8 py-3.5 bg-white text-black text-[12px] uppercase tracking-widest hover:bg-[#ff4a00] hover:text-white transition-colors shadow-lg font-bold rounded-lg"
                 >
                   {isUa ? "Скинути фільтри" : "Reset Filters"}
                 </button>
               </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
                {displayedProducts.map((product) => {
                  const productTitle = localizeShopProductTitle(locale, product);
                  const priceData = getDisplayPrice(product);
                  const engineTag = product.tags?.find(t => t.startsWith("car_engine:"))?.slice(11);

                  return (
                    <article key={product.slug} className="group relative bg-[#080808] rounded-none flex flex-col border border-white/[0.05] hover:border-white/20 transition-all duration-500 shadow-xl">
                      {/* Static GTS 5 Badge — all products are GTS 5 tier */}
                      <div className="absolute top-4 right-4 z-20">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[8px] uppercase tracking-[0.2em] font-bold bg-[#ff4a00]/15 text-[#ff4a00] border border-[#ff4a00]/20 rounded-sm backdrop-blur-sm">
                          <Zap size={10} strokeWidth={2.5} />
                          GTS 5
                        </span>
                      </div>

                      {/* MAIN CLICKABLE LINK */}
                      <Link
                        href={`/${locale}/shop/racechip/products/${product.slug}`}
                        className="flex flex-col flex-grow z-10"
                      >
                        {/* Square Image Canvas */}
                        <div className="relative aspect-square w-full overflow-hidden flex items-center justify-center bg-[#0a0a0a] border-b border-white/[0.05]">
                          {product.image ? (
                             <div className="absolute inset-0 p-8">
                               <Image
                                 src={product.image}
                                 alt={productTitle}
                                 fill
                                 sizes="(max-width: 768px) 100vw, 33vw"
                                 className="object-contain opacity-80 transition-transform group-hover:scale-105 group-hover:opacity-100 mix-blend-screen"
                                 style={{ transitionDuration: '1s' }}
                               />
                             </div>
                          ) : (
                             <div className="w-16 h-16 opacity-20 text-white">
                               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                                 <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
                                 <rect x="9" y="9" width="6" height="6"></rect>
                                 <line x1="9" y1="1" x2="9" y2="4"></line>
                                 <line x1="15" y1="1" x2="15" y2="4"></line>
                                 <line x1="9" y1="20" x2="9" y2="23"></line>
                                 <line x1="15" y1="20" x2="15" y2="23"></line>
                                 <line x1="20" y1="9" x2="23" y2="9"></line>
                                 <line x1="20" y1="14" x2="23" y2="14"></line>
                                 <line x1="1" y1="9" x2="4" y2="9"></line>
                                 <line x1="1" y1="14" x2="4" y2="14"></line>
                               </svg>
                             </div>
                          )}
                        </div>

                        {/* Card Body */}
                        <div className="px-6 pt-6 pb-2 flex flex-col flex-grow">
                          {engineTag && (
                             <p className="text-[9px] uppercase tracking-[0.2em] font-light text-zinc-500 mb-2 line-clamp-1">
                               {formatRacechipEngine(engineTag)}
                             </p>
                          )}
                          <h3 className="text-sm font-light leading-relaxed text-zinc-300 line-clamp-2 mb-4 group-hover:text-white transition-colors h-10">
                            {productTitle}
                          </h3>

                          {/* Dynamic Engine Specs Card Preview */}
                          {product.longDescription?.en && product.longDescription.en.includes('Original Power') && (
                            <div className="mb-6 grid grid-cols-2 gap-4 border-t border-b border-white/5 py-3">
                              <div>
                                <span className="block text-[8px] uppercase tracking-[0.3em] font-light text-zinc-600 mb-1">Power</span>
                                <span className="text-xs font-light text-zinc-400">
                                  {product.longDescription.en.match(/Original Power:<\/strong> (.*?) ->/)?.[1] || "---"} 
                                  <span className="text-[#ff4a00] mx-1">→</span> 
                                  <span className="text-white">{product.longDescription.en.match(/Tuned Power:<\/strong> (.*?)<\/li>/)?.[1] || "---"}</span>
                                </span>
                              </div>
                              <div className="border-l border-white/5 pl-4">
                                <span className="block text-[8px] uppercase tracking-[0.3em] font-light text-zinc-600 mb-1">Torque</span>
                                <span className="text-xs font-light text-zinc-400">
                                  {product.longDescription.en.match(/Original Torque:<\/strong> (.*?) ->/)?.[1] || "---"} 
                                  <span className="text-[#ff4a00] mx-1">→</span> 
                                  <span className="text-white">{product.longDescription.en.match(/Tuned Torque:<\/strong> (.*?)<\/li>/)?.[1] || "---"}</span>
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {/* Price — primary + all currencies */}
                          <div className="mt-auto pt-2 pb-4">
                            <span className="text-lg tracking-widest font-thin text-white">
                              {priceData ? priceData.primary : "ОЧІКУЄТЬСЯ"}
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
                          href={`/${locale}/shop/racechip/products/${product.slug}`}
                          className="flex-1 flex items-center justify-center gap-2 py-3 border border-[#ff4a00]/30 text-[10px] tracking-[0.3em] uppercase font-light text-[#ff4a00] hover:text-white hover:bg-[#ff4a00] hover:border-[#ff4a00] transition-all duration-300 rounded-[2px]"
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
                  className="px-12 py-4 border border-white/20 text-white text-[11px] tracking-[0.3em] uppercase font-light hover:bg-[#ff4a00] hover:text-white hover:border-[#ff4a00] transition-all duration-300 rounded-[2px] shadow-[0_0_20px_rgba(255,74,0,0.1)]"
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
