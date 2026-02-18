import { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import { absoluteUrl, buildLocalizedPath, buildPageMetadata, resolveLocale } from "@/lib/seo";
import MotoPageClient from "./MotoPageClient";
import { BreadcrumbSchema } from '@/components/seo/StructuredData';
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
    ? "Мото тюнінг в Україні: вихлоп, підвіска, ECU | OneCompany"
    : "Motorcycle Tuning: Exhaust, Suspension, ECU | OneCompany";
    
  const description = resolvedLocale === "ua"
    ? "Мото тюнінг для дороги й треку: вихлоп, підвіска, гальма, електроніка та OEM рішення. Офіційні поставки і професійний підбір."
    : "Motorcycle tuning for street and track: exhaust, suspension, brakes, electronics and OEM solutions. Official supply and expert selection.";

  return buildPageMetadata(resolvedLocale, "/moto", {
    title,
    description,
  });
}

export default async function MotoPage({ params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const motoCategoryLinks = categoryData
    .filter((category) => category.segment === "moto")
    .map((category) => `/${resolvedLocale}/moto/categories/${category.slug}`);

  const relatedHubLinks = [
    `/${resolvedLocale}/brands/moto`,
    `/${resolvedLocale}/brands`,
    `/${resolvedLocale}/blog`,
  ];

  const breadcrumbs = [
    { name: resolvedLocale === 'ua' ? 'Головна' : 'Home', url: absoluteUrl(buildLocalizedPath(resolvedLocale)) },
    { name: resolvedLocale === 'ua' ? 'Мото Тюнінг' : 'Moto Tuning', url: absoluteUrl(buildLocalizedPath(resolvedLocale, '/moto')) },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": resolvedLocale === "ua" ? "Мото Тюнінг" : "Moto Tuning",
    "description": resolvedLocale === "ua" 
      ? "Каталог професійного тюнінгу для мотоциклів." 
      : "Catalog of professional tuning for motorcycles.",
    "url": absoluteUrl(buildLocalizedPath(resolvedLocale, '/moto')),
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
      <nav
        className="sr-only"
        aria-label={resolvedLocale === "ua" ? "Навігація мото категорій" : "Moto category navigation"}
      >
        <ul>
          {[...motoCategoryLinks, ...relatedHubLinks].map((href) => (
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
