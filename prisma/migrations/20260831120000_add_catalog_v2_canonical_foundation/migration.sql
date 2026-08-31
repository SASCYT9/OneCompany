-- Catalog V2 canonical foundation.
-- This migration is deliberately DDL-only: no legacy row is copied, rewritten,
-- deleted, or published. Catalog V2 readers remain flag-off until parity gates pass.

CREATE TYPE "ShopCatalogSourceKind" AS ENUM (
  'SUPPLIER',
  'MANUAL_ADMIN',
  'LEGACY_SNAPSHOT',
  'INTEGRATION'
);

CREATE TYPE "ShopCatalogEntityType" AS ENUM (
  'PRODUCT',
  'VARIANT',
  'BRAND',
  'VEHICLE_MAKE',
  'VEHICLE_MODEL',
  'VEHICLE_GENERATION',
  'VEHICLE_POWERTRAIN',
  'VEHICLE_CONFIGURATION'
);

CREATE TYPE "ShopCatalogMappingStatus" AS ENUM (
  'MAPPED',
  'QUARANTINED',
  'IGNORED_WITH_REASON'
);

CREATE TYPE "ShopCatalogBindingAction" AS ENUM ('MAP', 'TOMBSTONE');

CREATE TYPE "ShopCatalogIssueStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

CREATE TYPE "VehicleTaxonomyEntityType" AS ENUM (
  'MAKE',
  'MODEL',
  'GENERATION',
  'POWERTRAIN',
  'CONFIGURATION'
);

CREATE TYPE "ShopCatalogCompatibilityMode" AS ENUM (
  'VEHICLE_SPECIFIC',
  'UNIVERSAL',
  'PARENT_DEPENDENT',
  'NEEDS_REVIEW'
);

CREATE TYPE "ShopCatalogCompatibilityDimension" AS ENUM (
  'SCOPE',
  'MAKE',
  'MODEL',
  'GENERATION',
  'CHASSIS',
  'YEAR',
  'ENGINE',
  'FUEL',
  'BODY_STYLE',
  'DRIVETRAIN',
  'TRANSMISSION',
  'MARKET',
  'OPF_GPF'
);

CREATE TYPE "ShopCatalogConstraintState" AS ENUM (
  'EXACT',
  'ANY',
  'NOT_APPLICABLE',
  'UNKNOWN'
);

CREATE TYPE "ShopCatalogClauseVerification" AS ENUM (
  'VERIFIED',
  'INFERRED',
  'NEEDS_REVIEW'
);

CREATE TYPE "ShopCatalogChangeDomain" AS ENUM (
  'CONTENT',
  'SEO',
  'MEDIA',
  'PRICE',
  'INVENTORY',
  'FITMENT',
  'TAXONOMY',
  'VISIBILITY',
  'SETTINGS'
);

CREATE TYPE "ShopCatalogPublicationEntityType" AS ENUM (
  'PRODUCT',
  'PRICE_BOOK',
  'SETTINGS'
);

CREATE TYPE "ShopCatalogOutboxStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'RETRY',
  'COMPLETED',
  'DEAD_LETTER'
);

CREATE TYPE "ShopCatalogProjectionTarget" AS ENUM (
  'CONTENT',
  'SEARCH',
  'PRICE',
  'INVENTORY',
  'SETTINGS'
);

CREATE TYPE "ShopCatalogPublicationReceiptStatus" AS ENUM (
  'SAVED',
  'PUBLISHING',
  'PUBLISHED',
  'FAILED'
);

ALTER TABLE "ShopProduct"
  ADD COLUMN "brandId" TEXT,
  ADD COLUMN "catalogVersion" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "publishedCatalogVersion" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "VehicleGeneration"
  ADD COLUMN "makeId" TEXT,
  ADD COLUMN "modelId" TEXT;

ALTER TABLE "VehicleGeneration"
  ADD CONSTRAINT "VehicleGeneration_model_requires_make_check" CHECK (
    "modelId" IS NULL OR "makeId" IS NOT NULL
  );

ALTER TABLE "ShopProduct"
  ADD CONSTRAINT "ShopProduct_catalog_versions_check" CHECK (
    "catalogVersion" >= 0
    AND "publishedCatalogVersion" >= 0
    AND "publishedCatalogVersion" <= "catalogVersion"
  );

CREATE TABLE "ShopCatalogSource" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "kind" "ShopCatalogSourceKind" NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopCatalogSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopBrand" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameUa" TEXT,
  "nameEn" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopBrand_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VehicleMake" (
  "id" TEXT NOT NULL,
  "makeKey" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'auto',
  "name" TEXT NOT NULL,
  "nameUa" TEXT,
  "nameEn" TEXT,
  "normalizedName" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VehicleMake_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VehicleModel" (
  "id" TEXT NOT NULL,
  "modelKey" TEXT NOT NULL,
  "makeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameUa" TEXT,
  "nameEn" TEXT,
  "normalizedName" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VehicleModel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VehiclePowertrain" (
  "id" TEXT NOT NULL,
  "powertrainKey" TEXT NOT NULL,
  "makeId" TEXT,
  "code" TEXT,
  "name" TEXT NOT NULL,
  "fuelKey" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VehiclePowertrain_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VehicleConfiguration" (
  "id" TEXT NOT NULL,
  "configurationKey" TEXT NOT NULL,
  "generationId" TEXT NOT NULL,
  "powertrainId" TEXT,
  "yearFrom" INTEGER,
  "yearTo" INTEGER,
  "fuelKey" TEXT,
  "bodyStyleKey" TEXT,
  "drivetrainKey" TEXT,
  "transmissionKey" TEXT,
  "marketKey" TEXT,
  "opfGpfKey" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VehicleConfiguration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VehicleConfiguration_years_check" CHECK (
    ("yearFrom" IS NULL OR "yearFrom" BETWEEN 1886 AND 2200)
    AND ("yearTo" IS NULL OR "yearTo" BETWEEN 1886 AND 2200)
    AND ("yearFrom" IS NULL OR "yearTo" IS NULL OR "yearFrom" <= "yearTo")
  )
);

CREATE TABLE "ShopCatalogSourceRecord" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "recordKey" TEXT NOT NULL,
  "sourceRevision" TEXT NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "rawPayload" JSONB,
  "blobRef" TEXT,
  "payloadHash" VARCHAR(64) NOT NULL,
  "productId" TEXT,
  "variantId" TEXT,
  "supersedesId" TEXT,
  "sourceUpdatedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShopCatalogSourceRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShopCatalogSourceRecord_payload_check" CHECK (
    ("rawPayload" IS NULL) <> ("blobRef" IS NULL)
  ),
  CONSTRAINT "ShopCatalogSourceRecord_hash_check" CHECK (
    "payloadHash" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "ShopCatalogSourceRecord_variant_product_check" CHECK (
    "variantId" IS NULL OR "productId" IS NOT NULL
  ),
  CONSTRAINT "ShopCatalogSourceRecord_schema_version_check" CHECK ("schemaVersion" > 0),
  CONSTRAINT "ShopCatalogSourceRecord_supersedes_self_check" CHECK (
    "supersedesId" IS NULL OR "supersedesId" <> "id"
  )
);

CREATE TABLE "ShopCatalogSourceBinding" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceRecordId" TEXT,
  "entityType" "ShopCatalogEntityType" NOT NULL,
  "externalKey" TEXT NOT NULL,
  "bindingVersion" INTEGER NOT NULL DEFAULT 1,
  "action" "ShopCatalogBindingAction" NOT NULL DEFAULT 'MAP',
  "canonicalEntityId" TEXT,
  "productId" TEXT,
  "variantId" TEXT,
  "supersedesId" TEXT,
  "decisionReason" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShopCatalogSourceBinding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShopCatalogSourceBinding_target_check" CHECK (
    (
      "action" = 'MAP'
      AND "canonicalEntityId" IS NOT NULL
      AND CASE "entityType"
        WHEN 'PRODUCT' THEN "productId" IS NOT NULL AND "variantId" IS NULL AND "canonicalEntityId" = "productId"
        WHEN 'VARIANT' THEN "productId" IS NOT NULL AND "variantId" IS NOT NULL AND "canonicalEntityId" = "variantId"
        ELSE "productId" IS NULL AND "variantId" IS NULL
      END
    )
    OR (
      "action" = 'TOMBSTONE'
      AND "canonicalEntityId" IS NULL
      AND "productId" IS NULL
      AND "variantId" IS NULL
    )
  ),
  CONSTRAINT "ShopCatalogSourceBinding_keys_check" CHECK (
    btrim("externalKey") <> ''
    AND ("canonicalEntityId" IS NULL OR btrim("canonicalEntityId") <> '')
  ),
  CONSTRAINT "ShopCatalogSourceBinding_version_check" CHECK (
    "bindingVersion" > 0 AND "supersedesId" IS DISTINCT FROM "id"
  ),
  CONSTRAINT "ShopCatalogSourceBinding_review_check" CHECK (
    ("bindingVersion" = 1 AND "action" = 'MAP')
    OR (
      "decisionReason" IS NOT NULL
      AND btrim("decisionReason") <> ''
      AND "reviewedById" IS NOT NULL
      AND btrim("reviewedById") <> ''
      AND "reviewedAt" IS NOT NULL
    )
  )
);

CREATE TABLE "ShopCatalogSourceBindingHead" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "entityType" "ShopCatalogEntityType" NOT NULL,
  "externalKey" TEXT NOT NULL,
  "currentBindingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopCatalogSourceBindingHead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopCatalogFieldProvenance" (
  "id" TEXT NOT NULL,
  "sourceRecordId" TEXT NOT NULL,
  "fieldPath" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL DEFAULT 0,
  "rawValue" JSONB NOT NULL,
  "canonicalEntityType" "ShopCatalogEntityType" NOT NULL,
  "canonicalEntityId" TEXT,
  "canonicalField" TEXT,
  "normalizedValue" JSONB,
  "mappingStatus" "ShopCatalogMappingStatus" NOT NULL,
  "mapperVersion" TEXT NOT NULL,
  "confidence" DECIMAL(4,3) NOT NULL,
  "reason" TEXT,
  "productId" TEXT,
  "variantId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShopCatalogFieldProvenance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShopCatalogFieldProvenance_confidence_check" CHECK (
    "confidence" BETWEEN 0 AND 1
  ),
  CONSTRAINT "ShopCatalogFieldProvenance_mapping_check" CHECK (
    ("mappingStatus" = 'MAPPED' AND "canonicalEntityId" IS NOT NULL AND "canonicalField" IS NOT NULL)
    OR ("mappingStatus" <> 'MAPPED' AND "reason" IS NOT NULL)
  ),
  CONSTRAINT "ShopCatalogFieldProvenance_variant_product_check" CHECK (
    "variantId" IS NULL OR "productId" IS NOT NULL
  ),
  CONSTRAINT "ShopCatalogFieldProvenance_ordinal_check" CHECK ("ordinal" >= 0)
);

CREATE TABLE "ShopCatalogNormalizationIssue" (
  "id" TEXT NOT NULL,
  "sourceRecordId" TEXT NOT NULL,
  "provenanceId" TEXT,
  "productId" TEXT,
  "variantId" TEXT,
  "issueKey" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "rawPath" TEXT,
  "details" JSONB NOT NULL,
  "status" "ShopCatalogIssueStatus" NOT NULL DEFAULT 'OPEN',
  "resolution" JSONB,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopCatalogNormalizationIssue_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShopCatalogNormalizationIssue_resolution_check" CHECK (
    ("status" = 'OPEN' AND "resolvedAt" IS NULL)
    OR ("status" <> 'OPEN' AND "resolvedAt" IS NOT NULL AND "resolution" IS NOT NULL)
  ),
  CONSTRAINT "ShopCatalogNormalizationIssue_variant_product_check" CHECK (
    "variantId" IS NULL OR "productId" IS NOT NULL
  )
);

