import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildShopBrandDiscountMap,
  createShopB2bTermsResolver,
  resolveShopB2bDiscount,
} from "../../../src/lib/shopB2bBrandDiscounts";
import { draftCatalogPrice } from "../../../src/lib/admin/proformaDraft";
import { resolveShopProductBrand } from "../../../src/lib/shopProductBrand";

const system = buildShopBrandDiscountMap([
  { brand: "Akrapovic", discountPct: 15 },
  { brand: "Brabus", discountPct: 8 },
  { brand: "Remus", discountPct: 0 },
]);

test("two partners get different discounts on the same brand", () => {
  const partnerA = buildShopBrandDiscountMap([{ brand: "Akrapovic", discountPct: 5 }]);
  const partnerB = buildShopBrandDiscountMap([
    { brand: "AKRAPOVIC", discountPct: 15 },
    { brand: "KW Suspensions", discountPct: 10 },
  ]);
  const base = { customerGroup: "B2B_APPROVED", systemBrandDiscountMap: system };

  assert.deepEqual(
    resolveShopB2bDiscount({ ...base, brand: "AKRAPOVIC", customerBrandDiscountMap: partnerA }),
    { percent: 5, source: "customer-brand" }
  );
  assert.deepEqual(
    resolveShopB2bDiscount({ ...base, brand: "akrapovic ", customerBrandDiscountMap: partnerB }),
    { percent: 15, source: "customer-brand" }
  );
  assert.deepEqual(
    resolveShopB2bDiscount({
      ...base,
      brand: "KW Suspensions",
      customerBrandDiscountMap: partnerB,
    }),
    { percent: 10, source: "customer-brand" }
  );
  // A brand only the "all partners" list covers.
  assert.deepEqual(
    resolveShopB2bDiscount({ ...base, brand: "Brabus", customerBrandDiscountMap: partnerA }),
    { percent: 8, source: "system-brand" }
  );
});

test("a 0% brand rule is a real rule and stops the fall-through", () => {
  assert.deepEqual(
    resolveShopB2bDiscount({
      customerGroup: "B2B_APPROVED",
      brand: "Remus",
      systemBrandDiscountMap: system,
      customerB2BDiscountPercent: 12,
    }),
    { percent: 0, source: "system-brand" }
  );
});

test("other brands fall back to the partner's general %, then the shop default", () => {
  const base = { customerGroup: "B2B_APPROVED", brand: "GiroDisc", systemBrandDiscountMap: system };
  assert.deepEqual(resolveShopB2bDiscount({ ...base, customerB2BDiscountPercent: 12 }), {
    percent: 12,
    source: "customer-global",
  });
  assert.deepEqual(resolveShopB2bDiscount({ ...base, defaultB2BDiscountPercent: 3 }), {
    percent: 3,
    source: "default",
  });
  assert.deepEqual(resolveShopB2bDiscount(base), { percent: 0, source: "none" });
});

test("brand rules never reach retail customers or pending applications", () => {
  for (const customerGroup of ["B2C", "B2B_PENDING", null]) {
    assert.deepEqual(
      resolveShopB2bDiscount({
        customerGroup,
        brand: "Akrapovic",
        systemBrandDiscountMap: system,
        customerBrandDiscountMap: system,
        customerB2BDiscountPercent: 20,
      }),
      { percent: 0, source: "none" }
    );
  }
});

test("Urban products match a rule on the storefront brand, not the car make", () => {
  const brand = resolveShopProductBrand({
    brand: "Range Rover",
    vendor: "Urban Automotive",
    slug: "urb-defender-kit",
  });
  assert.equal(brand, "Urban Automotive");
  const resolve = createShopB2bTermsResolver({
    group: "B2B_APPROVED",
    b2bDiscountPercent: null,
    defaultB2bDiscountPercent: null,
    systemBrandDiscounts: [],
    customerBrandDiscounts: [{ brand: "Urban Automotive", discountPct: 7 }],
  });
  assert.equal(resolve(brand).percent, 7);
  assert.equal(resolve("Range Rover").percent, 0);
});

test("admin terms resolver ignores the public default for retail customers", () => {
  const resolve = createShopB2bTermsResolver({
    group: "B2C",
    b2bDiscountPercent: 10,
    defaultB2bDiscountPercent: 5,
    systemBrandDiscounts: [{ brand: "Akrapovic", discountPct: 15 }],
    customerBrandDiscounts: [],
  });
  assert.deepEqual(resolve("Akrapovic"), { percent: 0, source: "none" });
  assert.deepEqual(createShopB2bTermsResolver(null)("Akrapovic"), { percent: 0, source: "none" });
});

test("proforma lines use the partner's brand discount unless the product has a wholesale price", () => {
  const product = { priceEur: 1000 };
  assert.equal(draftCatalogPrice(product, null, "EUR", true, 15), 850);
  assert.equal(draftCatalogPrice(product, null, "EUR", false, 15), 1000);
  assert.equal(draftCatalogPrice({ priceEur: 1000, priceEurB2b: 700 }, null, "EUR", true, 15), 700);
  assert.equal(draftCatalogPrice(product, null, "USD", true, 15), null);
});

test("storefront pricing, admin orders, proformas and order edits share one resolver", () => {
  const audience = readFileSync("src/lib/shopPricingAudience.ts", "utf8");
  assert.match(audience, /resolveShopB2bDiscount\(/);
  assert.doesNotMatch(audience, /customerBrandDiscountMap\?\.get\(/);
  for (const file of [
    "src/app/admin/shop/orders/create/page.tsx",
    "src/components/admin/proforma/ProformaWorkspace.tsx",
    "src/app/api/admin/shop/orders/catalog-search/route.ts",
  ]) {
    assert.match(readFileSync(file, "utf8"), /createShopB2bTermsResolver/, file);
  }
  const create = readFileSync("src/app/admin/shop/orders/create/page.tsx", "utf8");
  assert.doesNotMatch(create, /discountPct: selectedCustomer\.b2bDiscountPercent/);
});

test("impersonated viewers get the customer's prices on client-rendered grids", () => {
  const route = readFileSync("src/app/api/shop/pricing-context/route.ts", "utf8");
  assert.match(route, /impersonating: Boolean\(session\.impersonator\)/);
  assert.match(route, /group: session\.group/);
  const hook = readFileSync("src/lib/useShopViewerContext.ts", "utf8");
  assert.match(hook, /oc-shop-impersonation-active/);
  assert.match(hook, /brandDiscounts\?\.impersonating/);
});
