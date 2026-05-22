"use client";

import { ArrowRight } from "lucide-react";
import type { SupportedLocale } from "@/lib/seo";

type BikeRow = {
  manufacturer: string; // matches MANUFACTURERS keys in IlmbergerCatalog
  model: string; // matches MANUFACTURERS values
  labelEn: string;
  labelUa: string;
  yearsEn: string;
  yearsUa: string;
  /** Optional accent color for the card border on hover */
  accent?: string;
};

// Hand-curated order — biggest catalogue first, then newer models.
// Counts shown live (computed from products at runtime, not hardcoded).
const BIKES: BikeRow[] = [
  // ── Ducati ──────────────────────────────────────────────────────────
  {
    manufacturer: "Ducati",
    model: "Panigale V4",
    labelEn: "Panigale V4",
    labelUa: "Panigale V4",
    yearsEn: "2018 — present",
    yearsUa: "2018 — сьогодні",
    accent: "#cc0000",
  },
  {
    manufacturer: "Ducati",
    model: "Streetfighter V4",
    labelEn: "Streetfighter V4",
    labelUa: "Streetfighter V4",
    yearsEn: "2020 — present",
    yearsUa: "2020 — сьогодні",
    accent: "#cc0000",
  },
  {
    manufacturer: "Ducati",
    model: "Diavel V4",
    labelEn: "Diavel V4",
    labelUa: "Diavel V4",
    yearsEn: "2023 — present",
    yearsUa: "2023 — сьогодні",
    accent: "#cc0000",
  },
  {
    manufacturer: "Ducati",
    model: "Diavel 1260",
    labelEn: "Diavel 1260",
    labelUa: "Diavel 1260",
    yearsEn: "2019 — 2022",
    yearsUa: "2019 — 2022",
    accent: "#cc0000",
  },
  {
    manufacturer: "Ducati",
    model: "XDiavel",
    labelEn: "XDiavel",
    labelUa: "XDiavel",
    yearsEn: "2016 — present",
    yearsUa: "2016 — сьогодні",
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
    accent: "#1c69d4",
  },
  {
    manufacturer: "BMW Motorrad",
    model: "M 1000 RR",
    labelEn: "M 1000 RR",
    labelUa: "M 1000 RR",
    yearsEn: "2021 — present",
    yearsUa: "2021 — сьогодні",
    accent: "#1c69d4",
  },
  {
    manufacturer: "BMW Motorrad",
    model: "S 1000 XR",
    labelEn: "S 1000 XR",
    labelUa: "S 1000 XR",
    yearsEn: "2015 — present",
    yearsUa: "2015 — сьогодні",
    accent: "#1c69d4",
  },
  {
    manufacturer: "BMW Motorrad",
    model: "M 1000 XR",
    labelEn: "M 1000 XR",
    labelUa: "M 1000 XR",
    yearsEn: "2024 — present",
    yearsUa: "2024 — сьогодні",
    accent: "#1c69d4",
  },
  {
    manufacturer: "BMW Motorrad",
    model: "S 1000 R",
    labelEn: "S 1000 R",
    labelUa: "S 1000 R",
    yearsEn: "2021 — present",
    yearsUa: "2021 — сьогодні",
    accent: "#1c69d4",
  },
  {
    manufacturer: "BMW Motorrad",
    model: "M 1000 R",
    labelEn: "M 1000 R",
    labelUa: "M 1000 R",
    yearsEn: "2023 — present",
    yearsUa: "2023 — сьогодні",
    accent: "#1c69d4",
  },
];

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

type Props = {
  locale: SupportedLocale;
  /** Map of model → product-count (from live DB), keyed by model name. */
  productCountByModel: Map<string, number>;
  /** Called when user clicks a bike. Sets manufacturer + model in parent. */
  onPick: (manufacturer: string, model: string) => void;
};

