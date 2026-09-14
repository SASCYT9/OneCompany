import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAdminProductPayload } from "../../../src/lib/shopAdminCatalog";
import {
  defaultShopStorefrontDisplay,
  readShopStorefrontDisplay,
  parseShopStorefrontDisplay,
} from "../../../src/lib/shopStorefrontDisplay";
import {
  getShopConfirmedAvailability,
  isShopInStockProduct,
  isShopWarehouseHeroProduct,
  resolveShopConfirmedStock,
  shouldShowShopProductInCarousel,
} from "../../../src/lib/shopWarehouseInventory";
import { ShopAvailabilityBadge } from "../../../src/components/shop/ShopAvailabilityBadge";
import { AdminCheckboxField } from "../../../src/components/admin/AdminFormFields";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const hidden = { availability: "inStock", showInStock: false, showInCarousel: false } as const;
const license = { availability: "inStock", showInStock: true, showInCarousel: false } as const;
const featured = { ...license, showInCarousel: true };
const transit = { availability: "inTransit", showInStock: false, showInCarousel: false } as const;

test("saved manager settings override legacy inventory, including explicit false", () => {
  assert.equal(isShopInStockProduct("85230", "", hidden), false);
  assert.equal(getShopConfirmedAvailability("BM3-LIC-S55", "", hidden), null);
  assert.equal(shouldShowShopProductInCarousel("85230", "", hidden), false);
  assert.equal(isShopInStockProduct("NEW-SKU", "", license), true);
  assert.equal(shouldShowShopProductInCarousel("NEW-SKU", "", license), false);
  assert.equal(shouldShowShopProductInCarousel("NEW-SKU", "", featured), true);
  assert.equal(getShopConfirmedAvailability("85230", "", transit), "inTransit");
  assert.equal(resolveShopConfirmedStock("85230", "", "inStock", transit), "preOrder");
  assert.equal(
    isShopWarehouseHeroProduct({
      partNumber: "85230",
      slug: "",
      inStock: true,
      thumbnail: "/x.jpg",
      showInCarousel: false,
    }),
    false
  );
});

test("existing bootmod3 settings start with available licenses and the adapter in transit", () => {
  assert.deepEqual(defaultShopStorefrontDisplay("BM3-LIC-S55"), license);
  assert.deepEqual(defaultShopStorefrontDisplay("BM3-WIFI-ADAPTER"), transit);
  assert.deepEqual(defaultShopStorefrontDisplay("85230"), featured);
  assert.equal(defaultShopStorefrontDisplay("UNCONFIRMED", "", "inStock").showInStock, false);
});

test("admin payload persists and reloads display settings without replacing unrelated metadata IDs", () => {
  const { data, errors } = normalizeAdminProductPayload({
    slug: "license",
    titleEn: "License",
    stock: "inStock",
    storefrontDisplay: license,
    metafields: [
      { id: "material-id", namespace: "custom", key: "material", value: "carbon" },
      {
        id: "display-id",
        namespace: "onecompany",
        key: "storefront_display",
        value: JSON.stringify(featured),
        valueType: "json",
      },
    ],
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(readShopStorefrontDisplay(data.metafields), license);
  assert.equal(
    data.metafields.find((field) => field.key === "storefront_display")?.id,
    "display-id"
  );
  assert.equal(data.metafields.find((field) => field.key === "material")?.id, "material-id");
  const reload = normalizeAdminProductPayload({
    slug: "license",
    titleEn: "License",
    metafields: data.metafields,
  });
  assert.deepEqual(reload.errors, []);
  assert.deepEqual(readShopStorefrontDisplay(reload.data.metafields), license);
});

test("admin rejects contradictory or malformed controls; invalid stored settings fail closed", () => {
  for (const settings of [
    { ...transit, showInStock: true },
    { ...transit, showInCarousel: true },
    { ...hidden, showInCarousel: true },
    { ...license, showInStock: "false" },
  ]) {
    assert.equal(parseShopStorefrontDisplay(settings), null);
    const result = normalizeAdminProductPayload({
      slug: "p",
      titleEn: "Product",
      storefrontDisplay: settings,
    });
    assert.ok(result.errors.length);
  }
  assert.equal(readShopStorefrontDisplay([]), undefined);
  assert.deepEqual(
    readShopStorefrontDisplay([
      { namespace: "onecompany", key: "storefront_display", value: "bad json" },
    ]),
    {
      availability: "preOrder",
      showInStock: false,
      showInCarousel: false,
    }
  );
});

test("only in-stock availability renders a badge and disabled carousel controls are actually disabled", () => {
  for (const [locale, label] of [
    ["ua", "В наявності"],
    ["en", "In stock"],
  ] as const) {
    for (const availability of ["inTransit", null, undefined] as const) {
      assert.equal(
        renderToStaticMarkup(createElement(ShopAvailabilityBadge, { locale, availability })),
        ""
      );
    }
    const html = renderToStaticMarkup(
      createElement(ShopAvailabilityBadge, { locale, availability: "inStock" })
    );
    assert.ok(html.includes(label));
  }
  const html = renderToStaticMarkup(
    createElement(AdminCheckboxField, {
      label: "Показувати в каруселі",
      checked: false,
      disabled: true,
      onChange: () => {},
    })
  );
  assert.match(html, /disabled=""/);
});
