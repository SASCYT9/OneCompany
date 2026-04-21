"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Search, X, ChevronDown, SlidersHorizontal, ArrowRight } from "lucide-react";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { ShopProductImage } from "@/components/shop/ShopProductImage";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct } from "@/lib/shopCatalog";
import { localizeShopProductTitle } from "@/lib/shopText";
import { useMobileFilterDrawer } from "./useMobileFilterDrawer";

type Props = {
  locale: SupportedLocale;
  products: ShopProduct[];
};

function formatPrice(locale: SupportedLocale, amount: number, currency: "EUR" | "USD" | "UAH") {
  const formatter = new Intl.NumberFormat(locale === "ua" ? "uk-UA" : "en-US", {
    maximumFractionDigits: 0,
  });
  const formatted = formatter.format(amount);
  if (locale === "ua" && currency === "UAH") return `${formatted} грн`;
  return locale === "ua" ? `${formatted} ${currency}` : `${currency} ${formatted}`;
}

export default function CSFCatalogGrid({ locale, products }: Props) {
  const isUa = locale === "ua";
  const { currency, rates } = useShopCurrency();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"default" | "price_desc" | "price_asc">("default");
  const { mobileFilterOpen, closeMobileFilter, toggleMobileFilter } = useMobileFilterDrawer();

  /* ─── CSF Category normalizer ─── */
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

  const getCategoryLabel = (product: ShopProduct) => {
    const raw = product.category.ua || product.category.en;
    const mapped = CSF_CATEGORY_MAP[raw];
    if (!mapped) return { label: raw, group: raw };
    return { label: isUa ? mapped.ua : mapped.en, group: mapped.group };
  };

  // Extract categories from products (normalized)
  const categories = useMemo(() => {
    const groups = new Map<string, { label: string; count: number }>();
    for (const p of products) {
      const { label, group } = getCategoryLabel(p);
      const existing = groups.get(group);
      if (existing) {
        existing.count += 1;
      } else {
        groups.set(group, { label, count: 1 });
      }
    }
    return [...groups.values()]
      .sort((a, b) => b.count - a.count);
  }, [products, isUa]);

  // Filter
  const filteredProducts = useMemo(() => {
    let result = products;

    if (activeCategory !== "all") {
      result = result.filter((p) => {
        const { label } = getCategoryLabel(p);
        return label === activeCategory;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((p) => {
        const title = localizeShopProductTitle(locale, p).toLowerCase();
        const sku = (p.sku || "").toLowerCase();
        return title.includes(q) || sku.includes(q);
      });
    }

    result = [...result].sort((a, b) => {
      const priceA = a.price?.eur || 0;
      const priceB = b.price?.eur || 0;
      if (sortOrder === "price_desc") return priceB - priceA;
      if (sortOrder === "price_asc") return priceA - priceB;
      return priceB - priceA;
    });

    return result;
  }, [activeCategory, searchQuery, sortOrder, products, locale, isUa]);

  if (!mounted) return null;

  return (
    <section className="bg-transparent text-white py-8 min-h-screen relative z-30">
      <div className="max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-20">

        {/* Mobile Filter Toggle */}
        <div className="lg:hidden flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={toggleMobileFilter}
            aria-expanded={mobileFilterOpen}
            className="flex items-center gap-2.5 px-5 py-3 bg-[#050505]/80 backdrop-blur-md border border-white/[0.08] rounded-xl text-white text-[10px] uppercase tracking-[0.18em] font-semibold hover:border-[#c8102e]/40 transition-colors shadow-xl"
          >
            <SlidersHorizontal size={13} />
            {isUa ? "Фільтри" : "Filters"}
            {activeCategory !== "all" && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#c8102e] ml-1" />
            )}
          </button>
          <p className="text-white/40 text-xs tracking-wide">
            {filteredProducts.length} {isUa ? "з" : "of"} {products.length}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">

          {/* ─── LEFT SIDEBAR ─── */}
          <aside
            className={`flex-shrink-0 transition-transform duration-300 ${
              mobileFilterOpen
                ? "fixed inset-y-0 left-0 z-50 block w-[88vw] max-w-[360px]"
                : "hidden lg:block w-full lg:w-[260px] xl:w-[280px]"
            }`}
          >
            <div
              className={`${
                mobileFilterOpen
                  ? "flex min-h-full flex-col gap-8 overflow-y-auto border-r border-white/[0.08] bg-[#050505] px-5 pb-5 pt-4 shadow-2xl"
                  : "lg:sticky lg:top-[120px] pb-10 flex flex-col gap-8 bg-[#050505]/80 backdrop-blur-md border border-white/[0.04] p-6 rounded-2xl shadow-2xl"
              }`}
            >
              {/* Mobile close */}
              <button
                type="button"
                onClick={closeMobileFilter}
                className="lg:hidden self-end p-1.5 text-white/40 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>

              {/* Header */}
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/shop/csf/csf-logo.svg" alt="CSF Racing" className="h-8 mb-4" />
                <h2 className="text-2xl font-light tracking-widest uppercase mb-1 drop-shadow-sm">
                  {isUa ? "Каталог" : "Catalog"}
                </h2>
                <p className="text-[#c8102e]/60 text-xs tracking-widest uppercase font-semibold">
                  {filteredProducts.length} {isUa ? "з" : "of"} {products.length} {isUa ? "товарів" : "products"}
                </p>
              </div>

              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isUa ? "Пошук товарів..." : "Search products..."}
                  className="w-full bg-black/40 border border-white/10 rounded-sm pl-11 pr-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#c8102e]/50 transition-colors backdrop-blur-md"
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

              {/* Categories */}
              <div className="flex flex-col gap-3 mt-2">
                <h3 className="text-xs text-white/60 uppercase tracking-widest border-b border-white/[0.06] pb-2 font-medium">
                  {isUa ? "Категорія" : "Category"}
                </h3>
                <ul className="flex flex-col">
                  <li>
                    <button
                      onClick={() => setActiveCategory("all")}
                      className={`w-full text-left py-2.5 text-xs uppercase tracking-[0.15em] font-semibold transition-colors flex justify-between items-center ${
                        activeCategory === "all" ? "text-white" : "text-white/50 hover:text-white"
                      }`}
                    >
                      <span>{isUa ? "Всі товари" : "All Products"}</span>
                      {activeCategory === "all" && <span className="w-1.5 h-1.5 rounded-full bg-[#c8102e]" />}
                    </button>
                  </li>
                  {categories.map((cat) => (
                    <li key={cat.label}>
                      <button
                        onClick={() => setActiveCategory(cat.label)}
                        className={`w-full text-left py-2.5 text-xs uppercase tracking-[0.15em] font-semibold transition-colors flex justify-between items-center ${
                          activeCategory === cat.label ? "text-white" : "text-white/50 hover:text-white"
                        }`}
                      >
                        <span>{cat.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-white/40 font-bold">{cat.count}</span>
                          {activeCategory === cat.label && <span className="w-1.5 h-1.5 rounded-full bg-[#c8102e]" />}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>

          {/* Mobile overlay */}
          {mobileFilterOpen && (
            <div
              className="lg:hidden fixed inset-0 z-40 bg-black/60"
              onClick={closeMobileFilter}
            />
          )}

          {/* ─── RIGHT: PRODUCT GRID ─── */}
          <main className="flex-1 min-w-0">
            {/* Sort */}
            <div className="flex justify-end mb-6 z-20 relative">
              <div className="relative inline-block">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as "default" | "price_desc" | "price_asc")}
                  className="appearance-none bg-[#050505]/80 backdrop-blur-md border border-white/10 text-white text-[10px] uppercase tracking-[0.2em] font-semibold px-5 py-3 pr-10 rounded-lg outline-none focus:border-[#c8102e]/50 transition-colors shadow-xl cursor-pointer"
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
                  {isUa ? "Нічого не знайдено" : "No Products Found"}
                </h3>
                <p className="text-white/50 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                  {searchQuery
                    ? (isUa ? `Не знайдено за запитом "${searchQuery}"` : `No results for "${searchQuery}"`)
                    : (isUa ? "Товари для цієї категорії поки відсутні." : "Products for this category are unavailable.")}
                </p>
                <button
                  onClick={() => { setActiveCategory("all"); setSearchQuery(""); setSortOrder("default"); }}
                  className="px-8 py-3 bg-[#c8102e]/15 backdrop-blur-xl border border-[#c8102e]/40 text-white text-[10px] uppercase tracking-widest hover:bg-[#c8102e]/25 hover:border-[#c8102e]/70 transition-all duration-500 shadow-lg rounded-md font-medium"
                >
                  {isUa ? "Скинути фільтри" : "Reset Filters"}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
                {filteredProducts.map((product) => {
                  const productTitle = localizeShopProductTitle(locale, product);
                  const { label: cat } = getCategoryLabel(product);
                  const priceEur = product.price?.eur || 0;
                  const priceUsd = product.price?.usd || 0;
                  const priceUah = product.price?.uah || 0;
                  const hasPrice = priceEur > 0 || priceUsd > 0 || priceUah > 0;

                  return (
                    <article
                      key={product.slug}
                      className="group relative bg-gradient-to-b from-[#0c0c10] to-[#080809] overflow-hidden flex flex-col hover:from-[#0f0f14] hover:to-[#0a0a0e] transition-all duration-500 border border-white/[0.06] hover:border-white/[0.14] shadow-2xl hover:shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
                    >
                      <Link
                        href={`/${locale}/shop/csf/products/${product.slug}`}
                        className="flex flex-col flex-grow z-10"
                      >
                        {/* Image */}
                        <div className="relative aspect-square overflow-hidden border-b border-white/[0.04]">
                          {/* Neutral dark bg — products float on it */}
                          <div className="absolute inset-0 bg-[#141416]" />
                          {/* Center glow on hover */}
                          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(255,255,255,0.03)_0%,transparent_70%)]" />
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(200,16,46,0.05)_0%,transparent_50%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                          <ShopProductImage
                            src={product.image || "/images/placeholders/product-fallback.svg"}
                            alt={productTitle}
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            className="object-contain p-10 md:p-12 drop-shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-transform duration-700 group-hover:scale-[1.06] relative z-10 mix-blend-luminosity"
                          />
                          {/* Category badge */}
                          {cat && (
                            <span className="absolute top-4 left-4 z-20 text-[8px] uppercase tracking-[0.2em] font-bold text-white/50 bg-black/60 backdrop-blur-sm px-2.5 py-1 border border-white/[0.06]">
                              {cat}
                            </span>
                          )}
                        </div>

                        {/* Content */}
                        <div className="px-5 pb-5 pt-4 flex flex-col flex-grow">
                          <p className="text-[8px] uppercase tracking-[0.25em] font-bold text-white/25 mb-1.5 tabular-nums">
                            {product.sku}
                          </p>
                          <h3 className="text-[13px] font-normal leading-snug text-white/90 group-hover:text-white line-clamp-2 mb-3 transition-colors">
                            {productTitle}
                          </h3>

                          {/* Price */}
                          <div className="mt-auto pt-3 border-t border-white/[0.04]">
                            {hasPrice ? (
                              <span className="text-sm tracking-widest font-medium text-white tabular-nums">
                                {currency === "EUR" && formatPrice(locale, priceEur, "EUR")}
                                {currency === "USD" && formatPrice(locale, priceUsd, "USD")}
                                {currency === "UAH" && formatPrice(locale, priceUah, "UAH")}
                              </span>
                            ) : (
                              <span className="text-[10px] tracking-[0.15em] uppercase font-semibold text-[#c8102e]/60">
                                {isUa ? "Ціна за запитом" : "Price on Request"}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Hover accent line */}
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#c8102e] to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                      </Link>

                      {/* Bottom Actions */}
                      <div className="px-6 pb-6 pt-0 z-20 relative flex gap-3">
                        <Link
                          href={`/${locale}/shop/csf/products/${product.slug}`}
                          className="flex-1 flex items-center justify-center gap-2 py-3 border border-[#c8102e]/30 text-[10px] tracking-[0.3em] uppercase font-light text-[#c8102e] hover:text-white hover:bg-[#c8102e] hover:border-[#c8102e] transition-all duration-300 rounded-[2px]"
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
              </div>
            )}
          </main>
        </div>
      </div>
    </section>
  );
}
