"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X, ChevronDown, SlidersHorizontal, ArrowRight } from "lucide-react";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct } from "@/lib/shopCatalog";
import { localizeShopProductTitle } from "@/lib/shopText";
import { buildShopProductPathGirodisc } from "@/lib/girodiscCollectionMatcher";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";
import GirodiscSpotlightGrid from "./GirodiscSpotlightGrid";
import { useMobileFilterDrawer } from "./useMobileFilterDrawer";

type GirodiscVehicleFilterProps = {
  locale: SupportedLocale;
  products: ShopProduct[];
  viewerContext?: ShopViewerPricingContext;
};

// Map internal DB keys to clean display labels
const DISPLAY_LABELS: Record<string, Record<string, string>> = {
  // Categories
  rotors: { en: "Rotors", ua: "Гальмівні диски" },
  pads: { en: "Brake Pads", ua: "Гальмівні колодки" },
  lines: { en: "Brake Lines", ua: "Гальмівні магістралі" },
  fluid: { en: "Brake Fluid", ua: "Гальмівна рідина" },
  hardware: { en: "Hardware", ua: "Кріплення та компоненти" },
  rebuild: { en: "Rebuild Kits", ua: "Ремкомплекти" },
};

const GIRODISC_MAKE_LABELS: Record<string, string> = {
  audi: "Audi",
  bmw: "BMW",
  chevrolet: "Chevrolet",
  corvette: "Chevrolet",
  dodge: "Dodge",
  ferrari: "Ferrari",
  ford: "Ford",
  lamborghini: "Lamborghini",
  lotus: "Lotus",
  mclaren: "McLaren",
  mercedes: "Mercedes-Benz",
  nissan: "Nissan",
  porsche: "Porsche",
  subaru: "Subaru",
  toyota: "Toyota",
};

