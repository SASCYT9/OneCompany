"use client";

import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AddToCartButton } from '@/components/shop/AddToCartButton';
import { useShopCurrency } from '@/components/shop/CurrencyContext';
import type { SupportedLocale } from '@/lib/seo';
import type { ShopProduct } from '@/lib/shopCatalog';
import { localizeShopProductTitle, localizeShopText } from '@/lib/shopText';
import type { ShopViewerPricingContext } from '@/lib/shopPricingAudience';
import { resolveShopProductPricing } from '@/lib/shopPricingAudience';

type AdroCollectionProductGridProps = {
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

// Function to generate standard product path - avoiding tight coupling
function buildGenericShopProductPath(locale: SupportedLocale, product: ShopProduct) {
   const brandSlug = product.brand?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'brand';
   return `/${locale}/shop/${brandSlug}/products/${product.slug}`;
}

export default function AdroCollectionProductGrid({
  locale,
  handle,
  title,
  brand,
  products,
  viewerContext,
}: AdroCollectionProductGridProps) {
  const isUa = locale === 'ua';
  const { currency, rates } = useShopCurrency();

  return (
    <section className="bg-black py-24 min-h-[50vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-16 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-3">
              {brand}
            </p>
            <h1 className="text-3xl md:text-5xl font-light text-white tracking-tight">
              {title}
            </h1>
          </div>
          <Link
            href={`/${locale}/shop/adro`}
            className="text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
          >
            {isUa ? 'Повернутися до ADRO' : 'Return to ADRO'}
          </Link>
        </div>

        {products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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

              return (
              <article key={product.slug} className="group relative flex flex-col overflow-hidden bg-zinc-950 border border-white/5 hover:border-white/20 transition-colors duration-500">
                <Link
                  href={`/${locale}/shop/adro/products/${product.slug}`}
                  className="flex flex-col flex-grow"
                >
                  <div className="relative aspect-[4/3] bg-[#080808] overflow-hidden flex items-center justify-center p-6">
                    <Image
                      src={product.image || '/images/placeholders/product-fallback.jpg'}
                      alt={productTitle}
                      fill
                      sizes="(max-width: 768px) 100vw, 25vw"
                      className="object-contain p-8 opacity-80 group-hover:scale-105 group-hover:opacity-100 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                    />
                  </div>
                  
                  <div className="p-6 flex flex-col flex-grow relative z-20">
                    <h3 className="text-sm font-medium text-zinc-300 line-clamp-2 mb-4 group-hover:text-white transition-colors">
                      {productTitle}
                    </h3>
                    
                    <div className="flex-grow"></div>

                    <div className="flex flex-col gap-1 mb-5">
                      {isB2B && computedCompare ? (
                        <span className="text-[10px] text-zinc-600 line-through tracking-wider">
                          {currency === 'USD' && formatPrice(locale, computedCompare.usd, 'USD')}
                          {currency === 'EUR' && formatPrice(locale, computedCompare.eur, 'EUR')}
                          {currency === 'UAH' && formatPrice(locale, computedCompare.uah, 'UAH')}
                        </span>
                      ) : null}
                      
                      {computed.usd === 0 && computed.eur === 0 && computed.uah === 0 ? (
                        <span className="text-sm font-light text-zinc-500 tracking-wide">
                          {isUa ? "Ціна за запитом" : "Price on Request"}
                        </span>
                      ) : (
                        <span className={`text-sm tracking-wide ${isB2B ? 'text-emerald-500 font-medium' : 'text-white font-light'}`}>
                          {currency === 'USD' && formatPrice(locale, computed.usd, 'USD')}
                          {currency === 'EUR' && formatPrice(locale, computed.eur, 'EUR')}
                          {currency === 'UAH' && formatPrice(locale, computed.uah, 'UAH')}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>

                {/* Bottom Actions: View + Add To Cart */}
                <div className="px-6 pb-5 pt-0 z-20 relative flex gap-3">
                  <Link
                    href={`/${locale}/shop/adro/products/${product.slug}`}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-white/20 text-[10px] tracking-[0.3em] uppercase font-light text-white/70 hover:text-black hover:bg-white hover:border-white transition-all duration-300"
                  >
                    {isUa ? "ПЕРЕЙТИ" : "VIEW"}
                    <ArrowRight size={12} strokeWidth={2} />
                  </Link>
                  <AddToCartButton
                    slug={product.slug}
                    variantId={null}
                    locale={locale}
                    redirect={true}
                    productName={productTitle}
                    label={isUa ? "КОШИК" : "CART"}
                    labelAdded={isUa ? "✓" : "✓"}
                    className="flex-1 flex items-center justify-center py-2.5 border border-white/10 text-[10px] tracking-[0.3em] uppercase font-light text-white/50 hover:text-black hover:bg-white hover:border-white transition-all duration-300"
                    variant="inline"
                  />
                </div>
                
                {/* Minimalist interactive line at bottom */}
                <div className="h-[1px] w-0 bg-white group-hover:w-full transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] absolute bottom-0 left-0" />
              </article>
            );
          })}
          </div>
        ) : (
          <div className="py-24 text-center border border-white/5 bg-zinc-950/50">
            <p className="text-xl text-white font-light mb-4">
              {isUa ? 'Колекція наразі порожня' : 'Collection is currently empty'}
            </p>
            <p className="text-zinc-500 text-sm max-w-2xl mx-auto">
              {isUa
                ? 'Наші фахівці саме оновлюють асортимент для цієї моделі.'
                : 'Our specialists are currently updating the assortment for this model.'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
