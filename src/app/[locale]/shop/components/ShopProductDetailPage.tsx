import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { PrismaClient } from '@prisma/client';
import { AddToCartButton } from '@/components/shop/AddToCartButton';
import { ShopProductImage } from '@/components/shop/ShopProductImage';
import { ShopInlinePriceText } from '@/components/shop/ShopInlinePriceText';
import { ShopPrimaryPriceBox } from '@/components/shop/ShopPrimaryPriceBox';
import { ShopProductViewTracker } from '@/components/shop/ShopProductViewTracker';
import {
  buildPageMetadata,
  resolveLocale,
  type SupportedLocale,
} from '@/lib/seo';
import { getBrandLogo } from '@/lib/brandLogos';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { getShopProductBySlugServer, getShopProductsServer } from '@/lib/shopCatalogServer';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { localizeShopDescription, localizeShopProductTitle, localizeShopText, fixDo88UaDescriptionFragments } from '@/lib/shopText';
import { buildShopViewerPricingContext, resolveShopProductPricing } from '@/lib/shopPricingAudience';
import { extractShopProductDescriptionSections } from '@/lib/shopProductDescription';
import { buildDo88EnrichedDescription } from '@/lib/do88DescriptionEnricher';
import { buildShopStorefrontProductPathForProduct } from '@/lib/shopStorefrontRouting';
import { BurgerShopProductDetailLayout } from './BurgerShopProductDetailLayout';
import { BrabusShopProductDetailLayout } from './BrabusShopProductDetailLayout';
import {
  getProductsForDo88Collection,
  getDo88CollectionHandleForProduct,
} from '@/lib/do88CollectionMatcher';
import { DO88_COLLECTION_CARDS } from '../data/do88CollectionsList';
import {
  getProductsForUrbanCollection,
  getUrbanCollectionHandleForProduct,
} from '@/lib/urbanCollectionMatcher';
import { URBAN_COLLECTION_CARDS } from '../data/urbanCollectionsList';
import {
  buildUrbanCollectionImagePool,
  resolveUrbanCollectionCardImage,
  resolveUrbanProductGallery,
  resolveUrbanProductImage,
} from '@/lib/urbanImageUtils';
import { isBlobStorageUrl } from '@/lib/runtimeAssetPaths';
import { ShopProductGallery } from './ShopProductGallery';
import { MobileProductDisclosure } from './MobileProductDisclosure';
import { getUrbanCollectionPageConfig } from '../data/urbanCollectionPages.server';
import { findRelatedProducts } from '@/lib/shopRelatedProducts';

import type { ShopProduct } from '@/lib/shopCatalog';

const prisma = new PrismaClient();

type ProductPageMode = 'default' | 'urban' | 'do88' | 'brabus' | 'burger' | 'akrapovic' | 'racechip' | 'csf' | 'ohlins' | 'girodisc' | 'ipe' | 'adro';

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

