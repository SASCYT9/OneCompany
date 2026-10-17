import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import { BRAND_HOME_HEAD } from "@/lib/seoHubHeadCopy";
import { JsonLd, generateBrandSchema } from "@/lib/jsonLd";
import { getIlmbergerProductsServer } from "@/lib/shopCatalogServer";
import { getPublicShopSettingsRuntime } from "@/lib/shopPublicSettings";
import { buildShopViewerPricingContext } from "@/lib/shopPricingAudience";
import IlmbergerHomeSignature from "../components/IlmbergerHomeSignature";

export const dynamic = "force-static";
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(
    resolvedLocale,
    "shop/ilmberger",
    BRAND_HOME_HEAD.ilmberger[resolvedLocale]
  );
}

export default async function ShopIlmbergerPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  const [settingsRecord, ilmbergerProducts] = await Promise.all([
    getPublicShopSettingsRuntime(),
    getIlmbergerProductsServer(),
  ]);

  const viewerContext = buildShopViewerPricingContext(settingsRecord, null, false, null);
  // The storytelling home only counts products per bike model from their tags;
  // descriptions, variant rows and galleries made the page 1.2 MB of props.
  const portalProducts = ilmbergerProducts.map((product) => ({
    ...product,
    shortDescription: { ua: "", en: "" },
    longDescription: { ua: "", en: "" },
    variants: undefined,
    gallery: undefined,
    galleryMaterials: undefined,
  }));

  const description =
    resolvedLocale === "ua"
      ? "Автоклавний препрег-карбон ручної укладки для BMW S1000RR, Ducati Panigale V4, Aprilia RSV4 та Yamaha R1. Виготовлено в Ліндберзі, Німеччина з 1995 року."
      : "Autoclaved hand-laid prepreg carbon for BMW S1000RR, Ducati Panigale V4, Aprilia RSV4, and Yamaha R1. Made in Lindberg, Germany since 1995.";

  return (
    <>
      <JsonLd
        schema={generateBrandSchema({
          locale: resolvedLocale,
          slug: "shop/ilmberger",
          brandName: "Ilmberger Carbon",
          description,
        })}
      />
      <IlmbergerHomeSignature
        locale={resolvedLocale}
        products={portalProducts}
        viewerContext={viewerContext}
      />
    </>
  );
}
