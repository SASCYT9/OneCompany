'use client';

import Image from 'next/image';
import Link from 'next/link';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { SupportedLocale } from '@/lib/seo';
import { getBrandLogo } from '@/lib/brandLogos';
import { getBrandMetadata, getLocalizedCountry } from '@/lib/brands';
import { SHOP_PRODUCTS, type ShopScope, type ShopMoneySet } from '@/lib/shopCatalog';
import { localizeShopText } from '@/lib/shopText';
import { ShopListingToolbar } from '@/components/shop/ShopListingToolbar';
import { AddToCartButton } from '@/components/shop/AddToCartButton';
import { useShopCurrency } from '@/components/shop/CurrencyContext';
import {
  buildFeaturedBrandComparator,
  buildShopListingResult,
  getShopProductCategoryLabel,
  normalizeShopListingQuery,
  type ShopListingQueryState,
} from '@/lib/shopListing';

type CatalogScope = 'all' | ShopScope;

type ShopPageClientProps = {
  locale: SupportedLocale;
  /** When 'urban', use dark theme to match Urban Home section */
  variant?: 'default' | 'urban';
};

function formatPrice(
  locale: SupportedLocale,
  amount: number,
  currency: 'EUR' | 'USD' | 'UAH',
) {
  const effectiveLocale = locale === 'ua' ? 'uk-UA' : 'en-US';
  const formattedAmount = new Intl.NumberFormat(effectiveLocale, {
    maximumFractionDigits: 0,
  }).format(amount);

  if (locale === 'ua') {
    if (currency === 'UAH') return `${formattedAmount} грн`;
  }

  return `${currency} ${formattedAmount}`;
}

function getScopeLabel(locale: SupportedLocale, scope: CatalogScope) {
  if (locale === 'ua') {
    if (scope === 'auto') return 'Авто';
    if (scope === 'moto') return 'Мото';
    return 'Усе';
  }

  if (scope === 'auto') return 'Auto';
  if (scope === 'moto') return 'Moto';
  return 'All';
}

function computePricesFromUah(price: ShopMoneySet, rates: { EUR: number; USD: number } | null) {
  const baseUah = price.uah;

  if (rates && baseUah > 0) {
    return {
      uah: baseUah,
      eur: baseUah / rates.EUR,
      usd: baseUah / rates.USD,
    };
  }

  return {
    uah: baseUah,
    eur: price.eur,
    usd: price.usd,
  };
}

