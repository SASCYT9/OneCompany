'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Upload, Package, ShoppingCart, Search, Layers3, Warehouse, Coins, Settings2, FileClock, ImageIcon, FolderTree, Users, Boxes } from 'lucide-react';

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

export default function AdminShopPage() {
  const [products, setProducts] = useState<ShopProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  const filteredProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((product) =>
      [product.slug, product.titleEn, product.titleUa, product.brand, product.vendor, product.sku]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [products, query]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/shop/products');
      if (response.status === 401) {
        setError('Unauthorized');
        return;
      }
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        setError(data.error || 'Failed to load');
        return;
      }
      setProducts(data as ShopProductListItem[]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this product?')) return;
    setDeletingId(id);
    try {
      const response = await fetch(`/api/admin/shop/products/${id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Delete failed');
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
        <Package className="w-5 h-5 animate-pulse" />
        Loading catalog…
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Shop catalog</h2>
            <p className="mt-2 text-sm text-white/45">
              Products, variants, media and Shopify CSV imports live here.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/admin/shop/orders" className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">
              <ShoppingCart className="w-4 h-4" />
              Orders
            </Link>
            <Link href="/admin/shop/customers" className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">
              <Users className="w-4 h-4" />
              Customers
            </Link>
            <Link href="/admin/shop/inventory" className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">
              <Warehouse className="w-4 h-4" />
              Inventory
            </Link>
            <Link href="/admin/shop/pricing" className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">
              <Coins className="w-4 h-4" />
              Pricing
            </Link>
            <Link href="/admin/shop/settings" className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">
              <Settings2 className="w-4 h-4" />
              Settings
            </Link>
            <Link href="/admin/shop/audit" className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">
              <FileClock className="w-4 h-4" />
              Audit
            </Link>
            <Link href="/admin/shop/categories" className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">
              <FolderTree className="w-4 h-4" />
              Categories
            </Link>
            <Link href="/admin/shop/collections" className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">
              <Layers3 className="w-4 h-4" />
              Collections
            </Link>
            <Link href="/admin/shop/bundles" className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">
              <Boxes className="w-4 h-4" />
              Bundles
            </Link>
            <Link href="/admin/shop/media" className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">
              <ImageIcon className="w-4 h-4" />
              Media
            </Link>
            <Link href="/admin/shop/import" className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">
              <Upload className="w-4 h-4" />
              Shopify CSV
            </Link>
            <Link href="/admin/shop/new" className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90">
              <Plus className="w-4 h-4" />
              New product
            </Link>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="grid gap-1 text-sm text-white/70 md:grid-cols-3 md:gap-8">
            <div>{products.length} products</div>
            <div>{products.reduce((sum, item) => sum + item.variantsCount, 0)} variants</div>
            <div>{products.filter((item) => item.isPublished).length} published</div>
          </div>
          <label className="flex min-w-[260px] items-center gap-2 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white">
            <Search className="h-4 w-4 text-white/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by slug, title, brand, SKU"
              className="w-full bg-transparent text-white placeholder:text-white/25 focus:outline-none"
            />
          </label>
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-900/20 p-3 text-sm text-red-300">{error}</div>}

        {filteredProducts.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-center text-white/50">
            No products found. Import a Shopify CSV or add one manually.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 text-white/60 font-medium">Product</th>
                  <th className="px-4 py-3 text-white/60 font-medium">Type</th>
                  <th className="px-4 py-3 text-white/60 font-medium">Status</th>
                  <th className="px-4 py-3 text-white/60 font-medium">Counts</th>
                  <th className="px-4 py-3 text-white/60 font-medium">Price</th>
                  <th className="px-4 py-3 text-white/60 font-medium">Updated</th>
                  <th className="px-4 py-3 text-white/60 font-medium w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b border-white/5 align-top hover:bg-white/[0.03]">
                    <td className="px-4 py-4">
                      <div className="font-medium text-white">{product.titleEn || product.titleUa}</div>
                      <div className="mt-1 text-xs font-mono text-white/45">{product.slug}</div>
                      <div className="mt-1 text-xs text-white/45">
                        {[product.brand, product.vendor, product.sku].filter(Boolean).join(' · ') || '—'}
                      </div>
                      {product.collectionHandles.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {product.collectionHandles.slice(0, 3).map((handle) => (
                            <span
                              key={handle}
                              className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/60"
                            >
                              {handle}
                            </span>
                          ))}
                          {product.collectionHandles.length > 3 ? (
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/45">
                              +{product.collectionHandles.length - 3}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-white/70">
                      {product.productType || product.scope}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-white/80">{product.status}</div>
                      <div className="mt-1 text-xs text-white/45">{product.isPublished ? 'Published' : 'Hidden'}</div>
                    </td>
                    <td className="px-4 py-4 text-white/70">
                      <div>{product.variantsCount} variants</div>
                      <div className="mt-1 text-xs text-white/45">
                        {product.mediaCount} media · {product.collectionsCount} collections · {product.stock}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-white/70">{priceLabel(product)}</td>
                    <td className="px-4 py-4 text-white/45">
                      {new Date(product.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/shop/${product.id}`} className="rounded border border-white/20 p-1.5 text-white/80 hover:bg-white/10" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(product.id)}
                          disabled={deletingId === product.id}
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
