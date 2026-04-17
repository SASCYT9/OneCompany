"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, X, ChevronDown, SlidersHorizontal, ArrowRight } from "lucide-react";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct } from "@/lib/shopCatalog";
import { localizeShopProductTitle } from "@/lib/shopText";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";
import AkrapovicSpotlightGrid from "./AkrapovicSpotlightGrid";

type AkrapovicVehicleFilterProps = {
  locale: SupportedLocale;
  products: ShopProduct[];
  viewerContext?: ShopViewerPricingContext;
  productPathPrefix: string;
};

const BRAND_ORDER = ["Porsche", "BMW", "Mercedes-Benz", "Mercedes-AMG", "Audi", "Lamborghini", "Ferrari", "McLaren", "Toyota", "Volkswagen"];
const BRAND_LABELS: Record<string, Record<string, string>> = {
  Porsche: { en: "Porsche", ua: "Porsche" },
  BMW: { en: "BMW", ua: "BMW" },
  "Mercedes-Benz": { en: "Mercedes-Benz", ua: "Mercedes-Benz" },
  "Mercedes-AMG": { en: "Mercedes-AMG", ua: "Mercedes-AMG" },
  Audi: { en: "Audi", ua: "Audi" },
  Lamborghini: { en: "Lamborghini", ua: "Lamborghini" },
  Ferrari: { en: "Ferrari", ua: "Ferrari" },
  McLaren: { en: "McLaren", ua: "McLaren" },
  Toyota: { en: "Toyota", ua: "Toyota" },
  Volkswagen: { en: "Volkswagen", ua: "Volkswagen" },
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

export default function AkrapovicVehicleFilter({
  locale,
  products,
  viewerContext,
  productPathPrefix
}: AkrapovicVehicleFilterProps) {
  const isUa = locale === "ua";
  const { currency, rates } = useShopCurrency();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [activeBrand, setActiveBrand] = useState<string>("all");
  const [activeLine, setActiveLine] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"default" | "price_desc" | "price_asc">("default");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Extract brands dynamically from actual tags
  const availableBrands = useMemo(() => {
    const brands = new Map<string, number>();
    for (const p of products) {
      const brand = p.tags?.find(t => BRAND_ORDER.includes(t)) || p.tags?.find(t => t.match(/porsche|bmw|mercedes|audi|lamborghini|ferrari/i));
      if (brand) brands.set(brand, (brands.get(brand) || 0) + 1);
    }
    const foundTags = [...brands.keys()].sort((a,b) => {
        const iA = BRAND_ORDER.indexOf(a);
        const iB = BRAND_ORDER.indexOf(b);
        return (iA === -1 ? 99 : iA) - (iB === -1 ? 99 : iB);
    });
    return foundTags.map(b => ({
      key: b,
      label: BRAND_LABELS[b]?.[locale] || b,
      count: brands.get(b) || 0,
    }));
  }, [products, locale]);

  // Extract Akrapovic specific product lines
  const availableLines = useMemo(() => {
    if (activeBrand === "all" && products.length > 50) return [];
    const lines = new Map<string, number>();
    for (const p of products) {
      if (activeBrand !== "all" && !p.tags?.includes(activeBrand)) continue;
      
      const pTitle = localizeShopProductTitle(locale, p).toLowerCase();
      let detectedLine = "Other";
      if (p.tags?.includes("Slip-On Line") || pTitle.includes("slip-on")) detectedLine = "Slip-On Line";
      else if (p.tags?.includes("Evolution Line") || pTitle.includes("evolution line")) detectedLine = "Evolution Line";
      else if (p.tags?.includes("Link Pipe") || pTitle.includes("link pipe")) detectedLine = "Link Pipe";
      else if (p.tags?.includes("Downpipe") || pTitle.includes("downpipe")) detectedLine = "Downpipe";
      else if (p.tags?.includes("Tail pipe") || pTitle.includes("tail pipe")) detectedLine = "Tail pipe set";
      else if (p.tags?.includes("Sound Kit") || pTitle.includes("sound kit")) detectedLine = "Sound Kit";
      
      if (detectedLine !== "Other") {
        lines.set(detectedLine, (lines.get(detectedLine) || 0) + 1);
      }
    }
    return [...lines.entries()].sort((a,b) => b[1] - a[1]).map(([key, count]) => ({
      key,
      label: key,
      count
    }));
  }, [activeBrand, products, locale]);

  useEffect(() => {
    setActiveLine("all");
  }, [activeBrand]);

  const filteredProducts = useMemo(() => {
    let result = products;

    if (activeBrand !== "all") {
      result = result.filter(p => p.tags?.includes(activeBrand));
    }

    if (activeLine !== "all") {
       result = result.filter(p => {
          const t = localizeShopProductTitle(locale, p).toLowerCase();
          const tags = p.tags?.map(x => x.toLowerCase()) || [];
          const lookFor = activeLine.toLowerCase();
          return t.includes(lookFor) || tags.includes(lookFor);
       });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p => {
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
      const hasImgA = a.image && a.image.length > 5 ? 1 : 0;
      const hasImgB = b.image && b.image.length > 5 ? 1 : 0;
      
      if (hasImgA !== hasImgB) return hasImgB - hasImgA; // prioritize with image
      return priceB - priceA;
    });

    return result;
  }, [activeBrand, activeLine, searchQuery, sortOrder, products, locale]);

  const totalCount = products.length;

  if (!mounted) return null;

  return (
    <section id="catalog" className="bg-transparent text-white min-h-screen relative z-30">
      <div className="max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-20 pt-8">
        
        <div className="lg:hidden flex items-center gap-3 mb-4">
          <button
            onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
            className="flex items-center gap-2.5 px-5 py-3 bg-[#050505]/80 backdrop-blur-md border border-white/[0.08] rounded-xl text-white text-[10px] uppercase tracking-[0.18em] font-semibold hover:border-[#e50000]/40 transition-colors shadow-xl"
          >
            <SlidersHorizontal size={13} />
            {isUa ? "Фільтри" : "Filters"}
            {activeBrand !== "all" && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#e50000] ml-1" />
            )}
          </button>
          <p className="text-white/40 text-xs tracking-wide">
            {filteredProducts.length} {isUa ? "з" : "of"} {totalCount}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
          <aside className={`w-full lg:w-[260px] xl:w-[280px] flex-shrink-0 ${
            mobileFilterOpen ? 'block' : 'hidden lg:block'
          }`}>
            <div className="lg:sticky lg:top-[120px] pb-10 flex flex-col gap-8 bg-[#050505]/80 backdrop-blur-md border border-white/[0.04] p-6 rounded-2xl shadow-2xl">
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="lg:hidden self-end p-1.5 text-white/40 hover:text-white transition-colors"
                aria-label="Close filters"
              >
                <X size={16} />
              </button>
              
              <div>
                <h2 className="text-2xl font-light tracking-widest uppercase mb-1 drop-shadow-sm">
                  {isUa ? "Каталог" : "Catalog"}
                </h2>
                <p className="text-white/60 text-xs tracking-widest uppercase font-semibold">
                  {filteredProducts.length} {isUa ? "з" : "of"} {totalCount} {isUa ? "компонентів" : "components"}
                </p>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isUa ? "Пошук систем..." : "Search exhausts..."}
                  className="w-full bg-black/40 border border-white/10 rounded-sm pl-11 pr-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#e50000]/50 transition-colors backdrop-blur-md"
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
                      {activeBrand === "all" && <span className="w-1.5 h-1.5 rounded-full bg-[#e50000]"></span>}
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
                          {activeBrand === brand.key && <span className="w-1.5 h-1.5 rounded-full bg-[#e50000]"></span>}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {availableLines.length > 0 && (
                <div className="flex flex-col gap-3 mt-2 animate-in fade-in slide-in-from-top-4 duration-500">
                  <h3 className="text-xs text-white/60 uppercase tracking-widest border-b border-white/[0.06] pb-2 flex items-center gap-2 font-medium">
                    <SlidersHorizontal size={12} />
                    {isUa ? "Продукція" : "Product Line"}
                  </h3>
                  <ul className="flex flex-col">
                    <li>
                      <button
                        onClick={() => setActiveLine("all")}
                        className={`w-full text-left py-2 text-[11px] uppercase tracking-[0.12em] font-semibold transition-colors flex justify-between items-center ${
                          activeLine === "all" ? "text-[#e50000]" : "text-white/40 hover:text-white"
                        }`}
                      >
                        {isUa ? "Всі" : "All Lines"}
                      </button>
                    </li>
                    {availableLines.map((line) => (
                      <li key={line.key}>
                        <button
                          onClick={() => setActiveLine(line.key)}
                          className={`w-full text-left py-2 text-[11px] uppercase tracking-[0.12em] font-semibold transition-colors flex justify-between items-center ${
                            activeLine === line.key ? "text-[#e50000]" : "text-white/40 hover:text-white"
                          }`}
                        >
                          <span>{line.label}</span>
                          <span className="text-[10px] opacity-60">{line.count}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </aside>

          {mobileFilterOpen && (
            <div
              className="lg:hidden fixed inset-0 bg-black/40 z-20"
              onClick={() => setMobileFilterOpen(false)}
            />
          )}

          <main className="flex-1 min-w-0">
            <div className="flex justify-end mb-6 z-20 relative">
              <div className="relative inline-block">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="appearance-none bg-[#050505]/80 backdrop-blur-md border border-white/10 text-white text-[10px] uppercase tracking-[0.2em] font-semibold px-5 py-3 pr-10 rounded-lg outline-none focus:border-[#e50000]/50 transition-colors shadow-xl cursor-pointer"
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
                    : (isUa ? "Продукція відсутня." : "Components are currently unavailable.")}
                </p>
                <button
                  onClick={() => { setActiveBrand("all"); setActiveLine("all"); setSearchQuery(""); setSortOrder("default"); }}
                  className="px-8 py-3 bg-[#e50000]/15 backdrop-blur-xl border border-[#e50000]/40 text-white text-[10px] uppercase tracking-widest hover:bg-[#e50000]/25 hover:border-[#e50000]/70 transition-all duration-500 shadow-lg rounded-md font-medium"
                >
                  {isUa ? "Скинути фільтри" : "Reset Filters"}
                </button>
              </div>
            ) : (
              <AkrapovicSpotlightGrid className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
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
                    <article key={product.slug} className="group relative bg-[#050505]/60 backdrop-blur-xl rounded-none overflow-hidden flex flex-col hover:bg-[rgba(10,10,10,0.85)] transition-all duration-500 border border-white/[0.04] shadow-2xl">
                      <Link
                        href={`${productPathPrefix}/${product.slug}`}
                        className="flex flex-col flex-grow z-10"
                      >
                        <div className="relative aspect-[4/3] bg-transparent overflow-hidden flex items-center justify-center p-8 border-b border-white/[0.02]">
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(229,0,0,0.1)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                          <Image
                            src={product.image || "/images/placeholders/product-fallback.jpg"}
                            alt={productTitle}
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            className="object-contain p-6 md:p-8 drop-shadow-2xl transition-transform duration-700 group-hover:scale-110 relative z-10"
                          />
                        </div>

                        <div className="px-6 pb-6 pt-5 flex flex-col flex-grow">
                          <p className="text-[9px] uppercase tracking-[0.2em] font-bold text-[#e50000] mb-2">{product.brand}</p>
                          <h3 className="text-sm font-light leading-snug text-white line-clamp-2 mb-4">
                            {productTitle}
                          </h3>
                          
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

                        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#e50000] to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                      </Link>

                      {/* Bottom Actions: View + Add To Cart */}
                      <div className="px-6 pb-6 pt-0 z-20 relative flex gap-3">
                        <Link
                          href={`${productPathPrefix}/${product.slug}`}
                          className="flex-1 flex items-center justify-center gap-2 py-3 border border-[#e50000]/30 text-[10px] tracking-[0.3em] uppercase font-light text-[#e50000] hover:text-white hover:bg-[#e50000] hover:border-[#e50000] transition-all duration-300 rounded-[2px]"
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
              </AkrapovicSpotlightGrid>
            )}
          </main>
        </div>
      </div>
    </section>
  );
}
