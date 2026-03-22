'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Layers3, Pencil, Plus, RefreshCcw, Search, Trash2 } from 'lucide-react';

type ShopCollectionListItem = {
  id: string;
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

export default function AdminShopCollectionsPage() {
  const [collections, setCollections] = useState<ShopCollectionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void load();
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
      const response = await fetch('/api/admin/shop/collections');
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        setError(data.error || 'Failed to load collections');
        return;
      }
      setCollections(data as ShopCollectionListItem[]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSyncUrban() {
    setSyncing(true);
    setError('');
    try {
      const response = await fetch('/api/admin/shop/collections/sync-urban', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Failed to sync Urban collections');
        return;
      }
      await load();
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this collection? Products will keep legacy labels but lose the explicit mapping.')) return;
    setDeletingId(id);
    try {
      const response = await fetch(`/api/admin/shop/collections/${id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Failed to delete collection');
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
        Loading collections…
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="w-full px-6 md:px-12 py-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Collections</h2>
            <p className="mt-2 text-sm text-white/45">
              Explicit collection management for Urban and future One Company storefronts.
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
              {syncing ? 'Syncing…' : 'Sync Urban'}
            </button>
            <Link href="/admin/shop/collections/new" className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90">
              <Plus className="h-4 w-4" />
              New collection
            </Link>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="grid gap-1 text-sm text-white/70 md:grid-cols-3 md:gap-8">
            <div>{collections.length} collections</div>
            <div>{collections.filter((item) => item.isUrban).length} Urban</div>
            <div>{collections.reduce((sum, item) => sum + item.productsCount, 0)} mapped products</div>
          </div>
          <label className="flex min-w-[260px] items-center gap-2 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white">
            <Search className="h-4 w-4 text-white/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by handle, title or brand"
              className="w-full bg-transparent text-white placeholder:text-white/25 focus:outline-none"
            />
          </label>
        </div>

        {error ? <div className="mb-4 rounded-lg bg-red-900/20 p-3 text-sm text-red-300">{error}</div> : null}

        {filteredCollections.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-center text-white/50">
            No collections found yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 font-medium text-white/60">Collection</th>
                  <th className="px-4 py-3 font-medium text-white/60">Brand</th>
                  <th className="px-4 py-3 font-medium text-white/60">Flags</th>
                  <th className="px-4 py-3 font-medium text-white/60">Products</th>
                  <th className="px-4 py-3 font-medium text-white/60">Updated</th>
                  <th className="px-4 py-3 font-medium text-white/60">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCollections.map((collection) => (
                  <tr key={collection.id} className="border-b border-white/5 align-top hover:bg-white/[0.03]">
                    <td className="px-4 py-4">
                      <div className="font-medium text-white">{collection.titleEn || collection.titleUa}</div>
                      <div className="mt-1 font-mono text-xs text-white/45">{collection.handle}</div>
                      <div className="mt-1 text-xs text-white/45">Sort {collection.sortOrder}</div>
                    </td>
                    <td className="px-4 py-4 text-white/70">{collection.brand || '—'}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/70">
                          {collection.isPublished ? 'Published' : 'Hidden'}
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
                        <Link href={`/admin/shop/collections/${collection.id}`} className="rounded border border-white/20 p-1.5 text-white/80 hover:bg-white/10" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(collection.id)}
                          disabled={deletingId === collection.id}
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
