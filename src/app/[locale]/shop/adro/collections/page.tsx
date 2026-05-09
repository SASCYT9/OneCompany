import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import { getShopProductsServer } from "@/lib/shopCatalogServer";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { buildShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { isAdroProduct } from "@/lib/adroCatalog";
import AdroCatalogGrid from "../../components/AdroCatalogGrid";

// ISR: anonymous SSR; B2B prices applied client-side via useShopViewerContext.
export const dynamic = "force-static";
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(resolvedLocale, "shop/adro/collections", {
    title:
      resolvedLocale === "ua"
        ? "Каталог ADRO | Карбонові аерокіти та деталі | One Company"
        : "ADRO Catalog | Carbon Aero Kits and Components | One Company",
    description:
      resolvedLocale === "ua"
        ? "Повний каталог ADRO з фільтрами за маркою авто, моделлю, платформою та категорією карбонових деталей."
        : "Full ADRO catalog with filters by vehicle make, model, platform, and carbon component category.",
  });
}

export default async function AdroCollectionsPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const isUa = resolvedLocale === "ua";

  const [settingsRecord, products] = await Promise.all([
    getOrCreateShopSettings(prisma),
    getShopProductsServer(),
  ]);

  const viewerContext = buildShopViewerPricingContext(
    getShopSettingsRuntime(settingsRecord),
    null,
    false,
    null
  );

  const adroProducts = products.filter(isAdroProduct);

  return (
    <div className="relative min-h-screen bg-black">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <Image
          src="/images/shop/adro/adro-m3-front.jpg"
          alt="ADRO carbon aero"
          fill
          priority
          className="object-cover opacity-[0.12] grayscale"
        />
        <div className="absolute inset-0 bg-linear-to-b from-[#050505]/85 via-black/92 to-[#030303]" />
        <div className="absolute left-1/2 top-1/4 h-[420px] w-[860px] -translate-x-1/2 rounded-full bg-white/2.5 blur-[190px]" />
      </div>

      <div className="relative z-10 pt-[100px]">
        <div className="mx-auto w-full max-w-[1700px] px-6 pb-4 pt-4 md:px-12 lg:px-16">
          <Link
            href={`/${resolvedLocale}/shop/adro`}
            className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 transition-colors hover:text-white"
          >
            ← {isUa ? "Повернутися до ADRO" : "Return to ADRO"}
          </Link>
        </div>

        <Suspense
          fallback={
            <div className="flex items-center justify-center py-32">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            </div>
          }
        >
          <AdroCatalogGrid
            locale={resolvedLocale}
            products={adroProducts}
            viewerContext={viewerContext}
          />
        </Suspense>
      </div>
    </div>
  );
}
