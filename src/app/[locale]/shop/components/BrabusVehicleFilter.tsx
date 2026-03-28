"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, X, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct } from "@/lib/shopCatalog";
import { localizeShopProductTitle, localizeShopText } from "@/lib/shopText";
import { buildShopProductPathBrabus } from "@/lib/brabusCollectionMatcher";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";
import BrabusSpotlightGrid from "./BrabusSpotlightGrid";

type BrabusVehicleFilterProps = {
  locale: SupportedLocale;
  products: ShopProduct[];
  viewerContext?: ShopViewerPricingContext;
};

/* ─── Brand display names & order ─── */
const BRAND_ORDER = ["Mercedes", "Porsche", "Rolls-Royce", "Bentley", "Lamborghini", "Range Rover", "smart"];
const BRAND_LABELS: Record<string, Record<string, string>> = {
  Mercedes: { en: "Mercedes-Benz", ua: "Mercedes-Benz" },
  Porsche: { en: "Porsche", ua: "Porsche" },
  "Rolls-Royce": { en: "Rolls-Royce", ua: "Rolls-Royce" },
  Bentley: { en: "Bentley", ua: "Bentley" },
  Lamborghini: { en: "Lamborghini", ua: "Lamborghini" },
  "Range Rover": { en: "Range Rover", ua: "Range Rover" },
  smart: { en: "smart", ua: "smart" },
};

/* ─── Model/Klasse display names ─── */
const MODEL_LABELS: Record<string, Record<string, string>> = {
  // Mercedes
  "G-Klasse": { en: "G-Class", ua: "G-Клас" },
  "A-Klasse": { en: "A-Class", ua: "A-Клас" },
  "C-Klasse": { en: "C-Class", ua: "C-Клас" },
  "CLS-Klasse": { en: "CLS-Class", ua: "CLS-Клас" },
  "E-Klasse": { en: "E-Class", ua: "E-Клас" },
  "EQC": { en: "EQC", ua: "EQC" },
  "EQS SUV": { en: "EQS SUV", ua: "EQS SUV" },
  "GLB-Klasse": { en: "GLB-Class", ua: "GLB-Клас" },
  "GLC-Klasse": { en: "GLC-Class", ua: "GLC-Клас" },
  "GLE-Klasse": { en: "GLE-Class", ua: "GLE-Клас" },
  "GLS-Klasse": { en: "GLS-Class", ua: "GLS-Клас" },
  "GT-Klasse": { en: "AMG GT", ua: "AMG GT" },
  "S-Klasse": { en: "S-Class", ua: "S-Клас" },
  "SL-Klasse": { en: "SL-Class", ua: "SL-Клас" },
  "V-Klasse": { en: "V-Class", ua: "V-Клас" },
  "X-Klasse": { en: "X-Class", ua: "X-Клас" },
  // Porsche
  "Porsche 911 Turbo": { en: "911 Turbo", ua: "911 Turbo" },
  "Porsche Taycan": { en: "Taycan", ua: "Taycan" },
  // Rolls-Royce
  "Rolls-Royce Ghost": { en: "Ghost", ua: "Ghost" },
  "Rolls-Royce Cullinan": { en: "Cullinan", ua: "Cullinan" },
  // Bentley
  "Bentley Continental GT Speed": { en: "Continental GT", ua: "Continental GT" },
  "Bentley Continental GTC Speed": { en: "Continental GTC", ua: "Continental GTC" },
  // Lamborghini
  "Lamborghini Urus SE": { en: "Urus", ua: "Urus" },
  // Range Rover (sometimes tagged as P530)
  "P530": { en: "P530", ua: "P530" },
  // Smart
  "smart #1": { en: "#1", ua: "#1" },
  "smart #3": { en: "#3", ua: "#3" },
};

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

  // EUR-origin (Brabus)
  if (baseEur > 0 && rates) {
    const usdRate = rates.USD || 1;
    return {
      eur: baseEur,
      uah: baseUah > 0 ? baseUah : Math.round(baseEur * eurToUah),
      usd: baseUsd > 0 ? baseUsd : Math.round(baseEur / usdRate),
    };
  }

  // UAH-origin
  if (baseUah > 0 && rates) {
    return {
      uah: baseUah,
      eur: Math.round(baseUah / eurToUah),
      usd: Math.round((baseUah / eurToUah) * (rates.USD || 1)),
    };
  }

  return { uah: baseUah, eur: baseEur, usd: baseUsd };
}

