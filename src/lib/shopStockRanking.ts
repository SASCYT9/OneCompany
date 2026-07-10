export type ShopStockRankingSignals = {
  brand: string;
  score: number;
  stableKey: string;
};

const normalizeRankingBucket = (value: string) => value.trim().toLocaleLowerCase("en-US");

export function diversifyShopStockItems<T>(
  items: T[],
  getSignals: (item: T) => ShopStockRankingSignals
): T[] {
  const ranked = items
    .map((item, originalIndex) => ({ item, originalIndex, signals: getSignals(item) }))
    .sort((left, right) => {
      const scoreDifference = right.signals.score - left.signals.score;
      if (scoreDifference !== 0) return scoreDifference;

      const keyDifference = left.signals.stableKey.localeCompare(right.signals.stableKey, "en");
      if (keyDifference !== 0) return keyDifference;
      return left.originalIndex - right.originalIndex;
    });

  const buckets = new Map<string, typeof ranked>();
  for (const entry of ranked) {
    const bucketName = normalizeRankingBucket(entry.signals.brand) || "other";
    const bucket = buckets.get(bucketName);
    if (bucket) bucket.push(entry);
    else buckets.set(bucketName, [entry]);
  }

  const orderedBuckets = Array.from(buckets.entries()).sort((left, right) => {
    const scoreDifference = right[1][0].signals.score - left[1][0].signals.score;
    if (scoreDifference !== 0) return scoreDifference;
    return left[0].localeCompare(right[0], "en");
  });

  const result: T[] = [];
  let row = 0;
  let addedInRow = true;
  while (addedInRow) {
    addedInRow = false;
    for (const [, bucket] of orderedBuckets) {
      const entry = bucket[row];
      if (!entry) continue;
      result.push(entry.item);
      addedInRow = true;
    }
    row += 1;
  }

  return result;
}
