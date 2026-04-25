'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, Copy, ExternalLink, FileJson, FileSpreadsheet, RefreshCcw, Search } from 'lucide-react';

import {
  AdminActionBar,
  AdminBarList,
  AdminEmptyState,
  AdminFilterBar,
  AdminInlineAlert,
  AdminInspectorCard,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableShell,
} from '@/components/admin/AdminPrimitives';

type ProductFeedLocale = 'ua' | 'en';
type ProductFeedCurrency = 'EUR' | 'USD' | 'UAH';
type StockFeedFormat = 'json' | 'csv';

type StockFeedItem = {
  airtableId: string;
  title: string;
  sku: string;
  ourSku: string;
  brand: string;
  stockQuantity: number;
  price: number;
  priceCurrencyHint: string;
  stockStatus: 'in_stock' | 'out_of_stock';
};

type StockFeedPayload = {
  status: 'success';
  source: 'airtable';
  total_items: number;
  timestamp: string;
  items: StockFeedItem[];
};

const PRODUCT_FEED_LOCALES: Array<{ value: ProductFeedLocale; label: string }> = [
  { value: 'ua', label: 'UA' },
  { value: 'en', label: 'EN' },
];

const PRODUCT_FEED_CURRENCIES: Array<{ value: ProductFeedCurrency; label: string }> = [
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
  { value: 'UAH', label: 'UAH' },
];

const STOCK_FEED_FORMATS: Array<{ value: StockFeedFormat; label: string }> = [
  { value: 'json', label: 'JSON' },
  { value: 'csv', label: 'CSV' },
];

function buildUrl(origin: string, path: string, params: Record<string, string>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value.trim()) {
      query.set(key, value.trim());
    }
  }
  return `${origin}${path}${query.toString() ? `?${query.toString()}` : ''}`;
}