CREATE TABLE "ShopBrandAlias" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "alias" TEXT NOT NULL,
  "normalizedAlias" TEXT NOT NULL,
  "locale" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopBrandAlias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VehicleTaxonomyAlias" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "entityType" "VehicleTaxonomyEntityType" NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'auto',
  "aliasKey" TEXT NOT NULL,
  "alias" TEXT NOT NULL,
  "normalizedAlias" TEXT NOT NULL,
  "locale" TEXT,
  "confidence" DECIMAL(4,3) NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "makeId" TEXT,
  "modelId" TEXT,
  "generationId" TEXT,
  "powertrainId" TEXT,
  "configurationId" TEXT,
  "parentMakeId" TEXT,
  "parentModelId" TEXT,
  "parentGenerationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VehicleTaxonomyAlias_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VehicleTaxonomyAlias_confidence_check" CHECK ("confidence" BETWEEN 0 AND 1),
  CONSTRAINT "VehicleTaxonomyAlias_key_check" CHECK (
    btrim("scope") <> '' AND btrim("aliasKey") <> '' AND btrim("normalizedAlias") <> ''
  ),
  CONSTRAINT "VehicleTaxonomyAlias_target_check" CHECK (
    CASE "entityType"
      WHEN 'MAKE' THEN "makeId" IS NOT NULL AND "modelId" IS NULL AND "generationId" IS NULL AND "powertrainId" IS NULL AND "configurationId" IS NULL
      WHEN 'MODEL' THEN "makeId" IS NULL AND "modelId" IS NOT NULL AND "generationId" IS NULL AND "powertrainId" IS NULL AND "configurationId" IS NULL
      WHEN 'GENERATION' THEN "makeId" IS NULL AND "modelId" IS NULL AND "generationId" IS NOT NULL AND "powertrainId" IS NULL AND "configurationId" IS NULL
      WHEN 'POWERTRAIN' THEN "makeId" IS NULL AND "modelId" IS NULL AND "generationId" IS NULL AND "powertrainId" IS NOT NULL AND "configurationId" IS NULL
      WHEN 'CONFIGURATION' THEN "makeId" IS NULL AND "modelId" IS NULL AND "generationId" IS NULL AND "powertrainId" IS NULL AND "configurationId" IS NOT NULL
    END
  ),
  CONSTRAINT "VehicleTaxonomyAlias_context_check" CHECK (
    CASE "entityType"
      WHEN 'MAKE' THEN "parentMakeId" IS NULL AND "parentModelId" IS NULL AND "parentGenerationId" IS NULL
      WHEN 'MODEL' THEN "parentMakeId" IS NOT NULL AND "parentModelId" IS NULL AND "parentGenerationId" IS NULL
      WHEN 'GENERATION' THEN "parentMakeId" IS NOT NULL AND "parentModelId" IS NOT NULL AND "parentGenerationId" IS NULL
      WHEN 'POWERTRAIN' THEN "parentMakeId" IS NOT NULL AND "parentGenerationId" IS NULL
      WHEN 'CONFIGURATION' THEN "parentMakeId" IS NOT NULL AND "parentModelId" IS NOT NULL AND "parentGenerationId" IS NOT NULL
    END
  )
);

CREATE TABLE "ShopCatalogCompatibilityPolicy" (
  "id" TEXT NOT NULL,
  "targetKey" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT,
  "parentProductId" TEXT,
  "parentVariantId" TEXT,
  "mode" "ShopCatalogCompatibilityMode" NOT NULL DEFAULT 'VEHICLE_SPECIFIC',
  "schemaVersion" INTEGER NOT NULL DEFAULT 2,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sourceRecordId" TEXT,
  "retiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopCatalogCompatibilityPolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShopCatalogCompatibilityPolicy_target_key_check" CHECK (
    "targetKey" = CASE
      WHEN "variantId" IS NULL THEN 'product:' || "productId"
      ELSE 'variant:' || "variantId"
    END
  ),
  CONSTRAINT "ShopCatalogCompatibilityPolicy_parent_check" CHECK (
    ("mode" = 'PARENT_DEPENDENT' AND "parentProductId" IS NOT NULL)
    OR ("mode" <> 'PARENT_DEPENDENT' AND "parentProductId" IS NULL AND "parentVariantId" IS NULL)
  ),
  CONSTRAINT "ShopCatalogCompatibilityPolicy_self_parent_check" CHECK (
    NOT (
      "parentProductId" = "productId"
      AND (
        ("variantId" IS NULL AND "parentVariantId" IS NULL)
        OR "parentVariantId" = "variantId"
      )
    )
  ),
  CONSTRAINT "ShopCatalogCompatibilityPolicy_version_check" CHECK (
    "schemaVersion" = 2 AND "revision" > 0
  ),
  CONSTRAINT "ShopCatalogCompatibilityPolicy_retired_check" CHECK (
    ("isActive" AND "retiredAt" IS NULL) OR (NOT "isActive" AND "retiredAt" IS NOT NULL)
  )
);

CREATE TABLE "ShopCatalogCompatibilityDimensionRule" (
  "policyId" TEXT NOT NULL,
  "dimension" "ShopCatalogCompatibilityDimension" NOT NULL,
  "isRequired" BOOLEAN NOT NULL DEFAULT false,
  "defaultState" "ShopCatalogConstraintState" NOT NULL DEFAULT 'UNKNOWN',
  CONSTRAINT "ShopCatalogCompatibilityDimensionRule_pkey" PRIMARY KEY ("policyId", "dimension"),
  CONSTRAINT "ShopCatalogCompatibilityDimensionRule_default_check" CHECK ("defaultState" <> 'EXACT')
);

CREATE TABLE "ShopCatalogCompatibilityClause" (
  "id" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "clauseKey" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "verification" "ShopCatalogClauseVerification" NOT NULL DEFAULT 'NEEDS_REVIEW',
  "sourceRecordId" TEXT,
  "sourceRef" TEXT,
  "evidenceHash" VARCHAR(64),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShopCatalogCompatibilityClause_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShopCatalogCompatibilityClause_position_check" CHECK ("position" >= 0),
  CONSTRAINT "ShopCatalogCompatibilityClause_hash_check" CHECK (
    "evidenceHash" IS NULL OR "evidenceHash" ~ '^[0-9a-f]{64}$'
  )
);

CREATE TABLE "ShopCatalogCompatibilityConstraint" (
  "id" TEXT NOT NULL,
  "clauseId" TEXT NOT NULL,
  "dimension" "ShopCatalogCompatibilityDimension" NOT NULL,
  "state" "ShopCatalogConstraintState" NOT NULL,
  CONSTRAINT "ShopCatalogCompatibilityConstraint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopCatalogCompatibilityValue" (
  "id" TEXT NOT NULL,
  "constraintId" TEXT NOT NULL,
  "dimension" "ShopCatalogCompatibilityDimension" NOT NULL,
  "state" "ShopCatalogConstraintState" NOT NULL DEFAULT 'EXACT',
  "ordinal" INTEGER NOT NULL DEFAULT 0,
  "textValue" TEXT,
  "numberValue" DECIMAL(18,6),
  "booleanValue" BOOLEAN,
  "yearFrom" INTEGER,
  "yearTo" INTEGER,
  "makeId" TEXT,
  "modelId" TEXT,
  "generationId" TEXT,
  "powertrainId" TEXT,
  CONSTRAINT "ShopCatalogCompatibilityValue_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShopCatalogCompatibilityValue_exact_check" CHECK ("state" = 'EXACT'),
  CONSTRAINT "ShopCatalogCompatibilityValue_ordinal_check" CHECK ("ordinal" >= 0),
  CONSTRAINT "ShopCatalogCompatibilityValue_years_check" CHECK (
    ("yearFrom" IS NULL OR "yearFrom" BETWEEN 1886 AND 2200)
    AND ("yearTo" IS NULL OR "yearTo" BETWEEN 1886 AND 2200)
    AND ("yearFrom" IS NULL OR "yearTo" IS NULL OR "yearFrom" <= "yearTo")
  ),
  CONSTRAINT "ShopCatalogCompatibilityValue_shape_check" CHECK (
    num_nonnulls(
      "textValue",
      "numberValue",
      "booleanValue",
      CASE WHEN "yearFrom" IS NOT NULL OR "yearTo" IS NOT NULL THEN true END,
      "makeId",
      "modelId",
      "generationId",
      "powertrainId"
    ) = 1
  ),
  CONSTRAINT "ShopCatalogCompatibilityValue_dimension_shape_check" CHECK (
    CASE "dimension"
      WHEN 'MAKE' THEN "makeId" IS NOT NULL
      WHEN 'MODEL' THEN "modelId" IS NOT NULL
      WHEN 'GENERATION' THEN "generationId" IS NOT NULL
      WHEN 'YEAR' THEN (
        ("numberValue" IS NOT NULL AND "numberValue" BETWEEN 1886 AND 2200 AND trunc("numberValue") = "numberValue")
        OR "yearFrom" IS NOT NULL
        OR "yearTo" IS NOT NULL
      )
      WHEN 'ENGINE' THEN "powertrainId" IS NOT NULL OR "textValue" IS NOT NULL
      WHEN 'OPF_GPF' THEN "textValue" IS NOT NULL OR "booleanValue" IS NOT NULL
      WHEN 'SCOPE' THEN "textValue" IS NOT NULL
      WHEN 'CHASSIS' THEN "textValue" IS NOT NULL
      WHEN 'FUEL' THEN "textValue" IS NOT NULL
      WHEN 'BODY_STYLE' THEN "textValue" IS NOT NULL
      WHEN 'DRIVETRAIN' THEN "textValue" IS NOT NULL
      WHEN 'TRANSMISSION' THEN "textValue" IS NOT NULL
      WHEN 'MARKET' THEN "textValue" IS NOT NULL
    END
  )
);

CREATE TABLE "ShopCatalogProductRevision" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "version" BIGINT NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "changeDomains" "ShopCatalogChangeDomain"[] NOT NULL,
  "snapshot" JSONB NOT NULL,
  "contentHash" VARCHAR(64) NOT NULL,
  "actorType" TEXT,
  "actorId" TEXT,
  "reason" TEXT,
  "sourceRecordId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShopCatalogProductRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShopCatalogProductRevision_version_check" CHECK ("version" > 0),
  CONSTRAINT "ShopCatalogProductRevision_domains_check" CHECK (cardinality("changeDomains") > 0),
  CONSTRAINT "ShopCatalogProductRevision_hash_check" CHECK ("contentHash" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "ShopCatalogOutbox" (
  "id" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "entityType" "ShopCatalogPublicationEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "productId" TEXT,
  "revisionId" TEXT,
  "canonicalVersion" BIGINT NOT NULL,
  "changeDomains" "ShopCatalogChangeDomain"[] NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "ShopCatalogOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 10,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedBy" TEXT,
  "lockedAt" TIMESTAMP(3),
  "leaseExpiresAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopCatalogOutbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShopCatalogOutbox_version_check" CHECK ("canonicalVersion" > 0),
  CONSTRAINT "ShopCatalogOutbox_domains_check" CHECK (cardinality("changeDomains") > 0),
  CONSTRAINT "ShopCatalogOutbox_attempts_check" CHECK (
    "attempts" >= 0 AND "maxAttempts" > 0 AND "attempts" <= "maxAttempts"
  ),
  CONSTRAINT "ShopCatalogOutbox_lifecycle_check" CHECK (
    (
      "status" = 'PROCESSING'
      AND "lockedBy" IS NOT NULL
      AND "lockedAt" IS NOT NULL
      AND "leaseExpiresAt" IS NOT NULL
      AND "lockedAt" < "leaseExpiresAt"
      AND "processedAt" IS NULL
    )
    OR (
      "status" IN ('PENDING', 'RETRY')
      AND "lockedBy" IS NULL
      AND "lockedAt" IS NULL
      AND "leaseExpiresAt" IS NULL
      AND "processedAt" IS NULL
    )
    OR (
      "status" IN ('COMPLETED', 'DEAD_LETTER')
      AND "lockedBy" IS NULL
      AND "lockedAt" IS NULL
      AND "leaseExpiresAt" IS NULL
      AND "processedAt" IS NOT NULL
    )
  ),
  CONSTRAINT "ShopCatalogOutbox_product_check" CHECK (
    ("entityType" = 'PRODUCT' AND "productId" IS NOT NULL AND "revisionId" IS NOT NULL AND "entityId" = "productId")
    OR ("entityType" <> 'PRODUCT' AND "productId" IS NULL AND "revisionId" IS NULL)
  )
);

CREATE TABLE "ShopCatalogPublicationReceipt" (
  "id" TEXT NOT NULL,
  "entityType" "ShopCatalogPublicationEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "target" "ShopCatalogProjectionTarget" NOT NULL,
  "productId" TEXT,
  "appliedRevisionId" TEXT,
  "appliedVersion" BIGINT NOT NULL DEFAULT 0,
  "processingVersion" BIGINT,
  "failedVersion" BIGINT,
  "status" "ShopCatalogPublicationReceiptStatus" NOT NULL DEFAULT 'SAVED',
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopCatalogPublicationReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShopCatalogPublicationReceipt_product_check" CHECK (
    (
      "entityType" = 'PRODUCT'
      AND "productId" IS NOT NULL
      AND "entityId" = "productId"
      AND (
        ("appliedVersion" = 0 AND "appliedRevisionId" IS NULL)
        OR ("appliedVersion" > 0 AND "appliedRevisionId" IS NOT NULL)
      )
    )
    OR ("entityType" <> 'PRODUCT' AND "productId" IS NULL AND "appliedRevisionId" IS NULL)
  ),
  CONSTRAINT "ShopCatalogPublicationReceipt_versions_check" CHECK (
    "appliedVersion" >= 0
    AND ("processingVersion" IS NULL OR "processingVersion" > "appliedVersion")
    AND ("failedVersion" IS NULL OR "failedVersion" > "appliedVersion")
  ),
  CONSTRAINT "ShopCatalogPublicationReceipt_status_check" CHECK (
    ("status" = 'PUBLISHING' AND "processingVersion" IS NOT NULL AND "failedVersion" IS NULL)
    OR ("status" = 'FAILED' AND "processingVersion" IS NULL AND "failedVersion" IS NOT NULL)
    OR (
      "status" IN ('SAVED', 'PUBLISHED')
      AND "processingVersion" IS NULL
      AND "failedVersion" IS NULL
      AND ("status" <> 'PUBLISHED' OR "appliedVersion" > 0)
    )
  )
);

CREATE TABLE "ShopCatalogProjection" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "sourceVersion" BIGINT NOT NULL,
  "catalogVersion" BIGINT NOT NULL,
  "projectionVersion" BIGINT NOT NULL,
  "sourceUpdatedAt" TIMESTAMP(3),
  "sourceContentHash" VARCHAR(64) NOT NULL,
  "canonicalRelationHash" VARCHAR(64) NOT NULL,
  "compatibilityHash" VARCHAR(64) NOT NULL,
  "slug" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "statusKey" TEXT NOT NULL,
  "stockKey" TEXT NOT NULL,
  "isPublished" BOOLEAN NOT NULL,
  "stableRank" DECIMAL(20,8) NOT NULL,
  "normalizedSku" TEXT,
  "brandId" TEXT,
  "brandKey" TEXT NOT NULL,
  "brandLabel" TEXT NOT NULL,
  "categoryId" TEXT,
  "categoryKey" TEXT,
  "categoryLabel" TEXT,
  "productTypeKey" TEXT,
  "productKindKey" TEXT,
  "categoryGroupKey" TEXT,
  "title" TEXT NOT NULL,
  "cardCopy" TEXT,
  "searchText" TEXT NOT NULL,
  "primaryMediaAssetId" TEXT,
  "primaryMediaUrl" TEXT,
  "primaryMediaWidth" INTEGER,
  "primaryMediaHeight" INTEGER,
  "primaryMediaVersion" TEXT,
  "minPriceEur" DECIMAL(12,2),
  "minPriceEurEurope" DECIMAL(12,2),
  "minPriceUsd" DECIMAL(12,2),
  "minPriceUah" DECIMAL(12,2),
  "contentHash" VARCHAR(64) NOT NULL,
  "builtAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopCatalogProjection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShopCatalogProjection_locale_check" CHECK ("locale" IN ('ua', 'en')),
  CONSTRAINT "ShopCatalogProjection_versions_check" CHECK (
    "schemaVersion" = 1
    AND "sourceVersion" >= 0
    AND "catalogVersion" >= 0
    AND "projectionVersion" = "catalogVersion"
  ),
  CONSTRAINT "ShopCatalogProjection_media_check" CHECK (
    ("primaryMediaWidth" IS NULL OR "primaryMediaWidth" > 0)
    AND ("primaryMediaHeight" IS NULL OR "primaryMediaHeight" > 0)
  ),
  CONSTRAINT "ShopCatalogProjection_prices_check" CHECK (
    ("minPriceEur" IS NULL OR "minPriceEur" >= 0)
    AND ("minPriceEurEurope" IS NULL OR "minPriceEurEurope" >= 0)
    AND ("minPriceUsd" IS NULL OR "minPriceUsd" >= 0)
    AND ("minPriceUah" IS NULL OR "minPriceUah" >= 0)
  ),
  CONSTRAINT "ShopCatalogProjection_hashes_check" CHECK (
    "sourceContentHash" ~ '^[0-9a-f]{64}$'
    AND "canonicalRelationHash" ~ '^[0-9a-f]{64}$'
    AND "compatibilityHash" ~ '^[0-9a-f]{64}$'
    AND "contentHash" ~ '^[0-9a-f]{64}$'
  )
);

