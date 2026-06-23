import test from "node:test";
import assert from "node:assert/strict";

import {
  fetchAtomicEuNetPriceBySku,
  parseAtomicEuPrice,
} from "../../../scripts/_lib/atomic-eu-prices";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createFetchMock(routes: Array<[string, unknown]>, seenUrls: string[]) {
  return async (input: string | URL): Promise<Response> => {
    const url = String(input);
    seenUrls.push(url);
    const match = routes.find(([needle]) => url.includes(needle));
    if (!match) return jsonResponse({ error: "not found" }, 404);
    return jsonResponse(match[1]);
  };
}

test("Atomic EU parser confirms exact SKU from product JSON with Ukraine market net price", async () => {
  const seenUrls: string[] = [];
  const fetchImpl = createFetchMock(
    [
      [
        "/search/suggest.json",
        {
          resources: {
            results: {
              products: [
                {
                  title: "Akrapovic Mercedes AMG G63",
                  handle: "akrapovic-s-me-t-13h",
                  price: "7047.00",
                },
              ],
            },
          },
        },
      ],
      [
        "/products/akrapovic-s-me-t-13h.json",
        {
          product: {
            title: "AKRAPOVIC S-ME/T/13H",
            vendor: "Akrapovic",
            variants: [{ id: 101, sku: "S-ME/T/13H", price: "7047.00" }],
          },
        },
      ],
    ],
    seenUrls
  );

  const result = await fetchAtomicEuNetPriceBySku("S-ME/T/13H", { fetchImpl });

  assert.equal(result.status, "matched");
  if (result.status === "matched") {
    assert.equal(result.handle, "akrapovic-s-me-t-13h");
    assert.equal(result.priceEurNet, 7047);
    assert.equal(result.rawPrice, "7047.00");
    assert.equal(result.variantSku, "S-ME/T/13H");
  }
  assert.ok(seenUrls[0].includes("country=UA"));
  assert.ok(seenUrls.some((url) => url.includes(".json?country=UA")));
});

test("Atomic EU parser skips ambiguous exact SKU matches", async () => {
  const seenUrls: string[] = [];
  const fetchImpl = createFetchMock(
    [
      [
        "/search/suggest.json",
        {
          resources: {
            results: {
              products: [
                { title: "First", handle: "first-product", price: "100.00" },
                { title: "Second", handle: "second-product", price: "101.00" },
              ],
            },
          },
        },
      ],
      [
        "/products/first-product.json",
        {
          product: {
            title: "First",
            vendor: "Atomic",
            variants: [{ id: 1, sku: "ABC-123", price: "100.00" }],
          },
        },
      ],
      [
        "/products/second-product.json",
        {
          product: {
            title: "Second",
            vendor: "Atomic",
            variants: [{ id: 2, sku: "ABC/123", price: "101.00" }],
          },
        },
      ],
    ],
    seenUrls
  );

  const result = await fetchAtomicEuNetPriceBySku("ABC 123", { fetchImpl });

  assert.equal(result.status, "skipped");
  if (result.status === "skipped") {
    assert.equal(result.reason, "ambiguous");
  }
});

test("Atomic EU parser skips when search has products but no exact SKU variant", async () => {
  const seenUrls: string[] = [];
  const fetchImpl = createFetchMock(
    [
      [
        "/search/suggest.json",
        {
          resources: {
            results: {
              products: [{ title: "Nearby", handle: "nearby-product", price: "50.00" }],
            },
          },
        },
      ],
      [
        "/products/nearby-product.json",
        {
          product: {
            title: "Nearby",
            vendor: "Atomic",
            variants: [{ id: 1, sku: "OTHER-SKU", price: "50.00" }],
          },
        },
      ],
    ],
    seenUrls
  );

  const result = await fetchAtomicEuNetPriceBySku("TARGET-SKU", { fetchImpl });

  assert.equal(result.status, "skipped");
  if (result.status === "skipped") {
    assert.equal(result.reason, "no_exact_variant");
  }
});

test("Atomic EU parser skips when suggest returns no product handles", async () => {
  const seenUrls: string[] = [];
  const fetchImpl = createFetchMock(
    [
      [
        "/search/suggest.json",
        {
          resources: {
            results: {
              products: [],
            },
          },
        },
      ],
    ],
    seenUrls
  );

  const result = await fetchAtomicEuNetPriceBySku("MISSING", { fetchImpl });

  assert.equal(result.status, "skipped");
  if (result.status === "skipped") {
    assert.equal(result.reason, "not_found");
  }
});

test("Atomic EU price parser handles Shopify JSON decimal strings", () => {
  assert.equal(parseAtomicEuPrice("7047.00"), 7047);
  assert.equal(parseAtomicEuPrice("7,047.25"), 7047.25);
  assert.equal(parseAtomicEuPrice("7.047,25"), 7047.25);
});
