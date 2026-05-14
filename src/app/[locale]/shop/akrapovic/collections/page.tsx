import { prisma } from "@/lib/prisma";
import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import Link from "next/link";
import Image from "next/image";
import { getAkrapovicProductsServer, projectShopProductForListGrid } from "@/lib/shopCatalogServer";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { buildShopViewerPricingContext } from "@/lib/shopPricingAudience";
import AkrapovicVehicleFilter from "../../components/AkrapovicVehicleFilter";

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
  return buildPageMetadata(resolvedLocale, "shop/akrapovic/collections", {
    title:
      resolvedLocale === "ua"
        ? "Колекції Akrapovič | Каталог Продукції | One Company"
        : "Akrapovič Collections | Product Catalog | One Company",
    description:
      resolvedLocale === "ua"
        ? "Повний каталог преміальних вихлопних систем Akrapovič: Evolution Line, Slip-On, Link Pipe, Downpipe та аксесуари."
        : "Full catalog of premium Akrapovič exhaust systems: Evolution Line, Slip-On, Link Pipe, Downpipe and accessories.",
  });
}

export default async function AkrapovicCollectionsPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  const [settingsRecord, akrapovicRows] = await Promise.all([
    getOrCreateShopSettings(prisma),
    getAkrapovicProductsServer(),
  ]);
  const akrapovicProducts = akrapovicRows.map(projectShopProductForListGrid);

  const viewerContext = buildShopViewerPricingContext(
    getShopSettingsRuntime(settingsRecord),
    null,
    false,
    null
  );

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Cinematic factory backdrop — only in dark theme; light theme shows clean cream */}
      <div className="fixed inset-0 z-0 hidden dark:block">
        <Image
          src="/images/shop/akrapovic/factory-fallback.jpg"
          alt="Akrapovic Factory"
          fill
          priority
          className="object-cover opacity-20 sepia-[.2] hue-rotate-[-30deg]"
        />
        <div className="absolute inset-0 bg-linear-to-b from-[#0a0000]/65 via-black/85 to-[#050000] backdrop-blur-sm" />

        {/* Signature Red Accent Ambient Glow */}
        <div className="absolute top-0 right-1/4 w-[1000px] h-[500px] bg-[#e50000]/10 blur-[150px] rounded-full pointer-events-none mix-blend-screen opacity-50" />
      </div>

      <div className="relative z-10 pt-[100px]">
        <div className="w-full max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-6">
          <Link
            href={`/${locale}/shop/akrapovic`}
            className="text-[10px] uppercase tracking-[0.2em] text-foreground/55 dark:text-white/40 hover:text-foreground dark:hover:text-white transition-colors"
          >
            ← {resolvedLocale === "ua" ? "Головна Akrapovič" : "Akrapovič home"}
          </Link>
        </div>

        <AkrapovicVehicleFilter
          locale={resolvedLocale}
          products={akrapovicProducts}
          viewerContext={viewerContext}
          productPathPrefix={`/${locale}/shop/akrapovic/products`}
        />
      </div>
    </div>
  );
}
