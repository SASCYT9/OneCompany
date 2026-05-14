import { resolveLocale } from "@/lib/seo";
import ShopProductDetailPage, {
  getShopProductPageMetadata,
} from "../../../components/ShopProductDetailPage";

// ISR: cache rendered HTML for 1 hour. Public content, no per-user data on server.
// Cache-bust 2026-05-14: previous Vercel ISR cache held stale 404s for all
// Ohlins PDP slugs (likely cached at build-time when the case-sensitive brand
// filter from PR #98 was producing 0-row Prisma queries — see PR #102 fix).
// Touching this file forces Vercel to rebuild the route and purge those 404s.
// Cache-bust 2026-05-14T22: Vercel ISR cache held empty/errored renders for many brand routes — likely DB pool exhaustion during a build/revalidate window. Touching to rebuild.
export const dynamic = "force-static";
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  return getShopProductPageMetadata({
    locale: resolveLocale(locale),
    slug,
    mode: "ohlins",
  });
}

export default async function OhlinsProductPage({ params }: Props) {
  const { locale, slug } = await params;
  const resolvedLocale = resolveLocale(locale);

  return <ShopProductDetailPage locale={resolvedLocale} slug={slug} mode="ohlins" />;
}
