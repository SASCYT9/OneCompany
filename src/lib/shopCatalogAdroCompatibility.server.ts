import "server-only";

import { createHash } from "node:crypto";

import { Prisma, type ShopCatalogCompatibilityDimension } from "@prisma/client";

import type { AdroApplication, AdroNormalization } from "./shopCatalogAdroNormalization";

const dimensions: ShopCatalogCompatibilityDimension[] = [
  "SCOPE", "MAKE", "MODEL", "GENERATION", "CHASSIS", "YEAR", "ENGINE", "FUEL",
  "BODY_STYLE", "DRIVETRAIN", "TRANSMISSION", "MARKET", "OPF_GPF",
];

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function key(prefix: string, value: string) {
  return `${prefix}:${digest(value).slice(0, 24)}`;
}

async function upsertAlias(input: {
  tx: Prisma.TransactionClient;
  sourceId: string;
  entityType: "MAKE" | "MODEL" | "GENERATION";
  alias: string;
  makeId?: string;
  modelId?: string;
  generationId?: string;
  parentMakeId?: string;
  parentModelId?: string;
}) {
  const aliasKey = key(
    "adro-alias",
    `${input.entityType}|${input.parentMakeId ?? ""}|${input.parentModelId ?? ""}|${input.alias}`
  );
  const persisted = await input.tx.vehicleTaxonomyAlias.upsert({
    where: { sourceId_aliasKey: { sourceId: input.sourceId, aliasKey } },
    create: {
      sourceId: input.sourceId,
      aliasKey,
      entityType: input.entityType,
      alias: input.alias,
      normalizedAlias: input.alias.toLowerCase(),
      makeId: input.makeId,
      modelId: input.modelId,
      generationId: input.generationId,
      parentMakeId: input.parentMakeId,
      parentModelId: input.parentModelId,
    },
    update: {},
  });
  if (
    persisted.entityType !== input.entityType ||
    persisted.alias !== input.alias ||
    persisted.makeId !== (input.makeId ?? null) ||
    persisted.modelId !== (input.modelId ?? null) ||
    persisted.generationId !== (input.generationId ?? null)
  ) {
    throw new Error(`ADRO taxonomy alias conflict: ${aliasKey}`);
  }
}

async function resolveApplicationTaxonomy(input: {
  tx: Prisma.TransactionClient;
  sourceId: string;
  application: AdroApplication;
}) {
  const { tx, application } = input;
  const normalizedMake = application.make.toLowerCase();
  const makeKey = `auto:${normalizedMake}`;
  const make = await tx.vehicleMake.upsert({
    where: { makeKey },
    create: { makeKey, scope: "auto", name: application.make, normalizedName: normalizedMake },
    update: {},
  });
  if (make.scope !== "auto" || make.normalizedName !== normalizedMake) {
    throw new Error(`ADRO make taxonomy conflict: ${makeKey}`);
  }
  const normalizedModel = application.model.toLowerCase();
  const modelKey = `auto:${normalizedMake}:${normalizedModel}`;
  const model = await tx.vehicleModel.upsert({
    where: { modelKey },
    create: { modelKey, makeId: make.id, name: application.model, normalizedName: normalizedModel },
    update: {},
  });
  if (model.makeId !== make.id || model.normalizedName !== normalizedModel) {
    throw new Error(`ADRO model taxonomy conflict: ${modelKey}`);
  }
  const generation = application.generation
    ? await tx.vehicleGeneration.upsert({
        where: { generationKey: `auto:${normalizedMake}:${normalizedModel}:${application.generation.toLowerCase()}` },
        create: {
          generationKey: `auto:${normalizedMake}:${normalizedModel}:${application.generation.toLowerCase()}`,
          scope: "auto",
          make: application.make,
          model: application.model,
          makeId: make.id,
          modelId: model.id,
          generationName: application.generation,
          chassisCode: application.generation,
          yearFrom: application.yearFrom,
          yearTo: application.yearTo,
        },
        update: {},
      })
    : null;
  if (generation && (generation.makeId !== make.id || generation.modelId !== model.id)) {
    throw new Error(`ADRO generation taxonomy conflict: ${generation.generationKey}`);
  }
  await upsertAlias({ tx, sourceId: input.sourceId, entityType: "MAKE", alias: application.make, makeId: make.id });
  await upsertAlias({
    tx,
    sourceId: input.sourceId,
    entityType: "MODEL",
    alias: application.model,
    modelId: model.id,
    parentMakeId: make.id,
  });
  if (generation) {
    await upsertAlias({
      tx,
      sourceId: input.sourceId,
      entityType: "GENERATION",
      alias: application.generation!,
      generationId: generation.id,
      parentMakeId: make.id,
      parentModelId: model.id,
    });
  }
  return { make, model, generation };
}

