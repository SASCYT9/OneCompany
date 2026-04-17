"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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

  const searchParams = useSearchParams();
  const initialMake = searchParams?.get("make") || "all";
  const initialCategory = searchParams?.get("category") || "all";

  // ─── State ───
  const [activeMake, setActiveMake] = useState<string>(initialMake);
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"default" | "price_desc" | "price_asc">("default");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // ─── Extract Car Makes (from "car_make:xyz") ───
  const availableMakes = useMemo(() => {
    const makes = new Map<string, number>();
    for (const p of products) {
      const makeTag = p.tags?.find(t => t.startsWith("car_make:"));
      if (makeTag) {
        let make = makeTag.split(":")[1];
        if (make === "corvette") make = "chevrolet";
        makes.set(make, (makes.get(make) || 0) + 1);
      }
    }
    return Array.from(makes.entries())
      .map(([make, count]) => ({
        key: `car_make:${make}`, // Stored as tag format for filtering
        label: make.replace(/_/g, " ").replace(/-/g, " "),
        count,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)); // Alphabetical
  }, [products]);

  // ─── Extract Categories (from "category:xyz") ───
  const availableCategories = useMemo(() => {
    const categories = new Map<string, number>();
    for (const p of products) {
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
  }, [products, locale]);

  // ─── Filter products ───
  const filteredProducts = useMemo(() => {
    let result = products;

    // Filter by Make
    if (activeMake !== "all") {
      if (activeMake === "car_make:chevrolet") {
        result = result.filter(p => p.tags?.includes("car_make:chevrolet") || p.tags?.includes("car_make:corvette"));
      } else {
        result = result.filter(p => p.tags?.includes(activeMake));
      }
    }

    // Filter by Category
    if (activeCategory !== "all") {
      result = result.filter(p => p.tags?.includes(activeCategory));
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p => {
        const title = localizeShopProductTitle(locale, p).toLowerCase();
        const sku = (p.sku || "").toLowerCase();
        const tags = (p.tags || []).join(" ").toLowerCase();
        return title.includes(q) || sku.includes(q) || tags.includes(q);
      });
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
  }, [activeMake, activeCategory, searchQuery, sortOrder, products, locale]);

  const totalCount = products.length;

  if (!mounted) return null;

  return (
    <section id="catalog" className="bg-transparent text-white py-8 min-h-screen relative z-30">
      <div className="max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-20">
        
        {/* ─── Mobile Filter Toggle ─── */}
        <div className="lg:hidden flex items-center gap-3 mb-4">
          <button
            onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
            className="flex items-center gap-2.5 px-5 py-3 bg-[#050505]/80 backdrop-blur-md border border-white/[0.08] rounded-xl text-white text-[10px] uppercase tracking-[0.18em] font-semibold hover:border-red-600/40 transition-colors shadow-xl"
          >
            <SlidersHorizontal size={13} />
            {isUa ? "Фільтри" : "Filters"}
            {(activeMake !== "all" || activeCategory !== "all") && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 ml-1" />
            )}
          </button>
          <p className="text-white/40 text-xs tracking-wide">
            {filteredProducts.length} {isUa ? "компонентів" : "components"}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
          
          {/* ─── LEFT: SIDEBAR (collapsible on mobile) ─── */}
          <aside className={`
            flex-shrink-0 transition-transform duration-300
            ${mobileFilterOpen 
              ? "fixed inset-y-0 left-0 z-50 w-[85%] sm:w-[320px] bg-[#030303] border-r border-white/5 shadow-[20px_0_60px_rgba(0,0,0,0.9)] overflow-y-auto custom-scrollbar block" 
              : "hidden lg:block w-full lg:w-[260px] xl:w-[280px]"
            }
          `}>
            <div className={`
              ${mobileFilterOpen ? 'p-6 min-h-full flex flex-col gap-8' : 'lg:sticky lg:top-[120px] max-h-[85vh] overflow-y-auto custom-scrollbar pb-10 flex flex-col gap-8 bg-[#050505]/80 backdrop-blur-md border border-white/[0.04] p-6 rounded-2xl shadow-2xl'}
            `}>
              
              {/* Mobile close button */}
              <button
                onClick={() => setMobileFilterOpen(false)}
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
                  {filteredProducts.length} {isUa ? "компонентів" : "components"}
                </p>
              </div>

              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isUa ? "Пошук за назвою або SKU..." : "Search part or SKU..."}
                  className="w-full bg-black/40 border border-white/10 rounded-sm pl-11 pr-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-red-600/50 transition-colors backdrop-blur-md"
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

              {/* CATEGORIES FILTER */}
              <div className="flex flex-col gap-3 mt-2">
                <h3 className="text-xs text-white/60 uppercase tracking-widest border-b border-white/[0.06] pb-2 font-medium">
                  {isUa ? "Категорія" : "Category"}
                </h3>
                <ul className="flex flex-col">
                  <li>
                    <button
                      onClick={() => setActiveCategory("all")}
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
                        onClick={() => setActiveCategory(cat.key)}
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
                      onClick={() => setActiveMake("all")}
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
                        onClick={() => setActiveMake(make.key)}
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

            </div>
          </aside>

          {/* Mobile overlay backdrop */}
          {mobileFilterOpen && (
            <div
              className="lg:hidden fixed inset-0 bg-black/40 z-20"
              onClick={() => setMobileFilterOpen(false)}
            />
          )}

          {/* ─── RIGHT: PRODUCT GRID ─── */}
          <main className="flex-1 min-w-0">
            {/* Top Sort Bar */}
            <div className="flex justify-end mb-6 z-20 relative">
              <div className="relative inline-block">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
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
                  onClick={() => { setActiveMake("all"); setActiveCategory("all"); setSearchQuery(""); setSortOrder("default"); }}
                  className="px-8 py-3 bg-red-600/10 backdrop-blur-xl border border-red-600/30 text-white text-[10px] uppercase tracking-widest hover:bg-red-600/20 hover:border-red-600/60 transition-all duration-500 shadow-lg rounded-md font-medium"
                >
                  {isUa ? "Скинути фільтри" : "Reset Filters"}
                </button>
              </div>
            ) : (
              <GirodiscSpotlightGrid className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
                {filteredProducts.map((product) => {
                  const pricing = viewerContext
                    ? resolveShopProductPricing(product, viewerContext)
                    : { effectivePrice: product.price, effectiveCompareAt: product.compareAt, audience: "b2c", b2bVisible: false };

                  const computed = computePricesFromEur(
                    pricing.effectivePrice,
                    rates && { EUR: rates.EUR, USD: rates.USD, UAH: rates.UAH }
                  );

                  const productTitle = localizeShopProductTitle(locale, product);
                  
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
                        <div className="relative aspect-[4/3] bg-[#050505] overflow-hidden flex items-center justify-center p-8 border-b border-white/[0.03] group-hover:border-red-600/30 transition-colors duration-700">
                          {/* Premium Background Effects */}
                          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>
                          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] opacity-20 group-hover:opacity-40 transition-opacity duration-700" />
                          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(220,38,38,0.15)_0%,transparent_60%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                          
                          <Image
                            src={product.image || "/images/placeholders/product-fallback.jpg"}
                            alt={productTitle}
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            className="object-contain p-6 md:p-8 drop-shadow-2xl transition-transform duration-1000 group-hover:scale-110 relative z-10"
                          />
                          <div className="absolute top-4 left-4 z-20">
                            <span className="px-2.5 py-1.5 bg-[#0a0a0a]/90 backdrop-blur-xl text-white/80 border border-white/5 text-[9px] uppercase tracking-[0.2em] font-bold rounded-sm shadow-xl">
                              {catNameDisplay}
                            </span>
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="px-6 pb-6 pt-5 flex flex-col flex-grow relative">
                          <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-red-600 mb-3">{product.sku}</p>
                          <h3 className="text-[13px] font-normal leading-relaxed text-white/80 group-hover:text-white line-clamp-3 mb-6 transition-colors duration-300">
                            {productTitle}
                          </h3>
                          
                          {/* Price */}
                          <div className="mt-auto">
                            {computed.usd === 0 ? (
                              <span className="text-[12px] tracking-[0.15em] uppercase font-medium text-white/40">
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
                                <span className="text-[18px] tracking-widest font-light text-white group-hover:text-red-500 transition-colors duration-300">
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
                      <div className="px-6 pb-6 pt-0 z-20 relative flex gap-3">
                        <Link
                          href={buildShopProductPathGirodisc(locale, product)}
                          className="flex-1 flex items-center justify-center gap-2 py-3 border border-red-600/30 text-[10px] tracking-[0.3em] uppercase font-light text-red-500 hover:text-white hover:bg-red-600 hover:border-red-600 transition-all duration-300 rounded-[2px]"
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
              </GirodiscSpotlightGrid>
            )}
          </main>
        </div>

      </div>
    </section>
  );
}
