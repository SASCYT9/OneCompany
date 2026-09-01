import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the viewer pricing endpoint is own-session, B2B-only, and no-store", () => {
  const route = readFileSync("src/app/api/shop/pricing-context/route.ts", "utf8");
  assert.match(route, /getCurrentShopCustomerSession\(\)/);
  assert.match(route, /session\.group !== "B2B_APPROVED"/);
  assert.match(route, /customerId: session\.customerId/);
  assert.match(route, /where: \{ customerId: session\.customerId \}/);
  assert.match(route, /private, no-store/);
  assert.doesNotMatch(route, /searchParams|request\.json/);
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
