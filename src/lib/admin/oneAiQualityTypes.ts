export type OneAiQualityOverview = {
  activePublishedProducts: number;
  knowledgeRecords: number;
  readyKnowledge: number;
  needsReviewKnowledge: number;
  failedKnowledge: number;
  blockedKnowledge: number;
  coveragePercent: number;
  staleKnowledge: number;
  openReviewTasks: number;
  newFeedback: number;
  runsLast24Hours: number;
  failedRunsLast24Hours: number;
  pendingJobs: number;
  retryJobs: number;
  deadLetterJobs: number;
  lastEvaluation: {
    suiteName: string;
    suiteVersion: string;
    status: string;
    passedCases: number;
    totalCases: number;
    recallAt20: number | null;
    noMatchAccuracy: number | null;
    completedAt: string | null;
  } | null;
};

export type OneAiReviewTask = {
  id: string;
  taskType: string;
  status: string;
  priority: string;
  title: string;
  reasonCodes: string[];
  productId: string | null;
  productTitle: string;
  productSku: string | null;
  assignedToId: string | null;
  createdAt: string;
  dueAt: string | null;
};

export type OneAiFeedbackItem = {
  id: string;
  signal: string;
  reason: string | null;
  status: string;
  comment: string | null;
  productId: string | null;
  runId: string | null;
  redactedQuery: string | null;
  createdAt: string;
};

export type OneAiQueryTrace = {
  id: string;
  requestId: string | null;
  locale: string;
  scope: string | null;
  redactedQuery: string;
  status: string;
  mode: string | null;
  constraints: unknown;
  exactCount: number;
  verificationCount: number;
  candidateCount: number;
  acceptedCount: number;
  degraded: boolean;
  retrievalLatencyMs: number | null;
  totalLatencyMs: number | null;
  activeCpuMs: number | null;
  errorCode: string | null;
  createdAt: string;
};

export type OneAiIndexJob = {
  id: string;
  eventType: string;
  status: string;
  productId: string;
  productTitle: string;
  attempts: number;
  maxAttempts: number;
  availableAt: string;
  lockedAt: string | null;
  processedAt: string | null;
  lastError: string | null;
  updatedAt: string;
};

export type OneAiQualitySnapshot = {
  ready: boolean;
  checkedAt: string;
  missingTables: string[];
  overview: OneAiQualityOverview;
  reviewQueue: OneAiReviewTask[];
  feedback: OneAiFeedbackItem[];
  queryTraces: OneAiQueryTrace[];
  indexJobs: OneAiIndexJob[];
};

export type OneAiQualityProductVariant = {
  id: string;
  title: string | null;
  sku: string | null;
  position: number;
  option1Value: string | null;
  option2Value: string | null;
  option3Value: string | null;
  inventoryQty: number;
  updatedAt: string;
  knowledge: {
    id: string;
    status: string;
    revision: number;
    contentHash: string;
    qualityFlags: string[];
    facts: unknown;
    isActive: boolean;
    indexedAt: string;
  } | null;
};

export type OneAiQualityVehicleApplication = {
  id: string;
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
  verificationStatus: string;
  source: string;
  sourcePriority: number;
  confidence: number;
  revision: number;
  isActive: boolean;
  verifiedById: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OneAiQualityAttributeValue = {
  id: string;
  variantId: string | null;
  valueText: string | null;
  valueNumber: number | null;
  valueBoolean: boolean | null;
  valueJson: unknown;
  normalizedValue: string | null;
  unit: string | null;
  source: string;
  verificationStatus: string;
  confidence: number;
  revision: number;
  definition: {
    id: string;
    key: string;
    nameUa: string;
    nameEn: string;
    valueType: string;
    isHardConstraint: boolean;
    isRequired: boolean;
    isFilterable: boolean;
  };
};

export type OneAiQualityEvidence = {
  id: string;
  fieldPath: string;
  source: string;
  sourceRef: string | null;
  excerpt: string | null;
  sourceHash: string;
  confidence: number;
  extractorVersion: string | null;
  isManagerVerified: boolean;
  verifiedById: string | null;
  verifiedAt: string | null;
  revision: number;
  isActive: boolean;
  vehicleApplicationId: string | null;
  attributeValueId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OneAiQualityRevision = {
  id: string;
  revision: number;
  schemaVersion: number;
  status: string;
  changeType: string;
  source: string;
  snapshot: unknown;
  diff: unknown;
  reason: string | null;
  changedById: string | null;
  activatedAt: string | null;
  createdAt: string;
};

export type OneAiQualityProductReviewTask = {
  id: string;
  taskType: string;
  status: string;
  priority: string;
  title: string;
  details: unknown;
  reasonCodes: string[];
  assignedToId: string | null;
  resolution: unknown;
  dueAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OneAiQualityProductDetail = {
  ready: boolean;
  product: {
    id: string;
    slug: string;
    sku: string | null;
    scope: string;
    brand: string | null;
    titleUa: string;
    titleEn: string;
    categoryUa: string | null;
    categoryEn: string | null;
    shortDescUa: string | null;
    shortDescEn: string | null;
    longDescUa: string | null;
    longDescEn: string | null;
    bodyHtmlUa: string | null;
    bodyHtmlEn: string | null;
    tags: string[];
    isPublished: boolean;
    status: string;
    updatedAt: string;
    variants: OneAiQualityProductVariant[];
    knowledge: {
      id: string;
      schemaVersion: number;
      revision: number;
      activeRevision: number;
      status: string;
      completenessScore: number;
      qualityFlags: string[];
      sourceUpdatedAt: string | null;
      statusChangedAt: string;
      readyAt: string | null;
      failedAt: string | null;
      failureReason: string | null;
      categoryGroup: string | null;
      fitmentStatus: string;
      fitmentSource: string;
      facts: unknown;
      contentHash: string;
      embeddingModel: string | null;
      indexedAt: string;
      updatedAt: string;
      vehicleApplications: OneAiQualityVehicleApplication[];
      attributeValues: OneAiQualityAttributeValue[];
      evidence: OneAiQualityEvidence[];
      revisions: OneAiQualityRevision[];
      reviewTasks: OneAiQualityProductReviewTask[];
      _count: {
        chunks: number;
        variantKnowledge: number;
        vehicleApplications: number;
        attributeValues: number;
        evidence: number;
        reviewTasks: number;
      };
    } | null;
  };
};

export type OneAiQualityMutationResult = {
  productId: string;
  action: string;
  revision: number;
  activeRevision: number;
  status: string;
  qualityFlags: string[];
  applicationId: string | null;
  evidenceId: string;
  outboxId: string;
  reindexQueued: boolean;
  restoredFromRevisionId: string | null;
  restoredFromRevision: number | null;
};