function formatDateTime(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(value: number, currencyHint: string) {
  if (!Number.isFinite(value) || value <= 0) return '-';
  const currency = ['EUR', 'USD', 'UAH', 'GBP'].includes(currencyHint) ? currencyHint : 'UAH';
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function AdminFeedExportsPage() {
  const [origin, setOrigin] = useState('');
  const [locale, setLocale] = useState<ProductFeedLocale>('ua');
  const [currency, setCurrency] = useState<ProductFeedCurrency>('EUR');
  const [stockFormat, setStockFormat] = useState<StockFeedFormat>('json');
  const [brand, setBrand] = useState('');
  const [skuPrefix, setSkuPrefix] = useState('');
  const [preview, setPreview] = useState<StockFeedPayload | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const productFeedUrl = useMemo(
    () =>
      buildUrl(origin || 'https://onecompany.global', '/api/shop/feed/products', {
        locale,
        currency,
      }),
    [currency, locale, origin]
  );

  const stockFeedUrl = useMemo(
    () =>
      buildUrl(origin || 'https://onecompany.global', '/api/admin/shop/feed/stock', {
        format: stockFormat,
        brand,
        sku_prefix: skuPrefix,
      }),
    [brand, origin, skuPrefix, stockFormat]
  );

  const stockPreviewUrl = useMemo(
    () =>
      buildUrl(origin || '', '/api/admin/shop/feed/stock', {
        format: 'json',
        brand,
        sku_prefix: skuPrefix,
      }),
    [brand, origin, skuPrefix]
  );

  useEffect(() => {
    if (!origin) return;

    let cancelled = false;
    async function loadPreview() {
      setLoadingPreview(true);
      setError('');
      try {
        const response = await fetch(stockPreviewUrl, { cache: 'no-store' });
        const data = (await response.json().catch(() => ({}))) as StockFeedPayload & { error?: string; details?: string };
        if (!response.ok) {
          throw new Error(data.details || data.error || 'Failed to load stock feed preview');
        }
        if (!cancelled) {
          setPreview(data);
        }
      } catch (previewError) {
        if (!cancelled) {
          setPreview(null);
          setError(previewError instanceof Error ? previewError.message : 'Failed to load stock feed preview');
        }
      } finally {
        if (!cancelled) {
          setLoadingPreview(false);
        }
      }
    }

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [origin, stockPreviewUrl]);

  async function copyUrl(id: string, url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(id);
    window.setTimeout(() => setCopied(''), 1600);
  }

  const brandBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of preview?.items ?? []) {
      const label = item.brand || 'Unknown';
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value, tone: 'accent' as const }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 8);
  }, [preview]);

  const inStockCount = preview?.items.filter((item) => item.stockStatus === 'in_stock').length ?? 0;
  const outOfStockCount = Math.max(0, (preview?.total_items ?? 0) - inStockCount);

  return (
    <AdminPage className="space-y-6">
      <AdminPageHeader
        eyebrow="Feed"
        title="Distributor feed exports"
        description="Керована поверхня для видачі товарних і складських feed URL дистриб'юторам без зміни публічних endpoint-ів."
        actions={
          <AdminStatusBadge tone={error ? 'warning' : 'success'}>
            {error ? 'Preview degraded' : 'Feeds ready'}
          </AdminStatusBadge>
        }
      />

      <AdminMetricGrid>
        <AdminMetricCard label="Stock feed items" value={loadingPreview ? '...' : preview?.total_items ?? 0} meta="Filtered Airtable stock rows" tone="accent" />
        <AdminMetricCard label="In stock" value={inStockCount} meta="Ready for distributor availability" />
        <AdminMetricCard label="Out of stock" value={outOfStockCount} meta="Visible in stock feed as unavailable" />
        <AdminMetricCard label="Updated" value={formatDateTime(preview?.timestamp ?? null)} meta="Stock feed timestamp" />
      </AdminMetricGrid>

      {error ? <AdminInlineAlert tone="warning">{error}</AdminInlineAlert> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <AdminInspectorCard title="Product Merchant XML" description="Localized product feed for catalog syndication and merchant ingestion.">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FeedSelect label="Locale" value={locale} onChange={(value) => setLocale(value as ProductFeedLocale)} options={PRODUCT_FEED_LOCALES} />
              <FeedSelect label="Currency" value={currency} onChange={(value) => setCurrency(value as ProductFeedCurrency)} options={PRODUCT_FEED_CURRENCIES} />
            </div>
            <FeedUrlCard
              icon={<FileSpreadsheet className="h-4 w-4" />}
              title="Merchant XML URL"
              url={productFeedUrl}
              copied={copied === 'product'}
              onCopy={() => void copyUrl('product', productFeedUrl)}
            />
            <a
              href={productFeedUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
            >
              <ExternalLink className="h-4 w-4" />
              Open XML
            </a>
          </div>
        </AdminInspectorCard>

        <AdminInspectorCard title="Stock JSON / CSV" description="Airtable stock feed with distributor-friendly brand and SKU filters.">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <FeedSelect label="Format" value={stockFormat} onChange={(value) => setStockFormat(value as StockFeedFormat)} options={STOCK_FEED_FORMATS} />
              <label className="block sm:col-span-1">
                <span className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-zinc-500">Brand</span>
                <input
                  value={brand}
                  onChange={(event) => setBrand(event.target.value)}
                  placeholder="Eventuri"
                  className="w-full rounded-[6px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-white/20 focus:outline-none"
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-zinc-500">SKU prefix</span>
                <input
                  value={skuPrefix}
                  onChange={(event) => setSkuPrefix(event.target.value)}
                  placeholder="kw_"
                  className="w-full rounded-[6px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-white/20 focus:outline-none"
                />
              </label>
            </div>
            <FeedUrlCard
              icon={<FileJson className="h-4 w-4" />}
              title="Stock feed URL"
              url={stockFeedUrl}
              copied={copied === 'stock'}
              onCopy={() => void copyUrl('stock', stockFeedUrl)}
            />
            <a
              href={stockFeedUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
            >
              <ExternalLink className="h-4 w-4" />
              Open feed
            </a>
          </div>
        </AdminInspectorCard>
      </div>

      <AdminFilterBar>
        <div className="flex items-center gap-2 text-sm text-zinc-300">
          <Search className="h-4 w-4 text-zinc-500" />
          Preview follows the stock filters above.
        </div>
        <button
          type="button"
          onClick={() => {
            setBrand((current) => current.trim());
            setSkuPrefix((current) => current.trim());
          }}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
        >
          <RefreshCcw className={`h-4 w-4 ${loadingPreview ? 'motion-safe:animate-spin' : ''}`} />
          Refresh preview
        </button>
      </AdminFilterBar>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <AdminTableShell>
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-sm font-medium text-zinc-100">Stock feed preview</h2>
            <p className="mt-1 text-xs text-zinc-500">First rows from the JSON feed used for distributor availability checks.</p>
          </div>
          {preview?.items.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                    <th className="px-4 py-4 font-medium">Product</th>
                    <th className="px-4 py-4 font-medium">Brand</th>
                    <th className="px-4 py-4 font-medium">SKU</th>
                    <th className="px-4 py-4 font-medium">Stock</th>
                    <th className="px-4 py-4 font-medium">RRP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {preview.items.slice(0, 12).map((item) => (
                    <tr key={item.airtableId} className="align-top transition hover:bg-white/[0.03]">
                      <td className="px-4 py-4">
                        <div className="font-medium text-zinc-100">{item.title || '-'}</div>
                        <div className="mt-1 font-mono text-xs text-zinc-500">{item.airtableId}</div>
                      </td>
                      <td className="px-4 py-4 text-zinc-300">{item.brand || '-'}</td>
                      <td className="px-4 py-4">
                        <div className="font-mono text-xs text-zinc-300">{item.ourSku || '-'}</div>
                        <div className="mt-1 font-mono text-xs text-zinc-500">{item.sku || '-'}</div>
                      </td>
                      <td className="px-4 py-4">
                        <AdminStatusBadge tone={item.stockStatus === 'in_stock' ? 'success' : 'warning'}>
                          {item.stockQuantity} · {item.stockStatus.replace(/_/g, ' ')}
                        </AdminStatusBadge>
                      </td>
                      <td className="px-4 py-4 text-zinc-300">{formatMoney(item.price, item.priceCurrencyHint)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <AdminEmptyState
              className="rounded-none border-0 bg-transparent"
              title={loadingPreview ? 'Loading preview' : 'No feed rows'}
              description={loadingPreview ? 'The current stock feed filters are being loaded.' : 'Adjust brand or SKU prefix filters to broaden the stock feed.'}
            />
          )}
        </AdminTableShell>

        <AdminInspectorCard title="Brand mix" description="Top brands inside the current stock feed preview.">
          <AdminBarList data={brandBreakdown} />
        </AdminInspectorCard>
      </div>
    </AdminPage>
  );
}

function FeedSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[6px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-white/20 focus:outline-none"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FeedUrlCard({
  icon,
  title,
  url,
  copied,
  onCopy,
}: {
  icon: ReactNode;
  title: string;
  url: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-[6px] border border-white/10 bg-black/25 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
          <span className="text-blue-300">{icon}</span>
          {title}
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200 transition hover:bg-white/10"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <code className="block break-all rounded-[6px] border border-white/10 bg-[#080808] px-3 py-3 text-xs leading-5 text-zinc-400">
        {url}
      </code>
    </div>
  );
}
