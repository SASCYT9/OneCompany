import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("predeploy check uses repository-local CLIs instead of global npm or npx", () => {
  const source = readFileSync("scripts/predeploy-check.js", "utf8");

  assert.match(source, /execFileSync\(process\.execPath/);
  assert.match(source, /runNode\("tsx\/cli"/);
  assert.match(source, /runNode\("prisma\/build\/index\.js"/);
  assert.match(source, /runNode\("next\/dist\/bin\/next"/);
  assert.doesNotMatch(source, /execSync\("(?:npm|npx|node)\s/);
});
