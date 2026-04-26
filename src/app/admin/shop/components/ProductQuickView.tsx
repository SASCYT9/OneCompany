'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { ExternalLink, ImageOff, Package, Tag } from 'lucide-react';

import { AdminSlideOver } from '@/components/admin/AdminSlideOver';
import { AdminStatusBadge } from '@/components/admin/AdminPrimitives';

/**
 * Slide-over preview of a shop product. Loads detail on open.
 * Shows: image gallery, status, all currency prices (B2C + B2B), variants with stock,
 * collections, lead time, dimensions. Edit/Open buttons in footer.
 */

type ProductDetail = {
  id: string;
  slug: string;
  sku: string | null;
  brand: string | null;
  vendor: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  isPublished: boolean;
  titleEn: string;
  titleUa: string;
  productType: string | null;
  image: string | null;
  gallery: string[];
  priceEur: number | null;
  priceUsd: number | null;
  priceUah: number | null;
  priceEurB2b: number | null;
  priceUsdB2b: number | null;
  priceUahB2b: number | null;
  compareAtEur: number | null;
  stock: string;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  leadTimeEn: string | null;
  leadTimeUa: string | null;
  variants: Array<{
    id: string;
    title: string;
    sku: string | null;
    inventoryQty: number;
    priceEur: number | null;
    priceUsd: number | null;
    priceUah: number | null;
    isDefault: boolean;
  }>;
  collections: Array<{
    id: string;
    handle: string;
    titleEn: string;
  }>;
  media: Array<{ id: string; src: string; altText: string | null }>;
  createdAt: string;
  updatedAt: string;
};

