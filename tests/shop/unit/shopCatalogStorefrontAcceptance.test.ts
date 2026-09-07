import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts?: Record<string, string>;
  engines?: Record<string, string>;
};
const runner = readFileSync("scripts/run-catalog-v2-storefront-acceptance.ts", "utf8");

test("storefront acceptance runner is wired to the supported runtime and existing gates", () => {
  assert.equal(packageJson.engines?.node, ">=20.0.0 <23.0.0");
  assert.equal(
    packageJson.scripts?.["shop:catalog:v2:storefront:acceptance"],
    "tsx scripts/run-catalog-v2-storefront-acceptance.ts"
  );
  assert.match(runner, /process\.execPath/);
  assert.match(runner, /--import", "tsx/);
  assert.match(runner, /measure-catalog-v2-storefront-build\.ts/);
  assert.match(runner, /benchmark-catalog-v2-storefront-runtime\.ts/);
  assert.match(runner, /benchmark-catalog-v2-storefront-browser\.ts/);
  assert.match(runner, /artifact\.commitSha === commitSha/);
});

test("storefront acceptance covers both locales, mobile and desktop, plus HTTP JSON contracts", () => {
  assert.match(runner, /locale: "ua", width: 390, height: 844/);
  assert.match(runner, /locale: "en", width: 1440, height: 1000/);
  assert.match(runner, /make=BMW&model=M5&chassis=G90/);
  assert.match(runner, /\/api\/shop\/stock\/fitment/);
  assert.match(runner, /\/api\/shop\/stock\/suggest/);
  assert.match(runner, /application\/json/);
  assert.match(runner, /catalog-v2-storefront-acceptance\.json/);
});

test("storefront acceptance fails closed for dirty trees and remote targets", () => {
  assert.match(runner, /Storefront acceptance requires a clean committed worktree/);
  assert.match(runner, /CATALOG_STOREFRONT_ACCEPTANCE_ALLOW_REMOTE/);
  assert.match(runner, /status === "PASS"/);
  assert.match(runner, /process\.exitCode = 1/);
});
