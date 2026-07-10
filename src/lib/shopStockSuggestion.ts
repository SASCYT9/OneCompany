type StockSuggestionMatchInput = {
  strictSkuQuery: boolean;
  tokenCount: number;
  tokenMatches: number;
  compactQuery: string;
  compactSku: string;
};

export function shouldIncludeStockSuggestionMatch({
  strictSkuQuery,
  tokenCount,
  tokenMatches,
  compactQuery,
  compactSku,
}: StockSuggestionMatchInput) {
  const matchesAllTokens = tokenCount > 0 && tokenMatches === tokenCount;
  const matchesCompactSku = Boolean(compactQuery) && compactSku.includes(compactQuery);
  return strictSkuQuery ? matchesCompactSku : matchesAllTokens || matchesCompactSku;
}
