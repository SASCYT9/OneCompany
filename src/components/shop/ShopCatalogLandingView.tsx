import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import CatalogLoadingShell from "@/app/[locale]/shop/stock/CatalogLoadingShell";
import StockCatalogClient from "@/app/[locale]/shop/stock/StockCatalogClient";
import { BreadcrumbSchema } from "@/components/seo/StructuredData";
import { absoluteUrl, type SupportedLocale } from "@/lib/seo";
import {
  buildShopCatalogLandingCopy,
  buildShopCatalogLandingLinks,
  shopCatalogLandingFilters,
  shopCatalogLandingHref,
  shopCatalogLandingSearch,
  type ShopCatalogLanding,
  type ShopCatalogLandingCopy,
  type ShopCatalogLandingLinkGroup,
} from "@/lib/shopCatalogLandings";
import { loadShopCatalogLandingStats } from "@/lib/shopCatalogLandings.server";
import type { ShopCatalogLandingState } from "@/lib/shopCatalogLandingUrl";
import type { StockPageSearchParams } from "@/lib/shopStockInitialSearch";
import ShopCatalogLinkRows from "@/components/shop/ShopCatalogLinkRows";

function LandingHeader({
  locale,
  copy,
  links,
}: {
  locale: SupportedLocale;
  copy: ShopCatalogLandingCopy;
  links: ShopCatalogLandingLinkGroup[];
}) {
  return (
    <header className="mb-4 pt-2 sm:mb-7 sm:pt-4">
      <nav aria-label={locale === "ua" ? "Навігація" : "Breadcrumb"}>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.18em] text-foreground/45">
          {copy.breadcrumbs.map((crumb, index) => (
            <li key={`${crumb.name}-${index}`} className="flex items-center gap-2">
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {crumb.href && index < copy.breadcrumbs.length - 1 ? (
                <Link href={crumb.href} className="transition-colors hover:text-foreground">
                  {crumb.name}
                </Link>
              ) : (
                <span aria-current="page" className="text-foreground/70">
                  {crumb.name}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <h1 className="mt-2 text-xl font-light tracking-tight text-foreground sm:mt-3 sm:text-4xl">
        {copy.h1}
      </h1>
      <p className="mt-1.5 max-w-3xl text-xs font-light leading-relaxed text-foreground/60 sm:mt-2 sm:text-sm">
        {copy.description}
      </p>
      <ShopCatalogLinkRows groups={links} />
    </header>
  );
}

/**
 * A catalog landing page: the general catalog with the landing's filters
 * already applied, under its own heading and breadcrumbs. The first result
 * page is server-rendered for guests exactly as on the catalog itself.
 */
export default async function ShopCatalogLandingView({
  locale,
  landing,
  searchParams,
}: {
  locale: SupportedLocale;
  landing: ShopCatalogLanding;
  searchParams: StockPageSearchParams;
}) {
  const copy = buildShopCatalogLandingCopy(
    locale,
    landing,
    await loadShopCatalogLandingStats(locale, landing)
  );
  const href = shopCatalogLandingHref(locale, landing);
  const state: ShopCatalogLandingState = { href, filters: shopCatalogLandingFilters(landing) };
  return (
    <>
      <BreadcrumbSchema
        items={copy.breadcrumbs.map((crumb) => ({
          name: crumb.name,
          url: absoluteUrl(crumb.href ?? href),
        }))}
      />
      <Suspense fallback={<CatalogLoadingShell />}>
        <LandingCatalog
          locale={locale}
          query={shopCatalogLandingSearch(landing, searchParams)}
          state={state}
          header={
            <LandingHeader
              locale={locale}
              copy={copy}
              links={buildShopCatalogLandingLinks(locale, landing)}
            />
          }
        />
      </Suspense>
    </>
  );
}

async function LandingCatalog({
  locale,
  query,
  state,
  header,
}: {
  locale: SupportedLocale;
  query: StockPageSearchParams;
  state: ShopCatalogLandingState;
  header: ReactNode;
}) {
  const initialData = await import("@/lib/shopStockGuestInitialData.server")
    .then(({ loadGuestCatalogInitialData }) =>
      loadGuestCatalogInitialData(locale, Promise.resolve(query))
    )
    .catch((error: unknown) => {
      console.error({
        event: "catalog_landing_initial_search_failed",
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
      return undefined;
    });
  return <StockCatalogClient initialData={initialData} landing={{ ...state, header }} />;
}
