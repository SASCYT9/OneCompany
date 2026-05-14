import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import { getIpeProductsServer } from "@/lib/shopCatalogServer";
import { buildIpeHeroVehicleTree } from "@/lib/ipeHeroCatalog";
import IpeHomeSignature from "../components/IpeHomeSignature";

// ISR: cache rendered HTML for 1 hour. Public content, no per-user data on server.
export const dynamic = "force-static";
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(resolvedLocale, "shop/ipe", {
    title:
      resolvedLocale === "ua"
        ? "iPE Exhaust — Титанові Вихлопні Системи | One Company"
        : "iPE Exhaust — Titanium Exhaust Systems | One Company",
    description:
      resolvedLocale === "ua"
        ? "Преміальні титанові вихлопні системи Innotech Performance Exhaust (iPE) з фірмовим F1-звучанням і valvetronic-керуванням."
        : "Premium titanium Innotech Performance Exhaust (iPE) systems with signature F1-pitch sound and valvetronic control.",
  });
}

export default async function ShopIpePage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const ipeProducts = await getIpeProductsServer();
  const availableVehicles = buildIpeHeroVehicleTree(ipeProducts);

  return <IpeHomeSignature locale={resolvedLocale} availableVehicles={availableVehicles} />;
}
