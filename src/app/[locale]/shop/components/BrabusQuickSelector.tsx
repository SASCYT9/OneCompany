"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { SupportedLocale } from "@/lib/seo";
import BrabusVideoBackground from "./BrabusVideoBackground";
import {
  BRABUS_BRAND_ORDER,
  BRABUS_BRAND_LABELS,
  BRABUS_MODEL_LABELS,
  BRABUS_MODELS_BY_BRAND,
  BRABUS_CHASSIS_BY_MODEL,
} from "@/lib/brabusFilterTaxonomy";

type Props = {
  locale: SupportedLocale;
  /** Compact mode: no section wrapper, no video background, no heading.
   *  Use when embedding inside another section (e.g. inside the hero). */
  compact?: boolean;
};

export default function BrabusQuickSelector({ locale, compact = false }: Props) {
  const isUa = locale === "ua";
  const router = useRouter();
  const [selectedBrand, setSelectedBrand] = useState<string>("Mercedes");
  const [selectedModel, setSelectedModel] = useState<string>("all");
  const [selectedChassis, setSelectedChassis] = useState<string>("all");

  const currentModels = useMemo(() => {
    const raw = BRABUS_MODELS_BY_BRAND[selectedBrand] || [];
    const sorted = [...raw].sort((a, b) => {
      const labelA = BRABUS_MODEL_LABELS[a]?.[locale] || a;
      const labelB = BRABUS_MODEL_LABELS[b]?.[locale] || b;
      return labelA.localeCompare(labelB, locale);
    });
    return ["all", ...sorted];
  }, [selectedBrand, locale]);

  const currentChassis = useMemo(() => {
    if (selectedModel === "all") return [];
    return BRABUS_CHASSIS_BY_MODEL[selectedModel] || [];
  }, [selectedModel]);

  const handleBrandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBrand(e.target.value);
    setSelectedModel("all");
    setSelectedChassis("all");
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModel(e.target.value);
    setSelectedChassis("all");
  };

  const handleExplore = () => {
    let url = `/${locale}/shop/brabus/products?brand=${encodeURIComponent(selectedBrand)}`;
    if (selectedModel !== "all") {
      url += `&model=${encodeURIComponent(selectedModel)}`;
    }
    if (selectedChassis !== "all") {
      url += `&chassis=${encodeURIComponent(selectedChassis)}`;
    }
    url += "#catalog";
    router.push(url);
  };

  /* ── Form (used by both modes) ─────────────────────────────────────── */
  const form = (
    <div className="flex flex-col items-center justify-center gap-4 w-full max-w-md mx-auto">
      {/* Brand Select */}
      <div className="relative w-full group">
        <select
          value={selectedBrand}
          onChange={handleBrandChange}
          className="w-full appearance-none bg-[#050505]/60 backdrop-blur-md border border-white/10 text-white px-6 py-4 lg:py-5 rounded-none outline-hidden focus:border-[#c29d59]/50 hover:bg-[#111]/80 transition-all cursor-pointer text-xs md:text-sm tracking-widest uppercase shadow-2xl"
          aria-label={isUa ? "Марка автомобіля" : "Vehicle brand"}
        >
          {BRABUS_BRAND_ORDER.map((key) => (
            <option key={key} value={key} className="bg-black text-white">
              {BRABUS_BRAND_LABELS[key]?.[locale] || key}
            </option>
          ))}
        </select>
        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-white/30 group-hover:text-white/60 transition-colors">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
        <div className="absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent via-[#c29d59] to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
      </div>

      {/* Model Select */}
      <div className="relative w-full group">
        <select
          value={selectedModel}
          onChange={handleModelChange}
          className="w-full appearance-none bg-[#050505]/60 backdrop-blur-md border border-white/10 text-white px-6 py-4 lg:py-5 rounded-none outline-hidden focus:border-[#c29d59]/50 hover:bg-[#111]/80 transition-all cursor-pointer text-xs md:text-sm tracking-widest uppercase shadow-2xl"
          aria-label={isUa ? "Модель автомобіля" : "Vehicle model"}
        >
          {currentModels.map((m) => (
            <option key={m} value={m} className="bg-black text-white">
              {m === "all"
                ? isUa
                  ? "Всі моделі"
                  : "All Models"
                : BRABUS_MODEL_LABELS[m]?.[locale] || m}
            </option>
          ))}
        </select>
        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-white/30 group-hover:text-white/60 transition-colors">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
        <div className="absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent via-[#c29d59] to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
      </div>

      {/* Chassis Select */}
      <div className="relative w-full group">
        <select
          value={selectedChassis}
          onChange={(e) => setSelectedChassis(e.target.value)}
          disabled={selectedModel === "all" || currentChassis.length === 0}
          className="w-full appearance-none bg-[#050505]/60 backdrop-blur-md border border-white/10 text-white px-6 py-4 lg:py-5 rounded-none outline-hidden focus:border-[#c29d59]/50 hover:bg-[#111]/80 transition-all cursor-pointer text-xs md:text-sm tracking-widest uppercase shadow-2xl disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={isUa ? "Кузов автомобіля" : "Vehicle chassis"}
        >
          <option value="all" className="bg-black text-white">
            {isUa ? "Всі кузови" : "All Chassis"}
          </option>
          {currentChassis.map((c) => (
            <option key={c} value={c} className="bg-black text-white">
              {c}
            </option>
          ))}
        </select>
        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-white/30 group-hover:text-white/60 transition-colors">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
        <div className="absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent via-[#c29d59] to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
      </div>

      {/* Submit */}
      <button
        onClick={handleExplore}
        className="w-full px-10 py-4 lg:py-5 bg-[#c29d59]/15 backdrop-blur-xl border border-[#c29d59]/40 hover:bg-[#c29d59]/25 hover:border-[#c29d59]/70 text-white text-[11px] md:text-[13px] uppercase font-medium tracking-[0.2em] rounded-none transition-all duration-500 shadow-[0_0_20px_rgba(194,157,89,0.1)] hover:shadow-[0_0_40px_rgba(194,157,89,0.25)] whitespace-nowrap cursor-pointer text-center"
      >
        {isUa ? "Показати каталог" : "Explore Catalog"}
      </button>
    </div>
  );

  /* ── Compact: just the form, with a small label above ───────────────── */
  if (compact) {
    return (
      <div className="w-full max-w-md mx-auto px-4">
        <p className="text-[0.65rem] sm:text-xs font-medium text-white/50 uppercase tracking-[0.25em] mb-4 text-center">
          {isUa ? "Знайдіть деталі для свого авто" : "Find parts for your vehicle"}
        </p>
        {form}
      </div>
    );
  }

  /* ── Standalone section (legacy / standalone usage) ─────────────────── */
  return (
    <section className="relative min-h-[500px] flex items-center justify-center py-24 border-y border-foreground/10 dark:border-white/4 overflow-hidden z-20">
      {/* Background Video */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <BrabusVideoBackground
          videoSrc="/videos/shop/brabus/brabus-hero-new.mp4"
          fallbackImage="/images/shop/brabus/hq/brabus-supercars-26.jpg"
        />
        {/* Strong Blur Overlay for depth */}
        <div className="absolute inset-0 bg-transparent dark:bg-black/75 backdrop-blur-md" />
      </div>

      <div className="w-full max-w-[1200px] mx-auto px-6 text-center relative z-10">
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-light text-white uppercase tracking-[0.15em] mb-4 drop-shadow-lg">
          {isUa ? "Знайдіть комплектуючі для свого автомобіля" : "Find upgrades for your vehicle"}
        </h2>
        <p className="text-sm md:text-base text-white/60 mb-12 max-w-2xl mx-auto font-light tracking-wide leading-relaxed drop-shadow-md">
          {isUa
            ? "Оберіть марку та модель автомобіля, щоб миттєво перейти до всіх доступних преміальних компонентів тюнінгу Brabus у нашому каталозі."
            : "Select your vehicle brand and model to instantly jump to all available premium Brabus tuning components in our catalog."}
        </p>
        {form}
      </div>
    </section>
  );
}
