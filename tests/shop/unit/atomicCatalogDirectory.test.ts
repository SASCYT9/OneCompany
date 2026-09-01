import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertSafeCatalogReplacement,
  replaceCatalogDirectoryAtomically,
} from "../../../scripts/lib/atomic-catalog-directory";

test("catalog replacement rejects truncated and undersized snapshots", () => {
  assert.throws(() => assertSafeCatalogReplacement({ productCount: 188, activeDatabaseCount: 1 }), /at least 10000/);
  assert.throws(() => assertSafeCatalogReplacement({ productCount: 10_000, activeDatabaseCount: 10_001 }), /truncated/);
});

test("catalog replacement validates staging before preserving and atomically replacing target", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-atomic-test-"));
  try {
    const target = path.join(root, "catalog-fallback");
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "sentinel"), "old");
    const invalid = fs.mkdtempSync(path.join(root, ".staged-"));
    fs.writeFileSync(path.join(invalid, "manifest.json"), JSON.stringify({ count: 188, activeDatabaseCount: 1 }));
    assert.throws(() => replaceCatalogDirectoryAtomically(invalid, target), /at least 10000/);
    assert.equal(fs.readFileSync(path.join(target, "sentinel"), "utf8"), "old");

    const valid = fs.mkdtempSync(path.join(root, ".staged-"));
    fs.writeFileSync(path.join(valid, "manifest.json"), JSON.stringify({ count: 10_000, activeDatabaseCount: 10_000 }));
    fs.writeFileSync(path.join(valid, "sentinel"), "new");
    replaceCatalogDirectoryAtomically(valid, target);
    assert.equal(fs.readFileSync(path.join(target, "sentinel"), "utf8"), "new");
    assert.equal(fs.existsSync(valid), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
