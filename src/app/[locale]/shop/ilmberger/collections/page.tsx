import { prisma } from "@/lib/prisma";
import { absoluteUrl, buildLocalizedPath, buildPageMetadata, resolveLocale } from "@/lib/seo";
import { getIlmbergerProductsServer, projectShopProductForListGrid } from "@/lib/shopCatalogServer";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { buildShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { BreadcrumbSchema } from "@/components/seo/StructuredData";
import { JsonLd, generateProductItemListSchema } from "@/lib/jsonLd";
import { buildShopStorefrontProductPathForProduct } from "@/lib/shopStorefrontRouting";
import { localizeShopProductTitle } from "@/lib/shopText";
import IlmbergerCatalog from "../../components/IlmbergerCatalog";

// SSR with `force-static` means we cache the anon-context render publicly;
// per-customer per-brand maps would defeat caching. The system-wide brand
// map is safe to bake into the static HTML (it's the same for every B2B
// viewer) — per-customer overrides are layered on top client-side via
// `useShopViewerContext()` once the session loads.
export const dynamic = "force-static";
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(resolvedLocale, "shop/ilmberger/collections", {
    title:
      resolvedLocale === "ua"
        ? "Каталог Ilmberger Carbon — карбонові деталі | One Company"
        : "Ilmberger Carbon Catalog — Carbon Parts | One Company",
    description:
      resolvedLocale === "ua"
        ? "Повний каталог карбонових деталей Ilmberger: обтічники, накладки на бак, крила, захист рами, захист колеса та приладові панелі."
        : "Full catalog of Ilmberger carbon parts: fairings, tank covers, fenders, frame protection, wheel covers, and instrument dashes.",
  });
}

export default async function IlmbergerCollectionsPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  const [settingsRecord, ilmbergerRows] = await Promise.all([
    getOrCreateShopSettings(prisma),
    getIlmbergerProductsServer(),
  ]);
  const ilmbergerProducts = ilmbergerRows.map(projectShopProductForListGrid);

  const viewerContext = buildShopViewerPricingContext(
    getShopSettingsRuntime(settingsRecord),
    null,
    false,
    null
  );

  const listingPath = buildLocalizedPath(resolvedLocale, "/shop/ilmberger/collections");
  const itemListSchema = generateProductItemListSchema(
    resolvedLocale === "ua" ? "Каталог Ilmberger Carbon" : "Ilmberger Carbon Catalog",
    listingPath,
    ilmbergerProducts.map((product) => ({
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
      name: "Ilmberger Carbon",
      url: absoluteUrl(buildLocalizedPath(resolvedLocale, "/shop/ilmberger")),
    },
    {
      name: resolvedLocale === "ua" ? "Каталог" : "Catalog",
      url: absoluteUrl(listingPath),
    },
  ];

  return (
    <>
      <BreadcrumbSchema items={breadcrumbs} />
      <JsonLd schema={itemListSchema} />
      <IlmbergerCatalog
        locale={resolvedLocale}
        products={ilmbergerProducts}
        viewerContext={viewerContext}
      />
    </>
  );
}
