import { Metadata } from "next";
import Script from "next/script";
import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import AutoPageClient from "./AutoPageClient";
import { BreadcrumbSchema } from "@/components/seo/StructuredData";

interface Props {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  const title = resolvedLocale === "ua" 
    ? "Авто Тюнінг · OneCompany" 
    : "Auto Tuning · OneCompany";
    
  const description = resolvedLocale === "ua"
    ? "Преміум тюнінг для авто. Офіційний імпорт Akrapovic, Brabus, HRE, KW. Гарантія, встановлення, логістика."
    : "Premium auto tuning. Official import of Akrapovic, Brabus, HRE, KW. Warranty, installation, logistics.";

  return buildPageMetadata(resolvedLocale, "/auto", {
    title,
    description,
  });
}

export default async function AutoPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://onecompany.global';
  const breadcrumbs = [
    { name: resolvedLocale === 'ua' ? 'Головна' : 'Home', url: `${baseUrl}/${resolvedLocale}` },
    { name: resolvedLocale === 'ua' ? 'Авто Тюнінг' : 'Auto Tuning', url: `${baseUrl}/${resolvedLocale}/auto` },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": resolvedLocale === "ua" ? "Авто Тюнінг" : "Auto Tuning",
    "description": resolvedLocale === "ua" 
      ? "Каталог преміум тюнінгу для автомобілів." 
      : "Catalog of premium tuning for cars.",
    "url": `https://onecompany.global/${resolvedLocale}/auto`,
    "isPartOf": {
      "@type": "WebSite",
      "name": "OneCompany",
      "url": "https://onecompany.global"
    }
  };

  return (
    <>
      <Script
        id="auto-page-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AutoPageClient />
    </>
  );
}
