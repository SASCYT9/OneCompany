import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("publication status is version-specific and cannot call pending work published", () => {
  const source = readFileSync("src/lib/shopCatalogPublicationStatus.server.ts", "utf8");
  assert.match(source, /canonicalVersion: requestedVersion/);
  assert.match(source, /pendingTargets\.length === 0/);
  assert.match(source, /outbox\.status === "DEAD_LETTER"/);
  assert.match(source, /failedVersion === requestedVersion/);
  assert.match(source, /maxVersionLag/);
});

test("admin publication endpoint is authorized, dynamic, and uncached", () => {
  const source = readFileSync(
    "src/app/api/admin/shop/products/[id]/publication/route.ts",
    "utf8"
  );
  assert.match(source, /SHOP_PRODUCTS_READ/);
  assert.match(source, /dynamic = "force-dynamic"/);
  assert.match(source, /private, no-store/);
  assert.match(source, /searchParams\.get\("version"\)/);
});

test("product editor distinguishes saved state from verified publication", () => {
  const source = readFileSync(
    "src/app/admin/shop/components/AdminProductEditor.tsx",
    "utf8"
  );
  assert.match(source, /publicationVersion/);
  assert.match(source, /\/publication\$\{suffix\}/);
  assert.match(source, /next\.status !== "PUBLISHED" && next\.status !== "FAILED"/);
  assert.match(source, /Збережено\. Публікація перевіряється окремо\./);
  assert.match(source, /Publication failed/);
  assert.doesNotMatch(source, /setSuccess\("Saved"\)/);
});
