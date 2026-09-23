import assert from "node:assert/strict";
import test from "node:test";

import {
  hasFitmentResponseType,
  hasPartialFitmentCoverage,
  isCurrentFitmentRequest,
  isStringArray,
  parseShopStockJsonResponse,
  resolveFitmentOption,
} from "../../../src/lib/shopStockFitmentState";

test("fitment option restoration is case and alias key tolerant", () => {
  assert.equal(resolveFitmentOption(["G90", "G99"], "g90"), "G90");
  assert.equal(
    resolveFitmentOption(["M5"], "M5 LCI", (value) => value.replace(/\s+LCI$/i, "").toLowerCase()),
    "M5"
  );
  assert.equal(resolveFitmentOption(["M3"], "M5"), null);
});

test("stale fitment responses are rejected by request identity", () => {
  assert.equal(isCurrentFitmentRequest("bmw|m5", "bmw|m5"), true);
  assert.equal(isCurrentFitmentRequest("bmw|m5", "audi|rs6"), false);
  assert.equal(isCurrentFitmentRequest("bmw|m5", "bmw|m5", true), false);
});

test("fitment response arrays require string values", () => {
  assert.equal(isStringArray(["BMW", "Audi"]), true);
  assert.equal(isStringArray(["BMW", 5]), false);
  assert.equal(isStringArray(null), false);
});

test("partial fitment coverage is detected without treating missing metadata as complete evidence", () => {
  assert.equal(
    hasPartialFitmentCoverage({
      type: "models",
      data: ["M3"],
      meta: { coverage: "partial", complete: false },
    }),
    true
  );
  assert.equal(
    hasPartialFitmentCoverage({
      type: "models",
      data: ["M3"],
      meta: { coverage: "complete", complete: true },
    }),
    false
  );
  assert.equal(hasPartialFitmentCoverage({ type: "models", data: ["M3"] }), false);
  assert.equal(hasPartialFitmentCoverage(null), false);
});

test("stock response parsing rejects non-JSON and failed HTTP responses safely", async () => {
  await assert.rejects(
    parseShopStockJsonResponse(new Response("Unexpected end of JSON input", { status: 500 })),
    /stock_request_failed/
  );
  await assert.rejects(
    parseShopStockJsonResponse(new Response("<html>broken</html>", { status: 200 })),
    /stock_response_invalid/
  );
  assert.equal(hasFitmentResponseType({ type: "models", data: [] }, "models"), true);
  assert.equal(hasFitmentResponseType({ type: "chassis", data: [] }, "models"), false);
});
