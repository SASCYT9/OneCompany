'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Layers3,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';

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

type ShopProductListItem = {
  id: string;
  slug: string;
  sku: string | null;
  scope: string;
  brand: string | null;
  vendor: string | null;
  productType: string | null;
  collectionIds: string[];
  collectionHandles: string[];
  titleUa: string;
  titleEn: string;
  stock: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  priceUah: number | null;
  priceEur: number | null;
  priceUsd: number | null;
  isPublished: boolean;
  updatedAt: string;
  variantsCount: number;
  mediaCount: number;
  collectionsCount: number;
};

function priceLabel(product: ShopProductListItem) {
  if (product.priceEur != null) return `€${product.priceEur}`;
  if (product.priceUsd != null) return `$${product.priceUsd}`;
  if (product.priceUah != null) return `₴${product.priceUah}`;
  return '—';
}

function getStatusTone(status: ShopProductListItem['status']) {
  if (status === 'ACTIVE') return 'success';
  if (status === 'ARCHIVED') return 'danger';
  return 'warning';
}

function AdminShopPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const searchParam = searchParams.get('search') || '';
  const brandParam = searchParams.get('brand') || 'ALL';
  const statusParam = searchParams.get('status') || 'ALL';

  const [products, setProducts] = useState<ShopProductListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [metadata, setMetadata] = useState({ totalCount: 0, totalPages: 1, currentPage: 1, limit: 50 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [storefrontBackfilling, setStorefrontBackfilling] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParam);

  const commonBrands = [
    'ADRO',
    'Akrapovic',
    'Brabus',
    'Burger Motorsports',
    'CSF',
    'DO88',
    'GiroDisc',
    'MHT',
    'Mishimoto',
    'OHLINS',
    'RaceChip',
    'Urban Automotive',
  ];

  function updateParams(newParams: Record<string, string | number | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(newParams)) {
      if (value === null || value === '' || value === 'ALL') {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    }

    if (
      !newParams.page &&
      (newParams.search !== undefined || newParams.brand !== undefined || newParams.status !== undefined)
    ) {
      params.set('page', '1');
    }

    router.push(`/admin/shop?${params.toString()}`);
  }

  function toggleSelectAll() {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
      return;
    }

    setSelectedIds(new Set(products.map((product) => product.id)));
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  }

  async function load() {
    setLoading(true);
    setError('');

    try {
      const query = new URLSearchParams(searchParams.toString());
      const response = await fetch(`/api/admin/shop/products?${query.toString()}`);
      if (response.status === 401) {
        setError('Unauthorized');
        return;
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError((data as { error?: string }).error || 'Failed to load products');
        return;
      }

      setProducts((data as { products?: ShopProductListItem[] }).products || []);
      if ((data as { metadata?: typeof metadata }).metadata) {
        setMetadata((data as { metadata: typeof metadata }).metadata);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSelectedIds(new Set());
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleDelete(id: string) {
    if (
      !confirm(
        'Archive this product?\n\nThe product will be unpublished and moved to ARCHIVED without being hard deleted.'
      )
    ) {
      return;
    }

    setDeletingId(id);
    setSuccess('');
    setError('');

    try {
      const response = await fetch(`/api/admin/shop/products/${id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError((data as { error?: string }).error || 'Archive failed');
        return;
      }

      setSuccess('Product archived.');
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  async function handleBulkStatus(status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED') {
    if (selectedIds.size === 0) {
      return;
    }

    setBulkUpdating(true);
    try {
      const response = await fetch('/api/admin/shop/products/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), status }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError((data as { error?: string }).error || 'Bulk status update failed');
        return;
      }

      setSelectedIds(new Set());
      await load();
    } finally {
      setBulkUpdating(false);
    }
  }

  async function handleStorefrontBackfill() {
    if (
      !confirm(
        'Normalize storefront tags for the whole catalog?\n\nEach product will keep exactly one store:* tag based on Urban / Brabus / Main signals.'
      )
    ) {
      return;
    }

    setStorefrontBackfilling(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/admin/shop/products/backfill-storefront', { method: 'POST' });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError((data as { error?: string }).error || 'Failed to normalize storefront tags');
        return;
      }

      const payload = data as {
        updatedCount?: number;
        totalCount?: number;
        storefrontCounts?: { urban?: number; brabus?: number; main?: number };
      };

      setSuccess(
        `Storefront tags normalized: ${payload.updatedCount ?? 0} of ${payload.totalCount ?? 0} updated. Urban: ${
          payload.storefrontCounts?.urban ?? 0
        }, Brabus: ${payload.storefrontCounts?.brabus ?? 0}, Main: ${payload.storefrontCounts?.main ?? 0}.`
      );
      await load();
    } catch (backfillError) {
      setError((backfillError as Error).message || 'Failed to normalize storefront tags');
    } finally {
      setStorefrontBackfilling(false);
    }
  }

  const selectedCount = selectedIds.size;
  const selectionLabel =
    selectedCount === 0 ? 'Nothing selected' : `${selectedCount} selected for a bulk status change.`;

  if (loading && products.length === 0) {
    return (
      <AdminPage>
        <div className="flex items-center gap-3 rounded-[6px] border border-white/10 bg-[#171717] px-5 py-6 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
          Loading catalog…
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Products"
        description="Primary catalog surface for product ownership, publication state, collections, media coverage, and fast edit access."
        actions={
          <>
            <Link
              href="/admin/shop/import"
              className="inline-flex items-center gap-2 rounded-[6px] border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/[0.06]"
            >
              <Upload className="h-4 w-4" />
              Import center
            </Link>
            <button
              type="button"
              onClick={handleStorefrontBackfill}
              disabled={storefrontBackfilling}
              className="inline-flex items-center gap-2 rounded-[6px] border border-blue-500/25 bg-blue-500/[0.08] px-4 py-2.5 text-sm text-blue-300 transition hover:bg-blue-500/[0.12] disabled:opacity-60"
            >
              {storefrontBackfilling ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> : <Layers3 className="h-4 w-4" />}
              Normalize storefronts
            </button>
            <Link
              href="/admin/shop/new"
              className="inline-flex items-center gap-2 rounded-[6px] bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600"
            >
              <Plus className="h-4 w-4" />
              New product
            </Link>
          </>
        }
      />

      <AdminMetricGrid>
        <AdminMetricCard label="Products found" value={metadata.totalCount} meta="Current filtered result set" tone="accent" />
        <AdminMetricCard label="Current page" value={`${metadata.currentPage}/${metadata.totalPages}`} meta={`Page size ${metadata.limit}`} />
        <AdminMetricCard label="Visible now" value={products.length} meta="Rows rendered in this view" />
        <AdminMetricCard label="Bulk selection" value={selectedCount} meta={selectionLabel} />
      </AdminMetricGrid>

      <AdminFilterBar>
        <select
          value={statusParam}
          onChange={(event) => updateParams({ status: event.target.value })}
          className="rounded-[6px] border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-blue-500/30 focus:outline-none"
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>

        <select
          value={brandParam}
          onChange={(event) => updateParams({ brand: event.target.value })}
          className="rounded-[6px] border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-blue-500/30 focus:outline-none"
        >
          <option value="ALL">All brands</option>
          {commonBrands.map((brand) => (
            <option key={brand} value={brand}>
              {brand}
            </option>
          ))}
        </select>

        <label className="flex min-w-[280px] flex-1 items-center gap-2 rounded-[6px] border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-zinc-100">
          <Search className="h-4 w-4 text-zinc-500" />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                updateParams({ search: searchInput });
              }
            }}
            placeholder="Search by slug, SKU, brand, or title and press Enter"
            className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
        </label>
      </AdminFilterBar>

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}
      {success ? <AdminInlineAlert tone="success">{success}</AdminInlineAlert> : null}

      {selectedCount > 0 ? (
        <AdminActionBar>
          <div className="space-y-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Bulk action bar</div>
            <div className="text-sm text-zinc-200">{selectionLabel}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={bulkUpdating}
              onClick={() => handleBulkStatus('ACTIVE')}
              className="rounded-[6px] border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200 transition hover:bg-emerald-500/15 disabled:opacity-50"
            >
              {bulkUpdating ? 'Updating…' : 'Set Active'}
            </button>
            <button
              type="button"
              disabled={bulkUpdating}
              onClick={() => handleBulkStatus('DRAFT')}
              className="rounded-[6px] border border-blue-500/25 bg-blue-500/[0.08] px-4 py-2.5 text-sm text-blue-300 transition hover:bg-blue-500/[0.12] disabled:opacity-50"
            >
              {bulkUpdating ? 'Updating…' : 'Set Draft'}
            </button>
            <button
              type="button"
              disabled={bulkUpdating}
              onClick={() => handleBulkStatus('ARCHIVED')}
              className="rounded-[6px] border border-blue-500/20 bg-red-950/25 px-4 py-2.5 text-sm text-red-200 transition hover:bg-red-950/35 disabled:opacity-50"
            >
              {bulkUpdating ? 'Updating…' : 'Archive'}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="rounded-[6px] border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/[0.06]"
            >
              Clear selection
            </button>
          </div>
        </AdminActionBar>
      ) : null}

      {products.length === 0 ? (
        <AdminEmptyState
          title="No products match this view"
          description="Adjust filters, import a CSV batch, or add a product manually to seed the catalog."
          action={
            <Link
              href="/admin/shop/new"
              className="inline-flex items-center gap-2 rounded-[6px] bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600"
            >
              <Plus className="h-4 w-4" />
              Create product
            </Link>
          }
        />
      ) : (
        <AdminTableShell>
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === products.length && products.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-white/20 bg-black/40 text-emerald-500"
                  />
                </th>
                <th className="px-4 py-3 font-medium text-zinc-400">Product</th>
                <th className="px-4 py-3 font-medium text-zinc-400">Type</th>
                <th className="px-4 py-3 font-medium text-zinc-400">Status</th>
                <th className="px-4 py-3 font-medium text-zinc-400">Coverage</th>
                <th className="px-4 py-3 font-medium text-zinc-400">Price</th>
                <th className="px-4 py-3 font-medium text-zinc-400">Updated</th>
                <th className="w-28 px-4 py-3 font-medium text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr
                  key={product.id}
                  className={`border-b border-white/5 align-top transition hover:bg-white/[0.02] ${
                    selectedIds.has(product.id) ? 'bg-blue-500/[0.06]' : ''
                  }`}
                >
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(product.id)}
                      onChange={() => toggleSelect(product.id)}
                      className="rounded border-white/20 bg-black/40 text-emerald-500"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-zinc-50">{product.titleEn || product.titleUa}</div>
                    <div className="mt-1 font-mono text-xs text-zinc-500">{product.slug}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {[product.brand, product.vendor, product.sku].filter(Boolean).join(' · ') || '—'}
                    </div>
                    {product.collectionHandles.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {product.collectionHandles.slice(0, 3).map((handle) => (
                          <span
                            key={handle}
                            className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-300"
                          >
                            {handle}
                          </span>
                        ))}
                        {product.collectionHandles.length > 3 ? (
                          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-500">
                            +{product.collectionHandles.length - 3}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 text-zinc-300">{product.productType || product.scope}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <AdminStatusBadge tone={getStatusTone(product.status)}>{product.status}</AdminStatusBadge>
                      <AdminStatusBadge tone={product.isPublished ? 'success' : 'warning'}>
                        {product.isPublished ? 'Published' : 'Hidden'}
                      </AdminStatusBadge>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-zinc-300">
                    <div>{product.variantsCount} variants</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {product.mediaCount} media · {product.collectionsCount} collections · {product.stock}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-zinc-200">{priceLabel(product)}</td>
                  <td className="px-4 py-4 text-zinc-500">
                    {new Date(product.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/shop/${product.id}`}
                        className="rounded-[6px] border border-white/10 p-2 text-zinc-300 transition hover:bg-white/[0.06] hover:text-zinc-50"
                        title="Edit product"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(product.id)}
                        disabled={deletingId === product.id}
                        className="rounded-[6px] border border-blue-500/20 p-2 text-blue-300 transition hover:bg-blue-950/30 disabled:opacity-50"
                        title="Archive product"
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

      {metadata.totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4 text-sm text-zinc-400">
          <div>
            Showing {(metadata.currentPage - 1) * metadata.limit + 1}-
            {Math.min(metadata.currentPage * metadata.limit, metadata.totalCount)} of {metadata.totalCount}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={metadata.currentPage <= 1}
              onClick={() => updateParams({ page: metadata.currentPage - 1 })}
              className="rounded-[6px] border border-white/10 bg-white/[0.03] px-4 py-2 text-zinc-100 transition hover:bg-white/[0.06] disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-2 text-zinc-100">{metadata.currentPage}</span>
            <button
              type="button"
              disabled={metadata.currentPage >= metadata.totalPages}
              onClick={() => updateParams({ page: metadata.currentPage + 1 })}
              className="rounded-[6px] border border-white/10 bg-white/[0.03] px-4 py-2 text-zinc-100 transition hover:bg-white/[0.06] disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </AdminPage>
  );
}

export default function AdminShopPage() {
  return (
    <Suspense fallback={<AdminPage><div className="text-sm text-zinc-400">Loading catalog…</div></AdminPage>}>
      <AdminShopPageContent />
    </Suspense>
  );
}
