import { Prisma, type PrismaClient } from "@prisma/client";

import type { AdminSession } from "@/lib/adminAuth";
import {
  createOneAiQualityBulkPreviewToken,
  hashOneAiQualityBulkActor,
  hashOneAiQualityBulkToken,
  ONE_AI_QUALITY_BULK_PREVIEW_TTL_MS,
  type OneAiQualityBulkHomogeneousKey,
  type OneAiQualityBulkMutation,
  type OneAiQualityBulkPreviewInput,
  type OneAiQualityBulkPreviewTokenPayload,
} from "@/lib/admin/oneAiQualityBulk";
import type { OneAiQualityMutationInput } from "@/lib/admin/oneAiQualityMutation";
import {
  knowledgeStatusForAction,
  mutateOneAiQualityProductInTransaction,
  qualityFlagsForAction,
} from "@/lib/admin/oneAiQualityProductRepository";
import { writeAdminAuditLog } from "@/lib/adminRbac";
import { bumpShopKnowledgeCatalogState } from "@/lib/shopKnowledgeV2/catalogState";
import { hashKnowledgeValue } from "@/lib/shopKnowledgeV2/hash";

type TransactionClient = Prisma.TransactionClient;

const activeApplicationSelect = {
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
} satisfies Prisma.ShopVehicleApplicationSelect;

const previewProductSelect = {
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
      qualityFlags: true,
      categoryGroup: true,
      fitmentStatus: true,
      facts: true,
      vehicleApplications: {
        where: { isActive: true },
        orderBy: [{ sourcePriority: "asc" as const }, { updatedAt: "desc" as const }],
        select: activeApplicationSelect,
      },
    },
  },
} satisfies Prisma.ShopProductSelect;

type PreviewProduct = Prisma.ShopProductGetPayload<{ select: typeof previewProductSelect }>;
type PreviewApplication = NonNullable<PreviewProduct["knowledge"]>["vehicleApplications"][number];

export class OneAiQualityBulkSelectionError extends Error {}

export class OneAiQualityBulkRevisionConflictError extends Error {
  constructor(
    readonly conflicts: Array<{
      productId: string;
      expectedRevision: number;
      currentRevision: number | null;
    }>
  ) {
    super("One AI bulk revisions changed after preview");
  }
}

export class OneAiQualityBulkIdempotencyConflictError extends Error {
  constructor() {
    super("The idempotency key was already used for a different preview");
  }
}

function productKindFromFacts(value: Prisma.JsonValue): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const productKind = (value as Record<string, Prisma.JsonValue>).productKind;
  return typeof productKind === "string" && productKind.trim() ? productKind.trim() : null;
}

function homogeneousKey(product: PreviewProduct): OneAiQualityBulkHomogeneousKey | null {
  if (!product.knowledge) return null;
  return {
    scope: product.scope === "moto" ? "moto" : "auto",
    categoryGroup: product.knowledge.categoryGroup,
    productKind: productKindFromFacts(product.knowledge.facts),
  };
}

function sameHomogeneousKey(
  left: OneAiQualityBulkHomogeneousKey,
  right: OneAiQualityBulkHomogeneousKey
) {
  return (
    left.scope === right.scope &&
    left.categoryGroup === right.categoryGroup &&
    left.productKind === right.productKind
  );
}

function applicationSnapshot(application: PreviewApplication) {
  return {
    id: application.id,
    variantId: application.variantId,
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
  };
}

