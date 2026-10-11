import { Suspense } from "react";
import CatalogLoadingShell from "./CatalogLoadingShell";
import StockCatalogClient from "./StockCatalogClient";

export { generateMetadata } from "../catalog/metadata";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function StockPage({ params }: Props) {
  const { locale } = await params;
  return (
    <>
      {/* The catalog below reads useSearchParams(), so on this static page the
          server HTML holds only the loading shell. The page heading lives here,
          outside that boundary, so crawlers get it without running scripts. */}
      <h1 className="sr-only">{locale === "ua" ? "Каталог товарів" : "Product catalog"}</h1>
      <Suspense fallback={<CatalogLoadingShell />}>
        <StockCatalogClient />
      </Suspense>
    </>
  );
}
