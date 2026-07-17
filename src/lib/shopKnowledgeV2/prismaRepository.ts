import {
  Prisma,
  ShopKnowledgeOutboxStatus,
  ShopKnowledgeSource,
  ShopKnowledgeStatus,
  ShopKnowledgeVerificationStatus,
  ShopProductAttributeValueType,
  type PrismaClient,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { SHOP_KNOWLEDGE_CHUNK_EMBEDDING_MODEL } from "@/lib/shopKnowledgeV2/embeddings";
import { stableStringify, hashKnowledgeValue } from "@/lib/shopKnowledgeV2/hash";
import { StaleKnowledgeCommitError } from "@/lib/shopKnowledgeV2/indexer";
import type {
  ClaimKnowledgeOutboxInput,
  ClaimKnowledgeOutboxJobByIdInput,
  RetryKnowledgeOutboxInput,
  ShopKnowledgeV2Repository,
} from "@/lib/shopKnowledgeV2/indexer";
import {
  mapShopKnowledgeSourceProduct,
  shopKnowledgeSourceSelect,
} from "@/lib/shopKnowledgeV2/source";
import {
  SHOP_KNOWLEDGE_V2_EXTRACTOR_VERSION,
  type KnowledgeAttributeValue,
  type KnowledgeConfidence,
  type KnowledgeEvidenceSource,
  type KnowledgeIndexCommit,
  type ShopProductAttributeDraft,
} from "@/lib/shopKnowledgeV2/types";

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(stableStringify(value)) as Prisma.InputJsonValue;
}

function sourceEnum(source: KnowledgeEvidenceSource): ShopKnowledgeSource {
  switch (source) {
    case "manager":
      return ShopKnowledgeSource.MANAGER;
    case "manual_fitment":
      return ShopKnowledgeSource.MANUAL_OVERRIDE;
    case "supplier":
      return ShopKnowledgeSource.SUPPLIER;
    case "category_adapter":
      return ShopKnowledgeSource.CATEGORY_ADAPTER;
    case "description_extraction":
      return ShopKnowledgeSource.DESCRIPTION_EXTRACTION;
  }
}

function confidenceNumber(confidence: KnowledgeConfidence): number {
  switch (confidence) {
    case "verified":
      return 1;
    case "high":
      return 0.9;
    case "medium":
      return 0.65;
    case "low":
      return 0.35;
    case "unknown":
      return 0;
  }
}

function verificationEnum(
  value: "verified" | "inferred" | "needs_review"
): ShopKnowledgeVerificationStatus {
  if (value === "verified") return ShopKnowledgeVerificationStatus.VERIFIED;
  if (value === "needs_review") return ShopKnowledgeVerificationStatus.NEEDS_REVIEW;
  return ShopKnowledgeVerificationStatus.EXTRACTED;
}

function attributeValueType(attribute: ShopProductAttributeDraft): ShopProductAttributeValueType {
  switch (attribute.valueType) {
    case "number":
      return ShopProductAttributeValueType.NUMBER;
    case "boolean":
      return ShopProductAttributeValueType.BOOLEAN;
    case "string_list":
      return ShopProductAttributeValueType.JSON;
    case "string":
      return ShopProductAttributeValueType.TEXT;
  }
}

function attributeUnit(key: string): string | null {
  if (key.endsWith("Mm")) return "mm";
  if (key.endsWith("In")) return "in";
  if (key.endsWith("Kg")) return "kg";
  if (key.endsWith("Hp")) return "hp";
  if (key.endsWith("Nm")) return "Nm";
  return null;
}

function normalizedAttributeValue(value: KnowledgeAttributeValue): string {
  return (Array.isArray(value) ? value.join("|") : String(value)).trim().toLowerCase();
}

