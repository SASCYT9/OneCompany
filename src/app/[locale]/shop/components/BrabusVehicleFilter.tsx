"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  "Porsche 911 Turbo": { en: "911 Turbo", ua: "911 Turbo" },
  "Porsche Taycan": { en: "Taycan", ua: "Taycan" },
  "Rolls-Royce Ghost": { en: "Ghost", ua: "Ghost" },
  "Rolls-Royce Cullinan": { en: "Cullinan", ua: "Cullinan" },
  "Bentley Continental GT Speed": { en: "Continental GT", ua: "Continental GT" },
  "Bentley Continental GTC Speed": { en: "Continental GTC", ua: "Continental GTC" },
  "Lamborghini Urus SE": { en: "Urus", ua: "Urus" },
  "P530": { en: "P530", ua: "P530" },
  "smart #1": { en: "#1", ua: "#1" },
  "smart #3": { en: "#3", ua: "#3" },
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

  const searchParams = useSearchParams();
  const initialBrand = searchParams?.get("brand") || "all";
  const initialModel = searchParams?.get("model") || "all";

  const [activeBrand, setActiveBrand] = useState<string>(initialBrand);
  const [activeModel, setActiveModel] = useState<string>(initialModel);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"default" | "price_desc" | "price_asc">("default");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);


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

  const skipModelResetRef = useRef(true);
  useEffect(() => {
    if (skipModelResetRef.current) {
      skipModelResetRef.current = false;
      return;
    }
    setActiveModel("all");
  }, [activeBrand]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeBrand, activeModel, searchQuery, sortOrder]);

  /* ─── Filtering & Sorting ─── */
  const filteredProducts = useMemo(() => {
    let result = products;
    if (activeBrand !== "all") result = result.filter((p) => p.tags?.includes(activeBrand));
    if (activeModel !== "all")
      result = result.filter((p) => resolveBrabusModelKey(p, MODEL_KEYS_SET) === activeModel);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((p) => {
        const title = localizeShopProductTitle(locale, p).toLowerCase();
        const sku = (p.sku || "").toLowerCase();
        const tags = (p.tags || []).join(" ").toLowerCase();
        return title.includes(q) || sku.includes(q) || tags.includes(q);
      });
    }
    result = [...result].sort((a, b) => {
      const priceA = a.price?.eur || a.price?.uah || 0;
      const priceB = b.price?.eur || b.price?.uah || 0;
      if (sortOrder === "price_desc") return priceB - priceA;
      if (sortOrder === "price_asc") return priceA - priceB;
      const titleA = localizeShopProductTitle(locale, a).toLowerCase();
      const titleB = localizeShopProductTitle(locale, b).toLowerCase();
      const isKitA = /full kit|повний комплект|набір|комплект|full body|widetrack|widebody/.test(titleA);
      const isKitB = /full kit|повний комплект|набір|комплект|full body|widetrack|widebody/.test(titleB);
      if (isKitA && !isKitB) return -1;
      if (!isKitA && isKitB) return 1;
      return priceB - priceA;
    });
    return result;
  }, [activeBrand, activeModel, searchQuery, sortOrder, products, locale, MODEL_KEYS_SET]);

  const totalCount = products.length;
  const hasActiveFilters = activeBrand !== "all" || searchQuery.trim().length > 0;
  const displayedProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount]
  );

  if (!mounted) return null;

  return (
    <section id="catalog" className="bg-transparent text-white min-h-screen relative z-30">
      <div className="max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-20">

        {/* ═══ HORIZONTAL FILTER BAR ═══ */}
        <div className="-mx-6 md:-mx-12 lg:-mx-16 px-6 md:px-12 lg:px-16 bg-[#0a0a0a] border-y border-white/[0.08] shadow-[0_4px_30px_rgba(0,0,0,0.8)] [&_option]:bg-[#111] [&_option]:text-white">
          <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_auto] lg:grid-cols-[220px_200px_1fr_160px_auto] items-center gap-3 py-4">

            {/* Brand Select */}
            <div className="relative">
              <label className="absolute -top-0.5 left-3 text-[8px] uppercase tracking-[0.2em] text-white/25 pointer-events-none">{isUa ? "Марка" : "Brand"}</label>
              <select
                value={activeBrand}
                onChange={(e) => setActiveBrand(e.target.value)}
                className="appearance-none w-full bg-[#111] border border-white/[0.10] text-white text-xs uppercase tracking-[0.1em] font-medium pl-3 pr-8 pt-4 pb-2.5 outline-none focus:border-[#c29d59]/50 transition-colors cursor-pointer hover:border-white/20"
              >
                <option value="all">{isUa ? `Всі марки (${totalCount})` : `All Brands (${totalCount})`}</option>
                {availableBrands.map((b) => (
                  <option key={b.key} value={b.key}>{b.label} ({b.count})</option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/30">
                <ChevronDown size={12} />
              </div>
            </div>

            {/* Model Select */}
            <div className="relative">
              <label className="absolute -top-0.5 left-3 text-[8px] uppercase tracking-[0.2em] text-white/25 pointer-events-none">{isUa ? "Модель" : "Model"}</label>
              <select
                value={activeModel}
                onChange={(e) => setActiveModel(e.target.value)}
                disabled={activeBrand === "all" || availableModels.length === 0}
                className="appearance-none w-full bg-[#111] border border-white/[0.10] text-white text-xs uppercase tracking-[0.1em] font-medium pl-3 pr-8 pt-4 pb-2.5 outline-none focus:border-[#c29d59]/50 transition-colors cursor-pointer hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <option value="all">{isUa ? "Всі моделі" : "All Models"}</option>
                {availableModels.map((m) => (
                  <option key={m.key} value={m.key}>{m.label} ({m.count})</option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/30">
                <ChevronDown size={12} />
              </div>
            </div>

            {/* Search */}
            <div className="relative col-span-2 sm:col-span-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isUa ? "Пошук за назвою, артикулом..." : "Search by name, SKU..."}
                className="w-full bg-[#111] border border-white/[0.10] pl-10 pr-9 py-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#c29d59]/50 transition-colors hover:border-white/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Sort Select */}
            <div className="relative hidden sm:block">
              <label className="absolute -top-0.5 left-3 text-[8px] uppercase tracking-[0.2em] text-white/25 pointer-events-none">{isUa ? "Сортування" : "Sort"}</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "default" | "price_desc" | "price_asc")}
                className="appearance-none w-full bg-[#111] border border-white/[0.10] text-white text-xs uppercase tracking-[0.1em] font-medium pl-3 pr-8 pt-4 pb-2.5 outline-none focus:border-[#c29d59]/50 transition-colors cursor-pointer hover:border-white/20"
              >
                <option value="default">{isUa ? "Популярні" : "Popular"}</option>
                <option value="price_desc">{isUa ? "Ціна: спадання" : "Price: High → Low"}</option>
                <option value="price_asc">{isUa ? "Ціна: зростання" : "Price: Low → High"}</option>
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/30">
                <ChevronDown size={12} />
              </div>
            </div>

            {/* Results Count + Reset */}
            <div className="hidden lg:flex flex-col items-end gap-0.5">
              <span className="text-[11px] text-white/50 tabular-nums tracking-wide">
                {filteredProducts.length} <span className="text-white/25">/ {totalCount}</span>
              </span>
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setActiveBrand("all");
                    setActiveModel("all");
                    setSearchQuery("");
                    setSortOrder("default");
                  }}
                  className="flex items-center gap-1 text-[9px] uppercase tracking-[0.14em] text-white/30 hover:text-[#c29d59] transition-colors"
                >
                  <X size={9} />
                  {isUa ? "Скинути" : "Reset"}
                </button>
              )}
            </div>

          </div>

          {/* Mobile Sort Row (sm only) */}
          <div className="sm:hidden flex items-center justify-between pb-3 border-t border-white/[0.04] pt-3 -mt-1">
            <span className="text-[11px] text-white/40 tabular-nums">{filteredProducts.length} / {totalCount}</span>
            <div className="flex items-center gap-3">
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "default" | "price_desc" | "price_asc")}
                className="appearance-none bg-transparent text-white/60 text-[10px] uppercase tracking-[0.12em] font-medium outline-none cursor-pointer"
              >
                <option value="default">{isUa ? "Популярні" : "Popular"}</option>
                <option value="price_desc">{isUa ? "Ціна ↓" : "Price ↓"}</option>
                <option value="price_asc">{isUa ? "Ціна ↑" : "Price ↑"}</option>
              </select>
              {hasActiveFilters && (
                <button
                  onClick={() => { setActiveBrand("all"); setActiveModel("all"); setSearchQuery(""); setSortOrder("default"); }}
                  className="text-[10px] uppercase tracking-wider text-white/30 hover:text-white transition-colors"
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
            <div className="py-32 text-center bg-black/40 backdrop-blur-sm border border-white/5 rounded-none flex flex-col items-center">
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
                className="px-8 py-3 bg-[#c29d59]/15 backdrop-blur-xl border border-[#c29d59]/40 text-white text-[10px] uppercase tracking-widest hover:bg-[#c29d59]/25 hover:border-[#c29d59]/70 transition-all duration-500 shadow-lg rounded-none font-medium"
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
                    className="group relative bg-[#050505]/60 backdrop-blur-xl overflow-hidden flex flex-col hover:bg-[rgba(10,10,10,0.85)] transition-all duration-500 border border-white/[0.04] shadow-2xl rounded-none"
                  >
                    <Link
                      href={buildShopProductPathBrabus(locale, product)}
                      className="flex flex-col flex-grow z-10"
                    >
                      {/* Image */}
                      <div className="relative aspect-square sm:aspect-[4/3] bg-transparent overflow-hidden flex items-center justify-center p-2.5 sm:p-6 border-b border-white/[0.02]">
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
                      <div className="px-3 pb-3 pt-3 sm:px-5 sm:pb-5 sm:pt-4 flex flex-col flex-grow">
                        <p className="text-[8px] sm:text-[9px] uppercase tracking-[0.16em] sm:tracking-[0.2em] font-bold text-[#c29d59] mb-1.5">
                          {product.brand}
                        </p>
                        <h3 className="text-[11px] sm:text-[13px] font-light leading-snug text-white line-clamp-3 sm:line-clamp-2 mb-2 sm:mb-3">
                          {productTitle}
                        </h3>
                        <div className="mt-auto">
                          {computed.eur === 0 ? (
                            <span className="text-[9px] sm:text-[11px] tracking-wider uppercase font-medium text-white/50">
                              {isUa ? "Ціна за запитом" : "Price on Request"}
                            </span>
                          ) : (
                            <span className="text-[11px] sm:text-sm tracking-wider sm:tracking-widest font-light text-white">
                              {currency === "USD" && formatPrice(locale, computed.usd, "USD")}
                              {currency === "EUR" && formatPrice(locale, computed.eur, "EUR")}
                              {currency === "UAH" && formatPrice(locale, computed.uah, "UAH")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Hover top accent */}
                      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#c29d59] to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                    </Link>

                    {/* Actions */}
                    <div className="px-3 pb-3 pt-0 sm:px-5 sm:pb-5 z-20 relative flex gap-2">
                      <Link
                        href={buildShopProductPathBrabus(locale, product)}
                        className="flex-1 flex min-w-0 items-center justify-center gap-1.5 py-2 sm:py-2.5 border border-[#c29d59]/30 text-[9px] sm:text-[10px] tracking-[0.1em] sm:tracking-[0.3em] uppercase font-light text-[#c29d59] hover:text-black hover:bg-[#c29d59] hover:border-[#c29d59] transition-all duration-300 rounded-none"
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
                        className="flex-1 flex min-w-0 items-center justify-center py-2 sm:py-2.5 border border-white/10 text-[9px] sm:text-[10px] tracking-[0.1em] sm:tracking-[0.3em] uppercase font-light text-white hover:text-black hover:bg-white hover:border-white transition-all duration-300 rounded-none"
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
