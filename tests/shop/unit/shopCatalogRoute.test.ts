import assert from "node:assert/strict";
import test from "node:test";

import { generateMetadata } from "../../../src/app/[locale]/shop/catalog/metadata";
import {
  isIndexablePath,
  isNoindexPath,
  localizedStaticSlugs,
} from "../../../src/lib/seoIndexPolicy";

test("catalog route has localized self-canonical metadata", async () => {
  const uaMetadata = await generateMetadata({ params: Promise.resolve({ locale: "ua" }) });
  const enMetadata = await generateMetadata({ params: Promise.resolve({ locale: "en" }) });

  assert.equal(uaMetadata.title, "Каталог товарів | OneCompany");
  assert.equal(uaMetadata.alternates?.canonical, "https://onecompany.global/ua/shop/catalog");
  assert.equal(enMetadata.title, "Product catalog | OneCompany");
  assert.equal(enMetadata.alternates?.canonical, "https://onecompany.global/en/shop/catalog");
});

test("catalog is discoverable while the legacy stock route remains noindex", () => {
  assert.equal(localizedStaticSlugs.includes("/shop/catalog"), true);
  assert.equal(isIndexablePath("/ua/shop/catalog"), true);
  assert.equal(isNoindexPath("/ua/shop/catalog"), false);
  assert.equal(isNoindexPath("/ua/shop/stock"), true);
});
