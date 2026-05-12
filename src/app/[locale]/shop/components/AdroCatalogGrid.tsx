"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { ShopProductImage } from "@/components/shop/ShopProductImage";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct } from "@/lib/shopCatalog";
import {
  computeShopDisplayPrices,
  hasAnyShopPrice,
  pickShopSortableAmount,
} from "@/lib/shopDisplayPrices";
import { localizeShopProductTitle } from "@/lib/shopText";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { useShopViewerContext } from "@/lib/useShopViewerContext";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";
import {
  detectMakesForModel,
  enrichAdroCatalogProduct,
  type EnrichedAdroCatalogProduct,
} from "@/lib/adroCatalog";
import { useMobileFilterDrawer } from "./useMobileFilterDrawer";

type Props = {
  locale: SupportedLocale;
  products: ShopProduct[];
  viewerContext?: ShopViewerPricingContext;
};

type SortOrder = "default" | "price_desc" | "price_asc" | "title_asc";
type FacetOption = {
  key: string;
  label: string;
  count: number;
};

function formatPrice(locale: SupportedLocale, amount: number, currency: "EUR" | "USD" | "UAH") {
  const formatted = new Intl.NumberFormat(locale === "ua" ? "uk-UA" : "en-US", {
    maximumFractionDigits: 0,
  }).format(amount);

  if (locale === "ua" && currency === "UAH") return `${formatted} грн`;
  return locale === "ua" ? `${formatted} ${currency}` : `${currency} ${formatted}`;
}

function buildFacetOptions(values: Array<string | null | undefined>) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = String(value ?? "").trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function getCategoryLabel(locale: SupportedLocale, entry: EnrichedAdroCatalogProduct["category"]) {
  return locale === "ua" ? entry.labelUa : entry.labelEn;
}

function pickPrimaryPriceLabel(
  locale: SupportedLocale,
  currency: "EUR" | "USD" | "UAH",
  price: ShopProduct["price"]
) {
  if (currency === "USD" && price.usd > 0) return formatPrice(locale, price.usd, "USD");
  if (currency === "EUR" && price.eur > 0) return formatPrice(locale, price.eur, "EUR");
  if (currency === "UAH" && price.uah > 0) return formatPrice(locale, price.uah, "UAH");
  if (price.uah > 0) return formatPrice(locale, price.uah, "UAH");
  if (price.usd > 0) return formatPrice(locale, price.usd, "USD");
  if (price.eur > 0) return formatPrice(locale, price.eur, "EUR");
  return null;
}

