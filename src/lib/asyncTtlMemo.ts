export type ResettableAsyncMemo<T> = (() => Promise<T>) & {
  /** Drop the cached value and forget any in-flight load (its result is discarded). */
  reset(): void;
};

/**
 * Wraps an async loader so that
 *  - concurrent callers share one in-flight call instead of each issuing their
 *    own (a cold server otherwise runs the same heavy query once per request),
 *  - a successful result is reused for `ttlMs`,
 *  - a failed call is never cached: the next caller retries,
 *  - `reset()` forces the next caller to load again, and a load that was already
 *    running when `reset()` was called cannot repopulate the cache afterwards.
 */
export function memoizeAsyncWithTtl<T>(
  load: () => Promise<T>,
  ttlMs: number,
  now: () => number = Date.now
): ResettableAsyncMemo<T> {
  let cached: { value: T; at: number } | null = null;
  let inflight: Promise<T> | null = null;
  let generation = 0;

  const memo = (() => {
    if (cached && now() - cached.at < ttlMs) return Promise.resolve(cached.value);
    if (!inflight) {
      const startedIn = generation;
      const promise: Promise<T> = load()
        .then((value) => {
          if (generation === startedIn) cached = { value, at: now() };
          return value;
        })
        .finally(() => {
          if (inflight === promise) inflight = null;
        });
      inflight = promise;
    }
    return inflight;
  }) as ResettableAsyncMemo<T>;

  memo.reset = () => {
    generation += 1;
    cached = null;
    inflight = null;
  };

  return memo;
}
