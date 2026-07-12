import { Suspense } from "react";
import { notFound } from "next/navigation";
import { absoluteUrl, buildLocalizedPath, buildPageMetadata, resolveLocale } from "@/lib/seo";
import BurgerVehicleFilter from "../../components/BurgerVehicleFilter";
import BurgerHeroPicker from "../../components/BurgerHeroPicker";
import { getBurgerProductsServer, projectShopProductForListGrid } from "@/lib/shopCatalogServer";
import { buildShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { buildShopStorefrontProductPathForProduct } from "@/lib/shopStorefrontRouting";
import { localizeShopProductTitle } from "@/lib/shopText";
import { BreadcrumbSchema } from "@/components/seo/StructuredData";
import { JsonLd, generateProductItemListSchema } from "@/lib/jsonLd";
import { paginateProducts, COLLECTION_PAGE_SIZE } from "../../components/ShopPaginationNav";
import Link from "next/link";
import { getPublicShopSettingsRuntime } from "@/lib/shopPublicSettings";

// ISR with path-based pagination; client-side filter queries do not opt the route into SSR.
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
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

export async function renderBurgerProductsCatalogPage({ params }: Props, requestedPage = 1) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  const [settingsRuntime, burgerRows] = await Promise.all([
    getPublicShopSettingsRuntime(),
    getBurgerProductsServer(),
  ]);
  const allBurgerProducts = burgerRows.map(projectShopProductForListGrid);
  const {
    pageProducts: burgerProducts,
    currentPage,
    totalPages,
    isValidPage,
  } = paginateProducts(allBurgerProducts, requestedPage, COLLECTION_PAGE_SIZE);
  if (!isValidPage) notFound();

  const viewerContext = buildShopViewerPricingContext(settingsRuntime, null, false, null);

  const isUa = resolvedLocale === "ua";
  const listingBasePath = buildLocalizedPath(resolvedLocale, "/shop/burger/products");
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
      <h1 className="sr-only">
        {resolvedLocale === "ua"
          ? "Каталог товарів Burger Motorsports"
          : "Burger Motorsports product catalog"}
      </h1>
      <h2 className="sr-only">{resolvedLocale === "ua" ? "Товари" : "Products"}</h2>
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
            pageProducts={burgerProducts}
            currentPage={currentPage}
            totalPages={totalPages}
            basePath={`/${resolvedLocale}/shop/burger/products`}
            viewerContext={viewerContext}
            pickerSlot={
              <Suspense fallback={null}>
                <BurgerHeroPicker locale={resolvedLocale} />
              </Suspense>
            }
          />
        </Suspense>
      </div>
    </div>
  );
}

export default function BurgerProductsCatalogPage(props: Props) {
  return renderBurgerProductsCatalogPage(props);
}
