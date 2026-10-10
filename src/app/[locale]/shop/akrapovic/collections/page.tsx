import { absoluteUrl, buildLocalizedPath, buildPageMetadata, resolveLocale } from "@/lib/seo";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getAkrapovicProductsServer, projectShopProductForListGrid } from "@/lib/shopCatalogServer";
import { getPublicShopSettingsRuntime } from "@/lib/shopPublicSettings";
import { buildShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { BreadcrumbSchema } from "@/components/seo/StructuredData";
import { JsonLd, generateProductItemListSchema } from "@/lib/jsonLd";
import { buildShopStorefrontProductPathForProduct } from "@/lib/shopStorefrontRouting";
import { localizeShopProductTitle } from "@/lib/shopText";
import {
  AKRAPOVIC_LISTING_BASE_SLUG,
  AKRAPOVIC_LISTING_PAGE_SIZE,
  buildAkrapovicInitialQuery,
  buildAkrapovicListingPath,
  isAkrapovicMotoScope,
  resolveAkrapovicPagination,
  sortAkrapovicProducts,
  type AkrapovicListingSearchParams,
} from "@/lib/akrapovicListing";
import AkrapovicVehicleFilter from "../../components/AkrapovicVehicleFilter";

// ISR: anonymous SSR; B2B prices applied client-side via useShopViewerContext.
// Cache-bust 2026-05-14T22: Vercel ISR cache held empty/errored renders for many brand routes — likely DB pool exhaustion during a build/revalidate window. Touching to rebuild.
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<AkrapovicListingSearchParams>;
};

export async function generateMetadata({ params, searchParams }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const isMoto = isAkrapovicMotoScope(await searchParams);
  return buildPageMetadata(resolvedLocale, AKRAPOVIC_LISTING_BASE_SLUG, {
    title:
      resolvedLocale === "ua"
        ? isMoto
          ? "Каталог Мотопродукції Akrapovič | One Company"
          : "Каталог Автопродукції Akrapovič | One Company"
        : isMoto
          ? "Akrapovič Motorcycle Exhausts Catalog | One Company"
          : "Akrapovič Car Exhausts Catalog | One Company",
    description:
      resolvedLocale === "ua"
        ? isMoto
          ? "Повний каталог преміальних титанових та карбонових вихлопних систем Akrapovič для мотоциклів BMW та Ducati."
          : "Повний каталог преміальних титанових та карбонових вихлопних систем Akrapovič для BMW, Porsche, AMG, Audi, Ferrari."
        : isMoto
          ? "Full catalog of premium Akrapovič titanium exhaust systems for BMW and Ducati motorcycles."
          : "Full catalog of premium Akrapovič titanium & carbon fibre exhaust systems for BMW, Porsche, AMG, Audi, Ferrari.",
  });
}

/**
 * The catalog list. `requestedPage` > 1 is used by the crawlable
 * `/collections/page/N` routes: they render this same page, starting at that
 * page of the default (car) listing, so the products beyond the first
 * "Show more" step are reachable through plain links.
 */
