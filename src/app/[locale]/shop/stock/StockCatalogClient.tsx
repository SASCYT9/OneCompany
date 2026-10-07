"use client";

import { fetchShopStockSearch } from "@/lib/shopStockSearchRequest";
import { getShopStockItemCompareAtSet, getShopStockItemPriceSet } from "@/lib/shopStockItemPricing";
import { matchesShopSearchQuery } from "@/lib/shopSearch";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
  useId,
  Fragment,
  Suspense,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
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
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { useCatalogOverlay } from "@/components/shop/useCatalogOverlay";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import GlareHover from "@/components/reactbits/GlareHover";
import ShinyText from "@/components/reactbits/ShinyText";
import CountUp from "@/components/reactbits/CountUp";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { buildShopStorefrontBrandPath } from "@/lib/shopStorefrontRouting";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { DEFAULT_CURRENCY_RATES } from "@/lib/shopCurrencyDefaults";
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
import {
  isWheelForceWheel,
  isWheelForceWheelSet,
  WHEELFORCE_WHEEL_SET_SIZE,
} from "@/lib/wheelforceFamily";
import { getVehicleMakeLogoPath, normalizeVehicleMakeName } from "@/lib/vehicleMakeLogos";
import {
  canonicalVehicleModelLabel,
  canonicalizeVehicleChassisCodes,
  vehicleModelKey,
} from "@/lib/shopVehicleTaxonomy";
import {
  hasFitmentResponseType,
  isCurrentFitmentRequest,
  isStringArray,
  parseShopStockJsonResponse,
  resolveFitmentOption,
} from "@/lib/shopStockFitmentState";
import {
  cleanShopAiProductKind,
  formatShopAiProductKind,
  type ShopAiProductKind,
} from "@/lib/shopAiProductKind";
import { SHOP_CATALOG_OPEN_FILTERS_EVENT } from "@/lib/mobileBottomNavigation";
import { CATALOG_FOCUS_SEARCH_EVENT } from "@/lib/catalogSearchFocus";
import { ShopAvailabilityBadge } from "@/components/shop/ShopAvailabilityBadge";
import { SHOW_STOCK_BADGE } from "@/lib/shopStockUi";
import { resolveShopStockSearchDelay } from "@/lib/shopStockSearchTiming";
import {
  getShopConfirmedAvailability,
  isShopWarehouseHeroProduct,
  resolveShopWarehouseHeroImage,
  resolveShopWarehouseProductCopy,
} from "@/lib/shopWarehouseInventory";

const StockAiAssistant = dynamic(
  () => import("@/components/shop/StockAiAssistant").then((module) => module.StockAiAssistant),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden="true"
        className="h-10 w-[102px] rounded-[8px] border border-foreground/10 bg-foreground/[0.035]"
      />
    ),
  }
);

import type {
  StockItem,
  StockSuggestion,
  FilterStats,
  StockSearchResponse,
  StockInitialData,
} from "@/lib/shopStockSearchTypes";
import {
  buildStockPaginationHref,
  parseStockPage,
  stockSearchCacheKey,
} from "@/lib/shopStockInitialSearch";
import CatalogLoadingShell from "./CatalogLoadingShell";

type StockFilter = "all" | "inStock" | "preOrder";
type StockSort = "default" | "price_asc" | "price_desc" | "name_asc";
type VehicleMode = "auto" | "moto";

type SavedCatalogVehicle = {
  mode: VehicleMode;
  make: string;
  model: string;
  chassis: string;
  year: number | null;
};

const SAVED_CATALOG_VEHICLE_KEY = "onecompany:my-vehicle";

function readSavedCatalogVehicle(): SavedCatalogVehicle | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(SAVED_CATALOG_VEHICLE_KEY) ?? "null");
    if (
      !value ||
      (value.mode !== "auto" && value.mode !== "moto") ||
      typeof value.make !== "string" ||
      typeof value.model !== "string" ||
      !value.make ||
      !value.model
    ) {
      return null;
    }
    return {
      mode: value.mode,
      make: value.make.slice(0, 120),
      model: value.model.slice(0, 120),
      chassis: typeof value.chassis === "string" ? value.chassis.slice(0, 120) : "",
      year: Number.isInteger(value.year) ? value.year : null,
    };
  } catch {
    return null;
  }
}

function writeSavedCatalogVehicle(vehicle: SavedCatalogVehicle | null) {
  try {
    if (vehicle) window.localStorage.setItem(SAVED_CATALOG_VEHICLE_KEY, JSON.stringify(vehicle));
    else window.localStorage.removeItem(SAVED_CATALOG_VEHICLE_KEY);
  } catch {
    // Storage may be unavailable under strict privacy settings.
  }
}

// Clears the fixed storefront header (h-16/h-20) with a small visual gap.
const SEARCH_BOX_MIN_VIEWPORT_TOP = 104;

type FitmentResultKeyInput = {
  make: string;
  model: string;
  chassis: string;
  year: number | null;
  engine: string;
  fuel: string;
  opfGpf: string | null;
  strict: boolean;
};

/** Every selection that changes fitment evidence (badges, matchStatus) on a page. */
function fitmentResultKey(input: FitmentResultKeyInput) {
  return [
    input.make,
    input.model,
    input.chassis,
    input.year ? String(input.year) : "",
    input.engine,
    input.fuel,
    input.opfGpf ?? "",
    input.strict ? "strict" : "",
  ]
    .map((value) => value.trim().toLocaleLowerCase())
    .join("|");
}

