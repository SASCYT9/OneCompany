import { notFound } from "next/navigation";
import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import { getForgedDesign, getForgedDesigns } from "@/lib/forged/catalog";
import ForgedDesignDetail from "../../../components/ForgedDesignDetail";

// Cache-bust 2026-05-14T22: Vercel ISR cache held empty/errored renders for many brand routes — likely DB pool exhaustion during a build/revalidate window. Touching to rebuild.
export const dynamic = "force-static";
export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateStaticParams() {
  const designs = getForgedDesigns();
  return designs.flatMap((d) => [
    { locale: "ua", slug: d.slug },
    { locale: "en", slug: d.slug },
  ]);
}

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const resolvedLocale = resolveLocale(locale);
  const design = getForgedDesign(slug);
  if (!design) {
    return buildPageMetadata(resolvedLocale, `shop/forged/products/${slug}`, {
      title:
        resolvedLocale === "ua"
          ? "Дизайн не знайдено | One Company Forged"
          : "Design not found | One Company Forged",
      description:
        resolvedLocale === "ua"
          ? "Запитуваний дизайн відсутній у каталозі One Company Forged."
          : "The requested design is not available in the One Company Forged catalog.",
    });
  }
  const name = resolvedLocale === "ua" ? design.nameUa : design.nameEn;
  const tagline = resolvedLocale === "ua" ? design.taglineUa : design.taglineEn;
  return buildPageMetadata(resolvedLocale, `shop/forged/products/${slug}`, {
    title: `${name} | One Company Forged`,
    description: tagline,
    image: design.heroImage,
    type: "product",
  });
}

export default async function ShopForgedDesignPage({ params }: Props) {
  const { locale, slug } = await params;
  const resolvedLocale = resolveLocale(locale);
  const design = getForgedDesign(slug);
  if (!design) notFound();
  return <ForgedDesignDetail locale={resolvedLocale} design={design} />;
}