function normalizedBulkMutation(
  mutation: OneAiQualityBulkMutation,
  homogeneous: OneAiQualityBulkHomogeneousKey
): OneAiQualityBulkMutation {
  if (
    mutation.action === "mark_universal" &&
    (!homogeneous.categoryGroup || !homogeneous.productKind)
  ) {
    throw new OneAiQualityBulkSelectionError(
      "Universal bulk fitment requires one known category and product kind"
    );
  }
  if (mutation.action !== "verify_and_reindex" || !mutation.application) return mutation;
  if (mutation.application.scope !== homogeneous.scope) {
    throw new OneAiQualityBulkSelectionError(
      "The shared application scope does not match the selected products"
    );
  }
  if (
    mutation.application.categoryGroup &&
    mutation.application.categoryGroup !== homogeneous.categoryGroup
  ) {
    throw new OneAiQualityBulkSelectionError(
      "The shared application category does not match the selected products"
    );
  }
  if (
    mutation.application.productKind &&
    mutation.application.productKind !== homogeneous.productKind
  ) {
    throw new OneAiQualityBulkSelectionError(
      "The shared application product kind does not match the selected products"
    );
  }
  if (!homogeneous.categoryGroup || !homogeneous.productKind) {
    throw new OneAiQualityBulkSelectionError(
      "Verified bulk fitment requires one known category and product kind"
    );
  }
  return {
    ...mutation,
    application: {
      ...mutation.application,
      categoryGroup: homogeneous.categoryGroup,
      productKind: homogeneous.productKind,
    },
  };
}

function proposedApplications(
  product: PreviewProduct,
  mutation: OneAiQualityBulkMutation,
  nextRevision: number
) {
  const knowledge = product.knowledge!;
  const current = knowledge.vehicleApplications.map(applicationSnapshot);
  if (mutation.action === "block_strict") return [];
  if (mutation.action === "needs_source") {
    return current.map((application) => ({
      ...application,
      verificationStatus: "NEEDS_REVIEW",
    }));
  }
  if (mutation.action === "mark_universal") {
    return [
      {
        id: null,
        variantId: null,
        scope: product.scope === "moto" ? "moto" : "auto",
        make: null,
        model: null,
        generation: null,
        chassisCode: null,
        yearFrom: null,
        yearTo: null,
        engine: null,
        fuel: null,
        bodyStyle: null,
        drivetrain: null,
        transmission: null,
        market: null,
        opfGpf: "unknown",
        categoryGroup: knowledge.categoryGroup,
        productKind: productKindFromFacts(knowledge.facts),
        material: null,
        isUniversal: true,
        verificationStatus: "VERIFIED",
        source: "MANAGER",
        confidence: 1,
        revision: nextRevision,
      },
    ];
  }
  const application = mutation.application!;
  return [
    ...current,
    {
      id: null,
      variantId: null,
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
      isUniversal: false,
      verificationStatus: "VERIFIED",
      source: "MANAGER",
      confidence: 1,
      revision: nextRevision,
    },
  ];
}

function previewRow(product: PreviewProduct, mutation: OneAiQualityBulkMutation) {
  const knowledge = product.knowledge!;
  const nextRevision = knowledge.revision + 1;
  const nextFlags = qualityFlagsForAction(knowledge.qualityFlags, mutation.action);
  const nextStatus = knowledgeStatusForAction(mutation.action, nextFlags);
  return {
    productId: product.id,
    slug: product.slug,
    title: product.titleUa || product.titleEn || product.slug,
    before: {
      revision: knowledge.revision,
      activeRevision: knowledge.activeRevision,
      status: knowledge.status,
      qualityFlags: knowledge.qualityFlags,
      fitmentStatus: knowledge.fitmentStatus,
      applications: knowledge.vehicleApplications.map(applicationSnapshot),
    },
    after: {
      revision: nextRevision,
      activeRevision: knowledge.activeRevision,
      status: nextStatus,
      qualityFlags: nextFlags,
      fitmentStatus:
        mutation.action === "mark_universal"
          ? "universal"
          : mutation.action === "verify_and_reindex"
            ? "verified"
            : "needs_review",
      applications: proposedApplications(product, mutation, nextRevision),
      reindexQueued: mutation.action !== "block_strict",
    },
  };
}

async function loadExactProducts(client: PrismaClient | TransactionClient, productIds: string[]) {
  const products = await client.shopProduct.findMany({
    where: { id: { in: productIds } },
    select: previewProductSelect,
  });
  const byId = new Map(products.map((product) => [product.id, product]));
  const missing = productIds.filter((productId) => !byId.has(productId));
  if (missing.length) {
    throw new OneAiQualityBulkSelectionError(
      `Products not found: ${missing.slice(0, 5).join(", ")}`
    );
  }
  return productIds.map((productId) => byId.get(productId)!);
}

