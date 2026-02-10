import { Metadata } from "next";
import Script from "next/script";
import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import MotoPageClient from "./MotoPageClient";
import { BreadcrumbSchema } from '@/components/seo/StructuredData';

interface Props {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  const title = resolvedLocale === "ua" 
    ? "Мото Тюнінг · OneCompany" 
    : "Moto Tuning · OneCompany";
    
  const description = resolvedLocale === "ua"
    ? "Професійний тюнінг для мотоциклів. Вихлопні системи, підвіска, гальма. Офіційний дилер Akrapovic, Ohlins, Brembo."
    : "Professional moto tuning. Exhaust systems, suspension, brakes. Official dealer of Akrapovic, Ohlins, Brembo.";

  return buildPageMetadata(resolvedLocale, "/moto", {
    title,
    description,
  });
}

export default async function MotoPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://onecompany.global';
  const breadcrumbs = [
    { name: resolvedLocale === 'ua' ? 'Головна' : 'Home', url: `${baseUrl}/${resolvedLocale}` },
    { name: resolvedLocale === 'ua' ? 'Мото Тюнінг' : 'Moto Tuning', url: `${baseUrl}/${resolvedLocale}/moto` },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": resolvedLocale === "ua" ? "Мото Тюнінг" : "Moto Tuning",
    "description": resolvedLocale === "ua" 
      ? "Каталог професійного тюнінгу для мотоциклів." 
      : "Catalog of professional tuning for motorcycles.",
    "url": `https://onecompany.global/${resolvedLocale}/moto`,
    "isPartOf": {
      "@type": "WebSite",
      "name": "OneCompany",
      "url": "https://onecompany.global"
    }
  };

  return (
    <>
      <BreadcrumbSchema items={breadcrumbs} />
      <Script
        id="moto-page-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MotoPageClient />
    </>
  );
}
