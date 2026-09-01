import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { collectReferencedBlobUrls, getUnreferencedUploadedBlobUrls } from "../../../src/lib/blobUploadRetention";

test("reference collection finds exact and embedded URLs in nested JSON", () => {
  const first = "https://blob.example.com/first.jpg";
  const second = "https://blob.example.com/second.mp4";
  const unused = "https://blob.example.com/unused.jpg";
  const references = collectReferencedBlobUrls({ hero: first, html: `<video src="${second}">`, nested: [null, { other: "safe" }] }, new Set([first, second, unused]));
  assert.deepEqual([...references].sort(), [first, second]);
});

test("cleanup selection can delete only uploads from this run that are not persisted", () => {
  const shared = "https://blob.example.com/shared.jpg";
  const orphan = "https://blob.example.com/orphan.jpg";
  assert.deepEqual(getUnreferencedUploadedBlobUrls(new Set([shared, orphan]), new Set([shared, "https://blob.example.com/preexisting.jpg"])), [orphan]);
});

test("runtime and Brabus migrations always audit authoritative references before cleanup", () => {
  for (const file of ["scripts/migrate-runtime-media-to-blob.ts", "scripts/migrate-brabus-images-to-blob.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /uploadedThisRun\.add\(/);
    assert.match(source, /cleanupUnreferencedUploads/);
    assert.match(source, /getUnreferencedUploadedBlobUrls/);
    assert.match(source, /deleteBlob\(url\)/);
    assert.match(source, /\.finally\(async \(\) =>/);
    assert.doesNotMatch(source, /process\.exit\(1\)/);
  }
});
