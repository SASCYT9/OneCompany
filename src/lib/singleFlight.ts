/** Share concurrent work without caching successful values or failures. */
export function singleFlight<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => {
    if (!pending) {
      pending = Promise.resolve()
        .then(load)
        .finally(() => {
          pending = undefined;
        });
    }
    return pending;
  };
}
