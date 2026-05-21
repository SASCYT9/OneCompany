"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Info, Search } from "lucide-react";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct } from "@/lib/shopCatalog";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { ILMBERGER_MOCK_PRODUCTS } from "../data/ilmbergerHomeData";
import IlmbergerSpotlightCard from "./IlmbergerSpotlightCard";

type Props = {
  locale: SupportedLocale;
  products: ShopProduct[];
  viewerContext?: ShopViewerPricingContext;
  productPathPrefix: string;
};

// Manufacturer + model list must mirror IlmbergerCatalog.tsx so dropdowns
// on the home page show the same brands/models the catalog actually filters
// for. Drop manufacturers with 0 products (Aprilia/Yamaha/Honda/Kawasaki).
const MANUFACTURERS: Record<string, string[]> = {
  "BMW Motorrad": ["S 1000 RR", "M 1000 RR", "S 1000 R"],
  Ducati: ["Panigale V4", "Streetfighter V4", "Diavel V4", "Diavel 1260", "XDiavel"],
};

const CATEGORIES = [
  { id: "fairings", labelEn: "Fairings & Bodywork", labelUa: "Обтічники" },
  { id: "tank-covers", labelEn: "Tank Covers & Pads", labelUa: "Накладки на бак" },
  { id: "fenders", labelEn: "Front/Rear Fenders", labelUa: "Крила" },
  { id: "frame-protection", labelEn: "Frame & Swingarm Protection", labelUa: "Захист рами" },
  { id: "wheel-covers", labelEn: "Wheel Covers & Hugger", labelUa: "Захист колеса" },
  { id: "cockpit", labelEn: "Cockpit & Dash", labelUa: "Кокпіт" },
  { id: "exhaust", labelEn: "Exhaust", labelUa: "Вихлоп" },
  { id: "engine", labelEn: "Engine Covers", labelUa: "Накладки двигуна" },
  { id: "air-intake", labelEn: "Air Intake", labelUa: "Повітрозабірник" },
  { id: "seats", labelEn: "Seats", labelUa: "Сидіння" },
  { id: "lighting", labelEn: "Headlight & Windshield", labelUa: "Фара та вітрове скло" },
];

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

