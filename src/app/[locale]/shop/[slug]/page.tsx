import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { buildPageMetadata, resolveLocale } from '@/lib/seo';
import { getShopProductBySlugServer, getShopProductsServer } from '@/lib/shopCatalogServer';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { buildShopViewerPricingContext, resolveShopProductPricing } from '@/lib/shopPricingAudience';
import { localizeShopDescription, localizeShopProductTitle, localizeShopText } from '@/lib/shopText';
import { extractShopProductDescriptionSections } from '@/lib/shopProductDescription';
import { findRelatedProducts } from '@/lib/shopRelatedProducts';
import { buildShopStorefrontProductPathForProduct } from '@/lib/shopStorefrontRouting';
import { AddToCartButton } from '@/components/shop/AddToCartButton';
import { ShopInlinePriceText } from '@/components/shop/ShopInlinePriceText';
import { ShopPrimaryPriceBox } from '@/components/shop/ShopPrimaryPriceBox';
import { ShopProductGallery } from '../components/ShopProductGallery';
import { ShopProductImage } from '@/components/shop/ShopProductImage';
import { ShopProductViewTracker } from '@/components/shop/ShopProductViewTracker';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const resolvedLocale = resolveLocale(locale);
  const product = await getShopProductBySlugServer(slug);

  if (!product) {
    return buildPageMetadata(resolvedLocale, `shop/${slug}`, {
      title: resolvedLocale === 'ua' ? 'Товар не знайдено | One Company Shop' : 'Product not found | One Company Shop',
      description: resolvedLocale === 'ua' ? 'Сторінка товару недоступна.' : 'Product page is unavailable.',
    });
  }

  return buildPageMetadata(resolvedLocale, `shop/${slug}`, {
    title: `${localizeShopProductTitle(resolvedLocale, product)} | ${product.brand} | One Company Shop`,
    description: localizeShopDescription(resolvedLocale, product.shortDescription),
    image: product.image,
    type: 'website',
  });
}

