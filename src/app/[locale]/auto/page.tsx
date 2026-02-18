import { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import { absoluteUrl, buildLocalizedPath, buildPageMetadata, resolveLocale } from "@/lib/seo";
import AutoPageClient from "./AutoPageClient";
import { BreadcrumbSchema } from "@/components/seo/StructuredData";
import { categoryData } from "@/lib/categoryData";

interface Props {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  const title = resolvedLocale === "ua"
    ? "Авто тюнінг та сервісні рішення | OneCompany"
    : "Auto Tuning & Performance Parts | OneCompany";
    
  const description = resolvedLocale === "ua"
    ? "Тюнінг авто в Україні: вихлопні системи, підвіска, гальма, OEM деталі та електрика. Комерційний підбір, гарантія, офіційні поставки."
    : "Auto tuning in Ukraine: exhaust systems, suspension, brakes, OEM parts and electronics. Commercial sourcing, warranty, official supply.";

  return buildPageMetadata(resolvedLocale, "/auto", {
    title,
    description,
  });
}

export default async function AutoPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const autoCategoryLinks = categoryData
    .filter((category) => category.segment === "auto")
    .map((category) => `/${resolvedLocale}/auto/categories/${category.slug}`);

  const relatedHubLinks = [
    `/${resolvedLocale}/brands`,
    `/${resolvedLocale}/brands/usa`,
    `/${resolvedLocale}/brands/europe`,
    `/${resolvedLocale}/brands/oem`,
    `/${resolvedLocale}/brands/racing`,
    `/${resolvedLocale}/blog`,
  ];

  const breadcrumbs = [
    { name: resolvedLocale === 'ua' ? 'Головна' : 'Home', url: absoluteUrl(buildLocalizedPath(resolvedLocale)) },
    { name: resolvedLocale === 'ua' ? 'Авто Тюнінг' : 'Auto Tuning', url: absoluteUrl(buildLocalizedPath(resolvedLocale, '/auto')) },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": resolvedLocale === "ua" ? "Авто Тюнінг" : "Auto Tuning",
    "description": resolvedLocale === "ua" 
      ? "Каталог преміум тюнінгу для автомобілів." 
      : "Catalog of premium tuning for cars.",
    "url": absoluteUrl(buildLocalizedPath(resolvedLocale, '/auto')),
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
        id="auto-page-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AutoPageClient />
      <nav
        className="sr-only"
        aria-label={resolvedLocale === "ua" ? "Навігація авто категорій" : "Auto category navigation"}
      >
        <ul>
          {[...autoCategoryLinks, ...relatedHubLinks].map((href) => (
            <li key={href}>
              <Link
                href={href}
                aria-label={
                  resolvedLocale === "ua"
                    ? `Перейти до ${href}`
                    : `Open ${href}`
                }
              >
                {href}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
