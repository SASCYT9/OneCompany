import { Metadata } from "next";
import { notFound } from "next/navigation";
import { categoryData } from "@/lib/categoryData";
import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import CategoryPageClient from "./CategoryPageClient";
import Script from "next/script";

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

  return buildPageMetadata(resolvedLocale, `/categories/${slug}`, {
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

  const title = resolvedLocale === "ua" ? category.title.ua : category.title.en;
  const description = resolvedLocale === "ua" ? category.description.ua : category.description.en;

  // CollectionPage Schema
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": title,
    "description": description,
    "url": `https://onecompany.com.ua/${resolvedLocale}/categories/${slug}`,
    "isPartOf": {
      "@type": "WebSite",
      "name": "OneCompany",
      "url": "https://onecompany.com.ua"
    },
    "about": {
      "@type": "Thing",
      "name": title
    }
  };

  return (
    <>
      <Script
        id="category-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CategoryPageClient category={category} />
    </>
  );
}
