import Script from "next/script";

function toSchemaId(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "item";
}

interface OrganizationSchemaProps {
  locale?: "en" | "ua";
}

export function OrganizationSchema({ locale = "ua" }: OrganizationSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://onecompany.global/#organization",
    name: "One Company Global",
    alternateName: ["OneCompany", "One Company", "OneCompany UA"],
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
        telephone: "+380 66 077 17 00",
        contactType: "customer service",
        availableLanguage: ["Ukrainian", "English"],
      },
    ],
    sameAs: [
      "https://www.instagram.com/onecompany.global",
      "https://t.me/onecompany_global",
    ],
    knowsAbout: [
      "Automotive tuning",
      "Motorcycle tuning",
      "Premium exhaust systems",
      "Performance wheels",
      "Suspension systems",
      "Carbon fiber parts",
      "Brake systems",
      "Akrapovic exhaust",
      "Brabus tuning",
      "Mansory body kits",
      "HRE wheels",
      "KW suspension",
      "Ohlins suspension",
      "Brembo brakes",
      "тюнінг авто",
      "тюнінг мото",
      "OEM parts",
      "Auto repair services",
      "Motorcycle parts supply",
      "мото тюнинг",
      "автосервіс",
      "електрик для машини",
    ],
    areaServed: [
      {
        "@type": "Country",
        name: "Ukraine",
      },
      {
        "@type": "Country",
        name: "United States",
      },
      {
        "@type": "Country",
        name: "Germany",
      },
      {
        "@type": "Country",
        name: "United Arab Emirates",
      },
    ],
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
    name: "One Company Global",
    alternateName: ["OneCompany", "One Company"],
    description: "Тюнінг авто та мото Київ, Україна. Premium auto & moto tuning importer.",
    publisher: {
      "@id": "https://onecompany.global/#organization",
    },
    inLanguage: ["uk-UA", "en-US"],
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
  };

  return (
    <Script
      id={`product-schema-${toSchemaId(name)}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface LocalBusinessSchemaProps {
  locale?: "en" | "ua";
}

export function LocalBusinessSchema({ locale = "ua" }: LocalBusinessSchemaProps) {
  const commonBusinessFields = {
    name: "One Company Global",
    url: "https://onecompany.global",
    image: "https://onecompany.global/branding/one-company-logo.svg",
    telephone: "+380 66 077 17 00",
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
    areaServed: [{ "@type": "Country", name: "Ukraine" }],
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "09:00",
        closes: "18:00",
      },
    ],
    description:
      locale === "ua"
        ? "Тюнінг авто та мото в Києві: OEM і performance деталі, офіційні поставки, логістика та технічна підтримка."
        : "Auto and moto tuning in Kyiv: OEM and performance parts, official supply, logistics and technical support.",
  };

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        "@id": "https://onecompany.global/#localbusiness",
        ...commonBusinessFields,
      },
      {
        "@type": "AutoRepair",
        "@id": "https://onecompany.global/#autorepair",
        ...commonBusinessFields,
        serviceType: [
          "Performance upgrades",
          "OEM fitment support",
          "Exhaust and suspension consultation",
        ],
      },
      {
        "@type": "MotorcycleDealer",
        "@id": "https://onecompany.global/#motorcycledealer",
        ...commonBusinessFields,
        makesOffer: {
          "@type": "OfferCatalog",
          name: "Motorcycle tuning parts",
        },
      },
    ],
  };

  return (
    <Script
      id="localbusiness-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface BrandSchemaProps {
  name: string;
  description: string;
  url: string;
  logo?: string;
  country?: string;
}

export function BrandSchema({ name, description, url, logo, country }: BrandSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Brand",
    name: name,
    description: description,
    url: url,
    logo: logo,
    ...(country && {
      address: {
        "@type": "PostalAddress",
        addressCountry: country,
      },
    }),
  };

  return (
    <Script
      id={`brand-schema-${toSchemaId(name)}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface CollectionPageSchemaProps {
  name: string;
  description: string;
  url: string;
}

export function CollectionPageSchema({ name, description, url }: CollectionPageSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: name,
    description: description,
    url: url,
    isPartOf: {
      "@id": "https://onecompany.global/#website"
    }
  };

  return (
    <Script
      id={`collection-schema-${toSchemaId(name)}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface ArticleSchemaProps {
  id: string;
  headline: string;
  description: string;
  url: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  locale?: "ua" | "en";
}

export function ArticleSchema({
  id,
  headline,
  description,
  url,
  image,
  datePublished,
  dateModified,
  locale = "ua",
}: ArticleSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    url,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    image: image ? [image] : undefined,
    datePublished,
    dateModified: dateModified ?? datePublished,
    inLanguage: locale === "ua" ? "uk-UA" : "en-US",
    author: {
      "@type": "Organization",
      name: "One Company Global",
    },
    publisher: {
      "@type": "Organization",
      name: "One Company Global",
      logo: {
        "@type": "ImageObject",
        url: "https://onecompany.global/branding/one-company-logo.svg",
      },
    },
  };

  return (
    <Script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
