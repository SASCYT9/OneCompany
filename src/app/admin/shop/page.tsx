'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckSquare,
  Download,
  Eye,
  Layers,
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
  AdminEntityToolbar,
  AdminInlineAlert,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPage,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableShell,
} from '@/components/admin/AdminPrimitives';
import { AdminSkeletonKpiGrid, AdminSkeletonTable } from '@/components/admin/AdminSkeleton';
import { useConfirm } from '@/components/admin/AdminConfirmDialog';
import { useToast } from '@/components/admin/AdminToast';
import { AdminSavedViewsBar, useSavedViews } from '@/components/admin/AdminSavedViews';
import { ProductQuickView } from '@/app/admin/shop/components/ProductQuickView';
import { AdminMobileCard } from '@/components/admin/AdminMobileCard';
import { AdminBrandHero } from '@/components/admin/AdminBrandHero';
import { AdminFilterChips, type FilterChip } from '@/components/admin/AdminFilterChips';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { AdminProductThumbnail } from '@/components/admin/AdminProductThumbnail';
import {
  AdminDensityToggle,
  DENSITY_ROW_PADDING,
  DENSITY_THUMB_SIZE,
  useAdminDensity,
} from '@/components/admin/AdminDensityToggle';
import { adminBrandTheme, isBrandFilterActive } from '@/lib/admin/brandTheme';
import { cn } from '@/lib/utils';

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
  imageUrl: string | null;
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

function priceMeta(product: ShopProductListItem): string | null {
  const parts: string[] = [];
  if (product.priceEur != null && product.priceUsd != null) parts.push(`$${product.priceUsd}`);
  if (product.priceUah != null) parts.push(`₴${product.priceUah}`);
  return parts.length ? parts.join(' · ') : null;
}

function getStatusTone(status: ShopProductListItem['status']) {
  if (status === 'ACTIVE') return 'success';
  if (status === 'ARCHIVED') return 'danger';
  return 'warning';
}

function relativeTime(iso: string): { label: string; full: string } {
  const date = new Date(iso);
  const full = date.toLocaleString();
  const diff = Date.now() - date.getTime();
  const seconds = Math.max(0, Math.floor(diff / 1000));
  if (seconds < 60) return { label: 'щойно', full };
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return { label: `${minutes} хв тому`, full };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { label: `${hours} год тому`, full };
  const days = Math.floor(hours / 24);
  if (days < 30) return { label: `${days} дн. тому`, full };
  const months = Math.floor(days / 30);
  if (months < 12) return { label: `${months} міс. тому`, full };
  return { label: `${Math.floor(months / 12)} р. тому`, full };
}

