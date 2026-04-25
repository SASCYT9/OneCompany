'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Filter, RefreshCw, Save } from 'lucide-react';

import {
  AdminActionBar,
  AdminEmptyState,
  AdminFilterBar,
  AdminInlineAlert,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableShell,
} from '@/components/admin/AdminPrimitives';

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
        fetch('/api/shop/stock/search?brandsOnly=true').then((r) => r.json()).catch(() => ({ brands: [] })),
        fetch('/api/admin/shop/turn14/markups').then((r) => r.json()).catch(() => ({ markups: [], defaultMarkup: 25 })),
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

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const getMarkupForBrand = (brandId: string): number => {
    if (editedMarkups[brandId] !== undefined) return editedMarkups[brandId];
    const existing = markups.find((m) => m.brandId === brandId);
    return existing ? existing.markupPct : defaultMarkup;
  };

  const isCustomMarkup = (brandId: string): boolean => {
    return editedMarkups[brandId] !== undefined || markups.some((m) => m.brandId === brandId);
  };

  const handleMarkupChange = (brandId: string, value: number) => {
    setEditedMarkups((prev) => ({ ...prev, [brandId]: value }));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const updates = Object.entries(editedMarkups).map(([brandId, markupPct]) => {
        const brand = brands.find((b) => b.id === brandId);
        return {
          brandId,
          brandName: brand?.name || brandId,
          markupPct,
        };
      });

      const res = await fetch('/api/admin/shop/turn14/markups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultMarkup, markups: updates }),
      });

      if (!res.ok) {
        throw new Error('Failed to save markups');
      }

      setSaveStatus('success');
      setEditedMarkups({});
      await fetchData();
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const customCount = brands.filter((b) => isCustomMarkup(b.id)).length;
  const avgMarkup = useMemo(() => {
    if (!brands.length) return defaultMarkup;
    const total = brands.reduce((sum, brand) => sum + getMarkupForBrand(brand.id), 0);
    return Math.round(total / brands.length);
  }, [brands, editedMarkups, markups, defaultMarkup]);

  let displayBrands = brands.filter((b) => b.name.toLowerCase().includes(searchQuery.toLowerCase()));

  if (showOnlyCustom) {
    displayBrands = displayBrands.filter((b) => isCustomMarkup(b.id));
  }

  displayBrands.sort((a, b) => {
    if (sortBy === 'markup') {
      return getMarkupForBrand(b.id) - getMarkupForBrand(a.id);
    }
    return a.name.localeCompare(b.name);
  });

  const hasChanges = Object.keys(editedMarkups).length > 0;

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Supplier Workspace"
        title="Turn14 Brand Markups"
        description="Операційний контроль базового markup policy та винятків по брендах для supplier-driven ціноутворення."
        actions={
          <Link
            href="/admin/shop/turn14"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:border-white/25 hover:text-zinc-100"
          >
            Back to Turn14
          </Link>
        }
      />

      <AdminMetricGrid>
        <AdminMetricCard label="Default markup" value={`${defaultMarkup}%`} meta="Базове правило для всіх брендів" />
        <AdminMetricCard label="Brands" value={brands.length} meta="Синхронізований список брендів" />
        <AdminMetricCard label="Custom rules" value={customCount} meta="Бренди з override" />
        <AdminMetricCard label="Average markup" value={`${avgMarkup}%`} meta="Поточна середня ставка" />
      </AdminMetricGrid>

      <AdminActionBar>
        <div className="space-y-1">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Pricing policy</div>
          <div className="text-sm text-zinc-300">Змінюйте default markup або брендові винятки, потім фіксуйте все одним збереженням.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminStatusBadge tone={hasChanges ? 'warning' : 'success'}>
            {hasChanges ? `${Object.keys(editedMarkups).length} unsaved changes` : 'All changes saved'}
          </AdminStatusBadge>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
          >
            {saving ? <RefreshCw className="h-4 w-4 motion-safe:animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Збереження...' : 'Зберегти зміни'}
          </button>
        </div>
      </AdminActionBar>

      {saveStatus === 'success' ? <AdminInlineAlert tone="success">Налаштування націнок збережено.</AdminInlineAlert> : null}
      {saveStatus === 'error' ? <AdminInlineAlert tone="error">Не вдалося зберегти націнки. Перевірте API або спробуйте ще раз.</AdminInlineAlert> : null}

      <AdminFilterBar>
        <label className="min-w-[260px] flex-1">
          <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Brand search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Швидкий пошук бренду..."
            className="w-full rounded-[6px] border border-white/10 bg-[#0F0F0F] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-white/20 focus:outline-none"
          />
        </label>

        <label className="w-full md:w-[220px]">
          <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Sort</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'markup')}
            className="w-full rounded-[6px] border border-white/10 bg-[#0F0F0F] px-4 py-3 text-sm text-zinc-100 focus:border-white/20 focus:outline-none"
          >
            <option value="name">A → Z</option>
            <option value="markup">% descending</option>
          </select>
        </label>

        <button
          type="button"
          onClick={() => setShowOnlyCustom(!showOnlyCustom)}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-3 text-sm transition ${
            showOnlyCustom
              ? 'border-amber-300/20 bg-amber-500/10 text-blue-300'
              : 'border-white/10 text-zinc-300 hover:border-white/25 hover:text-zinc-100'
          }`}
        >
          <Filter className="h-4 w-4" />
          {showOnlyCustom ? 'Only custom rules' : 'All brands'}
        </button>
      </AdminFilterBar>

      {loading ? (
        <AdminEmptyState title="Завантаження markup grid" description="Підтягуємо бренди та збережені правила з Turn14 pricing layer." />
      ) : displayBrands.length === 0 ? (
        <AdminEmptyState
          title="Бренди не знайдені"
          description={searchQuery ? `Немає брендів за запитом "${searchQuery}".` : 'Немає даних по брендах для редагування.'}
        />
      ) : (
        <AdminTableShell>
          <table className="min-w-full text-left text-sm text-zinc-200">
            <thead className="bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Brand</th>
                <th className="px-4 py-3 font-medium">Markup %</th>
                <th className="px-4 py-3 font-medium">Multiplier</th>
                <th className="px-4 py-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayBrands.map((brand) => {
                const markup = getMarkupForBrand(brand.id);
                const isEdited = editedMarkups[brand.id] !== undefined;
                const isCustom = isCustomMarkup(brand.id);
                const multiplier = 1 + markup / 100;

                return (
                  <tr key={brand.id} className="border-t border-white/8">
                    <td className="px-4 py-4">
                      <div className="font-medium text-zinc-100">{brand.name}</div>
                      <div className="mt-1 text-xs text-zinc-500">ID: {brand.id}</div>
                    </td>
                    <td className="px-4 py-4">
                      <input
                        type="number"
                        min={0}
                        max={500}
                        step={1}
                        value={markup}
                        onChange={(e) => handleMarkupChange(brand.id, Number(e.target.value))}
                        className="w-28 rounded-[6px] border border-white/10 bg-[#0F0F0F] px-4 py-3 text-sm text-zinc-100 focus:border-white/20 focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-4 font-mono text-zinc-200">×{multiplier.toFixed(2)}</td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        {isEdited ? <AdminStatusBadge tone="warning">Edited</AdminStatusBadge> : null}
                        {isCustom ? <AdminStatusBadge>Custom rule</AdminStatusBadge> : <AdminStatusBadge tone="success">Default</AdminStatusBadge>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AdminTableShell>
      )}
    </AdminPage>
  );
}
