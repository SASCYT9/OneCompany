import { absoluteUrl, buildLocalizedPath, buildPageMetadata, resolveLocale } from "@/lib/seo";
import { localizeShopProductTitle } from "@/lib/shopText";
import { prisma } from "@/lib/prisma";
import { ADRO_PRODUCT_LINES } from "../../../data/adroHomeData";
import { getAdroProductsServer } from "@/lib/shopCatalogServer";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { buildShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { getProductsForAdroCollection } from "@/lib/adroCollectionMatcher";
import { buildShopStorefrontProductPathForProduct } from "@/lib/shopStorefrontRouting";
import { BreadcrumbSchema } from "@/components/seo/StructuredData";
import { JsonLd, generateProductItemListSchema } from "@/lib/jsonLd";
import AdroCollectionProductGrid from "../../../components/AdroCollectionProductGrid";
import { notFound } from "next/navigation";

// ISR: anonymous SSR; B2B prices applied client-side via useShopViewerContext.
// Cache-bust 2026-05-14T22: Vercel ISR cache held empty/errored renders for many brand routes — likely DB pool exhaustion during a build/revalidate window. Touching to rebuild.
export const dynamic = "force-static";
export const revalidate = 3600;
export const dynamicParams = false;

type Props = {
  params: Promise<{ locale: string; handle: string }>;
};

export async function generateStaticParams() {
  return ADRO_PRODUCT_LINES.map((line) => ({ handle: line.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; handle: string }>;
}) {
  const { locale, handle } = await params;
  const resolvedLocale = resolveLocale(locale);
  const line = ADRO_PRODUCT_LINES.find((l) => l.id === handle);
  if (!line) notFound();
  const title = line
    ? `${resolvedLocale === "ua" ? line.nameUk : line.name} | ADRO | One Company`
    : `${handle} | ADRO | One Company`;

  return buildPageMetadata(resolvedLocale, `shop/adro/collections/${handle}`, {
    title,
    description:
      resolvedLocale === "ua"
        ? `Програма ADRO для ${line?.nameUk ?? handle}. Препрег-карбон і CFD-аеродинаміка рівня F1.`
        : `ADRO aerodynamic program for ${line?.name ?? handle}. Prepreg carbon and F1-level CFD aero.`,
  });
}

export default async function AdroCollectionHandlePage({ params }: Props) {
  const { locale, handle } = await params;
  const resolvedLocale = resolveLocale(locale);
  const line = ADRO_PRODUCT_LINES.find((l) => l.id === handle);
  if (!line) notFound();

  const [settingsRecord, products] = await Promise.all([
    getOrCreateShopSettings(prisma),
    getAdroProductsServer(),
  ]);

  const viewerContext = buildShopViewerPricingContext(
    getShopSettingsRuntime(settingsRecord),
    null,
    false,
    null
  );

  const collectionProducts = getProductsForAdroCollection(products, handle);

  // Sort: Full Kit first, then by price desc
  const sortedProducts = [...collectionProducts].sort((a, b) => {
    const titleA = localizeShopProductTitle(resolvedLocale, a).toLowerCase();
    const titleB = localizeShopProductTitle(resolvedLocale, b).toLowerCase();
    const isKitA =
      titleA.includes("kit") || titleA.includes("widebody") || titleA.includes("full body");
    const isKitB =
      titleB.includes("kit") || titleB.includes("widebody") || titleB.includes("full body");
    if (isKitA && !isKitB) return -1;
    if (!isKitA && isKitB) return 1;
    const priceA = a.price?.usd || a.price?.eur || a.price?.uah || 0;
    const priceB = b.price?.usd || b.price?.eur || b.price?.uah || 0;
    return priceB - priceA;
  });

  const isUa = resolvedLocale === "ua";
  const lineLabel = line ? (isUa ? line.nameUk : line.name) : handle;
  const handlePath = buildLocalizedPath(resolvedLocale, `/shop/adro/collections/${handle}`);
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
      url: absoluteUrl(buildLocalizedPath(resolvedLocale, "/shop/adro/collections")),
    },
    {
      name: lineLabel,
      url: absoluteUrl(handlePath),
    },
  ];
  const itemListEntries = sortedProducts.map((product) => ({
    slug: product.slug,
    title: localizeShopProductTitle(resolvedLocale, product),
    path: buildShopStorefrontProductPathForProduct(resolvedLocale, product),
    image: product.image ?? null,
  }));
  const itemListSchema = generateProductItemListSchema(
    `${isUa ? "ADRO — " : "ADRO — "}${lineLabel}`,
    handlePath,
    itemListEntries
  );

  return (
    <>
      <BreadcrumbSchema items={breadcrumbs} />
      <JsonLd schema={itemListSchema} />
      <AdroCollectionProductGrid
        locale={resolvedLocale}
        handle={handle}
        title={lineLabel}
        brand="ADRO Aero"
        products={sortedProducts}
        viewerContext={viewerContext}
      />
    </>
  );
}
