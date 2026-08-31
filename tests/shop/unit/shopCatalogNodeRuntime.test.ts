import assert from "node:assert/strict";
import test from "node:test";

import {
  coordinateShopCatalogProductCreationWithClient,
  coordinateShopCatalogProductMutationInTransaction,
  coordinateShopCatalogProductMutationWithClient,
} from "../../../src/lib/shopCatalogMutationCoordinator.server";
import { buildShopCatalogAdminSnapshot } from "../../../src/lib/shopCatalogAdminSnapshot.server";
import { buildShopCatalogProjection } from "../../../src/lib/shopCatalogProjection.server";

test("Catalog V2 publication primitives load in a plain Node server runtime", () => {
  assert.equal(typeof coordinateShopCatalogProductMutationWithClient, "function");
  assert.equal(typeof coordinateShopCatalogProductCreationWithClient, "function");
  assert.equal(typeof coordinateShopCatalogProductMutationInTransaction, "function");
  assert.equal(typeof buildShopCatalogAdminSnapshot, "function");
  assert.equal(typeof buildShopCatalogProjection, "function");
});
