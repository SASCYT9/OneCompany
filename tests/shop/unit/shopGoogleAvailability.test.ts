import test from "node:test";
import assert from "node:assert/strict";
import { googleProductAvailability } from "../../../src/lib/shopGoogleAvailability";

test("stock and already released items on order use the proper Google values", () => {
  assert.equal(googleProductAvailability("inStock").availability, "in_stock");
  assert.equal(googleProductAvailability("preOrder").availability, "backorder");
  assert.equal(googleProductAvailability("preOrder").availabilityDate, null);
});
test("availability date is emitted only from an explicit valid source date", () => {
  assert.equal(googleProductAvailability("preOrder", "2026-11-03").availabilityDate, "2026-11-03T00:00:00Z");
  assert.equal(googleProductAvailability("preOrder", "2026-02-30").availabilityDate, null);
  assert.equal(googleProductAvailability("preOrder", "4 weeks").availabilityDate, null);
  assert.equal(googleProductAvailability("preOrder", "2026-11-03T25:00:00Z").availabilityDate, null);
  assert.equal(googleProductAvailability("preOrder", "2026-11-03T12:30:00Z").availabilityDate, "2026-11-03T12:30:00Z");
});
