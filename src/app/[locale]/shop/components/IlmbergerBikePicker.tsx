"use client";

import { ArrowRight, ChevronDown } from "lucide-react";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
    photo: "/images/shop/ilmberger/bikes/bmw-s1000r-new.png",
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

type BrandItem = {
  id: "BMW Motorrad" | "Ducati" | "Yamaha" | "Aprilia";
  name: string;
  logoText: string;
  logoSvg: string;
  accent: string;
  bgPhoto: string | null;
  descriptionEn: string;
  descriptionUa: string;
  active: boolean;
};

const BRANDS: BrandItem[] = [
  {
    id: "BMW Motorrad",
    name: "BMW Motorrad",
    logoText: "BMW",
    logoSvg: "/images/shop/ilmberger/brands/bmw-logo.svg",
    accent: "#1c69d4",
    bgPhoto: "/images/shop/ilmberger/brands/bmw.png",
    descriptionEn: "Engineering Excellence & Pure Performance",
    descriptionUa: "Інженерна досконалість та чиста потужність",
    active: true,
  },
  {
    id: "Ducati",
    name: "Ducati",
    logoText: "DUCATI",
    logoSvg: "/images/shop/ilmberger/brands/ducati-logo.svg",
    accent: "#cc0000",
    bgPhoto: "/images/shop/ilmberger/brands/ducati.png",
    descriptionEn: "Italian Racing Heritage & Exquisite Design",
    descriptionUa: "Італійська гоночна спадщина та вишуканий дизайн",
    active: true,
  },
  {
    id: "Yamaha",
    name: "Yamaha",
    logoText: "YAMAHA",
    logoSvg: "/images/shop/ilmberger/brands/yamaha-logo.svg",
    accent: "#0054a6",
    bgPhoto: null,
    descriptionEn: "Japanese Precision & Track Domination",
    descriptionUa: "Японська точність та домінування на треку",
    active: false,
  },
  {
    id: "Aprilia",
    name: "Aprilia",
    logoText: "APRILIA",
    logoSvg: "/images/shop/ilmberger/brands/aprilia-logo.svg",
    accent: "#ff0000",
    bgPhoto: "/images/shop/ilmberger/brands/aprilia.png",
    descriptionEn: "No-Compromise Racing Superbikes",
    descriptionUa: "Безкомпромісні гоночні супербайки",
    active: false,
  },
];

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

type Props = {
  locale: SupportedLocale;
  productCountByModel: Map<string, number>;
  onPick: (manufacturer: string, model: string) => void;
  variant?: "default" | "hero";
};

// Variants for staggered entrance animation of grid items
const gridContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

const bikeCardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
    },
  },
};

