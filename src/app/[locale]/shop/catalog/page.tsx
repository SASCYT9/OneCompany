import StockCatalogPage from "../stock/page";

export { generateMetadata } from "./metadata";

// The catalog shell is static and loads its paginated product data through the
// existing stock search API. Keeping both routes on the same client component
// avoids a second catalog implementation or duplicated product data.
export const dynamic = "force-static";
export const revalidate = 3600;

export default function CatalogPage() {
  return <StockCatalogPage />;
}
