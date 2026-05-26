"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, X, ChevronDown, ArrowRight } from "lucide-react";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { ShopProductImage } from "@/components/shop/ShopProductImage";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct } from "@/lib/shopCatalog";
import { localizeShopProductTitle } from "@/lib/shopText";
import { buildShopProductPathBrabus } from "@/lib/brabusCollectionMatcher";
import { resolveBrabusFallbackImage } from "@/lib/brabusImageFallbacks";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { useShopViewerContext } from "@/lib/useShopViewerContext";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";
import BrabusSpotlightGrid from "./BrabusSpotlightGrid";
import { ShopPaginationNav } from "./ShopPaginationNav";
import {
  BRABUS_BRAND_ORDER as BRAND_ORDER,
  BRABUS_BRAND_LABELS as BRAND_LABELS,
  BRABUS_MODEL_LABELS as MODEL_LABELS,
} from "@/lib/brabusFilterTaxonomy";

type BrabusVehicleFilterProps = {
  locale: SupportedLocale;
  products: ShopProduct[];
  pageProducts?: ShopProduct[];
  currentPage?: number;
  totalPages?: number;
  basePath?: string;
  viewerContext?: ShopViewerPricingContext;
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

function computePricesFromEur(
  price: ShopProduct["price"],
  rates: { EUR: number; USD: number; UAH?: number } | null
) {
  const baseEur = price.eur;
  const baseUah = price.uah;
  const baseUsd = price.usd;
  const eurToUah = rates?.UAH ?? (rates?.EUR ? rates.EUR : 0);

  if (baseEur > 0 && rates) {
    const usdRate = rates.USD || 1;
    return {
      eur: baseEur,
      uah: baseUah > 0 ? baseUah : Math.round(baseEur * eurToUah),
      usd: baseUsd > 0 ? baseUsd : Math.round(baseEur * usdRate),
    };
  }
  if (baseUah > 0 && rates) {
    return {
      uah: baseUah,
      eur: Math.round(baseUah / eurToUah),
      usd: Math.round((baseUah / eurToUah) * (rates.USD || 1)),
    };
  }
  return { uah: baseUah, eur: baseEur, usd: baseUsd };
}

function resolveBrabusModelKey(product: ShopProduct, modelKeysSet: Set<string>) {
  return product.tags?.find((tag) => modelKeysSet.has(tag)) || null;
}

/** Mercedes-style chassis codes look like "W 177", "W 463A", "X 290", "V 167", "S 214", "Z 223". */
const CHASSIS_TAG_PATTERN = /^[A-Z]\s?\d{3}[A-Z]?$/;
const CHASSIS_TITLE_PATTERN = /[–—-]\s*([A-Z]\s?\d{3}[A-Z]?)\s*[–—-]/;
function normaliseChassis(value: string) {
  // Normalise "W463A" → "W 463A" so tag-based and title-based keys match.
  return value.replace(/^([A-Z])\s*(\d)/, "$1 $2");
}
function resolveBrabusChassisKey(product: ShopProduct) {
  const fromTag = product.tags?.find((tag) => CHASSIS_TAG_PATTERN.test(tag));
  if (fromTag) return normaliseChassis(fromTag);
  for (const title of [product.title?.en, product.title?.ua]) {
    if (!title) continue;
    const m = title.match(CHASSIS_TITLE_PATTERN);
    if (m) return normaliseChassis(m[1]);
  }
  return null;
}

/**
 * Engine/variant key (e.g. "AMG G 63", "Maybach S 580 / S 680", "GLB 250") —
 * extracted from the chunk of the title between the chassis code and an
 * optional "| AMG Line" suffix. Dashes normalised so " - " and " – " collapse
 * to one canonical form.
 */
const ENGINE_TITLE_PATTERN = /[–—-]\s*[A-Z]\s?\d{3}[A-Z]?\s*[–—-]\s*([^|]+?)(?:\s*\||$)/;
function normaliseEngine(value: string) {
  return value
    .replace(/[–—-]/g, "–")
    .replace(/\s+/g, " ")
    .replace(/\s*\bfacelift\b.*$/i, "")
    .replace(/\s*\buntil\b.*$/i, "")
    .replace(/\s*\bfrom\s+MY.*$/i, "")
    .replace(/\s*\bfrom\s+\d{2}\/\d{4}.*$/i, "")
    .replace(/–\s*$/, "")
    .trim();
}
function resolveBrabusEngineKey(product: ShopProduct) {
  for (const title of [product.title?.en, product.title?.ua]) {
    if (!title) continue;
    const m = title.match(ENGINE_TITLE_PATTERN);
    if (m) {
      const v = normaliseEngine(m[1]);
      if (v) return v;
    }
  }
  return null;
}

/**
 * "Set / kit / body kit / WIDESTAR / Masterpiece / Carbon Body & Sound" — the
 * highest-tier products that should anchor the top of the catalog. Matched
 * against the localised title.
 */
const KIT_PRIORITY_PATTERN =
  /full kit|повний комплект|набір|комплект|full body|widebody|widetrack|widestar|rocket\s?\d+|masterpiece|signature carbon (?:package|interior)|body\s*&\s*sound|carbon body|body package|кузовний пакет|пакет кузова|пакет (?:bodi|body)/i;
function isKitProduct(title: string) {
  return KIT_PRIORITY_PATTERN.test(title);
}

export default function BrabusVehicleFilter({
  locale,
  products,
  pageProducts,
  currentPage,
  totalPages,
  basePath,
  viewerContext: ssrViewerContext,
}: BrabusVehicleFilterProps) {
  const viewerContext = useShopViewerContext(ssrViewerContext);
  const isUa = locale === "ua";
  const { currency, rates } = useShopCurrency();
  const [mounted, setMounted] = useState(false);

  const pathname = usePathname();
  const router = useRouter();

  // Initial state ignores URL params so SSR and CSR first-render match.
  // Lazy-init from window.location.search would set CSR state differently
  // from SSR ("all") and trigger React hydration warnings on every dropdown.
  // URL params apply after mount via the effect below.
  const [activeBrand, setActiveBrand] = useState<string>("all");
  const [activeModel, setActiveModel] = useState<string>("all");
  const [activeChassis, setActiveChassis] = useState<string>("all");
  const [activeEngine, setActiveEngine] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"default" | "price_desc" | "price_asc">("default");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const urlBrand = params.get("brand");
    const urlModel = params.get("model");
    const urlChassis = params.get("chassis");
    const urlEngine = params.get("engine");
    const urlQ = params.get("q");
    const urlSort = params.get("sort") as "default" | "price_desc" | "price_asc" | null;
    if (urlBrand) setActiveBrand(urlBrand);
    if (urlModel) setActiveModel(urlModel);
    if (urlChassis) setActiveChassis(urlChassis);
    if (urlEngine) setActiveEngine(urlEngine);
    if (urlQ) setSearchQuery(urlQ);
    if (urlSort) setSortOrder(urlSort);
    setMounted(true);
  }, []);

  // Mirror filter state into the URL so that navigating to a product detail and
  // then back ("back" button) restores the same filter. Uses replace() to avoid
  // polluting browser history with every dropdown change.
  useEffect(() => {
    if (!mounted) return;
    const params = new URLSearchParams();
    if (activeBrand !== "all") params.set("brand", activeBrand);
    if (activeModel !== "all") params.set("model", activeModel);
    if (activeChassis !== "all") params.set("chassis", activeChassis);
    if (activeEngine !== "all") params.set("engine", activeEngine);
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (sortOrder !== "default") params.set("sort", sortOrder);
    const qs = params.toString();
    const next = qs ? `${pathname}?${qs}` : pathname;
    const current = `${pathname}${window.location.search}`;
    if (next !== current) router.replace(next, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBrand, activeModel, activeChassis, activeEngine, searchQuery, sortOrder, mounted]);

  /* ─── Data derivation ─── */
  const availableBrands = useMemo(() => {
    const brands = new Map<string, number>();
    for (const p of products) {
      const brand = p.tags?.find((t) => BRAND_ORDER.includes(t));
      if (brand) brands.set(brand, (brands.get(brand) || 0) + 1);
    }
    return BRAND_ORDER.filter((b) => brands.has(b)).map((b) => ({
      key: b,
      label: BRAND_LABELS[b]?.[locale] || b,
      count: brands.get(b) || 0,
    }));
  }, [products, locale]);

  const MODEL_KEYS_SET = useMemo(() => new Set(Object.keys(MODEL_LABELS)), []);

  const availableModels = useMemo(() => {
    if (activeBrand === "all") return [];
    const models = new Map<string, number>();
    for (const p of products) {
      if (!p.tags?.includes(activeBrand)) continue;
      const modelKey = resolveBrabusModelKey(p, MODEL_KEYS_SET);
      if (modelKey) models.set(modelKey, (models.get(modelKey) || 0) + 1);
    }
    return [...models.entries()]
      .map(([key, count]) => ({
        key,
        label: MODEL_LABELS[key]?.[locale] || key.replace("-Klasse", "-Class"),
        count,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [activeBrand, products, locale, MODEL_KEYS_SET]);

  const availableChassis = useMemo(() => {
    const chassisCount = new Map<string, number>();
    for (const p of products) {
      if (activeBrand !== "all" && !p.tags?.includes(activeBrand)) continue;
      if (activeModel !== "all" && resolveBrabusModelKey(p, MODEL_KEYS_SET) !== activeModel)
        continue;
      const chassis = resolveBrabusChassisKey(p);
      if (chassis) chassisCount.set(chassis, (chassisCount.get(chassis) || 0) + 1);
    }
    return [...chassisCount.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([key, count]) => ({ key, label: key, count }));
  }, [activeBrand, activeModel, products, MODEL_KEYS_SET]);

  const availableEngines = useMemo(() => {
    const engineCount = new Map<string, number>();
    for (const p of products) {
      if (activeBrand !== "all" && !p.tags?.includes(activeBrand)) continue;
      if (activeModel !== "all" && resolveBrabusModelKey(p, MODEL_KEYS_SET) !== activeModel)
        continue;
      if (activeChassis !== "all" && resolveBrabusChassisKey(p) !== activeChassis) continue;
      const engine = resolveBrabusEngineKey(p);
      if (engine) engineCount.set(engine, (engineCount.get(engine) || 0) + 1);
    }
    return [...engineCount.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key, count]) => ({ key, label: key, count }));
  }, [activeBrand, activeModel, activeChassis, products, MODEL_KEYS_SET]);

  useEffect(() => {
    // Reset chassis if it's no longer available under current brand/model.
    if (activeChassis === "all") return;
    if (!availableChassis.some((c) => c.key === activeChassis)) {
      setActiveChassis("all");
    }
  }, [activeChassis, availableChassis]);

  useEffect(() => {
    if (activeEngine === "all") return;
    if (!availableEngines.some((e) => e.key === activeEngine)) {
      setActiveEngine("all");
    }
  }, [activeEngine, availableEngines]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeBrand, activeModel, activeChassis, activeEngine, searchQuery, sortOrder]);

  /* ─── Filtering & Sorting ─── */
  const filteredProducts = useMemo(() => {
    let result = products;
    if (activeBrand !== "all") result = result.filter((p) => p.tags?.includes(activeBrand));
    if (activeModel !== "all")
      result = result.filter((p) => resolveBrabusModelKey(p, MODEL_KEYS_SET) === activeModel);
    if (activeChassis !== "all")
      result = result.filter((p) => resolveBrabusChassisKey(p) === activeChassis);
    if (activeEngine !== "all")
      result = result.filter((p) => resolveBrabusEngineKey(p) === activeEngine);
    if (searchQuery.trim()) {
      // Normalise spaces so "W463A" matches "W 463A" (and vice versa).
      const q = searchQuery.toLowerCase().trim();
      const qNoSpace = q.replace(/\s+/g, "");
      result = result.filter((p) => {
        const titleEn = (p.title?.en || "").toLowerCase();
        const titleUa = (p.title?.ua || "").toLowerCase();
        const sku = (p.sku || "").toLowerCase();
        const tags = (p.tags || []).join(" ").toLowerCase();
        const haystack = `${titleEn} ${titleUa} ${sku} ${tags}`;
        return haystack.includes(q) || haystack.replace(/\s+/g, "").includes(qNoSpace);
      });
    }
    result = [...result].sort((a, b) => {
      const priceA = a.price?.eur || a.price?.uah || 0;
      const priceB = b.price?.eur || b.price?.uah || 0;
      if (sortOrder === "price_desc") return priceB - priceA;
      if (sortOrder === "price_asc") return priceA - priceB;
      // Default: body kits / WIDESTAR / Masterpiece anchor the top, then by price desc.
      const titleA = `${a.title?.en ?? ""} ${a.title?.ua ?? ""}`;
      const titleB = `${b.title?.en ?? ""} ${b.title?.ua ?? ""}`;
      const isKitA = isKitProduct(titleA);
      const isKitB = isKitProduct(titleB);
      if (isKitA && !isKitB) return -1;
      if (!isKitA && isKitB) return 1;
      return priceB - priceA;
    });
    return result;
  }, [
    activeBrand,
    activeModel,
    activeChassis,
    activeEngine,
    searchQuery,
    sortOrder,
    products,
    MODEL_KEYS_SET,
  ]);

  const totalCount = products.length;
  const hasActiveFilters =
    activeBrand !== "all" ||
    activeModel !== "all" ||
    activeChassis !== "all" ||
    activeEngine !== "all" ||
    searchQuery.trim().length > 0;
  const displayedProducts = useMemo(() => {
    if (!hasActiveFilters && pageProducts) {
      return pageProducts;
    }
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount, hasActiveFilters, pageProducts]);

  // Note: previous `if (!mounted) return null` removed — the filter renders
  // its full product grid on SSR (Googlebot crawl) with unfiltered defaults;
  // the post-mount useEffect above applies any URL filter state.

  return (
    <section id="catalog" className="bg-[#080808] text-white min-h-screen relative z-30">
      <div className="max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-20">
        {/* ═══ HORIZONTAL FILTER BAR ═══ */}
        <div className="-mx-6 md:-mx-12 lg:-mx-16 px-6 md:px-12 lg:px-16 bg-[#0d0d0d] border-b border-zinc-800/60 shadow-[0_4px_40px_rgba(0,0,0,0.9)] [&_option]:bg-[#1a1a1a] [&_option]:text-zinc-200">
          {/* ── Row 1: Dropdowns + count ── */}
          <div className="flex items-stretch gap-0 border-b border-zinc-800/50">
            {/* Brand */}
            <div className="relative flex-1 border-r border-zinc-800/50">
              <label className="absolute top-2 left-4 text-[9px] uppercase tracking-[0.18em] text-zinc-600 pointer-events-none font-medium">
                {isUa ? "Марка" : "Brand"}
              </label>
              <select
                value={activeBrand}
                onChange={(e) => {
                  setActiveBrand(e.target.value);
                  setActiveModel("all");
                  setActiveChassis("all");
                  setActiveEngine("all");
                }}
                className="appearance-none w-full bg-transparent text-zinc-200 text-[12px] tracking-wide font-light pl-4 pr-10 pt-8 pb-3 outline-none focus:bg-[#1a1a1a] focus:text-white transition-all duration-200 cursor-pointer hover:bg-[#161616] hover:text-white"
              >
                <option value="all">
                  {isUa ? `Всі марки (${totalCount})` : `All brands (${totalCount})`}
                </option>
                {availableBrands.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.label} ({b.count})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-4 bottom-3.5 text-zinc-600">
                <ChevronDown size={13} />
              </div>
            </div>

            {/* Model */}
            <div className="relative flex-1 border-r border-zinc-800/50">
              <label className="absolute top-2 left-4 text-[9px] uppercase tracking-[0.18em] text-zinc-600 pointer-events-none font-medium">
                {isUa ? "Модель" : "Model"}
              </label>
              <select
                value={activeModel}
                onChange={(e) => setActiveModel(e.target.value)}
                disabled={activeBrand === "all" || availableModels.length === 0}
                className="appearance-none w-full bg-transparent text-zinc-200 text-[12px] tracking-wide font-light pl-4 pr-10 pt-8 pb-3 outline-none focus:bg-[#1a1a1a] focus:text-white transition-all duration-200 cursor-pointer hover:bg-[#161616] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <option value="all">{isUa ? "Всі моделі" : "All models"}</option>
                {availableModels.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label} ({m.count})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-4 bottom-3.5 text-zinc-600">
                <ChevronDown size={13} />
              </div>
            </div>

            {/* Chassis */}
            <div className="relative flex-1 border-r border-zinc-800/50">
              <label className="absolute top-2 left-4 text-[9px] uppercase tracking-[0.18em] text-zinc-600 pointer-events-none font-medium">
                {isUa ? "Кузов" : "Chassis"}
              </label>
              <select
                value={activeChassis}
                onChange={(e) => setActiveChassis(e.target.value)}
                disabled={availableChassis.length === 0}
                className="appearance-none w-full bg-transparent text-zinc-200 text-[12px] tracking-wide font-light pl-4 pr-10 pt-8 pb-3 outline-none focus:bg-[#1a1a1a] focus:text-white transition-all duration-200 cursor-pointer hover:bg-[#161616] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <option value="all">{isUa ? "Усі кузови" : "All chassis"}</option>
                {availableChassis.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label} ({c.count})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-4 bottom-3.5 text-zinc-600">
                <ChevronDown size={13} />
              </div>
            </div>

            {/* Engine */}
            <div className="relative flex-1 border-r border-zinc-800/50">
              <label className="absolute top-2 left-4 text-[9px] uppercase tracking-[0.18em] text-zinc-600 pointer-events-none font-medium">
                {isUa ? "Двигун" : "Engine"}
              </label>
              <select
                value={activeEngine}
                onChange={(e) => setActiveEngine(e.target.value)}
                disabled={availableEngines.length === 0}
                className="appearance-none w-full bg-transparent text-zinc-200 text-[12px] tracking-wide font-light pl-4 pr-10 pt-8 pb-3 outline-none focus:bg-[#1a1a1a] focus:text-white transition-all duration-200 cursor-pointer hover:bg-[#161616] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <option value="all">{isUa ? "Усі двигуни" : "All engines"}</option>
                {availableEngines.map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.label} ({e.count})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-4 bottom-3.5 text-zinc-600">
                <ChevronDown size={13} />
              </div>
            </div>

            {/* Result count + reset */}
            <div className="flex flex-col items-end justify-center px-5 gap-1 min-w-[100px]">
              <span className="text-[13px] font-light text-zinc-300 tabular-nums">
                {filteredProducts.length}
                <span className="text-zinc-700 text-[11px]"> / {totalCount}</span>
              </span>
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setActiveBrand("all");
                    setActiveModel("all");
                    setActiveChassis("all");
                    setActiveEngine("all");
                    setSearchQuery("");
                    setSortOrder("default");
                  }}
                  className="flex items-center gap-1 text-[9px] uppercase tracking-[0.14em] text-zinc-600 hover:text-[#c29d59] transition-colors"
                >
                  <X size={9} />
                  {isUa ? "Скинути" : "Reset"}
                </button>
              )}
            </div>
          </div>

          {/* ── Row 2: Search + Sort ── */}
          <div className="flex items-center gap-0">
            {/* Search */}
            <div className="relative flex-1 border-r border-zinc-800/50">
              <Search
                size={14}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isUa
                    ? "Пошук за назвою, кузовом (W 463A), двигуном (G 63), артикулом..."
                    : "Search by name, chassis (W 463A), engine (G 63), SKU..."
                }
                className="w-full bg-transparent pl-11 pr-10 py-3.5 text-[12px] text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:text-white focus:placeholder:text-zinc-600 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Sort */}
            <div className="relative shrink-0">
              <label className="absolute top-1.5 left-4 text-[9px] uppercase tracking-[0.18em] text-zinc-600 pointer-events-none font-medium">
                {isUa ? "Сортування" : "Sort"}
              </label>
              <select
                value={sortOrder}
                onChange={(e) =>
                  setSortOrder(e.target.value as "default" | "price_desc" | "price_asc")
                }
                className="appearance-none bg-transparent text-zinc-200 text-[12px] tracking-wide font-light pl-4 pr-12 pt-7 pb-3 outline-none focus:bg-[#1a1a1a] focus:text-white transition-all duration-200 cursor-pointer hover:bg-[#161616] hover:text-white min-w-[180px]"
              >
                <option value="default">{isUa ? "Популярні" : "Popular"}</option>
                <option value="price_desc">{isUa ? "Ціна: спадання" : "High → Low"}</option>
                <option value="price_asc">{isUa ? "Ціна: зростання" : "Low → High"}</option>
              </select>
              <div className="pointer-events-none absolute right-4 bottom-3.5 text-zinc-600">
                <ChevronDown size={13} />
              </div>
            </div>
          </div>
        </div>

        {/* ═══ PRODUCT GRID (Full Width) ═══ */}
        <div className="pt-8 pb-4">
          {filteredProducts.length === 0 ? (
            <div className="py-32 text-center bg-[#0a0a0a] border border-zinc-900 rounded-2xl flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-6">
                <Search className="w-6 h-6 text-zinc-600" />
              </div>
              <h3 className="text-xl font-light text-white mb-3">
                {isUa ? "Нічого не знайдено" : "No Components Found"}
              </h3>
              <p className="text-zinc-500 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                {searchQuery
                  ? isUa
                    ? `Нічого не знайдено за запитом "${searchQuery}"`
                    : `No results for "${searchQuery}"`
                  : isUa
                    ? "Компоненти для цієї моделі зараз відсутні."
                    : "Components for this model are currently unavailable."}
              </p>
              <button
                onClick={() => {
                  setActiveBrand("all");
                  setActiveModel("all");
                  setSearchQuery("");
                  setSortOrder("default");
                }}
                className="px-8 py-3 bg-[#c29d59]/15 border border-[#c29d59]/40 text-[#f1d8a5] text-[10px] uppercase tracking-widest hover:bg-[#c29d59]/25 hover:border-[#c29d59]/70 transition-all duration-500 rounded-none font-medium"
              >
                {isUa ? "Скинути фільтри" : "Reset Filters"}
              </button>
            </div>
          ) : (
            <>
              <BrabusSpotlightGrid className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {displayedProducts.map((product) => {
                  const pricing = viewerContext
                    ? resolveShopProductPricing(product, viewerContext)
                    : {
                        effectivePrice: product.price,
                        effectiveCompareAt: product.compareAt,
                        audience: "b2c",
                        b2bVisible: false,
                      };
                  const computed = computePricesFromEur(
                    pricing.effectivePrice,
                    rates && { EUR: rates.EUR, USD: rates.USD, UAH: rates.UAH }
                  );
                  const productTitle = localizeShopProductTitle(locale, product);
                  const productFallbackImage = resolveBrabusFallbackImage(product);

                  return (
                    <article
                      key={product.slug}
                      className="group relative bg-[#0e0e0e] overflow-hidden flex flex-col transition-all duration-500 border border-zinc-900 hover:border-zinc-700 hover:shadow-[0_0_32px_rgba(194,157,89,0.08)] rounded-2xl"
                    >
                      <Link
                        href={buildShopProductPathBrabus(locale, product)}
                        className="flex flex-col grow z-10"
                      >
                        {/* Image — floating white product card on obsidian field */}
                        <div className="relative aspect-square sm:aspect-[4/3] bg-[#080808] flex items-center justify-center p-3 sm:p-4 overflow-hidden">
                          {/* Floating photo mount */}
                          <div className="relative w-full h-full rounded-xl bg-white shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden">
                            <ShopProductImage
                              src={product.image || "/images/placeholders/product-fallback.svg"}
                              fallbackSrc={productFallbackImage}
                              alt={productTitle}
                              fill
                              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                              className="object-contain p-4 transition-transform duration-700 group-hover:scale-[1.04]"
                            />
                          </div>
                          {/* Bronze vignette on hover */}
                          <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_50%_50%,rgba(194,157,89,0.05)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                        </div>

                        {/* Card Body */}
                        <div className="px-4 pb-4 pt-3 sm:px-5 sm:pb-5 sm:pt-4 flex flex-col grow">
                          <p className="text-[8px] sm:text-[9px] uppercase tracking-[0.2em] font-bold text-[#c29d59] mb-1.5">
                            {product.brand}
                          </p>
                          <h3 className="text-[11px] sm:text-[13px] font-light leading-snug text-zinc-300 group-hover:text-white transition-colors line-clamp-3 sm:line-clamp-2 mb-3 sm:mb-4">
                            {productTitle}
                          </h3>

                          {/* Footer */}
                          <div className="mt-auto flex items-center justify-between">
                            <div>
                              {computed.eur === 0 ? (
                                <span className="text-[9px] sm:text-[10px] tracking-wider uppercase font-medium text-zinc-500">
                                  {isUa ? "Ціна за запитом" : "Price on Request"}
                                </span>
                              ) : (
                                <span className="text-[11px] sm:text-xs font-light text-[#f1d8a5] tracking-wider sm:tracking-widest">
                                  {currency === "USD" && formatPrice(locale, computed.usd, "USD")}
                                  {currency === "EUR" && formatPrice(locale, computed.eur, "EUR")}
                                  {currency === "UAH" && formatPrice(locale, computed.uah, "UAH")}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] uppercase tracking-[0.15em] text-[#c29d59] font-medium transition-transform duration-300 group-hover:translate-x-1">
                              <span>{isUa ? "Деталі" : "Details"}</span>
                              <ArrowRight size={10} className="stroke-[2.5]" />
                            </div>
                          </div>
                        </div>

                        {/* Bronze top accent line */}
                        <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-[#c29d59]/70 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 rounded-full" />
                      </Link>
                    </article>
                  );
                })}
              </BrabusSpotlightGrid>
              {hasActiveFilters && visibleCount < filteredProducts.length ? (
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
                    className="rounded-full border border-[#c29d59]/35 bg-[#c29d59]/10 px-7 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f1d8a5] transition hover:border-[#c29d59]/70 hover:bg-[#c29d59]/18"
                  >
                    {isUa ? "Показати ще" : "Show more"} ({filteredProducts.length - visibleCount})
                  </button>
                </div>
              ) : null}

              {!hasActiveFilters && pageProducts && currentPage && totalPages && basePath ? (
                <ShopPaginationNav
                  locale={locale}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  basePath={basePath}
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
