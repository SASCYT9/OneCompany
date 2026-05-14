import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { absoluteUrl, buildLocalizedPath, buildPageMetadata, resolveLocale } from "@/lib/seo";
import { getDo88ProductsServer } from "@/lib/shopCatalogServer";
import { getProductsForDo88Collection } from "@/lib/do88CollectionMatcher";
import { getOrCreateShopSettings, getShopSettingsRuntime } from "@/lib/shopAdminSettings";
import { buildShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { DO88_COLLECTION_CARDS } from "../../../data/do88CollectionsList";
import Do88CollectionProductGrid from "../../../components/Do88CollectionProductGrid";
import Do88VehicleFilter from "../../Do88VehicleFilter";
import Do88CategoryFilter from "../../Do88CategoryFilter";
import { CAR_DATA } from "../../do88FitmentData";
import { Suspense } from "react";

// Anonymous SSR; B2B prices applied client-side via useShopViewerContext.
// NOTE: cannot be `force-static` — that forces searchParams empty, breaking ?brand=&keyword= filtering.
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; handle: string }>;
  searchParams: Promise<{ brand?: string; model?: string; chassis?: string }>;
};

export async function generateStaticParams() {
  return [
    { handle: "all" },
    ...DO88_COLLECTION_CARDS.map((card) => ({ handle: card.categoryHandle })),
  ];
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; handle: string }>;
  searchParams: Promise<{ brand?: string; model?: string; chassis?: string }>;
}) {
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
  const brand = paramsResolved.brand;
  const model = paramsResolved.model;
  const chassis = paramsResolved.chassis;
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
    getOrCreateShopSettings(prisma),
    getDo88ProductsServer(),
  ]);

  const viewerContext = buildShopViewerPricingContext(
    getShopSettingsRuntime(settingsRecord),
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
    const brandEntries = brand ? (CAR_DATA[brand] ?? []) : Object.values(CAR_DATA).flat();
    const matchedEntry = brandEntries.find(
      (entry) => (!model || entry.model === model) && (!chassis || entry.chassis === chassis)
    );

    collectionProducts = collectionProducts.filter((product) => {
      const cat = product.category?.en ?? "";

      // Brand-only filter: match any product under "Vehicle Specific > {brand} >"
      // (case-insensitive — the JSON has e.g. "TOYOTA" while CAR_DATA has "Toyota").
      if (brand && !model && !chassis) {
        return cat.toLowerCase().includes(`> ${brand.toLowerCase()} >`);
      }

      // Model/chassis filter: require an exact CAR_DATA entry and a category-token match.
      if (!matchedEntry) return false;
      const tokenMatches = (token: string) => cat.endsWith(token) || cat.includes(`> ${token}`);
      if (matchedEntry.categoryTokens.some(tokenMatches)) return true;

      // Shared-parts fallback: a few products fit two trims (e.g. 992 "Turbo /
      // Carrera" plenum / intercooler piping) but live under one category in
      // the supplier feed. Pull them in when (a) they sit in a configured
      // shared category AND (b) their title flags them as dual-fit.
      const sharedCats = matchedEntry.sharedCategoryTokens ?? [];
      const sharedTitles = matchedEntry.sharedTitleMustInclude ?? [];
      if (sharedCats.length === 0 || sharedTitles.length === 0) return false;
      if (!sharedCats.some(tokenMatches)) return false;
      const titleEn = product.title?.en ?? "";
      const titleUa = product.title?.ua ?? "";
      return sharedTitles.some((phrase) => titleEn.includes(phrase) || titleUa.includes(phrase));
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
          <main className="flex-1 min-w-0">
            <Do88CollectionProductGrid
              locale={resolvedLocale}
              handle={handle}
              title={card.title}
              titleUk={card.titleUk}
              products={collectionProducts}
              viewerContext={viewerContext}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
