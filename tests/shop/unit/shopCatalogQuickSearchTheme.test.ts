import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("catalog native select menus remain readable in light and dark themes", async () => {
  const source = await readFile(
    new URL("../../../src/components/shop/ShopCatalogQuickSearch.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /\[color-scheme:light\]/);
  assert.match(source, /dark:\[color-scheme:dark\]/);
  assert.match(source, /\[&>option\]:bg-background/);
  assert.match(source, /\[&>option\]:text-foreground/);
});
