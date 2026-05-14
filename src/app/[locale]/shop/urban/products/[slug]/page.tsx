import ShopProductDetailPage, {
  getShopProductPageMetadata,
} from "../../../components/ShopProductDetailPage";

// Cache-bust 2026-05-14T22: Vercel ISR cache held empty/errored renders for many brand routes — likely DB pool exhaustion during a build/revalidate window. Touching to rebuild.
type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  return getShopProductPageMetadata({ locale, slug, mode: "urban" });
}

export default async function UrbanShopProductPage({ params }: Props) {
  const { locale, slug } = await params;
  return <ShopProductDetailPage locale={locale} slug={slug} mode="urban" />;
}
