import { Metadata } from "next";
import { notFound } from "next/navigation";
import { permanentRedirect } from "next/navigation";
import { categoryData } from "@/lib/categoryData";
import { buildPageMetadata, resolveLocale } from "@/lib/seo";

interface Props {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const resolvedLocale = resolveLocale(locale);
  
  const category = categoryData.find((cat) => cat.slug === slug);
  if (!category) return {};

  const title = resolvedLocale === "ua" ? category.title.ua : category.title.en;
  const description = resolvedLocale === "ua" ? category.description.ua : category.description.en;

  return buildPageMetadata(resolvedLocale, `/${category.segment}/categories/${slug}`, {
    title: `${title} · OneCompany`,
    description,
  });
}

export default async function CategoryPage({ params }: Props) {
  const { locale, slug } = await params;
  const resolvedLocale = resolveLocale(locale);
  const category = categoryData.find((cat) => cat.slug === slug);

  if (!category) {
    notFound();
  }

  // Canonical category pages live under the segment route:
  // /[locale]/{auto|moto}/categories/[slug]
  permanentRedirect(`/${resolvedLocale}/${category.segment}/categories/${slug}`);
}
