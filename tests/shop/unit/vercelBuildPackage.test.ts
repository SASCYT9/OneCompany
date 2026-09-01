import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Vercel source package includes every custom build entrypoint dependency", () => {
  const ignore = readFileSync(".vercelignore", "utf8");
  const prebuild = readFileSync("scripts/prebuild-shop-snapshot.ts", "utf8");

  assert.match(prebuild, /\.\/lib\/atomic-catalog-directory/);
  assert.match(ignore, /^!\/scripts\/lib\/$/m);
  assert.match(ignore, /^!\/scripts\/lib\/atomic-catalog-directory\.ts$/m);
});