CREATE TABLE "ShopCatalogProjectionSku" (
  "id" TEXT NOT NULL,
  "skuKey" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT,
  "sourceVersion" BIGINT NOT NULL,
  "sku" TEXT NOT NULL,
  "normalizedSku" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "stableRank" DECIMAL(20,8) NOT NULL,
  CONSTRAINT "ShopCatalogProjectionSku_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShopCatalogProjectionSku_target_check" CHECK (
    "skuKey" = CASE
      WHEN "variantId" IS NULL THEN 'product:' || "productId"
      ELSE 'variant:' || "variantId"
    END
  ),
  CONSTRAINT "ShopCatalogProjectionSku_version_check" CHECK ("sourceVersion" >= 0)
);

CREATE TABLE "ShopCatalogProjectionPolicy" (
  "id" TEXT NOT NULL,
  "targetKey" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT,
  "parentProductId" TEXT,
  "parentVariantId" TEXT,
  "mode" "ShopCatalogCompatibilityMode" NOT NULL DEFAULT 'VEHICLE_SPECIFIC',
  "sourceVersion" BIGINT NOT NULL,
  "requiredDimensions" "ShopCatalogCompatibilityDimension"[] NOT NULL,
  "dimensionDefaults" JSONB NOT NULL,
  "clauseCount" INTEGER NOT NULL,
  CONSTRAINT "ShopCatalogProjectionPolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShopCatalogProjectionPolicy_target_check" CHECK (
    "targetKey" = CASE
      WHEN "variantId" IS NULL THEN 'product:' || "productId"
      ELSE 'variant:' || "variantId"
    END
  ),
  CONSTRAINT "ShopCatalogProjectionPolicy_counts_check" CHECK (
    "sourceVersion" >= 0 AND "clauseCount" >= 0
  ),
  CONSTRAINT "ShopCatalogProjectionPolicy_parent_check" CHECK (
    ("mode" = 'PARENT_DEPENDENT' AND "parentProductId" IS NOT NULL)
    OR ("mode" <> 'PARENT_DEPENDENT' AND "parentProductId" IS NULL AND "parentVariantId" IS NULL)
  ),
  CONSTRAINT "ShopCatalogProjectionPolicy_self_parent_check" CHECK (
    NOT (
      "parentProductId" = "productId"
      AND (
        ("variantId" IS NULL AND "parentVariantId" IS NULL)
        OR "parentVariantId" = "variantId"
      )
    )
  )
);

CREATE TABLE "ShopCatalogProjectionClause" (
  "id" TEXT NOT NULL,
  "targetKey" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT,
  "sourceVersion" BIGINT NOT NULL,
  "clauseKey" TEXT NOT NULL,
  "verification" "ShopCatalogClauseVerification" NOT NULL,
  "sourceRef" TEXT,
  CONSTRAINT "ShopCatalogProjectionClause_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShopCatalogProjectionClause_target_check" CHECK (
    "targetKey" = CASE
      WHEN "variantId" IS NULL THEN 'product:' || "productId"
      ELSE 'variant:' || "variantId"
    END
  ),
  CONSTRAINT "ShopCatalogProjectionClause_version_check" CHECK ("sourceVersion" >= 0)
);

CREATE TABLE "ShopCatalogProjectionConstraint" (
  "id" TEXT NOT NULL,
  "targetKey" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT,
  "sourceVersion" BIGINT NOT NULL,
  "clauseKey" TEXT NOT NULL,
  "dimension" "ShopCatalogCompatibilityDimension" NOT NULL,
  "state" "ShopCatalogConstraintState" NOT NULL,
  "valueOrdinal" INTEGER NOT NULL DEFAULT 0,
  "valueKind" TEXT,
  "textValue" TEXT,
  "numberValue" DECIMAL(18,6),
  "booleanValue" BOOLEAN,
  "yearFrom" INTEGER,
  "yearTo" INTEGER,
  CONSTRAINT "ShopCatalogProjectionConstraint_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShopCatalogProjectionConstraint_target_check" CHECK (
    "targetKey" = CASE
      WHEN "variantId" IS NULL THEN 'product:' || "productId"
      ELSE 'variant:' || "variantId"
    END
  ),
  CONSTRAINT "ShopCatalogProjectionConstraint_version_check" CHECK (
    "sourceVersion" >= 0 AND "valueOrdinal" >= 0
  ),
  CONSTRAINT "ShopCatalogProjectionConstraint_years_check" CHECK (
    ("yearFrom" IS NULL OR "yearFrom" BETWEEN 1886 AND 2200)
    AND ("yearTo" IS NULL OR "yearTo" BETWEEN 1886 AND 2200)
    AND ("yearFrom" IS NULL OR "yearTo" IS NULL OR "yearFrom" <= "yearTo")
  ),
  CONSTRAINT "ShopCatalogProjectionConstraint_shape_check" CHECK (
    (
      "state" = 'EXACT'
      AND (
        ("valueKind" = 'text' AND "textValue" IS NOT NULL AND "numberValue" IS NULL AND "booleanValue" IS NULL AND "yearFrom" IS NULL AND "yearTo" IS NULL)
        OR ("valueKind" = 'number' AND "textValue" IS NULL AND "numberValue" IS NOT NULL AND "booleanValue" IS NULL AND "yearFrom" IS NULL AND "yearTo" IS NULL)
        OR ("valueKind" = 'boolean' AND "textValue" IS NULL AND "numberValue" IS NULL AND "booleanValue" IS NOT NULL AND "yearFrom" IS NULL AND "yearTo" IS NULL)
        OR ("valueKind" = 'year_range' AND "textValue" IS NULL AND "numberValue" IS NULL AND "booleanValue" IS NULL AND ("yearFrom" IS NOT NULL OR "yearTo" IS NOT NULL))
      )
    )
    OR (
      "state" <> 'EXACT'
      AND "valueOrdinal" = 0
      AND "valueKind" IS NULL
      AND "textValue" IS NULL
      AND "numberValue" IS NULL
      AND "booleanValue" IS NULL
      AND "yearFrom" IS NULL
      AND "yearTo" IS NULL
    )
  )
);

CREATE TABLE "ShopCatalogState" (
  "id" TEXT NOT NULL,
  "canonicalVersion" BIGINT NOT NULL DEFAULT 0,
  "projectionVersion" BIGINT NOT NULL DEFAULT 0,
  "fingerprint" VARCHAR(64),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopCatalogState_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShopCatalogState_versions_check" CHECK (
    "canonicalVersion" >= 0 AND "projectionVersion" >= 0
  ),
  CONSTRAINT "ShopCatalogState_hash_check" CHECK (
    "fingerprint" IS NULL OR "fingerprint" ~ '^[0-9a-f]{64}$'
  )
);

CREATE TABLE "ShopCatalogRebuildCheckpoint" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "afterProductId" TEXT,
  "pageCount" INTEGER NOT NULL DEFAULT 0,
  "productCount" BIGINT NOT NULL DEFAULT 0,
  "projectionSchemaVersion" INTEGER NOT NULL DEFAULT 1,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopCatalogRebuildCheckpoint_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShopCatalogRebuildCheckpoint_status_check" CHECK (
    "status" IN ('RUNNING', 'COMPLETED', 'FAILED')
  ),
  CONSTRAINT "ShopCatalogRebuildCheckpoint_counts_check" CHECK (
    "pageCount" >= 0 AND "productCount" >= 0 AND "projectionSchemaVersion" > 0
  ),
  CONSTRAINT "ShopCatalogRebuildCheckpoint_completion_check" CHECK (
    ("status" = 'COMPLETED' AND "completedAt" IS NOT NULL AND "lastError" IS NULL)
    OR ("status" = 'FAILED' AND "completedAt" IS NOT NULL AND "lastError" IS NOT NULL)
    OR ("status" = 'RUNNING' AND "completedAt" IS NULL AND "lastError" IS NULL)
  )
);

CREATE INDEX "ShopCatalogRebuildCheckpoint_status_updatedAt_idx"
  ON "ShopCatalogRebuildCheckpoint"("status", "updatedAt");
CREATE INDEX "ShopCatalogRebuildCheckpoint_runId_idx"
  ON "ShopCatalogRebuildCheckpoint"("runId");

CREATE UNIQUE INDEX "ShopCatalogSource_key_key" ON "ShopCatalogSource"("key");
CREATE INDEX "ShopCatalogSource_kind_isActive_priority_idx" ON "ShopCatalogSource"("kind", "isActive", "priority");
CREATE UNIQUE INDEX "ShopBrand_key_key" ON "ShopBrand"("key");
CREATE INDEX "ShopBrand_isActive_name_idx" ON "ShopBrand"("isActive", "name");
CREATE UNIQUE INDEX "VehicleMake_makeKey_key" ON "VehicleMake"("makeKey");
CREATE INDEX "VehicleMake_scope_normalizedName_idx" ON "VehicleMake"("scope", "normalizedName");
CREATE INDEX "VehicleMake_isActive_name_idx" ON "VehicleMake"("isActive", "name");
CREATE UNIQUE INDEX "VehicleModel_modelKey_key" ON "VehicleModel"("modelKey");
CREATE UNIQUE INDEX "VehicleModel_makeId_normalizedName_key" ON "VehicleModel"("makeId", "normalizedName");
CREATE UNIQUE INDEX "VehicleModel_id_makeId_key" ON "VehicleModel"("id", "makeId");
CREATE INDEX "VehicleModel_makeId_isActive_name_idx" ON "VehicleModel"("makeId", "isActive", "name");
CREATE UNIQUE INDEX "VehiclePowertrain_powertrainKey_key" ON "VehiclePowertrain"("powertrainKey");
CREATE INDEX "VehiclePowertrain_makeId_code_idx" ON "VehiclePowertrain"("makeId", "code");
CREATE INDEX "VehiclePowertrain_fuelKey_isActive_idx" ON "VehiclePowertrain"("fuelKey", "isActive");
CREATE UNIQUE INDEX "VehicleConfiguration_configurationKey_key" ON "VehicleConfiguration"("configurationKey");
CREATE INDEX "VehicleConfiguration_generationId_yearFrom_yearTo_idx" ON "VehicleConfiguration"("generationId", "yearFrom", "yearTo");
CREATE INDEX "VehicleConfiguration_powertrainId_yearFrom_yearTo_idx" ON "VehicleConfiguration"("powertrainId", "yearFrom", "yearTo");
CREATE INDEX "VehicleConfiguration_fuelKey_bodyStyleKey_drivetrainKey_idx" ON "VehicleConfiguration"("fuelKey", "bodyStyleKey", "drivetrainKey");

