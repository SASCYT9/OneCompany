'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Coins, RefreshCcw, Search, Tags } from 'lucide-react';

type PricingRow = {
  id: string;
  productId: string;
  title: string | null;
  sku: string | null;
  position: number;
  priceEur: number | null;
  priceUsd: number | null;
  priceUah: number | null;
  priceEurB2b: number | null;
  priceUsdB2b: number | null;
  priceUahB2b: number | null;
  compareAtEur: number | null;
  compareAtUsd: number | null;
  compareAtUah: number | null;
  compareAtEurB2b: number | null;
  compareAtUsdB2b: number | null;
  compareAtUahB2b: number | null;
  isDefault: boolean;
  updatedAt: string;
  product: {
    id: string;
    slug: string;
    titleUa: string;
    titleEn: string;
    brand: string | null;
    vendor: string | null;
    scope: string;
    status: string;
    isPublished: boolean;
    stock: string;
    collectionIds: string[];
    collectionHandles: string[];
  };
};

type BulkPricingState = {
  priceEur: string;
  priceUsd: string;
  priceUah: string;
  priceEurB2b: string;
  priceUsdB2b: string;
  priceUahB2b: string;
  compareAtEur: string;
  compareAtUsd: string;
  compareAtUah: string;
  compareAtEurB2b: string;
  compareAtUsdB2b: string;
  compareAtUahB2b: string;
  multiplyUah: string;
  multiplyEur: string;
  multiplyUsd: string;
  multiplyUahB2b: string;
  multiplyEurB2b: string;
  multiplyUsdB2b: string;
};

function createEmptyBulkState(): BulkPricingState {
  return {
    priceEur: '',
    priceUsd: '',
    priceUah: '',
    priceEurB2b: '',
    priceUsdB2b: '',
    priceUahB2b: '',
    compareAtEur: '',
    compareAtUsd: '',
    compareAtUah: '',
    compareAtEurB2b: '',
    compareAtUsdB2b: '',
    compareAtUahB2b: '',
    multiplyUah: '',
    multiplyEur: '',
    multiplyUsd: '',
    multiplyUahB2b: '',
    multiplyEurB2b: '',
    multiplyUsdB2b: '',
  };
}

function priceLabel(value: number | null, prefix: string) {
  return value == null ? '—' : `${prefix}${value}`;
}

