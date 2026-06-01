"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct } from "@/lib/shopCatalog";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { extractVehicleBrands, extractVehicleModelNamesForBrand } from "@/lib/akrapovicFilterUtils";

const AkrapovicLogoSvg = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 101.86088 22.968215"
    width="101.86088"
    height="22.968215"
    className={className}
    style={{ display: "block" }}
  >
    <g transform="translate(43.37092,-179.68256)">
      <g transform="matrix(0.26458333,0,0,0.26458333,-46.601834,177.14679)">
        {/* Scorpion (Red) */}
        <path
          fill="#dc0432"
          d="m 12.83,84.79 c 0.42,-2.572 3.922,-21.942 3.922,-21.942 2.1,2.795 4.052,5.333 4.619,6.029 1.199,1.484 3.894,1.752 5.977,0.085 L 44.384,54.488 25.979,32.052 C 19.087,23.274 25.285,10.084 37.141,10.084 h 57.516 c -3.855,3.281 -15.584,13.302 -17.979,15.287 -1.719,1.432 -3.654,1.862 -5.675,1.862 H 54.768 c -1.905,0 -2.834,2.115 -1.562,3.647 l 28.226,34.17 c 1.196,1.358 3.39,0.707 3.723,-1.076 l 2.834,-16.073 c 0.37,-2.066 0.919,-3.756 2.887,-5.429 2.811,-2.398 12.865,-10.95 17.912,-15.24 L 98.674,84.646 C 96.458,96.292 81.571,99.409 74.764,91.248 L 56.91,69.667 c 0,0 -25.5,21.783 -28.136,23.915 C 21.329,99.612 11.52,92.795 12.83,84.79"
        />
        {/* Letters (White) */}
        <path
          fill="#ffffff"
          d="m 395.851,18.37 c 0,0 -16.149,1.157 -17.719,1.253 -1.403,0.089 -2.661,1.204 -2.923,2.682 l -0.43,2.444 h 19.95 z m -182.574,39.523 4.259,-24.189 c 0.618,-3.501 -1.71,-6.339 -5.209,-6.339 l -21.049,0.072 -12.056,68.401 h 9.146 l 4.382,-24.871 3.423,-0.794 1.408,25.665 h 9.287 l -1.843,-28.39 c 2.9,-0.825 7.229,-3.751 8.252,-9.555 m -9.274,0.841 c -0.154,0.852 -0.71,1.263 -1.193,1.404 l -8.529,2.155 4.683,-26.555 8.104,0.036 c 0.541,0 0.903,0.437 0.805,0.979 z M 132.565,27.437 c -3.495,0 -6.822,2.839 -7.439,6.336 l -10.93,62.065 h 9.093 l 4.385,-24.871 9.611,-2.107 -4.753,26.979 h 9.005 l 12.054,-68.401 h -21.026 z m 6.248,32.774 -9.604,2.115 4.513,-25.662 c 0.094,-0.539 0.61,-0.979 1.147,-0.979 h 8.265 z m 48.969,-32.774 h -8.989 l -14.991,32.656 5.754,-32.656 h -9.101 l -12.061,68.401 h 9.106 l 4.9,-27.794 4.335,27.794 h 8.993 l -4.834,-31.409 z m 203.62,0 -14.794,0.004 c -3.499,0 -6.822,2.835 -7.43,6.327 l -9.829,55.727 c -0.617,3.499 1.692,6.398 5.191,6.398 h 14.783 c 3.499,0 6.823,-2.84 7.44,-6.332 l 3.271,-18.595 h -8.98 l -2.797,15.741 c -0.091,0.538 -0.604,0.982 -1.146,0.982 h -7.279 c -0.536,0 -0.899,-0.444 -0.805,-0.982 l 8.803,-49.965 c 0.101,-0.538 0.617,-0.979 1.151,-0.979 h 7.279 c 0.535,0 0.899,0.441 0.805,0.979 l -2.436,13.821 h 9.029 l 2.94,-16.796 c 0.617,-3.491 -1.703,-6.33 -5.196,-6.33 m -161.283,0 c -3.497,0 -6.818,2.839 -7.438,6.336 l -10.926,62.065 h 9.09 l 4.379,-24.854 9.62,-2.115 -4.758,26.969 h 9.004 l 12.055,-68.401 z m 6.251,32.774 -9.606,2.115 4.512,-25.662 c 0.098,-0.539 0.61,-0.979 1.154,-0.979 h 8.26 z m 104.052,-32.774 -13.484,50.248 4.25,-50.248 h -9.098 l -3.644,68.401 h 10.608 l 20.358,-68.401 z m 14.055,0 -12.062,68.401 h 9.111 l 12.058,-68.401 z m -70.414,6.354 c 0.62,-3.512 -1.712,-6.354 -5.222,-6.354 h -21.017 l -12.059,68.401 h 9.137 l 4.386,-24.871 12.035,-3.386 c 2.901,-0.825 7.454,-3.787 8.484,-9.609 z m -13.476,24.795 c -0.149,0.852 -0.754,1.336 -1.24,1.479 l -8.523,2.229 4.663,-26.664 h 8.196 c 0.54,0 0.903,0.44 0.805,0.982 z m 40.924,-31.149 -14.797,0.004 c -3.489,0 -6.815,2.835 -7.428,6.327 l -9.83,55.727 c -0.614,3.499 1.693,6.396 5.192,6.396 h 14.788 c 3.499,0 6.817,-2.838 7.436,-6.33 l 9.836,-55.793 c 0.62,-3.492 -1.708,-6.331 -5.197,-6.331 m -13.14,59.271 c -0.093,0.537 -0.609,0.982 -1.147,0.982 h -7.277 c -0.542,0 -0.898,-0.445 -0.807,-0.982 l 8.824,-50.179 c 0.099,-0.535 0.617,-0.975 1.151,-0.975 h 7.283 c 0.534,0 0.894,0.44 0.803,0.975 z"
        />
      </g>
    </g>
  </svg>
);
import {
  AKRAPOVIC_HERO,
  AKRAPOVIC_GALLERY,
  AKRAPOVIC_PRODUCT_LINES,
  AKRAPOVIC_HERITAGE,
} from "../data/akrapovicHomeData";
import { AKRAPOVIC_SOUNDS } from "../data/akrapovicSoundData";