CREATE UNIQUE INDEX "ShopCatalogSourceRecord_sourceId_recordKey_sourceRevision_key" ON "ShopCatalogSourceRecord"("sourceId", "recordKey", "sourceRevision");
CREATE UNIQUE INDEX "ShopCatalogSourceRecord_id_sourceId_key" ON "ShopCatalogSourceRecord"("id", "sourceId");
CREATE UNIQUE INDEX "ShopCatalogSourceRecord_supersedesId_key" ON "ShopCatalogSourceRecord"("supersedesId");
CREATE UNIQUE INDEX "ShopCatalogSourceRecord_one_root_identity_idx" ON "ShopCatalogSourceRecord"("sourceId", "recordKey") WHERE "supersedesId" IS NULL;
CREATE INDEX "ShopCatalogSourceRecord_sourceId_recordKey_receivedAt_idx" ON "ShopCatalogSourceRecord"("sourceId", "recordKey", "receivedAt");
CREATE INDEX "ShopCatalogSourceRecord_productId_receivedAt_idx" ON "ShopCatalogSourceRecord"("productId", "receivedAt");
CREATE INDEX "ShopCatalogSourceRecord_variantId_receivedAt_idx" ON "ShopCatalogSourceRecord"("variantId", "receivedAt");
CREATE INDEX "ShopCatalogSourceRecord_payloadHash_idx" ON "ShopCatalogSourceRecord"("payloadHash");
CREATE UNIQUE INDEX "ShopCatalogSourceBinding_sourceId_entityType_externalKey_bi_key" ON "ShopCatalogSourceBinding"("sourceId", "entityType", "externalKey", "bindingVersion");
CREATE UNIQUE INDEX "ShopCatalogSourceBinding_id_sourceId_entityType_externalKey_key" ON "ShopCatalogSourceBinding"("id", "sourceId", "entityType", "externalKey");
CREATE INDEX "ShopCatalogSourceBinding_entityType_canonicalEntityId_idx" ON "ShopCatalogSourceBinding"("entityType", "canonicalEntityId");
CREATE INDEX "ShopCatalogSourceBinding_sourceRecordId_idx" ON "ShopCatalogSourceBinding"("sourceRecordId");
CREATE INDEX "ShopCatalogSourceBinding_supersedesId_idx" ON "ShopCatalogSourceBinding"("supersedesId");
CREATE INDEX "ShopCatalogSourceBinding_productId_idx" ON "ShopCatalogSourceBinding"("productId");
CREATE INDEX "ShopCatalogSourceBinding_variantId_idx" ON "ShopCatalogSourceBinding"("variantId");
CREATE UNIQUE INDEX "ShopCatalogSourceBindingHead_sourceId_entityType_externalKe_key" ON "ShopCatalogSourceBindingHead"("sourceId", "entityType", "externalKey");
CREATE UNIQUE INDEX "ShopCatalogSourceBindingHead_currentBindingId_sourceId_enti_key" ON "ShopCatalogSourceBindingHead"("currentBindingId", "sourceId", "entityType", "externalKey");
CREATE INDEX "ShopCatalogSourceBindingHead_entityType_externalKey_idx" ON "ShopCatalogSourceBindingHead"("entityType", "externalKey");
CREATE UNIQUE INDEX "ShopCatalogFieldProvenance_sourceRecordId_fieldPath_ordinal_key" ON "ShopCatalogFieldProvenance"("sourceRecordId", "fieldPath", "ordinal");
CREATE INDEX "ShopCatalogFieldProvenance_canonicalEntityType_canonicalEnt_idx" ON "ShopCatalogFieldProvenance"("canonicalEntityType", "canonicalEntityId");
CREATE INDEX "ShopCatalogFieldProvenance_mappingStatus_createdAt_idx" ON "ShopCatalogFieldProvenance"("mappingStatus", "createdAt");
CREATE INDEX "ShopCatalogFieldProvenance_productId_idx" ON "ShopCatalogFieldProvenance"("productId");
CREATE INDEX "ShopCatalogFieldProvenance_variantId_idx" ON "ShopCatalogFieldProvenance"("variantId");
CREATE UNIQUE INDEX "ShopCatalogNormalizationIssue_sourceRecordId_issueKey_key" ON "ShopCatalogNormalizationIssue"("sourceRecordId", "issueKey");
CREATE INDEX "ShopCatalogNormalizationIssue_status_createdAt_idx" ON "ShopCatalogNormalizationIssue"("status", "createdAt");
CREATE INDEX "ShopCatalogNormalizationIssue_code_status_idx" ON "ShopCatalogNormalizationIssue"("code", "status");
CREATE INDEX "ShopCatalogNormalizationIssue_productId_status_idx" ON "ShopCatalogNormalizationIssue"("productId", "status");
CREATE INDEX "ShopCatalogNormalizationIssue_variantId_status_idx" ON "ShopCatalogNormalizationIssue"("variantId", "status");

CREATE UNIQUE INDEX "ShopBrandAlias_sourceId_normalizedAlias_key" ON "ShopBrandAlias"("sourceId", "normalizedAlias");
CREATE INDEX "ShopBrandAlias_normalizedAlias_isActive_idx" ON "ShopBrandAlias"("normalizedAlias", "isActive");
CREATE INDEX "ShopBrandAlias_brandId_isActive_idx" ON "ShopBrandAlias"("brandId", "isActive");
CREATE UNIQUE INDEX "VehicleTaxonomyAlias_sourceId_aliasKey_key" ON "VehicleTaxonomyAlias"("sourceId", "aliasKey");
CREATE UNIQUE INDEX "VehicleTaxonomyAlias_one_active_context_idx" ON "VehicleTaxonomyAlias"(
  "sourceId",
  "entityType",
  "scope",
  COALESCE("parentMakeId", ''),
  COALESCE("parentModelId", ''),
  COALESCE("parentGenerationId", ''),
  "normalizedAlias"
) WHERE "isActive";
CREATE INDEX "VehicleTaxonomyAlias_sourceId_entityType_scope_parentMakeId_idx" ON "VehicleTaxonomyAlias"("sourceId", "entityType", "scope", "parentMakeId", "parentModelId", "normalizedAlias", "isActive");
CREATE INDEX "VehicleTaxonomyAlias_makeId_idx" ON "VehicleTaxonomyAlias"("makeId");
CREATE INDEX "VehicleTaxonomyAlias_modelId_idx" ON "VehicleTaxonomyAlias"("modelId");
CREATE INDEX "VehicleTaxonomyAlias_generationId_idx" ON "VehicleTaxonomyAlias"("generationId");
CREATE INDEX "VehicleTaxonomyAlias_powertrainId_idx" ON "VehicleTaxonomyAlias"("powertrainId");
CREATE INDEX "VehicleTaxonomyAlias_configurationId_idx" ON "VehicleTaxonomyAlias"("configurationId");
CREATE INDEX "VehicleTaxonomyAlias_parentGenerationId_normalizedAlias_isA_idx" ON "VehicleTaxonomyAlias"("parentGenerationId", "normalizedAlias", "isActive");

CREATE UNIQUE INDEX "ShopCatalogCompatibilityPolicy_targetKey_revision_key" ON "ShopCatalogCompatibilityPolicy"("targetKey", "revision");
CREATE UNIQUE INDEX "ShopCatalogCompatibilityPolicy_one_active_target_idx" ON "ShopCatalogCompatibilityPolicy"("targetKey") WHERE "isActive";
CREATE INDEX "ShopCatalogCompatibilityPolicy_productId_isActive_revision_idx" ON "ShopCatalogCompatibilityPolicy"("productId", "isActive", "revision");
CREATE INDEX "ShopCatalogCompatibilityPolicy_variantId_isActive_revision_idx" ON "ShopCatalogCompatibilityPolicy"("variantId", "isActive", "revision");
CREATE INDEX "ShopCatalogCompatibilityPolicy_parentProductId_idx" ON "ShopCatalogCompatibilityPolicy"("parentProductId");
CREATE INDEX "ShopCatalogCompatibilityPolicy_parentVariantId_idx" ON "ShopCatalogCompatibilityPolicy"("parentVariantId");
CREATE INDEX "ShopCatalogCompatibilityPolicy_sourceRecordId_idx" ON "ShopCatalogCompatibilityPolicy"("sourceRecordId");
CREATE INDEX "ShopCatalogCompatibilityDimensionRule_dimension_isRequired__idx" ON "ShopCatalogCompatibilityDimensionRule"("dimension", "isRequired", "defaultState");
CREATE UNIQUE INDEX "ShopCatalogCompatibilityClause_policyId_clauseKey_key" ON "ShopCatalogCompatibilityClause"("policyId", "clauseKey");
CREATE UNIQUE INDEX "ShopCatalogCompatibilityClause_policyId_position_key" ON "ShopCatalogCompatibilityClause"("policyId", "position");
CREATE INDEX "ShopCatalogCompatibilityClause_policyId_verification_positi_idx" ON "ShopCatalogCompatibilityClause"("policyId", "verification", "position");
CREATE INDEX "ShopCatalogCompatibilityClause_sourceRecordId_idx" ON "ShopCatalogCompatibilityClause"("sourceRecordId");
CREATE UNIQUE INDEX "ShopCatalogCompatibilityConstraint_clauseId_dimension_key" ON "ShopCatalogCompatibilityConstraint"("clauseId", "dimension");
CREATE UNIQUE INDEX "ShopCatalogCompatibilityConstraint_id_dimension_state_key" ON "ShopCatalogCompatibilityConstraint"("id", "dimension", "state");
CREATE INDEX "ShopCatalogCompatibilityConstraint_dimension_state_clauseId_idx" ON "ShopCatalogCompatibilityConstraint"("dimension", "state", "clauseId");
CREATE UNIQUE INDEX "ShopCatalogCompatibilityValue_constraintId_ordinal_key" ON "ShopCatalogCompatibilityValue"("constraintId", "ordinal");
CREATE INDEX "ShopCatalogCompatibilityValue_textValue_constraintId_idx" ON "ShopCatalogCompatibilityValue"("textValue", "constraintId");
CREATE INDEX "ShopCatalogCompatibilityValue_numberValue_constraintId_idx" ON "ShopCatalogCompatibilityValue"("numberValue", "constraintId");
CREATE INDEX "ShopCatalogCompatibilityValue_booleanValue_constraintId_idx" ON "ShopCatalogCompatibilityValue"("booleanValue", "constraintId");
CREATE INDEX "ShopCatalogCompatibilityValue_yearFrom_yearTo_constraintId_idx" ON "ShopCatalogCompatibilityValue"("yearFrom", "yearTo", "constraintId");
CREATE INDEX "ShopCatalogCompatibilityValue_makeId_constraintId_idx" ON "ShopCatalogCompatibilityValue"("makeId", "constraintId");
CREATE INDEX "ShopCatalogCompatibilityValue_modelId_constraintId_idx" ON "ShopCatalogCompatibilityValue"("modelId", "constraintId");
CREATE INDEX "ShopCatalogCompatibilityValue_generationId_constraintId_idx" ON "ShopCatalogCompatibilityValue"("generationId", "constraintId");
CREATE INDEX "ShopCatalogCompatibilityValue_powertrainId_constraintId_idx" ON "ShopCatalogCompatibilityValue"("powertrainId", "constraintId");