export function ProductQuickView({
  productId,
  open,
  onClose,
}: {
  productId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    if (!open || !productId) {
      setDetail(null);
      setError('');
      setActiveImageIndex(0);
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/admin/shop/products/${productId}`, { cache: 'no-store' });
        const data = (await response.json().catch(() => ({}))) as ProductDetail & { error?: string };
        if (!response.ok) throw new Error(data.error || 'Failed to load product');
        if (!cancelled) {
          setDetail(data);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, productId]);

  const allImages = [detail?.image, ...(detail?.media?.map((m) => m.src) ?? []), ...(detail?.gallery ?? [])]
    .filter((src): src is string => Boolean(src))
    .filter((src, idx, arr) => arr.indexOf(src) === idx); // dedupe

  return (
    <AdminSlideOver
      open={open}
      onClose={onClose}
      width="lg"
      title={detail ? detail.titleEn || detail.titleUa : 'Товар'}
      subtitle={detail ? `${detail.brand ?? '—'} · ${detail.sku ?? detail.slug}` : undefined}
      footer={
        detail ? (
          <div className="flex items-center justify-between gap-3">
            <Link
              href={`/admin/shop/${detail.id}`}
              className="inline-flex items-center gap-1.5 rounded-none bg-blue-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:bg-blue-500"
              onClick={onClose}
            >
              Редагувати товар
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-none border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.06]"
            >
              Закрити
            </button>
          </div>
        ) : undefined
      }
    >
      {loading ? (
        <div className="space-y-4">
          <div className="aspect-video rounded-none border border-white/[0.05] bg-white/[0.03] motion-safe:animate-pulse" />
          <div className="h-3 w-32 rounded-none bg-white/[0.06] motion-safe:animate-pulse" />
          <div className="h-12 w-full rounded-none bg-white/[0.04] motion-safe:animate-pulse" />
          <div className="h-32 w-full rounded-none bg-white/[0.04] motion-safe:animate-pulse" />
        </div>
      ) : error ? (
        <div className="rounded-none border border-red-500/20 bg-red-500/[0.05] p-4 text-sm text-red-300">{error}</div>
      ) : detail ? (
        <div className="space-y-5">
          {/* Image gallery */}
          <section>
            {allImages.length > 0 ? (
              <div className="space-y-2">
                <div className="relative aspect-video overflow-hidden rounded-none border border-white/[0.05] bg-[#0F0F0F]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={allImages[activeImageIndex]}
                    alt={detail.titleEn || detail.titleUa}
                    className="h-full w-full object-contain"
                  />
                </div>
                {allImages.length > 1 ? (
                  <div className="flex gap-1.5 overflow-x-auto">
                    {allImages.map((src, idx) => (
                      <button
                        key={src}
                        type="button"
                        onClick={() => setActiveImageIndex(idx)}
                        className={`h-14 w-14 shrink-0 overflow-hidden rounded-none border bg-[#0F0F0F] transition ${
                          activeImageIndex === idx
                            ? 'border-blue-500/60 ring-2 ring-blue-500/20'
                            : 'border-white/[0.05] hover:border-white/20'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="h-full w-full object-contain" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-none border border-white/[0.05] bg-[#0F0F0F] text-zinc-600">
                <ImageOff className="h-10 w-10" aria-hidden="true" />
              </div>
            )}
          </section>

          {/* Status row */}
          <section className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge tone={detail.status === 'ACTIVE' ? 'success' : detail.status === 'ARCHIVED' ? 'danger' : 'warning'}>
              {detail.status}
            </AdminStatusBadge>
            <AdminStatusBadge tone={detail.isPublished ? 'success' : 'warning'}>
              {detail.isPublished ? 'Опубліковано' : 'Прихований'}
            </AdminStatusBadge>
            {detail.productType ? (
              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                {detail.productType}
              </span>
            ) : null}
            {detail.brand ? (
              <span className="rounded-full border border-blue-500/25 bg-blue-500/[0.08] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-300">
                {detail.brand}
              </span>
            ) : null}
          </section>

          {/* Pricing */}
          <section className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Ціни</div>
            <div className="grid grid-cols-3 gap-2">
              <PriceCell label="EUR" b2c={detail.priceEur} b2b={detail.priceEurB2b} symbol="€" />
              <PriceCell label="USD" b2c={detail.priceUsd} b2b={detail.priceUsdB2b} symbol="$" />
              <PriceCell label="UAH" b2c={detail.priceUah} b2b={detail.priceUahB2b} symbol="₴" />
            </div>
            {detail.compareAtEur != null ? (
              <div className="text-xs text-zinc-500">
                Стара ціна: <span className="text-zinc-300">€{detail.compareAtEur}</span>
              </div>
            ) : null}
          </section>

          {/* Variants */}
          {detail.variants.length > 0 ? (
            <section className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Варіанти · {detail.variants.length}
              </div>
              <div className="space-y-1.5">
                {detail.variants.slice(0, 6).map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between gap-3 rounded-none border border-white/[0.05] bg-[#171717] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-zinc-100">{v.title}</span>
                        {v.isDefault ? (
                          <span className="rounded-full bg-blue-500/15 px-1.5 py-0 text-[9px] font-bold uppercase text-blue-300">
                            основний
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">{v.sku ?? '—'}</div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={`tabular-nums ${
                          v.inventoryQty <= 0 ? 'text-red-400' : v.inventoryQty <= 5 ? 'text-amber-300' : 'text-emerald-300'
                        }`}
                      >
                        {v.inventoryQty} шт
                      </span>
                      {v.priceEur != null ? (
                        <span className="text-zinc-300">€{v.priceEur}</span>
                      ) : null}
                    </div>
                  </div>
                ))}
                {detail.variants.length > 6 ? (
                  <div className="px-3 py-1.5 text-xs text-zinc-500">
                    +{detail.variants.length - 6} ще варіантів…
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* Collections */}
          {detail.collections.length > 0 ? (
            <section className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Колекції</div>
              <div className="flex flex-wrap gap-1.5">
                {detail.collections.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 text-[11px] text-zinc-300"
                  >
                    <Tag className="h-2.5 w-2.5 text-zinc-500" aria-hidden="true" />
                    {c.titleEn || c.handle}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {/* Stock + Lead time */}
          <section className="grid grid-cols-2 gap-3">
            <div className="rounded-none border border-white/[0.05] bg-[#171717] p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Залишок</div>
              <div className="mt-1 flex items-center gap-2">
                <Package className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                <span className="text-sm font-medium text-zinc-100">{detail.stock || '—'}</span>
              </div>
            </div>
            <div className="rounded-none border border-white/[0.05] bg-[#171717] p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Термін поставки</div>
              <div className="mt-1 truncate text-sm font-medium text-zinc-100">
                {detail.leadTimeEn || detail.leadTimeUa || '—'}
              </div>
            </div>
          </section>

          {/* Dimensions */}
          {detail.weight != null || detail.length != null ? (
            <section className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Розміри</div>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <DimCell label="Вага" value={detail.weight != null ? `${detail.weight} г` : '—'} />
                <DimCell label="Довжина" value={detail.length != null ? `${detail.length} см` : '—'} />
                <DimCell label="Ширина" value={detail.width != null ? `${detail.width} см` : '—'} />
                <DimCell label="Висота" value={detail.height != null ? `${detail.height} см` : '—'} />
              </div>
            </section>
          ) : null}

          {/* Meta */}
          <section className="border-t border-white/[0.05] pt-3 text-xs text-zinc-500">
            <div>Оновлено {new Date(detail.updatedAt).toLocaleString('uk-UA')}</div>
            <div>Створено {new Date(detail.createdAt).toLocaleString('uk-UA')}</div>
          </section>
        </div>
      ) : null}
    </AdminSlideOver>
  );
}

function PriceCell({
  label,
  b2c,
  b2b,
  symbol,
}: {
  label: string;
  b2c: number | null;
  b2b: number | null;
  symbol: string;
}) {
  return (
    <div className="rounded-none border border-white/[0.05] bg-[#171717] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-base font-semibold tabular-nums text-zinc-50">
        {b2c != null ? `${symbol}${b2c}` : '—'}
      </div>
      {b2b != null ? (
        <div className="mt-0.5 text-[11px] text-blue-300">
          B2B {symbol}
          {b2b}
        </div>
      ) : null}
    </div>
  );
}

function DimCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-none border border-white/[0.05] bg-black/25 p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-0.5 truncate text-sm font-medium text-zinc-100">{value}</div>
    </div>
  );
}
