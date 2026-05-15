import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import { getShopProductsServer } from "@/lib/shopCatalogServer";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { buildShopViewerPricingContext } from "@/lib/shopPricingAudience";
import {
  buildShopSearchText,
  hasShopVehicleSearchSignal,
  type ShopAlternativeSearchItem,
} from "@/lib/shopSearch";
import { buildShopStorefrontProductPathForProduct } from "@/lib/shopStorefrontRouting";
import { localizeShopProductTitle } from "@/lib/shopText";
import Link from "next/link";
import OhlinsVehicleFilter from "../../components/OhlinsVehicleFilter";
import { buildOhlinsHeroVehicleTree } from "@/lib/ohlinsCatalog";

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
  return buildPageMetadata(resolvedLocale, "shop/ohlins/catalog", {
    title:
      resolvedLocale === "ua"
        ? "Öhlins Каталог Підвісок | Знайди свою модифікацію | One Company"
        : "Öhlins Suspension Catalog | Find Your Setup | One Company",
    description:
      resolvedLocale === "ua"
        ? "Офіційний каталог Öhlins. DFV, TTX, Road & Track, Advanced Trackday та Motorsport підвіски для BMW, Porsche, Audi, Mercedes та інших."
        : "Official Öhlins catalog. DFV, TTX, Road & Track, Advanced Trackday and Motorsport suspension for BMW, Porsche, Audi, Mercedes and more.",
  });
}

function isOhlinsProduct(product: { brand?: string | null; vendor?: string | null }) {
  const brand = product.brand?.toLowerCase();
  const vendor = product.vendor?.toLowerCase();
  return brand === "ohlins" || brand === "öhlins" || vendor === "ohlins";
}

function resolveAlternativeSearchImage(image: string | null | undefined) {
  const value = image?.trim();
  if (!value || value.includes("image-coming-soon")) {
    return null;
  }
  return value;
}

export default async function OhlinsCatalogPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

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

  const ohlinsProducts = products.filter(isOhlinsProduct);
  const ohlinsHeroVehicles = buildOhlinsHeroVehicleTree(ohlinsProducts);
  const alternativeSearchItems = products.reduce<ShopAlternativeSearchItem[]>((items, product) => {
    if (isOhlinsProduct(product)) {
      return items;
    }

    const titleUa = localizeShopProductTitle("ua", product);
    const titleEn = localizeShopProductTitle("en", product);
    const collectionParts =
      product.collections?.flatMap((collection) => [
        collection.handle,
        collection.title.ua,
        collection.title.en,
        collection.brand ?? "",
      ]) ?? [];
    const searchText = buildShopSearchText([
      titleUa,
      titleEn,
      product.title.ua,
      product.title.en,
      product.sku,
      product.slug,
      product.brand,
      product.vendor,
      product.productType,
      product.category.ua,
      product.category.en,
      product.collection.ua,
      product.collection.en,
      ...collectionParts,
      ...(product.tags ?? []),
    ]);

    if (!hasShopVehicleSearchSignal(searchText)) {
      return items;
    }

    items.push({
      slug: product.slug,
      href: buildShopStorefrontProductPathForProduct(resolvedLocale, product),
      brand: product.brand,
      sku: product.sku,
      image: resolveAlternativeSearchImage(product.image),
      title: {
        ua: titleUa,
        en: titleEn,
      },
      searchText,
    });
    return items;
  }, []);

  const isUa = resolvedLocale === "ua";

  return (
    <div
      className="relative min-h-screen bg-background text-foreground overflow-hidden font-sans"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* Stealth Wealth Atmosphere — Öhlins Gold, dark only */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[800px] opacity-[0.03] blur-[180px] pointer-events-none z-0 rounded-full hidden dark:block"
        style={{ background: "#c29d59" }}
      />
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay pointer-events-none z-0 hidden dark:block" />

      <div className="relative z-10 pt-[140px] max-w-[1700px] mx-auto px-6 md:px-12 lg:px-16 pb-20">
        {/* Back Link — no z-50 here: it would tie with the mobile filter
            drawer (z-50) and bleed through it on phones, letting users tap
            the back link by accident. Parent `relative z-10` already keeps
            it above the bg glow/noise overlays (z-0). */}
        <div className="mb-4">
          <Link
            href={`/${resolvedLocale}/shop/ohlins`}
            className="text-[10px] tracking-[0.2em] uppercase text-foreground/55 dark:text-zinc-500 hover:text-[#c29d59] transition-colors font-light flex items-center gap-2"
          >
            <span className="opacity-50">←</span>{" "}
            {isUa ? "Повернутися до бренду" : "Back to Öhlins"}
          </Link>
        </div>

        {/* Live Filter Catalog — wrapped in Suspense for useSearchParams */}
        <div className="-mx-6 md:mx-0">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-32">
                <div className="w-8 h-8 border-2 border-[#c29d59]/30 border-t-[#c29d59] rounded-full animate-spin" />
              </div>
            }
          >
            <OhlinsVehicleFilter
              locale={resolvedLocale}
              products={ohlinsProducts}
              vehicles={ohlinsHeroVehicles}
              alternativeSearchItems={alternativeSearchItems}
              viewerContext={viewerContext}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
