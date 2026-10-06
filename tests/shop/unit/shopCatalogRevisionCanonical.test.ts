import assert from "node:assert/strict";
import test from "node:test";
import { canonicalizeCatalogBaselineValue, hashCatalogBaselineValue } from "../../../src/lib/shopCatalogBaseline";
import { encodeShopCatalogRevisionCanonical, decodeShopCatalogRevisionCanonical, validateShopCatalogRevisionCanonical } from "../../../src/lib/shopCatalogRevisionCanonical";

test("small canonical snapshots retain legacy shape and hash", () => {
  const input = { product: { id: "synthetic", version: BigInt(2), price: "123.45", updatedAt: new Date("2026-10-06T00:00:00Z") } };
  const encoded = encodeShopCatalogRevisionCanonical(input);
  assert.deepEqual(encoded.canonical, canonicalizeCatalogBaselineValue(input));
  assert.equal(encoded.contentHash, hashCatalogBaselineValue(input));
  assert.deepEqual(decodeShopCatalogRevisionCanonical(encoded.canonical, encoded.contentHash), encoded.canonical);
});
test("large immutable snapshots restore every field with the original canonical hash", () => {
  const input = { product: { id: "synthetic", price: "123.45", variants: [{ id: "variant", price: null }],
    metadata: "Synthetic repeated supplier metadata; ".repeat(80000) } };
  const encoded = encodeShopCatalogRevisionCanonical(input);
  assert.equal(encoded.contentHash, hashCatalogBaselineValue(input));
  assert.ok(JSON.stringify(encoded.canonical).length < JSON.stringify(input).length / 10);
  assert.deepEqual(decodeShopCatalogRevisionCanonical(encoded.canonical, encoded.contentHash), canonicalizeCatalogBaselineValue(input));
  validateShopCatalogRevisionCanonical(encoded.canonical, encoded.contentHash);
});
test("compressed archives reject corruption, wrong hashes and unsafe declared sizes", () => {
  const encoded = encodeShopCatalogRevisionCanonical({ data: "synthetic".repeat(200000) });
  const canonical = encoded.canonical as { data: string; uncompressedBytes: number };
  assert.throws(() => decodeShopCatalogRevisionCanonical({ ...canonical, data: "AAAA" }, encoded.contentHash), /checksum/);
  assert.throws(() => decodeShopCatalogRevisionCanonical(canonical, "b".repeat(64)), /envelope/);
  assert.throws(() => decodeShopCatalogRevisionCanonical({ ...canonical, uncompressedBytes: 1 }, encoded.contentHash));
  assert.throws(() => decodeShopCatalogRevisionCanonical({ ...canonical, uncompressedBytes: 1024 ** 3 }, encoded.contentHash), /envelope/);
});
