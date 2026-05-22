"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";
import type { SupportedLocale } from "@/lib/seo";

type BikeRow = {
  manufacturer: "BMW Motorrad" | "Ducati";
  model: string;
  labelEn: string;
  labelUa: string;
  yearsEn: string;
  yearsUa: string;
  photo: string;
  accent: string;
};

const BIKES: BikeRow[] = [
  // ── Ducati ──────────────────────────────────────────────────────────
  {
    manufacturer: "Ducati",
    model: "Panigale V4",
    labelEn: "Panigale V4",
    labelUa: "Panigale V4",
    yearsEn: "2018 — present",
    yearsUa: "2018 — сьогодні",
    photo: "/images/shop/ilmberger/bikes/ducati-panigale-v4.jpg",
    accent: "#cc0000",
  },
  {
    manufacturer: "Ducati",
    model: "Streetfighter V4",
    labelEn: "Streetfighter V4",
    labelUa: "Streetfighter V4",
    yearsEn: "2020 — present",
    yearsUa: "2020 — сьогодні",
    photo: "/images/shop/ilmberger/bikes/ducati-streetfighter-v4.jpg",
    accent: "#cc0000",
  },
  {
    manufacturer: "Ducati",
    model: "Diavel V4",
    labelEn: "Diavel V4",
    labelUa: "Diavel V4",
    yearsEn: "2023 — present",
    yearsUa: "2023 — сьогодні",
    photo: "/images/shop/ilmberger/bikes/ducati-diavel-v4.jpg",
    accent: "#cc0000",
  },
  {
    manufacturer: "Ducati",
    model: "Diavel 1260",
    labelEn: "Diavel 1260",
    labelUa: "Diavel 1260",
    yearsEn: "2019 — 2022",
    yearsUa: "2019 — 2022",
    photo: "/images/shop/ilmberger/bikes/ducati-diavel-1260.jpg",
    accent: "#cc0000",
  },
  {
    manufacturer: "Ducati",
    model: "XDiavel",
    labelEn: "XDiavel",
    labelUa: "XDiavel",
    yearsEn: "2016 — present",
    yearsUa: "2016 — сьогодні",
    photo: "/images/shop/ilmberger/bikes/ducati-xdiavel.jpg",
    accent: "#cc0000",
  },
  // ── BMW Motorrad ────────────────────────────────────────────────────
  {
    manufacturer: "BMW Motorrad",
    model: "S 1000 RR",
    labelEn: "S 1000 RR",
    labelUa: "S 1000 RR",
    yearsEn: "2019 — present",
    yearsUa: "2019 — сьогодні",
    photo: "/images/shop/ilmberger/bikes/bmw-s1000rr.jpg",
    accent: "#1c69d4",
  },
  {
    manufacturer: "BMW Motorrad",
    model: "M 1000 RR",
    labelEn: "M 1000 RR",
    labelUa: "M 1000 RR",
    yearsEn: "2021 — present",
    yearsUa: "2021 — сьогодні",
    photo: "/images/shop/ilmberger/bikes/bmw-m1000rr.jpg",
    accent: "#1c69d4",
  },
  {
    manufacturer: "BMW Motorrad",
    model: "S 1000 XR",
    labelEn: "S 1000 XR",
    labelUa: "S 1000 XR",
    yearsEn: "2015 — present",
    yearsUa: "2015 — сьогодні",
    photo: "/images/shop/ilmberger/bikes/bmw-s1000xr.jpg",
    accent: "#1c69d4",
  },
  {
    manufacturer: "BMW Motorrad",
    model: "M 1000 XR",
    labelEn: "M 1000 XR",
    labelUa: "M 1000 XR",
    yearsEn: "2024 — present",
    yearsUa: "2024 — сьогодні",
    photo: "/images/shop/ilmberger/bikes/bmw-m1000xr.jpg",
    accent: "#1c69d4",
  },
  {
    manufacturer: "BMW Motorrad",
    model: "S 1000 R",
    labelEn: "S 1000 R",
    labelUa: "S 1000 R",
    yearsEn: "2021 — present",
    yearsUa: "2021 — сьогодні",
    photo: "/images/shop/ilmberger/bikes/bmw-s1000r.jpg",
    accent: "#1c69d4",
  },
  {
    manufacturer: "BMW Motorrad",
    model: "M 1000 R",
    labelEn: "M 1000 R",
    labelUa: "M 1000 R",
    yearsEn: "2023 — present",
    yearsUa: "2023 — сьогодні",
    photo: "/images/shop/ilmberger/bikes/bmw-m1000r.jpg",
    accent: "#1c69d4",
  },
];

