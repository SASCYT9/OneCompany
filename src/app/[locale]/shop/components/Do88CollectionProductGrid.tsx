"use client";

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useState } from 'react';
import { AddToCartButton } from '@/components/shop/AddToCartButton';
import { ShopProductImage } from '@/components/shop/ShopProductImage';
import { useShopCurrency } from '@/components/shop/CurrencyContext';
import type { SupportedLocale } from '@/lib/seo';
import type { ShopProduct } from '@/lib/shopCatalog';
import { localizeShopProductTitle, localizeShopText } from '@/lib/shopText';
import { buildShopProductPath } from '@/lib/urbanCollectionMatcher';
import type { ShopViewerPricingContext } from '@/lib/shopPricingAudience';
import { resolveShopProductPricing } from '@/lib/shopPricingAudience';

type Do88CollectionProductGridProps = {
  locale: SupportedLocale;
  handle: string;
  title: string;
  titleUk?: string;
  products: ShopProduct[];
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

function computePrices(
  price: ShopProduct['price'],
  rates: { UAH: number; EUR: number; USD: number } | null,
) {
  if (price.uah > 0) {
    return {
      uah: price.uah,
      eur: rates ? price.uah / rates.UAH : price.eur,
      usd: rates ? (price.uah / rates.UAH) * rates.USD : price.usd,
    };
  }
  if (price.eur > 0) {
    return {
       eur: price.eur,
       uah: rates ? price.eur * rates.UAH : price.uah,
       usd: rates ? price.eur * rates.USD : price.usd,
    };
  }
  return {
    uah: price.uah,
    eur: price.eur,
    usd: price.usd,
  };
}

export default function Do88CollectionProductGrid({
  locale,
  handle,
  title,
  titleUk,
  products,
  viewerContext,
}: Do88CollectionProductGridProps) {
  const isUa = locale === 'ua';
  const displayTitle = isUa && titleUk ? titleUk : title;
  const { currency, rates } = useShopCurrency();
  const [sortOrder, setSortOrder] = useState<'price-desc' | 'price-asc' | 'title-asc' | 'title-desc'>('price-desc');

  const sortedProducts = [...products].sort((a, b) => {
    switch (sortOrder) {
      case 'price-asc': return (a.price?.eur || 0) - (b.price?.eur || 0);
      case 'price-desc': return (b.price?.eur || 0) - (a.price?.eur || 0);
      case 'title-asc': return a.title.en.localeCompare(b.title.en);
      case 'title-desc': return b.title.en.localeCompare(a.title.en);
      default: return 0;
    }
  });

  return (
    <section
      className="urban-product-grid"
      style={
        {
          '--upg-padding-top': `0px`,
          '--upg-padding-bottom': `0px`,
          '--upg-mobile-cols': 1,
          '--upg-desktop-cols': 3,
          background: 'none'
        } as CSSProperties
      }
    >
      <div className="w-full">
        <div className="urban-product-grid__head flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="urban-product-grid__eyebrow text-white/50 tracking-[0.2em] uppercase text-[10px] mb-2">
              DO88 Performance
            </p>
            <h2 className="urban-product-grid__title text-3xl md:text-5xl font-light uppercase tracking-tight mb-4">
              {displayTitle}
            </h2>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
            {products.length > 0 && (
              <div className="relative w-full sm:w-auto">
                <select 
                  value={sortOrder} 
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="w-full sm:w-auto appearance-none bg-black/40 border border-white/20 text-white py-3 pl-5 pr-12 rounded-full text-[11px] uppercase tracking-widest focus:outline-none focus:border-white/50 cursor-pointer backdrop-blur-md transition shadow-inner"
                >
                  <option value="price-desc" className="text-black bg-white">{isUa ? 'Ціна: від дорогих до дешевих' : 'Price: High to Low'}</option>
                  <option value="price-asc" className="text-black bg-white">{isUa ? 'Ціна: від дешевих до дорогих' : 'Price: Low to High'}</option>
                  <option value="title-asc" className="text-black bg-white">{isUa ? 'Назва: А-Я' : 'Name: A-Z'}</option>
                  <option value="title-desc" className="text-black bg-white">{isUa ? 'Назва: Я-А' : 'Name: Z-A'}</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/50">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                </div>
              </div>
            )}
            
            <Link
              href={`/${locale}/shop/do88/collections`}
              className="urban-product-grid__all-link text-white/50 hover:text-white uppercase tracking-[0.2em] text-[10px] whitespace-nowrap hidden sm:block transition"
            >
              {isUa ? '← Всі категорії' : '← All categories'}
            </Link>
          </div>
        </div>

        {products.length > 0 ? (
          <div className="urban-product-grid__cards mt-12">
            {sortedProducts.map((product) => {
              const pricing = viewerContext
                ? resolveShopProductPricing(product, viewerContext)
                : { effectivePrice: product.price, effectiveCompareAt: product.compareAt, audience: 'b2c', b2bVisible: false };
              
              const isB2B = pricing.audience === 'b2b' && (pricing as any).b2bVisible;

              const computed = computePrices(
                pricing.effectivePrice,
                rates
              );

              const computedCompare = pricing.effectiveCompareAt
                ? computePrices(pricing.effectiveCompareAt, rates)
                : null;
              
              const productTitle = localizeShopProductTitle(locale, product);
              const productCollection = localizeShopText(locale, product.collection);

              return (
              <article key={product.slug} className="urban-product-grid__card group">
                <Link
                  href={buildShopProductPath(locale, product)}
                  className="urban-product-grid__card-link"
                  aria-label={productTitle}
                />
                <div className="urban-product-grid__media">
                  {product.image && product.image.trim().length > 0 ? (
                    <ShopProductImage
                      src={product.image.trim()}
                      alt={productTitle}
                      fill
                      sizes="(max-width: 768px) 100vw, 25vw"
                      className="object-cover transition duration-700 group-hover:scale-105 group-hover:opacity-90"
                    />
                  ) : (
                    <div className="flex w-full h-full items-center justify-center text-white/20">
                      <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="urban-product-grid__body p-6">
                  <p className="urban-product-grid__brand text-white/40 text-[9px] uppercase tracking-[0.3em] mb-2">{product.brand}</p>
                  <h3 className="urban-product-grid__name font-light text-xl mb-4 text-white/90">
                    {productTitle}
                  </h3>
                  <div className="urban-product-grid__meta">
                    <p className="urban-product-grid__collection">
                      {productCollection || title}
                    </p>
                    <div className="urban-product-grid__price">
                      {isB2B && computedCompare && (
                        <span className="urban-product-grid__compare-at line-through text-white/30 mr-2 text-sm">
                          {formatPrice(locale, computedCompare[currency.toLowerCase() as keyof typeof computedCompare], currency as any)}
                        </span>
                      )}
                      <span className={isB2B ? "text-emerald-400 font-bold" : "text-white"}>
                        {formatPrice(locale, computed[currency.toLowerCase() as keyof typeof computed], currency as any)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="urban-product-grid__actions" style={{ zIndex: 10 }}>
                  <AddToCartButton 
                    slug={product.slug} 
                    locale={locale} 
                    variantId={product.variants?.find((v) => v.isDefault)?.id ?? product.variants?.[0]?.id ?? null} 
                    productName={productTitle} 
                    variant="minimal"
                    className="w-full bg-white/10 hover:bg-white hover:text-black py-3 rounded-xl text-center text-[10px] tracking-widest uppercase transition duration-300 font-semibold"
                  />
                </div>
              </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
