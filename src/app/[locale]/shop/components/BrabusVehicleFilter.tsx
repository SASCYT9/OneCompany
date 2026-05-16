"use client";

import { useState, useMemo, useEffect, useRef } from "react";
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
import {
  BRABUS_BRAND_ORDER as BRAND_ORDER,
  BRABUS_BRAND_LABELS as BRAND_LABELS,
  BRABUS_MODEL_LABELS as MODEL_LABELS,
} from "@/lib/brabusFilterTaxonomy";

type BrabusVehicleFilterProps = {
  locale: SupportedLocale;
  products: ShopProduct[];
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
      usd: baseUsd > 0 ? baseUsd : Math.round(baseEur / usdRate),
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
  viewerContext: ssrViewerContext,
}: BrabusVehicleFilterProps) {
  const viewerContext = useShopViewerContext(ssrViewerContext);
  const isUa = locale === "ua";
  const { currency, rates } = useShopCurrency();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const pathname = usePathname();
  const router = useRouter();
  // Read filter state from window.location directly via lazy useState init —
  // useSearchParams() can return empty values during the first client render
  // after a back-navigation onto an ISR/force-static page, which would silently
  // collapse the filter to "all" before our URL-sync effect runs.
  const readInitial = (key: string, fallback: string) => {
    if (typeof window === "undefined") return fallback;
    return new URLSearchParams(window.location.search).get(key) || fallback;
  };

  const [activeBrand, setActiveBrand] = useState<string>(() => readInitial("brand", "all"));
  const [activeModel, setActiveModel] = useState<string>(() => readInitial("model", "all"));
  const [activeChassis, setActiveChassis] = useState<string>(() => readInitial("chassis", "all"));
  const [activeEngine, setActiveEngine] = useState<string>(() => readInitial("engine", "all"));
  const [searchQuery, setSearchQuery] = useState<string>(() => readInitial("q", ""));
  const [sortOrder, setSortOrder] = useState<"default" | "price_desc" | "price_asc">(
    () => readInitial("sort", "default") as "default" | "price_desc" | "price_asc"
  );
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({
        key,
        label: MODEL_LABELS[key]?.[locale] || key.replace("-Klasse", "-Class"),
        count,
      }));
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

  const skipModelResetRef = useRef(true);
  useEffect(() => {
    if (skipModelResetRef.current) {
      skipModelResetRef.current = false;
      return;
    }
    setActiveModel("all");
    setActiveChassis("all");
    setActiveEngine("all");
  }, [activeBrand]);

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
  const displayedProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount]
  );

  if (!mounted) return null;

  return (
    <section
      id="catalog"
      className="bg-transparent text-foreground dark:text-white min-h-screen relative z-30"
    >
      <div className="max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-20">
        {/* ═══ HORIZONTAL FILTER BAR ═══ */}
        <div className="-mx-6 md:-mx-12 lg:-mx-16 px-6 md:px-12 lg:px-16 bg-card dark:bg-[#0a0a0a] border-y border-foreground/12 dark:border-white/8 shadow-[0_4px_30px_rgba(0,0,0,0.8)] [&_option]:bg-card dark:bg-[#111] [&_option]:text-foreground dark:text-white">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-[170px_160px_140px_180px_1fr_140px_auto] items-center gap-3 py-4">
            {/* Brand Select */}
            <div className="relative">
              <label className="absolute -top-0.5 left-3 text-[8px] uppercase tracking-[0.2em] text-foreground/40 dark:text-white/25 pointer-events-none">
                {isUa ? "Марка" : "Brand"}
              </label>
              <select
                value={activeBrand}
                onChange={(e) => setActiveBrand(e.target.value)}
                className="appearance-none w-full bg-card dark:bg-[#111] border border-foreground/15 dark:border-white/10 text-foreground dark:text-white text-xs uppercase tracking-widest font-medium pl-3 pr-8 pt-4 pb-2.5 outline-hidden focus:border-[#c29d59]/50 transition-colors cursor-pointer hover:border-foreground/25 dark:hover:border-white/20"
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
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground/45 dark:text-white/30">
                <ChevronDown size={12} />
              </div>
            </div>

            {/* Model Select */}
            <div className="relative">
              <label className="absolute -top-0.5 left-3 text-[8px] uppercase tracking-[0.2em] text-foreground/40 dark:text-white/25 pointer-events-none">
                {isUa ? "Модель" : "Model"}
              </label>
              <select
                value={activeModel}
                onChange={(e) => setActiveModel(e.target.value)}
                disabled={activeBrand === "all" || availableModels.length === 0}
                className="appearance-none w-full bg-card dark:bg-[#111] border border-foreground/15 dark:border-white/10 text-foreground dark:text-white text-xs uppercase tracking-widest font-medium pl-3 pr-8 pt-4 pb-2.5 outline-hidden focus:border-[#c29d59]/50 transition-colors cursor-pointer hover:border-foreground/25 dark:hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <option value="all">{isUa ? "Всі моделі" : "All Models"}</option>
                {availableModels.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label} ({m.count})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground/45 dark:text-white/30">
                <ChevronDown size={12} />
              </div>
            </div>

            {/* Chassis Select */}
            <div className="relative">
              <label className="absolute -top-0.5 left-3 text-[8px] uppercase tracking-[0.2em] text-foreground/40 dark:text-white/25 pointer-events-none">
                {isUa ? "Кузов" : "Chassis"}
              </label>
              <select
                value={activeChassis}
                onChange={(e) => setActiveChassis(e.target.value)}
                disabled={availableChassis.length === 0}
                className="appearance-none w-full bg-card dark:bg-[#111] border border-foreground/15 dark:border-white/10 text-foreground dark:text-white text-xs uppercase tracking-widest font-medium pl-3 pr-8 pt-4 pb-2.5 outline-hidden focus:border-[#c29d59]/50 transition-colors cursor-pointer hover:border-foreground/25 dark:hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <option value="all">{isUa ? "Усі кузови" : "All Chassis"}</option>
                {availableChassis.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label} ({c.count})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground/45 dark:text-white/30">
                <ChevronDown size={12} />
              </div>
            </div>

            {/* Engine Select */}
            <div className="relative">
              <label className="absolute -top-0.5 left-3 text-[8px] uppercase tracking-[0.2em] text-foreground/40 dark:text-white/25 pointer-events-none">
                {isUa ? "Двигун" : "Engine"}
              </label>
              <select
                value={activeEngine}
                onChange={(e) => setActiveEngine(e.target.value)}
                disabled={availableEngines.length === 0}
                className="appearance-none w-full bg-card dark:bg-[#111] border border-foreground/15 dark:border-white/10 text-foreground dark:text-white text-xs uppercase tracking-widest font-medium pl-3 pr-8 pt-4 pb-2.5 outline-hidden focus:border-[#c29d59]/50 transition-colors cursor-pointer hover:border-foreground/25 dark:hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <option value="all">{isUa ? "Усі двигуни" : "All Engines"}</option>
                {availableEngines.map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.label} ({e.count})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground/45 dark:text-white/30">
                <ChevronDown size={12} />
              </div>
            </div>

            {/* Search */}
            <div className="relative col-span-1 sm:col-span-2 md:col-span-4 lg:col-span-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 dark:text-white/25"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isUa
                    ? "Пошук: назва, кузов (W 463A), двигун (G 63), артикул..."
                    : "Search: name, chassis (W 463A), engine (G 63), SKU..."
                }
                className="w-full bg-card dark:bg-[#111] border border-foreground/15 dark:border-white/10 pl-10 pr-9 py-3 text-xs text-foreground dark:text-white placeholder:text-foreground/30 dark:placeholder:text-white/30 focus:outline-hidden focus:border-[#c29d59]/50 transition-colors hover:border-foreground/25 dark:hover:border-white/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/45 dark:text-white/30 hover:text-foreground dark:hover:text-white transition-colors"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Sort Select */}
            <div className="relative hidden sm:block">
              <label className="absolute -top-0.5 left-3 text-[8px] uppercase tracking-[0.2em] text-foreground/40 dark:text-white/25 pointer-events-none">
                {isUa ? "Сортування" : "Sort"}
              </label>
              <select
                value={sortOrder}
                onChange={(e) =>
                  setSortOrder(e.target.value as "default" | "price_desc" | "price_asc")
                }
                className="appearance-none w-full bg-card dark:bg-[#111] border border-foreground/15 dark:border-white/10 text-foreground dark:text-white text-xs uppercase tracking-widest font-medium pl-3 pr-8 pt-4 pb-2.5 outline-hidden focus:border-[#c29d59]/50 transition-colors cursor-pointer hover:border-foreground/25 dark:hover:border-white/20"
              >
                <option value="default">{isUa ? "Популярні" : "Popular"}</option>
                <option value="price_desc">{isUa ? "Ціна: спадання" : "Price: High → Low"}</option>
                <option value="price_asc">{isUa ? "Ціна: зростання" : "Price: Low → High"}</option>
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground/45 dark:text-white/30">
                <ChevronDown size={12} />
              </div>
            </div>

            {/* Results Count + Reset */}
            <div className="hidden lg:flex flex-col items-end gap-0.5">
              <span className="text-[11px] text-foreground/65 dark:text-white/50 tabular-nums tracking-wide">
                {filteredProducts.length}{" "}
                <span className="text-foreground/40 dark:text-white/25">/ {totalCount}</span>
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
                  className="flex items-center gap-1 text-[9px] uppercase tracking-[0.14em] text-foreground/45 dark:text-white/30 hover:text-[#c29d59] transition-colors"
                >
                  <X size={9} />
                  {isUa ? "Скинути" : "Reset"}
                </button>
              )}
            </div>
          </div>

          {/* Mobile Sort Row (sm only) */}
          <div className="sm:hidden flex items-center justify-between pb-3 border-t border-foreground/10 dark:border-white/4 pt-3 -mt-1">
            <span className="text-[11px] text-foreground/55 dark:text-white/40 tabular-nums">
              {filteredProducts.length} / {totalCount}
            </span>
            <div className="flex items-center gap-3">
              <select
                value={sortOrder}
                onChange={(e) =>
                  setSortOrder(e.target.value as "default" | "price_desc" | "price_asc")
                }
                className="appearance-none bg-transparent text-foreground/75 dark:text-white/60 text-[10px] uppercase tracking-[0.12em] font-medium outline-hidden cursor-pointer"
              >
                <option value="default">{isUa ? "Популярні" : "Popular"}</option>
                <option value="price_desc">{isUa ? "Ціна ↓" : "Price ↓"}</option>
                <option value="price_asc">{isUa ? "Ціна ↑" : "Price ↑"}</option>
              </select>
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
                  className="text-[10px] uppercase tracking-wider text-foreground/45 dark:text-white/30 hover:text-foreground dark:hover:text-white transition-colors"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ═══ PRODUCT GRID (Full Width) ═══ */}
        <div className="pt-8">
          {filteredProducts.length === 0 ? (
            <div className="py-32 text-center bg-black/40 backdrop-blur-xs border border-foreground/12 dark:border-white/5 rounded-none flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-foreground/8 dark:bg-white/5 flex items-center justify-center mb-6">
                <Search className="w-6 h-6 text-foreground/35 dark:text-white/20" />
              </div>
              <h3 className="text-xl font-light text-foreground dark:text-white mb-3">
                {isUa ? "Нічого не знайдено" : "No Components Found"}
              </h3>
              <p className="text-foreground/65 dark:text-white/50 text-sm max-w-md mx-auto mb-8 leading-relaxed">
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
                className="px-8 py-3 bg-[#c29d59]/15 backdrop-blur-xl border border-[#c29d59]/40 text-foreground dark:text-white text-[10px] uppercase tracking-widest hover:bg-[#c29d59]/25 hover:border-[#c29d59]/70 transition-all duration-500 shadow-lg rounded-none font-medium"
              >
                {isUa ? "Скинути фільтри" : "Reset Filters"}
              </button>
            </div>
          ) : (
            <>
              <BrabusSpotlightGrid className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
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
                      className="group relative bg-card/65 dark:bg-[#050505]/60 backdrop-blur-xl overflow-hidden flex flex-col hover:bg-[rgba(10,10,10,0.85)] transition-all duration-500 border border-foreground/10 dark:border-white/4 shadow-2xl rounded-none"
                    >
                      <Link
                        href={buildShopProductPathBrabus(locale, product)}
                        className="flex flex-col grow z-10"
                      >
                        {/* Image */}
                        <div className="relative aspect-square sm:aspect-4/3 bg-transparent overflow-hidden flex items-center justify-center p-2.5 sm:p-6 border-b border-foreground/2 dark:border-white/2">
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(194,157,89,0.15)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                          <ShopProductImage
                            src={product.image || "/images/placeholders/product-fallback.svg"}
                            fallbackSrc={productFallbackImage}
                            alt={productTitle}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                            className="object-contain p-2 sm:p-4 md:p-6 drop-shadow-2xl transition-transform duration-700 group-hover:scale-110 relative z-10"
                          />
                        </div>

                        {/* Card Body */}
                        <div className="px-3 pb-3 pt-3 sm:px-5 sm:pb-5 sm:pt-4 flex flex-col grow">
                          <p className="text-[8px] sm:text-[9px] uppercase tracking-[0.16em] sm:tracking-[0.2em] font-bold text-[#c29d59] mb-1.5">
                            {product.brand}
                          </p>
                          <h3 className="text-[11px] sm:text-[13px] font-light leading-snug text-foreground dark:text-white line-clamp-3 sm:line-clamp-2 mb-2 sm:mb-3">
                            {productTitle}
                          </h3>
                          <div className="mt-auto">
                            {computed.eur === 0 ? (
                              <span className="text-[9px] sm:text-[11px] tracking-wider uppercase font-medium text-foreground/65 dark:text-white/50">
                                {isUa ? "Ціна за запитом" : "Price on Request"}
                              </span>
                            ) : (
                              <span className="text-[11px] sm:text-sm tracking-wider sm:tracking-widest font-light text-foreground dark:text-white">
                                {currency === "USD" && formatPrice(locale, computed.usd, "USD")}
                                {currency === "EUR" && formatPrice(locale, computed.eur, "EUR")}
                                {currency === "UAH" && formatPrice(locale, computed.uah, "UAH")}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Hover top accent */}
                        <div className="absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent via-[#c29d59] to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                      </Link>

                      {/* Actions */}
                      <div className="px-3 pb-3 pt-0 sm:px-5 sm:pb-5 z-20 relative flex gap-2">
                        <Link
                          href={buildShopProductPathBrabus(locale, product)}
                          className="flex-1 flex min-w-0 items-center justify-center gap-1.5 py-2 sm:py-2.5 border border-[#c29d59]/30 text-[9px] sm:text-[10px] tracking-widest sm:tracking-[0.3em] uppercase font-light text-[#c29d59] hover:text-black hover:bg-[#c29d59] hover:border-[#c29d59] transition-all duration-300 rounded-none"
                        >
                          {isUa ? "Деталі" : "View"}
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
                          className="flex-1 flex min-w-0 items-center justify-center py-2 sm:py-2.5 border border-foreground/15 dark:border-white/10 text-[9px] sm:text-[10px] tracking-widest sm:tracking-[0.3em] uppercase font-light text-foreground dark:text-white hover:text-black hover:bg-white hover:border-white transition-all duration-300 rounded-none"
                          variant="inline"
                        />
                      </div>
                    </article>
                  );
                })}
              </BrabusSpotlightGrid>
              {visibleCount < filteredProducts.length ? (
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
            </>
          )}
        </div>
      </div>
    </section>
  );
}
