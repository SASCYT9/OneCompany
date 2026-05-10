import type { ShopProduct } from "@/lib/shopCatalog";
import {
  localizeShopProductTitle,
  localizeShopDescription,
  localizeShopText,
} from "@/lib/shopText";
import type { SupportedLocale } from "@/lib/seo";
import { absoluteUrl } from "@/lib/seo";
import { buildShopStorefrontProductPathForProduct } from "@/lib/shopStorefrontRouting";
import { expandShopPrices, pickPrimaryCurrency } from "@/lib/shopPriceConversion";
import { DEFAULT_CURRENCY_RATES, type ShopCurrencyCode } from "@/lib/shopAdminSettings";

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
    description:
      locale === "ua"
        ? "Офіційний B2B дистриб'ютор 200+ преміум брендів авто та мото тюнінгу в Україні. Akrapovic, Brabus, HRE, KW, Brembo. Експертний підбір, глобальна логістика, гарантійна підтримка з 2007."
        : "Official B2B importer of 200+ premium auto & moto tuning brands in Ukraine. Expert sourcing, global logistics, warranty support since 2007.",
    foundingDate: "2007",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Baseina St, 21B",
      addressLocality: "Kyiv",
      addressCountry: "UA",
      postalCode: "01024",
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
    sameAs: ["https://www.instagram.com/onecompany.global", "https://t.me/onecompany_global"],
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
      "Motorcycle parts supply",
      "мото тюнинг",
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
    <script
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
    <script
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
    <script
      id="breadcrumb-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

type Availability = "inStock" | "preOrder" | "outOfStock";

interface OfferLike {
  price: number;
  priceCurrency: ShopCurrencyCode;
  compareAtPrice?: number;
  availability: Availability;
  priceValidUntil?: string;
}

interface ProductSchemaProps {
  name: string;
  description: string;
  image: string | string[];
  brand: string;
  category: string;
  url: string;
  sku?: string;
  offers?: OfferLike[];
}

const SCHEMA_AVAILABILITY: Record<Availability, string> = {
  inStock: "https://schema.org/InStock",
  preOrder: "https://schema.org/PreOrder",
  outOfStock: "https://schema.org/OutOfStock",
};

const SHARED_RETURN_POLICY = {
  "@type": "MerchantReturnPolicy",
  applicableCountry: ["UA", "US", "GB", "DE", "FR", "AE"],
  returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays: 14,
  returnMethod: "https://schema.org/ReturnByMail",
  returnFees: "https://schema.org/ReturnShippingFees",
};

const SHARED_SHIPPING_DETAILS = {
  "@type": "OfferShippingDetails",
  shippingDestination: [
    { "@type": "DefinedRegion", addressCountry: "UA" },
    { "@type": "DefinedRegion", addressCountry: "US" },
    { "@type": "DefinedRegion", addressCountry: "GB" },
    { "@type": "DefinedRegion", addressCountry: "DE" },
    { "@type": "DefinedRegion", addressCountry: "FR" },
    { "@type": "DefinedRegion", addressCountry: "AE" },
  ],
  deliveryTime: {
    "@type": "ShippingDeliveryTime",
    handlingTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 3, unitCode: "DAY" },
    transitTime: { "@type": "QuantitativeValue", minValue: 3, maxValue: 14, unitCode: "DAY" },
  },
};

function buildOfferEntry(offer: OfferLike, url: string) {
  const entry: Record<string, unknown> = {
    "@type": "Offer",
    url,
    price: offer.price.toFixed(2),
    priceCurrency: offer.priceCurrency,
    availability: SCHEMA_AVAILABILITY[offer.availability],
    itemCondition: "https://schema.org/NewCondition",
    seller: {
      "@type": "Organization",
      name: "One Company Global",
      "@id": "https://onecompany.global/#organization",
    },
    hasMerchantReturnPolicy: SHARED_RETURN_POLICY,
    shippingDetails: SHARED_SHIPPING_DETAILS,
  };
  if (offer.priceValidUntil) entry.priceValidUntil = offer.priceValidUntil;
  if (offer.compareAtPrice && offer.compareAtPrice > offer.price) {
    entry.priceSpecification = [
      {
        "@type": "UnitPriceSpecification",
        priceType: "https://schema.org/SalePrice",
        price: offer.price.toFixed(2),
        priceCurrency: offer.priceCurrency,
      },
      {
        "@type": "UnitPriceSpecification",
        priceType: "https://schema.org/ListPrice",
        price: offer.compareAtPrice.toFixed(2),
        priceCurrency: offer.priceCurrency,
      },
    ];
  }
  return entry;
}

