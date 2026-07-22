import "server-only";

import { Prisma, type PrismaClient } from "@prisma/client";

import type { AdminSession } from "@/lib/adminAuth";
import {
  nextOneAiQualityRevision,
  OneAiQualityRevisionConflictError,
  parseOneAiQualityUndoSnapshot,
  type OneAiQualityApplicationInput,
  type OneAiQualityMutationInput,
  type OneAiQualityUndoApplication,
  type OneAiQualityUndoSnapshot,
} from "@/lib/admin/oneAiQualityMutation";
import { writeAdminAuditLog } from "@/lib/adminRbac";
import { bumpShopKnowledgeCatalogState } from "@/lib/shopKnowledgeV2/catalogState";
import { hashKnowledgeValue } from "@/lib/shopKnowledgeV2/hash";
import {
  NORMALIZED_FITMENT_KEY,
  NORMALIZED_FITMENT_NAMESPACE,
  normalizeManualFitment,
} from "@/lib/shopFitmentQuality";

export class OneAiQualityProductNotFoundError extends Error {
  constructor() {
    super("ONE_AI_QUALITY_PRODUCT_NOT_FOUND");
    this.name = "OneAiQualityProductNotFoundError";
  }
}

export class OneAiQualityKnowledgeMissingError extends Error {
  constructor() {
    super("ONE_AI_QUALITY_KNOWLEDGE_MISSING");
    this.name = "OneAiQualityKnowledgeMissingError";
  }
}

export class OneAiQualityReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OneAiQualityReferenceError";
  }
}

type TransactionClient = Prisma.TransactionClient;

type ActiveApplication = {
  id: string;
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
};

type UndoTargetRevision = {
  id: string;
  revision: number;
  status: string;
  state: OneAiQualityUndoSnapshot;
};

const UNDO_CONTROLLED_QUALITY_FLAGS = new Set([
  "manager_draft",
  "missing_fitment",
  "fitment_needs_review",
  "needs_source",
  "blocked_strict:manager",
]);