export default function AdroCatalogGrid({
  locale,
  products,
  viewerContext: ssrViewerContext,
}: Props) {
  const viewerContext = useShopViewerContext(ssrViewerContext);
  const t = useTranslations("adroCatalog");
  const { currency, rates } = useShopCurrency();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { mobileFilterOpen, closeMobileFilter, toggleMobileFilter } = useMobileFilterDrawer();
  const [mounted, setMounted] = useState(false);

  const [activeMake, setActiveMake] = useState(searchParams?.get("make") || "all");
  const [activeModel, setActiveModel] = useState(searchParams?.get("model") || "all");
  const [activeCategory, setActiveCategory] = useState(searchParams?.get("category") || "all");
  const [searchQuery, setSearchQuery] = useState(searchParams?.get("q") || "");
  const [sortOrder, setSortOrder] = useState<SortOrder>(
    (searchParams?.get("sort") as SortOrder) || "default"
  );
  const [visibleCount, setVisibleCount] = useState(30);
  const previousMakeRef = useRef(activeMake);

  useEffect(() => setMounted(true), []);

  const enrichedProducts = useMemo(
    () => products.map((product) => enrichAdroCatalogProduct(product)),
    [products]
  );

  const syncToUrl = useCallback(
    (make: string, model: string, category: string, sort: SortOrder, query: string) => {
      const params = new URLSearchParams();
      if (make !== "all") params.set("make", make);
      if (model !== "all") params.set("model", model);
      if (category !== "all") params.set("category", category);
      if (sort !== "default") params.set("sort", sort);
      if (query.trim()) params.set("q", query.trim());

      const nextQuery = params.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname || "", { scroll: false });
    },
    [pathname, router]
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      syncToUrl(activeMake, activeModel, activeCategory, sortOrder, searchQuery);
    }, 250);

    return () => clearTimeout(timeout);
  }, [activeCategory, activeMake, activeModel, searchQuery, sortOrder, syncToUrl]);

  useEffect(() => {
    setVisibleCount(30);
  }, [activeCategory, activeMake, activeModel, searchQuery, sortOrder]);

  useEffect(() => {
    if (previousMakeRef.current === activeMake) {
      return;
    }

    previousMakeRef.current = activeMake;
    setActiveModel("all");
  }, [activeMake]);

  const queryFilteredProducts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return enrichedProducts;

    return enrichedProducts.filter((entry) => entry.searchText.includes(query));
  }, [enrichedProducts, searchQuery]);

  const makeOptions = useMemo(
    () => buildFacetOptions(queryFilteredProducts.flatMap((entry) => entry.makes)),
    [queryFilteredProducts]
  );

  const modelOptions = useMemo(() => {
    const scoped = queryFilteredProducts.filter((entry) => {
      if (activeMake !== "all" && !entry.makes.includes(activeMake)) return false;
      if (activeCategory !== "all" && entry.category.key !== activeCategory) return false;
      return true;
    });

    const modelTokens = scoped.flatMap((entry) => {
      if (activeMake === "all") return entry.models;
      // Pin each model to its make so a multi-fit product (e.g. "M3 / BRZ kit")
      // doesn't leak the BRZ token into the BMW model dropdown.
      return entry.models.filter((model) => {
        const matched = detectMakesForModel(model);
        return matched.length === 0 || matched.includes(activeMake);
      });
    });

    return buildFacetOptions(modelTokens);
  }, [activeCategory, activeMake, queryFilteredProducts]);

  const categoryOptions = useMemo<FacetOption[]>(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const entry of queryFilteredProducts) {
      if (activeMake !== "all" && !entry.makes.includes(activeMake)) continue;
      if (activeModel !== "all" && !entry.models.includes(activeModel)) continue;

      const existing = counts.get(entry.category.key);
      counts.set(entry.category.key, {
        label: existing?.label ?? getCategoryLabel(locale, entry.category),
        count: (existing?.count ?? 0) + 1,
      });
    }

    return [...counts.entries()]
      .map(([key, value]) => ({ key, label: value.label, count: value.count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  }, [activeMake, activeModel, locale, queryFilteredProducts]);

  const filteredProducts = useMemo(() => {
    const displayRates = rates && { EUR: rates.EUR, USD: rates.USD, UAH: rates.UAH };
    const result = queryFilteredProducts.filter((entry) => {
      if (activeMake !== "all" && !entry.makes.includes(activeMake)) return false;
      if (activeModel !== "all" && !entry.models.includes(activeModel)) return false;
      if (activeCategory !== "all" && entry.category.key !== activeCategory) return false;
      return true;
    });

    return [...result].sort((left, right) => {
      const leftPricing = viewerContext
        ? resolveShopProductPricing(left.product, viewerContext)
        : null;
      const rightPricing = viewerContext
        ? resolveShopProductPricing(right.product, viewerContext)
        : null;
      const leftPrice = pickShopSortableAmount(
        leftPricing?.effectivePrice ?? left.product.price,
        currency,
        displayRates
      );
      const rightPrice = pickShopSortableAmount(
        rightPricing?.effectivePrice ?? right.product.price,
        currency,
        displayRates
      );

      if (sortOrder === "price_desc") return rightPrice - leftPrice;
      if (sortOrder === "price_asc") return leftPrice - rightPrice;
      if (sortOrder === "title_asc") {
        return localizeShopProductTitle(locale, left.product).localeCompare(
          localizeShopProductTitle(locale, right.product)
        );
      }

      return (
        left.makes[0].localeCompare(right.makes[0]) ||
        left.models[0].localeCompare(right.models[0]) ||
        left.category.key.localeCompare(right.category.key) ||
        localizeShopProductTitle(locale, left.product).localeCompare(
          localizeShopProductTitle(locale, right.product)
        )
      );
    });
  }, [
    activeCategory,
    activeMake,
    activeModel,
    currency,
    locale,
    queryFilteredProducts,
    rates,
    sortOrder,
    viewerContext,
  ]);

  const displayedProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount]
  );

  const hasActiveFilters =
    activeMake !== "all" ||
    activeModel !== "all" ||
    activeCategory !== "all" ||
    searchQuery.trim().length > 0 ||
    sortOrder !== "default";

  const resetFilters = () => {
    setActiveMake("all");
    setActiveModel("all");
    setActiveCategory("all");
    setSearchQuery("");
    setSortOrder("default");
  };

  const filterControls = (
    <div className="space-y-5">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/55 dark:text-foreground/30"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full rounded-[2px] border border-foreground/12 bg-card/80 dark:bg-black/55 py-3 pl-11 pr-10 text-sm text-foreground outline-hidden transition-colors placeholder:text-foreground/55 dark:placeholder:text-foreground/30 focus:border-foreground/35"
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/55 dark:text-foreground/35 transition-colors hover:text-foreground"
            aria-label={t("clearSearch")}
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      <label className="block">
        <span className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-foreground/65 dark:text-foreground/45">
          {t("make")}
        </span>
        <select
          value={activeMake}
          onChange={(event) => setActiveMake(event.target.value)}
          className="w-full appearance-none rounded-[2px] border border-foreground/12 bg-card/80 dark:bg-black/55 px-4 py-3 text-sm text-foreground outline-hidden transition-colors focus:border-foreground/35"
        >
          <option value="all">{t("allMakes")}</option>
          {makeOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label} ({option.count})
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-foreground/65 dark:text-foreground/45">
          {t("model")}
        </span>
        <select
          value={activeModel}
          onChange={(event) => setActiveModel(event.target.value)}
          disabled={modelOptions.length === 0}
          className="w-full appearance-none rounded-[2px] border border-foreground/12 bg-card/80 dark:bg-black/55 px-4 py-3 text-sm text-foreground outline-hidden transition-colors focus:border-foreground/35 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <option value="all">{t("allModels")}</option>
          {modelOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label} ({option.count})
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-[10px] uppercase tracking-[0.2em] text-foreground/65 dark:text-foreground/45">
          {t("category")}
        </span>
        <select
          value={activeCategory}
          onChange={(event) => setActiveCategory(event.target.value)}
          className="w-full appearance-none rounded-[2px] border border-foreground/12 bg-card/80 dark:bg-black/55 px-4 py-3 text-sm text-foreground outline-hidden transition-colors focus:border-foreground/35"
        >
          <option value="all">{t("allCategories")}</option>
          {categoryOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label} ({option.count})
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={resetFilters}
        className="w-full rounded-[2px] border border-foreground/15 bg-foreground/5 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground/90 dark:text-foreground/75 transition-colors hover:border-foreground/30 hover:bg-foreground/10"
      >
        {t("resetFilters")}
      </button>
    </div>
  );

  if (!mounted) return null;

  return (
    <section className="relative z-20 min-h-screen bg-transparent py-8 text-foreground">
      <div className="mx-auto max-w-[1700px] px-6 pb-20 md:px-12 lg:px-16">
        <div className="mb-10 grid gap-8 border-y border-foreground/8 py-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-foreground/60 dark:text-foreground/42">
              {t("eyebrow")}
            </p>
            <h1 className="mt-4 text-balance text-3xl font-extralight uppercase tracking-[0.12em] text-foreground md:text-5xl">
              {t("title")}
            </h1>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-foreground/65 dark:text-foreground/48 lg:justify-self-end">
            {t("subtitle")}
          </p>
        </div>

        <div className="mb-4 flex items-center gap-3 lg:hidden">
          <button
            type="button"
            onClick={toggleMobileFilter}
            aria-expanded={mobileFilterOpen}
            aria-controls="adro-mobile-filters"
            className="flex items-center gap-2.5 rounded-[2px] border border-foreground/15 bg-card/90 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground transition-colors hover:border-foreground/28"
          >
            <SlidersHorizontal size={13} />
            {t("filters")}
            {hasActiveFilters ? (
              <span className="ml-1 h-1.5 w-1.5 rounded-full bg-foreground" />
            ) : null}
          </button>
          <p className="text-xs tracking-wide text-foreground/60 dark:text-foreground/42">
            {filteredProducts.length} {t("of")} {products.length}
          </p>
        </div>

        <div className="flex flex-col gap-12 lg:flex-row lg:gap-16">
          <aside
            id="adro-mobile-filters"
            className={`shrink-0 transition-transform duration-300 ${
              mobileFilterOpen
                ? "fixed inset-y-0 left-0 z-50 block w-[88vw] max-w-[360px]"
                : "hidden w-full lg:block lg:w-[280px]"
            }`}
          >
            <div
              className={`${
                mobileFilterOpen
                  ? "flex min-h-full flex-col gap-6 overflow-y-auto border-r border-foreground/10 bg-card px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] shadow-2xl"
                  : "flex flex-col gap-6 rounded-[2px] border border-foreground/8 bg-card/90 p-6 shadow-2xl backdrop-blur-md lg:sticky lg:top-[112px]"
              }`}
            >
              <button
                type="button"
                onClick={closeMobileFilter}
                className="self-end p-1.5 text-foreground/60 dark:text-foreground/40 transition-colors hover:text-foreground lg:hidden"
                aria-label={t("closeFilters")}
              >
                <X size={16} />
              </button>
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-foreground/55 dark:text-foreground/35">
                  ADRO
                </p>
                <h2 className="mt-2 text-xl font-light uppercase tracking-[0.08em] text-foreground">
                  {t("filters")}
                </h2>
                <p className="mt-2 text-xs text-foreground/55 dark:text-foreground/38">
                  {filteredProducts.length} {t("results")}
                </p>
              </div>
              {filterControls}
            </div>
          </aside>

          {mobileFilterOpen ? (
            <div
              className="fixed inset-0 z-40 bg-foreground/30 dark:bg-black/70 lg:hidden"
              onClick={closeMobileFilter}
            />
          ) : null}

          <main className="min-w-0 flex-1">
            <div className="relative z-20 mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-foreground/65 dark:text-foreground/45">
                {filteredProducts.length} {t("filteredProducts")}
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="ml-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/85 dark:text-foreground/70 transition-colors hover:text-foreground"
                  >
                    {t("reset")}
                  </button>
                ) : null}
              </p>

              <div className="relative inline-block">
                <select
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value as SortOrder)}
                  className="appearance-none rounded-[2px] border border-foreground/12 bg-card/90 px-5 py-3 pr-10 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground shadow-xl outline-hidden transition-colors focus:border-foreground/35"
                >
                  <option value="default">{t("sortDefault")}</option>
                  <option value="price_desc">{t("sortPriceDesc")}</option>
                  <option value="price_asc">{t("sortPriceAsc")}</option>
                  <option value="title_asc">{t("sortTitleAsc")}</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-foreground/65 dark:text-foreground/50">
                  <ChevronDown size={12} />
                </div>
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center border border-foreground/6 bg-card/70 dark:bg-black/45 py-28 text-center backdrop-blur-xs">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-foreground/5">
                  <Search className="h-6 w-6 text-foreground/20" />
                </div>
                <h3 className="text-xl font-light text-foreground">{t("noResultsTitle")}</h3>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-foreground/65 dark:text-foreground/48">
                  {t("noResultsBody")}
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-8 rounded-[2px] border border-foreground/25 px-8 py-3 text-[10px] uppercase tracking-[0.2em] text-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
                >
                  {t("resetFilters")}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {displayedProducts.map((entry) => {
                  const product = entry.product;
                  const productTitle = localizeShopProductTitle(locale, product);
                  const pricing = viewerContext
                    ? resolveShopProductPricing(product, viewerContext)
                    : {
                        effectivePrice: product.price,
                        effectiveCompareAt: product.compareAt,
                        audience: "b2c",
                        b2bVisible: false,
                      };
                  const displayRates = rates && { EUR: rates.EUR, USD: rates.USD, UAH: rates.UAH };
                  const computed = computeShopDisplayPrices(pricing.effectivePrice, displayRates);
                  const hasPrice = hasAnyShopPrice(pricing.effectivePrice, displayRates);
                  const primaryPrice = pickPrimaryPriceLabel(locale, currency, computed);
                  const defaultVariant =
                    product.variants?.find((variant) => variant.isDefault) ??
                    product.variants?.[0] ??
                    null;
                  const facetLabel = [
                    entry.makes[0],
                    entry.models[0],
                    getCategoryLabel(locale, entry.category),
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <article
                      key={product.slug}
                      className="group relative flex flex-col overflow-hidden border border-foreground/8 bg-card transition-all duration-500 hover:border-foreground/25 hover:bg-foreground/5"
                    >
                      <Link
                        href={`/${locale}/shop/adro/products/${product.slug}`}
                        className="z-10 flex grow flex-col"
                      >
                        <div className="relative aspect-square overflow-hidden border-b border-foreground/6 bg-card">
                          <ShopProductImage
                            src={product.image || "/images/shop/adro/adro-hero-m4.jpg"}
                            alt={productTitle}
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            fallbackSrc="/images/shop/adro/adro-hero-m4.jpg"
                            className="object-contain p-10 opacity-[0.82] transition-all duration-700 group-hover:scale-[1.05] group-hover:opacity-100"
                          />
                          <div className="absolute left-4 top-4 z-20 border border-white/25 bg-black/65 px-2.5 py-1 text-[8px] uppercase tracking-[0.18em] text-white/85 backdrop-blur-xs">
                            {getCategoryLabel(locale, entry.category)}
                          </div>
                        </div>

                        <div className="flex grow flex-col px-5 pb-5 pt-4">
                          <p className="text-[8px] uppercase tracking-[0.2em] text-foreground/50 dark:text-foreground/28">
                            {product.sku}
                          </p>
                          <h3 className="mt-2 line-clamp-2 min-h-10 text-pretty text-sm leading-snug text-foreground/88 transition-colors group-hover:text-foreground">
                            {productTitle}
                          </h3>
                          <p className="mt-3 line-clamp-2 min-h-10 text-[10px] uppercase tracking-[0.12em] text-foreground/55 dark:text-foreground/38">
                            {facetLabel}
                          </p>
                          <div className="mt-auto border-t border-foreground/6 pt-3">
                            {hasPrice && primaryPrice ? (
                              <span className="tabular-nums text-sm font-medium tracking-wide text-foreground">
                                {primaryPrice}
                              </span>
                            ) : (
                              <span className="text-[10px] uppercase tracking-[0.18em] text-foreground/60 dark:text-foreground/42">
                                {t("priceOnRequest")}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>

                      <div className="relative z-20 flex gap-3 px-5 pb-5 pt-0">
                        <Link
                          href={`/${locale}/shop/adro/products/${product.slug}`}
                          className="flex flex-1 items-center justify-center gap-2 rounded-[2px] border border-foreground/30 py-3 text-[10px] uppercase tracking-[0.24em] text-foreground/78 transition-all duration-300 hover:border-foreground hover:bg-foreground hover:text-background"
                        >
                          {t("view")}
                          <ArrowRight size={12} strokeWidth={2} />
                        </Link>
                        <AddToCartButton
                          slug={product.slug}
                          variantId={defaultVariant?.id ?? null}
                          locale={locale}
                          redirect={true}
                          productName={productTitle}
                          label={t("cart")}
                          labelAdded="✓"
                          className="flex-1 rounded-[2px] border border-foreground/12 py-3 text-[10px] uppercase tracking-[0.24em] text-foreground transition-all duration-300 hover:border-foreground hover:bg-foreground hover:text-background"
                          variant="inline"
                        />
                      </div>
                      <div className="absolute left-0 top-0 h-px w-full origin-left scale-x-0 bg-foreground transition-transform duration-500 group-hover:scale-x-100" />
                    </article>
                  );
                })}
              </div>
            )}

            {filteredProducts.length > visibleCount ? (
              <div className="mt-14 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((current) => current + 30)}
                  className="rounded-[2px] border border-foreground/30 px-12 py-4 text-[11px] uppercase tracking-[0.24em] text-foreground transition-all duration-300 hover:border-foreground hover:bg-foreground hover:text-background"
                >
                  {t("loadMore")}
                </button>
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </section>
  );
}
