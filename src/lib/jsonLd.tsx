import React from "react";
import { absoluteUrl, buildLocalizedPath, type SupportedLocale } from "./seo";

/**
 * Returns a JSON-LD reference to the canonical Organization schema
 * emitted globally by `OrganizationSchema` in `components/seo/StructuredData.tsx`
 * (mounted in app/layout.tsx). Reference-by-@id avoids duplicating the
 * organization payload — and avoids the previous bug where a stale
 * placeholder phone "+380 99 000 0000" leaked into every brand-shop
 * schema, contradicting the real phone in the canonical block.
 */
export function getOrganizationSchema(_locale: SupportedLocale) {
  return {
    "@id": "https://onecompany.global/#organization",
  };
}

/**
 * Generates SEO Schema.org JSON for a Brand's Storefront (e.g., Brabus, Akrapovic).
 */
export function generateBrandSchema({
  locale,
  slug,
  brandName,
  description,
  image,
}: {
  locale: SupportedLocale;
  slug: string; // e.g. "shop/brabus"
  brandName: string;
  description: string;
  image?: string;
}) {
  const url = absoluteUrl(buildLocalizedPath(locale, slug));
  const fullImageLink = image
    ? image.startsWith("http")
      ? image
      : absoluteUrl(image)
    : absoluteUrl("/branding/og-image.png");

  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name: `${brandName} Performance Parts | One Company Ukraine`,
    description: description,
    url: url,
    image: fullImageLink,
    brand: {
      "@type": "Brand",
      name: brandName,
    },
    parentOrganization: getOrganizationSchema(locale),
  };
}

/**
 * React Component to render any JSON-LD safely.
 * Usage: <JsonLd schema={generateBrandSchema(...)} />
 */
export function JsonLd({ schema }: { schema: Record<string, any> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

/**
 * Builds a Schema.org BreadcrumbList. Caller provides full label+href pairs
 * including locale prefix (use `buildLocalizedPath(locale, slug)` upstream).
 */
export function generateBreadcrumbListSchema(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

type ItemListProductEntry = {
  slug: string;
  title: string;
  path: string; // locale-prefixed, no domain
  image?: string | null;
  brand?: string | null;
};

/**
 * Builds a Schema.org ItemList of products for a collection/listing page.
 * Each entry is a Product reference (not full payload) — the canonical Product
 * schema lives on the detail page (ShopProductStructuredData). This keeps the
 * listing JSON-LD compact (~200 entries × ~150 bytes) while still giving
 * Google an explicit, server-rendered link graph.
 */
export function generateProductItemListSchema(
  listName: string,
  listUrl: string,
  products: ItemListProductEntry[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    url: absoluteUrl(listUrl),
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(product.path),
      name: product.title,
      ...(product.image ? { image: product.image } : {}),
    })),
  };
}