function validateSelection(products: PreviewProduct[]) {
  for (const product of products) {
    if (!product.knowledge || product.knowledge.schemaVersion < 2) {
      throw new OneAiQualityBulkSelectionError(
        `Product ${product.id} has no current Knowledge V2 record`
      );
    }
  }
  const first = homogeneousKey(products[0]);
  if (!first) throw new OneAiQualityBulkSelectionError("Knowledge V2 selection is unavailable");
  const mismatched = products.filter((product) => {
    const key = homogeneousKey(product);
    return !key || !sameHomogeneousKey(first, key);
  });
  if (mismatched.length) {
    throw new OneAiQualityBulkSelectionError(
      "Bulk selection must have one scope, category and product kind"
    );
  }
  return first;
}

export async function previewOneAiQualityBulk(
  client: PrismaClient,
  input: OneAiQualityBulkPreviewInput,
  session: AdminSession,
  signingSecret: string,
  now = new Date()
) {
  const products = await loadExactProducts(client, input.productIds);
  const homogeneous = validateSelection(products);
  const mutation = normalizedBulkMutation(input.mutation, homogeneous);
  const expiresAt = new Date(now.getTime() + ONE_AI_QUALITY_BULK_PREVIEW_TTL_MS);
  const payload: OneAiQualityBulkPreviewTokenPayload = {
    version: 1,
    purpose: "one-ai-quality-bulk",
    issuedAt: now.getTime(),
    expiresAt: expiresAt.getTime(),
    actorHash: hashOneAiQualityBulkActor(session.email),
    homogeneous,
    products: products.map((product) => ({
      productId: product.id,
      expectedRevision: product.knowledge!.revision,
    })),
    mutation,
  };
  const previewToken = createOneAiQualityBulkPreviewToken(payload, signingSecret);
  return {
    previewToken,
    expiresAt: expiresAt.toISOString(),
    homogeneous,
    action: mutation.action,
    mutation,
    productCount: products.length,
    products: products.map((product) => previewRow(product, mutation)),
  };
}

type BulkApplyResult = {
  batchId: string;
  replayed: boolean;
  appliedAt: string;
  action: OneAiQualityBulkMutation["action"];
  products: Array<{
    productId: string;
    revision: number;
    status: string;
    outboxId: string;
    reindexOutboxId: string | null;
  }>;
  reindexOutboxIds: string[];
};

function storedResult(payload: Prisma.JsonValue): {
  tokenHash: string;
  result: BulkApplyResult | null;
} | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const source = payload as Record<string, Prisma.JsonValue>;
  const tokenHash = typeof source.tokenHash === "string" ? source.tokenHash : null;
  const result =
    source.result && typeof source.result === "object" && !Array.isArray(source.result)
      ? (source.result as unknown as BulkApplyResult)
      : null;
  return tokenHash ? { tokenHash, result } : null;
}

function idempotencyDedupeKey(actorHash: string, idempotencyKey: string) {
  return `ADMIN_AI_QUALITY_BULK:${hashKnowledgeValue({
    actorHash,
    idempotencyKey,
  })}`;
}

async function findReplay(
  client: PrismaClient,
  dedupeKey: string,
  tokenHash: string
): Promise<BulkApplyResult | null> {
  const marker = await client.shopKnowledgeOutbox.findUnique({
    where: { dedupeKey },
    select: { payload: true },
  });
  if (!marker) return null;
  const stored = storedResult(marker.payload);
  if (!stored || stored.tokenHash !== tokenHash) {
    throw new OneAiQualityBulkIdempotencyConflictError();
  }
  return stored.result ? { ...stored.result, replayed: true } : null;
}

function mutationForRevision(
  mutation: OneAiQualityBulkMutation,
  expectedRevision: number
): OneAiQualityMutationInput {
  return {
    ...mutation,
    expectedRevision,
    targetRevisionId: null,
    targetRevision: null,
  };
}

