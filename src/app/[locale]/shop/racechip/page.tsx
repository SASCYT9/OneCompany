import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import { getRacechipProductsServer } from "@/lib/shopCatalogServer";
import RacechipHomeSignature from "../components/RacechipHomeSignature";
import type { RacechipMakeModelEntry } from "../components/RacechipQuickFinder";

// ISR: cache rendered HTML for 1 hour. Public content, no per-user data on server.
export const dynamic = "force-static";
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(resolvedLocale, "shop/racechip", {
    title:
      resolvedLocale === "ua"
        ? "RaceChip Україна | GTS 5 Black + App Control | One Company"
        : "RaceChip Catalog | GTS 5 Black + App Control | One Company",
    description:
      resolvedLocale === "ua"
        ? "Офіційний магазин RaceChip. Максимальна потужність з GTS 5 Black + управління зі смартфону (App Control). 50+ брендів авто."
        : "Official RaceChip storefront. Maximize performance with GTS 5 Black + Smartphone App Control. 50+ vehicle brands.",
  });
}

async function loadMakeModels(): Promise<RacechipMakeModelEntry[]> {
  const rows = await getRacechipProductsServer();

  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    const make = r.tags?.find((t) => t.startsWith("car_make:"))?.slice(9);
    const model = r.tags?.find((t) => t.startsWith("car_model:"))?.slice(10);
    if (!make) continue;
    if (!map.has(make)) map.set(make, new Set());
    if (model) map.get(make)!.add(model);
  }

  return [...map.entries()]
    .map(([make, modelsSet]) => ({
      make,
      models: [...modelsSet].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.make.localeCompare(b.make));
}

export default async function RaceChipHomePage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const makeModels = await loadMakeModels();

  return <RacechipHomeSignature locale={resolvedLocale} makeModels={makeModels} />;
}