function resolveBlobBackedGalleryReference(
  reference: string,
  primaryImage: string | null | undefined
) {
  const normalizedReference = reference.replace(/^["']|["']$/g, '').trim();
  if (!normalizedReference.startsWith('/media/')) {
    return normalizedReference.startsWith('//') ? `https:${normalizedReference}` : normalizedReference;
  }

  const normalizedPrimaryImage = String(primaryImage ?? '').trim();
  if (!isBlobStorageUrl(normalizedPrimaryImage)) {
    return normalizedReference;
  }

  try {
    const primaryUrl = new URL(normalizedPrimaryImage);
    const blobPath = normalizedReference.replace(/^\/media\//, 'media/library/');
    return `${primaryUrl.origin}/${blobPath}`;
  } catch {
    return normalizedReference;
  }
}

function DetailListPanel({
  title,
  items,
  accentClassName,
  className,
}: {
  title?: string;
  items: string[];
  accentClassName?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border bg-black/30 p-5 ${accentClassName ?? 'border-white/12'} ${className ?? ''}`}>
      {title ? (
        <p className="text-[11px] uppercase tracking-[0.24em] text-white/50">{title}</p>
      ) : null}
      <ul className={`${title ? 'mt-4' : ''} space-y-3 text-sm leading-relaxed text-white/82 sm:text-[15px]`}>
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#c29d59]/80" />
            <span className="text-pretty">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DetailSpecPanel({
  title,
  specs,
  className,
}: {
  title?: string;
  specs: Array<{ label: string; value: string }>;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-white/12 bg-black/30 p-5 ${className ?? ''}`}>
      {title ? (
        <p className="text-[11px] uppercase tracking-[0.24em] text-white/50">{title}</p>
      ) : null}
      <dl className={`${title ? 'mt-4' : ''} grid gap-3 text-sm sm:grid-cols-2`}>
        {specs.map((spec) => (
          <div
            key={`${spec.label}:${spec.value}`}
            className="grid gap-1 rounded-xl border border-white/8 bg-white/[0.02] p-3"
          >
            <dt className="text-[10px] uppercase tracking-[0.18em] text-white/38">{spec.label}</dt>
            <dd className="text-pretty text-white/82">{spec.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function isWheelProduct(product: Pick<ShopProduct, 'category' | 'productType' | 'tags'>) {
  const values = [
    product.category.en,
    product.category.ua,
    product.productType ?? '',
    ...(product.tags ?? []),
  ].map((value) => value.toLowerCase());

  return values.some((value) => /\b(wheel|wheels|tyre|tyres|tire|tires|диск|диски|шини)\b/i.test(value));
}

function isKitProduct(product: Pick<ShopProduct, 'category' | 'productType' | 'tags' | 'bundle' | 'title'>) {
  if (isWheelProduct(product)) {
    return false;
  }

  const kitHaystack = [
    product.title.en,
    product.title.ua,
    product.category.en,
    product.category.ua,
    product.productType ?? '',
    ...(product.tags ?? []),
  ].join(' ').toLowerCase();

  return (
    Boolean(product.bundle) ||
    /\b(body\s?kit|bodykits|bodykit|full kit|complete kit|carbon fibre v2 kit|kit package|replacement bumper package|комплект обвісу|обвіси|повний комплект|пакет urban|пакет заміни бамперів)\b/i.test(kitHaystack)
  );
}

function isStandaloneUrbanComponent(product: Pick<ShopProduct, 'title'>) {
  const titleValue = `${product.title.en} ${product.title.ua}`.toLowerCase();

  return /(d-pillar|spoiler|roof|light bar|exhaust|tailpipe|bonnet|hood|mirror|trim|intake|насадк|спойлер|дахов|світлов|капот|оздоблен|повітрозабірник)/i.test(titleValue);
}

function isSameVehicleFamily(product: Pick<ShopProduct, 'brand' | 'vendor' | 'title' | 'collection' | 'tags'>, current: Pick<ShopProduct, 'brand' | 'vendor' | 'title' | 'collection' | 'tags'>) {
  const currentHaystack = [
    current.brand,
    current.vendor,
    current.title.en,
    current.title.ua,
    current.collection.en,
    current.collection.ua,
    ...(current.tags ?? []),
  ].join(' ').toLowerCase();
  const productHaystack = [
    product.brand,
    product.vendor,
    product.title.en,
    product.title.ua,
    product.collection.en,
    product.collection.ua,
    ...(product.tags ?? []),
  ].join(' ').toLowerCase();

  if (/(mercedes|g-wagon|g wagon|g-class|g class|g63|w465)/i.test(currentHaystack)) {
    return /(mercedes|g-wagon|g wagon|g-class|g class|g63|w465)/i.test(productHaystack);
  }

  const chassisFamilies = [
    ['range rover l460', 'l460'],
    ['range rover sport l461', 'sport l461', 'l461'],
    ['range rover sport l494', 'sport l494', 'l494', 'svr 2018'],
    ['discovery 5'],
    ['defender 90'],
    ['defender 110'],
    ['defender 130'],
  ];
  const currentFamily = chassisFamilies.find((markers) =>
    markers.some((marker) => currentHaystack.includes(marker))
  );
  if (currentFamily) {
    return currentFamily.some((marker) => productHaystack.includes(marker));
  }

  return product.brand.toLowerCase() === current.brand.toLowerCase();
}

function getFirstExternalProductImage(product: Pick<ShopProduct, 'image' | 'gallery'>) {
  return [product.image, ...(product.gallery ?? [])]
    .map((value) => String(value ?? '').replace(/^["']|["']$/g, '').trim())
    .find((value) => /^https?:\/\//i.test(value)) ?? null;
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
  if (mode === 'adro') pageSlug = `shop/adro/products/${slug}`;

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
  const urbanCollectionConfig = urbanCollectionHandle
    ? getUrbanCollectionPageConfig(urbanCollectionHandle)
    : null;
  const do88CollectionCard = do88CollectionHandle
    ? DO88_COLLECTION_CARDS.find((item) => item.categoryHandle === do88CollectionHandle)
    : null;
    
  const isUrbanMode = mode === 'urban' || Boolean(urbanCollectionHandle);
  const isDo88Mode = mode === 'do88' || Boolean(do88CollectionHandle);

  const productTitle = localizeShopProductTitle(resolvedLocale, product);
  const productCategory = localizeShopText(resolvedLocale, product.category);

  // For DO88 products we override the supplier's templated descriptions with
  // a concise, info-dense version generated from the product type + chassis.
  const do88Enriched = isDo88Mode
    ? buildDo88EnrichedDescription(product, resolvedLocale === 'ua' ? 'ua' : 'en')
    : null;

  const shortDescription = do88Enriched
    ? do88Enriched.shortDescription
    : localizeShopDescription(resolvedLocale, product.shortDescription);
  const supplierLongDescription = localizeShopDescription(resolvedLocale, product.longDescription);
  // Keep parsing the supplier long description so spec list still extracts;
  // the enriched headline + bullets replace the intro narrative.
  const descriptionSections = extractShopProductDescriptionSections(supplierLongDescription || shortDescription);
  if (do88Enriched) {
    descriptionSections.introHtml = do88Enriched.longDescriptionHtml;
    // If the enriched HTML already contains structured bullet sections (with
    // <h3> kickers + <ul>), the bullets are inline and we suppress the
    // separate features panel to avoid duplication. For the kind-based
    // fallback (headline + fitment only), keep the bullets on the panel.
    const hasInlineSections = /<h3\b/i.test(do88Enriched.longDescriptionHtml);
    if (hasInlineSections) {
      descriptionSections.features = [];
    } else if (descriptionSections.features.length === 0) {
      descriptionSections.features = [...do88Enriched.bullets];
    }
  }
  const fallbackSpecs: Array<{ label: string; value: string }> = [];
  const pushFallbackSpec = (label: string, value?: string | null) => {
    const normalizedValue = value?.trim();
    if (!normalizedValue) {
      return;
    }
    fallbackSpecs.push({ label, value: normalizedValue });
  };
  const detailFeatureItems = descriptionSections.features.length
    ? descriptionSections.features
    : product.highlights.map((item) => localizeShopText(resolvedLocale, item));
  const leadTime = localizeShopText(resolvedLocale, product.leadTime);
  pushFallbackSpec(isUa ? 'Термін постачання' : 'Lead time', leadTime);
  if (product.length != null || product.width != null || product.height != null) {
    const dimensionsValue = [
      product.length != null ? `${product.length} mm` : null,
      product.width != null ? `${product.width} mm` : null,
      product.height != null ? `${product.height} mm` : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join(' × ');
    pushFallbackSpec(isUa ? 'Габарити' : 'Dimensions', dimensionsValue);
  }
  if (product.weightKg != null) {
    pushFallbackSpec(isUa ? 'Вага' : 'Weight', `${product.weightKg} kg`);
  }
  const productBrandLc = (product.brand || '').toLowerCase();
  // Patch UA spec values that retained English fragments from supplier copy
  if (resolvedLocale === 'ua' && productBrandLc === 'do88') {
    descriptionSections.specs = descriptionSections.specs.map((s) => ({
      label: s.label,
      value: fixDo88UaDescriptionFragments(s.value),
    }));
  }
  const detailSpecs = [...descriptionSections.specs].filter((spec) => {
    if (/^категорія$|^category$/i.test(spec.label) && /[>›→]/.test(spec.value)) {
      return false;
    }
    if (
      /^бренд$|^brand$/i.test(spec.label)
      && productBrandLc
      && spec.value.toLowerCase().replace(/\s+/g, '') === productBrandLc.replace(/\s+/g, '')
    ) {
      return false;
    }
    return true;
  });
  const existingSpecKeys = new Set(
    detailSpecs.map((spec) => `${spec.label.toLowerCase()}::${spec.value.toLowerCase()}`)
  );
  fallbackSpecs.forEach((spec) => {
    const key = `${spec.label.toLowerCase()}::${spec.value.toLowerCase()}`;
    if (existingSpecKeys.has(key)) {
      return;
    }
    existingSpecKeys.add(key);
    detailSpecs.push(spec);
  });
  const isInStock = product.stock === 'inStock';

  // Determine model handles for image resolution
  const urbanModelHandles = urbanCollectionHandle ? [urbanCollectionHandle] : [];

  const gallery = (product.gallery?.length ? product.gallery : [product.image]).map(g => {
    if (!g) return '';
    return resolveBlobBackedGalleryReference(g, product.image);
  });

  const resolvedGallery = isUrbanMode && urbanModelHandles.length > 0
    ? resolveUrbanProductGallery(
        {
          slug: product.slug,
          title: product.title,
          category: product.category,
          productType: product.productType,
          tags: product.tags ?? [],
          bundle: product.bundle,
          image: product.image,
          gallery,
        },
        urbanModelHandles,
        urbanCollectionConfig
      )
    : gallery.filter(img => img.length > 0);
  let categoryRelatedProducts: ShopProduct[] = [];
  const isUrbanBodyKitPage = isUrbanMode && (product.slug === 'urb-bun-25358207-v1' || isKitProduct(product));
  
  if (isUrbanMode && urbanCollectionHandle && urbanCollectionCard) {
    categoryRelatedProducts = getProductsForUrbanCollection(
      allProducts.filter((item) => item.slug !== product.slug),
      urbanCollectionHandle,
      urbanCollectionCard.title,
      urbanCollectionCard.brand
    );

    if (isUrbanBodyKitPage) {
      categoryRelatedProducts = [];
    } else if (!isWheelProduct(product)) {
      categoryRelatedProducts = categoryRelatedProducts.filter((item) => !isWheelProduct(item));
    }
  } else if (isDo88Mode && do88CollectionHandle && do88CollectionCard) {
    categoryRelatedProducts = getProductsForDo88Collection(
      allProducts.filter((item) => item.slug !== product.slug),
      do88CollectionHandle,
      do88CollectionCard.title
    );
  }

  const urbanKitRelatedFallback = isUrbanBodyKitPage
    ? findRelatedProducts(
        product,
        allProducts.filter(
          (item) =>
            item.slug !== product.slug &&
            isSameVehicleFamily(item, product) &&
            isKitProduct(item) &&
            !isStandaloneUrbanComponent(item)
        ),
        3
      )
    : [];
  const relatedProducts = isUrbanBodyKitPage
    ? []
    : isUrbanMode
      ? categoryRelatedProducts.length
      ? categoryRelatedProducts.slice(0, 3)
      : urbanKitRelatedFallback
      : categoryRelatedProducts.length
        ? categoryRelatedProducts.slice(0, 3)
        : findRelatedProducts(product, allProducts, 3);
  const relatedProductsWithPricing = relatedProducts.map((item) => ({
    item,
    price: computeCrossPrices(resolveShopProductPricing(item, viewerContext).effectivePrice),
  }));
  const urbanRelatedImagePools = new Map<string, string[]>();
  if (isUrbanMode) {
    const relatedUrbanHandles = new Set(
      [urbanCollectionHandle, ...relatedProducts.map((item) => getUrbanCollectionHandleForProduct(item))]
        .filter((handle): handle is string => Boolean(handle))
    );

    relatedUrbanHandles.forEach((handle) => {
      urbanRelatedImagePools.set(
        handle,
        buildUrbanCollectionImagePool(getUrbanCollectionPageConfig(handle), [handle])
      );
    });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://onecompany.global');
    
  const rawImageStr = resolvedGallery[0] ?? (product.image ? product.image.replace(/^["']|["']$/g, '').trim() : '');
  const resolvedImageStr = isUrbanMode && urbanModelHandles.length > 0
    ? resolveUrbanProductImage(rawImageStr, urbanModelHandles, product.slug)
    : (rawImageStr.startsWith('//') ? `https:${rawImageStr}` : rawImageStr);
  const safeImageUrl = resolvedImageStr.startsWith('//')
    ? `https:${resolvedImageStr}`
    : (resolvedImageStr.startsWith('http') || resolvedImageStr.startsWith('/') ? resolvedImageStr : `${baseUrl}${resolvedImageStr}`);
  
  const priceValidUntil = new Date();
  priceValidUntil.setDate(priceValidUntil.getDate() + 30);
  let backLinkHref = `/${resolvedLocale}/shop`;
  let backLinkLabel = `← ${isUa ? 'Назад до магазину' : 'Back to shop'}`;
  let contextLinkHref: string | null = null;
  let contextLinkLabel: string | null = null;
  let continueShoppingHref = `/${resolvedLocale}/shop`;
  
  if (isUrbanMode) {
    backLinkHref = `/${resolvedLocale}/shop/urban/collections`;
    backLinkLabel = `← ${isUa ? 'Назад до каталогу Urban' : 'Back to Urban catalog'}`;
    contextLinkHref = urbanCollectionHandle ? `/${resolvedLocale}/shop/urban/collections/${urbanCollectionHandle}` : null;
    contextLinkLabel = urbanCollectionCard
      ? `${isUa ? 'Колекція' : 'Collection'}: ${urbanCollectionCard.title}`
      : null;
    continueShoppingHref = `/${resolvedLocale}/shop/urban/collections`;
  } else if (isDo88Mode) {
    backLinkHref = `/${resolvedLocale}/shop/do88/collections`;
    backLinkLabel = `← ${isUa ? 'Назад до каталогу do88' : 'Back to do88 catalog'}`;
    contextLinkHref = do88CollectionHandle ? `/${resolvedLocale}/shop/do88/collections/${do88CollectionHandle}` : null;
    contextLinkLabel = do88CollectionCard
      ? `${isUa ? 'Категорія' : 'Category'}: ${do88CollectionCard.title}`
      : null;
    continueShoppingHref = `/${resolvedLocale}/shop/do88/collections`;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-white">
      <ShopProductViewTracker
        slug={product.slug}
        name={productTitle}
        priceEur={computeCrossPrices(pricing.effectivePrice).eur}
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
            className="inline-flex items-center gap-2.5 rounded-full border-2 border-[#c29d59]/50 bg-[#c29d59]/12 px-6 py-3.5 text-[13px] font-semibold uppercase tracking-[0.2em] text-[#f1d8a5] shadow-[0_8px_24px_-6px_rgba(194,157,89,0.5)] transition hover:border-[#c29d59]/70 hover:bg-[#c29d59]/20 hover:text-white hover:shadow-[0_12px_32px_-6px_rgba(194,157,89,0.6)]"
          >
            {backLinkLabel}
          </Link>

          {contextLinkHref && contextLinkLabel ? (
            <Link
              href={contextLinkHref}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-white/72 transition hover:border-white/35 hover:text-white"
            >
              {contextLinkLabel}
            </Link>
          ) : null}

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

        <section className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="sticky top-32 min-w-0 space-y-4">
            <ShopProductGallery 
              images={[safeImageUrl, ...resolvedGallery.filter(img => img !== safeImageUrl && img && img.length > 0)]} 
              productTitle={productTitle}
              category={productCategory}
              isInStock={isInStock}
              isUa={isUa}
            />
          </div>

          <div className="min-w-0 space-y-6 rounded-3xl border border-white/15 bg-white/[0.03] p-6 backdrop-blur-xl sm:p-7">
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
            {(descriptionSections.introHtml || detailFeatureItems.length > 0 || detailSpecs.length > 0) ? (
              <MobileProductDisclosure
                title={isUa ? 'Опис і характеристики' : 'Description & specs'}
                contentClassName="space-y-4"
              >
                {descriptionSections.introHtml ? (
                  <div
                    className="product-description max-w-none space-y-4 text-sm leading-[1.85] tracking-wide text-white/70 sm:text-[15px] [&_h2]:hidden [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-xs [&_h3]:font-medium [&_h3]:uppercase [&_h3]:tracking-[0.2em] [&_h3]:text-[#c29d59]/90 [&_p]:text-pretty [&_strong]:font-medium [&_strong]:text-white/90 [&_ul]:mt-3 [&_ul]:space-y-2 [&_ul]:pl-0 [&_li]:flex [&_li]:items-start [&_li]:gap-2.5 [&_li]:list-none [&_li]:before:mt-[9px] [&_li]:before:block [&_li]:before:h-1 [&_li]:before:w-1 [&_li]:before:shrink-0 [&_li]:before:rounded-full [&_li]:before:bg-[#c29d59]/70"
                    dangerouslySetInnerHTML={{ __html: descriptionSections.introHtml }}
                  />
                ) : null}
                {detailFeatureItems.length > 0 ? (
                  <DetailListPanel
                    title={isDo88Mode ? undefined : (isUa ? 'Переваги' : 'Benefits')}
                    items={detailFeatureItems}
                  />
                ) : null}
                {detailSpecs.length > 0 ? (
                  <DetailSpecPanel
                    title={isDo88Mode ? undefined : (isUa ? 'Характеристики' : 'Specifications')}
                    specs={detailSpecs}
                  />
                ) : null}
              </MobileProductDisclosure>
            ) : null}

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
                    <ShopInlinePriceText
                      locale={resolvedLocale}
                      price={computeCrossPrices(pricing.effectiveCompareAt)}
                      className="text-sm text-red-400/80 line-through"
                      requestLabel={isUa ? 'Ціна за запитом' : 'Price on request'}
                    />
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
                            <ShopInlinePriceText
                              locale={resolvedLocale}
                              price={b2bPrices}
                              requestLabel={isUa ? 'Ціна за запитом' : 'Price on request'}
                            />
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

            {/* Додатковий блок опису прибрано, щоб текст не дублювався */}

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
                      href={buildShopStorefrontProductPathForProduct(resolvedLocale, item.product)}
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

            <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-4">
              <AddToCartButton 
                slug={product.slug} 
                locale={resolvedLocale} 
                variantId={defaultVariant?.id ?? null} 
                productName={productTitle}
                variant="minimal"
                className="inline-flex min-h-[54px] min-w-[220px] items-center justify-center rounded-full border border-white bg-white px-10 py-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-black shadow-[0_18px_40px_-24px_rgba(255,255,255,0.95)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#f2f2f2] hover:shadow-[0_22px_46px_-24px_rgba(255,255,255,1)] disabled:translate-y-0 disabled:opacity-50"
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

        {relatedProductsWithPricing.length > 0 ? (
          <section className="space-y-4">
            <h2 className="text-2xl font-light">{isUa ? 'Схожі товари' : 'Related products'}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {relatedProductsWithPricing.map(({ item, price }) => {
              const relatedUrbanHandle = isUrbanMode
                ? getUrbanCollectionHandleForProduct(item) ?? urbanCollectionHandle
                : null;
              const relatedImage = isUrbanMode
                ? getFirstExternalProductImage(item) ??
                  (relatedUrbanHandle
                    ? resolveUrbanCollectionCardImage(
                        item.image,
                        [relatedUrbanHandle],
                        urbanRelatedImagePools.get(relatedUrbanHandle) ?? [],
                        item.slug,
                        item.gallery,
                        item
                      )
                    : null)
                : relatedUrbanHandle
                  ? resolveUrbanCollectionCardImage(
                    item.image,
                    [relatedUrbanHandle],
                    urbanRelatedImagePools.get(relatedUrbanHandle) ?? [],
                    item.slug,
                    item.gallery,
                    item
                  )
                  : item.image && item.image.replace(/^[\"']|[\"']$/g, '').trim().length > 0
                    ? item.image.replace(/^[\"']|[\"']$/g, '').trim()
                    : null;

              return (
                <Link
                  key={item.slug}
                  href={buildShopStorefrontProductPathForProduct(resolvedLocale, item)}
                  className="group overflow-hidden rounded-2xl border border-white/15 bg-white/[0.03] transition hover:border-white/35"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    {relatedImage ? (
                      <ShopProductImage
                        src={relatedImage}
                        alt={localizeShopProductTitle(resolvedLocale, item)}
                        fill
                        sizes="(max-width: 1280px) 100vw, 30vw"
                        fallbackSrc="/images/placeholders/product-fallback.svg"
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
                      <ShopInlinePriceText
                        locale={resolvedLocale}
                        price={price}
                        requestLabel={isUa ? 'Ціна за запитом' : 'Price on request'}
                      />
                    </p>
                  </div>
                </Link>
              );
              })}
            </div>
          </section>
        ) : null}
      </div>)}
</main>
  );
}
