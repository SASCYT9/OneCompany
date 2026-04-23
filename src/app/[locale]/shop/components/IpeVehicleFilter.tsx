"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X, ChevronDown, SlidersHorizontal, ArrowRight } from "lucide-react";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { ShopProductImage } from "@/components/shop/ShopProductImage";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import { isAbsoluteHttpUrl, isBlobStorageUrl } from "@/lib/runtimeAssetPaths";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct } from "@/lib/shopCatalog";
import { localizeShopProductTitle } from "@/lib/shopText";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";
import {
  resolveIpeProductLine,
  resolveIpeProductMaterials,
  resolveIpeProductSpecs,
  resolveIpeVehicleBrand,
  resolveIpeVehicleModel,
} from "@/lib/ipeCatalog";
import { useMobileFilterDrawer } from "./useMobileFilterDrawer";

type IpeVehicleFilterProps = {
  locale: SupportedLocale;
  products: ShopProduct[];
  viewerContext?: ShopViewerPricingContext;
  productPathPrefix: string;
};

const BRAND_ORDER = ["Porsche", "Ferrari", "Lamborghini", "McLaren", "BMW", "Mercedes-Benz", "Mercedes-AMG", "Audi", "Volkswagen", "Toyota", "Maserati", "Aston Martin", "Nissan", "Ford", "Subaru"];
const BRAND_LABELS: Record<string, Record<string, string>> = {
  Porsche: { en: "Porsche", ua: "Porsche" },
  Ferrari: { en: "Ferrari", ua: "Ferrari" },
  Lamborghini: { en: "Lamborghini", ua: "Lamborghini" },
  McLaren: { en: "McLaren", ua: "McLaren" },
  BMW: { en: "BMW", ua: "BMW" },
  "Mercedes-Benz": { en: "Mercedes-Benz", ua: "Mercedes-Benz" },
  "Mercedes-AMG": { en: "Mercedes-AMG", ua: "Mercedes-AMG" },
  Audi: { en: "Audi", ua: "Audi" },
  Volkswagen: { en: "Volkswagen", ua: "Volkswagen" },
  Toyota: { en: "Toyota", ua: "Toyota" },
  Maserati: { en: "Maserati", ua: "Maserati" },
  "Aston Martin": { en: "Aston Martin", ua: "Aston Martin" },
  Nissan: { en: "Nissan", ua: "Nissan" },
  Ford: { en: "Ford", ua: "Ford" },
  Subaru: { en: "Subaru", ua: "Subaru" }
};

const MATERIAL_LABELS: Record<string, Record<string, string>> = {
  "Titanium": { en: "Titanium", ua: "Titanium" },
  "Stainless Steel": { en: "Stainless Steel", ua: "Stainless Steel" },
  "Carbon Fiber": { en: "Carbon Fiber", ua: "Carbon Fiber" },
};

const SPEC_LABELS: Record<string, Record<string, string>> = {
  "OPF": { en: "OPF", ua: "OPF" },
  "Non-OPF": { en: "Non-OPF", ua: "Без OPF" },
  "Catted": { en: "Catted", ua: "Catted" },
  "Catless": { en: "Catless", ua: "Catless" },
  "Remote Control": { en: "Remote Control", ua: "Remote Control" },
  "OBDII": { en: "OBDII", ua: "OBDII" },
};

const FILTER_LIST_SCROLL_CLASS =
  "flex flex-col max-h-[220px] overflow-y-auto overscroll-contain pr-1";

function formatPrice(locale: SupportedLocale, amount: number, currency: "EUR" | "USD" | "UAH") {
  const formatter = new Intl.NumberFormat(locale === "ua" ? "uk-UA" : "en-US", {
    maximumFractionDigits: 0,
  });
  const formatted = formatter.format(amount);
  if (locale === "ua" && currency === "UAH") return `${formatted} грн`;
  return locale === "ua" ? `${formatted} ${currency}` : `${currency} ${formatted}`;
}

