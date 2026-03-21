"use client";

import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AddToCartButton } from '@/components/shop/AddToCartButton';
import { useShopCurrency } from '@/components/shop/CurrencyContext';
import type { SupportedLocale } from '@/lib/seo';
import type { ShopProduct } from '@/lib/shopCatalog';
import { localizeShopProductTitle, localizeShopText } from '@/lib/shopText';
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
  const { currency, rates } = useShopCurrency();

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
              {products.length > 0
                ? isUa
                  ? `Підібрані позиції для колекції ${title}.`
                  : `Curated parts currently mapped to the ${title} collection.`
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
          <div className="urban-product-grid__cards">
            {products.map((product) => {
              const computed = computePricesFromUah(
                product.price,
                rates && { EUR: rates.EUR, USD: rates.USD },
              );
              const productTitle = localizeShopProductTitle(locale, product);
              const productCollection = localizeShopText(locale, product.collection);

              return (
              <article key={product.slug} className="urban-product-grid__card">
                <Link
                  href={buildShopProductPath(locale, product)}
                  className="urban-product-grid__card-link"
                  aria-label={productTitle}
                />
                <div className="urban-product-grid__media">
                  <Image
                    src={product.image}
                    alt={productTitle}
                    fill
                    sizes="(max-width: 768px) 100vw, 25vw"
                    className="object-cover"
                  />
                </div>
                <div className="urban-product-grid__body">
                  <p className="urban-product-grid__brand">{product.brand}</p>
                  <h3 className="urban-product-grid__name">
                    {productTitle}
                  </h3>
                  <div className="urban-product-grid__meta">
                    <span>{productCollection}</span>
                  </div>
                  <div className="urban-product-grid__actions">
                    <AddToCartButton
                      slug={product.slug}
                      locale={locale}
                      redirect={false}
                      variant="inline"
                      productName={productTitle}
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