export default function IlmbergerBikePicker({
  locale,
  productCountByModel,
  onPick,
  variant = "default",
}: Props) {
  const isUa = locale === "ua";
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);

  const isHero = variant === "hero";

  const getBrandPreviewModels = (brandId: string) => {
    return BIKES.filter((b) => b.manufacturer === brandId)
      .slice(0, 3)
      .map((b) => b.model);
  };

  return (
    <div
      className={`w-full text-left ${isHero ? "mt-12 md:mt-16" : "relative bg-[var(--il-bg)] border-b border-[var(--il-faint)] py-14 md:py-20 overflow-hidden"}`}
    >
      {!isHero && (
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(192,200,208,0.06) 0%, transparent 60%)",
          }}
          aria-hidden
        />
      )}

      <div className="relative max-w-[1600px] mx-auto px-4 md:px-8">
        {/* ── ACCORDION LIST OF BRANDS ── */}
        <div className="border border-[var(--il-faint)] rounded-none overflow-hidden bg-[var(--il-bg-soft)]/20 backdrop-blur-md max-w-[1600px] mx-auto">
          {BRANDS.map((brand) => {
            const isExpanded = expandedBrand === brand.id;
            const previewModels = getBrandPreviewModels(brand.id);
            const modelCount = BIKES.filter((b) => b.manufacturer === brand.id).length;

            return (
              <div
                key={brand.id}
                className="border-b border-[var(--il-faint)] last:border-0 overflow-hidden"
              >
                {/* Accordion Header */}
                <motion.button
                  type="button"
                  disabled={!brand.active}
                  onClick={() => setExpandedBrand(isExpanded ? null : brand.id)}
                  initial="initial"
                  whileHover="hover"
                  animate={isExpanded ? "expanded" : "collapsed"}
                  className={`w-full flex items-center justify-between p-4 sm:p-6 md:p-10 text-left transition-all duration-300 relative group overflow-hidden ${
                    brand.active
                      ? "cursor-pointer bg-[var(--il-bg-soft)]/10"
                      : "opacity-40 cursor-not-allowed bg-black/30"
                  }`}
                >
                  {/* Background Brand Accent Glow */}
                  {brand.active && (
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none"
                      style={{
                        background: `radial-gradient(circle at 10% 50%, ${brand.accent}55 0%, transparent 60%)`,
                      }}
                    />
                  )}

                  {/* Left Side: Brand Identity & Model Previews */}
                  <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-14 relative z-10">
                    <div className="flex items-center gap-3 sm:gap-5">
                      {/* Unified Premium Brand Logo Container */}
                      <div className="w-10 h-10 sm:w-14 sm:h-14 md:w-20 md:h-20 flex items-center justify-center bg-white/5 rounded-full p-1.5 sm:p-2.5 border border-white/10 group-hover:border-white/20 transition-all duration-300 group-hover:scale-105 group-hover:bg-white/10 select-none shadow-md">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={brand.logoSvg}
                          alt={brand.name}
                          className="max-w-full max-h-full object-contain transition-all duration-300"
                          style={{
                            filter: brand.id === "Yamaha" ? "brightness(0) invert(1)" : undefined,
                          }}
                        />
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <h3 className="text-xl sm:text-4xl md:text-5xl lg:text-6xl font-black italic tracking-wider sm:tracking-widest text-white uppercase select-none leading-none">
                          {brand.logoText}
                        </h3>
                        <span className="text-[9px] md:text-xs uppercase tracking-wider sm:tracking-[0.25em] font-semibold text-[var(--il-muted)] group-hover:text-[var(--il-titanium)] transition-colors">
                          {L(isUa, brand.descriptionEn, brand.descriptionUa)}
                        </span>
                      </div>
                    </div>

                    {brand.active && (
                      <>
                        {/* Vertical separator */}
                        <div className="hidden md:block w-[1px] h-12 bg-[var(--il-faint)]" />

                        {/* Model Previews - hidden on mobile for layout compactness */}
                        <div className="hidden md:flex flex-col gap-1">
                          <span className="text-[11px] md:text-xs uppercase tracking-widest text-[var(--il-muted)]">
                            {L(isUa, "Popular models", "Популярні моделі")}
                          </span>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base md:text-lg lg:text-xl text-[var(--il-titanium)] font-light">
                            {previewModels.map((m, idx) => (
                              <span key={m} className="flex items-center gap-3">
                                {idx > 0 && <span className="text-[var(--il-faint)]">•</span>}
                                {m}
                              </span>
                            ))}
                            <span className="text-[var(--il-muted)] ml-1 font-normal text-sm md:text-base">
                              {L(isUa, "and others...", "та інші...")}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Right Side: Accordion Trigger Icon */}
                  <div className="flex items-center gap-4 md:gap-6 relative z-10">
                    {brand.active ? (
                      <span className="hidden sm:inline-block text-sm md:text-base font-bold text-[var(--il-titanium)] tracking-wider">
                        {modelCount} {L(isUa, "models", "моделей")}
                      </span>
                    ) : (
                      <span className="hidden sm:inline-block text-xs md:text-sm font-semibold text-amber-500/80 uppercase tracking-widest">
                        {L(isUa, "Coming soon", "Незабаром")}
                      </span>
                    )}
                    <div
                      className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-[var(--il-faint)] group-hover:border-[var(--il-titanium)] flex items-center justify-center text-[var(--il-muted)] group-hover:text-white transition-all duration-300 ${
                        isExpanded ? "rotate-180 text-white border-white bg-white/5" : ""
                      }`}
                    >
                      <ChevronDown size={18} />
                    </div>
                  </div>

                  {/* Ghost bike background on the right side of header - animated slide out */}
                  {brand.active && brand.bgPhoto && (
                    <motion.div
                      className="absolute right-20 md:right-32 top-1/2 -translate-y-1/2 w-96 h-48 pointer-events-none select-none hidden lg:block"
                      style={{
                        maskImage:
                          "linear-gradient(to left, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)",
                        WebkitMaskImage:
                          "linear-gradient(to left, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)",
                      }}
                      variants={{
                        collapsed: { x: 70, opacity: 0.12, scale: 1.05 },
                        hover: { x: 0, opacity: 0.4, scale: 1.1 },
                        expanded: { x: 0, opacity: 0.48, scale: 1.1 },
                      }}
                      transition={{ type: "spring", stiffness: 100, damping: 18 }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={brand.bgPhoto} alt="" className="w-full h-full object-contain" />
                    </motion.div>
                  )}
                </motion.button>

                {/* Expanded Grid Area - Ultra Smooth Framer Motion Collapse/Expand */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden bg-[var(--il-bg)] border-t border-[var(--il-faint)]"
                    >
                      <div className="p-4 sm:p-6 md:p-10">
                        <motion.div
                          variants={gridContainerVariants}
                          initial="hidden"
                          animate="show"
                          className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6 md:gap-8"
                        >
                          {BIKES.filter((b) => b.manufacturer === brand.id).map((bike) => {
                            const count = productCountByModel.get(bike.model) ?? 0;
                            const isEmpty = count === 0;
                            return (
                              <motion.button
                                variants={bikeCardVariants}
                                key={`${bike.manufacturer}-${bike.model}`}
                                type="button"
                                onClick={() => {
                                  if (isEmpty) return;
                                  onPick(bike.manufacturer, bike.model);
                                }}
                                disabled={isEmpty}
                                className={`group relative flex flex-col text-left rounded-sm overflow-hidden transition-all duration-500 border border-[var(--il-faint)] bg-[var(--il-bg-soft)]/20 hover:bg-[var(--il-bg-soft)]/60 ${
                                  isEmpty
                                    ? "opacity-45 cursor-not-allowed"
                                    : "cursor-pointer hover:-translate-y-1.5 hover:shadow-xl"
                                }`}
                                style={{
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
                                  {/* Gradient overlay */}
                                  <div
                                    className="absolute inset-x-0 bottom-0 h-2/3 pointer-events-none"
                                    style={{
                                      background:
                                        "linear-gradient(0deg, rgba(10, 13, 18, 0.85) 0%, rgba(10, 13, 18, 0.40) 55%, transparent 100%)",
                                    }}
                                    aria-hidden
                                  />
                                  {/* Accent line on top */}
                                  <div
                                    className="absolute inset-x-0 top-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                    style={{
                                      background: `linear-gradient(90deg, transparent, ${bike.accent}, transparent)`,
                                    }}
                                    aria-hidden
                                  />

                                  {/* Overlaid title */}
                                  <div className="absolute bottom-0 left-0 right-0 px-3 py-2.5 sm:px-6 sm:py-5">
                                    <p
                                      className="text-[8px] sm:text-[9px] md:text-[10px] font-bold uppercase tracking-[0.3em] mb-0.5 sm:mb-1"
                                      style={{ color: bike.accent }}
                                    >
                                      {bike.manufacturer === "BMW Motorrad"
                                        ? "BMW Motorrad"
                                        : bike.manufacturer}
                                    </p>
                                    <h3 className="text-sm sm:text-xl md:text-2xl lg:text-3xl font-extrabold tracking-wide uppercase text-white drop-shadow-lg">
                                      {L(isUa, bike.labelEn, bike.labelUa)}
                                    </h3>
                                  </div>
                                </div>

                                {/* Info bar */}
                                <div className="flex items-center justify-between px-3.5 py-3 sm:px-6 sm:py-4 border-t border-[var(--il-faint)] bg-[var(--il-bg-soft)]/40">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[8px] sm:text-[9px] md:text-[10px] uppercase tracking-[0.25em] text-[var(--il-titanium)]">
                                      {L(isUa, bike.yearsEn, bike.yearsUa)}
                                    </span>
                                    <span className="text-[9px] sm:text-xs md:text-sm font-semibold text-[var(--il-white)]">
                                      {isEmpty
                                        ? L(isUa, "Coming soon", "Скоро")
                                        : `${count} ${L(isUa, "parts", "деталей")}`}
                                    </span>
                                  </div>
                                  {!isEmpty && (
                                    <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-[var(--il-faint)] text-[var(--il-muted)] group-hover:border-white group-hover:bg-white group-hover:text-black transition-all duration-300">
                                      <ArrowRight
                                        size={10}
                                        className="transition-transform group-hover:translate-x-0.5"
                                      />
                                    </div>
                                  )}
                                </div>
                              </motion.button>
                            );
                          })}
                        </motion.div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Skip option */}
        <div className="mt-12 md:mt-16 text-center">
          <button
            type="button"
            onClick={() => {
              onPick("all", "all");
            }}
            className="text-[11px] uppercase tracking-[0.3em] text-[var(--il-titanium)] hover:text-[var(--il-white)] transition-colors font-semibold border-b border-transparent hover:border-[var(--il-chrome)] pb-1"
          >
            {L(isUa, "Skip — browse all parts ↓", "Пропустити — переглянути все ↓")}
          </button>
        </div>
      </div>
    </div>
  );
}
