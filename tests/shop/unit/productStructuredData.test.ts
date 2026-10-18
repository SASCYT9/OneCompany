import assert from "node:assert/strict";
import test from "node:test";

import {
  LocalBusinessSchema,
  OrganizationSchema,
  ShopProductStructuredData,
} from "../../../src/components/seo/StructuredData";
import { SHOP_WAREHOUSE_IN_STOCK_SKUS } from "../../../src/lib/shopWarehouseInventory";

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
  // Owner, 2026-10-18: the customer pays return shipping unless the item is
  // defective or we made a mistake (stated on /refund).
  assert.equal(policy.returnFees, "https://schema.org/ReturnFeesCustomerResponsibility");
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
    // "EXAMPLE-1" is supplier stock, sold to order: not returnable (/refund, section 2).
    assert.deepEqual(offer.hasMerchantReturnPolicy, {
      "@type": "MerchantReturnPolicy",
      applicableCountry: "UA",
      returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
    });
  }
});

test("organization lists the same social profiles as the site footer", () => {
  const schema = readJsonLd(OrganizationSchema({ locale: "ua" }));
  const sameAs = schema.sameAs as string[];
  for (const profile of [
    "https://www.instagram.com/onecompany.global",
    "https://t.me/onecompany_global",
    "https://t.me/onecompany_moto",
    "https://www.tiktok.com/@onecompanyglobal",
    "https://www.youtube.com/@OneCompanyGlobal",
    "https://www.linkedin.com/company/onecompany-global/",
    "https://x.com/OneCompany_gl",
  ]) {
    assert.equal(sameAs.includes(profile), true, profile);
  }
  assert.equal(new Set(sameAs).size, sameAs.length);
});

test("local business is one entity tied to the organization, not three copies", () => {
  const schema = readJsonLd(LocalBusinessSchema({ locale: "ua" }));
  assert.equal("@graph" in schema, false);
  assert.deepEqual(schema["@type"], ["AutoPartsStore", "MotorcycleDealer"]);
  assert.equal(schema["@id"], "https://onecompany.global/#localbusiness");
  assert.deepEqual(schema.parentOrganization, {
    "@id": "https://onecompany.global/#organization",
  });
  assert.equal(Array.isArray(schema.makesOffer), true);
});

test("warehouse stock keeps the shared 14-day return policy", () => {
  const element = ShopProductStructuredData({
    locale: "ua",
    product: {
      slug: "eventuri-in-stock",
      sku: SHOP_WAREHOUSE_IN_STOCK_SKUS[0],
      scope: "auto",
      brand: "Eventuri",
      title: { ua: "Впуск Eventuri", en: "Eventuri intake" },
      category: { ua: "", en: "" },
      shortDescription: { ua: "Опис", en: "Description" },
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
  for (const offer of schema.offers as Array<Record<string, unknown>>) {
    assert.equal(offer.availability, "https://schema.org/InStock");
    assert.equal("hasMerchantReturnPolicy" in offer, false);
  }
});