function computePricesFromUsd(
  price: ShopProduct["price"],
  rates: { EUR: number; USD: number; UAH?: number } | null
) {
  const baseUsd = price.usd;
  const baseEur = price.eur;
  const baseUah = price.uah;
  
  if (!rates) return { uah: baseUah, eur: baseEur, usd: baseUsd };
  
  const eurToUah = rates.UAH ?? (rates.EUR ? rates.EUR : 0);
  const usdToUah = eurToUah / (rates.USD || 1);

  if (baseUsd > 0) {
    return {
      usd: baseUsd,
      uah: baseUah > 0 ? baseUah : Math.round(baseUsd * usdToUah),
      eur: baseEur > 0 ? baseEur : Math.round(baseUsd / (rates.USD || 1)),
    };
  }

  // Fallback for non-USD origin
  if (baseEur > 0) {
    return {
      eur: baseEur,
      uah: baseUah > 0 ? baseUah : Math.round(baseEur * eurToUah),
      usd: Math.round(baseEur * (rates.USD || 1)),
    };
  }

  return { uah: baseUah, eur: baseEur, usd: baseUsd };
}

function shouldBypassImageOptimization(reference: string | null | undefined) {
  return isBlobStorageUrl(reference) || isAbsoluteHttpUrl(reference);
}

