import assert from "node:assert/strict";
import test from "node:test";
import { fetchShopStockSearch } from "../../../src/lib/shopStockSearchRequest";

test("transient failures retry once and recover the same search", async () => {
  for (const failure of [new TypeError("Failed to fetch"), 502, 503, 504]) {
    let calls = 0;
    const result = await fetchShopStockSearch("/search?q=Revozport+yu7", new AbortController().signal, (async (url, init) => {
      calls += 1;
      assert.equal(url, "/search?q=Revozport+yu7");
      if (calls === 1) { if (failure instanceof Error) throw failure; return new Response("unavailable", { status: failure }); }
      assert.equal(init?.cache, "no-store");
      return Response.json({ data: ["YU7"] });
    }) as typeof fetch);
    assert.deepEqual(result, { data: ["YU7"] });
    assert.equal(calls, 2);
  }
});

test("persistent, invalid, and cancelled searches remain bounded", async () => {
  for (const status of [400, 500, 503]) {
    let calls = 0;
    await assert.rejects(fetchShopStockSearch("/search", new AbortController().signal, (async () => { calls++; return new Response("failed", { status }); }) as typeof fetch));
    assert.equal(calls, status === 503 ? 2 : 1);
  }
  let calls = 0;
  await assert.rejects(fetchShopStockSearch("/search", new AbortController().signal, (async () => { calls++; return new Response("<html>invalid</html>"); }) as typeof fetch), /stock_response_invalid/);
  assert.equal(calls, 1);
  const controller = new AbortController();
  await assert.rejects(fetchShopStockSearch("/search", controller.signal, (async () => { controller.abort(); throw new TypeError("disconnected"); }) as typeof fetch));
});
