'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, Filter, ChevronDown, ShoppingCart, Package, Loader2, X, Check, Layers } from 'lucide-react';

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
  basePrice: number;
  markupPct: number;
  turn14Id: string;
  dimensions?: { length: number; width: number; height: number; weight: number }[];
};

type FitmentData = { type: string; data: string[] };

export default function StockPage() {
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

  // Distributor source tab — read from URL for OurStoresPortal deep links
  const initialSource = (searchParams.get('source') || 'turn14') as StockSource;
  const [source, setSource] = useState<StockSource>(initialSource === 'local' || initialSource === 'all' ? initialSource : 'turn14');
  const [localCategory, setLocalCategory] = useState('');
  const [localCategories, setLocalCategories] = useState<string[]>([]);
  const [localBrands, setLocalBrands] = useState<string[]>([]);
  const [localProductCount, setLocalProductCount] = useState<number | null>(null);

  // Order modal state
  const [orderItem, setOrderItem] = useState<StockItem | null>(null);
  const [orderForm, setOrderForm] = useState({ name: '', email: '', phone: '' });
  const [ordering, setOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState('');
  const [loadingPrice, setLoadingPrice] = useState(false);

  // Fitment cascade state
  const [years, setYears] = useState<string[]>([]);
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [submodels, setSubmodels] = useState<string[]>([]);

  const [year, setYear] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [submodel, setSubmodel] = useState('');

  // Brand state
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [brand, setBrand] = useState('');

  // Load initial data: years + brands for Turn14; stats for local
  useEffect(() => {
    Promise.all([
      fetch('/api/shop/turn14/fitment').then(r => r.json()),
      fetch('/api/shop/turn14/brands').then(r => r.json()),
      fetch('/api/admin/stock/import').then(r => r.json()).catch(() => null),
    ]).then(([fitmentRes, brandsRes, stockStats]) => {
      setYears(fitmentRes.data || []);
      setBrands(brandsRes.data || []);
      if (stockStats?.total != null) {
        setLocalProductCount(stockStats.total);
      }
    }).catch(console.error);
  }, []);

  // Cascading: Year → Makes
  useEffect(() => {
    if (!year) { setMakes([]); setMake(''); return; }
    fetch(`/api/shop/turn14/fitment?year=${year}`)
      .then(r => r.json())
      .then(res => setMakes(res.data || []))
      .catch(console.error);
    setMake('');
    setModel('');
    setSubmodel('');
    setModels([]);
    setSubmodels([]);
  }, [year]);

  // Cascading: Make → Models
  useEffect(() => {
    if (!year || !make) { setModels([]); setModel(''); return; }
    fetch(`/api/shop/turn14/fitment?year=${year}&make=${encodeURIComponent(make)}`)
      .then(r => r.json())
      .then(res => setModels(res.data || []))
      .catch(console.error);
    setModel('');
    setSubmodel('');
    setSubmodels([]);
  }, [year, make]);

  // Cascading: Model → Submodels / Engines
  useEffect(() => {
    if (!year || !make || !model) { setSubmodels([]); setSubmodel(''); return; }
    fetch(`/api/shop/turn14/fitment?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`)
      .then(r => r.json())
      .then(res => setSubmodels(res.data || []))
      .catch(console.error);
    setSubmodel('');
  }, [year, make, model]);

  // Open order modal and fetch real-time price
  const handleOpenOrder = async (item: StockItem) => {
    setOrderItem(item);
    if (!item.price) {
      setLoadingPrice(true);
      try {
        const res = await fetch(`/api/shop/turn14/pricing?id=${item.turn14Id}`);
        const data = await res.json();
        if (data.success && data.purchaseCost) {
          const val = data.purchaseCost * (1 + item.markupPct / 100);
          setOrderItem({ ...item, price: val });
        }
      } catch (e) {
        console.error('Failed to fetch price', e);
      } finally {
        setLoadingPrice(false);
      }
    }
  };

  // Search handler
  const doSearch = useCallback(async (searchPage = 1) => {
    // If all filters are empty, don't execute a blank search that returns nothing.
    // Revert to the initial "Start searching" state instead.
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
    if (query) params.set('q', query);
    if (source === 'turn14' || source === 'all') {
      if (brand) params.set('brand', brand);
      if (year) params.set('year', year);
      if (make) params.set('make', make);
      if (model) params.set('model', model);
      if (submodel) params.set('submodel', submodel);
    } else {
      if (brand) params.set('brand', brand);
      if (localCategory) params.set('category', localCategory);
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

  // Auto-search when filters change (debounced)
  useEffect(() => {
    if (!brand && !year && !make && !model) return;
    const t = setTimeout(() => doSearch(1), 600);
    return () => clearTimeout(t);
  }, [brand, year, make, model, submodel, doSearch]);

  function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    doSearch(1);
  }

  function handleResetFilters() {
    setYear('');
    setMake('');
    setModel('');
    setSubmodel('');
    setBrand('');
    setQuery('');
    setHasSearched(false);
    setItems([]);
    setTotalPages(1);
  }

  const hasActiveFilters = year || make || model || brand || query;

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white selection:bg-white/20">
      {/* Hero */}
      <div className="relative pt-32 pb-8 px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800/30 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-[90rem] mx-auto relative z-10">
          <Link href={`/${locale}/shop`} className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-white/50 hover:text-white transition-colors mb-8">
            ← {isUa ? "НАЗАД ДО ВІТРИН" : "BACK TO STORES"}
          </Link>
          <h1 className="text-4xl md:text-6xl font-extralight tracking-tight text-white mb-3">
            One Company <span className="font-medium">Stock</span>
          </h1>
          <p className="text-sm text-white/40 max-w-lg font-light leading-relaxed">
            {isUa
              ? "Мільйони оригінальних деталей від 400+ виробників. Знайдіть деталь по своєму авто або артикулу."
              : "Millions of genuine parts from 400+ manufacturers. Find parts by your vehicle or part number."}
          </p>
        </div>
      </div>

      {/* Distributor Source Tabs */}
      <div className="max-w-[90rem] mx-auto px-6 pt-4 pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Layers className="w-4 h-4 text-white/30" />
          <span className="text-[10px] uppercase tracking-widest text-white/30 mr-2">{isUa ? 'Джерело' : 'Source'}</span>
          {[
            { id: 'turn14' as StockSource, label: 'Turn14', desc: isUa ? '400+ виробників' : '400+ manufacturers', count: null },
            { id: 'local' as StockSource, label: 'IND', desc: isUa ? 'Shopify каталог' : 'Shopify catalog', count: localProductCount },
            { id: 'all' as StockSource, label: isUa ? 'Усі' : 'All', desc: isUa ? 'Об\'єднаний пошук' : 'Combined search', count: null },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSource(tab.id);
                setItems([]);
                setHasSearched(false);
                setLocalCategory('');
                setBrand('');
              }}
              className={`px-4 py-2 text-xs font-medium tracking-wide transition-all border flex items-center gap-2 ${
                source === tab.id
                  ? 'bg-white text-black border-white'
                  : 'bg-white/[0.04] text-white/60 border-white/10 hover:bg-white/[0.08] hover:border-white/20'
              }`}
              title={tab.desc}
            >
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                  source === tab.id
                    ? 'bg-black/15 text-black/70'
                    : 'bg-white/10 text-white/40'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Layout */}
      <div className="max-w-[90rem] mx-auto px-6 pb-32 flex flex-col lg:flex-row gap-8">

        {/* ═══ LEFT SIDEBAR — FILTERS ═══ */}
        <aside className="w-full lg:w-72 shrink-0">
          <div className="sticky top-28">
            <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
              <h2 className="text-[10px] uppercase font-bold tracking-[0.2em] text-white flex items-center gap-2">
                <Filter className="w-3 h-3" />
                {isUa ? 'ПІДБІР ДЕТАЛЕЙ' : 'PART FINDER'}
              </h2>
              {hasActiveFilters && (
                <button onClick={handleResetFilters} className="text-[9px] uppercase tracking-widest text-white/30 hover:text-white transition-colors">
                  {isUa ? 'Скинути' : 'Reset'}
                </button>
              )}
            </div>

            <form onSubmit={handleSearch} className="flex flex-col gap-5">
              {/* Text Search */}
              <div className="group">
                <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-2 group-focus-within:text-white/50 transition-colors">{isUa ? 'Пошук' : 'Search'}</label>
                <div className="flex items-center border border-white/10 bg-white/[0.02] focus-within:border-white/40 focus-within:bg-white/[0.04] transition-all">
                  <Search className="w-4 h-4 text-white/30 ml-3 shrink-0 group-focus-within:text-white/50 transition-colors" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={isUa ? "Артикул або назва..." : "Part number or name..."}
                    className="w-full bg-transparent text-sm text-white placeholder-white/20 focus:outline-none py-3 px-3 tracking-wide"
                  />
                  {query && (
                    <button type="button" onClick={() => { setQuery(''); doSearch(1); }} className="p-2 mr-1 text-white/30 hover:text-white transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Vehicle Fitment Section — Turn14 only */}
              {source !== 'local' && (
              <div className="pt-3 border-t border-white/5">
                <div className="text-[10px] uppercase tracking-widest text-white/40 mb-4 flex items-center gap-2">
                  🚗 {isUa ? 'Ваш Автомобіль' : 'Your Vehicle'}
                </div>

                {/* Year */}
                <div className="mb-3">
                  <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1">{isUa ? 'Рік' : 'Year'}</label>
                  <div className="relative">
                    <select value={year} onChange={(e) => setYear(e.target.value)}
                      className="w-full bg-white/[0.02] border border-white/10 text-xs text-white focus:outline-none focus:border-white/30 py-2.5 px-3 appearance-none cursor-pointer transition-colors">
                      <option value="" className="bg-[#121216]">{isUa ? 'Оберіть рік' : 'Select year'}</option>
                      {years.map(y => <option key={y} value={y} className="bg-[#121216]">{y}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
                  </div>
                </div>

                {/* Make */}
                <div className="mb-3">
                  <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1">{isUa ? 'Марка' : 'Make'}</label>
                  <div className="relative">
                    <select value={make} onChange={(e) => setMake(e.target.value)} disabled={!year}
                      className="w-full bg-white/[0.02] border border-white/10 text-xs text-white focus:outline-none focus:border-white/30 py-2.5 px-3 appearance-none cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                      <option value="" className="bg-[#121216]">{isUa ? 'Оберіть марку' : 'Select make'}</option>
                      {makes.map(m => <option key={m} value={m} className="bg-[#121216]">{m}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
                  </div>
                </div>

                {/* Model */}
                <div className="mb-3">
                  <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1">{isUa ? 'Модель' : 'Model'}</label>
                  <div className="relative">
                    <select value={model} onChange={(e) => setModel(e.target.value)} disabled={!make}
                      className="w-full bg-white/[0.02] border border-white/10 text-xs text-white focus:outline-none focus:border-white/30 py-2.5 px-3 appearance-none cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                      <option value="" className="bg-[#121216]">{isUa ? 'Оберіть модель' : 'Select model'}</option>
                      {models.map(m => <option key={m} value={m} className="bg-[#121216]">{m}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
                  </div>
                </div>

                {/* Submodel / Engine */}
                {submodels.length > 0 && (
                  <div className="mb-3">
                    <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1">{isUa ? 'Двигун / Підмодель' : 'Engine / Submodel'}</label>
                    <div className="relative">
                      <select value={submodel} onChange={(e) => setSubmodel(e.target.value)}
                        className="w-full bg-white/[0.02] border border-white/10 text-xs text-white focus:outline-none focus:border-white/30 py-2.5 px-3 appearance-none cursor-pointer transition-colors">
                        <option value="" className="bg-[#121216]">{isUa ? 'Усі варіанти' : 'All variants'}</option>
                        {submodels.map(s => <option key={s} value={s} className="bg-[#121216]">{s}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>
              )}

              {/* Category Filter — Local/IND only */}
              {source === 'local' && localCategories.length > 0 && (
              <div className="pt-3 border-t border-white/5">
                <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1">{isUa ? 'Категорія' : 'Category'}</label>
                <div className="relative">
                  <select value={localCategory} onChange={(e) => { setLocalCategory(e.target.value); }}
                    className="w-full bg-white/[0.02] border border-white/10 text-xs text-white focus:outline-none focus:border-white/30 py-2.5 px-3 appearance-none cursor-pointer transition-colors">
                    <option value="" className="bg-[#121216]">{isUa ? 'Усі категорії' : 'All categories'}</option>
                    {localCategories.map(c => <option key={c} value={c} className="bg-[#121216]">{c}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
                </div>
              </div>
              )}

              {/* Brand — uses Turn14 brands or local DB brands depending on source */}
              <div className="pt-3 border-t border-white/5">
                <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1">{isUa ? 'Бренд (Виробник)' : 'Brand'}</label>
                <div className="relative">
                  <select value={brand} onChange={(e) => setBrand(e.target.value)}
                    className="w-full bg-white/[0.02] border border-white/10 text-xs text-white focus:outline-none focus:border-white/30 py-2.5 px-3 appearance-none cursor-pointer transition-colors">
                    <option value="" className="bg-[#121216]">{isUa ? 'Усі бренди' : 'All brands'}</option>
                    {source === 'local'
                      ? localBrands.map(b => <option key={b} value={b} className="bg-[#121216]">{b}</option>)
                      : brands.map(b => <option key={b.id} value={b.name} className="bg-[#121216]">{b.name}</option>)
                    }
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
                </div>
              </div>

              {/* Apply */}
              <button
                type="submit"
                disabled={loading}
                className="mt-4 w-full bg-white text-black py-3.5 text-[10px] uppercase font-bold tracking-widest hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> {isUa ? 'ПОШУК...' : 'SEARCHING...'}</>
                ) : (
                  <><Search className="w-3 h-3" /> {isUa ? 'ЗНАЙТИ ДЕТАЛІ' : 'FIND PARTS'}</>
                )}
              </button>
            </form>
          </div>
        </aside>

        {/* ═══ RIGHT — RESULTS GRID ═══ */}
        <main className="flex-1 min-w-0">
          {error && (
            <div className="bg-red-500/5 border border-red-500/20 text-red-400 p-4 mb-6 text-sm">{error}</div>
          )}

          {/* Active filters indicator */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 mb-6">
              {year && <span className="text-[10px] uppercase tracking-widest bg-white/5 border border-white/10 px-3 py-1.5 text-white/60 truncate max-w-[160px]">{year}</span>}
              {make && <span className="text-[10px] uppercase tracking-widest bg-white/5 border border-white/10 px-3 py-1.5 text-white/60 truncate max-w-[160px]">{make}</span>}
              {model && <span className="text-[10px] uppercase tracking-widest bg-white/5 border border-white/10 px-3 py-1.5 text-white/60 truncate max-w-[160px]">{model}</span>}
              {submodel && <span className="text-[10px] uppercase tracking-widest bg-white/5 border border-white/10 px-3 py-1.5 text-white/60 truncate max-w-[160px]">{submodel}</span>}
              {brand && <span className="text-[10px] uppercase tracking-widest bg-white/5 border border-white/10 px-3 py-1.5 text-white/60 truncate max-w-[160px]">{brand}</span>}
              {query && <span className="text-[10px] uppercase tracking-widest bg-white/5 border border-white/10 px-3 py-1.5 text-white/60 truncate max-w-[160px]">"{query}"</span>}
            </div>
          )}

          {/* Loading state */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-px bg-white/5 border border-white/5">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="bg-[#0a0a0c] p-5 flex flex-col h-[320px]">
                  <div className="aspect-square bg-white/[0.03] mb-4 animate-pulse rounded-md" />
                  <div className="h-2 bg-white/[0.05] animate-pulse w-8 mb-2" />
                  <div className="h-4 bg-white/[0.05] animate-pulse w-full mb-2" />
                  <div className="h-4 bg-white/[0.05] animate-pulse w-2/3 mb-4" />
                  <div className="mt-auto flex items-center justify-between pt-3 border-t border-white/5">
                    <div className="h-5 bg-white/[0.05] animate-pulse w-16" />
                    <div className="h-7 bg-white/[0.05] animate-pulse w-20" />
                  </div>
                </div>
              ))}
            </div>

          ) : !hasSearched ? (
            <div className="text-center py-40 bg-gradient-to-b from-transparent to-white/[0.02] border border-white/5 rounded-2xl">
              <div className="w-20 h-20 mx-auto bg-white/[0.02] rounded-full flex items-center justify-center mb-6 ring-1 ring-white/10 shadow-[0_0_30px_rgba(255,255,255,0.02)]">
                {source === 'local' ? <Package className="w-8 h-8 text-blue-400/50" /> : <Search className="w-8 h-8 text-white/30" />}
              </div>
              <h3 className="text-xl font-light text-white mb-3 tracking-wide">
                {source === 'local'
                  ? (isUa ? 'Каталог IND Distribution' : 'IND Distribution Catalog')
                  : (isUa ? 'Знайдіть деталі для вашого авто' : 'Find parts for your vehicle')}
              </h3>
              <p className="text-white/40 text-sm font-light max-w-md mx-auto leading-relaxed">
                {source === 'local'
                  ? (isUa
                    ? `Введіть назву товару або артикул для пошуку по каталогу IND.${localProductCount ? ` ${localProductCount} товарів у базі.` : ''}`
                    : `Enter a product name or SKU to search the IND catalog.${localProductCount ? ` ${localProductCount} products in database.` : ''}`)
                  : (isUa
                    ? 'Введіть артикул або назву деталі в поле пошуку, або скористайтеся зручним фільтром зліва для підбору по моделі авто.'
                    : 'Enter a part number or name in the search field, or use the convenient filters on the left to select your vehicle.')}
              </p>
            </div>

          ) : hasSearched && items.length === 0 ? (
            <div className="text-center py-40 bg-gradient-to-b from-transparent to-white/[0.02] border border-white/5 rounded-2xl">
              <div className="w-20 h-20 mx-auto bg-white/[0.02] rounded-full flex items-center justify-center mb-6 ring-1 ring-white/10">
                <Package className="w-8 h-8 text-white/30" />
              </div>
              <h3 className="text-xl font-light text-white mb-3 tracking-wide">
                {isUa ? "За вашим запитом нічого не знайдено" : "No results found for your query"}
              </h3>
              <p className="text-white/40 text-sm font-light mb-6">
                {isUa ? "Спробуйте змінити параметри пошуку або обрати інший автомобіль." : "Try adjusting your search parameters or selecting a different vehicle."}
              </p>
              <button onClick={handleResetFilters} className="inline-flex items-center gap-2 bg-white text-black px-6 py-3 text-[10px] uppercase font-bold tracking-widest hover:bg-zinc-200 transition-colors">
                <X className="w-3 h-3" /> {isUa ? 'Скинути всі фільтри' : 'Clear all filters'}
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

              {/* Product Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-px bg-white/5 border border-white/5">
                {items.map((item) => (
                  <div key={item.id} className="bg-[#0a0a0c] p-5 flex flex-col group hover:bg-white/[0.03] transition-all duration-300 relative z-0 hover:z-10 hover:shadow-[0_0_40px_rgba(255,255,255,0.03)] hover:ring-1 hover:ring-white/10">
                    {/* Image */}
                    <div className="aspect-square bg-white/[0.02] mb-4 flex items-center justify-center overflow-hidden relative">
                      {item.inStock && (
                        <span className="absolute top-2 left-2 bg-white text-black text-[8px] uppercase font-bold tracking-widest px-2 py-1 z-10">
                          {isUa ? 'В НАЯВНОСТІ' : 'IN STOCK'}
                        </span>
                      )}
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt={item.name} className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <Package className="w-16 h-16 text-white/10" />
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
                      <p className="text-[10px] text-white/30 mb-3 truncate font-mono">PN: {item.partNumber}</p>
                    </div>

                    {/* Price + Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-auto">
                      <div>
                        {item.price ? (
                          <span className="text-lg font-light text-white">${item.price.toFixed(2)}</span>
                        ) : (
                          <span className="text-xs text-white/30 uppercase tracking-widest">{isUa ? 'Ціна за запитом' : 'Request price'}</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleOpenOrder(item)}
                        className="text-[9px] uppercase tracking-widest font-bold text-white border border-white/20 px-4 py-2 group-hover:bg-white group-hover:text-black transition-all hover:!scale-105 active:!scale-95"
                      >
                        {isUa ? 'ЗАМОВИТИ' : 'ORDER'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <button
                    disabled={page <= 1}
                    onClick={() => doSearch(page - 1)}
                    className="text-[10px] uppercase tracking-widest text-white/40 border border-white/10 px-4 py-2 hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                  >
                    ← {isUa ? 'Назад' : 'Prev'}
                  </button>
                  <span className="text-[10px] text-white/30 uppercase tracking-widest px-4">
                    {page} / {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => doSearch(page + 1)}
                    className="text-[10px] uppercase tracking-widest text-white/40 border border-white/10 px-4 py-2 hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                  >
                    {isUa ? 'Далі' : 'Next'} →
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
      {/* ═══ ORDER MODAL ═══ */}
      {orderItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !ordering && setOrderItem(null)}>
          <div className="bg-[#111] border border-white/10 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-medium text-white">{isUa ? 'Оформити замовлення' : 'Place Order'}</h3>
              <button onClick={() => setOrderItem(null)} className="text-white/30 hover:text-white"><X className="w-4 h-4" /></button>
            </div>

            {orderSuccess ? (
              <div className="text-center py-8">
                <Check className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                <p className="text-emerald-400 text-sm font-medium mb-1">{isUa ? 'Замовлення створено!' : 'Order placed!'}</p>
                <p className="text-white/40 text-xs">{orderSuccess}</p>
                <button onClick={() => { setOrderItem(null); setOrderSuccess(''); }} className="mt-6 text-[9px] uppercase tracking-widest text-white/50 border border-white/10 px-6 py-2 hover:bg-white/5">
                  {isUa ? 'Закрити' : 'Close'}
                </button>
              </div>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault();
                setOrdering(true);
                
                let calculatedShipping = 0;
                if (orderItem.dimensions && orderItem.dimensions.length > 0) {
                  const dim = orderItem.dimensions[0];
                  const lCm = dim.length * 2.54;
                  const wCm = dim.width * 2.54;
                  const hCm = dim.height * 2.54;
                  const actKg = dim.weight * 0.453592;
                  const volKg = (lCm * wCm * hCm) / 5000;
                  if (volKg > actKg) calculatedShipping = (volKg - actKg) * 2;
                }

                try {
                  // Use Turn14 order API for Turn14 items, or the same endpoint for local
                  // (local items have empty turn14Id — the API handles both)
                  const res = await fetch('/api/shop/turn14/order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      item: {
                        ...orderItem,
                        turn14Id: orderItem.turn14Id || orderItem.id,
                      },
                      customerName: orderForm.name,
                      customerEmail: orderForm.email || undefined,
                      customerPhone: orderForm.phone || undefined,
                      quantity: 1,
                      shippingCost: calculatedShipping,
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error);
                  setOrderSuccess(data.message || data.orderNumber);
                  setOrderForm({ name: '', email: '', phone: '' });
                } catch (err: any) {
                  alert(err.message);
                } finally {
                  setOrdering(false);
                }
              }}>
                {/* Item preview */}
                <div className="bg-white/[0.03] p-3 mb-5 flex items-center gap-3">
                  {orderItem.thumbnail ? (
                    <img src={orderItem.thumbnail} alt="" className="w-12 h-12 object-contain" />
                  ) : (
                    <div className="w-12 h-12 bg-white/5 flex items-center justify-center"><Package className="w-6 h-6 text-white/10" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{orderItem.name}</p>
                    <p className="text-[9px] text-white/30">{orderItem.brand} · {orderItem.partNumber}</p>
                  </div>
                  {loadingPrice ? (
                    <span className="text-xs text-white/50 animate-pulse">{isUa ? 'Розрахункуємо...' : 'Working...'}</span>
                  ) : (
                    <span className="text-sm font-medium text-white tabular-nums">{orderItem.price ? `$${orderItem.price.toFixed(2)}` : '—'}</span>
                  )}
                </div>

                {/* Volumetric Shipping Calculator */}
                {(() => {
                  if (!orderItem.dimensions || orderItem.dimensions.length === 0) return null;
                  const dim = orderItem.dimensions[0];
                  const lCm = dim.length * 2.54;
                  const wCm = dim.width * 2.54;
                  const hCm = dim.height * 2.54;
                  const actKg = dim.weight * 0.453592;
                  const volKg = (lCm * wCm * hCm) / 5000;
                  const surcharge = volKg > actKg ? (volKg - actKg) * 2 : 0;
                  
                  return (
                    <div className="bg-white/[0.02] border border-white/10 p-4 mb-5 rounded-md">
                      <p className="text-[10px] uppercase tracking-widest text-white/50 mb-2 flex justify-between">
                        <span>{isUa ? 'Доставка (Казахстан)' : 'Shipping (Kazakhstan)'}</span>
                        <span>{surcharge > 0 ? `+$${surcharge.toFixed(2)}` : 'Стандартна (Standard)'}</span>
                      </p>
                      <div className="flex gap-4 text-xs">
                        <div className="flex-1">
                          <p className="text-white/40 mb-1">{isUa ? 'Габарити (см)' : 'Dimensions (cm)'}</p>
                          <p className="text-white font-medium">{lCm.toFixed(0)} × {wCm.toFixed(0)} × {hCm.toFixed(0)}</p>
                        </div>
                        <div className="flex-1">
                          <p className="text-white/40 mb-1">{isUa ? 'Фактична вага' : 'Actual Weight'}</p>
                          <p className="text-white font-medium">{actKg.toFixed(1)} kg</p>
                        </div>
                        <div className="flex-1">
                          <p className="text-white/40 mb-1">{isUa ? 'Об\'ємна вага' : 'Volumetric Weight'}</p>
                          <p className={`${surcharge > 0 ? 'text-red-400' : 'text-white'} font-medium`}>{volKg.toFixed(1)} kg</p>
                        </div>
                      </div>
                      {surcharge > 0 && (
                        <p className="text-[10px] text-red-400/80 mt-3 pt-3 border-t border-white/10">
                          {isUa ? `Надбавка за об\'ємну вагу: (${volKg.toFixed(1)} - ${actKg.toFixed(1)}) × $2 = $${surcharge.toFixed(2)}` : `Volumetric surcharge: (${volKg.toFixed(1)} - ${actKg.toFixed(1)}) × $2 = $${surcharge.toFixed(2)}`}
                        </p>
                      )}
                    </div>
                  );
                })()}

                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1.5">{isUa ? "Ваше ім'я" : 'Your name'} *</label>
                    <input required value={orderForm.name} onChange={e => setOrderForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-white/30" placeholder="" />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1.5">Email</label>
                    <input type="email" value={orderForm.email} onChange={e => setOrderForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-white/30" placeholder="" />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-white/30 mb-1.5">{isUa ? 'Телефон' : 'Phone'}</label>
                    <input type="tel" value={orderForm.phone} onChange={e => setOrderForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full bg-white/[0.03] border border-white/10 text-sm text-white px-3 py-2.5 focus:outline-none focus:border-white/30" placeholder="" />
                  </div>
                </div>

                <button type="submit" disabled={ordering || loadingPrice}
                  className="mt-5 w-full bg-white text-black text-[10px] uppercase tracking-widest font-bold py-3 hover:bg-zinc-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {ordering || loadingPrice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />}
                  {ordering ? (isUa ? 'ОФОРМЛЯЄМО...' : 'PROCESSING...') : loadingPrice ? (isUa ? 'ЗАВАНТАЖЕННЯ...' : 'LOADING...') : (isUa ? 'ПІДТВЕРДИТИ ЗАМОВЛЕННЯ' : 'CONFIRM ORDER')}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
