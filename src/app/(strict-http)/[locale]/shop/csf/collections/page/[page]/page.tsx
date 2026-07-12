import { notFound, permanentRedirect } from "next/navigation";
import { resolveLocale } from "@/lib/seo";
import { buildPagedListingMetadata, parseListingPage } from "@/lib/pagedListingMetadata";
import {
  generateMetadata as generateBaseMetadata,
  renderCSFCollectionsPage,
} from "@/app/[locale]/shop/csf/collections/page";
type Props = {
  params: Promise<{ locale: string; page: string }>;
};
const BASE_SLUG = "shop/csf/collections";
export const dynamic = "force-static";
export const dynamicParams = true;
export const revalidate = 86400;
export function generateStaticParams() {
  return [];
}
export async function generateMetadata({ params }: Props) {
  const { locale, page: rawPage } = await params;
  const page = parseListingPage(rawPage);
  if (!page) notFound();
  if (page === 1) permanentRedirect(`/${locale}/${BASE_SLUG}`);
  const base = await generateBaseMetadata({ params: Promise.resolve({ locale }) });
  return buildPagedListingMetadata(base, resolveLocale(locale), BASE_SLUG, page);
}
export default async function PagedCatalog({ params }: Props) {
  const { locale, page: rawPage } = await params;
  const page = parseListingPage(rawPage);
  if (!page) notFound();
  if (page === 1) permanentRedirect(`/${locale}/${BASE_SLUG}`);
  return renderCSFCollectionsPage({ params: Promise.resolve({ locale }) }, page);
}
