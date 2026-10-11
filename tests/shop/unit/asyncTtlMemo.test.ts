import assert from "node:assert/strict";
import test from "node:test";
import { memoizeAsyncWithTtl } from "../../../src/lib/asyncTtlMemo";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("concurrent callers share a single in-flight load", async () => {
  let calls = 0;
  const gate = deferred<number>();
  const get = memoizeAsyncWithTtl(() => {
    calls += 1;
    return gate.promise;
  }, 1000);

  const first = get();
  const second = get();
  const third = get();
  gate.resolve(42);

  assert.deepEqual(await Promise.all([first, second, third]), [42, 42, 42]);
  assert.equal(calls, 1);
});

test("a result is reused until the TTL expires, then reloaded", async () => {
  let clock = 0;
  let calls = 0;
  const get = memoizeAsyncWithTtl(
    async () => {
      calls += 1;
      return calls;
    },
    1000,
    () => clock
  );

  assert.equal(await get(), 1);
  clock = 999;
  assert.equal(await get(), 1);
  clock = 1000;
  assert.equal(await get(), 2);
  assert.equal(calls, 2);
});

test("a failed load is not cached and the next caller retries", async () => {
  let calls = 0;
  const get = memoizeAsyncWithTtl(async () => {
    calls += 1;
    if (calls === 1) throw new Error("db down");
    return "ok";
  }, 1000);

  await assert.rejects(get(), /db down/);
  assert.equal(await get(), "ok");
  assert.equal(await get(), "ok");
  assert.equal(calls, 2);
});

test("reset forces the next caller to load again", async () => {
  let calls = 0;
  const get = memoizeAsyncWithTtl(async () => {
    calls += 1;
    return calls;
  }, 60_000);

  assert.equal(await get(), 1);
  assert.equal(await get(), 1);
  get.reset();
  assert.equal(await get(), 2);
  assert.equal(calls, 2);
});

test("a load that was running during reset does not repopulate the cache", async () => {
  const gates = [deferred<string>(), deferred<string>()];
  let calls = 0;
  const get = memoizeAsyncWithTtl(() => gates[calls++].promise, 60_000);

  const stale = get();
  get.reset();
  const fresh = get();
  assert.equal(calls, 2);

  gates[1].resolve("fresh");
  assert.equal(await fresh, "fresh");
  // The pre-reset load finishing late must neither overwrite the fresh value
  // nor clear the cache entry that belongs to the newer load.
  gates[0].resolve("stale");
  assert.equal(await stale, "stale");
  assert.equal(await get(), "fresh");
  assert.equal(calls, 2);
});
