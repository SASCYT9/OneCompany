import assert from "node:assert/strict";
import test from "node:test";

import {
  buildShopProductMediaBlobPathname,
  collectRemoteShopProductMediaSources,
  getShopProductMediaDownloadCandidates,
  isRemoteShopProductMediaSource,
  rewriteShopProductMediaValue,
  SHOP_PRODUCT_MEDIA_BLOB_PREFIX,
} from "../../../src/lib/shopProductMediaMigration";

test("product media source classification skips local and existing Blob references", () => {
  assert.equal(isRemoteShopProductMediaSource("//img.example.com/a.jpg"), true);
  assert.equal(isRemoteShopProductMediaSource("/media/a.jpg"), false);
  assert.equal(
    isRemoteShopProductMediaSource("https://store.public.blob.vercel-storage.com/media/a.jpg"),
    false
  );
});

test("Blob pathname is deterministic and namespaced", () => {
  const first = buildShopProductMediaBlobPathname("https://img.example.com/a.jpg?v=1");
  const second = buildShopProductMediaBlobPathname("https://img.example.com/a.jpg?v=1");
  const different = buildShopProductMediaBlobPathname("https://img.example.com/a.jpg?v=2");

  assert.equal(first, second);
  assert.notEqual(first, different);
  assert.match(first, new RegExp(`^${SHOP_PRODUCT_MEDIA_BLOB_PREFIX}[a-f0-9]{64}$`));
});

test("Shopify stale UUID image URLs get a safe download fallback", () => {
  const source =
    "https://cdn.shopify.com/s/files/1/0733/4058/4242/files/RSQ8_8d4a2c1b-606b-4f7e-9f00-5ee5de44561c.png?v=1776079485";
  assert.deepEqual(getShopProductMediaDownloadCandidates(source), [
    source,
    "https://cdn.shopify.com/s/files/1/0733/4058/4242/files/RSQ8.png?v=1776079485",
  ]);
});

test("nested product galleries are collected and rewritten atomically", () => {
  const source = "https://img.example.com/a.jpg";
  const blob = "https://store.public.blob.vercel-storage.com/media/library/shop-products/a";
  const value = { gallery: ["//img.example.com/a.jpg", { src: source }], local: "/media/local.jpg" };
  const sources = collectRemoteShopProductMediaSources(value);
  const rewritten = rewriteShopProductMediaValue(value, new Map([[source, blob]]));

  assert.deepEqual([...sources], [source]);
  assert.equal(rewritten.replacements, 2);
  assert.deepEqual(rewritten.value, {
    gallery: [blob, { src: blob }],
    local: "/media/local.jpg",
  });
});
