import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

import type { ShopAiTelemetryRepository } from "../../../src/lib/shopAiTelemetry";

const serverOnlyStub = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")
).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: serverOnlyStub, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const telemetryModule = import("../../../src/lib/shopAiTelemetry");

type RunCreateInput = Parameters<ShopAiTelemetryRepository["createRun"]>[0];
type FeedbackInput = Parameters<ShopAiTelemetryRepository["createFeedback"]>[0];

function createRepository(overrides: Partial<ShopAiTelemetryRepository> = {}) {
  const repository: ShopAiTelemetryRepository = {
    async createRun() {
      return "run_1";
    },
    async completeRun() {
      return true;
    },
    async failRun() {
      return true;
    },
    async createCandidateDecisions(input) {
      return input.length;
    },
    async createFeedback() {
      return {
        feedbackId: "feedback_1",
        reviewTaskId: null,
        linkedToRun: false,
      };
    },
    ...overrides,
  };
  return repository;
}

test("telemetry redacts PII and bounds the persisted query", async () => {
  const { createShopAiTelemetry, SHOP_AI_TELEMETRY_MAX_MESSAGE_LENGTH } = await telemetryModule;
  const captured: RunCreateInput[] = [];
  const telemetry = createShopAiTelemetry(
    createRepository({
      async createRun(input) {
        captured.push(input);
        return "run_1";
      },
    })
  );
  const ownerKeyHash = "a".repeat(64);
  const result = await telemetry.createRun({
    locale: "ua",
    currency: "EUR",
    message:
      `Напишіть test@example.com або +380 67 123 45 67. VIN WBA8D9C50JA123456. ` +
      "x".repeat(1_000),
    constraints: {
      note: "Owner test@example.com",
    },
    ownerKeyHash,
  });

  assert.equal(result.persisted, true);
  const persisted = captured[0];
  assert.ok(persisted);
  assert.ok(persisted.redactedQuery.length <= SHOP_AI_TELEMETRY_MAX_MESSAGE_LENGTH);
  assert.doesNotMatch(persisted.redactedQuery, /test@example\.com/u);
  assert.doesNotMatch(persisted.redactedQuery, /WBA8D9C50JA123456/u);
  assert.match(persisted.redactedQuery, /\[email\]/u);
  assert.match(persisted.redactedQuery, /\[vin\]/u);
  assert.deepEqual(persisted.constraints, {
    note: "Owner [email]",
    __ownerKeyHash: ownerKeyHash,
  });
});

test("feedback parser enforces the public contract", async () => {
  const { parseShopAiFeedbackPayload } = await telemetryModule;

  assert.deepEqual(
    parseShopAiFeedbackPayload({
      runId: "run_123",
      conversationId: "conversation-123",
      rating: "down",
      reason: "wrong_fitment",
      locale: "ua",
    }),
    {
      ok: true,
      value: {
        runId: "run_123",
        conversationId: "conversation-123",
        rating: "down",
        reason: "wrong_fitment",
        locale: "ua",
      },
    }
  );
  assert.equal(parseShopAiFeedbackPayload({ rating: "bad", locale: "ua" }).ok, false);
  assert.equal(
    parseShopAiFeedbackPayload({
      runId: "../foreign",
      rating: "up",
      locale: "en",
    }).ok,
    false
  );
  assert.equal(
    parseShopAiFeedbackPayload({
      rating: "down",
      reason: "change_fitment_automatically",
      locale: "en",
    }).ok,
    false
  );
});

