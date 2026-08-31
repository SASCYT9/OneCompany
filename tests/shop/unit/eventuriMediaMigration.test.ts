import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  decideEventuriMediaMigration,
  getExpectedEventuriMediaSources,
  getUnreferencedUploadedBlobUrls,
} from "../../../src/lib/eventuriMediaMigration";

const primary = "https://cdn.example.com/primary.jpg";
const gallery = "https://cdn.example.com/gallery.jpg";
const variant = "https://cdn.example.com/variant.jpg";

const input = {
  primaryImage: primary,
  mediaSources: [primary, gallery],
  variantImages: [primary, variant, null],
};

test("Eventuri media sources include primary, gallery, and variant-only assets once", () => {
  assert.deepEqual(getExpectedEventuriMediaSources(input), [primary, gallery, variant]);
});

test("Eventuri media migration permits a product only after every expected asset resolves", () => {
  const decision = decideEventuriMediaMigration(
    input,
    new Map([
      [primary, "https://blob.example.com/primary.jpg"],
      [gallery, "https://blob.example.com/gallery.jpg"],
      [variant, "https://blob.example.com/variant.jpg"],
    ])
  );

  assert.equal(decision.canPersist, true);
  assert.deepEqual(decision.expectedSources, [primary, gallery, variant]);
});

test("Eventuri media migration fails closed when the primary image upload fails", () => {
  const decision = decideEventuriMediaMigration(
    input,
    new Map([
      [gallery, "https://blob.example.com/gallery.jpg"],
      [variant, "https://blob.example.com/variant.jpg"],
    ])
  );

  assert.equal(decision.canPersist, false);
  if (decision.canPersist) return;
  assert.equal(decision.primaryImageMissing, true);
  assert.deepEqual(decision.missingSources, [primary]);
  assert.match(decision.reason, /primary image missing/);
});

test("Eventuri media migration fails closed instead of persisting an incomplete gallery", () => {
  const decision = decideEventuriMediaMigration(
    input,
    new Map([
      [primary, "https://blob.example.com/primary.jpg"],
      [variant, "https://blob.example.com/variant.jpg"],
    ])
  );

  assert.equal(decision.canPersist, false);
  if (decision.canPersist) return;
  assert.equal(decision.primaryImageMissing, false);
  assert.deepEqual(decision.missingSources, [gallery]);
});

test("Eventuri media migration fails closed when a variant-only image upload fails", () => {
  const decision = decideEventuriMediaMigration(
    input,
    new Map([
      [primary, "https://blob.example.com/primary.jpg"],
      [gallery, "https://blob.example.com/gallery.jpg"],
    ])
  );

  assert.equal(decision.canPersist, false);
  if (decision.canPersist) return;
  assert.deepEqual(decision.missingSources, [variant]);
});

test("Eventuri products with no expected media retain the existing draft-import behavior", () => {
  const decision = decideEventuriMediaMigration(
    { primaryImage: null, mediaSources: [], variantImages: [null, undefined] },
    new Map()
  );

  assert.deepEqual(decision, { canPersist: true, expectedSources: [] });
});

test("Eventuri orphan cleanup deletes only new uploads that no persisted product references", () => {
  const uploadedThisRun = new Set([
    "https://blob.example.com/shared.jpg",
    "https://blob.example.com/skipped.jpg",
    "https://blob.example.com/failed-after-upload.jpg",
  ]);
  const persistedReferences = new Set([
    "https://blob.example.com/shared.jpg",
    "https://blob.example.com/preexisting.jpg",
  ]);

  assert.deepEqual(getUnreferencedUploadedBlobUrls(uploadedThisRun, persistedReferences), [
    "https://blob.example.com/failed-after-upload.jpg",
    "https://blob.example.com/skipped.jpg",
  ]);
});

test("Eventuri commit persists only the products returned by fail-closed media migration", () => {
  const source = readFileSync(
    new URL("../../../scripts/import-eventuri-catalog.ts", import.meta.url),
    "utf8"
  );
  const migration = source.indexOf("mediaMigration = await migrateMedia(products, report)");
  const persistenceLoop = source.indexOf("for (const product of productsToPersist)", migration);
  const databaseLookup = source.indexOf(
    "const existing = await prisma.shopProduct.findUnique",
    persistenceLoop
  );

  assert.ok(migration >= 0, "commit-draft must capture the safe migration result");
  assert.ok(persistenceLoop > migration, "snapshot persistence must iterate only safe products");
  assert.ok(
    databaseLookup > persistenceLoop,
    "the fail-closed gate must run before database lookup"
  );
  assert.match(source, /allowOverwrite: false/);
  assert.match(source, /mediaMigration\?\.retain\(product\)/);
  assert.match(source, /finally \{\s*await mediaMigration\?\.cleanup\(\)/);
});