CREATE UNIQUE INDEX "ShopCatalogProductRevision_productId_version_key" ON "ShopCatalogProductRevision"("productId", "version");
CREATE UNIQUE INDEX "ShopCatalogProductRevision_id_productId_version_key" ON "ShopCatalogProductRevision"("id", "productId", "version");
CREATE INDEX "ShopCatalogProductRevision_productId_createdAt_idx" ON "ShopCatalogProductRevision"("productId", "createdAt");
CREATE INDEX "ShopCatalogProductRevision_contentHash_idx" ON "ShopCatalogProductRevision"("contentHash");
CREATE INDEX "ShopCatalogProductRevision_sourceRecordId_idx" ON "ShopCatalogProductRevision"("sourceRecordId");
CREATE UNIQUE INDEX "ShopCatalogOutbox_dedupeKey_key" ON "ShopCatalogOutbox"("dedupeKey");
CREATE UNIQUE INDEX "ShopCatalogOutbox_entityType_entityId_canonicalVersion_key" ON "ShopCatalogOutbox"("entityType", "entityId", "canonicalVersion");
CREATE INDEX "ShopCatalogOutbox_status_availableAt_id_idx" ON "ShopCatalogOutbox"("status", "availableAt", "id");
CREATE INDEX "ShopCatalogOutbox_productId_canonicalVersion_idx" ON "ShopCatalogOutbox"("productId", "canonicalVersion");
CREATE INDEX "ShopCatalogOutbox_revisionId_idx" ON "ShopCatalogOutbox"("revisionId");
CREATE INDEX "ShopCatalogOutbox_leaseExpiresAt_idx" ON "ShopCatalogOutbox"("leaseExpiresAt");
CREATE UNIQUE INDEX "ShopCatalogPublicationReceipt_entityType_entityId_target_key" ON "ShopCatalogPublicationReceipt"("entityType", "entityId", "target");
CREATE INDEX "ShopCatalogPublicationReceipt_productId_target_appliedVersi_idx" ON "ShopCatalogPublicationReceipt"("productId", "target", "appliedVersion");
CREATE INDEX "ShopCatalogPublicationReceipt_appliedRevisionId_idx" ON "ShopCatalogPublicationReceipt"("appliedRevisionId");
CREATE INDEX "ShopCatalogPublicationReceipt_status_updatedAt_idx" ON "ShopCatalogPublicationReceipt"("status", "updatedAt");

CREATE UNIQUE INDEX "ShopCatalogProjection_productId_locale_key" ON "ShopCatalogProjection"("productId", "locale");
CREATE INDEX "ShopCatalogProjection_locale_isPublished_statusKey_stableRa_idx" ON "ShopCatalogProjection"("locale", "isPublished", "statusKey", "stableRank", "productId");
CREATE INDEX "ShopCatalogProjection_locale_scopeKey_stableRank_productId_idx" ON "ShopCatalogProjection"("locale", "scopeKey", "stableRank", "productId");
CREATE INDEX "ShopCatalogProjection_locale_brandKey_stableRank_productId_idx" ON "ShopCatalogProjection"("locale", "brandKey", "stableRank", "productId");
CREATE INDEX "ShopCatalogProjection_locale_categoryKey_stableRank_product_idx" ON "ShopCatalogProjection"("locale", "categoryKey", "stableRank", "productId");
CREATE INDEX "ShopCatalogProjection_normalizedSku_idx" ON "ShopCatalogProjection"("normalizedSku");
CREATE INDEX "ShopCatalogProjection_projectionVersion_idx" ON "ShopCatalogProjection"("projectionVersion");
CREATE INDEX "ShopCatalogProjection_contentHash_idx" ON "ShopCatalogProjection"("contentHash");
CREATE INDEX "ShopCatalogProjection_searchText_trgm_idx" ON "ShopCatalogProjection" USING GIN ("searchText" gin_trgm_ops);
CREATE INDEX "ShopCatalogProjection_searchText_fts_idx" ON "ShopCatalogProjection" USING GIN (to_tsvector('simple', "searchText"));
CREATE UNIQUE INDEX "ShopCatalogProjectionSku_productId_skuKey_key" ON "ShopCatalogProjectionSku"("productId", "skuKey");
CREATE INDEX "ShopCatalogProjectionSku_normalizedSku_stableRank_productId_idx" ON "ShopCatalogProjectionSku"("normalizedSku", "stableRank", "productId");
CREATE INDEX "ShopCatalogProjectionSku_variantId_idx" ON "ShopCatalogProjectionSku"("variantId");
CREATE INDEX "ShopCatalogProjectionSku_sourceVersion_idx" ON "ShopCatalogProjectionSku"("sourceVersion");
CREATE UNIQUE INDEX "ShopCatalogProjectionPolicy_targetKey_key" ON "ShopCatalogProjectionPolicy"("targetKey");
CREATE UNIQUE INDEX "ShopCatalogProjectionPolicy_targetKey_productId_sourceVersi_key" ON "ShopCatalogProjectionPolicy"("targetKey", "productId", "sourceVersion");
CREATE INDEX "ShopCatalogProjectionPolicy_productId_sourceVersion_idx" ON "ShopCatalogProjectionPolicy"("productId", "sourceVersion");
CREATE INDEX "ShopCatalogProjectionPolicy_variantId_sourceVersion_idx" ON "ShopCatalogProjectionPolicy"("variantId", "sourceVersion");
CREATE INDEX "ShopCatalogProjectionPolicy_parentProductId_idx" ON "ShopCatalogProjectionPolicy"("parentProductId");
CREATE INDEX "ShopCatalogProjectionPolicy_parentVariantId_idx" ON "ShopCatalogProjectionPolicy"("parentVariantId");
CREATE UNIQUE INDEX "ShopCatalogProjectionClause_targetKey_clauseKey_key" ON "ShopCatalogProjectionClause"("targetKey", "clauseKey");
CREATE UNIQUE INDEX "ShopCatalogProjectionClause_targetKey_clauseKey_productId_s_key" ON "ShopCatalogProjectionClause"("targetKey", "clauseKey", "productId", "sourceVersion");
CREATE INDEX "ShopCatalogProjectionClause_productId_verification_clauseKe_idx" ON "ShopCatalogProjectionClause"("productId", "verification", "clauseKey");
CREATE INDEX "ShopCatalogProjectionClause_variantId_verification_clauseKe_idx" ON "ShopCatalogProjectionClause"("variantId", "verification", "clauseKey");
CREATE UNIQUE INDEX "ShopCatalogProjectionConstraint_targetKey_clauseKey_dimensi_key" ON "ShopCatalogProjectionConstraint"("targetKey", "clauseKey", "dimension", "valueOrdinal");
CREATE INDEX "ShopCatalogProjectionConstraint_dimension_state_textValue_p_idx" ON "ShopCatalogProjectionConstraint"("dimension", "state", "textValue", "productId");
CREATE INDEX "ShopCatalogProjectionConstraint_dimension_state_numberValue_idx" ON "ShopCatalogProjectionConstraint"("dimension", "state", "numberValue", "productId");
CREATE INDEX "ShopCatalogProjectionConstraint_dimension_state_booleanValu_idx" ON "ShopCatalogProjectionConstraint"("dimension", "state", "booleanValue", "productId");
CREATE INDEX "ShopCatalogProjectionConstraint_dimension_state_yearFrom_ye_idx" ON "ShopCatalogProjectionConstraint"("dimension", "state", "yearFrom", "yearTo", "productId");
CREATE INDEX "ShopCatalogProjectionConstraint_variantId_dimension_state_idx" ON "ShopCatalogProjectionConstraint"("variantId", "dimension", "state");
CREATE INDEX "ShopCatalogProjectionConstraint_sourceVersion_idx" ON "ShopCatalogProjectionConstraint"("sourceVersion");

CREATE INDEX "ShopProduct_brandId_idx" ON "ShopProduct"("brandId");
CREATE INDEX "ShopProduct_catalogVersion_idx" ON "ShopProduct"("catalogVersion");
CREATE UNIQUE INDEX "ShopProductVariant_id_productId_key" ON "ShopProductVariant"("id", "productId");
CREATE INDEX "VehicleGeneration_makeId_modelId_idx" ON "VehicleGeneration"("makeId", "modelId");
CREATE UNIQUE INDEX "VehicleGeneration_id_makeId_modelId_key" ON "VehicleGeneration"("id", "makeId", "modelId");

