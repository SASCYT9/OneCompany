CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE "ShopKnowledgeStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'READY',
    'NEEDS_REVIEW',
    'FAILED',
    'BLOCKED'
);

CREATE TYPE "ShopKnowledgeVerificationStatus" AS ENUM (
    'EXTRACTED',
    'VERIFIED',
    'NEEDS_REVIEW',
    'BLOCKED'
);

CREATE TYPE "ShopKnowledgeSource" AS ENUM (
    'MANAGER',
    'MANUAL_OVERRIDE',
    'SUPPLIER',
    'CATEGORY_ADAPTER',
    'DESCRIPTION_EXTRACTION'
);

CREATE TYPE "ShopKnowledgeOutboxStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'RETRY',
    'COMPLETED',
    'DEAD_LETTER'
);

CREATE TYPE "ShopKnowledgeReviewStatus" AS ENUM (
    'OPEN',
    'IN_REVIEW',
    'RESOLVED',
    'DISMISSED'
);

CREATE TYPE "ShopKnowledgeReviewPriority" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

CREATE TYPE "ShopProductAttributeValueType" AS ENUM (
    'TEXT',
    'NUMBER',
    'BOOLEAN',
    'JSON'
);

CREATE TYPE "ShopAiRunStatus" AS ENUM (
    'PROCESSING',
    'COMPLETED',
    'FAILED'
);

CREATE TYPE "ShopAiResponseMode" AS ENUM (
    'RESULTS',
    'CLARIFICATION',
    'NO_MATCH'
);

CREATE TYPE "ShopAiMatchStatus" AS ENUM (
    'EXACT',
    'REQUIRES_VERIFICATION',
    'REJECTED'
);

CREATE TYPE "ShopAiFeedbackSignal" AS ENUM (
    'THUMBS_UP',
    'THUMBS_DOWN',
    'CLICK',
    'ADD_TO_CART',
    'ORDER_COMPLETED',
    'NO_RESULT',
    'MANAGER_CONFIRMED',
    'MANAGER_REJECTED'
);

CREATE TYPE "ShopAiFeedbackReason" AS ENUM (
    'WRONG_FITMENT',
    'WRONG_CATEGORY',
    'IRRELEVANT',
    'MISSING_PRODUCT',
    'OTHER'
);

CREATE TYPE "ShopAiFeedbackStatus" AS ENUM (
    'NEW',
    'REVIEWED',
    'RESOLVED',
    'DISMISSED'
);

CREATE TYPE "ShopAiEvaluationStatus" AS ENUM (
    'PENDING',
    'RUNNING',
    'COMPLETED',
    'FAILED'
);

ALTER TABLE "ShopProductKnowledge"
    ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "activeRevision" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "status" "ShopKnowledgeStatus" NOT NULL DEFAULT 'PENDING',
    ADD COLUMN "completenessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN "qualityFlags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "sourceUpdatedAt" TIMESTAMP(3),
    ADD COLUMN "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "readyAt" TIMESTAMP(3),
    ADD COLUMN "failedAt" TIMESTAMP(3),
    ADD COLUMN "failureReason" TEXT;

UPDATE "ShopProductKnowledge" AS knowledge
SET
    "activeRevision" = 0,
    "status" = 'PENDING',
    "completenessScore" = 0,
    "qualityFlags" = ARRAY['v2_backfill_required']::TEXT[],
    "sourceUpdatedAt" = product."updatedAt",
    "statusChangedAt" = CURRENT_TIMESTAMP,
    "readyAt" = NULL
FROM "ShopProduct" AS product
WHERE product."id" = knowledge."productId";

UPDATE "ShopProductKnowledge"
SET
    "makes" = COALESCE("makes", ARRAY[]::TEXT[]),
    "models" = COALESCE("models", ARRAY[]::TEXT[]),
    "chassisCodes" = COALESCE("chassisCodes", ARRAY[]::TEXT[]),
    "engines" = COALESCE("engines", ARRAY[]::TEXT[]),
    "bodyStyles" = COALESCE("bodyStyles", ARRAY[]::TEXT[]),
    "markets" = COALESCE("markets", ARRAY[]::TEXT[]);

ALTER TABLE "ShopProductKnowledge"
    ALTER COLUMN "makes" SET NOT NULL,
    ALTER COLUMN "models" SET NOT NULL,
    ALTER COLUMN "chassisCodes" SET NOT NULL,
    ALTER COLUMN "engines" SET NOT NULL,
    ALTER COLUMN "bodyStyles" SET NOT NULL,
    ALTER COLUMN "markets" SET NOT NULL;

