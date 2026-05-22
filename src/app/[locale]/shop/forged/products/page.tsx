import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import { getForgedDesigns } from "@/lib/forged/catalog";
import ForgedDesignGrid from "../../components/ForgedDesignGrid";

// Cache-bust 2026-05-14T22: Vercel ISR cache held empty/errored renders for many brand routes — likely DB pool exhaustion during a build/revalidate window. Touching to rebuild.
export const dynamic = "force-static";
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  return buildPageMetadata(resolvedLocale, "shop/forged/products", {
    title:
      resolvedLocale === "ua"
        ? "Каталог дизайнів — One Company Forged"
        : "Design Catalog — One Company Forged",
    description:
      resolvedLocale === "ua"
        ? "Стартовий каталог дизайнів кованих дисків One Company Forged. Кожен дизайн повністю конфігурується: розмір, матеріал, фініш, колір."
        : "Starting catalog of One Company Forged forged-wheel designs. Every design is fully configurable: size, material, finish, colour.",
  });
}

export default async function ShopForgedProductsPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const designs = getForgedDesigns();
  return <ForgedDesignGrid locale={resolvedLocale} designs={designs} />;
}
