/** Retries only an atomically rolled-back Serializable price-only transaction. */
export async function retrySerializablePriceBatch<T>(
  action: () => Promise<T>,
  onRetry?: (attempt: number) => void
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await action();
    } catch (error) {
      const databaseError = error as { code?: string; meta?: { code?: string } };
      const serializationConflict = databaseError?.code === "P2034" ||
        (databaseError?.code === "P2010" && ["40001", "40P01"].includes(databaseError.meta?.code ?? ""));
      if (!serializationConflict || attempt >= 11) throw error;
      onRetry?.(attempt + 1);
      const delay = Math.min(1000, 100 * (attempt + 1)) + Math.floor(Math.random() * 150);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
