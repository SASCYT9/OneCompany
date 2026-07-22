"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useParams, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import {
  Search,
  ChevronDown,
  Package,
  Loader2,
  X,
  Check,
  Copy,
  LayoutGrid,
  List,
  SlidersHorizontal,
  Minus,
  Plus,
  CircleAlert,
  ShieldCheck,
} from "lucide-react";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { StockAiAssistant } from "@/components/shop/StockAiAssistant";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { DEFAULT_CURRENCY_RATES } from "@/lib/shopAdminSettings";
import {
  convertShopCurrencyAmount,
  convertShopMoney,
  formatShopMoney,
  type ShopCurrencyCode,
  type ShopPriceSet,
} from "@/lib/shopMoneyFormat";
import { parseShopStockParamList } from "@/lib/shopStockSearchParams";
import { SHOP_STOCK_CATEGORY_GROUPS } from "@/lib/shopStockTaxonomy";
import { resolveShopCatalogProductHref } from "@/lib/shopStorefrontRouting";
import { getVehicleMakeLogoPath, normalizeVehicleMakeName } from "@/lib/vehicleMakeLogos";
import {
  cleanShopAiProductKind,
  formatShopAiProductKind,
  type ShopAiProductKind,
} from "@/lib/shopAiProductKind";

type StockItem = {
  id: string;
  name: string;
  brand: string;
  partNumber: string;
  description: string;
  thumbnail: string | null;
  inStock: boolean;
  price: number | null;
  priceUsd?: number;
  priceEur?: number;
  priceUah?: number;
  priceSet?: ShopPriceSet | null;
  originalPrice?: number | null;
  originalPriceSet?: ShopPriceSet | null;
  basePrice: number;
  markupPct: number;
  slug: string;
  href?: string | null;
  variantId: string | null;
  turn14Id: string;
  category?: string | null;
  matchStatus?: "exact" | "requires_verification";
  missingFacts?: string[];
  matchReason?: string;
  matchedApplicationId?: string | null;
};

type StockFilter = "all" | "inStock" | "preOrder";
type StockSort = "default" | "price_asc" | "price_desc" | "name_asc";
type VehicleMode = "auto" | "moto";

type StockSuggestion =
  | {
      type: "product";
      id: string;
      name: string;
      brand: string;
      partNumber: string;
      thumbnail: string | null;
      slug: string;
      href?: string | null;
      category: string;
    }
  | { type: "brand"; id: string; label: string; count?: number }
  | {
      type: "vehicle";
      id: string;
      label: string;
      make: string;
      model?: string;
      count?: number;
    };

type FilterStats = {
  brands: Array<{ label: string; count: number }>;
  categories: Array<{ label: string; count: number }>;
  stock: {
    all: number;
    inStock: number;
    preOrder: number;
  };
  price?: {
    min: number;
    max: number;
    currency?: string;
  };
};

type StockSearchResponse = {
  data?: StockItem[];
  error?: string;
  meta?: {
    totalPages?: number;
    totalItems?: number;
    fallbackApplied?: "fitment" | "all" | null;
  };
  filters?: {
    brands?: string[];
    categories?: string[];
    price?: FilterStats["price"];
  };
  filterStats?: FilterStats;
  globalFilterStats?: FilterStats;
};

const STOCK_LABELS: Record<StockFilter, { ua: string; en: string }> = {
  all: { ua: "Усі", en: "All" },
  inStock: { ua: "В наявності", en: "In stock" },
  preOrder: { ua: "Під замовлення", en: "Pre-order" },
};

const SORT_LABELS: Record<StockSort, { ua: string; en: string }> = {
  default: { ua: "Рекомендовані", en: "Recommended" },
  price_asc: { ua: "Ціна: від меншої", en: "Price: low to high" },
  price_desc: { ua: "Ціна: від більшої", en: "Price: high to low" },
  name_asc: { ua: "Назва A-Z", en: "Name A-Z" },
};

const normalizeStockPriceParam = (value: string) => value.trim().replace(",", ".");

const getUkrainianPlural = (count: number, one: string, few: string, many: string) => {
  const absolute = Math.abs(count);
  const lastTwoDigits = absolute % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return many;
  const lastDigit = absolute % 10;
  if (lastDigit === 1) return one;
  if (lastDigit >= 2 && lastDigit <= 4) return few;
  return many;
};
const sanitizeStockPriceInput = (value: string) => value.replace(/[^\d.,]/g, "");
const normalizeFacetSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const VEHICLE_MODE_ICON_MASK: Record<VehicleMode, string> = {
  auto: "/images/icons/vehicle/sport-car-icon.svg",
  moto: "/images/icons/vehicle/sport-bike-motorcycle-icon.svg",
};

function PremiumVehicleIcon({
  mode,
  className = "h-4 w-4",
}: {
  mode: VehicleMode;
  className?: string;
}) {
  const maskImage = `url("${VEHICLE_MODE_ICON_MASK[mode]}")`;

  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 ${className}`}
      style={{
        backgroundColor: "currentColor",
        WebkitMaskImage: maskImage,
        maskImage,
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        transform: "scaleX(-1)",
      }}
    />
  );
}

function SmartScrollArea({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

      const deltaMultiplier =
        event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? element.clientHeight : 1;
      const delta = event.deltaY * deltaMultiplier;
      const canScrollUp = delta < 0 && element.scrollTop > 0;
      const canScrollDown =
        delta > 0 && element.scrollTop + element.clientHeight < element.scrollHeight - 1;

      if (!canScrollUp && !canScrollDown) return;

      event.preventDefault();
      event.stopPropagation();
      element.scrollTop = Math.max(
        0,
        Math.min(element.scrollHeight - element.clientHeight, element.scrollTop + delta)
      );
    };

    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, []);

  return (
    <div ref={scrollRef} className={className}>
      {children}
    </div>
  );
}

const POPULAR_VEHICLE_MAKES = [
  "BMW",
  "Mercedes-Benz",
  "Audi",
  "Porsche",
  "Volkswagen",
  "Toyota",
  "Lexus",
  "Land Rover",
  "Range Rover",
  "Lamborghini",
  "Ferrari",
  "McLaren",
];

const DARK_VEHICLE_MAKE_LOGOS = new Set(
  [
    "Audi",
    "Bentley",
    "Cadillac",
    "Chrysler",
    "Cupra",
    "DS",
    "Genesis",
    "Infiniti",
    "Jaguar",
    "Jeep",
    "Maserati",
    "McLaren",
    "Mercedes-AMG",
    "Mini",
    "Nissan",
    "Rolls-Royce",
    "Smart",
    "SsangYong",
    "Toyota",
  ].map(normalizeVehicleMakeName)
);

/* ========= Brand Logo Helper ========= */
const normalizeBrandLogoName = (brandName: string) =>
  brandName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const getBrandLogoPath = (brandName: string): string | null => {
  const b = normalizeBrandLogoName(brandName);
  if (b.includes("akrapovic")) return "/logos/akrapovic.svg";
  if (b.includes("adro")) return "/images/shop/adro/adro-logo-white.svg";
  if (b.includes("brabus")) return "/logos/brabus.svg";
  if (b.includes("racechip")) return "/logos/racechip.png";
  if (b.includes("do88")) return "/logos/do88.png";
  if (b.includes("csf")) return "/images/shop/csf/csf-logo-white.png";
  if (b.includes("ohlins")) return "/logos/ohlins.svg";
  if (b.includes("girodisc")) return "/images/shop/girodisc/girodisc-logo-white.svg";
  if (b.includes("ilmberger")) return "/logos/ilmberger-carbon-dark.png";
  if (b.includes("ipe exhaust") || b === "ipe" || b.includes("innotech performance"))
    return "/images/shop/ipe/ipe-logo.png";
  if (b.includes("burger")) return "/logos/burger-motorsport.svg";
  if (b.includes("kw")) return "/logos/kw-suspension.svg";
  if (b.includes("urban")) return "/logos/urban-automotive.svg";
  if (b.includes("vf engineering") || b.includes("vf-engineering"))
    return "/logos/vf-engineering.png";
  if (b.includes("vorsteiner")) return "/logos/vorsteiner.png";
  if (b.includes("eventuri")) return "/brands/eventuri-logo.svg";
  if (b.includes("remus")) return "/logos/remus-dark.png";
  if (b.includes("fi exhaust") || b.includes("fi-exhaust")) return "/logos/fi-exhaust.svg";
  return null;
};

const getBrandLightLogoPath = (brandName: string, fallback: string): string => {
  const b = normalizeBrandLogoName(brandName);
  if (b.includes("adro")) return "/images/shop/adro/adro-logo.svg";
  if (b.includes("csf")) return "/images/shop/csf/csf-logo.svg";
  if (b.includes("girodisc")) return "/logos/girodisc.webp";
  if (b.includes("ilmberger")) return "/logos/ilmberger-carbon-transparent.webp";
  if (b.includes("ipe exhaust") || b === "ipe" || b.includes("innotech performance"))
    return "/logos/ipe-exhaust.webp";
  if (b.includes("remus")) return "/logos/remus.png";
  return fallback;
};

const LOGO_CONTRAST_LIFT_BRANDS = [
  "akrapovic",
  "akrapovi",
  "burger",
  "girodisc",
  "ipe",
  "kw",
  "remus",
  "urban",
  "vf engineering",
  "vorsteiner",
];

const LOGO_INVERT_BRANDS = ["brabus"];

const LOGO_LIGHT_INVERT_BRANDS = ["racechip", "do88", "urban"];

const LOGO_LIGHT_OUTLINE_BRANDS = ["akrapovic", "akrapovi", "burger"];

const LOGO_WIDE_MARK_BRANDS = [
  "akrapovic",
  "akrapovi",
  "brabus",
  "burger",
  "girodisc",
  "ilmberger",
  "ohlins",
  "racechip",
  "remus",
  "urban",
];

function brandLogoNeedsContrastLift(brandName: string) {
  const normalized = normalizeBrandLogoName(brandName);
  return LOGO_CONTRAST_LIFT_BRANDS.some((brand) => normalized.includes(brand));
}

function brandLogoNeedsInvert(brandName: string) {
  const normalized = normalizeBrandLogoName(brandName);
  return LOGO_INVERT_BRANDS.some((brand) => normalized.includes(brand));
}

function brandLogoNeedsLightInvert(brandName: string) {
  const normalized = normalizeBrandLogoName(brandName);
  return LOGO_LIGHT_INVERT_BRANDS.some((brand) => normalized.includes(brand));
}

function brandLogoNeedsLightOutline(brandName: string) {
  const normalized = normalizeBrandLogoName(brandName);
  return LOGO_LIGHT_OUTLINE_BRANDS.some((brand) => normalized.includes(brand));
}

function brandLogoNeedsWideBoost(brandName: string) {
  const normalized = normalizeBrandLogoName(brandName);
  return LOGO_WIDE_MARK_BRANDS.some((brand) => normalized.includes(brand));
}

function BrandLogoTile({
  brandName,
  logoPath,
  size = "sm",
  className = "",
}: {
  brandName: string;
  logoPath: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [logoPath]);

  if (!logoPath) return null;

  const needsContrastLift = brandLogoNeedsContrastLift(brandName);
  const needsInvert = brandLogoNeedsInvert(brandName);
  const needsLightInvert = brandLogoNeedsLightInvert(brandName);
  const needsLightOutline = brandLogoNeedsLightOutline(brandName);
  const needsWideBoost = brandLogoNeedsWideBoost(brandName);
  const lightThemeLogoPath = getBrandLightLogoPath(brandName, logoPath);
  const hasThemeSpecificLogo = lightThemeLogoPath !== logoPath;
  const sizeClass =
    size === "xs"
      ? "h-5 w-11"
      : size === "lg"
        ? "h-9 w-28"
        : size === "md"
          ? "h-8 w-24"
          : "h-6 w-[76px]";
  const imageSizeClass =
    size === "xs"
      ? "max-h-4 max-w-10"
      : size === "lg"
        ? "max-h-8 max-w-28"
        : size === "md"
          ? "max-h-7 max-w-24"
          : "max-h-5 max-w-[76px]";
  const logoFilterClass = needsInvert
    ? "[filter:brightness(0.88)_contrast(1.12)_drop-shadow(0_1px_1px_rgba(0,0,0,0.2))] dark:[filter:invert(1)_brightness(1.08)_contrast(1.1)_drop-shadow(0_1px_2px_rgba(0,0,0,0.65))]"
    : needsLightInvert
      ? "[filter:invert(1)_brightness(0.72)_contrast(1.25)_drop-shadow(0_1px_1px_rgba(0,0,0,0.16))] dark:[filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.62))]"
      : needsLightOutline
        ? "[filter:drop-shadow(1px_0_0_rgba(0,0,0,0.5))_drop-shadow(-1px_0_0_rgba(0,0,0,0.5))_drop-shadow(0_1px_0_rgba(0,0,0,0.5))_drop-shadow(0_-1px_0_rgba(0,0,0,0.5))] dark:[filter:drop-shadow(0_0_1px_rgba(255,255,255,0.72))_drop-shadow(0_0_7px_rgba(255,255,255,0.16))_drop-shadow(0_1px_2px_rgba(0,0,0,0.7))_brightness(1.08)_contrast(1.18)]"
        : needsContrastLift
          ? "[filter:drop-shadow(0_1px_1px_rgba(0,0,0,0.2))_brightness(0.98)_contrast(1.12)] dark:[filter:drop-shadow(0_0_1px_rgba(255,255,255,0.72))_drop-shadow(0_0_7px_rgba(255,255,255,0.16))_drop-shadow(0_1px_2px_rgba(0,0,0,0.7))_brightness(1.08)_contrast(1.18)]"
          : "[filter:drop-shadow(0_1px_1px_rgba(0,0,0,0.2))] dark:[filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.62))]";
  const imageScaleClass = needsWideBoost ? "scale-[1.1]" : "scale-100";

  if (failed) {
    return (
      <span
        className={`flex shrink-0 items-center justify-start overflow-hidden ${sizeClass} ${className}`}
        title={brandName}
      >
        <span className="max-w-full truncate text-[8px] font-semibold uppercase tracking-[0.08em] text-foreground/65">
          {brandName}
        </span>
      </span>
    );
  }

  return (
    <span
      className={`relative flex shrink-0 items-center justify-start overflow-visible ${sizeClass} ${className}`}
      title={brandName}
    >
      <Image
        src={lightThemeLogoPath}
        alt={brandName}
        width={112}
        height={36}
        unoptimized
        className={`relative ${imageSizeClass} origin-left object-contain opacity-90 transition duration-200 group-hover:opacity-100 ${imageScaleClass} ${logoFilterClass} ${
          hasThemeSpecificLogo ? "dark:hidden" : ""
        }`}
        onError={() => setFailed(true)}
      />
      {hasThemeSpecificLogo ? (
        <Image
          src={logoPath}
          alt={brandName}
          width={112}
          height={36}
          unoptimized
          className={`relative hidden ${imageSizeClass} origin-left object-contain opacity-90 transition duration-200 group-hover:opacity-100 dark:block ${imageScaleClass} ${logoFilterClass}`}
          onError={() => setFailed(true)}
        />
      ) : null}
    </span>
  );
}

function VehicleMakeLogo({ make, size = "sm" }: { make: string; size?: "sm" | "md" }) {
  const logoPath = getVehicleMakeLogoPath(make);
  const dimensions = size === "md" ? "h-10 w-16" : "h-6 w-9";
  const needsLightTreatment = DARK_VEHICLE_MAKE_LOGOS.has(normalizeVehicleMakeName(make));

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden ${dimensions}`}
      aria-hidden="true"
    >
      {logoPath ? (
        <Image
          src={logoPath}
          alt=""
          width={64}
          height={40}
          unoptimized
          className={`h-full w-full object-contain opacity-90 transition-[opacity,filter] duration-200 group-hover:opacity-100 ${
            needsLightTreatment
              ? "[filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.18))] dark:[filter:brightness(1.35)_grayscale(1)_invert(1)_drop-shadow(0_0_5px_rgba(255,255,255,0.24))]"
              : "[filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.16))] dark:[filter:drop-shadow(0_0_5px_rgba(255,255,255,0.24))]"
          }`}
        />
      ) : (
        <span className="text-[10px] font-semibold uppercase text-foreground/65">
          {make.slice(0, 2)}
        </span>
      )}
    </span>
  );
}