function normalizeImage(value: string | null | undefined) {
  const normalized = String(value ?? '').replace(/^["']|["']$/g, '').trim();
  if (!normalized) return null;
  return normalized.startsWith('//') ? `https:${normalized}` : normalized;
}

export default async function ShopProductPage({ params }: Props) {
  const { locale, slug } = await params;
  const resolvedLocale = resolveLocale(locale);
  const isUa = resolvedLocale === 'ua';

  const product = await getShopProductBySlugServer(slug);
  if (!product) {
    notFound();
  }

  const currentPath = `/${resolvedLocale}/shop/${slug}`;
  const canonicalPath = buildShopStorefrontProductPathForProduct(resolvedLocale, product);
  if (canonicalPath !== currentPath) {
    redirect(canonicalPath);
  }

  const [allProducts, session, settingsRecord] = await Promise.all([
    getShopProductsServer(),
    getCurrentShopCustomerSession(),
    getOrCreateShopSettings(prisma),
  ]);

  const settingsRuntime = getShopSettingsRuntime(settingsRecord);
  const viewerContext = buildShopViewerPricingContext(
    settingsRuntime,
    session?.group ?? null,
    Boolean(session),
    session?.b2bDiscountPercent ?? null
  );
  const pricing = resolveShopProductPricing(product, viewerContext);
  const defaultVariant = product.variants?.find((item) => item.isDefault) ?? product.variants?.[0] ?? null;
  const productTitle = localizeShopProductTitle(resolvedLocale, product);
  const productCategory = localizeShopText(resolvedLocale, product.category);
  const shortDescription = localizeShopDescription(resolvedLocale, product.shortDescription);
  const longDescription = localizeShopDescription(resolvedLocale, product.longDescription);
  const descriptionSections = extractShopProductDescriptionSections(longDescription || shortDescription);
  const gallery = (product.gallery?.length ? product.gallery : [product.image])
    .map(normalizeImage)
    .filter((item): item is string => Boolean(item));
  const safeGallery = gallery.length ? gallery : ['/images/placeholders/product-fallback.svg'];
  const relatedProducts = findRelatedProducts(product, allProducts, 3);

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-white">
      <ShopProductViewTracker
        slug={product.slug}
        name={productTitle}
        priceEur={pricing.effectivePrice.eur}
      />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-20 pt-28 sm:px-6 lg:px-8 lg:pt-32">
        <Link
          href={`/${resolvedLocale}/shop`}
          className="inline-flex w-fit items-center gap-2.5 rounded-full border-2 border-[#c29d59]/50 bg-[#c29d59]/12 px-6 py-3.5 text-[13px] font-semibold uppercase tracking-[0.2em] text-[#f1d8a5] transition hover:border-[#c29d59]/70 hover:bg-[#c29d59]/20 hover:text-white"
        >
          ← {isUa ? 'Назад до магазину' : 'Back to shop'}
        </Link>

        <section className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="sticky top-32 min-w-0 space-y-4">
            <ShopProductGallery
              images={safeGallery}
              productTitle={productTitle}
              category={productCategory}
              isInStock={product.stock === 'inStock'}
              isUa={isUa}
            />
          </div>

          <div className="min-w-0 space-y-6 rounded-3xl border border-white/15 bg-white/[0.03] p-6 backdrop-blur-xl sm:p-7">
            <p className="text-xs uppercase tracking-[0.18em] text-white/60">{product.brand}</p>
            <h1 className="text-balance text-2xl font-light leading-tight sm:text-3xl">{productTitle}</h1>

            {descriptionSections.introHtml ? (
              <div
                className="product-description max-w-none space-y-4 text-sm leading-[1.85] tracking-wide text-white/70 sm:text-[15px]"
                dangerouslySetInnerHTML={{ __html: descriptionSections.introHtml }}
              />
            ) : shortDescription ? (
              <p className="text-sm leading-[1.85] tracking-wide text-white/70 sm:text-[15px]">{shortDescription}</p>
            ) : null}

            <div className="rounded-2xl border border-white/15 bg-black/40 p-5">
              <ShopPrimaryPriceBox
                locale={resolvedLocale}
                isUa={isUa}
                price={pricing.effectivePrice}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.02] px-4 py-1.5 text-[10px] uppercase tracking-[0.15em] text-white/50">
                SKU {product.sku}
              </span>
              <span className="rounded-full border border-[#c29d59]/20 bg-[#c29d59]/5 px-4 py-1.5 text-[10px] uppercase tracking-[0.15em] text-[#c29d59]/80">
                {localizeShopText(resolvedLocale, product.collection)}
              </span>
              {product.productType ? (
                <span className="rounded-full border border-white/10 bg-white/[0.02] px-4 py-1.5 text-[10px] uppercase tracking-[0.15em] text-white/50">
                  {product.productType}
                </span>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 pt-4 sm:flex-row">
              <AddToCartButton
                slug={product.slug}
                locale={resolvedLocale}
                variantId={defaultVariant?.id ?? null}
                productName={productTitle}
                variant="minimal"
                className="group relative overflow-hidden rounded-full border border-white/10 bg-black px-8 py-3.5 text-[11px] font-medium uppercase tracking-[0.2em] text-[#c29d59] transition-all duration-500 hover:border-[#c29d59]/50 disabled:opacity-50"
              />
              <Link
                href={`/${resolvedLocale}/contact`}
                className="rounded-full border border-white/10 bg-white/[0.02] px-8 py-3.5 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-white/80 transition-all duration-500 hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
              >
                {isUa ? 'Запит по товару' : 'Request product'}
              </Link>
            </div>
          </div>
        </section>

        {relatedProducts.length ? (
          <section className="space-y-4">
            <h2 className="text-2xl font-light">{isUa ? 'Схожі товари' : 'Related products'}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {relatedProducts.map((item) => {
                const image = normalizeImage(item.image);
                return (
                  <Link
                    key={item.slug}
                    href={buildShopStorefrontProductPathForProduct(resolvedLocale, item)}
                    className="group overflow-hidden rounded-2xl border border-white/15 bg-white/[0.03] transition hover:border-white/35"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden">
                      {image ? (
                        <ShopProductImage
                          src={image}
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
                    </div>
                    <div className="space-y-2 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/55">{item.brand}</p>
                      <h3 className="text-lg font-light leading-snug">{localizeShopProductTitle(resolvedLocale, item)}</h3>
                      <p className="text-sm text-white/65">
                        <ShopInlinePriceText
                          locale={resolvedLocale}
                          price={resolveShopProductPricing(item, viewerContext).effectivePrice}
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
      </div>
    </main>
  );
}
