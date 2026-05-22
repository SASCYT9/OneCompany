import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { absoluteUrl, buildLocalizedPath, buildPageMetadata, resolveLocale } from "@/lib/seo";
import { getGirodiscProductsServer, projectShopProductForListGrid } from "@/lib/shopCatalogServer";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { buildShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { buildShopStorefrontProductPathForProduct } from "@/lib/shopStorefrontRouting";
import { localizeShopProductTitle } from "@/lib/shopText";
import { BreadcrumbSchema } from "@/components/seo/StructuredData";
import { JsonLd, generateProductItemListSchema } from "@/lib/jsonLd";
import Link from "next/link";
import GirodiscVehicleFilter from "../../components/GirodiscVehicleFilter";
import {
  ShopPaginationNav,
  paginateProducts,
  COLLECTION_PAGE_SIZE,
} from "../../components/ShopPaginationNav";

// ISR with on-demand rendering — searchParams.page drives server-side pagination.
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(resolvedLocale, "shop/girodisc/catalog", {
    title:
      resolvedLocale === "ua"
        ? "GiroDisc Каталог | Гальмівні системи | One Company"
        : "GiroDisc Catalog | Brake Systems | One Company",
    description:
      resolvedLocale === "ua"
        ? "Повний каталог високопродуктивних гальмівних дисків та комплектуючих від GiroDisc. Плаваючі двоскладові ротори."
        : "Full catalog of high-performance brake rotors and hardware from GiroDisc. Floating 2-piece rotors.",
  });
}

export default async function GirodiscProductsCatalogPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const sp = searchParams ? await searchParams : {};
  const requestedPage = Math.max(1, Number(sp?.page) || 1);

  const [settingsRecord, girodiscRows] = await Promise.all([
    getOrCreateShopSettings(prisma),
    getGirodiscProductsServer(),
  ]);
  const allGirodiscProducts = girodiscRows.map(projectShopProductForListGrid);
  const {
    pageProducts: girodiscProducts,
    currentPage,
    totalPages,
  } = paginateProducts(allGirodiscProducts, requestedPage, COLLECTION_PAGE_SIZE);

  const viewerContext = buildShopViewerPricingContext(
    getShopSettingsRuntime(settingsRecord),
    null,
    false,
    null
  );

  const isUa = resolvedLocale === "ua";
  const listingPath = buildLocalizedPath(resolvedLocale, "/shop/girodisc/catalog");
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
      name: "GiroDisc",
      url: absoluteUrl(buildLocalizedPath(resolvedLocale, "/shop/girodisc")),
    },
    {
      name: isUa ? "Каталог" : "Catalog",
      url: absoluteUrl(listingPath),
    },
  ];
  const itemListEntries = girodiscProducts.map((product) => ({
    slug: product.slug,
    title: localizeShopProductTitle(resolvedLocale, product),
    path: buildShopStorefrontProductPathForProduct(resolvedLocale, product),
    image: product.image ?? null,
  }));
  const itemListSchema = generateProductItemListSchema(
    isUa ? "Каталог GiroDisc" : "GiroDisc Catalog",
    listingPath,
    itemListEntries
  );

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden selection:bg-red-600 selection:text-white font-sans">
      <BreadcrumbSchema items={breadcrumbs} />
      <JsonLd schema={itemListSchema} />
      {/* Stealth Wealth Atmosphere — dark only */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-red-600 opacity-[0.03] blur-[200px] pointer-events-none z-0 rounded-full hidden dark:block" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04)_0,transparent_1px)] bg-size-[5px_5px] opacity-10 mix-blend-overlay pointer-events-none z-0 hidden dark:block" />

      <div className="relative z-10 pt-[140px] max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-20">
        {/* Back Link — no z-50 here: it would tie with the mobile filter
            drawer (z-50) and bleed through it on phones, letting users tap
            the back link by accident. Parent `relative z-10` already keeps
            it above the bg glow/noise overlays (z-0). */}
        <div className="mb-4">
          <Link
            href={`/${resolvedLocale}/shop/girodisc`}
            className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 hover:text-white transition-colors font-light flex items-center gap-2"
          >
            <span className="opacity-50">←</span> {isUa ? "Головна GiroDisc" : "GiroDisc Home"}
          </Link>
        </div>

        {/* Live Filter Catalog — wrapped in Suspense for useSearchParams */}
        <div className="-mx-6 md:mx-0">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-32">
                <div className="w-8 h-8 border-2 border-white/20 border-t-red-600 rounded-full animate-spin" />
              </div>
            }
          >
            <GirodiscVehicleFilter
              locale={resolvedLocale}
              products={girodiscProducts}
              viewerContext={viewerContext}
            />
          </Suspense>

          <ShopPaginationNav
            locale={resolvedLocale}
            currentPage={currentPage}
            totalPages={totalPages}
            basePath={`/${resolvedLocale}/shop/girodisc/catalog`}
          />
        </div>
      </div>
    </div>
  );
}
