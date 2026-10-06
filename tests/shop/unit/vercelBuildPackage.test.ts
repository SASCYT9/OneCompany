import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Vercel source package includes every custom build entrypoint dependency", () => {
  const ignore = readFileSync(".vercelignore", "utf8");
  const lines = ignore.split(/\r?\n/).map((line) => line.trim());
  const prebuild = readFileSync("scripts/prebuild-shop-snapshot.ts", "utf8");
  const build = readFileSync("scripts/build-site.mjs", "utf8");
  const scriptEntrypoints = [...build.matchAll(/run\(tsxCli, \["(scripts\/[^\"]+)"/g)].map(
    ([, entrypoint]) => entrypoint
  );
  assert.ok(scriptEntrypoints.length > 0);
  assert.match(prebuild, /\.\/lib\/atomic-catalog-directory/);

  // A file reaches the build when nothing ignores it, or when /scripts/ is ignored
  // and the file is re-included with an explicit negation.
  const scriptsIgnored = lines.some((line) => /^\/?scripts(\/|\/\*\*?)?$/.test(line));
  const included = (file: string) =>
    !lines.includes(`/${file}`) && (!scriptsIgnored || lines.includes(`!/${file}`));
  for (const file of [
    ...scriptEntrypoints,
    "scripts/lib/atomic-catalog-directory.ts",
    "scripts/lib/catalog-build-artifact.ts",
  ]) {
    assert.ok(included(file), `${file} must be included in the deployment package`);
  }
});
