import { Suspense } from "react";
import type { StockPageSearchParams } from "@/lib/shopStockInitialSearch";
import CatalogLoadingShell from "./CatalogLoadingShell";
import StockCatalogClient from "./StockCatalogClient";

export { generateMetadata } from "../catalog/metadata";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<StockPageSearchParams>;
};

export default async function StockPage({ params, searchParams }: Props) {
  const { locale } = await params;
  return (
    <>
      {/* The page heading lives outside the Suspense boundary, so it is in the
          first streamed bytes together with the loading shell. */}
      <h1 className="sr-only">{locale === "ua" ? "Каталог товарів" : "Product catalog"}</h1>
      <Suspense fallback={<CatalogLoadingShell />}>
        <StockCatalogWithFirstPage locale={locale} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/**
 * For guests the first result page is searched on the server (cached for 60
 * seconds per filter set) and streamed into the same response behind the
 * loading shell, so product cards and pagination links are in the HTML that
 * crawlers read. The client receives it as `initialData` and skips its own
 * first request. Any failure falls back to loading in the browser.
 */
async function StockCatalogWithFirstPage({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: Promise<StockPageSearchParams>;
}) {
  // Loaded on demand: the search reader is server-only and must not be pulled
  // into modules that only need this route's metadata.
  const initialData = await import("@/lib/shopStockGuestInitialData.server")
    .then(({ loadGuestCatalogInitialData }) => loadGuestCatalogInitialData(locale, searchParams))
    .catch((error: unknown) => {
      console.error({
        event: "catalog_initial_search_failed",
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
      return undefined;
    });
  return <StockCatalogClient initialData={initialData} />;
}