function FitmentExplanation({
  item,
  vehicleLabel,
  isUa,
}: {
  item: StockItem;
  vehicleLabel: string;
  isUa: boolean;
}) {
  if (!vehicleLabel) return null;
  const application = item.fitments?.[0];
  const needsReview =
    item.fitmentStatus === "needs_review" || item.matchStatus === "requires_verification";
  const sourceLabel =
    item.fitmentSource === "manual"
      ? isUa
        ? "ручна перевірка"
        : "manual review"
      : item.fitmentSource === "import"
        ? isUa
          ? "дані постачальника"
          : "supplier data"
        : isUa
          ? "каталог сумісності"
          : "compatibility catalog";
  const detailParts = application
    ? [
        application.make,
        ...application.models,
        ...application.chassisCodes,
        ...application.engines,
        ...application.yearRanges.map((range) =>
          range.to == null ? `${range.from}+` : `${range.from}-${range.to}`
        ),
      ].filter(Boolean)
    : [];

  return (
    <details className="group/fitment rounded-[7px] border border-foreground/[0.1] bg-foreground/[0.025] text-[9px] text-foreground/65">
      <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 px-2.5 py-1.5 outline-hidden marker:hidden focus-visible:ring-1 focus-visible:ring-foreground/45">
        {needsReview ? (
          <CircleAlert className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        ) : (
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        )}
        <span className="min-w-0 flex-1 truncate">
          {needsReview
            ? isUa
              ? "Сумісність потребує уточнення"
              : "Fitment needs review"
            : isUa
              ? "Підібрано для вашого авто"
              : "Selected for your vehicle"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-foreground/40 transition-transform group-open/fitment:rotate-180" />
      </summary>
      <div className="space-y-1 border-t border-foreground/[0.08] px-2.5 py-2 leading-relaxed text-foreground/55">
        <p>
          {isUa ? "Автомобіль:" : "Vehicle:"} {vehicleLabel}
        </p>
        {detailParts.length > 0 ? (
          <p>
            {isUa ? "Збіг:" : "Match:"} {detailParts.join(" · ")}
          </p>
        ) : null}
        <p>
          {isUa ? "Джерело:" : "Source:"} {sourceLabel}
        </p>
      </div>
    </details>
  );
}

const getCatalogProductPresentation = (item: StockItem, locale: "ua" | "en") => {
  const name = item.name.trim();
  const brand = item.brand.trim();
  const cleanTitle =
    brand && name.toLocaleLowerCase().startsWith(brand.toLocaleLowerCase())
      ? name.slice(brand.length).trim()
      : name;
  return resolveShopWarehouseProductCopy(
    item.partNumber,
    locale,
    {
      title: cleanTitle,
      description: item.description.trim(),
    },
    item.slug
  );
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

const FUEL_OPTIONS = [
  { value: "petrol", ua: "Бензин", en: "Petrol" },
  { value: "diesel", ua: "Дизель", en: "Diesel" },
  { value: "hybrid", ua: "Гібрид", en: "Hybrid" },
  { value: "electric", ua: "Електро", en: "Electric" },
] as const;

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

// Short names and Ukrainian spellings people type for a make ("vw", "мерс").
const VEHICLE_SEARCH_ALIASES: Record<string, string[]> = {
  volkswagen: ["vw", "фольксваген"],
  "mercedes-benz": ["mb", "merc", "mercedes", "мерседес", "мерс"],
  "mercedes-amg": ["amg", "мерседес"],
  bmw: ["бмв"],
  audi: ["ауді", "ауди"],
  porsche: ["порше"],
  toyota: ["тойота"],
  lexus: ["лексус"],
  "land rover": ["lr", "ленд ровер"],
  "alfa romeo": ["alfa", "альфа"],
  "rolls-royce": ["rr", "rolls"],
  chevrolet: ["chevy", "шевроле"],
  lamborghini: ["lambo", "ламборгіні"],
  ferrari: ["феррарі"],
  "aston martin": ["aston"],
};

function normalizeVehicleSearch(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase().trim();
}

function vehicleSearchText(value: string) {
  const base = normalizeVehicleSearch(value);
  return [base, ...(VEHICLE_SEARCH_ALIASES[base] ?? [])].join(" ");
}

type VehiclePickerOption = { value: string; group?: string };

type VehiclePickerSelectProps = {
  label: string;
  value: string;
  placeholder: string;
  options: VehiclePickerOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
  searchPlaceholder: string;
  emptyLabel: string;
  disabled?: boolean;
  loading?: boolean;
  /** First row of the list, e.g. "Any chassis". Selecting it passes "". */
  anyLabel?: string;
  /** Extra content above the list (e.g. the last used vehicle). */
  header?: ReactNode;
  renderIcon?: (value: string) => ReactNode;
  className?: string;
};

// One field of the "Parts for [make] [model] [chassis]" sentence: a compact
// trigger plus an inline searchable list that opens right under it.
function VehiclePickerSelect({
  label,
  value,
  placeholder,
  options,
  open,
  onOpenChange,
  onChange,
  searchPlaceholder,
  emptyLabel,
  disabled = false,
  loading = false,
  anyLabel,
  header,
  renderIcon,
  className = "",
}: VehiclePickerSelectProps) {
  const [filter, setFilter] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [menuShift, setMenuShift] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const keyboardNavRef = useRef(false);
  const listId = useId();

  const rows = useMemo(() => {
    const needle = normalizeVehicleSearch(filter);
    if (!needle) return options;
    const seen = new Set<string>();
    return options
      .filter((option) => vehicleSearchText(option.value).includes(needle))
      .filter((option) => (seen.has(option.value) ? false : (seen.add(option.value), true)))
      .map((option) => ({ value: option.value }));
  }, [filter, options]);
  const selectable = anyLabel && !filter.trim() ? [{ value: "" }, ...rows] : rows;

  useEffect(() => {
    if (!open) return;
    setFilter("");
    setHighlight(0);
    keyboardNavRef.current = false;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    window.addEventListener("pointerdown", close);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", close);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the menu inside the viewport: fields sit anywhere in the row, so a
  // menu anchored to the field's left edge can run off the right side.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const root = rootRef.current;
      if (!root) return;
      const margin = 12;
      const width = Math.min(320, window.innerWidth - margin * 2);
      const left = root.getBoundingClientRect().left;
      const clamped = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
      setMenuShift(clamped - left);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

  // Nothing to choose (e.g. a model without chassis codes): don't hang open.
  useEffect(() => {
    if (open && !loading && options.length === 0 && !anyLabel) onOpenChange(false);
  }, [anyLabel, loading, onOpenChange, open, options.length]);

  const choose = (next: string) => {
    onOpenChange(false);
    onChange(next);
  };

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${value || placeholder}`}
        className={`flex h-10 w-full min-w-0 items-center gap-2 rounded-[4px] border px-3 text-left text-[14px] transition disabled:cursor-not-allowed disabled:opacity-45 ${
          open
            ? "border-foreground bg-foreground/[0.04]"
            : value
              ? "border-foreground/30 hover:border-foreground/60"
              : "border-dashed border-foreground/30 hover:border-foreground/60"
        }`}
      >
        {value && renderIcon ? renderIcon(value) : null}
        <span
          className={`min-w-0 flex-1 truncate ${value ? "font-medium text-foreground" : "text-foreground/55"}`}
        >
          {value || placeholder}
        </span>
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-foreground/45" />
        ) : (
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-foreground/45 transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {open ? (
        <div
          style={{ left: menuShift }}
          className="absolute top-[calc(100%+6px)] z-[80] w-[min(320px,calc(100vw-1.5rem))] overflow-hidden rounded-[6px] border border-foreground/15 bg-popover text-popover-foreground shadow-[0_24px_60px_rgba(0,0,0,0.22)] dark:border-white/12 dark:bg-[#0b0c0f] dark:shadow-[0_24px_60px_rgba(0,0,0,0.65)]"
        >
          <label className="flex items-center gap-2 border-b border-foreground/10 px-3">
            <Search className="h-4 w-4 shrink-0 text-foreground/45" />
            <input
              ref={inputRef}
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setHighlight(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  keyboardNavRef.current = true;
                  setHighlight((index) => Math.min(index + 1, selectable.length - 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  keyboardNavRef.current = true;
                  setHighlight((index) => Math.max(index - 1, 0));
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  const row = selectable[highlight];
                  if (row) choose(row.value);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  onOpenChange(false);
                }
              }}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              role="combobox"
              aria-expanded="true"
              aria-autocomplete="list"
              aria-controls={listId}
              aria-activedescendant={
                !loading && selectable[highlight] ? `${listId}-opt-${highlight}` : undefined
              }
              className="h-11 min-w-0 flex-1 bg-transparent text-[13px] outline-hidden placeholder:text-foreground/45"
            />
          </label>
          {header && !filter.trim() ? (
            <div className="border-b border-foreground/10">{header}</div>
          ) : null}
          <ul
            id={listId}
            role="listbox"
            className="max-h-[300px] overflow-y-auto p-1 [scrollbar-width:thin]"
          >
            {loading ? (
              <li className="flex items-center gap-2 px-3 py-3 text-[13px] text-foreground/50">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {placeholder}
              </li>
            ) : selectable.length === 0 ? (
              <li className="px-3 py-3 text-[13px] text-foreground/50">{emptyLabel}</li>
            ) : (
              selectable.map((row, index) => {
                const group = "group" in row ? (row as VehiclePickerOption).group : undefined;
                const prev = selectable[index - 1] as VehiclePickerOption | undefined;
                const showGroup = Boolean(group) && group !== prev?.group;
                const isAny = row.value === "" && Boolean(anyLabel);
                const selected = isAny ? !value : row.value === value;
                return (
                  <li
                    key={`${group ?? ""}-${row.value || "__any"}`}
                    id={`${listId}-opt-${index}`}
                    role="option"
                    aria-selected={selected}
                  >
                    {showGroup ? (
                      <p className="px-3 pb-1 pt-2.5 text-[11px] text-foreground/45">{group}</p>
                    ) : null}
                    <button
                      type="button"
                      tabIndex={-1}
                      ref={(node) => {
                        if (node && index === highlight && keyboardNavRef.current) {
                          node.scrollIntoView({ block: "nearest" });
                        }
                      }}
                      onMouseEnter={() => {
                        keyboardNavRef.current = false;
                        setHighlight(index);
                      }}
                      onClick={() => choose(row.value)}
                      className={`flex min-h-9 w-full items-center gap-2.5 rounded-[3px] px-3 text-left text-[13px] transition ${
                        index === highlight ? "bg-foreground/[0.07]" : ""
                      } ${isAny ? "text-foreground/60" : "text-foreground"}`}
                    >
                      {!isAny && renderIcon ? renderIcon(row.value) : null}
                      <span className="min-w-0 flex-1 truncate">
                        {isAny ? anyLabel : row.value}
                      </span>
                      {selected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

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
  return <div className={`${className} overscroll-contain`}>{children}</div>;
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
  if (b.includes("bmc")) return "/logos/bmc-filters.png";
  if (b.includes("adro")) return "/images/shop/adro/adro-logo-white.svg";
  if (b.includes("brabus")) return "/logos/brabus.svg";
  if (b.includes("racechip")) return "/logos/racechip.png";
  if (b.includes("revozport")) return "/logos/revozport-official-white.png";
  if (b.includes("wheelforce")) return "/logos/wheelforce.svg";
  if (b === "mst" || b.includes("mst performance")) return "/logos/mst-performance.png";
  if (b.includes("do88")) return "/logos/do88.png";
  if (b.includes("csf")) return "/images/shop/csf/csf-logo.svg";
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
  if (b.includes("stopflex")) return "/logos/stopflex.png";
  if (b.includes("eventuri")) return "/logos/eventuri-official.svg";
  if (b.includes("remus")) return "/logos/remus-dark.png";
  if (b.includes("fi exhaust") || b.includes("fi-exhaust")) return "/logos/fi-exhaust.svg";
  if (b.includes("bootmod3")) return "/logos/bootmod3.webp";
  if (b.includes("g-sport") || b.includes("gsport")) return "/logos/gsport-by-gesi.png";
  return null;
};

const getBrandLightLogoPath = (brandName: string, fallback: string): string => {
  const b = normalizeBrandLogoName(brandName);
  if (b.includes("adro")) return "/images/shop/adro/adro-logo.svg";
  if (b.includes("csf")) return "/images/shop/csf/csf-logo.svg";
  if (b.includes("girodisc")) return "/logos/girodisc.webp";
  if (b.includes("ilmberger")) return "/logos/ilmberger-carbon-transparent.webp";
  if (b.includes("ipe exhaust") || b === "ipe" || b.includes("innotech performance"))
    return "/images/shop/ipe/ipe-logo.png";
  if (b.includes("remus")) return "/logos/remus.png";
  if (b.includes("revozport")) return "/logos/revozport-official-black.png";
  if (b.includes("eventuri")) return "/brands/eventuri-logo-email.png";
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

const LOGO_INVERT_BRANDS = ["brabus", "wheelforce"];

const LOGO_LIGHT_INVERT_BRANDS = ["racechip", "do88", "urban"];

const LOGO_LIGHT_OUTLINE_BRANDS = ["akrapovic", "akrapovi", "bmc", "burger"];

const LOGO_WIDE_MARK_BRANDS = [
  "akrapovic",
  "akrapovi",
  "brabus",
  "burger",
  "girodisc",
  "ilmberger",
  "ohlins",
  "racechip",
  "revozport",
  "remus",
  "stopflex",
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

function getBrandLogoBackdropClass(brandName: string) {
  const normalized = normalizeBrandLogoName(brandName);
  // Keep mixed-color artwork legible without inverting its brand colors.
  if (
    normalized.includes("bmc") ||
    normalized.includes("csf") ||
    normalized.includes("ipe exhaust") ||
    normalized === "ipe" ||
    normalized.includes("innotech performance")
  )
    return normalized.includes("bmc")
      ? "rounded-sm bg-white p-0.5"
      : "rounded-sm bg-neutral-950 p-0.5";
  if (normalized.includes("g-sport") || normalized.includes("gsport"))
    return "rounded-sm bg-white p-0.5";
  return "";
}

function BrandLogoTile({
  brandName,
  logoPath,
  size = "sm",
  className = "",
  decorative = false,
}: {
  brandName: string;
  logoPath: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  decorative?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [logoPath]);

  if (!logoPath) return null;

  const needsContrastLift = brandLogoNeedsContrastLift(brandName);
  const needsInvert = brandLogoNeedsInvert(brandName);
  const needsLightInvert = brandLogoNeedsLightInvert(brandName);
  const needsLightOutline = brandLogoNeedsLightOutline(brandName);
  const needsWideBoost = brandLogoNeedsWideBoost(brandName);
  const logoBackdropClass = getBrandLogoBackdropClass(brandName);
  const lightThemeLogoPath = getBrandLightLogoPath(brandName, logoPath);
  const hasThemeSpecificLogo = lightThemeLogoPath !== logoPath;
  const sizeClass =
    size === "xs"
      ? "h-6 w-[72px]"
      : size === "lg"
        ? "h-9 w-28"
        : size === "md"
          ? "h-8 w-24"
          : "h-6 w-[76px]";
  const imageSizeClass =
    size === "xs"
      ? "max-h-5 max-w-[72px]"
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
  const imageScaleClass = needsWideBoost && size !== "xs" ? "scale-[1.1]" : "scale-100";

  if (failed) {
    return (
      <span
        className={`flex shrink-0 items-center justify-start overflow-hidden ${sizeClass} ${className}`}
        title={brandName}
        aria-hidden={decorative || undefined}
      >
        <span className="max-w-full truncate text-[8px] font-semibold uppercase tracking-[0.08em] text-foreground/65">
          {brandName}
        </span>
      </span>
    );
  }

  return (
    <span
      className={`relative flex shrink-0 items-center ${size === "xs" ? "justify-center" : "justify-start"} overflow-visible ${sizeClass} ${className}`}
      title={brandName}
      aria-hidden={decorative || undefined}
    >
      <Image
        src={lightThemeLogoPath}
        alt={decorative ? "" : brandName}
        width={112}
        height={36}
        unoptimized
        className={`relative ${imageSizeClass} origin-left object-contain opacity-100 transition duration-200 ${imageScaleClass} ${logoFilterClass} ${logoBackdropClass} ${
          hasThemeSpecificLogo ? "dark:hidden" : ""
        }`}
        onError={() => setFailed(true)}
      />
      {hasThemeSpecificLogo ? (
        <Image
          src={logoPath}
          alt={decorative ? "" : brandName}
          width={112}
          height={36}
          unoptimized
          className={`relative hidden ${imageSizeClass} origin-left object-contain opacity-100 transition duration-200 dark:block ${imageScaleClass} ${logoFilterClass} ${logoBackdropClass}`}
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

  if (item.brand.trim().toLowerCase() === "wheelforce") {
    return (
      <Link
        href={resolveShopCatalogProductHref(locale, item.href, item.slug)}
        className="flex h-10 w-full items-center justify-center rounded-[7px] border border-foreground bg-foreground px-3 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-background shadow-[0_8px_20px_rgba(0,0,0,0.12)] transition hover:-translate-y-px hover:brightness-110"
      >
        {isUa ? "Обрати розмір і аксесуари" : "Choose size and accessories"}
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
  fallbackSrcs = [],
  alt,
  className,
  isMini = false,
}: {
  src: string | null | undefined;
  fallbackSrcs?: string[];
  alt: string;
  className?: string;
  isMini?: boolean;
}) {
  const cleanUrl = (value: string) => {
    const trimmed = value.trim();
    // Shopify frequently returns protocol-relative CDN URLs (`//cdn...`).
    // Collapsing those slashes turns them into a local `/cdn...` path and
    // makes every catalog-card image fail while the same PDP image works.
    if (trimmed.startsWith("//")) return `https:${trimmed}`;
    return trimmed.replace(/(https?:\/\/)|(\/)+/g, (match, protocol) => {
      if (protocol) return protocol;
      return "/";
    });
  };
  const sources = Array.from(
    new Set([src, ...fallbackSrcs].map((value) => String(value ?? "").trim()).filter(Boolean))
  ).map(cleanUrl);
  const sourceKey = sources.join("|");
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => {
    setSourceIndex(0);
  }, [sourceKey]);

  const activeSrc = sources[sourceIndex];
  if (!activeSrc) {
    return isMini ? (
      <Package className="h-6 w-6 shrink-0 text-foreground/20" />
    ) : (
      <Package className="h-12 w-12 shrink-0 text-foreground/18" />
    );
  }

  return (
    <Image
      src={activeSrc}
      alt={alt}
      width={720}
      height={480}
      sizes={
        isMini
          ? "80px"
          : "(min-width: 2400px) 18vw, (min-width: 1900px) 23vw, (min-width: 1280px) 31vw, (min-width: 768px) 48vw, 100vw"
      }
      quality={75}
      loading="lazy"
      onError={() => setSourceIndex((current) => Math.min(current + 1, sources.length))}
      className={className}
    />
  );
}

/* ========= Main Stock Page ========= */
function CatalogOverlayPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

function StockPageContent({ initialData }: { initialData?: StockInitialData }) {
  const initialResponse = initialData?.response;
  // The server-rendered grid must be visible before JS, including when the
  // browser prefers reduced motion (the server cannot read that preference).
  // Keep the existing entrance animation for subsequent client-side pages.
  const serverRenderedInitialPage = useRef(Boolean(initialData));
  useEffect(() => {
    serverRenderedInitialPage.current = false;
  }, []);
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = typeof params?.locale === "string" ? params.locale : "ua";
  const isUa = locale === "ua";
  const shouldReduceMotion = useReducedMotion();

  const { data: session, status: sessionStatus } = useSession();
  const user = session?.user as { group?: string } | undefined;
  const isB2B =
    sessionStatus === "loading" && initialData ? initialData.isB2B : user?.group === "B2B_APPROVED";
  const audienceKey =
    sessionStatus === "loading" && initialData
      ? initialData.audienceKey
      : JSON.stringify([session?.user?.email ?? "", user?.group ?? ""]);
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
  const initialPage = useRef(
    parseStockPage(
      typeof window === "undefined"
        ? searchParams.get("page")
        : new URLSearchParams(window.location.search).get("page")
    )
  ).current;
  const initialBrands = parseShopStockParamList(searchParams, "brand");
  const initialStock = searchParams.get("stock");
  const initialSort = searchParams.get("sort");

  const initialSearchRef = useRef(true);
  const searchRequestRef = useRef<AbortController | null>(null);
  const autoSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scopeSearchImmediateRef = useRef(false);
  const suggestionRequestRef = useRef<AbortController | null>(null);
  const resolvedSuggestionRequestKeyRef = useRef("");
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // The header "Search" item and the "/" key both bring the field into view.
  useEffect(() => {
    const focusSearch = () => {
      searchBoxRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      searchInputRef.current?.focus({ preventScroll: true });
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      event.preventDefault();
      focusSearch();
    };
    window.addEventListener(CATALOG_FOCUS_SEARCH_EVENT, focusSearch);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener(CATALOG_FOCUS_SEARCH_EVENT, focusSearch);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
  const searchFocusedRef = useRef(false);
  const searchResponseCacheRef = useRef(
    new Map<string, { timestamp: number; data: StockSearchResponse }>(
      initialData
        ? [[initialData.requestKey, { timestamp: Date.now(), data: initialData.response }]]
        : []
    )
  );
  const suggestionResponseCacheRef = useRef(
    new Map<string, { timestamp: number; data: StockSuggestion[] }>()
  );

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [suggestions, setSuggestions] = useState<StockSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [items, setItems] = useState<StockItem[]>(initialResponse?.data ?? []);
  // Vehicle that produced `items`. Selecting another vehicle updates make/model
  // immediately, while the previous products stay visible until the new
  // response arrives; fitment claims must never be shown for that stale page.
  const [resultVehicleKey, setResultVehicleKey] = useState<string | null>(() =>
    initialData
      ? fitmentResultKey({
          make: searchParams.get("make") ?? "",
          model: searchParams.get("model") ?? "",
          chassis: searchParams.get("chassis") ?? "",
          year: Number(searchParams.get("year")) || null,
          engine: searchParams.get("engine") ?? "",
          fuel: searchParams.get("fuel") ?? "",
          opfGpf: searchParams.get("opfGpf"),
          strict: searchParams.get("strict") === "1",
        })
      : null
  );
  const [warehouseHeroItems, setWarehouseHeroItems] = useState<StockItem[]>([]);
  const [heroProductIndex, setHeroProductIndex] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [heroInView, setHeroInView] = useState(true);
  const heroSectionRef = useRef<HTMLElement | null>(null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState("");
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(initialResponse?.meta?.totalPages || 1);
  const [correctedQuery, setCorrectedQuery] = useState<string | null>(
    initialResponse?.meta?.correctedQuery ?? null
  );
  const [totalItems, setTotalItems] = useState(initialResponse?.meta?.totalItems || 0);
  const [hasSearched, setHasSearched] = useState(true);
  const [fallbackApplied, setFallbackApplied] = useState<"fitment" | "all" | null>(
    initialResponse?.meta?.fallbackApplied ?? null
  );

  const [localCategory, setLocalCategory] = useState(searchParams.get("category") || "");
  const localCategoryLabel =
    SHOP_STOCK_CATEGORY_GROUPS.find((group) => group.id === localCategory)?.[isUa ? "ua" : "en"] ??
    localCategory;
  const [productTypeFilter, setProductTypeFilter] = useState(
    searchParams.get("productType")?.trim().slice(0, 120) || ""
  );
  const [requestedYear, setRequestedYear] = useState<number | null>(() => {
    const year = Number(searchParams.get("year"));
    return Number.isInteger(year) && year >= 1886 && year <= new Date().getFullYear() + 2
      ? year
      : null;
  });
  const [engineFilter, setEngineFilter] = useState(searchParams.get("engine")?.trim() || "");
  const [fuelFilter, setFuelFilter] = useState(searchParams.get("fuel")?.trim() || "");
  const [opfGpfFilter, setOpfGpfFilter] = useState<"with" | "without" | null>(() => {
    const value = searchParams.get("opfGpf");
    return value === "with" || value === "without" ? value : null;
  });
  const [productKindFilter, setProductKindFilter] = useState<ShopAiProductKind | null>(() =>
    cleanShopAiProductKind(searchParams.get("productKind"))
  );
  const [strictMatch, setStrictMatch] = useState(searchParams.get("strict") === "1");
  const [localCategories, setLocalCategories] = useState<string[]>(
    initialResponse?.filters?.categories ?? []
  );
  const [localBrands, setLocalBrands] = useState<string[]>(initialResponse?.filters?.brands ?? []);
  const [filterStats, setFilterStats] = useState<FilterStats | null>(
    initialResponse?.filterStats ?? null
  );
  const [globalFilterStats, setGlobalFilterStats] = useState<FilterStats | null>(
    initialResponse?.globalFilterStats ?? null
  );
  const [priceBounds, setPriceBounds] = useState<FilterStats["price"] | null>(
    initialResponse?.filters?.price ?? null
  );
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
  const [mobileFiltersOpen, setMobileFiltersOpen, rememberFiltersUrl] =
    useCatalogOverlay("filters");
  const [makePickerOpen, setMakePickerOpen, rememberMakeUrl] = useCatalogOverlay("make");
  const [vehicleMode, setVehicleMode] = useState<VehicleMode>(
    searchParams.get("scope") === "moto" ? "moto" : "auto"
  );
  const [make, setMake] = useState(searchParams.get("make") || "");
  const [model, setModel] = useState(searchParams.get("model") || "");
  const [chassis, setChassis] = useState(searchParams.get("chassis") || "");
  // "My vehicle": the last make+model a customer picked, remembered on this
  // device so a returning visitor can restore it with one tap. It is offered,
  // never auto-applied, so shared catalog links keep their exact filters.
  const [savedVehicle, setSavedVehicle] = useState<SavedCatalogVehicle | null>(null);
  useEffect(() => {
    setSavedVehicle(readSavedCatalogVehicle());
  }, []);
  useEffect(() => {
    if (!make || !model) return;
    const next: SavedCatalogVehicle = {
      mode: vehicleMode,
      make,
      model,
      chassis,
      year: null,
    };
    writeSavedCatalogVehicle(next);
    setSavedVehicle(next);
  }, [chassis, make, model, requestedYear, vehicleMode]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>(initialBrands.slice(0, 1));
  const showWarehouseHero =
    vehicleMode === "auto" &&
    !query.trim() &&
    !make &&
    !model &&
    !chassis &&
    !selectedBrands.length &&
    !localCategory &&
    !productTypeFilter &&
    (!productKindFilter || productKindFilter === "any") &&
    !requestedYear &&
    !engineFilter &&
    !fuelFilter &&
    !opfGpfFilter &&
    !minPriceFilter &&
    !maxPriceFilter &&
    stockFilter === "all";
  // The initial catalog and the full carousel request run in parallel. Use any
  // curated in-stock product already present on the first catalog page so the
  // hero never becomes an empty panel while the full carousel list is arriving.
  const heroInventoryItems = warehouseHeroItems.length ? warehouseHeroItems : items;
  const heroProducts = useMemo(() => {
    const uniqueInventory = new Map<string, StockItem>();
    for (const item of heroInventoryItems) {
      const inventoryKey = item.partNumber.trim().toUpperCase() || item.id;
      const existing = uniqueInventory.get(inventoryKey);
      if (!existing || (item.price ?? 0) > (existing.price ?? 0)) {
        uniqueInventory.set(inventoryKey, item);
      }
    }
    const available = [...uniqueInventory.values()]
      .filter(isShopWarehouseHeroProduct)
      .sort((left, right) => (right.price ?? 0) - (left.price ?? 0));
    const featured: StockItem[] = [];
    const usedBrands = new Set<string>();

    for (const item of available) {
      const brandKey = item.brand.trim().toLocaleLowerCase();
      if (!brandKey || usedBrands.has(brandKey)) continue;
      featured.push(item);
      usedBrands.add(brandKey);
    }

    for (const item of available) {
      if (featured.some((featuredItem) => featuredItem.id === item.id)) continue;
      featured.push(item);
    }

    return featured;
  }, [heroInventoryItems]);
  const activeHeroProduct = showWarehouseHero ? (heroProducts[heroProductIndex] ?? null) : null;
  // Typing the first character hides the warehouse hero above the search box.
  // Without compensation the whole page shifts up by the hero height and the
  // focused input slides under the fixed site header while the user types.
  const previousShowWarehouseHeroRef = useRef(showWarehouseHero);
  useLayoutEffect(() => {
    const heroJustHidden = previousShowWarehouseHeroRef.current && !showWarehouseHero;
    previousShowWarehouseHeroRef.current = showWarehouseHero;
    if (!heroJustHidden || !searchFocusedRef.current) return;
    const searchBox = searchBoxRef.current;
    if (!searchBox) return;
    const top = searchBox.getBoundingClientRect().top;
    if (top < SEARCH_BOX_MIN_VIEWPORT_TOP) {
      window.scrollBy({ top: top - SEARCH_BOX_MIN_VIEWPORT_TOP, behavior: "auto" });
    }
  }, [showWarehouseHero]);
  const mobileFiltersDialogRef = useRef<HTMLElement | null>(null);
  const mobileFiltersCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  // Preserve the catalog position when a customer opens a product and comes
  // back with the browser Back button. The URL remains the source of truth for
  // filters; this session-only value restores only the visual position.
  useEffect(() => {
    const key = `onecompany:catalog-scroll:${window.location.pathname}${window.location.search}`;
    const saved = Number(window.sessionStorage.getItem(key));
    if (Number.isFinite(saved) && saved > 0) {
      window.requestAnimationFrame(() => window.scrollTo({ top: saved, behavior: "auto" }));
    }
    const savePosition = () => {
      window.sessionStorage.setItem(key, String(Math.round(window.scrollY)));
    };
    window.addEventListener("pagehide", savePosition);
    return () => {
      savePosition();
      window.removeEventListener("pagehide", savePosition);
    };
  }, []);

  useEffect(() => {
    if (!showWarehouseHero) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      locale,
      stock: "inStock",
      carousel: "1",
      limit: "96",
      sort: "price_desc",
      currency,
    });
    if (country) params.set("country", country);

    void fetch(`/api/shop/stock/search?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("inventory"))))
      .then((payload: StockSearchResponse) => setWarehouseHeroItems(payload.data ?? []))
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
          setWarehouseHeroItems([]);
        }
      });

    return () => controller.abort();
  }, [country, currency, locale, showWarehouseHero]);

  useEffect(() => {
    setHeroProductIndex((current) => (heroProducts.length ? current % heroProducts.length : 0));
  }, [heroProducts.length]);

  useEffect(() => {
    if (
      !showWarehouseHero ||
      heroPaused ||
      !heroInView ||
      heroProducts.length < 2 ||
      shouldReduceMotion
    )
      return;
    const interval = window.setInterval(() => {
      setHeroProductIndex((current) => (current + 1) % heroProducts.length);
    }, 7000);
    return () => window.clearInterval(interval);
  }, [
    heroInView,
    heroPaused,
    heroProductIndex,
    heroProducts.length,
    shouldReduceMotion,
    showWarehouseHero,
  ]);

  useEffect(() => {
    const hero = heroSectionRef.current;
    if (!hero || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setHeroInView(entry.isIntersecting), {
      rootMargin: "120px 0px",
      threshold: 0.01,
    });
    observer.observe(hero);
    return () => observer.disconnect();
  }, [showWarehouseHero]);

  useEffect(() => {
    const handleOpenCatalogFilters = () => setMobileFiltersOpen(true);
    window.addEventListener(SHOP_CATALOG_OPEN_FILTERS_EVENT, handleOpenCatalogFilters);
    return () =>
      window.removeEventListener(SHOP_CATALOG_OPEN_FILTERS_EVENT, handleOpenCatalogFilters);
  }, []);

  useEffect(() => {
    if (!mobileFiltersOpen || makePickerOpen) return;

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
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      } else {
        window.requestAnimationFrame(() =>
          document.querySelector<HTMLElement>("[data-catalog-filter-trigger]")?.focus()
        );
      }
    };
  }, [mobileFiltersOpen, makePickerOpen, setMobileFiltersOpen]);

  // Vehicle fitment state
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [chassisCodes, setChassisCodes] = useState<string[]>([]);
  const [fitmentYears, setFitmentYears] = useState<number[]>([]);
  const [fitmentEngines, setFitmentEngines] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [submodelsLoading, setSubmodelsLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [modelsError, setModelsError] = useState(false);
  const [submodelsError, setSubmodelsError] = useState(false);
  const [makesError, setMakesError] = useState(false);
  const makesRequestKeyRef = useRef("");
  const modelsRequestKeyRef = useRef("");
  const chassisRequestKeyRef = useRef("");
  const detailsRequestKeyRef = useRef("");
  const makesGenerationRef = useRef(0);
  const modelsGenerationRef = useRef(0);
  const chassisGenerationRef = useRef(0);
  const detailsGenerationRef = useRef(0);

  const [makePickerQuery, setMakePickerQuery] = useState("");
  // Which field of the "Parts for [make] [model] [chassis]" sentence is open.
  const [vehiclePicker, setVehiclePicker] = useState<"make" | "model" | "chassis" | null>(null);
  const makePickerDialogRef = useRef<HTMLDivElement | null>(null);
  const makePickerSearchInputRef = useRef<HTMLInputElement | null>(null);
  const handleVehicleModeChange = useCallback(
    (mode: VehicleMode) => {
      if (mode === vehicleMode) return;

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
      setFitmentYears([]);
      setFitmentEngines([]);
      setRequestedYear(null);
      setEngineFilter("");
      setFuelFilter("");
      setOpfGpfFilter(null);
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
    // Keep the filter sheet beneath the make picker so model/chassis remain one tap away.
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

    const immediateBrands: StockSuggestion[] = localBrands
      .filter((brandName) => matchesShopSearchQuery(brandName, normalizedQuery))
      .slice(0, 2)
      .map((label) => ({ type: "brand", id: `brand:${label}`, label }));
    const immediateVehicles: StockSuggestion[] = makes
      .filter((makeName) => matchesShopSearchQuery(makeName, normalizedQuery))
      .slice(0, 2)
      .map((makeName) => ({
        type: "vehicle",
        id: `vehicle:${makeName}`,
        label: makeName,
        make: makeName,
      }));
    const immediateProducts: StockSuggestion[] = items
      .filter((item) =>
        matchesShopSearchQuery(
          `${item.name} ${item.brand} ${item.partNumber} ${item.category || ""}`,
          normalizedQuery
        )
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
    const cached = suggestionResponseCacheRef.current.get(requestKey);
    if (cached && Date.now() - cached.timestamp < 120_000) {
      resolvedSuggestionRequestKeyRef.current = requestKey;
      setSuggestions(cached.data);
      setSuggestionsOpen(true);
      setSuggestionsLoading(false);
      return;
    }

    const controller = new AbortController();
    suggestionRequestRef.current = controller;
    const timer = window.setTimeout(async () => {
      setSuggestionsLoading(true);
      const params = new URLSearchParams({
        q: normalizedQuery,
        locale,
        v: "4",
        scope: vehicleMode,
      });
      try {
        const response = await fetch(`/api/shop/stock/suggest?${params.toString()}`, {
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Suggestion search failed");
        resolvedSuggestionRequestKeyRef.current = requestKey;
        const nextSuggestions = Array.isArray(payload.data) ? payload.data.slice(0, 10) : [];
        suggestionResponseCacheRef.current.set(requestKey, {
          timestamp: Date.now(),
          data: nextSuggestions,
        });
        if (suggestionResponseCacheRef.current.size > 30) {
          const oldestKey = suggestionResponseCacheRef.current.keys().next().value;
          if (oldestKey) suggestionResponseCacheRef.current.delete(oldestKey);
        }
        setSuggestions(nextSuggestions);
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

  const handleToggleBrand = (brandName: string) => {
    setSelectedBrands((current) => (current.includes(brandName) ? [] : [brandName]));
  };

  const syncUrlState = useCallback(
    (searchPage: number, nextViewMode = viewModeRef.current) => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (selectedBrands.length > 0) params.set("brand", selectedBrands.join(","));
      if (localCategory) params.set("category", localCategory);
      if (productTypeFilter) params.set("productType", productTypeFilter);
      if (make) params.set("make", make);
      if (model) params.set("model", model);
      if (chassis) params.set("chassis", chassis);
      if (requestedYear) params.set("year", String(requestedYear));
      if (engineFilter.trim()) params.set("engine", engineFilter.trim());
      if (fuelFilter) params.set("fuel", fuelFilter);
      if (opfGpfFilter) params.set("opfGpf", opfGpfFilter);
      if (
        make ||
        model ||
        chassis ||
        requestedYear ||
        engineFilter.trim() ||
        fuelFilter ||
        opfGpfFilter
      ) {
        params.set("includeFitment", "true");
      }
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
      rememberFiltersUrl(nextUrl);
      rememberMakeUrl(nextUrl);
      if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
        // Let Next.js synchronize useSearchParams and pagination links. Passing
        // its internal history state makes the router skip that synchronization.
        window.history.replaceState(null, "", nextUrl);
      }
    },
    [
      rememberFiltersUrl,
      rememberMakeUrl,
      chassis,
      currency,
      engineFilter,
      fuelFilter,
      localCategory,
      productTypeFilter,
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
    (data: StockSearchResponse, searchPage: number, vehicleKey: string) => {
      setItems(data.data || []);
      setResultVehicleKey(vehicleKey);
      setTotalPages(data.meta?.totalPages || 1);
      setTotalItems(data.meta?.totalItems || 0);
      setFallbackApplied(data.meta?.fallbackApplied || null);
      setCorrectedQuery(data.meta?.correctedQuery ?? null);
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

  // Vehicle choices are brand-independent; the selected brand still filters products.
  useEffect(() => {
    const requestKey = vehicleMode;
    makesRequestKeyRef.current = requestKey;
    const generation = ++makesGenerationRef.current;
    const controller = new AbortController();
    fetch(`/api/shop/stock/fitment?scope=${vehicleMode}`, {
      signal: controller.signal,
    })
      .then((response) => {
        return parseShopStockJsonResponse(response);
      })
      .then((fitmentRes) => {
        if (
          controller.signal.aborted ||
          generation !== makesGenerationRef.current ||
          !isCurrentFitmentRequest(
            requestKey,
            makesRequestKeyRef.current,
            controller.signal.aborted
          )
        )
          return;
        if (!hasFitmentResponseType(fitmentRes, "makes") || !isStringArray(fitmentRes.data)) {
          throw new Error("invalid fitment makes response");
        }
        const nextMakes = fitmentRes.data;
        setMakes(nextMakes);
        setMakesError(false);
      })
      .catch((error: unknown) => {
        if (
          !(error instanceof DOMException && error.name === "AbortError") &&
          generation === makesGenerationRef.current &&
          isCurrentFitmentRequest(requestKey, makesRequestKeyRef.current)
        ) {
          setMakesError(true);
        }
      });
    return () => controller.abort();
  }, [vehicleMode]);

  // Cascading: Make → Models
  useEffect(() => {
    if (!make) {
      setModels([]);
      setModel("");
      setChassis("");
      setChassisCodes([]);
      setFitmentYears([]);
      setFitmentEngines([]);
      setOpfGpfFilter(null);
      setModelsError(false);
      setSubmodelsError(false);
      setModelsLoading(false);
      setSubmodelsLoading(false);
      setDetailsLoading(false);
      return;
    }
    setModelsLoading(true);
    setModelsError(false);
    const controller = new AbortController();
    const requestKey = `${vehicleMode}|${normalizeVehicleMakeName(make)}`;
    modelsRequestKeyRef.current = requestKey;
    const generation = ++modelsGenerationRef.current;
    fetch(`/api/shop/stock/fitment?scope=${vehicleMode}&make=${encodeURIComponent(make)}`, {
      signal: controller.signal,
    })
      .then((r) => {
        return parseShopStockJsonResponse(r);
      })
      .then((res) => {
        if (
          controller.signal.aborted ||
          generation !== modelsGenerationRef.current ||
          !isCurrentFitmentRequest(requestKey, modelsRequestKeyRef.current)
        )
          return;
        if (!hasFitmentResponseType(res, "models") || !isStringArray(res.data)) {
          throw new Error("invalid fitment models response");
        }
        const nextModels = res.data;
        setModels(nextModels);
        setModel((currentModel) => {
          const requestedModel = currentModel;
          const canonicalModel = resolveFitmentOption(nextModels, requestedModel, (value) =>
            vehicleModelKey(canonicalVehicleModelLabel(make, value))
          );
          return canonicalModel ?? currentModel;
        });
      })
      .catch((error: unknown) => {
        if (
          !(error instanceof DOMException && error.name === "AbortError") &&
          generation === modelsGenerationRef.current &&
          isCurrentFitmentRequest(requestKey, modelsRequestKeyRef.current)
        ) {
          setModelsError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setModelsLoading(false);
      });
    setChassisCodes([]);
    return () => controller.abort();
  }, [make, vehicleMode]);

  // Cascading: Model → Chassis
  useEffect(() => {
    if (!make || !model) {
      setChassisCodes([]);
      setChassis("");
      setFitmentYears([]);
      setFitmentEngines([]);
      setOpfGpfFilter(null);
      setRequestedYear(null);
      setEngineFilter("");
      setFuelFilter("");
      setSubmodelsError(false);
      setSubmodelsLoading(false);
      setDetailsLoading(false);
      return;
    }
    setSubmodelsLoading(true);
    setSubmodelsError(false);
    setFitmentYears([]);
    setFitmentEngines([]);
    setOpfGpfFilter(null);
    const controller = new AbortController();
    const requestKey = `${vehicleMode}|${normalizeVehicleMakeName(make)}|${vehicleModelKey(canonicalVehicleModelLabel(make, model))}`;
    chassisRequestKeyRef.current = requestKey;
    const generation = ++chassisGenerationRef.current;
    fetch(
      `/api/shop/stock/fitment?scope=${vehicleMode}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`,
      { signal: controller.signal }
    )
      .then((r) => {
        return parseShopStockJsonResponse(r);
      })
      .then((res) => {
        if (
          controller.signal.aborted ||
          generation !== chassisGenerationRef.current ||
          !isCurrentFitmentRequest(requestKey, chassisRequestKeyRef.current)
        )
          return;
        if (!hasFitmentResponseType(res, "chassis") || !isStringArray(res.data)) {
          throw new Error("invalid fitment chassis response");
        }
        const rawChassisCodes = res.data;
        const nextChassisCodes = canonicalizeVehicleChassisCodes(rawChassisCodes, make, model);
        setChassisCodes(nextChassisCodes);
        setChassis((currentChassis) => {
          const requestedChassis = currentChassis;
          const canonicalChassis = resolveFitmentOption(nextChassisCodes, requestedChassis);
          return canonicalChassis ?? currentChassis;
        });
      })
      .catch((error: unknown) => {
        if (
          !(error instanceof DOMException && error.name === "AbortError") &&
          generation === chassisGenerationRef.current &&
          isCurrentFitmentRequest(requestKey, chassisRequestKeyRef.current)
        ) {
          setSubmodelsError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSubmodelsLoading(false);
      });
    return () => controller.abort();
  }, [make, model, vehicleMode]);

  // Model/chassis → valid years and engines from the same correlated clauses.
  useEffect(() => {
    if (!make || !model) {
      setFitmentYears([]);
      setFitmentEngines([]);
      setOpfGpfFilter(null);
      setDetailsLoading(false);
      return;
    }
    setDetailsLoading(true);
    const controller = new AbortController();
    const requestKey = `${vehicleMode}|${normalizeVehicleMakeName(make)}|${vehicleModelKey(canonicalVehicleModelLabel(make, model))}|${chassis.trim().toLocaleLowerCase()}|${requestedYear ?? ""}`;
    detailsRequestKeyRef.current = requestKey;
    const generation = ++detailsGenerationRef.current;
    const params = new URLSearchParams({
      scope: vehicleMode,
      make,
      model,
      details: "1",
    });
    if (chassis) params.set("chassis", chassis);
    if (requestedYear) params.set("year", String(requestedYear));
    fetch(`/api/shop/stock/fitment?${params.toString()}`, { signal: controller.signal })
      .then((response) => {
        return parseShopStockJsonResponse(response);
      })
      .then((response) => {
        if (
          controller.signal.aborted ||
          generation !== detailsGenerationRef.current ||
          !isCurrentFitmentRequest(requestKey, detailsRequestKeyRef.current)
        )
          return;
        const details =
          hasFitmentResponseType(response, "details") &&
          response.data &&
          typeof response.data === "object"
            ? (response.data as { years?: unknown; engines?: unknown })
            : null;
        if (!details || !Array.isArray(details.years) || !isStringArray(details.engines)) {
          throw new Error("invalid fitment details response");
        }
        const years =
          Array.isArray(details?.years) &&
          details.years.every((year: unknown) => Number.isInteger(year))
            ? details.years
            : [];
        const engines = isStringArray(details?.engines) ? details.engines : [];
        setFitmentYears(years);
        setFitmentEngines(engines);
      })
      .catch((error: unknown) => {
        if (
          !(error instanceof DOMException && error.name === "AbortError") &&
          generation === detailsGenerationRef.current &&
          isCurrentFitmentRequest(requestKey, detailsRequestKeyRef.current)
        ) {
          setFitmentYears([]);
          setFitmentEngines([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailsLoading(false);
      });
    return () => controller.abort();
  }, [chassis, make, model, requestedYear, vehicleMode]);

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
      if (productTypeFilter) params.set("productType", productTypeFilter);
      if (make) params.set("make", make);
      if (model) params.set("model", model);
      if (chassis) params.set("chassis", chassis);
      if (requestedYear) params.set("year", String(requestedYear));
      if (engineFilter.trim()) params.set("engine", engineFilter.trim());
      if (fuelFilter) params.set("fuel", fuelFilter);
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
      const requestVehicleKey = fitmentResultKey({
        make,
        model,
        chassis,
        year: requestedYear,
        engine: engineFilter,
        fuel: fuelFilter,
        opfGpf: opfGpfFilter,
        strict: strictMatch,
      });
      const cacheKey = `${audienceKey}|${stockSearchCacheKey(params)}`;
      const cached = searchResponseCacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 45_000) {
        applySearchPayload(cached.data, searchPage, requestVehicleKey);
        searchRequestRef.current = null;
        setLoading(false);
        return;
      }

      try {
        const payload = await fetchShopStockSearch(
          `/api/shop/stock/search?${params.toString()}`,
          controller.signal
        );
        const data = payload as StockSearchResponse;
        if (!data || typeof data !== "object" || !Array.isArray(data.data)) {
          throw new Error("stock_response_invalid");
        }
        if (controller.signal.aborted) return;
        searchResponseCacheRef.current.set(cacheKey, { timestamp: Date.now(), data });
        if (searchResponseCacheRef.current.size > 40) {
          const oldestKey = searchResponseCacheRef.current.keys().next().value;
          if (oldestKey) searchResponseCacheRef.current.delete(oldestKey);
        }
        applySearchPayload(data, searchPage, requestVehicleKey);
      } catch (error) {
        if (controller.signal.aborted) return;
        setItems([]);
        setTotalItems(0);
        setTotalPages(1);
        setFilterStats(null);
        const errorCode = error instanceof Error ? error.message : "";
        setError(
          errorCode === "stock_response_invalid"
            ? isUa
              ? "Сервер повернув некоректну відповідь. Спробуйте ще раз."
              : "The server returned an invalid response. Please try again."
            : isUa
              ? "Не вдалося завантажити товари. Спробуйте ще раз."
              : "Products could not be loaded. Please try again."
        );
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
      fuelFilter,
      opfGpfFilter,
      productKindFilter,
      strictMatch,
      stockFilter,
      sortOrder,
      localCategory,
      productTypeFilter,
      minPriceFilter,
      maxPriceFilter,
      locale,
      country,
      currency,
      vehicleMode,
      applySearchPayload,
      audienceKey,
      isUa,
    ]
  );

  // Auto-search for filters and queries
  const searchTextKey = JSON.stringify([query, engineFilter, minPriceFilter, maxPriceFilter]);
  const previousSearchTextRef = useRef(searchTextKey);
  const autoSearchFilterKey = JSON.stringify([
    selectedBrands,
    make,
    model,
    chassis,
    requestedYear,
    engineFilter,
    fuelFilter,
    opfGpfFilter,
    productKindFilter,
    strictMatch,
    query,
    stockFilter,
    sortOrder,
    localCategory,
    productTypeFilter,
    minPriceFilter,
    maxPriceFilter,
    vehicleMode,
  ]);
  const autoSearchContextKey = JSON.stringify([currency, country, audienceKey, locale]);
  const previousAutoSearchFilterKeyRef = useRef(autoSearchFilterKey);
  const previousAutoSearchContextKeyRef = useRef(autoSearchContextKey);
  useEffect(() => {
    const isInitialSearch = initialSearchRef.current;
    const filtersChanged = previousAutoSearchFilterKeyRef.current !== autoSearchFilterKey;
    const contextChanged = previousAutoSearchContextKeyRef.current !== autoSearchContextKey;
    // Pagination updates the URL and useSearchParams. Only a real filter change
    // should start another search; otherwise page 2 immediately resets to 1.
    if (!isInitialSearch && !filtersChanged && !contextChanged) return;
    previousAutoSearchFilterKeyRef.current = autoSearchFilterKey;
    previousAutoSearchContextKeyRef.current = autoSearchContextKey;
    const searchPage = isInitialSearch ? initialPage : filtersChanged ? 1 : page;
    const delay = resolveShopStockSearchDelay({
      isInitialSearch,
      isScopeSearchImmediate: scopeSearchImmediateRef.current,
      isTextChange: previousSearchTextRef.current !== searchTextKey,
    });
    previousSearchTextRef.current = searchTextKey;
    scopeSearchImmediateRef.current = false;
    autoSearchTimerRef.current = setTimeout(() => {
      if (isInitialSearch) initialSearchRef.current = false;
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
    fuelFilter,
    opfGpfFilter,
    productKindFilter,
    strictMatch,
    query,
    stockFilter,
    sortOrder,
    localCategory,
    productTypeFilter,
    minPriceFilter,
    maxPriceFilter,
    doSearch,
    initialPage,
    searchTextKey,
    autoSearchFilterKey,
    autoSearchContextKey,
    page,
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
    setProductTypeFilter("");
    setRequestedYear(null);
    setEngineFilter("");
    setFuelFilter("");
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
    // Closing the nested picker consumes its temporary history entry immediately.
    // Publish the new vehicle URL before closing so a fast mobile tap cannot let
    // the popstate handler restore the pre-selection URL before React's effect
    // has had a chance to run.
    if (typeof window !== "undefined") {
      const nextUrl = new URL(window.location.href);
      if (nextMake) nextUrl.searchParams.set("make", nextMake);
      else nextUrl.searchParams.delete("make");
      for (const key of ["model", "chassis", "year", "engine", "fuel", "opfGpf", "page"]) {
        nextUrl.searchParams.delete(key);
      }
      const nextHref = `${nextUrl.pathname}${nextUrl.search}`;
      rememberFiltersUrl(nextHref);
      rememberMakeUrl(nextHref);
      window.history.replaceState(null, "", nextHref);
    }
    setMake(nextMake);
    setModel("");
    setChassis("");
    setRequestedYear(null);
    setEngineFilter("");
    setFuelFilter("");
    // Keep any product-brand filter the customer already selected. Vehicle
    // and product brand are independent dimensions and can be combined.
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

    setMake(suggestion.make);
    setModel(suggestion.model || "");
    setChassis("");
    setRequestedYear(null);
    setEngineFilter("");
    setFuelFilter("");
    setOpfGpfFilter(null);
    setSelectedBrands([]);
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
    Boolean(productTypeFilter) ||
    Boolean(make) ||
    Boolean(model) ||
    Boolean(chassis) ||
    Boolean(requestedYear) ||
    Boolean(engineFilter.trim()) ||
    Boolean(fuelFilter) ||
    Boolean(opfGpfFilter) ||
    Boolean(productKindFilter) ||
    vehicleMode === "moto" ||
    stockFilter !== "all" ||
    hasPriceFilter;

  const activeFilterCount =
    (query.trim() ? 1 : 0) +
    selectedBrands.length +
    (localCategory ? 1 : 0) +
    (productTypeFilter ? 1 : 0) +
    (make ? 1 : 0) +
    (model ? 1 : 0) +
    (chassis ? 1 : 0) +
    (requestedYear ? 1 : 0) +
    (engineFilter.trim() ? 1 : 0) +
    (fuelFilter ? 1 : 0) +
    (opfGpfFilter ? 1 : 0) +
    (productKindFilter ? 1 : 0) +
    (vehicleMode === "moto" ? 1 : 0) +
    (stockFilter !== "all" ? 1 : 0) +
    (hasPriceFilter ? 1 : 0);

  const isInitialCatalogLoading = loading && filterStats === null;
  const stockCount = (value: StockFilter) =>
    value === "all"
      ? filterStats?.stock.all
      : value === "inStock"
        ? filterStats?.stock.inStock
        : filterStats?.stock.preOrder;

  const getItemPriceSet = useCallback((item: StockItem): ShopPriceSet => {
    return getShopStockItemPriceSet(item);
  }, []);

  const getItemCompareAtSet = useCallback((item: StockItem): ShopPriceSet | null => {
    return getShopStockItemCompareAtSet(item);
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
      return compareAtAmount > 0 ? compareAtAmount : 0;
    },
    [currency, displayRates, getItemCompareAtSet]
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
  const currentFitmentKey = fitmentResultKey({
    make,
    model,
    chassis,
    year: requestedYear,
    engine: engineFilter,
    fuel: fuelFilter,
    opfGpf: opfGpfFilter,
    strict: strictMatch,
  });
  // The visible page was produced for the current vehicle/strict selection.
  const resultsMatchSelection = !loading && resultVehicleKey === currentFitmentKey;
  const showFitmentEvidence = Boolean(make || model || chassis) && resultsMatchSelection;
  // Strict match statuses ("Confirmed" / "Verify fitment") and the actions they
  // select belong to the response that produced them; drop them while a
  // replacement request for a different selection is pending.
  const visibleItems = useMemo(
    () =>
      resultsMatchSelection
        ? items
        : items.map((item) => (item.matchStatus ? { ...item, matchStatus: undefined } : item)),
    [items, resultsMatchSelection]
  );
  const emptyStateActions = useMemo(() => {
    const actions: Array<{ key: string; ua: string; en: string; run: () => void }> = [];
    if (query.trim()) {
      actions.push({
        key: "query",
        ua: "Очистити пошук",
        en: "Clear search",
        run: () => setQuery(""),
      });
    }
    if (chassis) {
      actions.push({
        key: "chassis",
        ua: "Прибрати кузов",
        en: "Remove chassis",
        run: () => setChassis(""),
      });
    }
    if (model) {
      actions.push({
        key: "model",
        ua: "Прибрати модель",
        en: "Remove model",
        run: () => {
          setModel("");
          setChassis("");
        },
      });
    }
    if (make) {
      actions.push({
        key: "make",
        ua: "Прибрати марку",
        en: "Remove make",
        run: () => {
          setMake("");
          setModel("");
          setChassis("");
          setRequestedYear(null);
          setEngineFilter("");
          setFuelFilter("");
          setOpfGpfFilter(null);
        },
      });
    }
    if (selectedBrands.length > 0) {
      actions.push({
        key: "brand",
        ua: "Прибрати бренд товару",
        en: "Remove product brand",
        run: () => setSelectedBrands([]),
      });
    }
    if (localCategory) {
      actions.push({
        key: "category",
        ua: "Прибрати групу",
        en: "Remove category",
        run: () => setLocalCategory(""),
      });
    }
    if (stockFilter !== "all") {
      actions.push({
        key: "stock",
        ua: "Показати всю наявність",
        en: "Show all availability",
        run: () => setStockFilter("all"),
      });
    }
    return actions.slice(0, 4);
  }, [chassis, localCategory, make, model, query, selectedBrands.length, stockFilter]);

  const renderVehicleFitmentFields = (horizontal = false) => {
    const vehicleFieldSurface = horizontal
      ? "rounded-[8px] bg-card shadow-[0_8px_24px_rgba(0,0,0,0.055)] dark:bg-[#08090b] dark:shadow-none"
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
              setModel(event.target.value);
              setChassis("");
              setRequestedYear(null);
              setEngineFilter("");
              setFuelFilter("");
              setOpfGpfFilter(null);
            }}
            className={`h-11 w-full appearance-none truncate border border-foreground/15 px-3 pr-9 text-xs font-normal text-foreground/80 outline-hidden transition hover:border-foreground/25 focus:border-foreground/45 disabled:cursor-not-allowed disabled:opacity-55 ${vehicleFieldSurface}`}
          >
            <option value="" className="bg-card text-foreground dark:bg-[#121216]">
              {modelsLoading
                ? isUa
                  ? "Завантаження..."
                  : "Loading..."
                : modelsError
                  ? isUa
                    ? "Не вдалося завантажити моделі"
                    : "Models unavailable"
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
            onChange={(event) => {
              setChassis(event.target.value);
              setRequestedYear(null);
              setEngineFilter("");
              setFuelFilter("");
              setOpfGpfFilter(null);
            }}
            className={`h-11 w-full appearance-none truncate border border-foreground/15 px-3 pr-9 text-xs font-normal text-foreground/80 outline-hidden transition hover:border-foreground/25 focus:border-foreground/45 disabled:cursor-not-allowed disabled:opacity-55 ${vehicleFieldSurface}`}
          >
            <option value="" className="bg-card text-foreground dark:bg-[#121216]">
              {submodelsLoading
                ? isUa
                  ? "Завантаження..."
                  : "Loading..."
                : submodelsError
                  ? isUa
                    ? "Не вдалося завантажити кузови"
                    : "Chassis unavailable"
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

  const hasVehicleModel = Boolean(model.trim());
  const hasYearOptions = hasVehicleModel && fitmentYears.length > 0;
  const hasEngineOptions = hasVehicleModel && fitmentEngines.length > 0;

  // Vehicle finder as one sentence: "Parts for [make] [model] [chassis]".
  // Each field opens its own searchable list in place; choosing a make opens
  // the model list, choosing a model opens the chassis list.
  const renderInlineVehicleFinder = () => {
    const clearBelowModel = () => {
      setChassis("");
      setRequestedYear(null);
      setEngineFilter("");
      setFuelFilter("");
      setOpfGpfFilter(null);
    };
    const popularMakes = visibleVehicleMakes.slice(0, 8);
    const sortedMakes = [...makes].sort((left, right) =>
      left.localeCompare(right, isUa ? "uk" : "en")
    );
    const makeOptions = [
      ...popularMakes.map((value) => ({ value, group: isUa ? "Популярні" : "Popular" })),
      ...sortedMakes.map((value) => ({ value, group: isUa ? "Усі марки" : "All makes" })),
    ];
    const savedLabel = savedVehicle
      ? [savedVehicle.make, savedVehicle.model, savedVehicle.chassis].filter(Boolean).join(" ")
      : "";

    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 flex w-full items-center gap-2.5 text-[14px] text-foreground/70 sm:w-auto">
          <PremiumVehicleIcon mode={vehicleMode} className="h-5 w-7 text-foreground/60" />
          {isUa ? "Деталі для" : "Parts for"}
        </span>

        <VehiclePickerSelect
          label={isUa ? "Марка" : "Make"}
          value={make}
          placeholder={
            makesError
              ? isUa
                ? "Марки недоступні"
                : "Makes unavailable"
              : isUa
                ? "оберіть марку"
                : "choose make"
          }
          options={makeOptions}
          open={vehiclePicker === "make"}
          onOpenChange={(next) => setVehiclePicker(next ? "make" : null)}
          onChange={(next) => {
            setMake(next);
            setModel("");
            clearBelowModel();
            if (next) setVehiclePicker("model");
          }}
          loading={makes.length === 0 && !makesError}
          searchPlaceholder={isUa ? "Знайти марку…" : "Find a make…"}
          emptyLabel={isUa ? "Марку не знайдено" : "No make found"}
          renderIcon={(value) => <VehicleMakeLogo make={value} />}
          header={
            !make && savedVehicle && savedVehicle.mode === vehicleMode ? (
              <button
                type="button"
                onClick={() => {
                  setVehiclePicker(null);
                  setMake(savedVehicle.make);
                  setModel(savedVehicle.model);
                  setChassis(savedVehicle.chassis);
                }}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-[13px] transition hover:bg-foreground/[0.05]"
              >
                <span className="min-w-0 truncate">
                  <span className="text-foreground/55">
                    {isUa ? "Минулого разу: " : "Last time: "}
                  </span>
                  <span className="font-medium">{savedLabel}</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-foreground/50" />
              </button>
            ) : null
          }
          className="w-full sm:w-[200px]"
        />

        <VehiclePickerSelect
          label={isUa ? "Модель" : "Model"}
          value={model}
          placeholder={isUa ? "модель" : "model"}
          options={models.map((value) => ({ value }))}
          open={vehiclePicker === "model"}
          onOpenChange={(next) => setVehiclePicker(next ? "model" : null)}
          onChange={(next) => {
            setModel(next);
            clearBelowModel();
            if (next) setVehiclePicker("chassis");
          }}
          disabled={!make}
          loading={modelsLoading}
          searchPlaceholder={
            isUa ? `Знайти модель серед ${models.length}…` : `Find among ${models.length} models…`
          }
          emptyLabel={
            modelsError
              ? isUa
                ? "Моделі недоступні"
                : "Models unavailable"
              : isUa
                ? "Модель не знайдено"
                : "No model found"
          }
          anyLabel={isUa ? "Будь-яка модель" : "Any model"}
          className="flex-1 sm:w-[180px] sm:flex-none"
        />

        <VehiclePickerSelect
          label={isUa ? "Кузов" : "Chassis"}
          value={chassis}
          placeholder={isUa ? "кузов" : "chassis"}
          options={chassisCodes.map((value) => ({ value }))}
          open={vehiclePicker === "chassis"}
          onOpenChange={(next) => setVehiclePicker(next ? "chassis" : null)}
          onChange={(next) => {
            clearBelowModel();
            setChassis(next);
          }}
          disabled={!model || (!submodelsLoading && chassisCodes.length === 0)}
          loading={submodelsLoading}
          searchPlaceholder={isUa ? "Знайти кузов…" : "Find a chassis…"}
          emptyLabel={isUa ? "Кузов не знайдено" : "No chassis found"}
          anyLabel={isUa ? "Будь-який кузов" : "Any chassis"}
          className="flex-1 sm:w-[150px] sm:flex-none"
        />

        {make ? (
          <button
            type="button"
            onClick={() => {
              setVehiclePicker(null);
              setMake("");
              setModel("");
              clearBelowModel();
            }}
            aria-label={isUa ? "Скинути авто" : "Clear vehicle"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] text-foreground/45 transition hover:bg-foreground/10 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    );
  };

  const renderStandardCompatibilityFields = (horizontal = false, includeYear = true) => {
    const surface = horizontal
      ? "rounded-[8px] bg-card/90 shadow-[0_8px_24px_rgba(0,0,0,0.055)] backdrop-blur-xl dark:bg-black/55 dark:shadow-none"
      : "bg-foreground/[0.035]";
    const fieldClass = `h-11 w-full border border-foreground/15 px-3 text-xs font-normal text-foreground/80 outline-hidden transition hover:border-foreground/25 focus:border-foreground/45 disabled:cursor-not-allowed disabled:opacity-55 ${surface}`;

    if (!hasVehicleModel) return null;

    return (
      <div className={horizontal ? "contents" : "grid grid-cols-1 gap-2"}>
        {includeYear && hasYearOptions ? (
          <label className="relative block min-w-0">
            <span className="sr-only">{isUa ? "Рік" : "Year"}</span>
            <select
              value={requestedYear ?? ""}
              onChange={(event) =>
                setRequestedYear(event.target.value ? Number(event.target.value) : null)
              }
              disabled={detailsLoading}
              className={`${fieldClass} appearance-none pr-9`}
            >
              <option value="" className="bg-card text-foreground dark:bg-[#121216]">
                {isUa ? "Будь-який рік" : "Any year"}
              </option>
              {fitmentYears.map((year) => (
                <option
                  key={year}
                  value={year}
                  className="bg-card text-foreground dark:bg-[#121216]"
                >
                  {year}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
          </label>
        ) : null}
        {hasEngineOptions ? (
          <label className="relative block min-w-0">
            <span className="sr-only">{isUa ? "Двигун" : "Engine"}</span>
            <select
              value={engineFilter}
              onChange={(event) => setEngineFilter(event.target.value)}
              disabled={detailsLoading}
              className={`${fieldClass} appearance-none pr-9`}
            >
              <option value="" className="bg-card text-foreground dark:bg-[#121216]">
                {isUa ? "Будь-який двигун" : "Any engine"}
              </option>
              {engineFilter && !fitmentEngines.includes(engineFilter) ? (
                <option value={engineFilter}>{engineFilter}</option>
              ) : null}
              {fitmentEngines.map((engine) => (
                <option
                  key={engine}
                  value={engine}
                  className="bg-card text-foreground dark:bg-[#121216]"
                >
                  {engine}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
          </label>
        ) : null}
      </div>
    );
  };

  const renderFilterPanel = (mobile = false) => (
    <form onSubmit={handleSearch} className="flex h-full flex-col">
      <div
        className={`flex shrink-0 items-center justify-between gap-3 border-b border-foreground/10 px-5 py-4 ${
          mobile ? "sticky top-0 z-20 bg-background/98 backdrop-blur-2xl" : ""
        }`}
      >
        <div>
          <p className="flex items-center gap-2.5 text-[14px] font-medium text-foreground">
            <SlidersHorizontal className="h-4 w-4 text-foreground/60" />
            {isUa ? "Фільтри" : "Filters"}
            {activeFilterCount > 0 ? (
              <span className="rounded-[3px] bg-foreground px-1.5 py-0.5 font-mono text-[10px] leading-none tracking-normal text-background">
                {activeFilterCount}
              </span>
            ) : null}
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
            className="h-8 shrink-0 rounded-[3px] px-2 text-[12px] text-foreground/60 underline-offset-4 transition hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-30 disabled:no-underline"
          >
            {isUa ? "Скинути все" : "Reset all"}
          </button>
        )}
      </div>

      <SmartScrollArea className="flex min-h-0 flex-1 scroll-pb-24 flex-col gap-5 overflow-y-auto px-5 py-5 [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-foreground/20 hover:[&::-webkit-scrollbar-thumb]:bg-foreground/35">
        {mobile ? (
          <section className="order-0 space-y-3 border-b border-foreground/10 pb-5">
            <h3 className="text-[13px] font-medium text-foreground">
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
            {hasVehicleModel ? (
              <div className="border-t border-foreground/10 pt-3">
                <p className="mb-2 text-[9px] font-medium uppercase tracking-[0.16em] text-foreground/50">
                  {isUa ? "Точна сумісність" : "Exact compatibility"}
                </p>
                {renderStandardCompatibilityFields(false, false)}
              </div>
            ) : null}
          </section>
        ) : null}

        {!mobile ? (
          <section className="order-0 rounded-[4px] border border-foreground/10 bg-foreground/[0.03] p-3">
            <p className="text-[12px] text-foreground/50">
              {vehicleMode === "auto"
                ? isUa
                  ? "Ваше авто"
                  : "Your car"
                : isUa
                  ? "Ваше мото"
                  : "Your motorcycle"}
            </p>
            <div className="mt-2 flex items-center gap-2.5">
              {make ? (
                <VehicleMakeLogo make={make} />
              ) : (
                <PremiumVehicleIcon mode={vehicleMode} className="h-5 w-7 text-foreground/45" />
              )}
              <span
                className={`min-w-0 flex-1 truncate text-[12px] ${make ? "font-medium text-foreground" : "text-foreground/55"}`}
              >
                {selectedVehicleLabel || (isUa ? "Не обрано" : "Not selected")}
              </span>
              {make ? (
                <button
                  type="button"
                  onClick={() => {
                    setMake("");
                    setModel("");
                    setChassis("");
                    setRequestedYear(null);
                    setEngineFilter("");
                    setFuelFilter("");
                    setOpfGpfFilter(null);
                  }}
                  aria-label={isUa ? "Очистити вибір авто" : "Clear selected vehicle"}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] text-foreground/45 transition hover:bg-foreground/10 hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                document.querySelector("[data-vehicle-finder]")?.scrollIntoView({
                  block: "center",
                  behavior: shouldReduceMotion ? "auto" : "smooth",
                });
                setVehiclePicker("make");
              }}
              className="mt-2 text-[12px] text-foreground/70 underline-offset-4 transition hover:text-foreground hover:underline"
            >
              {make
                ? isUa
                  ? "Змінити авто"
                  : "Change vehicle"
                : isUa
                  ? "Обрати авто"
                  : "Choose vehicle"}{" "}
              →
            </button>
          </section>
        ) : null}

        {SHOW_STOCK_BADGE ? (
          <section className="order-1 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-medium text-foreground">
                {isUa ? "Наявність" : "Availability"}
              </h3>
            </div>
            <div className="grid gap-1">
              {(Object.keys(STOCK_LABELS) as StockFilter[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStockFilter(value)}
                  className={`flex min-h-9 items-center gap-2.5 rounded-[4px] border px-3 text-left text-xs font-light transition ${
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
        ) : null}

        <section className="order-4 space-y-2.5 border-t border-foreground/10 pt-5">
          <h3 className="text-[13px] font-medium text-foreground">{isUa ? "Ціна" : "Price"}</h3>
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
                  className="h-10 w-full rounded-[4px] border border-foreground/12 bg-foreground/[0.03] px-3 font-mono text-xs text-foreground outline-hidden transition placeholder:font-sans placeholder:text-foreground/35 focus:border-foreground/35 focus:bg-foreground/[0.055]"
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
                  className="h-10 w-full rounded-[4px] border border-foreground/12 bg-foreground/[0.03] px-3 font-mono text-xs text-foreground outline-hidden transition placeholder:font-sans placeholder:text-foreground/35 focus:border-foreground/35 focus:bg-foreground/[0.055]"
                />
              </label>
            </div>
            <div className="flex min-h-4 items-center justify-between gap-2 text-[10px] font-light uppercase tracking-[0.12em] text-foreground/50">
              <span>{currency}</span>
              {priceBoundsLabel ? <span className="truncate">{priceBoundsLabel}</span> : null}
            </div>
          </div>
        </section>

        <section className="order-2 space-y-2.5 border-t border-foreground/10 pt-5">
          <button
            type="button"
            onClick={() => setCategorySectionOpen((current) => !current)}
            className="flex w-full items-center justify-between text-left"
            aria-expanded={categorySectionOpen}
          >
            <span className="text-[13px] font-medium text-foreground">
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
              <label className="relative flex h-10 items-center rounded-[4px] border border-foreground/12 bg-foreground/[0.03] px-3 transition focus-within:border-foreground/30 focus-within:bg-foreground/[0.05]">
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
                  className={`flex min-h-9 w-full items-center justify-between rounded-[4px] border px-3 text-left text-xs font-light transition ${
                    !localCategory
                      ? "border-transparent bg-foreground/[0.07] font-normal text-foreground shadow-[inset_2px_0_0_0_currentColor]"
                      : "border-transparent text-foreground/65 hover:bg-foreground/[0.045] hover:text-foreground"
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
                    className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-[4px] border px-3 text-left text-xs font-light transition ${
                      localCategory === categoryName
                        ? "border-transparent bg-foreground/[0.07] font-normal text-foreground shadow-[inset_2px_0_0_0_currentColor]"
                        : "border-transparent text-foreground/65 hover:bg-foreground/[0.045] hover:text-foreground"
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
                    className="flex min-h-9 w-full items-center justify-between border-t border-foreground/8 px-3 pt-2 text-[12px] text-foreground/55 transition hover:text-foreground"
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

        <section className="order-3 space-y-2.5 border-t border-foreground/10 pt-5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setBrandSectionOpen((current) => !current)}
              className="flex min-w-0 flex-1 items-center justify-between text-left"
              aria-expanded={brandSectionOpen}
            >
              <span className="text-[13px] font-medium text-foreground">
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
              <label className="relative flex h-10 items-center rounded-[4px] border border-foreground/12 bg-foreground/[0.03] px-3 transition focus-within:border-foreground/30 focus-within:bg-foreground/[0.05]">
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
                      className={`flex min-h-10 w-full items-center gap-3 rounded-[4px] border px-3 text-left text-xs font-light transition ${
                        selected
                          ? "border-transparent bg-foreground/[0.07] font-normal text-foreground shadow-[inset_2px_0_0_0_currentColor]"
                          : "border-transparent text-foreground/65 hover:bg-foreground/[0.045] hover:text-foreground"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border ${
                          selected
                            ? "border-foreground/45 bg-foreground text-background"
                            : "border-foreground/15"
                        }`}
                      >
                        {selected ? <Check className="h-3 w-3" /> : null}
                      </span>
                      <BrandLogoTile
                        brandName={brandName}
                        logoPath={logoPath}
                        size="xs"
                        decorative
                      />
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
                    className="flex min-h-9 w-full items-center justify-between border-t border-foreground/8 px-3 pt-2 text-[12px] text-foreground/55 transition hover:text-foreground"
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

  // Keep card subtrees stable while typing or rotating the warehouse hero.
  const gridCards = useMemo(
    () =>
      visibleItems.map((item) => {
        const logoPath = getBrandLogoPath(item.brand);
        const compareAtLabel = formatItemCompareAt(item);
        const priceLabel = formatItemPrice(item);
        const wheelLike = {
          brand: item.brand,
          partNumber: item.partNumber,
          category: item.category,
        };
        const isWheelSet = isWheelForceWheel(wheelLike) || isWheelForceWheelSet(wheelLike);
        const availability =
          item.availability === undefined
            ? getShopConfirmedAvailability(item.partNumber, item.slug)
            : item.availability;
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
          <SpotlightCard
            key={item.id}
            className="group flex min-h-[360px] min-w-0 flex-col overflow-hidden rounded-[6px] border border-foreground/[0.1] bg-card/78 p-3 shadow-[0_12px_34px_rgba(0,0,0,0.055)] transition-[border-color,background-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-foreground/24 hover:bg-card hover:shadow-[0_18px_44px_rgba(0,0,0,0.09)] dark:bg-black/15 dark:shadow-none dark:hover:bg-foreground/[0.018] md:min-h-[410px] md:p-3.5"
            style={{
              contentVisibility: "auto",
              containIntrinsicSize: "410px",
              contain: "layout paint style",
            }}
          >
            <Link
              href={resolveShopCatalogProductHref(locale, item.href, item.slug)}
              prefetch={false}
              className="flex min-w-0 cursor-pointer flex-col md:flex-1"
            >
              <div className="relative mb-3 flex aspect-[1.55] items-center justify-center overflow-hidden rounded-[4px] border border-foreground/[0.07] bg-background/55 md:aspect-[1.5] dark:bg-[#090a0c]">
                <SafeProductImage
                  src={item.thumbnail}
                  fallbackSrcs={item.imageSources}
                  alt={item.name}
                  className={`h-full w-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.018] ${
                    item.brand === "Eventuri"
                      ? "p-6 mix-blend-multiply dark:mix-blend-normal md:p-7"
                      : "p-3 md:p-3.5"
                  }`}
                />
              </div>

              <div className="mb-2.5 grid grid-cols-[minmax(64px,1fr)_minmax(0,44%)] items-center gap-2">
                <div className="min-w-0 overflow-hidden">
                  <div className="flex min-h-5 min-w-0 items-center">
                    {logoPath ? (
                      <>
                        <BrandLogoTile brandName={item.brand} logoPath={logoPath} size="sm" />
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
                {showFitmentEvidence ? (
                  <div className="mt-1 truncate text-[10px] font-light text-foreground/48">
                    {vehicleLabel}
                  </div>
                ) : null}
              </div>
            </Link>

            {showFitmentEvidence ? (
              <FitmentExplanation item={item} vehicleLabel={vehicleLabel} isUa={isUa} />
            ) : null}

            <div className="mt-3 space-y-2.5 border-t border-foreground/[0.07] pt-3 md:mt-auto">
              {isB2B ? (
                <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
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
                    {isWheelSet ? (
                      <div className="mt-1 text-[9px] font-medium uppercase tracking-[0.12em] text-foreground/45">
                        {isUa
                          ? `Комплект із ${WHEELFORCE_WHEEL_SET_SIZE} дисків`
                          : `Set of ${WHEELFORCE_WHEEL_SET_SIZE} wheels`}
                      </div>
                    ) : null}
                    {!isWheelSet ? (
                      <div className="mt-1 text-[10px] font-light uppercase tracking-[0.1em] text-foreground/45">
                        {isUa ? "за одиницю" : "per unit"}
                      </div>
                    ) : null}
                  </div>
                  <ShopAvailabilityBadge
                    availability={availability}
                    locale={isUa ? "ua" : "en"}
                    compact
                  />
                </div>
              ) : (
                <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
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
                    {isWheelSet ? (
                      <div className="mt-1 text-[9px] font-medium uppercase tracking-[0.12em] text-foreground/45">
                        {isUa
                          ? `Комплект із ${WHEELFORCE_WHEEL_SET_SIZE} дисків`
                          : `Set of ${WHEELFORCE_WHEEL_SET_SIZE} wheels`}
                      </div>
                    ) : null}
                  </div>
                  <ShopAvailabilityBadge
                    availability={availability}
                    locale={isUa ? "ua" : "en"}
                    compact
                  />
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

              <StockCardCartControl item={item} locale={locale as string} isUa={isUa} />
            </div>
          </SpotlightCard>
        );
      }),
    [
      visibleItems,
      formatItemCompareAt,
      formatItemPrice,
      make,
      model,
      chassis,
      showFitmentEvidence,
      isUa,
      isB2B,
      vehicleMode,
      locale,
    ]
  );

  // Search sits directly under the vehicle finder.
  const searchBoxNode = (
    <div
      ref={searchBoxRef}
      className="relative z-50"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          closeSuggestions();
        }
      }}
    >
      <div className="flex min-h-12 items-stretch rounded-[4px] border border-foreground/20 bg-transparent transition focus-within:border-foreground/60 sm:min-h-[54px]">
        <label className="relative flex min-w-0 flex-1 items-center pl-3 sm:pl-4">
          <Search className="h-5 w-5 shrink-0 text-foreground/55" />
          <span className="sr-only">{isUa ? "Пошук по каталогу" : "Search the catalog"}</span>
          <input
            ref={searchInputRef}
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
              selectedVehicleLabel
                ? isUa
                  ? `Пошук серед товарів для ${selectedVehicleLabel}: назва, бренд, артикул`
                  : `Search parts for ${selectedVehicleLabel}: name, brand, SKU`
                : isUa
                  ? "Пошук: бренд, SKU, авто"
                  : "Search: brand, SKU, product, or vehicle"
            }
            role="combobox"
            aria-expanded={suggestionsOpen}
            aria-controls="stock-search-suggestions"
            aria-activedescendant={
              activeSuggestionIndex >= 0 ? `stock-suggestion-${activeSuggestionIndex}` : undefined
            }
            className="h-11 min-w-0 flex-1 truncate bg-transparent px-2 text-[14px] text-foreground outline-hidden placeholder:text-foreground/50 sm:h-12 sm:px-3 sm:text-[15px]"
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
          ) : (
            <kbd
              aria-hidden="true"
              className="mr-1 hidden h-6 min-w-6 items-center justify-center rounded-[2px] border border-foreground/25 px-1.5 font-mono text-[11px] text-foreground/55 lg:flex"
            >
              /
            </kbd>
          )}
        </label>
        <button
          type="button"
          onClick={() => {
            closeSuggestions();
            handleSearch();
          }}
          className="m-1.5 flex shrink-0 items-center gap-2 rounded-[3px] bg-primary px-4 text-[12px] font-medium text-primary-foreground transition hover:brightness-110 dark:bg-white dark:text-black sm:px-8"
        >
          <Search className="h-4 w-4 sm:hidden" />
          <span className="hidden sm:inline">{isUa ? "Знайти" : "Search"}</span>
        </button>
      </div>

      <AnimatePresence>
        {suggestionsOpen && query.trim().length >= 2 ? (
          <motion.div
            id="stock-search-suggestions"
            role="listbox"
            initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="absolute left-0 right-0 top-[calc(100%+6px)] max-h-[min(420px,65dvh)] overflow-y-auto border border-foreground/15 bg-popover/98 p-1.5 text-popover-foreground shadow-[0_24px_70px_rgba(0,0,0,0.16)] backdrop-blur-2xl [scrollbar-width:thin] dark:border-white/16 dark:bg-[#090a0c]/98 dark:shadow-[0_24px_70px_rgba(0,0,0,0.72)]"
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
                        {suggestion.type === "product" ? suggestion.name : suggestion.label}
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
  );

  if (isInitialCatalogLoading) return <CatalogLoadingShell />;

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background text-foreground selection:bg-foreground/20">
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
                id="catalog-mobile-filters"
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
                  {makesError ? (
                    <div
                      className="py-16 text-center text-sm font-light text-foreground/45"
                      role="status"
                    >
                      {isUa ? "Не вдалося завантажити марки" : "Makes unavailable"}
                    </div>
                  ) : visibleVehicleMakes.length > 0 ? (
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

      <div className="relative w-full max-w-none px-3 pb-32 pt-8 sm:px-5 lg:px-6 2xl:px-8">
        <h1 className="sr-only">{isUa ? "Каталог товарів" : "Product catalog"}</h1>
        {/* Desktop: filters own the whole left column from the top of the page. */}
        <div className="lg:grid lg:grid-cols-[288px_minmax(0,1fr)] lg:items-start lg:gap-5 xl:grid-cols-[304px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside
            aria-label={isUa ? "Фільтри каталогу" : "Catalog filters"}
            className="hidden lg:sticky lg:top-24 lg:block"
          >
            <div className="h-[calc(100dvh-7rem)] overflow-hidden rounded-[6px] border border-foreground/12 bg-card shadow-[0_16px_42px_rgba(0,0,0,0.06)] dark:border-white/12 dark:bg-[#08090b] dark:shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
              {renderFilterPanel()}
            </div>
          </aside>
          <div className="min-w-0">
            {showWarehouseHero ? (
              <section
                ref={heroSectionRef}
                onMouseEnter={() => setHeroPaused(true)}
                onMouseLeave={() => setHeroPaused(false)}
                onFocusCapture={() => setHeroPaused(true)}
                onBlurCapture={() => setHeroPaused(false)}
                aria-roledescription="carousel"
                aria-label={isUa ? "Товари в наявності" : "Products in stock"}
                className="@container relative z-30 isolate mx-2 overflow-hidden rounded-[6px] border border-black/10 bg-[#efebe4] text-[#11110f] dark:border-white/10 dark:bg-[#08090b] dark:text-white sm:mx-0"
              >
                <style>
                  {
                    "@keyframes catalog-hero-progress{from{transform:scaleX(0)}to{transform:scaleX(1)}}"
                  }
                </style>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_45%_90%_at_14%_50%,rgba(255,255,255,0.75),transparent_70%)] dark:bg-[radial-gradient(ellipse_45%_90%_at_14%_50%,rgba(198,166,87,0.09),transparent_70%)]"
                />
                {activeHeroProduct ? (
                  <div className="relative z-10 grid grid-cols-[104px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 p-3 @xl:grid-cols-[176px_minmax(0,1fr)] @xl:gap-x-5 @xl:p-4 @3xl:grid-cols-[208px_minmax(0,1fr)_196px] @3xl:gap-x-7">
                    <motion.div
                      key={`hero-image-${activeHeroProduct.id}`}
                      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <GlareHover
                        disabled={Boolean(shouldReduceMotion)}
                        className="aspect-[16/10] w-full rounded-[4px] bg-[radial-gradient(circle_at_50%_42%,#f6f3ec_0%,#e0dbd0_78%,#cfc9bd_100%)] ring-1 ring-black/10 dark:ring-white/10"
                      >
                        <Image
                          src={
                            resolveShopWarehouseHeroImage(
                              activeHeroProduct.partNumber,
                              activeHeroProduct.thumbnail
                            )!
                          }
                          alt={
                            getCatalogProductPresentation(activeHeroProduct, isUa ? "ua" : "en")
                              .title
                          }
                          fill
                          priority={heroProductIndex === 0}
                          quality={80}
                          sizes="(min-width: 1024px) 208px, (min-width: 640px) 176px, 104px"
                          className="object-contain object-center p-2 mix-blend-multiply contrast-[1.04] @xl:p-3"
                        />
                      </GlareHover>
                    </motion.div>

                    <motion.div
                      key={`hero-copy-${activeHeroProduct.id}`}
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      className="min-w-0"
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <Link
                          href={buildShopStorefrontBrandPath(
                            isUa ? "ua" : "en",
                            activeHeroProduct.brand
                          )}
                          className="text-[11px] font-semibold uppercase tracking-[0.18em] underline-offset-4 hover:underline"
                        >
                          <span className="dark:hidden">
                            <ShinyText
                              text={activeHeroProduct.brand}
                              color="#8f6f24"
                              shineColor="#e2c472"
                              disabled={Boolean(shouldReduceMotion)}
                            />
                          </span>
                          <span className="hidden dark:inline">
                            <ShinyText
                              text={activeHeroProduct.brand}
                              color="#c6a657"
                              shineColor="#fff3cf"
                              disabled={Boolean(shouldReduceMotion)}
                            />
                          </span>
                        </Link>
                        <span className="inline-flex items-center gap-1.5 rounded-[3px] border border-emerald-600/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-300">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:hidden" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          </span>
                          {isUa ? "В наявності" : "In stock"}
                        </span>
                      </div>
                      <Link
                        href={resolveShopCatalogProductHref(
                          locale,
                          activeHeroProduct.href,
                          activeHeroProduct.slug
                        )}
                        className="mt-1.5 line-clamp-2 block text-[14px] font-light leading-snug tracking-[-0.01em] transition hover:opacity-80 @xl:text-[17px] @3xl:text-[19px]"
                      >
                        {getCatalogProductPresentation(activeHeroProduct, isUa ? "ua" : "en").title}
                      </Link>
                      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        <span className="text-[16px] font-light tracking-[-0.02em] @xl:text-[19px]">
                          {formatItemPrice(activeHeroProduct)}
                        </span>
                        <span className="text-[12px] text-black/50 dark:text-white/50">
                          {isUa ? "готово до відправлення" : "ready to ship"}
                        </span>
                      </div>
                    </motion.div>

                    <div className="col-span-2 flex items-center gap-2 @3xl:col-span-1 @3xl:flex-col @3xl:items-stretch @3xl:gap-2.5">
                      <Link
                        href={resolveShopCatalogProductHref(
                          locale,
                          activeHeroProduct.href,
                          activeHeroProduct.slug
                        )}
                        className="group flex h-9 flex-1 items-center justify-between gap-4 rounded-[4px] bg-foreground px-4 text-[12px] font-medium text-background transition hover:opacity-90 @3xl:flex-none"
                      >
                        {isUa ? "Детальніше" : "View product"}
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] tabular-nums text-black/50 dark:text-white/50">
                          {String(heroProducts.length ? heroProductIndex + 1 : 0).padStart(2, "0")}/
                          {String(heroProducts.length).padStart(2, "0")}
                        </span>
                        <span
                          aria-hidden="true"
                          className="relative hidden h-px flex-1 overflow-hidden bg-black/15 dark:bg-white/15 @3xl:block"
                        >
                          <span
                            key={`hero-progress-${heroProductIndex}`}
                            className="absolute inset-0 origin-left bg-foreground"
                            style={
                              shouldReduceMotion
                                ? { transform: "scaleX(1)" }
                                : {
                                    animation: "catalog-hero-progress 7s linear forwards",
                                    animationPlayState: heroPaused ? "paused" : "running",
                                  }
                            }
                          />
                        </span>
                        <button
                          type="button"
                          aria-label={isUa ? "Попередній товар" : "Previous product"}
                          disabled={heroProducts.length < 2}
                          onClick={() =>
                            setHeroProductIndex(
                              (current) => (current - 1 + heroProducts.length) % heroProducts.length
                            )
                          }
                          className="grid h-9 w-9 place-items-center rounded-[4px] border border-black/15 text-black/70 transition hover:border-black/50 hover:text-black disabled:opacity-25 dark:border-white/20 dark:text-white/75 dark:hover:border-white/60 dark:hover:text-white"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={isUa ? "Наступний товар" : "Next product"}
                          disabled={heroProducts.length < 2}
                          onClick={() =>
                            setHeroProductIndex((current) => (current + 1) % heroProducts.length)
                          }
                          className="grid h-9 w-9 place-items-center rounded-[4px] border border-black/15 text-black/70 transition hover:border-black/50 hover:text-black disabled:opacity-25 dark:border-white/20 dark:text-white/75 dark:hover:border-white/60 dark:hover:text-white"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            <section
              aria-label={
                isUa
                  ? vehicleMode === "auto"
                    ? "Пошук і підбір за авто"
                    : "Пошук і підбір за мото"
                  : "Search and vehicle finder"
              }
              className="relative z-40 mx-2 mt-3 rounded-[6px] border border-foreground/10 bg-card dark:bg-[#08090b] sm:mx-0"
            >
              <div data-vehicle-finder className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                    {renderInlineVehicleFinder()}
                  </div>
                  <div
                    className="grid h-9 w-full grid-cols-2 gap-0.5 rounded-[4px] border border-foreground/12 p-0.5 sm:w-[200px]"
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
                          className={`flex items-center justify-center gap-2 rounded-[3px] text-[12px] transition ${
                            selected
                              ? "bg-foreground text-background"
                              : "text-foreground/55 hover:text-foreground"
                          }`}
                        >
                          <PremiumVehicleIcon mode={mode} className="h-4 w-6" />
                          {mode === "auto" ? (isUa ? "Авто" : "Car") : isUa ? "Мото" : "Moto"}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {hasVehicleModel ? (
                  <div className="mt-3 grid gap-2 lg:grid-cols-3">
                    {renderStandardCompatibilityFields(true, false)}
                  </div>
                ) : null}
              </div>

              <div className="border-t border-foreground/10 p-3 sm:p-4">{searchBoxNode}</div>
            </section>

            <div className="mb-3" />

            <div id="catalog-results" className="scroll-mt-24">
              <div className="min-w-0">
                <div className="mb-4 rounded-[6px] border border-foreground/10 bg-card p-3 shadow-[0_16px_42px_rgba(0,0,0,0.075)] dark:bg-[#08090b] dark:shadow-[0_12px_30px_rgba(0,0,0,0.24)] sm:mb-4 sm:p-4">
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
                          {isInitialCatalogLoading ? (
                            isUa ? (
                              "Завантаження…"
                            ) : (
                              "Loading…"
                            )
                          ) : (
                            <>
                              <CountUp
                                to={totalItems}
                                locale={isUa ? "uk-UA" : "en-US"}
                                disabled={Boolean(shouldReduceMotion)}
                              />{" "}
                              {isUa
                                ? getUkrainianPlural(totalItems, "товар", "товари", "товарів")
                                : "products"}
                              {totalPages > 1
                                ? ` / ${isUa ? "сторінка" : "page"} ${page}/${totalPages}`
                                : ""}
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] lg:grid-cols-[minmax(0,1fr)_auto_auto] xl:flex xl:w-auto xl:flex-wrap">
                      <button
                        type="button"
                        onClick={() => setMobileFiltersOpen(true)}
                        data-catalog-filter-trigger
                        aria-controls="catalog-mobile-filters"
                        aria-expanded={mobileFiltersOpen}
                        className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-foreground/15 bg-foreground/[0.04] px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground transition hover:border-foreground/35 sm:h-10 lg:hidden"
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                        {isUa ? "Фільтри" : "Filters"}
                        {activeFilterCount > 0 ? (
                          <span className="font-mono text-foreground">{activeFilterCount}</span>
                        ) : null}
                      </button>

                      <div className="order-3 col-span-3 flex min-w-0 flex-wrap items-center gap-2 sm:order-none sm:col-span-1 xl:flex-nowrap">
                        <div
                          role="radiogroup"
                          aria-label={isUa ? "Наявність" : "Availability"}
                          className="grid h-9 w-full min-w-0 basis-full grid-cols-[0.7fr_1fr_1.4fr] gap-0.5 rounded-[6px] border border-foreground/15 bg-foreground/[0.035] p-0.5 sm:h-10 xl:flex xl:h-11 xl:w-auto xl:basis-auto xl:flex-none"
                        >
                          {(Object.keys(STOCK_LABELS) as StockFilter[]).map((value) => {
                            const selected = stockFilter === value;
                            return (
                              <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                onClick={() => setStockFilter(value)}
                                className={`flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[4px] px-2 text-[11px] font-medium transition sm:text-xs xl:px-4 xl:text-[13px] ${
                                  selected
                                    ? "bg-foreground text-background shadow-sm"
                                    : "text-foreground/60 hover:bg-foreground/[0.07] hover:text-foreground"
                                }`}
                              >
                                {value !== "all" ? (
                                  <span
                                    aria-hidden="true"
                                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                      value === "inStock" ? "bg-emerald-500" : "bg-amber-500"
                                    }`}
                                  />
                                ) : null}
                                <span className="xl:overflow-visible truncate xl:text-clip">
                                  {isUa ? STOCK_LABELS[value].ua : STOCK_LABELS[value].en}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        <label className="relative h-9 min-w-0 flex-1 sm:h-10 xl:w-[190px] xl:flex-none">
                          <span className="sr-only">{isUa ? "Сортування" : "Sort"}</span>
                          <select
                            value={sortOrder}
                            onChange={(event) => setSortOrder(event.target.value as StockSort)}
                            className="h-9 w-full min-w-0 appearance-none truncate rounded-[8px] border border-foreground/15 bg-foreground/[0.035] pl-3 pr-8 text-xs font-normal text-foreground/80 outline-hidden transition hover:border-foreground/30 focus:border-foreground/45 sm:h-10 sm:pr-9"
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
                      </div>

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

                  {hasActiveFilters &&
                  (query.trim() ||
                    vehicleMode === "moto" ||
                    selectedBrands.length > 0 ||
                    localCategory ||
                    productTypeFilter ||
                    requestedYear ||
                    engineFilter.trim() ||
                    fuelFilter ||
                    opfGpfFilter ||
                    productKindFilter ||
                    stockFilter !== "all" ||
                    hasPriceFilter) ? (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-foreground/10 pt-3">
                      {query.trim() ? (
                        <button
                          type="button"
                          onClick={() => setQuery("")}
                          className="inline-flex min-h-8 items-center gap-2 rounded-[4px] border border-foreground/15 bg-foreground/[0.04] px-3 text-[11px] text-foreground/75 transition hover:border-foreground/35 hover:text-foreground"
                        >
                          {isUa ? `Пошук: ${query.trim()}` : `Search: ${query.trim()}`}
                          <X className="h-3.5 w-3.5 text-foreground/45" />
                        </button>
                      ) : null}
                      {vehicleMode === "moto" ? (
                        <button
                          type="button"
                          onClick={() => handleVehicleModeChange("auto")}
                          className="inline-flex min-h-8 items-center gap-2 rounded-[4px] border border-foreground/12 bg-foreground/[0.03] px-3 text-[11px] text-foreground/70 transition hover:border-foreground/25 hover:text-foreground"
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
                          className={`inline-flex min-h-8 items-center gap-2 rounded-[4px] border px-3 text-[11px] text-foreground/70 transition hover:border-foreground/25 hover:text-foreground ${
                            normalizeBrandLogoName(brandName).includes("stopflex")
                              ? "border-[#e3262b]/30 bg-[#e3262b]/[0.06]"
                              : "border-foreground/12 bg-foreground/[0.03]"
                          }`}
                        >
                          {normalizeBrandLogoName(brandName).includes("stopflex") ? (
                            <BrandLogoTile
                              brandName={brandName}
                              logoPath={getBrandLogoPath(brandName)}
                              size="xs"
                              decorative
                            />
                          ) : null}
                          <span>{isUa ? `Бренд: ${brandName}` : `Brand: ${brandName}`}</span>
                          <X className="h-3.5 w-3.5 text-foreground/45" />
                        </button>
                      ))}
                      {localCategory ? (
                        <button
                          type="button"
                          onClick={() => setLocalCategory("")}
                          className="inline-flex min-h-8 items-center gap-2 rounded-[4px] border border-foreground/12 bg-foreground/[0.03] px-3 text-[11px] text-foreground/70 transition hover:border-foreground/25 hover:text-foreground"
                        >
                          {isUa ? `Група: ${localCategoryLabel}` : `Group: ${localCategoryLabel}`}
                          <X className="h-3.5 w-3.5 text-foreground/45" />
                        </button>
                      ) : null}
                      {productTypeFilter ? (
                        <button
                          type="button"
                          onClick={() => setProductTypeFilter("")}
                          className="inline-flex min-h-8 items-center gap-2 rounded-[4px] border border-foreground/12 bg-foreground/[0.03] px-3 text-[11px] text-foreground/70 transition hover:border-foreground/25 hover:text-foreground"
                        >
                          {isUa ? `Тип: ${productTypeFilter}` : `Type: ${productTypeFilter}`}
                          <X className="h-3.5 w-3.5 text-foreground/45" />
                        </button>
                      ) : null}
                      {requestedYear ? (
                        <button
                          type="button"
                          onClick={() => setRequestedYear(null)}
                          className="inline-flex min-h-8 items-center gap-2 rounded-[4px] border border-foreground/12 bg-foreground/[0.03] px-3 text-[11px] text-foreground/70 transition hover:border-foreground/25 hover:text-foreground"
                        >
                          {isUa ? `Рік: ${requestedYear}` : `Year: ${requestedYear}`}
                          <X className="h-3.5 w-3.5 text-foreground/45" />
                        </button>
                      ) : null}
                      {engineFilter.trim() ? (
                        <button
                          type="button"
                          onClick={() => setEngineFilter("")}
                          className="inline-flex min-h-8 items-center gap-2 rounded-[4px] border border-foreground/12 bg-foreground/[0.03] px-3 text-[11px] text-foreground/70 transition hover:border-foreground/25 hover:text-foreground"
                        >
                          {isUa
                            ? `Двигун: ${engineFilter.trim()}`
                            : `Engine: ${engineFilter.trim()}`}
                          <X className="h-3.5 w-3.5 text-foreground/45" />
                        </button>
                      ) : null}
                      {fuelFilter ? (
                        <button
                          type="button"
                          onClick={() => setFuelFilter("")}
                          className="inline-flex min-h-8 items-center gap-2 rounded-[4px] border border-foreground/12 bg-foreground/[0.03] px-3 text-[11px] text-foreground/70 transition hover:border-foreground/25 hover:text-foreground"
                        >
                          {isUa ? "Паливо: " : "Fuel: "}
                          {FUEL_OPTIONS.find((option) => option.value === fuelFilter)?.[
                            isUa ? "ua" : "en"
                          ] ?? fuelFilter}
                          <X className="h-3.5 w-3.5 text-foreground/45" />
                        </button>
                      ) : null}
                      {opfGpfFilter ? (
                        <button
                          type="button"
                          onClick={() => setOpfGpfFilter(null)}
                          className="inline-flex min-h-8 items-center gap-2 rounded-[4px] border border-foreground/12 bg-foreground/[0.03] px-3 text-[11px] text-foreground/70 transition hover:border-foreground/25 hover:text-foreground"
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
                          className="inline-flex min-h-8 items-center gap-2 rounded-[4px] border border-foreground/12 bg-foreground/[0.03] px-3 text-[11px] text-foreground/70 transition hover:border-foreground/25 hover:text-foreground"
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
                          className="inline-flex min-h-8 items-center gap-2 rounded-[4px] border border-foreground/12 bg-foreground/[0.03] px-3 text-[11px] text-foreground/70 transition hover:border-foreground/25 hover:text-foreground"
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
                          className="inline-flex min-h-8 items-center gap-2 rounded-[4px] border border-foreground/12 bg-foreground/[0.03] px-3 text-[11px] text-foreground/70 transition hover:border-foreground/25 hover:text-foreground"
                        >
                          {priceFilterLabel}
                          <X className="h-3.5 w-3.5 text-foreground/45" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="inline-flex min-h-8 items-center rounded-[4px] border border-foreground/12 bg-foreground/[0.03] px-3 text-[12px] text-foreground/60 lg:hidden transition hover:border-foreground/25 hover:bg-foreground/[0.06] hover:text-foreground"
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

                {correctedQuery && !loading && (
                  <p role="status" className="mb-4 text-sm text-foreground/65">
                    {isUa ? "Показано результати для" : "Showing results for"} «{correctedQuery}»
                  </p>
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

                <div
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  className="min-h-8 text-sm text-foreground/65"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="h-3 w-3 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin"
                      />
                      {isUa
                        ? "Підбираємо товари за вашими фільтрами…"
                        : "Finding products for your filters…"}
                    </span>
                  ) : null}
                </div>
                {error && items.length === 0 ? null : loading &&
                  items.length === 0 ? null : !hasSearched ? (
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
                  <div className="rounded-[12px] border border-foreground/10 bg-foreground/[0.014] px-4 py-20 text-center shadow-[0_12px_30px_rgba(0,0,0,0.07)] backdrop-blur-xl dark:bg-white/[0.014] dark:shadow-[0_12px_30px_rgba(0,0,0,0.22)] sm:px-8 sm:py-24">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-foreground/[0.035] ring-1 ring-foreground/10">
                      <Package className="h-7 w-7 text-foreground/55 dark:text-foreground/30" />
                    </div>
                    <h3 className="mb-3 text-xl font-light tracking-wide text-foreground">
                      {isUa ? "Точних збігів не знайдено" : "No exact matches found"}
                    </h3>
                    <p className="mx-auto mb-6 max-w-xl px-2 text-sm font-light leading-relaxed text-foreground/60 dark:text-foreground/40">
                      {isUa
                        ? "Спробуйте послабити один параметр. Ми збережемо ваш пошук і покажемо найближчі варіанти."
                        : "Try relaxing one parameter. We will keep your search and show the closest options."}
                    </p>
                    {emptyStateActions.length > 0 ? (
                      <div className="mx-auto mb-4 flex max-w-2xl flex-wrap justify-center gap-2">
                        {emptyStateActions.map((action) => (
                          <button
                            key={action.key}
                            type="button"
                            onClick={action.run}
                            className="inline-flex min-h-9 items-center rounded-[7px] border border-foreground/15 bg-foreground/[0.035] px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground/70 transition hover:border-foreground/35 hover:bg-foreground/[0.07] hover:text-foreground"
                          >
                            {isUa ? action.ua : action.en}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="inline-flex items-center gap-2 rounded-[7px] border border-foreground bg-foreground px-6 py-3 text-[10px] font-semibold uppercase tracking-widest text-background transition hover:bg-transparent hover:text-foreground"
                    >
                      <X className="h-3 w-3" /> {isUa ? "Скинути все" : "Clear all"}
                    </button>
                  </div>
                ) : (
                  <>
                    {viewMode === "grid" ? (
                      /* Product Grid — full width */
                      <motion.div
                        key={`${page}-${sortOrder}-${viewMode}`}
                        initial={
                          serverRenderedInitialPage.current || shouldReduceMotion
                            ? false
                            : { opacity: 0 }
                        }
                        animate={{ opacity: loading ? 0.45 : 1 }}
                        transition={{ duration: 0.15 }}
                        aria-busy={loading}
                        className={`grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3 [@media(min-width:1900px)]:grid-cols-4 [@media(min-width:2400px)]:grid-cols-5 ${loading ? "pointer-events-none" : ""}`}
                      >
                        {gridCards}
                      </motion.div>
                    ) : (
                      /* Premium marketplace table/list layout */
                      <div
                        aria-busy={loading}
                        className={`space-y-4 transition-opacity duration-150 ${loading ? "pointer-events-none opacity-45" : ""}`}
                      >
                        {/* Desktop View */}
                        <div className="hidden w-full overflow-hidden rounded-none border border-foreground/10 bg-foreground/[0.014] shadow-[0_12px_28px_rgba(0,0,0,0.07)] backdrop-blur-xl dark:bg-white/[0.014] dark:shadow-[0_12px_28px_rgba(0,0,0,0.22)] xl:block">
                          {/* Table Header */}
                          <div className="grid grid-cols-[80px_140px_1fr_120px_160px_160px] items-center gap-4 border-b border-foreground/10 px-6 py-4 text-[10px] font-light uppercase tracking-[0.18em] text-foreground/45">
                            <div>{isUa ? "Фото" : "Image"}</div>
                            <div>{isUa ? "Бренд / Артикул" : "Brand / SKU"}</div>
                            <div>{isUa ? "Назва деталі" : "Product Name"}</div>
                            <div className="text-center">
                              {SHOW_STOCK_BADGE
                                ? isUa
                                  ? "Наявність"
                                  : "Availability"
                                : isUa
                                  ? "Сумісність"
                                  : "Fitment"}
                            </div>
                            <div className="text-right">
                              {isB2B
                                ? isUa
                                  ? "РРЦ / Ціна"
                                  : "MSRP / Price"
                                : isUa
                                  ? "Ціна"
                                  : "Price"}
                            </div>
                            <div className="text-right">{isUa ? "Дія" : "Action"}</div>
                          </div>
                          {/* Table Rows */}
                          <div className="divide-y divide-foreground/5">
                            {visibleItems.map((item) => {
                              const logoPath = getBrandLogoPath(item.brand);
                              const compareAtLabel = formatItemCompareAt(item);
                              const priceLabel = formatItemPrice(item);
                              const wheelLike = {
                                brand: item.brand,
                                partNumber: item.partNumber,
                                category: item.category,
                              };
                              const isWheelSet =
                                isWheelForceWheel(wheelLike) || isWheelForceWheelSet(wheelLike);

                              return (
                                <div
                                  key={item.id}
                                  className="grid grid-cols-[80px_140px_1fr_120px_160px_160px] items-center gap-4 px-6 py-4 transition-all duration-300 hover:bg-foreground/[0.025]"
                                >
                                  {/* Thumbnail Image */}
                                  <div className="w-14 h-14 rounded-none bg-foreground/[0.035] flex items-center justify-center overflow-hidden border border-foreground/8">
                                    <SafeProductImage
                                      src={item.thumbnail}
                                      fallbackSrcs={item.imageSources}
                                      alt={item.name}
                                      className={`w-full h-full object-contain p-2 hover:scale-110 transition-transform duration-500 ${
                                        item.brand === "Eventuri"
                                          ? "mix-blend-multiply dark:mix-blend-normal"
                                          : ""
                                      }`}
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
                                      href={resolveShopCatalogProductHref(
                                        locale,
                                        item.href,
                                        item.slug
                                      )}
                                      prefetch={false}
                                      className="block truncate text-sm font-light text-foreground transition-colors hover:text-foreground"
                                      title={item.name}
                                    >
                                      {item.name}
                                    </Link>
                                  </div>

                                  {/* Stock Status & Fitment */}
                                  <div className="flex flex-col items-center justify-center gap-1.5">
                                    {item.availability ? (
                                      <ShopAvailabilityBadge
                                        availability={item.availability}
                                        locale={isUa ? "ua" : "en"}
                                        compact
                                      />
                                    ) : SHOW_STOCK_BADGE ? (
                                      <span className="text-center text-[9px] font-light uppercase tracking-widest text-foreground/45">
                                        {item.inStock
                                          ? isUa
                                            ? "В наявності"
                                            : "In stock"
                                          : isUa
                                            ? "Під замовлення"
                                            : "Pre-order"}
                                      </span>
                                    ) : null}
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
                                        {isWheelSet ? (
                                          <span className="ml-2 text-[9px] uppercase tracking-wider text-foreground/45">
                                            {isUa ? "Комплект із 4 дисків" : "Set of 4 wheels"}
                                          </span>
                                        ) : null}
                                      </div>
                                    ) : (
                                      <div
                                        className="font-mono text-base text-foreground"
                                        suppressHydrationWarning={true}
                                      >
                                        {priceLabel}
                                      </div>
                                    )}
                                    {isWheelSet ? (
                                      <div className="text-[9px] uppercase tracking-wider text-foreground/45">
                                        {isUa ? "Комплект із 4 дисків" : "Set of 4 wheels"}
                                      </div>
                                    ) : null}
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
                                    ) : isWheelSet ? (
                                      <Link
                                        href={resolveShopCatalogProductHref(
                                          locale,
                                          item.href,
                                          item.slug
                                        )}
                                        className="flex h-9 w-full items-center justify-center border border-foreground/20 bg-foreground/[0.08] px-2 text-center text-[9px] font-semibold uppercase tracking-[0.08em] text-foreground transition hover:border-foreground hover:bg-foreground hover:text-background"
                                      >
                                        {isUa ? "Обрати комплект" : "Choose set"}
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
                          {visibleItems.map((item) => {
                            const logoPath = getBrandLogoPath(item.brand);
                            const compareAtLabel = formatItemCompareAt(item);
                            const priceLabel = formatItemPrice(item);
                            const wheelLike = {
                              brand: item.brand,
                              partNumber: item.partNumber,
                              category: item.category,
                            };
                            const isWheelSet =
                              isWheelForceWheel(wheelLike) || isWheelForceWheelSet(wheelLike);

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
                                      fallbackSrcs={item.imageSources}
                                      alt={item.name}
                                      className={`w-full h-full object-contain p-1.5 ${
                                        item.brand === "Eventuri"
                                          ? "mix-blend-multiply dark:mix-blend-normal"
                                          : ""
                                      }`}
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
                                      href={resolveShopCatalogProductHref(
                                        locale,
                                        item.href,
                                        item.slug
                                      )}
                                      prefetch={false}
                                      className="line-clamp-3 text-xs font-light leading-tight text-foreground [overflow-wrap:anywhere] transition-colors hover:text-foreground"
                                    >
                                      {item.name}
                                    </Link>
                                  </div>
                                </div>

                                {showFitmentEvidence ? (
                                  <div className="mb-3">
                                    <FitmentExplanation
                                      item={item}
                                      vehicleLabel={[make, model, chassis]
                                        .filter(Boolean)
                                        .join(" ")}
                                      isUa={isUa}
                                    />
                                  </div>
                                ) : null}

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
                                    {isWheelSet ? (
                                      <div className="text-[9px] uppercase tracking-wider text-foreground/45">
                                        {isUa ? "Комплект із 4 дисків" : "Set of 4 wheels"}
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="w-32">
                                    {item.matchStatus === "requires_verification" ? (
                                      <Link
                                        href={`/${locale}/contact?source=one-ai&product=${encodeURIComponent(item.slug)}`}
                                        className="flex min-h-8 w-full items-center justify-center border border-amber-500/30 bg-amber-500/[0.06] px-2 text-center text-[8px] font-semibold uppercase tracking-[0.08em] text-foreground transition hover:border-amber-500/55"
                                      >
                                        {isUa ? "Перевірити" : "Verify fitment"}
                                      </Link>
                                    ) : isWheelSet ? (
                                      <Link
                                        href={resolveShopCatalogProductHref(
                                          locale,
                                          item.href,
                                          item.slug
                                        )}
                                        className="flex min-h-8 w-full items-center justify-center border border-foreground/20 bg-foreground/[0.08] px-2 text-center text-[8px] font-semibold uppercase tracking-[0.08em] text-foreground transition hover:border-foreground hover:bg-foreground hover:text-background"
                                      >
                                        {isUa ? "Обрати комплект" : "Choose set"}
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
                        <a
                          href={buildStockPaginationHref(locale, searchParams, page - 1)}
                          aria-disabled={page <= 1}
                          tabIndex={page <= 1 ? -1 : undefined}
                          onClick={(event) => {
                            if (page <= 1) event.preventDefault();
                          }}
                          className="rounded-none border border-foreground/10 px-4 py-2 text-[10px] uppercase tracking-widest text-foreground/60 transition-colors hover:bg-foreground/5 aria-disabled:cursor-not-allowed aria-disabled:opacity-20 dark:text-foreground/40"
                        >
                          ← {isUa ? "Назад" : "Prev"}
                        </a>
                        <span className="text-[10px] text-foreground/55 dark:text-foreground/30 uppercase tracking-widest px-4">
                          {page} / {totalPages}
                        </span>
                        <a
                          href={buildStockPaginationHref(locale, searchParams, page + 1)}
                          aria-disabled={page >= totalPages}
                          tabIndex={page >= totalPages ? -1 : undefined}
                          onClick={(event) => {
                            if (page >= totalPages) event.preventDefault();
                          }}
                          className="rounded-none border border-foreground/10 px-4 py-2 text-[10px] uppercase tracking-widest text-foreground/60 transition-colors hover:bg-foreground/5 aria-disabled:cursor-not-allowed aria-disabled:opacity-20 dark:text-foreground/40"
                        >
                          {isUa ? "Далі" : "Next"} →
                        </a>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StockCatalogClient({ initialData }: { initialData?: StockInitialData }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <StockPageContent initialData={initialData} />
    </Suspense>
  );
}
