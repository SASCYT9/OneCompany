'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, ChevronDown, ShoppingCart, Package, Loader2, X, Check, Layers, Car, RotateCcw } from 'lucide-react';
import { AddToCartButton } from '@/components/shop/AddToCartButton';

type StockSource = 'turn14' | 'local' | 'all';

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
  const [filter, setFilter] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = filter
    ? options.filter((o) => o.toLowerCase().includes(filter.toLowerCase()))
    : options;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // When value changes externally (reset), clear filter
  useEffect(() => {
    if (!value) setFilter('');
  }, [value]);

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <div
        className={`flex items-center border transition-all h-10 ${
          disabled
            ? 'bg-transparent border-white/5 cursor-not-allowed opacity-30 text-white/30'
            : open
            ? 'bg-[#111] border-white/30'
            : isSelected
            ? 'bg-[#111] border-red-500/40 text-white'
            : 'bg-transparent border-white/10 hover:border-white/20 cursor-pointer text-white/70'
        }`}
        onClick={() => {
          if (disabled) return;
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
      >
        {isSelected && (
          <Check className="w-3.5 h-3.5 text-red-500 ml-3 shrink-0" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={open ? filter : value || ''}
          onChange={(e) => {
            setFilter(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-transparent text-xs text-white placeholder-white/30 focus:outline-none py-1.5 px-2.5 tracking-wide cursor-pointer disabled:cursor-not-allowed"
          readOnly={!open}
        />
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 text-white/30 mr-3 shrink-0 animate-spin" />
        ) : (
          <ChevronDown className={`w-3.5 h-3.5 text-white/30 mr-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </div>

      {open && !disabled && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#0a0a0c] border border-white/10 max-h-64 overflow-y-auto shadow-2xl">
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`w-full text-left text-sm px-4 py-2.5 transition-colors ${
                value === opt
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
              }`}
              onClick={() => {
                onChange(opt);
                setFilter('');
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
  const isUa = locale === 'ua';
  const searchParams = useSearchParams();

  // Search state
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);

  // Distributor source tab
  const initialSource = (searchParams.get('source') || 'turn14') as StockSource;
  const initTab = initialSource === 'local' ? 'local' : (initialSource === 'all' ? 'all' : 'turn14');
  const [activeTab, setActiveTab] = useState<string>(initTab);
  const [source, setSource] = useState<StockSource>(initialSource === 'local' || initialSource === 'all' ? initialSource : 'turn14');
  const [activeDistributor, setActiveDistributor] = useState<string>('');
  const [localCategory, setLocalCategory] = useState('');
  const [localCategories, setLocalCategories] = useState<string[]>([]);
  const [localBrands, setLocalBrands] = useState<string[]>([]);
  const [distributors, setDistributors] = useState<{name: string, count: number}[]>([]);
  const totalLocalCount = distributors.reduce((sum, d) => sum + d.count, 0);
  const displayCount = activeDistributor ? (distributors.find(d => d.name === activeDistributor)?.count || 0) : totalLocalCount;


  // Vehicle fitment state
  const [years, setYears] = useState<string[]>([]);
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [submodels, setSubmodels] = useState<string[]>([]);
  const [makesLoading, setMakesLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [submodelsLoading, setSubmodelsLoading] = useState(false);

  const [year, setYear] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [submodel, setSubmodel] = useState('');

  // Vehicle selected state (locked in)
  const [vehicleLocked, setVehicleLocked] = useState(false);

  // Brand state
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [brand, setBrand] = useState('');

  // Load initial data
  useEffect(() => {
    Promise.all([
      fetch('/api/shop/turn14/fitment').then(r => r.json()),
      fetch('/api/shop/turn14/brands').then(r => r.json()),
      fetch('/api/admin/stock/import').then(r => r.json()).catch(() => null),
    ]).then(([fitmentRes, brandsRes, stockStats]) => {
      setYears(fitmentRes.data || []);
      setBrands(brandsRes.data || []);
      if (stockStats?.distributors?.length > 0) {
        setDistributors(stockStats.distributors);
        // If initial tab was 'local' but no specific distributor, optionally default to the first one
        if (initTab === 'local' && activeDistributor === '') {
          setActiveTab(`local_${stockStats.distributors[0].name}`);
          setActiveDistributor(stockStats.distributors[0].name);
        }
      }
    }).catch(console.error);
  }, []);

  // Cascading: Year → Makes
  useEffect(() => {
    if (!year) { setMakes([]); setMake(''); return; }
    setMakesLoading(true);
    fetch(`/api/shop/turn14/fitment?year=${year}`)
      .then(r => r.json())
      .then(res => setMakes(res.data || []))
      .catch(console.error)
      .finally(() => setMakesLoading(false));
    setMake(''); setModel(''); setSubmodel('');
    setModels([]); setSubmodels([]);
  }, [year]);

  // Cascading: Make → Models
  useEffect(() => {
    if (!year || !make) { setModels([]); setModel(''); return; }
    setModelsLoading(true);
    fetch(`/api/shop/turn14/fitment?year=${year}&make=${encodeURIComponent(make)}`)
      .then(r => r.json())
      .then(res => setModels(res.data || []))
      .catch(console.error)
      .finally(() => setModelsLoading(false));
    setModel(''); setSubmodel(''); setSubmodels([]);
  }, [year, make]);

  // Cascading: Model → Submodels
  useEffect(() => {
    if (!year || !make || !model) { setSubmodels([]); setSubmodel(''); return; }
    setSubmodelsLoading(true);
    fetch(`/api/shop/turn14/fitment?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`)
      .then(r => r.json())
      .then(res => setSubmodels(res.data || []))
      .catch(console.error)
      .finally(() => setSubmodelsLoading(false));
    setSubmodel('');
  }, [year, make, model]);


  // Search handler
  const doSearch = useCallback(async (searchPage = 1) => {
    if (!query && !brand && !year && !make && !model) {
      setHasSearched(false);
      setItems([]);
      setTotalPages(1);
      return;
    }

    setLoading(true);
    setError('');
    setHasSearched(true);

    const params = new URLSearchParams();
    params.set('source', source);
    if (source === 'local' && activeDistributor) {
      params.set('distributor', activeDistributor);
    }
    if (query) params.set('q', query);
    if (brand) params.set('brand', brand);
    if (localCategory) params.set('category', localCategory);
    
    if (source === 'turn14' || source === 'all') {
      if (year) params.set('year', year);
      if (make) params.set('make', make);
      if (model) params.set('model', model);
      if (submodel) params.set('submodel', submodel);
    }
    params.set('page', searchPage.toString());

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
  }, [query, brand, year, make, model, submodel, source, localCategory]);

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
    setYear(''); setMake(''); setModel(''); setSubmodel('');
    setBrand(''); setQuery('');
    setHasSearched(false);
    setItems([]);
    setTotalPages(1);
  }

  function handleChangeVehicle() {
    setVehicleLocked(false);
  }

  const vehicleText = [year, make, model, submodel].filter(Boolean).join(' · ');

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-red-500/30">
      {/* ════ CINEMATIC HERO ════ */}
      <div className="relative pt-32 pb-20 px-6 overflow-hidden border-b border-white/5">
        {/* Deep atmospheric glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] max-w-[1200px] h-96 bg-red-600/5 blur-[140px] rounded-full pointer-events-none" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.03] pointer-events-none mix-blend-screen" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#050505] to-transparent pointer-events-none" />

        <div className="max-w-[90rem] mx-auto relative z-10 text-center">
          <Link href={`/${locale}/shop`} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/5 text-[10px] uppercase tracking-[0.2em] text-white/50 hover:bg-white/10 hover:text-white transition-all mb-8">
            ← {isUa ? "НАЗАД ДО ВІТРИН" : "BACK TO STORES"}
          </Link>
          <h1 className="text-5xl md:text-7xl font-extralight tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 mb-6 drop-shadow-2xl">
            One Company <span className="font-medium text-white">Stock</span>
          </h1>
          <p className="text-base md:text-lg text-white/40 max-w-2xl mx-auto font-light leading-relaxed">
            {isUa
              ? "Отримайте миттєвий доступ до мільйонів оригінальних деталей від понад 400 світових виробників. Введіть артикул для блискавичного пошуку."
              : "Get instant access to millions of genuine parts from 400+ global manufacturers. Enter a part number for lightning-fast search."}
          </p>
        </div>
      </div>

      {/* ════ CAR SELECTOR BAR ════ */}
      {/* ════ CAR SELECTOR BAR (DISABLED DUE TO TURN14 API V1 PERMISSIONS) ════ */}
      {false && source !== 'local' && (
        <div className="bg-[#0a0a0c] border-y border-white/10">
          <div className="max-w-[90rem] mx-auto px-6 py-4">
            {vehicleLocked ? (
              /* ── Selected vehicle display ── */
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-red-600/10 border border-red-600/20 flex items-center justify-center shrink-0">
                    <Car className="w-5 h-5 text-red-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] uppercase tracking-widest text-white/40 mb-0.5">
                      {isUa ? 'Ваше авто' : 'Your vehicle'}
                    </div>
                    <div className="text-base font-medium text-white truncate">
                      {vehicleText}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleChangeVehicle}
                    className="text-[10px] uppercase tracking-widest text-white/50 border border-white/10 px-4 py-2 hover:bg-white hover:text-black transition-all"
                  >
                    {isUa ? 'Змінити' : 'Change'}
                  </button>
                  <button
                    onClick={handleResetVehicle}
                    className="text-[10px] uppercase tracking-widest text-white/50 border border-white/10 px-4 py-2 hover:bg-red-600 hover:border-red-600 hover:text-white transition-all flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3 h-3" />
                    {isUa ? 'Скинути' : 'Reset'}
                  </button>
                </div>
              </div>
            ) : (
              /* ── Vehicle selector form ── */
              <div className="flex flex-col md:flex-row items-start md:items-end gap-5">
                {/* Cascading selectors */}
                <div className="flex-1 w-full flex flex-col sm:flex-row gap-3 items-end">
                  <div className="shrink-0 flex items-center gap-2 mb-2 sm:mb-0 sm:mr-2">
                    <Car className="w-4 h-4 text-white/50" />
                    <span className="text-xs font-medium text-white tracking-wide uppercase">
                      {isUa ? 'Підбір авто' : 'Vehicle Fitment'}
                    </span>
                  </div>

                  {/* Year */}
                  <div className="sm:w-32 shrink-0 flex-1 sm:flex-none">
                    <div className="text-[8px] uppercase tracking-widest text-white/40 mb-1.5 ml-1">
                      {isUa ? 'Рік' : 'Year'}
                    </div>
                    <Combobox
                      options={years}
                      value={year}
                      onChange={setYear}
                      placeholder={isUa ? 'Оберіть...' : 'Select...'}
                      isSelected={!!year}
                    />
                  </div>

                  {/* Make */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[8px] uppercase tracking-widest text-white/40 mb-1.5 ml-1">
                      {isUa ? 'Марка' : 'Make'}
                    </div>
                    <Combobox
                      options={makes}
                      value={make}
                      onChange={setMake}
                      placeholder={isUa ? 'Марка...' : 'Make...'}
                      disabled={!year}
                      loading={makesLoading}
                      isSelected={!!make}
                    />
                  </div>

                  {/* Model */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[8px] uppercase tracking-widest text-white/40 mb-1.5 ml-1">
                      {isUa ? 'Модель' : 'Model'}
                    </div>
                    <Combobox
                      options={models}
                      value={model}
                      onChange={setModel}
                      placeholder={isUa ? 'Модель...' : 'Model...'}
                      disabled={!make}
                      loading={modelsLoading}
                      isSelected={!!model}
                    />
                  </div>

                  {/* Submodel / Engine — only if available */}
                  {submodels.length > 0 && (
                    <div className="flex-1 min-w-0">
                      <div className="text-[8px] uppercase tracking-widest text-white/40 mb-1.5 ml-1">
                        {isUa ? 'Двигун' : 'Engine'}
                      </div>
                      <Combobox
                        options={submodels}
                        value={submodel}
                        onChange={setSubmodel}
                        placeholder={isUa ? 'Двигун...' : 'Engine...'}
                        loading={submodelsLoading}
                        isSelected={!!submodel}
                      />
                    </div>
                  )}

                  {/* Apply button */}
                  <div className="shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                    <button
                      onClick={handleSearch}
                      disabled={!year || !make}
                      className="w-full sm:w-auto h-10 px-8 bg-red-600 text-white text-[10px] uppercase font-bold tracking-widest hover:bg-red-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Search className="w-3.5 h-3.5" />
                      {isUa ? 'ЗНАЙТИ' : 'FIND'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ SOURCE TABS + SEARCH BAR ════ */}
      <div className="max-w-[90rem] mx-auto px-6 pt-5 pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Source tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <Layers className="w-4 h-4 text-white/30" />
            <span className="text-[10px] uppercase tracking-widest text-white/30 mr-1">{isUa ? 'Джерело' : 'Source'}</span>
            {[
              { id: 'turn14', source: 'turn14' as StockSource, label: 'Turn14', count: undefined, distributor: undefined },
              ...distributors.map(d => ({
                id: `local_${d.name}`,
                source: 'local' as StockSource,
                label: d.name,
                count: d.count,
                distributor: d.name
              })),
              { id: 'all', source: 'all' as StockSource, label: isUa ? 'Усі' : 'All', count: undefined, distributor: undefined },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setSource(tab.source);
                  setActiveDistributor(tab.distributor || '');
                  setItems([]); setHasSearched(false);
                  setLocalCategory(''); setBrand('');
                }}
                className={`px-3 py-1.5 text-xs font-medium tracking-wide transition-all border flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-white text-black border-white'
                    : 'bg-white/[0.04] text-white/60 border-white/10 hover:bg-white/[0.08] hover:border-white/20'
                }`}
              >
                {tab.label}
                {tab.count != null && tab.count > 0 && (
                  <span className={`text-[9px] px-1 py-0.5 rounded-full ${
                    activeTab === tab.id ? 'bg-black/15 text-black/70' : 'bg-white/10 text-white/40'
                  }`}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Inline search + brand */}
          <form onSubmit={handleSearch} className="flex-1 w-full sm:w-auto flex items-center gap-2">
            <div className="flex-1 flex items-center border border-white/10 bg-white/[0.02] focus-within:border-white/30 transition-all h-9">
              <Search className="w-3.5 h-3.5 text-white/30 ml-2.5 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isUa ? "Артикул або назва..." : "Part number or name..."}
                className="w-full bg-transparent text-xs text-white placeholder-white/20 focus:outline-none py-1.5 px-2 tracking-wide"
              />
              {query && (
                <button type="button" onClick={() => { setQuery(''); }} className="p-1 mr-1 text-white/30 hover:text-white"><X className="w-3 h-3" /></button>
              )}
            </div>
            {/* Brand quick-filter */}
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="bg-white/[0.02] border border-white/10 text-xs text-white/60 h-9 px-2 appearance-none cursor-pointer focus:outline-none focus:border-white/30 max-w-[120px] sm:max-w-[140px] truncate"
            >
              <option value="" className="bg-[#121216]">{isUa ? 'Бренд' : 'Brand'}</option>
              {(source === 'local' ? localBrands : brands.map(b => b.name)).map(b => (
                <option key={b} value={b} className="bg-[#121216]">{b}</option>
              ))}
            </select>
            {/* Category quick-filter */}
            <select
              value={localCategory}
              onChange={(e) => setLocalCategory(e.target.value)}
              className="bg-white/[0.02] border border-white/10 text-xs text-white/60 h-9 px-2 appearance-none cursor-pointer focus:outline-none focus:border-white/30 max-w-[120px] sm:max-w-[140px] truncate hidden sm:block"
            >
              <option value="" className="bg-[#121216]">{isUa ? 'Категорія' : 'Category'}</option>
              {localCategories.map(c => (
                <option key={c} value={c} className="bg-[#121216]">{c}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={loading}
              className="h-9 px-4 bg-white/[0.06] border border-white/10 text-[10px] uppercase tracking-widest text-white/60 hover:bg-white/10 hover:text-white transition-all disabled:opacity-30 flex items-center gap-1.5 shrink-0"
            >
              <Search className="w-3 h-3" />
            </button>
          </form>
        </div>

        {/* Active filters bar */}
        {(year || make || brand || query) && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {year && <span className="text-[9px] uppercase tracking-widest bg-white/5 border border-white/10 px-2.5 py-1 text-white/60">{year}</span>}
            {make && <span className="text-[9px] uppercase tracking-widest bg-white/5 border border-white/10 px-2.5 py-1 text-white/60">{make}</span>}
            {model && <span className="text-[9px] uppercase tracking-widest bg-white/5 border border-white/10 px-2.5 py-1 text-white/60">{model}</span>}
            {submodel && <span className="text-[9px] uppercase tracking-widest bg-white/5 border border-white/10 px-2.5 py-1 text-white/60">{submodel}</span>}
            {brand && <span className="text-[9px] uppercase tracking-widest bg-white/5 border border-white/10 px-2.5 py-1 text-white/60">{brand}</span>}
            {localCategory && <span className="text-[9px] uppercase tracking-widest bg-white/5 border border-white/10 px-2.5 py-1 text-white/60">{localCategory}</span>}
            {query && <span className="text-[9px] uppercase tracking-widest bg-white/5 border border-white/10 px-2.5 py-1 text-white/60">&quot;{query}&quot;</span>}
            <button
              onClick={handleResetVehicle}
              className="text-[9px] uppercase tracking-widest text-red-400/60 hover:text-red-400 border border-red-400/10 px-2.5 py-1 hover:border-red-400/30 transition-colors flex items-center gap-1"
            >
              <X className="w-2.5 h-2.5" /> {isUa ? 'Скинути все' : 'Reset all'}
            </button>
          </div>
        )}
      </div>

      {/* ════ RESULTS ════ */}
      <div className="max-w-[90rem] mx-auto px-6 pb-32">
        {error && (
          <div className="bg-red-500/5 border border-red-500/20 text-red-400 p-4 mb-6 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-px bg-white/5 border border-white/5">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="bg-[#0a0a0c] p-5 flex flex-col h-[300px]">
                <div className="aspect-square bg-white/[0.03] mb-3 animate-pulse rounded" />
                <div className="h-2 bg-white/[0.05] animate-pulse w-10 mb-2" />
                <div className="h-4 bg-white/[0.05] animate-pulse w-full mb-1" />
                <div className="h-4 bg-white/[0.05] animate-pulse w-2/3 mb-3" />
                <div className="mt-auto flex items-center justify-between pt-3 border-t border-white/5">
                  <div className="h-5 bg-white/[0.05] animate-pulse w-16" />
                  <div className="h-7 bg-white/[0.05] animate-pulse w-20" />
                </div>
              </div>
            ))}
          </div>

        ) : !hasSearched ? (
          <div className="text-center py-32 bg-gradient-to-b from-transparent to-white/[0.02] border border-white/5 rounded-2xl">
            <div className="w-20 h-20 mx-auto bg-white/[0.02] rounded-full flex items-center justify-center mb-6 ring-1 ring-white/10 shadow-[0_0_30px_rgba(255,255,255,0.02)]">
              {source === 'local' ? <Package className="w-8 h-8 text-blue-400/50" /> : <Search className="w-8 h-8 text-red-500/50" />}
            </div>
            <h3 className="text-xl font-light text-white mb-3 tracking-wide">
              {source === 'local'
                ? (isUa ? 'Каталог IND Distribution' : 'IND Distribution Catalog')
                : (isUa ? 'Преміум дистриб\'юторський каталог' : 'Premium Distributor Catalog')}
            </h3>
            <p className="text-white/40 text-sm font-light max-w-md mx-auto leading-relaxed">
              {source === 'local'
                ? (isUa
                  ? `Введіть назву товару або артикул для пошуку.${displayCount ? ` ${displayCount} товарів у базі.` : ''}`
                  : `Enter a product name or SKU.${displayCount ? ` ${displayCount} products available.` : ''}`)
                : (isUa
                  ? 'Введіть оригінальний артикул (PN) або оберіть бренд для швидкого доступу до сотень тисяч деталей.'
                  : 'Enter an original article number (PN) or select a brand for quick access to hundreds of thousands of parts.')}
            </p>
          </div>

        ) : hasSearched && items.length === 0 ? (
          <div className="text-center py-32 bg-gradient-to-b from-transparent to-white/[0.02] border border-white/5 rounded-2xl">
            <div className="w-20 h-20 mx-auto bg-white/[0.02] rounded-full flex items-center justify-center mb-6 ring-1 ring-white/10">
              <Package className="w-8 h-8 text-white/30" />
            </div>
            <h3 className="text-xl font-light text-white mb-3 tracking-wide">
              {isUa ? "За вашим запитом нічого не знайдено" : "No results found"}
            </h3>
            <p className="text-white/40 text-sm font-light mb-6">
              {isUa ? "Спробуйте змінити параметри або обрати інший автомобіль." : "Try different filters or another vehicle."}
            </p>
            <button onClick={handleResetVehicle} className="inline-flex items-center gap-2 bg-white text-black px-6 py-3 text-[10px] uppercase font-bold tracking-widest hover:bg-zinc-200 transition-colors">
              <X className="w-3 h-3" /> {isUa ? 'Скинути фільтри' : 'Clear filters'}
            </button>
          </div>

        ) : (
          <>
            {/* Results count */}
            <div className="flex justify-between items-center mb-4">
              <p className="text-[10px] uppercase tracking-widest text-white/30">
                {items.length} {isUa ? 'результатів' : 'results'} {totalPages > 1 && `• ${isUa ? 'Сторінка' : 'Page'} ${page}/${totalPages}`}
              </p>
            </div>

            {/* Product Grid — full width */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-px bg-white/5 border border-white/5">
              {items.map((item) => (
                <div key={item.id} className="bg-[#0a0a0c] p-5 flex flex-col group hover:bg-white/[0.03] transition-all duration-300 relative z-0 hover:z-10 hover:shadow-[0_0_40px_rgba(255,255,255,0.03)] hover:ring-1 hover:ring-white/10">
                  {/* Image */}
                  <div className="aspect-square bg-white/[0.02] mb-3 flex items-center justify-center overflow-hidden relative">
                    {item.inStock && (
                      <span className="absolute top-2 left-2 bg-white text-black text-[8px] uppercase font-bold tracking-widest px-2 py-1 z-10">
                        {isUa ? 'В НАЯВНОСТІ' : 'IN STOCK'}
                      </span>
                    )}
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt={item.name} className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <Package className="w-14 h-14 text-white/10" />
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-[9px] uppercase tracking-widest text-white/40 truncate">{item.brand}</p>
                      {(item as any).source === 'local' && (
                        <span className="text-[7px] uppercase tracking-widest bg-blue-500/20 text-blue-300 border border-blue-500/20 px-1.5 py-0.5 shrink-0">{(item as any).distributor || 'IND'}</span>
                      )}
                    </div>
                    <h3 className="text-sm font-light text-white mb-1 leading-tight line-clamp-2">{item.name}</h3>
                    <p className="text-[10px] text-white/30 mb-2 truncate font-mono">PN: {item.partNumber}</p>
                  </div>
                  {/* Price + Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-auto">
                    <div>
                      {item.price ? (
                        <div className="flex flex-col">
                          {item.originalPrice && (
                            <span className="text-xs text-white/40 line-through">${item.originalPrice.toFixed(2)}</span>
                          )}
                          <span className={`text-lg font-light ${item.originalPrice ? 'text-red-400' : 'text-white'}`}>
                            ${item.price.toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-white/30 uppercase tracking-widest">{isUa ? 'Ціна за запитом' : 'Request price'}</span>
                      )}
                    </div>
                    <AddToCartButton
                      turn14Id={item.turn14Id || item.id}
                      locale={locale as string}
                      variant="minimal"
                      label={isUa ? 'В КОШИК' : 'TO CART'}
                      labelAdded={isUa ? 'В КОШИКУ ✓' : 'IN CART ✓'}
                      className="text-[9px] uppercase tracking-widest font-bold text-emerald-400 border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 transition-all hover:bg-emerald-400 hover:text-black active:!scale-95"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button disabled={page <= 1} onClick={() => doSearch(page - 1)}
                  className="text-[10px] uppercase tracking-widest text-white/40 border border-white/10 px-4 py-2 hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                  ← {isUa ? 'Назад' : 'Prev'}
                </button>
                <span className="text-[10px] text-white/30 uppercase tracking-widest px-4">{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => doSearch(page + 1)}
                  className="text-[10px] uppercase tracking-widest text-white/40 border border-white/10 px-4 py-2 hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                  {isUa ? 'Далі' : 'Next'} →
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
