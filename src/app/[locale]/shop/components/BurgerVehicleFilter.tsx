"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, X, ChevronDown, SlidersHorizontal, ShoppingCart, Mail } from "lucide-react";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct } from "@/lib/shopCatalog";
import { localizeShopProductTitle } from "@/lib/shopText";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";
import { AddToCartButton } from "@/components/shop/AddToCartButton";

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
  "flex-fuel": { en: "Flex Fuel Kits", ua: "Flex Fuel Кіти" },
  "intakes": { en: "Intakes", ua: "Інтейки" },
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
  "sensors": { en: "Sensors", ua: "Датчики" },
  "exhaust-tips": { en: "Exhaust Tips", ua: "Глушники" },
  "strut-braces": { en: "Strut Braces", ua: "Розтяжки" },
  "turbo-accessories": { en: "Turbo Parts", ua: "Турбо деталі" },
  "billet-accessories": { en: "Billet Parts", ua: "Billet деталі" },
};

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
  viewerContext,
}: Props) {
  const isUa = locale === "ua";
  const { currency, rates } = useShopCurrency();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const searchParams = useSearchParams();
  const initialBrand = searchParams?.get("brand") || "all";
  const initialType = searchParams?.get("type") || "all";

  const [activeBrand, setActiveBrand] = useState<string>(initialBrand);
  const [activeType, setActiveType] = useState<string>(initialType);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"default" | "price_desc" | "price_asc">("default");

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
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [products]);

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
      .sort((a, b) => a.label.localeCompare(b.label, locale === "ua" ? "uk" : "en"));
  }, [products, activeBrand, locale]);

  // Reset type when brand changes
  useEffect(() => {
    setActiveType("all");
  }, [activeBrand]);

  // ─── Filter & Sort ───
  const filtered = useMemo(() => {
    let list = products;

    if (activeBrand !== "all") {
      list = list.filter(p => p.tags?.includes(`brand:${activeBrand}`));
    }
    if (activeType !== "all") {
      list = list.filter(p => p.tags?.includes(`type:${activeType}`));
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
  }, [products, activeBrand, activeType, searchQuery, sortOrder, locale]);

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

  if (!mounted) return null;

  return (
    <section className="bg-[#050505] text-white py-12 min-h-[90vh] relative z-10 selection:bg-[var(--burger-yellow)] selection:text-black font-sans overflow-hidden">
      {/* Top Right Golden Glow Only */}
      <div className="absolute -top-40 -right-40 w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_center,rgba(255,215,0,0.06)_0%,transparent_70%)] rounded-full blur-3xl pointer-events-none" />
      
      <div className="max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-20 relative z-20">
        
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
          
          {/* ─── LEFT: STICKY SIDEBAR ─── */}
          <aside className="w-full lg:w-[260px] xl:w-[280px] flex-shrink-0">
            <div className="lg:sticky lg:top-[120px] pb-10 flex flex-col gap-8">
              
              {/* Header */}
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight uppercase mb-2 drop-shadow-sm text-white">
                  {isUa ? "Каталог JB4" : "JB4 Catalog"}
                </h2>
                <div className="w-8 h-1 bg-[var(--burger-yellow)] mb-4" />
                <p className="text-zinc-400 text-xs tracking-widest uppercase font-semibold">
                  {filtered.length} {isUa ? "з" : "of"} {products.length} {isUa ? "товарів" : "products"}
                </p>
              </div>

              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isUa ? "Пошук деталей..." : "Search parts..."}
                  className="w-full bg-[#111] border border-zinc-800 rounded-lg pl-11 pr-4 py-3.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--burger-yellow)]/60 focus:ring-1 focus:ring-[var(--burger-yellow)]/50 transition-all shadow-inner"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--burger-yellow)] hover:text-white transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* BRANDS FILTER */}
              <div className="flex flex-col gap-3 mt-4 bg-[#111]/50 p-5 rounded-2xl border border-white/[0.03]">
                <h3 className="text-[11px] text-zinc-400 uppercase tracking-[0.2em] border-b border-white/[0.06] pb-3 mb-2 font-bold flex items-center justify-between">
                  {isUa ? "Оберіть платформу" : "Select Platform"}
                </h3>
                <ul className="flex flex-col max-h-[250px] overflow-y-auto pr-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-black/20 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-thumb]:rounded-full">
                  <li>
                    <button
                      onClick={() => setActiveBrand("all")}
                      className={`w-full text-left py-2.5 text-[13px] uppercase tracking-wide font-medium transition-colors flex justify-between items-center ${
                        activeBrand === "all" ? "text-white" : "text-zinc-500 hover:text-white"
                      }`}
                    >
                      <span>{isUa ? "Всі платформи" : "All Platforms"}</span>
                      {activeBrand === "all" && <span className="w-2 h-2 rounded-full bg-[var(--burger-yellow)] shadow-[0_0_10px_rgba(255,215,0,0.6)]"></span>}
                    </button>
                  </li>
                  {availableBrands.map((brand) => (
                    <li key={brand.key}>
                      <button
                         onClick={() => setActiveBrand(brand.key)}
                         className={`w-full text-left py-2.5 text-[13px] uppercase tracking-wide font-medium transition-colors flex justify-between items-center ${
                           activeBrand === brand.key ? "text-white" : "text-zinc-500 hover:text-white"
                         }`}
                      >
                         <span>{brand.label}</span>
                         <div className="flex items-center gap-3">
                           <span className="text-[11px] text-zinc-600 font-bold bg-black/40 px-2 rounded-full">{brand.count}</span>
                           {activeBrand === brand.key && <span className="w-2 h-2 rounded-full bg-[var(--burger-yellow)] shadow-[0_0_10px_rgba(255,215,0,0.6)]"></span>}
                         </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* TYPE FILTER */}
              {availableTypes.length > 1 && (
                <div className="flex flex-col gap-3 mt-2 bg-[#111]/50 p-5 rounded-2xl border border-white/[0.03] animate-in fade-in slide-in-from-top-4 duration-500">
                  <h3 className="text-[11px] text-zinc-400 uppercase tracking-[0.2em] border-b border-white/[0.06] pb-3 mb-2 flex items-center gap-2 font-bold">
                    <SlidersHorizontal size={13} />
                    {isUa ? "Тип компонента" : "Component Type"}
                  </h3>
                  <ul className="flex flex-col max-h-[250px] overflow-y-auto pr-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-black/20 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-thumb]:rounded-full">
                    <li>
                      <button
                        onClick={() => setActiveType("all")}
                        className={`w-full text-left py-2 text-[12px] uppercase tracking-wide font-medium transition-colors flex justify-between items-center ${
                           activeType === "all" ? "text-[var(--burger-yellow)]" : "text-zinc-500 hover:text-white"
                        }`}
                      >
                        {isUa ? "Всі типи" : "All Types"}
                      </button>
                    </li>
                    {availableTypes.map((typeObj) => (
                      <li key={typeObj.key}>
                        <button
                          onClick={() => setActiveType(typeObj.key)}
                          className={`w-full text-left py-2 text-[12px] uppercase tracking-wide font-medium transition-colors flex justify-between items-center ${
                             activeType === typeObj.key ? "text-[var(--burger-yellow)]" : "text-zinc-500 hover:text-white"
                          }`}
                        >
                          <span className="truncate pr-2">{typeObj.label}</span>
                          <span className="text-[10px] text-zinc-600">{typeObj.count}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
          </aside>

          {/* ─── RIGHT: PRODUCT GRID ─── */}
          <main className="flex-1 min-w-0">
            {/* Top Sort Bar */}
            <div className="flex justify-end mb-8 z-20 relative">
              <div className="relative inline-flex items-center">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="appearance-none bg-[#111] border border-zinc-800 text-white text-[11px] uppercase tracking-[0.1em] font-semibold px-6 py-3.5 pr-12 rounded-lg outline-none focus:border-[var(--burger-yellow)] focus:ring-1 focus:ring-[var(--burger-yellow)] transition-all shadow-lg cursor-pointer"
                >
                  <option value="default">{isUa ? "За замовчуванням (Тюнери та Преміум)" : "Default (Tuners & Premium)"}</option>
                  <option value="price_asc">{isUa ? "Ціна: Від найменшої" : "Price: Low to High"}</option>
                  <option value="price_desc">{isUa ? "Ціна: Від найбільшої" : "Price: High to Low"}</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-400">
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>

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
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
                {filtered.map((product) => {
                  const productTitle = localizeShopProductTitle(locale, product);
                  const priceStr = getDisplayPrice(product);
                  const typeTag = product.tags?.find(t => t.startsWith("type:"))?.slice(5);

                  return (
                    <article key={product.slug} className="group relative bg-[#0a0a0a] rounded-2xl overflow-hidden flex flex-col hover:-translate-y-1 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.5)] border border-white/[0.04] hover:border-[var(--burger-yellow)]/50 hover:shadow-[0_8px_30px_rgba(255,215,0,0.1)]">
                      <Link
                        href={`/${locale}/shop/burger/products/${product.slug}`}
                        className="flex flex-col flex-grow z-10"
                      >
                        {/* Image Canvas (White to perfectly blend Burger JPGs) */}
                        <div className="relative aspect-[4/3] overflow-hidden flex items-center justify-center p-8 bg-white">
                          <Image
                            src={product.image || product.gallery?.[0] || "/images/placeholders/product-fallback.jpg"}
                            alt={productTitle}
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            className="object-contain p-6 md:p-8 mix-blend-multiply transition-transform duration-700 group-hover:scale-105"
                          />
                        </div>

                        {/* Card Body */}
                        <div className="px-6 pb-6 pt-5 flex flex-col flex-grow">
                          {typeTag && (
                             <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--burger-yellow)] mb-2.5">
                               {TYPE_LABELS[typeTag]?.[locale] || typeTag}
                             </p>
                          )}
                          <h3 className="text-sm font-semibold leading-relaxed text-zinc-100 line-clamp-2 mb-4 group-hover:text-white transition-colors">
                            {productTitle}
                          </h3>
                          
                          {/* Bottom Row: Price & Cart */}
                          <div className="mt-auto flex items-end justify-between border-t border-white/[0.04] pt-4">
                            <div>
                              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium mb-1">
                                {isUa ? "Ціна" : "Price"}
                              </p>
                              <span className="text-lg tracking-wide font-black text-white">
                                {priceStr || (isUa ? "За запитом" : "On Request")}
                              </span>
                            </div>
                            
                            {/* Re-added Cart Icon / Action */}
                            <div className="w-10 h-10 rounded-full bg-[#111] flex items-center justify-center text-zinc-400 group-hover:bg-[var(--burger-yellow)] group-hover:text-black transition-colors">
                               <ShoppingCart size={16} strokeWidth={2.5} />
                            </div>
                          </div>
                        </div>
                      </Link>
                      
                      {/* Hidden interactive ATC layer if needed, currently linking handles it gracefully via intuitive UX */}
                    </article>
                  );
                })}
              </div>
            )}
          </main>
        </div>

      </div>
    </section>
  );
}