ALTER TABLE "VehicleModel" ADD CONSTRAINT "VehicleModel_makeId_fkey" FOREIGN KEY ("makeId") REFERENCES "VehicleMake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehiclePowertrain" ADD CONSTRAINT "VehiclePowertrain_makeId_fkey" FOREIGN KEY ("makeId") REFERENCES "VehicleMake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleConfiguration" ADD CONSTRAINT "VehicleConfiguration_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "VehicleGeneration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleConfiguration" ADD CONSTRAINT "VehicleConfiguration_powertrainId_fkey" FOREIGN KEY ("powertrainId") REFERENCES "VehiclePowertrain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleGeneration" ADD CONSTRAINT "VehicleGeneration_makeId_fkey" FOREIGN KEY ("makeId") REFERENCES "VehicleMake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleGeneration" ADD CONSTRAINT "VehicleGeneration_modelId_makeId_fkey" FOREIGN KEY ("modelId", "makeId") REFERENCES "VehicleModel"("id", "makeId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShopCatalogSourceRecord" ADD CONSTRAINT "ShopCatalogSourceRecord_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ShopCatalogSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogSourceRecord" ADD CONSTRAINT "ShopCatalogSourceRecord_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogSourceRecord" ADD CONSTRAINT "ShopCatalogSourceRecord_variantId_productId_fkey" FOREIGN KEY ("variantId", "productId") REFERENCES "ShopProductVariant"("id", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogSourceRecord" ADD CONSTRAINT "ShopCatalogSourceRecord_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "ShopCatalogSourceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogSourceBinding" ADD CONSTRAINT "ShopCatalogSourceBinding_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ShopCatalogSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogSourceBinding" ADD CONSTRAINT "ShopCatalogSourceBinding_sourceRecordId_sourceId_fkey" FOREIGN KEY ("sourceRecordId", "sourceId") REFERENCES "ShopCatalogSourceRecord"("id", "sourceId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogSourceBinding" ADD CONSTRAINT "ShopCatalogSourceBinding_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogSourceBinding" ADD CONSTRAINT "ShopCatalogSourceBinding_variantId_productId_fkey" FOREIGN KEY ("variantId", "productId") REFERENCES "ShopProductVariant"("id", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogSourceBinding" ADD CONSTRAINT "ShopCatalogSourceBinding_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "ShopCatalogSourceBinding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogSourceBindingHead" ADD CONSTRAINT "ShopCatalogSourceBindingHead_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ShopCatalogSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogSourceBindingHead" ADD CONSTRAINT "ShopCatalogSourceBindingHead_currentBindingId_sourceId_ent_fkey" FOREIGN KEY ("currentBindingId", "sourceId", "entityType", "externalKey") REFERENCES "ShopCatalogSourceBinding"("id", "sourceId", "entityType", "externalKey") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogFieldProvenance" ADD CONSTRAINT "ShopCatalogFieldProvenance_sourceRecordId_fkey" FOREIGN KEY ("sourceRecordId") REFERENCES "ShopCatalogSourceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogFieldProvenance" ADD CONSTRAINT "ShopCatalogFieldProvenance_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogFieldProvenance" ADD CONSTRAINT "ShopCatalogFieldProvenance_variantId_productId_fkey" FOREIGN KEY ("variantId", "productId") REFERENCES "ShopProductVariant"("id", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogNormalizationIssue" ADD CONSTRAINT "ShopCatalogNormalizationIssue_sourceRecordId_fkey" FOREIGN KEY ("sourceRecordId") REFERENCES "ShopCatalogSourceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogNormalizationIssue" ADD CONSTRAINT "ShopCatalogNormalizationIssue_provenanceId_fkey" FOREIGN KEY ("provenanceId") REFERENCES "ShopCatalogFieldProvenance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogNormalizationIssue" ADD CONSTRAINT "ShopCatalogNormalizationIssue_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogNormalizationIssue" ADD CONSTRAINT "ShopCatalogNormalizationIssue_variantId_productId_fkey" FOREIGN KEY ("variantId", "productId") REFERENCES "ShopProductVariant"("id", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShopProduct" ADD CONSTRAINT "ShopProduct_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "ShopBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShopBrandAlias" ADD CONSTRAINT "ShopBrandAlias_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ShopCatalogSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopBrandAlias" ADD CONSTRAINT "ShopBrandAlias_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "ShopBrand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleTaxonomyAlias" ADD CONSTRAINT "VehicleTaxonomyAlias_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ShopCatalogSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleTaxonomyAlias" ADD CONSTRAINT "VehicleTaxonomyAlias_makeId_fkey" FOREIGN KEY ("makeId") REFERENCES "VehicleMake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleTaxonomyAlias" ADD CONSTRAINT "VehicleTaxonomyAlias_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "VehicleModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleTaxonomyAlias" ADD CONSTRAINT "VehicleTaxonomyAlias_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "VehicleGeneration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleTaxonomyAlias" ADD CONSTRAINT "VehicleTaxonomyAlias_powertrainId_fkey" FOREIGN KEY ("powertrainId") REFERENCES "VehiclePowertrain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleTaxonomyAlias" ADD CONSTRAINT "VehicleTaxonomyAlias_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "VehicleConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleTaxonomyAlias" ADD CONSTRAINT "VehicleTaxonomyAlias_parentMakeId_fkey" FOREIGN KEY ("parentMakeId") REFERENCES "VehicleMake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleTaxonomyAlias" ADD CONSTRAINT "VehicleTaxonomyAlias_parentModelId_parentMakeId_fkey" FOREIGN KEY ("parentModelId", "parentMakeId") REFERENCES "VehicleModel"("id", "makeId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleTaxonomyAlias" ADD CONSTRAINT "VehicleTaxonomyAlias_parentGenerationId_fkey" FOREIGN KEY ("parentGenerationId") REFERENCES "VehicleGeneration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShopCatalogCompatibilityPolicy" ADD CONSTRAINT "ShopCatalogCompatibilityPolicy_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogCompatibilityPolicy" ADD CONSTRAINT "ShopCatalogCompatibilityPolicy_variantId_productId_fkey" FOREIGN KEY ("variantId", "productId") REFERENCES "ShopProductVariant"("id", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogCompatibilityPolicy" ADD CONSTRAINT "ShopCatalogCompatibilityPolicy_parentProductId_fkey" FOREIGN KEY ("parentProductId") REFERENCES "ShopProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogCompatibilityPolicy" ADD CONSTRAINT "ShopCatalogCompatibilityPolicy_parentVariantId_parentProdu_fkey" FOREIGN KEY ("parentVariantId", "parentProductId") REFERENCES "ShopProductVariant"("id", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogCompatibilityPolicy" ADD CONSTRAINT "ShopCatalogCompatibilityPolicy_sourceRecordId_fkey" FOREIGN KEY ("sourceRecordId") REFERENCES "ShopCatalogSourceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogCompatibilityDimensionRule" ADD CONSTRAINT "ShopCatalogCompatibilityDimensionRule_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "ShopCatalogCompatibilityPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogCompatibilityClause" ADD CONSTRAINT "ShopCatalogCompatibilityClause_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "ShopCatalogCompatibilityPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogCompatibilityClause" ADD CONSTRAINT "ShopCatalogCompatibilityClause_sourceRecordId_fkey" FOREIGN KEY ("sourceRecordId") REFERENCES "ShopCatalogSourceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogCompatibilityConstraint" ADD CONSTRAINT "ShopCatalogCompatibilityConstraint_clauseId_fkey" FOREIGN KEY ("clauseId") REFERENCES "ShopCatalogCompatibilityClause"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogCompatibilityValue" ADD CONSTRAINT "ShopCatalogCompatibilityValue_constraintId_dimension_state_fkey" FOREIGN KEY ("constraintId", "dimension", "state") REFERENCES "ShopCatalogCompatibilityConstraint"("id", "dimension", "state") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogCompatibilityValue" ADD CONSTRAINT "ShopCatalogCompatibilityValue_makeId_fkey" FOREIGN KEY ("makeId") REFERENCES "VehicleMake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogCompatibilityValue" ADD CONSTRAINT "ShopCatalogCompatibilityValue_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "VehicleModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogCompatibilityValue" ADD CONSTRAINT "ShopCatalogCompatibilityValue_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "VehicleGeneration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogCompatibilityValue" ADD CONSTRAINT "ShopCatalogCompatibilityValue_powertrainId_fkey" FOREIGN KEY ("powertrainId") REFERENCES "VehiclePowertrain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShopCatalogProductRevision" ADD CONSTRAINT "ShopCatalogProductRevision_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogProductRevision" ADD CONSTRAINT "ShopCatalogProductRevision_sourceRecordId_fkey" FOREIGN KEY ("sourceRecordId") REFERENCES "ShopCatalogSourceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogOutbox" ADD CONSTRAINT "ShopCatalogOutbox_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogOutbox" ADD CONSTRAINT "ShopCatalogOutbox_revisionId_productId_canonicalVersion_fkey" FOREIGN KEY ("revisionId", "productId", "canonicalVersion") REFERENCES "ShopCatalogProductRevision"("id", "productId", "version") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogPublicationReceipt" ADD CONSTRAINT "ShopCatalogPublicationReceipt_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogPublicationReceipt" ADD CONSTRAINT "ShopCatalogPublicationReceipt_appliedRevisionId_productId__fkey" FOREIGN KEY ("appliedRevisionId", "productId", "appliedVersion") REFERENCES "ShopCatalogProductRevision"("id", "productId", "version") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogProjection" ADD CONSTRAINT "ShopCatalogProjection_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogProjection" ADD CONSTRAINT "ShopCatalogProjection_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "ShopBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogProjection" ADD CONSTRAINT "ShopCatalogProjection_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ShopCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogProjectionSku" ADD CONSTRAINT "ShopCatalogProjectionSku_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogProjectionSku" ADD CONSTRAINT "ShopCatalogProjectionSku_variantId_productId_fkey" FOREIGN KEY ("variantId", "productId") REFERENCES "ShopProductVariant"("id", "productId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogProjectionPolicy" ADD CONSTRAINT "ShopCatalogProjectionPolicy_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogProjectionPolicy" ADD CONSTRAINT "ShopCatalogProjectionPolicy_variantId_productId_fkey" FOREIGN KEY ("variantId", "productId") REFERENCES "ShopProductVariant"("id", "productId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogProjectionPolicy" ADD CONSTRAINT "ShopCatalogProjectionPolicy_parentProductId_fkey" FOREIGN KEY ("parentProductId") REFERENCES "ShopProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogProjectionPolicy" ADD CONSTRAINT "ShopCatalogProjectionPolicy_parentVariantId_parentProductI_fkey" FOREIGN KEY ("parentVariantId", "parentProductId") REFERENCES "ShopProductVariant"("id", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogProjectionClause" ADD CONSTRAINT "ShopCatalogProjectionClause_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogProjectionClause" ADD CONSTRAINT "ShopCatalogProjectionClause_variantId_productId_fkey" FOREIGN KEY ("variantId", "productId") REFERENCES "ShopProductVariant"("id", "productId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogProjectionClause" ADD CONSTRAINT "ShopCatalogProjectionClause_targetKey_productId_sourceVers_fkey" FOREIGN KEY ("targetKey", "productId", "sourceVersion") REFERENCES "ShopCatalogProjectionPolicy"("targetKey", "productId", "sourceVersion") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogProjectionConstraint" ADD CONSTRAINT "ShopCatalogProjectionConstraint_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogProjectionConstraint" ADD CONSTRAINT "ShopCatalogProjectionConstraint_variantId_productId_fkey" FOREIGN KEY ("variantId", "productId") REFERENCES "ShopProductVariant"("id", "productId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopCatalogProjectionConstraint" ADD CONSTRAINT "ShopCatalogProjectionConstraint_targetKey_clauseKey_produc_fkey" FOREIGN KEY ("targetKey", "clauseKey", "productId", "sourceVersion") REFERENCES "ShopCatalogProjectionClause"("targetKey", "clauseKey", "productId", "sourceVersion") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE FUNCTION catalog_v2_validate_vehicle_configuration_chain() RETURNS trigger AS $$
DECLARE
  generation_make_id TEXT;
  powertrain_make_id TEXT;
BEGIN
  SELECT generation."makeId" INTO generation_make_id
  FROM "VehicleGeneration" generation
  WHERE generation."id" = NEW."generationId";

  IF NEW."powertrainId" IS NOT NULL THEN
    SELECT powertrain."makeId" INTO powertrain_make_id
    FROM "VehiclePowertrain" powertrain
    WHERE powertrain."id" = NEW."powertrainId";
  END IF;

  IF generation_make_id IS NOT NULL
    AND powertrain_make_id IS NOT NULL
    AND generation_make_id <> powertrain_make_id THEN
    RAISE EXCEPTION 'vehicle configuration powertrain make does not match generation make';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "VehicleConfiguration_taxonomy_chain"
  BEFORE INSERT OR UPDATE OF "generationId", "powertrainId" ON "VehicleConfiguration"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_vehicle_configuration_chain();

CREATE FUNCTION catalog_v2_validate_taxonomy_alias_context() RETURNS trigger AS $$
BEGIN
  IF NEW."entityType" = 'MODEL' AND NOT EXISTS (
    SELECT 1 FROM "VehicleModel" model_row
    WHERE model_row."id" = NEW."modelId" AND model_row."makeId" = NEW."parentMakeId"
  ) THEN
    RAISE EXCEPTION 'model alias parent make does not match target model';
  END IF;

  IF NEW."entityType" = 'GENERATION' AND NOT EXISTS (
    SELECT 1 FROM "VehicleGeneration" generation_row
    WHERE generation_row."id" = NEW."generationId"
      AND generation_row."makeId" = NEW."parentMakeId"
      AND generation_row."modelId" = NEW."parentModelId"
  ) THEN
    RAISE EXCEPTION 'generation alias context does not match target generation';
  END IF;

  IF NEW."entityType" = 'POWERTRAIN' AND NOT EXISTS (
    SELECT 1 FROM "VehiclePowertrain" powertrain_row
    WHERE powertrain_row."id" = NEW."powertrainId"
      AND (powertrain_row."makeId" IS NULL OR powertrain_row."makeId" = NEW."parentMakeId")
  ) THEN
    RAISE EXCEPTION 'powertrain alias parent make does not match target powertrain';
  END IF;

  IF NEW."entityType" = 'CONFIGURATION' AND NOT EXISTS (
    SELECT 1
    FROM "VehicleConfiguration" configuration_row
    JOIN "VehicleGeneration" generation_row ON generation_row."id" = configuration_row."generationId"
    WHERE configuration_row."id" = NEW."configurationId"
      AND configuration_row."generationId" = NEW."parentGenerationId"
      AND generation_row."makeId" = NEW."parentMakeId"
      AND generation_row."modelId" = NEW."parentModelId"
  ) THEN
    RAISE EXCEPTION 'configuration alias context does not match target configuration';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "VehicleTaxonomyAlias_context_consistency"
  BEFORE INSERT OR UPDATE ON "VehicleTaxonomyAlias"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_taxonomy_alias_context();

CREATE FUNCTION catalog_v2_validate_source_record_lineage() RETURNS trigger AS $$
DECLARE
  has_cycle BOOLEAN;
BEGIN
  IF NEW."supersedesId" IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM "ShopCatalogSourceRecord" existing
      WHERE existing."sourceId" = NEW."sourceId"
        AND existing."recordKey" = NEW."recordKey"
    ) THEN
      RAISE EXCEPTION 'source record lineage may have only one root';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "ShopCatalogSourceRecord" previous
    WHERE previous."id" = NEW."supersedesId"
      AND previous."sourceId" = NEW."sourceId"
      AND previous."recordKey" = NEW."recordKey"
  ) THEN
    RAISE EXCEPTION 'source record may only supersede the same source and record key';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "ShopCatalogSourceRecord" successor
    WHERE successor."supersedesId" = NEW."supersedesId"
  ) THEN
    RAISE EXCEPTION 'source record must supersede the current lineage tail';
  END IF;

  WITH RECURSIVE lineage AS (
    SELECT previous."id", previous."supersedesId", ARRAY[previous."id"]::TEXT[] AS path
    FROM "ShopCatalogSourceRecord" previous
    WHERE previous."id" = NEW."supersedesId"
    UNION ALL
    SELECT parent."id", parent."supersedesId", lineage.path || parent."id"
    FROM lineage
    JOIN "ShopCatalogSourceRecord" parent ON parent."id" = lineage."supersedesId"
    WHERE NOT parent."id" = ANY(lineage.path)
  )
  SELECT EXISTS (
    SELECT 1 FROM lineage WHERE lineage."id" = NEW."id" OR lineage."supersedesId" = NEW."id"
  ) INTO has_cycle;

  IF has_cycle THEN
    RAISE EXCEPTION 'source record supersession cycle is not allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShopCatalogSourceRecord_lineage"
  BEFORE INSERT ON "ShopCatalogSourceRecord"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_source_record_lineage();

-- Immutable ledger rows retain the original evidence. Resolution/issues and
-- publication rows are intentionally mutable operational state.
CREATE FUNCTION catalog_v2_reject_ledger_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShopCatalogSourceRecord_append_only"
  BEFORE UPDATE OR DELETE ON "ShopCatalogSourceRecord"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_reject_ledger_mutation();
CREATE TRIGGER "ShopCatalogSourceBinding_append_only"
  BEFORE UPDATE OR DELETE ON "ShopCatalogSourceBinding"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_reject_ledger_mutation();
CREATE TRIGGER "ShopCatalogFieldProvenance_append_only"
  BEFORE UPDATE OR DELETE ON "ShopCatalogFieldProvenance"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_reject_ledger_mutation();
CREATE TRIGGER "ShopCatalogProductRevision_append_only"
  BEFORE UPDATE OR DELETE ON "ShopCatalogProductRevision"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_reject_ledger_mutation();

CREATE FUNCTION catalog_v2_reject_cursor_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% cannot be deleted; advance it through its versioned lifecycle', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShopCatalogSourceBindingHead_no_delete"
  BEFORE DELETE ON "ShopCatalogSourceBindingHead"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_reject_cursor_delete();
CREATE TRIGGER "ShopCatalogPublicationReceipt_no_delete"
  BEFORE DELETE ON "ShopCatalogPublicationReceipt"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_reject_cursor_delete();

CREATE FUNCTION catalog_v2_validate_binding_revision() RETURNS trigger AS $$
BEGIN
  IF NEW."bindingVersion" = 1 THEN
    IF NEW."supersedesId" IS NOT NULL THEN
      RAISE EXCEPTION 'binding revision 1 cannot supersede another binding';
    END IF;
  ELSIF NEW."supersedesId" IS NULL OR NOT EXISTS (
    SELECT 1
    FROM "ShopCatalogSourceBinding" previous
    WHERE previous."id" = NEW."supersedesId"
      AND previous."sourceId" = NEW."sourceId"
      AND previous."entityType" = NEW."entityType"
      AND previous."externalKey" = NEW."externalKey"
      AND previous."bindingVersion" = NEW."bindingVersion" - 1
  ) THEN
    RAISE EXCEPTION 'binding revision must supersede the immediately preceding identity revision';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShopCatalogSourceBinding_revision_chain"
  BEFORE INSERT ON "ShopCatalogSourceBinding"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_binding_revision();

CREATE FUNCTION catalog_v2_validate_binding_target() RETURNS trigger AS $$
DECLARE
  target_exists BOOLEAN;
BEGIN
  IF NEW."action" = 'TOMBSTONE' THEN
    RETURN NEW;
  END IF;

  CASE NEW."entityType"
    -- Product and variant existence/ownership is enforced by the typed foreign
    -- keys declared below; every other resolver target needs an explicit typed
    -- existence check because canonicalEntityId is intentionally polymorphic.
    WHEN 'PRODUCT' THEN target_exists := true;
    WHEN 'VARIANT' THEN target_exists := true;
    WHEN 'BRAND' THEN
      SELECT EXISTS (
        SELECT 1 FROM "ShopBrand" target WHERE target."id" = NEW."canonicalEntityId"
      ) INTO target_exists;
    WHEN 'VEHICLE_MAKE' THEN
      SELECT EXISTS (
        SELECT 1 FROM "VehicleMake" target WHERE target."id" = NEW."canonicalEntityId"
      ) INTO target_exists;
    WHEN 'VEHICLE_MODEL' THEN
      SELECT EXISTS (
        SELECT 1 FROM "VehicleModel" target WHERE target."id" = NEW."canonicalEntityId"
      ) INTO target_exists;
    WHEN 'VEHICLE_GENERATION' THEN
      SELECT EXISTS (
        SELECT 1 FROM "VehicleGeneration" target WHERE target."id" = NEW."canonicalEntityId"
      ) INTO target_exists;
    WHEN 'VEHICLE_POWERTRAIN' THEN
      SELECT EXISTS (
        SELECT 1 FROM "VehiclePowertrain" target WHERE target."id" = NEW."canonicalEntityId"
      ) INTO target_exists;
    WHEN 'VEHICLE_CONFIGURATION' THEN
      SELECT EXISTS (
        SELECT 1 FROM "VehicleConfiguration" target WHERE target."id" = NEW."canonicalEntityId"
      ) INTO target_exists;
  END CASE;

  IF NOT target_exists THEN
    RAISE EXCEPTION 'binding canonicalEntityId does not identify an existing % target', NEW."entityType";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShopCatalogSourceBinding_target_exists"
  BEFORE INSERT ON "ShopCatalogSourceBinding"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_binding_target();

CREATE FUNCTION catalog_v2_restrict_bound_target_identity_change() RETURNS trigger AS $$
DECLARE
  binding_entity_type "ShopCatalogEntityType" := TG_ARGV[0]::"ShopCatalogEntityType";
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."id" = OLD."id" THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM "ShopCatalogSourceBinding" binding
    WHERE binding."action" = 'MAP'
      AND binding."entityType" = binding_entity_type
      AND binding."canonicalEntityId" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'cannot change or delete % identity % while immutable source bindings reference it', binding_entity_type, OLD."id";
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShopBrand_bound_identity_restrict"
  BEFORE UPDATE OF "id" OR DELETE ON "ShopBrand"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_restrict_bound_target_identity_change('BRAND');
CREATE TRIGGER "VehicleMake_bound_identity_restrict"
  BEFORE UPDATE OF "id" OR DELETE ON "VehicleMake"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_restrict_bound_target_identity_change('VEHICLE_MAKE');
CREATE TRIGGER "VehicleModel_bound_identity_restrict"
  BEFORE UPDATE OF "id" OR DELETE ON "VehicleModel"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_restrict_bound_target_identity_change('VEHICLE_MODEL');
CREATE TRIGGER "VehicleGeneration_bound_identity_restrict"
  BEFORE UPDATE OF "id" OR DELETE ON "VehicleGeneration"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_restrict_bound_target_identity_change('VEHICLE_GENERATION');
CREATE TRIGGER "VehiclePowertrain_bound_identity_restrict"
  BEFORE UPDATE OF "id" OR DELETE ON "VehiclePowertrain"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_restrict_bound_target_identity_change('VEHICLE_POWERTRAIN');
CREATE TRIGGER "VehicleConfiguration_bound_identity_restrict"
  BEFORE UPDATE OF "id" OR DELETE ON "VehicleConfiguration"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_restrict_bound_target_identity_change('VEHICLE_CONFIGURATION');

CREATE FUNCTION catalog_v2_validate_binding_head() RETURNS trigger AS $$
DECLARE
  current_version INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW."sourceId" IS DISTINCT FROM OLD."sourceId"
    OR NEW."entityType" IS DISTINCT FROM OLD."entityType"
    OR NEW."externalKey" IS DISTINCT FROM OLD."externalKey"
  ) THEN
    RAISE EXCEPTION 'binding head identity is immutable';
  END IF;

  SELECT binding."bindingVersion" INTO current_version
  FROM "ShopCatalogSourceBinding" binding
  WHERE binding."id" = NEW."currentBindingId"
    AND binding."sourceId" = NEW."sourceId"
    AND binding."entityType" = NEW."entityType"
    AND binding."externalKey" = NEW."externalKey";

  IF current_version IS NULL OR EXISTS (
    SELECT 1 FROM "ShopCatalogSourceBinding" newer
    WHERE newer."sourceId" = NEW."sourceId"
      AND newer."entityType" = NEW."entityType"
      AND newer."externalKey" = NEW."externalKey"
      AND newer."bindingVersion" > current_version
  ) THEN
    RAISE EXCEPTION 'binding head must reference the latest identity revision';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShopCatalogSourceBindingHead_latest_revision"
  BEFORE INSERT OR UPDATE ON "ShopCatalogSourceBindingHead"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_binding_head();

CREATE FUNCTION catalog_v2_require_binding_head_at_commit() RETURNS trigger AS $$
BEGIN
  -- If several revisions were inserted in one transaction, only the latest one
  -- must be the head. Normal writers append exactly one revision per identity.
  IF NOT EXISTS (
    SELECT 1 FROM "ShopCatalogSourceBinding" newer
    WHERE newer."sourceId" = NEW."sourceId"
      AND newer."entityType" = NEW."entityType"
      AND newer."externalKey" = NEW."externalKey"
      AND newer."bindingVersion" > NEW."bindingVersion"
  ) AND NOT EXISTS (
    SELECT 1 FROM "ShopCatalogSourceBindingHead" head
    WHERE head."sourceId" = NEW."sourceId"
      AND head."entityType" = NEW."entityType"
      AND head."externalKey" = NEW."externalKey"
      AND head."currentBindingId" = NEW."id"
  ) THEN
    RAISE EXCEPTION 'latest binding revision must become head in the same transaction';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "ShopCatalogSourceBinding_requires_head"
  AFTER INSERT ON "ShopCatalogSourceBinding"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_require_binding_head_at_commit();

-- Every redundant product/variant pair must identify the real variant owner.
CREATE FUNCTION catalog_v2_validate_variant_owner() RETURNS trigger AS $$
BEGIN
  IF NEW."variantId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "ShopProductVariant" variant
    WHERE variant."id" = NEW."variantId"
      AND variant."productId" = NEW."productId"
  ) THEN
    RAISE EXCEPTION 'variant % does not belong to product %', NEW."variantId", NEW."productId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShopCatalogSourceRecord_variant_owner"
  BEFORE INSERT OR UPDATE OF "productId", "variantId" ON "ShopCatalogSourceRecord"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_variant_owner();
CREATE TRIGGER "ShopCatalogSourceBinding_variant_owner"
  BEFORE INSERT OR UPDATE OF "productId", "variantId" ON "ShopCatalogSourceBinding"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_variant_owner();
CREATE TRIGGER "ShopCatalogFieldProvenance_variant_owner"
  BEFORE INSERT OR UPDATE OF "productId", "variantId" ON "ShopCatalogFieldProvenance"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_variant_owner();
CREATE TRIGGER "ShopCatalogNormalizationIssue_variant_owner"
  BEFORE INSERT OR UPDATE OF "productId", "variantId" ON "ShopCatalogNormalizationIssue"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_variant_owner();
CREATE TRIGGER "ShopCatalogCompatibilityPolicy_variant_owner"
  BEFORE INSERT OR UPDATE OF "productId", "variantId" ON "ShopCatalogCompatibilityPolicy"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_variant_owner();
CREATE TRIGGER "ShopCatalogProjectionSku_variant_owner"
  BEFORE INSERT OR UPDATE OF "productId", "variantId" ON "ShopCatalogProjectionSku"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_variant_owner();
CREATE TRIGGER "ShopCatalogProjectionPolicy_variant_owner"
  BEFORE INSERT OR UPDATE OF "productId", "variantId" ON "ShopCatalogProjectionPolicy"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_variant_owner();
CREATE TRIGGER "ShopCatalogProjectionClause_variant_owner"
  BEFORE INSERT OR UPDATE OF "productId", "variantId" ON "ShopCatalogProjectionClause"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_variant_owner();
CREATE TRIGGER "ShopCatalogProjectionConstraint_variant_owner"
  BEFORE INSERT OR UPDATE OF "productId", "variantId" ON "ShopCatalogProjectionConstraint"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_variant_owner();

-- Unresolved engine strings are evidence, not canonical exact powertrains. They
-- may only live under a NEEDS_REVIEW clause until a source-aware alias resolves
-- them to VehiclePowertrain.
CREATE FUNCTION catalog_v2_validate_engine_text_value() RETURNS trigger AS $$
BEGIN
  IF NEW."dimension" = 'ENGINE' AND NEW."textValue" IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM "ShopCatalogCompatibilityConstraint" constraint_row
    JOIN "ShopCatalogCompatibilityClause" clause_row ON clause_row."id" = constraint_row."clauseId"
    WHERE constraint_row."id" = NEW."constraintId"
      AND clause_row."verification" = 'NEEDS_REVIEW'
  ) THEN
    RAISE EXCEPTION 'unresolved ENGINE text requires a NEEDS_REVIEW clause';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShopCatalogCompatibilityValue_engine_text_review"
  BEFORE INSERT OR UPDATE OF "constraintId", "dimension", "textValue" ON "ShopCatalogCompatibilityValue"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_engine_text_value();

