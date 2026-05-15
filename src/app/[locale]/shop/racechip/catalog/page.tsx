import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import {
  // Cache-bust 2026-05-14T22: Vercel ISR cache held empty/errored renders for many brand routes — likely DB pool exhaustion during a build/revalidate window. Touching to rebuild.
  // 2026-05-15: switched from getRacechipProductsServer (~150 MB DB transfer for
  // 5 181 rows × full ShopProduct columns + 4 relations) to the light fetcher
  // which selects only the columns RacechipVehicleFilter reads, dropping the
  // RSC payload from ~6 MB to ~600 KB and cold MISS from ~8 s to ~1 s.
  getRacechipProductsLightServer,
} from "@/lib/shopCatalogServer";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { buildShopViewerPricingContext } from "@/lib/shopPricingAudience";
import Link from "next/link";
import RacechipVehicleFilter from "../../components/RacechipVehicleFilter";
import "../racechip-shop.css";

// Re-enable ISR: previously this route was force-dynamic because the cross-brand
// fetch produced a ~25 MB RSC payload (exceeded Vercel's 19 MB ISR fallback).
// We now brand-filter the query at the DB and strip heavy fields before
// shipping to the client, so the payload fits well under the limit again.
// Cache-bust 2026-05-14: prod ISR cache held an errored render. Touch to rebuild.
// 2026-05-15: bumped from 1 h to 24 h. Inventory/prices for racechip only mutate
// when atomic-sync-cron runs (now weekly), and admin saves call
// `revalidatePath('/', 'layout')` to force-bust any cached ISR page, so a 24 h
// staleness ceiling drops MISS frequency 24× without losing freshness for edits.
export const revalidate = 86400;

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(resolvedLocale, "shop/racechip/catalog", {
    title:
      resolvedLocale === "ua"
        ? "RaceChip Каталог | Знайди свій тюнінг | One Company"
        : "RaceChip Catalog | Find Your Tuning | One Company",
    description:
      resolvedLocale === "ua"
        ? "Офіційний каталог RaceChip. Максимальна потужність з GTS 5 + управління зі смартфону (App Control). 4900+ модифікацій."
        : "Official RaceChip catalog. Maximize performance with GTS 5 + Smartphone App Control. 4900+ modifications.",
  });
}

export default async function RaceChipProductsCatalogPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  const [settingsRecord, racechipProducts] = await Promise.all([
    getOrCreateShopSettings(prisma),
    // Light fetcher already returns the projected shape — no need to map
    // through projectShopProductForVehicleCatalog like the old code path did.
    getRacechipProductsLightServer(),
  ]);

  const viewerContext = buildShopViewerPricingContext(
    getShopSettingsRuntime(settingsRecord),
    null,
    false,
    null
  );

  const isUa = resolvedLocale === "ua";

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden selection:bg-[#ff4a00] selection:text-white font-sans">
      {/* Atmospheric layer — dark only */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[800px] bg-[#ff4a00] opacity-[0.02] blur-[180px] pointer-events-none z-0 rounded-full hidden dark:block"></div>
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay pointer-events-none z-0 hidden dark:block"></div>

      <div className="relative z-10 pt-[140px] max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-20">
        {/* Back Link */}
        <div className="mb-4">
          <Link
            href={`/${resolvedLocale}/shop/racechip`}
            className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 hover:text-[#ff4a00] transition-colors font-light flex items-center gap-2"
          >
            <span className="opacity-50">←</span>{" "}
            {isUa ? "Повернутися до бренду" : "Back to RaceChip Brand"}
          </Link>
        </div>

        {/* Live Filter Catalog — wrapped in Suspense for useSearchParams */}
        <div className="-mx-6 md:mx-0">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-32">
                <div className="w-8 h-8 border-2 border-[#ff4a00]/30 border-t-[#ff4a00] rounded-full animate-spin" />
              </div>
            }
          >
            <RacechipVehicleFilter
              locale={resolvedLocale}
              products={racechipProducts}
              viewerContext={viewerContext}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
