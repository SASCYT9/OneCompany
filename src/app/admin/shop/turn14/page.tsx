'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, Globe, PackagePlus, ArrowLeft, RefreshCw, AlertCircle, CheckCircle2, Filter, ExternalLink } from 'lucide-react';

type Turn14Item = {
  id: string; 
  attributes: {
    item_name?: string;
    product_name?: string;
    name?: string;
    part_number?: string;
    mfr_part_number?: string;
    brand?: string;
    thumbnail?: string;
    image_url?: string;
  };
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

  // Stock filter state
  const [stockMap, setStockMap] = useState<Record<string, StockInfo>>({});
  const [stockFilter, setStockFilter] = useState<'all' | 'inStock' | 'notInStock'>('all');
  const [stockChecking, setStockChecking] = useState(false);

  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Turn14Item | null>(null);
  const [orderForm, setOrderForm] = useState({ email: '', price: '' });
  const [orderLoading, setOrderLoading] = useState(false);

  // Check stock for all loaded items
  const checkStock = useCallback(async (searchItems: Turn14Item[]) => {
    if (searchItems.length === 0) return;
    setStockChecking(true);
    try {
      const partNumbers = searchItems.map(item => {
        const attrs: any = item.attributes || item;
        return attrs.part_number || attrs.mfr_part_number || '';
      }).filter(Boolean);

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
          currency: 'EUR'
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(`Замовлення успішно створено! #${data.orderNumber}`);
      setOrderModalOpen(false);
      setOrderForm({ email: '', price: '' });
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
      
      // Auto-check stock for results
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
        body: JSON.stringify({ brandName: 'Urban Automotive' })
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

  // Apply stock filter
  const getPartNumber = (item: Turn14Item) => {
    const attrs: any = item.attributes || item;
    return attrs.part_number || attrs.mfr_part_number || '';
  };

  const filteredItems = items.filter(item => {
    if (stockFilter === 'all') return true;
    const pn = getPartNumber(item);
    const isInStock = pn && stockMap[pn];
    return stockFilter === 'inStock' ? !!isInStock : !isInStock;
  });

  const inStockCount = items.filter(item => {
    const pn = getPartNumber(item);
    return pn && stockMap[pn];
  }).length;

  return (
    <div className="relative h-full w-full overflow-auto bg-black text-white">
      {/* Subtle ambient neon glow in the background */}
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/10 blur-[120px]"></div>

      <div className="w-full px-4 py-8 md:px-8 lg:px-12">
        <Link
          href="/admin/shop"
          className="group mb-8 inline-flex items-center gap-2 text-[13px] font-medium tracking-wide text-white/40 hover:text-white transition-all duration-300"
        >
          <ArrowLeft className="h-4 w-4 transform transition-transform group-hover:-translate-x-1" />
          Назад в магазин
        </Link>
        
        <h1 className="mb-2 flex items-center gap-3 text-3xl font-light tracking-tight text-white drop-shadow-lg">
          <Globe className="h-8 w-8 text-indigo-500/80 drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]" /> 
          Turn14 Global Catalog Live Search
        </h1>
          <p className="mb-6 max-w-2xl text-sm leading-relaxed text-white/40">
          Пошук оригінальних деталей безпосередньо у постачальника Turn14 Distribution.
        </p>

        {/* Quick nav */}
        <div className="mb-8 flex items-center gap-3">
          <Link href="/admin/shop/turn14/markups"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 text-xs uppercase tracking-widest font-medium hover:bg-amber-500/10 transition-all">
            <span>%</span> Brand Markup Editor
          </Link>
          <Link href="/admin/crm"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 text-indigo-400 text-xs uppercase tracking-widest font-medium hover:bg-indigo-500/10 transition-all">
            CRM Dashboard
          </Link>
        </div>

        {/* Sync Controls Panel */}
        <div className="mb-10 flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-white/[0.08] bg-black/60 shadow-2xl backdrop-blur-2xl p-6 transition-all hover:border-indigo-500/20">
          <div className="flex-1">
            <h2 className="text-lg font-medium tracking-wide text-white mb-2">Фонова Синхронізація (B2B/Urban)</h2>
            <p className="text-[13px] text-white/50 max-w-xl">
              Запустити ручне фонове завдання, яке завантажить всі нові продукти від Urban Automotive
              через Turn14 API в нашу базу даних (Products / Variants).
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="group relative inline-flex items-center gap-3 overflow-hidden rounded-xl bg-white px-8 py-3.5 text-sm font-semibold uppercase tracking-widest text-black shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all duration-300 hover:scale-[1.02] hover:bg-zinc-200 hover:shadow-[0_0_25px_rgba(255,255,255,0.4)] disabled:opacity-50 disabled:hover:scale-100"
          >
            {syncing ? (
              <RefreshCw className="h-5 w-5 animate-spin text-indigo-600" />
            ) : (
              <RefreshCw className="h-5 w-5 text-indigo-600 drop-shadow-[0_0_8px_rgba(99,102,241,0.4)] transition-transform group-hover:rotate-180" />
            )}
            {syncing ? 'Процеринг...' : 'Синхронізувати Urban'}
          </button>
        </div>

      <form onSubmit={handleSearch} className="mb-8 flex items-center gap-3">
        <label className="flex w-full max-w-xl items-center gap-3 rounded-2xl border border-white/[0.08] bg-black/60 shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-2xl px-5 py-3.5 text-sm text-white focus-within:border-indigo-500/50 focus-within:shadow-[0_0_20px_rgba(99,102,241,0.2)] transition-all duration-300">
          <Search className="h-5 w-5 text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.3)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Введіть артикул, бренд або назву деталі (напр. 'exhaust')"
            className="w-full bg-transparent text-white placeholder:text-white/30 focus:outline-none tracking-wide"
          />
        </label>
        <button 
          type="submit" 
          disabled={loading || !query.trim()}
          className="rounded-xl bg-white px-8 py-4 text-sm font-semibold text-black hover:bg-zinc-200 hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] shadow-[0_0_10px_rgba(255,255,255,0.1)] transition-all duration-300 disabled:opacity-50 uppercase tracking-widest"
        >
          {loading ? 'Пошук...' : 'Знайти в Turn14'}
        </button>
      </form>

      {error && <div className="mb-8 text-red-500 bg-red-500/10 p-5 rounded-2xl border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)] flex items-center gap-3"><AlertCircle className="h-5 w-5" /> {error}</div>}

      {/* ═══ Stock Filter Bar ═══ */}
      {items.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-white/40 mr-2">
            <Filter className="w-4 h-4" />
            <span className="text-[10px] uppercase tracking-widest font-medium">Фільтр:</span>
          </div>
          
          <button
            onClick={() => setStockFilter('all')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium uppercase tracking-widest transition-all border ${
              stockFilter === 'all'
                ? 'bg-white/10 text-white border-white/20'
                : 'bg-transparent text-white/40 border-white/[0.06] hover:border-white/15 hover:text-white/60'
            }`}
          >
            Всі
            <span className="text-[10px] opacity-60">{items.length}</span>
          </button>

          <button
            onClick={() => setStockFilter('inStock')}
            disabled={stockChecking}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium uppercase tracking-widest transition-all border ${
              stockFilter === 'inStock'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-transparent text-white/40 border-white/[0.06] hover:border-emerald-500/20 hover:text-emerald-400/60'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            В наявності OC
            <span className="text-[10px] opacity-60">
              {stockChecking ? '...' : inStockCount}
            </span>
          </button>

          <button
            onClick={() => setStockFilter('notInStock')}
            disabled={stockChecking}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium uppercase tracking-widest transition-all border ${
              stockFilter === 'notInStock'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-transparent text-white/40 border-white/[0.06] hover:border-amber-500/20 hover:text-amber-400/60'
            }`}
          >
            <PackagePlus className="w-3.5 h-3.5" />
            Немає в OC
            <span className="text-[10px] opacity-60">
              {stockChecking ? '...' : items.length - inStockCount}
            </span>
          </button>

          {stockChecking && (
            <span className="text-[10px] text-white/20 animate-pulse uppercase tracking-widest ml-2">
              Перевірка наявності...
            </span>
          )}
        </div>
      )}

      <div className="rounded-3xl border border-white/[0.08] bg-black/40 shadow-2xl backdrop-blur-3xl overflow-hidden hover:border-white/[0.12] transition-colors relative">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
        {items.length === 0 && !loading && !error ? (
          <div className="p-16 text-center text-white/40 tracking-wider text-sm">
            Введіть запит, щоб знайти запчастини у багатомільйонній базі Turn14.
          </div>
        ) : loading ? (
           <div className="p-16 flex flex-col items-center justify-center text-center">
             <div className="w-10 h-10 mb-4 rounded-full border-t-2 border-indigo-500 animate-spin shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
             <span className="text-white/60 animate-pulse tracking-widest text-sm uppercase">Завантаження каталогу Turn14...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-16 text-center text-white/40 tracking-wider text-sm">
            {stockFilter === 'inStock' 
              ? 'Жоден з результатів пошуку не знайдено в каталозі One Company.'
              : stockFilter === 'notInStock'
                ? 'Всі знайдені товари вже є в каталозі One Company!'
                : 'Немає результатів.'}
          </div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredItems.map((item) => {
                const attributes: any = item.attributes || item;
                const itemId = item.id;
                const itemName = attributes.product_name || attributes.item_name || attributes.name || 'Unknown Part';
                const partNumber = attributes.part_number || attributes.mfr_part_number || 'N/A';
                const thumbnail = attributes.thumbnail || attributes.image_url || null;
                const brand = attributes.brand || 'Turn14';
                const stockInfo = partNumber !== 'N/A' ? stockMap[partNumber] : null;

                return (
                  <div 
                    key={itemId} 
                    className={`group relative overflow-hidden bg-zinc-900/30 border transition-colors duration-300 flex flex-col hover:border-white/20 ${
                      stockInfo ? 'border-emerald-500/20' : 'border-white/5'
                    }`}
                  >
                    {/* Stock badge */}
                    {stockInfo && (
                      <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-sm">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span className="text-[9px] uppercase tracking-widest text-emerald-400 font-bold">В OC</span>
                      </div>
                    )}

                    {/* Image Container */}
                    <div className="relative aspect-square overflow-hidden bg-zinc-900/50 p-8 flex items-center justify-center">
                      <div className="absolute inset-0 transition-opacity duration-300 opacity-0 group-hover:opacity-100 bg-black/40 z-10 pointer-events-none"></div>
                      {thumbnail ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img 
                          src={thumbnail} 
                          alt={itemName} 
                          className="z-0 max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-105" 
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full w-full text-white/20">
                          <PackagePlus className="w-8 h-8 opacity-50 mb-2" />
                          <span className="text-[10px] uppercase tracking-widest font-light">NO IMAGE</span>
                        </div>
                      )}
                      
                      {/* Floating actions on hover */}
                      <div className="absolute bottom-6 left-0 w-full px-6 flex gap-3 translate-y-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 z-20">
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setOrderModalOpen(true);
                          }}
                          className="flex-1 bg-white px-4 py-3 text-xs uppercase tracking-widest text-black hover:bg-zinc-200 transition-colors duration-300 font-medium text-center"
                        >
                          Для клієнта
                        </button>
                        {stockInfo && (
                          <Link
                            href={`/admin/shop/${stockInfo.productId}`}
                            className="bg-emerald-500 px-4 py-3 text-xs uppercase tracking-widest text-white hover:bg-emerald-600 transition-colors duration-300 font-medium text-center flex items-center gap-1.5"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Відкрити
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex flex-col flex-1 p-6 border-t border-white/5 bg-transparent">
                      <div className="mb-4">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">
                          {brand}
                        </div>
                        <h3 className="text-sm font-light text-white tracking-wide line-clamp-2" title={itemName}>
                          {itemName}
                        </h3>
                      </div>
                      
                      <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[9px] uppercase tracking-widest text-white/30 mb-0.5">Артикул</span>
                          <span className="font-mono text-xs tracking-wide text-white/60">{partNumber}</span>
                        </div>
                        
                        <button 
                          className={`p-2 transition-all duration-300 ${
                            importedStatuses[itemId] 
                              ? 'text-emerald-400 bg-emerald-400/10' 
                              : importingIds[itemId]
                                ? 'text-white/30 cursor-not-allowed'
                                : 'text-white/40 hover:text-white hover:bg-white/10'
                          }`}
                          disabled={importingIds[itemId] || importedStatuses[itemId]}
                          title="Імпортувати товар в базу"
                          onClick={async () => {
                            setImportingIds(prev => ({ ...prev, [itemId]: true }));
                            try {
                              const res = await fetch('/api/admin/shop/turn14/import', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(item),
                              });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data.error);
                              setImportedStatuses(prev => ({ ...prev, [itemId]: true }));
                            } catch (err: any) {
                              alert(`Import error: ${err.message}`);
                            } finally {
                              setImportingIds(prev => ({ ...prev, [itemId]: false }));
                            }
                          }}
                        >
                          <PackagePlus className={`w-4 h-4 ${importingIds[itemId] ? 'animate-pulse' : ''}`} /> 
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {orderModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#09090b] p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            <h3 className="text-xl font-medium text-white mb-2 tracking-wide">Оформити замовлення</h3>
            <p className="text-sm text-white/50 mb-6 leading-relaxed">
              Ви додаєте <span className="text-indigo-300 font-medium whitespace-pre-wrap break-words">{(selectedItem.attributes as any)?.product_name || (selectedItem.attributes as any)?.item_name || 'Деталь Turn14'}</span>. 
              Система створить нове UNPAID замовлення.
            </p>
            <form onSubmit={handleOrderSubmit} className="space-y-5">
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider font-medium text-white/50 block mb-2">Email клієнта *</span>
                <input
                  type="email"
                  required
                  value={orderForm.email}
                  onChange={e => setOrderForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-xl bg-black/40 border border-white/[0.08] px-4 py-3 text-sm text-white focus:border-indigo-500/50 focus:outline-none transition-colors"
                  placeholder="client@mail.com"
                />
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider font-medium text-white/50 block mb-2">Ціна продажу (EUR) *</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={orderForm.price}
                  onChange={e => setOrderForm(prev => ({ ...prev, price: e.target.value }))}
                  className="w-full rounded-xl bg-black/40 border border-white/[0.08] px-4 py-3 text-sm text-white focus:border-indigo-500/50 focus:outline-none transition-colors"
                  placeholder="1500.00"
                />
              </label>
              <div className="pt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setOrderModalOpen(false)}
                  className="flex-1 rounded-xl border border-white/10 bg-transparent hover:bg-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-white transition-colors"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  disabled={orderLoading}
                  className="flex-1 rounded-xl bg-white hover:bg-zinc-200 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-black shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] disabled:opacity-50 transition-all duration-300"
                >
                  {orderLoading ? 'Створення...' : 'Підтвердити'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
