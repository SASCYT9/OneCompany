import assert from "node:assert/strict";
import test from "node:test";
import { resolveMetaAdLocaleRedirect } from "../../../src/lib/metaAdLocaleRedirect";

const INSTAGRAM_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0 (iPhone15,2; iOS 18_0; en_US; en; scale=3.00)";
const FACEBOOK_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]";
const SAFARI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const GOOGLEBOT =
  "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const adVisit = {
  pathname: "/en/shop/catalog",
  country: "UA",
  userAgent: INSTAGRAM_IOS,
  referer: null,
  hasFbclid: false,
  isDocumentRequest: true,
};

test("Ukrainian visitors from Meta apps land on the Ukrainian catalog", () => {
  assert.equal(resolveMetaAdLocaleRedirect(adVisit), "/ua/shop/catalog");
  assert.equal(
    resolveMetaAdLocaleRedirect({ ...adVisit, userAgent: FACEBOOK_ANDROID }),
    "/ua/shop/catalog"
  );
  // An ad click opened outside the in-app browser still carries fbclid or the referrer.
  assert.equal(
    resolveMetaAdLocaleRedirect({ ...adVisit, userAgent: SAFARI_IOS, hasFbclid: true }),
    "/ua/shop/catalog"
  );
  assert.equal(
    resolveMetaAdLocaleRedirect({
      ...adVisit,
      userAgent: SAFARI_IOS,
      referer: "https://l.instagram.com/",
    }),
    "/ua/shop/catalog"
  );
});

test("everyone else keeps the English catalog", () => {
  // Visitors outside Ukraine, or with no known country.
  assert.equal(resolveMetaAdLocaleRedirect({ ...adVisit, country: "DE" }), null);
  assert.equal(resolveMetaAdLocaleRedirect({ ...adVisit, country: null }), null);
  // Ukrainian visitors who did not come from a Meta app.
  assert.equal(resolveMetaAdLocaleRedirect({ ...adVisit, userAgent: SAFARI_IOS }), null);
  assert.equal(
    resolveMetaAdLocaleRedirect({
      ...adVisit,
      userAgent: SAFARI_IOS,
      referer: "https://www.google.com/",
    }),
    null
  );
  assert.equal(
    resolveMetaAdLocaleRedirect({
      ...adVisit,
      userAgent: SAFARI_IOS,
      referer: "https://instagram.com.evil.example/",
    }),
    null
  );
  // Crawlers.
  assert.equal(
    resolveMetaAdLocaleRedirect({ ...adVisit, userAgent: GOOGLEBOT, country: "US" }),
    null
  );
  // Client-side navigation (RSC fetch), so the language switcher still works.
  assert.equal(resolveMetaAdLocaleRedirect({ ...adVisit, isDocumentRequest: false }), null);
  // Other paths, including the Ukrainian catalog itself (no redirect loop).
  assert.equal(resolveMetaAdLocaleRedirect({ ...adVisit, pathname: "/ua/shop/catalog" }), null);
  assert.equal(resolveMetaAdLocaleRedirect({ ...adVisit, pathname: "/en/shop/eventuri" }), null);
  assert.equal(resolveMetaAdLocaleRedirect({ ...adVisit, pathname: "/en" }), null);
});
