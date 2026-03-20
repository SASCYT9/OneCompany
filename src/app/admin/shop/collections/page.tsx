'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Layers3, Pencil, Plus, RefreshCcw, Search, Trash2 } from 'lucide-react';

type ShopCollectionListItem = {
  id: string;
  storeKey: string;
  store: {
    key: string;
    name: string;
  } | null;
  handle: string;
  titleUa: string;
  titleEn: string;
  brand: string | null;
  heroImage: string | null;
  isPublished: boolean;
  isUrban: boolean;
  sortOrder: number;
  productsCount: number;
  updatedAt: string;
};

type ShopStoreSummary = {
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
};

export default function AdminShopCollectionsPage() {
  const [collections, setCollections] = useState<ShopCollectionListItem[]>([]);
  const [stores, setStores] = useState<ShopStoreSummary[]>([]);
  const [storeKey, setStoreKey] = useState('urban');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [storeKey]);

  useEffect(() => {
    void loadStores();
  }, []);

  const filteredCollections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return collections;
    return collections.filter((collection) =>
      [collection.handle, collection.titleEn, collection.titleUa, collection.brand]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [collections, query]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/shop/collections?store=${encodeURIComponent(storeKey)}`);
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        setError(data.error || 'Не вдалося завантажити колекції');
        return;
      }
      setCollections(data as ShopCollectionListItem[]);
    } finally {
      setLoading(false);
    }
  }

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
      // Fall back to the default store when the stores route is unavailable.
    }
  }

  async function handleSyncUrban() {
    if (storeKey !== 'urban') {
      setError('Синхронізація Urban доступна лише для магазину Urban.');
      return;
    }
    setSyncing(true);
    setError('');
    try {
      const response = await fetch('/api/admin/shop/collections/sync-urban', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Не вдалося синхронізувати колекції Urban');
        return;
      }
      await load();
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Видалити цю колекцію? Товари збережуть legacy-мітки, але втратять явну прив’язку.')) return;
    setDeletingId(id);
    try {
      const response = await fetch(`/api/admin/shop/collections/${id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Не вдалося видалити колекцію');
        return;
      }
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-white/60 flex items-center gap-2">
        <Layers3 className="h-5 w-5 animate-pulse" />
        Завантаження колекцій…
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Колекції</h2>
            <p className="mt-2 text-sm text-white/45">
              Явне керування колекціями для Urban і майбутніх storefront-магазинів One Company.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSyncUrban}
              disabled={syncing}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              <RefreshCcw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Синхронізація…' : 'Синхронізувати Urban'}
            </button>
            <Link href={`/admin/shop/collections/new?store=${encodeURIComponent(storeKey)}`} className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90">
              <Plus className="h-4 w-4" />
              Нова колекція
            </Link>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="grid gap-1 text-sm text-white/70 md:grid-cols-3 md:gap-8">
            <div>{collections.length} колекцій</div>
            <div>{collections.filter((item) => item.isUrban).length} Urban</div>
            <div>{collections.reduce((sum, item) => sum + item.productsCount, 0)} прив’язаних товарів</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={storeKey}
              onChange={(event) => setStoreKey(event.target.value)}
              className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              {(stores.length
                ? stores
                : [{ key: 'urban', name: 'Urban Automotive', description: null, isActive: true, sortOrder: 0 }]
              ).map((store) => (
                <option key={store.key} value={store.key}>
                  {store.name}
                </option>
              ))}
            </select>
            <label className="flex min-w-[260px] items-center gap-2 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white">
              <Search className="h-4 w-4 text-white/35" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Пошук за handle, назвою або брендом"
                className="w-full bg-transparent text-white placeholder:text-white/25 focus:outline-none"
              />
            </label>
          </div>
        </div>

        {error ? <div className="mb-4 rounded-lg bg-red-900/20 p-3 text-sm text-red-300">{error}</div> : null}

        {filteredCollections.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-center text-white/50">
            Колекції ще не створені.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 font-medium text-white/60">Колекція</th>
                  <th className="px-4 py-3 font-medium text-white/60">Бренд</th>
                  <th className="px-4 py-3 font-medium text-white/60">Статус</th>
                  <th className="px-4 py-3 font-medium text-white/60">Товари</th>
                  <th className="px-4 py-3 font-medium text-white/60">Оновлено</th>
                  <th className="px-4 py-3 font-medium text-white/60">Дії</th>
                </tr>
              </thead>
              <tbody>
                {filteredCollections.map((collection) => (
                  <tr key={collection.id} className="border-b border-white/5 align-top hover:bg-white/[0.03]">
                    <td className="px-4 py-4">
                      <div className="font-medium text-white">{collection.titleEn || collection.titleUa}</div>
                      <div className="mt-1 text-xs text-white/55">{collection.store?.name ?? collection.storeKey}</div>
                      <div className="mt-1 font-mono text-xs text-white/45">{collection.handle}</div>
                      <div className="mt-1 text-xs text-white/45">Сортування {collection.sortOrder}</div>
                    </td>
                    <td className="px-4 py-4 text-white/70">{collection.brand || '—'}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/70">
                          {collection.isPublished ? 'Опубліковано' : 'Приховано'}
                        </span>
                        {collection.isUrban ? (
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/70">
                            Urban
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-white/70">{collection.productsCount}</td>
                    <td className="px-4 py-4 text-white/45">{new Date(collection.updatedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/shop/collections/${collection.id}?store=${encodeURIComponent(collection.storeKey)}`} className="rounded border border-white/20 p-1.5 text-white/80 hover:bg-white/10" title="Редагувати">
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(collection.id)}
                          disabled={deletingId === collection.id}
                          className="rounded border border-red-500/30 p-1.5 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                          title="Видалити"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
