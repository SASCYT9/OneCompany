import assert from "node:assert/strict";
import test from "node:test";

import { matchesEventuriSharedV8Application } from "../../../src/lib/eventuriSharedIntake";

test("the shared V8 intake follows its own models, not a bare generation of the make", () => {
  assert.equal(matchesEventuriSharedV8Application("Porsche", null), true);
  assert.equal(matchesEventuriSharedV8Application("Porsche", "Cayenne"), true);
  assert.equal(matchesEventuriSharedV8Application("Porsche", "911"), false);
  // `Porsche` + 992.1 is a 911 selection, not a Cayenne one.
  assert.equal(matchesEventuriSharedV8Application("Porsche", null, "992.1"), false);
  assert.equal(matchesEventuriSharedV8Application("Porsche", "Cayenne", "9YA"), true);
  assert.equal(matchesEventuriSharedV8Application("Audi", "RSQ8", "4M"), true);
});
