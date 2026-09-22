import { notFound, redirect } from "next/navigation";

import { resolveLocale } from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string; brand: string }>;
};

function decodeBrandSegment(value: string) {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

/**
 * Keep old generic brand URLs recoverable, but do not expose a second brand
 * page. Brands without a dedicated storefront belong in the main catalog.
 */
export default async function LegacyBrandCatalogRedirect({ params }: Props) {
  const { locale, brand: rawBrand } = await params;
  const brand = decodeBrandSegment(rawBrand);
  if (!brand) notFound();

  redirect(`/${resolveLocale(locale)}/shop/catalog?brand=${encodeURIComponent(brand)}`);
}
