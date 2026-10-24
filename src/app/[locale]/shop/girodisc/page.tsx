import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import { BRAND_HOME_HEAD } from "@/lib/seoHubHeadCopy";
import { JsonLd, generateBrandSchema } from "@/lib/jsonLd";
import { getGirodiscProductsServer } from "@/lib/shopCatalogServer";
import { buildGirodiscHeroVehicleTree } from "@/lib/girodiscHeroCatalog";
import GiroDiscHomeSignature from "../components/GiroDiscHomeSignature";
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
  return buildPageMetadata(
    resolvedLocale,
    "shop/girodisc",
    BRAND_HOME_HEAD.girodisc[resolvedLocale]
  );
}

export default async function GiroDiscSkinPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const girodiscProducts = await getGirodiscProductsServer();
  const availableVehicles = buildGirodiscHeroVehicleTree(girodiscProducts);
  const description =
    resolvedLocale === "ua"
      ? "Ексклюзивні 2-складові гальмівні диски GiroDisc, гоночні колодки та титанові щитки. Замовляйте з доставкою. Оригінальна продукція з гарантією виробника."
      : "Exclusive 2-piece high-performance brake rotors by GiroDisc, racing pads, and titanium heat shields. Buy with worldwide shipping. Genuine products with manufacturer warranty.";

  return (
    <>
      <JsonLd
        schema={generateBrandSchema({
          locale: resolvedLocale,
          slug: "shop/girodisc",
          brandName: "GiroDisc",
          description,
        })}
      />
      <GiroDiscHomeSignature locale={resolvedLocale} availableVehicles={availableVehicles} />
      <ShopBrandViewAllCta
        locale={resolvedLocale}
        href={`/${locale}/shop/girodisc/catalog`}
        productCount={girodiscProducts.length}
      />
    </>
  );
}