export default function BrabusVehicleFilter({
  locale,
  products,
  viewerContext,
}: BrabusVehicleFilterProps) {
  const isUa = locale === "ua";
  const { currency, rates } = useShopCurrency();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ─── State ───
  const [activeBrand, setActiveBrand] = useState<string>("all");
  const [activeModel, setActiveModel] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  // ─── Extract brands from actual data ───
  const availableBrands = useMemo(() => {
    const brands = new Map<string, number>();
    for (const p of products) {
      const brand = p.tags?.find(t => BRAND_ORDER.includes(t));
      if (brand) brands.set(brand, (brands.get(brand) || 0) + 1);
    }
    return BRAND_ORDER.filter(b => brands.has(b)).map(b => ({
      key: b,
      label: BRAND_LABELS[b]?.[locale] || b,
      count: brands.get(b) || 0,
    }));
  }, [products, locale]);

  // ─── Model/Klasse labels we look for in tags (Mercedes classes) ───
  const MODEL_KEYS_SET = useMemo(() => new Set(Object.keys(MODEL_LABELS)), []);
  
  const availableModels = useMemo(() => {
    if (activeBrand === "all") return [];
    const models = new Map<string, number>();
    for (const p of products) {
      if (!p.tags?.includes(activeBrand)) continue;
      // Look for klasse tags like G-Klasse, S-Klasse etc. or brand-specific identifiers
      const modelTag = p.tags.find(t => MODEL_KEYS_SET.has(t));
      // Also check productType or collection for non-Mercedes brands
      const modelKey = modelTag || p.productType || "";
      if (modelKey) models.set(modelKey, (models.get(modelKey) || 0) + 1);
    }
    return [...models.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({
        key,
        label: MODEL_LABELS[key]?.[locale] || key.replace('-Klasse', '-Class'),
        count,
      }));
  }, [activeBrand, products, locale, MODEL_KEYS_SET]);

  // Reset model when brand changes
  useEffect(() => {
    setActiveModel("all");
    setShowModelDropdown(false);
  }, [activeBrand]);

  // ─── Filter products ───
  const filteredProducts = useMemo(() => {
    let result = products;

    // Brand filter
    if (activeBrand !== "all") {
      result = result.filter(p => p.tags?.includes(activeBrand));
    }

    // Model filter
    if (activeModel !== "all") {
      result = result.filter(p => p.tags?.includes(activeModel));
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p => {
        const title = localizeShopProductTitle(locale, p).toLowerCase();
        const sku = (p.sku || "").toLowerCase();
        const tags = (p.tags || []).join(" ").toLowerCase();
        return title.includes(q) || sku.includes(q) || tags.includes(q);
      });
    }

    // Sort: "Full Kit" / "Набір" products first, then by price descending
    result = [...result].sort((a, b) => {
      const titleA = localizeShopProductTitle(locale, a).toLowerCase();
      const titleB = localizeShopProductTitle(locale, b).toLowerCase();
      const isKitA = titleA.includes('full kit') || titleA.includes('повний комплект') || titleA.includes('набір') || titleA.includes('комплект') || titleA.includes('full body') || titleA.includes('widetrack') || titleA.includes('widebody');
      const isKitB = titleB.includes('full kit') || titleB.includes('повний комплект') || titleB.includes('набір') || titleB.includes('комплект') || titleB.includes('full body') || titleB.includes('widetrack') || titleB.includes('widebody');
      if (isKitA && !isKitB) return -1;
      if (!isKitA && isKitB) return 1;
      // Within same category, sort by price descending (premium first)
      const priceA = a.price?.eur || a.price?.uah || 0;
      const priceB = b.price?.eur || b.price?.uah || 0;
      return priceB - priceA;
    });

    return result;
  }, [activeBrand, activeModel, searchQuery, products, locale]);

  const totalCount = products.length;

  if (!mounted) return null;

  return (
    <section id="catalog" className="bg-[#0a0a0a] text-white py-20 min-h-screen relative z-30">
      <div className="max-w-[1600px] mx-auto px-6 md:px-12 lg:px-16">

        {/* ─── Header Row ─── */}
        <div className="flex flex-col gap-6 mb-10">
          
          {/* Title + Search */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl md:text-2xl font-light tracking-wide uppercase">
                {isUa ? "Каталог компонентів" : "Component Catalog"}
              </h2>
              <p className="text-white/40 text-sm mt-1 tracking-wide">
                {filteredProducts.length} {isUa ? "з" : "of"} {totalCount} {isUa ? "товарів" : "products"}
              </p>
            </div>
            
            {/* Search toggle */}
            <div className="flex items-center gap-4">
              {showSearch && (
                <div className="relative animate-in fade-in slide-in-from-right-4 duration-300">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isUa ? "Пошук по каталогу..." : "Search catalog..."}
                    className="w-64 md:w-80 bg-white/[0.06] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/25 transition-colors"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              )}
              <button
                onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(""); }}
                className={`p-2.5 rounded-lg border transition-colors ${
                  showSearch ? "border-white/20 bg-white/10 text-white" : "border-white/10 bg-white/[0.03] text-white/40 hover:text-white/80"
                }`}
              >
                <Search size={16} />
              </button>
            </div>
          </div>

          {/* ─── Brand Tabs ─── */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide border-b border-white/[0.08] pb-0">
            <button
              onClick={() => setActiveBrand("all")}
              className={`pb-4 px-4 text-[11px] md:text-xs uppercase tracking-[0.15em] font-semibold transition-all whitespace-nowrap border-b-2 -mb-[1px] ${
                activeBrand === "all"
                  ? "border-[#cc0000] text-white"
                  : "border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              {isUa ? "Всі марки" : "All Brands"}
              <span className="ml-2 text-[10px] text-white/30">{totalCount}</span>
            </button>
            {availableBrands.map((brand) => (
              <button
                key={brand.key}
                onClick={() => setActiveBrand(brand.key)}
                className={`pb-4 px-4 text-[11px] md:text-xs uppercase tracking-[0.15em] font-semibold transition-all whitespace-nowrap border-b-2 -mb-[1px] ${
                  activeBrand === brand.key
                    ? "border-[#cc0000] text-white"
                    : "border-transparent text-white/40 hover:text-white/70"
                }`}
              >
                {brand.label}
                <span className="ml-2 text-[10px] text-white/25">{brand.count}</span>
              </button>
            ))}
          </div>

          {/* ─── Model Sub-Filter (appears when brand selected) ─── */}
          {activeBrand !== "all" && availableModels.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap animate-in fade-in slide-in-from-top-2 duration-300">
              <SlidersHorizontal size={14} className="text-white/30" />
              <button
                onClick={() => setActiveModel("all")}
                className={`px-3 py-1.5 text-[10px] md:text-[11px] uppercase tracking-[0.12em] font-medium rounded-full transition-all ${
                  activeModel === "all"
                    ? "bg-white/10 text-white border border-white/20"
                    : "bg-white/[0.03] text-white/50 border border-white/[0.06] hover:bg-white/[0.06] hover:text-white/70"
                }`}
              >
                {isUa ? "Всі моделі" : "All Models"}
              </button>
              {availableModels.map((model) => (
                <button
                  key={model.key}
                  onClick={() => setActiveModel(model.key)}
                  className={`px-3 py-1.5 text-[10px] md:text-[11px] uppercase tracking-[0.12em] font-medium rounded-full transition-all ${
                    activeModel === model.key
                      ? "bg-[#cc0000]/20 text-[#ff4444] border border-[#cc0000]/30"
                      : "bg-white/[0.03] text-white/50 border border-white/[0.06] hover:bg-white/[0.06] hover:text-white/70"
                  }`}
                >
                  {model.label}
                  <span className="ml-1.5 text-[9px] opacity-60">{model.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ─── Product Grid ─── */}
        <BrabusSpotlightGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProducts.map((product) => {
            const pricing = viewerContext
              ? resolveShopProductPricing(product, viewerContext)
              : { effectivePrice: product.price, effectiveCompareAt: product.compareAt, audience: "b2c", b2bVisible: false };

            const computed = computePricesFromEur(
              pricing.effectivePrice,
              rates && { EUR: rates.EUR, USD: rates.USD, UAH: rates.UAH }
            );

            const productTitle = localizeShopProductTitle(locale, product);

            return (
              <article key={product.slug} className="group relative bg-[#121212] rounded-2xl overflow-hidden flex flex-col hover:bg-[rgba(26,26,26,0.9)] transition-colors duration-500 border border-white/[0.04] shadow-2xl">
                <Link
                  href={buildShopProductPathBrabus(locale, product)}
                  className="flex flex-col flex-grow z-10"
                >
                  {/* Image */}
                  <div className="relative aspect-[4/3] bg-transparent overflow-hidden flex items-center justify-center p-8">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(204,0,0,0.15)_0%,transparent_60%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <Image
                      src={product.image || "/images/placeholders/product-fallback.jpg"}
                      alt={productTitle}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-contain p-6 md:p-10 drop-shadow-2xl transition-transform duration-700 group-hover:scale-105 relative z-10"
                    />
                  </div>

                  {/* Card Body */}
                  <div className="px-6 pb-6 pt-2 flex flex-col flex-grow">
                    <h3 className="text-[15px] leading-tight font-medium text-white line-clamp-2 mb-2">
                      {productTitle}
                    </h3>
                    
                    {/* Price */}
                    <div className="mb-6">
                      {computed.eur === 0 ? (
                        <span className="text-sm tracking-wide font-medium text-white/50">
                          {isUa ? "Ціна за запитом" : "Price on Request"}
                        </span>
                      ) : (
                        <span className="text-sm tracking-wide font-normal text-white">
                          {currency === "USD" && formatPrice(locale, computed.usd, "USD")}
                          {currency === "EUR" && formatPrice(locale, computed.eur, "EUR")}
                          {currency === "UAH" && formatPrice(locale, computed.uah, "UAH")}
                        </span>
                      )}
                    </div>
                    
                    {/* VIEW DETAILS */}
                    <div className="mt-auto flex items-center justify-between border-t border-white/[0.08] pt-5">
                      <div className="border border-white/10 bg-white/[0.03] rounded-md px-4 py-2 text-[10px] md:text-[11px] uppercase tracking-widest text-white/80 font-bold group-hover:bg-white/10 transition-colors">
                        {isUa ? "Детальніше" : "View Details"}
                      </div>
                      <div className="w-9 h-9 border border-white/10 bg-white/[0.03] rounded-md flex items-center justify-center group-hover:bg-white/10 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/80"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                      </div>
                    </div>
                  </div>
                </Link>
              </article>
            );
          })}
        </BrabusSpotlightGrid>

        {/* Empty state */}
        {filteredProducts.length === 0 && (
          <div className="py-32 text-center border-t border-b border-white/5">
            <h3 className="text-2xl font-light text-white mb-4">
              {isUa ? "Нічого не знайдено" : "No Components Found"}
            </h3>
            <p className="text-white/70 max-w-lg mx-auto mb-6">
              {searchQuery
                ? (isUa ? `Нічого не знайдено за запитом "${searchQuery}"` : `No results for "${searchQuery}"`)
                : (isUa ? "Компоненти для цієї моделі зараз відсутні." : "Components for this model are currently unavailable.")}
            </p>
            <button
              onClick={() => { setActiveBrand("all"); setActiveModel("all"); setSearchQuery(""); }}
              className="px-6 py-2.5 bg-white/10 text-white text-xs uppercase tracking-widest rounded-lg hover:bg-white/20 transition-colors"
            >
              {isUa ? "Скинути фільтри" : "Reset Filters"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
