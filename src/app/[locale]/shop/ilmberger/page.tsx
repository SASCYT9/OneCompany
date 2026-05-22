import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import { JsonLd, generateBrandSchema } from "@/lib/jsonLd";
import { prisma } from "@/lib/prisma";
import { getIlmbergerProductsServer } from "@/lib/shopCatalogServer";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
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
  return buildPageMetadata(resolvedLocale, "shop/ilmberger", {
    title:
      resolvedLocale === "ua"
        ? "Ilmberger Carbon — карбонові деталі для спортбайків | One Company"
        : "Ilmberger Carbon — Prepreg Carbon Parts for Sportbikes | One Company",
    description:
      resolvedLocale === "ua"
        ? "Автоклавний препрег-карбон ручної укладки для BMW S1000RR, Ducati Panigale V4, Aprilia RSV4 та Yamaha R1. Виготовлено в Ліндберзі, Німеччина з 1995 року."
        : "Autoclaved hand-laid prepreg carbon for BMW S1000RR, Ducati Panigale V4, Aprilia RSV4, and Yamaha R1. Made in Lindberg, Germany since 1995.",
  });
}

export default async function ShopIlmbergerPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  const [settingsRecord, ilmbergerProducts] = await Promise.all([
    getOrCreateShopSettings(prisma),
    getIlmbergerProductsServer(),
  ]);

  const viewerContext = buildShopViewerPricingContext(
    getShopSettingsRuntime(settingsRecord),
    null,
    false,
    null
  );

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
        products={ilmbergerProducts}
        viewerContext={viewerContext}
      />
    </>
  );
}
