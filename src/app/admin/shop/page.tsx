'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Pencil, Trash2, Upload, Package, ShoppingCart, Search, Layers3, Warehouse, Coins, Settings2, FileClock, ImageIcon, FolderTree, Users, Boxes, Globe } from 'lucide-react';

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

import { useRouter } from 'next/navigation';

function AdminShopPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const limitParam = parseInt(searchParams.get('limit') || '50', 10);
  const searchParam = searchParams.get('search') || '';
  const brandParam = searchParams.get('brand') || 'ALL';
  const statusParam = searchParams.get('status') || 'ALL';

  const [products, setProducts] = useState<ShopProductListItem[]>([]);
  const [metadata, setMetadata] = useState({ totalCount: 0, totalPages: 1, currentPage: 1, limit: 50 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Local state for debounced inputs
  const [searchInput, setSearchInput] = useState(searchParam);

  function updateParams(newParams: Record<string, string | number | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(newParams)) {
      if (value === null || value === '' || value === 'ALL') {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    }
    // Reset to page 1 on filter change
    if (!newParams.page && (newParams.search !== undefined || newParams.brand !== undefined || newParams.status !== undefined)) {
      params.set('page', '1');
    }
    router.push(`/admin/shop?${params.toString()}`);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const q = new URLSearchParams(searchParams.toString());
      const response = await fetch(`/api/admin/shop/products?${q.toString()}`);
      if (response.status === 401) {
        setError('Unauthorized');
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Failed to load');
        return;
      }
      setProducts(data.products || []);
      if (data.metadata) {
        setMetadata(data.metadata);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (
      !confirm(
        'Остаточно видалити цей товар з бази даних?\n\nЦю дію не можна скасувати, відновлення можливе тільки з бекапу.'
      )
    ) {
      return;
    }
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

  // Common brands to display in dropdown since we don't load all products anymore
  const commonBrands = [ 'Akrapovic', 'Burger Motorsports', 'CSF', 'DO88', 'Eventuri', 'MHT', 'Mishimoto', 'RaceChip', 'Urban Automotive' ];

  if (loading && products.length === 0) {
    return (
      <div className="p-6 text-white/60 flex items-center gap-2">
        <Package className="w-5 h-5 animate-pulse" />
        Завантаження каталогу…
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="w-full px-4 md:px-8 py-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Каталог магазину</h2>
            <p className="mt-2 text-sm text-white/45">
              Усі товари, варіанти та колекції. Тут додаємо / редагуємо товари, а детальне ціноутворення — у розділі
              <span className="font-medium text-white"> Ціни (B2C/B2B)</span>.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button 
                onClick={() => updateParams({ brand: 'Urban Automotive', search: '' })}
                className={`flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-medium tracking-wide transition-all font-mono ${brandParam === 'Urban Automotive' ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'}`}
              >
                <Package className="w-4 h-4" />
                Urban
              </button>
              <button 
                onClick={() => updateParams({ brand: 'DO88', search: '' })}
                className={`flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-medium tracking-wide transition-all font-mono ${brandParam === 'DO88' ? 'border-amber-500 bg-amber-500/20 text-amber-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'}`}
              >
                <Package className="w-4 h-4" />
                DO88
              </button>
              <button 
                onClick={() => updateParams({ brand: 'Eventuri', search: '' })}
                className={`flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-medium tracking-wide transition-all font-mono ${brandParam === 'Eventuri' ? 'border-purple-500 bg-purple-500/20 text-purple-400' : 'border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'}`}
              >
                <Package className="w-4 h-4" />
                Eventuri
              </button>
              <Link 
                href="/admin/shop/turn14"
                className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-5 py-2.5 text-sm font-medium tracking-wide text-indigo-400 hover:bg-indigo-500/20 transition-all font-mono ml-auto"
              >
                <Globe className="w-4 h-4" />
                Turn14 Database
              </Link>
            </div>
            
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2 text-xs text-white/55">
              <span className="font-medium text-white/75">Що робить кожен модуль:</span> Замовлення — перегляд і обробка замовлень; Клієнти — база B2B/B2C; Склад — залишки по варіантах; Ціни — масове ціноутворення; Налаштування — валюти, доставка, податки; Аудит — журнал дій; Категорії — дерево категорій; Колекції — підбірки товарів; Комплекти — збирання комплектів; Медіа — бібліотека зображень; Імпорт CSV — імпорт з мапінгом колонок.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/admin/shop/orders" title="Перегляд і обробка замовлень клієнтів" className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">
              <ShoppingCart className="w-4 h-4" />
              Замовлення
            </Link>
            <Link href="/admin/shop/customers" title="База клієнтів B2B та B2C" className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">
              <Users className="w-4 h-4" />
              Клієнти
            </Link>
            <Link href="/admin/shop/inventory" title="Залишки та відстеження по варіантах" className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">
              <Warehouse className="w-4 h-4" />
              Склад
            </Link>
            <Link href="/admin/shop/pricing" title="Масове ціноутворення B2C та B2B" className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">
              <Coins className="w-4 h-4" />
              Ціни (B2C/B2B)
            </Link>
            <Link href="/admin/shop/settings" title="Валюти, зони доставки, податки, B2B" className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">
              <Settings2 className="w-4 h-4" />
              Налаштування
            </Link>
            <Link href="/admin/shop/audit" title="Журнал дій у магазині" className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">
              <FileClock className="w-4 h-4" />
              Аудит
            </Link>
            <Link href="/admin/shop/categories" title="Дерево категорій товарів" className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">
              <FolderTree className="w-4 h-4" />
              Категорії
            </Link>
            <Link href="/admin/shop/collections" title="Підбірки та колекції товарів" className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">
              <Layers3 className="w-4 h-4" />
              Колекції
            </Link>
            <Link href="/admin/shop/bundles" title="Комплекти з кількох товарів" className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">
              <Boxes className="w-4 h-4" />
              Комплекти
            </Link>
            <Link href="/admin/shop/media" title="Бібліотека зображень" className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">
              <ImageIcon className="w-4 h-4" />
              Медіа
            </Link>
            <Link href="/admin/shop/import" title="Імпорт товарів з CSV і мапінг колонок" className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">
              <Upload className="w-4 h-4" />
              Імпорт CSV
            </Link>
            <Link href="/admin/shop/new" title="Створити новий товар" className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90">
              <Plus className="w-4 h-4" />
              Новий товар
            </Link>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="grid gap-1 text-sm text-white/70 md:grid-cols-3 md:gap-8">
            <div>Всього знайдено: {metadata.totalCount}</div>
            <div>Сторінка {metadata.currentPage} із {metadata.totalPages}</div>
            <div>Показано: {products.length} на сторінці</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={statusParam}
              onChange={(e) => updateParams({ status: e.target.value })}
              className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              <option value="ALL">Усі статуси</option>
              <option value="ACTIVE">Активні</option>
              <option value="DRAFT">Чернетки</option>
              <option value="ARCHIVED">Архів</option>
            </select>
            <select
              value={brandParam}
              onChange={(e) => updateParams({ brand: e.target.value })}
              className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              <option value="ALL">Всі Бренди</option>
              {commonBrands.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <label className="flex min-w-[260px] items-center gap-2 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white">
            <Search className="h-4 w-4 text-white/35" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  updateParams({ search: searchInput });
                }
              }}
              placeholder="Введіть пошук та натисніть Enter..."
              className="w-full bg-transparent text-white placeholder:text-white/25 focus:outline-none"
            />
            </label>
          </div>
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-900/20 p-3 text-sm text-red-300">{error}</div>}

        <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/55 space-y-1">
          <p className="font-medium text-white/80">Як працювати з каталогом:</p>
          <p>• <span className="font-semibold text-white">Редагувати товар</span> — клік по назві або іконка олівця у стовпчику дій.</p>
          <p>• <span className="font-semibold text-white">Ціни B2C / B2B</span> — окремий розділ «Ціни (B2C/B2B)», де можна масово змінювати ціни за варіантами.</p>
          <p>• <span className="font-semibold text-white">Видалення</span> — іконка кошика. Перед повним видаленням бажано мати актуальний бекап БД.</p>
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-center text-white/50">
            Товарів не знайдено. Імпортуйте CSV або додайте товар вручну.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 text-white/60 font-medium">Товар</th>
                  <th className="px-4 py-3 text-white/60 font-medium">Тип</th>
                  <th className="px-4 py-3 text-white/60 font-medium">Статус</th>
                  <th className="px-4 py-3 text-white/60 font-medium">Кількості</th>
                  <th className="px-4 py-3 text-white/60 font-medium">Ціна</th>
                  <th className="px-4 py-3 text-white/60 font-medium">Оновлено</th>
                  <th className="px-4 py-3 text-white/60 font-medium w-28">Дії</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
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
                      <div className="mt-1 text-xs text-white/45">{product.isPublished ? 'Опубліковано' : 'Приховано'}</div>
                    </td>
                    <td className="px-4 py-4 text-white/70">
                      <div>{product.variantsCount} варіантів</div>
                      <div className="mt-1 text-xs text-white/45">
                        {product.mediaCount} медіа · {product.collectionsCount} колекцій · {product.stock}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-white/70">{priceLabel(product)}</td>
                    <td className="px-4 py-4 text-white/45">
                      {new Date(product.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/shop/${product.id}`} className="rounded border border-white/20 p-1.5 text-white/80 hover:bg-white/10" title="Редагувати">
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(product.id)}
                          disabled={deletingId === product.id}
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

        {/* Pagination Controls */}
        {metadata.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-sm text-white/60">
            <div>
              Показано {(metadata.currentPage - 1) * metadata.limit + 1} - {Math.min(metadata.currentPage * metadata.limit, metadata.totalCount)} з {metadata.totalCount}
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={metadata.currentPage <= 1}
                onClick={() => updateParams({ page: metadata.currentPage - 1 })}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-white hover:bg-white/10 disabled:opacity-50"
              >
                Попередня
              </button>
              <div className="px-4 text-white">{metadata.currentPage}</div>
              <button
                disabled={metadata.currentPage >= metadata.totalPages}
                onClick={() => updateParams({ page: metadata.currentPage + 1 })}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-white hover:bg-white/10 disabled:opacity-50"
              >
                Наступна
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminShopPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white/50">Завантаження каталогу...</div>}>
      <AdminShopPageContent />
    </Suspense>
  );
}
