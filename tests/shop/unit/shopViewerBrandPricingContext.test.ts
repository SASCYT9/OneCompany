import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadShopBrandDiscountMaps } from "../../../src/lib/shopPricingContext.server";

test("the viewer pricing endpoint is own-session, B2B-only, and no-store", () => {
  const route = readFileSync("src/app/api/shop/pricing-context/route.ts", "utf8");
  assert.match(route, /getCurrentShopCustomerSession\(\)/);
  assert.match(route, /session\.group !== "B2B_APPROVED"/);
  assert.match(route, /customerId: session\.customerId/);
  assert.match(route, /loadShopBrandDiscountMaps\(prisma, session\.customerId, session\.group\)/);
  assert.match(route, /private, no-store/);
  assert.doesNotMatch(route, /searchParams|request\.json/);
});

test("server pricing maps are B2B-only and normalize brand keys once", async () => {
  let calls = 0;
  const fakePrisma = {
    shopBrandB2bDiscount: {
      findMany: async () => {
        calls += 1;
        return [{ brand: " Eventuri ", discountPct: 15 }];
      },
    },
    shopCustomerBrandDiscount: {
      findMany: async () => {
        calls += 1;
        return [{ brand: "EVENTURI", discountPct: 20 }];
      },
    },
  } as never;

  assert.equal(await loadShopBrandDiscountMaps(fakePrisma, "customer-1", "B2C"), undefined);
  assert.equal(calls, 0);
  const maps = await loadShopBrandDiscountMaps(fakePrisma, "customer-1", "B2B_APPROVED");
  assert.equal(calls, 2);
  assert.equal(maps?.systemBrandDiscountMap.get("eventuri"), 15);
  assert.equal(maps?.customerBrandDiscountMap.get("eventuri"), 20);
});

test("cart, checkout, product APIs, stock search, and AI share the server pricing context", () => {
  const files = [
    "src/lib/shopCheckout.ts",
    "src/lib/shopAiProductHydration.ts",
    "src/app/api/shop/cart/route.ts",
    "src/app/api/shop/cart/items/route.ts",
    "src/app/api/shop/cart/items/[itemId]/route.ts",
    "src/app/api/shop/products/route.ts",
    "src/app/api/shop/products/[slug]/route.ts",
    "src/app/api/shop/stock/search/route.ts",
  ];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /buildShopViewerPricingContextServer/);
    assert.doesNotMatch(source, /buildShopViewerPricingContext\(/);
  }
});

test("every variant pricing path supplies its owning product brand", () => {
  const files = [
    "src/lib/shopCheckout.ts",
    "src/lib/shopCart.ts",
    "src/lib/shopLocalCart.ts",
    "src/lib/shopPublicProducts.ts",
    "src/app/[locale]/shop/components/RacechipShopProductDetailLayout.tsx",
  ];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const calls = source.split("resolveShopPriceBands({").slice(1);
    assert.ok(calls.length > 0, `${file} must contain variant pricing`);
    for (const call of calls) assert.match(call.slice(0, 500), /brand[:,]/);
  }
});

test("client viewer context deduplicates and applies four-tier brand discounts", () => {
  const hook = readFileSync("src/lib/useShopViewerContext.ts", "utf8");
  assert.match(hook, /brandDiscountRequests = new Map/);
  assert.match(hook, /fetch\("\/api\/shop\/pricing-context"/);
  assert.match(hook, /cache: "no-store"/);
  assert.match(hook, /brandDiscountRequests\.delete\(customerId\)/);
  assert.match(hook, /payload\.customerId === customerId/);
  assert.match(hook, /systemBrandDiscountMap:/);
  assert.match(hook, /customerBrandDiscountMap:/);
});
