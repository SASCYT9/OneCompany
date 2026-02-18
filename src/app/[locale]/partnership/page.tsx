import { Metadata } from "next";
import Script from "next/script";
import { absoluteUrl, buildLocalizedPath, buildPageMetadata, resolveLocale } from "@/lib/seo";
import PartnershipPageClient from "./PartnershipPageClient";
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
    ? "Партнерство з OneCompany | Оптові умови тюнінгу" 
    : "Partnership with OneCompany | Wholesale Tuning Programs";
    
  const description = resolvedLocale === "ua"
    ? "Партнерські програми OneCompany для СТО, дилерів і тюнінг-ательє: OEM постачання, логістика, технічна підтримка і комерційні умови."
    : "Partnership programs for workshops, dealers and tuning studios: OEM supply, logistics, technical support and commercial conditions.";

  return buildPageMetadata(resolvedLocale, "/partnership", {
    title,
    description,
  });
}

export default async function PartnershipPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  const breadcrumbs = [
    { name: resolvedLocale === 'ua' ? 'Головна' : 'Home', url: absoluteUrl(buildLocalizedPath(resolvedLocale)) },
    { name: resolvedLocale === 'ua' ? 'Партнерство' : 'Partnership', url: absoluteUrl(buildLocalizedPath(resolvedLocale, '/partnership')) },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "name": resolvedLocale === "ua" ? "Партнерство" : "Partnership",
    "description": resolvedLocale === "ua" 
      ? "Станьте офіційним партнером OneCompany." 
      : "Become an official OneCompany partner.",
    "url": absoluteUrl(buildLocalizedPath(resolvedLocale, '/partnership'))
  };

  return (
    <>
      <BreadcrumbSchema items={breadcrumbs} />
      <Script
        id="partnership-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PartnershipPageClient />
    </>
  );
}
