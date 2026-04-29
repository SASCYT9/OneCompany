"use client";

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AddToCartButton } from '@/components/shop/AddToCartButton';
import { useShopCurrency } from '@/components/shop/CurrencyContext';
import type { SupportedLocale } from '@/lib/seo';
import type { ShopProduct } from '@/lib/shopCatalog';
import { computeShopDisplayPrices, hasAnyShopPrice } from '@/lib/shopDisplayPrices';
import { localizeShopProductTitle } from '@/lib/shopText';
import type { ShopViewerPricingContext } from '@/lib/shopPricingAudience';
import { useShopViewerContext } from "@/lib/useShopViewerContext";
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

function computeDisplayPrices(
  price: ShopProduct['price'],
  rates: { EUR: number; USD: number; UAH?: number } | null,
) {
  return computeShopDisplayPrices(price, rates);
}

function pickPrimaryPriceLabel(
  locale: SupportedLocale,
  currency: 'EUR' | 'USD' | 'UAH',
  price: ShopProduct['price'],
) {
  if (currency === 'USD' && price.usd > 0) return formatPrice(locale, price.usd, 'USD');
  if (currency === 'EUR' && price.eur > 0) return formatPrice(locale, price.eur, 'EUR');
  if (currency === 'UAH' && price.uah > 0) return formatPrice(locale, price.uah, 'UAH');
  if (price.uah > 0) return formatPrice(locale, price.uah, 'UAH');
  if (price.usd > 0) return formatPrice(locale, price.usd, 'USD');
  if (price.eur > 0) return formatPrice(locale, price.eur, 'EUR');
  return null;
}

export default function AdroCollectionProductGrid({
  locale,
  title,
  brand,
  products,
  viewerContext: ssrViewerContext,
}: AdroCollectionProductGridProps) {
  const viewerContext = useShopViewerContext(ssrViewerContext);
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
              
              const isB2B = pricing.audience === 'b2b' && pricing.b2bVisible;
              const displayRates = rates && { EUR: rates.EUR, USD: rates.USD, UAH: rates.UAH };

              const computed = computeDisplayPrices(
                pricing.effectivePrice,
                displayRates,
              );

              const computedCompare = pricing.effectiveCompareAt
                ? computeDisplayPrices(pricing.effectiveCompareAt, displayRates)
                : null;
              const hasPrice = hasAnyShopPrice(pricing.effectivePrice, displayRates);
              const primaryPrice = pickPrimaryPriceLabel(locale, currency, computed);
              const comparePrice = computedCompare
                ? pickPrimaryPriceLabel(locale, currency, computedCompare)
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
                      src={product.image || '/images/shop/adro/adro-hero-m4.jpg'}
                      alt={productTitle}
                      fill
                      sizes="(max-width: 768px) 100vw, 25vw"
                      className="object-contain p-8 opacity-80 group-hover:scale-105 group-hover:opacity-100 transition-all duration-700"
                      style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
                    />
                  </div>
                  
                  <div className="p-6 flex flex-col flex-grow relative z-20">
                    <h3 className="text-sm font-medium text-zinc-300 line-clamp-2 mb-4 group-hover:text-white transition-colors">
                      {productTitle}
                    </h3>
                    
                    <div className="flex-grow"></div>

                    <div className="flex flex-col gap-1 mb-5">
                      {isB2B && comparePrice ? (
                        <span className="text-[10px] text-zinc-600 line-through tracking-wider">
                          {comparePrice}
                        </span>
                      ) : null}
                      
                      {!hasPrice || !primaryPrice ? (
                        <span className="text-sm font-light text-zinc-500 tracking-wide">
                          {isUa ? "Ціна за запитом" : "Price on Request"}
                        </span>
                      ) : (
                        <span className={`text-sm tracking-wide ${isB2B ? 'text-emerald-500 font-medium' : 'text-white font-light'}`}>
                          {primaryPrice}
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
                <div
                  className="absolute bottom-0 left-0 h-[1px] w-0 bg-white transition-all duration-700 group-hover:w-full"
                  style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
                />
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
