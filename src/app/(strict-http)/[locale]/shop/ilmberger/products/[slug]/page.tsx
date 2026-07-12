import { resolveLocale } from "@/lib/seo";
import ShopProductDetailPage, {
  getShopProductPageMetadata,
} from "@/app/[locale]/shop/components/ShopProductDetailPage";

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
    mode: "ilmberger",
  });
}

export default async function IlmbergerProductPage({ params }: Props) {
  const { locale, slug } = await params;
  const resolvedLocale = resolveLocale(locale);

  return <ShopProductDetailPage locale={resolvedLocale} slug={slug} mode="ilmberger" />;
}