type ExactValue = Omit<
  Prisma.ShopCatalogCompatibilityValueUncheckedCreateInput,
  "constraintId" | "dimension" | "state"
>;

export async function persistAdroCompatibilityInTransaction(input: {
  tx: Prisma.TransactionClient;
  sourceId: string;
  sourceRecordId: string;
  payloadHash: string;
  normalization: AdroNormalization;
}) {
  const { tx, normalization } = input;
  const taxonomy = [];
  for (const application of normalization.applications) {
    taxonomy.push(await resolveApplicationTaxonomy({ tx, sourceId: input.sourceId, application }));
  }
  const targetKey = `variant:${normalization.variantId}`;
  const active = await tx.shopCatalogCompatibilityPolicy.findFirst({
    where: { targetKey, isActive: true },
    select: { id: true, revision: true, sourceRecordId: true },
  });
  if (active?.sourceRecordId === input.sourceRecordId) return { policyId: active.id, idempotent: true };
  const latest = await tx.shopCatalogCompatibilityPolicy.findFirst({
    where: { targetKey },
    orderBy: { revision: "desc" },
    select: { revision: true },
  });
  if (active) {
    await tx.shopCatalogCompatibilityPolicy.update({
      where: { id: active.id },
      data: { isActive: false, retiredAt: new Date() },
    });
  }
  const verified = normalization.verification === "VERIFIED";
  const policy = await tx.shopCatalogCompatibilityPolicy.create({
    data: {
      targetKey,
      productId: normalization.productId,
      variantId: normalization.variantId,
      mode: verified ? "VEHICLE_SPECIFIC" : "NEEDS_REVIEW",
      revision: (latest?.revision ?? 0) + 1,
      sourceRecordId: input.sourceRecordId,
      dimensionRules: {
        create: dimensions.map((dimension) => ({
          dimension,
          isRequired: ["SCOPE", "MAKE", "MODEL"].includes(dimension),
          defaultState: ["ENGINE", "FUEL", "DRIVETRAIN", "TRANSMISSION", "OPF_GPF"].includes(dimension)
            ? "NOT_APPLICABLE"
            : "ANY",
        })),
      },
    },
  });

  for (let position = 0; position < normalization.applications.length; position += 1) {
    const application = normalization.applications[position]!;
    const resolved = taxonomy[position]!;
    const clause = await tx.shopCatalogCompatibilityClause.create({
      data: {
        policyId: policy.id,
        clauseKey: key(
          "adro-clause",
          `${application.make}|${application.model}|${application.generation ?? "*"}|${application.yearFrom ?? "*"}|${application.yearTo ?? "*"}`
        ),
        position,
        verification: verified ? "VERIFIED" : "NEEDS_REVIEW",
        sourceRecordId: input.sourceRecordId,
        sourceRef: normalization.recordKey,
        evidenceHash: input.payloadHash,
      },
    });
    const specs: Array<{
      dimension: ShopCatalogCompatibilityDimension;
      state: "EXACT" | "ANY" | "NOT_APPLICABLE";
      value?: ExactValue;
    }> = [
      { dimension: "SCOPE", state: "EXACT", value: { textValue: "auto" } },
      { dimension: "MAKE", state: "EXACT", value: { makeId: resolved.make.id } },
      { dimension: "MODEL", state: "EXACT", value: { modelId: resolved.model.id } },
      resolved.generation
        ? { dimension: "GENERATION", state: "EXACT", value: { generationId: resolved.generation.id } }
        : { dimension: "GENERATION", state: "ANY" },
      application.generation
        ? { dimension: "CHASSIS", state: "EXACT", value: { textValue: application.generation } }
        : { dimension: "CHASSIS", state: "ANY" },
      application.yearFrom
        ? { dimension: "YEAR", state: "EXACT", value: { yearFrom: application.yearFrom, yearTo: application.yearTo } }
        : { dimension: "YEAR", state: "ANY" },
      { dimension: "ENGINE", state: "NOT_APPLICABLE" },
      { dimension: "FUEL", state: "NOT_APPLICABLE" },
      { dimension: "BODY_STYLE", state: "ANY" },
      { dimension: "DRIVETRAIN", state: "NOT_APPLICABLE" },
      { dimension: "TRANSMISSION", state: "NOT_APPLICABLE" },
      { dimension: "MARKET", state: "ANY" },
      { dimension: "OPF_GPF", state: "NOT_APPLICABLE" },
    ];
    for (const spec of specs) {
      const constraint = await tx.shopCatalogCompatibilityConstraint.create({
        data: { clauseId: clause.id, dimension: spec.dimension, state: spec.state },
      });
      if (spec.value) {
        await tx.shopCatalogCompatibilityValue.create({
          data: { constraintId: constraint.id, dimension: spec.dimension, state: "EXACT", ...spec.value },
        });
      }
    }
  }
  return { policyId: policy.id, idempotent: false, clauses: normalization.applications.length };
}
