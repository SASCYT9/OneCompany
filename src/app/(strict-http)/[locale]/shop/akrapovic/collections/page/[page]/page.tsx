import { notFound, permanentRedirect } from "next/navigation";
import { resolveLocale } from "@/lib/seo";
import { buildPagedListingMetadata, parseListingPage } from "@/lib/pagedListingMetadata";
import { AKRAPOVIC_LISTING_BASE_SLUG } from "@/lib/akrapovicListing";
import renderAkrapovicCollectionsPage, {
  generateMetadata as generateBaseMetadata,
} from "@/app/[locale]/shop/akrapovic/collections/page";

type Props = {
  params: Promise<{ locale: string; page: string }>;
};

// `/collections/page/N`: crawlable continuation of the car catalog. Rendered on
// demand and cached; query strings are ignored (filters live on the base URL).
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
  if (page === 1) permanentRedirect(`/${locale}/${AKRAPOVIC_LISTING_BASE_SLUG}`);

  const base = await generateBaseMetadata({
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve({}),
  });
  return buildPagedListingMetadata(base, resolveLocale(locale), AKRAPOVIC_LISTING_BASE_SLUG, page);
}

export default async function PagedAkrapovicCollections({ params }: Props) {
  const { locale, page: rawPage } = await params;
  const page = parseListingPage(rawPage);
  if (!page) notFound();
  if (page === 1) permanentRedirect(`/${locale}/${AKRAPOVIC_LISTING_BASE_SLUG}`);

  return renderAkrapovicCollectionsPage(
    { params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) },
    page
  );
}
