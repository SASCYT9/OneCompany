"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X, ChevronDown, SlidersHorizontal, ArrowRight } from "lucide-react";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { ShopProductImage } from "@/components/shop/ShopProductImage";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct } from "@/lib/shopCatalog";
import { computeShopDisplayPrices, hasAnyShopPrice, pickShopSortableAmount } from "@/lib/shopDisplayPrices";
import { localizeShopProductTitle } from "@/lib/shopText";
import { extractCsfCatalogFitment, detectCsfStockState } from "@/lib/csfCatalog";
import { SHOW_STOCK_BADGE } from "@/lib/shopStockUi";
import { useMobileFilterDrawer } from "./useMobileFilterDrawer";

type Props = {
  locale: SupportedLocale;
  products: ShopProduct[];
};

type SortOrder = "default" | "price_desc" | "price_asc" | "title_asc";
type PriceBand = "all" | "under_25000" | "25000_50000" | "50000_100000" | "over_100000";
type StockFilter = "all" | "in-stock" | "pre-order" | "out-of-stock";

type EnrichedProduct = {
  product: ShopProduct;
  categoryLabel: string;
  categoryGroup: string;
  make: string | null;
  models: string[];
  chassisCodes: string[];
  yearStart: number | null;
  yearEnd: number | null;
  yearLabel: string | null;
  stockState: StockFilter;
  priceSortValue: number;
};

type FacetOption = {
  key: string;
  label: string;
  count: number;
};

const CSF_CATEGORY_MAP: Record<string, { ua: string; en: string; group: string }> = {
  "Радіатори та аксесуари": { ua: "Радіатори", en: "Radiators", group: "radiators" },
  "Інтеркулери": { ua: "Інтеркулери", en: "Intercoolers", group: "intercoolers" },
  "Масляні радіатори і компоненти": { ua: "Масляні радіатори", en: "Oil Coolers", group: "oil-coolers" },
  "Впускні колектори": { ua: "Впускні колектори", en: "Intake Manifolds", group: "intake" },
  "Комплекти интеркулеров": { ua: "Комплекти інтеркулерів", en: "Intercooler Kits", group: "intercooler-kits" },
  "Охолодження трансмісії": { ua: "Охолодження трансмісії", en: "Transmission Cooling", group: "trans-cooling" },
  "З'єднувальні адаптери": { ua: "Аксесуари", en: "Accessories", group: "accessories" },
  "Прокладки, сальники, ролики": { ua: "Аксесуари", en: "Accessories", group: "accessories" },
  "Труби інтеркулера": { ua: "Комплекти інтеркулерів", en: "Intercooler Kits", group: "intercooler-kits" },
};

function formatPrice(locale: SupportedLocale, amount: number, currency: "EUR" | "USD" | "UAH") {
  const formatter = new Intl.NumberFormat(locale === "ua" ? "uk-UA" : "en-US", {
    maximumFractionDigits: 0,
  });
  const formatted = formatter.format(amount);
  if (locale === "ua" && currency === "UAH") return `${formatted} грн`;
  return locale === "ua" ? `${formatted} ${currency}` : `${currency} ${formatted}`;
}

function normalizeCategory(locale: SupportedLocale, product: ShopProduct) {
  const raw = product.category.ua || product.category.en;
  const mapped = CSF_CATEGORY_MAP[raw];

  if (!mapped) {
    return {
      label: raw,
      group: raw || "other",
    };
  }

  return {
    label: locale === "ua" ? mapped.ua : mapped.en,
    group: mapped.group,
  };
}

