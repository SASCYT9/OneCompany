import assert from "node:assert/strict";
import test from "node:test";
import nextConfig from "../../../next.config";

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
  assert.equal(
    resolveLegacyBrandRedirectPath("/shop/kw"),
    "/ua/shop/catalog?brand=KW%20Suspensions"
  );
  assert.equal(
    resolveLegacyBrandRedirectPath("/en/shop/fi/"),
    "/en/shop/catalog?brand=Fi%20EXHAUST"
  );
  assert.equal(resolveLegacyBrandRedirectPath("/eventuri"), "/ua/shop/eventuri");
  assert.equal(resolveLegacyBrandRedirectPath("/en/eventuri"), "/en/shop/eventuri");
  assert.equal(resolveLegacyBrandRedirectPath("/ua/shop/eventuri"), null);
});

test("next redirects cover localized legacy brand routes before middleware", async () => {
  const config = nextConfig as {
    redirects?: () => Promise<
      Array<{ source?: string; destination?: string; permanent?: boolean }>
    >;
  };
  const redirects = (await config.redirects?.()) ?? [];
  const legacy = redirects.filter(
    (entry) =>
      entry.source?.includes(":locale(ua|en)") &&
      (entry.source.endsWith("/kw") ||
        entry.source.endsWith("/fi") ||
        entry.source.endsWith("/eventuri"))
  );

  assert.deepEqual(
    legacy.map(({ source, destination, permanent }) => ({ source, destination, permanent })),
    [
      {
        source: "/:locale(ua|en)/kw",
        destination: "/:locale/shop/catalog?brand=KW%20Suspensions",
        permanent: true,
      },
      {
        source: "/:locale(ua|en)/fi",
        destination: "/:locale/shop/catalog?brand=Fi%20EXHAUST",
        permanent: true,
      },
      {
        source: "/:locale(ua|en)/eventuri",
        destination: "/:locale/shop/eventuri",
        permanent: true,
      },
      {
        source: "/:locale(ua|en)/shop/kw",
        destination: "/:locale/shop/catalog?brand=KW%20Suspensions",
        permanent: true,
      },
      {
        source: "/:locale(ua|en)/shop/fi",
        destination: "/:locale/shop/catalog?brand=Fi%20EXHAUST",
        permanent: true,
      },
      {
        source: "/:locale(ua|en)/brands/eventuri",
        destination: "/:locale/shop/eventuri",
        permanent: true,
      },
    ]
  );
});

test("retired static index redirects to the current localized homepage", async () => {
  const config = nextConfig as {
    redirects?: () => Promise<
      Array<{ source?: string; destination?: string; permanent?: boolean }>
    >;
  };
  const redirects = (await config.redirects?.()) ?? [];
  assert.deepEqual(
    redirects.find((entry) => entry.source === "/index.html"),
    { source: "/index.html", destination: "/ua", permanent: true }
  );
});

test("public utility HTML documents are excluded from organic indexing", async () => {
  const config = nextConfig as {
    headers?: () => Promise<
      Array<{
        source?: string;
        headers?: Array<{ key?: string; value?: string }>;
      }>
    >;
  };
  const headers = (await config.headers?.()) ?? [];
  const utilityRule = headers.find(
    (entry) =>
      entry.source === "/:legacyHtml(demo-hero|index|logo-audit|og-generator|thought-space).html"
  );
  assert.deepEqual(utilityRule?.headers, [
    { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  ]);
});

test("catalog pagination remains indexable while real filter variants stay noindex", async () => {
  const config = nextConfig as {
    headers?: () => Promise<
      Array<{
        source?: string;
        has?: Array<{ type?: string; key?: string }>;
        headers?: Array<{ key?: string; value?: string }>;
      }>
    >;
  };
  const headers = (await config.headers?.()) ?? [];
  const catalogRules = headers.filter((entry) => entry.source === "/:locale(ua|en)/shop/catalog");
  assert.equal(
    catalogRules.some((entry) => entry.has?.some((condition) => condition.key === "page")),
    false,
    "page is a pagination dimension, not a faceted filter"
  );
  assert.equal(
    catalogRules.some((entry) => entry.has?.some((condition) => condition.key === "brand")),
    true
  );
});
