import assert from "node:assert/strict";
import test from "node:test";

import { generateMetadata } from "../../../src/app/[locale]/shop/catalog/metadata";
import { generateMetadata as generateRewrittenCatalogMetadata } from "../../../src/app/[locale]/shop/stock/layout";
import {
  isIndexablePath,
  isNoindexPath,
  localizedStaticSlugs,
  resolveLegacyBrandRedirectPath,
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

test("rewritten catalog resolves public catalog metadata at the stock destination", async () => {
  for (const locale of ["ua", "en"] as const) {
    const metadata = await generateRewrittenCatalogMetadata({
      params: Promise.resolve({ locale }),
    });

    assert.equal(
      metadata.alternates?.canonical,
      `https://onecompany.global/${locale}/shop/catalog`
    );
    assert.deepEqual(metadata.alternates?.languages, {
      uk: "https://onecompany.global/ua/shop/catalog",
      en: "https://onecompany.global/en/shop/catalog",
      "x-default": "https://onecompany.global/ua/shop/catalog",
    });
    assert.equal(metadata.openGraph?.url, `https://onecompany.global/${locale}/shop/catalog`);
    assert.equal(
      metadata.robots,
      undefined,
      "the shared metadata must not noindex the public catalog"
    );
  }
});

test("live Eventuri and Ilmberger entry pages are discoverable in both sitemap locales", () => {
  for (const slug of [
    "/shop/eventuri",
    "/shop/ilmberger",
    "/shop/ilmberger/collections",
  ] as const) {
    assert.equal(localizedStaticSlugs.filter((entry) => entry === slug).length, 1);
    for (const locale of ["ua", "en"]) {
      assert.equal(isIndexablePath(`/${locale}${slug}`), true);
      assert.equal(isNoindexPath(`/${locale}${slug}`), false);
    }
  }
});

test("legacy brand routes redirect to localized canonical storefront destinations", () => {
  assert.equal(resolveLegacyBrandRedirectPath("/kw"), "/ua/shop/catalog?brand=KW%20Suspensions");
  assert.equal(resolveLegacyBrandRedirectPath("/en/kw"), "/en/shop/catalog?brand=KW%20Suspensions");
  assert.equal(resolveLegacyBrandRedirectPath("/ua/fi/"), "/ua/shop/catalog?brand=Fi%20EXHAUST");
  assert.equal(resolveLegacyBrandRedirectPath("/eventuri"), "/ua/shop/eventuri");
  assert.equal(resolveLegacyBrandRedirectPath("/en/eventuri"), "/en/shop/eventuri");
  assert.equal(resolveLegacyBrandRedirectPath("/ua/shop/eventuri"), null);
});
