"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
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
  Heart,
  Minus,
  Plus,
  Car,
  Ruler,
} from "lucide-react";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { useShopCurrency } from "@/components/shop/CurrencyContext";
import { motion, AnimatePresence } from "framer-motion";
import { SHOW_STOCK_BADGE } from "@/lib/shopStockUi";
import { DEFAULT_CURRENCY_RATES } from "@/lib/shopAdminSettings";
import { convertShopMoney, formatShopMoney, type ShopPriceSet } from "@/lib/shopMoneyFormat";

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
  variantId: string | null;
  turn14Id: string;
  category?: string | null;
};

type StockFilter = "all" | "inStock" | "preOrder";
type StockSort = "default" | "price_asc" | "price_desc" | "name_asc";

type FilterStats = {
  brands: Array<{ label: string; count: number }>;
  categories: Array<{ label: string; count: number }>;
  stock: {
    all: number;
    inStock: number;
    preOrder: number;
  };
};

const STOCK_LABELS: Record<StockFilter, { ua: string; en: string }> = {
  all: { ua: "Всі товари", en: "All products" },
  inStock: { ua: "В наявності", en: "In stock" },
  preOrder: { ua: "Під замовлення", en: "Pre-order" },
};

const SORT_LABELS: Record<StockSort, { ua: string; en: string }> = {
  default: { ua: "Релевантність", en: "Relevance" },
  price_asc: { ua: "Ціна: від меншої", en: "Price: low to high" },
  price_desc: { ua: "Ціна: від більшої", en: "Price: high to low" },
  name_asc: { ua: "Назва A-Z", en: "Name A-Z" },
};

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
  if (!logoPath) return null;

  const needsContrastLift = brandLogoNeedsContrastLift(brandName);
  const needsInvert = brandLogoNeedsInvert(brandName);
  const needsWideBoost = brandLogoNeedsWideBoost(brandName);
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
  const logoFilter = needsInvert
    ? "invert(1) brightness(1.08) contrast(1.1) drop-shadow(0 1px 2px rgba(0,0,0,0.65))"
    : needsContrastLift
      ? "drop-shadow(0 0 1px rgba(255,255,255,0.72)) drop-shadow(0 0 7px rgba(255,255,255,0.16)) drop-shadow(0 1px 2px rgba(0,0,0,0.7)) brightness(1.08) contrast(1.18)"
      : "drop-shadow(0 1px 2px rgba(0,0,0,0.62))";
  const imageScaleClass = needsWideBoost ? "scale-[1.1]" : "scale-100";

  return (
    <span
      className={`relative flex shrink-0 items-center justify-start overflow-visible ${sizeClass} ${className}`}
      title={brandName}
    >
      <img
        src={logoPath}
        alt={brandName}
        className={`relative ${imageSizeClass} origin-left object-contain opacity-90 transition duration-200 group-hover:opacity-100 ${imageScaleClass}`}
        style={{ filter: logoFilter }}
        onError={(event) => {
          (event.currentTarget.parentElement as HTMLElement | null)?.style.setProperty(
            "display",
            "none"
          );
        }}
      />
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

  return (
    <div className="grid grid-cols-[108px_minmax(0,1fr)] gap-2">
      <div className="grid h-10 grid-cols-[32px_1fr_32px] overflow-hidden rounded-none border border-foreground/10 bg-foreground/[0.04]">
        <button
          type="button"
          onClick={() => changeQuantity(-1)}
          className="flex items-center justify-center border-r border-foreground/10 text-foreground/45 transition hover:bg-foreground/[0.06] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
          disabled={quantity <= 1}
          aria-label={isUa ? "Зменшити кількість" : "Decrease quantity"}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-center justify-center font-mono text-xs font-semibold text-foreground">
          {quantity}
        </div>
        <button
          type="button"
          onClick={() => changeQuantity(1)}
          className="flex items-center justify-center border-l border-foreground/10 text-foreground/45 transition hover:bg-foreground/[0.06] hover:text-foreground"
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
        className="flex h-10 w-full items-center justify-center rounded-none border border-foreground bg-foreground px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-background transition hover:bg-transparent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-70"
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
      <Package className="w-6 h-6 text-foreground/10 opacity-30 shrink-0" />
    ) : (
      <Package className="w-16 h-16 text-foreground/5 opacity-20 shrink-0" />
    );
  }

  // Clean up any double slashes in URL path (except protocol)
  const cleanSrc = src.replace(/(https?:\/\/)|(\/)+/g, (match, protocol) => {
    if (protocol) return protocol;
    return "/";
  });

  return <img src={cleanSrc} alt={alt} onError={() => setError(true)} className={className} />;
}

/* ========= Search Query Sync Helpers ========= */
function removeTerm(queryStr: string, termToRemove: string): string {
  if (!termToRemove) return queryStr;
  const escaped = termToRemove.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "gi");
  const result = queryStr.replace(regex, "");
  return result.replace(/\s+/g, " ").trim();
}

function appendTerm(queryStr: string, termToAppend: string): string {
  if (!termToAppend) return queryStr;
  const escaped = termToAppend.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "i");
  if (regex.test(queryStr)) {
    return queryStr;
  }
  return queryStr ? `${queryStr} ${termToAppend}` : termToAppend;
}

