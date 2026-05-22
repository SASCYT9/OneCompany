"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, Filter, Info, Search, SlidersHorizontal, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct } from "@/lib/shopCatalog";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { ILMBERGER_MOCK_PRODUCTS } from "../data/ilmbergerHomeData";
import IlmbergerBikePicker from "./IlmbergerBikePicker";
import IlmbergerSpotlightCard from "./IlmbergerSpotlightCard";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import { ShopCardPriceTag } from "@/components/shop/ShopCardPriceTag";
import { useShopViewerContext } from "@/lib/useShopViewerContext";

function formatPrice(locale: SupportedLocale, amount: number, currency: "EUR" | "USD" | "UAH") {
  const formatter = new Intl.NumberFormat(locale === "ua" ? "uk-UA" : "en-US", {
    maximumFractionDigits: 0,
  });
  const formatted = formatter.format(amount);
  if (locale === "ua" && currency === "UAH") return `${formatted} грн`;
  return locale === "ua" ? `${formatted} ${currency}` : `${currency} ${formatted}`;
}

type Props = {
  locale: SupportedLocale;
  products: ShopProduct[];
  viewerContext?: ShopViewerPricingContext;
};

// Only manufacturers with actual products in DB. Aprilia/Yamaha/Honda/Kawasaki
// dropped — they have 0 products as of 2026-05.
const MANUFACTURERS: Record<string, string[]> = {
  "BMW Motorrad": ["S 1000 RR", "M 1000 RR", "S 1000 R", "M 1000 R", "S 1000 XR", "M 1000 XR"],
  Ducati: ["Panigale V4", "Streetfighter V4", "Diavel V4", "Diavel 1260", "XDiavel"],
};

const CATEGORIES = [
  { id: "all", labelEn: "All", labelUa: "Усі" },
  { id: "fairings", labelEn: "Fairings", labelUa: "Обтічники" },
  { id: "tank-covers", labelEn: "Tank Covers", labelUa: "Накладки на бак" },
  { id: "fenders", labelEn: "Fenders", labelUa: "Крила" },
  { id: "frame-protection", labelEn: "Frame Protection", labelUa: "Захист рами" },
  { id: "wheel-covers", labelEn: "Wheel Covers", labelUa: "Захист колеса" },
  { id: "cockpit", labelEn: "Cockpit", labelUa: "Кокпіт" },
  // New categories added 2026-05 to cover the 122 "other"-tagged products
  // (exhaust covers, engine covers, air intakes, seats, headlights, etc.)
  { id: "exhaust", labelEn: "Exhaust", labelUa: "Вихлоп" },
  { id: "engine", labelEn: "Engine Covers", labelUa: "Накладки двигуна" },
  { id: "air-intake", labelEn: "Air Intake", labelUa: "Повітрозабірник" },
  { id: "seats", labelEn: "Seats", labelUa: "Сидіння" },
  { id: "lighting", labelEn: "Headlight & Windshield", labelUa: "Фара та вітрове скло" },
];

const SORT_OPTIONS = [
  { id: "default", labelEn: "Featured", labelUa: "За замовчуванням" },
  { id: "price-asc", labelEn: "Price: Low to High", labelUa: "Ціна: за зростанням" },
  { id: "price-desc", labelEn: "Price: High to Low", labelUa: "Ціна: за спаданням" },
  { id: "name", labelEn: "Name", labelUa: "Назва" },
];

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

