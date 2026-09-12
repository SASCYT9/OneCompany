import assert from "node:assert/strict";
import test from "node:test";

import {
  OrganizationSchema,
  ShopProductStructuredData,
} from "../../../src/components/seo/StructuredData";

function readJsonLd(element: unknown) {
  const props = (element as { props?: { dangerouslySetInnerHTML?: { __html?: string } } }).props;
  const html = props?.dangerouslySetInnerHTML?.__html;
  assert.equal(typeof html, "string");
  return JSON.parse(html as string) as Record<string, unknown>;
}

test("organization schema carries the shared return policy", () => {
  const schema = readJsonLd(OrganizationSchema({ locale: "en" }));
  const policy = schema.hasMerchantReturnPolicy as Record<string, unknown>;
  assert.equal(policy.returnPolicyCategory, "https://schema.org/MerchantReturnFiniteReturnWindow");
  assert.equal(policy.merchantReturnDays, 14);
  assert.equal("returnFees" in policy, false);
});

test("product offers omit fabricated sale dates and empty categories", () => {
  const element = ShopProductStructuredData({
    locale: "en",
    product: {
      slug: "example-product",
      sku: "EXAMPLE-1",
      scope: "auto",
      brand: "Example",
      title: { ua: "Приклад товару", en: "Example product" },
      category: { ua: "", en: "" },
      shortDescription: { ua: "", en: "Example description" },
      longDescription: { ua: "", en: "" },
      leadTime: { ua: "", en: "" },
      stock: "inStock",
      collection: { ua: "", en: "" },
      price: { eur: 100, usd: 0, uah: 0 },
      image: "https://example.com/example.jpg",
      highlights: [],
    },
  });

  const children = (element as { props?: { children?: unknown[] } }).props?.children ?? [];
  const productSchemaElement = children[0] as {
    type?: (props: Record<string, unknown>) => unknown;
    props?: Record<string, unknown>;
  };
  const schema = readJsonLd(productSchemaElement.type?.(productSchemaElement.props ?? {}));
  assert.equal("category" in schema, false);
  assert.ok(Array.isArray(schema.offers));
  for (const offer of schema.offers as Array<Record<string, unknown>>) {
    assert.equal("validFrom" in offer, false);
    assert.equal("priceValidUntil" in offer, false);
    assert.equal("hasMerchantReturnPolicy" in offer, false);
  }
});
