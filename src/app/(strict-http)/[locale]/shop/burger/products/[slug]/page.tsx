import { resolveLocale } from "@/lib/seo";
import { getTopProductSlugsByBrand } from "@/lib/shopCatalogServer";
import ShopProductDetailPage, {
  getShopProductPageMetadata,
} from "@/app/[locale]/shop/components/ShopProductDetailPage";

// ISR: cache rendered HTML. Public content, no per-user data on server.
export const dynamic = "force-static";
export const revalidate = 86400;

export async function generateStaticParams() {
  const slugs = await getTopProductSlugsByBrand("Burger Motorsports", 25);
  const params = [];
  for (const slug of slugs) {
    params.push({ locale: "ua", slug });
    params.push({ locale: "en", slug });
  }
  return params;
}

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const resolvedLocale = resolveLocale(locale);
  return getShopProductPageMetadata({ locale: resolvedLocale, slug, mode: "burger" });
}

export default async function BurgerShopProductPage({ params }: Props) {
  const { locale, slug } = await params;
  const resolvedLocale = resolveLocale(locale);
  return <ShopProductDetailPage locale={resolvedLocale} slug={slug} mode="burger" />;
}