const detailSelect = Prisma.validator<Prisma.ShopProductSelect>()({
  id: true,
  slug: true,
  sku: true,
  scope: true,
  brand: true,
  titleUa: true,
  titleEn: true,
  categoryUa: true,
  categoryEn: true,
  shortDescUa: true,
  shortDescEn: true,
  longDescUa: true,
  longDescEn: true,
  bodyHtmlUa: true,
  bodyHtmlEn: true,
  tags: true,
  isPublished: true,
  status: true,
  updatedAt: true,
  variants: {
    orderBy: [{ position: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      sku: true,
      position: true,
      option1Value: true,
      option2Value: true,
      option3Value: true,
      inventoryQty: true,
      updatedAt: true,
      knowledge: {
        select: {
          id: true,
          status: true,
          revision: true,
          contentHash: true,
          qualityFlags: true,
          facts: true,
          isActive: true,
          indexedAt: true,
        },
      },
    },
  },
  knowledge: {
    select: {
      id: true,
      schemaVersion: true,
      revision: true,
      activeRevision: true,
      status: true,
      completenessScore: true,
      qualityFlags: true,
      sourceUpdatedAt: true,
      statusChangedAt: true,
      readyAt: true,
      failedAt: true,
      failureReason: true,
      categoryGroup: true,
      fitmentStatus: true,
      fitmentSource: true,
      facts: true,
      contentHash: true,
      embeddingModel: true,
      indexedAt: true,
      updatedAt: true,
      vehicleApplications: {
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
        take: 100,
        select: {
          id: true,
          applicationKey: true,
          variantId: true,
          scope: true,
          make: true,
          model: true,
          generation: true,
          chassisCode: true,
          yearFrom: true,
          yearTo: true,
          engine: true,
          fuel: true,
          bodyStyle: true,
          drivetrain: true,
          transmission: true,
          market: true,
          opfGpf: true,
          categoryGroup: true,
          productKind: true,
          material: true,
          isUniversal: true,
          verificationStatus: true,
          source: true,
          sourcePriority: true,
          confidence: true,
          revision: true,
          isActive: true,
          verifiedById: true,
          verifiedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      attributeValues: {
        where: { isActive: true },
        orderBy: [{ definition: { sortOrder: "asc" } }, { createdAt: "asc" }],
        take: 200,
        select: {
          id: true,
          variantId: true,
          valueText: true,
          valueNumber: true,
          valueBoolean: true,
          valueJson: true,
          normalizedValue: true,
          unit: true,
          source: true,
          verificationStatus: true,
          confidence: true,
          revision: true,
          definition: {
            select: {
              id: true,
              key: true,
              nameUa: true,
              nameEn: true,
              valueType: true,
              isHardConstraint: true,
              isRequired: true,
              isFilterable: true,
            },
          },
        },
      },
      evidence: {
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
        take: 100,
        select: {
          id: true,
          fieldPath: true,
          source: true,
          sourceRef: true,
          excerpt: true,
          sourceHash: true,
          confidence: true,
          extractorVersion: true,
          isManagerVerified: true,
          verifiedById: true,
          verifiedAt: true,
          revision: true,
          isActive: true,
          vehicleApplicationId: true,
          attributeValueId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      revisions: {
        orderBy: { revision: "desc" },
        take: 30,
        select: {
          id: true,
          revision: true,
          schemaVersion: true,
          status: true,
          changeType: true,
          source: true,
          snapshot: true,
          diff: true,
          reason: true,
          changedById: true,
          activatedAt: true,
          createdAt: true,
        },
      },
      reviewTasks: {
        orderBy: [{ status: "asc" }, { priority: "asc" }, { createdAt: "desc" }],
        take: 50,
        select: {
          id: true,
          taskType: true,
          status: true,
          priority: true,
          title: true,
          details: true,
          reasonCodes: true,
          assignedToId: true,
          resolution: true,
          dueAt: true,
          resolvedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      _count: {
        select: {
          chunks: true,
          variantKnowledge: true,
          vehicleApplications: true,
          attributeValues: true,
          evidence: true,
          reviewTasks: true,
        },
      },
    },
  },
});

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function qualityFlagsForAction(
  current: string[],
  action: OneAiQualityMutationInput["action"]
) {
  const flags = new Set(current);
  if (action === "save_draft") flags.add("manager_draft");
  if (action === "needs_source") flags.add("needs_source");
  if (action === "block_strict") flags.add("blocked_strict:manager");
  if (action === "verify_and_reindex" || action === "mark_universal") {
    flags.delete("manager_draft");
    flags.delete("missing_fitment");
    flags.delete("fitment_needs_review");
    flags.delete("needs_source");
    flags.delete("blocked_strict:manager");
  }
  return Array.from(flags).sort();
}

function qualityFlagsForUndo(current: string[], target: OneAiQualityUndoSnapshot) {
  const flags = new Set(current.filter((flag) => !UNDO_CONTROLLED_QUALITY_FLAGS.has(flag)));
  for (const flag of target.qualityFlags) {
    if (UNDO_CONTROLLED_QUALITY_FLAGS.has(flag)) flags.add(flag);
  }
  if (target.strictBlocked) {
    flags.add("blocked_strict:manager");
  } else {
    flags.delete("blocked_strict:manager");
  }
  return Array.from(flags).sort();
}

export function knowledgeStatusForAction(
  action: OneAiQualityMutationInput["action"],
  qualityFlags: string[]
) {
  if (action === "block_strict") return "BLOCKED" as const;
  if (action === "save_draft" || action === "needs_source") {
    return "NEEDS_REVIEW" as const;
  }
  return qualityFlags.length ? ("NEEDS_REVIEW" as const) : ("READY" as const);
}

function knowledgeStatusForUndo(target: OneAiQualityUndoSnapshot, qualityFlags: string[]) {
  if (target.strictBlocked) return "BLOCKED" as const;
  if (target.status === "NEEDS_REVIEW" || qualityFlags.length > 0) {
    return "NEEDS_REVIEW" as const;
  }
  return "READY" as const;
}

function applicationSnapshot(application: ActiveApplication) {
  return {
    id: application.id,
    variantId: application.variantId,
    vehicleType: application.isUniversal
      ? "universal"
      : application.scope === "moto"
        ? "motorcycle"
        : "car",
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
    verificationStatus: application.verificationStatus,
    source: application.source,
    sourcePriority: application.sourcePriority,
    confidence: application.confidence,
    revision: application.revision,
    isActive: application.isActive,
  };
}

function toJson(value: unknown) {
  return value as Prisma.InputJsonValue;
}

async function findActorId(tx: TransactionClient, session: AdminSession) {
  const actor = await tx.adminUser.findUnique({
    where: { email: session.email },
    select: { id: true },
  });
  return actor?.id ?? null;
}

async function validateApplicationReferences(
  tx: TransactionClient,
  productId: string,
  input: OneAiQualityApplicationInput
) {
  if (input.applicationId) {
    const application = await tx.shopVehicleApplication.findFirst({
      where: { id: input.applicationId, productId },
      select: { id: true },
    });
    if (!application) {
      throw new OneAiQualityReferenceError("The application does not belong to this product");
    }
  }

  if (!input.variantId) return null;
  const variant = await tx.shopProductVariant.findFirst({
    where: { id: input.variantId, productId },
    select: {
      id: true,
      knowledge: {
        where: { isActive: true },
        orderBy: { revision: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });
  if (!variant) {
    throw new OneAiQualityReferenceError("The variant does not belong to this product");
  }
  return variant.knowledge[0]?.id ?? null;
}

async function resolveUndoTargetRevision(
  tx: TransactionClient,
  input: OneAiQualityMutationInput,
  productId: string,
  knowledgeId: string,
  expectedScope: "auto" | "moto"
): Promise<UndoTargetRevision> {
  const target = await tx.shopKnowledgeRevision.findFirst({
    where: {
      knowledgeId,
      productId,
      ...(input.targetRevisionId
        ? { id: input.targetRevisionId }
        : { revision: input.targetRevision ?? -1 }),
    },
    select: {
      id: true,
      revision: true,
      status: true,
      snapshot: true,
    },
  });
  if (!target) {
    throw new OneAiQualityReferenceError("The target revision does not belong to this product");
  }
  if (target.revision >= input.expectedRevision) {
    throw new OneAiQualityReferenceError(
      "Undo target must be a prior revision of the current product state"
    );
  }

  const parsed = parseOneAiQualityUndoSnapshot(target.snapshot, productId);
  if (!parsed.ok) {
    throw new OneAiQualityReferenceError(parsed.error);
  }
  if (parsed.value.applications.some((application) => application.scope !== expectedScope)) {
    throw new OneAiQualityReferenceError(
      `Undo snapshot scope must match product scope ${expectedScope}`
    );
  }
  return {
    id: target.id,
    revision: target.revision,
    status: target.status,
    state: parsed.value,
  };
}

async function loadVariantKnowledgeIds(
  tx: TransactionClient,
  productId: string,
  applications: OneAiQualityUndoApplication[]
) {
  const variantIds = uniqueStrings(applications.map((application) => application.variantId));
  if (variantIds.length === 0) return new Map<string, string | null>();
  const variants = await tx.shopProductVariant.findMany({
    where: {
      productId,
      id: { in: variantIds },
    },
    select: {
      id: true,
      knowledge: {
        where: { isActive: true },
        orderBy: { revision: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });
  if (variants.length !== variantIds.length) {
    throw new OneAiQualityReferenceError(
      "Undo snapshot references a variant that no longer belongs to this product"
    );
  }
  return new Map(variants.map((variant) => [variant.id, variant.knowledge[0]?.id ?? null]));
}

async function deactivateApplicationEvidence(
  tx: TransactionClient,
  applicationIds: string[],
  revision: number
) {
  if (applicationIds.length === 0) return;
  await tx.shopKnowledgeEvidence.updateMany({
    where: {
      vehicleApplicationId: { in: applicationIds },
      isActive: true,
    },
    data: {
      isActive: false,
      revision,
    },
  });
}

async function deactivateStrictStateEvidence(
  tx: TransactionClient,
  knowledgeId: string,
  revision: number
) {
  await tx.shopKnowledgeEvidence.updateMany({
    where: {
      knowledgeId,
      isActive: true,
      fieldPath: {
        in: ["knowledge.strictMatchingStatus", "knowledge.undo"],
      },
    },
    data: {
      isActive: false,
      revision,
    },
  });
}

async function createApplication(
  tx: TransactionClient,
  input: {
    productId: string;
    knowledgeId: string;
    revision: number;
    action: "save_draft" | "verify_and_reindex";
    application: OneAiQualityApplicationInput;
    categoryGroup: string | null;
    material: string | null;
    variantKnowledgeId: string | null;
    actorId: string | null;
    now: Date;
  }
) {
  const verified = input.action === "verify_and_reindex";
  const identity = {
    productId: input.productId,
    revision: input.revision,
    action: input.action,
    application: input.application,
  };
  return tx.shopVehicleApplication.create({
    data: {
      applicationKey: hashKnowledgeValue(identity),
      knowledgeId: input.knowledgeId,
      productId: input.productId,
      variantId: input.application.variantId,
      variantKnowledgeId: input.variantKnowledgeId,
      scope: input.application.scope,
      make: input.application.make,
      model: input.application.model,
      generation: input.application.generation,
      chassisCode: input.application.chassisCode,
      yearFrom: input.application.yearFrom,
      yearTo: input.application.yearTo,
      engine: input.application.engine,
      fuel: input.application.fuel,
      bodyStyle: input.application.bodyStyle,
      drivetrain: input.application.drivetrain,
      transmission: input.application.transmission,
      market: input.application.market,
      opfGpf: input.application.opfGpf,
      categoryGroup: input.application.categoryGroup ?? input.categoryGroup,
      productKind: input.application.productKind,
      material: input.application.material ?? input.material,
      isUniversal: false,
      verificationStatus: verified ? "VERIFIED" : "NEEDS_REVIEW",
      source: "MANAGER",
      sourcePriority: 1,
      confidence: verified ? 1 : 0.4,
      revision: input.revision,
      isActive: verified,
      verifiedById: verified ? input.actorId : null,
      verifiedAt: verified ? input.now : null,
    },
    select: {
      id: true,
      variantId: true,
      scope: true,
      make: true,
      model: true,
      generation: true,
      chassisCode: true,
      yearFrom: true,
      yearTo: true,
      engine: true,
      fuel: true,
      bodyStyle: true,
      drivetrain: true,
      transmission: true,
      market: true,
      opfGpf: true,
      categoryGroup: true,
      productKind: true,
      material: true,
      isUniversal: true,
      verificationStatus: true,
      source: true,
      sourcePriority: true,
      confidence: true,
      revision: true,
      isActive: true,
    },
  });
}

async function createRestoredApplication(
  tx: TransactionClient,
  input: {
    productId: string;
    knowledgeId: string;
    revision: number;
    targetRevisionId: string;
    targetRevision: number;
    ordinal: number;
    application: OneAiQualityUndoApplication;
    variantKnowledgeId: string | null;
    actorId: string | null;
    now: Date;
  }
) {
  const verified = input.application.verificationStatus === "VERIFIED";
  return tx.shopVehicleApplication.create({
    data: {
      applicationKey: hashKnowledgeValue({
        productId: input.productId,
        action: "undo",
        revision: input.revision,
        targetRevisionId: input.targetRevisionId,
        targetRevision: input.targetRevision,
        ordinal: input.ordinal,
        application: input.application,
      }),
      knowledgeId: input.knowledgeId,
      productId: input.productId,
      variantId: input.application.variantId,
      variantKnowledgeId: input.variantKnowledgeId,
      scope: input.application.scope,
      make: input.application.make,
      model: input.application.model,
      generation: input.application.generation,
      chassisCode: input.application.chassisCode,
      yearFrom: input.application.yearFrom,
      yearTo: input.application.yearTo,
      engine: input.application.engine,
      fuel: input.application.fuel,
      bodyStyle: input.application.bodyStyle,
      drivetrain: input.application.drivetrain,
      transmission: input.application.transmission,
      market: input.application.market,
      opfGpf: input.application.opfGpf,
      categoryGroup: input.application.categoryGroup,
      productKind: input.application.productKind,
      material: input.application.material,
      isUniversal: input.application.isUniversal,
      verificationStatus: input.application.verificationStatus,
      source: "MANAGER",
      sourcePriority: 1,
      confidence: verified ? 1 : 0.4,
      revision: input.revision,
      isActive: true,
      verifiedById: verified ? input.actorId : null,
      verifiedAt: verified ? input.now : null,
    },
    select: {
      id: true,
      variantId: true,
      scope: true,
      make: true,
      model: true,
      generation: true,
      chassisCode: true,
      yearFrom: true,
      yearTo: true,
      engine: true,
      fuel: true,
      bodyStyle: true,
      drivetrain: true,
      transmission: true,
      market: true,
      opfGpf: true,
      categoryGroup: true,
      productKind: true,
      material: true,
      isUniversal: true,
      verificationStatus: true,
      source: true,
      sourcePriority: true,
      confidence: true,
      revision: true,
      isActive: true,
    },
  });
}

async function createUniversalApplication(
  tx: TransactionClient,
  input: {
    productId: string;
    knowledgeId: string;
    revision: number;
    scope: string;
    categoryGroup: string | null;
    productKind: string | null;
    material: string | null;
    actorId: string | null;
    now: Date;
  }
) {
  const identity = {
    productId: input.productId,
    revision: input.revision,
    action: "mark_universal",
  };
  return tx.shopVehicleApplication.create({
    data: {
      applicationKey: hashKnowledgeValue(identity),
      knowledgeId: input.knowledgeId,
      productId: input.productId,
      scope: input.scope === "moto" ? "moto" : "auto",
      categoryGroup: input.categoryGroup,
      productKind: input.productKind,
      material: input.material,
      opfGpf: "unknown",
      isUniversal: true,
      verificationStatus: "VERIFIED",
      source: "MANAGER",
      sourcePriority: 1,
      confidence: 1,
      revision: input.revision,
      isActive: true,
      verifiedById: input.actorId,
      verifiedAt: input.now,
    },
    select: {
      id: true,
      variantId: true,
      scope: true,
      make: true,
      model: true,
      generation: true,
      chassisCode: true,
      yearFrom: true,
      yearTo: true,
      engine: true,
      fuel: true,
      bodyStyle: true,
      drivetrain: true,
      transmission: true,
      market: true,
      opfGpf: true,
      categoryGroup: true,
      productKind: true,
      material: true,
      isUniversal: true,
      verificationStatus: true,
      source: true,
      sourcePriority: true,
      confidence: true,
      revision: true,
      isActive: true,
    },
  });
}

async function loadActiveApplications(tx: TransactionClient, knowledgeId: string) {
  return tx.shopVehicleApplication.findMany({
    where: { knowledgeId, isActive: true },
    orderBy: [{ sourcePriority: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      variantId: true,
      scope: true,
      make: true,
      model: true,
      generation: true,
      chassisCode: true,
      yearFrom: true,
      yearTo: true,
      engine: true,
      fuel: true,
      bodyStyle: true,
      drivetrain: true,
      transmission: true,
      market: true,
      opfGpf: true,
      categoryGroup: true,
      productKind: true,
      material: true,
      isUniversal: true,
      verificationStatus: true,
      source: true,
      sourcePriority: true,
      confidence: true,
      revision: true,
      isActive: true,
    },
  });
}

function normalizedFitmentApplications(applications: ActiveApplication[]) {
  return applications
    .filter((application) => !application.isUniversal && Boolean(application.make))
    .map((application) => ({
      vehicleType: application.scope === "moto" ? ("motorcycle" as const) : ("car" as const),
      make: application.make!,
      models: application.model ? [application.model] : [],
      chassisCodes: application.chassisCode ? [application.chassisCode] : [],
      yearRanges:
        application.yearFrom === null
          ? []
          : [{ from: application.yearFrom, to: application.yearTo }],
      engines: application.engine ? [application.engine] : [],
      bodyStyles: application.bodyStyle ? [application.bodyStyle] : [],
      drivetrains: application.drivetrain ? [application.drivetrain] : [],
      markets: application.market ? [application.market] : [],
    }));
}

async function persistNormalizedFitment(
  tx: TransactionClient,
  input: {
    action: OneAiQualityMutationInput["action"];
    productId: string;
    applications: ActiveApplication[];
    session: AdminSession;
    reason: string | null;
    now: Date;
  }
) {
  if (input.action === "save_draft" || input.action === "block_strict") return false;

  const status =
    input.action === "mark_universal" ||
    (input.action === "undo" &&
      input.applications.length === 1 &&
      input.applications[0].isUniversal)
      ? "universal"
      : input.action === "verify_and_reindex" ||
          (input.action === "undo" &&
            input.applications.length > 0 &&
            input.applications.every(
              (application) => application.verificationStatus === "VERIFIED"
            ))
        ? "verified"
        : "needs_review";
  const eligibleApplications =
    status === "verified"
      ? input.applications.filter(
          (application) =>
            application.verificationStatus === "VERIFIED" &&
            ["MANAGER", "MANUAL_OVERRIDE", "SUPPLIER"].includes(application.source)
        )
      : input.applications;
  const fitmentApplications = normalizedFitmentApplications(eligibleApplications);
  const primary = fitmentApplications[0];
  const normalized = normalizeManualFitment(
    {
      status,
      vehicleType: status === "universal" ? "universal" : (primary?.vehicleType ?? "unknown"),
      make: primary?.make ?? null,
      applications: fitmentApplications,
      note: input.reason,
    },
    input.session.email,
    input.now
  );
  if (!normalized.data) {
    throw new OneAiQualityReferenceError(normalized.errors.join(", "));
  }

  await tx.shopProductMetafield.upsert({
    where: {
      productId_namespace_key: {
        productId: input.productId,
        namespace: NORMALIZED_FITMENT_NAMESPACE,
        key: NORMALIZED_FITMENT_KEY,
      },
    },
    create: {
      productId: input.productId,
      namespace: NORMALIZED_FITMENT_NAMESPACE,
      key: NORMALIZED_FITMENT_KEY,
      value: JSON.stringify(normalized.data),
      valueType: "json",
    },
    update: {
      value: JSON.stringify(normalized.data),
      valueType: "json",
    },
  });
  return true;
}

function fitmentStatusForApplications(
  action: OneAiQualityMutationInput["action"],
  applications: ActiveApplication[],
  previous: string
) {
  if (action === "save_draft") return previous;
  if (action === "block_strict" || action === "needs_source") return "needs_review";
  if (applications.length === 1 && applications[0].isUniversal) return "universal";
  return applications.length > 0 &&
    applications.every((application) => application.verificationStatus === "VERIFIED")
    ? "verified"
    : "needs_review";
}

function applicationEvidenceText(input: OneAiQualityMutationInput) {
  return (
    input.evidence?.excerpt ??
    input.reason ??
    (input.application ? JSON.stringify(input.application) : input.action)
  );
}

export function isOneAiKnowledgeSchemaUnavailable(error: unknown) {
  const code = String((error as { code?: unknown })?.code ?? "");
  const message = String((error as { message?: unknown })?.message ?? "");
  return (
    code === "P2010" ||
    code === "P2021" ||
    code === "P2022" ||
    code === "42P01" ||
    code === "42703" ||
    /ShopProductKnowledge|ShopVehicleApplication|ShopKnowledgeEvidence|does not exist/i.test(
      message
    )
  );
}

export async function getOneAiQualityProductDetail(client: PrismaClient, productId: string) {
  const product = await client.shopProduct.findUnique({
    where: { id: productId },
    select: detailSelect,
  });
  if (!product) throw new OneAiQualityProductNotFoundError();
  return {
    ready: Boolean(product.knowledge && product.knowledge.schemaVersion >= 2),
    product,
  };
}

export async function mutateOneAiQualityProductInTransaction(
  tx: TransactionClient,
  productId: string,
  input: OneAiQualityMutationInput,
  session: AdminSession,
  options: { bumpCatalogState?: boolean } = {}
) {
  const product = await tx.shopProduct.findUnique({
    where: { id: productId },
    select: {
      id: true,
      slug: true,
      scope: true,
      titleUa: true,
      titleEn: true,
      knowledge: {
        select: {
          id: true,
          schemaVersion: true,
          revision: true,
          activeRevision: true,
          status: true,
          completenessScore: true,
          qualityFlags: true,
          categoryGroup: true,
          fitmentStatus: true,
          fitmentSource: true,
          facts: true,
          material: true,
          contentHash: true,
          applications: true,
        },
      },
    },
  });
  if (!product) throw new OneAiQualityProductNotFoundError();
  if (!product.knowledge || product.knowledge.schemaVersion < 2) {
    throw new OneAiQualityKnowledgeMissingError();
  }

  const knowledge = product.knowledge;
  const nextRevision = nextOneAiQualityRevision(knowledge.revision, input.expectedRevision);
  const now = new Date();
  const actorId = await findActorId(tx, session);
  const expectedScope = product.scope === "moto" ? ("moto" as const) : ("auto" as const);
  const undoTarget =
    input.action === "undo"
      ? await resolveUndoTargetRevision(tx, input, productId, knowledge.id, expectedScope)
      : null;
  const qualityFlags = undoTarget
    ? qualityFlagsForUndo(knowledge.qualityFlags, undoTarget.state)
    : qualityFlagsForAction(knowledge.qualityFlags, input.action);
  const nextStatus = undoTarget
    ? knowledgeStatusForUndo(undoTarget.state, qualityFlags)
    : knowledgeStatusForAction(input.action, qualityFlags);
  const optimisticUpdate = await tx.shopProductKnowledge.updateMany({
    where: {
      id: knowledge.id,
      revision: input.expectedRevision,
    },
    data: {
      revision: nextRevision,
      status: nextStatus,
      qualityFlags,
      statusChangedAt: now,
      readyAt: nextStatus === "READY" || nextStatus === "NEEDS_REVIEW" ? now : null,
      failedAt: null,
      failureReason: null,
    },
  });
  if (optimisticUpdate.count !== 1) {
    const current = await tx.shopProductKnowledge.findUnique({
      where: { id: knowledge.id },
      select: { revision: true },
    });
    throw new OneAiQualityRevisionConflictError(
      input.expectedRevision,
      current?.revision ?? knowledge.revision
    );
  }

  const previousApplications = await loadActiveApplications(tx, knowledge.id);
  const previousApplicationSnapshots = previousApplications.map(applicationSnapshot);
  const previousApplicationIds = previousApplications.map((application) => application.id);
  let createdApplication: Awaited<ReturnType<typeof createApplication>> | null = null;
  const restoredApplications: Awaited<ReturnType<typeof createRestoredApplication>>[] = [];
  let variantKnowledgeId: string | null = null;

  if (input.application) {
    if (input.application.scope !== expectedScope) {
      throw new OneAiQualityReferenceError(
        `Application scope must match product scope ${expectedScope}`
      );
    }
    variantKnowledgeId = await validateApplicationReferences(tx, productId, input.application);
    if (input.action === "verify_and_reindex" && input.application.applicationId) {
      await deactivateApplicationEvidence(tx, [input.application.applicationId], nextRevision);
      await tx.shopVehicleApplication.updateMany({
        where: {
          id: input.application.applicationId,
          productId,
          isActive: true,
        },
        data: {
          isActive: false,
          revision: nextRevision,
        },
      });
    }
    createdApplication = await createApplication(tx, {
      productId,
      knowledgeId: knowledge.id,
      revision: nextRevision,
      action: input.action as "save_draft" | "verify_and_reindex",
      application: input.application,
      categoryGroup: knowledge.categoryGroup,
      material: knowledge.material,
      variantKnowledgeId,
      actorId,
      now,
    });
  } else if (undoTarget) {
    await deactivateApplicationEvidence(tx, previousApplicationIds, nextRevision);
    await deactivateStrictStateEvidence(tx, knowledge.id, nextRevision);
    await tx.shopVehicleApplication.updateMany({
      where: { knowledgeId: knowledge.id, isActive: true },
      data: {
        isActive: false,
        revision: nextRevision,
      },
    });
    const variantKnowledgeIds = await loadVariantKnowledgeIds(
      tx,
      productId,
      undoTarget.state.applications
    );
    for (const [ordinal, application] of undoTarget.state.applications.entries()) {
      restoredApplications.push(
        await createRestoredApplication(tx, {
          productId,
          knowledgeId: knowledge.id,
          revision: nextRevision,
          targetRevisionId: undoTarget.id,
          targetRevision: undoTarget.revision,
          ordinal,
          application,
          variantKnowledgeId: application.variantId
            ? (variantKnowledgeIds.get(application.variantId) ?? null)
            : null,
          actorId,
          now,
        })
      );
    }
  } else if (input.action === "mark_universal") {
    await deactivateApplicationEvidence(tx, previousApplicationIds, nextRevision);
    await tx.shopVehicleApplication.updateMany({
      where: { knowledgeId: knowledge.id, isActive: true },
      data: {
        isActive: false,
        revision: nextRevision,
      },
    });
    const knowledgeFacts =
      knowledge.facts && typeof knowledge.facts === "object" && !Array.isArray(knowledge.facts)
        ? (knowledge.facts as Record<string, Prisma.JsonValue>)
        : {};
    createdApplication = await createUniversalApplication(tx, {
      productId,
      knowledgeId: knowledge.id,
      revision: nextRevision,
      scope: expectedScope,
      categoryGroup: knowledge.categoryGroup,
      productKind:
        typeof knowledgeFacts.productKind === "string" ? knowledgeFacts.productKind : null,
      material: knowledge.material,
      actorId,
      now,
    });
  } else if (input.action === "block_strict") {
    await deactivateApplicationEvidence(tx, previousApplicationIds, nextRevision);
    await tx.shopVehicleApplication.updateMany({
      where: { knowledgeId: knowledge.id, isActive: true },
      data: {
        verificationStatus: "BLOCKED",
        revision: nextRevision,
        isActive: false,
        verifiedById: actorId,
        verifiedAt: now,
      },
    });
  } else if (input.action === "needs_source") {
    await deactivateApplicationEvidence(tx, previousApplicationIds, nextRevision);
    await tx.shopVehicleApplication.updateMany({
      where: { knowledgeId: knowledge.id, isActive: true },
      data: {
        verificationStatus: "NEEDS_REVIEW",
        revision: nextRevision,
      },
    });
  }

  const primaryApplication = createdApplication ?? restoredApplications[0] ?? null;
  const activeApplications = await loadActiveApplications(tx, knowledge.id);
  const activeSnapshots = activeApplications.map(applicationSnapshot);
  const normalizedFitmentQueued = undoTarget?.state.strictBlocked
    ? false
    : await persistNormalizedFitment(tx, {
        action: input.action,
        productId,
        applications: activeApplications,
        session,
        reason: input.reason,
        now,
      });
  const explicitUndoQueue = Boolean(undoTarget && !normalizedFitmentQueued);
  const reindexQueued = normalizedFitmentQueued || explicitUndoQueue;
  const fitmentStatus = fitmentStatusForApplications(
    input.action,
    activeApplications,
    knowledge.fitmentStatus
  );
  const summaryApplications = activeSnapshots.map((application) => ({
    vehicleType: application.vehicleType,
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
    verificationStatus: application.verificationStatus,
    source: application.source,
    confidence: application.confidence,
  }));
  const yearRanges = Array.from(
    new Map(
      activeApplications
        .filter((application) => application.yearFrom !== null)
        .map((application) => [
          `${application.yearFrom}:${application.yearTo ?? "open"}`,
          { from: application.yearFrom, to: application.yearTo },
        ])
    ).values()
  );

  await tx.shopProductKnowledge.update({
    where: { id: knowledge.id },
    data: {
      vehicleType:
        (activeApplications[0]?.isUniversal
          ? "universal"
          : activeApplications[0]?.scope === "moto"
            ? "motorcycle"
            : activeApplications[0]
              ? "car"
              : null) ?? (nextStatus === "BLOCKED" ? "blocked" : "unknown"),
      makes: uniqueStrings(activeApplications.map((application) => application.make)),
      models: uniqueStrings(activeApplications.map((application) => application.model)),
      chassisCodes: uniqueStrings(activeApplications.map((application) => application.chassisCode)),
      yearRanges: toJson(yearRanges),
      engines: uniqueStrings(activeApplications.map((application) => application.engine)),
      bodyStyles: uniqueStrings(activeApplications.map((application) => application.bodyStyle)),
      markets: uniqueStrings(activeApplications.map((application) => application.market)),
      fitmentStatus,
      fitmentSource: input.action === "save_draft" ? knowledge.fitmentSource : "manual",
      applications: toJson(summaryApplications),
    },
  });

  const evidenceIds: string[] = [];
  if (undoTarget) {
    const undoExcerpt =
      input.reason ??
      `Manager restored canonical One AI state from revision ${undoTarget.revision}.`;
    const stateEvidence = await tx.shopKnowledgeEvidence.create({
      data: {
        evidenceKey: hashKnowledgeValue({
          productId,
          revision: nextRevision,
          action: "undo",
          targetRevisionId: undoTarget.id,
          fieldPath: undoTarget.state.strictBlocked
            ? "knowledge.strictMatchingStatus"
            : "knowledge.undo",
        }),
        knowledgeId: knowledge.id,
        productId,
        fieldPath: undoTarget.state.strictBlocked
          ? "knowledge.strictMatchingStatus"
          : "knowledge.undo",
        source: "MANAGER",
        sourceRef: `admin:one-ai-quality:undo:${undoTarget.id}`,
        excerpt: undoExcerpt,
        sourceHash: hashKnowledgeValue(undoExcerpt),
        confidence: 1,
        extractorVersion: "admin-v1",
        isManagerVerified: true,
        verifiedById: actorId,
        verifiedAt: now,
        revision: nextRevision,
        isActive: true,
      },
      select: { id: true },
    });
    evidenceIds.push(stateEvidence.id);

    for (const [ordinal, application] of restoredApplications.entries()) {
      const applicationExcerpt = `${undoExcerpt} Restored application ${ordinal + 1} from immutable revision ${undoTarget.revision}.`;
      const applicationEvidence = await tx.shopKnowledgeEvidence.create({
        data: {
          evidenceKey: hashKnowledgeValue({
            productId,
            revision: nextRevision,
            action: "undo",
            targetRevisionId: undoTarget.id,
            applicationId: application.id,
          }),
          knowledgeId: knowledge.id,
          productId,
          vehicleApplicationId: application.id,
          fieldPath: `vehicleApplications.${application.id}`,
          source: "MANAGER",
          sourceRef: `admin:one-ai-quality:undo:${undoTarget.id}`,
          excerpt: applicationExcerpt,
          sourceHash: hashKnowledgeValue(applicationExcerpt),
          confidence: application.verificationStatus === "VERIFIED" ? 1 : 0.4,
          extractorVersion: "admin-v1",
          isManagerVerified: true,
          verifiedById: actorId,
          verifiedAt: now,
          revision: nextRevision,
          isActive: true,
        },
        select: { id: true },
      });
      evidenceIds.push(applicationEvidence.id);
    }
  } else {
    const excerpt = applicationEvidenceText(input);
    const evidenceKey = hashKnowledgeValue({
      productId,
      revision: nextRevision,
      action: input.action,
      applicationId: primaryApplication?.id ?? null,
      excerpt,
    });
    const evidence = await tx.shopKnowledgeEvidence.create({
      data: {
        evidenceKey,
        knowledgeId: knowledge.id,
        productId,
        variantKnowledgeId,
        vehicleApplicationId: primaryApplication?.id ?? null,
        fieldPath: primaryApplication
          ? `vehicleApplications.${primaryApplication.id}`
          : "knowledge.strictMatchingStatus",
        source: "MANAGER",
        sourceRef: input.evidence?.sourceRef ?? `admin:one-ai-quality:${input.action}`,
        excerpt,
        sourceHash: hashKnowledgeValue(excerpt),
        confidence: input.action === "save_draft" ? 0.4 : 1,
        extractorVersion: "admin-v1",
        isManagerVerified: input.action !== "save_draft",
        verifiedById: input.action === "save_draft" ? null : actorId,
        verifiedAt: input.action === "save_draft" ? null : now,
        revision: nextRevision,
        isActive: true,
      },
      select: { id: true },
    });
    evidenceIds.push(evidence.id);
  }
  const evidenceId = evidenceIds[0];
  if (!evidenceId) {
    throw new OneAiQualityReferenceError("Manager evidence could not be created");
  }

  const revisionSnapshot = {
    action: input.action,
    revision: nextRevision,
    status: nextStatus,
    qualityFlags,
    activeRevision: knowledge.activeRevision,
    applications: activeSnapshots,
    draftApplication:
      input.action === "save_draft" && createdApplication
        ? applicationSnapshot(createdApplication)
        : null,
    restoredFrom: undoTarget
      ? {
          revisionId: undoTarget.id,
          revision: undoTarget.revision,
          status: undoTarget.status,
        }
      : null,
    evidenceId,
    evidenceIds,
  };
  await tx.shopKnowledgeRevision.create({
    data: {
      knowledgeId: knowledge.id,
      productId,
      revision: nextRevision,
      schemaVersion: knowledge.schemaVersion,
      status: nextStatus,
      changeType: `ADMIN_${input.action.toUpperCase()}`,
      source: "MANAGER",
      snapshot: toJson(revisionSnapshot),
      diff: toJson({
        status: { from: knowledge.status, to: nextStatus },
        activeRevision: {
          from: knowledge.activeRevision,
          to: knowledge.activeRevision,
        },
        qualityFlags: {
          from: knowledge.qualityFlags,
          to: qualityFlags,
        },
        applications: {
          from: previousApplicationSnapshots,
          to: activeSnapshots,
        },
        restoredFrom: undoTarget
          ? {
              revisionId: undoTarget.id,
              revision: undoTarget.revision,
            }
          : null,
      }),
      reason:
        input.reason ??
        (undoTarget ? `Restored canonical state from revision ${undoTarget.revision}.` : null),
      changedById: actorId,
      activatedAt: null,
    },
  });

  const outbox = await tx.shopKnowledgeOutbox.create({
    data: {
      dedupeKey: `${productId}:ADMIN_AI_QUALITY:${nextRevision}`,
      knowledgeId: knowledge.id,
      productId,
      variantId: primaryApplication?.variantId ?? null,
      eventType: `ADMIN_${input.action.toUpperCase()}`,
      payload: toJson({
        action: input.action,
        revision: nextRevision,
        reindexQueued,
        evidenceId,
        evidenceIds,
        applicationId: primaryApplication?.id ?? null,
        restoredFrom: undoTarget
          ? {
              revisionId: undoTarget.id,
              revision: undoTarget.revision,
            }
          : null,
      }),
      status: explicitUndoQueue ? "PENDING" : "COMPLETED",
      processedAt: explicitUndoQueue ? null : now,
      availableAt: now,
    },
    select: { id: true },
  });

  await writeAdminAuditLog(tx, session, {
    scope: "shop",
    action: `product.ai-quality.${input.action}`,
    entityType: "shop.product.knowledge",
    entityId: productId,
    metadata: {
      productId,
      slug: product.slug,
      expectedRevision: input.expectedRevision,
      revision: nextRevision,
      knowledgeStatus: nextStatus,
      applicationId: primaryApplication?.id ?? null,
      evidenceId,
      evidenceIds,
      outboxId: outbox.id,
      reindexQueued,
      reason: input.reason,
      restoredFromRevisionId: undoTarget?.id ?? null,
      restoredFromRevision: undoTarget?.revision ?? null,
    },
  });

  const sourceOutbox = reindexQueued
    ? await tx.shopKnowledgeOutbox.findUnique({
        where: { dedupeKey: `${productId}:SOURCE_CHANGED` },
        select: { id: true, status: true },
      })
    : null;

  if (options.bumpCatalogState !== false) {
    await bumpShopKnowledgeCatalogState(tx, now);
  }

  return {
    productId,
    action: input.action,
    revision: nextRevision,
    activeRevision: knowledge.activeRevision,
    status: nextStatus,
    qualityFlags,
    applicationId: primaryApplication?.id ?? null,
    evidenceId,
    outboxId: outbox.id,
    reindexQueued,
    reindexOutboxId:
      sourceOutbox?.status === "PENDING" ||
      sourceOutbox?.status === "RETRY" ||
      sourceOutbox?.status === "PROCESSING"
        ? sourceOutbox.id
        : explicitUndoQueue
          ? outbox.id
          : null,
    restoredFromRevisionId: undoTarget?.id ?? null,
    restoredFromRevision: undoTarget?.revision ?? null,
  };
}

export async function mutateOneAiQualityProduct(
  client: PrismaClient,
  productId: string,
  input: OneAiQualityMutationInput,
  session: AdminSession
) {
  return client.$transaction(
    (tx) => mutateOneAiQualityProductInTransaction(tx, productId, input, session),
    {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 5_000,
      timeout: 15_000,
    }
  );
}