export function ProductSchema({
  name,
  description,
  image,
  brand,
  category,
  url,
  sku,
  offers,
}: ProductSchemaProps) {
  const schema: Record<string, unknown> = {
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
  if (sku) {
    schema.sku = sku;
    schema.mpn = sku;
  }
  if (offers && offers.length > 0) {
    if (offers.length === 1) {
      schema.offers = buildOfferEntry(offers[0], url);
    } else {
      const primary = offers[0];
      const allPrices = offers.map((o) => o.price);
      schema.offers = {
        "@type": "AggregateOffer",
        url,
        priceCurrency: primary.priceCurrency,
        lowPrice: Math.min(...allPrices).toFixed(2),
        highPrice: Math.max(...allPrices).toFixed(2),
        offerCount: offers.length,
        availability: SCHEMA_AVAILABILITY[primary.availability],
        offers: offers.map((o) => buildOfferEntry(o, url)),
      };
    }
  }

  return (
    <script
      id={`product-schema-${toSchemaId(name)}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface ShopProductStructuredDataProps {
  product: ShopProduct;
  locale: SupportedLocale;
  rates?: Record<ShopCurrencyCode, number>;
}

function priceValidUntilFromNow(days = 90): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ShopProductStructuredData({
  product,
  locale,
  rates,
}: ShopProductStructuredDataProps) {
  const productPath = buildShopStorefrontProductPathForProduct(locale, product);
  const url = absoluteUrl(productPath);
  const name = localizeShopProductTitle(locale, product);
  const description =
    localizeShopDescription(locale, product.shortDescription) ||
    localizeShopDescription(locale, product.longDescription) ||
    name;
  const category = localizeShopText(locale, product.category);
  const galleryImages = (product.gallery?.length ? product.gallery : [product.image])
    .filter((src): src is string => Boolean(src))
    .map((src) =>
      src.startsWith("http") ? src : absoluteUrl(src.startsWith("/") ? src : `/${src}`)
    );
  const images = galleryImages.length > 0 ? galleryImages : [absoluteUrl("/branding/og-image.png")];

  const variantPrice =
    product.variants?.find((v) => v.isDefault)?.price ?? product.variants?.[0]?.price;
  const rawPrice = product.price ?? variantPrice;
  const ratesToUse = rates ?? DEFAULT_CURRENCY_RATES;
  const expanded = expandShopPrices(rawPrice ?? null, ratesToUse);
  const compareExpanded = expandShopPrices(product.compareAt ?? null, ratesToUse);
  const validUntil = priceValidUntilFromNow(90);
  const primary = pickPrimaryCurrency(locale);
  const currencyOrder: ShopCurrencyCode[] =
    primary === "UAH" ? ["UAH", "USD", "EUR"] : ["USD", "EUR", "UAH"];
  const offers = currencyOrder
    .map((c) => {
      const key = c.toLowerCase() as "usd" | "eur" | "uah";
      const price = expanded[key];
      if (!Number.isFinite(price) || price <= 0) return null;
      const compareAtPrice = compareExpanded[key];
      return {
        price,
        priceCurrency: c,
        availability: product.stock,
        priceValidUntil: validUntil,
        ...(compareAtPrice && compareAtPrice > price ? { compareAtPrice } : {}),
      };
    })
    .filter((o): o is NonNullable<typeof o> => Boolean(o));

  const shopRoot = absoluteUrl(`/${locale}/shop`);
  const brandSlug = product.brand?.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const brandShopHref = brandSlug ? absoluteUrl(`/${locale}/shop/${brandSlug}`) : null;
  const breadcrumbItems: { name: string; url: string }[] = [
    { name: locale === "ua" ? "Головна" : "Home", url: absoluteUrl(`/${locale}`) },
    { name: locale === "ua" ? "Магазин" : "Shop", url: shopRoot },
  ];
  if (brandShopHref) {
    breadcrumbItems.push({ name: product.brand, url: brandShopHref });
  }
  breadcrumbItems.push({ name, url });

  return (
    <>
      <ProductSchema
        name={name}
        description={description}
        image={images}
        brand={product.brand}
        category={category}
        url={url}
        sku={product.sku}
        offers={offers.length > 0 ? offers : undefined}
      />
      <BreadcrumbSchema items={breadcrumbItems} />
    </>
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
      postalCode: "01024",
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
        "@type": "AutoPartsStore",
        "@id": "https://onecompany.global/#autopartsstore",
        ...commonBusinessFields,
        makesOffer: {
          "@type": "OfferCatalog",
          name: "Premium auto tuning parts",
        },
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
    <script
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
    <script
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
      "@id": "https://onecompany.global/#website",
    },
  };

  return (
    <script
      id={`collection-schema-${toSchemaId(name)}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface FAQSchemaProps {
  faqItems: { question: string; answer: string }[];
}

export function FAQSchema({ faqItems }: FAQSchemaProps) {
  if (!faqItems || faqItems.length === 0) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <script
      id="faq-schema"
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
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
