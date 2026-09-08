import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Vercel source package includes every custom build entrypoint dependency", () => {
  const ignore = readFileSync(".vercelignore", "utf8");
  const prebuild = readFileSync("scripts/prebuild-shop-snapshot.ts", "utf8");
  const build = readFileSync("scripts/build-site.mjs", "utf8");
  const scriptEntrypoints = [...build.matchAll(/run\(tsxCli, \["(scripts\/[^\"]+)"/g)];
  assert.ok(scriptEntrypoints.length > 0);
  for (const [, entrypoint] of scriptEntrypoints) {
    assert.ok(
      ignore.split(/\r?\n/).includes(`!/${entrypoint}`),
      `${entrypoint} must be included in the deployment package`
    );
  }

  assert.match(prebuild, /\.\/lib\/atomic-catalog-directory/);
  assert.match(ignore, /^!\/scripts\/lib\/$/m);
  assert.match(ignore, /^!\/scripts\/lib\/atomic-catalog-directory\.ts$/m);
  assert.match(ignore, /^!\/scripts\/lib\/catalog-build-artifact\.ts$/m);
});