/* ========= SKU Clipboard Copy Button ========= */
function SkuCopy({ sku, isUa }: { sku: string; isUa: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(sku);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={handleCopy}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigator.clipboard.writeText(sku);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
      }}
      className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-[10px] font-mono text-foreground/45 transition-all duration-300 hover:text-foreground active:scale-95 group/copy cursor-pointer"
      title={isUa ? "Копіювати артикул" : "Copy part number"}
    >
      <span className="min-w-0 truncate">#{sku}</span>
      {copied ? (
        <Check className="w-3 h-3 text-foreground shrink-0" />
      ) : (
        <Copy className="w-2.5 h-2.5 text-foreground/35 opacity-0 transition-all duration-300 group-hover/copy:text-foreground group-hover:opacity-100 shrink-0" />
      )}
    </span>
  );
}

function StockCardCartControl({
  item,
  locale,
  isUa,
}: {
  item: StockItem;
  locale: string;
  isUa: boolean;
}) {
  const [quantity, setQuantity] = useState(1);
  const changeQuantity = (delta: number) => {
    setQuantity((current) => Math.max(1, Math.min(99, current + delta)));
  };

  if (item.matchStatus === "requires_verification") {
    return (
      <Link
        href={`/${locale}/contact?source=one-ai&product=${encodeURIComponent(item.slug)}`}
        className="flex h-10 w-full items-center justify-center rounded-[7px] border border-foreground/20 bg-foreground/[0.035] px-3 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground transition hover:border-foreground/45 hover:bg-foreground/[0.07]"
      >
        {isUa ? "Перевірити сумісність" : "Verify fitment"}
      </Link>
    );
  }

  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
      <div className="grid h-10 grid-cols-[28px_1fr_28px] overflow-hidden rounded-[7px] border border-foreground/10 bg-foreground/[0.02]">
        <button
          type="button"
          onClick={() => changeQuantity(-1)}
          className="flex items-center justify-center border-r border-foreground/10 text-foreground/45 transition hover:bg-foreground/[0.045] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
          disabled={quantity <= 1}
          aria-label={isUa ? "Зменшити кількість" : "Decrease quantity"}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-center justify-center font-mono text-[11px] font-semibold text-foreground">
          {quantity}
        </div>
        <button
          type="button"
          onClick={() => changeQuantity(1)}
          className="flex items-center justify-center border-l border-foreground/10 text-foreground/45 transition hover:bg-foreground/[0.045] hover:text-foreground"
          aria-label={isUa ? "Збільшити кількість" : "Increase quantity"}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <AddToCartButton
        slug={item.slug}
        variantId={item.variantId}
        locale={locale}
        quantity={quantity}
        redirect={false}
        variant="minimal"
        productName={item.name}
        label={isUa ? "У кошик" : "Cart"}
        labelAdded={isUa ? "Додано" : "Added"}
        className="flex h-10 w-full items-center justify-center rounded-[7px] border border-foreground bg-foreground px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-background shadow-[0_8px_20px_rgba(0,0,0,0.12)] transition hover:-translate-y-px hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
      />
    </div>
  );
}

/* ========= Safe Product Image with Error Fallback & URL Cleanup ========= */
function SafeProductImage({
  src,
  alt,
  className,
  isMini = false,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  isMini?: boolean;
}) {
  const [error, setError] = useState(false);

  if (error || !src) {
    return isMini ? (
      <Package className="h-6 w-6 shrink-0 text-foreground/20" />
    ) : (
      <Package className="h-12 w-12 shrink-0 text-foreground/18" />
    );
  }

  // Clean up any double slashes in URL path (except protocol)
  const cleanSrc = src.replace(/(https?:\/\/)|(\/)+/g, (match, protocol) => {
    if (protocol) return protocol;
    return "/";
  });

  return (
    <img
      src={cleanSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setError(true)}
      className={className}
    />
  );
}

/* ========= Main Stock Page ========= */
function CatalogOverlayPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

function StockPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = typeof params?.locale === "string" ? params.locale : "ua";
  const isUa = locale === "ua";
  const shouldReduceMotion = useReducedMotion();

  const { data: session } = useSession();
  const user = session?.user as any;
  const isB2B = user?.group === "B2B_APPROVED";
  const { country, currency, rates, setCurrency } = useShopCurrency();
  const displayLocale = locale === "en" ? "en" : "ua";
  const displayRates = rates ?? DEFAULT_CURRENCY_RATES;

  // View mode state with local storage persistence
  const initialView = searchParams.get("view");
  const [viewMode, setViewMode] = useState<"grid" | "list">(
    initialView === "list" ? "list" : "grid"
  );
  const viewModeRef = useRef(viewMode);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (initialView === "grid" || initialView === "list") {
        localStorage.setItem("onecompany_stock_view", initialView);
        return;
      }
      const saved = localStorage.getItem("onecompany_stock_view");
      if (saved === "grid" || saved === "list") {
        setViewMode(saved);
      }
    }
  }, [initialView]);

  const handleSetViewMode = (mode: "grid" | "list") => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("onecompany_stock_view", mode);
    }
  };

  // Search state
  const initialPage = Math.max(1, Number(searchParams.get("page")) || 1);
  const initialBrands = parseShopStockParamList(searchParams, "brand");
  const initialStock = searchParams.get("stock");
  const initialSort = searchParams.get("sort");

  const initialModelRef = useRef(searchParams.get("model") || "");
  const initialChassisRef = useRef(searchParams.get("chassis") || "");
  const initialSearchRef = useRef(true);
  const searchRequestRef = useRef<AbortController | null>(null);
  const autoSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scopeSearchImmediateRef = useRef(false);
  const suggestionRequestRef = useRef<AbortController | null>(null);
  const resolvedSuggestionRequestKeyRef = useRef("");
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const searchFocusedRef = useRef(false);
  const searchResponseCacheRef = useRef(
    new Map<string, { timestamp: number; data: StockSearchResponse }>()
  );

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [suggestions, setSuggestions] = useState<StockSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [hasSearched, setHasSearched] = useState(true);
  const [fallbackApplied, setFallbackApplied] = useState<"fitment" | "all" | null>(null);

  const [localCategory, setLocalCategory] = useState(searchParams.get("category") || "");
  const localCategoryLabel =
    SHOP_STOCK_CATEGORY_GROUPS.find((group) => group.id === localCategory)?.[isUa ? "ua" : "en"] ??
    localCategory;
  const [requestedYear, setRequestedYear] = useState<number | null>(() => {
    const year = Number(searchParams.get("year"));
    return Number.isInteger(year) && year >= 1886 && year <= new Date().getFullYear() + 2
      ? year
      : null;
  });
  const [engineFilter, setEngineFilter] = useState(searchParams.get("engine")?.trim() || "");
  const [opfGpfFilter, setOpfGpfFilter] = useState<"with" | "without" | null>(() => {
    const value = searchParams.get("opfGpf");
    return value === "with" || value === "without" ? value : null;
  });
  const [productKindFilter, setProductKindFilter] = useState<ShopAiProductKind | null>(() =>
    cleanShopAiProductKind(searchParams.get("productKind"))
  );
  const [strictMatch, setStrictMatch] = useState(searchParams.get("strict") === "1");
  const [localCategories, setLocalCategories] = useState<string[]>([]);
  const [localBrands, setLocalBrands] = useState<string[]>([]);
  const [filterStats, setFilterStats] = useState<FilterStats | null>(null);
  const [globalFilterStats, setGlobalFilterStats] = useState<FilterStats | null>(null);
  const [priceBounds, setPriceBounds] = useState<FilterStats["price"] | null>(null);
  const [minPriceFilter, setMinPriceFilter] = useState(searchParams.get("minPrice") || "");
  const [maxPriceFilter, setMaxPriceFilter] = useState(searchParams.get("maxPrice") || "");
  const previousPriceCurrencyRef = useRef<ShopCurrencyCode>(currency);
  const initialUrlCurrencyAppliedRef = useRef(false);
  const [brandFilterQuery, setBrandFilterQuery] = useState("");
  const [categoryFilterQuery, setCategoryFilterQuery] = useState("");
  const [categorySectionOpen, setCategorySectionOpen] = useState(true);
  const [brandSectionOpen, setBrandSectionOpen] = useState(true);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [brandsExpanded, setBrandsExpanded] = useState(false);
  const [stockFilter, setStockFilter] = useState<StockFilter>(
    initialStock === "inStock" || initialStock === "preOrder" ? initialStock : "all"
  );
  const [sortOrder, setSortOrder] = useState<StockSort>(
    initialSort === "price_asc" || initialSort === "price_desc" || initialSort === "name_asc"
      ? initialSort
      : "default"
  );
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [vehicleMode, setVehicleMode] = useState<VehicleMode>(
    searchParams.get("scope") === "moto" ? "moto" : "auto"
  );
  const mobileFiltersDialogRef = useRef<HTMLElement | null>(null);
  const mobileFiltersCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!mobileFiltersOpen) return;

    const desktopMedia = window.matchMedia("(min-width: 1024px)");
    if (desktopMedia.matches) {
      setMobileFiltersOpen(false);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusFrame = window.requestAnimationFrame(() =>
      mobileFiltersCloseButtonRef.current?.focus()
    );
    const handleDesktopChange = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileFiltersOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileFiltersOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = mobileFiltersDialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    desktopMedia.addEventListener("change", handleDesktopChange);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      desktopMedia.removeEventListener("change", handleDesktopChange);
      previouslyFocused?.focus();
    };
  }, [mobileFiltersOpen]);

  // Vehicle fitment state
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [chassisCodes, setChassisCodes] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [submodelsLoading, setSubmodelsLoading] = useState(false);

  const [make, setMake] = useState(searchParams.get("make") || "");
  const [model, setModel] = useState("");
  const [chassis, setChassis] = useState("");
  const [makePickerOpen, setMakePickerOpen] = useState(false);
  const [makePickerQuery, setMakePickerQuery] = useState("");
  const makePickerDialogRef = useRef<HTMLDivElement | null>(null);
  const makePickerSearchInputRef = useRef<HTMLInputElement | null>(null);
  const handleVehicleModeChange = useCallback(
    (mode: VehicleMode) => {
      if (mode === vehicleMode) return;

      initialModelRef.current = "";
      initialChassisRef.current = "";
      scopeSearchImmediateRef.current = true;
      if (autoSearchTimerRef.current) clearTimeout(autoSearchTimerRef.current);
      autoSearchTimerRef.current = null;
      searchRequestRef.current?.abort();
      searchRequestRef.current = null;
      suggestionRequestRef.current?.abort();
      suggestionRequestRef.current = null;
      resolvedSuggestionRequestKeyRef.current = "";

      setVehicleMode(mode);
      setMake("");
      setModel("");
      setChassis("");
      setMakes([]);
      setModels([]);
      setChassisCodes([]);
      setModelsLoading(false);
      setSubmodelsLoading(false);
      setSuggestions([]);
      setSuggestionsOpen(false);
      setSuggestionsLoading(false);
      setActiveSuggestionIndex(-1);
      setItems([]);
      setLocalCategories([]);
      setLocalBrands([]);
      setFilterStats(null);
      setGlobalFilterStats(null);
      setPriceBounds(null);
      setTotalItems(0);
      setTotalPages(1);
      setPage(1);
      setFallbackApplied(null);
      setError("");
      setLoading(true);
    },
    [vehicleMode]
  );
  const handleOpenMakePicker = useCallback(() => {
    setMobileFiltersOpen(false);
    setMakePickerOpen(true);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!searchBoxRef.current?.contains(event.target as Node)) {
        searchFocusedRef.current = false;
        setSearchFocused(false);
        setSuggestionsOpen(false);
        setActiveSuggestionIndex(-1);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!searchFocused || normalizedQuery.length < 2) return;

    const requestKey = `${locale}:${vehicleMode}:${normalizedQuery}`;
    if (resolvedSuggestionRequestKeyRef.current === requestKey) return;

    const needle = normalizeFacetSearchText(normalizedQuery);
    const immediateBrands: StockSuggestion[] = localBrands
      .filter((brandName) => normalizeFacetSearchText(brandName).includes(needle))
      .slice(0, 2)
      .map((label) => ({ type: "brand", id: `brand:${label}`, label }));
    const immediateVehicles: StockSuggestion[] = makes
      .filter((makeName) => normalizeFacetSearchText(makeName).includes(needle))
      .slice(0, 2)
      .map((makeName) => ({
        type: "vehicle",
        id: `vehicle:${makeName}`,
        label: makeName,
        make: makeName,
      }));
    const immediateProducts: StockSuggestion[] = items
      .filter((item) =>
        normalizeFacetSearchText(
          `${item.name} ${item.brand} ${item.partNumber} ${item.category || ""}`
        ).includes(needle)
      )
      .slice(0, 5)
      .map((item) => ({
        type: "product",
        id: item.id,
        name: item.name,
        brand: item.brand,
        partNumber: item.partNumber,
        thumbnail: item.thumbnail,
        slug: item.slug,
        href: item.href,
        category: item.category ?? "",
      }));
    const immediateSuggestions = [
      ...immediateBrands,
      ...immediateVehicles,
      ...immediateProducts,
    ].slice(0, 8);
    if (immediateSuggestions.length > 0) {
      setSuggestions(immediateSuggestions);
      if (searchFocusedRef.current) setSuggestionsOpen(true);
    }
  }, [items, localBrands, locale, makes, query, searchFocused, vehicleMode]);

  useEffect(() => {
    suggestionRequestRef.current?.abort();
    const normalizedQuery = query.trim();
    if (!searchFocused || normalizedQuery.length < 2) {
      resolvedSuggestionRequestKeyRef.current = "";
      suggestionRequestRef.current = null;
      setSuggestions([]);
      setSuggestionsOpen(false);
      setSuggestionsLoading(false);
      return;
    }

    const requestKey = `${locale}:${vehicleMode}:${normalizedQuery}`;
    resolvedSuggestionRequestKeyRef.current = "";

    const controller = new AbortController();
    suggestionRequestRef.current = controller;
    const timer = window.setTimeout(async () => {
      setSuggestionsLoading(true);
      const params = new URLSearchParams({
        q: normalizedQuery,
        locale,
        v: "2",
        scope: vehicleMode,
      });
      try {
        const response = await fetch(`/api/shop/stock/suggest?${params.toString()}`, {
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Suggestion search failed");
        resolvedSuggestionRequestKeyRef.current = requestKey;
        setSuggestions(payload.data || []);
        if (searchFocusedRef.current) setSuggestionsOpen(true);
        setActiveSuggestionIndex(-1);
      } catch {
        if (!controller.signal.aborted) {
          resolvedSuggestionRequestKeyRef.current = "";
          setSuggestions([]);
        }
      } finally {
        if (suggestionRequestRef.current === controller) {
          suggestionRequestRef.current = null;
          setSuggestionsLoading(false);
        }
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [locale, query, searchFocused, vehicleMode]);

  useEffect(() => {
    if (!makePickerOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusFrame = window.requestAnimationFrame(() =>
      makePickerSearchInputRef.current?.focus()
    );
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMakePickerOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = makePickerDialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      } else {
        document.querySelector<HTMLElement>("[data-catalog-filter-trigger]")?.focus();
      }
    };
  }, [makePickerOpen]);

  // Brand filters state (multi-select)
  const [selectedBrands, setSelectedBrands] = useState<string[]>(initialBrands);

  const handleToggleBrand = (brandName: string) => {
    setSelectedBrands((prev) => {
      if (prev.includes(brandName)) {
        return prev.filter((b) => b !== brandName);
      } else {
        return [...prev, brandName];
      }
    });
  };

  const syncUrlState = useCallback(
    (searchPage: number, nextViewMode = viewModeRef.current) => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (selectedBrands.length > 0) params.set("brand", selectedBrands.join(","));
      if (localCategory) params.set("category", localCategory);
      if (make) params.set("make", make);
      if (model) params.set("model", model);
      if (chassis) params.set("chassis", chassis);
      if (requestedYear) params.set("year", String(requestedYear));
      if (engineFilter.trim()) params.set("engine", engineFilter.trim());
      if (opfGpfFilter) params.set("opfGpf", opfGpfFilter);
      if (productKindFilter) params.set("productKind", productKindFilter);
      if (strictMatch) params.set("strict", "1");
      if (vehicleMode === "moto") params.set("scope", "moto");
      if (stockFilter !== "all") params.set("stock", stockFilter);
      const minPriceParam = normalizeStockPriceParam(minPriceFilter);
      const maxPriceParam = normalizeStockPriceParam(maxPriceFilter);
      if (minPriceParam) params.set("minPrice", minPriceParam);
      if (maxPriceParam) params.set("maxPrice", maxPriceParam);
      if (minPriceParam || maxPriceParam) params.set("currency", currency);
      if (sortOrder !== "default") params.set("sort", sortOrder);
      if (nextViewMode !== "grid") params.set("view", nextViewMode);
      if (searchPage > 1) params.set("page", String(searchPage));

      const queryString = params.toString();
      const nextUrl = queryString
        ? `${window.location.pathname}?${queryString}`
        : window.location.pathname;
      window.history.replaceState(window.history.state, "", nextUrl);
    },
    [
      chassis,
      currency,
      engineFilter,
      localCategory,
      make,
      maxPriceFilter,
      minPriceFilter,
      model,
      opfGpfFilter,
      productKindFilter,
      query,
      requestedYear,
      selectedBrands,
      sortOrder,
      stockFilter,
      strictMatch,
      vehicleMode,
    ]
  );

  const applySearchPayload = useCallback(
    (data: StockSearchResponse, searchPage: number) => {
      setItems(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotalItems(data.meta?.totalItems || 0);
      setFallbackApplied(data.meta?.fallbackApplied || null);
      if (data.filters) {
        setLocalCategories(data.filters.categories || []);
        setLocalBrands(data.filters.brands || []);
        setPriceBounds(data.filters.price || null);
      }
      if (data.filterStats) setFilterStats(data.filterStats);
      if (data.globalFilterStats) setGlobalFilterStats(data.globalFilterStats);
      setPage(searchPage);
      syncUrlState(searchPage);
    },
    [syncUrlState]
  );

  useEffect(() => {
    if (initialUrlCurrencyAppliedRef.current) return;
    initialUrlCurrencyAppliedRef.current = true;

    const urlCurrency = searchParams.get("currency")?.toUpperCase();
    const hasUrlPriceFilter = Boolean(searchParams.get("minPrice") || searchParams.get("maxPrice"));
    if (
      !hasUrlPriceFilter ||
      (urlCurrency !== "EUR" && urlCurrency !== "USD" && urlCurrency !== "UAH")
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      previousPriceCurrencyRef.current = urlCurrency;
      setCurrency(urlCurrency);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchParams, setCurrency]);

  useEffect(() => {
    const previousCurrency = previousPriceCurrencyRef.current;
    if (previousCurrency === currency) return;

    const convertFilterValue = (value: string) => {
      const amount = Number(normalizeStockPriceParam(value));
      if (!Number.isFinite(amount) || amount < 0) return value;
      const converted = convertShopCurrencyAmount(amount, previousCurrency, currency, displayRates);
      return converted > 0 ? String(converted) : value;
    };

    setMinPriceFilter((value) => (value ? convertFilterValue(value) : value));
    setMaxPriceFilter((value) => (value ? convertFilterValue(value) : value));
    previousPriceCurrencyRef.current = currency;
  }, [currency, displayRates]);

  // Fitment values do not depend on locale, country, or currency.
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/shop/stock/fitment?scope=${vehicleMode}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((fitmentRes) => {
        const nextMakes = Array.isArray(fitmentRes.data) ? fitmentRes.data : [];
        setMakes(nextMakes);
        if (
          make &&
          !nextMakes.some(
            (makeName: string) =>
              normalizeVehicleMakeName(makeName) === normalizeVehicleMakeName(make)
          )
        ) {
          initialModelRef.current = "";
          initialChassisRef.current = "";
          setMake("");
          setModel("");
          setChassis("");
          setModels([]);
          setChassisCodes([]);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [make, vehicleMode]);

  // Cascading: Make → Models
  useEffect(() => {
    if (!make) {
      setModels([]);
      setModel("");
      setChassis("");
      setChassisCodes([]);
      return;
    }
    setModelsLoading(true);
    const controller = new AbortController();
    fetch(`/api/shop/stock/fitment?scope=${vehicleMode}&make=${encodeURIComponent(make)}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((res) => {
        const nextModels = res.data || [];
        setModels(nextModels);
        const initialModel = initialModelRef.current;
        if (initialModel && nextModels.includes(initialModel)) {
          setModel(initialModel);
          initialModelRef.current = "";
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setModelsLoading(false);
      });
    if (!initialModelRef.current) {
      setModel("");
      setChassis("");
    }
    setChassisCodes([]);
    return () => controller.abort();
  }, [make, vehicleMode]);

  // Cascading: Model → Chassis
  useEffect(() => {
    if (!make || !model) {
      setChassisCodes([]);
      setChassis("");
      return;
    }
    setSubmodelsLoading(true);
    const controller = new AbortController();
    fetch(
      `/api/shop/stock/fitment?scope=${vehicleMode}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`,
      { signal: controller.signal }
    )
      .then((r) => r.json())
      .then((res) => {
        const nextChassisCodes = res.data || [];
        setChassisCodes(nextChassisCodes);
        const initialChassis = initialChassisRef.current;
        if (initialChassis && nextChassisCodes.includes(initialChassis)) {
          setChassis(initialChassis);
          initialChassisRef.current = "";
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setSubmodelsLoading(false);
      });
    if (!initialChassisRef.current) {
      setChassis("");
    }
    return () => controller.abort();
  }, [make, model, vehicleMode]);

  // Search handler
  const doSearch = useCallback(
    async (searchPage = 1) => {
      searchRequestRef.current?.abort();
      const controller = new AbortController();
      searchRequestRef.current = controller;
      setLoading(true);
      setError("");
      setHasSearched(true);
      setFallbackApplied(null);

      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (selectedBrands.length > 0) params.set("brand", selectedBrands.join(","));
      if (localCategory) params.set("category", localCategory);
      if (make) params.set("make", make);
      if (model) params.set("model", model);
      if (chassis) params.set("chassis", chassis);
      if (requestedYear) params.set("year", String(requestedYear));
      if (engineFilter.trim()) params.set("engine", engineFilter.trim());
      if (opfGpfFilter) params.set("opfGpf", opfGpfFilter);
      if (productKindFilter) params.set("productKind", productKindFilter);
      if (strictMatch) params.set("strict", "1");
      params.set("scope", vehicleMode);
      if (stockFilter !== "all") params.set("stock", stockFilter);
      const minPriceParam = normalizeStockPriceParam(minPriceFilter);
      const maxPriceParam = normalizeStockPriceParam(maxPriceFilter);
      if (minPriceParam) params.set("minPrice", minPriceParam);
      if (maxPriceParam) params.set("maxPrice", maxPriceParam);
      if (currency) params.set("currency", currency);
      if (sortOrder !== "default") params.set("sort", sortOrder);
      if (locale) params.set("locale", locale);
      if (country) params.set("country", country);
      params.set("page", searchPage.toString());
      const cacheKey = params.toString();
      const cached = searchResponseCacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 45_000) {
        applySearchPayload(cached.data, searchPage);
        searchRequestRef.current = null;
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/shop/stock/search?${cacheKey}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as StockSearchResponse;
        if (!res.ok) throw new Error(data.error);
        if (controller.signal.aborted) return;
        searchResponseCacheRef.current.set(cacheKey, { timestamp: Date.now(), data });
        if (searchResponseCacheRef.current.size > 40) {
          const oldestKey = searchResponseCacheRef.current.keys().next().value;
          if (oldestKey) searchResponseCacheRef.current.delete(oldestKey);
        }
        applySearchPayload(data, searchPage);
      } catch (error) {
        if (controller.signal.aborted) return;
        setItems([]);
        setTotalItems(0);
        setTotalPages(1);
        setFilterStats(null);
        setError(error instanceof Error ? error.message : "Search failed");
      } finally {
        if (searchRequestRef.current === controller) {
          searchRequestRef.current = null;
          setLoading(false);
        }
      }
    },
    [
      query,
      selectedBrands,
      make,
      model,
      chassis,
      requestedYear,
      engineFilter,
      opfGpfFilter,
      productKindFilter,
      strictMatch,
      stockFilter,
      sortOrder,
      localCategory,
      minPriceFilter,
      maxPriceFilter,
      locale,
      country,
      currency,
      vehicleMode,
      applySearchPayload,
    ]
  );

  // Auto-search for filters and queries
  useEffect(() => {
    const searchPage = initialSearchRef.current ? initialPage : 1;
    initialSearchRef.current = false;
    const delay = scopeSearchImmediateRef.current ? 0 : 600;
    scopeSearchImmediateRef.current = false;
    autoSearchTimerRef.current = setTimeout(() => {
      autoSearchTimerRef.current = null;
      void doSearch(searchPage);
    }, delay);
    return () => {
      if (autoSearchTimerRef.current) clearTimeout(autoSearchTimerRef.current);
      autoSearchTimerRef.current = null;
      searchRequestRef.current?.abort();
    };
  }, [
    selectedBrands,
    make,
    model,
    chassis,
    requestedYear,
    engineFilter,
    opfGpfFilter,
    productKindFilter,
    strictMatch,
    query,
    stockFilter,
    sortOrder,
    localCategory,
    minPriceFilter,
    maxPriceFilter,
    doSearch,
    initialPage,
  ]);

  useEffect(() => {
    syncUrlState(page, viewMode);
  }, [page, syncUrlState, viewMode]);

  function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (autoSearchTimerRef.current) clearTimeout(autoSearchTimerRef.current);
    autoSearchTimerRef.current = null;
    void doSearch(1);
  }

  function handleResetFilters() {
    initialModelRef.current = "";
    initialChassisRef.current = "";
    if (vehicleMode !== "auto") {
      scopeSearchImmediateRef.current = true;
      searchRequestRef.current?.abort();
      searchRequestRef.current = null;
      suggestionRequestRef.current?.abort();
      suggestionRequestRef.current = null;
      setItems([]);
      setSuggestions([]);
      setSuggestionsOpen(false);
      setLocalCategories([]);
      setLocalBrands([]);
      setFilterStats(null);
      setGlobalFilterStats(null);
      setPriceBounds(null);
      setMakes([]);
      setModels([]);
      setChassisCodes([]);
      setLoading(true);
    }
    setVehicleMode("auto");
    setMake("");
    setModel("");
    setChassis("");
    setSelectedBrands([]);
    setLocalCategory("");
    setRequestedYear(null);
    setEngineFilter("");
    setOpfGpfFilter(null);
    setProductKindFilter(null);
    setStrictMatch(false);
    setStockFilter("all");
    setSortOrder("default");
    setQuery("");
    setMinPriceFilter("");
    setMaxPriceFilter("");
    setBrandFilterQuery("");
    setCategoryFilterQuery("");
    setHasSearched(true);
    setFallbackApplied(null);
    setTotalPages(1);
    setTotalItems(0);
    setPage(1);
  }

  const brandCountByLabel = useMemo(
    () =>
      new Map(
        ((selectedBrands.length > 0 ? globalFilterStats : filterStats)?.brands ?? []).map(
          (entry) => [entry.label, entry.count]
        )
      ),
    [filterStats, globalFilterStats, selectedBrands.length]
  );
  const categoryCountByLabel = useMemo(
    () =>
      new Map(
        ((localCategory ? globalFilterStats : filterStats)?.categories ?? []).map((entry) => [
          entry.label,
          entry.count,
        ])
      ),
    [filterStats, globalFilterStats, localCategory]
  );
  const minPriceParam = normalizeStockPriceParam(minPriceFilter);
  const maxPriceParam = normalizeStockPriceParam(maxPriceFilter);
  const hasPriceFilter = Boolean(minPriceParam || maxPriceParam);

  const visibleCategories = useMemo(() => {
    const needle = normalizeFacetSearchText(categoryFilterQuery);
    const nonEmptyCategories = localCategories.filter(
      (categoryName) =>
        categoryName === localCategory ||
        !filterStats ||
        (categoryCountByLabel.get(categoryName) ?? 0) > 0
    );
    const matches = needle
      ? nonEmptyCategories.filter((categoryName) =>
          normalizeFacetSearchText(categoryName).includes(needle)
        )
      : nonEmptyCategories;

    return [...matches].sort((left, right) => {
      if (left === localCategory) return -1;
      if (right === localCategory) return 1;
      const countDiff =
        (categoryCountByLabel.get(right) ?? 0) - (categoryCountByLabel.get(left) ?? 0);
      if (countDiff !== 0) return countDiff;
      return left.localeCompare(right, locale === "ua" ? "uk" : "en");
    });
  }, [
    categoryCountByLabel,
    categoryFilterQuery,
    filterStats,
    localCategories,
    localCategory,
    locale,
  ]);

  const visibleBrands = useMemo(() => {
    const needle = normalizeFacetSearchText(brandFilterQuery);
    const selected = new Set(selectedBrands);
    const nonEmptyBrands = localBrands.filter(
      (brandName) =>
        selected.has(brandName) || !filterStats || (brandCountByLabel.get(brandName) ?? 0) > 0
    );
    const matches = needle
      ? nonEmptyBrands.filter((brandName) => normalizeFacetSearchText(brandName).includes(needle))
      : nonEmptyBrands;

    return [...matches].sort((left, right) => {
      const selectedDiff = Number(selected.has(right)) - Number(selected.has(left));
      if (selectedDiff !== 0) return selectedDiff;
      const countDiff = (brandCountByLabel.get(right) ?? 0) - (brandCountByLabel.get(left) ?? 0);
      if (countDiff !== 0) return countDiff;
      return left.localeCompare(right, locale === "ua" ? "uk" : "en");
    });
  }, [brandCountByLabel, brandFilterQuery, filterStats, localBrands, locale, selectedBrands]);

  const displayedCategories =
    categoryFilterQuery.trim() || categoriesExpanded
      ? visibleCategories
      : visibleCategories.slice(0, 7);
  const displayedBrands =
    brandFilterQuery.trim() || brandsExpanded ? visibleBrands : visibleBrands.slice(0, 7);

  const visibleVehicleMakes = useMemo(() => {
    const popularOrder = new Map(
      POPULAR_VEHICLE_MAKES.map((makeName, index) => [normalizeVehicleMakeName(makeName), index])
    );
    const needle = normalizeFacetSearchText(makePickerQuery);
    const matches = needle
      ? makes.filter((makeName) => normalizeFacetSearchText(makeName).includes(needle))
      : makes;

    return [...matches].sort((left, right) => {
      const leftPriority = popularOrder.get(normalizeVehicleMakeName(left));
      const rightPriority = popularOrder.get(normalizeVehicleMakeName(right));
      if (leftPriority !== undefined || rightPriority !== undefined) {
        return (
          (leftPriority ?? Number.MAX_SAFE_INTEGER) - (rightPriority ?? Number.MAX_SAFE_INTEGER)
        );
      }
      return left.localeCompare(right, locale === "ua" ? "uk" : "en");
    });
  }, [locale, makePickerQuery, makes]);

  const handleSelectVehicleMake = (nextMake: string) => {
    initialModelRef.current = "";
    initialChassisRef.current = "";
    setMake(nextMake);
    setModel("");
    setChassis("");
    setMakePickerOpen(false);
    setMakePickerQuery("");
  };

  const closeSuggestions = () => {
    searchFocusedRef.current = false;
    setSearchFocused(false);
    setSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);
  };

  const handleSuggestionSelection = (suggestion: StockSuggestion) => {
    closeSuggestions();
    if (suggestion.type === "product") {
      window.location.assign(
        resolveShopCatalogProductHref(locale, suggestion.href, suggestion.slug)
      );
      return;
    }
    if (suggestion.type === "brand") {
      setSelectedBrands([suggestion.label]);
      setQuery("");
      return;
    }

    initialModelRef.current = suggestion.model || "";
    initialChassisRef.current = "";
    setMake(suggestion.make);
    setModel("");
    setChassis("");
    setQuery("");
  };

  const handleSuggestionKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestionsOpen || suggestions.length === 0) {
      if (event.key === "ArrowDown" && suggestions.length > 0) setSuggestionsOpen(true);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex((current) => (current <= 0 ? suggestions.length : current) - 1);
    } else if (event.key === "Enter" && activeSuggestionIndex >= 0) {
      event.preventDefault();
      handleSuggestionSelection(suggestions[activeSuggestionIndex]);
    } else if (event.key === "Escape") {
      closeSuggestions();
    }
  };

  const hasActiveFilters =
    query.trim().length > 0 ||
    selectedBrands.length > 0 ||
    Boolean(localCategory) ||
    Boolean(make) ||
    Boolean(model) ||
    Boolean(chassis) ||
    Boolean(requestedYear) ||
    Boolean(engineFilter.trim()) ||
    Boolean(opfGpfFilter) ||
    Boolean(productKindFilter) ||
    vehicleMode === "moto" ||
    stockFilter !== "all" ||
    hasPriceFilter;

  const activeFilterCount =
    (query.trim() ? 1 : 0) +
    selectedBrands.length +
    (localCategory ? 1 : 0) +
    (make ? 1 : 0) +
    (model ? 1 : 0) +
    (chassis ? 1 : 0) +
    (requestedYear ? 1 : 0) +
    (engineFilter.trim() ? 1 : 0) +
    (opfGpfFilter ? 1 : 0) +
    (productKindFilter ? 1 : 0) +
    (vehicleMode === "moto" ? 1 : 0) +
    (stockFilter !== "all" ? 1 : 0) +
    (hasPriceFilter ? 1 : 0);

  const totalCatalogCount = filterStats?.stock.all ?? totalItems;
  const isInitialCatalogLoading = loading && filterStats === null;
  const stockCount = (value: StockFilter) =>
    value === "all"
      ? filterStats?.stock.all
      : value === "inStock"
        ? filterStats?.stock.inStock
        : filterStats?.stock.preOrder;

  const getItemPriceSet = useCallback((item: StockItem): ShopPriceSet => {
    return {
      eur: item.priceSet?.eur ?? item.priceEur ?? 0,
      usd: item.priceSet?.usd ?? item.priceUsd ?? item.price ?? 0,
      uah: item.priceSet?.uah ?? item.priceUah ?? 0,
    };
  }, []);

  const getItemCompareAtSet = useCallback((item: StockItem): ShopPriceSet | null => {
    const compareAt = item.originalPriceSet;
    if (
      compareAt &&
      ((compareAt.eur ?? 0) > 0 || (compareAt.usd ?? 0) > 0 || (compareAt.uah ?? 0) > 0)
    ) {
      return compareAt;
    }
    if (item.originalPrice && item.originalPrice > 0) {
      return { eur: 0, usd: item.originalPrice, uah: 0 };
    }
    return null;
  }, []);

  const formatAmount = useCallback(
    (amount: number) => formatShopMoney(displayLocale, amount, currency),
    [currency, displayLocale]
  );

  const formatPriceFilterAmount = useCallback(
    (value: string) => {
      const amount = Number(normalizeStockPriceParam(value));
      return Number.isFinite(amount) ? formatAmount(amount) : value;
    },
    [formatAmount]
  );

  const priceFilterLabel = useMemo(() => {
    if (!hasPriceFilter) return "";
    if (minPriceParam && maxPriceParam) {
      return `${isUa ? "Ціна" : "Price"}: ${formatPriceFilterAmount(
        minPriceParam
      )} - ${formatPriceFilterAmount(maxPriceParam)}`;
    }
    if (minPriceParam) {
      return `${isUa ? "Ціна від" : "Price from"} ${formatPriceFilterAmount(minPriceParam)}`;
    }
    return `${isUa ? "Ціна до" : "Price to"} ${formatPriceFilterAmount(maxPriceParam)}`;
  }, [formatPriceFilterAmount, hasPriceFilter, isUa, maxPriceParam, minPriceParam]);

  const priceBoundsLabel = useMemo(() => {
    const bounds = priceBounds ?? filterStats?.price;
    if (!bounds || bounds.min <= 0 || bounds.max <= 0) return "";
    return `${formatAmount(bounds.min)} - ${formatAmount(bounds.max)}`;
  }, [filterStats?.price, formatAmount, priceBounds]);

  const getItemDisplayPriceAmount = useCallback(
    (item: StockItem) => convertShopMoney(getItemPriceSet(item), currency, displayRates),
    [currency, displayRates, getItemPriceSet]
  );

  const getItemCompareAtAmount = useCallback(
    (item: StockItem) => {
      const compareAtAmount = convertShopMoney(getItemCompareAtSet(item), currency, displayRates);
      if (compareAtAmount > 0) return compareAtAmount;

      const priceAmount = getItemDisplayPriceAmount(item);
      return priceAmount > 0 ? priceAmount * 1.3 : 0;
    },
    [currency, displayRates, getItemCompareAtSet, getItemDisplayPriceAmount]
  );

  const formatItemPrice = useCallback(
    (item: StockItem) => {
      const amount = getItemDisplayPriceAmount(item);
      return amount > 0 ? formatAmount(amount) : isUa ? "Ціна за запитом" : "Price on request";
    },
    [formatAmount, getItemDisplayPriceAmount, isUa]
  );

  const formatItemCompareAt = useCallback(
    (item: StockItem) => {
      const priceAmount = getItemDisplayPriceAmount(item);
      const compareAtAmount = getItemCompareAtAmount(item);
      if (compareAtAmount <= 0 || (priceAmount > 0 && compareAtAmount <= priceAmount)) return null;
      return formatAmount(compareAtAmount);
    },
    [formatAmount, getItemCompareAtAmount, getItemDisplayPriceAmount]
  );

  const selectedVehicleLabel = [make, model, chassis].filter(Boolean).join(" ");

  const renderVehicleFitmentFields = (horizontal = false) => {
    const vehicleFieldSurface = horizontal
      ? "rounded-[8px] bg-card/90 shadow-[0_8px_24px_rgba(0,0,0,0.055)] backdrop-blur-xl dark:bg-black/55 dark:shadow-none"
      : "bg-foreground/[0.035]";

    return (
      <div className={horizontal ? "contents" : "space-y-2"}>
        <button
          type="button"
          onClick={handleOpenMakePicker}
          className={`group flex h-11 min-w-0 items-center gap-2 border border-foreground/15 px-3 text-left text-xs font-normal text-foreground/80 outline-hidden transition hover:border-foreground/30 focus:border-foreground/45 ${vehicleFieldSurface}`}
          aria-haspopup="dialog"
          aria-expanded={makePickerOpen}
        >
          {make ? (
            <VehicleMakeLogo make={make} />
          ) : vehicleMode === "moto" ? (
            <PremiumVehicleIcon mode="moto" className="h-[17px] w-[17px] text-foreground/50" />
          ) : (
            <PremiumVehicleIcon mode="auto" className="h-[17px] w-[17px] text-foreground/50" />
          )}
          <span className="min-w-0 flex-1 truncate">
            {make ||
              (isUa
                ? vehicleMode === "auto"
                  ? "Марка авто"
                  : "Марка мото"
                : vehicleMode === "auto"
                  ? "Car make"
                  : "Moto make")}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-foreground/50" />
        </button>

        <label className="relative block min-w-0">
          <span className="sr-only">
            {isUa
              ? vehicleMode === "auto"
                ? "Модель авто"
                : "Модель мото"
              : vehicleMode === "auto"
                ? "Car model"
                : "Moto model"}
          </span>
          <select
            value={model}
            disabled={!make || modelsLoading}
            onChange={(event) => {
              initialChassisRef.current = "";
              setModel(event.target.value);
              setChassis("");
            }}
            className={`h-11 w-full appearance-none truncate border border-foreground/15 px-3 pr-9 text-xs font-normal text-foreground/80 outline-hidden transition hover:border-foreground/25 focus:border-foreground/45 disabled:cursor-not-allowed disabled:opacity-55 ${vehicleFieldSurface}`}
          >
            <option value="" className="bg-card text-foreground dark:bg-[#121216]">
              {modelsLoading
                ? isUa
                  ? "Завантаження..."
                  : "Loading..."
                : make
                  ? isUa
                    ? vehicleMode === "auto"
                      ? "Модель авто"
                      : "Модель мото"
                    : vehicleMode === "auto"
                      ? "Car model"
                      : "Moto model"
                  : isUa
                    ? "Спочатку марка"
                    : "Select make first"}
            </option>
            {models.map((modelName) => (
              <option
                key={modelName}
                value={modelName}
                className="bg-card text-foreground dark:bg-[#121216]"
              >
                {modelName}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
        </label>

        <label className="relative block min-w-0">
          <span className="sr-only">{isUa ? "Кузов / шасі" : "Chassis"}</span>
          <select
            value={chassis}
            disabled={!model || submodelsLoading}
            onChange={(event) => setChassis(event.target.value)}
            className={`h-11 w-full appearance-none truncate border border-foreground/15 px-3 pr-9 text-xs font-normal text-foreground/80 outline-hidden transition hover:border-foreground/25 focus:border-foreground/45 disabled:cursor-not-allowed disabled:opacity-55 ${vehicleFieldSurface}`}
          >
            <option value="" className="bg-card text-foreground dark:bg-[#121216]">
              {submodelsLoading
                ? isUa
                  ? "Завантаження..."
                  : "Loading..."
                : model
                  ? isUa
                    ? "Кузов / шасі"
                    : "Chassis"
                  : isUa
                    ? "Спочатку модель"
                    : "Select model first"}
            </option>
            {chassisCodes.map((code) => (
              <option key={code} value={code} className="bg-card text-foreground dark:bg-[#121216]">
                {code}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
        </label>
      </div>
    );
  };

  const renderFilterPanel = (mobile = false) => (
    <form onSubmit={handleSearch} className="flex h-full flex-col">
      <div
        className={`flex shrink-0 items-center justify-between border-b border-foreground/10 px-4 py-3.5 ${
          mobile ? "sticky top-0 z-20 bg-background/98 backdrop-blur-2xl" : ""
        }`}
      >
        <div>
          <p className="text-[11px] font-normal uppercase tracking-[0.2em] text-foreground/80">
            {isUa ? "Фільтри" : "Filters"}
          </p>
          <p className="mt-1 text-xs font-light text-foreground/55">
            {isInitialCatalogLoading
              ? isUa
                ? "Завантаження каталогу…"
                : "Loading catalog…"
              : `${totalCatalogCount.toLocaleString(isUa ? "uk-UA" : "en-US")} ${isUa ? `${getUkrainianPlural(totalCatalogCount, "позиція", "позиції", "позицій")} у каталозі` : "catalog items"}`}
          </p>
        </div>
        {mobile ? (
          <button
            ref={mobileFiltersCloseButtonRef}
            type="button"
            onClick={() => setMobileFiltersOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/10 bg-foreground/5 text-foreground/60 transition hover:border-foreground/25 hover:text-foreground"
            aria-label={isUa ? "Закрити фільтри" : "Close filters"}
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleResetFilters}
            disabled={!hasActiveFilters}
            className="text-[9px] font-medium uppercase tracking-[0.13em] text-primary transition hover:brightness-75 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {isUa ? "Скинути все" : "Reset all"}
          </button>
        )}
      </div>

      <SmartScrollArea className="flex min-h-0 flex-1 scroll-pb-24 flex-col gap-4 overflow-y-auto px-4 py-4 [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-foreground/20 hover:[&::-webkit-scrollbar-thumb]:bg-foreground/35">
        {mobile ? (
          <section className="order-0 space-y-3 border-b border-foreground/10 pb-5">
            <h3 className="text-[10px] font-normal uppercase tracking-[0.2em] text-foreground/70">
              {isUa ? "Підібрати за транспортом" : "Find by vehicle"}
            </h3>
            <div className="grid h-11 grid-cols-2 gap-1 rounded-[9px] border border-foreground/15 bg-foreground/[0.025] p-1">
              {(["auto", "moto"] as const).map((mode) => {
                const selected = vehicleMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => handleVehicleModeChange(mode)}
                    className={`flex items-center justify-center gap-2 rounded-[7px] text-[10px] font-semibold uppercase tracking-[0.14em] transition ${
                      selected
                        ? "bg-foreground text-background"
                        : "text-foreground/55 hover:bg-foreground/[0.055] hover:text-foreground"
                    }`}
                  >
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-[8px] border transition-colors ${
                        selected
                          ? "border-background/15 bg-background/[0.08]"
                          : "border-foreground/10 bg-foreground/[0.035]"
                      }`}
                    >
                      <PremiumVehicleIcon mode={mode} className="h-5 w-7" />
                    </span>
                    {mode === "auto" ? (isUa ? "Авто" : "Auto") : isUa ? "Мото" : "Moto"}
                  </button>
                );
              })}
            </div>
            {renderVehicleFitmentFields()}
          </section>
        ) : null}

        <section className="order-1 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-normal uppercase tracking-[0.2em] text-foreground/70">
              {isUa ? "Наявність" : "Availability"}
            </h3>
          </div>
          <div className="grid gap-1">
            {(Object.keys(STOCK_LABELS) as StockFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStockFilter(value)}
                className={`flex min-h-8 items-center gap-2 border px-2.5 text-left text-[11px] font-light transition ${
                  stockFilter === value
                    ? "border-foreground/25 bg-foreground/[0.055] text-foreground"
                    : "border-transparent bg-transparent text-foreground/60 hover:border-foreground/12 hover:bg-foreground/[0.035] hover:text-foreground"
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border ${
                    stockFilter === value
                      ? "border-foreground bg-foreground text-background"
                      : "border-foreground/18"
                  }`}
                >
                  {stockFilter === value ? <Check className="h-3 w-3" /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {isUa ? STOCK_LABELS[value].ua : STOCK_LABELS[value].en}
                </span>
                <span className="shrink-0 font-mono text-[10px] opacity-55">
                  {isInitialCatalogLoading
                    ? "—"
                    : (stockCount(value) ?? 0).toLocaleString(isUa ? "uk-UA" : "en-US")}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="order-4 space-y-2.5 border-t border-foreground/10 pt-4">
          <h3 className="text-[10px] font-normal uppercase tracking-[0.2em] text-foreground/70">
            {isUa ? "Ціна" : "Price"}
          </h3>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="sr-only">{isUa ? "Ціна від" : "Minimum price"}</span>
                <input
                  value={minPriceFilter}
                  onChange={(event) =>
                    setMinPriceFilter(sanitizeStockPriceInput(event.target.value))
                  }
                  inputMode="decimal"
                  placeholder={isUa ? "Від" : "From"}
                  className="h-10 w-full rounded-none border border-foreground/10 bg-foreground/[0.035] px-3 font-mono text-xs text-foreground outline-hidden transition placeholder:font-sans placeholder:text-foreground/35 focus:border-foreground/35 focus:bg-foreground/[0.055]"
                />
              </label>
              <label className="block">
                <span className="sr-only">{isUa ? "Ціна до" : "Maximum price"}</span>
                <input
                  value={maxPriceFilter}
                  onChange={(event) =>
                    setMaxPriceFilter(sanitizeStockPriceInput(event.target.value))
                  }
                  inputMode="decimal"
                  placeholder={isUa ? "До" : "To"}
                  className="h-10 w-full rounded-none border border-foreground/10 bg-foreground/[0.035] px-3 font-mono text-xs text-foreground outline-hidden transition placeholder:font-sans placeholder:text-foreground/35 focus:border-foreground/35 focus:bg-foreground/[0.055]"
                />
              </label>
            </div>
            <div className="flex min-h-4 items-center justify-between gap-2 text-[10px] font-light uppercase tracking-[0.12em] text-foreground/50">
              <span>{currency}</span>
              {priceBoundsLabel ? <span className="truncate">{priceBoundsLabel}</span> : null}
            </div>
          </div>
        </section>

        <section className="order-2 space-y-2.5 border-t border-foreground/10 pt-4">
          <button
            type="button"
            onClick={() => setCategorySectionOpen((current) => !current)}
            className="flex w-full items-center justify-between text-left"
            aria-expanded={categorySectionOpen}
          >
            <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-foreground/70">
              {isUa ? "Група товарів" : "Product group"}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-foreground/40 transition-transform duration-200 ${
                categorySectionOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          {categorySectionOpen ? (
            <>
              <label className="relative flex h-9 items-center rounded-none border border-foreground/10 bg-foreground/[0.03] px-3 transition focus-within:border-foreground/30 focus-within:bg-foreground/[0.05]">
                <Search className="h-3.5 w-3.5 shrink-0 text-foreground/35" />
                <input
                  value={categoryFilterQuery}
                  onChange={(event) => setCategoryFilterQuery(event.target.value)}
                  placeholder={isUa ? "Знайти групу" : "Find group"}
                  className="h-full min-w-0 flex-1 bg-transparent px-2 text-xs font-light text-foreground outline-hidden placeholder:text-foreground/35"
                />
                {categoryFilterQuery ? (
                  <button
                    type="button"
                    onClick={() => setCategoryFilterQuery("")}
                    className="text-foreground/40 transition hover:text-foreground"
                    aria-label={isUa ? "Очистити пошук груп" : "Clear group search"}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </label>
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => setLocalCategory("")}
                  className={`flex min-h-9 w-full items-center justify-between rounded-none border px-3 text-left text-xs font-light transition ${
                    !localCategory
                      ? "border-foreground/30 bg-foreground/[0.06] text-foreground"
                      : "border-transparent text-foreground/60 hover:border-foreground/10 hover:bg-foreground/[0.04] hover:text-foreground"
                  }`}
                >
                  <span>{isUa ? "Всі групи" : "All groups"}</span>
                  <span className="font-mono text-[10px] opacity-55">
                    {(filterStats?.stock.all ?? 0).toLocaleString(isUa ? "uk-UA" : "en-US")}
                  </span>
                </button>
                {displayedCategories.map((categoryName) => (
                  <button
                    key={categoryName}
                    type="button"
                    onClick={() => setLocalCategory(categoryName)}
                    className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-none border px-3 text-left text-xs font-light transition ${
                      localCategory === categoryName
                        ? "border-foreground/30 bg-foreground/[0.06] text-foreground"
                        : "border-transparent text-foreground/60 hover:border-foreground/10 hover:bg-foreground/[0.04] hover:text-foreground"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{categoryName}</span>
                    <span className="font-mono text-[10px] opacity-55">
                      {categoryCountByLabel.get(categoryName) ?? 0}
                    </span>
                  </button>
                ))}
                {visibleCategories.length === 0 ? (
                  <div className="px-3 py-3 text-xs font-light text-foreground/40">
                    {isUa ? "Нічого не знайдено" : "No groups found"}
                  </div>
                ) : null}
                {!categoryFilterQuery.trim() && visibleCategories.length > 7 ? (
                  <button
                    type="button"
                    onClick={() => setCategoriesExpanded((current) => !current)}
                    className="flex min-h-9 w-full items-center justify-between border-t border-foreground/8 px-3 pt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-foreground/48 transition hover:text-foreground"
                  >
                    <span>
                      {categoriesExpanded
                        ? isUa
                          ? "Показати менше"
                          : "Show less"
                        : isUa
                          ? "Показати більше"
                          : "Show more"}
                    </span>
                    <span className="font-mono text-[9px]">
                      {categoriesExpanded ? "−" : `+${visibleCategories.length - 7}`}
                    </span>
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </section>

        <section className="order-3 space-y-2.5 border-t border-foreground/10 pt-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setBrandSectionOpen((current) => !current)}
              className="flex min-w-0 flex-1 items-center justify-between text-left"
              aria-expanded={brandSectionOpen}
            >
              <span className="text-[10px] font-normal uppercase tracking-[0.2em] text-foreground/70">
                {isUa ? "Бренд" : "Brand"}
              </span>
              <ChevronDown
                className={`mr-3 h-3.5 w-3.5 text-foreground/40 transition-transform duration-200 ${
                  brandSectionOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {selectedBrands.length > 0 ? (
              <button
                type="button"
                onClick={() => setSelectedBrands([])}
                className="text-[10px] uppercase tracking-[0.18em] text-foreground/45 transition hover:text-foreground"
              >
                {isUa ? "Очистити" : "Clear"}
              </button>
            ) : null}
          </div>
          {brandSectionOpen ? (
            <>
              <label className="relative flex h-9 items-center rounded-none border border-foreground/10 bg-foreground/[0.03] px-3 transition focus-within:border-foreground/30 focus-within:bg-foreground/[0.05]">
                <Search className="h-3.5 w-3.5 shrink-0 text-foreground/35" />
                <input
                  value={brandFilterQuery}
                  onChange={(event) => setBrandFilterQuery(event.target.value)}
                  placeholder={isUa ? "Знайти бренд" : "Find brand"}
                  className="h-full min-w-0 flex-1 bg-transparent px-2 text-xs font-light text-foreground outline-hidden placeholder:text-foreground/35"
                />
                {brandFilterQuery ? (
                  <button
                    type="button"
                    onClick={() => setBrandFilterQuery("")}
                    className="text-foreground/40 transition hover:text-foreground"
                    aria-label={isUa ? "Очистити пошук брендів" : "Clear brand search"}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </label>
              <div className="space-y-0.5">
                {displayedBrands.map((brandName) => {
                  const selected = selectedBrands.includes(brandName);
                  const logoPath = getBrandLogoPath(brandName);
                  return (
                    <button
                      key={brandName}
                      type="button"
                      onClick={() => handleToggleBrand(brandName)}
                      className={`flex min-h-10 w-full items-center gap-3 rounded-none border px-3 text-left text-xs font-light transition ${
                        selected
                          ? "border-foreground/30 bg-foreground/[0.06] text-foreground"
                          : "border-transparent text-foreground/60 hover:border-foreground/10 hover:bg-foreground/[0.04] hover:text-foreground"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-none border ${
                          selected
                            ? "border-foreground/45 bg-foreground text-background"
                            : "border-foreground/15"
                        }`}
                      >
                        {selected ? <Check className="h-3 w-3" /> : null}
                      </span>
                      <BrandLogoTile brandName={brandName} logoPath={logoPath} size="xs" />
                      <span className="min-w-0 flex-1 truncate" title={brandName}>
                        {brandName}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] opacity-55">
                        {brandCountByLabel.get(brandName) ?? 0}
                      </span>
                    </button>
                  );
                })}
                {visibleBrands.length === 0 ? (
                  <div className="px-3 py-3 text-xs font-light text-foreground/40">
                    {isUa ? "Нічого не знайдено" : "No brands found"}
                  </div>
                ) : null}
                {!brandFilterQuery.trim() && visibleBrands.length > 7 ? (
                  <button
                    type="button"
                    onClick={() => setBrandsExpanded((current) => !current)}
                    className="flex min-h-9 w-full items-center justify-between border-t border-foreground/8 px-3 pt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-foreground/48 transition hover:text-foreground"
                  >
                    <span>
                      {brandsExpanded
                        ? isUa
                          ? "Показати менше"
                          : "Show less"
                        : isUa
                          ? "Показати більше"
                          : "Show more"}
                    </span>
                    <span className="font-mono text-[9px]">
                      {brandsExpanded ? "−" : `+${visibleBrands.length - 7}`}
                    </span>
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </section>
      </SmartScrollArea>

      {mobile ? (
        <div className="sticky bottom-0 z-20 shrink-0 border-t border-foreground/10 bg-background/98 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-2xl">
          <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-2">
            <button
              type="button"
              onClick={handleResetFilters}
              disabled={!hasActiveFilters}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-[8px] border border-foreground/15 bg-transparent px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/65 transition hover:border-foreground/35 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
            >
              <X className="h-4 w-4" />
              {isUa ? "Скинути" : "Reset"}
            </button>
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(false)}
              className="flex h-11 min-w-0 items-center justify-center rounded-[8px] border border-foreground bg-foreground px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-background transition hover:bg-transparent hover:text-foreground"
            >
              <span className="truncate">
                {isUa ? "Показати" : "Show"} {totalItems.toLocaleString(isUa ? "uk-UA" : "en-US")}
              </span>
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground selection:bg-foreground/20">
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent via-foreground/[0.02] to-foreground/[0.045] dark:via-black/45 dark:to-black/75" />
      <div className="pt-16 sm:pt-20 lg:pt-16" />

      {/* ════ RESULTS ════ */}
      <CatalogOverlayPortal>
        <AnimatePresence>
          {mobileFiltersOpen ? (
            <>
              <motion.button
                type="button"
                aria-label={isUa ? "Закрити фільтри" : "Close filters"}
                className="fixed inset-0 z-[90] bg-background/75 backdrop-blur-sm lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileFiltersOpen(false)}
              />
              <motion.aside
                ref={mobileFiltersDialogRef}
                role="dialog"
                aria-modal="true"
                aria-label={isUa ? "Фільтри каталогу" : "Catalog filters"}
                className="fixed inset-x-0 bottom-0 z-[100] mx-auto h-[92dvh] w-full max-w-[680px] overflow-hidden rounded-t-[22px] border border-b-0 border-foreground/15 bg-background/98 shadow-[0_-28px_90px_rgba(0,0,0,0.22)] backdrop-blur-3xl dark:shadow-[0_-28px_90px_rgba(0,0,0,0.62)] lg:hidden"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 330, damping: 34 }}
              >
                {renderFilterPanel(true)}
              </motion.aside>
            </>
          ) : null}
        </AnimatePresence>
      </CatalogOverlayPortal>

      <CatalogOverlayPortal>
        <AnimatePresence>
          {makePickerOpen ? (
            <div className="fixed inset-0 z-[140] flex items-end justify-center sm:items-center sm:p-5">
              <motion.button
                type="button"
                aria-label={isUa ? "Закрити вибір марки" : "Close make selector"}
                className="absolute inset-0 bg-background/75 backdrop-blur-md dark:bg-black/80"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMakePickerOpen(false)}
              />
              <motion.div
                ref={makePickerDialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="vehicle-make-picker-title"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="relative flex max-h-[92vh] w-full max-w-[980px] flex-col border border-foreground/15 bg-card/98 shadow-[0_30px_100px_rgba(0,0,0,0.18)] dark:bg-[#0a0b0d] dark:shadow-[0_30px_100px_rgba(0,0,0,0.65)] sm:max-h-[82vh]"
              >
                <div className="flex items-start justify-between gap-4 border-b border-foreground/10 px-4 py-4 sm:px-6 sm:py-5">
                  <div className="min-w-0">
                    <p className="text-[9px] font-medium uppercase tracking-[0.22em] text-foreground/45">
                      {isUa ? "Підбір сумісності" : "Fitment selection"}
                    </p>
                    <h2
                      id="vehicle-make-picker-title"
                      className="mt-1 text-xl font-light text-foreground sm:text-2xl"
                    >
                      {isUa
                        ? vehicleMode === "auto"
                          ? "Оберіть марку авто"
                          : "Оберіть марку мото"
                        : vehicleMode === "auto"
                          ? "Choose a car make"
                          : "Choose a moto make"}
                    </h2>
                    <p className="mt-1 text-xs font-light text-foreground/48">
                      {makes.length.toLocaleString(isUa ? "uk-UA" : "en-US")}{" "}
                      {isUa ? "марок" : "makes"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMakePickerOpen(false)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center border border-foreground/12 text-foreground/55 transition hover:border-foreground/35 hover:text-foreground"
                    aria-label={isUa ? "Закрити" : "Close"}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="border-b border-foreground/10 p-4 sm:px-6">
                  <label className="flex h-11 items-center border border-foreground/15 bg-foreground/[0.025] px-3 transition focus-within:border-foreground/40">
                    <Search className="h-4 w-4 shrink-0 text-foreground/40" />
                    <input
                      ref={makePickerSearchInputRef}
                      type="search"
                      value={makePickerQuery}
                      onChange={(event) => setMakePickerQuery(event.target.value)}
                      placeholder={isUa ? "Пошук марки" : "Search makes"}
                      className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm font-light text-foreground outline-hidden placeholder:text-foreground/35"
                    />
                    {makePickerQuery ? (
                      <button
                        type="button"
                        onClick={() => setMakePickerQuery("")}
                        className="text-foreground/40 transition hover:text-foreground"
                        aria-label={isUa ? "Очистити пошук" : "Clear search"}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </label>
                </div>

                <SmartScrollArea className="min-h-0 flex-1 overflow-y-auto p-3 [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-foreground/20 hover:[&::-webkit-scrollbar-thumb]:bg-foreground/35 sm:p-5">
                  {visibleVehicleMakes.length > 0 ? (
                    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 sm:gap-2 md:grid-cols-4 lg:grid-cols-5">
                      {visibleVehicleMakes.map((makeName) => {
                        const selected = makeName === make;
                        return (
                          <button
                            key={makeName}
                            type="button"
                            onClick={() => handleSelectVehicleMake(makeName)}
                            className={`group relative flex min-h-[88px] min-w-0 flex-col items-center justify-center gap-2 border px-2 py-3 text-center transition ${
                              selected
                                ? "border-foreground/40 bg-foreground/[0.07] text-foreground"
                                : "border-foreground/[0.07] bg-transparent text-foreground/64 hover:border-foreground/24 hover:bg-foreground/[0.035] hover:text-foreground"
                            }`}
                          >
                            <VehicleMakeLogo make={makeName} size="md" />
                            <span className="w-full truncate text-[11px] font-normal">
                              {makeName}
                            </span>
                            {selected ? (
                              <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-foreground/70" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-16 text-center text-sm font-light text-foreground/45">
                      {isUa ? "Марку не знайдено" : "No make found"}
                    </div>
                  )}
                </SmartScrollArea>

                {make ? (
                  <div className="border-t border-foreground/10 p-4 sm:px-6">
                    <button
                      type="button"
                      onClick={() => handleSelectVehicleMake("")}
                      className="flex h-10 w-full items-center justify-center gap-2 border border-foreground/12 text-[10px] font-medium uppercase tracking-[0.16em] text-foreground/55 transition hover:border-foreground/35 hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                      {isUa ? "Очистити марку" : "Clear make"}
                    </button>
                  </div>
                ) : null}
              </motion.div>
            </div>
          ) : null}
        </AnimatePresence>
      </CatalogOverlayPortal>

      <div className="relative w-full max-w-none px-3 pb-32 sm:px-5 lg:px-6 2xl:px-8">
        <section className="relative z-30 isolate mb-0 min-h-[250px] overflow-hidden rounded-[18px] border border-foreground/10 bg-[#f3efe7] shadow-[0_18px_55px_rgba(0,0,0,0.08)] dark:bg-[#08090b] sm:min-h-[270px] lg:-mx-6 lg:rounded-none lg:border-x-0 2xl:-mx-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[url('/images/hero-stock-performance-light-v3.webp')] bg-cover bg-[position:66%_46%] bg-no-repeat dark:bg-[url('/images/hero-stock-performance-dark-v3.webp')] sm:bg-[position:50%_46%]"
          />
          <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-[#f8f5ef]/98 via-[#f8f5ef]/76 to-[#f8f5ef]/5 dark:from-black/92 dark:via-black/52 dark:to-black/5 sm:from-[#f8f5ef]/95 sm:via-[#f8f5ef]/62 sm:to-transparent sm:dark:from-black/88 sm:dark:via-black/38 sm:dark:to-transparent" />
          <div className="relative z-10 flex min-h-[250px] items-end p-5 pb-20 sm:min-h-[270px] sm:p-7 sm:pb-24 lg:p-9 lg:pb-24">
            <div className="min-w-0 self-end lg:pb-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.26em] text-foreground/55 dark:text-white/65">
                ONE COMPANY
              </p>
              <h1 className="mt-2 max-w-[620px] text-[29px] font-extralight leading-[1.03] tracking-[-0.035em] text-foreground dark:text-white sm:text-[38px] lg:text-[46px]">
                {isUa ? "Каталог товарів" : "Product catalog"}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-light text-foreground/60 dark:text-white/65">
                <span>
                  {isInitialCatalogLoading
                    ? isUa
                      ? "Завантаження каталогу…"
                      : "Loading catalog…"
                    : `${totalCatalogCount.toLocaleString(isUa ? "uk-UA" : "en-US")} ${isUa ? getUkrainianPlural(totalCatalogCount, "товар", "товари", "товарів") : "products"}`}
                </span>
                {!isInitialCatalogLoading ? (
                  <span className="border-l border-foreground/18 pl-3 dark:border-white/22">
                    {(filterStats?.stock.inStock ?? 0).toLocaleString(isUa ? "uk-UA" : "en-US")}{" "}
                    {isUa ? "в наявності" : "in stock"}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section
          aria-label={
            isUa
              ? vehicleMode === "auto"
                ? "Пошук і підбір за авто"
                : "Пошук і підбір за мото"
              : "Search and vehicle finder"
          }
          className="relative z-40 -mt-16 mx-2 rounded-[16px] border border-foreground/10 bg-card/98 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.13)] backdrop-blur-2xl dark:bg-[#08090b]/98 sm:mx-0 sm:p-4 lg:rounded-[12px] lg:px-5 lg:py-5"
        >
          <div className="space-y-2 self-end sm:space-y-3">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_260px] lg:grid-cols-[minmax(0,1fr)_380px]">
              <div
                ref={searchBoxRef}
                className="relative z-50"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    closeSuggestions();
                  }
                }}
              >
                <label className="relative flex min-h-11 items-center border border-foreground/18 bg-card/88 px-3 shadow-[0_2px_10px_rgba(0,0,0,0.04)] backdrop-blur-xl transition focus-within:border-foreground/40 focus-within:bg-card dark:border-white/18 dark:bg-black/65 dark:shadow-none dark:focus-within:border-white/45 dark:focus-within:bg-black/80 sm:min-h-12 sm:px-4">
                  <Search className="h-4 w-4 shrink-0 text-foreground/45" />
                  <input
                    type="text"
                    inputMode="search"
                    autoComplete="off"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onFocus={() => {
                      searchFocusedRef.current = true;
                      setSearchFocused(true);
                      if (query.trim().length >= 2) setSuggestionsOpen(true);
                    }}
                    onKeyDown={handleSuggestionKeyDown}
                    placeholder={
                      isUa ? "Пошук: бренд, SKU, авто" : "Search: brand, SKU, product, or vehicle"
                    }
                    role="combobox"
                    aria-expanded={suggestionsOpen}
                    aria-controls="stock-search-suggestions"
                    aria-activedescendant={
                      activeSuggestionIndex >= 0
                        ? `stock-suggestion-${activeSuggestionIndex}`
                        : undefined
                    }
                    className="h-10 min-w-0 flex-1 bg-transparent px-2 text-[13px] font-light text-foreground outline-hidden placeholder:text-foreground/38 sm:h-11 sm:px-3 sm:text-sm"
                  />
                  {suggestionsLoading ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-foreground/40" />
                  ) : null}
                  {query ? (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="ml-2 text-foreground/45 transition hover:text-foreground"
                      aria-label={isUa ? "Очистити пошук" : "Clear search"}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </label>

                <AnimatePresence>
                  {suggestionsOpen && query.trim().length >= 2 ? (
                    <motion.div
                      id="stock-search-suggestions"
                      role="listbox"
                      initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.16 }}
                      className="absolute left-0 right-0 top-[calc(100%+6px)] max-h-[420px] overflow-y-auto border border-foreground/15 bg-popover/98 p-1.5 text-popover-foreground shadow-[0_24px_70px_rgba(0,0,0,0.16)] backdrop-blur-2xl [scrollbar-width:thin] dark:border-white/16 dark:bg-[#090a0c]/98 dark:shadow-[0_24px_70px_rgba(0,0,0,0.72)]"
                    >
                      {suggestions.length > 0 ? (
                        suggestions.map((suggestion, index) => {
                          const active = activeSuggestionIndex === index;
                          return (
                            <button
                              id={`stock-suggestion-${index}`}
                              key={suggestion.id}
                              type="button"
                              role="option"
                              aria-selected={active}
                              onMouseEnter={() => setActiveSuggestionIndex(index)}
                              onClick={() => handleSuggestionSelection(suggestion)}
                              className={`grid min-h-14 w-full min-w-0 grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 border px-3 py-2 text-left transition ${
                                active
                                  ? "border-foreground/20 bg-foreground/[0.075]"
                                  : "border-transparent hover:border-foreground/10 hover:bg-foreground/[0.04]"
                              }`}
                            >
                              <span className="flex h-9 w-11 items-center justify-center overflow-hidden">
                                {suggestion.type === "product" ? (
                                  <SafeProductImage
                                    src={suggestion.thumbnail}
                                    alt=""
                                    className="h-full w-full object-contain p-0.5"
                                    isMini
                                  />
                                ) : suggestion.type === "brand" ? (
                                  <BrandLogoTile
                                    brandName={suggestion.label}
                                    logoPath={getBrandLogoPath(suggestion.label)}
                                    size="xs"
                                  />
                                ) : (
                                  <VehicleMakeLogo make={suggestion.make} />
                                )}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-normal text-foreground/88">
                                  {suggestion.type === "product"
                                    ? suggestion.name
                                    : suggestion.label}
                                </span>
                                <span className="mt-0.5 block truncate text-[9px] font-light uppercase tracking-[0.1em] text-foreground/42">
                                  {suggestion.type === "product"
                                    ? `${suggestion.brand} · ${suggestion.partNumber}`
                                    : suggestion.type === "brand"
                                      ? isUa
                                        ? "Бренд"
                                        : "Brand"
                                      : suggestion.model
                                        ? isUa
                                          ? vehicleMode === "auto"
                                            ? "Модель авто"
                                            : "Модель мото"
                                          : "Vehicle model"
                                        : isUa
                                          ? vehicleMode === "auto"
                                            ? "Марка авто"
                                            : "Марка мото"
                                          : "Vehicle make"}
                                </span>
                              </span>
                              <span className="max-w-[110px] shrink-0 truncate text-right font-mono text-[9px] text-foreground/35 sm:max-w-[150px]">
                                {suggestion.type === "product"
                                  ? suggestion.category
                                  : suggestion.count && suggestion.count > 0
                                    ? suggestion.count.toLocaleString(isUa ? "uk-UA" : "en-US")
                                    : null}
                              </span>
                            </button>
                          );
                        })
                      ) : !suggestionsLoading ? (
                        <div className="px-4 py-6 text-center text-xs font-light text-foreground/42">
                          {isUa ? "Нічого не знайдено" : "No suggestions found"}
                        </div>
                      ) : null}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <div
                className="hidden h-12 grid-cols-2 gap-1 rounded-[9px] border border-foreground/15 bg-foreground/[0.025] p-1 sm:grid"
                aria-label={isUa ? "Тип транспорту" : "Vehicle type"}
              >
                {(["auto", "moto"] as const).map((mode) => {
                  const selected = vehicleMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => handleVehicleModeChange(mode)}
                      className={`flex items-center justify-center gap-2 rounded-[7px] text-[10px] font-semibold uppercase tracking-[0.16em] transition ${
                        selected
                          ? "bg-foreground text-background shadow-[0_6px_18px_rgba(0,0,0,0.16)]"
                          : "text-foreground/55 hover:bg-foreground/[0.055] hover:text-foreground"
                      }`}
                    >
                      <span
                        className={`grid h-8 w-8 place-items-center rounded-[8px] border transition-colors ${
                          selected
                            ? "border-background/15 bg-background/[0.08]"
                            : "border-foreground/10 bg-foreground/[0.035]"
                        }`}
                      >
                        <PremiumVehicleIcon mode={mode} className="h-5 w-7" />
                      </span>
                      {mode === "auto" ? (isUa ? "Авто" : "Auto") : isUa ? "Мото" : "Moto"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:hidden">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                data-catalog-filter-trigger
                className="flex h-11 w-full min-w-0 items-center gap-3 border border-foreground/15 bg-card/90 px-3 text-left shadow-[0_12px_35px_rgba(0,0,0,0.08)] backdrop-blur-xl transition hover:border-foreground/35 hover:bg-card dark:border-white/18 dark:bg-black/55 dark:shadow-none dark:hover:border-white/35 dark:hover:bg-black/70"
              >
                <SlidersHorizontal className="h-4 w-4 shrink-0 text-foreground/65" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-medium text-foreground/85">
                    {isUa
                      ? vehicleMode === "auto"
                        ? "Підібрати за авто"
                        : "Підібрати за мото"
                      : "Find by vehicle"}
                  </span>
                  <span className="block truncate text-[10px] font-light text-foreground/50">
                    {selectedVehicleLabel ||
                      (isUa ? "Марка, модель і кузов" : "Make, model, and chassis")}
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 rotate-180 text-foreground/45" />
              </button>
            </div>
            <div className="hidden gap-2 lg:grid lg:grid-cols-[repeat(3,minmax(0,1fr))_132px]">
              {renderVehicleFitmentFields(true)}
              <button
                type="button"
                onClick={() => handleSearch()}
                disabled={loading}
                className="flex h-11 items-center justify-center rounded-[8px] border border-primary bg-primary px-4 text-[10px] font-semibold uppercase tracking-[0.13em] text-primary-foreground shadow-[0_10px_22px_rgba(213,0,28,0.2)] transition hover:-translate-y-px hover:brightness-105 disabled:cursor-wait disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isUa ? (
                  "Застосувати"
                ) : (
                  "Apply"
                )}
              </button>
            </div>
          </div>
        </section>

        <AnimatePresence initial={false}>
          {selectedVehicleLabel ? (
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="mx-2 mb-4 overflow-hidden rounded-b-[12px] border-x border-b border-foreground/10 bg-card/70 sm:mx-4 sm:mb-5 lg:mx-5"
            >
              <div className="flex min-h-12 items-center gap-3 px-4 sm:px-5">
                {vehicleMode === "auto" ? (
                  <PremiumVehicleIcon
                    mode="auto"
                    className="h-[17px] w-[17px] text-foreground/60"
                  />
                ) : (
                  <PremiumVehicleIcon
                    mode="moto"
                    className="h-[17px] w-[17px] text-foreground/60"
                  />
                )}
                <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-foreground/45">
                  {isUa
                    ? vehicleMode === "auto"
                      ? "Обране авто"
                      : "Обране мото"
                    : vehicleMode === "auto"
                      ? "Selected car"
                      : "Selected moto"}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-normal text-foreground/80">
                  {selectedVehicleLabel}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMake("");
                    setModel("");
                    setChassis("");
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center border border-foreground/10 text-foreground/45 transition hover:border-foreground/30 hover:text-foreground"
                  aria-label={
                    isUa
                      ? vehicleMode === "auto"
                        ? "Очистити вибір авто"
                        : "Очистити вибір мото"
                      : "Clear selected vehicle"
                  }
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="mb-4 sm:mb-5" />
          )}
        </AnimatePresence>

        <div
          id="catalog-results"
          className="grid gap-3 sm:gap-4 lg:grid-cols-[292px_minmax(0,1fr)] xl:grid-cols-[308px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)]"
        >
          <aside className="hidden lg:block">
            <div className="sticky top-24 h-[calc(100dvh-7rem)] max-h-[calc(100dvh-7rem)] overflow-hidden rounded-[14px] border border-foreground/10 bg-card/78 shadow-[0_16px_42px_rgba(0,0,0,0.075)] backdrop-blur-3xl dark:bg-white/[0.014] dark:shadow-[0_12px_30px_rgba(0,0,0,0.24)]">
              {renderFilterPanel()}
            </div>
          </aside>

          <div className="min-w-0">
            <div className="mb-4 rounded-[14px] border border-foreground/10 bg-card/78 p-3 shadow-[0_16px_42px_rgba(0,0,0,0.075)] backdrop-blur-3xl dark:bg-white/[0.014] dark:shadow-[0_12px_30px_rgba(0,0,0,0.24)] sm:mb-4 sm:p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="hidden items-center gap-2 text-[9px] font-light text-foreground/48 sm:flex">
                    <Link
                      href={`/${locale}/shop`}
                      prefetch={false}
                      className="transition hover:text-foreground"
                    >
                      {isUa ? "Магазин" : "Shop"}
                    </Link>
                    <span aria-hidden="true">/</span>
                    <span>{isUa ? "Каталог товарів" : "Product catalog"}</span>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-end gap-x-3 gap-y-1 sm:mt-1.5">
                    <h2 className="min-w-0 text-lg font-extralight leading-tight tracking-tight text-foreground sm:text-xl">
                      {isUa ? "Каталог товарів" : "Product catalog"}
                    </h2>
                    <span className="min-w-0 pb-0.5 font-mono text-[11px] text-foreground/42 sm:text-xs">
                      {isInitialCatalogLoading
                        ? isUa
                          ? "Завантаження…"
                          : "Loading…"
                        : `${totalItems.toLocaleString(isUa ? "uk-UA" : "en-US")} ${isUa ? getUkrainianPlural(totalItems, "товар", "товари", "товарів") : "products"}${totalPages > 1 ? ` / ${isUa ? "сторінка" : "page"} ${page}/${totalPages}` : ""}`}
                    </span>
                  </div>
                </div>

                <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] lg:grid-cols-[minmax(0,1fr)_auto_auto] xl:flex xl:w-auto xl:flex-wrap">
                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(true)}
                    data-catalog-filter-trigger
                    className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-foreground/15 bg-foreground/[0.04] px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground transition hover:border-foreground/35 sm:h-10 lg:hidden"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    {isUa ? "Фільтри" : "Filters"}
                    {activeFilterCount > 0 ? (
                      <span className="font-mono text-foreground">{activeFilterCount}</span>
                    ) : null}
                  </button>

                  <label className="relative order-3 col-span-3 h-9 min-w-0 sm:order-none sm:col-span-1 sm:h-10">
                    <span className="sr-only">{isUa ? "Сортування" : "Sort"}</span>
                    <select
                      value={sortOrder}
                      onChange={(event) => setSortOrder(event.target.value as StockSort)}
                      className="h-9 w-full min-w-0 appearance-none truncate rounded-[8px] border border-foreground/15 bg-foreground/[0.035] pl-3 pr-8 text-xs font-normal text-foreground/80 outline-hidden transition hover:border-foreground/30 focus:border-foreground/45 sm:h-10 sm:pr-9 xl:w-[190px]"
                    >
                      {(Object.keys(SORT_LABELS) as StockSort[]).map((value) => (
                        <option
                          key={value}
                          value={value}
                          className="bg-card text-foreground dark:bg-[#121216]"
                        >
                          {value === "default" && query.trim()
                            ? isUa
                              ? "Релевантність"
                              : "Relevance"
                            : isUa
                              ? SORT_LABELS[value].ua
                              : SORT_LABELS[value].en}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/45" />
                  </label>

                  <div className="flex h-9 rounded-[8px] border border-foreground/10 bg-foreground/[0.035] p-0.5 sm:h-10">
                    <button
                      type="button"
                      onClick={() => handleSetViewMode("grid")}
                      className={`flex w-9 items-center justify-center transition ${
                        viewMode === "grid"
                          ? "rounded-[6px] bg-foreground/[0.92] text-background"
                          : "text-foreground/45 hover:text-foreground"
                      }`}
                      title={isUa ? "Сітка" : "Grid"}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetViewMode("list")}
                      className={`flex w-9 items-center justify-center transition ${
                        viewMode === "list"
                          ? "rounded-[6px] bg-foreground/[0.92] text-background"
                          : "text-foreground/45 hover:text-foreground"
                      }`}
                      title={isUa ? "Список" : "List"}
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </div>
                  <StockAiAssistant
                    key={`stock-ai-${vehicleMode}-${make}-${model}-${chassis}-${requestedYear ?? ""}-${engineFilter}-${opfGpfFilter ?? ""}-${productKindFilter ?? ""}-${localCategory}`}
                    locale={displayLocale}
                    currency={currency}
                    scope={vehicleMode}
                    country={country ?? undefined}
                    query={query}
                    category={localCategory}
                    make={make}
                    model={model}
                    chassis={chassis}
                    year={requestedYear}
                    engine={engineFilter}
                    opfGpf={opfGpfFilter}
                    productKind={productKindFilter ?? undefined}
                  />
                </div>
              </div>

              {hasActiveFilters ? (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-foreground/10 pt-3">
                  {query.trim() ? (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="inline-flex min-h-8 items-center gap-2 rounded-[7px] border border-foreground/15 bg-foreground/[0.04] px-3 text-[11px] text-foreground/75 transition hover:border-foreground/35 hover:text-foreground"
                    >
                      {isUa ? `Пошук: ${query.trim()}` : `Search: ${query.trim()}`}
                      <X className="h-3.5 w-3.5 text-foreground/45" />
                    </button>
                  ) : null}
                  {vehicleMode === "moto" ? (
                    <button
                      type="button"
                      onClick={() => handleVehicleModeChange("auto")}
                      className="inline-flex min-h-8 items-center gap-2 rounded-[7px] border border-foreground/12 bg-foreground/[0.03] px-3 text-[11px] text-foreground/70 transition hover:border-foreground/25 hover:text-foreground"
                    >
                      <PremiumVehicleIcon mode="moto" className="h-4 w-4" />
                      {isUa ? "Каталог: Мото" : "Catalog: Moto"}
                      <X className="h-3.5 w-3.5 text-foreground/45" />
                    </button>
                  ) : null}
                  {selectedBrands.map((brandName) => (
                    <button
                      key={brandName}
                      type="button"
                      onClick={() => handleToggleBrand(brandName)}
                      className="inline-flex min-h-8 items-center gap-2 rounded-[7px] border border-foreground/12 bg-foreground/[0.03] px-3 text-[11px] text-foreground/70 transition hover:border-foreground/25 hover:text-foreground"
                    >
                      {isUa ? `Бренд: ${brandName}` : `Brand: ${brandName}`}
                      <X className="h-3.5 w-3.5 text-foreground/45" />
                    </button>
                  ))}
                  {localCategory ? (
                    <button
                      type="button"
                      onClick={() => setLocalCategory("")}
                      className="inline-flex min-h-8 items-center gap-2 rounded-[7px] border border-foreground/12 bg-foreground/[0.03] px-3 text-[11px] text-foreground/70 transition hover:border-foreground/25 hover:text-foreground"
                    >
                      {isUa ? `Група: ${localCategoryLabel}` : `Group: ${localCategoryLabel}`}
                      <X className="h-3.5 w-3.5 text-foreground/45" />
                    </button>
                  ) : null}
                  {[make, model, chassis].filter(Boolean).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        if (value === chassis) setChassis("");
                        else if (value === model) {
                          setModel("");
                          setChassis("");
                        } else {
                          setMake("");
                          setModel("");
                          setChassis("");
                        }
                      }}
                      className="inline-flex min-h-8 items-center gap-2 rounded-[7px] border border-foreground/12 bg-foreground/[0.03] px-3 text-[11px] text-foreground/70 transition hover:border-foreground/25 hover:text-foreground"
                    >
                      {value}
                      <X className="h-3.5 w-3.5 text-foreground/45" />
                    </button>
                  ))}
                  {requestedYear ? (
                    <button
                      type="button"
                      onClick={() => setRequestedYear(null)}
                      className="inline-flex min-h-8 items-center gap-2 rounded-[7px] border border-foreground/12 bg-foreground/[0.03] px-3 text-[11px] text-foreground/70 transition hover:border-foreground/25 hover:text-foreground"
                    >
                      {isUa ? `Рік: ${requestedYear}` : `Year: ${requestedYear}`}
                      <X className="h-3.5 w-3.5 text-foreground/45" />
                    </button>
                  ) : null}
                  {engineFilter.trim() ? (
                    <button
                      type="button"
                      onClick={() => setEngineFilter("")}
                      className="inline-flex min-h-8 items-center gap-2 rounded-[7px] border border-foreground/12 bg-foreground/[0.03] px-3 text-[11px] text-foreground/70 transition hover:border-foreground/25 hover:text-foreground"
                    >
                      {isUa ? `Двигун: ${engineFilter.trim()}` : `Engine: ${engineFilter.trim()}`}
                      <X className="h-3.5 w-3.5 text-foreground/45" />
                    </button>
                  ) : null}
                  {opfGpfFilter ? (
                    <button
                      type="button"
                      onClick={() => setOpfGpfFilter(null)}
                      className="inline-flex min-h-8 items-center gap-2 rounded-[7px] border border-foreground/12 bg-foreground/[0.03] px-3 text-[11px] text-foreground/70 transition hover:border-foreground/25 hover:text-foreground"
                    >
                      {opfGpfFilter === "with"
                        ? isUa
                          ? "З OPF/GPF"
                          : "With OPF/GPF"
                        : isUa
                          ? "Без OPF/GPF"
                          : "Without OPF/GPF"}
                      <X className="h-3.5 w-3.5 text-foreground/45" />
                    </button>
                  ) : null}
                  {productKindFilter ? (
                    <button
                      type="button"
                      onClick={() => setProductKindFilter(null)}
                      className="inline-flex min-h-8 items-center gap-2 rounded-[7px] border border-foreground/12 bg-foreground/[0.03] px-3 text-[11px] text-foreground/70 transition hover:border-foreground/25 hover:text-foreground"
                    >
                      {isUa ? "Тип: " : "Type: "}
                      {formatShopAiProductKind(productKindFilter, isUa ? "ua" : "en")}
                      <X className="h-3.5 w-3.5 text-foreground/45" />
                    </button>
                  ) : null}
                  {stockFilter !== "all" ? (
                    <button
                      type="button"
                      onClick={() => setStockFilter("all")}
                      className="inline-flex min-h-8 items-center gap-2 rounded-[7px] border border-foreground/12 bg-foreground/[0.03] px-3 text-[11px] text-foreground/70 transition hover:border-foreground/25 hover:text-foreground"
                    >
                      {isUa ? STOCK_LABELS[stockFilter].ua : STOCK_LABELS[stockFilter].en}
                      <X className="h-3.5 w-3.5 text-foreground/45" />
                    </button>
                  ) : null}
                  {hasPriceFilter ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMinPriceFilter("");
                        setMaxPriceFilter("");
                      }}
                      className="inline-flex min-h-8 items-center gap-2 rounded-[7px] border border-foreground/12 bg-foreground/[0.03] px-3 text-[11px] text-foreground/70 transition hover:border-foreground/25 hover:text-foreground"
                    >
                      {priceFilterLabel}
                      <X className="h-3.5 w-3.5 text-foreground/45" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex min-h-8 items-center rounded-[7px] border border-foreground/12 bg-foreground/[0.03] px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/55 transition hover:border-foreground/25 hover:bg-foreground/[0.06] hover:text-foreground"
                  >
                    {isUa ? "Скинути все" : "Reset all"}
                  </button>
                </div>
              ) : null}
            </div>
            {error && (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-none border border-foreground/15 bg-foreground/[0.035] p-4 text-sm font-light text-foreground/70">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => doSearch(page)}
                  className="min-h-9 border border-foreground/20 px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground transition hover:border-foreground/45"
                >
                  {isUa ? "Спробувати ще" : "Try again"}
                </button>
              </div>
            )}

            {fallbackApplied && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 flex items-start gap-3 rounded-none border border-foreground/10 bg-foreground/[0.025] p-4 text-xs font-light tracking-wide text-foreground/65 shadow-[0_12px_28px_rgba(0,0,0,0.07)] dark:shadow-[0_12px_28px_rgba(0,0,0,0.20)]"
              >
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06] text-foreground/50">
                  <CircleAlert className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="font-medium leading-relaxed">
                    {fallbackApplied === "fitment"
                      ? isUa
                        ? vehicleMode === "moto"
                          ? `У поточному фільтрі мотоцикла нічого не знайдено за запитом "${query}". Показано результати по всьому мото-каталогу:`
                          : `У поточному автомобільному фільтрі нічого не знайдено за запитом "${query}". Показано результати по всьому авто-каталогу:`
                        : vehicleMode === "moto"
                          ? `No results found for "${query}" matching the selected motorcycle filters. Showing results from the full motorcycle catalog:`
                          : `No results found for "${query}" matching the selected car filters. Showing results from the full car catalog:`
                      : isUa
                        ? `З обраними фільтрами нічого не знайдено. Показано всі результати за запитом "${query}" по всьому каталогу:`
                        : `No results found with the current filters. Showing all results for "${query}" from the entire catalog:`}
                  </p>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="mt-2 text-[10px] font-semibold uppercase tracking-wider underline transition-colors hover:text-foreground"
                  >
                    {isUa ? "Скинути фільтри" : "Clear Filters"}
                  </button>
                </div>
              </motion.div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-5 xl:grid-cols-3 2xl:grid-cols-4 [@media(min-width:2300px)]:grid-cols-5">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[380px] rounded-none border border-foreground/10 bg-foreground/[0.018] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_24px_rgba(0,0,0,0.18)] sm:rounded-none sm:p-5 md:p-6 flex flex-col"
                  >
                    <div className="aspect-square bg-foreground/5 mb-6 animate-pulse rounded-none" />
                    <div className="h-2 bg-foreground/5 animate-pulse w-10 mb-2" />
                    <div className="h-4 bg-foreground/5 animate-pulse w-full mb-1" />
                    <div className="h-4 bg-foreground/5 animate-pulse w-2/3 mb-3" />
                    <div className="mt-auto flex items-center justify-between pt-4 border-t border-foreground/5">
                      <div className="h-5 bg-foreground/5 animate-pulse w-16" />
                      <div className="h-8 bg-foreground/5 animate-pulse w-24 rounded-none" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !hasSearched ? (
              <div className="rounded-none border border-foreground/10 bg-foreground/[0.014] py-32 text-center shadow-[0_12px_30px_rgba(0,0,0,0.07)] backdrop-blur-xl dark:bg-white/[0.014] dark:shadow-[0_12px_30px_rgba(0,0,0,0.22)]">
                <div className="w-20 h-20 mx-auto bg-foreground/[0.03] rounded-none flex items-center justify-center mb-6 ring-1 ring-foreground/10 shadow-[0_0_30px_rgba(255,255,255,0.02)]">
                  <Package className="w-8 h-8 text-foreground/45" />
                </div>
                <h3 className="text-xl font-light text-foreground mb-3 tracking-wide">
                  {isUa ? "Каталог товарів" : "Product catalog"}
                </h3>
                <p className="text-foreground/60 dark:text-foreground/40 text-sm font-light max-w-md mx-auto leading-relaxed px-4">
                  {isUa
                    ? vehicleMode === "moto"
                      ? "Введіть назву, артикул, бренд або оберіть параметри мотоцикла для підбору сумісних компонентів."
                      : "Введіть назву, артикул, бренд або оберіть параметри автомобіля для підбору сумісних компонентів."
                    : vehicleMode === "moto"
                      ? "Enter product name, SKU, brand, or select motorcycle parameters to find compatible upgrades."
                      : "Enter product name, SKU, brand, or select car parameters to find compatible upgrades."}
                </p>
              </div>
            ) : hasSearched && items.length === 0 ? (
              <div className="rounded-none border border-foreground/10 bg-foreground/[0.014] py-32 text-center shadow-[0_12px_30px_rgba(0,0,0,0.07)] backdrop-blur-xl dark:bg-white/[0.014] dark:shadow-[0_12px_30px_rgba(0,0,0,0.22)]">
                <div className="w-20 h-20 mx-auto bg-foreground/[0.03] rounded-none flex items-center justify-center mb-6 ring-1 ring-foreground/10">
                  <Package className="w-8 h-8 text-foreground/55 dark:text-foreground/30" />
                </div>
                <h3 className="text-xl font-light text-foreground mb-3 tracking-wide">
                  {isUa ? "За вашим запитом нічого не знайдено" : "No results found"}
                </h3>
                <p className="text-foreground/60 dark:text-foreground/40 text-sm font-light mb-6 px-4">
                  {isUa
                    ? vehicleMode === "moto"
                      ? "Спробуйте змінити параметри пошуку або обрати інший мотоцикл."
                      : "Спробуйте змінити параметри пошуку або обрати інший автомобіль."
                    : vehicleMode === "moto"
                      ? "Try different filters or another motorcycle."
                      : "Try different filters or another car."}
                </p>
                <button
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-2 rounded-none border border-foreground bg-foreground px-6 py-3 text-[10px] font-semibold uppercase tracking-widest text-background transition hover:bg-transparent hover:text-foreground"
                >
                  <X className="w-3 h-3" /> {isUa ? "Скинути фільтри" : "Clear filters"}
                </button>
              </div>
            ) : (
              <>
                {viewMode === "grid" ? (
                  /* Product Grid — full width */
                  <motion.div
                    key={`${page}-${sortOrder}-${viewMode}`}
                    initial={shouldReduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3 [@media(min-width:1900px)]:grid-cols-4 [@media(min-width:2400px)]:grid-cols-5"
                  >
                    {items.map((item, index) => {
                      const logoPath = getBrandLogoPath(item.brand);
                      const compareAtLabel = formatItemCompareAt(item);
                      const priceLabel = formatItemPrice(item);
                      const vehicleLabel =
                        [make, model, chassis].filter(Boolean).join(" ") ||
                        (isUa
                          ? vehicleMode === "moto"
                            ? "Підбір по мото"
                            : "Підбір по авто"
                          : vehicleMode === "moto"
                            ? "Motorcycle fitment"
                            : "Car fitment");

                      return (
                        <motion.div
                          layout
                          key={item.id}
                          initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.42,
                            delay: shouldReduceMotion ? 0 : Math.min(index * 0.035, 0.28),
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          className="group relative flex min-h-[360px] min-w-0 flex-col overflow-hidden rounded-[12px] border border-foreground/[0.1] bg-card/78 p-3 shadow-[0_12px_34px_rgba(0,0,0,0.055)] transition-[border-color,background-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-foreground/24 hover:bg-card hover:shadow-[0_18px_44px_rgba(0,0,0,0.09)] dark:bg-black/15 dark:shadow-none dark:hover:bg-foreground/[0.018] md:min-h-[410px] md:p-3.5"
                        >
                          <Link
                            href={resolveShopCatalogProductHref(locale, item.href, item.slug)}
                            prefetch={false}
                            className="flex min-w-0 cursor-pointer flex-col md:flex-1"
                          >
                            <div className="relative mb-3 flex aspect-[1.55] items-center justify-center overflow-hidden rounded-[9px] border border-foreground/[0.07] bg-background/55 md:aspect-[1.5] dark:bg-[#090a0c]">
                              <SafeProductImage
                                src={item.thumbnail}
                                alt={item.name}
                                className="h-full w-full object-contain p-3 transition-transform duration-500 ease-out group-hover:scale-[1.018] md:p-3.5"
                              />
                            </div>

                            <div className="mb-2.5 grid grid-cols-[minmax(64px,1fr)_minmax(0,44%)] items-center gap-2">
                              <div className="min-w-0 overflow-hidden">
                                <div className="flex min-h-5 min-w-0 items-center">
                                  {logoPath ? (
                                    <>
                                      <BrandLogoTile
                                        brandName={item.brand}
                                        logoPath={logoPath}
                                        size="sm"
                                      />
                                      <span className="sr-only">{item.brand}</span>
                                    </>
                                  ) : (
                                    <span className="truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground/65">
                                      {item.brand}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="w-full min-w-0 justify-self-end overflow-hidden text-right">
                                <SkuCopy sku={item.partNumber} isUa={isUa} />
                              </div>
                            </div>

                            <div className="flex flex-col md:flex-1">
                              <h3 className="line-clamp-2 min-h-[40px] overflow-hidden text-[14px] font-normal leading-[1.35] text-foreground/90 [overflow-wrap:anywhere] transition-colors group-hover:text-foreground">
                                {item.name}
                              </h3>
                              <div className="mt-1.5 min-h-[17px] truncate text-[10px] font-light uppercase tracking-[0.1em] text-foreground/52">
                                {item.category}
                              </div>
                              {make || model || chassis ? (
                                <div className="mt-1 truncate text-[10px] font-light text-foreground/48">
                                  {vehicleLabel}
                                </div>
                              ) : null}
                            </div>
                          </Link>

                          <div className="mt-3 space-y-2.5 border-t border-foreground/[0.07] pt-3 md:mt-auto">
                            {isB2B ? (
                              <div className="flex min-w-0 items-end justify-between gap-3">
                                {compareAtLabel ? (
                                  <div className="min-w-0 pb-0.5">
                                    <div className="mb-0.5 text-[8px] font-light uppercase tracking-[0.18em] text-foreground/35">
                                      {isUa ? "РРЦ" : "MSRP"}
                                    </div>
                                    <div
                                      className="truncate font-mono text-[11px] text-foreground/45 line-through decoration-foreground/35"
                                      suppressHydrationWarning={true}
                                    >
                                      {compareAtLabel}
                                    </div>
                                  </div>
                                ) : null}
                                <div className="ml-auto min-w-0 text-right">
                                  <div className="mb-0.5 text-[9px] font-light uppercase tracking-[0.14em] text-foreground/50">
                                    {isUa ? "Ціна" : "Price"}
                                  </div>
                                  <div
                                    className="whitespace-nowrap font-mono text-[22px] font-semibold leading-none tracking-tight text-foreground"
                                    suppressHydrationWarning={true}
                                  >
                                    {priceLabel}
                                  </div>
                                  <div className="mt-1 text-[10px] font-light uppercase tracking-[0.1em] text-foreground/45">
                                    {isUa ? "за одиницю" : "per unit"}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex min-w-0 items-end justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="mb-0.5 text-[9px] font-light uppercase tracking-[0.14em] text-foreground/50">
                                    {isUa ? "Ціна" : "Price"}
                                  </div>
                                  <div
                                    className="whitespace-nowrap font-mono text-[22px] font-semibold leading-none tracking-tight text-foreground"
                                    suppressHydrationWarning={true}
                                  >
                                    {priceLabel}
                                  </div>
                                </div>
                              </div>
                            )}

                            {item.matchStatus ? (
                              <div
                                className={`flex min-h-9 items-center gap-2 rounded-[7px] border px-2.5 text-[9px] ${
                                  item.matchStatus === "exact"
                                    ? "border-emerald-500/25 bg-emerald-500/[0.055] text-foreground/70"
                                    : "border-amber-500/30 bg-amber-500/[0.06] text-foreground/72"
                                }`}
                                title={
                                  item.missingFacts?.length
                                    ? `${item.matchReason ?? ""}: ${item.missingFacts.join(", ")}`
                                    : item.matchReason
                                }
                              >
                                {item.matchStatus === "exact" ? (
                                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <CircleAlert className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                )}
                                <span className="min-w-0 flex-1 truncate">
                                  {item.matchStatus === "exact"
                                    ? isUa
                                      ? "Сумісність підтверджена"
                                      : "Confirmed fitment"
                                    : isUa
                                      ? "Сумісність потребує перевірки"
                                      : "Fitment needs verification"}
                                </span>
                                {item.matchStatus === "requires_verification" ? (
                                  <Link
                                    href={`/${locale}/contact?source=one-ai&product=${encodeURIComponent(item.slug)}`}
                                    className="shrink-0 font-semibold text-foreground/75 underline-offset-2 hover:underline"
                                  >
                                    {isUa ? "Перевірити" : "Verify"}
                                  </Link>
                                ) : null}
                              </div>
                            ) : null}

                            <StockCardCartControl
                              item={item}
                              locale={locale as string}
                              isUa={isUa}
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                ) : (
                  /* Premium marketplace table/list layout */
                  <div className="space-y-4">
                    {/* Desktop View */}
                    <div className="hidden w-full overflow-hidden rounded-none border border-foreground/10 bg-foreground/[0.014] shadow-[0_12px_28px_rgba(0,0,0,0.07)] backdrop-blur-xl dark:bg-white/[0.014] dark:shadow-[0_12px_28px_rgba(0,0,0,0.22)] xl:block">
                      {/* Table Header */}
                      <div className="grid grid-cols-[80px_140px_1fr_120px_160px_160px] items-center gap-4 border-b border-foreground/10 px-6 py-4 text-[10px] font-light uppercase tracking-[0.18em] text-foreground/45">
                        <div>{isUa ? "Фото" : "Image"}</div>
                        <div>{isUa ? "Бренд / Артикул" : "Brand / SKU"}</div>
                        <div>{isUa ? "Назва деталі" : "Product Name"}</div>
                        <div className="text-center">{isUa ? "Наявність" : "Availability"}</div>
                        <div className="text-right">
                          {isB2B ? (isUa ? "РРЦ / Ціна" : "MSRP / Price") : isUa ? "Ціна" : "Price"}
                        </div>
                        <div className="text-right">{isUa ? "Дія" : "Action"}</div>
                      </div>
                      {/* Table Rows */}
                      <div className="divide-y divide-foreground/5">
                        {items.map((item) => {
                          const logoPath = getBrandLogoPath(item.brand);
                          const compareAtLabel = formatItemCompareAt(item);
                          const priceLabel = formatItemPrice(item);

                          return (
                            <div
                              key={item.id}
                              className="grid grid-cols-[80px_140px_1fr_120px_160px_160px] items-center gap-4 px-6 py-4 transition-all duration-300 hover:bg-foreground/[0.025]"
                            >
                              {/* Thumbnail Image */}
                              <div className="w-14 h-14 rounded-none bg-foreground/[0.035] flex items-center justify-center overflow-hidden border border-foreground/8">
                                <SafeProductImage
                                  src={item.thumbnail}
                                  alt={item.name}
                                  className="w-full h-full object-contain p-2 hover:scale-110 transition-transform duration-500"
                                  isMini
                                />
                              </div>

                              {/* Brand & Part Number */}
                              <div className="flex flex-col gap-1 min-w-0">
                                <BrandLogoTile
                                  brandName={item.brand}
                                  logoPath={logoPath}
                                  size="xs"
                                />
                                <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-foreground/55">
                                  {item.brand}
                                </span>
                                <SkuCopy sku={item.partNumber} isUa={isUa} />
                              </div>

                              {/* Product Title & Category */}
                              <div className="flex flex-col gap-1 min-w-0 pr-4">
                                {item.category && (
                                  <span className="text-[8px] text-foreground/45 font-light uppercase tracking-widest">
                                    {item.category}
                                  </span>
                                )}
                                <Link
                                  href={resolveShopCatalogProductHref(locale, item.href, item.slug)}
                                  prefetch={false}
                                  className="block truncate text-sm font-light text-foreground transition-colors hover:text-foreground"
                                  title={item.name}
                                >
                                  {item.name}
                                </Link>
                              </div>

                              {/* Stock Status & Fitment */}
                              <div className="flex flex-col items-center justify-center gap-1.5">
                                <span className="text-center text-[9px] font-light uppercase tracking-widest text-foreground/45">
                                  {item.inStock
                                    ? isUa
                                      ? "В наявності"
                                      : "In stock"
                                    : isUa
                                      ? "Під замовлення"
                                      : "Pre-order"}
                                </span>
                                {item.matchStatus && (
                                  <span
                                    className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[8px] font-semibold uppercase tracking-widest ${
                                      item.matchStatus === "exact"
                                        ? "border-emerald-500/25 bg-emerald-500/[0.055] text-emerald-700 dark:text-emerald-300"
                                        : item.matchStatus === "requires_verification"
                                          ? "border-amber-500/30 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300"
                                          : "border-foreground/15 bg-foreground/[0.04] text-foreground/75"
                                    }`}
                                    title={item.matchReason}
                                  >
                                    {item.matchStatus === "exact" ? (
                                      <ShieldCheck className="h-2.5 w-2.5" />
                                    ) : (
                                      <CircleAlert className="h-2.5 w-2.5" />
                                    )}
                                    {item.matchStatus === "exact"
                                      ? isUa
                                        ? "Підтверджено"
                                        : "Confirmed"
                                      : item.matchStatus === "requires_verification"
                                        ? isUa
                                          ? "Потрібна перевірка"
                                          : "Verify fitment"
                                        : null}
                                  </span>
                                )}
                              </div>

                              {/* Pricing */}
                              <div className="text-right">
                                {isB2B ? (
                                  <div className="flex items-baseline justify-end gap-3 font-mono">
                                    {compareAtLabel ? (
                                      <span
                                        className="text-[10px] text-foreground/45 line-through decoration-foreground/35"
                                        suppressHydrationWarning={true}
                                      >
                                        {compareAtLabel}
                                      </span>
                                    ) : null}
                                    <span
                                      className="text-base font-semibold text-foreground"
                                      suppressHydrationWarning={true}
                                    >
                                      {priceLabel}
                                    </span>
                                  </div>
                                ) : (
                                  <div
                                    className="font-mono text-base text-foreground"
                                    suppressHydrationWarning={true}
                                  >
                                    {priceLabel}
                                  </div>
                                )}
                              </div>

                              {/* Add to Cart button */}
                              <div className="flex justify-end">
                                {item.matchStatus === "requires_verification" ? (
                                  <Link
                                    href={`/${locale}/contact?source=one-ai&product=${encodeURIComponent(item.slug)}`}
                                    className="flex h-9 w-full items-center justify-center border border-amber-500/30 bg-amber-500/[0.06] px-3 text-center text-[9px] font-semibold uppercase tracking-[0.1em] text-foreground transition hover:border-amber-500/55"
                                  >
                                    {isUa ? "Перевірити сумісність" : "Verify fitment"}
                                  </Link>
                                ) : (
                                  <AddToCartButton
                                    slug={item.slug}
                                    variantId={item.variantId}
                                    locale={locale as string}
                                    variant="minimal"
                                    label={isUa ? "Кошик" : "Cart"}
                                    labelAdded={isUa ? "В кошику ✓" : "In Cart ✓"}
                                    className="flex h-9 w-full items-center justify-center gap-1 rounded-none border border-foreground/20 bg-foreground/[0.08] text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground transition hover:border-foreground hover:bg-foreground hover:text-background active:scale-95"
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Mobile/Tablet view */}
                    <div className="space-y-3 xl:hidden">
                      {items.map((item) => {
                        const logoPath = getBrandLogoPath(item.brand);
                        const compareAtLabel = formatItemCompareAt(item);
                        const priceLabel = formatItemPrice(item);

                        return (
                          <div
                            key={item.id}
                            className="relative flex flex-col rounded-none border border-foreground/10 bg-foreground/[0.018] p-4 shadow-[0_12px_28px_rgba(0,0,0,0.07)] transition-all duration-300 hover:bg-foreground/[0.03] dark:bg-white/[0.018] dark:shadow-[0_12px_28px_rgba(0,0,0,0.22)]"
                          >
                            {/* Top info row */}
                            <div className="flex items-start justify-between gap-3 mb-2">
                              {/* Brand/SKU */}
                              <div className="flex min-w-0 items-center gap-3">
                                <BrandLogoTile
                                  brandName={item.brand}
                                  logoPath={logoPath}
                                  size="xs"
                                />
                                <div className="flex min-w-0 flex-col">
                                  <span className="truncate text-[9px] font-light uppercase tracking-widest text-foreground/45">
                                    {item.brand}
                                  </span>
                                  <SkuCopy sku={item.partNumber} isUa={isUa} />
                                </div>
                              </div>

                              {/* Fitment badge */}
                              <div className="flex gap-1.5">
                                {item.matchStatus && (
                                  <span
                                    className={`border px-2 py-0.5 text-[7px] font-semibold uppercase tracking-wider ${
                                      item.matchStatus === "exact"
                                        ? "border-emerald-500/25 bg-emerald-500/[0.055] text-emerald-700 dark:text-emerald-300"
                                        : item.matchStatus === "requires_verification"
                                          ? "border-amber-500/30 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300"
                                          : "border-foreground/15 bg-foreground/[0.04] text-foreground/75"
                                    }`}
                                    title={item.matchReason}
                                  >
                                    {item.matchStatus === "exact"
                                      ? isUa
                                        ? "Підтверджено"
                                        : "Confirmed"
                                      : item.matchStatus === "requires_verification"
                                        ? isUa
                                          ? "Потрібна перевірка"
                                          : "Verify fitment"
                                        : null}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Middle row: Name & Thumbnail */}
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-12 h-12 rounded-none bg-foreground/[0.035] flex items-center justify-center overflow-hidden shrink-0 border border-foreground/8">
                                <SafeProductImage
                                  src={item.thumbnail}
                                  alt={item.name}
                                  className="w-full h-full object-contain p-1.5"
                                  isMini
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                {item.category && (
                                  <span className="text-[8px] text-foreground/45 font-light uppercase tracking-wider">
                                    {item.category}
                                  </span>
                                )}
                                <Link
                                  href={resolveShopCatalogProductHref(locale, item.href, item.slug)}
                                  prefetch={false}
                                  className="line-clamp-3 text-xs font-light leading-tight text-foreground [overflow-wrap:anywhere] transition-colors hover:text-foreground"
                                >
                                  {item.name}
                                </Link>
                              </div>
                            </div>

                            {/* Bottom action row: Price & Buy button */}
                            <div className="flex items-center justify-between border-t border-foreground/5 pt-3 mt-auto">
                              <div>
                                {isB2B ? (
                                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono">
                                    {compareAtLabel ? (
                                      <span
                                        className="text-[10px] text-foreground/45 line-through decoration-foreground/35"
                                        suppressHydrationWarning={true}
                                      >
                                        {compareAtLabel}
                                      </span>
                                    ) : null}
                                    <span
                                      className="text-sm font-semibold text-foreground"
                                      suppressHydrationWarning={true}
                                    >
                                      {priceLabel}
                                    </span>
                                  </div>
                                ) : (
                                  <div
                                    className="font-mono text-sm text-foreground"
                                    suppressHydrationWarning={true}
                                  >
                                    {priceLabel}
                                  </div>
                                )}
                              </div>

                              <div className="w-32">
                                {item.matchStatus === "requires_verification" ? (
                                  <Link
                                    href={`/${locale}/contact?source=one-ai&product=${encodeURIComponent(item.slug)}`}
                                    className="flex min-h-8 w-full items-center justify-center border border-amber-500/30 bg-amber-500/[0.06] px-2 text-center text-[8px] font-semibold uppercase tracking-[0.08em] text-foreground transition hover:border-amber-500/55"
                                  >
                                    {isUa ? "Перевірити" : "Verify fitment"}
                                  </Link>
                                ) : (
                                  <AddToCartButton
                                    slug={item.slug}
                                    variantId={item.variantId}
                                    locale={locale as string}
                                    variant="minimal"
                                    label={isUa ? "Кошик" : "Cart"}
                                    labelAdded={isUa ? "В кошику ✓" : "In Cart ✓"}
                                    className="flex h-8 w-full items-center justify-center rounded-none border border-foreground/20 bg-foreground/[0.08] text-[9px] font-semibold uppercase tracking-[0.15em] text-foreground transition hover:border-foreground hover:bg-foreground hover:text-background"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    <button
                      disabled={page <= 1}
                      onClick={() => doSearch(page - 1)}
                      className="rounded-none border border-foreground/10 px-4 py-2 text-[10px] uppercase tracking-widest text-foreground/60 transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-20 dark:text-foreground/40"
                    >
                      ← {isUa ? "Назад" : "Prev"}
                    </button>
                    <span className="text-[10px] text-foreground/55 dark:text-foreground/30 uppercase tracking-widest px-4">
                      {page} / {totalPages}
                    </span>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => doSearch(page + 1)}
                      className="rounded-none border border-foreground/10 px-4 py-2 text-[10px] uppercase tracking-widest text-foreground/60 transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-20 dark:text-foreground/40"
                    >
                      {isUa ? "Далі" : "Next"} →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StockPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <StockPageContent />
    </Suspense>
  );
}