function typedAttributeColumns(value: KnowledgeAttributeValue) {
  return {
    valueText: typeof value === "string" ? value : null,
    valueNumber: typeof value === "number" ? new Prisma.Decimal(value) : null,
    valueBoolean: typeof value === "boolean" ? value : null,
    valueJson: Array.isArray(value) ? jsonValue(value) : Prisma.JsonNull,
  };
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function numericAttribute(attributes: ShopProductAttributeDraft[], key: string): number | null {
  const value = attributes.find((attribute) => attribute.key === key)?.value;
  return typeof value === "number" ? Math.round(value) : null;
}

function stringAttribute(attributes: ShopProductAttributeDraft[], key: string): string | null {
  const value = attributes.find((attribute) => attribute.key === key)?.value;
  return typeof value === "string" ? value : null;
}

async function persistKnowledgeBuild(tx: Prisma.TransactionClient, input: KnowledgeIndexCommit) {
  const { build, revision, previous, indexedAt } = input;
  const [sourceClock] = await tx.$queryRaw<Array<{ sourceUpdatedAt: Date }>>`
    SELECT GREATEST(
      product."updatedAt",
      COALESCE((SELECT MAX(variant."updatedAt") FROM "ShopProductVariant" variant WHERE variant."productId" = product."id"), product."updatedAt"),
      COALESCE((SELECT MAX(option."updatedAt") FROM "ShopProductOption" option WHERE option."productId" = product."id"), product."updatedAt"),
      COALESCE((SELECT MAX(metafield."updatedAt") FROM "ShopProductMetafield" metafield WHERE metafield."productId" = product."id"), product."updatedAt"),
      COALESCE((
        SELECT MAX(application."updatedAt")
        FROM "ShopVehicleApplication" application
        WHERE application."productId" = product."id"
          AND application."isActive" = true
          AND application."source" = 'MANAGER'
      ), product."updatedAt"),
      COALESCE((
        SELECT MAX(evidence."updatedAt")
        FROM "ShopKnowledgeEvidence" evidence
        WHERE evidence."productId" = product."id"
          AND evidence."isActive" = true
          AND evidence."source" = 'MANAGER'
      ), product."updatedAt")
    ) AS "sourceUpdatedAt"
    FROM "ShopProduct" product
    WHERE product."id" = ${build.productId}
    FOR UPDATE OF product
  `;
  if (!sourceClock || sourceClock.sourceUpdatedAt.getTime() !== build.sourceUpdatedAt.getTime()) {
    throw new StaleKnowledgeCommitError(build.productId);
  }

  const lockedCurrent = await tx.shopProductKnowledge.findUnique({
    where: { productId: build.productId },
    select: { revision: true },
  });
  if (
    (previous === null && lockedCurrent !== null) ||
    (previous !== null && lockedCurrent?.revision !== previous.revision)
  ) {
    throw new StaleKnowledgeCommitError(build.productId);
  }

  const knowledge = await tx.shopProductKnowledge.upsert({
    where: { productId: build.productId },
    create: {
      productId: build.productId,
      schemaVersion: build.schemaVersion,
      revision,
      activeRevision: 0,
      status: ShopKnowledgeStatus.PROCESSING,
      completenessScore: build.completenessScore,
      qualityFlags: build.qualityFlags,
      sourceUpdatedAt: build.sourceUpdatedAt,
      statusChangedAt: indexedAt,
      vehicleType: "unknown",
      searchText: build.searchText,
      contentHash: build.contentHash,
      indexedAt,
    },
    update: {
      schemaVersion: build.schemaVersion,
      revision,
      status: ShopKnowledgeStatus.PROCESSING,
      completenessScore: build.completenessScore,
      qualityFlags: build.qualityFlags,
      sourceUpdatedAt: build.sourceUpdatedAt,
      statusChangedAt: indexedAt,
      failedAt: null,
      failureReason: null,
    },
    select: { id: true, activeRevision: true, status: true },
  });

  const existingChunks = await tx.shopKnowledgeChunk.findMany({
    where: { knowledgeId: knowledge.id, isActive: true },
    select: { chunkKey: true, contentHash: true, embeddingModel: true },
  });
  const variantKnowledgeIdByVariantId = new Map<string, string>();
  for (const variant of build.variants) {
    const variantKnowledge = await tx.shopVariantKnowledge.upsert({
      where: {
        knowledgeId_variantId_revision: {
          knowledgeId: knowledge.id,
          variantId: variant.variantId,
          revision,
        },
      },
      create: {
        knowledgeId: knowledge.id,
        productId: build.productId,
        variantId: variant.variantId,
        sku: variant.sku,
        optionValues: jsonValue(variant.optionValues),
        facts: jsonValue({
          title: variant.title,
          position: variant.position,
          attributes: variant.attributes,
        }),
        searchText: variant.searchText,
        contentHash: variant.contentHash,
        schemaVersion: build.schemaVersion,
        revision,
        status: ShopKnowledgeStatus.PROCESSING,
        completenessScore: build.completenessScore,
        qualityFlags: build.qualityFlags,
        isActive: false,
        sourceUpdatedAt: build.sourceUpdatedAt,
        indexedAt,
        readyAt: null,
      },
      update: {
        knowledgeId: knowledge.id,
        productId: build.productId,
        sku: variant.sku,
        optionValues: jsonValue(variant.optionValues),
        facts: jsonValue({
          title: variant.title,
          position: variant.position,
          attributes: variant.attributes,
        }),
        searchText: variant.searchText,
        contentHash: variant.contentHash,
        schemaVersion: build.schemaVersion,
        revision,
        status: ShopKnowledgeStatus.PROCESSING,
        completenessScore: build.completenessScore,
        qualityFlags: build.qualityFlags,
        isActive: false,
        sourceUpdatedAt: build.sourceUpdatedAt,
        indexedAt,
        readyAt: null,
      },
      select: { id: true },
    });
    variantKnowledgeIdByVariantId.set(variant.variantId, variantKnowledge.id);
  }

  const applicationIdByEvidenceKey = new Map<string, string>();
  for (const application of build.applications) {
    const persisted = await tx.shopVehicleApplication.upsert({
      where: {
        applicationKey_revision: {
          applicationKey: application.applicationKey,
          revision,
        },
      },
      create: {
        applicationKey: application.applicationKey,
        knowledgeId: knowledge.id,
        productId: build.productId,
        variantId: application.variantId,
        variantKnowledgeId: application.variantId
          ? variantKnowledgeIdByVariantId.get(application.variantId)
          : null,
        scope: application.scope,
        make: application.make,
        model: application.model,
        generation: application.generation,
        chassisCode: application.chassisCode,
        yearFrom: application.yearFrom,
        yearTo: application.yearTo,
        engine: application.engine,
        fuel: application.fuel,
        bodyStyle: application.bodyStyle,
        drivetrain: application.drivetrain,
        transmission: application.transmission,
        market: application.market,
        opfGpf: application.opfGpf,
        categoryGroup: application.categoryGroup,
        productKind: application.productKind,
        material: application.material,
        isUniversal: application.isUniversal,
        verificationStatus: verificationEnum(application.fitmentStatus),
        source: sourceEnum(application.source),
        sourcePriority: application.sourcePriority,
        confidence: confidenceNumber(application.confidence),
        revision,
        isActive: false,
        verifiedById:
          application.source === "manager"
            ? build.evidence.find((item) => item.evidenceKey === application.evidenceKey)
                ?.verifiedBy
            : null,
        verifiedAt:
          build.evidence.find((item) => item.evidenceKey === application.evidenceKey)?.verifiedAt ??
          null,
      },
      update: {
        knowledgeId: knowledge.id,
        productId: build.productId,
        variantId: application.variantId,
        variantKnowledgeId: application.variantId
          ? variantKnowledgeIdByVariantId.get(application.variantId)
          : null,
        scope: application.scope,
        make: application.make,
        model: application.model,
        generation: application.generation,
        chassisCode: application.chassisCode,
        yearFrom: application.yearFrom,
        yearTo: application.yearTo,
        engine: application.engine,
        fuel: application.fuel,
        bodyStyle: application.bodyStyle,
        drivetrain: application.drivetrain,
        transmission: application.transmission,
        market: application.market,
        opfGpf: application.opfGpf,
        categoryGroup: application.categoryGroup,
        productKind: application.productKind,
        material: application.material,
        isUniversal: application.isUniversal,
        verificationStatus: verificationEnum(application.fitmentStatus),
        source: sourceEnum(application.source),
        sourcePriority: application.sourcePriority,
        confidence: confidenceNumber(application.confidence),
        revision,
        isActive: false,
        verifiedById:
          application.source === "manager"
            ? build.evidence.find((item) => item.evidenceKey === application.evidenceKey)
                ?.verifiedBy
            : null,
        verifiedAt:
          build.evidence.find((item) => item.evidenceKey === application.evidenceKey)?.verifiedAt ??
          null,
      },
      select: { id: true },
    });
    applicationIdByEvidenceKey.set(application.evidenceKey, persisted.id);
  }

  for (const chunk of build.chunks) {
    const persistedChunk = await tx.shopKnowledgeChunk.upsert({
      where: {
        chunkKey_revision: {
          chunkKey: chunk.chunkKey,
          revision,
        },
      },
      create: {
        chunkKey: chunk.chunkKey,
        knowledgeId: knowledge.id,
        productId: build.productId,
        variantKnowledgeId: chunk.variantId
          ? variantKnowledgeIdByVariantId.get(chunk.variantId)
          : null,
        locale: chunk.locale,
        sourceField:
          chunk.sourceOrdinal > 0
            ? `${chunk.sourceField}#${chunk.sourceOrdinal}`
            : chunk.sourceField,
        ordinal: chunk.ordinal,
        content: chunk.content,
        contentHash: chunk.contentHash,
        tokenCount: chunk.tokenCount,
        revision,
        isActive: false,
      },
      update: {
        knowledgeId: knowledge.id,
        productId: build.productId,
        variantKnowledgeId: chunk.variantId
          ? variantKnowledgeIdByVariantId.get(chunk.variantId)
          : null,
        locale: chunk.locale,
        sourceField:
          chunk.sourceOrdinal > 0
            ? `${chunk.sourceField}#${chunk.sourceOrdinal}`
            : chunk.sourceField,
        ordinal: chunk.ordinal,
        content: chunk.content,
        contentHash: chunk.contentHash,
        tokenCount: chunk.tokenCount,
        revision,
        isActive: false,
      },
      select: { id: true },
    });
    const previousChunk = existingChunks.find(
      (candidate) =>
        candidate.chunkKey === chunk.chunkKey &&
        candidate.contentHash === chunk.contentHash &&
        candidate.embeddingModel ===
          (process.env.SHOP_AI_EMBEDDING_MODEL || SHOP_KNOWLEDGE_CHUNK_EMBEDDING_MODEL)
    );
    if (previousChunk) {
      await tx.$executeRaw`
        UPDATE "ShopKnowledgeChunk" pending
        SET
          "embedding" = active."embedding",
          "embeddingModel" = active."embeddingModel",
          "embeddedAt" = active."embeddedAt"
        FROM "ShopKnowledgeChunk" active
        WHERE pending."id" = ${persistedChunk.id}
          AND active."knowledgeId" = ${knowledge.id}
          AND active."chunkKey" = ${chunk.chunkKey}
          AND active."contentHash" = ${chunk.contentHash}
          AND active."isActive" = true
          AND active."embeddingModel" = ${
            process.env.SHOP_AI_EMBEDDING_MODEL || SHOP_KNOWLEDGE_CHUNK_EMBEDDING_MODEL
          }
          AND active."embedding" IS NOT NULL
      `;
    }
  }

  const allAttributes = [
    ...build.attributes.map((attribute) => ({ attribute, variantId: null })),
    ...build.variants.flatMap((variant) =>
      variant.attributes.map((attribute) => ({ attribute, variantId: variant.variantId }))
    ),
  ];
  const attributeKeys = uniqueStrings(allAttributes.map((item) => item.attribute.key));
  const existingDefinitions = await tx.shopProductAttributeDefinition.findMany({
    where: { key: { in: attributeKeys } },
    select: {
      id: true,
      key: true,
      categoryGroups: true,
      isHardConstraint: true,
      isRequired: true,
    },
  });
  const existingDefinitionByKey = new Map(
    existingDefinitions.map((definition) => [definition.key, definition] as const)
  );
  const attributeValueIdByEvidenceKey = new Map<string, string>();
  for (const item of allAttributes) {
    const existingDefinition = existingDefinitionByKey.get(item.attribute.key);
    const definition = await tx.shopProductAttributeDefinition.upsert({
      where: { key: item.attribute.key },
      create: {
        key: item.attribute.key,
        nameUa: item.attribute.key,
        nameEn: item.attribute.key,
        categoryGroups: [build.categoryGroup],
        valueType: attributeValueType(item.attribute),
        unit: attributeUnit(item.attribute.key),
        allowedValues: [],
        aliases: {},
        isHardConstraint: item.attribute.isHard,
        isFilterable: item.attribute.isHard,
        isRequired: item.attribute.isHard,
        schemaVersion: build.schemaVersion,
      },
      update: {
        categoryGroups: Array.from(
          new Set([...(existingDefinition?.categoryGroups ?? []), build.categoryGroup])
        ),
        isHardConstraint: (existingDefinition?.isHardConstraint ?? false) || item.attribute.isHard,
        isFilterable: (existingDefinition?.isHardConstraint ?? false) || item.attribute.isHard,
        isRequired: (existingDefinition?.isRequired ?? false) || item.attribute.isHard,
        schemaVersion: build.schemaVersion,
      },
      select: { id: true },
    });
    const valueKey = hashKnowledgeValue({
      productId: build.productId,
      variantId: item.variantId,
      key: item.attribute.key,
    });
    const columns = typedAttributeColumns(item.attribute.value);
    const value = await tx.shopProductAttributeValue.upsert({
      where: { valueKey_revision: { valueKey, revision } },
      create: {
        valueKey,
        definitionId: definition.id,
        knowledgeId: knowledge.id,
        productId: build.productId,
        variantId: item.variantId,
        variantKnowledgeId: item.variantId
          ? variantKnowledgeIdByVariantId.get(item.variantId)
          : null,
        ...columns,
        normalizedValue: normalizedAttributeValue(item.attribute.value),
        unit: attributeUnit(item.attribute.key),
        source: sourceEnum(item.attribute.source),
        verificationStatus: ShopKnowledgeVerificationStatus.EXTRACTED,
        confidence: confidenceNumber(item.attribute.confidence),
        revision,
        isActive: false,
      },
      update: {
        definitionId: definition.id,
        knowledgeId: knowledge.id,
        productId: build.productId,
        variantId: item.variantId,
        variantKnowledgeId: item.variantId
          ? variantKnowledgeIdByVariantId.get(item.variantId)
          : null,
        ...columns,
        normalizedValue: normalizedAttributeValue(item.attribute.value),
        unit: attributeUnit(item.attribute.key),
        source: sourceEnum(item.attribute.source),
        verificationStatus: ShopKnowledgeVerificationStatus.EXTRACTED,
        confidence: confidenceNumber(item.attribute.confidence),
        revision,
        isActive: false,
      },
      select: { id: true },
    });
    attributeValueIdByEvidenceKey.set(item.attribute.evidenceKey, value.id);
  }

  for (const evidence of build.evidence) {
    await tx.shopKnowledgeEvidence.upsert({
      where: {
        evidenceKey_revision: {
          evidenceKey: evidence.evidenceKey,
          revision,
        },
      },
      create: {
        evidenceKey: evidence.evidenceKey,
        knowledgeId: knowledge.id,
        productId: build.productId,
        variantKnowledgeId: evidence.variantId
          ? variantKnowledgeIdByVariantId.get(evidence.variantId)
          : null,
        vehicleApplicationId: applicationIdByEvidenceKey.get(evidence.evidenceKey),
        attributeValueId: attributeValueIdByEvidenceKey.get(evidence.evidenceKey),
        fieldPath: evidence.fieldPath,
        source: sourceEnum(evidence.source),
        sourceRef: evidence.sourceRef ?? `${evidence.locale}:${evidence.sourceField}`,
        excerpt: evidence.excerpt,
        sourceHash: evidence.sourceHash,
        confidence: confidenceNumber(evidence.confidence),
        extractorVersion: evidence.extractorVersion ?? SHOP_KNOWLEDGE_V2_EXTRACTOR_VERSION,
        isManagerVerified: evidence.isManagerVerified ?? evidence.source === "manager",
        verifiedById: evidence.verifiedBy,
        verifiedAt: evidence.verifiedAt,
        revision,
        isActive: false,
      },
      update: {
        knowledgeId: knowledge.id,
        productId: build.productId,
        variantKnowledgeId: evidence.variantId
          ? variantKnowledgeIdByVariantId.get(evidence.variantId)
          : null,
        vehicleApplicationId: applicationIdByEvidenceKey.get(evidence.evidenceKey),
        attributeValueId: attributeValueIdByEvidenceKey.get(evidence.evidenceKey),
        fieldPath: evidence.fieldPath,
        source: sourceEnum(evidence.source),
        sourceRef: evidence.sourceRef ?? `${evidence.locale}:${evidence.sourceField}`,
        excerpt: evidence.excerpt,
        sourceHash: evidence.sourceHash,
        confidence: confidenceNumber(evidence.confidence),
        extractorVersion: evidence.extractorVersion ?? SHOP_KNOWLEDGE_V2_EXTRACTOR_VERSION,
        isManagerVerified: evidence.isManagerVerified ?? evidence.source === "manager",
        verifiedById: evidence.verifiedBy,
        verifiedAt: evidence.verifiedAt,
        revision,
        isActive: false,
      },
    });
  }

  const activeApplications = build.applications;
  const legacyYearRanges = Array.from(
    new Map(
      activeApplications
        .filter((application) => application.yearFrom !== null)
        .map((application) => [
          `${application.yearFrom}:${application.yearTo ?? "open"}`,
          { from: application.yearFrom, to: application.yearTo },
        ])
    ).values()
  );
  const fitmentStatus =
    activeApplications.length === 0 ||
    activeApplications.some((application) => application.fitmentStatus === "needs_review")
      ? "needs_review"
      : activeApplications.every((application) => application.fitmentStatus === "verified")
        ? "verified"
        : "inferred";
  const fitmentSource =
    activeApplications[0]?.source === "manager" ||
    activeApplications[0]?.source === "manual_fitment"
      ? "manual"
      : activeApplications[0]?.source === "supplier"
        ? "import"
        : "automatic";
  const knowledgeProjection = {
    schemaVersion: build.schemaVersion,
    completenessScore: build.completenessScore,
    qualityFlags: build.qualityFlags,
    sourceUpdatedAt: build.sourceUpdatedAt.toISOString(),
    vehicleType:
      activeApplications[0]?.vehicleType ??
      (build.categoryGroup === "motoCarbon" ? "motorcycle" : "unknown"),
    makes: uniqueStrings(activeApplications.map((application) => application.make)),
    models: uniqueStrings(activeApplications.map((application) => application.model)),
    chassisCodes: uniqueStrings(activeApplications.map((application) => application.chassisCode)),
    yearRanges: legacyYearRanges,
    engines: uniqueStrings(activeApplications.map((application) => application.engine)),
    bodyStyles: uniqueStrings(activeApplications.map((application) => application.bodyStyle)),
    markets: uniqueStrings(activeApplications.map((application) => application.market)),
    categoryGroup: build.categoryGroup,
    powerGainHp: numericAttribute(build.attributes, "powerGainHp"),
    torqueGainNm: numericAttribute(build.attributes, "torqueGainNm"),
    material: stringAttribute(build.attributes, "material"),
    opfGpf: stringAttribute(build.attributes, "opfGpf"),
    installationType: stringAttribute(build.attributes, "installationType"),
    fitmentStatus,
    fitmentSource,
    applications: activeApplications,
    facts: {
      productKind: stringAttribute(build.attributes, "productKind"),
      opfGpf: stringAttribute(build.attributes, "opfGpf"),
      material: stringAttribute(build.attributes, "material"),
      installationType: stringAttribute(build.attributes, "installationType"),
      powerGainHp: numericAttribute(build.attributes, "powerGainHp"),
      torqueGainNm: numericAttribute(build.attributes, "torqueGainNm"),
      engine: stringAttribute(build.attributes, "engine"),
      fuel: stringAttribute(build.attributes, "fuel"),
      attributes: build.attributes,
      variants: build.variants.map((variant) => ({
        variantId: variant.variantId,
        sku: variant.sku,
        contentHash: variant.contentHash,
      })),
    },
    searchText: build.searchText,
    contentHash: build.contentHash,
  };
  const revisionSnapshot = {
    contentHash: build.contentHash,
    schemaVersion: build.schemaVersion,
    extractorVersion: build.extractorVersion,
    targetStatus: build.status,
    status: build.status,
    completenessScore: build.completenessScore,
    qualityFlags: build.qualityFlags,
    categoryGroup: build.categoryGroup,
    expectedCounts: {
      applications: build.applications.length,
      variants: build.variants.length,
      chunks: build.chunks.length,
      attributes: allAttributes.length,
      evidence: build.evidence.length,
    },
    knowledgeProjection,
    applications: build.applications,
    variants: build.variants,
    chunks: build.chunks,
    attributes: allAttributes,
    evidence: build.evidence,
  };
  await tx.shopKnowledgeRevision.create({
    data: {
      knowledgeId: knowledge.id,
      productId: build.productId,
      revision,
      schemaVersion: build.schemaVersion,
      status: ShopKnowledgeStatus.PROCESSING,
      changeType: previous ? "REINDEXED" : "CREATED",
      source: ShopKnowledgeSource.CATEGORY_ADAPTER,
      snapshot: jsonValue(revisionSnapshot),
      diff: previous
        ? jsonValue({
            previousContentHash: previous.contentHash,
            contentHash: build.contentHash,
          })
        : Prisma.JsonNull,
      activatedAt: null,
    },
  });

  await tx.shopProductKnowledge.update({
    where: { id: knowledge.id },
    data:
      knowledge.activeRevision > 0
        ? {
            revision,
            sourceUpdatedAt: build.sourceUpdatedAt,
            indexedAt,
          }
        : {
            ...knowledgeProjection,
            sourceUpdatedAt: build.sourceUpdatedAt,
            yearRanges: jsonValue(legacyYearRanges),
            applications: jsonValue(activeApplications),
            facts: jsonValue(knowledgeProjection.facts),
            revision,
            status: ShopKnowledgeStatus.PROCESSING,
            statusChangedAt: indexedAt,
            readyAt: null,
            failedAt: null,
            failureReason: null,
            embeddingModel: null,
            indexedAt,
          },
  });

  if (build.status === ShopKnowledgeStatus.NEEDS_REVIEW) {
    const existingReview = await tx.shopKnowledgeReviewTask.findFirst({
      where: {
        knowledgeId: knowledge.id,
        taskType: "INDEX_QUALITY",
        status: { in: ["OPEN", "IN_REVIEW"] },
      },
      select: { id: true },
    });
    const reviewDetails = jsonValue({
      revision,
      completenessScore: build.completenessScore,
      categoryGroup: build.categoryGroup,
    });
    const priority = build.qualityFlags.some((flag) => flag === "missing_fitment")
      ? "HIGH"
      : "MEDIUM";
    if (existingReview) {
      await tx.shopKnowledgeReviewTask.update({
        where: { id: existingReview.id },
        data: {
          details: reviewDetails,
          reasonCodes: build.qualityFlags,
          priority,
        },
      });
    } else {
      await tx.shopKnowledgeReviewTask.create({
        data: {
          knowledgeId: knowledge.id,
          productId: build.productId,
          taskType: "INDEX_QUALITY",
          title: "Knowledge V2 requires review",
          details: reviewDetails,
          reasonCodes: build.qualityFlags,
          priority,
        },
      });
    }
  } else {
    await tx.shopKnowledgeReviewTask.updateMany({
      where: {
        knowledgeId: knowledge.id,
        taskType: "INDEX_QUALITY",
        status: { in: ["OPEN", "IN_REVIEW"] },
      },
      data: {
        status: "RESOLVED",
        resolvedAt: indexedAt,
        resolution: jsonValue({ type: "automatic_reindex", revision }),
      },
    });
  }
}

class PrismaShopKnowledgeV2Repository implements ShopKnowledgeV2Repository {
  constructor(private readonly client: PrismaClient) {}

  async loadSourceProduct(productId: string) {
    const row = await this.client.shopProduct.findUnique({
      where: { id: productId },
      select: shopKnowledgeSourceSelect,
    });
    return row ? mapShopKnowledgeSourceProduct(row) : null;
  }

  async getCurrentKnowledge(productId: string) {
    return this.client.shopProductKnowledge
      .findUnique({
        where: { productId },
        select: {
          id: true,
          productId: true,
          revision: true,
          activeRevision: true,
          contentHash: true,
          status: true,
          revisions: {
            orderBy: { revision: "desc" },
            take: 1,
            select: { revision: true, status: true, snapshot: true },
          },
        },
      })
      .then((record) =>
        record
          ? {
              knowledgeId: record.id,
              productId: record.productId,
              revision: record.revisions[0]?.revision ?? record.revision,
              activeRevision: record.activeRevision,
              contentHash:
                typeof record.revisions[0]?.snapshot === "object" &&
                record.revisions[0]?.snapshot !== null &&
                !Array.isArray(record.revisions[0]?.snapshot) &&
                typeof (record.revisions[0].snapshot as Record<string, unknown>).contentHash ===
                  "string"
                  ? ((record.revisions[0].snapshot as Record<string, unknown>)
                      .contentHash as string)
                  : record.contentHash,
              status: record.revisions[0]?.status ?? record.status,
            }
          : null
      );
  }

  async touchKnowledgeSource(productId: string, sourceUpdatedAt: Date, checkedAt: Date) {
    await this.client.shopProductKnowledge.updateMany({
      where: { productId },
      data: {
        sourceUpdatedAt,
        indexedAt: checkedAt,
      },
    });
  }

  async commitKnowledgeIndex(input: KnowledgeIndexCommit) {
    await this.client.$transaction((tx) => persistKnowledgeBuild(tx, input), {
      maxWait: 10_000,
      timeout: 60_000,
    });
  }

  async claimOutboxJobs(input: ClaimKnowledgeOutboxInput) {
    return this.client.$transaction(async (tx) => {
      const availableWhere: Prisma.ShopKnowledgeOutboxWhereInput = {
        OR: [
          {
            status: {
              in: [ShopKnowledgeOutboxStatus.PENDING, ShopKnowledgeOutboxStatus.RETRY],
            },
            availableAt: { lte: input.now },
          },
          {
            status: ShopKnowledgeOutboxStatus.PROCESSING,
            lockedAt: { lt: input.staleBefore },
          },
        ],
      };
      const candidates = await tx.shopKnowledgeOutbox.findMany({
        where: availableWhere,
        orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
        take: input.limit,
        select: { id: true },
      });
      if (candidates.length === 0) return [];
      const ids = candidates.map((candidate) => candidate.id);
      await tx.shopKnowledgeOutbox.updateMany({
        where: { id: { in: ids }, ...availableWhere },
        data: {
          status: ShopKnowledgeOutboxStatus.PROCESSING,
          lockedAt: input.now,
          lockedBy: input.workerId,
          attempts: { increment: 1 },
        },
      });
      return tx.shopKnowledgeOutbox.findMany({
        where: {
          id: { in: ids },
          status: ShopKnowledgeOutboxStatus.PROCESSING,
          lockedBy: input.workerId,
          lockedAt: input.now,
        },
        orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          productId: true,
          dedupeKey: true,
          status: true,
          attempts: true,
          maxAttempts: true,
          lockedBy: true,
        },
      });
    });
  }

  async claimOutboxJobById(input: ClaimKnowledgeOutboxJobByIdInput) {
    return this.client.$transaction(async (tx) => {
      const availableWhere: Prisma.ShopKnowledgeOutboxWhereInput = {
        id: input.jobId,
        OR: [
          {
            status: {
              in: [ShopKnowledgeOutboxStatus.PENDING, ShopKnowledgeOutboxStatus.RETRY],
            },
            availableAt: { lte: input.now },
          },
          {
            status: ShopKnowledgeOutboxStatus.PROCESSING,
            lockedAt: { lt: input.staleBefore },
          },
        ],
      };
      const claimed = await tx.shopKnowledgeOutbox.updateMany({
        where: availableWhere,
        data: {
          status: ShopKnowledgeOutboxStatus.PROCESSING,
          lockedAt: input.now,
          lockedBy: input.workerId,
          attempts: { increment: 1 },
        },
      });
      if (claimed.count !== 1) return null;
      return tx.shopKnowledgeOutbox.findFirst({
        where: {
          id: input.jobId,
          status: ShopKnowledgeOutboxStatus.PROCESSING,
          lockedBy: input.workerId,
          lockedAt: input.now,
        },
        select: {
          id: true,
          productId: true,
          dedupeKey: true,
          status: true,
          attempts: true,
          maxAttempts: true,
          lockedBy: true,
        },
      });
    });
  }

  async completeOutboxJob(jobId: string, processedAt: Date, workerId?: string) {
    await this.client.shopKnowledgeOutbox.updateMany({
      where: {
        id: jobId,
        status: ShopKnowledgeOutboxStatus.PROCESSING,
        ...(workerId ? { lockedBy: workerId } : {}),
      },
      data: {
        status: ShopKnowledgeOutboxStatus.COMPLETED,
        processedAt,
        lockedAt: null,
        lockedBy: null,
        lastError: null,
      },
    });
  }

  async retryOutboxJob(input: RetryKnowledgeOutboxInput) {
    await this.client.shopKnowledgeOutbox.updateMany({
      where: {
        id: input.jobId,
        status: ShopKnowledgeOutboxStatus.PROCESSING,
        ...(input.workerId ? { lockedBy: input.workerId } : {}),
      },
      data: {
        status: ShopKnowledgeOutboxStatus.RETRY,
        attempts: input.attempts,
        availableAt: input.availableAt,
        lockedAt: null,
        lockedBy: null,
        lastError: input.error,
      },
    });
  }

  async deadLetterOutboxJob(jobId: string, error: string, attempts: number, workerId?: string) {
    await this.client.$transaction(async (tx) => {
      const updated = await tx.shopKnowledgeOutbox.updateMany({
        where: {
          id: jobId,
          status: ShopKnowledgeOutboxStatus.PROCESSING,
          ...(workerId ? { lockedBy: workerId } : {}),
        },
        data: {
          status: ShopKnowledgeOutboxStatus.DEAD_LETTER,
          attempts,
          lockedAt: null,
          lockedBy: null,
          lastError: error,
        },
      });
      if (updated.count === 0) return;

      const job = await tx.shopKnowledgeOutbox.findUnique({
        where: { id: jobId },
        select: { knowledgeId: true, productId: true },
      });
      if (!job?.knowledgeId) return;

      const existingReview = await tx.shopKnowledgeReviewTask.findFirst({
        where: {
          knowledgeId: job.knowledgeId,
          taskType: "INDEX_DEAD_LETTER",
          status: { in: ["OPEN", "IN_REVIEW"] },
        },
        select: { id: true },
      });
      const details = jsonValue({ jobId, attempts, error });
      if (existingReview) {
        await tx.shopKnowledgeReviewTask.update({
          where: { id: existingReview.id },
          data: {
            priority: "CRITICAL",
            details,
            reasonCodes: ["index_dead_letter"],
          },
        });
        return;
      }
      await tx.shopKnowledgeReviewTask.create({
        data: {
          knowledgeId: job.knowledgeId,
          productId: job.productId,
          taskType: "INDEX_DEAD_LETTER",
          title: "Knowledge V2 indexing failed",
          priority: "CRITICAL",
          details,
          reasonCodes: ["index_dead_letter"],
        },
      });
    });
  }
}

export function createPrismaShopKnowledgeV2Repository(
  client: PrismaClient = prisma
): ShopKnowledgeV2Repository {
  return new PrismaShopKnowledgeV2Repository(client);
}
