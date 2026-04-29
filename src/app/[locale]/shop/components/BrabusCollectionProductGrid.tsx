"use client";

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { AddToCartButton } from '@/components/shop/AddToCartButton';
import { useShopCurrency } from '@/components/shop/CurrencyContext';
import { ShopProductImage } from '@/components/shop/ShopProductImage';
import type { SupportedLocale } from '@/lib/seo';
import type { ShopProduct } from '@/lib/shopCatalog';
import { localizeShopProductTitle, localizeShopText } from '@/lib/shopText';
import { buildShopProductPathBrabus } from '@/lib/brabusCollectionMatcher';
import { resolveBrabusFallbackImage } from '@/lib/brabusImageFallbacks';
import type { ShopViewerPricingContext } from '@/lib/shopPricingAudience';
import { useShopViewerContext } from "@/lib/useShopViewerContext";
import { resolveShopProductPricing } from '@/lib/shopPricingAudience';
import BrabusSpotlightGrid from './BrabusSpotlightGrid';

type BrabusCollectionProductGridProps = {
  locale: SupportedLocale;
  handle: string;
  title: string;
  brand: string;
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

export default function BrabusCollectionProductGrid({
  locale,
  handle,
  title,
  brand,
  products,
  viewerContext: ssrViewerContext,
}: BrabusCollectionProductGridProps) {
  const viewerContext = useShopViewerContext(ssrViewerContext);
  const isUa = locale === 'ua';
  const { currency, rates } = useShopCurrency();

  return (
    <section
      className="urban-product-grid"
      style={
        {
          '--upg-padding-top': `96px`,
          '--upg-padding-bottom': `96px`,
          '--upg-mobile-cols': 1,
          '--upg-desktop-cols': 4,
          '--accent': '#ff0000',
        } as CSSProperties
      }
    >
      <div className="urban-product-grid__inner max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="urban-product-grid__head">
          <div>
            <p className="urban-product-grid__eyebrow" style={{ color: 'var(--accent)' }}>
              {brand || 'Brabus Tuning'}
            </p>
            <h2 className="urban-product-grid__title">
              {isUa ? `Товари для ${title}` : `${title} Products`}
            </h2>
            <p className="urban-product-grid__sub">
              {products.length > 0
                ? isUa
                  ? `Оригінальні тюнінг-компоненти Brabus для колекції ${title}.`
                  : `Original Brabus tuning components mapped to the ${title} collection.`
                : isUa
                  ? 'Каталог товарів наразі оновлюється.'
                  : 'This catalog is currently being updated.'}
            </p>
          </div>
          <Link
            href={`/${locale}/shop/brabus/collections`}
            className="urban-product-grid__all-link hover:text-[var(--accent)]"
          >
            {isUa ? 'Усі колекції Brabus' : 'All Brabus collections'}
          </Link>
        </div>

        {products.length > 0 ? (
          <BrabusSpotlightGrid className="urban-product-grid__cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2rem' }}>
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
              const productFallbackImage = resolveBrabusFallbackImage(product);

              return (
              <article key={product.slug} className="group bg-[#0a0a0a] rounded-xl overflow-hidden flex flex-col hover:bg-[#111] transition-colors duration-300 border border-[#1f1f1f] hover:border-[#333]">
                <Link
                  href={buildShopProductPathBrabus(locale, product)}
                  className="flex flex-col flex-grow"
                  aria-label={productTitle}
                >
                  <div className="relative aspect-[4/3] bg-[#0f0f0f] overflow-hidden flex items-center justify-center">
                    <ShopProductImage
                      src={product.image || '/images/placeholders/product-fallback.svg'}
                      fallbackSrc={productFallbackImage}
                      alt={productTitle}
                      fill
                      sizes="(max-width: 768px) 100vw, 25vw"
                      className="object-contain p-8 transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                  
                  <div className="p-6 flex flex-col flex-grow relative z-20">
                    <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-white/40 mb-2">
                      {product.brand}
                    </p>
                    <h3 className="text-sm font-medium text-white line-clamp-2 mb-3 tracking-wide leading-relaxed">
                      {productTitle}
                    </h3>
                    
                    <div className="flex-grow"></div>

                    <div className="flex flex-col gap-1 mb-5">
                      {isB2B && computedCompare ? (
                        <span className="text-[10px] text-white/30 line-through tracking-wider">
                          {currency === 'USD' && formatPrice(locale, computedCompare.usd, 'USD')}
                          {currency === 'EUR' && formatPrice(locale, computedCompare.eur, 'EUR')}
                          {currency === 'UAH' && formatPrice(locale, computedCompare.uah, 'UAH')}
                        </span>
                      ) : null}
                      
                      {computed.eur === 0 ? (
                        <span className="text-sm font-normal text-white/50 tracking-wide">
                          {isUa ? "Ціна за запитом" : "Price on Request"}
                        </span>
                      ) : (
                        <span className={`text-sm tracking-wide ${isB2B ? 'text-emerald-400 font-medium' : 'text-white/90 font-normal'}`}>
                          {currency === 'USD' && formatPrice(locale, computed.usd, 'USD')}
                          {currency === 'EUR' && formatPrice(locale, computed.eur, 'EUR')}
                          {currency === 'UAH' && formatPrice(locale, computed.uah, 'UAH')}
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-auto flex items-center justify-between">
                      <span className="text-xs uppercase tracking-widest text-white/50 font-medium group-hover:text-white transition-colors">
                        {isUa ? "Переглянути" : "View Details"}
                      </span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white/30 group-hover:text-white group-hover:translate-x-1 transition-all" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    </div>
                  </div>
                </Link>
              </article>
            );
          })}
          </BrabusSpotlightGrid>
        ) : (
          <div className="urban-product-grid__empty py-24 text-center border border-white/10 bg-black/40">
            <p className="urban-product-grid__empty-title text-xl text-white font-medium mb-4">
              {isUa ? 'Колекція незабаром у каталозі' : 'Collection coming to the catalog'}
            </p>
            <p className="urban-product-grid__empty-copy text-white/60 max-w-2xl mx-auto mb-8">
              {isUa
                ? `Ми завершуємо формування преміум-асортименту Brabus для ${title}. Залиште запит, і наш менеджер підбере тюнінг-програму під ваш автомобіль.`
                : `We are finalizing the premium Brabus assortment for ${title}. Leave a request and our team will curate a tuning program for your car.`}
            </p>
            <Link href={`/${locale}/#contact`} className="urban-product-grid__empty-cta inline-block bg-[#ff0000] text-white px-8 py-3 text-sm font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-colors duration-300">
              {isUa ? 'Запитати конфігурацію' : 'Request configuration'}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
