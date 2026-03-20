'use client';

import { useEffect, useState } from 'react';
import type { ShopListingQueryState, ShopListingResult } from '@/lib/shopListing';

type ShopListingToolbarProps = {
  locale: 'ua' | 'en';
  query: ShopListingQueryState;
  filters: ShopListingResult['availableFilters'];
  total: number;
  onQueryChange: (updates: Partial<ShopListingQueryState>) => void;
  onReset: () => void;
  theme?: 'light' | 'dark';
  showBrand?: boolean;
  showCategory?: boolean;
  showSearch?: boolean;
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function withCount(label: string, count: number) {
  return `${label} (${count})`;
}

export function ShopListingToolbar({
  locale,
  query,
  filters,
  total,
  onQueryChange,
  onReset,
  theme = 'light',
  showBrand = true,
  showCategory = true,
  showSearch = true,
}: ShopListingToolbarProps) {
  const isUa = locale === 'ua';
  const isDark = theme === 'dark';
  const [draftPriceMin, setDraftPriceMin] = useState(query.priceMin != null ? String(query.priceMin) : '');
  const [draftPriceMax, setDraftPriceMax] = useState(query.priceMax != null ? String(query.priceMax) : '');

  useEffect(() => {
    setDraftPriceMin(query.priceMin != null ? String(query.priceMin) : '');
    setDraftPriceMax(query.priceMax != null ? String(query.priceMax) : '');
  }, [query.priceMin, query.priceMax]);

  const shellClassName = isDark
    ? 'border-white/12 bg-white/6 text-white'
    : 'border-black/10 bg-white text-black';
  const fieldClassName = isDark
    ? 'border-white/12 bg-black/35 text-white placeholder:text-white/40 focus:border-white/40'
    : 'border-black/15 bg-[#fbfaf8] text-black placeholder:text-black/45 focus:border-black/35';
  const mutedClassName = isDark ? 'text-white/60' : 'text-black/60';
  const badgeClassName = isDark
    ? 'border-white/15 bg-white/10 text-white/80'
    : 'border-black/15 bg-[#f8f6f2] text-black/70';
  const buttonClassName = isDark
    ? 'border-white/20 bg-white/8 text-white/85 hover:border-white/40 hover:bg-white/12'
    : 'border-black/15 bg-white text-black/75 hover:border-black/30 hover:text-black';

  const brandOptions = showBrand ? filters.brands : [];
  const categoryOptions = showCategory ? filters.categories : [];
  const applyPriceRange = () => {
    onQueryChange({
      priceMin: draftPriceMin ? Number(draftPriceMin) : null,
      priceMax: draftPriceMax ? Number(draftPriceMax) : null,
    });
  };

  return (
    <div className={cx('rounded-2xl border p-4 shadow-[0_12px_26px_rgba(0,0,0,0.06)]', shellClassName)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={cx('text-[11px] uppercase tracking-[0.22em]', mutedClassName)}>
            {isUa ? 'Фільтри та сортування' : 'Filters and sorting'}
          </p>
          <p className={cx('mt-1 text-sm', mutedClassName)}>
            {isUa ? `Результатів: ${total}` : `Results: ${total}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={cx('rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em]', badgeClassName)}>
            {isUa ? `Від ${filters.priceRange.min ?? 0}` : `From ${filters.priceRange.min ?? 0}`}
          </span>
          <span className={cx('rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em]', badgeClassName)}>
            {isUa ? `До ${filters.priceRange.max ?? 0}` : `Up to ${filters.priceRange.max ?? 0}`}
          </span>
          <button
            type="button"
            onClick={onReset}
            className={cx(
              'rounded-full border px-4 py-2 text-[11px] uppercase tracking-[0.2em] transition',
              buttonClassName
            )}
          >
            {isUa ? 'Скинути' : 'Reset'}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {showSearch ? (
          <label className="relative xl:col-span-2">
            <span className={cx('pointer-events-none absolute left-3 top-1/2 -translate-y-1/2', mutedClassName)} aria-hidden>
              ⌕
            </span>
            <input
              type="search"
              value={query.q}
              onChange={(event) => onQueryChange({ q: event.target.value })}
              placeholder={isUa ? 'Пошук по товарах' : 'Search products'}
              className={cx(
                'w-full rounded-xl border py-3 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-white/10',
                fieldClassName
              )}
            />
          </label>
        ) : null}

        {brandOptions.length > 1 ? (
          <select
            value={query.brand}
            onChange={(event) => onQueryChange({ brand: event.target.value })}
            className={cx('w-full rounded-xl border px-3 py-3 text-sm outline-none', fieldClassName)}
          >
            <option value="all">{isUa ? 'Усі бренди' : 'All brands'}</option>
            {brandOptions.map((brand) => (
              <option key={brand.value} value={brand.value}>
                {withCount(brand.label, brand.count)}
              </option>
            ))}
          </select>
        ) : null}

        {categoryOptions.length > 1 ? (
          <select
            value={query.category}
            onChange={(event) => onQueryChange({ category: event.target.value })}
            className={cx('w-full rounded-xl border px-3 py-3 text-sm outline-none', fieldClassName)}
          >
            <option value="all">{isUa ? 'Усі категорії' : 'All categories'}</option>
            {categoryOptions.map((category) => (
              <option key={category.value} value={category.value}>
                {withCount(category.label, category.count)}
              </option>
            ))}
          </select>
        ) : null}

        <select
          value={query.availability}
          onChange={(event) => onQueryChange({ availability: event.target.value as ShopListingQueryState['availability'] })}
          className={cx('w-full rounded-xl border px-3 py-3 text-sm outline-none', fieldClassName)}
        >
          <option value="all">{isUa ? 'Будь-яка наявність' : 'Any availability'}</option>
          <option value="inStock">{isUa ? 'Лише в наявності' : 'In stock only'}</option>
          <option value="preOrder">{isUa ? 'Лише під замовлення' : 'Pre-order only'}</option>
        </select>

        <select
          value={query.sort}
          onChange={(event) => onQueryChange({ sort: event.target.value as ShopListingQueryState['sort'] })}
          className={cx('w-full rounded-xl border px-3 py-3 text-sm outline-none', fieldClassName)}
        >
          <option value="featured">{isUa ? 'Рекомендовані' : 'Featured'}</option>
          <option value="newest">{isUa ? 'Найновіші' : 'Newest'}</option>
          <option value="priceLow">{isUa ? 'Ціна: від меншої' : 'Price: low to high'}</option>
          <option value="priceHigh">{isUa ? 'Ціна: від більшої' : 'Price: high to low'}</option>
        </select>

        <div className="grid grid-cols-[1fr_1fr_auto] gap-3">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={draftPriceMin}
            onChange={(event) => setDraftPriceMin(event.target.value)}
            placeholder={isUa ? 'Ціна від' : 'Min price'}
            className={cx('w-full rounded-xl border px-3 py-3 text-sm outline-none', fieldClassName)}
          />
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={draftPriceMax}
            onChange={(event) => setDraftPriceMax(event.target.value)}
            placeholder={isUa ? 'Ціна до' : 'Max price'}
            className={cx('w-full rounded-xl border px-3 py-3 text-sm outline-none', fieldClassName)}
          />
          <button
            type="button"
            onClick={applyPriceRange}
            className={cx(
              'rounded-xl border px-4 py-3 text-[11px] uppercase tracking-[0.2em] transition',
              buttonClassName
            )}
          >
            {isUa ? 'Застосувати' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}
