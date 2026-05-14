import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import { getGirodiscProductsServer, projectShopProductForListGrid } from "@/lib/shopCatalogServer";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { buildShopViewerPricingContext } from "@/lib/shopPricingAudience";
import Link from "next/link";
import GirodiscVehicleFilter from "../../components/GirodiscVehicleFilter";

// ISR: anonymous SSR; B2B prices applied client-side via useShopViewerContext.
// Cache-bust 2026-05-14T22: Vercel ISR cache held empty/errored renders for many brand routes — likely DB pool exhaustion during a build/revalidate window. Touching to rebuild.
export const dynamic = "force-static";
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(resolvedLocale, "shop/girodisc/catalog", {
    title:
      resolvedLocale === "ua"
        ? "GiroDisc Каталог | Гальмівні системи | One Company"
        : "GiroDisc Catalog | Brake Systems | One Company",
    description:
      resolvedLocale === "ua"
        ? "Повний каталог високопродуктивних гальмівних дисків та комплектуючих від GiroDisc. Плаваючі двоскладові ротори."
        : "Full catalog of high-performance brake rotors and hardware from GiroDisc. Floating 2-piece rotors.",
  });
}

export default async function GirodiscProductsCatalogPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  const [settingsRecord, girodiscRows] = await Promise.all([
    getOrCreateShopSettings(prisma),
    getGirodiscProductsServer(),
  ]);
  const girodiscProducts = girodiscRows.map(projectShopProductForListGrid);

  const viewerContext = buildShopViewerPricingContext(
    getShopSettingsRuntime(settingsRecord),
    null,
    false,
    null
  );

  const isUa = resolvedLocale === "ua";

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden selection:bg-red-600 selection:text-white font-sans">
      {/* Stealth Wealth Atmosphere — dark only */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-red-600 opacity-[0.03] blur-[200px] pointer-events-none z-0 rounded-full hidden dark:block" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04)_0,transparent_1px)] bg-size-[5px_5px] opacity-10 mix-blend-overlay pointer-events-none z-0 hidden dark:block" />

      <div className="relative z-10 pt-[140px] max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-20">
        {/* Back Link */}
        <div className="mb-4 relative z-50">
          <Link
            href={`/${resolvedLocale}/shop/girodisc`}
            className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 hover:text-white transition-colors font-light flex items-center gap-2"
          >
            <span className="opacity-50">←</span> {isUa ? "Головна GiroDisc" : "GiroDisc Home"}
          </Link>
        </div>

        {/* Live Filter Catalog — wrapped in Suspense for useSearchParams */}
        <div className="-mx-6 md:mx-0">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-32">
                <div className="w-8 h-8 border-2 border-white/20 border-t-red-600 rounded-full animate-spin" />
              </div>
            }
          >
            <GirodiscVehicleFilter
              locale={resolvedLocale}
              products={girodiscProducts}
              viewerContext={viewerContext}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
