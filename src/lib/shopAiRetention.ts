export const SHOP_AI_DETAILED_TRACE_RETENTION_DAYS = 30;
export const SHOP_AI_AGGREGATE_RETENTION_MONTHS = 12;

export function getShopAiRetentionCutoffs(now = new Date()) {
  const detailedTraceBefore = new Date(now);
  detailedTraceBefore.setUTCDate(
    detailedTraceBefore.getUTCDate() - SHOP_AI_DETAILED_TRACE_RETENTION_DAYS
  );

  const aggregateBefore = new Date(now);
  aggregateBefore.setUTCMonth(aggregateBefore.getUTCMonth() - SHOP_AI_AGGREGATE_RETENTION_MONTHS);

  return {
    detailedTraceBefore,
    aggregateBefore,
    expiredConversationBefore: new Date(now),
  };
}