export default function AdminPricingPage() {
  const [variants, setVariants] = useState<PricingRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [query, setQuery] = useState('');
  const [bulk, setBulk] = useState<BulkPricingState>(createEmptyBulkState());

  useEffect(() => {
    void load();
  }, []);

  const filteredVariants = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return variants;
    return variants.filter((variant) =>
      [
        variant.product.slug,
        variant.product.titleEn,
        variant.product.titleUa,
        variant.product.brand,
        variant.product.vendor,
        variant.title,
        variant.sku,
        ...variant.product.collectionHandles,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [variants, query]);

  const visibleIds = filteredVariants.map((variant) => variant.id);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/shop/pricing');
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        setError(data.error || 'Не вдалося завантажити ціни');
        return;
      }
      setVariants(data as PricingRow[]);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  }

  function selectVisible() {
    setSelectedIds((current) => Array.from(new Set([...current, ...visibleIds])));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  async function applyBulk() {
    setError('');
    setSuccess('');

    if (!selectedIds.length) {
      setError('Оберіть щонайменше один варіант.');
      return;
    }

    const payload: Record<string, unknown> = {
      variantIds: selectedIds,
    };

    if (bulk.priceEur.trim()) payload.priceEur = Number(bulk.priceEur);
    if (bulk.priceUsd.trim()) payload.priceUsd = Number(bulk.priceUsd);
    if (bulk.priceUah.trim()) payload.priceUah = Number(bulk.priceUah);
    if (bulk.priceEurB2b.trim()) payload.priceEurB2b = Number(bulk.priceEurB2b);
    if (bulk.priceUsdB2b.trim()) payload.priceUsdB2b = Number(bulk.priceUsdB2b);
    if (bulk.priceUahB2b.trim()) payload.priceUahB2b = Number(bulk.priceUahB2b);
    if (bulk.compareAtEur.trim()) payload.compareAtEur = Number(bulk.compareAtEur);
    if (bulk.compareAtUsd.trim()) payload.compareAtUsd = Number(bulk.compareAtUsd);
    if (bulk.compareAtUah.trim()) payload.compareAtUah = Number(bulk.compareAtUah);
    if (bulk.compareAtEurB2b.trim()) payload.compareAtEurB2b = Number(bulk.compareAtEurB2b);
    if (bulk.compareAtUsdB2b.trim()) payload.compareAtUsdB2b = Number(bulk.compareAtUsdB2b);
    if (bulk.multiplyUah.trim()) payload.multiplyUah = Number(bulk.multiplyUah);
    if (bulk.multiplyEur.trim()) payload.multiplyEur = Number(bulk.multiplyEur);
    if (bulk.multiplyUsd.trim()) payload.multiplyUsd = Number(bulk.multiplyUsd);
    if (bulk.multiplyUahB2b.trim()) payload.multiplyUahB2b = Number(bulk.multiplyUahB2b);
    if (bulk.multiplyEurB2b.trim()) payload.multiplyEurB2b = Number(bulk.multiplyEurB2b);
    if (bulk.multiplyUsdB2b.trim()) payload.multiplyUsdB2b = Number(bulk.multiplyUsdB2b);

    if (Object.keys(payload).length === 1) {
      setError('Вкажіть щонайменше одну зміну ціни або множник для масового оновлення.');
      return;
    }

    setApplying(true);
    try {
      const response = await fetch('/api/admin/shop/pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Не вдалося оновити ціни');
        return;
      }
      setSuccess(`Оновлено варіантів: ${data.updatedCount ?? selectedIds.length}.`);
      setBulk(createEmptyBulkState());
      await load();
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-white/60 flex items-center gap-2">
        <Coins className="h-5 w-5 animate-pulse" />
        Завантаження цін…
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="w-full px-4 md:px-8 py-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/admin/shop" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Назад до каталогу
            </Link>
            <h2 className="mt-3 text-2xl font-semibold text-white">Ціни (B2C / B2B)</h2>
            <p className="mt-2 text-sm text-white/45">
              Масові операції з цінами по варіантах. Зміни дефолтного варіанту автоматично синхронізуються з ціною на картці товару для роздрібних (B2C) та оптових (B2B) клієнтів.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/admin/shop/inventory" className="rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">
              Склад
            </Link>
            <Link href="/admin/shop/promotions" className="rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">
              Акції / купони
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700"
            >
              <RefreshCcw className="h-4 w-4" />
              Оновити
            </button>
          </div>
        </div>

        <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="grid gap-2 text-sm text-white/70 md:grid-cols-4">
              <div>{variants.length} варіантів</div>
              <div>{variants.filter((variant) => variant.priceEur != null).length} мають ціну в EUR</div>
              <div>{variants.filter((variant) => variant.priceUsd != null).length} мають ціну в USD</div>
              <div>{variants.filter((variant) => variant.priceUah != null).length} мають ціну в UAH</div>
            </div>
            <label className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white">
              <Search className="h-4 w-4 text-white/35" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Пошук за товаром, варіантом, SKU або колекцією"
                className="w-full bg-transparent text-white placeholder:text-white/25 focus:outline-none"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-white">Вибір</div>
                <div className="mt-1 text-xs text-white/45">
                  Обрано {selectedIds.length}, на екрані {visibleIds.filter((id) => selectedIds.includes(id)).length}
                </div>
              </div>
              <Tags className="h-5 w-5 text-white/35" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={selectVisible} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white hover:bg-white/5">
                Обрати видимі
              </button>
              <button type="button" onClick={clearSelection} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white hover:bg-white/5">
                Очистити
              </button>
            </div>
          </div>
        </div>

        {error ? <div className="mb-4 rounded-lg bg-red-900/20 p-3 text-sm text-red-300">{error}</div> : null}
        {success ? <div className="mb-4 rounded-lg bg-green-900/20 p-3 text-sm text-green-200">{success}</div> : null}

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-white">Масове оновлення</h3>
            <p className="mt-1 text-sm text-white/45">
              Встановіть нові роздрібні (B2C) та оптові (B2B) ціни, а також compare‑at для обраних варіантів.
            </p>
            <div className="mt-3 rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white/65 space-y-1.5">
              <p className="font-medium text-white/85">Як користуватися:</p>
              <p>1. Знайдіть потрібні варіанти через пошук або фільтрацію по колекціях.</p>
              <p>2. Натисніть <span className="font-semibold text-white">«Обрати видимі»</span> або відмітьте чекбокси вручну.</p>
              <p>3. Заповніть потрібні поля вище (наприклад, тільки B2B UAH) — порожні поля не змінюються.</p>
              <p>4. Можна вказати <span className="font-semibold text-white">множник</span> (наприклад 1.1 = +10%) — поточна ціна варіанту буде помножена на це число.</p>
              <p>5. Натисніть <span className="font-semibold text-black bg-white/90 px-1 py-0.5 rounded">Застосувати до обраних</span>, щоб оновити ціни.</p>
              <p className="text-white/55">
                Зміни одразу впливають на ціни у вітрині магазину для відповідних клієнтів, тому перед масовими операціями бажано мати актуальний бекап.
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <InputField label="Ціна EUR" value={bulk.priceEur} onChange={(value) => setBulk((current) => ({ ...current, priceEur: value }))} />
            <InputField label="Ціна USD" value={bulk.priceUsd} onChange={(value) => setBulk((current) => ({ ...current, priceUsd: value }))} />
            <InputField label="Ціна UAH" value={bulk.priceUah} onChange={(value) => setBulk((current) => ({ ...current, priceUah: value }))} />
            <InputField label="Порівн. ціна EUR" value={bulk.compareAtEur} onChange={(value) => setBulk((current) => ({ ...current, compareAtEur: value }))} />
            <InputField label="Порівн. ціна USD" value={bulk.compareAtUsd} onChange={(value) => setBulk((current) => ({ ...current, compareAtUsd: value }))} />
            <InputField label="Порівн. ціна UAH" value={bulk.compareAtUah} onChange={(value) => setBulk((current) => ({ ...current, compareAtUah: value }))} />
            <InputField label="B2B (опт) EUR" value={bulk.priceEurB2b} onChange={(value) => setBulk((current) => ({ ...current, priceEurB2b: value }))} />
            <InputField label="B2B (опт) USD" value={bulk.priceUsdB2b} onChange={(value) => setBulk((current) => ({ ...current, priceUsdB2b: value }))} />
            <InputField label="B2B (опт) UAH" value={bulk.priceUahB2b} onChange={(value) => setBulk((current) => ({ ...current, priceUahB2b: value }))} />
            <InputField label="B2B порівн. EUR" value={bulk.compareAtEurB2b} onChange={(value) => setBulk((current) => ({ ...current, compareAtEurB2b: value }))} />
            <InputField label="B2B порівн. USD" value={bulk.compareAtUsdB2b} onChange={(value) => setBulk((current) => ({ ...current, compareAtUsdB2b: value }))} />
            <InputField label="B2B порівн. UAH" value={bulk.compareAtUahB2b} onChange={(value) => setBulk((current) => ({ ...current, compareAtUahB2b: value }))} />
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="mb-2 text-xs font-medium text-white/70">Множник (наприклад 1.1 = +10%, 0.9 = −10%)</p>
            <div className="grid gap-4 md:grid-cols-6">
              <InputField label="B2C UAH" value={bulk.multiplyUah} onChange={(value) => setBulk((current) => ({ ...current, multiplyUah: value }))} placeholder="1.1" />
              <InputField label="B2C EUR" value={bulk.multiplyEur} onChange={(value) => setBulk((current) => ({ ...current, multiplyEur: value }))} placeholder="1.1" />
              <InputField label="B2C USD" value={bulk.multiplyUsd} onChange={(value) => setBulk((current) => ({ ...current, multiplyUsd: value }))} placeholder="1.1" />
              <InputField label="B2B UAH" value={bulk.multiplyUahB2b} onChange={(value) => setBulk((current) => ({ ...current, multiplyUahB2b: value }))} placeholder="1.1" />
              <InputField label="B2B EUR" value={bulk.multiplyEurB2b} onChange={(value) => setBulk((current) => ({ ...current, multiplyEurB2b: value }))} placeholder="1.1" />
              <InputField label="B2B USD" value={bulk.multiplyUsdB2b} onChange={(value) => setBulk((current) => ({ ...current, multiplyUsdB2b: value }))} placeholder="1.1" />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={applyBulk}
              disabled={applying}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50"
            >
              <Coins className="h-4 w-4" />
              {applying ? 'Застосовуємо…' : 'Застосувати до обраних'}
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 font-medium text-white/60">Обрати</th>
                  <th className="px-4 py-3 font-medium text-white/60">Товар</th>
                  <th className="px-4 py-3 font-medium text-white/60">Варіант</th>
                  <th className="px-4 py-3 font-medium text-white/60">Колекції</th>
                  <th className="px-4 py-3 font-medium text-white/60">EUR</th>
                  <th className="px-4 py-3 font-medium text-white/60">B2B EUR</th>
                  <th className="px-4 py-3 font-medium text-white/60">USD</th>
                  <th className="px-4 py-3 font-medium text-white/60">B2B USD</th>
                  <th className="px-4 py-3 font-medium text-white/60">UAH</th>
                  <th className="px-4 py-3 font-medium text-white/60">B2B UAH</th>
                  <th className="px-4 py-3 font-medium text-white/60">Дії</th>
                </tr>
              </thead>
              <tbody>
                {filteredVariants.map((variant) => (
                  <tr key={variant.id} className="border-b border-white/5 align-top hover:bg-white/[0.03]">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(variant.id)}
                        onChange={() => toggleSelection(variant.id)}
                        className="h-4 w-4 rounded border-white/20 bg-zinc-950"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-white">{variant.product.titleEn || variant.product.titleUa}</div>
                      <div className="mt-1 font-mono text-xs text-white/45">{variant.product.slug}</div>
                      <div className="mt-1 text-xs text-white/45">
                        {[variant.product.brand, variant.product.vendor].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-white/80">
                        {variant.title || `Варіант №${variant.position}`} {variant.isDefault ? '· За замовч.' : ''}
                      </div>
                      <div className="mt-1 font-mono text-xs text-white/45">{variant.sku || 'Без SKU'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex max-w-[260px] flex-wrap gap-1.5">
                        {variant.product.collectionHandles.length ? (
                          variant.product.collectionHandles.map((handle) => (
                            <span key={handle} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/60">
                              {handle}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-white/35">Без колекцій</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-white/80">
                      <div>{priceLabel(variant.priceEur, '€')}</div>
                      <div className="mt-1 text-xs text-white/45">Порівн. {priceLabel(variant.compareAtEur, '€')}</div>
                    </td>
                    <td className="px-4 py-4 text-white/80">
                      <div>{priceLabel(variant.priceEurB2b, '€')}</div>
                      <div className="mt-1 text-xs text-white/45">Порівн. {priceLabel(variant.compareAtEurB2b, '€')}</div>
                    </td>
                    <td className="px-4 py-4 text-white/80">
                      <div>{priceLabel(variant.priceUsd, '$')}</div>
                      <div className="mt-1 text-xs text-white/45">Порівн. {priceLabel(variant.compareAtUsd, '$')}</div>
                    </td>
                    <td className="px-4 py-4 text-white/80">
                      <div>{priceLabel(variant.priceUsdB2b, '$')}</div>
                      <div className="mt-1 text-xs text-white/45">Порівн. {priceLabel(variant.compareAtUsdB2b, '$')}</div>
                    </td>
                    <td className="px-4 py-4 text-white/80">
                      <div>{priceLabel(variant.priceUah, '₴')}</div>
                      <div className="mt-1 text-xs text-white/45">Порівн. {priceLabel(variant.compareAtUah, '₴')}</div>
                    </td>
                    <td className="px-4 py-4 text-white/80">
                      <div>{priceLabel(variant.priceUahB2b, '₴')}</div>
                      <div className="mt-1 text-xs text-white/45">Порівн. {priceLabel(variant.compareAtUahB2b, '₴')}</div>
                    </td>
                    <td className="px-4 py-4">
                      <Link href={`/admin/shop/${variant.productId}`} className="text-sm text-white/70 hover:text-white">
                        Редагувати товар
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

type InputFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

function InputField({ label, value, onChange, placeholder }: InputFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-white/50">{label}</span>
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-white/30 focus:outline-none"
      />
    </label>
  );
}
