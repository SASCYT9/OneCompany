export const SHOP_KNOWLEDGE_V2_OTHER_QUARANTINE_REASON =
  "Excluded from Knowledge V2 because categoryGroup=other; exact-SKU identity lookup remains available from the published catalog.";
export const SHOP_KNOWLEDGE_V2_CATALOG_INELIGIBLE_QUARANTINE_REASON =
  "Excluded from Knowledge V2 because the catalog product is unpublished or inactive.";
export const SHOP_KNOWLEDGE_V2_QUARANTINED_SCHEMA_VERSION = 1;

export function assertShopKnowledgeV2OtherQuarantineCommitSafe(input: {
  candidateCount: number;
  expectedCount: number;
  maxRecords: number;
}) {
  if (!Number.isInteger(input.maxRecords) || input.maxRecords < 1 || input.maxRecords > 10_000) {
    throw new Error("Knowledge V2 quarantine maxRecords must be an integer between 1 and 10000");
  }
  if (input.candidateCount !== input.expectedCount) {
    throw new Error(
      `Knowledge V2 quarantine candidate set changed: expected ${input.expectedCount}, locked ${input.candidateCount}`
    );
  }
  if (input.candidateCount > input.maxRecords) {
    throw new Error(
      `Knowledge V2 quarantine refused ${input.candidateCount} records; maxRecords is ${input.maxRecords}`
    );
  }
}
