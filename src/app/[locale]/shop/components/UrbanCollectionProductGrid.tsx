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

import { motion } from 'framer-motion';

const gridVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 50, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 50, damping: 20 },
  },
};

export default function UrbanCollectionProductGrid({
  locale,
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
      id="urban-products"
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
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8 }}
          className="urban-product-grid__head"
        >
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
        </motion.div>

        {products.length > 0 ? (
          <motion.div
            variants={gridVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.1 }}
            className="urban-product-grid__cards"
          >
            {products.map((product) => {
              const pricing = viewerContext
                ? resolveShopProductPricing(product, viewerContext)
                : { effectivePrice: product.price, effectiveCompareAt: product.compareAt, audience: 'b2c', b2bVisible: false };
              
              const isB2B = pricing.audience === 'b2b' && pricing.b2bVisible;

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
              <motion.article 
                variants={cardVariants}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                key={product.slug} 
                className="urban-product-grid__card"
              >
                <Link
                  href={buildShopProductPath(locale, product)}
                  className="urban-product-grid__card-link"
                  aria-label={productTitle}
                />
                <div className="urban-product-grid__media group overflow-hidden relative">
                  <motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.6 }} className="w-full h-full">
                    <Image
                      src={safeImageUrl}
                      alt={productTitle}
                      fill
                      sizes="(max-width: 768px) 100vw, 25vw"
                      className="object-cover"
                    />
                  </motion.div>
                </div>
                <div className="urban-product-grid__body backdrop-blur-md bg-white/5 border border-white/10 rounded-b-xl">
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
                      label={isUa ? 'Замовити' : 'Order'}
                      labelAdded={isUa ? 'У кошику' : 'In cart'}
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
                      className="urban-product-grid__details whitespace-nowrap text-xs text-white/70 hover:text-white transition-colors uppercase tracking-widest"
                    >
                      {isUa ? 'Деталі' : 'Details'}
                    </Link>
                  </div>
                </div>
              </motion.article>
            );
          })}
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="urban-product-grid__empty"
          >
            <p className="urban-product-grid__empty-title">
              {isUa ? 'Колекція незабаром у каталозі' : 'Collection coming to the catalog'}
            </p>
            <p className="urban-product-grid__empty-copy">
              {isUa
                ? `Ми завершуємо формування асортименту для ${title}. Залиште запит, і менеджер підбере комплект під ваш автомобіль.`
                : `We are finalizing the assortment for ${title}. Leave a request and our team will curate a package for your car.`}
            </p>
            <Link href={`/${locale}/contact`} className="urban-product-grid__empty-cta hover:bg-white hover:text-black transition-colors duration-500">
              {isUa ? 'Запитати комплект' : 'Request a package'}
            </Link>
          </motion.div>
        )}
      </div>
    </section>
  );
}
