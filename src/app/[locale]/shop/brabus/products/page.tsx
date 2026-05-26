import { prisma } from "@/lib/prisma";
import { absoluteUrl, buildLocalizedPath, buildPageMetadata, resolveLocale } from "@/lib/seo";
import BrabusVehicleFilter from "../../components/BrabusVehicleFilter";
import BrabusVideoBackground from "../../components/BrabusVideoBackground";
import { getBrabusProductsServer, projectShopProductForListGrid } from "@/lib/shopCatalogServer";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { buildShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { buildShopStorefrontProductPathForProduct } from "@/lib/shopStorefrontRouting";
import { localizeShopProductTitle } from "@/lib/shopText";
import { BreadcrumbSchema } from "@/components/seo/StructuredData";
import { JsonLd, generateProductItemListSchema } from "@/lib/jsonLd";
import { isFactoryOnlyProduct } from "@/lib/brabusFactoryOnly";
import { isBrabusExhaustProduct } from "@/lib/brabusCatalogExclusions";
import {
  ShopPaginationNav,
  paginateProducts,
  COLLECTION_PAGE_SIZE,
} from "../../components/ShopPaginationNav";
import Link from "next/link";

// ISR with on-demand rendering — searchParams.page drives server-side pagination.
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(resolvedLocale, "shop/brabus/products", {
    title:
      resolvedLocale === "ua"
        ? "Каталог компонентів Brabus | One Company"
        : "Brabus Component Catalog | One Company",
    description:
      resolvedLocale === "ua"
        ? "Повний каталог преміальних компонентів для тюнінгу Brabus. Аеродинаміка, диски, вихлопні системи."
        : "Full catalog of premium Brabus tuning components. Aerodynamics, wheels, exhaust systems.",
  });
}

export default async function BrabusProductsCatalogPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const sp = searchParams ? await searchParams : {};
  const requestedPage = Math.max(1, Number(sp?.page) || 1);

  const [settingsRecord, allBrabusProducts] = await Promise.all([
    getOrCreateShopSettings(prisma),
    getBrabusProductsServer(),
  ]);

  const viewerContext = buildShopViewerPricingContext(
    getShopSettingsRuntime(settingsRecord),
    null,
    false,
    null
  );

  const allFilteredBrabusProducts = allBrabusProducts.map(projectShopProductForListGrid);
  const {
    pageProducts: brabusProducts,
    currentPage,
    totalPages,
  } = paginateProducts(allFilteredBrabusProducts, requestedPage, COLLECTION_PAGE_SIZE);

  const isUa = resolvedLocale === "ua";
  const listingPath = buildLocalizedPath(resolvedLocale, "/shop/brabus/products");
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
      name: "Brabus",
      url: absoluteUrl(buildLocalizedPath(resolvedLocale, "/shop/brabus")),
    },
    {
      name: isUa ? "Каталог компонентів" : "Component catalog",
      url: absoluteUrl(listingPath),
    },
  ];
  const itemListEntries = brabusProducts.map((product) => ({
    slug: product.slug,
    title: localizeShopProductTitle(resolvedLocale, product),
    path: buildShopStorefrontProductPathForProduct(resolvedLocale, product),
    image: product.image ?? null,
  }));
  const itemListSchema = generateProductItemListSchema(
    isUa ? "Каталог компонентів Brabus" : "Brabus Component Catalog",
    listingPath,
    itemListEntries
  );

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <BreadcrumbSchema items={breadcrumbs} />
      <JsonLd schema={itemListSchema} />
      {/* Cinematic video backdrop */}
      <div className="fixed inset-0 z-0">
        <BrabusVideoBackground
          videoSrc="/videos/shop/brabus/brabus-hero-new.mp4"
          fallbackImage="/images/shop/brabus/hq/brabus-supercars-26.jpg"
        />
        <div className="absolute inset-0 bg-transparent dark:bg-black/65 backdrop-blur-xl" />
      </div>

      <div className="relative z-10 pt-[100px]">
        <div className="w-full max-w-[1600px] mx-auto px-6 md:px-12 lg:px-16 pb-6">
          <Link
            href={`/${locale}/shop/brabus`}
            className="text-[10px] uppercase tracking-[0.2em] text-foreground/55 dark:text-white/40 hover:text-foreground dark:hover:text-white transition-colors"
          >
            ← {resolvedLocale === "ua" ? "Головна Brabus" : "Brabus home"}
          </Link>
        </div>
        <BrabusVehicleFilter
          locale={resolvedLocale}
          products={allFilteredBrabusProducts}
          pageProducts={brabusProducts}
          currentPage={currentPage}
          totalPages={totalPages}
          basePath={`/${resolvedLocale}/shop/brabus/products`}
          viewerContext={viewerContext}
        />
      </div>
    </div>
  );
}
