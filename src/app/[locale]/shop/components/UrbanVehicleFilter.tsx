"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, X, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct } from "@/lib/shopCatalog";
import { localizeShopProductTitle } from "@/lib/shopText";
import { buildShopProductPath } from "@/lib/urbanCollectionMatcher";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";

type UrbanVehicleFilterProps = {
  locale: SupportedLocale;
  products: ShopProduct[];
  viewerContext?: ShopViewerPricingContext;
};

const BRAND_ORDER = ["Land Rover", "Mercedes-Benz", "Rolls-Royce", "Bentley", "Lamborghini", "Audi", "Volkswagen"];

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

export default function UrbanVehicleFilter({
  locale,
  products,
  viewerContext,
}: UrbanVehicleFilterProps) {
  const isUa = locale === "ua";
  const { currency, rates } = useShopCurrency();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const searchParams = useSearchParams();
  const initialBrand = searchParams?.get("brand") || "all";
  const initialCollection = searchParams?.get("collection") || "all";

  const [activeBrand, setActiveBrand] = useState<string>(initialBrand);
  const [activeCollection, setActiveCollection] = useState<string>(initialCollection);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"default" | "price_desc" | "price_asc">("default");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Available Brands from products
  const availableBrands = useMemo(() => {
    const brands = new Map<string, number>();
    for (const p of products) {
      // Find one of the BRAND_ORDER in either tags or collection title
      const brand = BRAND_ORDER.find(b => p.tags?.includes(b) || p.title.en.includes(b) || p.title.ua.includes(b));
      if (brand) brands.set(brand, (brands.get(brand) || 0) + 1);
    }
    return BRAND_ORDER.filter(b => brands.has(b)).map(b => ({
      key: b,
      label: b,
      count: brands.get(b) || 0,
    }));
  }, [products]);

  // Extract collections dynamically based on the active brand
  const availableCollections = useMemo(() => {
    if (activeBrand === "all") return [];
    const colls = new Map<string, number>();
    for (const p of products) {
      if (!p.tags?.includes(activeBrand) && !p.title.en.includes(activeBrand)) continue;
      
      // Look at p.collections to find unique handles
      if (p.collections && p.collections.length > 0) {
        for (const c of p.collections) {
           colls.set(c.title.en, (colls.get(c.title.en) || 0) + 1);
        }
      } else {
         // Fallback to productType if no collections attached
         if (p.productType) colls.set(p.productType, (colls.get(p.productType) || 0) + 1);
      }
    }
    return [...colls.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({
        key,
        label: key,
        count,
      }));
  }, [activeBrand, products]);

  // Reset collection when brand changes
  useEffect(() => {
    setActiveCollection("all");
  }, [activeBrand]);

  const filteredProducts = useMemo(() => {
    let result = products;

    if (activeBrand !== "all") {
      result = result.filter(p => p.tags?.includes(activeBrand) || p.title.en.includes(activeBrand));
    }

    if (activeCollection !== "all") {
      result = result.filter(p => 
        (p.collections && p.collections.some(c => c.title.en === activeCollection)) ||
        p.productType === activeCollection ||
        p.tags?.includes(activeCollection)
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p => {
        const title = localizeShopProductTitle(locale, p).toLowerCase();
        const sku = (p.sku || "").toLowerCase();
        return title.includes(q) || sku.includes(q);
      });
    }

    result = [...result].sort((a, b) => {
      const priceA = a.price?.eur || a.price?.uah || 0;
      const priceB = b.price?.eur || b.price?.uah || 0;

      if (sortOrder === "price_desc") return priceB - priceA;
      if (sortOrder === "price_asc") return priceA - priceB;

      // Default: prioritize kits
      const titleA = localizeShopProductTitle(locale, a).toLowerCase();
      const titleB = localizeShopProductTitle(locale, b).toLowerCase();
      const isKitA = titleA.includes('kit') || titleA.includes('bundle') || titleA.includes('комплект') || titleA.includes('набір');
      const isKitB = titleB.includes('kit') || titleB.includes('bundle') || titleB.includes('комплект') || titleB.includes('набір');
      
      if (isKitA && !isKitB) return -1;
      if (!isKitA && isKitB) return 1;
      return priceB - priceA;
    });

    return result;
  }, [activeBrand, activeCollection, searchQuery, sortOrder, products, locale]);

  const totalCount = products.length;

  if (!mounted) return null;

  return (
    <section id="catalog" className="bg-transparent text-white py-8 relative z-30">
      <div className="max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-20">
        
        {/* Mobile Filter Toggle */}
        <div className="lg:hidden flex items-center gap-3 mb-4">
          <button
            onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
            className="flex items-center gap-2.5 px-5 py-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-none text-white text-[10px] uppercase tracking-[0.18em] font-semibold transition-colors"
          >
            <SlidersHorizontal size={13} />
            {isUa ? "Фільтри" : "Filters"}
            {activeBrand !== "all" && <span className="w-1.5 h-1.5 rounded-full bg-white ml-1" />}
          </button>
          <p className="text-white/40 text-xs tracking-wide">
            {filteredProducts.length} {isUa ? "з" : "of"} {totalCount}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
          
          {/* LEFT: SIDEBAR */}
          <aside className={`w-full lg:w-[260px] xl:w-[280px] flex-shrink-0 ${
            mobileFilterOpen ? 'block' : 'hidden lg:block'
          }`}>
            <div className="lg:sticky lg:top-[120px] pb-10 flex flex-col gap-8">
              
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="lg:hidden self-end p-1.5 text-white/40 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
              
              <div>
                <h2 className="text-2xl font-light tracking-widest uppercase mb-1">
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
                  placeholder={isUa ? "Пошук..." : "Search..."}
                  className="w-full bg-white/5 border border-white/10 rounded-none pl-11 pr-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/50 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Brands */}
              <div className="flex flex-col gap-3 mt-2">
                <h3 className="text-xs text-white/60 uppercase tracking-widest border-b border-white/10 pb-2 font-medium">
                  {isUa ? "Оберіть марку" : "Select Brand"}
                </h3>
                <ul className="flex flex-col">
                  <li>
                    <button
                      onClick={() => setActiveBrand("all")}
                      className={`w-full text-left py-2.5 text-[11px] uppercase tracking-[0.15em] font-semibold transition-colors flex justify-between items-center ${
                        activeBrand === "all" ? "text-white" : "text-white/50 hover:text-white"
                      }`}
                    >
                      <span>{isUa ? "Всі марки" : "All Brands"}</span>
                      {activeBrand === "all" && <span className="w-1.5 h-1.5 rounded-full bg-white text-white"></span>}
                    </button>
                  </li>
                  {availableBrands.map((brand) => (
                    <li key={brand.key}>
                      <button
                        onClick={() => setActiveBrand(brand.key)}
                        className={`w-full text-left py-2.5 text-[11px] uppercase tracking-[0.15em] font-semibold transition-colors flex justify-between items-center ${
                          activeBrand === brand.key ? "text-white" : "text-white/50 hover:text-white"
                        }`}
                      >
                        <span>{brand.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-white/40 font-bold">{brand.count}</span>
                          {activeBrand === brand.key && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Collections */}
              {activeBrand !== "all" && availableCollections.length > 1 && (
                <div className="flex flex-col gap-3 mt-2">
                  <h3 className="text-xs text-white/60 uppercase tracking-widest border-b border-white/10 pb-2 font-medium">
                    {isUa ? "Колекція" : "Collection"}
                  </h3>
                  <ul className="flex flex-col">
                    <li>
                      <button
                        onClick={() => setActiveCollection("all")}
                        className={`w-full text-left py-2 text-[10px] uppercase tracking-[0.12em] font-semibold transition-colors flex justify-between items-center ${
                          activeCollection === "all" ? "text-white" : "text-white/40 hover:text-white"
                        }`}
                      >
                        {isUa ? "Всі колекції" : "All Collections"}
                      </button>
                    </li>
                    {availableCollections.map((col) => (
                      <li key={col.key}>
                        <button
                          onClick={() => setActiveCollection(col.key)}
                          className={`w-full text-left py-2 text-[10px] uppercase tracking-[0.12em] font-semibold transition-colors flex justify-between items-center ${
                            activeCollection === col.key ? "text-white" : "text-white/40 hover:text-white"
                          }`}
                        >
                          <span>{col.label}</span>
                          <span className="text-[10px] opacity-60">{col.count}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
          </aside>

          {mobileFilterOpen && (
            <div className="lg:hidden fixed inset-0 bg-black/80 z-20" onClick={() => setMobileFilterOpen(false)} />
          )}

          {/* RIGHT: PRODUCT GRID */}
          <main className="flex-1 min-w-0">
            <div className="flex justify-end mb-6 z-20 relative">
              <div className="relative inline-block border-b border-white/20 pb-1">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="appearance-none bg-transparent text-white text-[10px] uppercase tracking-[0.2em] font-semibold px-2 py-2 pr-8 outline-none cursor-pointer"
                >
                  <option value="default">{isUa ? "За замовчуванням" : "Default"}</option>
                  <option value="price_desc">{isUa ? "Ціна: Від найбільшої" : "Price: High to Low"}</option>
                  <option value="price_asc">{isUa ? "Ціна: Від найменшої" : "Price: Low to High"}</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white/50">
                  <ChevronDown size={12} />
                </div>
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="py-24 text-center border border-white/10 rounded-sm">
                <h3 className="text-xl font-light text-white mb-3">
                  {isUa ? "Нічого не знайдено" : "No Components Found"}
                </h3>
                <button
                  onClick={() => { setActiveBrand("all"); setActiveCollection("all"); setSearchQuery(""); }}
                  className="px-6 py-2 bg-white text-black text-[10px] uppercase tracking-widest hover:bg-white/90 transition-colors font-bold mt-4"
                >
                  {isUa ? "Скинути фільтри" : "Reset Filters"}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[2px] bg-white/5 border border-white/5">
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
                    <article key={product.slug} className="group relative bg-[#040404] p-6 flex flex-col justify-between hover:bg-[#0a0a0a] transition-colors">
                      <Link href={buildShopProductPath(locale, product)} className="flex flex-col flex-grow z-10">
                        <div className="relative aspect-square mb-6 overflow-hidden flex items-center justify-center">
                          <Image
                            src={product.image || "/images/placeholders/product-fallback.jpg"}
                            alt={productTitle}
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            className="object-contain transition-transform duration-700 group-hover:scale-105"
                          />
                        </div>

                        <div className="flex flex-col flex-grow mt-auto">
                          <h3 className="text-xs uppercase tracking-widest leading-snug text-white/90 group-hover:text-white transition-colors mb-4 line-clamp-3">
                            {productTitle}
                          </h3>
                          
                          <div className="mt-auto">
                            {computed.eur === 0 ? (
                              <span className="text-[10px] uppercase tracking-widest text-[#cfcfcf]">
                                {isUa ? "За запитом" : "On Request"}
                              </span>
                            ) : (
                              <span className="text-sm font-light text-[#cfcfcf]">
                                {currency === "USD" && formatPrice(locale, computed.usd, "USD")}
                                {currency === "EUR" && formatPrice(locale, computed.eur, "EUR")}
                                {currency === "UAH" && formatPrice(locale, computed.uah, "UAH")}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
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
