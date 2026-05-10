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
