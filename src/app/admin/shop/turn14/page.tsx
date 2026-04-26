'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, Globe, PackagePlus, RefreshCw, Search } from 'lucide-react';

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

type Turn14Item = {
  id: string;
  source?: string;
  attributes: {
    item_name?: string;
    product_name?: string;
    name?: string;
    part_number?: string;
    mfr_part_number?: string;
    internal_part_number?: string;
    brand?: string;
    brand_short_description?: string;
    thumbnail?: string;
    image_url?: string;
    primary_image?: string;
    dealer_price?: number;
    jobber_price?: number;
    weight?: number;
  };
  product_name?: string;
  part_number?: string;
  internal_part_number?: string;
  brand?: string;
  dealer_price?: number;
  jobber_price?: number;
  weight?: number;
  primary_image?: string;
};

type StockInfo = {
  productId: string;
  slug: string;
  title: string;
  sku: string;
};

export default function Turn14AdminPage() {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Turn14Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [importingIds, setImportingIds] = useState<Record<string, boolean>>({});
  const [importedStatuses, setImportedStatuses] = useState<Record<string, boolean>>({});
  const [stockMap, setStockMap] = useState<Record<string, StockInfo>>({});
  const [stockFilter, setStockFilter] = useState<'all' | 'inStock' | 'notInStock'>('all');
  const [stockChecking, setStockChecking] = useState(false);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Turn14Item | null>(null);
  const [orderForm, setOrderForm] = useState({ email: '', price: '' });
  const [orderLoading, setOrderLoading] = useState(false);

  const checkStock = useCallback(async (searchItems: Turn14Item[]) => {
    if (searchItems.length === 0) return;
    setStockChecking(true);
    try {
      const partNumbers = searchItems
        .map((item) => {
          const attrs: any = item.attributes || item;
          return attrs.part_number || attrs.mfr_part_number || attrs.internal_part_number || '';
        })
        .filter(Boolean);

      if (partNumbers.length === 0) {
        setStockMap({});
        return;
      }

      const res = await fetch('/api/admin/shop/turn14/stock-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partNumbers }),
      });
      const data = await res.json();
      setStockMap(data.inStock || {});
    } catch (err) {
      console.error('Stock check failed:', err);
    } finally {
      setStockChecking(false);
    }
  }, []);

  async function handleOrderSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItem || !orderForm.email || !orderForm.price) return;
    setOrderLoading(true);
    try {
      const res = await fetch('/api/admin/shop/turn14/quick-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item: selectedItem,
          customerEmail: orderForm.email,
          salePrice: orderForm.price,
          currency: 'EUR',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrderModalOpen(false);
      setOrderForm({ email: '', price: '' });
      alert(`Замовлення успішно створено! #${data.orderNumber}`);
    } catch (err: any) {
      alert(`Помилка: ${err.message}`);
    } finally {
      setOrderLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setStockMap({});
    setStockFilter('all');

    try {
      const res = await fetch(`/api/admin/shop/turn14?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');

      let resultItems = data.data || [];
      if (Array.isArray(data) && !(data as any).data) {
        resultItems = data;
      }

      setItems(resultItems);
      if (resultItems.length > 0) {
        checkStock(resultItems);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setError('');
    try {
      const res = await fetch('/api/admin/shop/turn14/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandName: 'Urban Automotive' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(`✅ ${data.message}\n\nНових товарів: ${data.created}\nОновлених: ${data.updated}\nПомилок: ${data.errors}\nЗагальна кількість: ${data.total}`);
    } catch (err: any) {
      setError(`Помилка синхронізації: ${err.message}`);
      alert(`❌ Помилка синхронізації: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }

  const getPartNumber = (item: Turn14Item) => {
    const attrs: any = item.attributes || item;
    return attrs.part_number || attrs.mfr_part_number || attrs.internal_part_number || '';
  };

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (stockFilter === 'all') return true;
        const pn = getPartNumber(item);
        const isInStock = pn && stockMap[pn];
        return stockFilter === 'inStock' ? !!isInStock : !isInStock;
      }),
    [items, stockFilter, stockMap]
  );

  const inStockCount = useMemo(
    () =>
      items.filter((item) => {
        const pn = getPartNumber(item);
        return pn && stockMap[pn];
      }).length,
    [items, stockMap]
  );

  const importedCount = Object.values(importedStatuses).filter(Boolean).length;

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Supplier Workspace"
        title="Turn14 Global Catalog"
        description="Пошук, stock check, sync і швидкі операції по supplier feed в одній робочій поверхні без showroom-noise."
        actions={
          <>
            <Link
              href="/admin/shop/turn14/markups"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:border-white/25 hover:text-zinc-100"
            >
              Brand markups
            </Link>
            <Link
              href="/admin/shop/audit"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:border-white/25 hover:text-zinc-100"
            >
              Audit
            </Link>
          </>
        }
      />

      <AdminMetricGrid>
        <AdminMetricCard label="Search results" value={items.length} meta="Поточна supplier видача" />
        <AdminMetricCard label="Already in OC" value={inStockCount} meta="Збіг по stock check" />
        <AdminMetricCard label="Imported now" value={importedCount} meta="У поточній сесії" />
        <AdminMetricCard label="Stock status" value={stockChecking ? 'Checking…' : stockFilter} meta="Фільтр на таблицю" />
      </AdminMetricGrid>

      <AdminActionBar>
        <div className="space-y-1">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">Ops flow</div>
          <div className="text-sm text-zinc-300">
            Search supplier inventory, звірити з One Company stock, імпортувати товар або створити швидке замовлення для клієнта.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminStatusBadge tone={stockChecking ? 'warning' : 'default'}>{stockChecking ? 'Stock checking' : 'Stock ready'}</AdminStatusBadge>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'motion-safe:animate-spin' : ''}`} />
            {syncing ? 'Синхронізація...' : 'Синхронізувати Urban'}
          </button>
        </div>
      </AdminActionBar>

      <form onSubmit={handleSearch}>
        <AdminFilterBar>
          <label className="min-w-[260px] flex-1">
            <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Search supplier catalog</span>
            <div className="flex items-center gap-2 rounded-none border border-white/10 bg-[#0F0F0F] px-4 py-3">
              <Search className="h-4 w-4 text-zinc-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Urban Automotive, Eventuri, SKU, part number..."
                className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
              />
            </div>
          </label>

          <label className="w-full md:w-[220px]">
            <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Availability filter</span>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as 'all' | 'inStock' | 'notInStock')}
              className="w-full rounded-none border border-white/10 bg-[#0F0F0F] px-4 py-3 text-sm text-zinc-100 focus:border-white/20 focus:outline-none"
            >
              <option value="all">All results</option>
              <option value="inStock">Already in One Company</option>
              <option value="notInStock">Missing in One Company</option>
            </select>
          </label>

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-3 text-sm text-zinc-100 transition hover:border-white/25 disabled:opacity-50"
          >
            <Globe className="h-4 w-4" />
            {loading ? 'Пошук...' : 'Знайти в Turn14'}
          </button>
        </AdminFilterBar>
      </form>

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}

      {loading ? (
        <AdminEmptyState
          title="Пошук у Turn14"
          description="Формуємо supplier result set і паралельно готуємо stock-check у локальному каталозі."
        />
      ) : filteredItems.length === 0 ? (
        <AdminEmptyState
          title={items.length === 0 ? 'Пошук ще не виконано' : 'Немає результатів під цей фільтр'}
          description={
            items.length === 0
              ? 'Запустіть пошук по бренду, SKU або part number, щоб побачити supplier inventory.'
              : 'Спробуйте інший availability filter або інший пошуковий запит.'
          }
        />
      ) : (
        <AdminTableShell>
          <table className="min-w-full text-left text-sm text-zinc-200">
            <thead className="bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Part number</th>
                <th className="px-4 py-3 font-medium">Availability</th>
                <th className="px-4 py-3 font-medium">Pricing</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const attributes: any = item.attributes || item;
                const itemId = item.id;
                const itemName = attributes.product_name || attributes.item_name || attributes.name || 'Unknown Part';
                const partNumber = attributes.part_number || attributes.mfr_part_number || attributes.internal_part_number || 'N/A';
                const brand = attributes.brand || attributes.brand_short_description || 'Turn14';
                const price = attributes.dealer_price || attributes.jobber_price || item.dealer_price || item.jobber_price || 0;
                const weight = attributes.weight || item.weight;
                const stockInfo = partNumber !== 'N/A' ? stockMap[partNumber] : null;

                return (
                  <tr key={itemId} className="border-t border-white/8 align-top">
                    <td className="px-4 py-4">
                      <div className="font-medium text-zinc-100">{itemName}</div>
                      <div className="mt-1 text-xs text-zinc-500">{brand}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-mono text-zinc-200">{partNumber}</div>
                      <div className="mt-1 text-xs text-zinc-500">{weight ? `${weight} lbs` : 'Weight unknown'}</div>
                    </td>
                    <td className="px-4 py-4">
                      {stockInfo ? (
                        <div className="space-y-2">
                          <AdminStatusBadge tone="success">In One Company</AdminStatusBadge>
                          <div className="text-xs text-zinc-500">{stockInfo.title}</div>
                        </div>
                      ) : (
                        <AdminStatusBadge tone="warning">Missing in One Company</AdminStatusBadge>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-zinc-100">${Number(price).toFixed(2)}</div>
                      <div className="mt-1 text-xs text-zinc-500">{stockInfo ? stockInfo.sku : 'No local SKU'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedItem(item);
                            setOrderModalOpen(true);
                          }}
                          className="rounded-full border border-white/10 px-3 py-2 text-xs text-zinc-300 transition hover:border-white/25 hover:text-zinc-100"
                        >
                          Quick order
                        </button>
                        {stockInfo ? (
                          <Link
                            href={`/admin/shop/${stockInfo.productId}`}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-zinc-300 transition hover:border-white/25 hover:text-zinc-100"
                          >
                            Open
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          disabled={importingIds[itemId] || importedStatuses[itemId]}
                          onClick={async () => {
                            setImportingIds((prev) => ({ ...prev, [itemId]: true }));
                            try {
                              const res = await fetch('/api/admin/shop/turn14/import', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(item),
                              });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data.error);
                              setImportedStatuses((prev) => ({ ...prev, [itemId]: true }));
                            } catch (err: any) {
                              alert(`Import error: ${err.message}`);
                            } finally {
                              setImportingIds((prev) => ({ ...prev, [itemId]: false }));
                            }
                          }}
                          className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-2 text-xs font-medium text-black transition hover:bg-stone-200 disabled:opacity-50"
                        >
                          {importedStatuses[itemId] ? <CheckCircle2 className="h-3.5 w-3.5" /> : <PackagePlus className="h-3.5 w-3.5" />}
                          {importedStatuses[itemId] ? 'Imported' : importingIds[itemId] ? 'Importing...' : 'Import'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AdminTableShell>
      )}

      {orderModalOpen && selectedItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-none border border-white/10 bg-[#09090b] p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            <h3 className="text-xl font-medium text-white">Оформити швидке замовлення</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              Система створить нове `UNPAID` замовлення для {(selectedItem.attributes as any)?.product_name || (selectedItem.attributes as any)?.item_name || 'деталі Turn14'}.
            </p>
            <form onSubmit={handleOrderSubmit} className="mt-6 space-y-5">
              <label className="block">
                <span className="mb-2 block text-[11px] uppercase tracking-wider text-white/50">Email клієнта</span>
                <input
                  type="email"
                  required
                  value={orderForm.email}
                  onChange={(e) => setOrderForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-none border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-white/20 focus:outline-none"
                  placeholder="client@mail.com"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[11px] uppercase tracking-wider text-white/50">Ціна продажу (EUR)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={orderForm.price}
                  onChange={(e) => setOrderForm((prev) => ({ ...prev, price: e.target.value }))}
                  className="w-full rounded-none border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:border-white/20 focus:outline-none"
                  placeholder="1500.00"
                />
              </label>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOrderModalOpen(false)}
                  className="flex-1 rounded-full border border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-white transition hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={orderLoading}
                  className="flex-1 rounded-full bg-zinc-100 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-black transition hover:bg-stone-200 disabled:opacity-50"
                >
                  {orderLoading ? 'Створення...' : 'Підтвердити'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AdminPage>
  );
}