const GIRODISC_MODEL_MAKE_TERMS: Record<string, string[]> = {
  audi: ["audi"],
  bmw: ["bmw"],
  chevrolet: ["chevrolet", "corvette"],
  corvette: ["chevrolet", "corvette"],
  dodge: ["dodge"],
  ferrari: ["ferrari"],
  ford: ["ford"],
  lamborghini: ["lamborghini"],
  lotus: ["lotus"],
  mclaren: ["mclaren"],
  mercedes: ["mercedes-benz", "mercedes benz", "mercedes", "amg"],
  nissan: ["nissan"],
  porsche: ["porsche"],
  subaru: ["subaru"],
  toyota: ["toyota"],
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeGirodiscToken(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatGirodiscLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => {
      if (/^(bmw|amg|gt|gts|gt2|gt3|gt4|gt4rs|gt500|rs|rs3|rs4|rs5|rs6|rs7|rsq8|r8|tt|sti|wrx|z06|z51)$/i.test(word)) {
        return word.toUpperCase();
      }
      if (/^[a-z]\d/i.test(word) || /^[a-z]{1,3}\d+[a-z]?$/i.test(word)) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function getGirodiscMakeKey(product: ShopProduct) {
  const makeTag = product.tags?.find((tag) => tag.startsWith("car_make:"));
  if (!makeTag) return null;
  const make = makeTag.split(":")[1];
  return make === "corvette" ? "chevrolet" : make;
}

function productMatchesMake(product: ShopProduct, activeMake: string) {
  if (activeMake === "all") return true;
  if (activeMake === "car_make:chevrolet") {
    return product.tags?.includes("car_make:chevrolet") || product.tags?.includes("car_make:corvette");
  }
  return product.tags?.includes(activeMake);
}

function buildGirodiscSearchText(locale: SupportedLocale, product: ShopProduct) {
  return [
    localizeShopProductTitle(locale, product),
    product.title.en,
    product.title.ua,
    product.sku,
    product.slug,
    product.brand,
    product.vendor,
    product.productType,
    product.collection.en,
    product.collection.ua,
    product.category.en,
    product.category.ua,
    ...(product.tags ?? []),
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");
}

function productMatchesSearch(locale: SupportedLocale, product: ShopProduct, query: string) {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  return buildGirodiscSearchText(locale, product).includes(q);
}

function cleanGirodiscModelLabel(value: string) {
  return value
    .replace(/\b(for|для|dlia)\b/gi, " ")
    .replace(/\b(front|rear|left|right|kit|set|brake|pads?|rotors?|rings?|replacement|racing|endurance|magic|performance)\b/gi, " ")
    .replace(/\d{3,4}\s*[xх]\s*\d{2,3}[-\s]*(?:mm|мм|mм|мm)/giu, " ")
    .replace(/\d{3,4}[-\s]*(?:mm|мм|mм|мm)/giu, " ")
    .replace(/\b(19|20)\d{2}\s*(?:-\s*(?:\d{2,4})?)?/g, " ")
    .replace(/[()[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractGirodiscModels(product: ShopProduct, makeKey: string | null) {
  const taggedModels = (product.tags ?? [])
    .filter((tag) => tag.startsWith("car_model:"))
    .map((tag) => tag.slice("car_model:".length))
    .map((value) => ({
      key: normalizeGirodiscToken(value),
      label: formatGirodiscLabel(value),
    }));

  if (taggedModels.length > 0) {
    return taggedModels;
  }

  if (!makeKey) return [];

  const terms = GIRODISC_MODEL_MAKE_TERMS[makeKey] ?? [makeKey];
  const sourceText = `${product.title.en} ${product.title.ua} ${product.slug.replace(/-/g, " ")}`;
  const lowerSource = sourceText.toLowerCase();
  const segments: string[] = [];

  for (const term of terms) {
    const match = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").exec(sourceText);
    if (!match) continue;

    let segment = sourceText.slice(match.index + match[0].length);
    const nextMakeIndex = Object.values(GIRODISC_MODEL_MAKE_TERMS)
      .flat()
      .filter((otherTerm) => !terms.includes(otherTerm))
      .map((otherTerm) => lowerSource.indexOf(otherTerm, match.index + match[0].length))
      .filter((index) => index > -1)
      .sort((a, b) => a - b)[0];

    if (typeof nextMakeIndex === "number") {
      segment = sourceText.slice(match.index + match[0].length, nextMakeIndex);
    }

    segments.push(segment);
  }

  const candidates = segments
    .flatMap((segment) => segment.split(/\s+\/\s+|[,;]|(?:\s+\+\s+)/g))
    .map(cleanGirodiscModelLabel)
    .map((value) => value.replace(new RegExp(`^(${terms.map(escapeRegExp).join("|")})\\s+`, "i"), ""))
    .map((value) => value.trim())
    .filter((value) => value.length >= 2 && value.length <= 42)
    .filter((value) => !/^(and|or|with|without|mm|cm)$|^\d+$/i.test(value));

  const unique = new Map<string, { key: string; label: string }>();
  for (const candidate of candidates) {
    const key = normalizeGirodiscToken(candidate);
    if (!key || unique.has(key)) continue;
    unique.set(key, { key, label: formatGirodiscLabel(candidate) });
  }

  return [...unique.values()];
}

function formatPrice(locale: SupportedLocale, amount: number, currency: "EUR" | "USD" | "UAH") {
  const formatter = new Intl.NumberFormat(locale === "ua" ? "uk-UA" : "en-US", {
    maximumFractionDigits: 0,
  });
  const formatted = formatter.format(amount);
  if (locale === "ua" && currency === "UAH") return `${formatted} грн`;
  return locale === "ua" ? `${formatted} ${currency}` : `${currency} ${formatted}`;
}

function formatComponentCount(locale: SupportedLocale, count: number) {
  if (locale !== "ua") {
    return `${count} component${count === 1 ? "" : "s"}`;
  }

  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  const word =
    lastDigit === 1 && lastTwoDigits !== 11
      ? "компонент"
      : lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)
        ? "компоненти"
        : "компонентів";

  return `${count} ${word}`;
}

const PAGE_SIZE = 30;

function GirodiscProductImage({
  src,
  alt,
}: {
  src: string | null | undefined;
  alt: string;
}) {
  const fallbackSrc = "/images/placeholders/product-fallback.svg";
  const [imageSrc, setImageSrc] = useState(src || fallbackSrc);

  return (
    <Image
      src={imageSrc}
      alt={alt}
      fill
      sizes="(max-width: 768px) 100vw, 33vw"
      className="object-contain p-2 sm:p-6 md:p-8 drop-shadow-2xl transition-transform duration-1000 group-hover:scale-110 relative z-10"
      onError={() => {
        if (imageSrc !== fallbackSrc) {
          setImageSrc(fallbackSrc);
        }
      }}
    />
  );
}

function computePricesFromEur(
  price: ShopProduct["price"],
  rates: { EUR: number; USD: number; UAH?: number } | null
) {
  const baseEur = price.eur;
  const baseUah = price.uah;
  const baseUsd = price.usd;
  const eurToUah = rates?.UAH ?? (rates?.EUR ? rates.EUR : 0);

  // USD-origin (GiroDisc uses USD base prices)
  if (baseUsd > 0 && rates) {
    const equivalentEur = baseUsd / (rates.USD || 1);
    return {
      usd: baseUsd,
      eur: Math.round(equivalentEur),
      uah: Math.round(equivalentEur * eurToUah),
    };
  }

  // Fallback if somehow EUR is base
  if (baseEur > 0 && rates) {
    const usdRate = rates.USD || 1;
    return {
      eur: baseEur,
      uah: baseUah > 0 ? baseUah : Math.round(baseEur * eurToUah),
      usd: baseUsd > 0 ? baseUsd : Math.round(baseEur * usdRate),
    };
  }

  return { uah: baseUah, eur: baseEur, usd: baseUsd };
}

export default function GirodiscVehicleFilter({
  locale,
  products,
  viewerContext,
}: GirodiscVehicleFilterProps) {
  const isUa = locale === "ua";
  const { currency, rates } = useShopCurrency();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialMake = searchParams?.get("make") || "all";
  const initialModel = searchParams?.get("model") || "all";
  const initialCategory = searchParams?.get("category") || "all";
  const initialSort = (searchParams?.get("sort") as "default" | "price_desc" | "price_asc") || "default";
  const initialSearch = searchParams?.get("q") || "";

  // ─── State ───
  const [activeMake, setActiveMake] = useState<string>(initialMake);
  const [activeModel, setActiveModel] = useState<string>(initialModel);
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [sortOrder, setSortOrder] = useState<"default" | "price_desc" | "price_asc">(initialSort);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const { mobileFilterOpen, closeMobileFilter, toggleMobileFilter } = useMobileFilterDrawer();

  const syncToUrl = useCallback((make: string, model: string, category: string, sort: string, q: string) => {
    const params = new URLSearchParams();
    if (make !== "all") params.set("make", make);
    if (model !== "all") params.set("model", model);
    if (category !== "all") params.set("category", category);
    if (sort !== "default") params.set("sort", sort);
    if (q.trim()) params.set("q", q.trim());
    const queryString = params.toString();
    const nextPath = queryString ? `${pathname}?${queryString}` : (pathname || "");
    if (typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", nextPath);
    }
    router.replace(nextPath, { scroll: false });
  }, [pathname, router]);

  // ─── Extract Car Makes (from "car_make:xyz") ───
  const availableMakes = useMemo(() => {
    const makes = new Map<string, number>();
    for (const p of products) {
      if (!productMatchesSearch(locale, p, searchQuery)) continue;
      if (activeCategory !== "all" && !p.tags?.includes(activeCategory)) continue;
      const make = getGirodiscMakeKey(p);
      if (!make) continue;
      makes.set(make, (makes.get(make) || 0) + 1);
    }
    return Array.from(makes.entries())
      .map(([make, count]) => ({
        key: `car_make:${make}`, // Stored as tag format for filtering
        label: GIRODISC_MAKE_LABELS[make] ?? formatGirodiscLabel(make),
        count,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)); // Alphabetical
  }, [products, locale, searchQuery, activeCategory]);

  const activeMakeKey = activeMake.startsWith("car_make:") ? activeMake.slice("car_make:".length) : null;

  // ─── Extract Categories (from "category:xyz") ───
  const availableCategories = useMemo(() => {
    const categories = new Map<string, number>();
    for (const p of products) {
      if (!productMatchesSearch(locale, p, searchQuery)) continue;
      if (!productMatchesMake(p, activeMake)) continue;
      if (activeModel !== "all") {
        const models = extractGirodiscModels(p, activeMakeKey);
        if (!models.some((model) => model.key === activeModel)) continue;
      }
      const catTag = p.tags?.find(t => t.startsWith("category:"));
      if (catTag) {
        const cat = catTag.split(":")[1];
        categories.set(cat, (categories.get(cat) || 0) + 1);
      }
    }
    return Array.from(categories.entries())
      .map(([cat, count]) => ({
        key: `category:${cat}`,
        value: cat,
        label: DISPLAY_LABELS[cat]?.[locale] || cat.replace(/_/g, " ").replace(/-/g, " "),
        count,
      }))
      .sort((a, b) => b.count - a.count); // Most popular first
  }, [products, locale, searchQuery, activeMake, activeMakeKey, activeModel]);

  const availableModels = useMemo(() => {
    if (!activeMakeKey) return [];
    const models = new Map<string, { label: string; count: number }>();

    for (const p of products) {
      if (!productMatchesMake(p, activeMake)) continue;
      if (activeCategory !== "all" && !p.tags?.includes(activeCategory)) continue;
      if (!productMatchesSearch(locale, p, searchQuery)) continue;

      for (const model of extractGirodiscModels(p, activeMakeKey)) {
        const current = models.get(model.key);
        models.set(model.key, {
          label: current?.label ?? model.label,
          count: (current?.count ?? 0) + 1,
        });
      }
    }

    return [...models.entries()]
      .map(([key, value]) => ({ key, label: value.label, count: value.count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [products, activeMake, activeMakeKey, activeCategory, locale, searchQuery]);

  useEffect(() => {
    if (activeModel === "all") return;
    if (!availableModels.some((model) => model.key === activeModel)) {
      setActiveModel("all");
    }
  }, [activeModel, availableModels]);

  // ─── Filter products ───
  const filteredProducts = useMemo(() => {
    let result = products;

    // Filter by Make
    if (activeMake !== "all") {
      result = result.filter((p) => productMatchesMake(p, activeMake));
    }

    if (activeModel !== "all") {
      result = result.filter((p) => extractGirodiscModels(p, activeMakeKey).some((model) => model.key === activeModel));
    }

    // Filter by Category
    if (activeCategory !== "all") {
      result = result.filter(p => p.tags?.includes(activeCategory));
    }

    // Search query
    if (searchQuery.trim()) {
      result = result.filter((p) => productMatchesSearch(locale, p, searchQuery));
    }

    // Sort order
    result = [...result].sort((a, b) => {
      const priceA = a.price?.usd || a.price?.eur || a.price?.uah || 0;
      const priceB = b.price?.usd || b.price?.eur || b.price?.uah || 0;

      if (sortOrder === "price_desc") return priceB - priceA;
      if (sortOrder === "price_asc") return priceA - priceB;

      // Default sorting: Alphabetical if same price, or just SKU
      return (a.sku || "").localeCompare(b.sku || "");
    });

    return result;
  }, [activeMake, activeModel, activeMakeKey, activeCategory, searchQuery, sortOrder, products, locale]);

  const displayedProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount]
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeMake, activeModel, activeCategory, searchQuery, sortOrder]);

  if (!mounted) return null;

  const hasActiveFilters =
    activeMake !== "all" ||
    activeModel !== "all" ||
    activeCategory !== "all" ||
    searchQuery.trim().length > 0 ||
    sortOrder !== "default";

  function resetFilters() {
    setActiveMake("all");
    setActiveModel("all");
    setActiveCategory("all");
    setSearchQuery("");
    setSortOrder("default");
    syncToUrl("all", "all", "all", "default", "");
  }

  function updateMake(nextMake: string) {
    setActiveMake(nextMake);
    setActiveModel("all");
    syncToUrl(nextMake, "all", activeCategory, sortOrder, searchQuery);
  }

  function updateModel(nextModel: string) {
    setActiveModel(nextModel);
    syncToUrl(activeMake, nextModel, activeCategory, sortOrder, searchQuery);
  }

  function updateCategory(nextCategory: string) {
    setActiveCategory(nextCategory);
    syncToUrl(activeMake, activeModel, nextCategory, sortOrder, searchQuery);
  }

  function updateSort(nextSort: "default" | "price_desc" | "price_asc") {
    setSortOrder(nextSort);
    syncToUrl(activeMake, activeModel, activeCategory, nextSort, searchQuery);
  }

  function updateSearch(nextQuery: string) {
    setSearchQuery(nextQuery);
    syncToUrl(activeMake, activeModel, activeCategory, sortOrder, nextQuery);
  }

  return (
    <section id="catalog" className="bg-transparent text-white py-8 min-h-screen relative z-30">
      <div className="max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-20">
        
        {/* ─── Mobile Filter Toggle ─── */}
        <div className="lg:hidden flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={toggleMobileFilter}
            aria-expanded={mobileFilterOpen}
            aria-controls="girodisc-mobile-filters"
            className="flex items-center gap-2.5 px-5 py-3 bg-[#050505]/80 backdrop-blur-md border border-white/[0.08] rounded-xl text-white text-[10px] uppercase tracking-[0.18em] font-semibold hover:border-red-600/40 transition-colors shadow-xl"
          >
            <SlidersHorizontal size={13} />
            {isUa ? "Фільтри" : "Filters"}
            {hasActiveFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 ml-1" />
            )}
          </button>
          <p className="text-white/40 text-xs tracking-wide">
            {formatComponentCount(locale, filteredProducts.length)}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
          
          {/* ─── LEFT: SIDEBAR (collapsible on mobile) ─── */}
          <aside
            id="girodisc-mobile-filters"
            className={`
            flex-shrink-0 transition-transform duration-300
            ${mobileFilterOpen 
              ? "fixed inset-y-0 left-0 z-50 w-[85%] sm:w-[320px] bg-[#030303] border-r border-white/5 shadow-[20px_0_60px_rgba(0,0,0,0.9)] overflow-y-auto custom-scrollbar block" 
              : "hidden lg:block w-full lg:w-[260px] xl:w-[280px]"
            }
          `}
          >
            <div className={`
              ${mobileFilterOpen ? 'p-6 min-h-full flex flex-col gap-8' : 'lg:sticky lg:top-[120px] max-h-[85vh] overflow-y-auto custom-scrollbar pb-10 flex flex-col gap-8 bg-[#050505]/80 backdrop-blur-md border border-white/[0.04] p-6 rounded-2xl shadow-2xl'}
            `}>
              
              {/* Mobile close button */}
              <button
                type="button"
                onClick={closeMobileFilter}
                className="lg:hidden self-end p-1.5 text-white/40 hover:text-white transition-colors"
                aria-label="Close filters"
              >
                <X size={16} />
              </button>
              
              {/* Header */}
              <div>
                <h2 className="text-2xl font-light tracking-widest uppercase mb-1 drop-shadow-sm border-l-2 border-red-600 pl-3">
                  {isUa ? "Каталог" : "Catalog"}
                </h2>
                <p className="text-white/60 text-xs tracking-widest uppercase font-semibold pl-3.5">
                  {formatComponentCount(locale, filteredProducts.length)}
                </p>
              </div>

              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => updateSearch(e.target.value)}
                  placeholder={isUa ? "Пошук за назвою або SKU..." : "Search part or SKU..."}
                  className="w-full bg-black/40 border border-white/10 rounded-sm pl-11 pr-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-red-600/50 transition-colors backdrop-blur-md"
                />
                {searchQuery && (
                  <button
                    onClick={() => updateSearch("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* CATEGORIES FILTER */}
              <div className="flex flex-col gap-3 mt-2">
                <h3 className="text-xs text-white/60 uppercase tracking-widest border-b border-white/[0.06] pb-2 font-medium">
                  {isUa ? "Категорія" : "Category"}
                </h3>
                <ul className="flex flex-col">
                  <li>
                    <button
                      onClick={() => updateCategory("all")}
                      className={`w-full text-left py-2.5 text-xs uppercase tracking-[0.14em] font-semibold transition-colors flex justify-between items-center ${
                        activeCategory === "all" ? "text-white" : "text-white/50 hover:text-white"
                      }`}
                    >
                      <span>{isUa ? "Всі категорії" : "All Categories"}</span>
                      {activeCategory === "all" && <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>}
                    </button>
                  </li>
                  {availableCategories.map((cat) => (
                    <li key={cat.key}>
                      <button
                        onClick={() => updateCategory(cat.key)}
                        className={`w-full text-left py-2.5 text-[11px] uppercase tracking-[0.14em] font-semibold transition-colors flex justify-between items-center ${
                          activeCategory === cat.key ? "text-white" : "text-white/50 hover:text-white"
                        }`}
                      >
                        <span>{cat.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-white/40 font-bold">{cat.count}</span>
                          {activeCategory === cat.key && <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* MAKES FILTER */}
              <div className="flex flex-col gap-3 mt-2">
                <h3 className="text-xs text-white/60 uppercase tracking-widest border-b border-white/[0.06] pb-2 font-medium">
                  {isUa ? "Марка Авто" : "Vehicle Make"}
                </h3>
                <ul className="flex flex-col max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                  <li>
                    <button
                      onClick={() => updateMake("all")}
                      className={`w-full text-left py-2 text-[11px] uppercase tracking-[0.14em] font-semibold transition-colors flex justify-between items-center ${
                        activeMake === "all" ? "text-white" : "text-white/40 hover:text-white"
                      }`}
                    >
                      <span>{isUa ? "Всі марки" : "All Makes"}</span>
                      {activeMake === "all" && <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>}
                    </button>
                  </li>
                  {availableMakes.map((make) => (
                    <li key={make.key}>
                      <button
                        onClick={() => updateMake(make.key)}
                        className={`w-full text-left py-2 text-[11px] uppercase tracking-[0.12em] font-semibold transition-colors flex justify-between items-center ${
                          activeMake === make.key ? "text-white" : "text-white/40 hover:text-white"
                        }`}
                      >
                        <span>{make.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] opacity-50">{make.count}</span>
                          {activeMake === make.key && <span className="w-1 h-1 rounded-full bg-red-600"></span>}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* MODELS FILTER */}
              <div className="flex flex-col gap-3 mt-2">
                <h3 className="text-xs text-white/60 uppercase tracking-widest border-b border-white/[0.06] pb-2 font-medium">
                  {isUa ? "Модель" : "Vehicle Model"}
                </h3>
                {activeMake === "all" ? (
                  <p className="text-[11px] leading-relaxed text-white/35">
                    {isUa ? "Спочатку оберіть марку авто." : "Select a vehicle make first."}
                  </p>
                ) : (
                  <ul className="flex flex-col max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    <li>
                      <button
                        onClick={() => updateModel("all")}
                        className={`w-full text-left py-2 text-[11px] uppercase tracking-[0.14em] font-semibold transition-colors flex justify-between items-center ${
                          activeModel === "all" ? "text-white" : "text-white/40 hover:text-white"
                        }`}
                      >
                        <span>{isUa ? "Усі моделі" : "All Models"}</span>
                        {activeModel === "all" && <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>}
                      </button>
                    </li>
                    {availableModels.map((model) => (
                      <li key={model.key}>
                        <button
                          onClick={() => updateModel(model.key)}
                          className={`w-full text-left py-2 text-[11px] uppercase tracking-[0.12em] font-semibold transition-colors flex justify-between items-center ${
                            activeModel === model.key ? "text-white" : "text-white/40 hover:text-white"
                          }`}
                        >
                          <span>{model.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] opacity-50">{model.count}</span>
                            {activeModel === model.key && <span className="w-1 h-1 rounded-full bg-red-600"></span>}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

            </div>
          </aside>

          {/* Mobile overlay backdrop */}
          {mobileFilterOpen && (
            <div
              className="lg:hidden fixed inset-0 bg-black/40 z-20"
              onClick={closeMobileFilter}
            />
          )}

          {/* ─── RIGHT: PRODUCT GRID ─── */}
          <main className="flex-1 min-w-0">
            {/* Top Sort Bar */}
            <div className="flex justify-end mb-6 z-20 relative">
              <div className="relative inline-block">
                <select
                  value={sortOrder}
                  onChange={(e) => updateSort(e.target.value as "default" | "price_desc" | "price_asc")}
                  className="appearance-none bg-[#050505]/80 backdrop-blur-md border border-white/10 text-white text-[10px] uppercase tracking-[0.2em] font-semibold px-5 py-3 pr-10 rounded-lg outline-none focus:border-red-600/50 transition-colors shadow-xl cursor-pointer"
                >
                  <option value="default">{isUa ? "За замовчуванням" : "Default"}</option>
                  <option value="price_desc">{isUa ? "Ціна: Від найбільшої" : "Price: High to Low"}</option>
                  <option value="price_asc">{isUa ? "Ціна: Від найменшої" : "Price: Low to High"}</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-white/50">
                  <ChevronDown size={12} />
                </div>
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="py-32 text-center bg-black/40 backdrop-blur-sm border border-white/5 rounded-2xl flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6">
                  <Search className="w-6 h-6 text-white/20" />
                </div>
                <h3 className="text-xl font-light text-white mb-3">
                  {isUa ? "Нічого не знайдено" : "No Components Found"}
                </h3>
                <p className="text-white/50 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                  {searchQuery
                    ? (isUa ? `Нічого не знайдено за запитом "${searchQuery}"` : `No results for "${searchQuery}"`)
                    : (isUa ? "Діапазон деталей відсутній." : "Components for this category/make are currently unavailable.")}
                </p>
                <button
                  onClick={resetFilters}
                  className="px-8 py-3 bg-red-600/10 backdrop-blur-xl border border-red-600/30 text-white text-[10px] uppercase tracking-widest hover:bg-red-600/20 hover:border-red-600/60 transition-all duration-500 shadow-lg rounded-md font-medium"
                >
                  {isUa ? "Скинути фільтри" : "Reset Filters"}
                </button>
              </div>
            ) : (
              <>
              <GirodiscSpotlightGrid className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6 lg:gap-8">
                {displayedProducts.map((product) => {
                  const pricing = viewerContext
                    ? resolveShopProductPricing(product, viewerContext)
                    : { effectivePrice: product.price, effectiveCompareAt: product.compareAt, audience: "b2c", b2bVisible: false };

                  const computed = computePricesFromEur(
                    pricing.effectivePrice,
                    rates && { EUR: rates.EUR, USD: rates.USD, UAH: rates.UAH }
                  );

                  const productTitle = localizeShopProductTitle(locale, product);
                  const productMakeKey = getGirodiscMakeKey(product);
                  const productMakeLabel = productMakeKey ? (GIRODISC_MAKE_LABELS[productMakeKey] ?? formatGirodiscLabel(productMakeKey)) : null;
                  const productModels = extractGirodiscModels(product, productMakeKey);
                  const productModelLabel =
                    (activeModel !== "all"
                      ? productModels.find((model) => model.key === activeModel)?.label
                      : null) ?? productModels[0]?.label ?? null;
                  
                  // Category Badge helper
                  const catTag = product.tags?.find(t => t.startsWith("category:"));
                  const catNameDisplay = catTag 
                    ? DISPLAY_LABELS[catTag.split(":")[1]]?.[locale] || catTag.split(":")[1] 
                    : "Part";

                  return (
                    <article key={product.slug} className="group relative bg-[#030303] backdrop-blur-xl rounded-none overflow-hidden flex flex-col hover:bg-[#080808] transition-all duration-700 border border-white/[0.03] hover:border-white/[0.08] shadow-2xl">
                      <Link
                        href={buildShopProductPathGirodisc(locale, product)}
                        className="flex flex-col flex-grow z-10"
                      >
                        {/* Image Container */}
                        <div className="relative aspect-square sm:aspect-[4/3] bg-[#050505] overflow-hidden flex items-center justify-center p-3 sm:p-8 border-b border-white/[0.03] group-hover:border-red-600/30 transition-colors duration-700">
                          {/* Premium Background Effects */}
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04)_0,transparent_1px)] bg-[size:4px_4px] opacity-20 pointer-events-none mix-blend-overlay"></div>
                          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] opacity-20 group-hover:opacity-40 transition-opacity duration-700" />
                          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(220,38,38,0.15)_0%,transparent_60%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                          
                          <GirodiscProductImage src={product.image} alt={productTitle} />
                          <div className="absolute left-2 top-2 z-20 sm:left-4 sm:top-4">
                            <span className="px-2 py-1 bg-[#0a0a0a]/90 backdrop-blur-xl text-white/80 border border-white/5 text-[7px] sm:text-[9px] uppercase tracking-[0.14em] sm:tracking-[0.2em] font-bold rounded-sm shadow-xl">
                              {catNameDisplay}
                            </span>
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="px-3 pb-3 pt-3 sm:px-6 sm:pb-6 sm:pt-5 flex flex-col flex-grow relative">
                          <p className="text-[8px] sm:text-[10px] uppercase tracking-[0.16em] sm:tracking-[0.25em] font-bold text-red-600 mb-2 sm:mb-3">{product.sku}</p>
                          {(productMakeLabel || productModelLabel) && (
                            <p className="mb-2 text-[8px] sm:text-[9px] uppercase tracking-[0.12em] sm:tracking-[0.18em] text-white/35 line-clamp-1">
                              {[productMakeLabel, productModelLabel].filter(Boolean).join(" · ")}
                            </p>
                          )}
                          <h3 className="text-[11px] sm:text-[13px] font-normal leading-snug sm:leading-relaxed text-white/80 group-hover:text-white line-clamp-3 mb-3 sm:mb-6 transition-colors duration-300">
                            {productTitle}
                          </h3>
                          
                          {/* Price */}
                          <div className="mt-auto">
                            {computed.usd === 0 ? (
                              <span className="text-[9px] sm:text-[12px] tracking-[0.12em] sm:tracking-[0.15em] uppercase font-medium text-white/40">
                                {isUa ? "Ціна за запитом" : "Price on Request"}
                              </span>
                            ) : (
                              <div className="flex flex-col p-1 pl-0">
                                {pricing.effectiveCompareAt?.usd && pricing.effectiveCompareAt.usd > computed.usd && (
                                  <span className="text-xs text-white/40 line-through mb-1 font-light">
                                    {currency === "USD" && formatPrice(locale, pricing.effectiveCompareAt.usd, "USD")}
                                    {currency === "EUR" && formatPrice(locale, pricing.effectiveCompareAt.usd * (rates?.USD ? (rates.EUR / rates.USD) : 1), "EUR")}
                                    {currency === "UAH" && formatPrice(locale, pricing.effectiveCompareAt.usd * (rates?.USD || 1), "UAH")}
                                  </span>
                                )}
                                <span className="text-[11px] sm:text-[18px] tracking-wider sm:tracking-widest font-light text-white group-hover:text-red-500 transition-colors duration-300">
                                  {currency === "USD" && formatPrice(locale, computed.usd, "USD")}
                                  {currency === "EUR" && formatPrice(locale, computed.eur, "EUR")}
                                  {currency === "UAH" && formatPrice(locale, computed.uah, "UAH")}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* HOVER OVERLAY STRIPS */}
                        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-600 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-center" />
                        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-600 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-center" />
                      </Link>

                      {/* Bottom Actions: View + Add To Cart */}
                      <div className="px-3 pb-3 pt-0 sm:px-6 sm:pb-6 z-20 relative flex gap-2 sm:gap-3">
                        <Link
                          href={buildShopProductPathGirodisc(locale, product)}
                          className="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 sm:py-3 border border-red-600/30 text-[9px] sm:text-[10px] tracking-[0.1em] sm:tracking-[0.3em] uppercase font-light text-red-500 hover:text-white hover:bg-red-600 hover:border-red-600 transition-all duration-300 rounded-[2px]"
                        >
                          {isUa ? "Деталі" : "View"}
                          <ArrowRight size={11} strokeWidth={2} className="hidden min-[390px]:block" />
                        </Link>
                        <AddToCartButton
                          slug={product.slug}
                          variantId={null}
                          locale={locale}
                          redirect={true}
                          productName={productTitle}
                          label={isUa ? "КОШИК" : "CART"}
                          labelAdded={isUa ? "✓" : "✓"}
                          className="flex-1 min-w-0 flex items-center justify-center py-2 sm:py-3 border border-white/10 text-[9px] sm:text-[10px] tracking-[0.1em] sm:tracking-[0.3em] uppercase font-light text-white hover:text-black hover:bg-white hover:border-white transition-all duration-300 rounded-[2px]"
                          variant="inline"
                        />
                      </div>
                    </article>
                  );
                })}
              </GirodiscSpotlightGrid>
              {visibleCount < filteredProducts.length ? (
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
                    className="rounded-full border border-red-600/35 bg-red-600/10 px-7 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-red-100 transition hover:border-red-600/70 hover:bg-red-600/20"
                  >
                    {isUa ? "Показати ще" : "Show more"} ({filteredProducts.length - visibleCount})
                  </button>
                </div>
              ) : null}
              </>
            )}
          </main>
        </div>

      </div>
    </section>
  );
}
