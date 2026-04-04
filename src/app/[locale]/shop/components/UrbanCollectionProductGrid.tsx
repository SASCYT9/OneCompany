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
import type { ShopViewerPricingContext } from '@/lib/shopPricingAudience';
import { resolveShopProductPricing } from '@/lib/shopPricingAudience';
import type { UrbanProductGridConfig } from '../data/urbanCollectionPages';

type UrbanCollectionProductGridProps = {
  locale: SupportedLocale;
  handle: string;
  title: string;
  brand: string;
  products: ShopProduct[];
  settings: UrbanProductGridConfig;
  viewerContext?: ShopViewerPricingContext;
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
  rates: { EUR: number; USD: number; UAH?: number } | null,
) {
  const baseUah = price.uah;
  const baseEur = price.eur;
  const baseUsd = price.usd;
  const eurToUah = rates?.UAH ?? (rates?.EUR ? rates.EUR : 0);

  // EUR-origin products
  if (baseEur > 0 && baseUah === 0 && rates) {
    const usdRate = rates.USD || 1;
    return {
      eur: baseEur,
      uah: Math.round(baseEur * eurToUah),
      usd: Math.round(baseEur * usdRate),
    };
  }

  // USD-origin products
  if (baseUsd > 0 && baseUah === 0 && baseEur === 0 && rates) {
    const usdToUah = eurToUah / (rates.USD || 1);
    return {
      usd: baseUsd,
      uah: Math.round(baseUsd * usdToUah),
      eur: Math.round(baseUsd / (rates.USD || 1)),
    };
  }

  // UAH-origin products
  if (rates && baseUah > 0) {
    return {
      uah: baseUah,
      eur: Math.round(baseUah / eurToUah),
      usd: Math.round((baseUah / eurToUah) * (rates.USD || 1)),
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
  viewerContext,
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
              const pricing = viewerContext
                ? resolveShopProductPricing(product, viewerContext)
                : { effectivePrice: product.price, effectiveCompareAt: product.compareAt, audience: 'b2c', b2bVisible: false };
              
              const isB2B = pricing.audience === 'b2b' && (pricing as any).b2bVisible;

              const computed = computePricesFromUah(
                pricing.effectivePrice,
                rates && { EUR: rates.EUR, USD: rates.USD, UAH: rates.UAH },
              );

              const computedCompare = pricing.effectiveCompareAt
                ? computePricesFromUah(pricing.effectiveCompareAt, rates && { EUR: rates.EUR, USD: rates.USD, UAH: rates.UAH })
                : null;
              const productTitle = localizeShopProductTitle(locale, product);
              const productCollection = localizeShopText(locale, product.collection);
              
              const rawImg = product.image ? product.image.replace(/^["']|["']$/g, '').trim() : '';
              const safeImageUrl = rawImg.startsWith('//') 
                ? `https:${rawImg}` 
                : (rawImg || '/images/placeholders/product-fallback.jpg');

              return (
              <article key={product.slug} className="urban-product-grid__card">
                <Link
                  href={buildShopProductPath(locale, product)}
                  className="urban-product-grid__card-link"
                  aria-label={productTitle}
                />
                <div className="urban-product-grid__media">
                  <Image
                    src={safeImageUrl}
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
                      redirect={true}
                      variant="inline"
                      productName={productTitle}
                      className="urban-product-grid__add"
                      label={isUa ? 'Додати в кошик' : 'Add to cart'}
                      labelAdded={isUa ? 'Додано' : 'Added'}
                    />
                    <div className="urban-product-grid__price-stack flex flex-col items-end gap-1">
                      {isB2B && computedCompare ? (
                        <span className="urban-product-grid__price-retail text-[10px] text-white/40 line-through">
                          {currency === 'USD' && formatPrice(locale, computedCompare.usd, 'USD')}
                          {currency === 'EUR' && formatPrice(locale, computedCompare.eur, 'EUR')}
                          {currency === 'UAH' && formatPrice(locale, computedCompare.uah, 'UAH')}
                        </span>
                      ) : null}
                      <span className={`urban-product-grid__price ${isB2B ? 'text-emerald-400 font-medium' : ''}`}>
                        {currency === 'USD' && formatPrice(locale, computed.usd, 'USD')}
                        {currency === 'EUR' && formatPrice(locale, computed.eur, 'EUR')}
                        {currency === 'UAH' && formatPrice(locale, computed.uah, 'UAH')}
                      </span>
                    </div>
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
