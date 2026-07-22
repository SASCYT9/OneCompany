import assert from "node:assert/strict";
import test from "node:test";

import {
  getMobileBottomNavigationActiveKey,
  shouldHideMobileBottomNavigation,
} from "../../../src/lib/mobileBottomNavigation";

test("mobile navigation resolves the four primary destinations", () => {
  assert.equal(getMobileBottomNavigationActiveKey("/ua", "ua"), "home");
  assert.equal(getMobileBottomNavigationActiveKey("/ua/shop", "ua"), "shop");
  assert.equal(getMobileBottomNavigationActiveKey("/ua/shop/akrapovic/products", "ua"), "shop");
  assert.equal(getMobileBottomNavigationActiveKey("/ua/shop/catalog", "ua"), "shop");
  assert.equal(getMobileBottomNavigationActiveKey("/ua/shop/stock", "ua"), "shop");
  assert.equal(getMobileBottomNavigationActiveKey("/ua/contact", "ua"), "selection");
  assert.equal(getMobileBottomNavigationActiveKey("/ua/shop/cart", "ua"), "cart");
  assert.equal(getMobileBottomNavigationActiveKey("/ua/shop/cartoon", "ua"), "shop");
  assert.equal(getMobileBottomNavigationActiveKey("/ua/about", "ua"), null);
});

test("mobile navigation stays out of admin and checkout flows", () => {
  assert.equal(shouldHideMobileBottomNavigation("/ua/admin", "ua"), true);
  assert.equal(shouldHideMobileBottomNavigation("/ua/shop/checkout", "ua"), true);
  assert.equal(shouldHideMobileBottomNavigation("/ua/shop/checkout/success", "ua"), true);
  assert.equal(shouldHideMobileBottomNavigation("/ua/shop/cart", "ua"), false);
});
