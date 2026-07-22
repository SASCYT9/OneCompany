import type { ShopStockCategoryGroupId } from "@/lib/shopStockTaxonomy";

export const SHOP_KNOWLEDGE_V2_SCHEMA_VERSION = 2;
export const SHOP_KNOWLEDGE_V2_EXTRACTOR_VERSION = "2.0.0";

export type KnowledgeLocale = "ua" | "en" | "neutral";
export type KnowledgeStatus =
  | "PENDING"
  | "PROCESSING"
  | "READY"
  | "NEEDS_REVIEW"
  | "FAILED"
  | "BLOCKED";
export type KnowledgeOutboxStatus =
  | "PENDING"
  | "PROCESSING"
  | "RETRY"
  | "COMPLETED"
  | "DEAD_LETTER";
export type KnowledgeEvidenceSource =
  | "manager"
  | "manual_fitment"
  | "supplier"
  | "category_adapter"
  | "description_extraction";
export type KnowledgeConfidence = "verified" | "high" | "medium" | "low" | "unknown";
export type KnowledgeOpfGpf = "with" | "without" | "unknown";

export type KnowledgeSourceVariant = {
  id: string;
  title: string | null;
  sku: string | null;
  position: number;
  option1Value: string | null;
  option2Value: string | null;
  option3Value: string | null;
  inventoryQty: number;
  updatedAt: Date;
};

export type KnowledgeSourceOption = {
  id: string;
  name: string;
  position: number;
  values: string[];
  updatedAt: Date;
};

export type KnowledgeSourceMetafield = {
  id: string;
  namespace: string;
  key: string;
  value: string;
  valueType: string;
  updatedAt: Date;
};

export type KnowledgeManagerEvidenceSource = {
  evidenceKey: string;
  fieldPath: string;
  sourceRef: string | null;
  excerpt: string | null;
  sourceHash: string;
  confidence: number;
  extractorVersion: string | null;
  isManagerVerified: boolean;
  verifiedById: string | null;
  verifiedAt: Date | null;
  updatedAt: Date;
};

export type KnowledgeManagerApplicationSource = {
  applicationKey: string;
  variantId: string | null;
  scope: string;
  make: string | null;
  model: string | null;
  generation: string | null;
  chassisCode: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  engine: string | null;
  fuel: string | null;
  bodyStyle: string | null;
  drivetrain: string | null;
  transmission: string | null;
  market: string | null;
  opfGpf: string | null;
  categoryGroup: string | null;
  productKind: string | null;
  material: string | null;
  isUniversal: boolean;
  verificationStatus: "VERIFIED" | "NEEDS_REVIEW";
  confidence: number;
  verifiedById: string | null;
  verifiedAt: Date | null;
  updatedAt: Date;
  evidence: KnowledgeManagerEvidenceSource[];
};

export type KnowledgeSourceProduct = {
  id: string;
  slug: string;
  sku: string | null;
  scope: string;
  brand: string | null;
  vendor: string | null;
  productType: string | null;
  productCategory: string | null;
  titleUa: string;
  titleEn: string;
  categoryUa: string | null;
  categoryEn: string | null;
  shortDescUa: string | null;
  shortDescEn: string | null;
  longDescUa: string | null;
  longDescEn: string | null;
  leadTimeUa: string | null;
  leadTimeEn: string | null;
  collectionUa: string | null;
  collectionEn: string | null;
  bodyHtmlUa: string | null;
  bodyHtmlEn: string | null;
  seoTitleUa: string | null;
  seoTitleEn: string | null;
  seoDescriptionUa: string | null;
  seoDescriptionEn: string | null;
  tags: string[];
  highlights: unknown;
  isPublished: boolean;
  status: string;
  updatedAt: Date;
  variants: KnowledgeSourceVariant[];
  options: KnowledgeSourceOption[];
  metafields: KnowledgeSourceMetafield[];
  managerApplications: KnowledgeManagerApplicationSource[];
  managerStrictBlock: boolean;
};

export type KnowledgeTextSource = {
  variantId: string | null;
  locale: KnowledgeLocale;
  sourceField: string;
  sourceOrdinal: number;
  text: string;
};