export default function IpeVehicleFilter({
  locale,
  products,
  viewerContext,
  productPathPrefix
}: IpeVehicleFilterProps) {
  const isUa = locale === "ua";
  const { currency, rates } = useShopCurrency();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialBrand = searchParams?.get("brand") || "all";
  const initialLine = searchParams?.get("line") || "all";
  const initialModel = searchParams?.get("model") || "all";
  const initialMaterial = searchParams?.get("material") || "all";
  const initialSpec = searchParams?.get("spec") || "all";
  const initialSearch = searchParams?.get("q") || "";
  const initialSort = (searchParams?.get("sort") as "default" | "price_desc" | "price_asc") || "default";

  const [activeBrand, setActiveBrand] = useState<string>(initialBrand);
  const [activeLine, setActiveLine] = useState<string>(initialLine);
  const [activeModel, setActiveModel] = useState<string>(initialModel);
  const [activeMaterial, setActiveMaterial] = useState<string>(initialMaterial);
  const [activeSpec, setActiveSpec] = useState<string>(initialSpec);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [sortOrder, setSortOrder] = useState<"default" | "price_desc" | "price_asc">(initialSort);
  const { mobileFilterOpen, closeMobileFilter, toggleMobileFilter } = useMobileFilterDrawer();

  const syncToUrl = useCallback((brand: string, line: string, model: string, material: string, spec: string, sort: string, query: string) => {
    const params = new URLSearchParams();
    if (brand !== "all") params.set("brand", brand);
    if (line !== "all") params.set("line", line);
    if (model !== "all") params.set("model", model);
    if (material !== "all") params.set("material", material);
    if (spec !== "all") params.set("spec", spec);
    if (sort !== "default") params.set("sort", sort);
    if (query.trim()) params.set("q", query);
    const qs = params.toString();
    const nextPath = qs ? `${pathname}?${qs}` : pathname || "";
    router.replace(nextPath, { scroll: false });
  }, [pathname, router]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      syncToUrl(activeBrand, activeLine, activeModel, activeMaterial, activeSpec, sortOrder, searchQuery);
    }, 250);
    return () => clearTimeout(timeout);
  }, [activeBrand, activeLine, activeModel, activeMaterial, activeSpec, sortOrder, searchQuery, syncToUrl]);

  const enrichedProducts = useMemo(() => {
    return products.map((product) => ({
      product,
      brand: resolveIpeVehicleBrand(product),
      model: resolveIpeVehicleModel(product),
      line: resolveIpeProductLine(product),
      materials: resolveIpeProductMaterials(product),
      specs: resolveIpeProductSpecs(product),
    }));
  }, [products]);

  // Extract brands dynamically from tags
  const availableBrands = useMemo(() => {
    const brands = new Map<string, number>();
    for (const entry of enrichedProducts) {
      const brand = entry.brand;
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
  }, [enrichedProducts, locale]);

  const availableModels = useMemo(() => {
    const models = new Map<string, number>();
    for (const entry of enrichedProducts) {
      if (activeBrand !== "all" && entry.brand !== activeBrand) continue;
      if (!entry.model) continue;
      models.set(entry.model, (models.get(entry.model) || 0) + 1);
    }
    return [...models.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key, count]) => ({ key, label: key, count }));
  }, [activeBrand, enrichedProducts]);

  // Extract iPE specific product lines (Valvetronic, Downpipe, Headers)
  const availableLines = useMemo(() => {
    if (activeBrand === "all" && products.length > 50) return [];
    const lines = new Map<string, number>();
    for (const entry of enrichedProducts) {
      if (activeBrand !== "all" && entry.brand !== activeBrand) continue;
      const detectedLine = entry.line;
      if (detectedLine) {
        lines.set(detectedLine, (lines.get(detectedLine) || 0) + 1);
      }
    }
    const resolved = [...lines.entries()].sort((a,b) => b[1] - a[1]).map(([key, count]) => ({
      key,
      label: key,
      count
    }));
    return resolved.length > 1 ? resolved : [];
  }, [activeBrand, enrichedProducts, locale, products.length]);

  const availableMaterials = useMemo(() => {
    const materials = new Map<string, number>();
    for (const entry of enrichedProducts) {
      if (activeBrand !== "all" && entry.brand !== activeBrand) continue;
      if (activeModel !== "all" && entry.model !== activeModel) continue;
      for (const material of entry.materials) {
        materials.set(material, (materials.get(material) || 0) + 1);
      }
    }
    return [...materials.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key, count]) => ({
        key,
        label: MATERIAL_LABELS[key]?.[locale] || key,
        count,
      }));
  }, [activeBrand, activeModel, enrichedProducts, locale]);

  const availableSpecs = useMemo(() => {
    const specs = new Map<string, number>();
    for (const entry of enrichedProducts) {
      if (activeBrand !== "all" && entry.brand !== activeBrand) continue;
      if (activeModel !== "all" && entry.model !== activeModel) continue;
      for (const spec of entry.specs) {
        specs.set(spec, (specs.get(spec) || 0) + 1);
      }
    }
    return [...specs.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key, count]) => ({
        key,
        label: SPEC_LABELS[key]?.[locale] || key,
        count,
      }));
  }, [activeBrand, activeModel, enrichedProducts, locale]);

  useEffect(() => {
    setActiveLine("all");
    setActiveModel("all");
    setActiveMaterial("all");
    setActiveSpec("all");
  }, [activeBrand]);

  useEffect(() => {
    setActiveMaterial("all");
    setActiveSpec("all");
  }, [activeModel]);

  const filteredProducts = useMemo(() => {
    let result = enrichedProducts;

    if (activeBrand !== "all") {
      result = result.filter((entry) => entry.brand === activeBrand);
    }

    if (activeLine !== "all") {
       result = result.filter((entry) => entry.line === activeLine);
    }

    if (activeModel !== "all") {
      result = result.filter((entry) => entry.model === activeModel);
    }

    if (activeMaterial !== "all") {
      result = result.filter((entry) => entry.materials.includes(activeMaterial));
    }

    if (activeSpec !== "all") {
      result = result.filter((entry) => entry.specs.includes(activeSpec));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(({ product }) => {
        const title = localizeShopProductTitle(locale, product).toLowerCase();
        const sku = (product.sku || "").toLowerCase();
        const tags = (product.tags || []).join(" ").toLowerCase();
        const variantText = (product.variants || [])
          .flatMap((variant) => [
            variant.sku || "",
            variant.title || "",
            ...(variant.optionValues || []),
          ])
          .join(" ")
          .toLowerCase();
        return title.includes(q) || sku.includes(q) || tags.includes(q) || variantText.includes(q);
      });
    }

    const sorted = [...result].sort((a, b) => {
      const priceA = a.product.price?.usd || a.product.price?.eur || a.product.price?.uah || 0;
      const priceB = b.product.price?.usd || b.product.price?.eur || b.product.price?.uah || 0;

      if (sortOrder === "price_desc") return priceB - priceA;
      if (sortOrder === "price_asc") return priceA - priceB;
      
      const hasImgA = a.product.image && a.product.image.length > 5 ? 1 : 0;
      const hasImgB = b.product.image && b.product.image.length > 5 ? 1 : 0;
      
      if (hasImgA !== hasImgB) return hasImgB - hasImgA; // prioritize with image
      return priceB - priceA;
    });

    return sorted.map((entry) => entry.product);
  }, [activeBrand, activeLine, activeMaterial, activeModel, activeSpec, enrichedProducts, searchQuery, sortOrder, locale]);

  const totalCount = products.length;

  if (!mounted) return null;

  return (
    <section id="catalog" className="bg-black text-white min-h-screen relative z-30">
      <div className="max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-20 pt-16">
        
        <div className="lg:hidden flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={toggleMobileFilter}
            aria-expanded={mobileFilterOpen}
            aria-controls="ipe-mobile-filters"
            className="flex items-center gap-2.5 px-5 py-3 bg-zinc-950 backdrop-blur-md border border-white/10 rounded-none text-white text-[10px] uppercase tracking-[0.18em] font-semibold hover:border-white/30 transition-colors shadow-none"
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
          <aside
            id="ipe-mobile-filters"
            className={`flex-shrink-0 transition-transform duration-300 ${
              mobileFilterOpen
                ? "fixed inset-y-0 left-0 z-50 block w-[88vw] max-w-[360px]"
                : "hidden lg:block w-full lg:w-[260px] xl:w-[280px]"
            }`}
          >
            <div
              className={`${
                mobileFilterOpen
                  ? "flex min-h-full flex-col gap-8 overflow-y-auto border-r border-white/10 bg-zinc-950 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
                  : "lg:sticky lg:top-[120px] lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto pb-10 flex flex-col gap-8 bg-zinc-950 border border-white/5 p-6 rounded-none shadow-none"
              }`}
            >
              <button
                type="button"
                onClick={closeMobileFilter}
                className="lg:hidden self-end p-1.5 text-white/40 hover:text-white transition-colors"
                aria-label="Close filters"
              >
                <X size={16} />
              </button>
              
              <div>
                <h2 className="text-2xl font-light tracking-widest uppercase mb-1">
                  {isUa ? "Каталог" : "Catalog"}
                </h2>
                <p className="text-zinc-500 text-xs tracking-widest uppercase font-medium">
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
                  className="w-full bg-black border border-white/10 pl-11 pr-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#c29d59]/50 transition-colors rounded-none"
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
                <ul className={FILTER_LIST_SCROLL_CLASS}>
                  <li>
                    <button
                      onClick={() => setActiveBrand("all")}
                      className={`w-full text-left py-2.5 text-xs uppercase tracking-[0.15em] font-semibold transition-colors flex justify-between items-center ${
                        activeBrand === "all" ? "text-white" : "text-white/50 hover:text-[#c29d59]"
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
                           activeBrand === brand.key ? "text-white" : "text-white/50 hover:text-[#c29d59]"
                         }`}
                      >
                        <span>{brand.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-zinc-600 font-bold">{brand.count}</span>
                          {activeBrand === brand.key && <span className="w-1.5 h-1.5 rounded-full bg-[#c29d59]"></span>}
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
                  <ul className={FILTER_LIST_SCROLL_CLASS}>
                    <li>
                      <button
                        onClick={() => setActiveLine("all")}
                        className={`w-full text-left py-2 text-[11px] uppercase tracking-[0.12em] font-semibold transition-colors flex justify-between items-center ${
                          activeLine === "all" ? "text-[#c29d59]" : "text-white/40 hover:text-[#c29d59]"
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
                            activeLine === line.key ? "text-[#c29d59]" : "text-white/40 hover:text-[#c29d59]"
                          }`}
                        >
                          <span>{line.label}</span>
                          <span className="text-[10px] opacity-60 text-zinc-500">{line.count}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {availableModels.length > 0 && (
                <div className="flex flex-col gap-3 mt-2 animate-in fade-in slide-in-from-top-4 duration-500">
                  <h3 className="text-xs text-white/60 uppercase tracking-widest border-b border-white/[0.06] pb-2 font-medium">
                    {isUa ? "Модель" : "Vehicle Model"}
                  </h3>
                  <ul className={FILTER_LIST_SCROLL_CLASS}>
                    <li>
                      <button
                        onClick={() => setActiveModel("all")}
                        className={`w-full text-left py-2 text-[11px] tracking-[0.08em] uppercase font-semibold transition-colors flex justify-between items-center ${
                          activeModel === "all" ? "text-[#c29d59]" : "text-white/40 hover:text-[#c29d59]"
                        }`}
                      >
                        <span>{isUa ? "Всі моделі" : "All Models"}</span>
                      </button>
                    </li>
                    {availableModels.map((model) => (
                      <li key={model.key}>
                        <button
                          onClick={() => setActiveModel(model.key)}
                          className={`w-full text-left py-2 text-[11px] tracking-[0.03em] font-medium transition-colors flex justify-between items-center ${
                            activeModel === model.key ? "text-[#c29d59]" : "text-white/40 hover:text-[#c29d59]"
                          }`}
                        >
                          <span className="pr-3">{model.label}</span>
                          <span className="text-[10px] opacity-60 text-zinc-500">{model.count}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {availableMaterials.length > 0 && (
                <div className="flex flex-col gap-3 mt-2 animate-in fade-in slide-in-from-top-4 duration-500">
                  <h3 className="text-xs text-white/60 uppercase tracking-widest border-b border-white/[0.06] pb-2 font-medium">
                    {isUa ? "Матеріал" : "Material"}
                  </h3>
                  <ul className={FILTER_LIST_SCROLL_CLASS}>
                    <li>
                      <button
                        onClick={() => setActiveMaterial("all")}
                        className={`w-full text-left py-2 text-[11px] uppercase tracking-[0.12em] font-semibold transition-colors flex justify-between items-center ${
                          activeMaterial === "all" ? "text-[#c29d59]" : "text-white/40 hover:text-[#c29d59]"
                        }`}
                      >
                        <span>{isUa ? "Усі" : "All"}</span>
                      </button>
                    </li>
                    {availableMaterials.map((material) => (
                      <li key={material.key}>
                        <button
                          onClick={() => setActiveMaterial(material.key)}
                          className={`w-full text-left py-2 text-[11px] uppercase tracking-[0.12em] font-semibold transition-colors flex justify-between items-center ${
                            activeMaterial === material.key ? "text-[#c29d59]" : "text-white/40 hover:text-[#c29d59]"
                          }`}
                        >
                          <span>{material.label}</span>
                          <span className="text-[10px] opacity-60 text-zinc-500">{material.count}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {availableSpecs.length > 0 && (
                <div className="flex flex-col gap-3 mt-2 animate-in fade-in slide-in-from-top-4 duration-500">
                  <h3 className="text-xs text-white/60 uppercase tracking-widest border-b border-white/[0.06] pb-2 font-medium">
                    {isUa ? "Конфігурація" : "Configuration"}
                  </h3>
                  <ul className={FILTER_LIST_SCROLL_CLASS}>
                    <li>
                      <button
                        onClick={() => setActiveSpec("all")}
                        className={`w-full text-left py-2 text-[11px] uppercase tracking-[0.12em] font-semibold transition-colors flex justify-between items-center ${
                          activeSpec === "all" ? "text-[#c29d59]" : "text-white/40 hover:text-[#c29d59]"
                        }`}
                      >
                        <span>{isUa ? "Усі" : "All"}</span>
                      </button>
                    </li>
                    {availableSpecs.map((spec) => (
                      <li key={spec.key}>
                        <button
                          onClick={() => setActiveSpec(spec.key)}
                          className={`w-full text-left py-2 text-[11px] uppercase tracking-[0.12em] font-semibold transition-colors flex justify-between items-center ${
                            activeSpec === spec.key ? "text-[#c29d59]" : "text-white/40 hover:text-[#c29d59]"
                          }`}
                        >
                          <span>{spec.label}</span>
                          <span className="text-[10px] opacity-60 text-zinc-500">{spec.count}</span>
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
              className="lg:hidden fixed inset-0 z-40 bg-black/80"
              onClick={closeMobileFilter}
            />
          )}

          <main className="flex-1 min-w-0">
            <div className="flex justify-end mb-6 z-20 relative">
              <div className="relative inline-block">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as "default" | "price_desc" | "price_asc")}
                  className="appearance-none bg-zinc-900 border border-white/5 text-white text-[10px] uppercase tracking-[0.2em] font-semibold px-5 py-3 pr-10 rounded-none outline-none focus:border-white/20 transition-colors shadow-none cursor-pointer"
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
              <div className="py-24 text-center bg-zinc-950 border border-white/5 rounded-none flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-6">
                  <Search className="w-6 h-6 text-zinc-600" />
                </div>
                <h3 className="text-xl font-light text-zinc-300 mb-3">
                  {isUa ? "Поки що порожньо" : "Nothing Found Yet"}
                </h3>
                <p className="text-zinc-500 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                  {searchQuery
                    ? (isUa ? `Нічого не знайдено за запитом "${searchQuery}"` : `No results for "${searchQuery}"`)
                    : (isUa ? "Каталог iPE наразі оновлюється." : "The iPE catalog is currently being updated.")}
                </p>
                <button
                  onClick={() => { setActiveBrand("all"); setActiveLine("all"); setActiveModel("all"); setActiveMaterial("all"); setActiveSpec("all"); setSearchQuery(""); setSortOrder("default"); }}
                  className="px-8 py-3 bg-[#c29d59] text-black text-[10px] uppercase tracking-widest hover:bg-white transition-all duration-300 font-bold"
                >
                  {isUa ? "Скинути фільтри" : "Reset Filters"}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1">
                {filteredProducts.map((product) => {
                  const pricing = viewerContext
                    ? resolveShopProductPricing(product, viewerContext)
                    : { effectivePrice: product.price, effectiveCompareAt: product.compareAt, audience: "b2c", b2bVisible: false };

                  const computed = computePricesFromUsd(
                    pricing.effectivePrice,
                    rates && { EUR: rates.EUR, USD: rates.USD, UAH: rates.UAH }
                  );

                  const productTitle = localizeShopProductTitle(locale, product);
                  const productImage = product.image || "/images/placeholders/product-fallback.jpg";

                  return (
                    <article key={product.slug} className="group relative bg-[#060606] overflow-hidden flex flex-col hover:bg-[#0a0a0a] transition-all duration-500 border border-white/5 hover:border-white/10">
                      <Link
                        href={`${productPathPrefix}/${product.slug}`}
                        className="flex flex-col flex-grow z-10"
                      >
                        <div className="relative aspect-[4/3] bg-black overflow-hidden flex items-center justify-center p-8 border-b border-white/[0.02]">
                          <ShopProductImage
                            src={productImage}
                            alt={productTitle}
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            fallbackSrc="/images/placeholders/product-fallback.jpg"
                            unoptimized={shouldBypassImageOptimization(productImage)}
                            className="object-contain p-6 md:p-8 opacity-80 group-hover:opacity-100 transition-all duration-700 ease-out group-hover:scale-105"
                          />
                        </div>

                        <div className="px-6 pb-6 pt-5 flex flex-col flex-grow">
                          <p className="text-[9px] uppercase tracking-[0.2em] font-medium text-[#c29d59] mb-2">{product.brand}</p>
                          <h3 className="text-sm font-light leading-snug text-zinc-300 group-hover:text-white transition-colors line-clamp-2 mb-4">
                            {productTitle}
                          </h3>
                          
                          <div className="mt-auto">
                            {computed.usd === 0 && computed.eur === 0 ? (
                              <span className="text-[11px] tracking-wider uppercase font-medium text-zinc-600">
                                {isUa ? "Ціна за запитом" : "Price on Request"}
                              </span>
                            ) : (
                              <span className="text-sm tracking-widest font-medium text-white">
                                {currency === "USD" && formatPrice(locale, computed.usd, "USD")}
                                {currency === "EUR" && formatPrice(locale, computed.eur, "EUR")}
                                {currency === "UAH" && formatPrice(locale, computed.uah, "UAH")}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>

                      {/* Bottom Actions: View + Add To Cart */}
                      <div className="px-6 pb-6 pt-0 z-20 relative flex gap-3">
                        <Link
                          href={`${productPathPrefix}/${product.slug}`}
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
              </div>
            )}
          </main>
        </div>
      </div>
    </section>
  );
}
