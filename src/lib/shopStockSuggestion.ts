type StockSuggestionMatchInput = {
  strictSkuQuery: boolean;
  tokenCount: number;
  tokenMatches: number;
  compactQuery: string;
  compactSku: string;
  allowCompactSkuMatch?: boolean;
};

export function shouldIncludeStockSuggestionMatch({
  strictSkuQuery,
  tokenCount,
  tokenMatches,
  compactQuery,
  compactSku,
  allowCompactSkuMatch = true,
}: StockSuggestionMatchInput) {
  const matchesAllTokens = tokenCount > 0 && tokenMatches === tokenCount;
  const matchesCompactSku =
    allowCompactSkuMatch && Boolean(compactQuery) && compactSku.includes(compactQuery);
  return strictSkuQuery ? matchesCompactSku : matchesAllTokens || matchesCompactSku;
}
