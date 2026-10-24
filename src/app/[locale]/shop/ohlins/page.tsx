import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import { BRAND_HOME_HEAD } from "@/lib/seoHubHeadCopy";
import { JsonLd, generateBrandSchema } from "@/lib/jsonLd";
import { getOhlinsProductsServer } from "@/lib/shopCatalogServer";
import { buildOhlinsHeroVehicleTree } from "@/lib/ohlinsCatalog";
import OhlinsHomeSignature from "../components/OhlinsHomeSignature";
import { ShopBrandViewAllCta } from "../components/ShopBrandViewAllCta";

// ISR: cache rendered HTML for 1 hour. Public content, no per-user data on server.
// Cache-bust 2026-05-14T22: Vercel ISR cache held empty/errored renders for many brand routes — likely DB pool exhaustion during a build/revalidate window. Touching to rebuild.
export const dynamic = "force-static";
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(resolvedLocale, "shop/ohlins", BRAND_HOME_HEAD.ohlins[resolvedLocale]);
}

export default async function OhlinsSkinPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  const ohlinsProducts = await getOhlinsProductsServer();
  const availableVehicles = buildOhlinsHeroVehicleTree(ohlinsProducts);
  const description =
    resolvedLocale === "ua"
      ? "Ексклюзивні підвіски Öhlins: Road & Track, Advanced Track Day та Dedicated Track серії. Замовляйте з доставкою. Оригінальна продукція з гарантією виробника."
      : "Exclusive Öhlins suspensions: Road & Track, Advanced Track Day, and Dedicated Track series. Buy with worldwide shipping. Genuine products with manufacturer warranty.";

  return (
    <>
      <JsonLd
        schema={generateBrandSchema({
          locale: resolvedLocale,
          slug: "shop/ohlins",
          brandName: "Öhlins",
          description,
        })}
      />
      <OhlinsHomeSignature locale={resolvedLocale} availableVehicles={availableVehicles} />
      <ShopBrandViewAllCta
        locale={resolvedLocale}
        href={`/${locale}/shop/ohlins/catalog`}
        productCount={ohlinsProducts.length}
      />
    </>
  );
}
