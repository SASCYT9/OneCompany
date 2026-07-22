import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("the root layout suppresses automatic PWA install promotion", () => {
  const layout = fs.readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");
  const suppressor = fs.readFileSync(
    path.join(root, "src/components/pwa/SuppressAutomaticInstallPrompt.tsx"),
    "utf8"
  );

  assert.match(layout, /<SuppressAutomaticInstallPrompt\s*\/>/);
  assert.match(suppressor, /beforeinstallprompt/);
  assert.match(suppressor, /event\.preventDefault\(\)/);
  assert.doesNotMatch(suppressor, /\.prompt\(/);
});
