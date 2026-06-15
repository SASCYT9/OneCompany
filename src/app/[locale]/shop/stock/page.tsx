"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
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
} from "lucide-react";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { motion, AnimatePresence } from "framer-motion";
import { SHOW_STOCK_BADGE } from "@/lib/shopStockUi";
import { DEFAULT_CURRENCY_RATES } from "@/lib/shopAdminSettings";

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
  originalPrice?: number | null;
  basePrice: number;
  markupPct: number;
  slug: string;
  variantId: string | null;
  turn14Id: string;
  category?: string | null;
};

/* ========= Brand Logo Helper ========= */
const getBrandLogoPath = (brandName: string): string | null => {
  const b = brandName.toLowerCase().trim();
  if (b.includes("akrapovic") || b.includes("akrapovič")) return "/logos/akrapovic.svg";
  if (b.includes("adro")) return "/logos/adro.svg";
  if (b.includes("racechip")) return "/logos/racechip.png";
  if (b.includes("do88")) return "/logos/do88.png";
  if (b.includes("csf")) return "/logos/csf.png";
  if (b.includes("ohlins") || b.includes("öhlins")) return "/logos/ohlins.svg";
  if (b.includes("girodisc")) return "/logos/girodisc.webp";
  if (b.includes("ipe")) return "/logos/ipe-exhaust.svg";
  if (b.includes("burger")) return "/logos/burger-motorsport.svg";
  if (b.includes("kw ")) return "/logos/kw-suspension.svg";
  if (b.includes("urban")) return "/logos/urban-automotive.svg";
  if (b.includes("vf engineering") || b.includes("vf-engineering"))
    return "/logos/vf-engineering.png";
  if (b.includes("vorsteiner")) return "/logos/vorsteiner.png";
  if (b.includes("eventuri")) return "/brands/eventuri-logo.svg";
  if (b.includes("remus")) return "/logos/remus.png";
  if (b.includes("fi exhaust") || b.includes("fi-exhaust")) return "/logos/fi-exhaust.svg";
  return null;
};

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
      className="inline-flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 hover:text-white active:scale-95 transition-all duration-300 group/copy cursor-pointer"
      title={isUa ? "Копіювати артикул" : "Copy part number"}
    >
      <span>#{sku}</span>
      {copied ? (
        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
      ) : (
        <Copy className="w-2.5 h-2.5 text-zinc-600 group-hover/copy:text-white opacity-0 group-hover:opacity-100 transition-all duration-300 shrink-0" />
      )}
    </span>
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

