"use client";

import { startTransition, type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AddToCartButton } from '@/components/shop/AddToCartButton';
import { useShopCurrency } from '@/components/shop/CurrencyContext';
import { ShopListingToolbar } from '@/components/shop/ShopListingToolbar';
import type { SupportedLocale } from '@/lib/seo';
import type { ShopProduct } from '@/lib/shopCatalog';
import { buildShopListingResult, normalizeShopListingQuery, type ShopListingQueryState } from '@/lib/shopListing';
import { localizeShopText } from '@/lib/shopText';
import { buildShopProductPath } from '@/lib/urbanCollectionMatcher';
import type { UrbanProductGridConfig } from '../data/urbanCollectionPages';

type UrbanCollectionProductGridProps = {
  locale: SupportedLocale;
  handle: string;
  title: string;
  brand: string;
  products: ShopProduct[];
  settings: UrbanProductGridConfig;
};

function buildPremiumDescription(locale: SupportedLocale, title: { ua: string; en: string }, short: { ua: string; en: string }, long: { ua: string; en: string }) {
  const t = localizeShopText(locale, title, { kind: 'title' }).trim();
  const s = localizeShopText(locale, short, { kind: 'description' }).trim();
  const l = localizeShopText(locale, long, { kind: 'description' }).trim();

  const sNormalized = s.toLowerCase();
  const tNormalized = t.toLowerCase();

  // Якщо короткий опис дублює заголовок — беремо longDescription
  if (!s || sNormalized === tNormalized || sNormalized.startsWith(tNormalized)) {
    return l;
  }

  return s;
}

function formatPrice(locale: SupportedLocale, amount: number, currency: 'EUR' | 'USD' | 'UAH') {
  const formatter = new Intl.NumberFormat(locale === 'ua' ? 'uk-UA' : 'en-US', {
    maximumFractionDigits: 0,
  });

  const formatted = formatter.format(amount);
  if (locale === 'ua' && currency === 'UAH') {
    return `${formatted} грн`;
  }
  return locale === 'ua' ? `${formatted} ${currency}` : `${currency} ${formatted}`;
}

