import { absoluteUrl, buildLocalizedPath, buildPageMetadata, resolveLocale } from "@/lib/seo";
import { notFound } from "next/navigation";
import BrabusVehicleFilter from "../../components/BrabusVehicleFilter";
import BrabusVideoBackground from "../../components/BrabusVideoBackground";
import { getBrabusProductsServer, projectShopProductForListGrid } from "@/lib/shopCatalogServer";
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

export async function renderBrabusProductsCatalogPage({ params }: Props, requestedPage = 1) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  const [settingsRuntime, allBrabusProducts] = await Promise.all([
    getPublicShopSettingsRuntime(),
    getBrabusProductsServer(),
  ]);

  const viewerContext = buildShopViewerPricingContext(settingsRuntime, null, false, null);

  const allFilteredBrabusProducts = allBrabusProducts.map(projectShopProductForListGrid);
  const {
    pageProducts: brabusProducts,
    currentPage,
    totalPages,
    isValidPage,
  } = paginateProducts(allFilteredBrabusProducts, requestedPage, COLLECTION_PAGE_SIZE);
  if (!isValidPage) notFound();

  const isUa = resolvedLocale === "ua";
  const listingBasePath = buildLocalizedPath(resolvedLocale, "/shop/brabus/products");
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
      <h1 className="sr-only">
        {resolvedLocale === "ua" ? "Каталог товарів Brabus" : "Brabus product catalog"}
      </h1>
      <h2 className="sr-only">{resolvedLocale === "ua" ? "Товари" : "Products"}</h2>
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
          products={brabusProducts}
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

export default function BrabusProductsCatalogPage(props: Props) {
  return renderBrabusProductsCatalogPage(props);
}
