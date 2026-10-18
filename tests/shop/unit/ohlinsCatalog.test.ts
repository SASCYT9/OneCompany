import test from "node:test";
import assert from "node:assert/strict";
import "./fixtures/register-server-only.mjs";

import { detectOhlinsCategory, detectOhlinsMake } from "../../../src/lib/ohlinsCatalog";
import {
  normalizeFeedManagedProductImages,
  resolveFeedManagedCatalogImage,
} from "../../../src/lib/shopCatalogServer";
import type { ShopProduct } from "../../../src/lib/shopCatalog";
import {
  OHLINS_FAMILY_IMAGES,
  resolveOhlinsFamilyImage,
} from "../../../src/lib/ohlinsFamilyImages";

test("detectOhlinsMake maps the corrected Isuzu prefix", () => {
  assert.equal(
    detectOhlinsMake({
      slug: "ohlins-isv-dmax-road-track",
      title: { en: "OHLINS Road & Track Kit", ua: "OHLINS Road & Track Kit" },
    }),
    "Isuzu"
  );
});

test("detectOhlinsMake falls back to Universal for hardware-only items", () => {
  assert.equal(
    detectOhlinsMake({
      slug: "ohlins-10216-02",
      title: {
        en: "OHLINS 10216-02 Dust Boot R & T Car",
        ua: "OHLINS 10216-02 Dust Boot R & T Car",
      },
    }),
    "Universal"
  );

  assert.equal(
    detectOhlinsMake({
      slug: "ohlins-35020-16",
      title: {
        en: "OHLINS 35020-16 Electronic Damping Kit Chevrolet Camaro",
        ua: "OHLINS 35020-16 Electronic Damping Kit Chevrolet Camaro",
      },
    }),
    "Chevrolet"
  );
});

test("detectOhlinsCategory classifies mounts and motorsport catalog items", () => {
  assert.deepEqual(
    detectOhlinsCategory({
      title: {
        en: "OHLINS 05926-10 Rear Shock Mount Set BMW M3 E46",
        ua: "OHLINS 05926-10 Rear Shock Mount Set BMW M3 E46",
      },
      shortDescription: { en: "", ua: "" },
    }),
    { label: "Mounts & Hardware", labelUa: "Опори та кріплення" }
  );

  assert.deepEqual(
    detectOhlinsCategory({
      title: {
        en: "OHLINS GTTX25 Motorsport Suspension Damper Formula Student Damper TTX 25 MkII 267/90",
        ua: "OHLINS GTTX25 Motorsport Suspension Damper Formula Student Damper TTX 25 MkII 267/90",
      },
      shortDescription: { en: "", ua: "" },
    }),
    { label: "Motorsport", labelUa: "Motorsport" }
  );

  assert.deepEqual(
    detectOhlinsCategory({
      title: {
        en: "OHLINS 25608-01 Rubber Bushing 16/37/37",
        ua: "OHLINS 25608-01 Rubber Bushing 16/37/37",
      },
      shortDescription: { en: "", ua: "" },
    }),
    { label: "Mounts & Hardware", labelUa: "Опори та кріплення" }
  );

  // Specific line wins over generic "coilover/койловер" Road & Track catch-all.
  assert.deepEqual(
    detectOhlinsCategory({
      title: {
        en: "Advanced Trackday TTX coilover kit (incl. springs and top mounts) for BMW M3 (G80) / M4 (G82)",
        ua: "Комплект койловерів Advanced Trackday TTX (включаючи пружини та верхні опори) для BMW M3 (G80) / M4 (G82)",
      },
      shortDescription: { en: "", ua: "" },
    }),
    { label: "Advanced Trackday", labelUa: "Advanced Trackday" }
  );
});

test("resolveFeedManagedCatalogImage replaces stale Brabus cache images for Ohlins", () => {
  assert.equal(
    resolveFeedManagedCatalogImage("/images/shop/brabus/hq/brabus-portal-hero.png", "OHLINS"),
    "/images/shop/ohlins/ohlins-product-fallback.png"
  );

  assert.equal(
    resolveFeedManagedCatalogImage("/images/shop/ohlins/catalog-fallback.jpg", "OHLINS"),
    "/images/shop/ohlins/catalog-fallback.jpg"
  );

  assert.equal(
    resolveFeedManagedCatalogImage(
      "https://d3pd3d30e33rxi.cloudfront.net/_default_upload_bucket/ohlins-pov-my00-1.jpg",
      "OHLINS"
    ),
    "https://d3pd3d30e33rxi.cloudfront.net/_default_upload_bucket/ohlins-pov-my00-1.jpg"
  );
});

