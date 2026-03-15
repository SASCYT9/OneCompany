'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FolderTree, Pencil, Plus, RefreshCcw, Search, Trash2 } from 'lucide-react';

type ShopCategoryListItem = {
  id: string;
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

export default function AdminShopCategoriesPage() {
  const [categories, setCategories] = useState<ShopCategoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void load();
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
      const response = await fetch('/api/admin/shop/categories');
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        setError((data as { error?: string }).error || 'Failed to load categories');
        return;
      }
      setCategories(data as ShopCategoryListItem[]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setError('');
    try {
      const response = await fetch('/api/admin/shop/categories/sync-from-products', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError((data as { error?: string }).error || 'Failed to sync categories');
        return;
      }
      await load();
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this category? It must not have linked products or child categories.')) return;
    setDeletingId(id);
    try {
      const response = await fetch(`/api/admin/shop/categories/${id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError((data as { error?: string }).error || 'Failed to delete category');
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
        Loading categories…
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Categories</h2>
            <p className="mt-2 text-sm text-white/45">
              Structured catalog categories for product grouping, filters and future storefront navigation.
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
              {syncing ? 'Syncing…' : 'Sync from products'}
            </button>
            <Link href="/admin/shop/categories/new" className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90">
              <Plus className="h-4 w-4" />
              New category
            </Link>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="grid gap-1 text-sm text-white/70 md:grid-cols-3 md:gap-8">
            <div>{categories.length} categories</div>
            <div>{categories.reduce((sum, item) => sum + item.productsCount, 0)} assigned products</div>
            <div>{categories.reduce((sum, item) => sum + item.childrenCount, 0)} child links</div>
          </div>
          <label className="flex min-w-[260px] items-center gap-2 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white">
            <Search className="h-4 w-4 text-white/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by slug, title or parent"
              className="w-full bg-transparent text-white placeholder:text-white/25 focus:outline-none"
            />
          </label>
        </div>

        {error ? <div className="mb-4 rounded-lg bg-red-900/20 p-3 text-sm text-red-300">{error}</div> : null}

        {filteredCategories.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-center text-white/50">
            No categories found yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 font-medium text-white/60">Category</th>
                  <th className="px-4 py-3 font-medium text-white/60">Parent</th>
                  <th className="px-4 py-3 font-medium text-white/60">Flags</th>
                  <th className="px-4 py-3 font-medium text-white/60">Links</th>
                  <th className="px-4 py-3 font-medium text-white/60">Updated</th>
                  <th className="px-4 py-3 font-medium text-white/60">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((category) => (
                  <tr key={category.id} className="border-b border-white/5 align-top hover:bg-white/[0.03]">
                    <td className="px-4 py-4">
                      <div className="font-medium text-white">{category.titleEn || category.titleUa}</div>
                      <div className="mt-1 font-mono text-xs text-white/45">{category.slug}</div>
                      <div className="mt-1 text-xs text-white/45">Sort {category.sortOrder}</div>
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
                        {category.isPublished ? 'Published' : 'Hidden'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-white/70">
                      <div>{category.productsCount} products</div>
                      <div className="mt-1 text-xs text-white/45">{category.childrenCount} child categories</div>
                    </td>
                    <td className="px-4 py-4 text-white/45">{new Date(category.updatedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/shop/categories/${category.id}`} className="rounded border border-white/20 p-1.5 text-white/80 hover:bg-white/10" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(category.id)}
                          disabled={deletingId === category.id}
                          className="rounded border border-red-500/30 p-1.5 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                          title="Delete"
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
