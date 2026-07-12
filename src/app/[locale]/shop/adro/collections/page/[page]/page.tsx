import { notFound, permanentRedirect } from "next/navigation";
import { resolveLocale } from "@/lib/seo";
import {
  buildPagedListingMetadata,
  hasListingFilters,
  parseListingPage,
} from "@/lib/pagedListingMetadata";
import CatalogPage, { generateMetadata as generateBaseMetadata } from "../../page";
type Props = {
  params: Promise<{ locale: string; page: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
const BASE_SLUG = "shop/adro/collections";
export async function generateMetadata({ params, searchParams }: Props) {
  const { locale, page: rawPage } = await params;
  const page = parseListingPage(rawPage);
  if (!page) notFound();
  if (page === 1) permanentRedirect(`/${locale}/${BASE_SLUG}`);
  const base = await generateBaseMetadata({ params: Promise.resolve({ locale }) });
  return buildPagedListingMetadata(
    base,
    resolveLocale(locale),
    BASE_SLUG,
    page,
    hasListingFilters(await searchParams)
  );
}
export default async function PagedCatalog({ params }: Props) {
  const { locale, page: rawPage } = await params;
  const page = parseListingPage(rawPage);
  if (!page) notFound();
  if (page === 1) permanentRedirect(`/${locale}/${BASE_SLUG}`);
  return CatalogPage({
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve({ page: String(page) }),
  });
}
