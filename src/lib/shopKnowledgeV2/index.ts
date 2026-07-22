export {
  isShopKnowledgeBackfillAllowed,
  parseShopKnowledgeBackfillCategories,
  SHOP_KNOWLEDGE_BACKFILL_CATEGORIES,
} from "@/lib/shopKnowledgeV2/backfillPolicy";
export {
  SHOP_KNOWLEDGE_REQUIRED_HARD_ATTRIBUTES,
  extractCategoryAttributes,
  extractCategoryAttributesFromText,
  resolveKnowledgeCategoryGroup,
} from "@/lib/shopKnowledgeV2/attributes";
export { buildShopKnowledgeV2 } from "@/lib/shopKnowledgeV2/builders";
export { createPrismaShopKnowledgeChunkEmbeddingRepository } from "@/lib/shopKnowledgeV2/embeddingRepository";
export {
  SHOP_KNOWLEDGE_CHUNK_EMBEDDING_DIMENSIONS,
  SHOP_KNOWLEDGE_CHUNK_EMBEDDING_MODEL,
  runShopKnowledgeChunkEmbeddingBatch,
  runShopKnowledgeEmbeddingWorker,
  type ShopKnowledgeChunkEmbeddingBacklog,
  type ShopKnowledgeChunkEmbeddingCandidate,
  type ShopKnowledgeChunkEmbeddingProvider,
  type ShopKnowledgeChunkEmbeddingRepository,
  type ShopKnowledgeChunkEmbeddingStoreResult,
  type ShopKnowledgeChunkEmbeddingWrite,
  type ShopKnowledgeEmbeddingWorkerResult,
} from "@/lib/shopKnowledgeV2/embeddings";
export { hashKnowledgeValue, stableStringify } from "@/lib/shopKnowledgeV2/hash";
export {
  calculateKnowledgeRetryAt,
  indexShopKnowledgeProduct,
  previewShopKnowledgeProduct,
  runShopKnowledgeOutboxJobById,
  runShopKnowledgeOutboxWorker,
  StaleKnowledgeCommitError,
  type ShopKnowledgeV2Repository,
} from "@/lib/shopKnowledgeV2/indexer";
export { createPrismaShopKnowledgeV2Repository } from "@/lib/shopKnowledgeV2/prismaRepository";
export {
  getShopKnowledgeSourceProduct,
  listShopKnowledgeSourceProducts,
} from "@/lib/shopKnowledgeV2/source";
export {
  KNOWLEDGE_CHUNK_MAX_TOKENS,
  KNOWLEDGE_CHUNK_OVERLAP_TOKENS,
  KNOWLEDGE_CHUNK_TARGET_TOKENS,
  buildKnowledgeChunks,
  chunkKnowledgeText,
  collectKnowledgeTextSources,
  estimateKnowledgeTokenCount,
  htmlToKnowledgeText,
  tokenizeKnowledgeText,
} from "@/lib/shopKnowledgeV2/text";
export {
  SHOP_KNOWLEDGE_V2_EXTRACTOR_VERSION,
  SHOP_KNOWLEDGE_V2_SCHEMA_VERSION,
} from "@/lib/shopKnowledgeV2/types";
export type {
  KnowledgeCurrentRecord,
  KnowledgeIndexCommit,
  KnowledgeIndexOutcome,
  KnowledgeOutboxJob,
  KnowledgeSourceProduct,
  ShopKnowledgeBuild,
  ShopKnowledgeChunkDraft,
  ShopKnowledgeEvidenceDraft,
  ShopProductAttributeDraft,
  ShopVariantKnowledgeDraft,
  ShopVehicleApplicationDraft,
} from "@/lib/shopKnowledgeV2/types";
