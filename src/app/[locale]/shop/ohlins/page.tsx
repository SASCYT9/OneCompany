import { resolveLocale } from "@/lib/seo";
import { getOhlinsProductsServer } from "@/lib/shopCatalogServer";
import { buildOhlinsHeroVehicleTree } from "@/lib/ohlinsCatalog";
import OhlinsHomeSignature from "../components/OhlinsHomeSignature";

// ISR: cache rendered HTML for 1 hour. Public content, no per-user data on server.
// Cache-bust 2026-05-14T22: Vercel ISR cache held empty/errored renders for many brand routes — likely DB pool exhaustion during a build/revalidate window. Touching to rebuild.
export const dynamic = "force-static";
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const isUa = resolveLocale(locale) === "ua";

  return {
    title: isUa
      ? "Öhlins Підвіски | Офіційний Дилер | OneCompany"
      : "Öhlins Suspension | Official Dealer | OneCompany",
    description: isUa
      ? "Ексклюзивні підвіски Öhlins: Road & Track, Advanced Track Day, та Dedicated Track серії. Замовляйте з доставкою. OneCompany - офіційний дилер."
      : "Exclusive Öhlins suspensions: Road & Track, Advanced Track Day, and Dedicated Track series. Buy with worldwide shipping. OneCompany - official dealer.",
  };
}

export default async function OhlinsSkinPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  const ohlinsProducts = await getOhlinsProductsServer();
  const availableVehicles = buildOhlinsHeroVehicleTree(ohlinsProducts);

  return <OhlinsHomeSignature locale={resolvedLocale} availableVehicles={availableVehicles} />;
}