test("negative fitment feedback is queued for review but never mutates fitment", async () => {
  const { createShopAiTelemetry, SHOP_AI_TELEMETRY_MAX_COMMENT_LENGTH } = await telemetryModule;
  const captured: FeedbackInput[] = [];
  const telemetry = createShopAiTelemetry(
    createRepository({
      async createFeedback(input) {
        captured.push(input);
        return {
          feedbackId: "feedback_1",
          reviewTaskId: "review_1",
          linkedToRun: true,
        };
      },
    })
  );

  const result = await telemetry.recordFeedback({
    runId: "run_1",
    conversationId: null,
    rating: "down",
    reason: "wrong_fitment",
    locale: "ua",
    comment: `test@example.com ${"x".repeat(800)}`,
  });

  assert.equal(result.persisted, true);
  const persisted = captured[0];
  assert.ok(persisted);
  assert.equal(persisted.signal, "THUMBS_DOWN");
  assert.equal(persisted.reason, "WRONG_FITMENT");
  assert.equal(persisted.createReviewTask, true);
  assert.ok((persisted.comment?.length ?? 0) <= SHOP_AI_TELEMETRY_MAX_COMMENT_LENGTH);
  assert.doesNotMatch(persisted.comment ?? "", /test@example\.com/u);
});

test("a run can only be linked through its owner hash or validated conversation", async () => {
  const { canLinkShopAiRun } = await telemetryModule;
  const ownerKeyHash = "b".repeat(64);

  assert.equal(
    canLinkShopAiRun({
      runConversationId: "conversation_1",
      runConstraints: { __ownerKeyHash: ownerKeyHash },
      validatedConversationId: null,
      ownerKeyHash,
    }),
    true
  );
  assert.equal(
    canLinkShopAiRun({
      runConversationId: "conversation_1",
      runConstraints: {},
      validatedConversationId: "conversation_1",
      ownerKeyHash: "c".repeat(64),
    }),
    true
  );
  assert.equal(
    canLinkShopAiRun({
      runConversationId: "conversation_1",
      runConstraints: { __ownerKeyHash: ownerKeyHash },
      validatedConversationId: "conversation_2",
      ownerKeyHash: "c".repeat(64),
    }),
    false
  );
});

test("missing telemetry tables never block the assistant", async () => {
  const { createShopAiTelemetry } = await telemetryModule;
  const telemetry = createShopAiTelemetry(
    createRepository({
      async createRun() {
        throw Object.assign(new Error("table does not exist"), {
          code: "P2021",
        });
      },
    })
  );

  const result = await telemetry.createRun({
    locale: "en",
    currency: "EUR",
    message: "BMW M3 exhaust",
  });
  assert.deepEqual(result, { persisted: false, value: null });
});

test("no-result telemetry creates a manager review task without changing catalog facts", async () => {
  const { createShopAiTelemetry } = await telemetryModule;
  const captured: FeedbackInput[] = [];
  const telemetry = createShopAiTelemetry(
    createRepository({
      async createFeedback(input) {
        captured.push(input);
        return {
          feedbackId: "feedback_2",
          reviewTaskId: "review_2",
          linkedToRun: true,
        };
      },
    })
  );

  await telemetry.recordNoResult({
    runId: "run_1",
    conversationId: null,
    locale: "en",
  });

  const persisted = captured[0];
  assert.ok(persisted);
  assert.equal(persisted.signal, "NO_RESULT");
  assert.equal(persisted.reason, "MISSING_PRODUCT");
  assert.equal(persisted.createReviewTask, true);
});

test("missing-product feedback is promoted to review", async () => {
  const { createShopAiTelemetry } = await telemetryModule;
  const captured: FeedbackInput[] = [];
  const telemetry = createShopAiTelemetry(
    createRepository({
      async createFeedback(input) {
        captured.push(input);
        return {
          feedbackId: "feedback_3",
          reviewTaskId: "review_3",
          linkedToRun: true,
        };
      },
    })
  );

  await telemetry.recordFeedback({
    runId: "run_1",
    conversationId: null,
    rating: "down",
    reason: "missing_product",
    locale: "ua",
  });

  assert.equal(captured[0]?.reason, "MISSING_PRODUCT");
  assert.equal(captured[0]?.createReviewTask, true);
});
