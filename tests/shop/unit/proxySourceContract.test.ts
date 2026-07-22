import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const proxySource = readFileSync("src/proxy.ts", "utf8");

test("proxy preserves storefront routing while adding the admin path header", () => {
  assert.match(proxySource, /createMiddleware\(routing\)/);
  assert.match(proxySource, /resolveRemovedBlogRedirectPath/);
  assert.match(proxySource, /hasLocalePrefix/);
  assert.match(proxySource, /x-vercel-ip-country/);
  assert.match(proxySource, /shouldAllowAdminApiRequest/);
  assert.match(proxySource, /shouldAllowAdminPageRequest/);
  assert.match(proxySource, /ADMIN_PATH_HEADER/);
  assert.match(proxySource, /request:\s*\{[\s\S]*headers:\s*requestHeaders/);
  assert.match(proxySource, /matcher:\s*\["\/\(\(\?!_next\/static/);
  assert.doesNotMatch(proxySource, /matcher:\s*\["\/admin\/:path\*"\]/);
});
