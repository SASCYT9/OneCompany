'use client';

import { useEffect, useMemo, useState } from 'react';

import Link from 'next/link';
import { FolderTree, Pencil, Plus, RefreshCcw, Search, Trash2 } from 'lucide-react';

import {
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
import { useConfirm } from '@/components/admin/AdminConfirmDialog';
import { useToast } from '@/components/admin/AdminToast';

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
  const confirm = useConfirm();
  const toast = useToast();
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
    const ok = await confirm({
      tone: 'danger',
      title: 'Delete this category?',
      description: 'It must not have linked products or child categories. This action cannot be undone.',
      confirmLabel: 'Delete category',
    });
    if (!ok) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/admin/shop/categories/${id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = (data as { error?: string }).error || 'Failed to delete category';
        setError(msg);
        toast.error('Could not delete category', msg);
        return;
      }
      toast.success('Category deleted');
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <AdminPage>
        <div className="flex items-center gap-3 rounded-none border border-white/10 bg-[#171717] px-5 py-6 text-sm text-zinc-400">
          <FolderTree className="h-4 w-4 animate-pulse" />
          Loading categories…
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Categories"
        description="Structured taxonomy for filters, collection mapping, and future storefront navigation."
        actions={
          <>
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-none border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-50"
            >
              <RefreshCcw className={`h-4 w-4 ${syncing ? 'motion-safe:animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync from products'}
            </button>
            <Link
              href="/admin/shop/categories/new"
              className="inline-flex items-center gap-2 rounded-none bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600"
            >
              <Plus className="h-4 w-4" />
              New category
            </Link>
          </>
        }
      />

      <AdminMetricGrid className="xl:grid-cols-3">
        <AdminMetricCard label="Categories" value={categories.length} meta="Published and hidden nodes" tone="accent" />
        <AdminMetricCard
          label="Assigned products"
          value={categories.reduce((sum, item) => sum + item.productsCount, 0)}
          meta="Explicit product-category links"
        />
        <AdminMetricCard
          label="Child links"
          value={categories.reduce((sum, item) => sum + item.childrenCount, 0)}
          meta="Nested taxonomy connections"
        />
      </AdminMetricGrid>

      <AdminFilterBar>
        <label className="flex min-w-[280px] flex-1 items-center gap-2 rounded-none border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-zinc-100">
          <Search className="h-4 w-4 text-zinc-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by slug, title, or parent"
            className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
        </label>
      </AdminFilterBar>

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}

      {filteredCategories.length === 0 ? (
        <AdminEmptyState
          title="No categories found"
          description="Create a new category or sync from products to seed the taxonomy tree."
          action={
            <Link
              href="/admin/shop/categories/new"
              className="inline-flex items-center gap-2 rounded-none bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600"
            >
              <Plus className="h-4 w-4" />
              Create category
            </Link>
          }
        />
      ) : (
        <AdminTableShell>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                <th className="px-4 py-3 font-medium text-zinc-400">Category</th>
                <th className="px-4 py-3 font-medium text-zinc-400">Parent</th>
                <th className="px-4 py-3 font-medium text-zinc-400">Visibility</th>
                <th className="px-4 py-3 font-medium text-zinc-400">Links</th>
                <th className="px-4 py-3 font-medium text-zinc-400">Updated</th>
                <th className="px-4 py-3 font-medium text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories.map((category) => (
                <tr key={category.id} className="border-b border-white/5 align-top transition hover:bg-white/[0.02]">
                  <td className="px-4 py-4">
                    <div className="font-medium text-zinc-50">{category.titleEn || category.titleUa}</div>
                    <div className="mt-1 font-mono text-xs text-zinc-500">{category.slug}</div>
                    <div className="mt-1 text-xs text-zinc-500">Sort {category.sortOrder}</div>
                  </td>
                  <td className="px-4 py-4 text-zinc-300">
                    {category.parent ? (
                      <>
                        <div>{category.parent.titleEn || category.parent.titleUa}</div>
                        <div className="mt-1 font-mono text-xs text-zinc-500">{category.parent.slug}</div>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <AdminStatusBadge tone={category.isPublished ? 'success' : 'warning'}>
                      {category.isPublished ? 'Published' : 'Hidden'}
                    </AdminStatusBadge>
                  </td>
                  <td className="px-4 py-4 text-zinc-300">
                    <div>{category.productsCount} products</div>
                    <div className="mt-1 text-xs text-zinc-500">{category.childrenCount} child categories</div>
                  </td>
                  <td className="px-4 py-4 text-zinc-500">{new Date(category.updatedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/shop/categories/${category.id}`}
                        className="rounded-none border border-white/10 p-2 text-zinc-300 transition hover:bg-white/[0.06] hover:text-zinc-50"
                        title="Edit category"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(category.id)}
                        disabled={deletingId === category.id}
                        className="rounded-none border border-blue-500/20 p-2 text-blue-300 transition hover:bg-blue-950/30 disabled:opacity-50"
                        title="Delete category"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableShell>
      )}
    </AdminPage>
  );
}