CREATE FUNCTION catalog_v2_validate_clause_verification() RETURNS trigger AS $$
BEGIN
  IF NEW."verification" = 'VERIFIED' AND EXISTS (
    SELECT 1 FROM "ShopCatalogCompatibilityPolicy" policy
    WHERE policy."id" = NEW."policyId" AND policy."mode" = 'NEEDS_REVIEW'
  ) THEN
    RAISE EXCEPTION 'NEEDS_REVIEW policy cannot contain VERIFIED clauses';
  END IF;

  IF NEW."verification" <> 'NEEDS_REVIEW' AND EXISTS (
    SELECT 1
    FROM "ShopCatalogCompatibilityConstraint" constraint_row
    JOIN "ShopCatalogCompatibilityValue" value_row ON value_row."constraintId" = constraint_row."id"
    WHERE constraint_row."clauseId" = NEW."id"
      AND constraint_row."dimension" = 'ENGINE'
      AND value_row."textValue" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'unresolved ENGINE text cannot be promoted beyond NEEDS_REVIEW';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShopCatalogCompatibilityClause_verification_guard"
  BEFORE INSERT OR UPDATE OF "policyId", "verification" ON "ShopCatalogCompatibilityClause"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_clause_verification();

CREATE FUNCTION catalog_v2_validate_policy_review_mode() RETURNS trigger AS $$
BEGIN
  IF NEW."mode" = 'NEEDS_REVIEW' AND EXISTS (
    SELECT 1 FROM "ShopCatalogCompatibilityClause" clause_row
    WHERE clause_row."policyId" = NEW."id" AND clause_row."verification" = 'VERIFIED'
  ) THEN
    RAISE EXCEPTION 'NEEDS_REVIEW policy cannot contain VERIFIED clauses';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShopCatalogCompatibilityPolicy_review_mode_guard"
  BEFORE UPDATE OF "mode" ON "ShopCatalogCompatibilityPolicy"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_policy_review_mode();

CREATE FUNCTION catalog_v2_validate_projection_clause() RETURNS trigger AS $$
BEGIN
  IF NEW."verification" = 'VERIFIED' AND EXISTS (
    SELECT 1 FROM "ShopCatalogProjectionPolicy" policy
    WHERE policy."targetKey" = NEW."targetKey"
      AND policy."productId" = NEW."productId"
      AND policy."sourceVersion" = NEW."sourceVersion"
      AND policy."mode" = 'NEEDS_REVIEW'
  ) THEN
    RAISE EXCEPTION 'projected NEEDS_REVIEW policy cannot contain VERIFIED clauses';
  END IF;

  IF NEW."verification" <> 'NEEDS_REVIEW' AND EXISTS (
    SELECT 1 FROM "ShopCatalogProjectionConstraint" constraint_row
    WHERE constraint_row."targetKey" = NEW."targetKey"
      AND constraint_row."clauseKey" = NEW."clauseKey"
      AND constraint_row."productId" = NEW."productId"
      AND constraint_row."sourceVersion" = NEW."sourceVersion"
      AND constraint_row."dimension" = 'ENGINE'
      AND constraint_row."textValue" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'projected unresolved ENGINE text cannot be promoted beyond NEEDS_REVIEW';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShopCatalogProjectionClause_verification_guard"
  BEFORE INSERT OR UPDATE OF "targetKey", "productId", "sourceVersion", "verification" ON "ShopCatalogProjectionClause"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_projection_clause();

CREATE FUNCTION catalog_v2_validate_projection_constraint_review() RETURNS trigger AS $$
BEGIN
  IF NEW."dimension" = 'ENGINE' AND NEW."textValue" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "ShopCatalogProjectionClause" clause_row
    WHERE clause_row."targetKey" = NEW."targetKey"
      AND clause_row."clauseKey" = NEW."clauseKey"
      AND clause_row."productId" = NEW."productId"
      AND clause_row."sourceVersion" = NEW."sourceVersion"
      AND clause_row."verification" = 'NEEDS_REVIEW'
  ) THEN
    RAISE EXCEPTION 'projected unresolved ENGINE text requires NEEDS_REVIEW';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShopCatalogProjectionConstraint_engine_text_review"
  BEFORE INSERT OR UPDATE OF "targetKey", "clauseKey", "productId", "sourceVersion", "dimension", "textValue" ON "ShopCatalogProjectionConstraint"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_projection_constraint_review();

CREATE FUNCTION catalog_v2_validate_projection_policy_review_mode() RETURNS trigger AS $$
BEGIN
  IF NEW."mode" = 'NEEDS_REVIEW' AND EXISTS (
    SELECT 1 FROM "ShopCatalogProjectionClause" clause_row
    WHERE clause_row."targetKey" = NEW."targetKey"
      AND clause_row."productId" = NEW."productId"
      AND clause_row."sourceVersion" = NEW."sourceVersion"
      AND clause_row."verification" = 'VERIFIED'
  ) THEN
    RAISE EXCEPTION 'projected NEEDS_REVIEW policy cannot contain VERIFIED clauses';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShopCatalogProjectionPolicy_review_mode_guard"
  BEFORE UPDATE OF "mode" ON "ShopCatalogProjectionPolicy"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_projection_policy_review_mode();

-- Event identity and immutable revision semantics survive retries. Only lease,
-- attempts, availability, status, error, and processed timestamps are mutable.
CREATE FUNCTION catalog_v2_reject_outbox_event_mutation() RETURNS trigger AS $$
BEGIN
  IF ROW(
    NEW."dedupeKey",
    NEW."entityType",
    NEW."entityId",
    NEW."productId",
    NEW."revisionId",
    NEW."canonicalVersion",
    NEW."changeDomains",
    NEW."payload",
    NEW."createdAt"
  ) IS DISTINCT FROM ROW(
    OLD."dedupeKey",
    OLD."entityType",
    OLD."entityId",
    OLD."productId",
    OLD."revisionId",
    OLD."canonicalVersion",
    OLD."changeDomains",
    OLD."payload",
    OLD."createdAt"
  ) THEN
    RAISE EXCEPTION 'catalog outbox event identity, revision, domains, and payload are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShopCatalogOutbox_event_immutable"
  BEFORE UPDATE ON "ShopCatalogOutbox"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_reject_outbox_event_mutation();

CREATE FUNCTION catalog_v2_validate_outbox_revision_domains_at_commit() RETURNS trigger AS $$
DECLARE
  event_domains "ShopCatalogChangeDomain"[];
  revision_domains "ShopCatalogChangeDomain"[];
BEGIN
  IF NEW."entityType" <> 'PRODUCT' THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(DISTINCT changed.domain ORDER BY changed.domain)
  INTO event_domains
  FROM unnest(NEW."changeDomains") AS changed(domain);

  SELECT array_agg(DISTINCT changed.domain ORDER BY changed.domain)
  INTO revision_domains
  FROM "ShopCatalogProductRevision" revision
  CROSS JOIN LATERAL unnest(revision."changeDomains") AS changed(domain)
  WHERE revision."id" = NEW."revisionId"
    AND revision."productId" = NEW."productId"
    AND revision."version" = NEW."canonicalVersion";

  IF revision_domains IS NULL OR event_domains IS DISTINCT FROM revision_domains THEN
    RAISE EXCEPTION 'PRODUCT outbox changeDomains must equal its immutable revision changeDomains';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "ShopCatalogOutbox_revision_domains"
  AFTER INSERT OR UPDATE ON "ShopCatalogOutbox"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_outbox_revision_domains_at_commit();

-- Receipts are the authoritative per-target publication cursor. Stale workers
-- may no-op through a conditional UPDATE, but the database rejects regression.
CREATE FUNCTION catalog_v2_enforce_receipt_monotonicity() RETURNS trigger AS $$
BEGIN
  IF NEW."appliedVersion" < OLD."appliedVersion" THEN
    RAISE EXCEPTION 'publication receipt appliedVersion cannot regress';
  END IF;
  IF NEW."processingVersion" IS NOT NULL AND NEW."processingVersion" <= OLD."appliedVersion" THEN
    RAISE EXCEPTION 'publication receipt processingVersion must be newer than appliedVersion';
  END IF;
  IF NEW."failedVersion" IS NOT NULL AND NEW."failedVersion" <= OLD."appliedVersion" THEN
    RAISE EXCEPTION 'publication receipt failedVersion must be newer than appliedVersion';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShopCatalogPublicationReceipt_monotonic"
  BEFORE UPDATE OF "appliedVersion", "processingVersion", "failedVersion" ON "ShopCatalogPublicationReceipt"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_enforce_receipt_monotonicity();

CREATE FUNCTION catalog_v2_validate_receipt_product_version() RETURNS trigger AS $$
DECLARE
  current_version BIGINT;
BEGIN
  IF NEW."entityType" <> 'PRODUCT' THEN
    RETURN NEW;
  END IF;

  SELECT product."catalogVersion" INTO current_version
  FROM "ShopProduct" product
  WHERE product."id" = NEW."productId";

  IF current_version IS NULL
    OR NEW."appliedVersion" > current_version
    OR (NEW."processingVersion" IS NOT NULL AND NEW."processingVersion" > current_version)
    OR (NEW."failedVersion" IS NOT NULL AND NEW."failedVersion" > current_version) THEN
    RAISE EXCEPTION 'publication receipt version cannot exceed product catalogVersion';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShopCatalogPublicationReceipt_product_version"
  BEFORE INSERT OR UPDATE OF "productId", "entityType", "appliedVersion", "processingVersion", "failedVersion" ON "ShopCatalogPublicationReceipt"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_receipt_product_version();

CREATE FUNCTION catalog_v2_enforce_projection_monotonicity() RETURNS trigger AS $$
BEGIN
  IF NEW."projectionVersion" < OLD."projectionVersion" THEN
    RAISE EXCEPTION 'catalog projectionVersion cannot regress';
  END IF;
  IF NEW."projectionVersion" = OLD."projectionVersion"
    AND NEW."contentHash" IS DISTINCT FROM OLD."contentHash" THEN
    RAISE EXCEPTION 'equal catalog projectionVersion cannot carry a different contentHash';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShopCatalogProjection_monotonic"
  BEFORE UPDATE ON "ShopCatalogProjection"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_enforce_projection_monotonicity();

CREATE FUNCTION catalog_v2_validate_revision_version_at_commit() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "ShopProduct" product
    WHERE product."id" = NEW."productId" AND product."catalogVersion" >= NEW."version"
  ) THEN
    RAISE EXCEPTION 'catalog revision version cannot exceed product catalogVersion';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "ShopCatalogProductRevision_product_version"
  AFTER INSERT ON "ShopCatalogProductRevision"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_revision_version_at_commit();

