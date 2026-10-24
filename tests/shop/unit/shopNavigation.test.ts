import assert from "node:assert/strict";
import test from "node:test";

import {
  getShopNavigationActiveKey,
  getShopNavigationDestinations,
} from "../../../src/lib/shopNavigation";

test("shop navigation is the catalog and the finder; there is no brands hub", () => {
  assert.deepEqual(getShopNavigationDestinations("ua"), [
    { key: "catalog", href: "/ua/shop/catalog" },
    { key: "selection", href: "/ua/contact#selection-form" },
  ]);
});

test("every shop page, brand landings included, belongs to the catalog", () => {
  assert.equal(getShopNavigationActiveKey("/ua/shop", "ua"), "catalog");
  assert.equal(getShopNavigationActiveKey("/ua/shop/brand/akrapovic", "ua"), "catalog");
  assert.equal(getShopNavigationActiveKey("/ua/shop/akrapovic-slip-on", "ua"), "catalog");
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
  assert.equal(getShopNavigationActiveKey("/en/shop/brand/racechip", "en"), "catalog");
  assert.equal(getShopNavigationActiveKey("/en/shop/catalog", "en"), "catalog");
  assert.equal(getShopNavigationActiveKey("/en/contact", "en"), "selection");
});
