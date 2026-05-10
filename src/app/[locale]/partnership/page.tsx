import { Metadata } from "next";
import { absoluteUrl, buildLocalizedPath, buildPageMetadata, resolveLocale } from "@/lib/seo";
import PartnershipPageClient from "./PartnershipPageClient";
import { BreadcrumbSchema } from "@/components/seo/StructuredData";

// ISR: cache rendered HTML for 1 hour. Public content, no per-user data on server.
export const dynamic = "force-static";
export const revalidate = 3600;

interface Props {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  const title =
    resolvedLocale === "ua"
      ? "Партнерство з OneCompany | Оптові умови тюнінгу"
      : "Partnership with OneCompany | Wholesale Tuning Programs";

  const description =
    resolvedLocale === "ua"
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
    {
      name: resolvedLocale === "ua" ? "Головна" : "Home",
      url: absoluteUrl(buildLocalizedPath(resolvedLocale)),
    },
    {
      name: resolvedLocale === "ua" ? "Партнерство" : "Partnership",
      url: absoluteUrl(buildLocalizedPath(resolvedLocale, "/partnership")),
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType:
      resolvedLocale === "ua"
        ? "B2B дистрибуція преміум тюнінг-запчастин"
        : "B2B premium tuning parts distribution",
    provider: {
      "@id": "https://onecompany.global/#organization",
    },
    areaServed: [
      { "@type": "Country", name: "Ukraine" },
      { "@type": "Country", name: "United States" },
      { "@type": "Country", name: "Germany" },
      { "@type": "Country", name: "United Arab Emirates" },
    ],
    audience: {
      "@type": "BusinessAudience",
      audienceType:
        resolvedLocale === "ua"
          ? "СТО, тюнінг-ательє, дилери, детейлінг-центри"
          : "Workshops, tuning studios, dealers, detailing centers",
    },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name:
        resolvedLocale === "ua"
          ? "Партнерські програми OneCompany"
          : "OneCompany partnership programs",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: resolvedLocale === "ua" ? "Офіційна дистрибуція" : "Official distribution",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: resolvedLocale === "ua" ? "OEM постачання" : "OEM supply",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: resolvedLocale === "ua" ? "Глобальна логістика" : "Global logistics",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name:
              resolvedLocale === "ua"
                ? "Технічна підтримка та fitment"
                : "Technical support & fitment consultation",
          },
        },
      ],
    },
    url: absoluteUrl(buildLocalizedPath(resolvedLocale, "/partnership")),
  };

  return (
    <>
      <BreadcrumbSchema items={breadcrumbs} />
      <script
        id="partnership-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PartnershipPageClient />
    </>
  );
}
