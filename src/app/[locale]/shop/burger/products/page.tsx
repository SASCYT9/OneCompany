import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { absoluteUrl, buildLocalizedPath, buildPageMetadata, resolveLocale } from "@/lib/seo";
import BurgerVehicleFilter from "../../components/BurgerVehicleFilter";
import BurgerHeroPicker from "../../components/BurgerHeroPicker";
import { getBurgerProductsServer, projectShopProductForListGrid } from "@/lib/shopCatalogServer";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { buildShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { buildShopStorefrontProductPathForProduct } from "@/lib/shopStorefrontRouting";
import { localizeShopProductTitle } from "@/lib/shopText";
import { BreadcrumbSchema } from "@/components/seo/StructuredData";
import { JsonLd, generateProductItemListSchema } from "@/lib/jsonLd";
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
  return buildPageMetadata(resolvedLocale, "shop/burger/products", {
    title:
      resolvedLocale === "ua"
        ? "Каталог Burger Motorsports | JB4 Tuners & Parts | One Company"
        : "Burger Motorsports Catalog | JB4 Tuners & Parts | One Company",
    description:
      resolvedLocale === "ua"
        ? "Повний каталог JB4 тюнерів, flex fuel кітів, інтейків та performance деталей для BMW та 30+ марок."
        : "Full catalog of JB4 tuners, flex fuel kits, intakes and performance parts for BMW and 30+ brands.",
  });
}

export default async function BurgerProductsCatalogPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const sp = searchParams ? await searchParams : {};
  const requestedPage = Math.max(1, Number(sp?.page) || 1);

  const [settingsRecord, burgerRows] = await Promise.all([
    getOrCreateShopSettings(prisma),
    getBurgerProductsServer(),
  ]);
  const allBurgerProducts = burgerRows.map(projectShopProductForListGrid);
  const {
    pageProducts: burgerProducts,
    currentPage,
    totalPages,
  } = paginateProducts(allBurgerProducts, requestedPage, COLLECTION_PAGE_SIZE);

  const viewerContext = buildShopViewerPricingContext(
    getShopSettingsRuntime(settingsRecord),
    null,
    false,
    null
  );

  const isUa = resolvedLocale === "ua";
  const listingPath = buildLocalizedPath(resolvedLocale, "/shop/burger/products");
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
      name: "Burger Motorsports",
      url: absoluteUrl(buildLocalizedPath(resolvedLocale, "/shop/burger")),
    },
    {
      name: isUa ? "Каталог" : "Catalog",
      url: absoluteUrl(listingPath),
    },
  ];
  const itemListEntries = burgerProducts.map((product) => ({
    slug: product.slug,
    title: localizeShopProductTitle(resolvedLocale, product),
    path: buildShopStorefrontProductPathForProduct(resolvedLocale, product),
    image: product.image ?? null,
  }));
  const itemListSchema = generateProductItemListSchema(
    isUa ? "Каталог Burger Motorsports" : "Burger Motorsports Catalog",
    listingPath,
    itemListEntries
  );

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <BreadcrumbSchema items={breadcrumbs} />
      <JsonLd schema={itemListSchema} />
      <div style={{ paddingTop: "100px" }}>
        <div className="burger-back">
          <Link href={`/${locale}/shop/burger`} className="burger-back__link">
            ← {resolvedLocale === "ua" ? "Головна Burger" : "Burger home"}
          </Link>
        </div>

        <Suspense fallback={null}>
          <BurgerVehicleFilter
            locale={resolvedLocale}
            products={burgerProducts}
            viewerContext={viewerContext}
            pickerSlot={
              <Suspense fallback={null}>
                <BurgerHeroPicker locale={resolvedLocale} />
              </Suspense>
            }
          />
        </Suspense>

        <ShopPaginationNav
          locale={resolvedLocale}
          currentPage={currentPage}
          totalPages={totalPages}
          basePath={`/${resolvedLocale}/shop/burger/products`}
        />
      </div>
    </div>
  );
}