// Moto data sources
import {
  AKRAPOVIC_MOTO_HERO,
  AKRAPOVIC_MOTO_GALLERY,
  AKRAPOVIC_MOTO_PRODUCT_LINES,
  AKRAPOVIC_MOTO_HERITAGE,
} from "../data/akrapovicMotoHomeData";
import { AKRAPOVIC_MOTO_SOUNDS } from "../data/akrapovicMotoSoundData";

import AkrapovicVideoBackground from "./AkrapovicVideoBackground";
import AkrapovicSoundPlayer from "./AkrapovicSoundPlayer";
import AkrapovicVehicleFilter from "./AkrapovicVehicleFilter";

type Props = {
  locale: SupportedLocale;
  products: ShopProduct[];
  viewerContext?: ShopViewerPricingContext;
};

function L(isUa: boolean, en: string, ua: string) {
  return isUa ? ua : en;
}

const formatModelLabel = (key: string): string => {
  switch (key) {
    case "S1000RR":
      return "S 1000 RR";
    case "S1000R":
      return "S 1000 R";
    case "S1000XR":
      return "S 1000 XR";
    case "M1000RR":
      return "M 1000 RR";
    case "M1000R":
      return "M 1000 R";
    case "M1000XR":
      return "M 1000 XR";
    case "R1300GS / Adventure":
      return "R 1300 GS";
    case "R1300R / RS":
      return "R 1300 R / RS";
    case "F 900 R":
      return "F 900 R / XR";
    default:
      return key;
  }
};

const extractYearsFromTitle = (title: string): number[] => {
  const years: number[] = [];
  const rangeMatches = title.matchAll(/\b(20\d{2})[-–](20\d{2})\b/g);
  for (const m of rangeMatches) {
    years.push(parseInt(m[1]), parseInt(m[2]));
  }
  const singleMatches = title.matchAll(/\((20\d{2})\)/g);
  for (const m of singleMatches) {
    years.push(parseInt(m[1]));
  }
  return years;
};

const getModelImage = (brandKey: string, modelKey: string, fallbackBrandImage: string): string => {
  if (brandKey === "BMW") {
    if (modelKey === "S1000RR") return "/images/shop/akrapovic/bmw-s1000rr.webp";
    if (modelKey === "S1000R") return "/images/shop/akrapovic/bmw-s1000rr.webp";
    if (modelKey === "S1000XR") return "/images/shop/akrapovic/bmw-s1000rr.webp";
    if (modelKey === "M1000RR") return "/images/shop/akrapovic/bmw-m1000rr.webp";
    if (modelKey === "M1000R") return "/images/shop/akrapovic/bmw-m1000rr.webp";
    if (modelKey === "M1000XR") return "/images/shop/akrapovic/bmw-m1000rr.webp";
    if (modelKey === "R1300GS / Adventure") return "/images/shop/akrapovic/bmw-r1300gs.webp";
    if (modelKey === "R1300R / RS") return "/images/shop/akrapovic/bmw-r1300gs.webp";
    if (modelKey === "F 900 R") return "/images/shop/akrapovic/bmw-s1000rr.webp";

    // Auto models
    if (modelKey.includes("M3")) return "/images/shop/akrapovic/sound-bmw-m3.jpg";
  }
  if (brandKey === "Ducati") {
    if (modelKey.includes("Panigale")) return "/images/shop/akrapovic/ducati-panigale-v2.webp";
    if (modelKey.includes("Streetfighter"))
      return "/images/shop/akrapovic/ducati-streetfighter-v2.webp";
    if (modelKey.includes("Multistrada"))
      return "/images/shop/akrapovic/ducati-multistrada-v4.webp";
  }
  return fallbackBrandImage;
};

