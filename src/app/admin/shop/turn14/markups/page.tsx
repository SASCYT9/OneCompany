'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Save, Percent, Loader2, Check, AlertCircle,
  ArrowUpDown, Filter, ChevronDown
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

      // Turn14 brands from API
      const turn14Brands = brandsRes.brands || [];
      setBrands(turn14Brands);

      // Existing markups from DB
      const existingMarkups = markupsRes.markups || [];
      setMarkups(existingMarkups);
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
        setSaveStatus('success');
        setSaving(false);
        return;
      }

      const res = await fetch('/api/admin/shop/turn14/markups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markups: updates }),
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

  // Filter & sort
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
  const customCount = brands.filter(b => isCustomMarkup(b.id)).length;

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-white flex items-center gap-3">
            <Percent className="w-6 h-6 text-amber-400" />
            Brand Markup
          </h1>
          <p className="text-xs text-white/30 mt-1">
            {brands.length} брендів Turn14 · {customCount} з кастомною націнкою · Default: {defaultMarkup}%
          </p>
        </div>

        <AnimatePresence mode="wait">
          {hasChanges && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={handleSaveAll}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs uppercase tracking-widest font-medium disabled:opacity-50 transition-all rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.2)]"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Зберігаю...' : `Зберегти (${Object.keys(editedMarkups).length})`}
            </motion.button>
          )}
        </AnimatePresence>

        {saveStatus === 'success' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-emerald-400 text-xs">
            <Check className="w-4 h-4" /> Збережено!
          </motion.div>
        )}
      </div>

      {/* Default markup editor */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-medium text-white/70">Default Markup для всіх брендів</h3>
            <p className="text-[9px] text-white/30 mt-0.5">Використовується якщо бренд не має індивідуальної ціни</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={200}
              step={1}
              value={defaultMarkup}
              onChange={(e) => setDefaultMarkup(Number(e.target.value))}
              className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-center text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
            />
            <span className="text-white/30 text-sm">%</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-6">
        <div className="flex-1 flex items-center border border-white/10 bg-white/[0.02] rounded-xl px-4">
          <Search className="w-4 h-4 text-white/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Пошук бренду..."
            className="w-full bg-transparent text-sm text-white placeholder-white/20 focus:outline-none py-3 px-3"
          />
        </div>
        <button
          onClick={() => setShowOnlyCustom(!showOnlyCustom)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs transition-all ${
            showOnlyCustom
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              : 'bg-white/[0.02] border-white/10 text-white/40 hover:text-white/60'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          Тільки кастомні ({customCount})
        </button>
        <button
          onClick={() => setSortBy(sortBy === 'name' ? 'markup' : 'name')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.02] text-white/40 hover:text-white/60 text-xs transition-all"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          {sortBy === 'name' ? 'A→Z' : '% ↓'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400/30" />
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Header row */}
          <div className="grid grid-cols-12 gap-4 px-5 py-2 text-[9px] uppercase tracking-widest text-white/30 font-medium">
            <div className="col-span-5">Бренд</div>
            <div className="col-span-2 text-center">Markup %</div>
            <div className="col-span-2 text-center">Ціна (×)</div>
            <div className="col-span-3 text-right">Статус</div>
          </div>

          {displayBrands.map((brand, i) => {
            const markup = getMarkupForBrand(brand.id);
            const isEdited = editedMarkups[brand.id] !== undefined;
            const isCustom = isCustomMarkup(brand.id);
            const multiplier = 1 + markup / 100;

            return (
              <motion.div
                key={brand.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.01, 0.5) }}
                className={`grid grid-cols-12 gap-4 items-center px-5 py-3 rounded-xl border transition-all ${
                  isEdited
                    ? 'bg-amber-500/5 border-amber-500/15'
                    : isCustom
                    ? 'bg-white/[0.02] border-white/[0.06]'
                    : 'bg-transparent border-white/[0.03] hover:bg-white/[0.01]'
                }`}
              >
                {/* Brand name */}
                <div className="col-span-5">
                  <span className="text-sm text-white/80">{brand.name}</span>
                  {isEdited && <span className="ml-2 text-[8px] text-amber-400">змінено</span>}
                </div>

                {/* Markup slider + input */}
                <div className="col-span-2 flex items-center justify-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={markup}
                    onChange={(e) => handleMarkupChange(brand.id, Number(e.target.value))}
                    className="w-16 h-1 appearance-none bg-white/10 rounded-full accent-amber-500 cursor-pointer"
                  />
                  <input
                    type="number"
                    min={0}
                    max={200}
                    step={1}
                    value={markup}
                    onChange={(e) => handleMarkupChange(brand.id, Number(e.target.value))}
                    className="w-14 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-center text-xs focus:outline-none focus:border-amber-500/50 transition-colors"
                  />
                  <span className="text-white/20 text-xs">%</span>
                </div>

                {/* Multiplier */}
                <div className="col-span-2 text-center">
                  <span className="text-xs text-white/40 font-mono">×{multiplier.toFixed(2)}</span>
                </div>

                {/* Status */}
                <div className="col-span-3 flex items-center justify-end gap-2">
                  {isCustom ? (
                    <span className="text-[9px] uppercase tracking-widest font-medium text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md">
                      Кастом
                    </span>
                  ) : (
                    <span className="text-[9px] uppercase tracking-widest font-medium text-white/20 bg-white/[0.03] px-2.5 py-1 rounded-md">
                      Default {defaultMarkup}%
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}

          {displayBrands.length === 0 && (
            <div className="text-center py-12 text-white/20 text-sm">
              {searchQuery ? `Нічого не знайдено по "${searchQuery}"` : 'Немає брендів'}
            </div>
          )}
        </div>
      )}

      {/* Sticky save bar */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-3 flex items-center gap-4 shadow-2xl"
          >
            <span className="text-xs text-white/50">{Object.keys(editedMarkups).length} змін</span>
            <button
              onClick={() => setEditedMarkups({})}
              className="text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              Скинути
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs uppercase tracking-widest font-medium rounded-xl transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Зберегти
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
