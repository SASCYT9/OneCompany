import assert from "node:assert/strict";
import test from "node:test";
import { singleFlight } from "../../../src/lib/singleFlight";

test("simultaneous catalog consumers share one load, subsequent calls can refresh", async () => {
  let loads = 0;
  let finish!: (value: number) => void;
  const load = singleFlight(() => {
    loads++;
    return new Promise<number>((resolve) => {
      finish = resolve;
    });
  });
  const first = load();
  const second = load();
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(loads, 1);
  finish(42);
  assert.deepEqual(await Promise.all([first, second]), [42, 42]);
  const next = load();
  await Promise.resolve();
  assert.equal(loads, 2);
  finish(43);
  assert.equal(await next, 43);
});

test("a failed catalog load is released so the next request can retry", async () => {
  let loads = 0;
  const load = singleFlight(async () => {
    if (++loads === 1) throw new Error("temporary failure");
    return 42;
  });
  const first = load();
  const second = load();
  const outcomes = await Promise.allSettled([first, second]);
  assert.ok(outcomes.every((result) => result.status === "rejected"));
  assert.equal(await load(), 42);
  assert.equal(loads, 2);
});