function buildFacetOptions(items: string[], predicate?: (label: string) => boolean) {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item) continue;
    if (predicate && !predicate(item)) continue;
    counts.set(item, (counts.get(item) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

const KNOWN_MAKES_RE = /\b(BMW|TOYOTA|PORSCHE|NISSAN|FORD|SUBARU|CHEVROLET|AUDI|HONDA|MERCEDES(?:-BENZ)?|MITSUBISHI|MAZDA|FERRARI|JEEP|DODGE|HYUNDAI|MCLAREN|VAG|LEXUS|LAMBORGHINI|ALFA|CADILLAC|MINI|VOLKSWAGEN|VW|LOTUS|ACURA)\b/i;

function isCleanModelLabel(label: string) {
  const trimmed = label.trim();
  if (trimmed.length < 2 || trimmed.length > 22) return false;
  if (KNOWN_MAKES_RE.test(trimmed)) return false;
  if (/\d{2,4}\s*[-+]\s*\d{2,4}/.test(trimmed)) return false;
  if (/\b(19|20)\d{2}\b/.test(trimmed)) return false;
  if (/[\/,]/.test(trimmed)) return false;
  if ((trimmed.match(/\s/g) || []).length > 2) return false;
  return true;
}

function isCleanChassisLabel(label: string) {
  return /^[A-Z]{1,3}\d{2,4}[A-Z]?$/.test(label.trim());
}

function isCleanYearLabel(label: string) {
  return /^\d{4}(?:[-–]\d{4}|\+)?$/.test(label.trim());
}

function inPriceBand(value: number, band: PriceBand) {
  if (band === "all") return true;
  if (band === "under_25000") return value > 0 && value < 25000;
  if (band === "25000_50000") return value >= 25000 && value < 50000;
  if (band === "50000_100000") return value >= 50000 && value < 100000;
  return value >= 100000;
}

function getPriceBandLabel(locale: SupportedLocale, band: PriceBand, currency: "EUR" | "USD" | "UAH") {
  const currencyLabel = locale === "ua" && currency === "UAH" ? "грн" : currency;
  const join = (range: string) => (locale === "ua" ? `${range} ${currencyLabel}` : `${currencyLabel} ${range}`);
  if (band === "under_25000") return join(locale === "ua" ? "до 25 000" : "under 25,000");
  if (band === "25000_50000") return join(locale === "ua" ? "25 000 - 50 000" : "25,000 - 50,000");
  if (band === "50000_100000") return join(locale === "ua" ? "50 000 - 100 000" : "50,000 - 100,000");
  return join("100 000+");
}

function stripCsfSkuPrefix(title: string, sku: string | null | undefined) {
  if (!title) return title;
  let cleaned = title.replace(/^\s*CSF[\s#]*\d+[A-Za-z]?\s*[-—:|]?\s*/i, "");
  if (sku) {
    const skuRe = new RegExp(`^\\s*${sku.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s*[-—:|]?\\s*`, "i");
    cleaned = cleaned.replace(skuRe, "");
  }
  return cleaned.trim() || title;
}

function stripChassisChips(title: string) {
  if (!title) return title;
  // "(G80/G81) / M4 (G82/G83)" → "M4" — strip parenthetical chassis codes / years
  // for compact card display. The full title remains on the PDP.
  const cleaned = title
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([/,])/g, "$1")
    .trim();
  return cleaned || title;
}

function getStockLabel(locale: SupportedLocale, stock: StockFilter) {
  if (stock === "in-stock") return locale === "ua" ? "В наявності" : "In stock";
  if (stock === "pre-order") return locale === "ua" ? "Під замовлення" : "Pre-order";
  if (stock === "out-of-stock") return locale === "ua" ? "Немає в наявності" : "Out of stock";
  return locale === "ua" ? "Усі статуси" : "All stock";
}

const STOCK_BADGE_CLASS: Record<Exclude<StockFilter, "all">, string> = {
  "in-stock": "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  "pre-order": "border-amber-400/25 bg-amber-400/10 text-amber-200",
  "out-of-stock": "border-white/10 bg-white/[0.04] text-white/45",
};

export default function CSFCatalogGrid({ locale, products }: Props) {
  const isUa = locale === "ua";
  const { currency, rates } = useShopCurrency();
  const [mounted, setMounted] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { mobileFilterOpen, closeMobileFilter, toggleMobileFilter } = useMobileFilterDrawer();

  const [activeCategory, setActiveCategory] = useState(searchParams?.get("category") || "all");
  const [activeMake, setActiveMake] = useState(searchParams?.get("make") || "all");
  const [activeModel, setActiveModel] = useState(searchParams?.get("model") || "all");
  const [activeChassis, setActiveChassis] = useState(searchParams?.get("chassis") || "all");
  const [activeYear, setActiveYear] = useState(searchParams?.get("year") || "all");
  const [activeStock, setActiveStock] = useState<StockFilter>((searchParams?.get("stock") as StockFilter) || "all");
  const [activePriceBand, setActivePriceBand] = useState<PriceBand>((searchParams?.get("price") as PriceBand) || "all");
  const [searchQuery, setSearchQuery] = useState(searchParams?.get("q") || "");
  const [sortOrder, setSortOrder] = useState<SortOrder>((searchParams?.get("sort") as SortOrder) || "default");
  const [visibleCount, setVisibleCount] = useState(30);

  useEffect(() => setMounted(true), []);

  const syncToUrl = useCallback(
    (
      category: string,
      make: string,
      model: string,
      chassis: string,
      year: string,
      stock: StockFilter,
      priceBand: PriceBand,
      sort: SortOrder,
      query: string
    ) => {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (make !== "all") params.set("make", make);
      if (model !== "all") params.set("model", model);
      if (chassis !== "all") params.set("chassis", chassis);
      if (year !== "all") params.set("year", year);
      if (stock !== "all") params.set("stock", stock);
      if (priceBand !== "all") params.set("price", priceBand);
      if (sort !== "default") params.set("sort", sort);
      if (query.trim()) params.set("q", query.trim());

      const nextQuery = params.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname || "", { scroll: false });
    },
    [pathname, router]
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      syncToUrl(
        activeCategory,
        activeMake,
        activeModel,
        activeChassis,
        activeYear,
        activeStock,
        activePriceBand,
        sortOrder,
        searchQuery
      );
    }, 250);

    return () => clearTimeout(timeout);
  }, [
    activeCategory,
    activeMake,
    activeModel,
    activeChassis,
    activeYear,
    activeStock,
    activePriceBand,
    sortOrder,
    searchQuery,
    syncToUrl,
  ]);

  useEffect(() => {
    setVisibleCount(30);
  }, [activeCategory, activeMake, activeModel, activeChassis, activeYear, activeStock, activePriceBand, searchQuery, sortOrder]);

  useEffect(() => {
    setActiveModel("all");
    setActiveChassis("all");
    setActiveYear("all");
  }, [activeCategory, activeMake]);

  useEffect(() => {
    setActiveChassis("all");
    setActiveYear("all");
  }, [activeModel]);

  const enrichedProducts = useMemo<EnrichedProduct[]>(() => {
    return products.map((product) => {
      const category = normalizeCategory(locale, product);
      const fitment = extractCsfCatalogFitment(product);
      const priceSortValue = pickShopSortableAmount(
        product.price,
        currency,
        rates && { EUR: rates.EUR, USD: rates.USD, UAH: rates.UAH }
      );

      return {
        product,
        categoryLabel: category.label,
        categoryGroup: category.group,
        make: fitment.make,
        models: fitment.models,
        chassisCodes: fitment.chassisCodes,
        yearStart: fitment.yearStart,
        yearEnd: fitment.yearEnd,
        yearLabel: fitment.yearLabel,
        stockState: detectCsfStockState((product as { stock?: string }).stock) as StockFilter,
        priceSortValue,
      };
    });
  }, [products, locale, currency, rates]);

  const queryFilteredProducts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return enrichedProducts;

    return enrichedProducts.filter(({ product, make, models, chassisCodes, yearLabel }) => {
      const haystack = [
        localizeShopProductTitle(locale, product),
        product.sku,
        product.slug,
        make,
        models.join(" "),
        chassisCodes.join(" "),
        yearLabel,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [enrichedProducts, searchQuery, locale]);

  const categoryOptions = useMemo<FacetOption[]>(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const item of queryFilteredProducts) {
      if (activeMake !== "all" && item.make !== activeMake) continue;
      if (activeModel !== "all" && !item.models.includes(activeModel)) continue;
      if (activeChassis !== "all" && !item.chassisCodes.includes(activeChassis)) continue;
      if (activeYear !== "all" && item.yearLabel !== activeYear) continue;
      const existing = counts.get(item.categoryGroup);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(item.categoryGroup, { label: item.categoryLabel, count: 1 });
      }
    }

    return [...counts.entries()]
      .map(([key, value]) => ({ key, label: value.label, count: value.count }))
      .sort((left, right) => right.count - left.count);
  }, [queryFilteredProducts, activeMake, activeModel, activeChassis, activeYear]);

  const makeOptions = useMemo<FacetOption[]>(() => {
    const scoped = activeCategory === "all"
      ? queryFilteredProducts
      : queryFilteredProducts.filter((item) => item.categoryGroup === activeCategory);

    return buildFacetOptions(scoped.map((item) => item.make ?? ""));
  }, [queryFilteredProducts, activeCategory]);

  const modelOptions = useMemo<FacetOption[]>(() => {
    const scoped = queryFilteredProducts.filter((item) => {
      if (activeCategory !== "all" && item.categoryGroup !== activeCategory) return false;
      if (activeMake !== "all" && item.make !== activeMake) return false;
      return true;
    });

    return buildFacetOptions(scoped.flatMap((item) => item.models), isCleanModelLabel);
  }, [queryFilteredProducts, activeCategory, activeMake]);

  const chassisOptions = useMemo<FacetOption[]>(() => {
    const scoped = queryFilteredProducts.filter((item) => {
      if (activeCategory !== "all" && item.categoryGroup !== activeCategory) return false;
      if (activeMake !== "all" && item.make !== activeMake) return false;
      if (activeModel !== "all" && !item.models.includes(activeModel)) return false;
      return true;
    });

    return buildFacetOptions(scoped.flatMap((item) => item.chassisCodes), isCleanChassisLabel);
  }, [queryFilteredProducts, activeCategory, activeMake, activeModel]);

  const yearOptions = useMemo<FacetOption[]>(() => {
    const scoped = queryFilteredProducts.filter((item) => {
      if (activeCategory !== "all" && item.categoryGroup !== activeCategory) return false;
      if (activeMake !== "all" && item.make !== activeMake) return false;
      if (activeModel !== "all" && !item.models.includes(activeModel)) return false;
      if (activeChassis !== "all" && !item.chassisCodes.includes(activeChassis)) return false;
      return true;
    });

    return buildFacetOptions(scoped.map((item) => item.yearLabel ?? ""), isCleanYearLabel);
  }, [queryFilteredProducts, activeCategory, activeMake, activeModel, activeChassis]);

  useEffect(() => {
    if (activeMake === "all") return;
    const exact = makeOptions.find((option) => option.key === activeMake);
    if (exact) return;
    const ci = makeOptions.find((option) => option.key.toLowerCase() === activeMake.toLowerCase());
    setActiveMake(ci ? ci.key : "all");
  }, [makeOptions, activeMake]);

  useEffect(() => {
    if (activeModel !== "all" && !modelOptions.some((option) => option.key === activeModel)) {
      setActiveModel("all");
    }
  }, [modelOptions, activeModel]);

  useEffect(() => {
    if (activeChassis !== "all" && !chassisOptions.some((option) => option.key === activeChassis)) {
      setActiveChassis("all");
    }
  }, [chassisOptions, activeChassis]);

  useEffect(() => {
    if (activeYear !== "all" && !yearOptions.some((option) => option.key === activeYear)) {
      setActiveYear("all");
    }
  }, [yearOptions, activeYear]);

  const filteredProducts = useMemo(() => {
    let result = queryFilteredProducts.filter((item) => {
      if (activeCategory !== "all" && item.categoryGroup !== activeCategory) return false;
      if (activeMake !== "all" && item.make !== activeMake) return false;
      if (activeModel !== "all" && !item.models.includes(activeModel)) return false;
      if (activeChassis !== "all" && !item.chassisCodes.includes(activeChassis)) return false;
      if (activeYear !== "all" && item.yearLabel !== activeYear) return false;
      if (activeStock !== "all" && item.stockState !== activeStock) return false;
      if (!inPriceBand(item.priceSortValue, activePriceBand)) return false;
      return true;
    });

    const stockRank: Record<StockFilter, number> = { "in-stock": 0, "pre-order": 1, "out-of-stock": 2, all: 3 };

    result = [...result].sort((left, right) => {
      if (sortOrder === "price_desc") return right.priceSortValue - left.priceSortValue;
      if (sortOrder === "price_asc") return left.priceSortValue - right.priceSortValue;
      if (sortOrder === "title_asc") {
        return localizeShopProductTitle(locale, left.product).localeCompare(localizeShopProductTitle(locale, right.product));
      }
      const stockDiff = stockRank[left.stockState] - stockRank[right.stockState];
      if (stockDiff !== 0) return stockDiff;
      return right.priceSortValue - left.priceSortValue;
    });

    return result;
  }, [
    queryFilteredProducts,
    activeCategory,
    activeMake,
    activeModel,
    activeChassis,
    activeYear,
    activeStock,
    activePriceBand,
    sortOrder,
    locale,
  ]);

  const displayedProducts = useMemo(() => filteredProducts.slice(0, visibleCount), [filteredProducts, visibleCount]);

  const hasActiveFilters =
    activeCategory !== "all" ||
    activeMake !== "all" ||
    activeModel !== "all" ||
    activeChassis !== "all" ||
    activeYear !== "all" ||
    activeStock !== "all" ||
    activePriceBand !== "all" ||
    sortOrder !== "default" ||
    searchQuery.trim().length > 0;

  const resetFilters = () => {
    setActiveCategory("all");
    setActiveMake("all");
    setActiveModel("all");
    setActiveChassis("all");
    setActiveYear("all");
    setActiveStock("all");
    setActivePriceBand("all");
    setSearchQuery("");
    setSortOrder("default");
  };

  if (!mounted) {
    return (
      <section className="relative z-30 min-h-screen bg-transparent py-8 text-white" aria-busy="true">
        <div className="mx-auto max-w-[1700px] px-6 pb-20 md:px-12 lg:px-16">
          <div className="flex flex-col gap-12 lg:flex-row lg:gap-16">
            <aside className="hidden w-[280px] flex-shrink-0 lg:block">
              <div className="flex flex-col gap-6 rounded-2xl border border-white/[0.04] bg-[#050505]/80 p-6 shadow-2xl backdrop-blur-md lg:sticky lg:top-[120px]">
                <div className="h-8 w-24 animate-pulse rounded-sm bg-white/5" />
                <div className="h-6 w-40 animate-pulse rounded-sm bg-white/5" />
                <div className="h-12 w-full animate-pulse rounded-sm bg-white/5" />
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-3 w-20 animate-pulse rounded-sm bg-white/5" />
                    <div className="h-10 w-full animate-pulse rounded-sm bg-white/5" />
                  </div>
                ))}
              </div>
            </aside>
            <main className="min-w-0 flex-1">
              <div className="mb-6 flex items-center justify-between">
                <div className="h-8 w-72 animate-pulse rounded-sm bg-white/5" />
                <div className="h-10 w-48 animate-pulse rounded-sm bg-white/5" />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:gap-8 xl:grid-cols-3">
                {Array.from({ length: Math.min(products.length || 6, 9) }).map((_, i) => (
                  <div
                    key={i}
                    className="flex flex-col overflow-hidden border border-white/[0.06] bg-gradient-to-b from-[#0c0c10] to-[#080809] shadow-2xl"
                  >
                    <div className="aspect-square animate-pulse bg-white/[0.03]" />
                    <div className="space-y-3 px-3 pb-3 pt-3 sm:px-5 sm:pb-5 sm:pt-4">
                      <div className="h-3 w-16 animate-pulse rounded-sm bg-white/5" />
                      <div className="h-4 w-full animate-pulse rounded-sm bg-white/5" />
                      <div className="h-4 w-3/4 animate-pulse rounded-sm bg-white/5" />
                      <div className="h-5 w-24 animate-pulse rounded-sm bg-white/5" />
                    </div>
                  </div>
                ))}
              </div>
            </main>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative z-30 min-h-screen bg-transparent py-8 text-white">
      <div className="mx-auto max-w-[1700px] px-6 pb-20 md:px-12 lg:px-16">
        <div className="mb-4 flex items-center gap-3 lg:hidden">
          <button
            type="button"
            onClick={toggleMobileFilter}
            aria-expanded={mobileFilterOpen}
            aria-controls="csf-mobile-filters"
            className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-[#050505]/80 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-xl transition-colors hover:border-[#c8102e]/40"
          >
            <SlidersHorizontal size={13} />
            {isUa ? "Фільтри" : "Filters"}
            {hasActiveFilters ? <span className="ml-1 h-1.5 w-1.5 rounded-full bg-[#c8102e]" /> : null}
          </button>
          <p className="text-xs tracking-wide text-white/40">
            {filteredProducts.length} {isUa ? "з" : "of"} {products.length}
          </p>
        </div>

        <div className="flex flex-col gap-12 lg:flex-row lg:gap-16">
          <aside
            id="csf-mobile-filters"
            className={`flex-shrink-0 transition-transform duration-300 ${
              mobileFilterOpen
                ? "fixed inset-y-0 left-0 z-50 block w-[88vw] max-w-[360px]"
                : "hidden w-full lg:block lg:w-[280px]"
            }`}
          >
            <div
              className={`${
                mobileFilterOpen
                  ? "flex min-h-full flex-col gap-6 overflow-y-auto border-r border-white/[0.08] bg-[#050505] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] shadow-2xl"
                  : "flex flex-col gap-6 rounded-2xl border border-white/[0.04] bg-[#050505]/80 p-6 shadow-2xl backdrop-blur-md lg:sticky lg:top-[120px]"
              }`}
            >
              <button
                type="button"
                onClick={closeMobileFilter}
                className="self-end p-1.5 text-white/40 transition-colors hover:text-white lg:hidden"
                aria-label="Close filters"
              >
                <X size={16} />
              </button>

              <div>
                <img src="/images/shop/csf/csf-logo.svg" alt="CSF Racing" className="mb-4 h-8" />
                <h2 className="text-balance text-2xl font-light uppercase text-white">
                  {isUa ? "Фільтр каталогу" : "Catalog filter"}
                </h2>
                <p className="mt-2 text-xs uppercase text-[#c8102e]/70">
                  {filteredProducts.length} {isUa ? "результатів" : "results"}
                </p>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={isUa ? "Пошук за SKU, моделлю, шасі..." : "Search SKU, model, chassis..."}
                  className="w-full rounded-sm border border-white/10 bg-black/40 py-3 pl-11 pr-10 text-sm text-white placeholder:text-white/30 focus:border-[#c8102e]/50 focus:outline-none"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 transition-colors hover:text-white"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-[10px] uppercase text-white/50">{isUa ? "Категорія" : "Category"}</label>
                  <select
                    value={activeCategory}
                    onChange={(event) => setActiveCategory(event.target.value)}
                    className="w-full appearance-none rounded-sm border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition-colors hover:border-white/20 focus:border-[#c8102e]/50"
                  >
                    <option value="all">{isUa ? "Усі категорії" : "All categories"}</option>
                    {categoryOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label} ({option.count})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] uppercase text-white/50">{isUa ? "Марка" : "Make"}</label>
                  <select
                    value={activeMake}
                    onChange={(event) => setActiveMake(event.target.value)}
                    className="w-full appearance-none rounded-sm border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition-colors hover:border-white/20 focus:border-[#c8102e]/50"
                  >
                    <option value="all">{isUa ? "Усі марки" : "All makes"}</option>
                    {makeOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label} ({option.count})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] uppercase text-white/50">{isUa ? "Модель" : "Model"}</label>
                  <select
                    value={activeModel}
                    onChange={(event) => setActiveModel(event.target.value)}
                    disabled={activeMake === "all" || modelOptions.length === 0}
                    className="w-full appearance-none rounded-sm border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition-colors hover:border-white/20 focus:border-[#c8102e]/50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <option value="all">{isUa ? "Усі моделі" : "All models"}</option>
                    {modelOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label} ({option.count})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] uppercase text-white/50">{isUa ? "Шасі / платформа" : "Chassis / platform"}</label>
                  <select
                    value={activeChassis}
                    onChange={(event) => setActiveChassis(event.target.value)}
                    disabled={chassisOptions.length === 0}
                    className="w-full appearance-none rounded-sm border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition-colors hover:border-white/20 focus:border-[#c8102e]/50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <option value="all">{isUa ? "Усі шасі" : "All chassis"}</option>
                    {chassisOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label} ({option.count})
                      </option>
                    ))}
                  </select>
                </div>

                {SHOW_STOCK_BADGE ? (
                  <div>
                    <label className="mb-2 block text-[10px] uppercase text-white/50">{isUa ? "Наявність" : "Stock"}</label>
                    <select
                      value={activeStock}
                      onChange={(event) => setActiveStock(event.target.value as StockFilter)}
                      className="w-full appearance-none rounded-sm border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition-colors hover:border-white/20 focus:border-[#c8102e]/50"
                    >
                      <option value="all">{getStockLabel(locale, "all")}</option>
                      <option value="in-stock">{getStockLabel(locale, "in-stock")}</option>
                      <option value="pre-order">{getStockLabel(locale, "pre-order")}</option>
                      <option value="out-of-stock">{getStockLabel(locale, "out-of-stock")}</option>
                    </select>
                  </div>
                ) : null}

              </div>

              <button
                type="button"
                onClick={resetFilters}
                className="w-full rounded-sm border border-[#c8102e]/30 bg-[#c8102e]/10 px-5 py-3 text-[11px] uppercase text-white transition-colors hover:border-[#c8102e]/50 hover:bg-[#c8102e]/20"
              >
                {isUa ? "Скинути фільтри" : "Reset filters"}
              </button>
            </div>
          </aside>

          {mobileFilterOpen ? <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={closeMobileFilter} /> : null}

          <main className="min-w-0 flex-1">
            <div className="relative z-20 mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-balance text-2xl font-light text-white">{isUa ? "CSF Cooling Catalog" : "CSF Cooling Catalog"}</h3>
                <p className="mt-2 text-sm text-white/45">
                  {filteredProducts.length} {isUa ? "товарів після фільтрації" : "products after filtering"}
                </p>
              </div>

              <div className="relative inline-block">
                <select
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value as SortOrder)}
                  className="appearance-none rounded-lg border border-white/10 bg-[#050505]/80 px-5 py-3 pr-10 text-[10px] font-semibold uppercase tracking-[0.2em] text-white shadow-xl outline-none transition-colors focus:border-[#c8102e]/50"
                >
                  <option value="default">{isUa ? "Рекомендовані" : "Recommended"}</option>
                  <option value="price_desc">{isUa ? "Спочатку дорожчі" : "Price: high to low"}</option>
                  <option value="price_asc">{isUa ? "Спочатку дешевші" : "Price: low to high"}</option>
                  <option value="title_asc">{isUa ? "Назва A-Z" : "Title A-Z"}</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-white/50">
                  <ChevronDown size={12} />
                </div>
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-white/5 bg-black/40 py-32 text-center backdrop-blur-sm">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                  <Search className="h-6 w-6 text-white/20" />
                </div>
                <h3 className="text-xl font-light text-white">{isUa ? "Нічого не знайдено" : "No products found"}</h3>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-white/50">
                  {isUa
                    ? "Змініть параметри фільтра або скиньте їх, щоб повернутись до повного каталогу."
                    : "Adjust the filter parameters or reset them to return to the full catalog."}
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-8 rounded-md border border-[#c8102e]/40 bg-[#c8102e]/15 px-8 py-3 text-[10px] uppercase text-white transition-colors hover:border-[#c8102e]/60 hover:bg-[#c8102e]/25"
                >
                  {isUa ? "Скинути фільтри" : "Reset filters"}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:gap-8 xl:grid-cols-3">
                {displayedProducts.map((entry) => {
                  const { product, categoryLabel, make, models, chassisCodes, yearLabel, stockState } = entry;
                  const productTitle = stripChassisChips(stripCsfSkuPrefix(localizeShopProductTitle(locale, product), product.sku));
                  const defaultVariant = product.variants?.find((variant) => variant.isDefault) ?? product.variants?.[0] ?? null;
                  const computedPrice = computeShopDisplayPrices(
                    product.price,
                    rates && { EUR: rates.EUR, USD: rates.USD, UAH: rates.UAH }
                  );
                  const hasPrice = hasAnyShopPrice(
                    product.price,
                    rates && { EUR: rates.EUR, USD: rates.USD, UAH: rates.UAH }
                  );
                  const primaryPrice =
                    currency === "EUR" && computedPrice.eur > 0
                      ? formatPrice(locale, computedPrice.eur, "EUR")
                      : currency === "USD" && computedPrice.usd > 0
                        ? formatPrice(locale, computedPrice.usd, "USD")
                        : currency === "UAH" && computedPrice.uah > 0
                          ? formatPrice(locale, computedPrice.uah, "UAH")
                          : computedPrice.uah > 0
                            ? formatPrice(locale, computedPrice.uah, "UAH")
                            : computedPrice.usd > 0
                              ? formatPrice(locale, computedPrice.usd, "USD")
                              : computedPrice.eur > 0
                                ? formatPrice(locale, computedPrice.eur, "EUR")
                                : null;
                  const cleanModel = models[0] && models[0].length <= 24 ? models[0] : null;
                  const fitmentBadge = [make, cleanModel, chassisCodes[0], yearLabel].filter(Boolean).join(" · ");

                  return (
                    <article
                      key={product.slug}
                      className="group relative flex flex-col overflow-hidden border border-white/[0.06] bg-gradient-to-b from-[#0c0c10] to-[#080809] shadow-2xl transition-all duration-500 hover:border-white/[0.14] hover:from-[#0f0f14] hover:to-[#0a0a0e]"
                    >
                      <Link href={`/${locale}/shop/csf/products/${product.slug}`} className="z-10 flex flex-grow flex-col">
                        <div className="relative aspect-square overflow-hidden border-b border-white/[0.04] bg-[#0a0a0c] p-3 sm:p-4">
                          <div className="relative h-full w-full overflow-hidden rounded-none bg-white">
                            <div className="absolute inset-[10%]">
                              <ShopProductImage
                                src={product.image || "/images/shop/csf/factory-fallback.jpg"}
                                alt={productTitle}
                                fill
                                sizes="(max-width: 768px) 40vw, 25vw"
                                className="object-contain mix-blend-multiply transition-transform duration-700 group-hover:scale-[1.06]"
                              />
                            </div>
                          </div>
                          <div className="absolute left-4 top-4 z-20 flex flex-wrap gap-1 sm:left-5 sm:top-5 sm:gap-2">
                            <span className="border border-black/10 bg-white/85 px-2 py-0.5 text-[7px] uppercase text-black/70 backdrop-blur-sm sm:px-2.5 sm:py-1 sm:text-[8px]">
                              {categoryLabel}
                            </span>
                            {SHOW_STOCK_BADGE && stockState !== "all" ? (
                              <span
                                className={`border px-2 py-0.5 text-[7px] uppercase backdrop-blur-sm sm:px-2.5 sm:py-1 sm:text-[8px] ${STOCK_BADGE_CLASS[stockState]}`}
                              >
                                {getStockLabel(locale, stockState)}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-grow flex-col px-3 pb-3 pt-3 sm:px-5 sm:pb-5 sm:pt-4">
                          <p className="tabular-nums text-[8px] uppercase text-white/25">{product.sku}</p>
                          <h3 className="mt-2 line-clamp-3 h-[3.6rem] overflow-hidden text-pretty text-[11px] leading-tight text-white/90 transition-colors group-hover:text-white sm:h-[4.2rem] sm:text-[13px]">
                            {productTitle}
                          </h3>
                          <p className="mt-3 line-clamp-1 h-4 text-[8px] uppercase text-white/40 sm:mt-4 sm:h-5 sm:text-[10px]">
                            {fitmentBadge}
                          </p>
                          <div className="mt-auto border-t border-white/[0.04] pt-2 sm:pt-3">
                            {hasPrice ? (
                              <span className="tabular-nums text-[11px] font-medium tracking-wide text-white sm:text-sm">
                                {primaryPrice}
                              </span>
                            ) : (
                              <span className="text-[9px] uppercase text-[#c8102e]/60 sm:text-[10px]">
                                {isUa ? "Ціна за запитом" : "Price on request"}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="absolute left-0 top-0 h-[2px] w-full origin-left scale-x-0 bg-gradient-to-r from-transparent via-[#c8102e] to-transparent transition-transform duration-500 group-hover:scale-x-100" />
                      </Link>

                      <div className="relative z-20 flex gap-2 px-3 pb-3 pt-0 sm:gap-3 sm:px-6 sm:pb-6">
                        <Link
                          href={`/${locale}/shop/csf/products/${product.slug}`}
                          className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[2px] border border-[#c8102e]/30 py-2 text-[9px] uppercase text-[#c8102e] transition-all duration-300 hover:border-[#c8102e] hover:bg-[#c8102e] hover:text-white sm:py-3 sm:text-[10px]"
                        >
                          {isUa ? "Деталі" : "View"}
                          <ArrowRight size={11} strokeWidth={2} className="hidden min-[390px]:block" />
                        </Link>
                        <AddToCartButton
                          slug={product.slug}
                          variantId={defaultVariant?.id ?? null}
                          locale={locale}
                          redirect={true}
                          productName={productTitle}
                          label={isUa ? "КОШИК" : "CART"}
                          labelAdded="✓"
                          className="min-w-0 flex-1 rounded-[2px] border border-white/10 py-2 text-[9px] uppercase text-white transition-all duration-300 hover:border-white hover:bg-white hover:text-black sm:py-3 sm:text-[10px]"
                          variant="inline"
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {filteredProducts.length > visibleCount ? (
              <div className="mt-16 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((current) => current + 30)}
                  className="rounded-[2px] border border-white/20 px-12 py-4 text-[11px] uppercase text-white transition-all duration-300 hover:border-[#c8102e]/50 hover:bg-[#c8102e]/10"
                >
                  {isUa ? "ЗАВАНТАЖИТИ ЩЕ" : "LOAD MORE"}
                </button>
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </section>
  );
}
