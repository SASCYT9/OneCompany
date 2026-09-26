import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isLocalStorefrontMode } from "@/lib/localStorefront";
import {
  buildNoIndexPageMetadata,
  buildPageMetadata,
  resolveLocale,
  type SupportedLocale,
} from "@/lib/seo";
import {
  getShopProductBySlugServer,
  getShopRelatedProductsByBrandServer,
} from "@/lib/shopCatalogServer";
import type { ShopProduct } from "@/lib/shopCatalog";
import {
  buildShopViewerPricingContext,
  resolveShopProductPricing,
  type ShopViewerPricingContext,
} from "@/lib/shopPricingAudience";
import {
  localizeShopDescription,
  localizeShopProductTitle,
  localizeShopText,
} from "@/lib/shopText";
import { extractShopProductDescriptionSections } from "@/lib/shopProductDescription";
import { findRelatedProducts } from "@/lib/shopRelatedProducts";
import { buildShopStorefrontProductPathForProduct } from "@/lib/shopStorefrontRouting";
import { ShopInlinePriceText } from "@/components/shop/ShopInlinePriceText";
import { ShopBrandLink } from "@/components/shop/ShopBrandLink";
import { ShopProductGallery } from "@/app/[locale]/shop/components/ShopProductGallery";
import { ShopProductVideos } from "@/app/[locale]/shop/components/ShopProductVideos";
import { MobileProductDisclosure } from "@/app/[locale]/shop/components/MobileProductDisclosure";
import { ShopProductImage } from "@/components/shop/ShopProductImage";
import { ShopProductViewTracker } from "@/components/shop/ShopProductViewTracker";
import { ShopProductStructuredData } from "@/components/seo/StructuredData";
import { ShopProductVariantPurchaseSection } from "@/app/[locale]/shop/components/ShopProductVariantPurchaseSection";
import { getPublicShopSettingsRuntime } from "@/lib/shopPublicSettings";
import { isRevozportBrand } from "@/lib/revozportShipping";
import {
  isWheelForceWheel,
  isWheelForceWheelSet,
  wheelForceSetMoney,
  WHEELFORCE_FAMILY_CHILD_TAG,
} from "@/lib/wheelforceFamily";

// ISR: anonymous SSR; B2B prices applied client-side via useShopViewerContext.
export const dynamic = "force-static";
export const revalidate = 86400;

export async function generateStaticParams() {
  // Product URLs are present in the sitemap and use on-demand ISR. Keeping the
  // build list empty avoids a catalogue DB query and 200 eager PDP renders.
  if (process.env.NEXT_PHASE === "phase-production-build" || isLocalStorefrontMode()) return [];

  try {
    const products = await prisma.shopProduct.findMany({
      where: { isPublished: true },
      select: { slug: true },
      take: 100,
      orderBy: { updatedAt: "desc" },
    });

    const params = [];
    for (const p of products) {
      params.push({ locale: "ua", slug: p.slug });
      params.push({ locale: "en", slug: p.slug });
    }
    return params;
  } catch (err) {
    console.error("[ShopProductPage] generateStaticParams failed:", err);
    return [];
  }
}

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const resolvedLocale = resolveLocale(locale);
  const product = await getShopProductBySlugServer(slug);

  if (!product) {
    notFound();
    return buildNoIndexPageMetadata(resolvedLocale, `shop/${slug}`, {
      title:
        resolvedLocale === "ua"
          ? "Товар не знайдено | One Company Shop"
          : "Product not found | One Company Shop",
      description:
        resolvedLocale === "ua" ? "Сторінка товару недоступна." : "Product page is unavailable.",
    });
  }

  const canonicalProduct = product.wheelForceFamily?.parentSlug
    ? { ...product, slug: product.wheelForceFamily.parentSlug }
    : product;
  const canonicalPath = buildShopStorefrontProductPathForProduct(resolvedLocale, canonicalProduct);
  const canonicalSlug = canonicalPath.replace(`/${resolvedLocale}/`, "");

  const localizedTitle = localizeShopProductTitle(resolvedLocale, product);
  const pageTitle = product.brand?.trim().toLowerCase() === "wheelforce"
    ? `${localizedTitle} | One Company Shop`
    : `${localizedTitle} | ${product.brand} | One Company Shop`;
  return buildPageMetadata(resolvedLocale, canonicalSlug, {
    title: pageTitle,
    description: localizeShopDescription(resolvedLocale, product.shortDescription),
    image: product.image,
    type: "product",
  });
}

