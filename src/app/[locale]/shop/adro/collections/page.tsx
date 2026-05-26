import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { absoluteUrl, buildLocalizedPath, buildPageMetadata, resolveLocale } from "@/lib/seo";
import { getAdroProductsServer, projectShopProductForListGrid } from "@/lib/shopCatalogServer";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { buildShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { buildShopStorefrontProductPathForProduct } from "@/lib/shopStorefrontRouting";
import { localizeShopProductTitle } from "@/lib/shopText";
import { BreadcrumbSchema } from "@/components/seo/StructuredData";
import { JsonLd, generateProductItemListSchema } from "@/lib/jsonLd";
import AdroCatalogGrid from "../../components/AdroCatalogGrid";
import {
  ShopPaginationNav,
  paginateProducts,
  COLLECTION_PAGE_SIZE,
} from "../../components/ShopPaginationNav";

// ISR with on-demand rendering — searchParams.page is required for
// server-side pagination, which `force-static` would strip. Each `?page=N`
// URL becomes its own cache entry under `revalidate`.
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(resolvedLocale, "shop/adro/collections", {
    title:
      resolvedLocale === "ua"
        ? "Каталог ADRO | Карбонові аерокіти та деталі | One Company"
        : "ADRO Catalog | Carbon Aero Kits and Components | One Company",
    description:
      resolvedLocale === "ua"
        ? "Повний каталог ADRO з фільтрами за маркою авто, моделлю, платформою та категорією карбонових деталей."
        : "Full ADRO catalog with filters by vehicle make, model, platform, and carbon component category.",
  });
}

export default async function AdroCollectionsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const isUa = resolvedLocale === "ua";
  const sp = searchParams ? await searchParams : {};
  const requestedPage = Math.max(1, Number(sp?.page) || 1);

  const [settingsRecord, adroRows] = await Promise.all([
    getOrCreateShopSettings(prisma),
    getAdroProductsServer(),
  ]);
  const allAdroProducts = adroRows.map(projectShopProductForListGrid);
  const {
    pageProducts: adroProducts,
    currentPage,
    totalPages,
  } = paginateProducts(allAdroProducts, requestedPage, COLLECTION_PAGE_SIZE);

  const viewerContext = buildShopViewerPricingContext(
    getShopSettingsRuntime(settingsRecord),
    null,
    false,
    null
  );

  const listingPath = buildLocalizedPath(resolvedLocale, "/shop/adro/collections");
  const breadcrumbs = [
    {
      name: isUa ? "Головна" : "Home",
      url: absoluteUrl(buildLocalizedPath(resolvedLocale)),
    },
    {
      name: isUa ? "Каталог" : "Shop",
      url: absoluteUrl(buildLocalizedPath(resolvedLocale, "/shop")),
    },
    {
      name: "ADRO",
      url: absoluteUrl(buildLocalizedPath(resolvedLocale, "/shop/adro")),
    },
    {
      name: isUa ? "Колекції" : "Collections",
      url: absoluteUrl(listingPath),
    },
  ];

  const itemListEntries = adroProducts.map((product) => ({
    slug: product.slug,
    title: localizeShopProductTitle(resolvedLocale, product),
    path: buildShopStorefrontProductPathForProduct(resolvedLocale, product),
    image: product.image ?? null,
  }));
  const itemListSchema = generateProductItemListSchema(
    isUa ? "Каталог ADRO" : "ADRO Catalog",
    listingPath,
    itemListEntries
  );

  return (
    <div className="relative min-h-screen bg-background">
      <BreadcrumbSchema items={breadcrumbs} />
      <JsonLd schema={itemListSchema} />
      <div className="fixed inset-0 z-0 pointer-events-none">
        <Image
          src="/images/shop/adro/adro-m3-front.jpg"
          alt="ADRO carbon aero"
          fill
          priority
          className="object-cover opacity-[0.06] grayscale dark:opacity-[0.12]"
        />
        <div className="absolute inset-0 bg-linear-to-b from-background/40 via-background/70 to-background dark:from-[#050505]/85 dark:via-black/92 dark:to-[#030303]" />
        <div className="absolute left-1/2 top-1/4 h-[420px] w-[860px] -translate-x-1/2 rounded-full bg-foreground/[0.025] blur-[190px]" />
      </div>

      <div className="relative z-10 pt-[100px]">
        <div className="mx-auto w-full max-w-[1700px] px-6 pb-4 pt-4 md:px-12 lg:px-16">
          <Link
            href={`/${resolvedLocale}/shop/adro`}
            className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/60 dark:text-foreground/40 transition-colors hover:text-foreground"
          >
            ← {isUa ? "Повернутися до ADRO" : "Return to ADRO"}
          </Link>
        </div>

        <Suspense
          fallback={
            <div className="flex items-center justify-center py-32">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
            </div>
          }
        >
          <AdroCatalogGrid
            locale={resolvedLocale}
            products={allAdroProducts}
            pageProducts={adroProducts}
            currentPage={currentPage}
            totalPages={totalPages}
            basePath={`/${resolvedLocale}/shop/adro/collections`}
            viewerContext={viewerContext}
          />
        </Suspense>
      </div>
    </div>
  );
}
