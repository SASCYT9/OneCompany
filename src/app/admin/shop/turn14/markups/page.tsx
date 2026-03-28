'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Save, Percent, Loader2, Check, AlertCircle,
  ArrowUpDown, Filter, ChevronDown, TrendingUp, DollarSign, Activity, Settings2
} from 'lucide-react';

type Brand = {
  id: string;
  name: string;
};

type BrandMarkup = {
  id: string;
  brandId: string;
  brandName: string;
  markupPct: number;
};

export default function BrandMarkupsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [markups, setMarkups] = useState<BrandMarkup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [editedMarkups, setEditedMarkups] = useState<Record<string, number>>({});
  const [defaultMarkup, setDefaultMarkup] = useState(25);
  const [sortBy, setSortBy] = useState<'name' | 'markup'>('name');
  const [showOnlyCustom, setShowOnlyCustom] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [brandsRes, markupsRes] = await Promise.all([
        fetch('/api/shop/stock/search?brandsOnly=true').then(r => r.json()).catch(() => ({ brands: [] })),
        fetch('/api/admin/shop/turn14/markups').then(r => r.json()).catch(() => ({ markups: [], defaultMarkup: 25 })),
      ]);

      setBrands(brandsRes.brands || []);
      setMarkups(markupsRes.markups || []);
      setDefaultMarkup(markupsRes.defaultMarkup || 25);
    } catch (err) {
      console.error('Failed to load markups:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getMarkupForBrand = (brandId: string): number => {
    if (editedMarkups[brandId] !== undefined) return editedMarkups[brandId];
    const existing = markups.find(m => m.brandId === brandId);
    return existing ? existing.markupPct : defaultMarkup;
  };

  const isCustomMarkup = (brandId: string): boolean => {
    return editedMarkups[brandId] !== undefined || markups.some(m => m.brandId === brandId);
  };

  const handleMarkupChange = (brandId: string, value: number) => {
    setEditedMarkups(prev => ({ ...prev, [brandId]: value }));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const updates = Object.entries(editedMarkups).map(([brandId, markupPct]) => {
        const brand = brands.find(b => b.id === brandId);
        return {
          brandId,
          brandName: brand?.name || brandId,
          markupPct,
        };
      });

      if (updates.length === 0) {
        // Just save default markup if we aren't saving any brand specific ones
        const res = await fetch('/api/admin/shop/turn14/markups', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ defaultMarkup, markups: [] }),
        });
        if (res.ok) setSaveStatus('success');
        setSaving(false);
        return;
      }

      const res = await fetch('/api/admin/shop/turn14/markups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultMarkup, markups: updates }),
      });

      if (res.ok) {
        setSaveStatus('success');
        setEditedMarkups({});
        fetchData();
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  // Stats calculations
  const customCount = brands.filter(b => isCustomMarkup(b.id)).length;
  const avgMarkup = useMemo(() => {
    if (!brands.length) return defaultMarkup;
    const total = brands.reduce((sum, b) => sum + getMarkupForBrand(b.id), 0);
    return Math.round(total / brands.length);
  }, [brands, editedMarkups, markups, defaultMarkup]);

  let displayBrands = brands.filter(b =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (showOnlyCustom) {
    displayBrands = displayBrands.filter(b => isCustomMarkup(b.id));
  }

  displayBrands.sort((a, b) => {
    if (sortBy === 'markup') {
      return getMarkupForBrand(b.id) - getMarkupForBrand(a.id);
    }
    return a.name.localeCompare(b.name);
  });

  const hasChanges = Object.keys(editedMarkups).length > 0;

  return (
    <div className="relative min-h-screen bg-[#030303] text-white p-6 md:p-10 font-sans overflow-hidden">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[150px] mix-blend-screen" />
        <div className="absolute bottom-0 left-1/4 w-[800px] h-[800px] bg-emerald-600/5 rounded-full blur-[150px] mix-blend-screen" />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto">
        {/* Header & Save Bar */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-[10px] uppercase font-bold tracking-widest text-indigo-400">
              <Activity className="w-3 h-3" /> Turn14 Financial Engine
            </div>
            <h1 className="text-4xl lg:text-5xl font-light tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-500">
              Глобальні Націнки
            </h1>
            <p className="text-sm text-zinc-400 mt-3 max-w-xl leading-relaxed">
              Управління маржинальністю та ціноутворенням брендів. Налаштуйте базову ставку або задайте унікальний множник ціни для кожного постачальника.
            </p>
          </div>

          <div className="flex items-center gap-4">
            {saveStatus === 'success' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                <Check className="w-5 h-5" /> Збережено
              </motion.div>
            )}
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="group relative inline-flex items-center gap-3 overflow-hidden rounded-2xl bg-white px-8 py-4 text-sm font-bold uppercase tracking-widest text-black shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all duration-300 hover:scale-[1.02] hover:bg-zinc-200 hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] disabled:opacity-50 disabled:hover:scale-100"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 transition-transform group-hover:-translate-y-1" />}
              {saving ? 'Збереження...' : 'Зберегти зміни'}
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
           {/* Card 1: Default Markup */}
           <div className="relative group overflow-hidden rounded-3xl border border-white/[0.08] bg-black/40 backdrop-blur-xl p-6 transition-all hover:border-amber-500/30 hover:bg-black/60">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
              <div className="relative flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Percent className="w-5 h-5 text-amber-500" />
                </div>
                <div className="bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded">Глобально</div>
              </div>
              <h3 className="text-zinc-400 text-xs uppercase tracking-widest font-medium mb-1">Базова Націнка</h3>
              <div className="flex items-end gap-2">
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={defaultMarkup}
                  onChange={(e) => setDefaultMarkup(Number(e.target.value))}
                  className="w-20 bg-transparent border-b-2 border-amber-500/50 text-3xl font-light text-white focus:outline-none focus:border-amber-400 pb-1"
                />
                <span className="text-xl text-zinc-500 font-light pb-2">%</span>
              </div>
           </div>

           {/* Card 2: Total Brands */}
           <div className="relative group overflow-hidden rounded-3xl border border-white/[0.08] bg-black/40 backdrop-blur-xl p-6 transition-all hover:border-indigo-500/30 hover:bg-black/60">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />
              <div className="relative flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <Settings2 className="w-5 h-5 text-indigo-500" />
                </div>
              </div>
              <h3 className="text-zinc-400 text-xs uppercase tracking-widest font-medium mb-1">Синхронізовані Бренди</h3>
              <div className="flex items-end gap-2">
                <div className="text-4xl font-light text-white">{brands.length}</div>
              </div>
           </div>

           {/* Card 3: Custom Markups Active */}
           <div className="relative group overflow-hidden rounded-3xl border border-white/[0.08] bg-black/40 backdrop-blur-xl p-6 transition-all hover:border-rose-500/30 hover:bg-black/60">
              <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent pointer-events-none" />
              <div className="relative flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-rose-500" />
                </div>
              </div>
              <h3 className="text-zinc-400 text-xs uppercase tracking-widest font-medium mb-1">Кастомні Конфіги</h3>
              <div className="flex items-end gap-2">
                <div className="text-4xl font-light text-white">{customCount}</div>
                <span className="text-sm text-zinc-500 font-light pb-1 mb-1">/{brands.length}</span>
              </div>
           </div>

           {/* Card 4: Avg Multiplier */}
           <div className="relative group overflow-hidden rounded-3xl border border-white/[0.08] bg-black/40 backdrop-blur-xl p-6 transition-all hover:border-emerald-500/30 hover:bg-black/60">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
              <div className="relative flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded">Прогноз</div>
              </div>
              <h3 className="text-zinc-400 text-xs uppercase tracking-widest font-medium mb-1">Середня Маржа сайту</h3>
              <div className="flex items-end gap-2">
                <div className="text-4xl font-light text-white">{avgMarkup}</div>
                <span className="text-xl text-zinc-500 font-light pb-1">%</span>
              </div>
           </div>
        </div>

        {/* Filters Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 mb-6">
          <div className="flex-1 flex items-center border border-white/10 bg-white/[0.03] rounded-2xl px-5 h-14 backdrop-blur-md focus-within:border-indigo-500/50 focus-within:bg-indigo-500/5 transition-all">
            <Search className="w-5 h-5 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Швидкий пошук бренду..."
              className="w-full bg-transparent text-base text-white placeholder-zinc-600 focus:outline-none py-2 px-4"
            />
          </div>
          <button
            onClick={() => setShowOnlyCustom(!showOnlyCustom)}
            className={`flex items-center justify-center gap-3 px-6 h-14 rounded-2xl border text-sm font-semibold uppercase tracking-widest transition-all ${
              showOnlyCustom
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Filter className="w-4 h-4" />
            Кастомні ({customCount})
          </button>
          <button
            onClick={() => setSortBy(sortBy === 'name' ? 'markup' : 'name')}
            className="flex items-center justify-center gap-3 px-6 h-14 rounded-2xl border border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white hover:bg-white/5 text-sm font-semibold uppercase tracking-widest transition-all"
          >
            <ArrowUpDown className="w-4 h-4" />
            {sortBy === 'name' ? 'Сорт: A→Z' : 'Сорт: % Від найвищої'}
          </button>
        </div>

        {/* Data Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-12 h-12 rounded-full border-2 border-zinc-800 border-t-indigo-500 animate-spin mb-6 shadow-[0_0_20px_rgba(99,102,241,0.4)]"></div>
            <p className="text-zinc-500 uppercase tracking-widest text-sm font-bold animate-pulse">Зчитування даних з Turn14...</p>
          </div>
        ) : (
          <div className="rounded-3xl border border-white/[0.08] bg-black/40 backdrop-blur-2xl overflow-hidden shadow-2xl relative">
            
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-6 bg-white/[0.02] border-b border-white/[0.05] px-8 py-5 text-[11px] uppercase tracking-[0.2em] font-bold text-zinc-500">
              <div className="col-span-12 md:col-span-4">Управління Брендом</div>
              <div className="col-span-12 md:col-span-4">Встановити % Націнки</div>
              <div className="col-span-6 md:col-span-2 text-center md:text-right">Multiplier</div>
              <div className="col-span-6 md:col-span-2 text-right">Статус</div>
            </div>

            <div className="divide-y divide-white/[0.04]">
              <AnimatePresence>
                {displayBrands.map((brand, i) => {
                  const markup = getMarkupForBrand(brand.id);
                  const isEdited = editedMarkups[brand.id] !== undefined;
                  const isCustom = isCustomMarkup(brand.id);
                  const multiplier = 1 + markup / 100;
                  
                  // Color scale based on multiplier
                  const mLevel = 
                    multiplier >= 1.5 ? 'text-emerald-400' : 
                    multiplier >= 1.3 ? 'text-indigo-400' : 
                    multiplier >= 1.1 ? 'text-amber-400' : 
                    'text-zinc-400';

                  return (
                    <motion.div
                      key={brand.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.2) }}
                      className={`grid grid-cols-12 gap-6 items-center px-8 py-5 transition-all duration-300 hover:bg-white/[0.02] ${
                        isEdited ? 'bg-amber-500/[0.03] border-l-2 border-amber-500' : 'border-l-2 border-transparent'
                      }`}
                    >
                      {/* Brand name */}
                      <div className="col-span-12 md:col-span-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-xs font-bold text-zinc-400 uppercase">
                          {brand.name.substring(0,2)}
                        </div>
                        <div>
                          <div className="text-base font-medium text-zinc-200 tracking-wide flex items-center gap-2">
                            {brand.name}
                            {isEdited && <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" title="Unsaved changes" />}
                          </div>
                          <div className="text-[10px] text-zinc-600 uppercase tracking-widest mt-1 font-mono">ID: {brand.id.substring(0,8)}...</div>
                        </div>
                      </div>

                      {/* Markup controls */}
                      <div className="col-span-12 md:col-span-4 flex items-center gap-4">
                        <input
                          type="range"
                          min={0}
                          max={150}
                          step={1}
                          value={markup}
                          onChange={(e) => handleMarkupChange(brand.id, Number(e.target.value))}
                          className="flex-1 h-2 appearance-none bg-zinc-800 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
                          style={{
                            backgroundImage: `linear-gradient(to right, ${multiplier >= 1.3 ? '#6366f1' : '#f59e0b'}, ${multiplier >= 1.3 ? '#818cf8' : '#fbbf24'})`,
                            backgroundSize: `${(markup / 150) * 100}% 100%`,
                            backgroundRepeat: 'no-repeat'
                          }}
                        />
                        <div className="relative">
                          <input
                            type="number"
                            min={0}
                            max={500}
                            step={1}
                            value={markup}
                            onChange={(e) => handleMarkupChange(brand.id, Number(e.target.value))}
                            className="w-16 bg-black border border-white/10 rounded-xl px-2 py-2 text-white text-center text-sm font-semibold focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono"
                          />
                          <span className="absolute -right-2 -top-1 text-[9px] text-zinc-500 font-bold">%</span>
                        </div>
                      </div>

                      {/* Multiplier Badge */}
                      <div className="col-span-6 md:col-span-2 text-center md:text-right flex items-center justify-center md:justify-end gap-2">
                        <span className={`text-base font-mono font-bold ${mLevel} tracking-widest`}>
                          ×{multiplier.toFixed(2)}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="col-span-6 md:col-span-2 flex items-center justify-end">
                        {isCustom ? (
                          <div className="inline-flex flex-col items-end">
                            <span className="text-[10px] uppercase tracking-widest font-bold text-amber-500 border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 rounded-lg shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                              Унікальна
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 rounded-lg">
                            Global
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {displayBrands.length === 0 && (
              <div className="text-center py-24">
                <Search className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                <p className="text-zinc-500 uppercase tracking-widest text-sm font-bold">
                  {searchQuery ? `Жодного бренду за запитом "${searchQuery}"` : 'Бренди не знайдені'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
