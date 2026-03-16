import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
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
import { buildShopViewerPricingContext, resolveShopProductPricing } from '@/lib/shopPricingAudience';
import {
  buildShopProductPath,
  getProductsForUrbanCollection,
  getUrbanCollectionHandleForProduct,
} from '@/lib/urbanCollectionMatcher';
import { URBAN_COLLECTION_CARDS } from '../data/urbanCollectionsList';

const prisma = new PrismaClient();

type ProductPageMode = 'default' | 'urban';

type Props = {
  locale: string;
  slug: string;
  mode?: ProductPageMode;
};

function localize(locale: SupportedLocale, value: { ua: string; en: string }) {
  return locale === 'ua' ? value.ua : value.en;
}

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
  const pageSlug = mode === 'urban' ? `shop/urban/products/${slug}` : `shop/${slug}`;

  if (!product) {
    return buildPageMetadata(resolvedLocale, pageSlug, {
      title: resolvedLocale === 'ua' ? 'Товар не знайдено | One Company Shop' : 'Product not found | One Company Shop',
      description: resolvedLocale === 'ua' ? 'Сторінка товару недоступна.' : 'Product page is unavailable.',
    });
  }

  return buildPageMetadata(resolvedLocale, pageSlug, {
    title: `${localize(resolvedLocale, product.title)} | ${product.brand} | One Company Shop`,
    description: localize(resolvedLocale, product.shortDescription),
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

  const viewerContext = buildShopViewerPricingContext(
    getShopSettingsRuntime(settingsRecord),
    session?.group ?? null,
    Boolean(session),
    session?.b2bDiscountPercent ?? null
  );
  const pricing = resolveShopProductPricing(product, viewerContext);
  const defaultVariant = product.variants?.find((item) => item.isDefault) ?? product.variants?.[0] ?? null;

  const urbanCollectionHandle = getUrbanCollectionHandleForProduct(product);
  const urbanCollectionCard = urbanCollectionHandle
    ? URBAN_COLLECTION_CARDS.find((item) => item.collectionHandle === urbanCollectionHandle)
    : null;
  const isUrbanMode = mode === 'urban' || Boolean(urbanCollectionHandle);

  const productTitle = localize(resolvedLocale, product.title);
  const productCategory = localize(resolvedLocale, product.category);
  const shortDescription = localize(resolvedLocale, product.shortDescription);
  const longDescription = localize(resolvedLocale, product.longDescription);
  const leadTime = localize(resolvedLocale, product.leadTime);
  const collection = localize(resolvedLocale, product.collection);
  const isInStock = product.stock === 'inStock';

  const brandMeta = getBrandMetadata(product.brand);
  const country = brandMeta ? getLocalizedCountry(brandMeta.country, resolvedLocale) : null;
  const subcategory = brandMeta ? getLocalizedSubcategory(brandMeta.subcategory, resolvedLocale) : null;

  const gallery = product.gallery?.length ? product.gallery : [product.image];
  const urbanRelatedProducts =
    urbanCollectionHandle && urbanCollectionCard
      ? getProductsForUrbanCollection(
          allProducts.filter((item) => item.slug !== product.slug),
          urbanCollectionHandle,
          urbanCollectionCard.title,
          urbanCollectionCard.brand
        )
      : [];
  const relatedProducts = (
    urbanRelatedProducts.length
      ? urbanRelatedProducts
      : allProducts.filter((item) => item.slug !== product.slug && item.scope === product.scope)
  ).slice(0, 3);

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://onecompany.global');
  const productPath = mode === 'urban'
    ? `/${resolvedLocale}/shop/urban/products/${product.slug}`
    : buildShopProductPath(resolvedLocale, product, isUrbanMode);
  const productUrl = `${baseUrl}${productPath}`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: productTitle,
    description: shortDescription,
    image: product.image.startsWith('http') ? product.image : `${baseUrl}${product.image}`,
    url: productUrl,
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
    },
  };
  const backLinkHref =
    isUrbanMode && urbanCollectionHandle
      ? `/${resolvedLocale}/shop/urban/collections/${urbanCollectionHandle}`
      : `/${resolvedLocale}/shop`;
  const backLinkLabel =
    isUrbanMode && urbanCollectionCard
      ? `← ${isUa ? `До ${urbanCollectionCard.title}` : `Back to ${urbanCollectionCard.title}`}`
      : `← ${isUa ? 'До магазину' : 'Back to shop'}`;
  const continueShoppingHref =
    isUrbanMode
      ? `/${resolvedLocale}/shop/urban/collections`
      : `/${resolvedLocale}/shop`;

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <ShopProductViewTracker
        slug={product.slug}
        name={productTitle}
        priceEur={pricing.effectivePrice.eur}
      />
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

          <span className="rounded-full border border-white/20 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/65">
            {product.scope === 'auto' ? (isUa ? 'Авто' : 'Auto') : (isUa ? 'Мото' : 'Moto')}
          </span>
        </div>

        <section className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-white/15 bg-black/40">
              <Image
                src={product.image}
                alt={productTitle}
                fill
                sizes="(max-width: 1280px) 100vw, 58vw"
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/15 to-black/65" />
              <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-3">
                <span className="rounded-full border border-white/25 bg-black/50 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/75">
                  {productCategory}
                </span>
                <span
                  className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] ${
                    isInStock
                      ? 'border-emerald-300/45 bg-emerald-400/20 text-emerald-100'
                      : 'border-amber-300/45 bg-amber-400/20 text-amber-100'
                  }`}
                >
                  {isInStock ? (isUa ? 'В наявності' : 'In stock') : (isUa ? 'Під замовлення' : 'Pre-order')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {gallery.slice(0, 6).map((image, index) => (
                <div key={`${product.slug}-${index}`} className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/15">
                  <Image
                    src={image}
                    alt={`${productTitle} ${index + 1}`}
                    fill
                    sizes="(max-width: 1280px) 50vw, 16vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
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
            <p className="text-sm leading-relaxed text-white/75 sm:text-base">
              {longDescription || shortDescription}
            </p>

            <div className="rounded-2xl border border-white/15 bg-black/40 p-4">
              <ShopPrimaryPriceBox
                locale={resolvedLocale}
                isUa={isUa}
                price={pricing.effectivePrice}
              />
              {pricing.effectiveCompareAt ? (
                <p className="mt-2 text-xs text-white/45 line-through">
                  {formatPrice(resolvedLocale, pricing.effectiveCompareAt.eur, 'EUR')}
                </p>
              ) : null}
              {pricing.b2bVisible ? (
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-emerald-200/80">
                  {isUa ? 'B2B band visible' : 'B2B band visible'}
                </p>
              ) : null}
              {pricing.audience === 'b2b' && pricing.source === 'b2b-discount' && pricing.discountPercent != null ? (
                <p className="mt-2 text-xs text-emerald-100/80">
                  {isUa
                    ? `Персональна B2B знижка ${pricing.discountPercent}% застосована`
                    : `Personal B2B discount ${pricing.discountPercent}% applied`}
                </p>
              ) : null}
              {pricing.requestQuote ? (
                <p className="mt-2 text-xs text-white/45">
                  {isUa ? 'B2B ціни доступні після погодження акаунта або запиту.' : 'B2B pricing becomes available after approval or quote request.'}
                </p>
              ) : null}
              {pricing.b2bVisible && pricing.bands.b2b?.price ? (
                <p className="mt-2 text-sm text-white/65">
                  B2B: {formatPrice(resolvedLocale, pricing.bands.b2b.price.eur, 'EUR')} / {formatPrice(resolvedLocale, pricing.bands.b2b.price.usd, 'USD')} / {formatPrice(resolvedLocale, pricing.bands.b2b.price.uah, 'UAH')}
                </p>
              ) : null}
              {pricing.b2bVisible && pricing.bands.b2b?.source === 'b2b-discount' && pricing.bands.b2b.discountPercent != null ? (
                <p className="text-xs text-white/45">
                  {isUa
                    ? `B2B band побудований від базової ціни зі знижкою ${pricing.bands.b2b.discountPercent}%`
                    : `B2B band is derived from base pricing with a ${pricing.bands.b2b.discountPercent}% discount`}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/20 bg-white/[0.04] px-3 py-1 text-xs text-white/75">
                SKU: {product.sku}
              </span>
              {leadTime ? (
                <span className="rounded-full border border-white/20 bg-white/[0.04] px-3 py-1 text-xs text-white/75">
                  {isUa ? 'Поставка:' : 'Lead time:'} {leadTime}
                </span>
              ) : null}
              <span className="rounded-full border border-white/20 bg-white/[0.04] px-3 py-1 text-xs text-white/75">
                {collection}
              </span>
              {product.productType ? (
                <span className="rounded-full border border-white/20 bg-white/[0.04] px-3 py-1 text-xs text-white/75">
                  {product.productType}
                </span>
              ) : null}
              {country ? (
                <span className="rounded-full border border-white/20 bg-white/[0.04] px-3 py-1 text-xs text-white/75">
                  {country}
                </span>
              ) : null}
              {subcategory ? (
                <span className="rounded-full border border-white/20 bg-white/[0.04] px-3 py-1 text-xs text-white/75">
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
                      <span>{localize(resolvedLocale, item)}</span>
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
                        isUrbanMode
                          ? `/${resolvedLocale}/shop/urban/products/${item.product.slug}`
                          : `/${resolvedLocale}/shop/${item.product.slug}`
                      }
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75 transition hover:border-white/25 hover:text-white"
                    >
                      <div>
                        <p className="font-medium">{localize(resolvedLocale, item.product.title)}</p>
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

            <div className="flex flex-wrap gap-3">
              <AddToCartButton slug={product.slug} locale={resolvedLocale} variantId={defaultVariant?.id ?? null} />
              <Link
                href={`/${resolvedLocale}/contact`}
                className="rounded-full border border-white/25 bg-white px-5 py-2 text-xs uppercase tracking-[0.2em] text-black transition hover:border-white hover:bg-white/90"
              >
                {pricing.requestQuote ? (isUa ? 'Запитати B2B ціну' : 'Request B2B pricing') : (isUa ? 'Запит по товару' : 'Request product')}
              </Link>
              <Link
                href={continueShoppingHref}
                className="rounded-full border border-white/25 bg-white/[0.03] px-5 py-2 text-xs uppercase tracking-[0.2em] text-white transition hover:border-white/50"
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
                href={buildShopProductPath(resolvedLocale, item, isUrbanMode)}
                className="group overflow-hidden rounded-2xl border border-white/15 bg-white/[0.03] transition hover:border-white/35"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={item.image}
                    alt={localize(resolvedLocale, item.title)}
                    fill
                    sizes="(max-width: 1280px) 100vw, 30vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/70" />
                </div>
                <div className="space-y-2 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/55">{item.brand}</p>
                  <h3 className="text-lg font-light leading-snug">{localize(resolvedLocale, item.title)}</h3>
                  <p className="text-sm text-white/65">
                    {formatPrice(resolvedLocale, resolveShopProductPricing(item, viewerContext).effectivePrice.eur, 'EUR')}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
