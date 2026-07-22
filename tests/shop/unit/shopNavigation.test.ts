import assert from "node:assert/strict";
import test from "node:test";

import {
  getShopNavigationActiveKey,
  getShopNavigationDestinations,
} from "../../../src/lib/shopNavigation";

test("shop navigation exposes brands, catalog, and finder without a second shop", () => {
  assert.deepEqual(getShopNavigationDestinations("ua"), [
    { key: "brands", href: "/ua/shop" },
    { key: "catalog", href: "/ua/shop/catalog" },
    { key: "selection", href: "/ua/contact#selection-form" },
  ]);
});

test("shop navigation distinguishes storefronts from the global catalog", () => {
  assert.equal(getShopNavigationActiveKey("/ua/shop", "ua"), "brands");
  assert.equal(getShopNavigationActiveKey("/ua/shop/akrapovic", "ua"), "brands");
  assert.equal(
    getShopNavigationActiveKey("/ua/shop/akrapovic/products/akrapovic-slip-on", "ua"),
    "brands"
  );
  assert.equal(getShopNavigationActiveKey("/ua/shop/catalog", "ua"), "catalog");
  assert.equal(getShopNavigationActiveKey("/ua/shop/stock", "ua"), "catalog");
  assert.equal(getShopNavigationActiveKey("/ua/shop/generic-product-slug", "ua"), "catalog");
  assert.equal(getShopNavigationActiveKey("/ua/shop/turn14/product/42", "ua"), "catalog");
});

test("shop utilities do not masquerade as a shopping destination", () => {
  assert.equal(getShopNavigationActiveKey("/ua/shop/account", "ua"), null);
  assert.equal(getShopNavigationActiveKey("/ua/shop/cart", "ua"), null);
  assert.equal(getShopNavigationActiveKey("/ua/shop/checkout", "ua"), null);
  assert.equal(getShopNavigationActiveKey("/ua/contact", "ua"), "selection");
  assert.equal(getShopNavigationActiveKey("/ua", "ua"), null);
});

test("shop navigation remains locale-aware", () => {
  assert.equal(getShopNavigationActiveKey("/en/shop/racechip/catalog", "en"), "brands");
  assert.equal(getShopNavigationActiveKey("/en/shop/catalog", "en"), "catalog");
  assert.equal(getShopNavigationActiveKey("/en/contact", "en"), "selection");
});
