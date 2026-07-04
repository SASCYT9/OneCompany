"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct } from "@/lib/shopCatalog";
import { ILMBERGER_MOCK_PRODUCTS } from "../data/ilmbergerHomeData";

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
  { id: "exhaust", labelEn: "Exhaust", labelUa: "Вихлоп" },
  { id: "engine", labelEn: "Engine Covers", labelUa: "Накладки двигуна" },
  { id: "air-intake", labelEn: "Air Intake", labelUa: "Повітрозабірник" },
  { id: "seats", labelEn: "Seats", labelUa: "Сидіння" },
  { id: "lighting", labelEn: "Headlight & Windshield", labelUa: "Фара та вітрове скло" },
];

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

type Props = {
  locale: SupportedLocale;
  products?: ShopProduct[];
};

export default function IlmbergerHeroFilter({ locale, products = [] }: Props) {
  const isUa = locale === "ua";
  const router = useRouter();

  const [manufacturer, setManufacturer] = useState("all");
  const [model, setModel] = useState("all");
  const [year, setYear] = useState("all");
  const [category, setCategory] = useState("all");

  const availableModels = useMemo(() => {
    if (manufacturer === "all") return [];
    return MANUFACTURERS[manufacturer] ?? [];
  }, [manufacturer]);

  const hasRealProducts = products.length > 0;
  const sourceList = hasRealProducts ? products : ILMBERGER_MOCK_PRODUCTS;

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

      if (brandKey && !text.includes(brandKey)) continue;

      if (model !== "all" && hasRealProducts) {
        const tags = ((p as ShopProduct).tags ?? []) as string[];
        if (!tags.includes(model)) continue;
      }

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (manufacturer !== "all") params.set("manufacturer", manufacturer);
    if (model !== "all") params.set("model", model);
    if (year !== "all") params.set("year", year);
    if (category !== "all" && category !== "all") params.set("category", category);

    const qs = params.toString();
    router.push(`/${locale}/shop/ilmberger/collections${qs ? `?${qs}` : ""}`);
  };

  return (
    <form className="il-hero-filter" onSubmit={handleSubmit}>
      <div className="il-hero-filter__select-wrap">
        <select
          className="il-hero-filter__field"
          value={manufacturer}
          onChange={(e) => {
            setManufacturer(e.target.value);
            setModel("all");
            setYear("all");
          }}
          aria-label={L(isUa, "Manufacturer", "Марка")}
        >
          <option value="all">{L(isUa, "Make", "Марка")}</option>
          {Object.keys(MANUFACTURERS).map((mfr) => (
            <option key={mfr} value={mfr}>
              {mfr}
            </option>
          ))}
        </select>
        <ChevronDown className="il-hero-filter__chevron" size={14} aria-hidden />
      </div>

      <div className="il-hero-filter__select-wrap">
        <select
          className="il-hero-filter__field"
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
            setYear("all");
          }}
          disabled={manufacturer === "all"}
          aria-label={L(isUa, "Model", "Модель")}
        >
          <option value="all">{L(isUa, "Model", "Модель")}</option>
          {availableModels.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <ChevronDown className="il-hero-filter__chevron" size={14} aria-hidden />
      </div>

      <div className="il-hero-filter__select-wrap">
        <select
          className="il-hero-filter__field"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          disabled={availableYears.length === 0}
          aria-label={L(isUa, "Year", "Рік")}
        >
          <option value="all">{L(isUa, "Year", "Рік")}</option>
          {availableYears.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <ChevronDown className="il-hero-filter__chevron" size={14} aria-hidden />
      </div>

      <div className="il-hero-filter__select-wrap">
        <select
          className="il-hero-filter__field"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label={L(isUa, "Category", "Категорія")}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {L(isUa, cat.labelEn, cat.labelUa)}
            </option>
          ))}
        </select>
        <ChevronDown className="il-hero-filter__chevron" size={14} aria-hidden />
      </div>

      <button type="submit" className="il-hero-filter__cta">
        <Search size={14} aria-hidden />
        <span>{L(isUa, "Search Parts", "Знайти деталі")}</span>
      </button>
    </form>
  );
}
