import assert from "node:assert/strict";
import test from "node:test";

import {
  buildShopAiOwnerSignature,
  buildShopAiQuerySignature,
  redactShopAiContextValue,
  redactShopAiText,
  resolveShopAiOwnerHmacSecret,
} from "../../../src/lib/shopAiPrivacy";

const OWNER_SECRET = "test-one-ai-owner-hmac-secret-32-bytes";

test("redacts email, phone and VIN before One AI telemetry", () => {
  const result = redactShopAiText(
    "Напишіть test@example.com або +38 (067) 123-45-67, VIN WBA8D9G50JNU12345"
  );

  assert.equal(result.text.includes("test@example.com"), false);
  assert.equal(result.text.includes("067"), false);
  assert.equal(result.text.includes("WBA8D9G50JNU12345"), false);
  assert.deepEqual(result.redacted, ["email", "phone", "vin"]);
});

test("redacts VINs formatted with spaces or hyphens before any One AI sink", () => {
  const spacedVin = "W B A 8 D 9 G 5 0 J N U 1 2 3 4 5";
  const hyphenatedVin = "WBA8D9G50-JNU12345";
  const result = redactShopAiText(`Перевір ${spacedVin} та ${hyphenatedVin}`);

  assert.equal(result.text.includes("W B A"), false);
  assert.equal(result.text.includes("WBA8D9G50"), false);
  assert.equal(result.text, "Перевір [vin] та [vin]");
  assert.deepEqual(result.redacted, ["vin"]);
});

test("query signature is stable after whitespace normalization", () => {
  assert.equal(
    buildShopAiQuerySignature("BMW   M3 2018 вихлоп"),
    buildShopAiQuerySignature("bmw m3 2018 вихлоп")
  );
});

test("owner signatures keep different IPv4 guests isolated", () => {
  const first = buildShopAiOwnerSignature({ ip: "203.0.113.10" }, OWNER_SECRET);
  const second = buildShopAiOwnerSignature({ ip: "198.51.100.77" }, OWNER_SECRET);

  assert.notEqual(first, second);
  assert.equal(first, buildShopAiOwnerSignature({ ip: " 203.0.113.10 " }, OWNER_SECRET));
});

test("owner signatures bind authenticated customers to the request IP", () => {
  const first = buildShopAiOwnerSignature(
    {
      customerId: "customer-1",
      ip: "203.0.113.10",
    },
    OWNER_SECRET
  );

  assert.notEqual(
    first,
    buildShopAiOwnerSignature(
      {
        customerId: "customer-2",
        ip: "203.0.113.10",
      },
      OWNER_SECRET
    )
  );
  assert.notEqual(
    first,
    buildShopAiOwnerSignature(
      {
        customerId: "customer-1",
        ip: "203.0.113.11",
      },
      OWNER_SECRET
    )
  );
});

test("owner pseudonyms use a keyed HMAC and production has no public fallback", () => {
  const identity = { customerId: "customer-1", ip: "203.0.113.10" };
  const first = buildShopAiOwnerSignature(identity, OWNER_SECRET);
  const rotated = buildShopAiOwnerSignature(identity, "rotated-one-ai-owner-hmac-secret-32-bytes");

  assert.notEqual(first, rotated);
  assert.equal(
    resolveShopAiOwnerHmacSecret({
      NODE_ENV: "production",
      NEXTAUTH_SECRET: OWNER_SECRET,
    }),
    OWNER_SECRET
  );
  assert.throws(
    () => resolveShopAiOwnerHmacSecret({ NODE_ENV: "production" }),
    /required in production/
  );
});

test("redacts PII from free-form assistant context before planning", () => {
  const value = redactShopAiContextValue(
    "<b>BMW</b> WBA8D9G50JNU12345 test@example.com +38 (067) 123-45-67",
    120
  );

  assert.equal(value.includes("WBA8D9G50JNU12345"), false);
  assert.equal(value.includes("test@example.com"), false);
  assert.equal(value.includes("067"), false);
  assert.equal(value.startsWith("BMW"), true);
});
