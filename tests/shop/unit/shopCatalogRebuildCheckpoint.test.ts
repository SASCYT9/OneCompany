import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const serverOnlyStub = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")
).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: serverOnlyStub, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

const checkpointModule = import("../../../src/lib/shopCatalogRebuildCheckpoint.server");

test("checkpoint cursor must advance strictly with a non-empty page", async () => {
  const { validateShopCatalogCheckpointAdvance } = await checkpointModule;
  assert.equal(
    validateShopCatalogCheckpointAdvance({
      currentCursor: "product-1",
      nextCursor: "product-2",
      pageProductCount: 10,
    }),
    "product-2"
  );
  assert.throws(
    () =>
      validateShopCatalogCheckpointAdvance({
        currentCursor: "product-2",
        nextCursor: "product-2",
        pageProductCount: 1,
      }),
    /strictly/
  );
  assert.throws(
    () =>
      validateShopCatalogCheckpointAdvance({
        currentCursor: null,
        nextCursor: "product-1",
        pageProductCount: 0,
      }),
    /positive/
  );
});
