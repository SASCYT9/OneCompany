"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, X, ChevronDown, SlidersHorizontal, Settings2 } from "lucide-react";
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

// Map URL slug names back to readable format for robust fallback if title isn't sufficient
function formatSlugPart(text: string) {
  if (!text) return '';
  return text
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/ccm/i, ' cm³')
    .replace(/hp/i, ' HP')
    .replace(/kw/i, ' kW')
    .replace(/nm/i, ' Nm');
}

function formatPrice(locale: SupportedLocale, amount: number, currency: "EUR" | "USD" | "UAH") {
  const formatter = new Intl.NumberFormat(locale === "ua" ? "uk-UA" : "en-US", {
    maximumFractionDigits: 0,
  });
  const formatted = formatter.format(amount);
  if (locale === "ua" && currency === "UAH") return `${formatted} грн`;
  return locale === "ua" ? `${formatted} ${currency}` : `${currency} ${formatted}`;
}

export default function RacechipVehicleFilter({
  locale,
  products,
  viewerContext,
}: Props) {
  const isUa = locale === "ua";
  const { currency, rates } = useShopCurrency();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [activeMake, setActiveMake] = useState<string>("all");
  const [activeModel, setActiveModel] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"default" | "price_desc" | "price_asc">("default");

  // Pagination to restrict the number of visible DOM elements
  const [visibleCount, setVisibleCount] = useState(30);

  // Reset visible limit whenever a filter changes
  useEffect(() => {
    setVisibleCount(30);
  }, [activeMake, activeModel, searchQuery, sortOrder]);

  // 1. EXTRACT ALL MAKES
  const availableMakes = useMemo(() => {
    const makes = new Map<string, number>();
    for (const p of products) {
      if (searchQuery && !localizeShopProductTitle(locale, p).toLowerCase().includes(searchQuery.toLowerCase())) continue;
      for (const tag of p.tags || []) {
        if (tag.startsWith("car_make:")) {
          const make = tag.slice(9);
          makes.set(make, (makes.get(make) || 0) + 1);
        }
      }
    }
    return [...makes.entries()]
      .map(([key, count]) => ({ key, label: formatSlugPart(key), count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [products, searchQuery, locale]);

  // 2. EXTRACT ALL MODELS FOR THE GIVEN MAKE
  const availableModels = useMemo(() => {
    if (activeMake === "all") return [];
    const models = new Map<string, number>();
    for (const p of products) {
        if (searchQuery && !localizeShopProductTitle(locale, p).toLowerCase().includes(searchQuery.toLowerCase())) continue;
        if (!p.tags?.includes(`car_make:${activeMake}`)) continue;
        
        for (const tag of p.tags || []) {
            if (tag.startsWith("car_model:")) {
            const model = tag.slice(10);
            models.set(model, (models.get(model) || 0) + 1);
            }
        }
    }
    return [...models.entries()]
      .map(([key, count]) => ({ key, label: formatSlugPart(key), count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [products, activeMake, searchQuery, locale]);

  // Reset models when make changes
  useEffect(() => {
    setActiveModel("all");
  }, [activeMake]);

  // 3. FILTER RESULTS
  const filtered = useMemo(() => {
    let list = products;

    if (activeMake !== "all") {
      list = list.filter(p => p.tags?.includes(`car_make:${activeMake}`));
    }
    if (activeModel !== "all") {
      list = list.filter(p => p.tags?.includes(`car_model:${activeModel}`));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => {
        const title = localizeShopProductTitle(locale, p).toLowerCase();
        return title.includes(q) || p.sku?.toLowerCase().includes(q);
      });
    }

    list = [...list].sort((a, b) => {
      const priceA = a.price?.eur || 0;
      const priceB = b.price?.eur || 0;
      if (sortOrder === "price_asc") return priceA - priceB;
      if (sortOrder === "price_desc") return priceB - priceA;
      return 0; // Default leaves it as DB imported order (usually by engine size)
    });

    return list;
  }, [products, activeMake, activeModel, searchQuery, sortOrder, locale]);

  const displayedProducts = useMemo(() => {
    return filtered.slice(0, visibleCount);
  }, [filtered, visibleCount]);

  const getDisplayPrice = (p: ShopProduct) => {
    if (!mounted) return null;
    const pricing = viewerContext ? resolveShopProductPricing(p, viewerContext) : null;
    const ep = pricing?.effectivePrice;
    const priceUsd = ep?.usd ?? p.price.usd ?? 0;
    const priceEur = ep?.eur ?? p.price.eur ?? 0;
    const priceUah = ep?.uah ?? p.price.uah ?? 0;
    
    // Racechip is EUR based natively
    if (currency === "EUR") return priceEur > 0 ? formatPrice(locale, priceEur, "EUR") : null;
    if (currency === "USD" && rates?.USD) {
      const usd = priceUsd > 0 ? priceUsd : Math.round(priceEur * rates.USD); 
      return usd > 0 ? formatPrice(locale, usd, "USD") : null;
    }
    if (currency === "UAH" && rates?.UAH) {
      const uah = priceUah > 0 ? priceUah : Math.round(priceEur * rates.UAH); 
      return uah > 0 ? formatPrice(locale, uah, "UAH") : null;
    }
    return priceEur > 0 ? formatPrice(locale, priceEur, "EUR") : null;
  };

  if (!mounted) return null;

  return (
    <section className="bg-transparent text-white py-12 min-h-[90vh] relative z-10 selection:bg-[#ff4a00] selection:text-white font-sans overflow-hidden">
      {/* Top Right Orange Glow Only */}
      <div className="absolute -top-40 -right-40 w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_center,rgba(255,74,0,0.06)_0%,transparent_70%)] rounded-full blur-3xl pointer-events-none" />
      
      <div className="max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-20 relative z-20">
        
        <div className="flex flex-col gap-10">
          
          {/* ─── TOP: COMMAND CENTER FILTER ─── */}
          {/* ─── TOP: COMMAND CENTER FILTER ─── */}
          <div className="relative z-30 mb-8 max-w-5xl mx-auto w-full">
            <div className="flex flex-col items-center justify-center text-center mb-10">
              <h2 className="text-2xl lg:text-3xl font-light tracking-[0.05em] uppercase text-white/90">
                {isUa ? "НАЛАШТУЙТЕ СВІЙ АВТОМОБІЛЬ" : "CONFIGURE YOUR VEHICLE"}
              </h2>
            </div>

            {/* CONTROLS ROW - 4 COLUMNS EXACTLY LIKE CONCEPT */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* MAKE DROPDOWN */}
              <div className="relative border border-white/20 hover:border-[#ff4a00]/50 transition-colors">
                <select
                  value={activeMake}
                  onChange={(e) => setActiveMake(e.target.value)}
                  className="appearance-none w-full bg-[#080808] text-white text-[11px] uppercase tracking-[0.1em] font-light px-6 py-4 pr-12 outline-none cursor-pointer rounded-none"
                >
                  <option value="all" className="bg-[#080808] text-zinc-500 font-light">{isUa ? "Виберіть Марку" : "Select Make"}</option>
                  {availableMakes.map((m) => (
                    <option key={m.key} value={m.key} className="bg-[#080808] text-white">
                      {m.label} ({m.count})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-6 text-zinc-500">
                  <ChevronDown size={14} strokeWidth={1.5} />
                </div>
              </div>

              {/* MODEL DROPDOWN */}
              <div className="relative border border-white/20 hover:border-[#ff4a00]/50 transition-colors">
                <select
                  value={activeModel}
                  onChange={(e) => setActiveModel(e.target.value)}
                  disabled={activeMake === "all" || availableModels.length === 0}
                  className="appearance-none w-full bg-[#080808] text-white text-[11px] uppercase tracking-[0.1em] font-light px-6 py-4 pr-12 outline-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed rounded-none"
                >
                  <option value="all" className="bg-[#080808] text-zinc-500 font-light">{isUa ? "Виберіть Модель" : "Select Model"}</option>
                  {availableModels.map((m) => (
                    <option key={m.key} value={m.key} className="bg-[#080808] text-white">
                      {m.label} ({m.count})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-6 text-zinc-500">
                  <ChevronDown size={14} strokeWidth={1.5} />
                </div>
              </div>

              {/* SEARCH -> Replaced with search box that matches the box style */}
              <div className="relative border border-white/20 hover:border-[#ff4a00]/50 transition-colors">
                <Search size={14} strokeWidth={1.5} className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isUa ? "Пошук авто..." : "Search Engine..."}
                  className="w-full bg-[#080808] text-white text-[11px] tracking-[0.1em] font-light px-14 py-4 outline-none placeholder-zinc-500 rounded-none cursor-text"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-6 top-1/2 -translate-y-1/2 text-[#ff4a00] hover:text-white transition-opacity"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* SORT DROPDOWN */}
              <div className="relative border border-white/20 hover:border-[#ff4a00]/50 transition-colors">
                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-500">
                   <SlidersHorizontal size={14} strokeWidth={1.5} />
                </div>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="appearance-none w-full bg-[#080808] text-white text-[11px] uppercase tracking-[0.1em] font-light px-14 py-4 pr-12 outline-none cursor-pointer rounded-none"
                >
                  <option value="default" className="bg-[#080808] text-white">{isUa ? "За замовчуванням" : "Default Sort"}</option>
                  <option value="price_desc" className="bg-[#080808] text-white">{isUa ? "Спочатку дорожчі" : "Price: High to Low"}</option>
                  <option value="price_asc" className="bg-[#080808] text-white">{isUa ? "Спочатку дешевші" : "Price: Low to High"}</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-6 text-zinc-500">
                  <ChevronDown size={14} strokeWidth={1.5} />
                </div>
              </div>
            </div>
            
            <p className="text-center text-zinc-500 text-[10px] sm:text-xs font-light tracking-widest mt-6">
              {isUa ? "Цей селектор авто веде до продуктів та функцій." : "The vehicle selector leads to products and features."}
            </p>
          </div>

          {/* ─── BOTTOM: PRODUCT GRID ─── */}
          <main className="w-full">

            {filtered.length === 0 ? (
               <div className="py-32 text-center bg-[#111] border border-zinc-900 rounded-2xl flex flex-col items-center shadow-2xl">
                 <div className="w-20 h-20 rounded-full bg-black flex items-center justify-center mb-6 border border-white/5 shadow-[0_0_30px_rgba(255,74,0,0.1)]">
                   <Search className="w-8 h-8 text-[#ff4a00]/50" />
                 </div>
                 <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">
                   {isUa ? "Нічого не знайдено" : "No Components Found"}
                 </h3>
                 <p className="text-zinc-500 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                   {searchQuery
                     ? (isUa ? `На жаль, за запитом "${searchQuery}" ми нічого не знайшли.` : `No results for "${searchQuery}"`)
                     : (isUa ? "Компоненти для цієї комбінації відсутні." : "Components for this combination are currently unavailable.")}
                 </p>
                 <button
                   onClick={() => { setActiveMake("all"); setActiveModel("all"); setSearchQuery(""); }}
                   className="px-8 py-3.5 bg-white text-black text-[12px] uppercase tracking-widest hover:bg-[#ff4a00] hover:text-white transition-colors shadow-lg font-bold rounded-lg"
                 >
                   {isUa ? "Скинути фільтри" : "Reset Filters"}
                 </button>
               </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
                {displayedProducts.map((product) => {
                  const productTitle = localizeShopProductTitle(locale, product);
                  const priceStr = getDisplayPrice(product);
                  const engineTag = product.tags?.find(t => t.startsWith("car_engine:"))?.slice(11);

                  return (
                    <article key={product.slug} className="group relative bg-[#080808] rounded-none flex flex-col border border-white/[0.05] hover:border-white/20 transition-all duration-500 shadow-xl">
                      {/* MAIN CLICKABLE LINK */}
                      <Link
                        href={`/${locale}/shop/racechip/products/${product.slug}`}
                        className="flex flex-col flex-grow z-10"
                      >
                        {/* Square Image Canvas */}
                        <div className="relative aspect-square w-full overflow-hidden flex items-center justify-center bg-[#0a0a0a] border-b border-white/[0.05]">
                          {product.image ? (
                             <div className="absolute inset-0 p-8">
                               <Image
                                 src={product.image}
                                 alt={productTitle}
                                 fill
                                 sizes="(max-width: 768px) 100vw, 33vw"
                                 className="object-contain transition-transform duration-[1s] group-hover:scale-105 opacity-80 group-hover:opacity-100 mix-blend-screen"
                               />
                             </div>
                          ) : (
                             <div className="w-16 h-16 opacity-20 text-white">
                               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                                 <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
                                 <rect x="9" y="9" width="6" height="6"></rect>
                                 <line x1="9" y1="1" x2="9" y2="4"></line>
                                 <line x1="15" y1="1" x2="15" y2="4"></line>
                                 <line x1="9" y1="20" x2="9" y2="23"></line>
                                 <line x1="15" y1="20" x2="15" y2="23"></line>
                                 <line x1="20" y1="9" x2="23" y2="9"></line>
                                 <line x1="20" y1="14" x2="23" y2="14"></line>
                                 <line x1="1" y1="9" x2="4" y2="9"></line>
                                 <line x1="1" y1="14" x2="4" y2="14"></line>
                               </svg>
                             </div>
                          )}
                        </div>

                        {/* Card Body */}
                        <div className="px-6 pt-6 pb-2 flex flex-col flex-grow">
                          {engineTag && (
                             <p className="text-[9px] uppercase tracking-[0.2em] font-light text-zinc-500 mb-2 line-clamp-1">
                               {formatSlugPart(engineTag)}
                             </p>
                          )}
                          <h3 className="text-sm font-light leading-relaxed text-zinc-300 line-clamp-2 mb-4 group-hover:text-white transition-colors h-10">
                            {productTitle}
                          </h3>

                          {/* Dynamic Engine Specs Card Preview */}
                          {product.longDescription?.en && product.longDescription.en.includes('Original Power') && (
                            <div className="mb-6 grid grid-cols-2 gap-4 border-t border-b border-white/5 py-3">
                              <div>
                                <span className="block text-[8px] uppercase tracking-[0.3em] font-light text-zinc-600 mb-1">Power</span>
                                <span className="text-xs font-light text-zinc-400">
                                  {product.longDescription.en.match(/Original Power:<\/strong> (.*?) ->/)?.[1] || "---"} 
                                  <span className="text-[#ff4a00] mx-1">→</span> 
                                  <span className="text-white">{product.longDescription.en.match(/Tuned Power:<\/strong> (.*?)<\/li>/)?.[1] || "---"}</span>
                                </span>
                              </div>
                              <div className="border-l border-white/5 pl-4">
                                <span className="block text-[8px] uppercase tracking-[0.3em] font-light text-zinc-600 mb-1">Torque</span>
                                <span className="text-xs font-light text-zinc-400">
                                  {product.longDescription.en.match(/Original Torque:<\/strong> (.*?) ->/)?.[1] || "---"} 
                                  <span className="text-[#ff4a00] mx-1">→</span> 
                                  <span className="text-white">{product.longDescription.en.match(/Tuned Torque:<\/strong> (.*?)<\/li>/)?.[1] || "---"}</span>
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {/* Price */}
                          <div className="mt-auto pt-2 pb-4">
                            <span className="text-lg tracking-widest font-thin text-white">
                              {priceStr ? priceStr.replace('€', '€ ') : "ОЧІКУЄТЬСЯ"}
                            </span>
                          </div>
                        </div>
                      </Link>

                      {/* Add To Cart Quick Action */}
                      <div className="px-6 pb-6 pt-0 z-20 relative">
                        <AddToCartButton 
                          slug={product.slug}
                          variantId={null}
                          locale={locale}
                          redirect={true}
                          productName={productTitle}
                          label={isUa ? "ДО КОШИКА" : "ADD TO CART"}
                          labelAdded={isUa ? "В КОШИКУ" : "ADDED"}
                          className="w-full flex items-center justify-center py-3 border border-white/10 text-[10px] tracking-[0.3em] uppercase font-light text-white hover:text-black hover:bg-white hover:border-white transition-all duration-300 rounded-[2px]"
                          variant="inline"
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* LOAD MORE BUTTON */}
            {filtered.length > 0 && visibleCount < filtered.length && (
              <div className="mt-16 flex justify-center w-full relative z-30">
                <button
                  onClick={() => setVisibleCount((prev) => prev + 30)}
                  className="px-12 py-4 border border-white/20 text-white text-[11px] tracking-[0.3em] uppercase font-light hover:bg-[#ff4a00] hover:text-white hover:border-[#ff4a00] transition-all duration-300 rounded-[2px] shadow-[0_0_20px_rgba(255,74,0,0.1)]"
                >
                  {isUa ? "ЗАВАНТАЖИТИ ЩЕ" : "LOAD MORE"}
                </button>
              </div>
            )}

          </main>
        </div>

      </div>
    </section>
  );
}
