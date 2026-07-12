import assert from "node:assert/strict";
import test from "node:test";
import { isTransientShopCatalogError } from "../../../src/lib/shopCatalogErrors";

test("recognizes only transient Prisma failures as fallback-eligible", () => {
  for (const code of ["P1001", "P1002", "P1008", "P1017", "P2024"]) {
    assert.equal(isTransientShopCatalogError({ code }), true, code);
  }

  assert.equal(
    isTransientShopCatalogError(new Error("Timed out while acquiring a connection from the pool")),
    true
  );
  assert.equal(isTransientShopCatalogError({ code: "P2002" }), false);
  assert.equal(isTransientShopCatalogError(new Error("Invalid product data")), false);
});

test("treats Prisma initialization failures as transient outages", () => {
  const error = new Error("Datasource URL is temporarily unavailable");
  error.name = "PrismaClientInitializationError";
  assert.equal(isTransientShopCatalogError(error), true);
});
