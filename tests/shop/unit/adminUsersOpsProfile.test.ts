import assert from "node:assert/strict";
import test from "node:test";

import { normalizeOpsMemberProfilePayload } from "../../../src/lib/admin/adminUsers";

test("normalizes a Telegram manager profile without losing bigint precision", () => {
  const result = normalizeOpsMemberProfilePayload({
    telegramUserId: "8622639642",
    telegramEnabled: true,
    timezone: "Europe/Kyiv",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.telegramUserId, BigInt("8622639642"));
    assert.equal(result.value.timezone, "Europe/Kyiv");
  }
});

test("rejects invalid timezone, bigint range, and enabled profile without Telegram ID", () => {
  assert.equal(
    normalizeOpsMemberProfilePayload({
      telegramUserId: "8622639642",
      telegramEnabled: true,
      timezone: "Not/A_Timezone",
    }).ok,
    false
  );
  assert.equal(
    normalizeOpsMemberProfilePayload({
      telegramUserId: "9223372036854775808",
      telegramEnabled: true,
      timezone: "Europe/Kyiv",
    }).ok,
    false
  );
  assert.equal(
    normalizeOpsMemberProfilePayload({
      telegramUserId: null,
      telegramEnabled: true,
      timezone: "Europe/Kyiv",
    }).ok,
    false
  );
});