export type ShopKnowledgeChunkDraft = {
  chunkKey: string;
  productId: string;
  variantId: string | null;
  locale: KnowledgeLocale;
  sourceField: string;
  sourceOrdinal: number;
  ordinal: number;
  content: string;
  tokenCount: number;
  contentHash: string;
};

export type ShopKnowledgeEvidenceDraft = {
  evidenceKey: string;
  productId: string;
  variantId: string | null;
  fieldPath: string;
  source: KnowledgeEvidenceSource;
  sourceField: string;
  locale: KnowledgeLocale;
  excerpt: string;
  sourceHash: string;
  confidence: KnowledgeConfidence;
  verifiedAt: Date | null;
  verifiedBy: string | null;
  sourceRef?: string | null;
  extractorVersion?: string | null;
  isManagerVerified?: boolean;
  contentHash: string;
};

export type KnowledgeAttributeValue = string | number | boolean | string[];

export type ShopProductAttributeDraft = {
  key: string;
  value: KnowledgeAttributeValue;
  valueType: "string" | "number" | "boolean" | "string_list";
  isHard: boolean;
  source: KnowledgeEvidenceSource;
  confidence: KnowledgeConfidence;
  evidenceKey: string;
  contentHash: string;
};

export type ShopVehicleApplicationDraft = {
  applicationKey: string;
  productId: string;
  variantId: string | null;
  scope: string;
  vehicleType: "car" | "motorcycle" | "universal";
  make: string | null;
  model: string | null;
  generation: string | null;
  chassisCode: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  engine: string | null;
  fuel: string | null;
  bodyStyle: string | null;
  drivetrain: string | null;
  transmission: string | null;
  market: string | null;
  opfGpf: KnowledgeOpfGpf;
  categoryGroup: ShopStockCategoryGroupId;
  productKind: string | null;
  material: string | null;
  isUniversal: boolean;
  fitmentStatus: "verified" | "inferred" | "needs_review";
  source: KnowledgeEvidenceSource;
  sourcePriority: number;
  confidence: KnowledgeConfidence;
  evidenceKey: string;
  contentHash: string;
};

export type ShopVariantKnowledgeDraft = {
  variantId: string;
  productId: string;
  sku: string | null;
  title: string | null;
  position: number;
  optionValues: Record<string, string>;
  attributes: ShopProductAttributeDraft[];
  searchText: string;
  contentHash: string;
};

export type ShopKnowledgeBuild = {
  productId: string;
  schemaVersion: typeof SHOP_KNOWLEDGE_V2_SCHEMA_VERSION;
  extractorVersion: typeof SHOP_KNOWLEDGE_V2_EXTRACTOR_VERSION;
  sourceUpdatedAt: Date;
  categoryGroup: ShopStockCategoryGroupId;
  status: Extract<KnowledgeStatus, "READY" | "NEEDS_REVIEW" | "BLOCKED">;
  completenessScore: number;
  qualityFlags: string[];
  searchText: string;
  applications: ShopVehicleApplicationDraft[];
  variants: ShopVariantKnowledgeDraft[];
  chunks: ShopKnowledgeChunkDraft[];
  attributes: ShopProductAttributeDraft[];
  evidence: ShopKnowledgeEvidenceDraft[];
  contentHash: string;
};

export type KnowledgeCurrentRecord = {
  knowledgeId: string;
  productId: string;
  revision: number;
  activeRevision: number | null;
  contentHash: string;
  status: KnowledgeStatus;
};

export type KnowledgeOutboxJob = {
  id: string;
  productId: string;
  dedupeKey: string;
  status: KnowledgeOutboxStatus;
  attempts: number;
  maxAttempts?: number;
  lockedBy?: string | null;
};

export type KnowledgeIndexCommit = {
  build: ShopKnowledgeBuild;
  revision: number;
  previous: KnowledgeCurrentRecord | null;
  indexedAt: Date;
};

export type KnowledgeIndexOutcome = {
  productId: string;
  mode: "dry-run" | "commit";
  result: "created" | "updated" | "unchanged" | "blocked";
  revision: number;
  contentHash: string;
  status: ShopKnowledgeBuild["status"];
  chunks: number;
  applications: number;
  variants: number;
  qualityFlags: string[];
};
