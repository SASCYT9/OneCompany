"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, X, ChevronDown, ShoppingCart } from "lucide-react";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct } from "@/lib/shopCatalog";
import { localizeShopProductTitle } from "@/lib/shopText";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { useShopViewerContext } from "@/lib/useShopViewerContext";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";
import fitmentOptions from "../data/burgerFitmentOptions.json";

type FitmentOptionsShape = Record<string, {
  count: number;
  models: Record<string, { count: number; chassis: string[]; engines: string[] }>;
  allChassis: string[];
  allEngines: string[];
}>;
const FITMENT = fitmentOptions as FitmentOptionsShape;

type Props = {
  locale: SupportedLocale;
  products: ShopProduct[];
  viewerContext?: ShopViewerPricingContext;
};

/* ─── Product type display labels ─── */
const TYPE_LABELS: Record<string, Record<string, string>> = {
  "jb4-tuners": { en: "JB4 Tuners", ua: "JB4 Тюнери" },
  "jb-plus-tuners": { en: "JB+ Tuners", ua: "JB+ Тюнери" },
  "stage-1-tuners": { en: "Stage 1 Tuners", ua: "Stage 1 Тюнери" },
  "pedal-tuners": { en: "Pedal Tuners", ua: "Педаль-тюнери" },
  "flex-fuel": { en: "Flex Fuel Kits", ua: "Flex Fuel Кіти" },
  "intakes": { en: "Intakes", ua: "Впускні системи" },
  "oil-catch-cans": { en: "Oil Catch Cans", ua: "Маслозбірники" },
  "wheel-spacers": { en: "Wheel Spacers", ua: "Проставки" },
  "methanol-injection": { en: "Methanol Injection", ua: "Метанол. вприск" },
  "fuel-pumps": { en: "Fuel Pumps", ua: "Паливні насоси" },
  "port-injection": { en: "Port Injection", ua: "Port Injection" },
  "charge-pipes": { en: "Charge Pipes", ua: "Charge Pipes" },
  "air-filters": { en: "Air Filters", ua: "Повітряні фільтри" },
  "engine-accessories": { en: "Engine Parts", ua: "Деталі двигуна" },
  "blow-off-valves": { en: "Blow Off Valves", ua: "BOV" },
  "spark-plugs": { en: "Spark Plugs", ua: "Свічки" },
  "cooling": { en: "Cooling", ua: "Охолодження" },
  "transmission-coolers": { en: "Transmission Coolers", ua: "Радіатори АКПП" },
  "sensors": { en: "Sensors", ua: "Датчики" },
  "exhaust-tips": { en: "Exhaust Tips", ua: "Глушники" },
  "strut-braces": { en: "Strut Braces", ua: "Розтяжки" },
  "chassis-reinforcement": { en: "Chassis Reinforcement", ua: "Підсилення кузова" },
  "turbo-accessories": { en: "Turbo Parts", ua: "Турбо деталі" },
  "billet-accessories": { en: "Billet Parts", ua: "Billet деталі" },
  "obdii-accessories": { en: "OBDII Accessories", ua: "OBDII Аксесуари" },
  "clutch-stops": { en: "Clutch Stops", ua: "Обмежувачі зчеплення" },
  "dragy": { en: "Dragy GPS", ua: "Dragy GPS" },
  "universal": { en: "Universal", ua: "Універсальні" },
};

const UNIVERSAL_BRAND_KEY = "Universal";
const BRAND_LABELS: Record<string, Record<string, string>> = {
  Universal: { en: "Universal Fit", ua: "Універсальні" },
};

const PAGE_SIZE = 30;

function formatPrice(locale: SupportedLocale, amount: number, currency: "EUR" | "USD" | "UAH") {
  const formatter = new Intl.NumberFormat(locale === "ua" ? "uk-UA" : "en-US", {
    maximumFractionDigits: 0,
  });
  const formatted = formatter.format(amount);
  if (locale === "ua" && currency === "UAH") return `${formatted} грн`;
  return locale === "ua" ? `${formatted} ${currency}` : `${currency} ${formatted}`;
}