export default function IlmbergerCatalog({
  locale,
  products,
  viewerContext: ssrViewerContext,
}: Props) {
  const isUa = locale === "ua";
  const router = useRouter();
  const searchParams = useSearchParams();
  // Global currency toggle (€ / $ / ₴) — picks display currency + live FX rates
  const { currency, rates } = useShopCurrency();
  // Seed the client-side viewer context from SSR (anon) so the module-level
  // brand-discount cache primes; B2B users get dealer pricing post-hydration.
  useShopViewerContext(ssrViewerContext);

  const [manufacturer, setManufacturer] = useState(searchParams.get("manufacturer") ?? "all");
  const [model, setModel] = useState(searchParams.get("model") ?? "all");
  const [year, setYear] = useState(searchParams.get("year") ?? "all");
  const [category, setCategory] = useState(searchParams.get("category") ?? "all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("default");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const availableModels = useMemo(() => {
    if (manufacturer === "all") return [];
    return MANUFACTURERS[manufacturer] ?? [];
  }, [manufacturer]);

  const hasRealProducts = products.length > 0;
  const sourceList = hasRealProducts ? products : ILMBERGER_MOCK_PRODUCTS;

  // Live count per bike model — used by IlmbergerBikePicker to show
  // "X parts" badges on each bike card.
  const productCountByModel = useMemo(() => {
    const counts = new Map<string, number>();
    if (!hasRealProducts) return counts;
    for (const p of products) {
      for (const tag of p.tags ?? []) {
        if (typeof tag !== "string") continue;
        // Only count canonical bike-model tags (the ones we put on cards).
        if (
          /^(S 1000 (RR|R|XR)|M 1000 (RR|R|XR)|Panigale V4|Streetfighter V4|Diavel V4|Diavel 1260|XDiavel)$/.test(
            tag
          )
        ) {
          counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
      }
    }
    return counts;
  }, [products, hasRealProducts]);

  // Years available — extracted dynamically from categoryEn / categoryUa
  // (formatted as "BMW S 1000 RR (MY 2019)"). Auto-narrows when manufacturer
  // or model is selected so the dropdown only shows years that actually
  // have products for the current filter context.
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    const brandKey = manufacturer !== "all" ? manufacturer.toLowerCase().split(" ")[0] : null;
    for (const p of sourceList) {
      const text = (() => {
        if (!hasRealProducts) {
          return [(p as any).title, (p as any).titleUk, (p as any).category, (p as any).fitment]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
        }
        const prod = p as ShopProduct;
        return [
          prod.title?.en,
          prod.title?.ua,
          prod.category?.en,
          prod.category?.ua,
          ...(prod.tags ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
      })();
      // Narrow by current marque/model context so the year list reflects what's reachable.
      if (brandKey && !text.includes(brandKey)) continue;
      // Model narrowing uses exact tag match (substring would alias S 1000 R into S 1000 RR).
      if (model !== "all" && hasRealProducts) {
        const tags = ((p as ShopProduct).tags ?? []) as string[];
        if (!tags.includes(model)) continue;
      }
      // Match "MY 2019" pattern AND legacy "'16" pattern (XDiavel etc.)
      const myMatches = text.match(/my\s+(20\d{2})/g);
      myMatches?.forEach((m) => years.add(m.replace(/my\s+/i, "")));
      const shortYearMatches = text.match(/'(\d{2})\b/g);
      shortYearMatches?.forEach((m) => {
        const yy = m.replace(/^'/, "");
        const yyyy = parseInt(yy, 10) > 50 ? `19${yy}` : `20${yy}`;
        years.add(yyyy);
      });
    }
    return Array.from(years).sort();
  }, [sourceList, hasRealProducts, manufacturer, model]);

  // Real-time grid sorting & filtering
  // Helpers — normalize searchable text across mock + real ShopProduct shapes
  const getSearchableText = (p: any): string => {
    if (!hasRealProducts) {
      return [p.title, p.titleUk, p.fitment, p.fitmentUk, p.category, p.categoryUk, p.sku]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    }
    const prod = p as ShopProduct;
    return [
      prod.title?.en,
      prod.title?.ua,
      prod.category?.en,
      prod.category?.ua,
      prod.sku,
      ...(prod.tags ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  };

  const getPriceNumeric = (p: any): number => {
    if (!hasRealProducts && p.priceFrom) {
      return parseInt(String(p.priceFrom).replace(/[^0-9]/g, "")) || 0;
    }
    return Number((p as ShopProduct).price?.eur ?? 0);
  };

  const filteredProducts = useMemo(() => {
    let list = [...sourceList];

    // Filter by manufacturer (BMW Motorrad / Ducati / etc.) — match against
    // full searchable text. "BMW Motorrad" also matches "BMW S 1000 RR" etc.
    if (manufacturer !== "all") {
      // Take just the brand keyword: "BMW Motorrad" → "bmw"
      const brandKey = manufacturer.toLowerCase().split(" ")[0];
      list = list.filter((p) => getSearchableText(p).includes(brandKey));
    }

    // Filter by model — exact tag match against canonical bike-model tags
    // (set at import time). Substring matching on searchableText falsely
    // captures "S 1000 RR" when filtering for "S 1000 R" (prefix overlap),
    // and similarly for M 1000 R vs M 1000 RR.
    if (model !== "all") {
      list = list.filter((p) => {
        if (!hasRealProducts) {
          // Mock products don't have a tags array — keep substring fallback.
          const t = getSearchableText(p);
          const modelNoSpace = model.toLowerCase().replace(/\s+/g, "");
          return t.includes(model.toLowerCase()) || t.replace(/\s+/g, "").includes(modelNoSpace);
        }
        return ((p as ShopProduct).tags ?? []).includes(model);
      });
    }

    // Filter by year — match the "MY YYYY" anchor we put in categoryEn/Ua
    // at import time (e.g. "BMW S 1000 RR (MY 2019)"), OR the short-year
    // pattern XDiavel uses ('16 → 2016, '19 → 2019).
    if (year !== "all") {
      const yy = year.slice(2); // "2016" → "16"
      list = list.filter((p) => {
        const text = getSearchableText(p);
        return text.includes(`my ${year}`) || text.includes(`'${yy}`);
      });
    }

    // Filter by category (fairings / tank-covers / fenders / etc.)
    // For real products the category id is stored in `tags` (we wrote it
    // there at import time) and also exists as `productCategory`-like substring.
    if (category !== "all") {
      list = list.filter((p) => getSearchableText(p).includes(category.toLowerCase()));
    }

    // Filter by search query — same text bag
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => getSearchableText(p).includes(q));
    }

    // Apply sorting
    if (sort === "price-asc") {
      list.sort((a, b) => getPriceNumeric(a) - getPriceNumeric(b));
    } else if (sort === "price-desc") {
      list.sort((a, b) => getPriceNumeric(b) - getPriceNumeric(a));
    } else if (sort === "name") {
      list.sort((a, b) => {
        const nameA = hasRealProducts
          ? ((a as ShopProduct).title?.[isUa ? "ua" : "en"] ?? "")
          : ((a as any).title ?? "");
        const nameB = hasRealProducts
          ? ((b as ShopProduct).title?.[isUa ? "ua" : "en"] ?? "")
          : ((b as any).title ?? "");
        return nameA.localeCompare(nameB);
      });
    }

    return list;
  }, [sourceList, manufacturer, model, year, category, search, sort, hasRealProducts, isUa]);

  const resetFilters = () => {
    setManufacturer("all");
    setModel("all");
    setYear("all");
    setCategory("all");
    setSearch("");
    setSort("default");
    router.replace(`/${locale}/shop/ilmberger/collections`);
  };

  const hasActiveFilters =
    manufacturer !== "all" ||
    model !== "all" ||
    year !== "all" ||
    category !== "all" ||
    search.length > 0;

  return (
    <div className="il-home il-catalog min-h-screen bg-[var(--il-bg)] text-[var(--il-white)] font-sans selection:bg-[var(--il-chrome)] selection:text-[var(--il-bg)] overflow-hidden">
      {/* ════════════════════════════════════════════════════════════════
          CINEMATIC BRAND HEADER (THEMED)
      ════════════════════════════════════════════════════════════════ */}
      <header className="relative min-h-[320px] overflow-hidden flex items-end p-8 border-b border-[var(--il-faint)] bg-[var(--il-bg)]">
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/shop/ilmberger/products/gallery-06-winglet-mounted.jpg"
            alt=""
            className="w-full h-full object-cover object-center filter blur-[4px] grayscale"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--il-bg)] via-[var(--il-bg)]/60 to-transparent" />
        </div>
        <div className="relative z-10 w-full max-w-7xl mx-auto">
          <nav
            className="flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase text-[var(--il-titanium)] mb-3"
            aria-label="breadcrumb"
          >
            <Link
              href={`/${locale}/shop`}
              className="hover:text-[var(--il-white)] transition-colors"
            >
              {L(isUa, "Shops", "Магазини")}
            </Link>
            <span aria-hidden className="opacity-40">
              ·
            </span>
            <Link
              href={`/${locale}/shop/ilmberger`}
              className="hover:text-[var(--il-white)] transition-colors"
            >
              Ilmberger
            </Link>
            <span aria-hidden className="opacity-40">
              ·
            </span>
            <span className="text-[var(--il-muted)]">{L(isUa, "Catalog", "Каталог")}</span>
          </nav>

          <h1 className="text-3xl md:text-5xl font-extralight tracking-wider uppercase text-[var(--il-white)] mb-3">
            {L(isUa, "Ilmberger Catalog", "Каталог Ilmberger")}
          </h1>
          <p className="text-sm font-light text-[var(--il-muted)] max-w-xl leading-relaxed">
            {L(
              isUa,
              `${products.length} carbon parts for BMW S 1000 RR / M 1000 RR`,
              `${products.length} деталей для BMW S 1000 RR / M 1000 RR`
            )}
          </p>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════════
          STEP 1 — BIKE PICKER
          Shows always at the top; clicking a bike sets manufacturer+model
          and smooth-scrolls to the catalog anchor below.
      ════════════════════════════════════════════════════════════════ */}
      <IlmbergerBikePicker
        locale={locale}
        productCountByModel={productCountByModel}
        onPick={(mfr, mdl) => {
          setManufacturer(mfr);
          setModel(mdl);
          setYear("all");
        }}
      />

      {/* Anchor — IlmbergerBikePicker scrolls here on bike click */}
      <div data-il-anchor="catalog" aria-hidden />

      {/* ════════════════════════════════════════════════════════════════
          QUICK CATEGORY CHIPS
      ════════════════════════════════════════════════════════════════ */}
      <div className="bg-[var(--il-bg)]/80 border-b border-[var(--il-faint)] sticky top-0 z-30 backdrop-blur-md">
        <div className="relative max-w-7xl mx-auto">
          {/* 11 categories — wrap onto multiple rows so all are visible without
              horizontal scroll. Smaller padding/font on mobile to fit more
              per row. */}
          <div className="px-4 md:px-8 py-3 flex flex-wrap gap-1.5 md:gap-2" role="tablist">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`px-3 md:px-5 py-1.5 md:py-2 text-[9px] md:text-[10px] font-semibold tracking-widest uppercase rounded-sm border transition-all duration-300 ${
                  category === cat.id
                    ? "bg-[var(--il-white)] text-[var(--il-bg)] border-[var(--il-white)] shadow-lg shadow-black/5"
                    : "bg-[var(--il-bg-soft)]/50 text-[var(--il-muted)] border-[var(--il-faint)] hover:text-[var(--il-white)] hover:border-[var(--il-titanium)]"
                }`}
                onClick={() => setCategory(cat.id)}
                role="tab"
                aria-selected={category === cat.id}
              >
                {L(isUa, cat.labelEn, cat.labelUa)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          CATALOG STOREFRONT LAYOUT
      ════════════════════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        {/* ── Filter Sidebar (Themed) ── */}
        <aside
          className={`lg:sticky lg:top-[120px] self-start flex flex-col gap-6 p-6 bg-[var(--il-bg-soft)]/50 border border-[var(--il-faint)] rounded-sm max-h-[calc(100vh-140px)] overflow-y-auto ${
            mobileFilterOpen
              ? "fixed inset-0 z-50 bg-[var(--il-bg)] border-0 rounded-none max-h-screen translate-x-0"
              : "hidden lg:flex"
          }`}
          aria-label={L(isUa, "Filters", "Фільтри")}
        >
          <div className="flex items-center justify-between pb-3 border-b border-[var(--il-faint)]">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--il-white)]">
              <SlidersHorizontal size={14} className="text-[var(--il-muted)]" />{" "}
              {L(isUa, "Store Filters", "Фільтри магазину")}
            </h2>
            {mobileFilterOpen && (
              <button
                type="button"
                className="p-1.5 hover:bg-[var(--il-faint)] rounded text-[var(--il-muted)] hover:text-[var(--il-white)] transition-colors"
                onClick={() => setMobileFilterOpen(false)}
                aria-label={L(isUa, "Close filters", "Закрити фільтри")}
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Make Filter */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--il-titanium)]">
              {L(isUa, "Manufacturer", "Марка")}
            </label>
            <div className="relative">
              <select
                className="il-filter__field w-full h-11"
                value={manufacturer}
                onChange={(e) => {
                  setManufacturer(e.target.value);
                  setModel("all");
                }}
              >
                <option value="all">{L(isUa, "All Manufacturers", "Усі марки")}</option>
                {Object.keys(MANUFACTURERS).map((mfr) => (
                  <option key={mfr} value={mfr}>
                    {mfr}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--il-muted)] text-[10px]">
                ▼
              </div>
            </div>
          </div>

          {/* Model Filter */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--il-titanium)]">
              {L(isUa, "Model Fitment", "Модель байка")}
            </label>
            <div className="relative">
              <select
                className="il-filter__field w-full h-11 disabled:opacity-40 disabled:cursor-not-allowed"
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  setYear("all"); // reset year — narrowing context changes available years
                }}
                disabled={manufacturer === "all"}
              >
                <option value="all">
                  {manufacturer === "all"
                    ? L(isUa, "Select manufacturer first", "Оберіть марку спочатку")
                    : L(isUa, "All Models", "Усі моделі")}
                </option>
                {availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--il-muted)] text-[10px]">
                ▼
              </div>
            </div>
          </div>

          {/* Year Filter */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--il-titanium)]">
              {L(isUa, "Model Year", "Рік моделі")}
            </label>
            <div className="relative">
              <select
                className="il-filter__field w-full h-11 disabled:opacity-40 disabled:cursor-not-allowed"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                disabled={availableYears.length === 0}
              >
                <option value="all">{L(isUa, "All Years", "Усі роки")}</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    MY {y}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--il-muted)] text-[10px]">
                ▼
              </div>
            </div>
          </div>

          {/* Text search */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--il-titanium)]">
              {L(isUa, "Product Search", "Пошук товарів")}
            </label>
            <div className="relative">
              <Search
                size={14}
                aria-hidden
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--il-muted)] pointer-events-none"
              />
              <input
                type="search"
                className="il-filter__field w-full h-11 pl-10"
                placeholder={L(isUa, "SKU, name, or keywords...", "SKU, назва або серія...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              className="mt-2 h-10 w-full border border-[var(--il-faint)] bg-[var(--il-bg-soft)] hover:bg-[var(--il-bg)] hover:border-[var(--il-chrome)] rounded text-[10px] font-bold uppercase tracking-widest text-[var(--il-titanium)] hover:text-[var(--il-white)] transition-all"
              onClick={resetFilters}
            >
              {L(isUa, "Reset all filters", "Очистити фільтри")}
            </button>
          )}

          {/* Quick FAQ / Assistance Panel */}
          <div className="mt-auto pt-6 border-t border-[var(--il-faint)] text-[11px] text-[var(--il-titanium)] leading-relaxed">
            <p className="mb-3">
              {L(
                isUa,
                "Every panel is autoclaved for maximum fiber-to-resin ratio, yielding up to 50% weight savings over OEM ABS plastics.",
                "Кожна деталь запікається в автоклаві під високим тиском, гарантуючи міцність та економію ваги до 50% у порівнянні з OEM-пластиком."
              )}
            </p>
            <Link
              href={`/${locale}/contact`}
              className="text-[var(--il-white)] hover:underline underline-offset-4 font-semibold uppercase tracking-wider text-[10px] inline-flex items-center gap-1"
            >
              {L(isUa, "Direct Atelier Request", "Прямий запит на фабрику")} →
            </Link>
          </div>
        </aside>

        {/* ── Main Catalog Grid ── */}
        <main className="min-w-0">
          {!hasRealProducts && (
            <div className="flex items-center gap-3 p-4 bg-[var(--il-bg-soft)]/80 border border-[var(--il-faint)] rounded mb-6 text-xs text-[var(--il-muted)]">
              <Info size={16} className="text-[var(--il-titanium)] flex-shrink-0" />
              <span>
                <strong className="text-[var(--il-white)]">
                  {L(isUa, "Reference Showcase.", "Демонстраційний каталог.")}
                </strong>{" "}
                {L(
                  isUa,
                  "Showing curated prepreg parts catalog. Price points are estimated base rates. Click any card to launch the interactive inquiry workflow.",
                  "Відображається підготовлений каталог препрег-деталей. Натисніть на будь-яку картку, щоб відкрити інтерактивний запит."
                )}
              </span>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-[var(--il-faint)] mb-6">
            <button
              type="button"
              className="lg:hidden flex items-center gap-2 h-9 px-4 bg-[var(--il-bg-soft)] border border-[var(--il-faint)] rounded text-xs font-semibold uppercase tracking-wider text-[var(--il-white)]"
              onClick={() => setMobileFilterOpen(true)}
            >
              <Filter size={13} /> {L(isUa, "Filters", "Фільтри")}
            </button>

            <div className="text-[11px] uppercase tracking-widest text-[var(--il-titanium)]">
              {L(isUa, "Showing", "Знайдено")}:{" "}
              <strong className="text-[var(--il-white)] font-bold">
                {filteredProducts.length}
              </strong>{" "}
              {L(isUa, "specifications", "модифікацій")}
            </div>

            <div className="flex items-center gap-2 text-[var(--il-muted)]">
              <ArrowUpDown size={12} className="opacity-60" />
              <select
                className="il-filter__field h-9 px-3 !text-[10px] !font-semibold"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {L(isUa, opt.labelEn, opt.labelUa)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Fluid Product Grid */}
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredProducts.map((p, i) => {
                const isMock = !hasRealProducts;
                const sku = p.sku ?? "";
                const title = isMock
                  ? L(isUa, (p as any).title, (p as any).titleUk)
                  : L(
                      isUa,
                      (p as ShopProduct).title?.en ?? "",
                      (p as ShopProduct).title?.ua ?? (p as ShopProduct).title?.en ?? ""
                    );
                const fitment = isMock ? L(isUa, (p as any).fitment, (p as any).fitmentUk) : "";
                const cat = isMock
                  ? L(isUa, (p as any).category, (p as any).categoryUk)
                  : L(
                      isUa,
                      (p as ShopProduct).category?.en ?? "",
                      (p as ShopProduct).category?.ua ?? (p as ShopProduct).category?.en ?? ""
                    );
                // Pricing: mock keeps pre-formatted "from €389"; real
                // products route through `<ShopCardPriceTag/>` below for
                // B2B-discount awareness (RRP strikethrough + −% badge).
                const isMockPrice = isMock;
                const mockPriceFrom = isMockPrice ? ((p as any).priceFrom ?? "") : "";
                const image = isMock
                  ? (p as any).image
                  : ((p as ShopProduct).image ?? "/logos/ilmberger-carbon.webp");

                const productHref = isMock
                  ? `/${locale}/contact`
                  : `/${locale}/shop/ilmberger/products/${(p as ShopProduct).slug}`;

                return (
                  <motion.div
                    key={"id" in p ? (p as any).id : ((p as ShopProduct).slug ?? i)}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="group"
                  >
                    <IlmbergerSpotlightCard spotlightColor="var(--il-chrome)" intensity={0.15}>
                      <Link
                        href={productHref}
                        className="relative flex flex-col bg-[var(--il-bg-soft)]/40 border border-[var(--il-faint)] group-hover:border-[var(--il-chrome)]/40 rounded-sm overflow-hidden transition-all duration-500 cursor-pointer shadow-sm hover:shadow-xl hover:shadow-[var(--il-bg-soft)] no-underline"
                      >
                        {/* Media Display Container */}
                        <div className="relative aspect-[4/3] bg-gradient-to-b from-[var(--il-bg-soft)] to-[var(--il-bg)] overflow-hidden">
                          <div className="absolute top-3.5 left-3.5 z-10 text-[8px] font-bold uppercase tracking-[0.25em] px-2.5 py-1 bg-[var(--il-bg)]/85 border border-[var(--il-faint)] text-[var(--il-white)] rounded">
                            {isMock
                              ? L(isUa, "Prepreg", "Препрег")
                              : L(isUa, "In Stock", "В наявності")}
                          </div>

                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image}
                            alt={title}
                            className="w-full h-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105 filter brightness-[0.95] group-hover:brightness-100 contrast-[1.02]"
                            loading="lazy"
                          />

                          {sku && (
                            <span className="absolute bottom-3.5 right-3.5 text-[8px] text-[var(--il-muted)] bg-[var(--il-bg)]/60 backdrop-blur-sm px-2 py-0.5 rounded font-mono tracking-widest border border-[var(--il-faint)]">
                              {sku}
                            </span>
                          )}
                        </div>

                        {/* Product Info & Specs Reveal Panel */}
                        <div className="p-5 flex flex-col flex-1 gap-3 bg-[var(--il-bg)]/60">
                          <div>
                            {cat && (
                              <span className="block text-[8px] font-bold uppercase tracking-[0.25em] text-[var(--il-titanium)] mb-1">
                                {cat}
                              </span>
                            )}
                            <h3 className="text-sm font-medium text-[var(--il-white)] uppercase tracking-wide leading-snug line-clamp-2 min-h-[2.5rem]">
                              {title}
                            </h3>
                            {fitment && (
                              <p className="text-xs text-[var(--il-muted)] font-light mt-1 uppercase tracking-wider">
                                {fitment}
                              </p>
                            )}
                          </div>

                          {/* Card Footer Pricing / Action */}
                          <div className="flex items-center justify-between pt-3 border-t border-[var(--il-faint)] mt-auto">
                            <div>
                              <span className="block text-[8px] font-bold uppercase tracking-[0.2em] text-[var(--il-titanium)] mb-0.5">
                                {isMock
                                  ? L(isUa, "Atelier spec", "Специфікація")
                                  : L(isUa, "From", "Від")}
                              </span>
                              {isMockPrice ? (
                                <span className="text-xs font-semibold text-[var(--il-white)] tracking-wide">
                                  {mockPriceFrom || "—"}
                                </span>
                              ) : (
                                <ShopCardPriceTag
                                  locale={locale}
                                  b2cPrice={(p as ShopProduct).price}
                                  b2bExplicit={(p as ShopProduct).b2bPrice ?? null}
                                  compareAt={(p as ShopProduct).compareAt ?? null}
                                  brand={(p as ShopProduct).brand ?? null}
                                  variant="ultra-compact"
                                  classNames={{
                                    root: "flex items-baseline gap-1.5 flex-wrap",
                                    price:
                                      "text-xs font-semibold text-[var(--il-white)] tracking-wide tabular-nums",
                                    retail:
                                      "text-[9px] font-light line-through text-[var(--il-muted)]",
                                    badge:
                                      "inline-flex items-center rounded-sm bg-[var(--il-chrome)]/20 px-1 py-0 text-[8px] font-bold tracking-wider text-[var(--il-chrome)]",
                                  }}
                                  requestLabel="—"
                                />
                              )}
                            </div>

                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--il-muted)] group-hover:text-[var(--il-white)] flex items-center gap-1.5 transition-colors bg-[var(--il-bg-soft)] px-3 py-1.5 rounded-sm border border-[var(--il-faint)] group-hover:border-[var(--il-titanium)]">
                              {isMock
                                ? L(isUa, "Configure", "Конфігурувати")
                                : L(isUa, "Purchase", "Купити")}
                              <span className="group-hover:translate-x-1 transition-transform inline-block">
                                →
                              </span>
                            </span>
                          </div>
                        </div>
                      </Link>
                    </IlmbergerSpotlightCard>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-20 border border-dashed border-[var(--il-chrome)]/40 rounded-sm">
              <p className="text-[var(--il-muted)] font-light text-sm mb-4">
                {L(
                  isUa,
                  "No carbon specifications matching active filters.",
                  "Не знайдено деталей карбону для поточних фільтрів."
                )}
              </p>
              <button
                type="button"
                className="px-5 py-2.5 bg-[var(--il-bg-soft)] border border-[var(--il-faint)] hover:border-[var(--il-chrome)] rounded-sm text-[10px] font-bold uppercase tracking-widest text-[var(--il-titanium)] hover:text-[var(--il-white)] transition-all"
                onClick={resetFilters}
              >
                {L(isUa, "Reset all filters", "Очистити всі фільтри")}
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Inquiry drawer/modal removed — clicks on product cards now go to
          their dedicated PDP at /shop/ilmberger/products/{slug} via Next/Link.
          For users who need a custom build (variant request), the PDP itself
          can host that flow later — out of scope for catalog grid. */}
    </div>
  );
}