export default function IlmbergerBikePicker({ locale, productCountByModel, onPick }: Props) {
  const isUa = locale === "ua";

  return (
    <section
      className="il-bike-picker bg-[var(--il-bg)] border-b border-[var(--il-faint)] py-12 md:py-16"
      aria-label={L(isUa, "Choose your motorcycle", "Оберіть мотоцикл")}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {/* Section header */}
        <div className="mb-8 md:mb-10 text-center">
          <p className="text-[10px] md:text-xs font-semibold tracking-[0.3em] uppercase text-[var(--il-chrome)] mb-2">
            {L(isUa, "Step 1", "Крок 1")}
          </p>
          <h2 className="text-2xl md:text-4xl font-extralight tracking-wide uppercase text-[var(--il-white)] mb-3">
            {L(isUa, "Choose Your Motorcycle", "Оберіть свій мотоцикл")}
          </h2>
          <p className="text-sm text-[var(--il-muted)] max-w-xl mx-auto leading-relaxed">
            {L(
              isUa,
              "Pick your model — the catalog filters to parts that fit your bike.",
              "Оберіть модель — каталог відфільтрується до деталей, що підходять до вашого байка."
            )}
          </p>
        </div>

        {/* Bike grid — 2 cols mobile, 3 cols tablet, 4 cols desktop */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
          {BIKES.map((bike) => {
            const count = productCountByModel.get(bike.model) ?? 0;
            const isEmpty = count === 0;
            return (
              <button
                key={`${bike.manufacturer}-${bike.model}`}
                type="button"
                onClick={() => {
                  if (isEmpty) return;
                  onPick(bike.manufacturer, bike.model);
                  // Smooth-scroll down to the category chips
                  requestAnimationFrame(() => {
                    document
                      .querySelector('[data-il-anchor="catalog"]')
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  });
                }}
                disabled={isEmpty}
                className={`group relative flex flex-col items-start text-left p-5 md:p-6 border rounded-sm transition-all duration-300 overflow-hidden ${
                  isEmpty
                    ? "border-[var(--il-faint)] bg-[var(--il-bg-soft)]/30 opacity-40 cursor-not-allowed"
                    : "border-[var(--il-faint)] bg-[var(--il-bg-soft)]/50 hover:border-[var(--il-chrome)] hover:bg-[var(--il-bg-soft)] cursor-pointer hover:-translate-y-0.5"
                }`}
              >
                {/* Manufacturer tag */}
                <span
                  className="text-[9px] font-bold uppercase tracking-[0.25em] mb-2 md:mb-3"
                  style={{ color: bike.accent ?? "var(--il-chrome)" }}
                >
                  {bike.manufacturer === "BMW Motorrad" ? "BMW" : bike.manufacturer}
                </span>

                {/* Model name (large) */}
                <span className="text-lg md:text-xl font-medium text-[var(--il-white)] tracking-wide leading-tight mb-1">
                  {L(isUa, bike.labelEn, bike.labelUa)}
                </span>

                {/* Year range */}
                <span className="text-[10px] uppercase tracking-wider text-[var(--il-muted)] mb-3 md:mb-4">
                  {L(isUa, bike.yearsEn, bike.yearsUa)}
                </span>

                {/* Spacer pushes footer down */}
                <span className="flex-1" />

                {/* Footer: count + arrow */}
                <div className="w-full flex items-end justify-between pt-3 border-t border-[var(--il-faint)]">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--il-titanium)]">
                    {isEmpty
                      ? L(isUa, "Coming soon", "Скоро")
                      : `${count} ${L(isUa, "parts", "деталей")}`}
                  </span>
                  {!isEmpty && (
                    <ArrowRight
                      size={14}
                      className="text-[var(--il-muted)] group-hover:text-[var(--il-white)] group-hover:translate-x-1 transition-all"
                      aria-hidden
                    />
                  )}
                </div>

                {/* Chrome glow on hover */}
                {!isEmpty && (
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{
                      background: `radial-gradient(circle at 50% 0%, ${bike.accent ?? "var(--il-chrome)"}15 0%, transparent 60%)`,
                    }}
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* "See all" affordance */}
        <div className="mt-6 md:mt-8 text-center">
          <button
            type="button"
            onClick={() => {
              document
                .querySelector('[data-il-anchor="catalog"]')
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="text-[10px] uppercase tracking-[0.25em] text-[var(--il-titanium)] hover:text-[var(--il-white)] transition-colors font-semibold border-b border-transparent hover:border-[var(--il-chrome)] pb-0.5"
          >
            {L(isUa, "Or browse all parts ↓", "Або переглянути всі деталі ↓")}
          </button>
        </div>
      </div>
    </section>
  );
}
