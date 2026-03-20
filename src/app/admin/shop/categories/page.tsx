'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FolderTree, Pencil, Plus, RefreshCcw, Search, Trash2 } from 'lucide-react';

type ShopCategoryListItem = {
  id: string;
  storeKey: string;
  store: {
    key: string;
    name: string;
  } | null;
  slug: string;
  titleUa: string;
  titleEn: string;
  isPublished: boolean;
  sortOrder: number;
  parent: {
    id: string;
    slug: string;
    titleEn: string;
    titleUa: string;
  } | null;
  productsCount: number;
  childrenCount: number;
  updatedAt: string;
};

type ShopStoreSummary = {
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
};

export default function AdminShopCategoriesPage() {
  const [categories, setCategories] = useState<ShopCategoryListItem[]>([]);
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

  const filteredCategories = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return categories;
    return categories.filter((category) =>
      [category.slug, category.titleEn, category.titleUa, category.parent?.titleEn, category.parent?.titleUa]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [categories, query]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/shop/categories?store=${encodeURIComponent(storeKey)}`);
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        setError((data as { error?: string }).error || 'Не вдалося завантажити категорії');
        return;
      }
      setCategories(data as ShopCategoryListItem[]);
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

  async function handleSync() {
    setSyncing(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/shop/categories/sync-from-products?store=${encodeURIComponent(storeKey)}`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError((data as { error?: string }).error || 'Не вдалося синхронізувати категорії');
        return;
      }
      await load();
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Видалити цю категорію? Вона не повинна мати пов’язаних товарів або дочірніх категорій.')) return;
    setDeletingId(id);
    try {
      const response = await fetch(`/api/admin/shop/categories/${id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError((data as { error?: string }).error || 'Не вдалося видалити категорію');
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
        <FolderTree className="h-5 w-5 animate-pulse" />
        Завантаження категорій…
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Категорії</h2>
            <p className="mt-2 text-sm text-white/45">
              Структуровані категорії каталогу для групування товарів, фільтрів і майбутньої навігації вітриною.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              <RefreshCcw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Синхронізація…' : 'Синхронізувати з товарами'}
            </button>
            <Link href={`/admin/shop/categories/new?store=${encodeURIComponent(storeKey)}`} className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90">
              <Plus className="h-4 w-4" />
              Нова категорія
            </Link>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="grid gap-1 text-sm text-white/70 md:grid-cols-3 md:gap-8">
            <div>{categories.length} категорій</div>
            <div>{categories.reduce((sum, item) => sum + item.productsCount, 0)} призначених товарів</div>
            <div>{categories.reduce((sum, item) => sum + item.childrenCount, 0)} дочірніх зв’язків</div>
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
                placeholder="Пошук за slug, назвою або батьківською категорією"
                className="w-full bg-transparent text-white placeholder:text-white/25 focus:outline-none"
              />
            </label>
          </div>
        </div>

        {error ? <div className="mb-4 rounded-lg bg-red-900/20 p-3 text-sm text-red-300">{error}</div> : null}

        {filteredCategories.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-center text-white/50">
            Категорії ще не створені.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 font-medium text-white/60">Категорія</th>
                  <th className="px-4 py-3 font-medium text-white/60">Батьківська</th>
                  <th className="px-4 py-3 font-medium text-white/60">Статус</th>
                  <th className="px-4 py-3 font-medium text-white/60">Зв’язки</th>
                  <th className="px-4 py-3 font-medium text-white/60">Оновлено</th>
                  <th className="px-4 py-3 font-medium text-white/60">Дії</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((category) => (
                  <tr key={category.id} className="border-b border-white/5 align-top hover:bg-white/[0.03]">
                    <td className="px-4 py-4">
                      <div className="font-medium text-white">{category.titleEn || category.titleUa}</div>
                      <div className="mt-1 text-xs text-white/55">{category.store?.name ?? category.storeKey}</div>
                      <div className="mt-1 font-mono text-xs text-white/45">{category.slug}</div>
                      <div className="mt-1 text-xs text-white/45">Сортування {category.sortOrder}</div>
                    </td>
                    <td className="px-4 py-4 text-white/70">
                      {category.parent ? (
                        <>
                          <div>{category.parent.titleEn || category.parent.titleUa}</div>
                          <div className="mt-1 font-mono text-xs text-white/45">{category.parent.slug}</div>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70">
                        {category.isPublished ? 'Опубліковано' : 'Приховано'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-white/70">
                      <div>{category.productsCount} товарів</div>
                      <div className="mt-1 text-xs text-white/45">{category.childrenCount} дочірніх категорій</div>
                    </td>
                    <td className="px-4 py-4 text-white/45">{new Date(category.updatedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/shop/categories/${category.id}?store=${encodeURIComponent(category.storeKey)}`} className="rounded border border-white/20 p-1.5 text-white/80 hover:bg-white/10" title="Редагувати">
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(category.id)}
                          disabled={deletingId === category.id}
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
