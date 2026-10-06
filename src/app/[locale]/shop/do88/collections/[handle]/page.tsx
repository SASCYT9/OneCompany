import Link from "next/link";
import { absoluteUrl, buildLocalizedPath, buildPageMetadata, resolveLocale } from "@/lib/seo";
import { getDo88ProductsServer } from "@/lib/shopCatalogServer";
import { getProductsForDo88Collection } from "@/lib/do88CollectionMatcher";
import { getPublicShopSettingsRuntime } from "@/lib/shopPublicSettings";
import { buildShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { DO88_COLLECTION_CARDS } from "../../../data/do88CollectionsList";
import Do88CollectionProductGrid from "../../../components/Do88CollectionProductGrid";
import Do88VehicleFilter from "../../Do88VehicleFilter";
import Do88CategoryFilter from "../../Do88CategoryFilter";
import {
  findDo88ClampKitFitmentParent,
  matchesDo88VehicleFilter,
} from "../../do88FitmentData";
import { Suspense } from "react";
import { notFound } from "next/navigation";

// Cache-bust 2026-05-14T22: Vercel ISR cache held empty/errored renders for many brand routes — likely DB pool exhaustion during a build/revalidate window. Touching to rebuild.
// Anonymous SSR; B2B prices applied client-side via useShopViewerContext.
// NOTE: cannot be `force-static` — that forces searchParams empty, breaking ?brand=&keyword= filtering.
export const revalidate = 3600;
export const dynamicParams = false;

type Props = {
  params: Promise<{ locale: string; handle: string }>;
  searchParams: Promise<Partial<Record<"brand" | "model" | "chassis", string | string[]>>>;
};

function firstFilterValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateStaticParams() {
  return [
    { handle: "all" },
    ...DO88_COLLECTION_CARDS.map((card) => ({ handle: card.categoryHandle })),
  ];
}

export async function generateMetadata({ params, searchParams }: Props) {
  const { locale, handle } = await params;
  const resolvedLocale = resolveLocale(locale);
  const filters = await searchParams;
  const hasFilters = Boolean(filters.brand || filters.model || filters.chassis);

  let card = DO88_COLLECTION_CARDS.find((c) => c.categoryHandle === handle);
  if (handle === "all") {
    card = {
      categoryHandle: "all",
      title: "All Parts",
      titleUk: "Всі деталі",
      externalImageUrl: "",
    };
  }
  if (!card) notFound();
  const title = card ? `${card.title} | DO88 | One Company` : "DO88 | One Company";
  const baseSlug = `shop/do88/collections/${handle}`;
  const meta = {
    title:
      resolvedLocale === "ua"
        ? `${card?.titleUk ?? card?.title ?? handle} | DO88 | One Company`
        : title,
    description:
      resolvedLocale === "ua"
        ? `Високопродуктивні ${card?.titleUk ?? card?.title ?? handle} DO88 зі Швеції. Інтеркулери, радіатори та компоненти для стабільного охолодження.`
        : `High-performance DO88 ${card?.title ?? handle} from Sweden. Intercoolers, radiators, and cooling components built for stable temperatures.`,
  };

  // Faceted filter URLs (?brand=&model=&chassis=) spawn an unbounded
  // number of vehicle-combination URLs that all show subsets of the
  // same collection. Index only the bare collection page; for any
  // filtered state, point canonical at the bare URL and noindex so
  // Google consolidates authority on one page.
  if (hasFilters) {
    const base = buildPageMetadata(resolvedLocale, baseSlug, meta);
    return {
      ...base,
      alternates: {
        ...base.alternates,
        canonical: absoluteUrl(buildLocalizedPath(resolvedLocale, baseSlug)),
      },
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  return buildPageMetadata(resolvedLocale, baseSlug, meta);
}

export default async function Do88CollectionHandlePage({ params, searchParams }: Props) {
  const { locale, handle } = await params;
  const paramsResolved = await searchParams;
  // Match URLSearchParams.get() in the client even for repeated query keys.
  const brand = firstFilterValue(paramsResolved.brand);
  const model = firstFilterValue(paramsResolved.model);
  const chassis = firstFilterValue(paramsResolved.chassis);
  const resolvedLocale = resolveLocale(locale);
  const isUa = resolvedLocale === "ua";

  let card = DO88_COLLECTION_CARDS.find((item) => item.categoryHandle === handle);
  if (handle === "all") {
    card = {
      categoryHandle: "all",
      title: "All Parts",
      titleUk: "Всі деталі",
      externalImageUrl: "",
    };
  }

  if (!card) {
    notFound();
    return (
      <>
        <div className="urban-back-to-stores">
          <Link href={`/${locale}/shop/do88/collections`} className="urban-back-to-stores__link">
            ← {isUa ? "Всі категорії" : "All categories"}
          </Link>
        </div>
        <section
          className="ucg"
          style={{
            minHeight: "60vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 48,
          }}
        >
          <h1 className="ucg__card-title" style={{ position: "static", marginBottom: 16 }}>
            {handle}
          </h1>
          <p className="ucg__hero-sub" style={{ marginTop: 0 }}>
            {isUa ? "Категорію не знайдено." : "Category not found."}
          </p>
          <Link
            href={`/${locale}/shop/do88/collections`}
            className="urban-bp__cta"
            style={{
              marginTop: 24,
              padding: "12px 24px",
              backgroundColor: "#0ea5e9",
              color: "#000",
              borderRadius: "4px",
              fontWeight: "bold",
            }}
          >
            {isUa ? "До всіх категорій" : "Go to all categories"}
          </Link>
        </section>
      </>
    );
  }

  const [settingsRecord, products] = await Promise.all([
    getPublicShopSettingsRuntime(),
    getDo88ProductsServer(),
  ]);

  const viewerContext = buildShopViewerPricingContext(
    settingsRecord,
    null,
    false,
    null
  );

  let collectionProducts = getProductsForDo88Collection(products, handle, card.title);

  if (brand || model || chassis) {
    // Find the curated CAR_DATA entry matching the chosen (model, chassis) under
    // brand. The entry's categoryTokens are the canonical fitment classifiers
    // — we match by exact category-suffix instead of substring on title to
    // avoid the Turbo/Carrera mix-up where supplier marketing copy ("Turbo /
    // Carrera") in titles bled into the wrong filter result.
    collectionProducts = collectionProducts.filter((product) => {
      const cat = product.category?.en ?? "";

      let fitmentCategory = cat;
      let fitmentTitleEn = product.title?.en ?? "";
      let fitmentTitleUa = product.title?.ua ?? "";

      // do88's clamp-kit number identifies the hose kit it is supplied for.
      // Resolve through the matching catalog SKU and only use the link when
      // exactly one vehicle-specific parent is present; otherwise fail closed.
      const clampParent = findDo88ClampKitFitmentParent(product, products);
      if (clampParent) {
        fitmentCategory = clampParent.category?.en ?? "";
        fitmentTitleEn = clampParent.title?.en ?? "";
        fitmentTitleUa = clampParent.title?.ua ?? "";
      }

      return matchesDo88VehicleFilter(
        fitmentCategory,
        `${fitmentTitleEn} ${fitmentTitleUa}`,
        { make: brand, model, chassis }
      );
    });
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: card.title,
    url: absoluteUrl(`/${resolvedLocale}/shop/do88/collections/${handle}`),
    mainEntity: {
      "@type": "ItemList",
      itemListElement: collectionProducts.map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(`/${resolvedLocale}/shop/do88/products/${product.slug}`),
        name: product.title.en,
      })),
    },
  };

  const fallbackBanner = "/branding/do88/do88_car_hero_porsche_front_1774441447168.png";
  const bannerImage = card.externalImageUrl || fallbackBanner;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Background Banner — cinematic only in dark theme (designed as dimmed photo under
          dark page bg). In light theme it just whitewashes the cream page, so hide entirely. */}
      <div
        className="absolute top-0 left-0 w-full h-[350px] md:h-[450px] z-0 pointer-events-none hidden dark:block opacity-25"
        style={{
          backgroundImage: `url('${bannerImage}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="absolute inset-0 bg-linear-to-b from-[#050505]/40 via-transparent to-[#050505]" />
      </div>

      <div className="relative z-10 w-full max-w-[1600px] mx-auto px-4 md:px-8 pt-32 lg:pt-40 pb-20">
        <div className="mb-6">
          <Link
            href={`/${locale}/shop/do88/collections`}
            className="text-[10px] uppercase tracking-[0.2em] text-foreground/65 dark:text-white/50 hover:text-foreground dark:hover:text-white transition inline-flex items-center gap-2"
          >
            ← {isUa ? "Всі категорії DO88" : "All DO88 categories"}
          </Link>
        </div>

        {/* Vehicle picker pinned to the top — was previously in the left
            sidebar, but the brief from the shop owner is to surface the
            "vehicle finder" above the catalog so it's the first thing visible. */}
        <div className="mb-8 lg:mb-10">
          <Suspense
            fallback={
              <div className="h-20 bg-foreground/5 dark:bg-white/5 rounded-2xl animate-pulse" />
            }
          >
            <Do88VehicleFilter locale={resolvedLocale} compact={true} currentCategory={handle} />
          </Suspense>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
          {/* Left Sidebar — categories only now; vehicle picker moved to top */}
          <aside className="w-full lg:w-[280px] shrink-0 flex flex-col gap-6">
            <div className="sticky top-20 lg:top-40 z-20 hidden lg:block">
              <Suspense
                fallback={
                  <div className="h-32 bg-foreground/5 dark:bg-white/5 rounded-xl animate-pulse" />
                }
              >
                <Do88CategoryFilter
                  locale={resolvedLocale}
                  currentHandle={handle}
                  variant="sidebar"
                />
              </Suspense>
            </div>
          </aside>

          {/* Right Product Grid */}
          <div className="flex-1 min-w-0">
            <Do88CollectionProductGrid
              locale={resolvedLocale}
              handle={handle}
              title={card.title}
              titleUk={card.titleUk}
              products={collectionProducts}
              viewerContext={viewerContext}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
