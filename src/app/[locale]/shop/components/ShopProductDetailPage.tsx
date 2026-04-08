import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { PrismaClient } from '@prisma/client';
import { AddToCartButton } from '@/components/shop/AddToCartButton';
import { ShopPrimaryPriceBox } from '@/components/shop/ShopPrimaryPriceBox';
import { ShopProductViewTracker } from '@/components/shop/ShopProductViewTracker';
import {
  buildPageMetadata,
  resolveLocale,
  type SupportedLocale,
} from '@/lib/seo';
import { getBrandLogo } from '@/lib/brandLogos';
import {
  getBrandMetadata,
  getLocalizedCountry,
  getLocalizedSubcategory,
} from '@/lib/brands';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { getShopProductBySlugServer, getShopProductsServer } from '@/lib/shopCatalogServer';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { localizeShopDescription, localizeShopProductTitle, localizeShopText } from '@/lib/shopText';
import { buildShopViewerPricingContext, resolveShopProductPricing } from '@/lib/shopPricingAudience';
import { BurgerShopProductDetailLayout } from './BurgerShopProductDetailLayout';
import { BrabusShopProductDetailLayout } from './BrabusShopProductDetailLayout';
import {
  getProductsForDo88Collection,
  getDo88CollectionHandleForProduct,
} from '@/lib/do88CollectionMatcher';
import { DO88_COLLECTION_CARDS } from '../data/do88CollectionsList';
import {
  buildShopProductPath,
  getProductsForUrbanCollection,
  getUrbanCollectionHandleForProduct,
} from '@/lib/urbanCollectionMatcher';
import { URBAN_COLLECTION_CARDS } from '../data/urbanCollectionsList';
import { ShopProductGallery } from './ShopProductGallery';

import type { ShopProduct } from '@/lib/shopCatalog';

const prisma = new PrismaClient();

type ProductPageMode = 'default' | 'urban' | 'do88' | 'brabus' | 'burger' | 'akrapovic' | 'racechip' | 'csf' | 'ohlins' | 'girodisc' | 'ipe';

type Props = {
  locale: string;
  slug: string;
  mode?: ProductPageMode;
};

function formatPrice(locale: SupportedLocale, amount: number, currency: 'EUR' | 'USD' | 'UAH') {
  const effectiveLocale = locale === 'ua' ? 'uk-UA' : 'en-US';
  const formattedAmount = new Intl.NumberFormat(effectiveLocale, {
    maximumFractionDigits: 0,
  }).format(amount);

  if (locale === 'ua') {
    if (currency === 'UAH') {
      return `${formattedAmount} грн`;
    }
    return `${formattedAmount} ${currency}`;
  }

  return `${currency} ${formattedAmount}`;
}

export async function getShopProductPageMetadata({
  locale,
  slug,
  mode = 'default',
}: Props): Promise<Metadata> {
  const resolvedLocale = resolveLocale(locale);
  const product = await getShopProductBySlugServer(slug);
  
  let pageSlug = `shop/${slug}`;
  if (mode === 'urban') pageSlug = `shop/urban/products/${slug}`;
  if (mode === 'do88') pageSlug = `shop/do88/products/${slug}`;
  if (mode === 'burger') pageSlug = `shop/burger/products/${slug}`;
  if (mode === 'ipe') pageSlug = `shop/ipe/products/${slug}`;

  if (!product) {
    return buildPageMetadata(resolvedLocale, pageSlug, {
      title: resolvedLocale === 'ua' ? 'Товар не знайдено | One Company Shop' : 'Product not found | One Company Shop',
      description: resolvedLocale === 'ua' ? 'Сторінка товару недоступна.' : 'Product page is unavailable.',
    });
  }

  return buildPageMetadata(resolvedLocale, pageSlug, {
    title: `${localizeShopProductTitle(resolvedLocale, product)} | ${product.brand} | One Company Shop`,
    description: localizeShopDescription(resolvedLocale, product.shortDescription),
    image: product.image,
    type: 'website',
  });
}

