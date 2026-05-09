"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search,
  ChevronDown,
  ShoppingCart,
  Package,
  Loader2,
  X,
  Check,
  Layers,
  Car,
  RotateCcw,
} from "lucide-react";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { motion } from "framer-motion";
import { SHOW_STOCK_BADGE } from "@/lib/shopStockUi";

type StockSource = "turn14" | "local" | "all";

type StockItem = {
  id: string;
  name: string;
  brand: string;
  partNumber: string;
  description: string;
  thumbnail: string | null;
  inStock: boolean;
  price: number | null;
  originalPrice?: number | null;
  basePrice: number;
  markupPct: number;
  turn14Id: string;
  dimensions?: { length: number; width: number; height: number; weight: number }[];
};

type FitmentData = { type: string; data: string[] };

type DealerData = {
  name: string;
  tier: "SILVER" | "GOLD" | "VIP";
  discountPct: number;
  creditLimit: number;
  balance: number;
  activeOrders: number;
};

/* ========= B2B Dealer Header ========= */
function DealerDashboardHeader({ data, isUa }: { data: DealerData; isUa: boolean }) {
  const tierColors = {
    SILVER: "text-zinc-400 border-zinc-500/20 bg-zinc-500/5",
    GOLD: "text-amber-400 border-amber-500/20 bg-amber-500/5",
    VIP: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-360 mx-auto px-6 mb-8"
    >
      <div className="relative group overflow-hidden rounded-[32px] border border-foreground/10 bg-foreground/[0.03] backdrop-blur-3xl p-8 shadow-2xl">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] pointer-events-none group-hover:bg-indigo-500/10 transition-all duration-700" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          {/* Welcome & Tier */}
          <div className="space-y-3">
            <div
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-bold tracking-[0.2em] uppercase ${tierColors[data.tier]}`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              Dealer Tier: {data.tier}
            </div>
            <h2 className="text-3xl md:text-4xl font-light tracking-tight text-foreground">
              {isUa ? "Вітаємо," : "Welcome,"} <span className="font-medium">{data.name}</span>
            </h2>
            <p className="text-zinc-500 text-sm font-light">
              {isUa
                ? "Ваш персональний B2B портал складу та логістики."
                : "Your personalized B2B stock and logistics portal."}
            </p>
          </div>

          {/* Financial Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-8 border-t lg:border-t-0 lg:border-l border-foreground/5 pt-8 lg:pt-0 lg:pl-12">
            <div>
              <div className="text-[9px] uppercase tracking-widest text-zinc-500 mb-1">
                {isUa ? "Ваша знижка" : "Your Discount"}
              </div>
              <div className="text-2xl font-light text-emerald-400">{data.discountPct}%</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-widest text-zinc-500 mb-1">
                {isUa ? "Кредитний ліміт" : "Credit Limit"}
              </div>
              <div className="text-2xl font-light text-foreground">
                ${data.creditLimit.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-widest text-zinc-500 mb-1">
                {isUa ? "Баланс" : "Balance"}
              </div>
              <div className="text-2xl font-light text-rose-400">
                -${Math.abs(data.balance).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-widest text-zinc-500 mb-1">
                {isUa ? "В роботі" : "Active Orders"}
              </div>
              <div className="text-2xl font-light text-indigo-400">{data.activeOrders}</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ========= Custom Combobox Component ========= */
function Combobox({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  loading = false,
  isSelected = false,
}: {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  disabled?: boolean;
  loading?: boolean;
  isSelected?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = filter
    ? options.filter((o) => o.toLowerCase().includes(filter.toLowerCase()))
    : options;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // When value changes externally (reset), clear filter
  useEffect(() => {
    if (!value) setFilter("");
  }, [value]);

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <div
        className={`flex items-center border transition-all h-10 ${
          disabled
            ? "bg-transparent border-foreground/5 cursor-not-allowed opacity-30 text-foreground/55 dark:text-foreground/30"
            : open
              ? "bg-[#111] border-foreground/30"
              : isSelected
                ? "bg-[#111] border-red-500/40 text-foreground"
                : "bg-transparent border-foreground/10 hover:border-foreground/20 cursor-pointer text-foreground/85 dark:text-foreground/70"
        }`}
        onClick={() => {
          if (disabled) return;
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
      >
        {isSelected && <Check className="w-3.5 h-3.5 text-red-500 ml-3 shrink-0" />}
        <input
          ref={inputRef}
          type="text"
          value={open ? filter : value || ""}
          onChange={(e) => {
            setFilter(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-transparent text-xs text-foreground placeholder-white/30 focus:outline-hidden py-1.5 px-2.5 tracking-wide cursor-pointer disabled:cursor-not-allowed"
          readOnly={!open}
        />
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 text-foreground/55 dark:text-foreground/30 mr-3 shrink-0 animate-spin" />
        ) : (
          <ChevronDown
            className={`w-3.5 h-3.5 text-foreground/55 dark:text-foreground/30 mr-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </div>

      {open && !disabled && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#0a0a0c] border border-foreground/10 max-h-64 overflow-y-auto shadow-2xl">
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`w-full text-left text-sm px-4 py-2.5 transition-colors ${
                value === opt
                  ? "bg-foreground/10 text-foreground font-medium"
                  : "text-foreground/85 dark:text-foreground/70 hover:bg-card/6 hover:text-foreground"
              }`}
              onClick={() => {
                onChange(opt);
                setFilter("");
                setOpen(false);
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ========= Main Stock Page ========= */
function StockPageContent() {
  const { locale } = useParams();
  const isUa = locale === "ua";
  const searchParams = useSearchParams();

  // Search state
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);

  // Mock Dealer Data (in production this would come from a session/context)
  const [dealer] = useState<DealerData>({
    name: "Top Level Tuning",
    tier: "VIP",
    discountPct: 25,
    creditLimit: 50000,
    balance: -12450,
    activeOrders: 4,
  });

  // Distributor source tab
  const initialSource = (searchParams.get("source") || "turn14") as StockSource;
  const initTab = initialSource === "local" ? "local" : initialSource === "all" ? "all" : "turn14";
  const [activeTab, setActiveTab] = useState<string>(initTab);
  const [source, setSource] = useState<StockSource>(
    initialSource === "local" || initialSource === "all" ? initialSource : "turn14"
  );
  const [activeDistributor, setActiveDistributor] = useState<string>("");
  const [localCategory, setLocalCategory] = useState("");
  const [localCategories, setLocalCategories] = useState<string[]>([]);
  const [localBrands, setLocalBrands] = useState<string[]>([]);
  const [distributors, setDistributors] = useState<{ name: string; count: number }[]>([]);
  const totalLocalCount = distributors.reduce((sum, d) => sum + d.count, 0);
  const displayCount = activeDistributor
    ? distributors.find((d) => d.name === activeDistributor)?.count || 0
    : totalLocalCount;

  // Vehicle fitment state
  const [years, setYears] = useState<string[]>([]);
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [submodels, setSubmodels] = useState<string[]>([]);
  const [makesLoading, setMakesLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [submodelsLoading, setSubmodelsLoading] = useState(false);

  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [submodel, setSubmodel] = useState("");

  // Vehicle selected state (locked in)
  const [vehicleLocked, setVehicleLocked] = useState(false);

  // Brand state
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [brand, setBrand] = useState("");

  // Load initial data
  useEffect(() => {
    Promise.all([
      fetch("/api/shop/turn14/fitment").then((r) => r.json()),
      fetch("/api/shop/turn14/brands").then((r) => r.json()),
      fetch("/api/shop/stock/stats")
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(([fitmentRes, brandsRes, stockStats]) => {
        setYears(fitmentRes.data || []);
        setBrands(brandsRes.data || []);
        if (stockStats?.distributors?.length > 0) {
          setDistributors(stockStats.distributors);
          // If initial tab was 'local' but no specific distributor, optionally default to the first one
          if (initTab === "local" && activeDistributor === "") {
            setActiveTab(`local_${stockStats.distributors[0].name}`);
            setActiveDistributor(stockStats.distributors[0].name);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Cascading: Year → Makes
  useEffect(() => {
    if (!year) {
      setMakes([]);
      setMake("");
      return;
    }
    setMakesLoading(true);
    fetch(`/api/shop/turn14/fitment?year=${year}`)
      .then((r) => r.json())
      .then((res) => setMakes(res.data || []))
      .catch(() => {})
      .finally(() => setMakesLoading(false));
    setMake("");
    setModel("");
    setSubmodel("");
    setModels([]);
    setSubmodels([]);
  }, [year]);

  // Cascading: Make → Models
  useEffect(() => {
    if (!year || !make) {
      setModels([]);
      setModel("");
      return;
    }
    setModelsLoading(true);
    fetch(`/api/shop/turn14/fitment?year=${year}&make=${encodeURIComponent(make)}`)
      .then((r) => r.json())
      .then((res) => setModels(res.data || []))
      .catch(() => {})
      .finally(() => setModelsLoading(false));
    setModel("");
    setSubmodel("");
    setSubmodels([]);
  }, [year, make]);

  // Cascading: Model → Submodels
  useEffect(() => {
    if (!year || !make || !model) {
      setSubmodels([]);
      setSubmodel("");
      return;
    }
    setSubmodelsLoading(true);
    fetch(
      `/api/shop/turn14/fitment?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`
    )
      .then((r) => r.json())
      .then((res) => setSubmodels(res.data || []))
      .catch(() => {})
      .finally(() => setSubmodelsLoading(false));
    setSubmodel("");
  }, [year, make, model]);

  // Search handler
  const doSearch = useCallback(
    async (searchPage = 1) => {
      if (!query && !brand && !year && !make && !model) {
        setHasSearched(false);
        setItems([]);
        setTotalPages(1);
        return;
      }

      setLoading(true);
      setError("");
      setHasSearched(true);

      const params = new URLSearchParams();
      params.set("source", source);
      if (source === "local" && activeDistributor) {
        params.set("distributor", activeDistributor);
      }
      if (query) params.set("q", query);
      if (brand) params.set("brand", brand);
      if (localCategory) params.set("category", localCategory);

      if (source === "turn14" || source === "all") {
        if (year) params.set("year", year);
        if (make) params.set("make", make);
        if (model) params.set("model", model);
        if (submodel) params.set("submodel", submodel);
      }
      params.set("page", searchPage.toString());

      try {
        const res = await fetch(`/api/shop/stock/search?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setItems(data.data || []);
        setTotalPages(data.meta?.totalPages || data.pagination?.totalPages || 1);
        setPage(searchPage);
        if (data.filters) {
          setLocalCategories(data.filters.categories || []);
          setLocalBrands(data.filters.brands || []);
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [query, brand, year, make, model, submodel, source, localCategory]
  );

  // Auto-search when vehicle is locked
  useEffect(() => {
    if (!vehicleLocked) return;
    doSearch(1);
  }, [vehicleLocked, doSearch]);

  // Auto-search for text/brand changes
  useEffect(() => {
    if (!vehicleLocked && !brand && !query) return;
    const t = setTimeout(() => doSearch(1), 600);
    return () => clearTimeout(t);
  }, [brand, query, doSearch, vehicleLocked]);

  function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (year && make) setVehicleLocked(true);
    doSearch(1);
  }

  function handleResetVehicle() {
    setVehicleLocked(false);
    setYear("");
    setMake("");
    setModel("");
    setSubmodel("");
    setBrand("");
    setQuery("");
    setHasSearched(false);
    setItems([]);
    setTotalPages(1);
  }

  function handleChangeVehicle() {
    setVehicleLocked(false);
  }

  const vehicleText = [year, make, model, submodel].filter(Boolean).join(" · ");

  return (
    <div className="min-h-screen bg-[#050505] text-foreground selection:bg-red-500/30">
      {/* ════ B2B DEALER HUB ════ */}
      <div className="pt-32 pb-6 relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] max-w-[1400px] h-[500px] bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.02] pointer-events-none mix-blend-screen" />

        <DealerDashboardHeader data={dealer} isUa={isUa} />
      </div>

      {/* ════ MY GARAGE (FITMENT) ════ */}
      <div className="max-w-360 mx-auto px-6 mb-12">
        <div className="relative group overflow-hidden rounded-[40px] border border-foreground/10 bg-card/70 dark:bg-background/40 backdrop-blur-3xl p-10">
          <div className="absolute top-0 left-0 w-full h-full bg-linear-to-br from-indigo-500/3 to-transparent pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Car className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-xl font-light tracking-tight text-foreground">
                  {isUa ? "Мій Гараж" : "My Garage"}
                </h3>
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold">
                  Select a vehicle to find guaranteed fits
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-end gap-6">
              {/* Year */}
              <div className="w-full md:w-40 shrink-0">
                <div className="text-[9px] uppercase tracking-widest text-zinc-500 mb-2 ml-1 font-bold">
                  {isUa ? "Рік" : "Year"}
                </div>
                <Combobox
                  options={years}
                  value={year}
                  onChange={setYear}
                  placeholder="2024"
                  isSelected={!!year}
                />
              </div>

              {/* Make */}
              <div className="w-full md:flex-1 min-w-0">
                <div className="text-[9px] uppercase tracking-widest text-zinc-500 mb-2 ml-1 font-bold">
                  {isUa ? "Марка" : "Make"}
                </div>
                <Combobox
                  options={makes}
                  value={make}
                  onChange={setMake}
                  placeholder="Porsche"
                  disabled={!year}
                  loading={makesLoading}
                  isSelected={!!make}
                />
              </div>

              {/* Model */}
              <div className="w-full md:flex-1 min-w-0">
                <div className="text-[9px] uppercase tracking-widest text-zinc-500 mb-2 ml-1 font-bold">
                  {isUa ? "Модель" : "Model"}
                </div>
                <Combobox
                  options={models}
                  value={model}
                  onChange={setModel}
                  placeholder="911 GT3"
                  disabled={!make}
                  loading={modelsLoading}
                  isSelected={!!model}
                />
              </div>

              {/* Engine / Submodel */}
              {submodels.length > 0 && (
                <div className="w-full md:flex-1 min-w-0">
                  <div className="text-[9px] uppercase tracking-widest text-zinc-500 mb-2 ml-1 font-bold">
                    {isUa ? "Двигун" : "Engine"}
                  </div>
                  <Combobox
                    options={submodels}
                    value={submodel}
                    onChange={setSubmodel}
                    placeholder="4.0L H6"
                    loading={submodelsLoading}
                    isSelected={!!submodel}
                  />
                </div>
              )}

              {/* Apply / Action */}
              <button
                onClick={handleSearch}
                disabled={!year || !make}
                className="w-full md:w-auto h-10 px-10 rounded-xl bg-card text-primary-foreground text-[11px] font-bold uppercase tracking-widest hover:bg-zinc-200 transition-all disabled:opacity-20 flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                {isUa ? "Застосувати" : "Filter Items"}
              </button>
            </div>

            {vehicleLocked && (
              <div className="mt-6 flex items-center justify-between pt-6 border-t border-foreground/5">
                <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
                  <Check className="w-4 h-4" />
                  Active Fitment: {vehicleText}
                </div>
                <button
                  onClick={handleResetVehicle}
                  className="text-[10px] text-zinc-500 hover:text-foreground transition-colors uppercase tracking-widest font-bold underline decoration-indigo-500/30 underline-offset-4"
                >
                  Reset Vehicle
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ════ SOURCE TABS + SEARCH BAR ════ */}
      <div className="max-w-360 mx-auto px-6 pt-5 pb-3">
        <div className="flex flex-col xl:flex-row items-start xl:items-center gap-6">
          {/* Source tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 xl:pb-0 no-scrollbar">
            {[
              {
                id: "turn14",
                source: "turn14" as StockSource,
                label: "Turn14 Global",
                count: undefined,
                distributor: undefined,
              },
              ...distributors.map((d) => ({
                id: `local_${d.name}`,
                source: "local" as StockSource,
                label: d.name,
                count: d.count,
                distributor: d.name,
              })),
              {
                id: "all",
                source: "all" as StockSource,
                label: isUa ? "Усі склади" : "All Stock",
                count: undefined,
                distributor: undefined,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setSource(tab.source);
                  setActiveDistributor(tab.distributor || "");
                  setItems([]);
                  setHasSearched(false);
                  setLocalCategory("");
                  setBrand("");
                }}
                className={`relative px-4 py-2 text-[10px] font-bold uppercase tracking-[0.15em] transition-all border shrink-0 rounded-xl flex items-center gap-2 ${
                  activeTab === tab.id
                    ? "bg-card text-primary-foreground border-primary shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                    : "bg-foreground/[0.03] text-zinc-500 border-foreground/5 hover:border-foreground/20 hover:text-foreground"
                }`}
              >
                {tab.label}
                {tab.count != null && tab.count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[9px] ${
                      activeTab === tab.id
                        ? "bg-card/30 dark:bg-background/10 text-primary-foreground/60"
                        : "bg-foreground/5 text-zinc-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -bottom-px left-4 right-4 h-[2px] bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                  />
                )}
              </button>
            ))}
          </div>

          {/* Inline search + brand */}
          <form
            onSubmit={handleSearch}
            className="flex-1 w-full flex flex-col sm:flex-row items-center gap-3"
          >
            <div className="flex-1 w-full flex items-center rounded-2xl border border-foreground/10 bg-foreground/[0.03] focus-within:border-indigo-500/50 focus-within:bg-foreground/5 transition-all h-11 px-4">
              <Search className="w-4 h-4 text-zinc-500 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  isUa ? "Пошук за артикулом або назвою..." : "Search by Part Number or name..."
                }
                className="w-full bg-transparent text-sm text-foreground placeholder-zinc-600 focus:outline-hidden px-3 tracking-wide"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                  }}
                  className="p-1 text-zinc-500 hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="flex-1 sm:flex-none bg-foreground/[0.03] border border-foreground/10 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-zinc-400 h-11 px-4 appearance-none cursor-pointer focus:outline-hidden focus:border-indigo-500/50 min-w-[140px]"
              >
                <option value="" className="bg-[#121216]">
                  {isUa ? "Бренд" : "Brand"}
                </option>
                {(source === "local" ? localBrands : brands.map((b) => b.name)).map((b) => (
                  <option key={b} value={b} className="bg-[#121216]">
                    {b}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                disabled={loading}
                className="h-11 px-6 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-[10px] uppercase font-bold tracking-[0.2em] text-indigo-400 hover:bg-indigo-500 hover:text-foreground transition-all disabled:opacity-30 flex items-center gap-2 shrink-0"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                {isUa ? "Пошук" : "Search"}
              </button>
            </div>
          </form>
        </div>

        {/* Active filters bar */}
        {(year || make || brand || query) && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {year && (
              <span className="text-[9px] uppercase tracking-widest bg-foreground/5 border border-foreground/10 px-2.5 py-1 text-foreground/75 dark:text-foreground/60">
                {year}
              </span>
            )}
            {make && (
              <span className="text-[9px] uppercase tracking-widest bg-foreground/5 border border-foreground/10 px-2.5 py-1 text-foreground/75 dark:text-foreground/60">
                {make}
              </span>
            )}
            {model && (
              <span className="text-[9px] uppercase tracking-widest bg-foreground/5 border border-foreground/10 px-2.5 py-1 text-foreground/75 dark:text-foreground/60">
                {model}
              </span>
            )}
            {submodel && (
              <span className="text-[9px] uppercase tracking-widest bg-foreground/5 border border-foreground/10 px-2.5 py-1 text-foreground/75 dark:text-foreground/60">
                {submodel}
              </span>
            )}
            {brand && (
              <span className="text-[9px] uppercase tracking-widest bg-foreground/5 border border-foreground/10 px-2.5 py-1 text-foreground/75 dark:text-foreground/60">
                {brand}
              </span>
            )}
            {localCategory && (
              <span className="text-[9px] uppercase tracking-widest bg-foreground/5 border border-foreground/10 px-2.5 py-1 text-foreground/75 dark:text-foreground/60">
                {localCategory}
              </span>
            )}
            {query && (
              <span className="text-[9px] uppercase tracking-widest bg-foreground/5 border border-foreground/10 px-2.5 py-1 text-foreground/75 dark:text-foreground/60">
                &quot;{query}&quot;
              </span>
            )}
            <button
              onClick={handleResetVehicle}
              className="text-[9px] uppercase tracking-widest text-red-400/60 hover:text-red-400 border border-red-400/10 px-2.5 py-1 hover:border-red-400/30 transition-colors flex items-center gap-1"
            >
              <X className="w-2.5 h-2.5" /> {isUa ? "Скинути все" : "Reset all"}
            </button>
          </div>
        )}
      </div>

      {/* ════ RESULTS ════ */}
      <div className="max-w-360 mx-auto px-6 pb-32">
        {error && (
          <div className="bg-red-500/5 border border-red-500/20 text-red-400 p-4 mb-6 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-px bg-foreground/5 border border-foreground/5">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="bg-[#0a0a0c] p-5 flex flex-col h-[300px]">
                <div className="aspect-square bg-foreground/5 mb-3 animate-pulse rounded" />
                <div className="h-2 bg-foreground/5 animate-pulse w-10 mb-2" />
                <div className="h-4 bg-foreground/5 animate-pulse w-full mb-1" />
                <div className="h-4 bg-foreground/5 animate-pulse w-2/3 mb-3" />
                <div className="mt-auto flex items-center justify-between pt-3 border-t border-foreground/5">
                  <div className="h-5 bg-foreground/5 animate-pulse w-16" />
                  <div className="h-7 bg-foreground/5 animate-pulse w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : !hasSearched ? (
          <div className="text-center py-32 bg-linear-to-b from-transparent to-foreground/[0.02] border border-foreground/5 rounded-2xl">
            <div className="w-20 h-20 mx-auto bg-foreground/[0.03] rounded-full flex items-center justify-center mb-6 ring-1 ring-white/10 shadow-[0_0_30px_rgba(255,255,255,0.02)]">
              {source === "local" ? (
                <Package className="w-8 h-8 text-blue-400/50" />
              ) : (
                <Search className="w-8 h-8 text-red-500/50" />
              )}
            </div>
            <h3 className="text-xl font-light text-foreground mb-3 tracking-wide">
              {source === "local"
                ? isUa
                  ? "Каталог IND Distribution"
                  : "IND Distribution Catalog"
                : isUa
                  ? "Преміум дистриб'юторський каталог"
                  : "Premium Distributor Catalog"}
            </h3>
            <p className="text-foreground/60 dark:text-foreground/40 text-sm font-light max-w-md mx-auto leading-relaxed">
              {source === "local"
                ? isUa
                  ? `Введіть назву товару або артикул для пошуку.${displayCount ? ` ${displayCount} товарів у базі.` : ""}`
                  : `Enter a product name or SKU.${displayCount ? ` ${displayCount} products available.` : ""}`
                : isUa
                  ? "Введіть оригінальний артикул (PN) або оберіть бренд для швидкого доступу до сотень тисяч деталей."
                  : "Enter an original article number (PN) or select a brand for quick access to hundreds of thousands of parts."}
            </p>
          </div>
        ) : hasSearched && items.length === 0 ? (
          <div className="text-center py-32 bg-linear-to-b from-transparent to-foreground/[0.02] border border-foreground/5 rounded-2xl">
            <div className="w-20 h-20 mx-auto bg-foreground/[0.03] rounded-full flex items-center justify-center mb-6 ring-1 ring-white/10">
              <Package className="w-8 h-8 text-foreground/55 dark:text-foreground/30" />
            </div>
            <h3 className="text-xl font-light text-foreground mb-3 tracking-wide">
              {isUa ? "За вашим запитом нічого не знайдено" : "No results found"}
            </h3>
            <p className="text-foreground/60 dark:text-foreground/40 text-sm font-light mb-6">
              {isUa
                ? "Спробуйте змінити параметри або обрати інший автомобіль."
                : "Try different filters or another vehicle."}
            </p>
            <button
              onClick={handleResetVehicle}
              className="inline-flex items-center gap-2 bg-card text-primary-foreground px-6 py-3 text-[10px] uppercase font-bold tracking-widest hover:bg-zinc-200 transition-colors"
            >
              <X className="w-3 h-3" /> {isUa ? "Скинути фільтри" : "Clear filters"}
            </button>
          </div>
        ) : (
          <>
            {/* Results count */}
            <div className="flex justify-between items-center mb-4">
              <p className="text-[10px] uppercase tracking-widest text-foreground/55 dark:text-foreground/30">
                {items.length} {isUa ? "результатів" : "results"}{" "}
                {totalPages > 1 && `• ${isUa ? "Сторінка" : "Page"} ${page}/${totalPages}`}
              </p>
            </div>

            {/* Product Grid — full width */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {items.map((item) => {
                const msrp = item.originalPrice || (item.price ? item.price * 1.3 : null);
                const dealerPrice = item.price;
                const estimatedProfit = msrp && dealerPrice ? msrp - dealerPrice : null;

                return (
                  <motion.div
                    layout
                    key={item.id}
                    className="group relative flex flex-col rounded-[32px] border border-primary/6 bg-zinc-900/20 backdrop-blur-xs p-6 hover:bg-zinc-900/40 hover:border-foreground/10 transition-all duration-500 hover:shadow-[0_0_50px_rgba(0,0,0,0.3)]"
                  >
                    {/* Status Badges */}
                    <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
                      {SHOW_STOCK_BADGE && item.inStock && (
                        <div className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md">
                          <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                            <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                            {isUa ? "В наявності" : "In Stock"}
                          </span>
                        </div>
                      )}
                      {vehicleLocked && (
                        <div className="px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 backdrop-blur-md">
                          <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" />
                            {isUa ? "Гарантовано підходить" : "Guaranteed Fit"}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Image Container */}
                    <div className="aspect-square rounded-2xl bg-foreground/[0.03] mb-6 flex items-center justify-center overflow-hidden relative group-hover:bg-foreground/5 transition-colors">
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt={item.name}
                          className="w-full h-full object-contain p-6 group-hover:scale-110 transition-transform duration-700 ease-out"
                        />
                      ) : (
                        <Package className="w-16 h-16 text-foreground/5 opacity-20" />
                      )}
                    </div>

                    {/* Brand & Name */}
                    <div className="flex-1 space-y-2 mb-6">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                          {item.brand}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-600">
                          #{item.partNumber}
                        </span>
                      </div>
                      <h3 className="text-sm font-medium text-foreground leading-snug line-clamp-2 group-hover:text-indigo-300 transition-colors">
                        {item.name}
                      </h3>
                    </div>

                    {/* B2B Pricing Block */}
                    <div className="space-y-4 pt-4 border-t border-foreground/5">
                      <div className="flex items-end justify-between">
                        <div className="space-y-1">
                          <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">
                            {isUa ? "РРЦ (MSRP)" : "MSRP"}
                          </div>
                          <div className="text-sm text-zinc-500 line-through font-mono">
                            ${msrp?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="text-[9px] uppercase tracking-widest text-emerald-500 font-bold">
                            {isUa ? "Ваша Ціна" : "Dealer Price"}
                          </div>
                          <div className="text-2xl font-light text-foreground tracking-tight font-mono">
                            ${dealerPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>

                      {/* Profit Badge */}
                      {estimatedProfit && (
                        <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                          <span className="text-[9px] font-bold text-emerald-500/60 uppercase tracking-widest">
                            {isUa ? "Ваш прибуток" : "Your Profit"}
                          </span>
                          <span className="text-xs font-bold text-emerald-400 font-mono">
                            +$
                            {estimatedProfit.toLocaleString(undefined, {
                              minimumFractionDigits: 0,
                            })}
                          </span>
                        </div>
                      )}

                      <AddToCartButton
                        turn14Id={item.turn14Id || item.id}
                        locale={locale as string}
                        variant="minimal"
                        label={isUa ? "Додати до замовлення" : "Add to Order"}
                        labelAdded={isUa ? "В замовленні ✓" : "In Order ✓"}
                        className="w-full h-12 rounded-xl bg-card text-primary-foreground text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>

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
