import { Metadata } from "next";
import Script from "next/script";
import { buildPageMetadata, resolveLocale } from "@/lib/seo";
import PartnershipPageClient from "./PartnershipPageClient";

interface Props {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  const title = resolvedLocale === "ua" 
    ? "Партнерство · OneCompany" 
    : "Partnership · OneCompany";
    
  const description = resolvedLocale === "ua"
    ? "Станьте офіційним партнером OneCompany. Спеціальні умови для СТО, дилерів та тюнінг-ательє. Глобальна логістика та технічна підтримка."
    : "Become an official OneCompany partner. Special conditions for workshops, dealers and tuning studios. Global logistics and technical support.";

  return buildPageMetadata(resolvedLocale, "/partnership", {
    title,
    description,
  });
}

export default async function PartnershipPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "name": resolvedLocale === "ua" ? "Партнерство" : "Partnership",
    "description": resolvedLocale === "ua" 
      ? "Станьте офіційним партнером OneCompany." 
      : "Become an official OneCompany partner.",
    "url": `https://onecompany.global/${resolvedLocale}/partnership`
  };

  return (
    <>
      <Script
        id="partnership-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PartnershipPageClient />
    </>
  );
}