export default async function ShopProductDetailPage({
  locale,
  slug,
  mode = 'default',
}: Props) {
  const resolvedLocale = resolveLocale(locale);
  const isUa = resolvedLocale === 'ua';

  const [product, allProducts] = await Promise.all([
    getShopProductBySlugServer(slug),
    getShopProductsServer(),
  ]);

  const [session, settingsRecord] = await Promise.all([
    getCurrentShopCustomerSession(),
    getOrCreateShopSettings(prisma),
  ]);

  if (!product) {
    notFound();
  }

  const settingsRuntime = getShopSettingsRuntime(settingsRecord);
  const rates = settingsRuntime.currencyRates;

  const viewerContext = buildShopViewerPricingContext(
    settingsRuntime,
    session?.group ?? null,
    Boolean(session),
    session?.b2bDiscountPercent ?? null
  );
  const pricing = resolveShopProductPricing(product, viewerContext);
  const defaultVariant = product.variants?.find((item) => item.isDefault) ?? product.variants?.[0] ?? null;

  const computeCrossPrices = (priceObj: { eur: number; usd: number; uah: number }) => {
    let computedUah = priceObj.uah || 0;
    let computedEur = priceObj.eur || 0;
    let computedUsd = priceObj.usd || 0;

    const hasValid = (v?: number) => typeof v === 'number' && v > 0;

    if (hasValid(priceObj.uah) && rates) {
      if (!hasValid(computedEur)) computedEur = (priceObj.uah / rates.UAH) * rates.EUR;
      if (!hasValid(computedUsd)) computedUsd = (priceObj.uah / rates.UAH) * rates.USD;
    } else if (hasValid(priceObj.eur) && rates) {
      if (!hasValid(computedUah)) computedUah = (priceObj.eur / rates.EUR) * rates.UAH;
      if (!hasValid(computedUsd)) computedUsd = (priceObj.eur / rates.EUR) * rates.USD;
    } else if (hasValid(priceObj.usd) && rates) {
      if (!hasValid(computedUah)) computedUah = (priceObj.usd / rates.USD) * rates.UAH;
      if (!hasValid(computedEur)) computedEur = (priceObj.usd / rates.USD) * rates.EUR;
    }

    return { uah: computedUah, eur: computedEur, usd: computedUsd };
  };

  const urbanCollectionHandle = getUrbanCollectionHandleForProduct(product);
  const do88CollectionHandle = getDo88CollectionHandleForProduct(product);
  
  const urbanCollectionCard = urbanCollectionHandle
    ? URBAN_COLLECTION_CARDS.find((item) => item.collectionHandle === urbanCollectionHandle)
    : null;
  const do88CollectionCard = do88CollectionHandle
    ? DO88_COLLECTION_CARDS.find((item) => item.categoryHandle === do88CollectionHandle)
    : null;
    
  const isUrbanMode = mode === 'urban' || Boolean(urbanCollectionHandle);
  const isDo88Mode = mode === 'do88' || Boolean(do88CollectionHandle);

  const productTitle = localizeShopProductTitle(resolvedLocale, product);
  const productCategory = localizeShopText(resolvedLocale, product.category);
  const shortDescription = localizeShopDescription(resolvedLocale, product.shortDescription);
  const longDescription = localizeShopDescription(resolvedLocale, product.longDescription);
  const leadTime = localizeShopText(resolvedLocale, product.leadTime);
  const collection = localizeShopText(resolvedLocale, product.collection);
  const isInStock = product.stock === 'inStock';

  const brandMeta = getBrandMetadata(product.brand);
  const country = brandMeta ? getLocalizedCountry(brandMeta.country, resolvedLocale) : null;
  const subcategory = brandMeta ? getLocalizedSubcategory(brandMeta.subcategory, resolvedLocale) : null;

  const gallery = (product.gallery?.length ? product.gallery : [product.image]).map(g => {
    if (!g) return '';
    const raw = g.replace(/^["']|["']$/g, '').trim();
    return raw.startsWith('//') ? `https:${raw}` : raw;
  });
  let categoryRelatedProducts: ShopProduct[] = [];
  
  if (isUrbanMode && urbanCollectionHandle && urbanCollectionCard) {
    categoryRelatedProducts = getProductsForUrbanCollection(
      allProducts.filter((item) => item.slug !== product.slug),
      urbanCollectionHandle,
      urbanCollectionCard.title,
      urbanCollectionCard.brand
    );
  } else if (isDo88Mode && do88CollectionHandle && do88CollectionCard) {
    categoryRelatedProducts = getProductsForDo88Collection(
      allProducts.filter((item) => item.slug !== product.slug),
      do88CollectionHandle,
      do88CollectionCard.title
    );
  }

  const relatedProducts = (
    categoryRelatedProducts.length
      ? categoryRelatedProducts
      : allProducts.filter((item) => item.slug !== product.slug && item.scope === product.scope)
  ).slice(0, 3);

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://onecompany.global');
    
  let productPath = `/${resolvedLocale}/shop/${product.slug}`;
  if (isUrbanMode) productPath = `/${resolvedLocale}/shop/urban/products/${product.slug}`;
  if (isDo88Mode) productPath = `/${resolvedLocale}/shop/do88/products/${product.slug}`;
  if (mode === 'burger') productPath = `/${resolvedLocale}/shop/burger/products/${product.slug}`;
  if (mode === 'ipe') productPath = `/${resolvedLocale}/shop/ipe/products/${product.slug}`;
  
  const productUrl = `${baseUrl}${productPath}`;
  
  const rawImageStr = product.image ? product.image.replace(/^["']|["']$/g, '').trim() : '';
  const safeImageUrl = rawImageStr.startsWith('//') 
    ? `https:${rawImageStr}` 
    : (rawImageStr.startsWith('http') ? rawImageStr : `${baseUrl}${rawImageStr}`);
  
  const priceValidUntil = new Date();
  priceValidUntil.setDate(priceValidUntil.getDate() + 30);
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: productTitle,
    description: shortDescription,
    image: safeImageUrl,
    url: productUrl,
    ...(product.sku && { sku: product.sku }),
    brand: {
      '@type': 'Brand',
      name: product.brand,
    },
    offers: {
      '@type': 'Offer',
      price: pricing.effectivePrice.eur,
      priceCurrency: 'EUR',
      availability: isInStock ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
      url: productUrl,
      priceValidUntil: priceValidUntil.toISOString().slice(0, 10),
    },
  };
  let backLinkHref = `/${resolvedLocale}/shop`;
  let backLinkLabel = `← ${isUa ? 'До магазину' : 'Back to shop'}`;
  let continueShoppingHref = `/${resolvedLocale}/shop`;
  
  if (isUrbanMode) {
    backLinkHref = urbanCollectionHandle ? `/${resolvedLocale}/shop/urban/collections/${urbanCollectionHandle}` : `/${resolvedLocale}/shop/urban/collections`;
    backLinkLabel = urbanCollectionCard ? `← ${isUa ? `До ${urbanCollectionCard.title}` : `Back to ${urbanCollectionCard.title}`}` : `← ${isUa ? 'Всі колекції' : 'All collections'}`;
    continueShoppingHref = `/${resolvedLocale}/shop/urban/collections`;
  } else if (isDo88Mode) {
    backLinkHref = do88CollectionHandle ? `/${resolvedLocale}/shop/do88/collections/${do88CollectionHandle}` : `/${resolvedLocale}/shop/do88/collections`;
    backLinkLabel = do88CollectionCard ? `← ${isUa ? `До ${do88CollectionCard.title}` : `Back to ${do88CollectionCard.title}`}` : `← ${isUa ? 'Всі категорії' : 'All categories'}`;
    continueShoppingHref = `/${resolvedLocale}/shop/do88/collections`;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-white">
      <ShopProductViewTracker
        slug={product.slug}
        name={productTitle}
        priceEur={pricing.effectivePrice.eur}
      />
      
      {product.brand === 'Brabus' || mode === 'brabus' ? (
        <BrabusShopProductDetailLayout
          locale={locale}
          resolvedLocale={resolvedLocale}
          product={product}
          pricing={pricing}
          viewerContext={viewerContext}
          rates={rates}
          defaultVariant={defaultVariant}
          relatedProducts={relatedProducts}
        />
      ) : mode === 'burger' || product.brand === 'Burger Motorsports' ? (
        <BurgerShopProductDetailLayout
          locale={locale}
          resolvedLocale={resolvedLocale}
          product={product}
          pricing={pricing}
          viewerContext={viewerContext}
          rates={rates}
          defaultVariant={defaultVariant}
          relatedProducts={relatedProducts}
        />
      ) : (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-20 pt-28 sm:px-6 lg:px-8 lg:pt-32">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={backLinkHref}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-white/75 transition hover:border-white/40 hover:text-white"
          >
            {backLinkLabel}
          </Link>

          {isUrbanMode ? (
            <Link
              href={`/${resolvedLocale}/shop/urban`}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-white/60 transition hover:border-white/40 hover:text-white"
            >
              {isUa ? 'Urban Home' : 'Urban home'}
            </Link>
          ) : null}
          
          {isDo88Mode ? (
            <Link
              href={`/${resolvedLocale}/shop/do88`}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-900/[0.04] px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-cyan-400 transition hover:border-cyan-400/40 hover:text-cyan-300"
            >
              {isUa ? 'DO88 Home' : 'DO88 home'}
            </Link>
          ) : null}

          <span className="rounded-full border border-white/20 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/65">
            {product.scope === 'auto' ? (isUa ? 'Авто' : 'Auto') : (isUa ? 'Мото' : 'Moto')}
          </span>
        </div>

        <section className="grid items-start gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div className="sticky top-32 space-y-4">
            <ShopProductGallery 
              images={[safeImageUrl, ...gallery.filter(img => img !== safeImageUrl && img && img.length > 0)]} 
              productTitle={productTitle}
              category={productCategory}
              isInStock={isInStock}
              isUa={isUa}
            />
          </div>

          <div className="space-y-6 rounded-3xl border border-white/15 bg-white/[0.03] p-6 backdrop-blur-xl sm:p-7">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/[0.06] p-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getBrandLogo(product.brand)} alt={product.brand} className="h-full w-full object-contain" />
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.18em] text-white/60">{product.brand}</p>
                {product.vendor ? (
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                    {product.vendor}
                  </p>
                ) : null}
              </div>
            </div>

            <h1 className="text-balance text-2xl font-light leading-tight sm:text-3xl">{productTitle}</h1>
            <div 
              className="text-sm leading-relaxed text-white/75 sm:text-base prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: longDescription || shortDescription || '' }}
            />

            <div className="rounded-2xl border border-white/15 bg-black/40 p-5 space-y-4">
              <div className="flex flex-col">
                <ShopPrimaryPriceBox
                  locale={resolvedLocale}
                  isUa={isUa}
                  price={pricing.effectivePrice}
                />
                {pricing.effectiveCompareAt ? (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-white/40">{isUa ? 'Стара ціна' : 'Was'}</span>
                    <span className="text-sm text-red-400/80 line-through">
                      {formatPrice(resolvedLocale, computeCrossPrices(pricing.effectiveCompareAt).eur, 'EUR')}
                    </span>
                  </div>
                ) : null}
              </div>

              {pricing.b2bVisible ? (
                <div className="rounded-xl bg-cyan-950/30 border border-cyan-500/20 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20 text-[10px] text-cyan-300">✓</span>
                    <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">
                      {isUa ? 'B2B Ціноутворення' : 'B2B Pricing'}
                    </p>
                  </div>
                  
                  {pricing.bands.b2b?.price ? (
                    (() => {
                      const b2bPrices = computeCrossPrices(pricing.bands.b2b.price);
                      return (
                        <div className="pl-7">
                          <p className="text-2xl font-light text-white">
                            {formatPrice(resolvedLocale, b2bPrices.eur, 'EUR')}
                          </p>
                          <p className="text-[11px] text-cyan-100/50 mt-1">
                            {formatPrice(resolvedLocale, b2bPrices.usd, 'USD')} / {formatPrice(resolvedLocale, b2bPrices.uah, 'UAH')}
                          </p>
                        </div>
                      );
                    })()
                  ) : null}

                  {pricing.audience === 'b2b' && pricing.source === 'b2b-discount' && pricing.discountPercent != null ? (
                    <div className="pl-7">
                       <span className="inline-block px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] uppercase text-emerald-300 tracking-wider">
                         {isUa
                          ? `Знижка -${pricing.discountPercent}%`
                          : `Discount -${pricing.discountPercent}%`}
                       </span>
                    </div>
                  ) : pricing.bands.b2b?.source === 'b2b-discount' && pricing.bands.b2b.discountPercent != null ? (
                    <div className="pl-7">
                       <span className="inline-block px-2 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded text-[10px] uppercase text-cyan-300 tracking-wider">
                         {isUa
                          ? `Базова B2B знижка -${pricing.bands.b2b.discountPercent}%`
                          : `Base B2B discount -${pricing.bands.b2b.discountPercent}%`}
                       </span>
                    </div>
                  ) : null}

                  {pricing.requestQuote ? (
                    <p className="pl-7 text-[11px] text-cyan-200/50 leading-relaxed uppercase tracking-[0.1em]">
                      {isUa ? 'Очікує верифікації акаунта' : 'Pending account verification'}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Divider */}
            <div className="mx-auto h-[1px] w-full bg-gradient-to-r from-transparent via-white/10 to-transparent my-6" />

            <div className="flex flex-wrap gap-3">
              <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-4 py-1.5 text-[10px] uppercase tracking-[0.15em] text-white/50 transition-colors hover:bg-white/[0.04]">
                <span className="text-white/30">SKU</span> {product.sku}
              </span>
              {leadTime ? (
                <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-4 py-1.5 text-[10px] uppercase tracking-[0.15em] text-white/50 transition-colors hover:bg-white/[0.04]">
                  <span className="text-white/30">{isUa ? 'Поставка' : 'Lead time'}</span> {leadTime}
                </span>
              ) : null}
              <span className="flex items-center gap-2 rounded-full border border-[#c29d59]/20 bg-[#c29d59]/5 px-4 py-1.5 text-[10px] uppercase tracking-[0.15em] text-[#c29d59]/80 transition-colors hover:bg-[#c29d59]/10">
                {collection}
              </span>
              {product.productType ? (
                <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-4 py-1.5 text-[10px] uppercase tracking-[0.15em] text-white/50 transition-colors hover:bg-white/[0.04]">
                  {product.productType}
                </span>
              ) : null}
              {country ? (
                <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-4 py-1.5 text-[10px] uppercase tracking-[0.15em] text-white/50 transition-colors hover:bg-white/[0.04]">
                  {country}
                </span>
              ) : null}
              {subcategory ? (
                <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-4 py-1.5 text-[10px] uppercase tracking-[0.15em] text-white/50 transition-colors hover:bg-white/[0.04]">
                  {subcategory}
                </span>
              ) : null}
            </div>

            {/* Додатковий блок опису прибрано, щоб текст не дублювався */}

            {product.highlights.length > 0 ? (
              <div className="space-y-2 rounded-2xl border border-white/15 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/50">{isUa ? 'Ключові переваги' : 'Highlights'}</p>
                <ul className="space-y-2 text-sm text-white/75">
                  {product.highlights.map((item) => (
                    <li key={item.en} className="flex gap-2">
                      <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-white/60" />
                      <span>{localizeShopText(resolvedLocale, item)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {product.bundle ? (
              <div className="space-y-3 rounded-2xl border border-white/15 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/50">
                    {isUa ? 'Склад комплекту' : 'Bundle contents'}
                  </p>
                  <span className="rounded-full border border-white/20 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-white/70">
                    {isUa
                      ? `Доступно комплектів: ${product.bundle.availableQuantity}`
                      : `Available bundles: ${product.bundle.availableQuantity}`}
                  </span>
                </div>
                <div className="space-y-2">
                  {product.bundle.items.map((item) => (
                    <Link
                      key={item.id}
                      href={
                        isDo88Mode
                          ? `/${resolvedLocale}/shop/do88/products/${item.product.slug}`
                          : isUrbanMode
                          ? `/${resolvedLocale}/shop/urban/products/${item.product.slug}`
                          : `/${resolvedLocale}/shop/${item.product.slug}`
                      }
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75 transition hover:border-white/25 hover:text-white"
                    >
                      <div>
                        <p className="font-medium">{localizeShopProductTitle(resolvedLocale, item.product)}</p>
                        <p className="mt-1 text-xs text-white/45">
                          {item.quantity} × {item.variantTitle || (isUa ? 'Базовий варіант' : 'Default variant')}
                        </p>
                      </div>
                      <span className="text-xs uppercase tracking-[0.18em] text-white/45">
                        {item.availableQuantity}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            {product.tags?.length ? (
              <div className="flex flex-wrap gap-2">
                {product.tags.slice(0, 8).map((tag) => (
                  <span key={tag} className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-white/60">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-4">
              <AddToCartButton 
                slug={product.slug} 
                locale={resolvedLocale} 
                variantId={defaultVariant?.id ?? null} 
                productName={productTitle}
                variant="minimal"
                className="group relative overflow-hidden rounded-full border border-white/10 bg-black px-8 py-3.5 text-[11px] font-medium uppercase tracking-[0.2em] text-[#c29d59] transition-all duration-500 hover:border-[#c29d59]/50 hover:shadow-[0_0_20px_-5px_rgba(194,157,89,0.4)] disabled:opacity-50"
              />
              <Link
                href={`/${resolvedLocale}/contact`}
                className="group relative overflow-hidden rounded-full border border-white/10 bg-white/[0.02] px-8 py-3.5 text-[11px] font-medium uppercase tracking-[0.2em] text-white/80 transition-all duration-500 hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
              >
                {pricing.requestQuote ? (isUa ? 'Запитати B2B ціну' : 'Request B2B pricing') : (isUa ? 'Запит по товару' : 'Request product')}
              </Link>
              <Link
                href={continueShoppingHref}
                className="rounded-full border border-transparent bg-transparent px-6 py-3.5 text-[10px] font-light uppercase tracking-[0.15em] text-white/40 transition-all duration-500 hover:text-white/80"
              >
                {isUa ? 'Продовжити покупки' : 'Continue shopping'}
              </Link>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-light">{isUa ? 'Схожі товари' : 'Related products'}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedProducts.map((item) => (
              <Link
                key={item.slug}
                href={isDo88Mode ? `/${resolvedLocale}/shop/do88/products/${item.slug}` : (isUrbanMode ? `/${resolvedLocale}/shop/urban/products/${item.slug}` : `/${resolvedLocale}/shop/${item.slug}`)}
                className="group overflow-hidden rounded-2xl border border-white/15 bg-white/[0.03] transition hover:border-white/35"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  {item.image && item.image.replace(/^[\"']|[\"']$/g, '').trim().length > 0 ? (
                    <Image
                      src={item.image.replace(/^[\"']|[\"']$/g, '').trim()}
                      alt={localizeShopProductTitle(resolvedLocale, item)}
                      fill
                      sizes="(max-width: 1280px) 100vw, 30vw"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-black/40 text-white/10">
                      <ShoppingBag className="h-12 w-12 opacity-30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/70" />
                </div>
                <div className="space-y-2 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/55">{item.brand}</p>
                  <h3 className="text-lg font-light leading-snug">{localizeShopProductTitle(resolvedLocale, item)}</h3>
                  <p className="text-sm text-white/65">
                    {formatPrice(resolvedLocale, resolveShopProductPricing(item, viewerContext).effectivePrice.eur, 'EUR')}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>)}
</main>
  );
}
