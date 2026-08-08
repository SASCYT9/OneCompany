import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  SHOP_AI_CLIENT_ABORT_MS,
  SHOP_AI_DEFAULT_MODEL,
  SHOP_AI_PLANNER_TIMEOUT_MS,
  SHOP_AI_QUERY_EMBEDDING_TIMEOUT_MS,
  SHOP_AI_SERVER_TURN_DEADLINE_MS,
  classifyShopAiProviderError,
  resolveShopAiProviderApiKey,
  shouldOpenShopAiProviderCircuit,
} from "../../../src/lib/shopAiProviderPolicy";

test("OneAI uses Gemini 3.5 Flash-Lite with a provider-supported planner timeout", () => {
  assert.equal(SHOP_AI_DEFAULT_MODEL, "gemini-3.5-flash-lite");
  assert.equal(SHOP_AI_PLANNER_TIMEOUT_MS, 12_000);
  assert.equal(SHOP_AI_QUERY_EMBEDDING_TIMEOUT_MS, 10_000);
  assert.equal(SHOP_AI_SERVER_TURN_DEADLINE_MS, 15_000);
  assert.equal(SHOP_AI_CLIENT_ABORT_MS, 18_000);
});

test("Gemini planner is schema-bound and does not send deprecated sampling parameters", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/lib/shopAiAssistantProvider.ts"),
    "utf8"
  );

  assert.match(source, /responseMimeType:\s*"application\/json"/);
  assert.match(source, /responseSchema:/);
  assert.match(source, /maxOutputTokens:/);
  assert.match(source, /httpOptions:\s*\{\s*timeout:\s*SHOP_AI_PLANNER_TIMEOUT_MS\s*\}/);
  assert.doesNotMatch(source, /\btemperature\s*:/);
  assert.doesNotMatch(source, /\btop[PK]\s*:/);
});

test("provider keys prefer dedicated planner and embedding credentials over legacy Gemini", () => {
  assert.equal(
    resolveShopAiProviderApiKey({
      SHOP_AI_API_KEY: " planner-key ",
      SHOP_AI_EMBEDDING_API_KEY: "embedding-key",
      GEMINI_API_KEY: "legacy-key",
    }),
    "planner-key"
  );
  assert.equal(
    resolveShopAiProviderApiKey({
      SHOP_AI_EMBEDDING_API_KEY: " embedding-key ",
      GEMINI_API_KEY: "leaked-legacy-key",
    }),
    "embedding-key"
  );
  assert.equal(resolveShopAiProviderApiKey({ GEMINI_API_KEY: " legacy-key " }), "legacy-key");
  assert.equal(resolveShopAiProviderApiKey({}), null);
});

test("provider failures map to stable internal classes", () => {
  assert.equal(classifyShopAiProviderError({ status: 401 }), "auth");
  assert.equal(classifyShopAiProviderError({ status: 429 }), "quota");
  assert.equal(classifyShopAiProviderError(new Error("deadline exceeded")), "timeout");
  assert.equal(classifyShopAiProviderError(new Error("fetch failed: ECONNRESET")), "network");
  assert.equal(
    classifyShopAiProviderError({ status: 400, message: "response schema invalid" }),
    "schema"
  );
  assert.equal(
    classifyShopAiProviderError({ status: 400, message: "model not found" }),
    "invalid_config"
  );
});

test("only auth and invalid configuration open the warm-instance circuit", () => {
  assert.equal(shouldOpenShopAiProviderCircuit("auth"), true);
  assert.equal(shouldOpenShopAiProviderCircuit("invalid_config"), true);
  assert.equal(shouldOpenShopAiProviderCircuit("quota"), false);
  assert.equal(shouldOpenShopAiProviderCircuit("network"), false);
});
