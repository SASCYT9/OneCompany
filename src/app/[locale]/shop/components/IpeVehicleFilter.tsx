"use client";

import { useState, useMemo, useEffect, useCallback, useRef, type ReactNode } from "react";
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
import { useShopViewerContext } from "@/lib/useShopViewerContext";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";
import {
  resolveIpeProductLine,
  resolveIpeProductMaterials,
  resolveIpeProductSpecs,
  resolveIpeVehicleBrand,
  resolveIpeVehicleModel,
} from "@/lib/ipeCatalog";
import { splitIpeModelLabel, IPE_HERO_BRAND_PRIORITY } from "@/lib/ipeHeroCatalog";
import { useMobileFilterDrawer } from "./useMobileFilterDrawer";

type IpeVehicleFilterProps = {
  locale: SupportedLocale;
  products: ShopProduct[];
  viewerContext?: ShopViewerPricingContext;
  productPathPrefix: string;
};

// Brand order is shared with the hero finder so the two filter UIs agree.
const BRAND_ORDER = IPE_HERO_BRAND_PRIORITY;
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
  Subaru: { en: "Subaru", ua: "Subaru" },
};

const MATERIAL_LABELS: Record<string, Record<string, string>> = {
  Titanium: { en: "Titanium", ua: "Titanium" },
  "Stainless Steel": { en: "Stainless Steel", ua: "Stainless Steel" },
  "Carbon Fiber": { en: "Carbon Fiber", ua: "Carbon Fiber" },
};

const SPEC_LABELS: Record<string, Record<string, string>> = {
  OPF: { en: "OPF", ua: "OPF" },
  "Non-OPF": { en: "Non-OPF", ua: "Без OPF" },
  Catted: { en: "Catted", ua: "Catted" },
  Catless: { en: "Catless", ua: "Catless" },
  "Remote Control": { en: "Remote Control", ua: "Remote Control" },
  OBDII: { en: "OBDII", ua: "OBDII" },
};

const FILTER_LIST_SCROLL_CLASS =
  "flex max-h-56 flex-col overflow-y-auto overscroll-contain pr-1 [scrollbar-color:rgba(194,157,89,0.55)_transparent] scrollbar-thin";
const PAGE_SIZE = 30;

type FilterSectionKey = "brand" | "line" | "model" | "body" | "material" | "spec";

type FilterSectionProps = {
  title: string;
  count?: number;
  isOpen: boolean;
  children: ReactNode;
  onToggle: () => void;
};

