import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import { JsonLd, generateBrandSchema } from "@/lib/jsonLd";
import { prisma } from "@/lib/prisma";
import { getAkrapovicProductsServer } from "@/lib/shopCatalogServer";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { buildShopViewerPricingContext } from "@/lib/shopPricingAudience";
import AkrapovicHomeSignature from "../components/AkrapovicHomeSignature";

// ISR: anonymous SSR; B2B prices applied client-side via useShopViewerContext.
export const dynamic = "force-static";
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(resolvedLocale, "shop/akrapovic", {
    title:
      resolvedLocale === "ua"
        ? "Akrapovič — Титанові Вихлопні Системи | One Company"
        : "Akrapovič — Titanium Exhaust Systems | One Company",
    description:
      resolvedLocale === "ua"
        ? "Преміальні титанові та карбонові вихлопні системи Akrapovič для BMW, Porsche, Mercedes, Audi, Lamborghini та Ferrari."
        : "Premium titanium & carbon fibre Akrapovič exhaust systems for BMW, Porsche, Mercedes, Audi, Lamborghini, and Ferrari.",
  });
}

export default async function ShopAkrapovicPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  const [settingsRecord, akrapovicProducts] = await Promise.all([
    getOrCreateShopSettings(prisma),
    getAkrapovicProductsServer(),
  ]);

  const viewerContext = buildShopViewerPricingContext(
    getShopSettingsRuntime(settingsRecord),
    null,
    false,
    null
  );

  const description =
    resolvedLocale === "ua"
      ? "Преміальні титанові та карбонові вихлопні системи Akrapovič для BMW, Porsche, Mercedes, Audi, Lamborghini та Ferrari."
      : "Premium titanium & carbon fibre Akrapovič exhaust systems for BMW, Porsche, Mercedes, Audi, Lamborghini, and Ferrari.";

  return (
    <>
      <JsonLd
        schema={generateBrandSchema({
          locale: resolvedLocale,
          slug: "shop/akrapovic",
          brandName: "Akrapovič",
          description,
        })}
      />
      <AkrapovicHomeSignature
        locale={resolvedLocale}
        products={akrapovicProducts}
        viewerContext={viewerContext}
      />
    </>
  );
}