-- Keep the database publication aggregate aligned with the executable
-- change-domain contract. A product version only waits for consumers whose
-- projections can actually be affected by that immutable revision.
CREATE FUNCTION catalog_v2_required_projection_targets(
  changed_domains "ShopCatalogChangeDomain"[]
) RETURNS "ShopCatalogProjectionTarget"[] AS $$
  SELECT COALESCE(
    array_agg(DISTINCT mapping.target::"ShopCatalogProjectionTarget" ORDER BY mapping.target::"ShopCatalogProjectionTarget"),
    ARRAY[]::"ShopCatalogProjectionTarget"[]
  )
  FROM unnest(changed_domains) AS changed(domain)
  JOIN (
    VALUES
      ('CONTENT', 'CONTENT'),
      ('CONTENT', 'SEARCH'),
      ('SEO', 'CONTENT'),
      ('SEO', 'SEARCH'),
      ('MEDIA', 'CONTENT'),
      ('MEDIA', 'SEARCH'),
      ('PRICE', 'PRICE'),
      ('INVENTORY', 'INVENTORY'),
      ('FITMENT', 'SEARCH'),
      ('TAXONOMY', 'SEARCH'),
      ('VISIBILITY', 'CONTENT'),
      ('VISIBILITY', 'SEARCH'),
      ('SETTINGS', 'SETTINGS')
  ) AS mapping(domain, target)
    ON mapping.domain = changed.domain::TEXT;
$$ LANGUAGE SQL IMMUTABLE STRICT;

CREATE FUNCTION catalog_v2_enforce_product_version_monotonicity() RETURNS trigger AS $$
BEGIN
  IF NEW."catalogVersion" < OLD."catalogVersion"
    OR NEW."publishedCatalogVersion" < OLD."publishedCatalogVersion" THEN
    RAISE EXCEPTION 'product catalog versions cannot regress';
  END IF;

  IF NEW."publishedCatalogVersion" > OLD."publishedCatalogVersion" AND NOT EXISTS (
    SELECT 1
    FROM "ShopCatalogProductRevision" revision
    WHERE revision."productId" = NEW."id"
      AND revision."version" = NEW."publishedCatalogVersion"
      AND NOT EXISTS (
        SELECT required_target.target
        FROM unnest(catalog_v2_required_projection_targets(revision."changeDomains"))
          AS required_target(target)
        WHERE NOT EXISTS (
          SELECT 1 FROM "ShopCatalogPublicationReceipt" receipt
          WHERE receipt."entityType" = 'PRODUCT'
            AND receipt."entityId" = NEW."id"
            AND receipt."target" = required_target.target
            AND receipt."appliedVersion" >= NEW."publishedCatalogVersion"
        )
      )
  ) THEN
    RAISE EXCEPTION 'publishedCatalogVersion requires its revision and change-domain target receipts';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShopProduct_catalog_versions_monotonic"
  BEFORE UPDATE OF "catalogVersion", "publishedCatalogVersion" ON "ShopProduct"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_enforce_product_version_monotonicity();

-- EXACT constraints may receive values later in the same transaction, but may
-- never commit empty. Non-EXACT constraints cannot own values because the
-- composite FK above pins every value to parent state EXACT.
CREATE FUNCTION catalog_v2_assert_exact_constraint_values(checked_id TEXT) RETURNS void AS $$
BEGIN
  IF checked_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM "ShopCatalogCompatibilityConstraint" constraint_row
    WHERE constraint_row."id" = checked_id
      AND constraint_row."state" = 'EXACT'
      AND NOT EXISTS (
        SELECT 1 FROM "ShopCatalogCompatibilityValue" value_row
        WHERE value_row."constraintId" = constraint_row."id"
      )
  ) THEN
    RAISE EXCEPTION 'EXACT compatibility constraint % requires at least one value', checked_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION catalog_v2_validate_constraint_values_from_constraint() RETURNS trigger AS $$
BEGIN
  PERFORM catalog_v2_assert_exact_constraint_values(NEW."id");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION catalog_v2_validate_constraint_values_from_value() RETURNS trigger AS $$
BEGIN
  PERFORM catalog_v2_assert_exact_constraint_values(OLD."constraintId");
  IF TG_OP = 'UPDATE' AND NEW."constraintId" IS DISTINCT FROM OLD."constraintId" THEN
    PERFORM catalog_v2_assert_exact_constraint_values(NEW."constraintId");
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "ShopCatalogCompatibilityConstraint_exact_values"
  AFTER INSERT OR UPDATE OF "state" ON "ShopCatalogCompatibilityConstraint"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_constraint_values_from_constraint();
CREATE CONSTRAINT TRIGGER "ShopCatalogCompatibilityValue_exact_values"
  AFTER DELETE OR UPDATE OF "constraintId" ON "ShopCatalogCompatibilityValue"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_validate_constraint_values_from_value();