function CoverageHealth({
  variants,
  media,
  collections,
}: {
  variants: number;
  media: number;
  collections: number;
}) {
  const items: Array<{ short: string; full: string; value: number; tone: 'good' | 'warn' }> = [
    { short: 'Варіанти', full: 'Варіанти', value: variants, tone: variants > 0 ? 'good' : 'warn' },
    { short: 'Медіа', full: 'Медіа', value: media, tone: media > 0 ? 'good' : 'warn' },
    { short: 'Колекції', full: 'Колекції', value: collections, tone: collections > 0 ? 'good' : 'warn' },
  ];
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5"
      title={`Варіанти ${variants} · Медіа ${media} · Колекції ${collections}`}
    >
      {items.map((item) => (
        <div key={item.full} className="flex items-center gap-2">
          <span
            className={cn(
              'inline-block h-1.5 w-6 rounded-full',
              item.tone === 'good' ? 'bg-emerald-500/70' : 'bg-amber-500/70'
            )}
            aria-hidden="true"
          />
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            {item.short}
          </span>
          <span className="text-[12px] font-semibold tabular-nums text-zinc-200">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function PriceCell({ product }: { product: ShopProductListItem }) {
  const meta = priceMeta(product);
  return (
    <div className="space-y-0.5">
      <div className="text-base font-semibold tabular-nums text-zinc-50">{priceLabel(product)}</div>
      {meta ? <div className="text-[11px] text-zinc-500 tabular-nums">{meta}</div> : null}
    </div>
  );
}

function AdminShopPageContent() {
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { density, setDensity } = useAdminDensity('comfortable');

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
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const brandActive = isBrandFilterActive(brandParam);
  const brandTheme = useMemo(() => adminBrandTheme(brandParam), [brandParam]);

  const visibleStats = useMemo(() => {
    const counts = { active: 0, draft: 0, archived: 0, published: 0 };
    for (const p of products) {
      if (p.status === 'ACTIVE') counts.active += 1;
      if (p.status === 'DRAFT') counts.draft += 1;
      if (p.status === 'ARCHIVED') counts.archived += 1;
      if (p.isPublished) counts.published += 1;
    }
    return counts;
  }, [products]);

  // Saved views — filter combinations stored in localStorage
  const savedViews = useSavedViews({
    scope: 'products',
    currentValue: { search: searchParam, brand: brandParam, status: statusParam },
    presets: [
      { name: 'Усі товари', value: { search: '', brand: 'ALL', status: 'ALL' } },
      { name: 'Лише активні', value: { status: 'ACTIVE' } },
      { name: 'Чернетки', value: { status: 'DRAFT' } },
      { name: 'Архів', value: { status: 'ARCHIVED' } },
      { name: 'Brabus', value: { brand: 'Brabus', status: 'ALL' } },
      { name: 'Akrapovic', value: { brand: 'Akrapovic', status: 'ALL' } },
      { name: 'RaceChip', value: { brand: 'RaceChip', status: 'ALL' } },
    ],
    onApply: (v) => {
      updateParams({
        search: (v.search as string) ?? '',
        brand: (v.brand as string) ?? 'ALL',
        status: (v.status as string) ?? 'ALL',
      });
    },
  });

  async function handleExport() {
    setExporting(true);
    try {
      const filtersJson = JSON.stringify({
        search: searchParam,
        brand: brandParam !== 'ALL' ? brandParam : '',
        status: statusParam !== 'ALL' ? statusParam : '',
      });
      const filtersB64 = btoa(unescape(encodeURIComponent(filtersJson)));
      const response = await fetch(`/api/admin/export/products?filters=${filtersB64}`, { cache: 'no-store' });
      if (!response.ok) {
        toast.error('Не вдалося експортувати товари');
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'products.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Товари експортовано', `Завантажено ${a.download}`);
    } catch (e) {
      toast.error('Експорт не вдався', (e as Error).message);
    } finally {
      setExporting(false);
    }
  }

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
        setError((data as { error?: string }).error || 'Не вдалося завантажити товари');
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

  async function handleArchive(id: string) {
    const ok = await confirm({
      tone: 'warning',
      title: 'Архівувати цей товар?',
      description: 'Товар буде знято з публікації та переведено в архів. Його можна буде відновити — це не повне видалення.',
      confirmLabel: 'Архівувати',
    });
    if (!ok) return;

    setDeletingId(id);
    setSuccess('');
    setError('');

    try {
      const response = await fetch(`/api/admin/shop/products/${id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const msg = (data as { error?: string }).error || 'Archive failed';
        setError(msg);
        toast.error('Не вдалося архівувати товар', msg);
        return;
      }

      setSuccess('Товар архівовано.');
      toast.success('Товар архівовано');
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
        setError((data as { error?: string }).error || 'Масова зміна статусу не вдалась');
        return;
      }

      setSelectedIds(new Set());
      await load();
    } finally {
      setBulkUpdating(false);
    }
  }

  async function handleStorefrontBackfill() {
    const ok = await confirm({
      tone: 'warning',
      title: 'Нормалізувати storefront-теги для всього каталогу?',
      description: 'Кожен товар отримає рівно один тег store:* залежно від сигналів Urban / Brabus / Main. Поточні теги буде замінено.',
      confirmLabel: 'Виконати нормалізацію',
    });
    if (!ok) return;

    setStorefrontBackfilling(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/admin/shop/products/backfill-storefront', { method: 'POST' });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError((data as { error?: string }).error || 'Не вдалося нормалізувати storefront-теги');
        return;
      }

      const payload = data as {
        updatedCount?: number;
        totalCount?: number;
        storefrontCounts?: { urban?: number; brabus?: number; main?: number };
      };

      setSuccess(
        `Storefront-теги нормалізовано: оновлено ${payload.updatedCount ?? 0} з ${payload.totalCount ?? 0}. Urban: ${
          payload.storefrontCounts?.urban ?? 0
        }, Brabus: ${payload.storefrontCounts?.brabus ?? 0}, Main: ${payload.storefrontCounts?.main ?? 0}.`
      );
      await load();
    } catch (backfillError) {
      setError((backfillError as Error).message || 'Не вдалося нормалізувати storefront-теги');
    } finally {
      setStorefrontBackfilling(false);
    }
  }

  const selectedCount = selectedIds.size;
  const selectionLabel =
    selectedCount === 0 ? 'Нічого не вибрано' : `${selectedCount} вибрано для масової зміни статусу.`;

  // Build active filter chips
  const filterChips: FilterChip[] = [];
  if (brandActive) {
    filterChips.push({
      id: 'brand',
      label: 'Бренд',
      value: brandTheme.displayName,
      onRemove: () => updateParams({ brand: 'ALL' }),
      tintHex: brandTheme.tintHex,
    });
  }
  if (statusParam !== 'ALL') {
    filterChips.push({
      id: 'status',
      label: 'Статус',
      value: statusParam,
      onRemove: () => updateParams({ status: 'ALL' }),
    });
  }
  if (searchParam) {
    filterChips.push({
      id: 'search',
      label: 'Пошук',
      value: `«${searchParam}»`,
      onRemove: () => {
        setSearchInput('');
        updateParams({ search: '' });
      },
    });
  }

  // Action buttons (rendered in either hero or page header)
  const headerActions = (
    <>
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={exporting}
        className="inline-flex items-center gap-2 rounded-none border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/[0.06] disabled:opacity-50"
      >
        <Download className="h-4 w-4" />
        {exporting ? 'Експорт…' : 'Експорт CSV'}
      </button>
      <Link
        href="/admin/shop/import"
        className="inline-flex items-center gap-2 rounded-none border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-200 transition hover:bg-white/[0.06]"
      >
        <Upload className="h-4 w-4" />
        Імпорт
      </Link>
      <button
        type="button"
        onClick={handleStorefrontBackfill}
        disabled={storefrontBackfilling}
        className="inline-flex items-center gap-2 rounded-none border border-blue-500/25 bg-blue-500/[0.08] px-4 py-2.5 text-sm text-blue-300 transition hover:bg-blue-500/[0.12] disabled:opacity-60"
      >
        {storefrontBackfilling ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> : <Layers3 className="h-4 w-4" />}
        Нормалізувати
      </button>
      <Link
        href="/admin/shop/new"
        className="inline-flex items-center gap-2 rounded-none bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600"
      >
        <Plus className="h-4 w-4" />
        Новий товар
      </Link>
    </>
  );

  if (loading && products.length === 0) {
    return (
      <AdminPage wide className="space-y-6">
        <div role="status" aria-live="polite" aria-busy="true" className="space-y-6">
          <span className="sr-only">Завантаження каталогу…</span>
          <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
            <div className="space-y-3">
              <div className="h-3 w-20 motion-safe:animate-pulse rounded-none bg-white/[0.06]" />
              <div className="h-9 w-72 motion-safe:animate-pulse rounded-none bg-white/[0.06]" />
              <div className="h-3.5 w-96 motion-safe:animate-pulse rounded-none bg-white/[0.04]" />
            </div>
            <div className="h-9 w-44 motion-safe:animate-pulse rounded-none bg-white/[0.04]" />
          </div>
          <AdminSkeletonKpiGrid count={4} />
          <AdminSkeletonTable rows={10} cols={6} />
        </div>
      </AdminPage>
    );
  }

  const thumbSize = DENSITY_THUMB_SIZE[density];
  const rowPad = DENSITY_ROW_PADDING[density];

  return (
    <AdminPage wide className="space-y-6">
      {brandActive ? (
        <AdminBrandHero
          brand={brandParam}
          onClearBrand={() => updateParams({ brand: 'ALL' })}
          stats={[
            { label: 'Усього', value: metadata.totalCount, tone: 'accent' },
            { label: 'Активні', value: visibleStats.active, tone: 'success' },
            { label: 'Чернетки', value: visibleStats.draft, tone: 'warning' },
            { label: 'Архів', value: visibleStats.archived, tone: 'danger' },
            { label: 'Опубліковано', value: visibleStats.published, tone: 'default' },
          ]}
          actions={headerActions}
        />
      ) : (
        <AdminPageHeader
          eyebrow="Каталог"
          title="Товари"
          description="Основний каталог: відповідальність за товари, стан публікації, колекції, покриття медіа та швидкий доступ до редагування."
          actions={
            <>
              <AdminSavedViewsBar {...savedViews} />
              {headerActions}
            </>
          }
        />
      )}

      {brandActive ? (
        <div className="-mt-2">
          <AdminSavedViewsBar {...savedViews} />
        </div>
      ) : null}

      <AdminMetricGrid>
        <AdminMetricCard
          label="Знайдено товарів"
          value={metadata.totalCount}
          meta={brandActive ? `Бренд: ${brandTheme.displayName}` : 'Поточний фільтрований результат'}
          tone="accent"
          icon={<Layers3 />}
        />
        <AdminMetricCard
          label="Поточна сторінка"
          value={`${metadata.currentPage}/${metadata.totalPages}`}
          meta={`Розмір сторінки ${metadata.limit}`}
          icon={<Layers />}
        />
        <AdminMetricCard
          label="Видимі зараз"
          value={products.length}
          meta="Рядки в цьому перегляді"
          icon={<Eye />}
        />
        <AdminMetricCard
          label="Вибрано"
          value={selectedCount}
          meta={selectionLabel}
          tone={selectedCount > 0 ? 'accent' : 'default'}
          icon={<CheckSquare />}
        />
      </AdminMetricGrid>

      <AdminFilterChips
        chips={filterChips}
        onClearAll={
          filterChips.length > 1
            ? () => {
                setSearchInput('');
                updateParams({ brand: 'ALL', status: 'ALL', search: '' });
              }
            : undefined
        }
      />

      <AdminEntityToolbar>
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <select
            value={statusParam}
            onChange={(event) => updateParams({ status: event.target.value })}
            className="rounded-none border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-blue-500/30 focus:outline-none"
            aria-label="Фільтр за статусом"
          >
            <option value="ALL">Усі статуси</option>
            <option value="ACTIVE">Активні</option>
            <option value="DRAFT">Чернетки</option>
            <option value="ARCHIVED">Архів</option>
          </select>

          <select
            value={brandParam}
            onChange={(event) => updateParams({ brand: event.target.value })}
            className="rounded-none border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-zinc-100 focus:border-blue-500/30 focus:outline-none"
            aria-label="Фільтр за брендом"
          >
            <option value="ALL">Усі бренди</option>
            {commonBrands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>

          <label className="flex min-w-[280px] flex-1 items-center gap-2 rounded-none border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-zinc-100">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  updateParams({ search: searchInput });
                }
              }}
              placeholder="Пошук за slug, SKU, брендом або назвою — натисніть Enter"
              className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
            />
          </label>
        </div>

        <AdminDensityToggle value={density} onChange={setDensity} />
      </AdminEntityToolbar>

      {error ? <AdminInlineAlert tone="error">{error}</AdminInlineAlert> : null}
      {success ? <AdminInlineAlert tone="success">{success}</AdminInlineAlert> : null}

      {selectedCount > 0 ? (
        <AdminActionBar>
          <div className="space-y-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Панель масових дій</div>
            <div className="text-sm text-zinc-200">{selectionLabel}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={bulkUpdating}
              onClick={() => handleBulkStatus('ACTIVE')}
              className="rounded-none border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200 transition hover:bg-emerald-500/15 disabled:opacity-50"
            >
              {bulkUpdating ? 'Оновлення…' : 'Зробити активними'}
            </button>
            <button
              type="button"
              disabled={bulkUpdating}
              onClick={() => handleBulkStatus('DRAFT')}
              className="rounded-none border border-blue-500/25 bg-blue-500/[0.08] px-4 py-2.5 text-sm text-blue-300 transition hover:bg-blue-500/[0.12] disabled:opacity-50"
            >
              {bulkUpdating ? 'Оновлення…' : 'У чернетки'}
            </button>
            <button
              type="button"
              disabled={bulkUpdating}
              onClick={() => handleBulkStatus('ARCHIVED')}
              className="rounded-none border border-red-500/25 bg-red-950/30 px-4 py-2.5 text-sm text-red-200 transition hover:bg-red-950/45 disabled:opacity-50"
            >
              {bulkUpdating ? 'Оновлення…' : 'Архівувати'}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="rounded-none border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/[0.06]"
            >
              Очистити вибір
            </button>
          </div>
        </AdminActionBar>
      ) : null}

      {products.length === 0 ? (
        <AdminEmptyState
          title="Жоден товар не відповідає фільтрам"
          description="Спробуйте змінити фільтри, імпортувати CSV-партію або додати товар вручну, щоб заповнити каталог."
          action={
            <Link
              href="/admin/shop/new"
              className="inline-flex items-center gap-2 rounded-none bg-gradient-to-b from-blue-500 to-blue-700 px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(59,130,246,0.4)] transition hover:from-blue-400 hover:to-blue-600"
            >
              <Plus className="h-4 w-4" />
              Створити товар
            </Link>
          }
        />
      ) : (
        <>
          {/* Mobile card view */}
          <div className="space-y-2 lg:hidden">
            {products.map((product) => (
              <AdminMobileCard
                key={product.id}
                title={product.titleEn || product.titleUa}
                subtitle={[product.brand, product.sku, product.slug].filter(Boolean).join(' · ')}
                leading={
                  <AdminProductThumbnail
                    imageUrl={product.imageUrl}
                    brand={product.brand}
                    title={product.titleEn || product.titleUa}
                    size="sm"
                    tintHex={
                      product.brand === brandParam ? brandTheme.tintHex : undefined
                    }
                  />
                }
                badge={
                  <div className="flex flex-wrap gap-1">
                    <AdminStatusBadge tone={getStatusTone(product.status)}>{product.status}</AdminStatusBadge>
                  </div>
                }
                rows={[
                  { label: 'Ціна', value: priceLabel(product) },
                  { label: 'Варіантів', value: product.variantsCount },
                  { label: 'Залишок', value: product.stock },
                  { label: 'Публікація', value: product.isPublished ? 'Так' : 'Прихований' },
                ]}
                footer={
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setQuickViewId(product.id)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-none border border-blue-500/25 bg-blue-500/[0.08] px-3 py-2.5 text-xs font-medium uppercase tracking-wider text-blue-300"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Швидкий перегляд
                    </button>
                    <Link
                      href={`/admin/shop/${product.id}`}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-none border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-xs font-medium uppercase tracking-wider text-zinc-200"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Редагувати
                    </Link>
                  </div>
                }
              />
            ))}
          </div>

          {/* Desktop table */}
          <AdminTableShell className="hidden lg:block">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="sticky top-0 z-20 bg-[#171717]/95 backdrop-blur-md">
                <tr className="border-b border-white/10">
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === products.length && products.length > 0}
                      onChange={toggleSelectAll}
                      className="border-white/20 bg-black/40 text-emerald-500"
                      aria-label="Вибрати всі рядки"
                    />
                  </th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Товар</th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Тип</th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Статус</th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Покриття</th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Ціна</th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">Оновлено</th>
                  <th className="sticky right-0 z-10 w-[180px] bg-[#171717]/95 px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-zinc-500 whitespace-nowrap backdrop-blur-md">
                    Дії
                  </th>
                </tr>
              </thead>
                <tbody>
                  {products.map((product) => {
                    const time = relativeTime(product.updatedAt);
                    const isSelected = selectedIds.has(product.id);
                    return (
                      <tr
                        key={product.id}
                        className={cn(
                          'group border-b border-white/[0.04] align-top transition-colors',
                          isSelected ? 'bg-blue-500/[0.06]' : 'hover:bg-white/[0.025]'
                        )}
                      >
                        <td className={cn('px-4 align-middle', rowPad)}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(product.id)}
                            className="rounded-none border-white/20 bg-black/40 text-emerald-500"
                            aria-label={`Вибрати ${product.titleEn || product.titleUa}`}
                          />
                        </td>
                        <td className={cn('px-4', rowPad)}>
                          <button
                            type="button"
                            onClick={() => setQuickViewId(product.id)}
                            className="flex w-full items-start gap-3 text-left"
                          >
                            <AdminProductThumbnail
                              imageUrl={product.imageUrl}
                              brand={product.brand}
                              title={product.titleEn || product.titleUa}
                              size={thumbSize}
                              tintHex={
                                product.brand === brandParam ? brandTheme.tintHex : undefined
                              }
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium text-zinc-50 transition group-hover:text-blue-200">
                                {product.titleEn || product.titleUa}
                              </div>
                              <div className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">{product.slug}</div>
                              <div className="mt-1 truncate text-[11px] text-zinc-500">
                                {[product.brand, product.vendor, product.sku].filter(Boolean).join(' · ') || '—'}
                              </div>
                              {product.collectionHandles.length ? (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {product.collectionHandles.slice(0, 2).map((handle) => (
                                    <span
                                      key={handle}
                                      className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] text-zinc-400"
                                    >
                                      {handle}
                                    </span>
                                  ))}
                                  {product.collectionHandles.length > 2 ? (
                                    <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] text-zinc-500">
                                      +{product.collectionHandles.length - 2}
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </button>
                        </td>
                        <td className={cn('px-4 text-zinc-300', rowPad)}>{product.productType || product.scope}</td>
                        <td className={cn('px-4', rowPad)}>
                          <div className="flex flex-wrap gap-1.5">
                            <AdminStatusBadge tone={getStatusTone(product.status)}>{product.status}</AdminStatusBadge>
                            {!product.isPublished ? (
                              <AdminStatusBadge tone="warning">Прихований</AdminStatusBadge>
                            ) : null}
                          </div>
                        </td>
                        <td className={cn('px-4', rowPad)}>
                          <CoverageHealth
                            variants={product.variantsCount}
                            media={product.mediaCount}
                            collections={product.collectionsCount}
                          />
                        </td>
                        <td className={cn('px-4', rowPad)}>
                          <PriceCell product={product} />
                        </td>
                        <td className={cn('px-4 text-zinc-500', rowPad)} title={time.full}>
                          {time.label}
                        </td>
                        <td
                          className={cn(
                            'sticky right-0 z-10 px-4 whitespace-nowrap',
                            rowPad,
                            isSelected ? 'bg-[#0F1B33]' : 'bg-[#171717] group-hover:bg-[#1B1B1B]'
                          )}
                        >
                          <div className="flex items-center justify-end gap-1.5 opacity-80 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => setQuickViewId(product.id)}
                              data-action="quick-view"
                              className="rounded-none border border-blue-500/25 bg-blue-500/[0.08] p-2 text-blue-300 transition hover:border-blue-500/40 hover:bg-blue-500/[0.14]"
                              title="Швидкий перегляд (без переходу)"
                            >
                              <Eye className="h-4 w-4" aria-label="Швидкий перегляд" />
                            </button>
                            <Link
                              href={`/admin/shop/${product.id}`}
                              className="rounded-none border border-white/10 p-2 text-zinc-300 transition hover:bg-white/[0.06] hover:text-zinc-50"
                              title="Редагувати товар"
                            >
                              <Pencil className="h-4 w-4" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleArchive(product.id)}
                              disabled={deletingId === product.id}
                              className="rounded-none border border-amber-500/30 bg-amber-500/[0.06] p-2 text-amber-300 transition hover:border-amber-500/50 hover:bg-amber-500/[0.14] disabled:opacity-50"
                              title="Архівувати (м'яке видалення — можна відновити)"
                            >
                              <Trash2 className="h-4 w-4" aria-label="Архівувати" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          </AdminTableShell>
        </>
      )}

      <ProductQuickView
        productId={quickViewId}
        open={quickViewId !== null}
        onClose={() => setQuickViewId(null)}
      />

      <AdminPagination
        currentPage={metadata.currentPage}
        totalPages={metadata.totalPages}
        totalCount={metadata.totalCount}
        pageSize={metadata.limit}
        onPageChange={(page) => updateParams({ page })}
      />
    </AdminPage>
  );
}

export default function AdminShopPage() {
  return (
    <Suspense fallback={<AdminPage><div className="text-sm text-zinc-400">Завантаження каталогу…</div></AdminPage>}>
      <AdminShopPageContent />
    </Suspense>
  );
}
