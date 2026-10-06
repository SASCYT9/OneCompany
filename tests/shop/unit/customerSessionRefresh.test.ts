import assert from "node:assert/strict";
import test from "node:test";
import "./fixtures/register-server-only.mjs";
import { authOptions } from "../../../src/lib/authOptions";

test("a recently refreshed customer session does not re-read the database", async () => {
  const jwt = authOptions.callbacks!.jwt!;
  const token = { customerId: "customer-1", group: "B2C" as const, refreshedAt: Date.now() - 60_000 };
  // No database is configured in unit tests: a read here would reject.
  const result = await jwt({ token, user: undefined as never, account: null, trigger: "update" } as never);
  assert.equal(result.customerId, "customer-1");
  assert.equal(result.refreshedAt, token.refreshedAt);
});

test("signing in stamps the refresh time on the session token", async () => {
  const jwt = authOptions.callbacks!.jwt!;
  const before = Date.now();
  const result = await jwt({
    token: {},
    user: { id: "customer-1", customerId: "customer-1", group: "B2C", preferredLocale: "ua", email: "a@example.invalid" },
    account: null,
  } as never);
  assert.equal(result.customerId, "customer-1");
  assert.ok((result.refreshedAt ?? 0) >= before);
});