export default function IlmbergerVehicleFilter({
  locale,
  products,
  productPathPrefix: _productPathPrefix,
}: Props) {
  const isUa = locale === "ua";

  const [manufacturer, setManufacturer] = useState<string>("all");
  const [model, setModel] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const availableModels = useMemo(() => {
    if (manufacturer === "all") return [];
    return MANUFACTURERS[manufacturer] ?? [];
  }, [manufacturer]);

  const hasRealProducts = products.length > 0;

  // Build the same searchable text bag as IlmbergerCatalog: title.en/ua,
  // category.en/ua, sku, tags. Lowercased for case-insensitive matching.
  const getSearchableText = (p: ShopProduct): string => {
    return [p.title?.en, p.title?.ua, p.category?.en, p.category?.ua, p.sku, ...(p.tags ?? [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  };

  const displayProducts = useMemo(() => {
    if (!hasRealProducts) return null;
    let list = products;
    if (manufacturer !== "all") {
      const brandKey = manufacturer.toLowerCase().split(" ")[0];
      list = list.filter((p) => getSearchableText(p).includes(brandKey));
    }
    if (model !== "all") {
      const modelNoSpace = model.toLowerCase().replace(/\s+/g, "");
      list = list.filter((p) => {
        const t = getSearchableText(p);
        return t.includes(model.toLowerCase()) || t.replace(/\s+/g, "").includes(modelNoSpace);
      });
    }
    if (category !== "all") {
      list = list.filter((p) => getSearchableText(p).includes(category.toLowerCase()));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => getSearchableText(p).includes(q));
    }
    return list;
  }, [products, hasRealProducts, manufacturer, model, category, search]);

  const hasActiveFilters =
    manufacturer !== "all" || model !== "all" || category !== "all" || search.length > 0;
  const resetFilters = () => {
    setManufacturer("all");
    setModel("all");
    setCategory("all");
    setSearch("");
  };

  return (
    <section className="il-filter-shell il-home">
      <div className="il-filter-shell__inner">
        <header className="text-center mb-8">
          <span className="il-label">{L(isUa, "Browse Catalog", "Перегляд каталогу")}</span>
          <h1 className="il-section-title">
            {L(isUa, "Ilmberger Carbon Catalog", "Каталог Ilmberger Carbon")}
          </h1>
          <div className="il-divider il-divider--center" />
          <p className="il-section-sub mx-auto" style={{ textAlign: "center" }}>
            {L(
              isUa,
              "Select your bike to see compatible carbon parts.",
              "Виберіть свій мотоцикл, щоб побачити сумісні карбонові деталі."
            )}
          </p>
        </header>

        <form
          className="il-filter"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <div className="il-filter__select-wrap">
            <select
              className="il-filter__field"
              value={manufacturer}
              onChange={(e) => {
                setManufacturer(e.target.value);
                setModel("all");
              }}
              aria-label={L(isUa, "Manufacturer", "Марка")}
            >
              <option value="all">{L(isUa, "All manufacturers", "Всі марки")}</option>
              {Object.keys(MANUFACTURERS).map((mfr) => (
                <option key={mfr} value={mfr}>
                  {mfr}
                </option>
              ))}
            </select>
            <ChevronDown className="il-filter__chevron" size={16} aria-hidden />
          </div>

          <div className="il-filter__select-wrap">
            <select
              className="il-filter__field"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={manufacturer === "all"}
              aria-label={L(isUa, "Model", "Модель")}
            >
              <option value="all">
                {manufacturer === "all"
                  ? L(isUa, "Select manufacturer first", "Спочатку виберіть марку")
                  : L(isUa, "All models", "Всі моделі")}
              </option>
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <ChevronDown className="il-filter__chevron" size={16} aria-hidden />
          </div>

          <div className="il-filter__select-wrap">
            <select
              className="il-filter__field"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label={L(isUa, "Category", "Категорія")}
            >
              <option value="all">{L(isUa, "All categories", "Всі категорії")}</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {L(isUa, cat.labelEn, cat.labelUa)}
                </option>
              ))}
            </select>
            <ChevronDown className="il-filter__chevron" size={16} aria-hidden />
          </div>

          <div className="il-filter__select-wrap">
            <input
              type="search"
              className="il-filter__field"
              placeholder={L(isUa, "Search SKU or model", "Пошук SKU або моделі")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={L(isUa, "Search", "Пошук")}
            />
            <Search className="il-filter__chevron" size={16} aria-hidden />
          </div>
        </form>

        {!hasRealProducts && (
          <div className="il-catalog-notice">
            <Info size={16} aria-hidden />
            <span>
              <strong>{L(isUa, "Preview catalog.", "Демо-каталог.")}</strong>{" "}
              {L(
                isUa,
                "Showing reference cards while we import the live Ilmberger feed. Pricing & stock update on launch.",
                "Показано демонстраційні картки, доки ми імпортуємо живий фід Ilmberger. Ціни та наявність оновляться після запуску."
              )}
            </span>
            <Link href={`/${locale}/contact`} className="il-catalog-notice__link">
              {L(isUa, "Get notified", "Отримати сповіщення")}
            </Link>
          </div>
        )}

        {hasRealProducts && hasActiveFilters && (
          <div
            className="il-filter-count"
            style={{
              textAlign: "center",
              marginBottom: "1rem",
              fontSize: "0.75rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "var(--il-titanium)",
            }}
          >
            {L(isUa, "Showing", "Знайдено")}:{" "}
            <strong style={{ color: "var(--il-white)" }}>{displayProducts?.length ?? 0}</strong>{" "}
            {L(isUa, "of", "із")} {products.length}
            {" · "}
            <button
              type="button"
              onClick={resetFilters}
              style={{
                background: "none",
                border: "none",
                color: "var(--il-chrome)",
                cursor: "pointer",
                textDecoration: "underline",
                padding: 0,
                font: "inherit",
                letterSpacing: "inherit",
                textTransform: "inherit",
              }}
            >
              {L(isUa, "Reset", "Очистити")}
            </button>
          </div>
        )}

        {hasRealProducts && displayProducts && displayProducts.length === 0 && (
          <div className="il-catalog-notice" style={{ textAlign: "center" }}>
            <Info size={16} aria-hidden />
            <span>
              {L(
                isUa,
                "No products match the selected filters.",
                "Жоден товар не відповідає обраним фільтрам."
              )}
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="il-catalog-notice__link"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                font: "inherit",
              }}
            >
              {L(isUa, "Reset filters", "Очистити фільтри")}
            </button>
          </div>
        )}

        <div className="il-grid">
          {(displayProducts ?? ILMBERGER_MOCK_PRODUCTS).map((p, i) => {
            const isMock = !displayProducts;
            const href = isMock
              ? `/${locale}/contact`
              : `/${locale}/shop/ilmberger/products/${(p as ShopProduct).slug}`;
            const sku = isMock
              ? (p as (typeof ILMBERGER_MOCK_PRODUCTS)[number]).sku
              : ((p as ShopProduct).sku ?? "");
            const title = isMock
              ? L(
                  isUa,
                  (p as (typeof ILMBERGER_MOCK_PRODUCTS)[number]).title,
                  (p as (typeof ILMBERGER_MOCK_PRODUCTS)[number]).titleUk
                )
              : ((p as ShopProduct).title?.en ?? "");
            const fitment = isMock
              ? L(
                  isUa,
                  (p as (typeof ILMBERGER_MOCK_PRODUCTS)[number]).fitment,
                  (p as (typeof ILMBERGER_MOCK_PRODUCTS)[number]).fitmentUk
                )
              : "";
            const cat = isMock
              ? L(
                  isUa,
                  (p as (typeof ILMBERGER_MOCK_PRODUCTS)[number]).category,
                  (p as (typeof ILMBERGER_MOCK_PRODUCTS)[number]).categoryUk
                )
              : "";
            const priceFrom = isMock
              ? (p as (typeof ILMBERGER_MOCK_PRODUCTS)[number]).priceFrom
              : "";
            const image = isMock
              ? (p as (typeof ILMBERGER_MOCK_PRODUCTS)[number]).image
              : ((p as ShopProduct).image ?? "/logos/ilmberger-carbon.webp");

            return (
              <IlmbergerSpotlightCard
                key={
                  isMock
                    ? (p as (typeof ILMBERGER_MOCK_PRODUCTS)[number]).id
                    : ((p as ShopProduct).slug ?? i)
                }
                className="il-card-spotlight-wrap"
              >
                <Link href={href} className="il-card">
                  <div className="il-card__media">
                    <span className="il-card__badge">
                      {isMock ? L(isUa, "Soon", "Скоро") : L(isUa, "In Stock", "В наявності")}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image}
                      alt=""
                      className="il-card__img"
                      loading="lazy"
                      decoding="async"
                      aria-hidden
                    />
                    {sku && <span className="il-card__sku">{sku}</span>}
                  </div>
                  <div className="il-card__body">
                    {cat && <span className="il-card__category">{cat}</span>}
                    <h3 className="il-card__title">{title}</h3>
                    {fitment && <p className="il-card__fitment">{fitment}</p>}
                    <div className="il-card__footer">
                      <div>
                        <span className="il-card__price-from">
                          {isMock
                            ? L(isUa, "Pre-order", "Передзамовлення")
                            : L(isUa, "From", "Від")}
                        </span>
                        <span className="il-card__price">{priceFrom || "—"}</span>
                      </div>
                      <span className="il-card__cta">
                        {isMock ? L(isUa, "Request", "Запит") : L(isUa, "View", "Дивитись")}
                        <svg viewBox="0 0 24 24">
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                      </span>
                    </div>
                  </div>
                </Link>
              </IlmbergerSpotlightCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}
