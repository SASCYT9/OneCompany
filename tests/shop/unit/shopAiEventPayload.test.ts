import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { parseShopAiAttributionEvent } from "../../../src/lib/shopAiEventPayload";

test("OneAI attribution events accept only bounded candidate identities", () => {
  assert.deepEqual(
    parseShopAiAttributionEvent({
      event: "manager_handoff",
      runId: "run_123",
      conversationId: "conversation_123",
      productId: "product_123",
      variantId: null,
      locale: "ua",
    }),
    {
      ok: true,
      value: {
        event: "manager_handoff",
        runId: "run_123",
        conversationId: "conversation_123",
        productId: "product_123",
        variantId: null,
        locale: "ua",
      },
    }
  );

  assert.equal(
    parseShopAiAttributionEvent({
      event: "order_completed",
      runId: "run_123",
      productId: "product_123",
      locale: "ua",
    }).ok,
    false
  );
  assert.equal(
    parseShopAiAttributionEvent({
      event: "product_click",
      runId: "../../run",
      productId: "product_123",
      locale: "ua",
    }).ok,
    false
  );
});

test("event endpoint verifies origin, rate, ownership and shown candidate membership", () => {
  const route = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/shop/stock/assistant/events/route.ts"),
    "utf8"
  );
  const recorder = fs.readFileSync(path.join(process.cwd(), "src/lib/shopAiEvents.ts"), "utf8");

  assert.match(route, /validateShopAiJsonRequest/);
  assert.match(route, /consumeRateLimit/);
  assert.match(route, /loadShopAiConversation/);
  assert.match(recorder, /canLinkShopAiRun/);
  assert.match(recorder, /shown:\s*true/);
  assert.match(recorder, /candidate_not_owned/);
});

test("checkout copies nullable attribution and emits a server-side order signal", () => {
  const checkout = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/shop/checkout/route.ts"),
    "utf8"
  );
  const migration = fs.readFileSync(
    path.join(
      process.cwd(),
      "prisma/migrations/20260807120000_one_ai_production_upgrade/migration.sql"
    ),
    "utf8"
  );

  assert.match(checkout, /oneAiRunId:\s*attribution\?\.runId \?\? null/);
  assert.match(
    checkout,
    /oneAiCandidateDecisionId:\s*attribution\?\.candidateDecisionId \?\? null/
  );
  assert.match(checkout, /signal:\s*"ORDER_COMPLETED"/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "oneAiRunId" TEXT/);
  assert.doesNotMatch(migration, /UPDATE "Shop(?:Cart|Order)Item"/);
});
