import assert from "node:assert/strict";
import test from "node:test";

import { observeShopCatalogRead, shopCatalogFilterDimensions, shopCatalogServerTiming } from "../../../src/lib/shopCatalogReadTelemetry";

test("read telemetry records dimensions but never filter values", async () => {
  const logs: unknown[] = [];
  const secretQuery = "private exact sku ABC-123";
  const times = [10, 22.345];
  const read = await observeShopCatalogRead({
    operation: "listing", locale: "ua", filters: { text: secretQuery, brand: "Eventuri", fuel: null },
    databaseQueriesUpperBound: 1, rows: (value: string[]) => value.length,
    execute: async () => ["one", "two"], now: () => times.shift()!, log: (metric) => logs.push(metric),
  });
  assert.deepEqual(read.metric.filterDimensions, ["text", "brand"]);
  assert.equal(read.metric.durationMs, 12.345);
  assert.equal(read.metric.rowsReturned, 2);
  assert.equal(JSON.stringify(logs).includes(secretQuery), false);
  assert.equal(JSON.stringify(logs).includes("Eventuri"), false);
  assert.equal(shopCatalogServerTiming(read.metric), "catalog-v2-listing;dur=12.345");
});

test("read telemetry emits a bounded error type and rethrows", async () => {
  const logs: unknown[] = [];
  await assert.rejects(observeShopCatalogRead({
    operation: "suggestions", locale: "en", filters: { text: "private" }, databaseQueriesUpperBound: 3,
    rows: () => 0, execute: async () => { throw new TypeError("sensitive database detail"); },
    now: (() => { const values = [1, 2]; return () => values.shift()!; })(), log: (metric) => logs.push(metric),
  }), /sensitive database detail/);
  assert.match(JSON.stringify(logs), /TypeError/);
  assert.equal(JSON.stringify(logs).includes("sensitive database detail"), false);
});

test("empty and false filter values are not reported as active", () => {
  assert.deepEqual(shopCatalogFilterDimensions({ text: "", year: null, brand: false, scope: "auto" }), ["scope"]);
});