const TABS: Array<{
  id: "all" | "BMW Motorrad" | "Ducati";
  labelEn: string;
  labelUa: string;
  accent: string;
}> = [
  { id: "BMW Motorrad", labelEn: "BMW Motorrad", labelUa: "BMW Motorrad", accent: "#1c69d4" },
  { id: "Ducati", labelEn: "Ducati", labelUa: "Ducati", accent: "#cc0000" },
  { id: "all", labelEn: "All Models", labelUa: "Усі моделі", accent: "#c0c8d0" },
];

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

type Props = {
  locale: SupportedLocale;
  productCountByModel: Map<string, number>;
  onPick: (manufacturer: string, model: string) => void;
};

export default function IlmbergerBikePicker({ locale, productCountByModel, onPick }: Props) {
  const isUa = locale === "ua";
  const [activeTab, setActiveTab] = useState<"all" | "BMW Motorrad" | "Ducati">("BMW Motorrad");

  const visibleBikes =
    activeTab === "all" ? BIKES : BIKES.filter((b) => b.manufacturer === activeTab);

  return (
    <section
      className="il-bike-picker relative bg-[var(--il-bg)] border-b border-[var(--il-faint)] py-14 md:py-20 overflow-hidden"
      aria-label={L(isUa, "Choose your motorcycle", "Оберіть мотоцикл")}
    >
      {/* Subtle radial accent in the background */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(192,200,208,0.06) 0%, transparent 60%)",
        }}
        aria-hidden
      />

      <div className="relative max-w-7xl mx-auto px-4 md:px-8">
        {/* Section header */}
        <div className="mb-10 md:mb-14 text-center">
          <p className="text-[10px] md:text-xs font-semibold tracking-[0.4em] uppercase text-[var(--il-chrome)] mb-3">
            {L(isUa, "Step 01 — Configure", "Крок 01 — Конфігурація")}
          </p>
          <h2 className="text-3xl md:text-5xl font-extralight tracking-wider uppercase text-[var(--il-white)] mb-4">
            {L(isUa, "Choose Your Motorcycle", "Оберіть свій мотоцикл")}
          </h2>
          <p className="text-sm md:text-base font-light text-[var(--il-muted)] max-w-xl mx-auto leading-relaxed">
            {L(
              isUa,
              "Pick your model — the catalog filters to parts engineered for your bike.",
              "Оберіть модель — каталог покаже деталі, інженеровані під ваш байк."
            )}
          </p>
        </div>

        {/* Brand tabs — large solid pills with brand-color accent */}
        <div
          className="flex flex-wrap items-center justify-center gap-2 md:gap-3 mb-10 md:mb-12"
          role="tablist"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const tabCount =
              tab.id === "all"
                ? BIKES.length
                : BIKES.filter((b) => b.manufacturer === tab.id).length;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`group relative flex items-center gap-3 px-6 md:px-8 py-3 md:py-4 text-sm md:text-base font-semibold uppercase tracking-[0.22em] rounded-sm border-2 transition-all duration-300 ${
                  isActive
                    ? "text-[var(--il-bg)] -translate-y-0.5"
                    : "text-[var(--il-titanium)] hover:text-[var(--il-white)] hover:-translate-y-0.5 bg-[var(--il-bg-soft)]/40 border-[var(--il-faint)] hover:border-[var(--il-titanium)]"
                }`}
                style={
                  isActive
                    ? {
                        background: `linear-gradient(135deg, ${tab.accent} 0%, ${tab.accent}dd 100%)`,
                        borderColor: tab.accent,
                        boxShadow: `0 6px 24px ${tab.accent}55, 0 0 0 1px ${tab.accent}88 inset`,
                        color: "#ffffff",
                      }
                    : undefined
                }
              >
                <span>{L(isUa, tab.labelEn, tab.labelUa)}</span>
                <span
                  className={`inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-[10px] font-bold rounded-sm ${
                    isActive
                      ? "bg-white/25 text-white"
                      : "bg-[var(--il-bg)] text-[var(--il-muted)] border border-[var(--il-faint)]"
                  }`}
                >
                  {tabCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* Bike grid — 3 cols desktop, 2 tablet, 1 mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {visibleBikes.map((bike) => {
            const count = productCountByModel.get(bike.model) ?? 0;
            const isEmpty = count === 0;
            return (
              <button
                key={`${bike.manufacturer}-${bike.model}`}
                type="button"
                onClick={() => {
                  if (isEmpty) return;
                  onPick(bike.manufacturer, bike.model);
                  requestAnimationFrame(() => {
                    document
                      .querySelector('[data-il-anchor="catalog"]')
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  });
                }}
                disabled={isEmpty}
                className={`group relative flex flex-col text-left rounded-sm overflow-hidden transition-all duration-500 ${
                  isEmpty ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:-translate-y-1"
                }`}
                style={{
                  background: "linear-gradient(180deg, var(--il-bg-soft) 0%, var(--il-bg) 100%)",
                  border: "1px solid var(--il-faint)",
                  boxShadow: "0 1px 0 rgba(255,255,255,0.02) inset",
                }}
              >
                {/* Photo */}
                <div className="relative aspect-[4/3] overflow-hidden bg-[var(--il-bg)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bike.photo}
                    alt={bike.labelEn}
                    className="w-full h-full object-cover transition-all duration-[1.2s] ease-out group-hover:scale-110"
                    loading="lazy"
                  />
                  {/* Gradient overlay for text contrast on bottom */}
                  <div
                    className="absolute inset-x-0 bottom-0 h-2/3 pointer-events-none"
                    style={{
                      background:
                        "linear-gradient(0deg, var(--il-bg-soft) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)",
                    }}
                    aria-hidden
                  />
                  {/* Accent line on top (brand color) */}
                  <div
                    className="absolute inset-x-0 top-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${bike.accent}, transparent)`,
                    }}
                    aria-hidden
                  />

                  {/* Bottom-left overlaid title (sits on the gradient) */}
                  <div className="absolute bottom-0 left-0 right-0 px-5 md:px-6 py-4 md:py-5">
                    <p
                      className="text-[10px] font-bold uppercase tracking-[0.3em] mb-1.5"
                      style={{ color: bike.accent }}
                    >
                      {bike.manufacturer === "BMW Motorrad" ? "BMW Motorrad" : bike.manufacturer}
                    </p>
                    <h3 className="text-2xl md:text-3xl font-extralight tracking-wide uppercase text-white drop-shadow-lg">
                      {L(isUa, bike.labelEn, bike.labelUa)}
                    </h3>
                  </div>
                </div>

                {/* Info bar — chrome strip below photo */}
                <div className="flex items-center justify-between px-5 md:px-6 py-4 border-t border-[var(--il-faint)]">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase tracking-[0.25em] text-[var(--il-titanium)]">
                      {L(isUa, bike.yearsEn, bike.yearsUa)}
                    </span>
                    <span className="text-[11px] font-semibold text-[var(--il-white)]">
                      {isEmpty
                        ? L(isUa, "Coming soon", "Скоро")
                        : `${count} ${L(isUa, "carbon parts", "карбонових деталей")}`}
                    </span>
                  </div>
                  {!isEmpty && (
                    <div
                      className="flex items-center justify-center w-9 h-9 rounded-full border transition-all duration-300 group-hover:border-[var(--il-white)] group-hover:bg-[var(--il-white)] group-hover:text-[var(--il-bg)]"
                      style={{
                        borderColor: "var(--il-titanium)",
                        color: "var(--il-titanium)",
                      }}
                    >
                      <ArrowRight
                        size={14}
                        className="transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </div>
                  )}
                </div>

                {/* Glow on hover — subtle radial in brand accent */}
                {!isEmpty && (
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                    style={{
                      background: `radial-gradient(circle at 50% 0%, ${bike.accent}22 0%, transparent 70%)`,
                    }}
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Skip affordance */}
        <div className="mt-10 md:mt-12 text-center">
          <button
            type="button"
            onClick={() => {
              document
                .querySelector('[data-il-anchor="catalog"]')
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="text-[10px] uppercase tracking-[0.3em] text-[var(--il-titanium)] hover:text-[var(--il-white)] transition-colors font-semibold border-b border-transparent hover:border-[var(--il-chrome)] pb-1"
          >
            {L(isUa, "Skip — browse all parts ↓", "Пропустити — переглянути все ↓")}
          </button>
        </div>
      </div>
    </section>
  );
}
