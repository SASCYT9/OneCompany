import { Suspense } from "react";
import CatalogLoadingShell from "./CatalogLoadingShell";
import StockCatalogClient from "./StockCatalogClient";

export { generateMetadata } from "../catalog/metadata";

export default function StockPage() {
  return (
    <Suspense fallback={<CatalogLoadingShell />}>
      <StockCatalogClient />
    </Suspense>
  );
}