export default async function AkrapovicCollectionsPage(
  { params, searchParams }: Props,
  requestedPage = 1
) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const query = await searchParams;
  const isMoto = isAkrapovicMotoScope(query);

  const [settingsRecord, akrapovicRows] = await Promise.all([
    getPublicShopSettingsRuntime(),
    getAkrapovicProductsServer(),
  ]);
  const akrapovicProducts = akrapovicRows.map(projectShopProductForListGrid);
  const carProducts = akrapovicProducts.filter((product) => product.scope !== "moto");
  const motoProducts = akrapovicProducts.filter((product) => product.scope === "moto");

  const pagination = resolveAkrapovicPagination(carProducts.length, requestedPage);
  if (!pagination.isValidPage) notFound();

  const viewerContext = buildShopViewerPricingContext(settingsRecord, null, false, null);

  // ItemList describes the products this URL actually opens with, in the order
  // the grid shows them (same comparator and default currency as the client).
  const sorted = sortAkrapovicProducts(isMoto ? motoProducts : carProducts, "default", {
    viewerContext,
    currency: "UAH",
    rates: settingsRecord.currencyRates,
  });
  const pageStart = isMoto ? 0 : (requestedPage - 1) * AKRAPOVIC_LISTING_PAGE_SIZE;
  const listedProducts = sorted.slice(pageStart, pageStart + AKRAPOVIC_LISTING_PAGE_SIZE);

  const listingPath = buildAkrapovicListingPath(resolvedLocale, isMoto ? 1 : requestedPage);
  const itemListSchema = generateProductItemListSchema(
    isMoto ? "Akrapovič Motorcycle Exhausts Catalog" : "Akrapovič Car Exhausts Catalog",
    listingPath,
    listedProducts.map((product) => ({
      slug: product.slug,
      title: localizeShopProductTitle(resolvedLocale, product),
      path: buildShopStorefrontProductPathForProduct(resolvedLocale, product),
      image: product.image ?? null,
    }))
  );
  const breadcrumbs = [
    {
      name: resolvedLocale === "ua" ? "Головна" : "Home",
      url: absoluteUrl(buildLocalizedPath(resolvedLocale)),
    },
    {
      name: resolvedLocale === "ua" ? "Магазин" : "Shop",
      url: absoluteUrl(buildLocalizedPath(resolvedLocale, "/shop")),
    },
    {
      name: "Akrapovič",
      url: absoluteUrl(buildLocalizedPath(resolvedLocale, "/shop/akrapovic")),
    },
    {
      name:
        resolvedLocale === "ua"
          ? isMoto
            ? "Каталог мото"
            : "Каталог авто"
          : isMoto
            ? "Motorcycle catalog"
            : "Car catalog",
      url: absoluteUrl(listingPath),
    },
  ];

  return (
    <>
      <BreadcrumbSchema items={breadcrumbs} />
      <JsonLd schema={itemListSchema} />
      <h1 className="sr-only">
        {resolvedLocale === "ua"
          ? isMoto
            ? "Каталог вихлопних систем Akrapovič для мотоциклів"
            : "Каталог вихлопних систем Akrapovič для авто"
          : isMoto
            ? "Akrapovič motorcycle exhaust catalog"
            : "Akrapovič car exhaust catalog"}
      </h1>
      <div className="relative min-h-screen bg-background text-foreground">
        {/* Cinematic factory backdrop — only in dark theme; light theme shows clean cream */}
        <div className="fixed inset-0 z-0 hidden dark:block">
          <Image
            src="/images/shop/akrapovic/factory-fallback.jpg"
            alt="Akrapovic Factory"
            fill
            priority
            className="object-cover opacity-20 sepia-[.2] hue-rotate-[-30deg]"
          />
          <div className="absolute inset-0 bg-linear-to-b from-[#0a0000]/65 via-black/85 to-[#050000] backdrop-blur-sm" />

          {/* Signature Red Accent Ambient Glow */}
          <div className="absolute top-0 right-1/4 w-[1000px] h-[500px] bg-[#e50000]/10 blur-[150px] rounded-full pointer-events-none mix-blend-screen opacity-50" />
        </div>

        <div className="relative z-10 pt-[100px]">
          <div className="w-full max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-6">
            <Link
              href={`/${locale}/shop/akrapovic${isMoto ? "?segment=moto" : "?segment=auto"}`}
              className="text-[10px] uppercase tracking-[0.2em] text-foreground/55 dark:text-white/40 hover:text-foreground dark:hover:text-white transition-colors"
            >
              ←{" "}
              {resolvedLocale === "ua"
                ? isMoto
                  ? "Головна Akrapovič Moto"
                  : "Головна Akrapovič Auto"
                : isMoto
                  ? "Akrapovič Moto Home"
                  : "Akrapovič Auto Home"}
            </Link>
          </div>

          <AkrapovicVehicleFilter
            locale={resolvedLocale}
            products={akrapovicProducts}
            viewerContext={viewerContext}
            productPathPrefix={`/${locale}/shop/akrapovic/products`}
            initialQuery={buildAkrapovicInitialQuery(query)}
            scope={isMoto ? "moto" : "auto"}
            pagination={
              isMoto
                ? undefined
                : {
                    page: requestedPage,
                    basePath: `/${resolvedLocale}/${AKRAPOVIC_LISTING_BASE_SLUG}`,
                  }
            }
          />
        </div>
      </div>
    </>
  );
}
