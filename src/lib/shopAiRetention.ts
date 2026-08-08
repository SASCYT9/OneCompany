export const SHOP_AI_DETAILED_TRACE_RETENTION_DAYS = 30;
export const SHOP_AI_AGGREGATE_RETENTION_MONTHS = 12;
export const SHOP_AI_ABANDONED_RUN_AFTER_MINUTES = 5;

export function getShopAiRetentionCutoffs(now = new Date()) {
  const detailedTraceBefore = new Date(now);
  detailedTraceBefore.setUTCDate(
    detailedTraceBefore.getUTCDate() - SHOP_AI_DETAILED_TRACE_RETENTION_DAYS
  );

  const aggregateBefore = new Date(now);
  aggregateBefore.setUTCMonth(aggregateBefore.getUTCMonth() - SHOP_AI_AGGREGATE_RETENTION_MONTHS);

  const abandonedRunBefore = new Date(
    now.getTime() - SHOP_AI_ABANDONED_RUN_AFTER_MINUTES * 60 * 1_000
  );

  return {
    detailedTraceBefore,
    aggregateBefore,
    expiredConversationBefore: new Date(now),
    abandonedRunBefore,
  };
}