/* ========= Dynamic Dealer / Catalog Header ========= */
function CatalogHeader({ isUa }: { isUa: boolean }) {
  const { data: session } = useSession();
  const user = session?.user as any;
  const isB2B = user?.group === "B2B_APPROVED";

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[1400px] mx-auto px-4 sm:px-6 md:px-8 mb-8"
    >
      {isB2B ? (
        <div className="relative group overflow-hidden rounded-none border border-foreground/10 bg-foreground/[0.03] backdrop-blur-3xl p-8 shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[100px] pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-none border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-[10px] font-bold tracking-[0.2em] uppercase">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Dealer Tier: B2B Partner
              </div>
              <h2 className="text-3xl font-light tracking-tight text-foreground">
                {isUa ? "Вітаємо," : "Welcome,"}{" "}
                <span className="font-medium">{user.companyName || user.name || user.email}</span>
              </h2>
              <p className="text-zinc-500 text-sm font-light">
                {isUa
                  ? "Ваш персональний B2B портал складу та логістики."
                  : "Your personalized B2B stock and logistics portal."}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative group overflow-hidden rounded-none border border-foreground/10 bg-foreground/[0.01] backdrop-blur-3xl p-8">
          <div className="relative z-10 space-y-2 text-center max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-light tracking-tight text-foreground">
              {isUa ? "B2B Портал" : "B2B Portal"}
            </h2>
            <p className="text-zinc-500 text-sm font-light leading-relaxed">
              {isUa
                ? "Пошук та перевірка наявності деталей для преміум автомобілів по всіх брендах нашої компанії."
                : "Search and check availability of tuning components for premium vehicles across all company brands."}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
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
  const locale = typeof params?.locale === "string" ? params.locale : "ua";
  const isUa = locale === "ua";

  const { data: session } = useSession();
  const user = session?.user as any;
  const isB2B = user?.group === "B2B_APPROVED";

  // View mode state with local storage persistence
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("onecompany_stock_view");
      if (saved === "grid" || saved === "list") {
        setViewMode(saved);
      }
    }
  }, []);

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
      if (locale) params.set("locale", locale);
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

    const headers = ["SKU", "Product Name", "Price (USD)", "Price (EUR)"];

    const rows = exportItems.map((item) => {
      const usdPrice = item.priceUsd || item.price || 0;
      const eurPrice = item.priceEur || (item.price ? item.price / DEFAULT_CURRENCY_RATES.USD : 0);

      return [
        item.partNumber,
        item.name.replace(/"/g, '""'),
        usdPrice.toFixed(2),
        eurPrice.toFixed(2),
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
    link.setAttribute("download", `OneCompany_Stock${filterText}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Search state
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [fallbackApplied, setFallbackApplied] = useState<"fitment" | "all" | null>(null);

  const [localCategory, setLocalCategory] = useState("");
  const [localCategories, setLocalCategories] = useState<string[]>([]);
  const [localBrands, setLocalBrands] = useState<string[]>([]);

  // Vehicle fitment state
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [chassisCodes, setChassisCodes] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [submodelsLoading, setSubmodelsLoading] = useState(false);

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [chassis, setChassis] = useState("");

  // Brand filters state (multi-select)
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);

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
      .then((res) => setModels(res.data || []))
      .catch(() => {})
      .finally(() => setModelsLoading(false));
    setModel("");
    setChassis("");
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
      .then((res) => setChassisCodes(res.data || []))
      .catch(() => {})
      .finally(() => setSubmodelsLoading(false));
    setChassis("");
  }, [make, model]);

  // Search handler
  const doSearch = useCallback(
    async (searchPage = 1) => {
      if (!query && selectedBrands.length === 0 && !make && !model && !chassis && !localCategory) {
        setHasSearched(false);
        setItems([]);
        setTotalPages(1);
        return;
      }

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
      if (locale) params.set("locale", locale);
      params.set("page", searchPage.toString());

      try {
        const res = await fetch(`/api/shop/stock/search?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setItems(data.data || []);
        setTotalPages(data.meta?.totalPages || 1);
        setTotalItems(data.meta?.totalItems || 0);
        setFallbackApplied(data.meta?.fallbackApplied || null);
        setPage(searchPage);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [query, selectedBrands, make, model, chassis, localCategory, locale]
  );

  // Auto-search for filters and queries
  useEffect(() => {
    const t = setTimeout(() => doSearch(1), 600);
    return () => clearTimeout(t);
  }, [selectedBrands, make, model, chassis, query, localCategory, doSearch]);

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
    setQuery("");
    setHasSearched(false);
    setFallbackApplied(null);
    setItems([]);
    setTotalPages(1);
    setTotalItems(0);
  }

  return (
    <div className="min-h-screen bg-[#050505] text-foreground selection:bg-red-500/30">
      {/* ════ B2B DEALER HUB ════ */}
      <div className="pt-32 pb-6 relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] max-w-[1400px] h-[500px] bg-white/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.02] pointer-events-none mix-blend-screen" />

        <CatalogHeader isUa={isUa} />
      </div>

      {/* ════ SELECTED ITEMS HUD PANEL ════ */}
      <AnimatePresence>
        {selectedItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="max-w-[1400px] mx-auto px-4 sm:px-6 md:px-8 mb-8 overflow-hidden"
          >
            <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-[#0d0d12]/50 backdrop-blur-3xl p-6 shadow-[0_12px_40px_rgba(197,168,128,0.08)]">
              <div className="flex items-center justify-between mb-4 border-b border-foreground/5 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-300">
                    {isUa ? "Вибрано для пакетної дії" : "Selected for Bulk Action"}
                  </h3>
                  <span className="px-2 py-0.5 rounded-none bg-white/5 border border-white/20 text-white text-xs font-bold">
                    {selectedItems.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedItems([])}
                  className="text-zinc-500 hover:text-rose-400 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  {isUa ? "Очистити список" : "Clear list"}
                </button>
              </div>

              {/* Horizontal Scroll of Selected Items */}
              <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar scroll-smooth">
                {selectedItems.map((item) => {
                  return (
                    <div
                      key={item.id}
                      className="group relative flex items-center gap-3 w-72 shrink-0 rounded-none border border-foreground/5 bg-foreground/[0.01] hover:bg-foreground/[0.03] p-3 transition-all duration-300"
                    >
                      {/* Deselect trigger */}
                      <button
                        type="button"
                        onClick={() => handleToggleSelectItem(item)}
                        className="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 rounded-none border border-foreground/10 bg-[#0a0a0c] hover:bg-rose-500 hover:text-white hover:border-rose-400 text-zinc-500 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 cursor-pointer"
                        title={isUa ? "Видалити" : "Remove"}
                      >
                        <X className="w-3 h-3" />
                      </button>

                      {/* Mini image */}
                      <div className="w-12 h-12 rounded-none bg-foreground/[0.02] flex items-center justify-center overflow-hidden shrink-0">
                        <SafeProductImage
                          src={item.thumbnail}
                          alt={item.name}
                          className="w-full h-full object-contain p-1"
                          isMini
                        />
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="text-[8px] font-bold uppercase text-zinc-500 tracking-wider flex items-center justify-between">
                          <span className="truncate max-w-[120px]">{item.brand}</span>
                          <span className="font-mono text-zinc-600">#{item.partNumber}</span>
                        </div>
                        <h4 className="text-[11px] font-medium text-foreground leading-snug truncate">
                          {item.name}
                        </h4>
                        <div className="text-[10px] font-mono text-white font-bold">
                          ${item.price?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 md:px-8 mb-12">
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
                    {isUa ? `Категорія: ${localCategory}` : `Category: ${localCategory}`}
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
                      {logoPath && (
                        <img
                          src={logoPath}
                          alt={b}
                          className={`h-4.5 object-contain max-w-[28px] transition-all duration-300 ${
                            isSelected
                              ? "opacity-100 scale-105 filter-none"
                              : "opacity-45 group-hover:opacity-85 grayscale invert dark:invert-0"
                          }`}
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      )}
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
                  className="w-full sm:w-auto h-11 px-6 rounded-none border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  {isUa ? "Скинути" : "Reset"}
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto h-11 px-10 rounded-none bg-[#c5a880]/15 hover:bg-[#c5a880]/25 border border-[#c5a880]/30 text-white text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-30 flex items-center justify-center gap-2 cursor-pointer"
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
                  className="w-full sm:w-auto h-11 px-6 rounded-none border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isUa ? "Експорт CSV" : "Export CSV"}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* ════ RESULTS ════ */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 md:px-8 pb-32">
        {error && (
          <div className="bg-red-500/5 border border-red-500/20 text-red-400 p-4 mb-6 text-sm">
            {error}
          </div>
        )}

        {fallbackApplied && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-none border border-amber-500/20 bg-amber-500/5 text-amber-400 text-xs tracking-wide flex items-start gap-3 shadow-lg"
          >
            <div className="w-5 h-5 rounded-none bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
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
                className="mt-2 text-[10px] font-bold uppercase tracking-wider underline hover:text-amber-300 transition-colors"
              >
                {isUa ? "Скинути фільтри" : "Clear Filters"}
              </button>
            </div>
          </motion.div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="bg-zinc-900/20 border border-primary/6 rounded-none sm:rounded-3xl p-4 sm:p-5 md:p-6 flex flex-col h-[380px]"
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
          <div className="text-center py-32 bg-linear-to-b from-transparent to-foreground/[0.02] border border-foreground/5 rounded-none">
            <div className="w-20 h-20 mx-auto bg-foreground/[0.03] rounded-none flex items-center justify-center mb-6 ring-1 ring-white/10 shadow-[0_0_30px_rgba(255,255,255,0.02)]">
              <Package className="w-8 h-8 text-zinc-500" />
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
          <div className="text-center py-32 bg-linear-to-b from-transparent to-foreground/[0.02] border border-foreground/5 rounded-none">
            <div className="w-20 h-20 mx-auto bg-foreground/[0.03] rounded-none flex items-center justify-center mb-6 ring-1 ring-white/10">
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
              className="inline-flex items-center gap-2 bg-card text-primary-foreground px-6 py-3 text-[10px] uppercase font-bold tracking-widest hover:bg-zinc-200 transition-colors"
            >
              <X className="w-3 h-3" /> {isUa ? "Скинути фільтри" : "Clear filters"}
            </button>
          </div>
        ) : (
          <>
            {/* Results count & Select All */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 border-b border-foreground/5 pb-4">
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
                      className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-2 cursor-pointer border border-emerald-500/25 bg-emerald-500/5 px-4 py-2 rounded-none hover:bg-emerald-500/10 active:scale-95 transition-all flex-1 sm:flex-none justify-center disabled:opacity-50"
                    >
                      {selectingAll ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {items.map((item) => {
                  const msrp = item.originalPrice || (item.price ? item.price * 1.3 : null);
                  const dealerPrice = item.price;

                  return (
                    <motion.div
                      layout
                      key={item.id}
                      className="group relative flex flex-col rounded-none sm:rounded-none border border-primary/6 bg-zinc-900/20 backdrop-blur-xs p-4 sm:p-5 md:p-6 hover:bg-zinc-900/40 hover:border-foreground/10 transition-all duration-500 hover:shadow-[0_0_50px_rgba(0,0,0,0.3)]"
                    >
                      {/* Selection Checkbox */}
                      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-30">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleToggleSelectItem(item);
                          }}
                          className={`w-6 h-6 rounded-none border flex items-center justify-center transition-all cursor-pointer ${
                            selectedItems.some((x) => x.id === item.id)
                              ? "bg-white border-white text-black shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                              : "border-foreground/15 bg-black/40 hover:border-foreground/30 text-transparent hover:text-foreground/25"
                          }`}
                        >
                          <Check className="w-3 h-3 stroke-[3px]" />
                        </button>
                      </div>

                      {/* Status Badges */}
                      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 flex flex-col gap-2">
                        {SHOW_STOCK_BADGE && item.inStock && (
                          <div className="px-2 py-1 rounded-none bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md">
                            <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              {isUa ? "В наявності" : "In Stock"}
                            </span>
                          </div>
                        )}
                        {(make || model || chassis) && (
                          <div className="px-2 py-1 rounded-none bg-white/5 border border-white/20 backdrop-blur-md">
                            <span className="text-[8px] font-bold text-white uppercase tracking-widest flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" />
                              {isUa ? "Підходить" : "Fits"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Link wrapping Image & Titles */}
                      <Link
                        href={`/${locale}/shop/${item.slug}`}
                        className="flex-1 flex flex-col cursor-pointer"
                      >
                        {/* Image Container */}
                        <div className="aspect-square rounded-none bg-foreground/[0.03] mb-6 flex items-center justify-center overflow-hidden relative group-hover:bg-foreground/5 transition-colors">
                          <SafeProductImage
                            src={item.thumbnail}
                            alt={item.name}
                            className="w-full h-full object-contain p-6 group-hover:scale-110 transition-transform duration-700 ease-out"
                          />
                        </div>

                        {/* Brand & Name */}
                        <div className="flex-1 space-y-2 mb-6">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                              {item.brand}
                            </span>
                            <SkuCopy sku={item.partNumber} isUa={isUa} />
                          </div>
                          {item.category && (
                            <div className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider">
                              {item.category}
                            </div>
                          )}
                          <h3 className="text-sm font-medium text-foreground leading-snug line-clamp-2 group-hover:text-white transition-colors">
                            {item.name}
                          </h3>
                        </div>
                      </Link>

                      {/* Pricing Block */}
                      <div className="space-y-4 pt-4 border-t border-foreground/5">
                        {isB2B ? (
                          <>
                            <div className="flex flex-row flex-wrap items-end justify-between gap-2">
                              <div className="space-y-1">
                                <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">
                                  {isUa ? "РРЦ (MSRP)" : "MSRP"}
                                </div>
                                <div className="text-sm text-zinc-500 line-through font-mono">
                                  ${msrp?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </div>
                              </div>
                              <div className="text-right space-y-1">
                                <div className="text-[9px] uppercase tracking-widest text-emerald-500 font-bold">
                                  {isUa ? "Ваша Ціна" : "Dealer Price"}
                                </div>
                                <div className="text-2xl font-light text-foreground tracking-tight font-mono">
                                  $
                                  {dealerPrice?.toLocaleString(undefined, {
                                    maximumFractionDigits: 0,
                                  })}
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-row flex-wrap items-end justify-between gap-2">
                            <div className="space-y-1">
                              <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">
                                {isUa ? "Ціна" : "Price"}
                              </div>
                              <div className="text-2xl font-light text-foreground tracking-tight font-mono">
                                $
                                {dealerPrice?.toLocaleString(undefined, {
                                  maximumFractionDigits: 0,
                                })}
                              </div>
                            </div>
                          </div>
                        )}

                        <AddToCartButton
                          slug={item.slug}
                          variantId={item.variantId}
                          locale={locale as string}
                          variant="minimal"
                          label={
                            isB2B
                              ? isUa
                                ? "Додати до замовлення"
                                : "Add to Order"
                              : isUa
                                ? "Додати в кошик"
                                : "Add to Cart"
                          }
                          labelAdded={
                            isB2B
                              ? isUa
                                ? "В замовленні ✓"
                                : "In Order ✓"
                              : isUa
                                ? "В кошику ✓"
                                : "In Cart ✓"
                          }
                          className="w-full h-12 rounded-none bg-card text-primary-foreground text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              /* Premium B2B Table/List Layout */
              <div className="space-y-4">
                {/* Desktop View */}
                <div className="hidden md:block w-full border border-foreground/10 bg-zinc-900/10 backdrop-blur-xs">
                  {/* Table Header */}
                  <div className="grid grid-cols-[auto_80px_140px_1fr_120px_160px_160px] items-center gap-4 px-6 py-3 border-b border-foreground/10 text-[10px] uppercase tracking-widest font-bold text-zinc-500">
                    <div className="w-6" /> {/* Checkbox placeholder */}
                    <div>{isUa ? "Фото" : "Image"}</div>
                    <div>{isUa ? "Бренд / Артикул" : "Brand / SKU"}</div>
                    <div>{isUa ? "Назва деталі" : "Product Name"}</div>
                    <div className="text-center">{isUa ? "Наявність" : "Availability"}</div>
                    <div className="text-right">
                      {isB2B ? (isUa ? "РРЦ / Дилер" : "MSRP / Dealer") : isUa ? "Ціна" : "Price"}
                    </div>
                    <div className="text-right">{isUa ? "Дія" : "Action"}</div>
                  </div>
                  {/* Table Rows */}
                  <div className="divide-y divide-foreground/5">
                    {items.map((item) => {
                      const msrp = item.originalPrice || (item.price ? item.price * 1.3 : null);
                      const dealerPrice = item.price;
                      const isSelected = selectedItems.some((x) => x.id === item.id);

                      return (
                        <div
                          key={item.id}
                          className={`grid grid-cols-[auto_80px_140px_1fr_120px_160px_160px] items-center gap-4 px-6 py-4 hover:bg-foreground/[0.02] transition-all duration-300 border-l-2 ${
                            isSelected ? "border-l-white bg-white/[0.02]" : "border-l-transparent"
                          }`}
                        >
                          {/* Checkbox */}
                          <div className="flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => handleToggleSelectItem(item)}
                              className={`w-5 h-5 rounded-none border flex items-center justify-center transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-white border-white text-black shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                                  : "border-foreground/15 bg-black/40 hover:border-foreground/30 text-transparent hover:text-foreground/25"
                              }`}
                            >
                              <Check className="w-3 h-3 stroke-[3px]" />
                            </button>
                          </div>

                          {/* Thumbnail Image */}
                          <div className="w-14 h-14 bg-foreground/[0.03] flex items-center justify-center overflow-hidden border border-foreground/5">
                            <SafeProductImage
                              src={item.thumbnail}
                              alt={item.name}
                              className="w-full h-full object-contain p-2 hover:scale-110 transition-transform duration-500"
                              isMini
                            />
                          </div>

                          {/* Brand & Part Number */}
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider truncate">
                              {item.brand}
                            </span>
                            <SkuCopy sku={item.partNumber} isUa={isUa} />
                          </div>

                          {/* Product Title & Category */}
                          <div className="flex flex-col gap-1 min-w-0 pr-4">
                            {item.category && (
                              <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">
                                {item.category}
                              </span>
                            )}
                            <Link
                              href={`/${locale}/shop/${item.slug}`}
                              className="text-sm font-medium text-foreground hover:text-white transition-colors truncate block"
                              title={item.name}
                            >
                              {item.name}
                            </Link>
                          </div>

                          {/* Stock Status & Fitment */}
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            {item.inStock ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-none bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400 uppercase tracking-widest">
                                <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                                {isUa ? "Склад" : "Stock"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-none bg-zinc-500/10 border border-zinc-500/20 text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                                {isUa ? "Немає" : "Out"}
                              </span>
                            )}
                            {(make || model || chassis) && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-none bg-white/5 border border-white/20 text-[8px] font-bold text-white uppercase tracking-widest">
                                <Check className="w-2 h-2" />
                                {isUa ? "Підходить" : "Fits"}
                              </span>
                            )}
                          </div>

                          {/* Pricing */}
                          <div className="text-right">
                            {isB2B ? (
                              <div className="flex flex-col items-end gap-0.5 font-mono">
                                <span className="text-[10px] text-zinc-500 line-through">
                                  ${msrp?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                                <span className="text-base font-semibold text-emerald-400">
                                  $
                                  {dealerPrice?.toLocaleString(undefined, {
                                    maximumFractionDigits: 0,
                                  })}
                                </span>
                              </div>
                            ) : (
                              <div className="font-mono text-base text-foreground">
                                $
                                {dealerPrice?.toLocaleString(undefined, {
                                  maximumFractionDigits: 0,
                                })}
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
                              label={isB2B ? (isUa ? "Додати" : "Add") : isUa ? "Кошик" : "Cart"}
                              labelAdded={
                                isB2B
                                  ? isUa
                                    ? "Додано ✓"
                                    : "Added ✓"
                                  : isUa
                                    ? "В кошику ✓"
                                    : "In Cart ✓"
                              }
                              className="h-9 w-full rounded-none bg-card text-primary-foreground text-[10px] font-bold uppercase tracking-wider hover:bg-zinc-200 transition-all active:scale-95 flex items-center justify-center gap-1"
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
                    const msrp = item.originalPrice || (item.price ? item.price * 1.3 : null);
                    const dealerPrice = item.price;
                    const isSelected = selectedItems.some((x) => x.id === item.id);

                    return (
                      <div
                        key={item.id}
                        className={`relative flex flex-col p-4 rounded-none border border-foreground/10 bg-zinc-900/20 hover:bg-zinc-900/40 transition-all duration-300 ${
                          isSelected ? "border-l-2 border-l-white bg-white/[0.01]" : ""
                        }`}
                      >
                        {/* Top info row */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          {/* Checkbox and brand/SKU */}
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleToggleSelectItem(item)}
                              className={`w-5 h-5 rounded-none border flex items-center justify-center transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-white border-white text-black"
                                  : "border-foreground/15 bg-black/40 text-transparent"
                              }`}
                            >
                              <Check className="w-3 h-3 stroke-[3px]" />
                            </button>
                            <div className="flex flex-col">
                              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                                {item.brand}
                              </span>
                              <SkuCopy sku={item.partNumber} isUa={isUa} />
                            </div>
                          </div>

                          {/* Status/Badge */}
                          <div className="flex gap-1.5">
                            {item.inStock && (
                              <span className="px-1.5 py-0.5 rounded-none bg-emerald-500/10 border border-emerald-500/20 text-[7px] font-bold text-emerald-400 uppercase tracking-wider">
                                {isUa ? "В наявності" : "Stock"}
                              </span>
                            )}
                            {(make || model || chassis) && (
                              <span className="px-1.5 py-0.5 rounded-none bg-white/5 border border-white/20 text-[7px] font-bold text-white uppercase tracking-wider">
                                {isUa ? "Підходить" : "Fits"}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Middle row: Name & Thumbnail */}
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 bg-foreground/[0.03] flex items-center justify-center overflow-hidden shrink-0 border border-foreground/5">
                            <SafeProductImage
                              src={item.thumbnail}
                              alt={item.name}
                              className="w-full h-full object-contain p-1.5"
                              isMini
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            {item.category && (
                              <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-wider">
                                {item.category}
                              </span>
                            )}
                            <Link
                              href={`/${locale}/shop/${item.slug}`}
                              className="text-xs font-medium text-foreground hover:text-white transition-colors line-clamp-2 leading-tight"
                            >
                              {item.name}
                            </Link>
                          </div>
                        </div>

                        {/* Bottom action row: Price & Buy button */}
                        <div className="flex items-center justify-between border-t border-foreground/5 pt-3 mt-auto">
                          <div>
                            {isB2B ? (
                              <div className="flex flex-row items-baseline gap-2 font-mono">
                                <span className="text-[10px] text-zinc-500 line-through">
                                  ${msrp?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                                <span className="text-sm font-semibold text-emerald-400">
                                  $
                                  {dealerPrice?.toLocaleString(undefined, {
                                    maximumFractionDigits: 0,
                                  })}
                                </span>
                              </div>
                            ) : (
                              <div className="font-mono text-sm text-foreground">
                                $
                                {dealerPrice?.toLocaleString(undefined, {
                                  maximumFractionDigits: 0,
                                })}
                              </div>
                            )}
                          </div>

                          <div className="w-32">
                            <AddToCartButton
                              slug={item.slug}
                              variantId={item.variantId}
                              locale={locale as string}
                              variant="minimal"
                              label={isB2B ? (isUa ? "Додати" : "Add") : isUa ? "Кошик" : "Cart"}
                              labelAdded={
                                isB2B
                                  ? isUa
                                    ? "Додано ✓"
                                    : "Added ✓"
                                  : isUa
                                    ? "В кошику ✓"
                                    : "In Cart ✓"
                              }
                              className="h-8 w-full rounded-none bg-card text-primary-foreground text-[9px] font-bold uppercase tracking-wider hover:bg-zinc-200 transition-all flex items-center justify-center"
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
                  className="text-[10px] uppercase tracking-widest text-foreground/60 dark:text-foreground/40 border border-foreground/10 px-4 py-2 hover:bg-foreground/5 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                >
                  ← {isUa ? "Назад" : "Prev"}
                </button>
                <span className="text-[10px] text-foreground/55 dark:text-foreground/30 uppercase tracking-widest px-4">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => doSearch(page + 1)}
                  className="text-[10px] uppercase tracking-widest text-foreground/60 dark:text-foreground/40 border border-foreground/10 px-4 py-2 hover:bg-foreground/5 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                >
                  {isUa ? "Далі" : "Next"} →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ════ FLOATING BATCH ACTIONS BAR ════ */}
      <AnimatePresence>
        {selectedItems.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0, x: "-50%" }}
            animate={{ y: 0, opacity: 1, x: "-50%" }}
            exit={{ y: 80, opacity: 0, x: "-50%" }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="fixed bottom-6 left-1/2 z-50 w-[92%] sm:w-auto max-w-4xl -translate-x-1/2 rounded-none border border-[#c5a880]/30 bg-[#0a0a0c]/85 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-t-white/30"
          >
            {/* Left: item count & bulk clear */}
            <div className="flex items-center gap-4">
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                  {isUa ? "Вибрані товари" : "Selected Items"}
                </div>
                <div className="text-lg font-light text-foreground flex items-center gap-2">
                  <span className="font-semibold text-white">{selectedItems.length}</span>
                  <span className="text-zinc-500 text-xs">{isUa ? "дет." : "pcs."}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItems([])}
                className="h-8 px-3 rounded-none border border-foreground/10 hover:bg-foreground/5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-foreground transition-all shrink-0"
              >
                {isUa ? "Очистити" : "Clear"}
              </button>
            </div>

            {/* Middle: calculations (Dealer/MSRP/Profit if B2B) */}
            <div className="flex flex-wrap items-center gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-foreground/5">
              {isB2B ? (
                <>
                  <div className="space-y-0.5">
                    <div className="text-[8px] uppercase font-bold tracking-widest text-zinc-500">
                      {isUa ? "Сума РРЦ (MSRP)" : "Total MSRP"}
                    </div>
                    <div className="text-sm font-mono text-zinc-400 line-through">
                      $
                      {selectedItems
                        .reduce((acc, curr) => {
                          const m = curr.originalPrice || (curr.price ? curr.price * 1.3 : 0);
                          return acc + m;
                        }, 0)
                        .toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="text-[8px] uppercase font-bold tracking-widest text-white">
                      {isUa ? "Сума B2B Partner" : "Total Dealer"}
                    </div>
                    <div className="text-sm font-mono text-white font-bold">
                      $
                      {selectedItems
                        .reduce((acc, curr) => acc + (curr.price || 0), 0)
                        .toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-0.5">
                  <div className="text-[8px] uppercase font-bold tracking-widest text-zinc-400">
                    {isUa ? "Загальна сума" : "Total Price"}
                  </div>
                  <div className="text-lg font-mono text-foreground font-light">
                    $
                    {selectedItems
                      .reduce((acc, curr) => acc + (curr.price || 0), 0)
                      .toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
              <button
                type="button"
                onClick={() => handleExportCSV(selectedItems)}
                className="flex-1 md:flex-none h-11 px-4 rounded-none border border-zinc-700 bg-zinc-900/40 hover:bg-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-300 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {isUa ? "Експорт CSV" : "Export CSV"}
              </button>

              <button
                type="button"
                onClick={handleBulkAddToCart}
                disabled={bulkAdding}
                className="flex-1 md:flex-none h-11 px-6 rounded-none bg-[#c5a880] text-white hover:bg-[#b0926a] disabled:opacity-50 text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(197,168,128,0.3)] hover:shadow-[0_0_25px_rgba(197,168,128,0.5)] border border-white/20"
              >
                {bulkAdding ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : bulkAdded ? (
                  <span>{isUa ? "Товари додано! ✓" : "Items added! ✓"}</span>
                ) : (
                  <span>
                    {isB2B
                      ? isUa
                        ? "Додати до замовлення"
                        : "Add Selected to Order"
                      : isUa
                        ? "Додати вибрані в кошик"
                        : "Add Selected to Cart"}
                  </span>
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
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0c]" />}>
      <StockPageContent />
    </Suspense>
  );
}
