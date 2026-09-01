import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(resolved);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [resolved] : [];
  });
}

test("migrated catalog writers cannot reintroduce broad route invalidation", () => {
  const writerMarker = /coordinateShopCatalog|publishShopCatalogImport/;
  const forbidden = [
    /revalidatePath\(\s*["']\/["']\s*,\s*["']layout["']\s*\)/,
    /revalidatePath\(\s*["']\/(?:ua|en)\/shop\/catalog(?:\/page\/\[page\])?["']/,
    /revalidatePath\(\s*["']\/\[locale\]\/shop["']\s*,\s*["']layout["']\s*\)/,
  ];
  const migratedWriters = [...collectTypeScriptFiles("src/app"), ...collectTypeScriptFiles("scripts")]
    .filter((file) => writerMarker.test(readFileSync(file, "utf8")));

  assert.ok(migratedWriters.length >= 20, `expected broad writer coverage, found ${migratedWriters.length}`);
  for (const file of migratedWriters) {
    const source = readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.doesNotMatch(source, pattern, `${file} uses broad catalog invalidation`);
    }
  }
});
