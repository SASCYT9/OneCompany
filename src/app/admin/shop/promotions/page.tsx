'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BadgePercent, Plus, RefreshCcw, Trash2 } from 'lucide-react';

type PromotionRow = {
  id: string;
  storeKey: string;
  code: string | null;
  titleUa: string;
  titleEn: string;
  descriptionUa: string | null;
  descriptionEn: string | null;
  promotionType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
  discountValue: number | null;
  currency: string | null;
  minimumSubtotal: number | null;
  usageLimit: number | null;
  usageCount: number;
  customerGroup: 'B2C' | 'B2B_PENDING' | 'B2B_APPROVED' | null;
  appliesToAll: boolean;
  productSlugs: string[];
  categorySlugs: string[];
  brandNames: string[];
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
};

type ShopStoreSummary = {
  key: string;
  name: string;
};

type FormState = {
  code: string;
  titleUa: string;
  titleEn: string;
  descriptionUa: string;
  descriptionEn: string;
  promotionType: PromotionRow['promotionType'];
  discountValue: string;
  currency: string;
  minimumSubtotal: string;
  usageLimit: string;
  customerGroup: string;
  appliesToAll: boolean;
  productSlugs: string;
  categorySlugs: string;
  brandNames: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

function createEmptyForm(): FormState {
  return {
    code: '',
    titleUa: '',
    titleEn: '',
    descriptionUa: '',
    descriptionEn: '',
    promotionType: 'PERCENTAGE',
    discountValue: '',
    currency: 'EUR',
    minimumSubtotal: '',
    usageLimit: '',
    customerGroup: '',
    appliesToAll: true,
    productSlugs: '',
    categorySlugs: '',
    brandNames: '',
    startsAt: '',
    endsAt: '',
    isActive: true,
  };
}

export default function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [stores, setStores] = useState<ShopStoreSummary[]>([]);
  const [storeKey, setStoreKey] = useState('urban');
  const [form, setForm] = useState<FormState>(createEmptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const activePromotions = useMemo(() => promotions.filter((promotion) => promotion.isActive).length, [promotions]);

  useEffect(() => {
    void loadStores();
  }, []);

  useEffect(() => {
    void loadPromotions();
  }, [storeKey]);

  async function loadStores() {
    try {
      const response = await fetch('/api/admin/shop/stores');
      const data = await response.json().catch(() => []);
      if (!response.ok) return;
      const nextStores = data as ShopStoreSummary[];
      setStores(nextStores);
      if (nextStores.length && !nextStores.some((store) => store.key === storeKey)) {
        setStoreKey(nextStores[0].key);
      }
    } catch {
      // ignore
    }
  }

  async function loadPromotions() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/shop/promotions?store=${encodeURIComponent(storeKey)}`);
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        setError(data.error || 'Не вдалося завантажити акції');
        return;
      }
      setPromotions(data as PromotionRow[]);
    } finally {
      setLoading(false);
    }
  }

  function startEditing(promotion: PromotionRow) {
    setEditingId(promotion.id);
    setForm({
      code: promotion.code ?? '',
      titleUa: promotion.titleUa,
      titleEn: promotion.titleEn,
      descriptionUa: promotion.descriptionUa ?? '',
      descriptionEn: promotion.descriptionEn ?? '',
      promotionType: promotion.promotionType,
      discountValue: promotion.discountValue != null ? String(promotion.discountValue) : '',
      currency: promotion.currency ?? 'EUR',
      minimumSubtotal: promotion.minimumSubtotal != null ? String(promotion.minimumSubtotal) : '',
      usageLimit: promotion.usageLimit != null ? String(promotion.usageLimit) : '',
      customerGroup: promotion.customerGroup ?? '',
      appliesToAll: promotion.appliesToAll,
      productSlugs: promotion.productSlugs.join(', '),
      categorySlugs: promotion.categorySlugs.join(', '),
      brandNames: promotion.brandNames.join(', '),
      startsAt: promotion.startsAt ? promotion.startsAt.slice(0, 16) : '',
      endsAt: promotion.endsAt ? promotion.endsAt.slice(0, 16) : '',
      isActive: promotion.isActive,
    });
    setError('');
    setSuccess('');
  }

  function resetForm() {
    setEditingId(null);
    setForm(createEmptyForm());
    setError('');
    setSuccess('');
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(editingId ? `/api/admin/shop/promotions/${editingId}` : '/api/admin/shop/promotions', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeKey,
          ...form,
          discountValue: form.discountValue || null,
          minimumSubtotal: form.minimumSubtotal || null,
          usageLimit: form.usageLimit || null,
          customerGroup: form.customerGroup || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || (editingId ? 'Не вдалося оновити акцію' : 'Не вдалося створити акцію'));
        return;
      }
      resetForm();
      setSuccess(editingId ? 'Акцію оновлено.' : 'Акцію збережено.');
      await loadPromotions();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Видалити цю акцію або промокод?')) {
      return;
    }
    const response = await fetch(`/api/admin/shop/promotions/${id}`, { method: 'DELETE' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || 'Не вдалося видалити акцію');
      return;
    }
    await loadPromotions();
  }

  async function handleToggle(id: string, isActive: boolean) {
    const response = await fetch(`/api/admin/shop/promotions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || 'Не вдалося оновити акцію');
      return;
    }
    await loadPromotions();
  }

  return (
    <div className="h-full overflow-auto">
      <div className="w-full px-4 py-6 md:px-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/admin/shop" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Назад до каталогу
            </Link>
            <h2 className="mt-3 text-2xl font-semibold text-white">Акції, купони та промокоди</h2>
            <p className="mt-2 text-sm text-white/45">
              Тут керуємо ручними акціями: відсоток, фіксована знижка або безкоштовна доставка. Промокоди застосовуються в checkout і пишуться в snapshot замовлення.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={storeKey}
              onChange={(event) => setStoreKey(event.target.value)}
              className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              {(stores.length ? stores : [{ key: 'urban', name: 'Urban Automotive' }]).map((store) => (
                <option key={store.key} value={store.key}>
                  {store.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadPromotions()}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700"
            >
              <RefreshCcw className="h-4 w-4" />
              Оновити
            </button>
          </div>
        </div>

        <div className="mb-4 grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-4 flex items-center gap-2 text-white">
              <Plus className="h-4 w-4" />
              {editingId ? 'Редагування акції' : 'Нова акція'}
            </div>
            <div className="space-y-3">
              <input value={form.code} onChange={(e) => setForm((current) => ({ ...current, code: e.target.value.toUpperCase() }))} placeholder="Промокод" className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <input value={form.titleUa} onChange={(e) => setForm((current) => ({ ...current, titleUa: e.target.value }))} placeholder="Назва UA" className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <input value={form.titleEn} onChange={(e) => setForm((current) => ({ ...current, titleEn: e.target.value }))} placeholder="Назва EN" className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <textarea value={form.descriptionUa} onChange={(e) => setForm((current) => ({ ...current, descriptionUa: e.target.value }))} placeholder="Опис UA" className="min-h-[84px] w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <textarea value={form.descriptionEn} onChange={(e) => setForm((current) => ({ ...current, descriptionEn: e.target.value }))} placeholder="Опис EN" className="min-h-[84px] w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <select value={form.promotionType} onChange={(e) => setForm((current) => ({ ...current, promotionType: e.target.value as FormState['promotionType'] }))} className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white">
                <option value="PERCENTAGE">Відсоток</option>
                <option value="FIXED_AMOUNT">Фіксована сума</option>
                <option value="FREE_SHIPPING">Безкоштовна доставка</option>
              </select>
              {form.promotionType !== 'FREE_SHIPPING' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={form.discountValue} onChange={(e) => setForm((current) => ({ ...current, discountValue: e.target.value }))} placeholder="Значення" className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white" />
                  <input value={form.currency} onChange={(e) => setForm((current) => ({ ...current, currency: e.target.value.toUpperCase() }))} placeholder="Валюта" className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white" />
                </div>
              ) : null}
              <input value={form.minimumSubtotal} onChange={(e) => setForm((current) => ({ ...current, minimumSubtotal: e.target.value }))} placeholder="Мінімальний subtotal" className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <input value={form.usageLimit} onChange={(e) => setForm((current) => ({ ...current, usageLimit: e.target.value }))} placeholder="Ліміт використань" className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <select value={form.customerGroup} onChange={(e) => setForm((current) => ({ ...current, customerGroup: e.target.value }))} className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white">
                <option value="">Усі клієнти</option>
                <option value="B2C">B2C</option>
                <option value="B2B_PENDING">B2B pending</option>
                <option value="B2B_APPROVED">B2B approved</option>
              </select>
              <input value={form.productSlugs} onChange={(e) => setForm((current) => ({ ...current, productSlugs: e.target.value }))} placeholder="Product slugs через кому" className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <input value={form.categorySlugs} onChange={(e) => setForm((current) => ({ ...current, categorySlugs: e.target.value }))} placeholder="Category slugs через кому" className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <input value={form.brandNames} onChange={(e) => setForm((current) => ({ ...current, brandNames: e.target.value }))} placeholder="Бренди через кому" className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white" />
              <div className="grid gap-3 sm:grid-cols-2">
                <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm((current) => ({ ...current, startsAt: e.target.value }))} className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white" />
                <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm((current) => ({ ...current, endsAt: e.target.value }))} className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white" />
              </div>
              <label className="flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={form.appliesToAll} onChange={(e) => setForm((current) => ({ ...current, appliesToAll: e.target.checked }))} /> Застосовувати до всього замовлення</label>
              <label className="flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm((current) => ({ ...current, isActive: e.target.checked }))} /> Активна</label>
              <div className="flex gap-3">
                <button type="button" onClick={() => void handleSave()} disabled={saving} className="flex-1 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50">
                  {saving ? 'Зберігаємо…' : editingId ? 'Оновити акцію' : 'Створити акцію'}
                </button>
                {editingId ? (
                  <button type="button" onClick={resetForm} className="rounded-lg border border-white/10 bg-zinc-950 px-4 py-2 text-sm text-white hover:bg-zinc-900">
                    Скасувати
                  </button>
                ) : null}
              </div>
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              {success ? <p className="text-sm text-emerald-400">{success}</p> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-white/65">{promotions.length} акцій, з них {activePromotions} активних</div>
              <div className="inline-flex items-center gap-2 text-sm text-white/50">
                <BadgePercent className="h-4 w-4" />
                Checkout-ready
              </div>
            </div>

            {loading ? (
              <div className="text-white/50">Завантаження…</div>
            ) : (
              <div className="space-y-3">
                {promotions.map((promotion) => (
                  <div key={promotion.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-white">{promotion.titleUa}</span>
                          {promotion.code ? <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-white/60">{promotion.code}</span> : null}
                          <span className={`rounded-full px-2 py-0.5 text-xs ${promotion.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-white/50'}`}>
                            {promotion.isActive ? 'Активна' : 'Вимкнена'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-white/45">
                          {promotion.promotionType} · використано {promotion.usageCount}
                          {promotion.usageLimit != null ? ` / ${promotion.usageLimit}` : ''}
                        </p>
                        <p className="mt-2 text-sm text-white/70">
                          {promotion.descriptionUa || 'Без окремого опису'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEditing(promotion)}
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75 hover:bg-white/10"
                        >
                          Редагувати
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggle(promotion.id, !promotion.isActive)}
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75 hover:bg-white/10"
                        >
                          {promotion.isActive ? 'Вимкнути' : 'Увімкнути'}
                        </button>
                        <button type="button" onClick={() => void handleDelete(promotion.id)} className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {!promotions.length ? <div className="text-sm text-white/45">Поки немає акцій або промокодів.</div> : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
