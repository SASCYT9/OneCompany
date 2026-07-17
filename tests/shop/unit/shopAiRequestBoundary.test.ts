import assert from "node:assert/strict";
import test from "node:test";

import { validateShopAiJsonRequest } from "../../../src/lib/shopAiRequestBoundary";

const REQUEST_URL = "https://onecompany.global/api/shop/stock/assistant";

test("One AI accepts same-origin JSON requests", () => {
  assert.deepEqual(
    validateShopAiJsonRequest(
      new Headers({
        "Content-Type": "application/json; charset=utf-8",
        Origin: "https://onecompany.global",
      }),
      REQUEST_URL,
      {}
    ),
    { ok: true }
  );
});

test("One AI rejects unsafe text/plain and cross-origin requests", () => {
  assert.deepEqual(
    validateShopAiJsonRequest(
      new Headers({
        "Content-Type": "text/plain",
        Origin: "https://onecompany.global",
      }),
      REQUEST_URL,
      {}
    ),
    {
      ok: false,
      status: 415,
      error: "Content-Type must be application/json",
    }
  );

  assert.deepEqual(
    validateShopAiJsonRequest(
      new Headers({
        "Content-Type": "application/json",
        Origin: "https://attacker.example",
      }),
      REQUEST_URL,
      {}
    ),
    {
      ok: false,
      status: 403,
      error: "Origin is not allowed",
    }
  );
});

test("One AI requires Origin and accepts only explicitly configured extra origins", () => {
  assert.equal(
    validateShopAiJsonRequest(new Headers({ "Content-Type": "application/json" }), REQUEST_URL, {})
      .ok,
    false
  );

  assert.deepEqual(
    validateShopAiJsonRequest(
      new Headers({
        "Content-Type": "application/json",
        Origin: "https://preview.onecompany.example",
      }),
      REQUEST_URL,
      {
        SHOP_AI_ALLOWED_ORIGINS: "https://preview.onecompany.example,not-a-valid-origin",
      }
    ),
    { ok: true }
  );
});