export async function applyOneAiQualityBulk(
  client: PrismaClient,
  payload: OneAiQualityBulkPreviewTokenPayload,
  previewToken: string,
  idempotencyKey: string,
  session: AdminSession
): Promise<BulkApplyResult> {
  const tokenHash = hashOneAiQualityBulkToken(previewToken);
  const dedupeKey = idempotencyDedupeKey(payload.actorHash, idempotencyKey);
  const replay = await findReplay(client, dedupeKey, tokenHash);
  if (replay) return replay;

  try {
    return await client.$transaction(
      async (tx) => {
        const existingMarker = await tx.shopKnowledgeOutbox.findUnique({
          where: { dedupeKey },
          select: { payload: true },
        });
        if (existingMarker) {
          const stored = storedResult(existingMarker.payload);
          if (!stored || stored.tokenHash !== tokenHash) {
            throw new OneAiQualityBulkIdempotencyConflictError();
          }
          if (stored.result) return { ...stored.result, replayed: true };
          throw new OneAiQualityBulkIdempotencyConflictError();
        }

        const productIds = payload.products.map((product) => product.productId);
        const currentProducts = await loadExactProducts(tx, productIds);
        const currentHomogeneous = validateSelection(currentProducts);
        if (!sameHomogeneousKey(currentHomogeneous, payload.homogeneous)) {
          throw new OneAiQualityBulkSelectionError(
            "The selected products are no longer homogeneous"
          );
        }
        const currentMutation = normalizedBulkMutation(payload.mutation, currentHomogeneous);
        const currentRevisionByProduct = new Map(
          currentProducts.map((product) => [product.id, product.knowledge!.revision])
        );
        const conflicts = payload.products
          .filter(
            (product) =>
              currentRevisionByProduct.get(product.productId) !== product.expectedRevision
          )
          .map((product) => ({
            productId: product.productId,
            expectedRevision: product.expectedRevision,
            currentRevision: currentRevisionByProduct.get(product.productId) ?? null,
          }));
        if (conflicts.length) throw new OneAiQualityBulkRevisionConflictError(conflicts);

        const marker = await tx.shopKnowledgeOutbox.create({
          data: {
            dedupeKey,
            productId: payload.products[0].productId,
            eventType: "ADMIN_AI_QUALITY_BULK_APPLY",
            payload: {
              tokenHash,
              state: "processing",
            },
            status: "COMPLETED",
            processedAt: new Date(),
          },
          select: { id: true },
        });

        const productResults: BulkApplyResult["products"] = [];
        for (const product of payload.products) {
          const result = await mutateOneAiQualityProductInTransaction(
            tx,
            product.productId,
            mutationForRevision(currentMutation, product.expectedRevision),
            session,
            { bumpCatalogState: false }
          );
          productResults.push({
            productId: result.productId,
            revision: result.revision,
            status: result.status,
            outboxId: result.outboxId,
            reindexOutboxId: result.reindexOutboxId,
          });
        }
        await bumpShopKnowledgeCatalogState(tx);

        const result: BulkApplyResult = {
          batchId: marker.id,
          replayed: false,
          appliedAt: new Date().toISOString(),
          action: currentMutation.action,
          products: productResults,
          reindexOutboxIds: Array.from(
            new Set(
              productResults
                .map((product) => product.reindexOutboxId)
                .filter((outboxId): outboxId is string => Boolean(outboxId))
            )
          ),
        };

        await tx.shopKnowledgeOutbox.update({
          where: { id: marker.id },
          data: {
            payload: {
              tokenHash,
              state: "completed",
              result: result as unknown as Prisma.InputJsonValue,
            },
          },
        });
        await writeAdminAuditLog(tx, session, {
          scope: "shop",
          action: "product.ai-quality.bulk-apply",
          entityType: "shop.product.knowledge.bulk",
          entityId: marker.id,
          metadata: {
            action: currentMutation.action,
            productIds,
            expectedRevisions: payload.products,
            idempotencyHash: hashKnowledgeValue(idempotencyKey),
            tokenHash,
            reindexOutboxIds: result.reindexOutboxIds,
          },
        });
        return result;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 10_000,
        timeout: 60_000,
      }
    );
  } catch (error) {
    if (error instanceof OneAiQualityBulkIdempotencyConflictError) throw error;
    const code = String((error as { code?: unknown })?.code ?? "");
    if (code === "P2002") {
      const concurrentReplay = await findReplay(client, dedupeKey, tokenHash);
      if (concurrentReplay) return concurrentReplay;
    }
    throw error;
  }
}
