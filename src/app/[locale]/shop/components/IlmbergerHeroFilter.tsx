"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import type { SupportedLocale } from "@/lib/seo";

const MANUFACTURERS: Record<string, string[]> = {
  "BMW Motorrad": ["S 1000 RR", "M 1000 RR", "R 1250 RS", "K 1600"],
  Ducati: ["Panigale V4", "Panigale V2", "Streetfighter V4"],
  Aprilia: ["RSV4", "Tuono V4"],
  Yamaha: ["YZF-R1", "YZF-R6", "MT-10"],
  Honda: ["CBR1000RR-R Fireblade", "CBR600RR"],
  Kawasaki: ["ZX-10R", "ZX-6R"],
};

const CATEGORIES = [
  { id: "fairings", labelEn: "Fairings", labelUa: "Обтічники" },
  { id: "tank-covers", labelEn: "Tank Covers", labelUa: "Накладки на бак" },
  { id: "fenders", labelEn: "Fenders", labelUa: "Крила" },
  { id: "frame-protection", labelEn: "Frame Protection", labelUa: "Захист рами" },
  { id: "wheel-covers", labelEn: "Wheel Covers", labelUa: "Захист колеса" },
  { id: "cockpit", labelEn: "Cockpit", labelUa: "Кокпіт" },
];

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

type Props = {
  locale: SupportedLocale;
};

export default function IlmbergerHeroFilter({ locale }: Props) {
  const isUa = locale === "ua";
  const router = useRouter();

  const [manufacturer, setManufacturer] = useState("all");
  const [model, setModel] = useState("all");
  const [category, setCategory] = useState("all");

  const availableModels = useMemo(() => {
    if (manufacturer === "all") return [];
    return MANUFACTURERS[manufacturer] ?? [];
  }, [manufacturer]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (manufacturer !== "all") params.set("manufacturer", manufacturer);
    if (model !== "all") params.set("model", model);
    if (category !== "all") params.set("category", category);
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
          onChange={(e) => setModel(e.target.value)}
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
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label={L(isUa, "Category", "Категорія")}
        >
          <option value="all">{L(isUa, "Category", "Категорія")}</option>
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
