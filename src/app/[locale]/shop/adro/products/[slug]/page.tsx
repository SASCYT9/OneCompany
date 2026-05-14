import { resolveLocale } from "@/lib/seo";
import ShopProductDetailPage, {
  getShopProductPageMetadata,
} from "../../../components/ShopProductDetailPage";

// ISR: cache rendered HTML for 1 hour. Public content, no per-user data on server.
// Cache-bust 2026-05-14: previous Vercel ISR cache held stale 404s for ADRO
// PDP slugs (likely cached at build-time during the PR #98 → #102 window when
// the case-sensitive brand filter was producing 0-row Prisma queries).
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
    mode: "adro",
  });
}

export default async function AdroProductPage({ params }: Props) {
  const { locale, slug } = await params;
  const resolvedLocale = resolveLocale(locale);

  return <ShopProductDetailPage locale={resolvedLocale} slug={slug} mode="adro" />;
}