/* ========= Main Stock Page ========= */
function StockPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = typeof params?.locale === "string" ? params.locale : "ua";
  const isUa = locale === "ua";

  const { data: session } = useSession();
  const user = session?.user as any;
  const isB2B = user?.group === "B2B_APPROVED";
  const { country, currency, rates } = useShopCurrency();
  const displayLocale = locale === "en" ? "en" : "ua";
  const displayRates = rates ?? DEFAULT_CURRENCY_RATES;

  // View mode state with local storage persistence
  const initialView = searchParams.get("view");
  const [viewMode, setViewMode] = useState<"grid" | "list">(
    initialView === "list" ? "list" : "grid"
  );

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

  // Multi-selection states
  const [selectedItems, setSelectedItems] = useState<StockItem[]>([]);
  const [bulkAdding, setBulkAdding] = useState(false);
  const [bulkAdded, setBulkAdded] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);

  const handleSelectAllResults = async () => {
    if (selectingAll) return;
    setSelectingAll(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (selectedBrands.length > 0) params.set("brand", selectedBrands.join(","));
      if (localCategory) params.set("category", localCategory);
      if (make) params.set("make", make);
      if (model) params.set("model", model);
      if (chassis) params.set("chassis", chassis);
      if (stockFilter !== "all") params.set("stock", stockFilter);
      if (sortOrder !== "default") params.set("sort", sortOrder);
      if (locale) params.set("locale", locale);
      if (country) params.set("country", country);
      params.set("all", "true");

      const res = await fetch(`/api/shop/stock/search?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const fetchedItems = data.data || [];
      setSelectedItems((prev) => {
        const next = [...prev];
        fetchedItems.forEach((item: any) => {
          if (!next.some((x) => x.id === item.id)) {
            next.push(item);
          }
        });
        return next;
      });
    } catch (e) {
      console.error(e);
    } finally {
      setSelectingAll(false);
    }
  };

  const handleToggleSelectItem = (item: StockItem) => {
    setSelectedItems((prev) => {
      const exists = prev.some((x) => x.id === item.id);
      if (exists) {
        return prev.filter((x) => x.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  };

  const handleBulkAddToCart = async () => {
    if (selectedItems.length === 0 || bulkAdding) return;
    setBulkAdding(true);
    try {
      const response = await fetch("/api/shop/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selectedItems.map((item) => ({
            slug: item.slug,
            variantId: item.variantId,
            quantity: 1,
          })),
        }),
      });
      if (!response.ok) throw new Error("Bulk add to cart failed");

      setBulkAdded(true);
      setTimeout(() => {
        setBulkAdded(false);
        setSelectedItems([]);
      }, 1500);

      // Trigger a page refresh or custom event so other cart elements refresh
      router.refresh();
    } catch (e: any) {
      alert(isUa ? "Не вдалося додати товари: " + e.message : "Failed to add items: " + e.message);
    } finally {
      setBulkAdding(false);
    }
  };

  const handleExportCSV = (exportItems: StockItem[]) => {
    if (exportItems.length === 0) return;

    const headers = [
      "SKU",
      "Product Name",
      `Price (${currency})`,
      "Price (USD)",
      "Price (EUR)",
      "Price (UAH)",
    ];

    const rows = exportItems.map((item) => {
      const priceSet = getItemPriceSet(item);
      const selectedPrice = convertShopMoney(priceSet, currency, displayRates);
      const usdPrice = convertShopMoney(priceSet, "USD", displayRates);
      const eurPrice = convertShopMoney(priceSet, "EUR", displayRates);
      const uahPrice = convertShopMoney(priceSet, "UAH", displayRates);

      return [
        item.partNumber,
        item.name.replace(/"/g, '""'),
        selectedPrice.toFixed(2),
        usdPrice.toFixed(2),
        eurPrice.toFixed(2),
        uahPrice.toFixed(2),
      ];
    });

    const csvString = [
      headers.join(","),
      ...rows.map((e) => e.map((val) => `"${val}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);

    const filterText =
      selectedBrands.length > 0 ? `_${selectedBrands.join("_").replace(/\s+/g, "_")}` : "_catalog";
    link.setAttribute("download", `OneCompany_Catalog${filterText}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Search state
  const initialPage = Math.max(1, Number(searchParams.get("page")) || 1);
  const initialBrands = (searchParams.get("brand") || "")
    .split(",")
    .map((brand) => brand.trim())
    .filter(Boolean);
  const initialStock = searchParams.get("stock");
  const initialSort = searchParams.get("sort");

  const initialModelRef = useRef(searchParams.get("model") || "");
  const initialChassisRef = useRef(searchParams.get("chassis") || "");
  const initialSearchRef = useRef(true);

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [hasSearched, setHasSearched] = useState(true);
  const [fallbackApplied, setFallbackApplied] = useState<"fitment" | "all" | null>(null);

  const [localCategory, setLocalCategory] = useState(searchParams.get("category") || "");
  const [localCategories, setLocalCategories] = useState<string[]>([]);
  const [localBrands, setLocalBrands] = useState<string[]>([]);
  const [filterStats, setFilterStats] = useState<FilterStats | null>(null);
  const [stockFilter, setStockFilter] = useState<StockFilter>(
    initialStock === "inStock" || initialStock === "preOrder" ? initialStock : "all"
  );
  const [sortOrder, setSortOrder] = useState<StockSort>(
    initialSort === "price_asc" || initialSort === "price_desc" || initialSort === "name_asc"
      ? initialSort
      : "default"
  );
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Vehicle fitment state
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [chassisCodes, setChassisCodes] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [submodelsLoading, setSubmodelsLoading] = useState(false);

  const [make, setMake] = useState(searchParams.get("make") || "");
  const [model, setModel] = useState("");
  const [chassis, setChassis] = useState("");

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

  // Synchronize dropdown filters to physical search query input text
  const prevFiltersRef = useRef<{
    make: string;
    model: string;
    chassis: string;
    brands: string[];
  }>({ make: "", model: "", chassis: "", brands: [] });

  const syncUrlState = useCallback(
    (searchPage: number, nextViewMode = viewMode) => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (selectedBrands.length > 0) params.set("brand", selectedBrands.join(","));
      if (localCategory) params.set("category", localCategory);
      if (make) params.set("make", make);
      if (model) params.set("model", model);
      if (chassis) params.set("chassis", chassis);
      if (stockFilter !== "all") params.set("stock", stockFilter);
      if (sortOrder !== "default") params.set("sort", sortOrder);
      if (nextViewMode !== "grid") params.set("view", nextViewMode);
      if (searchPage > 1) params.set("page", String(searchPage));

      const queryString = params.toString();
      const nextUrl = queryString
        ? `${window.location.pathname}?${queryString}`
        : window.location.pathname;
      window.history.replaceState(window.history.state, "", nextUrl);
    },
    [chassis, localCategory, make, model, query, selectedBrands, sortOrder, stockFilter, viewMode]
  );

  useEffect(() => {
    const prev = prevFiltersRef.current;
    let newQuery = query;

    // Handle brands
    const removedBrands = prev.brands.filter((b) => !selectedBrands.includes(b));
    removedBrands.forEach((b) => {
      newQuery = removeTerm(newQuery, b);
    });
    const addedBrands = selectedBrands.filter((b) => !prev.brands.includes(b));
    addedBrands.forEach((b) => {
      newQuery = appendTerm(newQuery, b);
    });

    // Handle make
    if (prev.make && prev.make !== make) {
      newQuery = removeTerm(newQuery, prev.make);
    }
    if (make && prev.make !== make) {
      newQuery = appendTerm(newQuery, make);
    }

    // Handle model
    if (prev.model && prev.model !== model) {
      newQuery = removeTerm(newQuery, prev.model);
    }
    if (model && prev.model !== model) {
      newQuery = appendTerm(newQuery, model);
    }

    // Handle chassis
    if (prev.chassis && prev.chassis !== chassis) {
      newQuery = removeTerm(newQuery, prev.chassis);
    }
    if (chassis && prev.chassis !== chassis) {
      newQuery = appendTerm(newQuery, chassis);
    }

    if (newQuery !== query) {
      setQuery(newQuery);
    }

    prevFiltersRef.current = { make, model, chassis, brands: [...selectedBrands] };
  }, [make, model, chassis, selectedBrands, query]);

  // Load initial makes and filter metadata
  useEffect(() => {
    Promise.all([
      fetch("/api/shop/stock/fitment").then((r) => r.json()),
      fetch("/api/shop/stock/search?limit=1")
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(([fitmentRes, searchRes]) => {
        setMakes(fitmentRes.data || []);
        if (searchRes?.filters) {
          setLocalCategories(searchRes.filters.categories || []);
          setLocalBrands(searchRes.filters.brands || []);
        }
      })
      .catch(() => {});
  }, []);

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
    fetch(`/api/shop/stock/fitment?make=${encodeURIComponent(make)}`)
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
      .finally(() => setModelsLoading(false));
    if (!initialModelRef.current) {
      setModel("");
      setChassis("");
    }
    setChassisCodes([]);
  }, [make]);

  // Cascading: Model → Chassis
  useEffect(() => {
    if (!make || !model) {
      setChassisCodes([]);
      setChassis("");
      return;
    }
    setSubmodelsLoading(true);
    fetch(
      `/api/shop/stock/fitment?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`
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
      .finally(() => setSubmodelsLoading(false));
    if (!initialChassisRef.current) {
      setChassis("");
    }
  }, [make, model]);

  // Search handler
  const doSearch = useCallback(
    async (searchPage = 1) => {
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
      if (stockFilter !== "all") params.set("stock", stockFilter);
      if (sortOrder !== "default") params.set("sort", sortOrder);
      if (locale) params.set("locale", locale);
      if (country) params.set("country", country);
      params.set("page", searchPage.toString());

      try {
        const res = await fetch(`/api/shop/stock/search?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setItems(data.data || []);
        setTotalPages(data.meta?.totalPages || 1);
        setTotalItems(data.meta?.totalItems || 0);
        setFallbackApplied(data.meta?.fallbackApplied || null);
        if (data.filters) {
          setLocalCategories(data.filters.categories || []);
          setLocalBrands(data.filters.brands || []);
        }
        if (data.filterStats) {
          setFilterStats(data.filterStats);
        }
        setPage(searchPage);
        syncUrlState(searchPage);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [
      query,
      selectedBrands,
      make,
      model,
      chassis,
      stockFilter,
      sortOrder,
      localCategory,
      locale,
      country,
      syncUrlState,
    ]
  );

  // Auto-search for filters and queries
  useEffect(() => {
    const searchPage = initialSearchRef.current ? initialPage : 1;
    initialSearchRef.current = false;
    const t = setTimeout(() => doSearch(searchPage), 600);
    return () => clearTimeout(t);
  }, [
    selectedBrands,
    make,
    model,
    chassis,
    query,
    stockFilter,
    sortOrder,
    localCategory,
    doSearch,
    initialPage,
  ]);

  useEffect(() => {
    syncUrlState(page, viewMode);
  }, [page, syncUrlState, viewMode]);

  function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    doSearch(1);
  }

  function handleResetFilters() {
    setMake("");
    setModel("");
    setChassis("");
    setSelectedBrands([]);
    setLocalCategory("");
    setStockFilter("all");
    setSortOrder("default");
    setQuery("");
    setHasSearched(true);
    setFallbackApplied(null);
    setTotalPages(1);
    setTotalItems(0);
    setPage(1);
  }

  const brandCountByLabel = useMemo(
    () => new Map((filterStats?.brands ?? []).map((entry) => [entry.label, entry.count])),
    [filterStats]
  );
  const categoryCountByLabel = useMemo(
    () => new Map((filterStats?.categories ?? []).map((entry) => [entry.label, entry.count])),
    [filterStats]
  );

  const hasActiveFilters =
    query.trim().length > 0 ||
    selectedBrands.length > 0 ||
    Boolean(localCategory) ||
    Boolean(make) ||
    Boolean(model) ||
    Boolean(chassis) ||
    stockFilter !== "all" ||
    sortOrder !== "default";

  const activeFilterCount =
    (query.trim() ? 1 : 0) +
    selectedBrands.length +
    (localCategory ? 1 : 0) +
    (make ? 1 : 0) +
    (model ? 1 : 0) +
    (chassis ? 1 : 0) +
    (stockFilter !== "all" ? 1 : 0) +
    (sortOrder !== "default" ? 1 : 0);

  const totalCatalogCount = filterStats?.stock.all ?? totalItems;
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

  const selectedCartTotal = selectedItems.reduce(
    (acc, item) => acc + getItemDisplayPriceAmount(item),
    0
  );
  const selectedCompareAtTotal = selectedItems.reduce(
    (acc, item) => acc + getItemCompareAtAmount(item),
    0
  );

  const allItemsOnPageSelected =
    items.length > 0 && items.every((item) => selectedItems.some((x) => x.id === item.id));

  function handleToggleSelectPage() {
    if (allItemsOnPageSelected) {
      setSelectedItems((prev) => prev.filter((x) => !items.some((item) => item.id === x.id)));
      return;
    }

    setSelectedItems((prev) => {
      const next = [...prev];
      items.forEach((item) => {
        if (!next.some((x) => x.id === item.id)) {
          next.push(item);
        }
      });
      return next;
    });
  }

  const FilterPanel = ({ mobile = false }: { mobile?: boolean }) => (
    <form onSubmit={handleSearch} className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-foreground/10 px-5 py-5">
        <div>
          <p className="text-[10px] font-light uppercase tracking-[0.24em] text-foreground/65">
            {isUa ? "Фільтри" : "Filters"}
          </p>
          <p className="mt-1 text-xs font-light text-foreground/45">
            {totalCatalogCount.toLocaleString(isUa ? "uk-UA" : "en-US")}{" "}
            {isUa ? "позицій у каталозі" : "catalog items"}
          </p>
        </div>
        {mobile ? (
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-none border border-foreground/10 bg-foreground/5 text-foreground/60 transition hover:border-foreground/25 hover:text-foreground"
            aria-label={isUa ? "Закрити фільтри" : "Close filters"}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <label className="block">
          <span className="mb-2 block text-[10px] font-light uppercase tracking-[0.22em] text-foreground/55">
            {isUa ? "Пошук" : "Search"}
          </span>
          <span className="relative flex h-11 items-center rounded-none border border-foreground/10 bg-foreground/[0.035] px-3 transition focus-within:border-foreground/35 focus-within:bg-foreground/[0.055]">
            <Search className="h-4 w-4 shrink-0 text-foreground/45" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={isUa ? "Назва, SKU або бренд" : "Name, SKU, or brand"}
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm font-light text-foreground outline-hidden placeholder:text-foreground/35"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-foreground/45 transition hover:text-foreground"
                aria-label={isUa ? "Очистити пошук" : "Clear search"}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </span>
        </label>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-light uppercase tracking-[0.22em] text-foreground/55">
              {isUa ? "Наявність" : "Availability"}
            </h3>
          </div>
          <div className="grid gap-2">
            {(Object.keys(STOCK_LABELS) as StockFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStockFilter(value)}
                className={`flex min-h-10 items-center justify-between rounded-none border px-3 text-left text-xs font-light transition ${
                  stockFilter === value
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/10 bg-foreground/[0.025] text-foreground/60 hover:border-foreground/25 hover:bg-foreground/[0.05] hover:text-foreground"
                }`}
              >
                <span>{isUa ? STOCK_LABELS[value].ua : STOCK_LABELS[value].en}</span>
                <span className="font-mono text-[10px] opacity-55">
                  {(stockCount(value) ?? 0).toLocaleString(isUa ? "uk-UA" : "en-US")}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-[10px] font-light uppercase tracking-[0.22em] text-foreground/55">
            {isUa ? "Ціна" : "Price"}
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "default" as StockSort, ua: "Релев.", en: "Relevant" },
              { value: "price_asc" as StockSort, ua: "Дешевше", en: "Low" },
              { value: "price_desc" as StockSort, ua: "Дорожче", en: "High" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={sortOrder === option.value}
                onClick={() => setSortOrder(option.value)}
                className={`min-h-9 rounded-none border px-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
                  sortOrder === option.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/10 bg-foreground/[0.025] text-foreground/50 hover:border-foreground/25 hover:bg-foreground/[0.05] hover:text-foreground"
                }`}
              >
                {isUa ? option.ua : option.en}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-[10px] font-light uppercase tracking-[0.22em] text-foreground/55">
            {isUa ? "Група товарів" : "Product group"}
          </h3>
          <div className="max-h-[150px] space-y-1 overflow-y-auto pr-1">
            <button
              type="button"
              onClick={() => setLocalCategory("")}
              className={`flex min-h-9 w-full items-center justify-between rounded-none border px-3 text-left text-xs font-light transition ${
                !localCategory
                  ? "border-foreground bg-foreground text-background"
                  : "border-transparent text-foreground/60 hover:border-foreground/10 hover:bg-foreground/[0.04] hover:text-foreground"
              }`}
            >
              <span>{isUa ? "Всі групи" : "All groups"}</span>
              <span className="font-mono text-[10px] opacity-55">
                {(filterStats?.stock.all ?? 0).toLocaleString(isUa ? "uk-UA" : "en-US")}
              </span>
            </button>
            {localCategories.map((categoryName) => (
              <button
                key={categoryName}
                type="button"
                onClick={() => setLocalCategory(categoryName)}
                className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-none border px-3 text-left text-xs font-light transition ${
                  localCategory === categoryName
                    ? "border-foreground bg-foreground text-background"
                    : "border-transparent text-foreground/60 hover:border-foreground/10 hover:bg-foreground/[0.04] hover:text-foreground"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{categoryName}</span>
                <span className="font-mono text-[10px] opacity-55">
                  {categoryCountByLabel.get(categoryName) ?? 0}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-light uppercase tracking-[0.22em] text-foreground/55">
              {isUa ? "Бренд" : "Brand"}
            </h3>
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
          <div className="max-h-[240px] space-y-1 overflow-y-auto pr-1">
            {localBrands.map((brandName) => {
              const selected = selectedBrands.includes(brandName);
              const logoPath = getBrandLogoPath(brandName);
              return (
                <button
                  key={brandName}
                  type="button"
                  onClick={() => handleToggleBrand(brandName)}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-none border px-3 text-left text-xs font-light transition ${
                    selected
                      ? "border-foreground bg-foreground text-background"
                      : "border-transparent text-foreground/60 hover:border-foreground/10 hover:bg-foreground/[0.04] hover:text-foreground"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-none border ${
                      selected
                        ? "border-background bg-background text-foreground"
                        : "border-foreground/15"
                    }`}
                  >
                    {selected ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <BrandLogoTile brandName={brandName} logoPath={logoPath} size="sm" />
                  <span className="min-w-0 flex-1 truncate">{brandName}</span>
                  <span className="font-mono text-[10px] opacity-55">
                    {brandCountByLabel.get(brandName) ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-[10px] font-light uppercase tracking-[0.22em] text-foreground/55">
            {isUa ? "Сумісність з авто" : "Vehicle fitment"}
          </h3>
          <div className="space-y-3">
            <div className="relative">
              <select
                value={make}
                onChange={(event) => {
                  initialModelRef.current = "";
                  initialChassisRef.current = "";
                  setMake(event.target.value);
                  setModel("");
                  setChassis("");
                }}
                className="h-11 w-full appearance-none rounded-none border border-foreground/10 bg-foreground/[0.035] px-3 pr-9 text-xs font-light text-foreground/75 outline-hidden transition focus:border-foreground/35"
              >
                <option value="" className="bg-[#121216]">
                  {isUa ? "Марка авто" : "Car make"}
                </option>
                {makes.map((makeName) => (
                  <option key={makeName} value={makeName} className="bg-[#121216] text-white">
                    {makeName}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/45" />
            </div>
            <div className="relative">
              <select
                value={model}
                disabled={!make || modelsLoading}
                onChange={(event) => {
                  initialChassisRef.current = "";
                  setModel(event.target.value);
                  setChassis("");
                }}
                className="h-11 w-full appearance-none rounded-none border border-foreground/10 bg-foreground/[0.035] px-3 pr-9 text-xs font-light text-foreground/75 outline-hidden transition focus:border-foreground/35 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <option value="" className="bg-[#121216]">
                  {modelsLoading
                    ? isUa
                      ? "Завантаження..."
                      : "Loading..."
                    : make
                      ? isUa
                        ? "Модель авто"
                        : "Car model"
                      : isUa
                        ? "Спочатку марка"
                        : "Select make first"}
                </option>
                {models.map((modelName) => (
                  <option key={modelName} value={modelName} className="bg-[#121216] text-white">
                    {modelName}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/45" />
            </div>
            <div className="relative">
              <select
                value={chassis}
                disabled={!model || submodelsLoading}
                onChange={(event) => setChassis(event.target.value)}
                className="h-11 w-full appearance-none rounded-none border border-foreground/10 bg-foreground/[0.035] px-3 pr-9 text-xs font-light text-foreground/75 outline-hidden transition focus:border-foreground/35 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <option value="" className="bg-[#121216]">
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
                  <option key={code} value={code} className="bg-[#121216] text-white">
                    {code}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/45" />
            </div>
          </div>
        </section>
      </div>

      <div className="border-t border-foreground/10 p-5">
        <button
          type="button"
          onClick={handleResetFilters}
          disabled={!hasActiveFilters}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-none border border-foreground/12 bg-foreground/[0.03] text-xs font-semibold uppercase tracking-[0.18em] text-foreground/60 transition hover:border-foreground/25 hover:bg-foreground/[0.06] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
        >
          <X className="h-4 w-4" />
          {isUa ? "Скинути фільтри" : "Reset filters"}
        </button>
      </div>
    </form>
  );

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground selection:bg-foreground/20 [&_*]:!rounded-none">
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent via-foreground/[0.04] to-foreground/[0.06] dark:via-black/80 dark:to-black" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.1),transparent_60%)] sm:h-64" />
      <div className="pt-20 sm:pt-24 lg:pt-28" />

      <div className="hidden">
        <div className="relative overflow-hidden rounded-none border border-foreground/10 bg-zinc-900/10 backdrop-blur-3xl p-6 sm:p-8">
          <form onSubmit={handleSearch} className="space-y-6">
            {/* Search Input Row */}
            <div className="relative flex items-center rounded-none border border-foreground/10 bg-foreground/[0.02] focus-within:border-white/40 focus-within:bg-foreground/[0.04] transition-all h-12 px-4">
              <Search className="w-5 h-5 text-zinc-500 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  isUa
                    ? "Шукати за назвою, SKU або описом..."
                    : "Search by name, SKU or description..."
                }
                className="w-full bg-transparent text-sm text-foreground placeholder-zinc-600 focus:outline-hidden px-3 tracking-wide"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="p-1 text-zinc-500 hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Active Filter Badges */}
            {(make || model || chassis || selectedBrands.length > 0 || localCategory) && (
              <div className="flex flex-wrap gap-2 pt-1 pb-3">
                {selectedBrands.map((b) => (
                  <span
                    key={b}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none border border-white/20 bg-white/5 text-white text-[10px] font-medium tracking-wide"
                  >
                    {isUa ? `Бренд: ${b}` : `Brand: ${b}`}
                    <button
                      type="button"
                      onClick={() => handleToggleBrand(b)}
                      className="hover:text-foreground transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
                {make && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none border border-white/20 bg-white/5 text-white text-[10px] font-medium tracking-wide">
                    {isUa ? `Марка: ${make}` : `Make: ${make}`}
                    <button
                      type="button"
                      onClick={() => setMake("")}
                      className="hover:text-foreground transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}
                {model && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none border border-white/20 bg-white/5 text-white text-[10px] font-medium tracking-wide">
                    {isUa ? `Модель: ${model}` : `Model: ${model}`}
                    <button
                      type="button"
                      onClick={() => setModel("")}
                      className="hover:text-foreground transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}
                {chassis && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none border border-white/20 bg-white/5 text-white text-[10px] font-medium tracking-wide">
                    {isUa ? `Кузов: ${chassis}` : `Chassis: ${chassis}`}
                    <button
                      type="button"
                      onClick={() => setChassis("")}
                      className="hover:text-foreground transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}
                {localCategory && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none border border-white/20 bg-white/5 text-white text-[10px] font-medium tracking-wide">
                    {isUa ? `Група: ${localCategory}` : `Group: ${localCategory}`}
                    <button
                      type="button"
                      onClick={() => setLocalCategory("")}
                      className="hover:text-foreground transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}
              </div>
            )}

            {/* Brand Logo Selection Grid */}
            <div className="space-y-2.5">
              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-400">
                {isUa ? "Вибір за брендом" : "Select by Brand"}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedBrands([])}
                  className={`group px-5 py-3 rounded-none text-[10px] font-bold uppercase tracking-[0.15em] transition-all duration-300 border flex items-center justify-center gap-2 cursor-pointer ${
                    selectedBrands.length === 0
                      ? "bg-white/10 border-white/35 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                      : "bg-foreground/[0.02] text-zinc-500 border-foreground/5 hover:border-foreground/15 hover:text-foreground"
                  }`}
                >
                  {isUa ? "Всі бренди" : "All Brands"}
                </button>
                {localBrands.map((b) => {
                  const logoPath = getBrandLogoPath(b);
                  const isSelected = selectedBrands.includes(b);
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => handleToggleBrand(b)}
                      className={`group px-5 py-3 rounded-none text-[10px] font-bold uppercase tracking-[0.15em] transition-all duration-300 border flex items-center gap-2.5 justify-center cursor-pointer ${
                        isSelected
                          ? "bg-white/10 border-white/35 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                          : "bg-foreground/[0.02] text-zinc-500 border-foreground/10 hover:border-foreground/20 hover:text-foreground"
                      }`}
                    >
                      <BrandLogoTile
                        brandName={b}
                        logoPath={logoPath}
                        size="md"
                        className={
                          isSelected ? "opacity-100" : "opacity-80 group-hover:opacity-100"
                        }
                      />
                      <span>{b}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vehicle Fitment Dropdowns */}
            <div className="space-y-2.5">
              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-400">
                {isUa ? "Сумісність з авто" : "Vehicle Fitment"}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Make Select */}
                <div className="relative">
                  <select
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    className="w-full bg-foreground/[0.02] hover:bg-foreground/[0.04] border border-foreground/10 focus:border-white/30 rounded-none text-xs text-zinc-400 h-11 px-4 appearance-none cursor-pointer focus:outline-hidden"
                  >
                    <option value="" className="bg-[#121216]">
                      {isUa ? "Марка авто" : "Car Make"}
                    </option>
                    {makes.map((m) => (
                      <option key={m} value={m} className="bg-[#121216] text-foreground">
                        {m}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                </div>

                {/* Model Select */}
                <div className="relative">
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    disabled={!make}
                    className="w-full bg-foreground/[0.02] hover:bg-foreground/[0.04] border border-foreground/10 focus:border-white/30 rounded-none text-xs text-zinc-400 h-11 px-4 appearance-none cursor-pointer focus:outline-hidden disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <option value="" className="bg-[#121216]">
                      {make
                        ? isUa
                          ? "Модель авто"
                          : "Car Model"
                        : isUa
                          ? "Спочатку марка"
                          : "Select Make first"}
                    </option>
                    {models.map((m) => (
                      <option key={m} value={m} className="bg-[#121216] text-foreground">
                        {m}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                </div>

                {/* Chassis Select */}
                <div className="relative">
                  <select
                    value={chassis}
                    onChange={(e) => setChassis(e.target.value)}
                    disabled={!model}
                    className="w-full bg-foreground/[0.02] hover:bg-foreground/[0.04] border border-foreground/10 focus:border-white/30 rounded-none text-xs text-zinc-400 h-11 px-4 appearance-none cursor-pointer focus:outline-hidden disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <option value="" className="bg-[#121216]">
                      {model
                        ? isUa
                          ? "Кузов / Шасі"
                          : "Chassis Code"
                        : isUa
                          ? "Спочатку модель"
                          : "Select Model first"}
                    </option>
                    {chassisCodes.map((c) => (
                      <option key={c} value={c} className="bg-[#121216] text-foreground">
                        {c}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Actions Bar Footer */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 pt-5 border-t border-foreground/5">
              {(make ||
                model ||
                chassis ||
                selectedBrands.length > 0 ||
                localCategory ||
                query) && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="w-full sm:w-auto h-11 px-6 rounded-none border border-white/12 bg-white/[0.03] hover:bg-white/[0.06] text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  {isUa ? "Скинути" : "Reset"}
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto h-11 px-10 rounded-none border border-white/20 bg-white/[0.06] text-white text-xs font-bold uppercase tracking-wider transition-all hover:bg-white/[0.1] disabled:opacity-30 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {isUa ? "Шукати" : "Search"}
              </button>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleExportCSV(items)}
                  className="w-full sm:w-auto h-11 px-6 rounded-none border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-zinc-400 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isUa ? "Експорт CSV" : "Export CSV"}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* ════ RESULTS ════ */}
      <AnimatePresence>
        {mobileFiltersOpen ? (
          <>
            <motion.button
              type="button"
              aria-label={isUa ? "Закрити фільтри" : "Close filters"}
              className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileFiltersOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-[88vw] max-w-[390px] border-r border-foreground/10 bg-background/95 shadow-[25px_0_80px_rgba(0,0,0,0.55)] backdrop-blur-3xl lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 330, damping: 34 }}
            >
              <FilterPanel mobile />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <div className="relative w-full max-w-none px-4 pb-32 sm:px-5 lg:px-6 2xl:px-8">
        <section className="mb-4 overflow-hidden rounded-none border border-foreground/10 bg-foreground/[0.02] p-5 shadow-[0_30px_60px_rgba(0,0,0,0.42)] backdrop-blur-3xl dark:bg-white/[0.02] sm:mb-8 sm:rounded-none sm:p-8 md:rounded-none">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,0.75fr)_minmax(560px,1.25fr)] xl:items-end">
            <div className="min-w-0">
              <p className="hidden text-[10px] font-light uppercase tracking-[0.3em] text-foreground/65 sm:block">
                {isUa ? "Каталог тюнінгу" : "Tuning catalog"}
              </p>
              <h1 className="text-[26px] font-extralight leading-tight tracking-tight text-foreground sm:mt-3 sm:text-5xl">
                {isUa ? "Магазин One Company" : "One Company Shop"}
              </h1>
              <div className="mt-5 hidden flex-wrap items-center gap-2 text-[10px] font-light uppercase tracking-[0.16em] text-foreground/45 sm:flex">
                <span className="rounded-none border border-foreground/10 bg-foreground/[0.04] px-3 py-1 text-foreground/65">
                  {isUa ? "В наявності" : "In stock"}{" "}
                  {(filterStats?.stock.inStock ?? 0).toLocaleString(isUa ? "uk-UA" : "en-US")}
                </span>
                <span className="rounded-none border border-foreground/10 bg-foreground/[0.04] px-3 py-1 text-foreground/65">
                  {isUa ? "Під замовлення" : "Pre-order"}{" "}
                  {(filterStats?.stock.preOrder ?? 0).toLocaleString(isUa ? "uk-UA" : "en-US")}
                </span>
                <span className="rounded-none border border-foreground/10 bg-foreground/[0.04] px-3 py-1 text-foreground/65">
                  {totalCatalogCount.toLocaleString(isUa ? "uk-UA" : "en-US")}{" "}
                  {isUa ? "товарів" : "products"}
                </span>
              </div>
            </div>

            <div className="space-y-2 sm:space-y-3">
              <label className="relative flex min-h-11 items-center rounded-none border border-foreground/10 bg-foreground/[0.035] px-2.5 transition focus-within:border-foreground/35 focus-within:bg-foreground/[0.055] sm:min-h-12 sm:px-3">
                <Search className="h-4 w-4 shrink-0 text-foreground/45" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    isUa ? "Пошук: бренд, SKU, авто" : "Search: brand, SKU, product, or vehicle"
                  }
                  className="h-11 min-w-0 flex-1 bg-transparent px-2 text-[13px] font-light text-foreground outline-hidden placeholder:text-foreground/35 sm:h-12 sm:px-3 sm:text-sm"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="text-foreground/45 transition hover:text-foreground"
                    aria-label={isUa ? "Очистити пошук" : "Clear search"}
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </label>

              <div className="grid grid-cols-3 gap-2">
                <label className="relative block">
                  <span className="sr-only">{isUa ? "Марка авто" : "Car make"}</span>
                  <select
                    value={make}
                    onChange={(event) => {
                      initialModelRef.current = "";
                      initialChassisRef.current = "";
                      setMake(event.target.value);
                      setModel("");
                      setChassis("");
                    }}
                    className="h-10 w-full appearance-none truncate rounded-none border border-foreground/10 bg-foreground/[0.035] px-2 pr-7 text-[11px] font-light text-foreground/75 outline-hidden transition focus:border-foreground/35 sm:h-11 sm:px-3 sm:pr-9 sm:text-xs"
                  >
                    <option value="" className="bg-[#121216]">
                      {isUa ? "Марка авто" : "Car make"}
                    </option>
                    {makes.map((makeName) => (
                      <option key={makeName} value={makeName} className="bg-[#121216] text-white">
                        {makeName}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/45 sm:right-3 sm:h-4 sm:w-4" />
                </label>

                <label className="relative block">
                  <span className="sr-only">{isUa ? "Модель авто" : "Car model"}</span>
                  <select
                    value={model}
                    disabled={!make || modelsLoading}
                    onChange={(event) => {
                      initialChassisRef.current = "";
                      setModel(event.target.value);
                      setChassis("");
                    }}
                    className="h-10 w-full appearance-none truncate rounded-none border border-foreground/10 bg-foreground/[0.035] px-2 pr-7 text-[11px] font-light text-foreground/75 outline-hidden transition focus:border-foreground/35 disabled:cursor-not-allowed disabled:opacity-40 sm:h-11 sm:px-3 sm:pr-9 sm:text-xs"
                  >
                    <option value="" className="bg-[#121216]">
                      {modelsLoading
                        ? isUa
                          ? "Завантаження..."
                          : "Loading..."
                        : make
                          ? isUa
                            ? "Модель авто"
                            : "Car model"
                          : isUa
                            ? "Спочатку марка"
                            : "Select make first"}
                    </option>
                    {models.map((modelName) => (
                      <option key={modelName} value={modelName} className="bg-[#121216] text-white">
                        {modelName}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/45 sm:right-3 sm:h-4 sm:w-4" />
                </label>

                <label className="relative block">
                  <span className="sr-only">{isUa ? "Кузов / шасі" : "Chassis"}</span>
                  <select
                    value={chassis}
                    disabled={!model || submodelsLoading}
                    onChange={(event) => setChassis(event.target.value)}
                    className="h-10 w-full appearance-none truncate rounded-none border border-foreground/10 bg-foreground/[0.035] px-2 pr-7 text-[11px] font-light text-foreground/75 outline-hidden transition focus:border-foreground/35 disabled:cursor-not-allowed disabled:opacity-40 sm:h-11 sm:px-3 sm:pr-9 sm:text-xs"
                  >
                    <option value="" className="bg-[#121216]">
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
                      <option key={code} value={code} className="bg-[#121216] text-white">
                        {code}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/45 sm:right-3 sm:h-4 sm:w-4" />
                </label>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-3 sm:gap-5 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-hidden rounded-none border border-foreground/10 bg-foreground/[0.02] shadow-[0_30px_60px_rgba(0,0,0,0.42)] backdrop-blur-3xl dark:bg-white/[0.02]">
              <FilterPanel />
            </div>
          </aside>

          <main className="min-w-0">
            <div className="mb-4 rounded-none border border-foreground/10 bg-foreground/[0.02] p-4 shadow-[0_24px_55px_rgba(0,0,0,0.34)] backdrop-blur-3xl dark:bg-white/[0.02] sm:mb-6 sm:rounded-none sm:p-5">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <p className="hidden text-[10px] font-light uppercase tracking-[0.3em] text-foreground/65 sm:block">
                    {isUa ? "Результати" : "Results"}
                  </p>
                  <div className="flex min-w-0 flex-wrap items-end gap-x-3 gap-y-1 sm:mt-2">
                    <h2 className="min-w-0 text-xl font-extralight leading-tight tracking-tight text-foreground sm:text-2xl">
                      {isUa ? "Каталог товарів" : "Product catalog"}
                    </h2>
                    <span className="min-w-0 pb-0.5 font-mono text-[11px] text-foreground/45 sm:pb-1 sm:text-xs">
                      {totalItems.toLocaleString(isUa ? "uk-UA" : "en-US")}{" "}
                      {isUa ? "товарів" : "products"}
                      {totalPages > 1
                        ? ` / ${isUa ? "сторінка" : "page"} ${page}/${totalPages}`
                        : ""}
                    </span>
                  </div>
                </div>

                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(true)}
                    className="inline-flex h-9 items-center gap-2 rounded-none border border-foreground/15 bg-foreground/[0.04] px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground transition hover:border-foreground/35 sm:h-10 lg:hidden"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    {isUa ? "Фільтри" : "Filters"}
                    {activeFilterCount > 0 ? (
                      <span className="font-mono text-foreground">{activeFilterCount}</span>
                    ) : null}
                  </button>

                  {items.length > 0 ? (
                    <button
                      type="button"
                      onClick={handleToggleSelectPage}
                      className={`hidden h-10 max-w-[190px] items-center gap-2 border px-3 text-[10px] font-bold uppercase tracking-[0.14em] transition sm:inline-flex ${
                        allItemsOnPageSelected
                          ? "border-foreground bg-foreground text-background"
                          : "border-foreground/10 bg-foreground/[0.025] text-foreground/60 hover:border-foreground/25 hover:bg-foreground/[0.05] hover:text-foreground"
                      }`}
                    >
                      <Heart
                        className={`h-3.5 w-3.5 ${allItemsOnPageSelected ? "fill-current" : ""}`}
                      />
                      <span className="truncate">
                        {allItemsOnPageSelected
                          ? isUa
                            ? "Сторінку вибрано"
                            : "Page saved"
                          : isUa
                            ? "Вибрати сторінку"
                            : "Save page"}
                      </span>
                    </button>
                  ) : null}

                  <label className="relative h-9 sm:h-10">
                    <span className="sr-only">{isUa ? "Сортування" : "Sort"}</span>
                    <select
                      value={sortOrder}
                      onChange={(event) => setSortOrder(event.target.value as StockSort)}
                      className="h-9 max-w-[190px] appearance-none truncate rounded-none border border-foreground/10 bg-foreground/[0.035] pl-3 pr-8 text-xs font-light text-foreground/75 outline-hidden transition hover:border-foreground/20 focus:border-foreground/35 sm:h-10 sm:pr-9"
                    >
                      {(Object.keys(SORT_LABELS) as StockSort[]).map((value) => (
                        <option key={value} value={value} className="bg-[#121216] text-white">
                          {isUa ? SORT_LABELS[value].ua : SORT_LABELS[value].en}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/45" />
                  </label>

                  <div className="flex h-9 rounded-none border border-foreground/10 bg-foreground/[0.035] p-0.5 sm:h-10">
                    <button
                      type="button"
                      onClick={() => handleSetViewMode("grid")}
                      className={`flex w-9 items-center justify-center transition ${
                        viewMode === "grid"
                          ? "rounded-none bg-foreground text-background"
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
                          ? "rounded-none bg-foreground text-background"
                          : "text-foreground/45 hover:text-foreground"
                      }`}
                      title={isUa ? "Список" : "List"}
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {hasActiveFilters ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-foreground/10 pt-4">
                  {query.trim() ? (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="inline-flex min-h-8 items-center gap-2 rounded-none border border-foreground/15 bg-foreground/[0.04] px-3 text-[11px] text-foreground/75 transition hover:border-foreground/35 hover:text-foreground"
                    >
                      {isUa ? `Пошук: ${query.trim()}` : `Search: ${query.trim()}`}
                      <X className="h-3.5 w-3.5 text-foreground/45" />
                    </button>
                  ) : null}
                  {selectedBrands.map((brandName) => (
                    <button
                      key={brandName}
                      type="button"
                      onClick={() => handleToggleBrand(brandName)}
                      className="inline-flex min-h-8 items-center gap-2 rounded-none border border-foreground/12 bg-foreground/[0.03] px-3 text-[11px] text-foreground/70 transition hover:border-foreground/25 hover:text-foreground"
                    >
                      {isUa ? `Бренд: ${brandName}` : `Brand: ${brandName}`}
                      <X className="h-3.5 w-3.5 text-foreground/45" />
                    </button>
                  ))}
                  {localCategory ? (
                    <button
                      type="button"
                      onClick={() => setLocalCategory("")}
                      className="inline-flex min-h-8 items-center gap-2 rounded-none border border-foreground/12 bg-foreground/[0.03] px-3 text-[11px] text-foreground/70 transition hover:border-foreground/25 hover:text-foreground"
                    >
                      {isUa ? `Група: ${localCategory}` : `Group: ${localCategory}`}
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
                      className="inline-flex min-h-8 items-center gap-2 rounded-none border border-foreground/12 bg-foreground/[0.03] px-3 text-[11px] text-foreground/70 transition hover:border-foreground/25 hover:text-foreground"
                    >
                      {value}
                      <X className="h-3.5 w-3.5 text-foreground/45" />
                    </button>
                  ))}
                  {stockFilter !== "all" ? (
                    <button
                      type="button"
                      onClick={() => setStockFilter("all")}
                      className="inline-flex min-h-8 items-center gap-2 rounded-none border border-foreground/12 bg-foreground/[0.03] px-3 text-[11px] text-foreground/70 transition hover:border-foreground/25 hover:text-foreground"
                    >
                      {isUa ? STOCK_LABELS[stockFilter].ua : STOCK_LABELS[stockFilter].en}
                      <X className="h-3.5 w-3.5 text-foreground/45" />
                    </button>
                  ) : null}
                  {sortOrder !== "default" ? (
                    <button
                      type="button"
                      onClick={() => setSortOrder("default")}
                      className="inline-flex min-h-8 items-center gap-2 rounded-none border border-foreground/12 bg-foreground/[0.03] px-3 text-[11px] text-foreground/70 transition hover:border-foreground/25 hover:text-foreground"
                    >
                      {isUa ? SORT_LABELS[sortOrder].ua : SORT_LABELS[sortOrder].en}
                      <X className="h-3.5 w-3.5 text-foreground/45" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex min-h-8 items-center rounded-none border border-foreground/12 bg-foreground/[0.03] px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/55 transition hover:border-foreground/25 hover:bg-foreground/[0.06] hover:text-foreground"
                  >
                    {isUa ? "Скинути все" : "Reset all"}
                  </button>
                </div>
              ) : null}
            </div>
            {error && (
              <div className="mb-6 rounded-none border border-foreground/12 bg-foreground/[0.035] p-4 text-sm font-light text-foreground/70">
                {error}
              </div>
            )}

            {fallbackApplied && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 flex items-start gap-3 rounded-none border border-foreground/10 bg-foreground/[0.03] p-4 text-xs font-light tracking-wide text-foreground/65 shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
              >
                <div className="w-5 h-5 rounded-none bg-foreground/[0.06] flex items-center justify-center shrink-0 mt-0.5 text-foreground/50">
                  <span className="font-bold text-xs">!</span>
                </div>
                <div>
                  <p className="font-medium leading-relaxed">
                    {fallbackApplied === "fitment"
                      ? isUa
                        ? `У поточному автомобільному фільтрі нічого не знайдено за запитом "${query}". Показано результати по всьому каталогу:`
                        : `No results found for "${query}" matching the selected vehicle filters. Showing results from the entire catalog:`
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
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-5 lg:grid-cols-3 xl:grid-cols-4 [@media(min-width:2400px)]:grid-cols-5">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[380px] rounded-none border border-foreground/10 bg-foreground/[0.02] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.2)] sm:rounded-none sm:p-5 md:p-6 flex flex-col"
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
              <div className="rounded-none border border-foreground/10 bg-foreground/[0.02] py-32 text-center shadow-[0_24px_55px_rgba(0,0,0,0.28)] backdrop-blur-xl dark:bg-white/[0.02]">
                <div className="w-20 h-20 mx-auto bg-foreground/[0.03] rounded-none flex items-center justify-center mb-6 ring-1 ring-foreground/10 shadow-[0_0_30px_rgba(255,255,255,0.02)]">
                  <Package className="w-8 h-8 text-foreground/45" />
                </div>
                <h3 className="text-xl font-light text-foreground mb-3 tracking-wide">
                  {isUa ? "Каталог нашого магазину" : "Our Shop Catalog"}
                </h3>
                <p className="text-foreground/60 dark:text-foreground/40 text-sm font-light max-w-md mx-auto leading-relaxed px-4">
                  {isUa
                    ? "Введіть назву, артикул, бренд або оберіть параметри автомобіля для підбору сумісних компонентів."
                    : "Enter product name, SKU, brand, or select car parameters to find compatible upgrades."}
                </p>
              </div>
            ) : hasSearched && items.length === 0 ? (
              <div className="rounded-none border border-foreground/10 bg-foreground/[0.02] py-32 text-center shadow-[0_24px_55px_rgba(0,0,0,0.28)] backdrop-blur-xl dark:bg-white/[0.02]">
                <div className="w-20 h-20 mx-auto bg-foreground/[0.03] rounded-none flex items-center justify-center mb-6 ring-1 ring-foreground/10">
                  <Package className="w-8 h-8 text-foreground/55 dark:text-foreground/30" />
                </div>
                <h3 className="text-xl font-light text-foreground mb-3 tracking-wide">
                  {isUa ? "За вашим запитом нічого не знайдено" : "No results found"}
                </h3>
                <p className="text-foreground/60 dark:text-foreground/40 text-sm font-light mb-6 px-4">
                  {isUa
                    ? "Спробуйте змінити параметри пошуку або обрати інший автомобіль."
                    : "Try different filters or another vehicle."}
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
                {/* Results count & Select All */}
                <div className="hidden">
                  <p className="text-[10px] uppercase tracking-widest text-foreground/55 dark:text-foreground/30">
                    {items.length} {isUa ? "результатів" : "results"}{" "}
                    {totalPages > 1 && `• ${isUa ? "Сторінка" : "Page"} ${page}/${totalPages}`}
                  </p>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full lg:w-auto">
                    {items.length > 0 && (
                      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                        {/* Select All on Page */}
                        <button
                          type="button"
                          onClick={() => {
                            const allSelectedOnPage = items.every((item) =>
                              selectedItems.some((x) => x.id === item.id)
                            );
                            if (allSelectedOnPage) {
                              // Deselect all items of this page
                              setSelectedItems((prev) =>
                                prev.filter((x) => !items.some((item) => item.id === x.id))
                              );
                            } else {
                              // Select all items of this page (avoiding duplicates)
                              setSelectedItems((prev) => {
                                const next = [...prev];
                                items.forEach((item) => {
                                  if (!next.some((x) => x.id === item.id)) {
                                    next.push(item);
                                  }
                                });
                                return next;
                              });
                            }
                          }}
                          className="text-[10px] font-bold uppercase tracking-wider text-white hover:text-white transition-colors flex items-center gap-2 cursor-pointer border border-white/20 bg-white/5 px-4 py-2 rounded-none hover:bg-white/10 active:scale-95 transition-all flex-1 sm:flex-none justify-center"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {items.every((item) => selectedItems.some((x) => x.id === item.id))
                            ? isUa
                              ? "Зняти виділення сторінки"
                              : "Deselect All on Page"
                            : isUa
                              ? "Вибрати всі на сторінці"
                              : "Select All on Page"}
                        </button>

                        {/* Select All Matching Results */}
                        <button
                          type="button"
                          disabled={selectingAll}
                          onClick={handleSelectAllResults}
                          className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors flex items-center gap-2 cursor-pointer border border-white/10 bg-white/[0.03] px-4 py-2 rounded-none hover:bg-white/[0.06] active:scale-95 transition-all flex-1 sm:flex-none justify-center disabled:opacity-50"
                        >
                          {selectingAll ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          {isUa
                            ? `Вибрати всі знайдені (${totalItems})`
                            : `Select All Found (${totalItems})`}
                        </button>
                      </div>
                    )}

                    {/* View Mode Toggle Group */}
                    <div className="flex border border-foreground/10 p-0.5 rounded-none bg-foreground/[0.01] self-end sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSetViewMode("grid")}
                        className={`p-1.5 rounded-none transition-all cursor-pointer ${
                          viewMode === "grid"
                            ? "bg-white/10 border border-white/30 text-white"
                            : "text-zinc-500 hover:text-foreground border border-transparent"
                        }`}
                        title={isUa ? "Сітка" : "Grid"}
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetViewMode("list")}
                        className={`p-1.5 rounded-none transition-all cursor-pointer ${
                          viewMode === "list"
                            ? "bg-white/10 border border-white/30 text-white"
                            : "text-zinc-500 hover:text-foreground border border-transparent"
                        }`}
                        title={isUa ? "Список" : "List"}
                      >
                        <List className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {viewMode === "grid" ? (
                  /* Product Grid — full width */
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-5 lg:grid-cols-3 xl:grid-cols-4 [@media(min-width:2400px)]:grid-cols-5">
                    {items.map((item) => {
                      const isSelected = selectedItems.some((x) => x.id === item.id);
                      const logoPath = getBrandLogoPath(item.brand);
                      const compareAtLabel = formatItemCompareAt(item);
                      const priceLabel = formatItemPrice(item);
                      const vehicleLabel =
                        [make, model, chassis].filter(Boolean).join(" ") ||
                        (isUa ? "Підбір по авто" : "Vehicle fitment");

                      return (
                        <motion.div
                          layout
                          key={item.id}
                          className={`group relative flex min-h-[360px] min-w-0 flex-col overflow-hidden rounded-none border bg-foreground/[0.02] p-3 shadow-[0_24px_50px_rgba(0,0,0,0.32)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/22 hover:bg-foreground/[0.035] dark:bg-white/[0.02] md:min-h-[430px] md:rounded-none md:p-4 ${
                            isSelected ? "border-foreground/35" : "border-foreground/10"
                          }`}
                        >
                          <div className="absolute right-3 top-3 z-30 flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleToggleSelectItem(item);
                              }}
                              className={`flex h-8 w-8 items-center justify-center rounded-none border backdrop-blur-md transition ${
                                isSelected
                                  ? "border-foreground bg-foreground text-background"
                                  : "border-foreground/10 bg-background/40 text-foreground/45 hover:border-foreground/25 hover:text-foreground"
                              }`}
                              title={isUa ? "Зберегти товар" : "Save product"}
                            >
                              <Heart className={`h-4 w-4 ${isSelected ? "fill-current" : ""}`} />
                            </button>
                          </div>

                          <Link
                            href={`/${locale}/shop/${item.slug}`}
                            className="flex min-w-0 cursor-pointer flex-col md:flex-1"
                          >
                            <div className="relative mb-4 flex aspect-[1.62] items-center justify-center overflow-hidden rounded-none border border-foreground/8 bg-foreground/[0.035] md:aspect-[1.42]">
                              <SafeProductImage
                                src={item.thumbnail}
                                alt={item.name}
                                className="h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-105 md:p-4"
                              />
                            </div>

                            <div className="mb-2.5 grid grid-cols-[minmax(0,1fr)_minmax(0,42%)] items-center gap-3">
                              <div className="min-w-0 overflow-hidden">
                                <div className="flex min-h-5 items-center gap-2">
                                  <BrandLogoTile
                                    brandName={item.brand}
                                    logoPath={logoPath}
                                    size="sm"
                                  />
                                  <span className="truncate text-[9px] font-semibold uppercase tracking-[0.18em] text-foreground/55">
                                    {item.brand}
                                  </span>
                                </div>
                              </div>
                              <div className="min-w-0 justify-self-end overflow-hidden">
                                <SkuCopy sku={item.partNumber} isUa={isUa} />
                              </div>
                            </div>

                            <div className="flex flex-col md:flex-1">
                              <h3 className="line-clamp-3 min-h-[48px] overflow-hidden text-[13px] font-light leading-[1.22] text-foreground [overflow-wrap:anywhere] transition-colors group-hover:text-foreground">
                                {item.name}
                              </h3>
                              <div className="mt-1 truncate text-[10px] font-light uppercase tracking-[0.12em] text-foreground/45">
                                SKU: {item.partNumber}
                              </div>

                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <span className="inline-flex max-w-full items-center gap-1.5 rounded-none border border-foreground/12 bg-foreground/[0.035] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground/65">
                                  <Car className="h-3 w-3 shrink-0 text-foreground/45" />
                                  <span className="min-w-0 truncate">{vehicleLabel}</span>
                                </span>
                                <span className="hidden max-w-full items-center gap-1.5 rounded-none border border-foreground/10 bg-foreground/[0.025] px-2.5 py-1 text-[10px] font-light text-foreground/55 md:inline-flex">
                                  <Ruler className="h-3 w-3 shrink-0 text-foreground/35" />
                                  <span className="min-w-0 truncate">
                                    {item.category || item.brand}
                                  </span>
                                </span>
                              </div>
                            </div>
                          </Link>

                          <div className="mt-3 space-y-3 border-t border-foreground/8 pt-3 md:mt-auto">
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
                                  <div className="mb-0.5 text-[8px] font-semibold uppercase tracking-[0.18em] text-foreground/45">
                                    {isUa ? "Ціна" : "Price"}
                                  </div>
                                  <div
                                    className="whitespace-nowrap font-mono text-[19px] font-semibold leading-none tracking-tight text-foreground 2xl:text-[21px]"
                                    suppressHydrationWarning={true}
                                  >
                                    {priceLabel}
                                  </div>
                                  <div className="mt-1 text-[10px] font-light uppercase tracking-[0.12em] text-foreground/35">
                                    {isUa ? "за одиницю" : "per unit"}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex min-w-0 items-end justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="mb-0.5 text-[8px] font-light uppercase tracking-[0.18em] text-foreground/35">
                                    {isUa ? "Ціна" : "Price"}
                                  </div>
                                  <div
                                    className="whitespace-nowrap font-mono text-[19px] font-semibold leading-none tracking-tight text-foreground 2xl:text-[20px]"
                                    suppressHydrationWarning={true}
                                  >
                                    {priceLabel}
                                  </div>
                                  <div className="mt-1 text-[10px] font-light uppercase tracking-[0.12em] text-foreground/35">
                                    {isUa ? "за одиницю" : "per unit"}
                                  </div>
                                </div>
                              </div>
                            )}

                            <StockCardCartControl
                              item={item}
                              locale={locale as string}
                              isUa={isUa}
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  /* Premium marketplace table/list layout */
                  <div className="space-y-4">
                    {/* Desktop View */}
                    <div className="hidden w-full overflow-hidden rounded-none border border-foreground/10 bg-foreground/[0.02] shadow-[0_24px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl dark:bg-white/[0.02] md:block">
                      {/* Table Header */}
                      <div className="grid grid-cols-[auto_80px_140px_1fr_120px_160px_160px] items-center gap-4 border-b border-foreground/10 px-6 py-4 text-[10px] font-light uppercase tracking-[0.18em] text-foreground/45">
                        <div className="w-6" /> {/* Checkbox placeholder */}
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
                          const isSelected = selectedItems.some((x) => x.id === item.id);
                          const compareAtLabel = formatItemCompareAt(item);
                          const priceLabel = formatItemPrice(item);

                          return (
                            <div
                              key={item.id}
                              className={`grid grid-cols-[auto_80px_140px_1fr_120px_160px_160px] items-center gap-4 border-l-2 px-6 py-4 transition-all duration-300 hover:bg-foreground/[0.025] ${
                                isSelected
                                  ? "border-l-foreground bg-foreground/[0.035]"
                                  : "border-l-transparent"
                              }`}
                            >
                              {/* Checkbox */}
                              <div className="flex items-center justify-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSelectItem(item)}
                                  className={`w-5 h-5 rounded-none border flex items-center justify-center transition-all cursor-pointer ${
                                    isSelected
                                      ? "bg-foreground border-foreground text-background"
                                      : "border-foreground/15 bg-foreground/[0.03] hover:border-foreground/30 text-transparent hover:text-foreground/25"
                                  }`}
                                >
                                  <Check className="w-3 h-3 stroke-[3px]" />
                                </button>
                              </div>

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
                                  href={`/${locale}/shop/${item.slug}`}
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
                                {(make || model || chassis) && (
                                  <span className="inline-flex items-center gap-0.5 rounded-none border border-foreground/15 bg-foreground/[0.04] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-widest text-foreground/75">
                                    <Check className="w-2 h-2" />
                                    {isUa ? "Підходить" : "Fits"}
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
                                <AddToCartButton
                                  slug={item.slug}
                                  variantId={item.variantId}
                                  locale={locale as string}
                                  variant="minimal"
                                  label={isUa ? "Кошик" : "Cart"}
                                  labelAdded={isUa ? "В кошику ✓" : "In Cart ✓"}
                                  className="h-9 w-full rounded-none border border-foreground bg-foreground text-background text-[10px] font-semibold uppercase tracking-[0.18em] transition hover:bg-transparent hover:text-foreground active:scale-95 flex items-center justify-center gap-1"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Mobile/Tablet view */}
                    <div className="md:hidden space-y-3">
                      {items.map((item) => {
                        const isSelected = selectedItems.some((x) => x.id === item.id);
                        const compareAtLabel = formatItemCompareAt(item);
                        const priceLabel = formatItemPrice(item);

                        return (
                          <div
                            key={item.id}
                            className={`relative flex flex-col rounded-none border border-foreground/10 bg-foreground/[0.02] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.25)] transition-all duration-300 hover:bg-foreground/[0.035] dark:bg-white/[0.02] ${
                              isSelected
                                ? "border-l-2 border-l-foreground bg-foreground/[0.035]"
                                : ""
                            }`}
                          >
                            {/* Top info row */}
                            <div className="flex items-start justify-between gap-3 mb-2">
                              {/* Checkbox and brand/SKU */}
                              <div className="flex min-w-0 items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSelectItem(item)}
                                  className={`w-5 h-5 rounded-none border flex items-center justify-center transition-all cursor-pointer ${
                                    isSelected
                                      ? "bg-foreground border-foreground text-background"
                                      : "border-foreground/15 bg-foreground/[0.03] text-transparent"
                                  }`}
                                >
                                  <Check className="w-3 h-3 stroke-[3px]" />
                                </button>
                                <div className="flex min-w-0 flex-col">
                                  <span className="truncate text-[9px] font-light uppercase tracking-widest text-foreground/45">
                                    {item.brand}
                                  </span>
                                  <SkuCopy sku={item.partNumber} isUa={isUa} />
                                </div>
                              </div>

                              {/* Fitment badge */}
                              <div className="flex gap-1.5">
                                {(make || model || chassis) && (
                                  <span className="rounded-none border border-foreground/15 bg-foreground/[0.04] px-2 py-0.5 text-[7px] font-semibold uppercase tracking-wider text-foreground/75">
                                    {isUa ? "Підходить" : "Fits"}
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
                                  href={`/${locale}/shop/${item.slug}`}
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
                                <AddToCartButton
                                  slug={item.slug}
                                  variantId={item.variantId}
                                  locale={locale as string}
                                  variant="minimal"
                                  label={isUa ? "Кошик" : "Cart"}
                                  labelAdded={isUa ? "В кошику ✓" : "In Cart ✓"}
                                  className="h-8 w-full rounded-none border border-foreground bg-foreground text-background text-[9px] font-semibold uppercase tracking-[0.16em] transition hover:bg-transparent hover:text-foreground flex items-center justify-center"
                                />
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
          </main>
        </div>
      </div>

      {/* ════ FLOATING BATCH ACTIONS BAR ════ */}
      <AnimatePresence>
        {selectedItems.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0, x: "-50%" }}
            animate={{ y: 0, opacity: 1, x: "-50%" }}
            exit={{ y: 80, opacity: 0, x: "-50%" }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="fixed bottom-6 left-1/2 z-50 flex w-[92%] max-w-4xl -translate-x-1/2 flex-col gap-4 rounded-none border border-foreground/12 bg-background/85 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-3xl sm:w-auto md:flex-row md:items-center md:justify-between md:p-6"
          >
            {/* Left: item count & bulk clear */}
            <div className="flex items-center gap-4">
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-light tracking-widest text-foreground/45">
                  {isUa ? "Вибрані товари" : "Selected Items"}
                </div>
                <div className="text-lg font-light text-foreground flex items-center gap-2">
                  <span className="font-semibold text-foreground">{selectedItems.length}</span>
                  <span className="text-foreground/45 text-xs">{isUa ? "дет." : "pcs."}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItems([])}
                className="h-8 shrink-0 rounded-none border border-foreground/10 px-3 text-[10px] font-semibold uppercase tracking-wider text-foreground/60 transition-all hover:bg-foreground/5 hover:text-foreground"
              >
                {isUa ? "Очистити" : "Clear"}
              </button>
            </div>

            {/* Middle: selected cart calculations */}
            <div className="flex flex-wrap items-center gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-foreground/5">
              {isB2B ? (
                <>
                  <div className="space-y-0.5">
                    <div className="text-[8px] uppercase font-light tracking-widest text-foreground/45">
                      {isUa ? "Сума РРЦ (MSRP)" : "Total MSRP"}
                    </div>
                    <div
                      className="text-sm font-mono text-foreground/45 line-through"
                      suppressHydrationWarning={true}
                    >
                      {formatAmount(selectedCompareAtTotal)}
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="text-[8px] uppercase font-light tracking-widest text-foreground/60">
                      {isUa ? "Сума" : "Total"}
                    </div>
                    <div
                      className="text-sm font-mono font-semibold text-foreground"
                      suppressHydrationWarning={true}
                    >
                      {formatAmount(selectedCartTotal)}
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-0.5">
                  <div className="text-[8px] uppercase font-light tracking-widest text-foreground/55">
                    {isUa ? "Загальна сума" : "Total Price"}
                  </div>
                  <div
                    className="text-lg font-mono text-foreground font-light"
                    suppressHydrationWarning={true}
                  >
                    {formatAmount(selectedCartTotal)}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
              <button
                type="button"
                onClick={() => handleExportCSV(selectedItems)}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-none border border-foreground/12 bg-foreground/[0.03] px-4 text-[10px] font-semibold uppercase tracking-wider text-foreground/65 transition-all hover:bg-foreground/[0.06] hover:text-foreground active:scale-95 md:flex-none"
              >
                {isUa ? "Експорт CSV" : "Export CSV"}
              </button>

              <button
                type="button"
                onClick={handleBulkAddToCart}
                disabled={bulkAdding}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-none border border-foreground bg-foreground px-6 text-[10px] font-semibold uppercase tracking-widest text-background transition-all hover:bg-transparent hover:text-foreground active:scale-95 disabled:opacity-50 md:flex-none"
              >
                {bulkAdding ? (
                  <Loader2 className="w-4 h-4 animate-spin text-background" />
                ) : bulkAdded ? (
                  <span>{isUa ? "Товари додано! ✓" : "Items added! ✓"}</span>
                ) : (
                  <span>{isUa ? "Додати вибрані в кошик" : "Add selected to cart"}</span>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