function normalizeImage(value: string | null | undefined) {
  const normalized = String(value ?? "")
    .replace(/^["']|["']$/g, "")
    .trim();
  if (!normalized) return null;
  return normalized.startsWith("//") ? `https:${normalized}` : normalized;
}

function appendRevozportShippingWeight(
  html: string,
  product: ShopProduct,
  locale: SupportedLocale
) {
  if (!isRevozportBrand(product.brand)) return html;
  if (typeof product.weightKg !== "number" || !Number.isFinite(product.weightKg)) return html;
  if (/(?:Вага відправлення|Shipping weight)\s*:/i.test(html)) return html;

  const label = locale === "ua" ? "Вага відправлення" : "Shipping weight";
  const unit = locale === "ua" ? "кг" : "kg";
  const specHtml = `<p><strong>${label}:</strong> ${product.weightKg} ${unit}</p>`;
  const deliveryHeading = /<h[1-6][^>]*>\s*(?:Доставка|Delivery)\s*<\/h[1-6]>/i;
  const match = deliveryHeading.exec(html);

  if (!match || match.index == null) return `${html}${specHtml}`;
  return `${html.slice(0, match.index)}${specHtml}${html.slice(match.index)}`;
}

export default async function ShopProductPage({ params }: Props) {
  const { locale, slug } = await params;
  const resolvedLocale = resolveLocale(locale);
  const isUa = resolvedLocale === "ua";

  const product = await getShopProductBySlugServer(slug);
  if (!product) {
    notFound();
  }

  const currentPath = `/${resolvedLocale}/shop/${slug}`;
  const canonicalPath = buildShopStorefrontProductPathForProduct(resolvedLocale, product);
  if (canonicalPath !== currentPath) {
    permanentRedirect(canonicalPath);
  }

  // Related products no longer block first byte: the brand-scoped fetch +
  // findRelatedProducts scoring run inside the Suspense boundary at the
  // bottom of the page. Main path only awaits shop settings.
  const settingsRuntime = await getPublicShopSettingsRuntime();
  const rates = settingsRuntime.currencyRates;
  const viewerContext = buildShopViewerPricingContext(settingsRuntime, null, false, null, undefined, {
    priceCountry: isUa ? "Ukraine" : null,
  });
  const pricing = resolveShopProductPricing(product, viewerContext);
  const productTitle = localizeShopProductTitle(resolvedLocale, product);
  const productCategory = localizeShopText(resolvedLocale, product.category);
  const shortDescription = localizeShopDescription(resolvedLocale, product.shortDescription);
  const longDescription = localizeShopDescription(resolvedLocale, product.longDescription);
  const descriptionSections = extractShopProductDescriptionSections(
    longDescription || shortDescription
  );
  descriptionSections.introHtml = appendRevozportShippingWeight(
    descriptionSections.introHtml,
    product,
    resolvedLocale
  );
  const gallery = (product.gallery?.length ? product.gallery : [product.image])
    .map(normalizeImage)
    .filter((item): item is string => Boolean(item));
  const safeGallery = gallery.length ? gallery : ["/images/placeholders/product-fallback.svg"];
  const localizedProductType = product.productType
    ? resolvedLocale === "en" && /[\u0400-\u04ff]/u.test(product.productType)
      ? productCategory
      : resolvedLocale === "ua" && !/[\u0400-\u04ff]/u.test(product.productType)
        ? productCategory
        : product.productType
    : null;

  return (
    <div className="min-h-screen bg-background text-foreground dark:bg-linear-to-b dark:from-black dark:via-zinc-950 dark:to-background">
      <ShopProductStructuredData product={product} locale={resolvedLocale} rates={rates} />
      <ShopProductViewTracker
        slug={product.slug}
        name={productTitle}
        priceEur={pricing.effectivePrice.eur}
      />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-20 pt-28 sm:px-6 lg:px-8 lg:pt-32">
        <Link
          href={`/${resolvedLocale}/shop`}
          className="inline-flex w-fit items-center gap-2.5 rounded-full border border-foreground/25 bg-foreground/5 px-6 py-3.5 text-[13px] font-semibold uppercase tracking-[0.2em] text-foreground/85 transition hover:border-foreground/45 hover:bg-foreground/10 hover:text-foreground"
        >
          ← {isUa ? "Назад до магазину" : "Back to shop"}
        </Link>

        <section className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="min-w-0 lg:sticky lg:top-32">
            <ShopProductGallery
              images={safeGallery}
              productTitle={productTitle}
              category={productCategory}
              isInStock={product.stock === "inStock"}
              isUa={isUa}
            />
          </div>

          <div className="min-w-0 space-y-6 rounded-3xl border border-foreground/18 bg-card p-3 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] sm:p-7">
            <ShopBrandLink
              brand={product.brand}
              locale={resolvedLocale}
              className="inline-flex w-fit text-xs uppercase tracking-[0.18em] text-foreground/75 underline decoration-foreground/25 underline-offset-4 transition hover:text-primary hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 dark:text-foreground/60"
            />
            <h1 className="text-balance text-2xl font-light leading-tight sm:text-3xl">
              {productTitle}
            </h1>

            {descriptionSections.introHtml || shortDescription ? (
              <MobileProductDisclosure title={isUa ? "Опис товару" : "Product description"}>
                {descriptionSections.introHtml ? (
                  <div
                    className="product-description max-w-none space-y-4 text-sm leading-[1.85] tracking-wide text-foreground/85 dark:text-foreground/70 sm:text-[15px]"
                    dangerouslySetInnerHTML={{ __html: descriptionSections.introHtml }}
                  />
                ) : shortDescription ? (
                  <p className="text-sm leading-[1.85] tracking-wide text-foreground/85 dark:text-foreground/70 sm:text-[15px]">
                    {shortDescription}
                  </p>
                ) : null}
              </MobileProductDisclosure>
            ) : null}

            {product.externalVideos?.length ? (
              <ShopProductVideos videos={product.externalVideos} title={productTitle} isUa={isUa} />
            ) : null}

            <ShopProductVariantPurchaseSection
              product={product}
              ssrViewerContext={viewerContext}
              locale={resolvedLocale}
              isUa={isUa}
              productTitle={productTitle}
              continueShoppingHref={`/${resolvedLocale}/shop`}
            >
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-[10px] uppercase tracking-[0.15em] text-primary/80">
                  {localizeShopText(resolvedLocale, product.collection)}
                </span>
                {localizedProductType ? (
                  <span className="rounded-full border border-foreground/10 bg-foreground/[0.03] px-4 py-1.5 text-[10px] uppercase tracking-[0.15em] text-foreground/65 dark:text-foreground/50">
                    {localizedProductType}
                  </span>
                ) : null}
              </div>
            </ShopProductVariantPurchaseSection>
          </div>
        </section>

        <Suspense fallback={null}>
          <RelatedProductsSection
            product={product}
            locale={resolvedLocale}
            viewerContext={viewerContext}
          />
        </Suspense>
      </div>
    </div>
  );
}
async function RelatedProductsSection({
  product,
  locale,
  viewerContext,
}: {
  product: ShopProduct;
  locale: SupportedLocale;
  viewerContext: ShopViewerPricingContext;
}) {
  // Brand-scoped fetch — ~95% of related-product picks come from the same
  // brand anyway. Heavy lift (DB query + mapDbToCatalog × N) runs here in
  // the Suspense subtree so it doesn't block the main PDP first byte.
  const brandPool = await getShopRelatedProductsByBrandServer(product.brand);
  const relatedPool = product.brand.trim().toLowerCase() === "wheelforce"
    ? brandPool.filter((item) =>
        !(item.tags ?? []).includes(WHEELFORCE_FAMILY_CHILD_TAG) &&
        item.slug !== product.wheelForceFamily?.parentSlug
      )
    : brandPool;
  const isWheelForceBrand = product.brand.trim().toLowerCase() === "wheelforce";
  const wheelSetRecommendations = isWheelForceBrand
    ? findRelatedProducts(product, relatedPool.filter(isWheelForceWheelSet), 3)
    : [];
  const remainingRecommendationSlots = Math.max(0, 3 - wheelSetRecommendations.length);
  const otherRecommendations = remainingRecommendationSlots
    ? findRelatedProducts(
        product,
        isWheelForceBrand ? relatedPool.filter((item) => !isWheelForceWheelSet(item)) : relatedPool,
        remainingRecommendationSlots
      )
    : [];
  const relatedProducts = isWheelForceBrand
    ? [...wheelSetRecommendations, ...otherRecommendations]
    : otherRecommendations;
  if (!relatedProducts.length) return null;
  const isUa = locale === "ua";
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-light">{isUa ? "Схожі товари" : "Related products"}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {relatedProducts.map((item) => {
          const image = normalizeImage(item.image);
          const relatedPricing = resolveShopProductPricing(item, viewerContext);
          const relatedPrice = isWheelForceWheel(item)
            ? wheelForceSetMoney(relatedPricing.effectivePrice)
            : relatedPricing.effectivePrice;
          return (
            <Link
              key={item.slug}
              href={buildShopStorefrontProductPathForProduct(locale, item)}
              className="group overflow-hidden rounded-2xl border border-foreground/15 bg-foreground/5 transition hover:border-primary/35"
            >
              <div className="relative aspect-4/3 overflow-hidden bg-white border-b border-zinc-950/10 flex items-center justify-center p-4">
                {image ? (
                  <ShopProductImage
                    src={image}
                    alt={localizeShopProductTitle(locale, item)}
                    fill
                    sizes="(max-width: 1280px) 100vw, 30vw"
                    fallbackSrc="/images/placeholders/product-fallback.svg"
                    className="object-contain p-4 mix-blend-multiply transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-zinc-400">
                    <ShoppingBag className="h-12 w-12 opacity-30" />
                  </div>
                )}
              </div>
              <div className="space-y-2 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-foreground/70 dark:text-foreground/55">
                  {item.brand}
                </p>
                <h3 className="text-lg font-light leading-snug">
                  {localizeShopProductTitle(locale, item)}
                </h3>
                <p className="text-sm text-foreground/80 dark:text-foreground/65">
                  <ShopInlinePriceText
                    locale={locale}
                    price={relatedPrice}
                    requestLabel={isUa ? "Ціна за запитом" : "Price on request"}
                  />
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

