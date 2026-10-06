import test from "node:test";
import assert from "node:assert/strict";
import "./fixtures/register-server-only.mjs";
import { mergeShopCartItemInputs } from "../../../src/lib/shopCart";

test("mergeShopCartItemInputs aggregates guest and customer cart rows by slug and variant", () => {
  const merged = mergeShopCartItemInputs(
    [
      { slug: "urban-defender-kit", quantity: 1, variantId: "v1" },
      { slug: "urban-wheel-set", quantity: 2 },
    ],
    [
      { slug: "urban-defender-kit", quantity: 3, variantId: "v1" },
      { slug: "urban-defender-kit", quantity: 1, variantId: "v2" },
      { slug: "urban-wheel-set", quantity: 1 },
    ]
  );

  assert.deepEqual(merged, [
    { slug: "urban-defender-kit", quantity: 4, variantId: "v1" },
    { slug: "urban-wheel-set", quantity: 3, variantId: null },
    { slug: "urban-defender-kit", quantity: 1, variantId: "v2" },
  ]);
});

test("mergeShopCartItemInputs preserves OneAI attribution across cart rewrites", () => {
  const merged = mergeShopCartItemInputs(
    [
      {
        slug: "one-ai-product",
        quantity: 1,
        variantId: "v1",
        oneAiRunId: "run-1",
        oneAiCandidateDecisionId: "candidate-1",
      },
    ],
    [{ slug: "one-ai-product", quantity: 2, variantId: "v1" }]
  );

  assert.deepEqual(merged, [
    {
      slug: "one-ai-product",
      quantity: 3,
      variantId: "v1",
      oneAiRunId: "run-1",
      oneAiCandidateDecisionId: "candidate-1",
    },
  ]);
});

test("reading a guest cart does not write unless the expiry is close", async () => {
  const { resolveShopCart } = await import("../../../src/lib/shopCart");
  const day = 24 * 60 * 60 * 1000;
  const cart = (expiresInDays: number) => ({
    id: "cart-1", token: "token-1", customerId: null, currency: "EUR", locale: "en",
    expiresAt: new Date(Date.now() + expiresInDays * day), createdAt: new Date(), updatedAt: new Date(), items: [],
  });
  const fakePrisma = (row: ReturnType<typeof cart>) => {
    const calls = { update: 0, create: 0 };
    const client = { shopCart: {
      findFirst: async () => row,
      update: async ({ data }: { data: object }) => { calls.update++; return { ...row, ...data }; },
      create: async () => { calls.create++; return row; },
    } };
    return { calls, client: client as never };
  };
  const fresh = fakePrisma(cart(25));
  await resolveShopCart(fresh.client, { cartToken: "token-1", currency: "EUR", locale: "en" });
  assert.deepEqual(fresh.calls, { update: 0, create: 0 });
  const expiring = fakePrisma(cart(3));
  await resolveShopCart(expiring.client, { cartToken: "token-1", currency: "EUR", locale: "en" });
  assert.deepEqual(expiring.calls, { update: 1, create: 0 });
});

test("the cart count cookie is readable by the header badge and the token stays httpOnly", async () => {
  const { NextResponse } = await import("next/server");
  const { setShopCartCookies } = await import("../../../src/lib/shopCart");
  const { readShopCartCount } = await import("../../../src/lib/shopCartCountCookie");
  const response = NextResponse.json({});
  setShopCartCookies(response, "token-1", 3);
  assert.equal(response.cookies.get("oc_cart_count")?.value, "3");
  assert.equal(response.cookies.get("oc_cart_count")?.httpOnly, false);
  assert.equal(response.cookies.get("oc_cart_token")?.httpOnly, true);
  assert.equal(readShopCartCount("theme=dark; oc_cart_count=12; x=1"), 12);
  assert.equal(readShopCartCount("theme=dark"), null);
});