test("Öhlins items without a photo show their family's photo, the rest the brand picture", () => {
  const family = (title: string) => resolveOhlinsFamilyImage({ brand: "OHLINS", title });
  assert.equal(
    family(
      "OHLINS BMV GU21M2 Комплект койловерів Advanced Trackday TTX (включаючи пружини та верхні опори)"
    ),
    OHLINS_FAMILY_IMAGES.ttxKit
  );
  assert.equal(
    family("OHLINS BMS 1U00 Амортизатор передній лівий для BMW 3 (F30/G20)"),
    OHLINS_FAMILY_IMAGES.roadDamper
  );
  assert.equal(
    family(
      "OHLINS FOV 3X50 Задній лівий амортизатор для FORD Everest (U704/UB) 2022 (Пружини продаються окремо)"
    ),
    OHLINS_FAMILY_IMAGES.offRoadDamper
  );
  assert.equal(
    family("OHLINS 10363-01 Передня пружина ліфта підвіски 30 мм для амортизатора INV MZ00"),
    OHLINS_FAMILY_IMAGES.spring
  );
  assert.equal(
    family("OHLINS 05173-11 Допоміжна пружина 67/9/105"),
    OHLINS_FAMILY_IMAGES.helperSpring
  );
  assert.equal(
    family("OHLINS G90377-M2 Опори амортизатора Millway для BMW M2 (F87)"),
    OHLINS_FAMILY_IMAGES.topMounts
  );
  assert.equal(
    family("OHLINS 35020-35 Комплект для скасування MERCEDES A45 AMG (W177)"),
    OHLINS_FAMILY_IMAGES.cancelKit
  );
  for (const title of [
    "OHLINS 00710-05 С-подібний ключ",
    "OHLINS 25602-03 Підшипник для VWS MU21",
    "OHLINS 35021-04 Комплект кронштейнів EDC TTX для BMW M3 (F80)",
    "OHLINS 05925-10 Набір підйомних адаптерів Advanced Trackday для Porsche 991",
  ]) {
    assert.equal(family(title), null, title);
  }
  assert.equal(resolveOhlinsFamilyImage({ brand: "KW Suspensions", title: "Амортизатор" }), null);

  assert.equal(
    resolveFeedManagedCatalogImage("", "OHLINS", null, "OHLINS 62473-09 Пружина 90/420/50 N/mm"),
    OHLINS_FAMILY_IMAGES.spring
  );
  // The catalog mapping already put the brand picture in for a product without media.
  assert.equal(
    resolveFeedManagedCatalogImage(
      "/images/shop/ohlins/ohlins-product-fallback.png",
      "OHLINS",
      null,
      "Амортизатор задній для TESLA Model 3 / Model Y"
    ),
    OHLINS_FAMILY_IMAGES.roadDamper
  );
  assert.equal(
    resolveFeedManagedCatalogImage("", "OHLINS", null, "OHLINS 00710-05 С-подібний ключ"),
    "/images/shop/ohlins/ohlins-product-fallback.png"
  );
  assert.equal(
    resolveFeedManagedCatalogImage("", "AKRAPOVIC", null, "Пружина"),
    "/images/shop/akrapovic/factory-fallback.jpg"
  );
});

test("products shown with a substitute picture are marked, so the Merchant feed skips them", () => {
  const product = (brand: string, image: string, title: string) =>
    ({ brand, image, gallery: [image], title: { ua: title, en: "" } }) as unknown as ShopProduct;

  const damper = normalizeFeedManagedProductImages(
    product("OHLINS", "/images/shop/ohlins/ohlins-product-fallback.png", "Амортизатор задній")
  );
  assert.equal(damper.image, OHLINS_FAMILY_IMAGES.roadDamper);
  assert.deepEqual(damper.gallery, [OHLINS_FAMILY_IMAGES.roadDamper]);
  assert.equal(damper.imagePlaceholder, true);

  const exhaust = normalizeFeedManagedProductImages(
    product("AKRAPOVIC", "/images/shop/akrapovic/factory-fallback.jpg", "Вихлопна система")
  );
  assert.equal(exhaust.image, "/images/shop/akrapovic/factory-fallback.jpg");
  assert.equal(exhaust.imagePlaceholder, true);

  const ownPhoto = OHLINS_FAMILY_IMAGES.ttxKit;
  const kit = normalizeFeedManagedProductImages(
    product("OHLINS", ownPhoto, "OHLINS NIR GN00 до-т підвіски Advanced Trackday")
  );
  assert.equal(kit.image, ownPhoto);
  assert.equal(kit.imagePlaceholder, undefined);
});
