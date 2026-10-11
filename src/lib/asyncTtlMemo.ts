/**
 * Wraps an async loader so that
 *  - concurrent callers share one in-flight call instead of each issuing their
 *    own (a cold server otherwise runs the same heavy query once per request),
 *  - a successful result is reused for `ttlMs`,
 *  - a failed call is never cached: the next caller retries.
 */
export function memoizeAsyncWithTtl<T>(
  load: () => Promise<T>,
  ttlMs: number,
  now: () => number = Date.now
): () => Promise<T> {
  let cached: { value: T; at: number } | null = null;
  let inflight: Promise<T> | null = null;

  return () => {
    if (cached && now() - cached.at < ttlMs) return Promise.resolve(cached.value);
    if (!inflight) {
      inflight = load()
        .then((value) => {
          cached = { value, at: now() };
          return value;
        })
        .finally(() => {
          inflight = null;
        });
    }
    return inflight;
  };
}