function computePricesFromUah(
  price: ShopProduct['price'],
  rates: { EUR: number; USD: number } | null,
) {
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

export default function UrbanCollectionProductGrid({
  locale,
  handle,
  title,
  brand,
  products,
  settings,
}: UrbanCollectionProductGridProps) {
  const isUa = locale === 'ua';
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currency, rates } = useShopCurrency();
  const listingQuery = useMemo(
    () => normalizeShopListingQuery(searchParams, { store: 'urban', collection: handle }),
    [handle, searchParams]
  );
  const [queryDraft, setQueryDraft] = useState(listingQuery);
  const queryDraftRef = useRef(queryDraft);

  useEffect(() => {
    setQueryDraft(listingQuery);
  }, [listingQuery]);

  useEffect(() => {
    queryDraftRef.current = queryDraft;
  }, [queryDraft]);

  const listing = useMemo(
    () =>
      buildShopListingResult(products, {
        locale,
        currency,
        rates: rates ? { EUR: rates.EUR, USD: rates.USD } : null,
        query: queryDraft,
      }),
    [currency, locale, products, queryDraft, rates]
  );

  const updateListingQuery = (updates: Partial<ShopListingQueryState>) => {
    const nextState = normalizeShopListingQuery({}, {
      ...queryDraftRef.current,
      ...updates,
      store: 'urban',
      collection: handle,
    });
    setQueryDraft(nextState);
    const next = new URLSearchParams();

    (Object.keys(nextState) as Array<keyof ShopListingQueryState>).forEach((key) => {
      const rawValue = nextState[key];
      const queryKey = key as string;

      if (
        rawValue == null ||
        rawValue === '' ||
        rawValue === 'all' ||
        rawValue === handle ||
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
    setQueryDraft(normalizeShopListingQuery({}, { store: 'urban', collection: handle }));
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  };

  return (
    <section
      className="urban-product-grid"
      style={
        {
          '--upg-padding-top': `${settings.paddingTop}px`,
          '--upg-padding-bottom': `${settings.paddingBottom}px`,
          '--upg-mobile-cols': settings.columnsMobile,
          // Фіксуємо 3 колонки в ряд для десктопа, незалежно від налаштувань теми
          '--upg-desktop-cols': 3,
        } as CSSProperties
      }
    >
      <div className="urban-product-grid__inner">
        <div className="urban-product-grid__head">
          <div>
            <p className="urban-product-grid__eyebrow">
              {brand || 'Urban Automotive'}
            </p>
            <h2 className="urban-product-grid__title">
              {isUa ? `Товари для ${title}` : `${title} Products`}
            </h2>
            <p className="urban-product-grid__sub">
              {listing.total > 0
                ? isUa
                  ? `Підібрані позиції для ${title}. Знайдено ${listing.total} результатів за поточними фільтрами.`
                  : `Curated parts mapped to ${title}. ${listing.total} results match the active filters.`
                : isUa
                  ? 'Найближчим часом колекція буде доступна в каталозі.'
                  : 'This collection will be available in the catalog shortly.'}
            </p>
          </div>
          <Link
            href={`/${locale}/shop/urban/collections`}
            className="urban-product-grid__all-link"
          >
            {isUa ? 'Усі колекції' : 'All collections'}
          </Link>
        </div>

        {products.length > 0 ? (
          <>
            <div className="urban-product-grid__toolbar">
              <ShopListingToolbar
                locale={locale}
                query={queryDraft}
                filters={listing.availableFilters}
                total={listing.total}
                onQueryChange={updateListingQuery}
                onReset={resetListingQuery}
                theme="dark"
                showSearch
                showBrand={settings.enableFiltering}
                showCategory={settings.enableFiltering}
              />
            </div>
          {listing.products.length > 0 ? (
            <div className="urban-product-grid__cards">
              {listing.products.map((product, index) => {
              const premiumDescription = buildPremiumDescription(
                locale,
                product.title,
                product.shortDescription,
                product.longDescription,
              );
              const computed = computePricesFromUah(
                product.price,
                rates && { EUR: rates.EUR, USD: rates.USD },
              );

              return (
              <article key={product.slug} className="urban-product-grid__card">
                <Link
                  href={buildShopProductPath(locale, product)}
                  className="urban-product-grid__card-link"
                  aria-label={localizeShopText(locale, product.title, { kind: 'title' })}
                />
                <div className="urban-product-grid__media">
                  <Image
                    src={product.image}
                    alt={localizeShopText(locale, product.title, { kind: 'title' })}
                    fill
                    sizes="(max-width: 479px) 100vw, (max-width: 768px) 50vw, 25vw"
                    className="object-cover"
                    priority={index === 0}
                  />
                </div>
                <div className="urban-product-grid__body">
                  <p className="urban-product-grid__brand">{product.brand}</p>
                  <h3 className="urban-product-grid__name">
                    {localizeShopText(locale, product.title, { kind: 'title' })}
                  </h3>
                  <p className="urban-product-grid__description">
                    {premiumDescription}
                  </p>
                  <div className="urban-product-grid__meta">
                    <span>{localizeShopText(locale, product.collection, { kind: 'label' })}</span>
                  </div>
                  <div className="urban-product-grid__actions">
                    <AddToCartButton
                      slug={product.slug}
                      locale={locale}
                      redirect={false}
                      variant="inline"
                      productName={localizeShopText(locale, product.title, { kind: 'title' })}
                      className="urban-product-grid__add"
                      label={isUa ? 'Додати в кошик' : 'Add to cart'}
                      labelAdded={isUa ? 'Додано' : 'Added'}
                    />
                    <span className="urban-product-grid__price">
                      {currency === 'USD' &&
                        formatPrice(locale, computed.usd, 'USD')}
                      {currency === 'EUR' &&
                        formatPrice(locale, computed.eur, 'EUR')}
                      {currency === 'UAH' &&
                        formatPrice(locale, computed.uah, 'UAH')}
                    </span>
                    <Link
                      href={buildShopProductPath(locale, product)}
                      className="urban-product-grid__details"
                    >
                      {isUa ? 'Деталі' : 'Details'}
                    </Link>
                  </div>
                </div>
              </article>
            );
})}
            </div>
          ) : (
            <div className="urban-product-grid__empty">
              <p className="urban-product-grid__empty-title">
                {isUa ? 'За поточними фільтрами нічого не знайдено' : 'No products match these filters'}
              </p>
              <p className="urban-product-grid__empty-copy">
                {isUa
                  ? 'Спробуйте змінити діапазон цін, доступність або скинути фільтри.'
                  : 'Try adjusting the price range, availability, or reset the active filters.'}
              </p>
              <button type="button" onClick={resetListingQuery} className="urban-product-grid__empty-cta">
                {isUa ? 'Скинути фільтри' : 'Reset filters'}
              </button>
            </div>
          )}
          </>
        ) : (
          <div className="urban-product-grid__empty">
            <p className="urban-product-grid__empty-title">
              {isUa ? 'Колекція незабаром у каталозі' : 'Collection coming to the catalog'}
            </p>
            <p className="urban-product-grid__empty-copy">
              {isUa
                ? `Ми завершуємо формування асортименту для ${title}. Залиште запит, і менеджер підбере комплект під ваш автомобіль.`
                : `We are finalizing the assortment for ${title}. Leave a request and our team will curate a package for your car.`}
            </p>
            <Link href={`/${locale}/#contact`} className="urban-product-grid__empty-cta">
              {isUa ? 'Запитати комплект' : 'Request a package'}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
