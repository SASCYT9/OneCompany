import { prisma } from "@/lib/prisma";
import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import { BRABUS_COLLECTION_CARDS } from "../../../data/brabusCollectionsList";
import { getBrabusCollectionPageConfig } from "../../../data/brabusCollectionPages";
import { getBrabusProductsServer } from "@/lib/shopCatalogServer";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { buildShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { getProductsForBrabusCollection } from "@/lib/brabusCollectionMatcher";
import { isFactoryOnlyProduct } from "@/lib/brabusFactoryOnly";
import { isBrabusExhaustProduct } from "@/lib/brabusCatalogExclusions";
import BrabusCollectionHero from "../../../components/BrabusCollectionHero";
import BrabusCollectionProductGrid from "../../../components/BrabusCollectionProductGrid";

// ISR: anonymous SSR; B2B prices applied client-side via useShopViewerContext.
// Cache-bust 2026-05-14T22: Vercel ISR cache held empty/errored renders for many brand routes — likely DB pool exhaustion during a build/revalidate window. Touching to rebuild.
export const dynamic = "force-static";
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; handle: string }>;
};

export async function generateStaticParams() {
  return BRABUS_COLLECTION_CARDS.map((card) => ({ handle: card.collectionHandle }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; handle: string }>;
}) {
  const { locale, handle } = await params;
  const resolvedLocale = resolveLocale(locale);
  const card = BRABUS_COLLECTION_CARDS.find((c) => c.collectionHandle === handle);
  const config = getBrabusCollectionPageConfig(handle);
  const title = config
    ? `${resolvedLocale === "ua" ? config.titleUk : config.title} | Brabus | One Company`
    : `${card?.title ?? handle} | Brabus | One Company`;
  return buildPageMetadata(resolvedLocale, `shop/brabus/collections/${handle}`, {
    title,
    description:
      resolvedLocale === "ua"
        ? `Програма BRABUS ${config?.titleUk ?? card?.title ?? handle}. Аеродинаміка, ковані диски та індивідуальні апгрейди преміум-класу.`
        : `BRABUS ${config?.title ?? card?.title ?? handle} programme. Aerodynamic kits, forged wheels, and premium bespoke upgrades.`,
  });
}

export default async function BrabusCollectionHandlePage({ params }: Props) {
  const { locale, handle } = await params;
  const resolvedLocale = resolveLocale(locale);
  const config = getBrabusCollectionPageConfig(handle);
  const card = BRABUS_COLLECTION_CARDS.find((item) => item.collectionHandle === handle);

  const [settingsRecord, products] = await Promise.all([
    getOrCreateShopSettings(prisma),
    getBrabusProductsServer(),
  ]);

  const viewerContext = buildShopViewerPricingContext(
    getShopSettingsRuntime(settingsRecord),
    null,
    false,
    null
  );

  const collectionProducts = getProductsForBrabusCollection(products, handle)
    .filter((p) => !isFactoryOnlyProduct(p.sku))
    .filter((p) => !isBrabusExhaustProduct(p));

  // Sort: Body kit / Widestar / Full Kit first, then by price desc.
  // Reason: catalog hero/showcase positions body-kit programmes as the entry point,
  // so the first product on the collection page should be the matching body-kit SKU.
  const isBodyKitProduct = (p: (typeof collectionProducts)[number]) => {
    const en = (p.title?.en || "").toLowerCase();
    const ua = (p.title?.ua || "").toLowerCase();
    const haystack = `${en} ${ua}`;
    return /widestar|widetrack|widebody|full kit|full body|body kit|обвіс|розширювач крил/.test(
      haystack
    );
  };
  const sortedProducts = [...collectionProducts].sort((a, b) => {
    const isKitA = isBodyKitProduct(a);
    const isKitB = isBodyKitProduct(b);
    if (isKitA && !isKitB) return -1;
    if (!isKitA && isKitB) return 1;
    const priceA = a.price?.eur || a.price?.uah || 0;
    const priceB = b.price?.eur || b.price?.uah || 0;
    return priceB - priceA;
  });

  return (
    <>
      {/* Cinematic Hero (if config exists) — the hero inside is scope-dark (photo) */}
      {config && (
        <BrabusCollectionHero
          locale={resolvedLocale}
          config={config}
          productCount={sortedProducts.length}
        />
      )}

      {/* Product Grid with Full Kit first */}
      <BrabusCollectionProductGrid
        locale={resolvedLocale}
        handle={handle}
        title={
          config
            ? resolvedLocale === "ua"
              ? config.titleUk
              : config.title
            : (card?.title ?? handle)
        }
        brand="Brabus Tuning"
        products={sortedProducts}
        viewerContext={viewerContext}
      />
    </>
  );
}
