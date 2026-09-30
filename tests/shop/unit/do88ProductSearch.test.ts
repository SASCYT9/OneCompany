import assert from "node:assert/strict";
import test from "node:test";
import { stripDo88SearchText } from "../../../src/lib/do88ProductSearch";

test("do88 catalog search preserves Ukrainian letters instead of making every query empty", () => {
  const query = stripDo88SearchText("фільтр");
  assert.equal(query, "фільтр");
  assert.equal(stripDo88SearchText("комплект фільтра SAI").includes(query), true);
  assert.equal(stripDo88SearchText("силіконовий патрубок").includes(query), false);
  assert.equal(stripDo88SearchText("ї є ґ і"), "їєґі");
});

test("do88 catalog search retains punctuation-tolerant original SKU matching", () => {
  assert.equal(stripDo88SearchText("ir-130r-48-do88"), "ir130r48do88");
  assert.equal(stripDo88SearchText("big-340-1-r").includes("big340"), true);
});
