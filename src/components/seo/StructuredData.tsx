import Script from "next/script";

interface OrganizationSchemaProps {
  locale?: "en" | "ua";
}

export function OrganizationSchema({ locale = "ua" }: OrganizationSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://onecompany.global/#organization",
    name: "onecompany",
    alternateName: "One Company Global",
    url: "https://onecompany.global",
    logo: {
      "@type": "ImageObject",
      url: "https://onecompany.global/branding/one-company-logo.svg",
      width: "512",
      height: "512",
    },
    image: "https://onecompany.global/branding/one-company-logo.svg",
    description: locale === "ua" 
      ? "Офіційний B2B дистриб'ютор 200+ преміум брендів авто та мото тюнінгу в Україні. Akrapovic, Brabus, HRE, KW, Brembo. Експертний підбір, глобальна логістика, гарантійна підтримка з 2007."
      : "Official B2B importer of 200+ premium auto & moto tuning brands in Ukraine. Expert sourcing, global logistics, warranty support since 2007.",
    foundingDate: "2007",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Baseina St, 21B",
      addressLocality: "Kyiv",
      addressCountry: "UA",
      postalCode: "01004",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: "50.4415",
      longitude: "30.5267",
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: "+380-XX-XXX-XXXX",
        contactType: "customer service",
        availableLanguage: ["Ukrainian", "English", "Russian"],
      },
    ],
    sameAs: [
      "https://t.me/onecompany_ua",
      "https://www.instagram.com/onecompany.global/",
    ],
    knowsAbout: [
      "Automotive tuning",
      "Motorcycle tuning",
      "Premium exhaust systems",
      "Performance wheels",
      "Suspension systems",
      "Carbon fiber parts",
      "Brake systems",
    ],
    areaServed: {
      "@type": "Country",
      name: "Ukraine",
    },
  };

  return (
    <Script
      id="organization-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function WebSiteSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": "https://onecompany.global/#website",
    url: "https://onecompany.global",
    name: "onecompany",
    description: "Premium auto & moto tuning importer Ukraine",
    publisher: {
      "@id": "https://onecompany.global/#organization",
    },
    inLanguage: ["uk-UA", "en-US"],
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://onecompany.global/ua/brands?search={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <Script
      id="website-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface BreadcrumbSchemaProps {
  items: { name: string; url: string }[];
}

export function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <Script
      id="breadcrumb-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface ProductSchemaProps {
  name: string;
  description: string;
  image: string;
  brand: string;
  category: string;
  url: string;
}

export function ProductSchema({ name, description, image, brand, category, url }: ProductSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    image,
    brand: {
      "@type": "Brand",
      name: brand,
    },
    category,
    url,
    offers: {
      "@type": "Offer",
      availability: "https://schema.org/InStock",
      priceCurrency: "UAH",
      seller: {
        "@id": "https://onecompany.global/#organization",
      },
    },
  };

  return (
    <Script
      id={`product-schema-${name.toLowerCase().replace(/\s+/g, '-')}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface LocalBusinessSchemaProps {
  locale?: "en" | "ua";
}

export function LocalBusinessSchema({ locale = "ua" }: LocalBusinessSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": "https://onecompany.global/#localbusiness",
    name: "onecompany",
    image: "https://onecompany.global/branding/one-company-logo.svg",
    url: "https://onecompany.global",
    telephone: "+380-XX-XXX-XXXX",
    priceRange: "$$$",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Baseina St, 21B",
      addressLocality: "Kyiv",
      addressRegion: "Kyiv",
      postalCode: "01004",
      addressCountry: "UA",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: "50.4415",
      longitude: "30.5267",
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "09:00",
        closes: "18:00",
      },
    ],
    description: locale === "ua"
      ? "Офіційний імпортер преміум авто та мото тюнінгу в Україні"
      : "Official premium auto & moto tuning importer in Ukraine",
  };

  return (
    <Script
      id="localbusiness-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
