type SearchParamReader = {
  getAll(name: string): string[];
};

export function parseShopStockParamList(searchParams: SearchParamReader, key: string): string[] {
  const seen = new Set<string>();
  const values: string[] = [];

  for (const rawValue of searchParams.getAll(key)) {
    for (const rawPart of rawValue.split(",")) {
      const value = rawPart.trim();
      if (!value) continue;

      const dedupeKey = value.toLowerCase();
      if (seen.has(dedupeKey)) continue;

      seen.add(dedupeKey);
      values.push(value);
    }
  }

  return values;
}
