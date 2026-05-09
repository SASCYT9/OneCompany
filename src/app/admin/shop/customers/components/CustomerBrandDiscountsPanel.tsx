'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useToast } from '@/components/admin/AdminToast';
import { AdminTableShell } from '@/components/admin/AdminPrimitives';

type Discount = {
  id: string;
  brand: string;
  discountPct: number;
  notes: string | null;
  updatedAt: string;
};

type Props = {
  customerId: string;
  globalDiscountPct: number | null;
};

const KNOWN_BRANDS = [
  'Akrapovic',
  'Brabus',
  'Burger Motorsports',
  'CSF',
  'iPE',
  'Ohlins',
  'Adro',
  'do88',
  'GiroDisc',
  'Racechip',
  'Urban',
];

export function CustomerBrandDiscountsPanel({ customerId, globalDiscountPct }: Props) {
  const toast = useToast();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [newBrand, setNewBrand] = useState('');
  const [newPct, setNewPct] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/shop/customers/${customerId}/brand-discounts`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError((data as { error?: string }).error || 'Не вдалося завантажити знижки');
        return;
      }
      setDiscounts((data as { discounts: Discount[] }).discounts ?? []);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!newBrand.trim()) {
      setError('Виберіть бренд або введіть назву');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/shop/customers/${customerId}/brand-discounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: newBrand.trim(),
          discountPct: Number(newPct),
          notes: newNotes.trim() || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = (data as { error?: string }).error || 'Не вдалося зберегти';
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success(`Знижку ${newBrand} оновлено`);
      setNewBrand('');
      setNewPct('');
      setNewNotes('');
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(brand: string) {
    if (!window.confirm(`Видалити знижку для ${brand}?`)) return;
    setSaving(true);
    try {
      const response = await fetch(
        `/api/admin/shop/customers/${customerId}/brand-discounts?brand=${encodeURIComponent(brand)}`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast.error((data as { error?: string }).error || 'Не вдалося видалити');
        return;
      }
      toast.success(`Знижку ${brand} видалено`);
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-none border border-white/10 bg-[#171717] p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-zinc-100">Знижки по брендах</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Персональна знижка % окремо для кожного бренду. Якщо запис відсутній — застосовується
          глобальна B2B-знижка
          {globalDiscountPct != null ? ` (${globalDiscountPct}%)` : ' (не задана)'}.
        </p>
        <p className="mt-1 text-[11px] text-amber-300/70">
          ⚠️ Інтеграція з ціноутворенням — у наступному етапі. Поки що ці значення зберігаються,
          але pricing-логіка не змінюється — використовується глобальна знижка.
        </p>
      </div>

      {/* Add form */}
      <div className="rounded-none border border-white/10 bg-black/25 p-4 mb-5">
        <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr_2fr_auto]">
          <div>
            <label className="block">
              <span className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-1">Бренд</span>
              <input
                list="known-brands"
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value)}
                placeholder="Akrapovic"
                className="w-full rounded-none border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              />
              <datalist id="known-brands">
                {KNOWN_BRANDS.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </label>
          </div>
          <div>
            <label className="block">
              <span className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-1">Знижка %</span>
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={newPct}
                onChange={(e) => setNewPct(e.target.value)}
                placeholder="15"
                className="w-full rounded-none border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>
          <div>
            <label className="block">
              <span className="block text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-1">Нотатка</span>
              <input
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="особливі умови (опційно)"
                className="w-full rounded-none border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void add()}
              disabled={saving || !newBrand.trim() || !newPct}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Додати
            </button>
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      </div>

      {/* Existing list */}
      {loading ? (
        <div className="rounded-none border border-white/10 bg-black/25 px-4 py-8 text-sm text-zinc-500">
          Завантаження…
        </div>
      ) : discounts.length === 0 ? (
        <div className="rounded-none border border-dashed border-white/10 px-4 py-10 text-sm text-zinc-500">
          Персональних знижок по брендах ще немає. Усі бренди використовують глобальну знижку
          {globalDiscountPct != null ? ` ${globalDiscountPct}%.` : '.'}
        </div>
      ) : (
        <AdminTableShell>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  <th className="px-4 py-3 font-medium">Бренд</th>
                  <th className="px-4 py-3 font-medium text-right">Знижка</th>
                  <th className="px-4 py-3 font-medium">Нотатка</th>
                  <th className="px-4 py-3 font-medium">Оновлено</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {discounts.map((d) => (
                  <tr key={d.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-zinc-100 font-medium">{d.brand}</td>
                    <td className="px-4 py-3 text-emerald-300 font-semibold text-right tabular-nums">
                      −{d.discountPct.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{d.notes || '—'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {new Date(d.updatedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void remove(d.brand)}
                        disabled={saving}
                        className="inline-flex items-center gap-1 text-xs text-red-300/80 hover:text-red-200 transition disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Видалити
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminTableShell>
      )}
    </section>
  );
}