export default function ShopPageClient({ locale, variant = 'default' }: ShopPageClientProps) {
  const isUa = locale === 'ua';
  const isUrban = variant === 'urban';
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currency, rates } = useShopCurrency();
  const [scope, setScope] = useState<CatalogScope>('all');
  const listingQuery = useMemo(() => normalizeShopListingQuery(searchParams), [searchParams]);
  const [queryDraft, setQueryDraft] = useState(listingQuery);
  const queryDraftRef = useRef(queryDraft);

  useEffect(() => {
    setQueryDraft(listingQuery);
  }, [listingQuery]);

  useEffect(() => {
    queryDraftRef.current = queryDraft;
  }, [queryDraft]);

  const scopedProducts = useMemo(() => {
    return SHOP_PRODUCTS.filter((product) => scope === 'all' || product.scope === scope);
  }, [scope]);

  const updateListingQuery = (updates: Partial<ShopListingQueryState>) => {
    const nextState = normalizeShopListingQuery({}, { ...queryDraftRef.current, ...updates });
    setQueryDraft(nextState);
    const next = new URLSearchParams();

    (Object.keys(nextState) as Array<keyof ShopListingQueryState>).forEach((key) => {
      const rawValue = nextState[key];
      const queryKey = key as string;

      if (
        rawValue == null ||
        rawValue === '' ||
        rawValue === 'all' ||
        (key === 'sort' && rawValue === 'featured')
      ) {
        next.delete(queryKey);
        return;
      }

      next.set(queryKey, String(rawValue));
    });

    const nextQuery = next.toString();
    startTransition(() => {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    });
  };

  const resetListingQuery = () => {
    setQueryDraft(normalizeShopListingQuery({}, {}));
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  };

  const listing = useMemo(
    () =>
      buildShopListingResult(scopedProducts, {
        locale,
        currency,
        rates: rates ? { EUR: rates.EUR, USD: rates.USD } : null,
        query: queryDraft,
        featuredComparator: buildFeaturedBrandComparator(),
      }),
    [currency, locale, queryDraft, rates, scopedProducts]
  );

  const brandCards = useMemo(() => {
    return listing.availableFilters.brands.map((brand) => ({
      name: brand.value,
      count: brand.count,
      image: scopedProducts.find((product) => product.brand === brand.value)?.image ?? '/branding/og-image.png',
    })).slice(0, 12);
  }, [listing.availableFilters.brands, scopedProducts]);

  const categoryCards = useMemo(() => {
    return listing.availableFilters.categories.map((category) => ({
      key: category.value,
      label: category.label,
      image:
        scopedProducts.find((product) => getShopProductCategoryLabel(product, locale) === category.label)?.image ??
        '/branding/og-image.png',
      count: category.count,
    }));
  }, [listing.availableFilters.categories, locale, scopedProducts]);

  const stats = useMemo(() => {
    return {
      products: scopedProducts.length,
      brands: new Set(scopedProducts.map((product) => product.brand)).size,
      categories: new Set(scopedProducts.map((product) => getShopProductCategoryLabel(product, locale))).size,
    };
  }, [locale, scopedProducts]);

  return (
    <div
      className={
        isUrban
          ? 'shop-catalog shop-catalog--urban relative min-h-screen overflow-hidden bg-[#0a0a0a] text-[#f5f5f3]'
          : 'relative min-h-screen overflow-hidden bg-[#f4f1eb] text-[#14120f]'
      }
    >
      {!isUrban && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-140px] top-[-160px] h-[460px] w-[460px] rounded-full bg-[#d2ccc1]/50 blur-3xl" />
          <div className="absolute bottom-[-180px] right-[-120px] h-[430px] w-[430px] rounded-full bg-[#d8c9b7]/40 blur-3xl" />
        </div>
      )}

      <main id="shop-catalog" className="relative mx-auto flex w-full max-w-[1320px] flex-col gap-14 px-4 pb-20 pt-28 sm:px-6 lg:px-10 lg:pt-32">
        {/* Page title */}
        <header className="relative">
          <p className="text-[11px] uppercase tracking-[0.32em] text-black/50">
            {isUa ? 'One Company' : 'One Company'}
          </p>
          <h1 className="mt-2 text-4xl font-light tracking-tight text-[#171511] sm:text-5xl">
            {isUa ? 'Магазин' : 'Shop'}
          </h1>
          <p className="mt-3 max-w-xl text-base text-black/65">
            {isUa
              ? 'Преміальні запчастини та тюнінг для авто та мото. Оберіть бренд, категорію та перегляньте товари.'
              : 'Premium parts and tuning for auto and moto. Choose a brand, category, and browse products.'}
          </p>
        </header>

        {/* Entry to Urban Automotive experience */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/80 px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur sm:px-5">
          <p className="text-sm text-black/70">
            {isUa ? 'Преміальні обвіси Urban Automotive на нашому сайті.' : 'Premium Urban Automotive body kits on our site.'}
          </p>
          <Link
            href={`/${locale}/shop/urban`}
            className="inline-flex items-center gap-2 rounded-full border border-black/20 bg-black px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-white transition hover:border-black hover:bg-[#222]"
          >
            {isUa ? 'Досвід Urban' : 'Urban experience'}
            <span aria-hidden>→</span>
          </Link>
        </div>

        <section
          className={
            isUrban
              ? 'rounded-2xl border border-white/10 bg-[#141414] p-4'
              : 'rounded-2xl border border-black/10 bg-white p-4 shadow-[0_12px_26px_rgba(0,0,0,0.06)]'
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2.5">
              {(['all', 'auto', 'moto'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setScope(item);
                    updateListingQuery({ brand: 'all', category: 'all' });
                  }}
                  className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] transition ${
                    isUrban
                      ? scope === item
                        ? 'border-white bg-white text-black'
                        : 'border-white/30 bg-white/10 text-white/90 hover:border-white/50 hover:bg-white/15'
                      : scope === item
                        ? 'border-black bg-black text-white'
                        : 'border-black/20 bg-white text-black/70 hover:border-black/35 hover:text-black'
                  }`}
                >
                  {getScopeLabel(locale, item)}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <p className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${
                isUrban ? 'border-white/25 bg-white/10 text-white/80' : 'border-black/15 bg-[#f8f6f2] text-black/65'
              }`}>
                {isUa ? `Товари: ${stats.products}` : `Products: ${stats.products}`}
              </p>
              <p className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${
                isUrban ? 'border-white/25 bg-white/10 text-white/80' : 'border-black/15 bg-[#f8f6f2] text-black/65'
              }`}>
                {isUa ? `Бренди: ${stats.brands}` : `Brands: ${stats.brands}`}
              </p>
              <p className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${
                isUrban ? 'border-white/25 bg-white/10 text-white/80' : 'border-black/15 bg-[#f8f6f2] text-black/65'
              }`}>
                {isUa ? `Категорії: ${stats.categories}` : `Categories: ${stats.categories}`}
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-black/45">{isUa ? 'Крок 1' : 'Step 1'}</p>
              <h2 className="mt-2 text-3xl font-light text-[#171511]">{isUa ? 'Обери бренд' : 'Select a brand'}</h2>
            </div>
            <button
              onClick={() => updateListingQuery({ brand: 'all' })}
              className="rounded-full border border-black/20 bg-white px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-black/70 transition hover:border-black/35 hover:text-black"
            >
              {isUa ? 'Показати всі' : 'Show all'}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <button
              onClick={() => updateListingQuery({ brand: 'all' })}
              className={`rounded-2xl border p-5 text-left transition ${
                queryDraft.brand === 'all'
                  ? 'border-black/80 bg-[#11110f] text-white'
                  : 'border-black/15 bg-white text-black hover:border-black/35'
              }`}
            >
              <p className="text-[11px] uppercase tracking-[0.28em] opacity-75">{isUa ? 'Усі бренди' : 'All brands'}</p>
              <p className="mt-3 text-2xl font-light">{brandCards.length}</p>
              <p className="mt-1 text-xs opacity-70">{isUa ? 'Доступні в каталозі' : 'Available in catalog'}</p>
            </button>

            {brandCards.map((brand) => (
              <button
                key={brand.name}
                onClick={() => updateListingQuery({ brand: brand.name })}
                className={`group relative overflow-hidden rounded-2xl border bg-white text-left transition ${
                  queryDraft.brand === brand.name
                    ? 'border-black/80 shadow-[0_14px_30px_rgba(0,0,0,0.13)]'
                    : 'border-black/15 hover:border-black/35 hover:shadow-[0_14px_30px_rgba(0,0,0,0.08)]'
                }`}
              >
                <div className="absolute inset-0 overflow-hidden rounded-2xl">
                  <Image
                    src={brand.image}
                    alt={brand.name}
                    fill
                    sizes="(max-width: 1280px) 50vw, 25vw"
                    className="object-cover opacity-22 transition duration-500 group-hover:scale-105 group-hover:opacity-30"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/80 to-white" />
                </div>

                <div className="relative flex h-full min-h-[170px] flex-col justify-between p-5">
                  <div className="inline-flex w-fit items-center rounded-full border border-black/20 bg-white/80 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-black/70">
                    {brand.count} {isUa ? 'товари' : 'items'}
                  </div>

                  <div>
                    <div className="mb-3 flex h-16 items-center justify-center rounded-xl border border-black/10 bg-white px-3 shadow-[0_10px_18px_rgba(0,0,0,0.1)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getBrandLogo(brand.name)} alt={brand.name} className="h-11 w-full object-contain" />
                    </div>
                    <p className="text-sm font-medium text-[#161410]">{brand.name}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-black/45">{isUa ? 'Крок 2' : 'Step 2'}</p>
              <h2 className="mt-2 text-3xl font-light text-[#171511]">{isUa ? 'Категорії та колекції' : 'Collections and categories'}</h2>
            </div>
            <button
              onClick={() => updateListingQuery({ category: 'all' })}
              className="rounded-full border border-black/20 bg-white px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-black/70 transition hover:border-black/35 hover:text-black"
            >
              {isUa ? 'Скинути категорію' : 'Reset category'}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button
              onClick={() => updateListingQuery({ category: 'all' })}
              className={`rounded-2xl border p-4 text-left transition ${
                queryDraft.category === 'all'
                  ? 'border-black/80 bg-[#11110f] text-white'
                  : 'border-black/15 bg-white text-black hover:border-black/35'
              }`}
            >
              <p className="text-[11px] uppercase tracking-[0.24em] opacity-75">{isUa ? 'Усі категорії' : 'All categories'}</p>
              <p className="mt-2 text-xl font-light">{categoryCards.length}</p>
            </button>

            {categoryCards.map((category) => (
              <button
                key={category.key}
                onClick={() => updateListingQuery({ category: category.key })}
                className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition ${
                  queryDraft.category === category.key
                    ? 'border-black/80 bg-white'
                    : 'border-black/15 bg-white hover:border-black/35'
                }`}
              >
                <div className="absolute inset-0">
                  <Image
                    src={category.image}
                    alt={category.label}
                    fill
                    sizes="(max-width: 1280px) 50vw, 25vw"
                    className="object-cover opacity-18 transition duration-500 group-hover:scale-105 group-hover:opacity-30"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/80 to-white" />
                </div>

                <div className="relative">
                  <p className="text-sm font-medium text-[#171511]">{category.label}</p>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-black/60">
                    {category.count} {isUa ? 'позицій' : 'products'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-black/45">{isUa ? 'Крок 3' : 'Step 3'}</p>
              <h2 className="mt-2 text-3xl font-light text-[#171511]">{isUa ? 'Товари каталогу' : 'Catalog products'}</h2>
            </div>
            <p className="rounded-full border border-black/20 bg-white px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-black/70">
              {listing.total} {isUa ? 'результатів' : 'results'}
            </p>
          </div>

          <ShopListingToolbar
            locale={locale}
            query={queryDraft}
            filters={listing.availableFilters}
            total={listing.total}
            onQueryChange={updateListingQuery}
            onReset={resetListingQuery}
            showBrand={false}
            showCategory={false}
          />

          {listing.products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/25 bg-white p-10 text-center text-black/60">
              {isUa
                ? 'За поточними фільтрами товари не знайдені. Спробуй змінити бренд або категорію.'
                : 'No products found with current filters. Try another brand or category.'}
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {listing.products.map((product) => {
                const productTitle = localizeShopText(locale, product.title, { kind: 'title' });
                const category = localizeShopText(locale, product.category, { kind: 'label' });
                const shortDescription = localizeShopText(locale, product.shortDescription, { kind: 'description' });
                const isInStock = product.stock === 'inStock';
                const brandMeta = getBrandMetadata(product.brand);
                const country = brandMeta ? getLocalizedCountry(brandMeta.country, locale) : null;

                return (
                  <Link
                    key={product.slug}
                    href={`/${locale}/shop/${product.slug}`}
                    className="group overflow-hidden rounded-[30px] border border-black/10 bg-white transition hover:-translate-y-0.5 hover:border-black/30 hover:shadow-[0_28px_50px_rgba(20,14,8,0.16)]"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden">
                      <Image
                        src={product.image}
                        alt={productTitle}
                        fill
                        sizes="(max-width: 1280px) 100vw, 33vw"
                        className="object-cover transition duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/65" />

                      <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-2">
                        <div className="rounded-full border border-white/45 bg-black/20 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white">
                          {category}
                        </div>
                        <div
                          className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] ${
                            isInStock
                              ? 'border-emerald-300/45 bg-emerald-400/20 text-emerald-100'
                              : 'border-amber-300/45 bg-amber-400/20 text-amber-100'
                          }`}
                        >
                          {isInStock ? (isUa ? 'В наявності' : 'In stock') : (isUa ? 'Під замовлення' : 'Pre-order')}
                        </div>
                      </div>

                      <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/30 bg-white/90 p-3 backdrop-blur">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-black/50">
                          {isUa ? 'Ціна від' : 'Price from'}
                        </p>
                        {(() => {
                          const computed = computePricesFromUah(
                            product.price,
                            rates && { EUR: rates.EUR, USD: rates.USD },
                          );

                          const primaryAmount =
                            currency === 'USD'
                              ? computed.usd
                              : currency === 'EUR'
                                ? computed.eur
                                : computed.uah;

                          return (
                            <>
                              <p className="mt-1 text-2xl font-light text-[#171511]">
                                {currency === 'USD' &&
                                  formatPrice(locale, primaryAmount, 'USD')}
                                {currency === 'EUR' &&
                                  formatPrice(locale, primaryAmount, 'EUR')}
                                {currency === 'UAH' &&
                                  formatPrice(locale, primaryAmount, 'UAH')}
                              </p>
                              <p className="text-xs text-black/55">
                                {formatPrice(locale, computed.usd, 'USD')} /{' '}
                                {formatPrice(locale, computed.eur, 'EUR')} /{' '}
                                {formatPrice(locale, computed.uah, 'UAH')}
                              </p>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="space-y-3 p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/15 bg-[#fbfaf8] p-1.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={getBrandLogo(product.brand)} alt={product.brand} className="h-full w-full object-contain" />
                        </div>
                        <p className="text-xs uppercase tracking-[0.18em] text-black/60">{product.brand}</p>
                      </div>

                      <h3 className="text-lg font-light leading-snug text-[#161410]">{productTitle}</h3>
                      <p className="line-clamp-2 text-sm leading-relaxed text-black/65">{shortDescription}</p>

                      <div className="flex flex-wrap gap-2">
                        {country ? (
                          <span className="rounded-full border border-black/15 bg-[#f8f6f2] px-3 py-1 text-[11px] text-black/65">
                            {country}
                          </span>
                        ) : null}
                        <span className="rounded-full border border-black/15 bg-[#f8f6f2] px-3 py-1 text-[11px] text-black/65">
                          {localizeShopText(locale, product.collection, { kind: 'label' })}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <AddToCartButton
                          slug={product.slug}
                          locale={locale}
                          variant="inline"
                          redirect={false}
                          productName={localizeShopText(locale, product.title, { kind: 'title' })}
                          className="rounded-full border border-black/20 bg-[#f8f6f2] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-black/80 hover:bg-black/10 transition"
                        />
                        <p className="text-xs uppercase tracking-[0.2em] text-black/50">
                          {isUa ? 'Детальніше' : 'View details'} →
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