function FilterSection({ title, count, isOpen, children, onToggle }: FilterSectionProps) {
  return (
    <div className="border-t border-white/[0.07] pt-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65 transition-colors hover:text-white"
      >
        <span>{title}</span>
        <span className="ml-auto flex items-center gap-3">
          {typeof count === "number" && (
            <span className="rounded-full border border-white/10 bg-white/3 px-2 py-0.5 text-[10px] tracking-normal text-white/38">
              {count}
            </span>
          )}
          <ChevronDown
            size={13}
            className={`text-[#c29d59] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      {isOpen && <div className="mt-3">{children}</div>}
    </div>
  );
}

type ActiveFilterChipProps = {
  label: string;
  onClear: () => void;
};

function ActiveFilterChip({ label, onClear }: ActiveFilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-2 rounded-full border border-[#c29d59]/30 bg-[#c29d59]/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-[#f1d8a5] transition-colors hover:border-[#c29d59]/60 hover:bg-[#c29d59]/16"
    >
      <span className="max-w-[180px] truncate">{label}</span>
      <X size={11} />
    </button>
  );
}

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
  viewerContext: ssrViewerContext,
  productPathPrefix,
}: IpeVehicleFilterProps) {
  const viewerContext = useShopViewerContext(ssrViewerContext);
  const isUa = locale === "ua";
  const { currency, rates } = useShopCurrency();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialBrand = searchParams?.get("brand") || "all";
  const initialLine = searchParams?.get("line") || "all";
  const initialModelRaw = searchParams?.get("model") || "all";
  const initialBodyParam = searchParams?.get("body") || "all";
  // The hero filter writes `?model=M3 / M4 (G80/G82)` — split that into a
  // base ("M3 / M4") plus body ("G80/G82") so the catalog presents them as
  // two separate facets. Older bookmarks stay compatible.
  const { base: initialModelBase, body: initialBodyFromModel } =
    initialModelRaw !== "all" ? splitIpeModelLabel(initialModelRaw) : { base: "all", body: null };
  const initialModel = initialModelBase || "all";
  const initialBody =
    initialBodyParam !== "all" ? initialBodyParam : (initialBodyFromModel ?? "all");
  const initialMaterial = searchParams?.get("material") || "all";
  const initialSpec = searchParams?.get("spec") || "all";
  const initialSearch = searchParams?.get("q") || "";
  const initialSort =
    (searchParams?.get("sort") as "default" | "price_desc" | "price_asc") || "default";

  const [activeBrand, setActiveBrand] = useState<string>(initialBrand);
  const [activeLine, setActiveLine] = useState<string>(initialLine);
  const [activeModel, setActiveModel] = useState<string>(initialModel);
  const [activeBody, setActiveBody] = useState<string>(initialBody);
  const [activeMaterial, setActiveMaterial] = useState<string>(initialMaterial);
  const [activeSpec, setActiveSpec] = useState<string>(initialSpec);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [modelQuery, setModelQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"default" | "price_desc" | "price_asc">(initialSort);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [openSections, setOpenSections] = useState<Record<FilterSectionKey, boolean>>({
    brand: true,
    line: initialLine !== "all",
    model: initialModel !== "all",
    body: initialBody !== "all",
    material: initialMaterial !== "all",
    spec: initialSpec !== "all",
  });
  const { mobileFilterOpen, closeMobileFilter, toggleMobileFilter } = useMobileFilterDrawer();

  const toggleSection = useCallback((section: FilterSectionKey) => {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setActiveBrand("all");
    setActiveLine("all");
    setActiveModel("all");
    setActiveBody("all");
    setActiveMaterial("all");
    setActiveSpec("all");
    setSearchQuery("");
    setModelQuery("");
    setSortOrder("default");
  }, []);

  const syncToUrl = useCallback(
    (
      brand: string,
      line: string,
      model: string,
      body: string,
      material: string,
      spec: string,
      sort: string,
      query: string
    ) => {
      const params = new URLSearchParams();
      if (brand !== "all") params.set("brand", brand);
      if (line !== "all") params.set("line", line);
      if (model !== "all") params.set("model", model);
      if (body !== "all") params.set("body", body);
      if (material !== "all") params.set("material", material);
      if (spec !== "all") params.set("spec", spec);
      if (sort !== "default") params.set("sort", sort);
      if (query.trim()) params.set("q", query);
      const qs = params.toString();
      const nextPath = qs ? `${pathname}?${qs}` : pathname || "";
      router.replace(nextPath, { scroll: false });
    },
    [pathname, router]
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      syncToUrl(
        activeBrand,
        activeLine,
        activeModel,
        activeBody,
        activeMaterial,
        activeSpec,
        sortOrder,
        searchQuery
      );
    }, 250);
    return () => clearTimeout(timeout);
  }, [
    activeBrand,
    activeLine,
    activeModel,
    activeBody,
    activeMaterial,
    activeSpec,
    sortOrder,
    searchQuery,
    syncToUrl,
  ]);

  const enrichedProducts = useMemo(() => {
    return products.map((product) => {
      const fullModel = resolveIpeVehicleModel(product);
      const split = fullModel ? splitIpeModelLabel(fullModel) : { base: null, body: null };
      return {
        product,
        brand: resolveIpeVehicleBrand(product),
        model: fullModel,
        modelBase: split.base,
        body: split.body,
        line: resolveIpeProductLine(product),
        materials: resolveIpeProductMaterials(product),
        specs: resolveIpeProductSpecs(product),
      };
    });
  }, [products]);

  // Extract brands dynamically from tags
  const availableBrands = useMemo(() => {
    const brands = new Map<string, number>();
    for (const entry of enrichedProducts) {
      const brand = entry.brand;
      if (brand) brands.set(brand, (brands.get(brand) || 0) + 1);
    }
    const foundTags = [...brands.keys()].sort((a, b) => {
      const iA = BRAND_ORDER.indexOf(a);
      const iB = BRAND_ORDER.indexOf(b);
      return (iA === -1 ? 99 : iA) - (iB === -1 ? 99 : iB);
    });
    return foundTags.map((b) => ({
      key: b,
      label: BRAND_LABELS[b]?.[locale] || b,
      count: brands.get(b) || 0,
    }));
  }, [enrichedProducts, locale]);

  // Models grouped by base name, e.g. "M3 / M4" rather than the full
  // "M3 / M4 (G80/G82)" — the body / chassis becomes a separate facet below.
  const availableModels = useMemo(() => {
    const models = new Map<string, number>();
    for (const entry of enrichedProducts) {
      if (activeBrand !== "all" && entry.brand !== activeBrand) continue;
      const key = entry.modelBase;
      if (!key) continue;
      models.set(key, (models.get(key) || 0) + 1);
    }
    return [...models.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key, count]) => ({ key, label: key, count }));
  }, [activeBrand, enrichedProducts]);

  const visibleModels = useMemo(() => {
    const query = modelQuery.trim().toLowerCase();
    if (!query) return availableModels;
    return availableModels.filter((model) => model.label.toLowerCase().includes(query));
  }, [availableModels, modelQuery]);

  // Bodies (chassis codes) under the currently picked base model. Hidden
  // entirely when the model only has one body — there's nothing to choose.
  const availableBodies = useMemo(() => {
    if (activeModel === "all") return [];
    const bodies = new Map<string, number>();
    for (const entry of enrichedProducts) {
      if (activeBrand !== "all" && entry.brand !== activeBrand) continue;
      if (entry.modelBase !== activeModel) continue;
      if (!entry.body) continue;
      bodies.set(entry.body, (bodies.get(entry.body) || 0) + 1);
    }
    if (bodies.size <= 1) return [];
    return [...bodies.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, count]) => ({ key, label: key, count }));
  }, [activeBrand, activeModel, enrichedProducts]);

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
    const resolved = [...lines.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({
        key,
        label: key,
        count,
      }));
    return resolved.length > 1 ? resolved : [];
  }, [activeBrand, enrichedProducts, products.length]);

  const availableMaterials = useMemo(() => {
    const materials = new Map<string, number>();
    for (const entry of enrichedProducts) {
      if (activeBrand !== "all" && entry.brand !== activeBrand) continue;
      if (activeModel !== "all" && entry.modelBase !== activeModel) continue;
      if (activeBody !== "all" && entry.body !== activeBody) continue;
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
  }, [activeBrand, activeModel, activeBody, enrichedProducts, locale]);

  const availableSpecs = useMemo(() => {
    const specs = new Map<string, number>();
    for (const entry of enrichedProducts) {
      if (activeBrand !== "all" && entry.brand !== activeBrand) continue;
      if (activeModel !== "all" && entry.modelBase !== activeModel) continue;
      if (activeBody !== "all" && entry.body !== activeBody) continue;
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
  }, [activeBrand, activeModel, activeBody, enrichedProducts, locale]);

  // Skip the cascading reset on initial mount so deep-links from the brand-home
  // hero filter (e.g. ?brand=Porsche&model=...&line=...) keep all their params.
  const previousBrandRef = useRef(activeBrand);
  useEffect(() => {
    if (previousBrandRef.current === activeBrand) {
      return;
    }
    previousBrandRef.current = activeBrand;
    setActiveLine("all");
    setActiveModel("all");
    setActiveBody("all");
    setActiveMaterial("all");
    setActiveSpec("all");
    setModelQuery("");
  }, [activeBrand]);

  const previousModelRef = useRef(activeModel);
  useEffect(() => {
    if (previousModelRef.current === activeModel) {
      return;
    }
    previousModelRef.current = activeModel;
    setActiveBody("all");
    setActiveMaterial("all");
    setActiveSpec("all");
  }, [activeModel]);

  useEffect(() => {
    setOpenSections((current) => {
      if (activeBrand === "all") {
        return {
          ...current,
          line: false,
          model: false,
          body: false,
          material: false,
          spec: false,
        };
      }

      return {
        ...current,
        line: availableLines.length > 0,
        model: activeModel !== "all",
        body: activeModel !== "all" && availableBodies.length > 0,
      };
    });
  }, [activeBrand, activeModel, availableLines.length, availableBodies.length]);

  const filteredProducts = useMemo(() => {
    let result = enrichedProducts;

    if (activeBrand !== "all") {
      result = result.filter((entry) => entry.brand === activeBrand);
    }

    if (activeLine !== "all") {
      result = result.filter((entry) => entry.line === activeLine);
    }

    if (activeModel !== "all") {
      result = result.filter((entry) => entry.modelBase === activeModel);
    }

    if (activeBody !== "all") {
      result = result.filter((entry) => entry.body === activeBody);
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
  }, [
    activeBrand,
    activeLine,
    activeMaterial,
    activeModel,
    activeBody,
    activeSpec,
    enrichedProducts,
    searchQuery,
    sortOrder,
    locale,
  ]);

  const displayedProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount]
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [
    activeBrand,
    activeLine,
    activeModel,
    activeBody,
    activeMaterial,
    activeSpec,
    searchQuery,
    sortOrder,
  ]);

  const totalCount = products.length;
  const activeBrandLabel =
    activeBrand !== "all" ? BRAND_LABELS[activeBrand]?.[locale] || activeBrand : null;
  const activeMaterialLabel =
    activeMaterial !== "all" ? MATERIAL_LABELS[activeMaterial]?.[locale] || activeMaterial : null;
  const activeSpecLabel =
    activeSpec !== "all" ? SPEC_LABELS[activeSpec]?.[locale] || activeSpec : null;
  const hasActiveFilters =
    activeBrand !== "all" ||
    activeLine !== "all" ||
    activeModel !== "all" ||
    activeBody !== "all" ||
    activeMaterial !== "all" ||
    activeSpec !== "all" ||
    searchQuery.trim().length > 0 ||
    sortOrder !== "default";

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
            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-[#c29d59] ml-1" />}
          </button>
          <p className="text-white/40 text-xs tracking-wide">
            {filteredProducts.length} {isUa ? "з" : "of"} {totalCount}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
          <aside
            id="ipe-mobile-filters"
            className={`shrink-0 transition-transform duration-300 ${
              mobileFilterOpen
                ? "fixed inset-y-0 left-0 z-50 block w-[88vw] max-w-[360px]"
                : "hidden lg:block w-full lg:w-[260px] xl:w-[280px]"
            }`}
          >
            <div
              className={`${
                mobileFilterOpen
                  ? "flex min-h-full flex-col gap-8 overflow-y-auto border-r border-white/10 bg-zinc-950 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
                  : "lg:sticky lg:top-[104px] lg:max-h-[calc(100vh-124px)] lg:overflow-y-auto flex flex-col gap-5 bg-zinc-950/95 border border-white/8 p-5 rounded-[2px] shadow-[0_18px_55px_rgba(0,0,0,0.38)] [scrollbar-color:rgba(194,157,89,0.35)_transparent] scrollbar-thin"
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
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-light tracking-widest uppercase text-white">
                    {isUa ? "Каталог" : "Catalog"}
                  </h2>
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                    {filteredProducts.length} {isUa ? "з" : "of"} {totalCount}{" "}
                    {isUa ? "компонентів" : "components"}
                  </p>
                </div>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c29d59]/80 transition-colors hover:text-[#f1d8a5]"
                  >
                    {isUa ? "Скинути" : "Reset"}
                  </button>
                )}
              </div>

              {hasActiveFilters && (
                <div className="flex flex-wrap gap-2">
                  {activeBrandLabel && (
                    <ActiveFilterChip
                      label={activeBrandLabel}
                      onClear={() => setActiveBrand("all")}
                    />
                  )}
                  {activeLine !== "all" && (
                    <ActiveFilterChip label={activeLine} onClear={() => setActiveLine("all")} />
                  )}
                  {activeModel !== "all" && (
                    <ActiveFilterChip label={activeModel} onClear={() => setActiveModel("all")} />
                  )}
                  {activeBody !== "all" && (
                    <ActiveFilterChip label={activeBody} onClear={() => setActiveBody("all")} />
                  )}
                  {activeMaterialLabel && (
                    <ActiveFilterChip
                      label={activeMaterialLabel}
                      onClear={() => setActiveMaterial("all")}
                    />
                  )}
                  {activeSpecLabel && (
                    <ActiveFilterChip
                      label={activeSpecLabel}
                      onClear={() => setActiveSpec("all")}
                    />
                  )}
                  {searchQuery.trim() && (
                    <ActiveFilterChip
                      label={searchQuery.trim()}
                      onClear={() => setSearchQuery("")}
                    />
                  )}
                </div>
              )}

              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isUa ? "Пошук систем..." : "Search exhausts..."}
                  className="w-full rounded-[2px] border border-white/10 bg-black/80 py-3 pl-11 pr-4 text-sm text-white placeholder-white/30 transition-colors focus:border-[#c29d59]/50 focus:outline-hidden"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <FilterSection
                title={isUa ? "Марка" : "Brand"}
                count={availableBrands.length}
                isOpen={openSections.brand}
                onToggle={() => toggleSection("brand")}
              >
                <ul className={FILTER_LIST_SCROLL_CLASS}>
                  <li>
                    <button
                      type="button"
                      onClick={() => setActiveBrand("all")}
                      className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-[2px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                        activeBrand === "all"
                          ? "bg-white/6 text-white"
                          : "text-white/50 hover:bg-white/3 hover:text-[#c29d59]"
                      }`}
                    >
                      <span>{isUa ? "Всі марки" : "All Brands"}</span>
                      {activeBrand === "all" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#c29d59]"></span>
                      )}
                    </button>
                  </li>
                  {availableBrands.map((brand) => (
                    <li key={brand.key}>
                      <button
                        type="button"
                        onClick={() => setActiveBrand(brand.key)}
                        className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-[2px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                          activeBrand === brand.key
                            ? "bg-[#c29d59]/10 text-white"
                            : "text-white/50 hover:bg-white/3 hover:text-[#c29d59]"
                        }`}
                      >
                        <span>{brand.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-zinc-600">{brand.count}</span>
                          {activeBrand === brand.key && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#c29d59]"></span>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </FilterSection>

              {activeBrand !== "all" && availableLines.length > 0 && (
                <FilterSection
                  title={isUa ? "Продукція" : "Product Line"}
                  count={availableLines.length}
                  isOpen={openSections.line}
                  onToggle={() => toggleSection("line")}
                >
                  <ul className={FILTER_LIST_SCROLL_CLASS}>
                    <li>
                      <button
                        type="button"
                        onClick={() => setActiveLine("all")}
                        className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-[2px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                          activeLine === "all"
                            ? "bg-white/6 text-[#c29d59]"
                            : "text-white/42 hover:bg-white/3 hover:text-[#c29d59]"
                        }`}
                      >
                        {isUa ? "Всі" : "All Lines"}
                      </button>
                    </li>
                    {availableLines.map((line) => (
                      <li key={line.key}>
                        <button
                          type="button"
                          onClick={() => setActiveLine(line.key)}
                          className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-[2px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                            activeLine === line.key
                              ? "bg-[#c29d59]/10 text-[#c29d59]"
                              : "text-white/42 hover:bg-white/3 hover:text-[#c29d59]"
                          }`}
                        >
                          <span>{line.label}</span>
                          <span className="text-[10px] opacity-60 text-zinc-500">{line.count}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </FilterSection>
              )}

              {activeBrand !== "all" && availableModels.length > 0 && (
                <FilterSection
                  title={isUa ? "Модель" : "Vehicle Model"}
                  count={availableModels.length}
                  isOpen={openSections.model}
                  onToggle={() => toggleSection("model")}
                >
                  {availableModels.length > 8 && (
                    <div className="relative mb-2">
                      <Search
                        size={12}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25"
                      />
                      <input
                        type="text"
                        value={modelQuery}
                        onChange={(event) => setModelQuery(event.target.value)}
                        placeholder={isUa ? "Пошук моделі" : "Find model"}
                        className="w-full rounded-[2px] border border-white/8 bg-black/55 py-2 pl-9 pr-3 text-xs text-white placeholder-white/25 transition-colors focus:border-[#c29d59]/45 focus:outline-hidden"
                      />
                    </div>
                  )}
                  <ul className={FILTER_LIST_SCROLL_CLASS}>
                    <li>
                      <button
                        type="button"
                        onClick={() => setActiveModel("all")}
                        className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-[2px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-widest transition-colors ${
                          activeModel === "all"
                            ? "bg-white/6 text-[#c29d59]"
                            : "text-white/42 hover:bg-white/3 hover:text-[#c29d59]"
                        }`}
                      >
                        <span>{isUa ? "Всі моделі" : "All Models"}</span>
                      </button>
                    </li>
                    {visibleModels.map((model) => (
                      <li key={model.key}>
                        <button
                          type="button"
                          onClick={() => setActiveModel(model.key)}
                          className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-[2px] px-3 py-2 text-left text-[11px] font-medium tracking-[0.02em] transition-colors ${
                            activeModel === model.key
                              ? "bg-[#c29d59]/10 text-[#c29d59]"
                              : "text-white/42 hover:bg-white/3 hover:text-[#c29d59]"
                          }`}
                        >
                          <span className="pr-3">{model.label}</span>
                          <span className="text-[10px] opacity-60 text-zinc-500">
                            {model.count}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </FilterSection>
              )}

              {activeModel !== "all" && availableBodies.length > 0 && (
                <FilterSection
                  title={isUa ? "Кузов" : "Body"}
                  count={availableBodies.length}
                  isOpen={openSections.body}
                  onToggle={() => toggleSection("body")}
                >
                  <ul className={FILTER_LIST_SCROLL_CLASS}>
                    <li>
                      <button
                        type="button"
                        onClick={() => setActiveBody("all")}
                        className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-[2px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                          activeBody === "all"
                            ? "bg-white/6 text-[#c29d59]"
                            : "text-white/42 hover:bg-white/3 hover:text-[#c29d59]"
                        }`}
                      >
                        <span>{isUa ? "Усі кузови" : "All bodies"}</span>
                      </button>
                    </li>
                    {availableBodies.map((body) => (
                      <li key={body.key}>
                        <button
                          type="button"
                          onClick={() => setActiveBody(body.key)}
                          className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-[2px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-widest transition-colors ${
                            activeBody === body.key
                              ? "bg-[#c29d59]/10 text-[#c29d59]"
                              : "text-white/42 hover:bg-white/3 hover:text-[#c29d59]"
                          }`}
                        >
                          <span>{body.label}</span>
                          <span className="text-[10px] opacity-60 text-zinc-500">{body.count}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </FilterSection>
              )}

              {activeBrand !== "all" && availableMaterials.length > 0 && (
                <FilterSection
                  title={isUa ? "Матеріал" : "Material"}
                  count={availableMaterials.length}
                  isOpen={openSections.material}
                  onToggle={() => toggleSection("material")}
                >
                  <ul className={FILTER_LIST_SCROLL_CLASS}>
                    <li>
                      <button
                        type="button"
                        onClick={() => setActiveMaterial("all")}
                        className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-[2px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                          activeMaterial === "all"
                            ? "bg-white/6 text-[#c29d59]"
                            : "text-white/42 hover:bg-white/3 hover:text-[#c29d59]"
                        }`}
                      >
                        <span>{isUa ? "Усі" : "All"}</span>
                      </button>
                    </li>
                    {availableMaterials.map((material) => (
                      <li key={material.key}>
                        <button
                          type="button"
                          onClick={() => setActiveMaterial(material.key)}
                          className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-[2px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                            activeMaterial === material.key
                              ? "bg-[#c29d59]/10 text-[#c29d59]"
                              : "text-white/42 hover:bg-white/3 hover:text-[#c29d59]"
                          }`}
                        >
                          <span>{material.label}</span>
                          <span className="text-[10px] opacity-60 text-zinc-500">
                            {material.count}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </FilterSection>
              )}

              {activeBrand !== "all" && availableSpecs.length > 0 && (
                <FilterSection
                  title={isUa ? "Конфігурація" : "Configuration"}
                  count={availableSpecs.length}
                  isOpen={openSections.spec}
                  onToggle={() => toggleSection("spec")}
                >
                  <ul className={FILTER_LIST_SCROLL_CLASS}>
                    <li>
                      <button
                        type="button"
                        onClick={() => setActiveSpec("all")}
                        className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-[2px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                          activeSpec === "all"
                            ? "bg-white/6 text-[#c29d59]"
                            : "text-white/42 hover:bg-white/3 hover:text-[#c29d59]"
                        }`}
                      >
                        <span>{isUa ? "Усі" : "All"}</span>
                      </button>
                    </li>
                    {availableSpecs.map((spec) => (
                      <li key={spec.key}>
                        <button
                          type="button"
                          onClick={() => setActiveSpec(spec.key)}
                          className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-[2px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                            activeSpec === spec.key
                              ? "bg-[#c29d59]/10 text-[#c29d59]"
                              : "text-white/42 hover:bg-white/3 hover:text-[#c29d59]"
                          }`}
                        >
                          <span>{spec.label}</span>
                          <span className="text-[10px] opacity-60 text-zinc-500">{spec.count}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </FilterSection>
              )}
            </div>
          </aside>

          {mobileFilterOpen && (
            <div className="lg:hidden fixed inset-0 z-40 bg-black/80" onClick={closeMobileFilter} />
          )}

          <main className="flex-1 min-w-0">
            <div className="flex justify-end mb-6 z-20 relative">
              <div className="relative inline-block">
                <select
                  value={sortOrder}
                  onChange={(e) =>
                    setSortOrder(e.target.value as "default" | "price_desc" | "price_asc")
                  }
                  className="appearance-none bg-zinc-900 border border-white/5 text-white text-[10px] uppercase tracking-[0.2em] font-semibold px-5 py-3 pr-10 rounded-none outline-hidden focus:border-white/20 transition-colors shadow-none cursor-pointer"
                >
                  <option value="default">{isUa ? "За замовчуванням" : "Default"}</option>
                  <option value="price_desc">
                    {isUa ? "Ціна: Від найбільшої" : "Price: High to Low"}
                  </option>
                  <option value="price_asc">
                    {isUa ? "Ціна: Від найменшої" : "Price: Low to High"}
                  </option>
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
                    ? isUa
                      ? `Нічого не знайдено за запитом "${searchQuery}"`
                      : `No results for "${searchQuery}"`
                    : isUa
                      ? "Каталог iPE наразі оновлюється."
                      : "The iPE catalog is currently being updated."}
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-8 py-3 bg-[#c29d59] text-black text-[10px] uppercase tracking-widest hover:bg-white transition-all duration-300 font-bold"
                >
                  {isUa ? "Скинути фільтри" : "Reset Filters"}
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-1">
                  {displayedProducts.map((product) => {
                    const pricing = viewerContext
                      ? resolveShopProductPricing(product, viewerContext)
                      : {
                          effectivePrice: product.price,
                          effectiveCompareAt: product.compareAt,
                          audience: "b2c",
                          b2bVisible: false,
                        };

                    const computed = computePricesFromUsd(
                      pricing.effectivePrice,
                      rates && { EUR: rates.EUR, USD: rates.USD, UAH: rates.UAH }
                    );

                    const productTitle = localizeShopProductTitle(locale, product);
                    const productImage =
                      product.image || "/images/placeholders/product-fallback.jpg";

                    return (
                      <article
                        key={product.slug}
                        className="group relative bg-[#060606] overflow-hidden flex flex-col hover:bg-[#0a0a0a] transition-all duration-500 border border-white/5 hover:border-white/10"
                      >
                        <Link
                          href={`${productPathPrefix}/${product.slug}`}
                          className="flex flex-col grow z-10"
                        >
                          <div className="relative aspect-square sm:aspect-4/3 bg-black overflow-hidden flex items-center justify-center p-3 sm:p-8 border-b border-white/2">
                            <ShopProductImage
                              src={productImage}
                              alt={productTitle}
                              fill
                              sizes="(max-width: 768px) 100vw, 33vw"
                              fallbackSrc="/images/placeholders/product-fallback.jpg"
                              unoptimized={shouldBypassImageOptimization(productImage)}
                              className="object-contain p-2 sm:p-6 md:p-8 opacity-80 group-hover:opacity-100 transition-all duration-700 ease-out group-hover:scale-105"
                            />
                          </div>

                          <div className="px-3 pb-3 pt-3 sm:px-6 sm:pb-6 sm:pt-5 flex flex-col grow">
                            <p className="text-[8px] sm:text-[9px] uppercase tracking-[0.14em] sm:tracking-[0.2em] font-medium text-[#c29d59] mb-2">
                              {product.brand}
                            </p>
                            <h3 className="text-[11px] sm:text-sm font-light leading-snug text-zinc-300 group-hover:text-white transition-colors line-clamp-3 sm:line-clamp-2 mb-3 sm:mb-4">
                              {productTitle}
                            </h3>

                            <div className="mt-auto">
                              {computed.usd === 0 && computed.eur === 0 ? (
                                <span className="text-[9px] sm:text-[11px] tracking-wider uppercase font-medium text-zinc-600">
                                  {isUa ? "Ціна за запитом" : "Price on Request"}
                                </span>
                              ) : (
                                <span className="text-[11px] sm:text-sm tracking-wider sm:tracking-widest font-medium text-white">
                                  {currency === "USD" && formatPrice(locale, computed.usd, "USD")}
                                  {currency === "EUR" && formatPrice(locale, computed.eur, "EUR")}
                                  {currency === "UAH" && formatPrice(locale, computed.uah, "UAH")}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>

                        {/* Bottom Actions: View + Add To Cart */}
                        <div className="px-3 pb-3 pt-0 sm:px-6 sm:pb-6 z-20 relative flex gap-2 sm:gap-3">
                          <Link
                            href={`${productPathPrefix}/${product.slug}`}
                            className="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 sm:py-3 border border-[#c29d59]/30 text-[9px] sm:text-[10px] tracking-widest sm:tracking-[0.3em] uppercase font-light text-[#c29d59] hover:text-black hover:bg-[#c29d59] hover:border-[#c29d59] transition-all duration-300 rounded-[2px]"
                          >
                            {isUa ? "Деталі" : "View"}
                            <ArrowRight
                              size={11}
                              strokeWidth={2}
                              className="hidden min-[390px]:block"
                            />
                          </Link>
                          <AddToCartButton
                            slug={product.slug}
                            variantId={null}
                            locale={locale}
                            redirect={true}
                            productName={productTitle}
                            label={isUa ? "КОШИК" : "CART"}
                            labelAdded={isUa ? "✓" : "✓"}
                            className="flex-1 min-w-0 flex items-center justify-center py-2 sm:py-3 border border-white/10 text-[9px] sm:text-[10px] tracking-widest sm:tracking-[0.3em] uppercase font-light text-white hover:text-black hover:bg-white hover:border-white transition-all duration-300 rounded-[2px]"
                            variant="inline"
                          />
                        </div>
                      </article>
                    );
                  })}
                </div>
                {visibleCount < filteredProducts.length ? (
                  <div className="mt-8 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
                      className="rounded-full border border-[#c29d59]/35 bg-[#c29d59]/10 px-7 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f1d8a5] transition hover:border-[#c29d59]/70 hover:bg-[#c29d59]/18"
                    >
                      {isUa ? "Показати ще" : "Show more"} ({filteredProducts.length - visibleCount}
                      )
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </main>
        </div>
      </div>
    </section>
  );
}
