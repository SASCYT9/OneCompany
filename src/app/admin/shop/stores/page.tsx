'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Building2, Plus, Save } from 'lucide-react';

type ShopStoreSummary = {
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  productCount?: number;
  collectionCount?: number;
  categoryCount?: number;
  orderCount?: number;
};

type StoreFormState = {
  key: string;
  name: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
};

const EMPTY_FORM: StoreFormState = {
  key: '',
  name: '',
  description: '',
  isActive: true,
  sortOrder: 10,
};

export default function AdminShopStoresPage() {
  const [stores, setStores] = useState<ShopStoreSummary[]>([]);
  const [form, setForm] = useState<StoreFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    void loadStores();
  }, []);

  async function loadStores() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/shop/stores');
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        setError((data as { error?: string }).error || 'Не вдалося завантажити магазини');
        return;
      }
      setStores(data as ShopStoreSummary[]);
    } catch {
      setError('Не вдалося завантажити магазини');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/shop/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError((data as { error?: string }).error || 'Не вдалося створити магазин');
        return;
      }
      setMessage(`Магазин ${form.key} створено`);
      setForm(EMPTY_FORM);
      await loadStores();
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(store: ShopStoreSummary) {
    setSavingKey(store.key);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/admin/shop/stores/${encodeURIComponent(store.key)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: store.name,
          description: store.description,
          isActive: store.isActive,
          sortOrder: store.sortOrder,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError((data as { error?: string }).error || 'Не вдалося оновити магазин');
        return;
      }
      setMessage(`Магазин ${store.key} оновлено`);
      setStores((current) =>
        current
          .map((entry) => (entry.key === store.key ? ({ ...entry, ...(data as ShopStoreSummary) }) : entry))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      );
    } finally {
      setSavingKey(null);
    }
  }

  function updateStore<K extends keyof ShopStoreSummary>(key: string, field: K, value: ShopStoreSummary[K]) {
    setStores((current) =>
      current.map((store) => (store.key === key ? { ...store, [field]: value } : store))
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="w-full px-4 py-6 md:px-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Магазини</h2>
            <p className="mt-2 max-w-3xl text-sm text-white/45">
              Керуйте store-контейнерами для multi-store shop. Кожен магазин має свій `storeKey`, окремі товари,
              колекції, категорії, кошики й замовлення.
            </p>
          </div>
          <Link href="/admin/shop" className="rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">
            До каталогу
          </Link>
        </div>

        {error ? <div className="mb-4 rounded-lg bg-red-900/20 p-3 text-sm text-red-300">{error}</div> : null}
        {message ? <div className="mb-4 rounded-lg bg-emerald-900/20 p-3 text-sm text-emerald-300">{message}</div> : null}

        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <form
            onSubmit={handleCreate}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/70">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-white">Новий магазин</h3>
                <p className="text-sm text-white/45">Створює новий store для окремого каталогу й checkout flow.</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/45">Ключ магазину</span>
                <input
                  value={form.key}
                  onChange={(event) => setForm((current) => ({ ...current, key: event.target.value.toLowerCase() }))}
                  placeholder="kw"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-white/25 focus:border-white/35 focus:outline-none"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/45">Назва</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="KW Suspensions"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-white/25 focus:border-white/35 focus:outline-none"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/45">Опис</span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  rows={4}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-white/25 focus:border-white/35 focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/45">Порядок сортування</span>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) => setForm((current) => ({ ...current, sortOrder: Number(event.target.value || 0) }))}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white focus:border-white/35 focus:outline-none"
                />
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                  className="h-4 w-4 rounded border-white/30 bg-black"
                />
                Активний магазин
              </label>

              <button
                type="submit"
                disabled={creating}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {creating ? 'Створення…' : 'Створити магазин'}
              </button>
            </div>
          </form>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/70">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-white">Поточні магазини</h3>
                <p className="text-sm text-white/45">Редагуйте назву, опис, статус і порядок відображення.</p>
              </div>
            </div>

            {loading ? (
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-white/50">
                Завантаження магазинів…
              </div>
            ) : stores.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-white/50">
                Магазини ще не створені.
              </div>
            ) : (
              <div className="space-y-4">
                {stores.map((store) => (
                  <div key={store.key} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_140px_140px]">
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-white/35">Ключ магазину</div>
                          <div className="mt-1 font-mono text-sm text-white/80">{store.key}</div>
                        </div>
                        <label className="block">
                          <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/35">Назва</span>
                          <input
                            value={store.name}
                            onChange={(event) => updateStore(store.key, 'name', event.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-white focus:border-white/35 focus:outline-none"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/35">Опис</span>
                          <textarea
                            value={store.description ?? ''}
                            onChange={(event) => updateStore(store.key, 'description', event.target.value)}
                            rows={3}
                            className="w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-white focus:border-white/35 focus:outline-none"
                          />
                        </label>
                      </div>

                      <div className="space-y-3">
                        <label className="block">
                          <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/35">Порядок сортування</span>
                          <input
                            type="number"
                            value={store.sortOrder}
                            onChange={(event) => updateStore(store.key, 'sortOrder', Number(event.target.value || 0))}
                            className="w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-white focus:border-white/35 focus:outline-none"
                          />
                        </label>

                        <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white/80">
                          <input
                            type="checkbox"
                            checked={store.isActive}
                            onChange={(event) => updateStore(store.key, 'isActive', event.target.checked)}
                            className="h-4 w-4 rounded border-white/30 bg-black"
                          />
                          Активний
                        </label>

                        <div className="rounded-xl border border-white/10 bg-zinc-950 p-4 text-xs text-white/55">
                          <div>{store.productCount ?? 0} товарів</div>
                          <div className="mt-1">{store.collectionCount ?? 0} колекцій</div>
                          <div className="mt-1">{store.categoryCount ?? 0} категорій</div>
                          <div className="mt-1">{store.orderCount ?? 0} замовлень</div>
                        </div>
                      </div>

                      <div className="flex flex-col justify-between gap-3">
                        <div className="rounded-xl border border-white/10 bg-zinc-950 p-4 text-xs text-white/55">
                          <div className="font-medium text-white/80">Після створення</div>
                          <div className="mt-2">1. Імпортуй товари у цей store.</div>
                          <div className="mt-1">2. Створи колекції й категорії.</div>
                          <div className="mt-1">3. Прив’яжи storefront flow.</div>
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleUpdate(store)}
                          disabled={savingKey === store.key}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-50"
                        >
                          <Save className="h-4 w-4" />
                          {savingKey === store.key ? 'Збереження…' : 'Зберегти'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