const BrandLogo = ({ brandKey, className }: { brandKey: string; className?: string }) => {
  switch (brandKey) {
    case "BMW":
      return (
        <svg viewBox="0 0 100 100" className={className} style={{ display: "block" }}>
          <defs>
            <path id="textCircle" d="M 15,50 A 35,35 0 0,1 85,50" />
          </defs>
          <circle cx="50" cy="50" r="48" fill="#000000" stroke="#c0c0c0" strokeWidth="1.2" />
          <circle cx="50" cy="50" r="30" fill="#ffffff" stroke="#c0c0c0" strokeWidth="0.8" />
          <path d="M 50 50 L 50 20 A 30 30 0 0 0 20 50 Z" fill="#0066b2" />
          <path d="M 50 50 L 50 80 A 30 30 0 0 0 80 50 Z" fill="#0066b2" />
          <text
            fill="#ffffff"
            fontSize="13"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="900"
            letterSpacing="4"
          >
            <textPath href="#textCircle" startOffset="50%" textAnchor="middle">
              BMW
            </textPath>
          </text>
        </svg>
      );
    case "Ducati":
      return (
        <svg viewBox="0 0 100 100" className={className} style={{ display: "block" }}>
          <path
            d="M 50 10 C 25 10 20 20 20 50 C 20 75 35 90 50 95 C 65 90 80 75 80 50 C 80 20 75 10 50 10 Z"
            fill="#dc0432"
            stroke="#ffffff"
            strokeWidth="1"
          />
          <path
            d="M 32 30 C 52 30 68 45 68 62 C 68 72 60 80 50 82 C 45 70 38 52 32 30 Z"
            fill="none"
            stroke="#ffffff"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <text
            x="50"
            y="24"
            fill="#ffffff"
            fontSize="9"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="900"
            textAnchor="middle"
            letterSpacing="1"
          >
            DUCATI
          </text>
        </svg>
      );
    case "Porsche":
      return (
        <svg viewBox="0 0 100 100" className={className} style={{ display: "block" }}>
          <path
            d="M 50 10 C 30 10 25 22 25 50 C 25 72 38 88 50 94 C 62 88 75 72 75 50 C 75 22 70 10 50 10 Z"
            fill="#c99741"
            stroke="#ffffff"
            strokeWidth="1"
          />
          <text
            x="50"
            y="26"
            fill="#000000"
            fontSize="7"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="900"
            textAnchor="middle"
            letterSpacing="0.5"
          >
            PORSCHE
          </text>
          <rect x="33" y="32" width="14" height="20" fill="#dc0432" />
          <rect x="53" y="32" width="14" height="20" fill="#000000" />
          <rect x="33" y="56" width="14" height="20" fill="#000000" />
          <rect x="53" y="56" width="14" height="20" fill="#dc0432" />
        </svg>
      );
    case "Mercedes-AMG":
      return (
        <svg viewBox="0 0 100 100" className={className} style={{ display: "block" }}>
          <circle cx="50" cy="50" r="45" fill="none" stroke="#ffffff" strokeWidth="3" />
          <path
            d="M 50 10 L 50 50 L 15 70 M 50 50 L 85 70"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "Audi":
      return (
        <svg viewBox="0 0 100 100" className={className} style={{ display: "block" }}>
          <g fill="none" stroke="#ffffff" strokeWidth="2.5">
            <circle cx="32" cy="50" r="14" />
            <circle cx="44" cy="50" r="14" />
            <circle cx="56" cy="50" r="14" />
            <circle cx="68" cy="50" r="14" />
          </g>
        </svg>
      );
    case "Lamborghini":
      return (
        <svg viewBox="0 0 100 100" className={className} style={{ display: "block" }}>
          <path
            d="M 50 10 C 25 10 20 20 20 50 C 20 75 35 90 50 95 C 65 90 80 75 80 50 C 80 20 75 10 50 10 Z"
            fill="#101010"
            stroke="#d4af37"
            strokeWidth="2.5"
          />
          <text
            x="50"
            y="24"
            fill="#d4af37"
            fontSize="6.5"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="900"
            textAnchor="middle"
            letterSpacing="0.8"
          >
            LAMBORGHINI
          </text>
          <path
            d="M 40 45 C 42 42 48 42 50 48 C 52 42 58 42 60 45 C 62 48 58 65 50 72 C 42 65 38 48 40 45 Z"
            fill="#d4af37"
          />
        </svg>
      );
    case "Ferrari":
      return (
        <svg viewBox="0 0 100 100" className={className} style={{ display: "block" }}>
          <path
            d="M 50 10 C 25 10 20 20 20 50 C 20 75 35 90 50 95 C 65 90 80 75 80 50 C 80 20 75 10 50 10 Z"
            fill="#ffde00"
            stroke="#000000"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <path d="M 30 10 L 70 10 C 65 15 35 15 30 10" fill="#008f39" />
          <path
            d="M 46 65 C 44 60 44 48 48 44 C 50 40 54 38 52 32 C 55 35 56 42 54 48 C 56 45 60 48 58 54 C 54 58 52 64 56 72 C 50 72 48 68 46 65 Z"
            fill="#000000"
          />
        </svg>
      );
    default:
      return null;
  }
};

export default function AkrapovicHomeSignature({ locale, products, viewerContext }: Props) {
  const isUa = locale === "ua";
  const router = useRouter();
  const searchParams = useSearchParams();
  const segmentParam = searchParams.get("segment");

  // activeSegment state: 'auto' | 'moto' | null. If segmentParam is provided, use it. Otherwise show portal.
  const [activeSegment, setActiveSegment] = useState<"auto" | "moto" | null>(() => {
    if (segmentParam === "auto") return "auto";
    if (segmentParam === "moto") return "moto";
    return null; // Show portal by default if no segment is active
  });

  // Sync state with URL parameter changes (e.g. from header switcher)
  useEffect(() => {
    if (segmentParam === "auto") {
      setActiveSegment("auto");
    } else if (segmentParam === "moto") {
      setActiveSegment("moto");
    } else {
      setActiveSegment(null);
    }
  }, [segmentParam]);

  const handleSegmentChange = (seg: "auto" | "moto" | null) => {
    setActiveSegment(seg);
    const params = new URLSearchParams(window.location.search);
    if (seg) {
      params.set("segment", seg);
    } else {
      params.delete("segment");
    }
    router.push(`${window.location.pathname}?${params.toString()}`);
  };

  /* ── Scroll reveal observer ── */
  useEffect(() => {
    if (activeSegment === null) return;
    const els = document.querySelectorAll("[data-ak-reveal]");
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("ak-vis");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [activeSegment]);

  // Determine current active data
  const isMoto = activeSegment === "moto";
  const currentHero = isMoto ? AKRAPOVIC_MOTO_HERO : AKRAPOVIC_HERO;
  const currentGallery = isMoto ? AKRAPOVIC_MOTO_GALLERY : AKRAPOVIC_GALLERY;
  const currentLines = isMoto ? AKRAPOVIC_MOTO_PRODUCT_LINES : AKRAPOVIC_PRODUCT_LINES;
  const currentSounds = isMoto ? AKRAPOVIC_MOTO_SOUNDS : AKRAPOVIC_SOUNDS;
  const currentHeritage = isMoto ? AKRAPOVIC_MOTO_HERITAGE : AKRAPOVIC_HERITAGE;

  // Filter products by scope
  const filteredProducts = products.filter((p) => {
    if (isMoto) return p.scope === "moto";
    return p.scope !== "moto";
  });

  // Map product to its vehicle brands
  const productBrandMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of filteredProducts) {
      const title = p.title?.en || "";
      const brands = extractVehicleBrands(title);
      if (brands.length > 0) map.set(p.slug, brands);
    }
    return map;
  }, [filteredProducts]);

  // Group models by brand
  const brandModelsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        label: string;
        years?: string;
        filterYear?: string;
        reactKey: string;
        generations?: { label: string; filterYear: string }[];
      }[]
    >();
    const targetBrands = isMoto
      ? ["BMW", "Ducati"]
      : ["BMW", "Porsche", "Mercedes-AMG", "Audi", "Lamborghini", "Ferrari"];

    for (const brand of targetBrands) {
      const modelsSet = new Set<string>();
      const modelProductsMap = new Map<string, typeof filteredProducts>();

      for (const p of filteredProducts) {
        const isMatched =
          productBrandMap.get(p.slug)?.includes(brand) ||
          (brand === "Mercedes-AMG" &&
            (productBrandMap.get(p.slug)?.includes("Mercedes-Benz") ||
              productBrandMap.get(p.slug)?.includes("Mercedes-AMG")));
        if (!isMatched) continue;

        const title = p.title?.en || "";
        const models = extractVehicleModelNamesForBrand(title, brand);
        for (const model of models) {
          if (model) {
            modelsSet.add(model);
            if (!modelProductsMap.has(model)) {
              modelProductsMap.set(model, []);
            }
            modelProductsMap.get(model)!.push(p);
          }
        }
      }

      const sortedModels: {
        key: string;
        label: string;
        years?: string;
        filterYear?: string;
        reactKey: string;
        generations?: { label: string; filterYear: string }[];
      }[] = [];
      const extractedList = Array.from(modelsSet).sort((a, b) => a.localeCompare(b));

      for (const m of extractedList) {
        const matchingProducts = modelProductsMap.get(m) || [];
        const allYears: number[] = [];
        for (const p of matchingProducts) {
          const title = p.title?.en || "";
          allYears.push(...extractYearsFromTitle(title));
        }
        let yearsStr: string | undefined = undefined;
        if (allYears.length > 0) {
          const min = Math.min(...allYears);
          const max = Math.max(...allYears);
          yearsStr = min === max ? `${min}` : `${min}-${max}`;
        }

        const splitModels = [
          "S1000RR",
          "S1000R",
          "S1000XR",
          "M1000RR",
          "M1000R",
          "M1000XR",
          "Multistrada V4 / S / RS / RALLY",
        ];
        if (isMoto && (brand === "BMW" || brand === "Ducati") && splitModels.includes(m)) {
          sortedModels.push({
            key: m,
            label: m,
            years: yearsStr || (brand === "Ducati" ? "2021-2026" : "2019-2026"),
            reactKey: m,
            generations: [
              { label: brand === "Ducati" ? "2021-2024" : "2019-2024", filterYear: "2024" },
              { label: "2025+", filterYear: "2025" },
            ],
          });
        } else {
          sortedModels.push({
            key: m,
            label: m,
            years: yearsStr,
            reactKey: m,
          });
        }
      }
      map.set(brand, sortedModels);
    }
    return map;
  }, [filteredProducts, productBrandMap, isMoto]);

  const [expandedBrands, setExpandedBrands] = useState<Record<string, boolean>>({});
  const [activeModalModel, setActiveModalModel] = useState<null | {
    key: string;
    label: string;
    brand: string;
    isMoto: boolean;
    generations: { label: string; filterYear: string }[];
  }>(null);
  const isAnyBrandExpanded = useMemo(
    () => Object.values(expandedBrands).some(Boolean),
    [expandedBrands]
  );

  const toggleBrandExpand = (brand: string) => {
    setExpandedBrands((prev) => ({
      ...prev,
      [brand]: !prev[brand],
    }));
  };

  // Portal selection page
  if (activeSegment === null) {
    return (
      <div className="ak-portal">
        {/* Left Side: Auto */}
        <button
          onClick={() => handleSegmentChange("auto")}
          className="ak-portal__side ak-portal__side--auto group"
          aria-label={L(isUa, "Enter Auto Division", "Перейти до розділу Авто")}
        >
          <div className="ak-portal__bg ak-portal__bg--auto" />
          <div className="ak-portal__overlay" />
          <div className="ak-portal__side-content">
            <span className="ak-portal__subtitle">Akrapovič</span>
            <h2 className="ak-portal__title">Auto</h2>
            <span className="ak-portal__cta-text">
              {L(isUa, "Enter Division", "Перейти до розділу")} →
            </span>
          </div>
        </button>

        {/* Right Side: Moto */}
        <button
          onClick={() => handleSegmentChange("moto")}
          className="ak-portal__side ak-portal__side--moto group"
          aria-label={L(isUa, "Enter Moto Division", "Перейти до розділу Мото")}
        >
          <div className="ak-portal__bg ak-portal__bg--moto" />
          <div className="ak-portal__overlay" />
          <div className="ak-portal__side-content">
            <span className="ak-portal__subtitle">Akrapovič</span>
            <h2 className="ak-portal__title ak-portal__title--moto">Moto</h2>
            <span className="ak-portal__cta-text">
              {L(isUa, "Enter Division", "Перейти до розділу")} →
            </span>
          </div>
        </button>

        {/* Central Logo */}
        <div className="ak-portal__logo-wrap">
          <AkrapovicLogoSvg className="ak-portal__logo" />
        </div>

        {/* Subtle Portal Footer */}
        <footer className="ak-portal__footer">
          <Link href={`/${locale}/shop`} className="ak-portal__footer-link">
            ← {L(isUa, "Back to all stores", "Назад до всіх магазинів")}
          </Link>
          <div className="ak-portal__footer-divider" />
          <span className="ak-portal__footer-text">
            One Company × Akrapovič Official Retail Partner
          </span>
          <div className="ak-portal__footer-divider" />
          <span className="ak-portal__footer-text">© {new Date().getFullYear()} One Company</span>
        </footer>
      </div>
    );
  }

  return (
    <div className={`ak-home ${activeSegment ? "ak-home--has-switcher" : ""}`} id="AkrapovicHome">
      {/* ════════════════════════════════════════════════════════════════
          SECTION 1 — CINEMATIC HERO (full viewport, center-aligned)
      ════════════════════════════════════════════════════════════════ */}
      <section className="ak-hero" id="ak-hero-section">
        <AkrapovicVideoBackground
          videoSrc={currentHero.heroVideoUrl}
          fallbackImage={currentHero.heroImageFallback}
          fallbackWidth={currentHero.heroImageWidth}
          fallbackHeight={currentHero.heroImageHeight}
          overlayStyle="hero"
          withAudio
          isMuted
        />

        <div
          className={`ak-hero__content ${isAnyBrandExpanded ? "ak-hero__content--expanded" : ""}`}
        >
          <div className="ak-hero__logo-wrapper">
            <AkrapovicLogoSvg className="ak-hero__logo" />
          </div>

          <p className="ak-hero__overtitle">One Company × Akrapovič {isMoto ? "Moto" : "Auto"}</p>

          <h1 className="sr-only">
            {isMoto
              ? L(
                  isUa,
                  "Akrapovič Exhaust Systems | Motorcycle Racing",
                  "Мотоциклетні вихлопні системи Akrapovič | Перегони та Трек"
                )
              : L(
                  isUa,
                  "Akrapovič Exhaust Systems | Titanium & Carbon",
                  "Автомобільні вихлопні системи Akrapovič | Титан і Карбон"
                )}
          </h1>
          <p className="ak-hero__title">
            {L(isUa, "The Sound of", "Звук")}
            <br />
            <em>
              {isMoto ? L(isUa, "Racing", "Перегонів") : L(isUa, "Perfection", "Досконалості")}
            </em>
          </p>

          <p className="ak-hero__subtitle">
            {L(isUa, currentHero.subtitle, currentHero.subtitleUk)}
          </p>

          <AkrapovicVehicleFilter
            locale={locale}
            products={filteredProducts}
            viewerContext={viewerContext}
            productPathPrefix={`/${locale}/shop/akrapovic/products`}
            filterOnly
            heroCompact
          />

          {/* Interactive Brand Selector List (Ilmberger style) */}
          <div
            className={`ak-hero__brands-list-wrapper ${isAnyBrandExpanded ? "ak-hero__brands-list-wrapper--expanded" : ""}`}
          >
            <span className="ak-hero__brands-title">
              {L(isUa, "Or select manufacturer", "Або оберіть виробника")}
            </span>
            <div className="ak-brands-list">
              {(isMoto
                ? [
                    {
                      key: "BMW",
                      label: "BMW Motorrad",
                      image: "/images/shop/akrapovic/bmw-s1000rr.webp",
                      accent: "bmw-moto",
                    },
                    {
                      key: "Ducati",
                      label: "DUCATI",
                      image: "/images/shop/akrapovic/ducati-panigale-v2.webp",
                      accent: "ducati",
                    },
                  ]
                : [
                    {
                      key: "BMW",
                      label: "BMW",
                      image: "/images/shop/akrapovic/sound-bmw-m3.jpg",
                      accent: "bmw",
                    },
                    {
                      key: "Porsche",
                      label: "PORSCHE",
                      image: "/images/shop/akrapovic/sound-porsche-911-v2.jpg",
                      accent: "porsche",
                    },
                    {
                      key: "Mercedes-AMG",
                      label: "MERCEDES-AMG",
                      image: "/images/shop/akrapovic/sound-mercedes-g63-v2.jpg",
                      accent: "mercedes",
                    },
                    {
                      key: "Audi",
                      label: "AUDI",
                      image: "/images/shop/akrapovic/sound-audi-rs6-v2.jpg",
                      accent: "audi",
                    },
                    {
                      key: "Lamborghini",
                      label: "LAMBORGHINI",
                      image: "/images/shop/akrapovic/sound-lamborghini-huracan.jpg",
                      accent: "lamborghini",
                    },
                    {
                      key: "Ferrari",
                      label: "FERRARI",
                      image: "/images/shop/akrapovic/sound-ferrari-488.jpg",
                      accent: "ferrari",
                    },
                  ]
              ).map((b) => {
                const brandHref = `/${locale}/shop/akrapovic/collections?brand=${encodeURIComponent(b.key)}${isMoto ? "&scope=moto" : ""}`;
                const allModels = brandModelsMap.get(b.key) || [];
                const isExpanded = expandedBrands[b.key] || false;
                const visibleModels = isExpanded ? allModels : allModels.slice(0, 3);

                if (isExpanded) {
                  return (
                    <div
                      key={b.key}
                      className={`ak-brand-row-card ak-brand-row-card--${b.accent} ak-brand-row-card--expanded cursor-pointer`}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (
                          target.tagName !== "A" &&
                          !target.closest("a") &&
                          target.tagName !== "BUTTON"
                        ) {
                          toggleBrandExpand(b.key);
                        }
                      }}
                    >
                      {/* Header Row */}
                      <div className="ak-brand-row-card__header">
                        <div className="ak-brand-row-card__header-left">
                          <div className="ak-brand-row-card__title-row">
                            <BrandLogo brandKey={b.key} className="ak-brand-row-card__logo-icon" />
                            <span className="ak-brand-row-card__title">{b.label}</span>
                          </div>
                          <span className="ak-brand-row-card__subtitle-expanded">
                            {L(
                              isUa,
                              `${allModels.length} models available`,
                              `Доступно ${allModels.length} моделей`
                            )}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleBrandExpand(b.key);
                          }}
                          className="ak-brand-row-card__collapse-btn"
                          aria-label={L(isUa, "Collapse", "Згорнути")}
                        >
                          <ChevronUp size={20} />
                        </button>
                      </div>

                      {/* Models Grid */}
                      <div className="ak-brand-row-card__models-grid">
                        {allModels.map((m, index) => {
                          const modelHref = `/${locale}/shop/akrapovic/collections?brand=${encodeURIComponent(
                            b.key
                          )}&model=${encodeURIComponent(m.key)}${isMoto ? "&scope=moto" : ""}${
                            m.filterYear ? `&year=${m.filterYear}` : ""
                          }`;
                          const modelImage = getModelImage(b.key, m.key, b.image);

                          if (m.generations) {
                            return (
                              <div
                                key={m.reactKey}
                                className="ak-model-grid-card cursor-pointer"
                                style={
                                  { animationDelay: `${index * 0.05}s` } as React.CSSProperties
                                }
                                onClick={() => {
                                  setActiveModalModel({
                                    key: m.key,
                                    label: m.label,
                                    brand: b.key,
                                    isMoto,
                                    generations: m.generations || [],
                                  });
                                }}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={modelImage}
                                  alt={m.label}
                                  className="ak-model-grid-card__bg"
                                />
                                <div className="ak-model-grid-card__overlay" />
                                {m.years && (
                                  <span className="ak-model-grid-card__year-badge">{m.years}</span>
                                )}
                                <div className="ak-model-grid-card__info">
                                  <span className="ak-model-grid-card__name">
                                    {formatModelLabel(m.label)}
                                  </span>
                                  <div className="ak-model-grid-card__footer">
                                    <span className="ak-model-grid-card__cta">
                                      {L(isUa, "Select Year →", "Обрати рік →")}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <Link
                              key={m.reactKey}
                              href={modelHref}
                              className="ak-model-grid-card"
                              style={{ animationDelay: `${index * 0.05}s` } as React.CSSProperties}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={modelImage}
                                alt={m.label}
                                className="ak-model-grid-card__bg"
                              />
                              <div className="ak-model-grid-card__overlay" />
                              {m.years && (
                                <span className="ak-model-grid-card__year-badge">{m.years}</span>
                              )}
                              <div className="ak-model-grid-card__info">
                                <span className="ak-model-grid-card__name">
                                  {formatModelLabel(m.label)}
                                </span>
                                <div className="ak-model-grid-card__footer">
                                  <span className="ak-model-grid-card__cta">
                                    {L(isUa, "Explore Catalog →", "Переглянути каталог →")}
                                  </span>
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>

                      {/* Right side: Watermark / Background silhouette image */}
                      <div className="ak-brand-row-card__watermark-wrap">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={b.image}
                          alt=""
                          aria-hidden="true"
                          className="ak-brand-row-card__watermark"
                        />
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={b.key}
                    className={`ak-brand-row-card ak-brand-row-card--${b.accent} ${allModels.length > 3 ? "ak-brand-row-card--has-chevron" : ""} cursor-pointer`}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (
                        target.tagName !== "A" &&
                        !target.closest("a") &&
                        target.tagName !== "BUTTON"
                      ) {
                        toggleBrandExpand(b.key);
                      }
                    }}
                  >
                    {/* Left vehicle image */}
                    <div className="ak-brand-row-card__img-wrap">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.image} alt={b.label} className="ak-brand-row-card__img" />
                    </div>

                    {/* Middle: Brand name + Models list */}
                    <div className="ak-brand-row-card__content">
                      <div className="ak-brand-row-card__title-row">
                        <BrandLogo brandKey={b.key} className="ak-brand-row-card__logo-icon" />
                        <Link href={brandHref} className="ak-brand-row-card__title">
                          {b.label}
                        </Link>
                      </div>
                      <ul className="ak-brand-row-card__models">
                        {visibleModels.map((m) => {
                          const modelHref = `/${locale}/shop/akrapovic/collections?brand=${encodeURIComponent(
                            b.key
                          )}&model=${encodeURIComponent(m.key)}${
                            isMoto ? "&scope=moto" : ""
                          }${m.filterYear ? `&year=${m.filterYear}` : ""}`;
                          return (
                            <li key={m.reactKey}>
                              <Link href={modelHref}>
                                • {formatModelLabel(m.label)}
                                {m.years ? ` (${m.years})` : ""}
                              </Link>
                            </li>
                          );
                        })}
                        {allModels.length > 3 ? (
                          <li>
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent card onClick double trigger
                                toggleBrandExpand(b.key);
                              }}
                              className="ak-brand-row-card__toggle-btn"
                            >
                              • {L(isUa, "Show all", "Показати всі")} {allModels.length}
                            </button>
                          </li>
                        ) : allModels.length > 0 ? (
                          <li>
                            <Link href={brandHref} className="ak-brand-row-card__more-link">
                              • {L(isUa, "More models...", "Ще моделі...")}
                            </Link>
                          </li>
                        ) : null}
                      </ul>
                    </div>

                    {/* Right side: Watermark / Background silhouette image */}
                    <div className="ak-brand-row-card__watermark-wrap">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={b.image}
                        alt=""
                        aria-hidden="true"
                        className="ak-brand-row-card__watermark"
                      />
                    </div>

                    {/* Centered Chevron indicator at the bottom */}
                    {allModels.length > 3 && (
                      <div className="ak-brand-row-card__chevron-bar">
                        <ChevronDown size={14} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="ak-hero__scroll" aria-hidden>
          <div className="ak-hero__scroll-line" />
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2 — GALLERY MASONRY (real official photos)
      ════════════════════════════════════════════════════════════════ */}
      <section className="ak-gallery" data-ak-reveal>
        <div className="ak-gallery__grid">
          {currentGallery.map((item, index) => (
            <article
              key={item.id}
              className={`ak-gallery__card${index === 0 ? " ak-gallery__card--featured" : ""}`}
            >
              <div className="ak-gallery__media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image}
                  alt=""
                  width={item.width}
                  height={item.height}
                  loading="lazy"
                  decoding="async"
                  aria-hidden="true"
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 3 — PRODUCT LINES (horizontal scroll cards)
      ════════════════════════════════════════════════════════════════ */}
      <section className="ak-lines" data-ak-reveal>
        <div className="ak-lines__header">
          <span className="ak-label">{L(isUa, "Product Lines", "Лінійки продукції")}</span>
          <h2 className="ak-section-title">
            {isMoto
              ? L(isUa, "Built for Your Bike", "Створено для вашого байка")
              : L(isUa, "Engineered for Your Machine", "Створено для вашої машини")}
          </h2>
          <div className="ak-divider ak-divider--center" />
        </div>

        <div className="ak-lines__track">
          {currentLines.map((line) => (
            <Link key={line.id} href={`/${locale}${line.link}`} className="ak-line-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="ak-line-card__img"
                src={line.image}
                alt={L(isUa, line.name, line.nameUk)}
                width={line.imageWidth}
                height={line.imageHeight}
                loading="lazy"
                decoding="async"
              />
              <div className="ak-line-card__overlay" />
              <span className="ak-line-card__badge">{L(isUa, line.badge, line.badgeUk)}</span>
              <div className="ak-line-card__content">
                <h3 className="ak-line-card__name">{L(isUa, line.name, line.nameUk)}</h3>
                <p className="ak-line-card__desc">
                  {L(isUa, line.description, line.descriptionUk)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 4 — SOUND COMPARISON GRID (interactive audio)
      ════════════════════════════════════════════════════════════════ */}
      <section className="ak-sounds" data-ak-reveal>
        <div className="ak-sounds__header">
          <span className="ak-label">{L(isUa, "Hear the difference", "Почуйте різницю")}</span>
          <h2 className="ak-section-title">
            {L(isUa, "Every Engine Has Its Voice", "Кожен двигун має свій голос")}
          </h2>
          <p className="ak-section-sub" style={{ margin: "1.5rem auto 0" }}>
            {isMoto
              ? L(
                  isUa,
                  "Click on any motorcycle to hear the Akrapovič exhaust note. Short clips captured at our test facility.",
                  "Натисніть на будь-який мотоцикл, щоб почути звук вихлопу Akrapovič. Короткі записи з нашого тестувального полігону."
                )
              : L(
                  isUa,
                  "Click on any car to hear the Akrapovič exhaust note. Short clips captured at our test facility.",
                  "Натисніть на будь-яке авто, щоб почути звук вихлопу Akrapovič. Короткі записи з нашого тестувального полігону."
                )}
          </p>
          <div className="ak-divider ak-divider--center" />
        </div>

        <div className="ak-sounds__grid">
          {currentSounds.map((entry) => (
            <AkrapovicSoundPlayer key={entry.id} entry={entry} isUa={isUa} />
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 5 — SOUND WAVE DIVIDER
      ════════════════════════════════════════════════════════════════ */}
      <div className="ak-wave" aria-hidden>
        {Array.from({ length: 40 }).map((_, i) => {
          const h = 8 + ((i * 13) % 24);
          return (
            <div
              key={i}
              className="ak-wave__bar"
              style={
                {
                  "--h": `${h}px`,
                  animationDelay: `${Number((i * 0.06).toFixed(2))}s`,
                } as React.CSSProperties
              }
            />
          );
        })}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 6 — HERITAGE (video background + storytelling)
      ════════════════════════════════════════════════════════════════ */}
      <section className="ak-heritage" data-ak-reveal>
        <AkrapovicVideoBackground
          videoSrc={currentHeritage.videoUrl}
          fallbackImage={currentHeritage.fallbackImage}
          fallbackWidth={currentHeritage.fallbackWidth}
          fallbackHeight={currentHeritage.fallbackHeight}
          overlayStyle="heritage"
          defer
        />

        <div className="ak-heritage__content">
          <span className="ak-label">{L(isUa, "Heritage", "Спадщина")}</span>
          <h2 className="ak-heritage__title">
            {L(isUa, currentHeritage.title, currentHeritage.titleUk)}
          </h2>
          <div className="ak-divider ak-divider--center" />
          <p className="ak-heritage__desc">
            {L(isUa, currentHeritage.description, currentHeritage.descriptionUk)}
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 7 — BOTTOM CTA (single, subtle)
      ════════════════════════════════════════════════════════════════ */}
      <div className="ak-bottom-cta" data-ak-reveal>
        <span className="ak-label">{L(isUa, "Ready to upgrade?", "Готові до апгрейду?")}</span>
        <br />
        <Link
          href={`/${locale}/shop/akrapovic/collections${isMoto ? "?scope=moto" : ""}`}
          className="ak-btn"
        >
          {L(isUa, "Explore Catalog", "Переглянути каталог")}
          <svg viewBox="0 0 24 24">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </Link>
      </div>

      {/* Premium Year Selection Modal */}
      {activeModalModel && (
        <div className="ak-modal-backdrop" onClick={() => setActiveModalModel(null)}>
          <div className="ak-modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="ak-modal-close"
              onClick={() => setActiveModalModel(null)}
              aria-label={L(isUa, "Close", "Закрити")}
            >
              <X size={18} />
            </button>

            <div className="ak-modal-brand-label">{activeModalModel.brand} MOTORRAD</div>

            <h3 className="ak-modal-model-title">{formatModelLabel(activeModalModel.label)}</h3>

            <div className="ak-modal-divider" />

            <p className="ak-modal-subtitle">
              {L(isUa, "Select production year:", "Оберіть рік випуску:")}
            </p>

            <div className="ak-modal-options">
              {activeModalModel.generations.map((gen) => {
                const href = `/${locale}/shop/akrapovic/collections?brand=${encodeURIComponent(
                  activeModalModel.brand
                )}&model=${encodeURIComponent(activeModalModel.key)}${
                  activeModalModel.isMoto ? "&scope=moto" : ""
                }&year=${gen.filterYear}`;

                return (
                  <Link
                    key={gen.filterYear}
                    href={href}
                    className="ak-modal-option-btn group"
                    onClick={() => setActiveModalModel(null)}
                  >
                    <span className="ak-modal-option-year">{gen.label}</span>
                    <span className="ak-modal-option-arrow">{L(isUa, "Select →", "Обрати →")}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
