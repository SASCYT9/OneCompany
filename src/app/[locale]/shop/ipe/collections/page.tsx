import { Suspense } from "react";
import { absoluteUrl, buildLocalizedPath, buildPageMetadata, resolveLocale } from "@/lib/seo";
import Link from "next/link";
import { getPublicShopSettingsRuntime } from "@/lib/shopPublicSettings";
import Image from "next/image";
import { getIpeProductsServer, projectShopProductForListGrid } from "@/lib/shopCatalogServer";
import { buildShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { buildShopStorefrontProductPathForProduct } from "@/lib/shopStorefrontRouting";
import { localizeShopProductTitle } from "@/lib/shopText";
import { BreadcrumbSchema } from "@/components/seo/StructuredData";
import { JsonLd, generateProductItemListSchema } from "@/lib/jsonLd";
import IpeVehicleFilter from "../../components/IpeVehicleFilter";
import { paginateProducts, COLLECTION_PAGE_SIZE } from "../../components/ShopPaginationNav";

// ISR with on-demand rendering — searchParams.page drives server-side pagination.
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(resolvedLocale, "shop/ipe/collections", {
    title:
      resolvedLocale === "ua"
        ? "Каталог Продукції iPE | Innotech Performance Exhaust | One Company"
        : "iPE Product Catalog | Innotech Performance Exhaust | One Company",
    description:
      resolvedLocale === "ua"
        ? "Повний каталог преміальних вихлопних систем iPE: Valvetronic, Downpipe, Headers та аксесуари."
        : "Full catalog of premium iPE exhaust systems: Valvetronic, Downpipe, Headers and accessories.",
  });
}

export default async function IpeCollectionsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const sp = searchParams ? await searchParams : {};
  const requestedPage = Math.max(1, Number(sp?.page) || 1);

  const [settingsRuntime, ipeRows] = await Promise.all([
    getPublicShopSettingsRuntime(),
    getIpeProductsServer(),
  ]);
  const allIpeProducts = ipeRows.map(projectShopProductForListGrid);
  const {
    pageProducts: ipeProducts,
    currentPage,
    totalPages,
  } = paginateProducts(allIpeProducts, requestedPage, COLLECTION_PAGE_SIZE);

  const viewerContext = buildShopViewerPricingContext(settingsRuntime, null, false, null);

  const isUa = resolvedLocale === "ua";
  const listingBasePath = buildLocalizedPath(resolvedLocale, "/shop/ipe/collections");
  const listingPath =
    currentPage === 1 ? listingBasePath : `${listingBasePath}/page/${currentPage}`;
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
      name: "iPE",
      url: absoluteUrl(buildLocalizedPath(resolvedLocale, "/shop/ipe")),
    },
    {
      name: isUa ? "Каталог" : "Catalog",
      url: absoluteUrl(listingPath),
    },
  ];
  const itemListEntries = ipeProducts.map((product) => ({
    slug: product.slug,
    title: localizeShopProductTitle(resolvedLocale, product),
    path: buildShopStorefrontProductPathForProduct(resolvedLocale, product),
    image: product.image ?? null,
  }));
  const itemListSchema = generateProductItemListSchema(
    isUa ? "Каталог iPE" : "iPE Catalog",
    listingPath,
    itemListEntries
  );

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <BreadcrumbSchema items={breadcrumbs} />
      <JsonLd schema={itemListSchema} />
      {/* Cinematic backdrop — only in dark theme; light theme shows clean cream */}
      <div className="fixed inset-0 z-0 hidden dark:block">
        <Image
          src="/images/shop/ipe/ipe-factory.png"
          alt="iPE Workshop"
          fill
          priority
          className="object-cover opacity-20 sepia-[.4] hue-rotate-[-10deg]"
        />
        <div className="absolute inset-0 bg-linear-to-b from-[#0a0600]/80 via-black/90 to-[#050300] backdrop-blur-[10px]" />

        {/* Signature Bronze Accent Ambient Glow */}
        <div className="absolute top-1/4 right-1/4 w-[800px] h-[400px] bg-[#c29d59]/5 blur-[200px] rounded-full pointer-events-none mix-blend-screen opacity-50" />
      </div>

      <div className="relative z-10 pt-[100px]">
        <div className="w-full max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-6 pt-4">
          <Link
            href={`/${locale}/shop/ipe`}
            className="text-[10px] uppercase tracking-[0.2em] text-[#c29d59]/70 hover:text-[#c29d59] transition-colors font-semibold"
          >
            ← {resolvedLocale === "ua" ? "Повернутися до iPE" : "Return to iPE"}
          </Link>
        </div>

        <Suspense
          fallback={
            <div className="flex items-center justify-center py-32">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c29d59]/30 border-t-[#c29d59]" />
            </div>
          }
        >
          <IpeVehicleFilter
            locale={resolvedLocale}
            products={ipeProducts}
            pageProducts={ipeProducts}
            currentPage={currentPage}
            totalPages={totalPages}
            basePath={`/${resolvedLocale}/shop/ipe/collections`}
            viewerContext={viewerContext}
            productPathPrefix={`/${locale}/shop/ipe/products`}
          />
        </Suspense>
      </div>
    </div>
  );
}
