import assert from "node:assert/strict";
import test from "node:test";
import {
  boundedCatalogPages,
  readCatalogRowsWithSizeFallback,
} from "../../../src/lib/boundedCatalogPages";

test("bounded reads preserve all rows and order, including an empty payload page", async () => {
  const ids = Array.from({ length: 23 }, (_, index) => String(index).padStart(3, "0"));
  let active = 0;
  let peak = 0;
  const result: string[] = [];
  for await (const page of boundedCatalogPages({
    pageSize: 2,
    concurrency: 4,
    readIds: async (after, limit) => ids.filter((id) => !after || id > after).slice(0, limit),
    readRows: async (batch) => {
      assert.ok(batch.length <= 2);
      peak = Math.max(peak, ++active);
      await new Promise((resolve) => setImmediate(resolve));
      active--;
      // Products unpublished after the ID read must not stall pagination.
      return batch.filter((id) => id !== "002" && id !== "003");
    },
  }))
    result.push(...page);
  assert.deepEqual(
    result,
    ids.filter((id) => id !== "002" && id !== "003")
  );
  assert.equal(peak, 4);
});

test("failed payload reads fail the load instead of publishing a partial catalog", async () => {
  await assert.rejects(async () => {
    for await (const _page of boundedCatalogPages({
      pageSize: 1,
      concurrency: 2,
      readIds: async () => ["a", "b"],
      readRows: async (ids) => {
        if (ids[0] === "b") throw new Error("database unavailable");
        return ids;
      },
    })) {
      /* consume */
    }
  }, /database unavailable/);
});

test("empty catalogs and exact windows terminate without duplicate rows", async () => {
  for (const count of [0, 4, 8]) {
    const ids = Array.from({ length: count }, (_, index) => String(index));
    const actual: string[] = [];
    for await (const page of boundedCatalogPages({
      pageSize: 2,
      concurrency: 2,
      readIds: async (after, limit) => ids.filter((id) => !after || id > after).slice(0, limit),
      readRows: async (batch) => batch,
    }))
      actual.push(...page);
    assert.deepEqual(actual, ids);
  }
});

test("oversized responses split without losing IDs or multiplying concurrency", async () => {
  const ids = ["a", "b", "c", "d", "e", "f", "g"];
  let active = 0;
  let peak = 0;
  let splits = 0;
  const result = await readCatalogRowsWithSizeFallback(ids, async (batch) => {
    peak = Math.max(peak, ++active);
    await new Promise((resolve) => setImmediate(resolve));
    active--;
    if (batch.length > 2) {
      splits++;
      throw Object.assign(new Error("response too large"), { code: "P6009" });
    }
    return batch;
  });
  assert.deepEqual(result, ids);
  assert.equal(splits, 3);
  assert.equal(peak, 1);
});

test("size fallback propagates unrelated errors and a single oversized record", async () => {
  for (const [ids, code] of [
    [["a", "b"], "P6004"],
    [["a"], "P6009"],
  ] as const) {
    const error = Object.assign(new Error(code), { code });
    let calls = 0;
    await assert.rejects(
      readCatalogRowsWithSizeFallback([...ids], async () => {
        calls++;
        throw error;
      }),
      (actual) => actual === error
    );
    assert.equal(calls, 1);
  }
});