UPDATE "ShopAiConversation"
SET "shownProductIds" = COALESCE("shownProductIds", ARRAY[]::TEXT[]);

ALTER TABLE "ShopAiConversation"
    ALTER COLUMN "shownProductIds" SET NOT NULL;

CREATE TABLE "VehicleGeneration" (
    "id" TEXT NOT NULL,
    "generationKey" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'auto',
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "generationName" TEXT,
    "chassisCode" TEXT,
    "yearFrom" INTEGER,
    "yearTo" INTEGER,
    "bodyStyles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "markets" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleGeneration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VehicleAlias" (
    "id" TEXT NOT NULL,
    "vehicleGenerationId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "aliasType" TEXT NOT NULL,
    "locale" TEXT,
    "source" "ShopKnowledgeSource" NOT NULL DEFAULT 'CATEGORY_ADAPTER',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleAlias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopVariantKnowledge" (
    "id" TEXT NOT NULL,
    "knowledgeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "sku" TEXT,
    "optionValues" JSONB NOT NULL DEFAULT '{}',
    "facts" JSONB NOT NULL DEFAULT '{}',
    "searchText" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 2,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" "ShopKnowledgeStatus" NOT NULL DEFAULT 'PENDING',
    "completenessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qualityFlags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sourceUpdatedAt" TIMESTAMP(3),
    "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopVariantKnowledge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopVehicleApplication" (
    "id" TEXT NOT NULL,
    "applicationKey" TEXT NOT NULL,
    "knowledgeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "variantKnowledgeId" TEXT,
    "vehicleGenerationId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'auto',
    "make" TEXT,
    "model" TEXT,
    "generation" TEXT,
    "chassisCode" TEXT,
    "yearFrom" INTEGER,
    "yearTo" INTEGER,
    "engine" TEXT,
    "fuel" TEXT,
    "bodyStyle" TEXT,
    "drivetrain" TEXT,
    "transmission" TEXT,
    "market" TEXT,
    "opfGpf" TEXT,
    "categoryGroup" TEXT,
    "productKind" TEXT,
    "material" TEXT,
    "isUniversal" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "ShopKnowledgeVerificationStatus" NOT NULL DEFAULT 'EXTRACTED',
    "source" "ShopKnowledgeSource" NOT NULL DEFAULT 'CATEGORY_ADAPTER',
    "sourcePriority" INTEGER NOT NULL DEFAULT 5,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopVehicleApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopKnowledgeChunk" (
    "id" TEXT NOT NULL,
    "chunkKey" TEXT NOT NULL,
    "knowledgeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantKnowledgeId" TEXT,
    "locale" TEXT NOT NULL,
    "sourceField" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "embeddingModel" TEXT,
    "embedding" vector(768),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "embeddedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopKnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopProductAttributeDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameUa" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "categoryGroups" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "valueType" "ShopProductAttributeValueType" NOT NULL,
    "unit" TEXT,
    "allowedValues" JSONB NOT NULL DEFAULT '[]',
    "aliases" JSONB NOT NULL DEFAULT '{}',
    "isHardConstraint" BOOLEAN NOT NULL DEFAULT false,
    "isFilterable" BOOLEAN NOT NULL DEFAULT false,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopProductAttributeDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopProductAttributeValue" (
    "id" TEXT NOT NULL,
    "valueKey" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "knowledgeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "variantKnowledgeId" TEXT,
    "valueText" TEXT,
    "valueNumber" DECIMAL(18,6),
    "valueBoolean" BOOLEAN,
    "valueJson" JSONB,
    "normalizedValue" TEXT,
    "unit" TEXT,
    "source" "ShopKnowledgeSource" NOT NULL DEFAULT 'CATEGORY_ADAPTER',
    "verificationStatus" "ShopKnowledgeVerificationStatus" NOT NULL DEFAULT 'EXTRACTED',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopProductAttributeValue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopKnowledgeEvidence" (
    "id" TEXT NOT NULL,
    "evidenceKey" TEXT NOT NULL,
    "knowledgeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantKnowledgeId" TEXT,
    "vehicleApplicationId" TEXT,
    "attributeValueId" TEXT,
    "fieldPath" TEXT NOT NULL,
    "source" "ShopKnowledgeSource" NOT NULL,
    "sourceRef" TEXT,
    "excerpt" TEXT,
    "sourceHash" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "extractorVersion" TEXT,
    "isManagerVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopKnowledgeEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopKnowledgeRevision" (
    "id" TEXT NOT NULL,
    "knowledgeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 2,
    "status" "ShopKnowledgeStatus" NOT NULL,
    "changeType" TEXT NOT NULL,
    "source" "ShopKnowledgeSource" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "diff" JSONB,
    "reason" TEXT,
    "changedById" TEXT,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopKnowledgeRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopKnowledgeOutbox" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "knowledgeId" TEXT,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "ShopKnowledgeOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 8,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopKnowledgeOutbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopAiEvaluationRun" (
    "id" TEXT NOT NULL,
    "suiteName" TEXT NOT NULL,
    "suiteVersion" TEXT NOT NULL,
    "categoryGroup" TEXT,
    "datasetHash" TEXT NOT NULL,
    "status" "ShopAiEvaluationStatus" NOT NULL DEFAULT 'PENDING',
    "config" JSONB NOT NULL DEFAULT '{}',
    "results" JSONB NOT NULL DEFAULT '{}',
    "totalCases" INTEGER NOT NULL DEFAULT 0,
    "passedCases" INTEGER NOT NULL DEFAULT 0,
    "failedCases" INTEGER NOT NULL DEFAULT 0,
    "recallAt20" DOUBLE PRECISION,
    "noMatchAccuracy" DOUBLE PRECISION,
    "wrongExactCount" INTEGER NOT NULL DEFAULT 0,
    "hallucinationCount" INTEGER NOT NULL DEFAULT 0,
    "p95RetrievalMs" INTEGER,
    "p95TurnMs" INTEGER,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopAiEvaluationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopAiRun" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "conversationId" TEXT,
    "evaluationRunId" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'ua',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "scope" TEXT,
    "redactedQuery" TEXT NOT NULL,
    "normalizedQuery" TEXT,
    "status" "ShopAiRunStatus" NOT NULL DEFAULT 'PROCESSING',
    "mode" "ShopAiResponseMode",
    "constraints" JSONB NOT NULL DEFAULT '{}',
    "response" JSONB,
    "exactCount" INTEGER NOT NULL DEFAULT 0,
    "verificationCount" INTEGER NOT NULL DEFAULT 0,
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "acceptedCount" INTEGER NOT NULL DEFAULT 0,
    "generationCalls" INTEGER NOT NULL DEFAULT 0,
    "embeddingCalls" INTEGER NOT NULL DEFAULT 0,
    "retrievalLatencyMs" INTEGER,
    "totalLatencyMs" INTEGER,
    "activeCpuMs" INTEGER,
    "degraded" BOOLEAN NOT NULL DEFAULT false,
    "traceSampled" BOOLEAN NOT NULL DEFAULT false,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopAiRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopAiCandidateDecision" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "vehicleApplicationId" TEXT,
    "productSnapshot" JSONB NOT NULL DEFAULT '{}',
    "matchStatus" "ShopAiMatchStatus" NOT NULL,
    "rank" INTEGER,
    "lexicalScore" DOUBLE PRECISION,
    "semanticScore" DOUBLE PRECISION,
    "softScore" DOUBLE PRECISION,
    "totalScore" DOUBLE PRECISION,
    "reasonCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "missingFacts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "shown" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopAiCandidateDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopAiFeedback" (
    "id" TEXT NOT NULL,
    "runId" TEXT,
    "conversationId" TEXT,
    "candidateDecisionId" TEXT,
    "productId" TEXT,
    "variantId" TEXT,
    "signal" "ShopAiFeedbackSignal" NOT NULL,
    "reason" "ShopAiFeedbackReason",
    "comment" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "status" "ShopAiFeedbackStatus" NOT NULL DEFAULT 'NEW',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopAiFeedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopKnowledgeReviewTask" (
    "id" TEXT NOT NULL,
    "knowledgeId" TEXT,
    "productId" TEXT,
    "variantId" TEXT,
    "vehicleApplicationId" TEXT,
    "attributeValueId" TEXT,
    "aiRunId" TEXT,
    "feedbackId" TEXT,
    "taskType" TEXT NOT NULL,
    "status" "ShopKnowledgeReviewStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "ShopKnowledgeReviewPriority" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "reasonCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "assignedToId" TEXT,
    "resolvedById" TEXT,
    "resolution" JSONB,
    "dueAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopKnowledgeReviewTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VehicleGeneration_generationKey_key"
    ON "VehicleGeneration"("generationKey");
CREATE INDEX "VehicleGeneration_scope_make_model_idx"
    ON "VehicleGeneration"("scope", "make", "model");
CREATE INDEX "VehicleGeneration_chassisCode_idx"
    ON "VehicleGeneration"("chassisCode");
CREATE INDEX "VehicleGeneration_yearFrom_yearTo_idx"
    ON "VehicleGeneration"("yearFrom", "yearTo");

CREATE UNIQUE INDEX "VehicleAlias_generation_alias_key"
    ON "VehicleAlias"("vehicleGenerationId", "normalizedAlias");
CREATE INDEX "VehicleAlias_normalizedAlias_active_idx"
    ON "VehicleAlias"("normalizedAlias", "isActive");
CREATE INDEX "VehicleAlias_aliasType_active_idx"
    ON "VehicleAlias"("aliasType", "isActive");

CREATE UNIQUE INDEX "ShopVariantKnowledge_knowledge_variant_revision_key"
    ON "ShopVariantKnowledge"("knowledgeId", "variantId", "revision");
CREATE INDEX "ShopVariantKnowledge_knowledge_status_idx"
    ON "ShopVariantKnowledge"("knowledgeId", "status");
CREATE INDEX "ShopVariantKnowledge_product_active_idx"
    ON "ShopVariantKnowledge"("productId", "isActive");
CREATE INDEX "ShopVariantKnowledge_sku_idx"
    ON "ShopVariantKnowledge"("sku");
CREATE INDEX "ShopVariantKnowledge_contentHash_idx"
    ON "ShopVariantKnowledge"("contentHash");

CREATE UNIQUE INDEX "ShopVehicleApplication_applicationKey_revision_key"
    ON "ShopVehicleApplication"("applicationKey", "revision");
CREATE INDEX "ShopVehicleApplication_knowledge_active_idx"
    ON "ShopVehicleApplication"("knowledgeId", "isActive");
CREATE INDEX "ShopVehicleApplication_product_active_idx"
    ON "ShopVehicleApplication"("productId", "isActive");
CREATE INDEX "ShopVehicleApplication_variant_active_idx"
    ON "ShopVehicleApplication"("variantId", "isActive");
CREATE INDEX "ShopVehicleApplication_generation_idx"
    ON "ShopVehicleApplication"("vehicleGenerationId");
CREATE INDEX "ShopVehicleApplication_scope_vehicle_idx"
    ON "ShopVehicleApplication"("scope", "make", "model", "chassisCode");
CREATE INDEX "ShopVehicleApplication_years_idx"
    ON "ShopVehicleApplication"("make", "model", "yearFrom", "yearTo");
CREATE INDEX "ShopVehicleApplication_category_kind_idx"
    ON "ShopVehicleApplication"("categoryGroup", "productKind");
CREATE INDEX "ShopVehicleApplication_verification_active_idx"
    ON "ShopVehicleApplication"("verificationStatus", "isActive");
CREATE INDEX "ShopVehicleApplication_opf_active_idx"
    ON "ShopVehicleApplication"("opfGpf", "isActive");

CREATE UNIQUE INDEX "ShopKnowledgeChunk_chunkKey_revision_key"
    ON "ShopKnowledgeChunk"("chunkKey", "revision");
CREATE INDEX "ShopKnowledgeChunk_knowledge_revision_active_idx"
    ON "ShopKnowledgeChunk"("knowledgeId", "revision", "isActive");
CREATE INDEX "ShopKnowledgeChunk_product_locale_active_idx"
    ON "ShopKnowledgeChunk"("productId", "locale", "isActive");
CREATE INDEX "ShopKnowledgeChunk_variant_active_idx"
    ON "ShopKnowledgeChunk"("variantKnowledgeId", "isActive");
CREATE INDEX "ShopKnowledgeChunk_locale_source_idx"
    ON "ShopKnowledgeChunk"("locale", "sourceField");
CREATE INDEX "ShopKnowledgeChunk_contentHash_idx"
    ON "ShopKnowledgeChunk"("contentHash");
CREATE INDEX "ShopKnowledgeChunk_embedding_model_idx"
    ON "ShopKnowledgeChunk"("embeddingModel", "embeddedAt");
CREATE INDEX "ShopKnowledgeChunk_content_trgm_idx"
    ON "ShopKnowledgeChunk" USING GIN ("content" gin_trgm_ops);
CREATE INDEX "ShopKnowledgeChunk_content_fts_idx"
    ON "ShopKnowledgeChunk" USING GIN (to_tsvector('simple', "content"));
CREATE INDEX "ShopKnowledgeChunk_embedding_hnsw_idx"
    ON "ShopKnowledgeChunk" USING hnsw ("embedding" vector_cosine_ops)
    WHERE "isActive" = true AND "embedding" IS NOT NULL;

CREATE UNIQUE INDEX "ShopProductAttributeDefinition_key_key"
    ON "ShopProductAttributeDefinition"("key");
CREATE INDEX "ShopProductAttributeDefinition_active_filter_idx"
    ON "ShopProductAttributeDefinition"("isActive", "isFilterable");
CREATE INDEX "ShopProductAttributeDefinition_hard_required_idx"
    ON "ShopProductAttributeDefinition"("isHardConstraint", "isRequired");

CREATE UNIQUE INDEX "ShopProductAttributeValue_valueKey_revision_key"
    ON "ShopProductAttributeValue"("valueKey", "revision");
CREATE INDEX "ShopProductAttributeValue_definition_value_idx"
    ON "ShopProductAttributeValue"("definitionId", "normalizedValue", "isActive");
CREATE INDEX "ShopProductAttributeValue_knowledge_revision_idx"
    ON "ShopProductAttributeValue"("knowledgeId", "revision", "isActive");
CREATE INDEX "ShopProductAttributeValue_product_active_idx"
    ON "ShopProductAttributeValue"("productId", "isActive");
CREATE INDEX "ShopProductAttributeValue_variant_active_idx"
    ON "ShopProductAttributeValue"("variantId", "isActive");
CREATE INDEX "ShopProductAttributeValue_verification_idx"
    ON "ShopProductAttributeValue"("verificationStatus", "isActive");

CREATE UNIQUE INDEX "ShopKnowledgeEvidence_evidenceKey_revision_key"
    ON "ShopKnowledgeEvidence"("evidenceKey", "revision");
CREATE INDEX "ShopKnowledgeEvidence_knowledge_field_idx"
    ON "ShopKnowledgeEvidence"("knowledgeId", "fieldPath", "isActive");
CREATE INDEX "ShopKnowledgeEvidence_product_revision_idx"
    ON "ShopKnowledgeEvidence"("productId", "revision");
CREATE INDEX "ShopKnowledgeEvidence_application_idx"
    ON "ShopKnowledgeEvidence"("vehicleApplicationId");
CREATE INDEX "ShopKnowledgeEvidence_attribute_idx"
    ON "ShopKnowledgeEvidence"("attributeValueId");
CREATE INDEX "ShopKnowledgeEvidence_source_verified_idx"
    ON "ShopKnowledgeEvidence"("source", "isManagerVerified");

CREATE UNIQUE INDEX "ShopKnowledgeRevision_knowledge_revision_key"
    ON "ShopKnowledgeRevision"("knowledgeId", "revision");
CREATE INDEX "ShopKnowledgeRevision_product_created_idx"
    ON "ShopKnowledgeRevision"("productId", "createdAt");
CREATE INDEX "ShopKnowledgeRevision_status_created_idx"
    ON "ShopKnowledgeRevision"("status", "createdAt");

CREATE UNIQUE INDEX "ShopKnowledgeOutbox_dedupeKey_key"
    ON "ShopKnowledgeOutbox"("dedupeKey");
CREATE INDEX "ShopKnowledgeOutbox_status_available_idx"
    ON "ShopKnowledgeOutbox"("status", "availableAt");
CREATE INDEX "ShopKnowledgeOutbox_product_status_idx"
    ON "ShopKnowledgeOutbox"("productId", "status");
CREATE INDEX "ShopKnowledgeOutbox_variant_status_idx"
    ON "ShopKnowledgeOutbox"("variantId", "status");
CREATE INDEX "ShopKnowledgeOutbox_lockedAt_idx"
    ON "ShopKnowledgeOutbox"("lockedAt");

CREATE INDEX "ShopAiEvaluationRun_status_created_idx"
    ON "ShopAiEvaluationRun"("status", "createdAt");
CREATE INDEX "ShopAiEvaluationRun_category_created_idx"
    ON "ShopAiEvaluationRun"("categoryGroup", "createdAt");
CREATE INDEX "ShopAiEvaluationRun_suite_idx"
    ON "ShopAiEvaluationRun"("suiteName", "suiteVersion");

CREATE UNIQUE INDEX "ShopAiRun_requestId_key"
    ON "ShopAiRun"("requestId");
CREATE INDEX "ShopAiRun_conversation_created_idx"
    ON "ShopAiRun"("conversationId", "createdAt");
CREATE INDEX "ShopAiRun_status_created_idx"
    ON "ShopAiRun"("status", "createdAt");
CREATE INDEX "ShopAiRun_mode_created_idx"
    ON "ShopAiRun"("mode", "createdAt");
CREATE INDEX "ShopAiRun_evaluation_idx"
    ON "ShopAiRun"("evaluationRunId");
CREATE INDEX "ShopAiRun_trace_created_idx"
    ON "ShopAiRun"("traceSampled", "createdAt");

CREATE INDEX "ShopAiCandidateDecision_run_status_idx"
    ON "ShopAiCandidateDecision"("runId", "matchStatus");
CREATE INDEX "ShopAiCandidateDecision_run_rank_idx"
    ON "ShopAiCandidateDecision"("runId", "rank");
CREATE INDEX "ShopAiCandidateDecision_product_created_idx"
    ON "ShopAiCandidateDecision"("productId", "createdAt");
CREATE INDEX "ShopAiCandidateDecision_application_idx"
    ON "ShopAiCandidateDecision"("vehicleApplicationId");

CREATE INDEX "ShopAiFeedback_status_created_idx"
    ON "ShopAiFeedback"("status", "createdAt");
CREATE INDEX "ShopAiFeedback_signal_created_idx"
    ON "ShopAiFeedback"("signal", "createdAt");
CREATE INDEX "ShopAiFeedback_run_idx"
    ON "ShopAiFeedback"("runId");
CREATE INDEX "ShopAiFeedback_conversation_idx"
    ON "ShopAiFeedback"("conversationId");
CREATE INDEX "ShopAiFeedback_product_created_idx"
    ON "ShopAiFeedback"("productId", "createdAt");

CREATE UNIQUE INDEX "ShopKnowledgeReviewTask_feedbackId_key"
    ON "ShopKnowledgeReviewTask"("feedbackId");
CREATE INDEX "ShopKnowledgeReviewTask_status_priority_idx"
    ON "ShopKnowledgeReviewTask"("status", "priority", "createdAt");
CREATE INDEX "ShopKnowledgeReviewTask_knowledge_status_idx"
    ON "ShopKnowledgeReviewTask"("knowledgeId", "status");
CREATE INDEX "ShopKnowledgeReviewTask_product_status_idx"
    ON "ShopKnowledgeReviewTask"("productId", "status");
CREATE INDEX "ShopKnowledgeReviewTask_assignee_status_idx"
    ON "ShopKnowledgeReviewTask"("assignedToId", "status");
CREATE INDEX "ShopKnowledgeReviewTask_aiRun_idx"
    ON "ShopKnowledgeReviewTask"("aiRunId");

CREATE INDEX "ShopProductKnowledge_status_sourceUpdated_idx"
    ON "ShopProductKnowledge"("status", "sourceUpdatedAt");
CREATE INDEX "ShopProductKnowledge_status_updated_idx"
    ON "ShopProductKnowledge"("status", "updatedAt");
CREATE INDEX "ShopProductKnowledge_searchText_trgm_idx"
    ON "ShopProductKnowledge" USING GIN ("searchText" gin_trgm_ops);
CREATE INDEX "ShopProductKnowledge_searchText_fts_idx"
    ON "ShopProductKnowledge" USING GIN (to_tsvector('simple', "searchText"));
CREATE INDEX "ShopProductKnowledge_embedding_hnsw_idx"
    ON "ShopProductKnowledge" USING hnsw ("embedding" vector_cosine_ops)
    WHERE "embedding" IS NOT NULL;

ALTER TABLE "VehicleAlias"
    ADD CONSTRAINT "VehicleAlias_vehicleGenerationId_fkey"
    FOREIGN KEY ("vehicleGenerationId") REFERENCES "VehicleGeneration"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShopVariantKnowledge"
    ADD CONSTRAINT "ShopVariantKnowledge_knowledgeId_fkey"
    FOREIGN KEY ("knowledgeId") REFERENCES "ShopProductKnowledge"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopVariantKnowledge_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopVariantKnowledge_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "ShopProductVariant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShopVehicleApplication"
    ADD CONSTRAINT "ShopVehicleApplication_knowledgeId_fkey"
    FOREIGN KEY ("knowledgeId") REFERENCES "ShopProductKnowledge"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopVehicleApplication_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopVehicleApplication_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "ShopProductVariant"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopVehicleApplication_variantKnowledgeId_fkey"
    FOREIGN KEY ("variantKnowledgeId") REFERENCES "ShopVariantKnowledge"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopVehicleApplication_generationId_fkey"
    FOREIGN KEY ("vehicleGenerationId") REFERENCES "VehicleGeneration"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShopKnowledgeChunk"
    ADD CONSTRAINT "ShopKnowledgeChunk_knowledgeId_fkey"
    FOREIGN KEY ("knowledgeId") REFERENCES "ShopProductKnowledge"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopKnowledgeChunk_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopKnowledgeChunk_variantKnowledgeId_fkey"
    FOREIGN KEY ("variantKnowledgeId") REFERENCES "ShopVariantKnowledge"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShopProductAttributeValue"
    ADD CONSTRAINT "ShopProductAttributeValue_definitionId_fkey"
    FOREIGN KEY ("definitionId") REFERENCES "ShopProductAttributeDefinition"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopProductAttributeValue_knowledgeId_fkey"
    FOREIGN KEY ("knowledgeId") REFERENCES "ShopProductKnowledge"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopProductAttributeValue_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopProductAttributeValue_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "ShopProductVariant"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopProductAttributeValue_variantKnowledgeId_fkey"
    FOREIGN KEY ("variantKnowledgeId") REFERENCES "ShopVariantKnowledge"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShopKnowledgeEvidence"
    ADD CONSTRAINT "ShopKnowledgeEvidence_knowledgeId_fkey"
    FOREIGN KEY ("knowledgeId") REFERENCES "ShopProductKnowledge"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopKnowledgeEvidence_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopKnowledgeEvidence_variantKnowledgeId_fkey"
    FOREIGN KEY ("variantKnowledgeId") REFERENCES "ShopVariantKnowledge"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopKnowledgeEvidence_vehicleApplicationId_fkey"
    FOREIGN KEY ("vehicleApplicationId") REFERENCES "ShopVehicleApplication"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopKnowledgeEvidence_attributeValueId_fkey"
    FOREIGN KEY ("attributeValueId") REFERENCES "ShopProductAttributeValue"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShopKnowledgeRevision"
    ADD CONSTRAINT "ShopKnowledgeRevision_knowledgeId_fkey"
    FOREIGN KEY ("knowledgeId") REFERENCES "ShopProductKnowledge"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopKnowledgeRevision_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShopKnowledgeOutbox"
    ADD CONSTRAINT "ShopKnowledgeOutbox_knowledgeId_fkey"
    FOREIGN KEY ("knowledgeId") REFERENCES "ShopProductKnowledge"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopKnowledgeOutbox_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopKnowledgeOutbox_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "ShopProductVariant"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShopAiRun"
    ADD CONSTRAINT "ShopAiRun_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "ShopAiConversation"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopAiRun_evaluationRunId_fkey"
    FOREIGN KEY ("evaluationRunId") REFERENCES "ShopAiEvaluationRun"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShopAiCandidateDecision"
    ADD CONSTRAINT "ShopAiCandidateDecision_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "ShopAiRun"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShopAiFeedback"
    ADD CONSTRAINT "ShopAiFeedback_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "ShopAiRun"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopAiFeedback_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "ShopAiConversation"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopAiFeedback_candidateDecisionId_fkey"
    FOREIGN KEY ("candidateDecisionId") REFERENCES "ShopAiCandidateDecision"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShopKnowledgeReviewTask"
    ADD CONSTRAINT "ShopKnowledgeReviewTask_knowledgeId_fkey"
    FOREIGN KEY ("knowledgeId") REFERENCES "ShopProductKnowledge"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopKnowledgeReviewTask_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopKnowledgeReviewTask_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "ShopProductVariant"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopKnowledgeReviewTask_vehicleApplicationId_fkey"
    FOREIGN KEY ("vehicleApplicationId") REFERENCES "ShopVehicleApplication"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopKnowledgeReviewTask_attributeValueId_fkey"
    FOREIGN KEY ("attributeValueId") REFERENCES "ShopProductAttributeValue"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopKnowledgeReviewTask_aiRunId_fkey"
    FOREIGN KEY ("aiRunId") REFERENCES "ShopAiRun"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "ShopKnowledgeReviewTask_feedbackId_fkey"
    FOREIGN KEY ("feedbackId") REFERENCES "ShopAiFeedback"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION enqueue_shop_knowledge_source_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    affected_product_id TEXT;
    knowledge_id TEXT;
    dedupe_key TEXT;
    event_id TEXT;
BEGIN
    IF TG_TABLE_NAME = 'ShopProduct' THEN
        affected_product_id := NEW."id";
    ELSIF TG_OP = 'DELETE' THEN
        affected_product_id := OLD."productId";
    ELSE
        affected_product_id := NEW."productId";
    END IF;

    SELECT "id"
    INTO knowledge_id
    FROM "ShopProductKnowledge"
    WHERE "productId" = affected_product_id;

    dedupe_key := affected_product_id || ':SOURCE_CHANGED';
    event_id := md5(dedupe_key);

    INSERT INTO "ShopKnowledgeOutbox" (
        "id",
        "dedupeKey",
        "knowledgeId",
        "productId",
        "eventType",
        "payload",
        "status",
        "attempts",
        "maxAttempts",
        "availableAt",
        "createdAt",
        "updatedAt"
    )
    VALUES (
        event_id,
        dedupe_key,
        knowledge_id,
        affected_product_id,
        'SOURCE_CHANGED',
        jsonb_build_object(
            'table', TG_TABLE_NAME,
            'operation', TG_OP,
            'transactionId', txid_current()::TEXT
        ),
        'PENDING',
        0,
        8,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT ("dedupeKey") DO UPDATE
    SET
        "knowledgeId" = EXCLUDED."knowledgeId",
        "eventType" = EXCLUDED."eventType",
        "payload" = EXCLUDED."payload",
        "status" = 'PENDING',
        "attempts" = 0,
        "maxAttempts" = 8,
        "availableAt" = CURRENT_TIMESTAMP,
        "lockedAt" = NULL,
        "lockedBy" = NULL,
        "processedAt" = NULL,
        "lastError" = NULL,
        "updatedAt" = CURRENT_TIMESTAMP;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "ShopProduct_knowledge_outbox_trigger"
AFTER INSERT OR UPDATE OF
    "scope",
    "brand",
    "titleUa",
    "titleEn",
    "categoryUa",
    "categoryEn",
    "shortDescUa",
    "shortDescEn",
    "longDescUa",
    "longDescEn",
    "leadTimeUa",
    "leadTimeEn",
    "collectionUa",
    "collectionEn",
    "highlights",
    "vendor",
    "productType",
    "productCategory",
    "tags",
    "status",
    "isPublished",
    "bodyHtmlUa",
    "bodyHtmlEn"
ON "ShopProduct"
FOR EACH ROW EXECUTE FUNCTION enqueue_shop_knowledge_source_change();

CREATE TRIGGER "ShopProductVariant_knowledge_outbox_trigger"
AFTER INSERT OR UPDATE OF
    "title",
    "sku",
    "position",
    "option1Value",
    "option1LinkedTo",
    "option2Value",
    "option2LinkedTo",
    "option3Value",
    "option3LinkedTo"
OR DELETE ON "ShopProductVariant"
FOR EACH ROW EXECUTE FUNCTION enqueue_shop_knowledge_source_change();

CREATE TRIGGER "ShopProductOption_knowledge_outbox_trigger"
AFTER INSERT OR UPDATE OF "name", "position", "values" OR DELETE ON "ShopProductOption"
FOR EACH ROW EXECUTE FUNCTION enqueue_shop_knowledge_source_change();

CREATE TRIGGER "ShopProductMetafield_knowledge_outbox_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "ShopProductMetafield"
FOR EACH ROW EXECUTE FUNCTION enqueue_shop_knowledge_source_change();

INSERT INTO "ShopKnowledgeOutbox" (
    "id",
    "dedupeKey",
    "knowledgeId",
    "productId",
    "eventType",
    "payload",
    "status",
    "availableAt",
    "createdAt",
    "updatedAt"
)
SELECT
    md5(product."id" || ':SOURCE_CHANGED'),
    product."id" || ':SOURCE_CHANGED',
    knowledge."id",
    product."id",
    'V2_BACKFILL_REQUIRED',
    jsonb_build_object('schemaVersion', 2, 'reason', 'migration'),
    'PENDING',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "ShopProduct" AS product
LEFT JOIN "ShopProductKnowledge" AS knowledge
    ON knowledge."productId" = product."id"
WHERE product."isPublished" = true
  AND product."status"::text = 'ACTIVE'
ON CONFLICT ("dedupeKey") DO NOTHING;
