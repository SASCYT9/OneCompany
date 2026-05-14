import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import { getAdroProductsServer } from "@/lib/shopCatalogServer";
import { buildAdroHeroVehicleTree } from "@/lib/adroCatalog";
import AdroHomeSignature from "../components/AdroHomeSignature";

// ISR: cache rendered HTML for 1 hour. Public content, no per-user data on server.
// Cache-bust 2026-05-14T22: Vercel ISR cache held empty/errored renders for many brand routes — likely DB pool exhaustion during a build/revalidate window. Touching to rebuild.
export const dynamic = "force-static";
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(resolvedLocale, "shop/adro", {
    title:
      resolvedLocale === "ua"
        ? "ADRO — Карбонові Аерокіти Преміум-Класу | One Company"
        : "ADRO — Premium Carbon Fiber Aerokits | One Company",
    description:
      resolvedLocale === "ua"
        ? "Преміальні карбонові аерокіти ADRO з CFD-валідацією рівня F1. Препрег-карбон для BMW, Porsche, Toyota та Tesla."
        : "Premium ADRO carbon fiber aerokits with F1-level CFD validation. Prepreg carbon for BMW, Porsche, Toyota, and Tesla.",
  });
}

export default async function ShopAdroPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const adroProducts = await getAdroProductsServer();
  const availableVehicles = buildAdroHeroVehicleTree(adroProducts);

  return <AdroHomeSignature locale={resolvedLocale} availableVehicles={availableVehicles} />;
}
