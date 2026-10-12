import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();

test("product editor uses a narrow read-only currency context endpoint", () => {
  const routeSource = fs.readFileSync(
    path.join(ROOT, "src/app/api/admin/shop/products/editor-context/route.ts"),
    "utf8"
  );
  const editorSource = fs.readFileSync(
    path.join(ROOT, "src/app/admin/shop/components/AdminProductEditor.tsx"),
    "utf8"
  );

  assert.match(routeSource, /SHOP_PRODUCTS_READ/);
  assert.match(routeSource, /select:\s*\{\s*currencyRates:\s*true\s*\}/);
  // B2B discount terms are only added for admins who may read pricing.
  assert.match(routeSource, /canReadPricing \? readB2bDiscountContext\(\)/);
  assert.match(routeSource, /SHOP_PRICING_READ/);
  assert.doesNotMatch(routeSource, /\.(?:create|update|upsert|delete)\s*\(/);
  assert.match(editorSource, /\/api\/admin\/shop\/products\/editor-context/);
});
