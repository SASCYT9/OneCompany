"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, X, ChevronDown, SlidersHorizontal, ArrowRight } from "lucide-react";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { ShopProductImage } from "@/components/shop/ShopProductImage";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct } from "@/lib/shopCatalog";
import { localizeShopProductTitle } from "@/lib/shopText";
import { buildShopProductPathBrabus } from "@/lib/brabusCollectionMatcher";
import { resolveBrabusFallbackImage } from "@/lib/brabusImageFallbacks";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";
import BrabusSpotlightGrid from "./BrabusSpotlightGrid";
import { useMobileFilterDrawer } from "./useMobileFilterDrawer";

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
  "EQC-Klasse": { en: "EQC", ua: "EQC" },
  "EQC": { en: "EQC", ua: "EQC" },
  "EQS-Klasse": { en: "EQS", ua: "EQS" },
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

function resolveBrabusModelKey(product: ShopProduct, modelKeysSet: Set<string>) {
  return product.tags?.find((tag) => modelKeysSet.has(tag)) || null;
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

  const searchParams = useSearchParams();
  const initialBrand = searchParams?.get("brand") || "all";
  const initialModel = searchParams?.get("model") || "all";

  // ─── State ───
  const [activeBrand, setActiveBrand] = useState<string>(initialBrand);
  const [activeModel, setActiveModel] = useState<string>(initialModel);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"default" | "price_desc" | "price_asc">("default");
  const { mobileFilterOpen, closeMobileFilter, toggleMobileFilter } = useMobileFilterDrawer();

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
      const modelKey = resolveBrabusModelKey(p, MODEL_KEYS_SET);
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
      result = result.filter((p) => resolveBrabusModelKey(p, MODEL_KEYS_SET) === activeModel);
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

    // Sort: "Full Kit" / "Набір" products first, then by price descending (or custom sort)
    result = [...result].sort((a, b) => {
      const priceA = a.price?.eur || a.price?.uah || 0;
      const priceB = b.price?.eur || b.price?.uah || 0;

      if (sortOrder === "price_desc") return priceB - priceA;
      if (sortOrder === "price_asc") return priceA - priceB;

      // Default sorting
      const titleA = localizeShopProductTitle(locale, a).toLowerCase();
      const titleB = localizeShopProductTitle(locale, b).toLowerCase();
      const isKitA = titleA.includes('full kit') || titleA.includes('повний комплект') || titleA.includes('набір') || titleA.includes('комплект') || titleA.includes('full body') || titleA.includes('widetrack') || titleA.includes('widebody');
      const isKitB = titleB.includes('full kit') || titleB.includes('повний комплект') || titleB.includes('набір') || titleB.includes('комплект') || titleB.includes('full body') || titleB.includes('widetrack') || titleB.includes('widebody');
      
      if (isKitA && !isKitB) return -1;
      if (!isKitA && isKitB) return 1;
      return priceB - priceA;
    });

    return result;
  }, [activeBrand, activeModel, searchQuery, sortOrder, products, locale]);

  const totalCount = products.length;

  if (!mounted) return null;

  return (
    <section id="catalog" className="bg-transparent text-white py-8 min-h-screen relative z-30">
      <div className="max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-20">
        
        {/* ─── Mobile Filter Toggle ─── */}
        <div className="lg:hidden flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={toggleMobileFilter}
            aria-expanded={mobileFilterOpen}
            aria-controls="brabus-mobile-filters"
            className="flex items-center gap-2.5 px-5 py-3 bg-[#050505]/80 backdrop-blur-md border border-white/[0.08] rounded-xl text-white text-[10px] uppercase tracking-[0.18em] font-semibold hover:border-[#c29d59]/40 transition-colors shadow-xl"
          >
            <SlidersHorizontal size={13} />
            {isUa ? "Фільтри" : "Filters"}
            {activeBrand !== "all" && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#c29d59] ml-1" />
            )}
          </button>
          <p className="text-white/40 text-xs tracking-wide">
            {filteredProducts.length} {isUa ? "з" : "of"} {totalCount}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
          
          {/* ─── LEFT: SIDEBAR (collapsible on mobile) ─── */}
          <aside
            id="brabus-mobile-filters"
            className={`flex-shrink-0 transition-transform duration-300 ${
              mobileFilterOpen
                ? "fixed inset-y-0 left-0 z-50 block w-[88vw] max-w-[360px]"
                : "hidden lg:block w-full lg:w-[260px] xl:w-[280px]"
            }`}
          >
            <div
              className={`${
                mobileFilterOpen
                  ? "flex min-h-full flex-col gap-8 overflow-y-auto border-r border-white/[0.08] bg-[#050505] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] shadow-2xl"
                  : "lg:sticky lg:top-[120px] pb-10 flex flex-col gap-8 bg-[#050505]/80 backdrop-blur-md border border-white/[0.04] p-6 rounded-2xl shadow-2xl"
              }`}
            >
              
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
                <h2 className="text-2xl font-light tracking-widest uppercase mb-1 drop-shadow-sm">
                  {isUa ? "Каталог" : "Catalog"}
                </h2>
                <p className="text-white/60 text-xs tracking-widest uppercase font-semibold">
                  {filteredProducts.length} {isUa ? "з" : "of"} {totalCount} {isUa ? "компонентів" : "components"}
                </p>
              </div>

              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isUa ? "Пошук деталей..." : "Search parts..."}
                  className="w-full bg-black/40 border border-white/10 rounded-sm pl-11 pr-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#c29d59]/50 transition-colors backdrop-blur-md"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* BRANDS FILTER */}
              <div className="flex flex-col gap-3 mt-2">
                <h3 className="text-xs text-white/60 uppercase tracking-widest border-b border-white/[0.06] pb-2 font-medium">
                  {isUa ? "Оберіть марку" : "Select Brand"}
                </h3>
                <ul className="flex flex-col">
                  <li>
                    <button
                      onClick={() => setActiveBrand("all")}
                      className={`w-full text-left py-2.5 text-xs uppercase tracking-[0.15em] font-semibold transition-colors flex justify-between items-center ${
                        activeBrand === "all" ? "text-white" : "text-white/50 hover:text-white"
                      }`}
                    >
                      <span>{isUa ? "Всі марки" : "All Brands"}</span>
                      {activeBrand === "all" && <span className="w-1.5 h-1.5 rounded-full bg-[#c29d59]"></span>}
                    </button>
                  </li>
                  {availableBrands.map((brand) => (
                    <li key={brand.key}>
                      <button
                        onClick={() => setActiveBrand(brand.key)}
                        className={`w-full text-left py-2.5 text-xs uppercase tracking-[0.15em] font-semibold transition-colors flex justify-between items-center ${
                          activeBrand === brand.key ? "text-white" : "text-white/50 hover:text-white"
                        }`}
                      >
                        <span>{brand.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-white/40 font-bold">{brand.count}</span>
                          {activeBrand === brand.key && <span className="w-1.5 h-1.5 rounded-full bg-[#c29d59]"></span>}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* MODELS FILTER (Conditional) */}
              {activeBrand !== "all" && availableModels.length > 1 && (
                <div className="flex flex-col gap-3 mt-2 animate-in fade-in slide-in-from-top-4 duration-500">
                  <h3 className="text-xs text-white/60 uppercase tracking-widest border-b border-white/[0.06] pb-2 flex items-center gap-2 font-medium">
                    <SlidersHorizontal size={12} />
                    {isUa ? "Модель кузова" : "Chassis Model"}
                  </h3>
                  <ul className="flex flex-col">
                    <li>
                      <button
                        onClick={() => setActiveModel("all")}
                        className={`w-full text-left py-2 text-[11px] uppercase tracking-[0.12em] font-semibold transition-colors flex justify-between items-center ${
                          activeModel === "all" ? "text-[#c29d59]" : "text-white/40 hover:text-white"
                        }`}
                      >
                        {isUa ? "Всі моделі" : "All Models"}
                      </button>
                    </li>
                    {availableModels.map((model) => (
                      <li key={model.key}>
                        <button
                          onClick={() => setActiveModel(model.key)}
                          className={`w-full text-left py-2 text-[11px] uppercase tracking-[0.12em] font-semibold transition-colors flex justify-between items-center ${
                            activeModel === model.key ? "text-[#c29d59]" : "text-white/40 hover:text-white"
                          }`}
                        >
                          <span>{model.label}</span>
                          <span className="text-[10px] opacity-60">{model.count}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
          </aside>

          {/* Mobile overlay backdrop */}
          {mobileFilterOpen && (
            <div
              className="lg:hidden fixed inset-0 z-40 bg-black/60"
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
                  onChange={(e) => setSortOrder(e.target.value as "default" | "price_desc" | "price_asc")}
                  className="appearance-none bg-[#050505]/80 backdrop-blur-md border border-white/10 text-white text-[10px] uppercase tracking-[0.2em] font-semibold px-5 py-3 pr-10 rounded-lg outline-none focus:border-[#c29d59]/50 transition-colors shadow-xl cursor-pointer"
                >
                  <option value="default">{isUa ? "За замовчуванням (Популярні)" : "Default (Popular)"}</option>
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
                    : (isUa ? "Компоненти для цієї моделі зараз відсутні." : "Components for this model are currently unavailable.")}
                </p>
                <button
                  onClick={() => { setActiveBrand("all"); setActiveModel("all"); setSearchQuery(""); setSortOrder("default"); }}
                  className="px-8 py-3 bg-[#c29d59]/15 backdrop-blur-xl border border-[#c29d59]/40 text-white text-[10px] uppercase tracking-widest hover:bg-[#c29d59]/25 hover:border-[#c29d59]/70 transition-all duration-500 shadow-lg rounded-md font-medium"
                >
                  {isUa ? "Скинути фільтри" : "Reset Filters"}
                </button>
              </div>
            ) : (
              <BrabusSpotlightGrid className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
                {filteredProducts.map((product) => {
                  const pricing = viewerContext
                    ? resolveShopProductPricing(product, viewerContext)
                    : { effectivePrice: product.price, effectiveCompareAt: product.compareAt, audience: "b2c", b2bVisible: false };

                  const computed = computePricesFromEur(
                    pricing.effectivePrice,
                    rates && { EUR: rates.EUR, USD: rates.USD, UAH: rates.UAH }
                  );

                  const productTitle = localizeShopProductTitle(locale, product);
                  const productFallbackImage = resolveBrabusFallbackImage(product);

                  return (
                    <article key={product.slug} className="group relative bg-[#050505]/60 backdrop-blur-xl rounded-none overflow-hidden flex flex-col hover:bg-[rgba(10,10,10,0.85)] transition-all duration-500 border border-white/[0.04] shadow-2xl">
                      <Link
                        href={buildShopProductPathBrabus(locale, product)}
                        className="flex flex-col flex-grow z-10"
                      >
                        {/* Image */}
                        <div className="relative aspect-[4/3] bg-transparent overflow-hidden flex items-center justify-center p-8 border-b border-white/[0.02]">
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(194,157,89,0.15)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                          <ShopProductImage
                            src={product.image || "/images/placeholders/product-fallback.svg"}
                            fallbackSrc={productFallbackImage}
                            alt={productTitle}
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            className="object-contain p-6 md:p-8 drop-shadow-2xl transition-transform duration-700 group-hover:scale-110 relative z-10"
                          />
                        </div>

                        {/* Card Body */}
                        <div className="px-6 pb-6 pt-5 flex flex-col flex-grow">
                          <p className="text-[9px] uppercase tracking-[0.2em] font-bold text-[#c29d59] mb-2">{product.brand}</p>
                          <h3 className="text-sm font-light leading-snug text-white line-clamp-2 mb-4">
                            {productTitle}
                          </h3>
                          
                          {/* Price */}
                          <div className="mt-auto">
                            {computed.eur === 0 ? (
                              <span className="text-[11px] tracking-wider uppercase font-medium text-white/50">
                                {isUa ? "Ціна за запитом" : "Price on Request"}
                              </span>
                            ) : (
                              <span className="text-sm tracking-widest font-light text-white">
                                {currency === "USD" && formatPrice(locale, computed.usd, "USD")}
                                {currency === "EUR" && formatPrice(locale, computed.eur, "EUR")}
                                {currency === "UAH" && formatPrice(locale, computed.uah, "UAH")}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* HOVER OVERLAY STRIP */}
                        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#c29d59] to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                      </Link>

                      {/* Bottom Actions: View + Add To Cart */}
                      <div className="px-6 pb-6 pt-0 z-20 relative flex gap-3">
                        <Link
                          href={buildShopProductPathBrabus(locale, product)}
                          className="flex-1 flex items-center justify-center gap-2 py-3 border border-[#c29d59]/30 text-[10px] tracking-[0.3em] uppercase font-light text-[#c29d59] hover:text-black hover:bg-[#c29d59] hover:border-[#c29d59] transition-all duration-300 rounded-[2px]"
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
              </BrabusSpotlightGrid>
            )}
          </main>
        </div>

      </div>
    </section>
  );
}