export default function BurgerVehicleFilter({
  locale,
  products,
  viewerContext: ssrViewerContext,
}: Props) {
  const viewerContext = useShopViewerContext(ssrViewerContext);
  const isUa = locale === "ua";
  const { currency, rates } = useShopCurrency();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const searchParams = useSearchParams();
  const initialBrand = searchParams?.get("brand") || "all";
  const initialType = searchParams?.get("type") || "all";
  const initialModel = searchParams?.get("model") || "all";
  const initialChassis = searchParams?.get("chassis") || "all";
  const initialEngine = searchParams?.get("engine") || "all";

  const [activeBrand, setActiveBrand] = useState<string>(initialBrand);
  const [activeType, setActiveType] = useState<string>(initialType);
  const [activeModel, setActiveModel] = useState<string>(initialModel);
  const [activeChassis, setActiveChassis] = useState<string>(initialChassis);
  const [activeEngine, setActiveEngine] = useState<string>(initialEngine);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"default" | "price_desc" | "price_asc">("default");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // ─── Extract brands from tags ───
  const availableBrands = useMemo(() => {
    const brands = new Map<string, number>();
    for (const p of products) {
      for (const tag of p.tags || []) {
        if (tag.startsWith("brand:")) {
          const brand = tag.slice(6);
          brands.set(brand, (brands.get(brand) || 0) + 1);
        }
      }
    }
    return [...brands.entries()]
      .map(([key, count]) => ({
        key,
        label: BRAND_LABELS[key]?.[locale] || key,
        count,
      }))
      .sort((a, b) => {
        // "Universal" always last
        if (a.key === UNIVERSAL_BRAND_KEY) return 1;
        if (b.key === UNIVERSAL_BRAND_KEY) return -1;
        // Then by count desc
        if (b.count !== a.count) return b.count - a.count;
        return a.label.localeCompare(b.label);
      });
  }, [products, locale]);

  // ─── Extract product types from tags ───
  const availableTypes = useMemo(() => {
    const types = new Map<string, number>();
    for (const p of products) {
      if (activeBrand !== "all" && !p.tags?.includes(`brand:${activeBrand}`)) continue;

      for (const tag of p.tags || []) {
        if (tag.startsWith("type:")) {
          const t = tag.slice(5);
          types.set(t, (types.get(t) || 0) + 1);
        }
      }
    }
    return [...types.entries()]
      .map(([key, count]) => ({
        key,
        label: TYPE_LABELS[key]?.[locale] || key,
        count,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.label.localeCompare(b.label, locale === "ua" ? "uk" : "en");
      });
  }, [products, activeBrand, locale]);

  // ─── Smart sort helpers (mirror picker logic) ───
  function bmwGroup(model: string) {
    if (/-Series$/.test(model)) return 0;
    if (/^M\d/.test(model)) return 1;
    if (/^X\d/.test(model) || model === "XM") return 2;
    if (/^Z\d/.test(model)) return 3;
    if (/^i\d/.test(model)) return 4;
    return 5;
  }
  function modelSortValue(model: string) {
    const m = model.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 999;
  }

  // ─── Extract models / chassis / engines ───
  // Chassis canonical-per-model (via static map) when a brand+model is selected.
  function extractFacet(prefix: "model" | "chassis" | "engine") {
    const map = new Map<string, number>();

    // For chassis/engine with brand+model selected, restrict to canonical set for that model
    let canonicalAllowlist: Set<string> | null = null;
    if ((prefix === "chassis" || prefix === "engine") && activeBrand !== "all" && activeModel !== "all") {
      const modelData = FITMENT[activeBrand]?.models[activeModel];
      const canon = prefix === "chassis" ? modelData?.chassis : modelData?.engines;
      if (canon && canon.length > 0) canonicalAllowlist = new Set(canon);
    }

    for (const p of products) {
      if (activeBrand !== "all" && !p.tags?.includes(`brand:${activeBrand}`)) continue;
      if ((prefix === "chassis" || prefix === "engine") && activeModel !== "all") {
        if (!p.tags?.includes(`model:${activeModel}`)) continue;
      }
      for (const tag of p.tags || []) {
        if (tag.startsWith(`${prefix}:`)) {
          const v = tag.slice(prefix.length + 1);
          if (canonicalAllowlist && !canonicalAllowlist.has(v)) continue;
          map.set(v, (map.get(v) || 0) + 1);
        }
      }
    }
    const items = [...map.entries()].map(([key, count]) => ({ key, label: key, count }));

    if (prefix === "model" && activeBrand === "BMW") {
      return items.sort((a, b) => {
        const ga = bmwGroup(a.key);
        const gb = bmwGroup(b.key);
        if (ga !== gb) return ga - gb;
        const na = modelSortValue(a.key);
        const nb = modelSortValue(b.key);
        if (na !== nb) return na - nb;
        return a.label.localeCompare(b.label);
      });
    }

    // Chassis & non-BMW models: natural alphanumeric (E36 < E46 < F30 < G20)
    if (prefix === "chassis" || prefix === "model" || prefix === "engine") {
      return items.sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" })
      );
    }

    return items.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });
  }

  const availableModels = useMemo(() => extractFacet("model"), [products, activeBrand]);
  const availableChassis = useMemo(() => extractFacet("chassis"), [products, activeBrand, activeModel]);
  const availableEngines = useMemo(() => extractFacet("engine"), [products, activeBrand, activeModel]);

  // Reset narrower filters when brand actually changes (skip initial mount so
  // ?brand=BMW&model=M5&chassis=F90 from URL is preserved).
  const prevBrandRef = useRef(activeBrand);
  useEffect(() => {
    if (prevBrandRef.current !== activeBrand) {
      prevBrandRef.current = activeBrand;
      setActiveType("all");
      setActiveModel("all");
      setActiveChassis("all");
      setActiveEngine("all");
    }
  }, [activeBrand]);

  // Same for model: reset chassis/engine only when model actually changes (not on mount)
  const prevModelRef = useRef(activeModel);
  useEffect(() => {
    if (prevModelRef.current !== activeModel) {
      prevModelRef.current = activeModel;
      setActiveChassis("all");
      setActiveEngine("all");
    }
  }, [activeModel]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeBrand, activeType, activeModel, activeChassis, activeEngine, searchQuery, sortOrder]);

  // ─── Filter & Sort ───
  const filtered = useMemo(() => {
    let list = products;

    if (activeBrand !== "all") {
      list = list.filter(p => p.tags?.includes(`brand:${activeBrand}`));
    }
    if (activeType !== "all") {
      list = list.filter(p => p.tags?.includes(`type:${activeType}`));
    }
    if (activeModel !== "all") {
      list = list.filter(p => p.tags?.includes(`model:${activeModel}`));
      // Canonical sanity: model must belong to the selected brand.
      // E.g. ?brand=BMW&model=Supra is invalid even if some cross-fit product has both tags.
      if (activeBrand !== "all") {
        const brandModels = FITMENT[activeBrand]?.models;
        if (brandModels && !brandModels[activeModel]) {
          list = [];
        }
      }
    }
    if (activeChassis !== "all") {
      list = list.filter(p => p.tags?.includes(`chassis:${activeChassis}`));
      // Canonical sanity: if a model is also selected, the chassis must canonically
      // belong to that model. Otherwise the URL combo is invalid (e.g. 3-Series + F22).
      if (activeModel !== "all" && activeBrand !== "all") {
        const canon = FITMENT[activeBrand]?.models[activeModel]?.chassis || [];
        if (canon.length > 0 && !canon.includes(activeChassis)) {
          list = [];
        }
      }
    }
    if (activeEngine !== "all") {
      list = list.filter(p => p.tags?.includes(`engine:${activeEngine}`));
      // Same canonical sanity for engine
      if (activeModel !== "all" && activeBrand !== "all") {
        const canon = FITMENT[activeBrand]?.models[activeModel]?.engines || [];
        if (canon.length > 0 && !canon.includes(activeEngine)) {
          list = [];
        }
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => {
        const title = localizeShopProductTitle(locale, p).toLowerCase();
        return title.includes(q) || p.sku?.toLowerCase().includes(q);
      });
    }

    list = [...list].sort((a, b) => {
      const priceA = a.price?.usd || 0;
      const priceB = b.price?.usd || 0;

      if (sortOrder === "price_asc") return priceA - priceB;
      if (sortOrder === "price_desc") return priceB - priceA;

      // Default sorting: Tuners first, then Price Descending
      const isTunerA = a.tags?.includes("type:jb4-tuners") || a.tags?.includes("type:jb-plus-tuners") || a.tags?.includes("type:stage-1-tuners");
      const isTunerB = b.tags?.includes("type:jb4-tuners") || b.tags?.includes("type:jb-plus-tuners") || b.tags?.includes("type:stage-1-tuners");

      if (isTunerA && !isTunerB) return -1;
      if (!isTunerA && isTunerB) return 1;

      return priceB - priceA;
    });

    return list;
  }, [products, activeBrand, activeType, activeModel, activeChassis, activeEngine, searchQuery, sortOrder, locale]);

  const getDisplayPrice = (p: ShopProduct) => {
    if (!mounted) return null;
    const pricing = viewerContext ? resolveShopProductPricing(p, viewerContext) : null;
    const ep = pricing?.effectivePrice;
    const priceUsd = ep?.usd ?? p.price.usd ?? 0;
    const priceEur = ep?.eur ?? p.price.eur ?? 0;
    const priceUah = ep?.uah ?? p.price.uah ?? 0;
    
    if (currency === "USD") return priceUsd > 0 ? formatPrice(locale, priceUsd, "USD") : null;
    if (currency === "EUR") return priceEur > 0 ? formatPrice(locale, priceEur, "EUR") : null;
    if (currency === "UAH" && rates?.UAH) {
      const uah = priceUah > 0 ? priceUah : Math.round(priceUsd * rates.UAH); // Burger is USD based
      return uah > 0 ? formatPrice(locale, uah, "UAH") : null;
    }
    return priceUsd > 0 ? formatPrice(locale, priceUsd, "USD") : null;
  };

  const hasActiveFilters =
    activeBrand !== "all" ||
    activeType !== "all" ||
    activeModel !== "all" ||
    activeChassis !== "all" ||
    activeEngine !== "all" ||
    searchQuery.trim().length > 0 ||
    sortOrder !== "default";
  const displayedProducts = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  if (!mounted) return null;

  return (
    <section className="bg-[#050505] text-white py-12 min-h-[90dvh] relative z-10 selection:bg-[var(--burger-yellow)] selection:text-black font-sans overflow-hidden">
      {/* Top Right Golden Glow Only */}
      <div className="absolute -top-40 -right-40 w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_center,rgba(255,215,0,0.06)_0%,transparent_70%)] rounded-full blur-3xl pointer-events-none" />
      
      <div className="max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-20 relative z-20">
        {/* ─── COUNT + TITLE ─── */}
        <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight uppercase text-white">
              {isUa ? "Каталог JB4" : "JB4 Catalog"}
            </h2>
            <p className="mt-2 text-zinc-400 text-[11px] tracking-[0.2em] uppercase font-semibold">
              {filtered.length} {isUa ? "з" : "of"} {products.length} {isUa ? "товарів" : "products"}
            </p>
          </div>

          {/* Sort */}
          <div className="relative inline-flex items-center">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "default" | "price_desc" | "price_asc")}
              className="appearance-none bg-[#111] border border-zinc-800 text-white text-[11px] uppercase tracking-[0.1em] font-semibold px-5 py-3 pr-10 rounded-lg outline-none focus:border-[var(--burger-yellow)] focus:ring-1 focus:ring-[var(--burger-yellow)] transition-all cursor-pointer"
            >
              <option value="default">{isUa ? "За замовчуванням" : "Default"}</option>
              <option value="price_asc">{isUa ? "Ціна: ↑" : "Price: ↑"}</option>
              <option value="price_desc">{isUa ? "Ціна: ↓" : "Price: ↓"}</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
              <ChevronDown size={14} />
            </div>
          </div>
        </div>

        {/* ─── SEARCH ─── */}
        <div className="mb-5 relative max-w-md">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isUa ? "Пошук деталей..." : "Search parts..."}
            className="w-full bg-[#111] border border-zinc-800 rounded-lg pl-11 pr-10 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--burger-yellow)]/60 focus:ring-1 focus:ring-[var(--burger-yellow)]/50 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--burger-yellow)] hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* ─── TYPE FILTER PILLS ─── */}
        {availableTypes.length > 1 && (
          <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:bg-zinc-800 [&::-webkit-scrollbar-thumb]:rounded-full">
            <button
              type="button"
              onClick={() => setActiveType("all")}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-[11px] uppercase tracking-[0.12em] font-semibold border transition-colors ${
                activeType === "all"
                  ? "bg-[var(--burger-yellow)] text-black border-[var(--burger-yellow)]"
                  : "bg-transparent text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-white"
              }`}
            >
              {isUa ? "Всі типи" : "All Types"}
            </button>
            {availableTypes.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveType(t.key)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-[11px] uppercase tracking-[0.12em] font-semibold border transition-colors flex items-center gap-2 ${
                  activeType === t.key
                    ? "bg-[var(--burger-yellow)] text-black border-[var(--burger-yellow)]"
                    : "bg-transparent text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-white"
                }`}
              >
                <span>{t.label}</span>
                <span className={`text-[10px] ${activeType === t.key ? "text-black/60" : "text-zinc-600"}`}>{t.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* ─── ENGINE FILTER PILLS (only when brand selected & engines available) ─── */}
        {activeBrand !== "all" && availableEngines.length > 0 && (
          <div className="mb-8 flex items-center gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:bg-zinc-800 [&::-webkit-scrollbar-thumb]:rounded-full">
            <span className="whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-semibold pr-2">
              {isUa ? "Двигун:" : "Engine:"}
            </span>
            <button
              type="button"
              onClick={() => setActiveEngine("all")}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[10px] uppercase tracking-[0.12em] font-semibold border transition-colors ${
                activeEngine === "all"
                  ? "bg-white/10 text-white border-white/20"
                  : "bg-transparent text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-white"
              }`}
            >
              {isUa ? "Усі" : "All"}
            </button>
            {availableEngines.map((e) => (
              <button
                key={e.key}
                type="button"
                onClick={() => setActiveEngine(e.key)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[10px] uppercase tracking-[0.12em] font-semibold border transition-colors flex items-center gap-1.5 ${
                  activeEngine === e.key
                    ? "bg-white/10 text-white border-white/20"
                    : "bg-transparent text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-white"
                }`}
              >
                <span>{e.label}</span>
                <span className="text-zinc-600">{e.count}</span>
              </button>
            ))}
          </div>
        )}


          {/* ─── PRODUCT GRID — full-width ─── */}
          <main className="flex-1 min-w-0">
            {filtered.length === 0 ? (
              <div className="py-32 text-center bg-[#111] border border-zinc-900 rounded-2xl flex flex-col items-center shadow-2xl">
                <div className="w-20 h-20 rounded-full bg-black flex items-center justify-center mb-6 border border-white/5">
                  <Search className="w-8 h-8 text-[var(--burger-yellow)]/50" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">
                  {isUa ? "Нічого не знайдено" : "No Components Found"}
                </h3>
                <p className="text-zinc-500 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                  {searchQuery
                    ? (isUa ? `На жаль, за запитом "${searchQuery}" ми нічого не знайшли.` : `No results for "${searchQuery}"`)
                    : (isUa ? "Компоненти для цієї комбінації фільтрів відсутні." : "Components for this combination are currently unavailable.")}
                </p>
                <button
                  onClick={() => { setActiveBrand("all"); setActiveType("all"); setSearchQuery(""); setSortOrder("default"); }}
                  className="px-8 py-3.5 bg-white text-black text-[12px] uppercase tracking-widest hover:bg-[var(--burger-yellow)] transition-colors shadow-lg font-bold rounded-lg"
                >
                  {isUa ? "Скинути фільтри" : "Reset Filters"}
                </button>
              </div>
            ) : (
              <>
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6 lg:gap-8">
                {displayedProducts.map((product) => {
                  const productTitle = localizeShopProductTitle(locale, product);
                  const priceStr = getDisplayPrice(product);
                  const typeTag = product.tags?.find(t => t.startsWith("type:"))?.slice(5);

                  return (
                    <article key={product.slug} className="group relative bg-[#0a0a0a] rounded-xl sm:rounded-2xl overflow-hidden flex flex-col hover:-translate-y-1 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.5)] border border-white/[0.04] hover:border-[var(--burger-yellow)]/50 hover:shadow-[0_8px_30px_rgba(255,215,0,0.1)]">
                      <Link
                        href={`/${locale}/shop/burger/products/${product.slug}`}
                        className="flex flex-col flex-grow z-10"
                      >
                        {/* Image Canvas (White to perfectly blend Burger JPGs) */}
                        <div className="relative aspect-square sm:aspect-[4/3] overflow-hidden flex items-center justify-center p-2 sm:p-8 bg-white">
                          <Image
                            src={product.image || product.gallery?.[0] || "/images/placeholders/product-fallback.jpg"}
                            alt={productTitle}
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            className="object-contain p-2 sm:p-6 md:p-8 mix-blend-multiply transition-transform duration-700 group-hover:scale-105"
                          />
                        </div>

                        {/* Card Body */}
                        <div className="px-3 pb-3 pt-3 sm:px-6 sm:pb-6 sm:pt-5 flex flex-col flex-grow">
                          {typeTag && (
                             <p className="text-[8px] sm:text-[10px] uppercase tracking-[0.12em] sm:tracking-widest font-bold text-[var(--burger-yellow)] mb-2">
                               {TYPE_LABELS[typeTag]?.[locale] || typeTag}
                             </p>
                          )}
                          <h3 className="text-[11px] sm:text-sm font-semibold leading-snug sm:leading-relaxed text-zinc-100 line-clamp-3 sm:line-clamp-2 mb-3 sm:mb-4 group-hover:text-white transition-colors">
                            {productTitle}
                          </h3>
                          
                          {/* Bottom Row: Price & Cart */}
                          <div className="mt-auto flex items-end justify-between gap-2 border-t border-white/[0.04] pt-3 sm:pt-4">
                            <div>
                              <p className="text-[8px] sm:text-[10px] text-zinc-500 uppercase tracking-widest font-medium mb-1">
                                {isUa ? "Ціна" : "Price"}
                              </p>
                              <span className="text-[11px] sm:text-lg tracking-wide font-black text-white">
                                {priceStr || (isUa ? "За запитом" : "On Request")}
                              </span>
                            </div>
                            
                            {/* Re-added Cart Icon / Action */}
                            <div className="h-8 w-8 sm:w-10 sm:h-10 shrink-0 rounded-full bg-[#111] flex items-center justify-center text-zinc-400 group-hover:bg-[var(--burger-yellow)] group-hover:text-black transition-colors">
                               <ShoppingCart size={14} strokeWidth={2.5} />
                            </div>
                          </div>
                        </div>
                      </Link>
                      
                      {/* Hidden interactive ATC layer if needed, currently linking handles it gracefully via intuitive UX */}
                    </article>
                  );
                })}
              </div>
              {visibleCount < filtered.length ? (
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
                    className="rounded-full border border-[var(--burger-yellow)]/35 bg-[var(--burger-yellow)]/10 px-7 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--burger-yellow)] transition hover:border-[var(--burger-yellow)]/70 hover:bg-[var(--burger-yellow)]/18"
                  >
                    {isUa ? "Показати ще" : "Show more"} ({filtered.length - visibleCount})
                  </button>
                </div>
              ) : null}
              </>
            )}
          </main>

      </div>
    </section>
  );
}
