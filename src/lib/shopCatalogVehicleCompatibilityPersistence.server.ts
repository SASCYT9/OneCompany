import "server-only";

import { createHash } from "node:crypto";

import { Prisma, type ShopCatalogCompatibilityDimension } from "@prisma/client";

export type VehiclePolicyApplication = {
  scope?: "auto" | "moto";
  make: string;
  model: string;
  generation: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  engineCode: string | null;
  fuel: string | null;
};

export type VehiclePolicyNormalization = {
  scope?: "auto" | "moto";
  productId: string;
  variantId: string;
  recordKey: string;
  mode: "UNIVERSAL" | "VEHICLE_SPECIFIC" | "NEEDS_REVIEW";
  engineRelevant: boolean;
  applications: VehiclePolicyApplication[];
  verification: "VERIFIED" | "NEEDS_REVIEW";
};

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

type ExactValue = Omit<
  Prisma.ShopCatalogCompatibilityValueUncheckedCreateInput,
  "constraintId" | "dimension" | "state"
>;

async function alias(input: {
  tx: Prisma.TransactionClient;
  sourceId: string;
  label: string;
  aliasPrefix: string;
  entityType: "MAKE" | "MODEL" | "GENERATION" | "POWERTRAIN";
  value: string;
  makeId?: string;
  modelId?: string;
  generationId?: string;
  powertrainId?: string;
  parentMakeId?: string;
  parentModelId?: string;
}) {
  const aliasKey = key(
    input.aliasPrefix,
    `${input.entityType}|${input.parentMakeId ?? ""}|${input.parentModelId ?? ""}|${input.value}`
  );
  const persisted = await input.tx.vehicleTaxonomyAlias.upsert({
    where: { sourceId_aliasKey: { sourceId: input.sourceId, aliasKey } },
    create: {
      sourceId: input.sourceId,
      aliasKey,
      entityType: input.entityType,
      alias: input.value,
      normalizedAlias: input.value.toLowerCase(),
      makeId: input.makeId,
      modelId: input.modelId,
      generationId: input.generationId,
      powertrainId: input.powertrainId,
      parentMakeId: input.parentMakeId,
      parentModelId: input.parentModelId,
    },
    update: {},
  });
  if (
    persisted.entityType !== input.entityType ||
    persisted.makeId !== (input.makeId ?? null) ||
    persisted.modelId !== (input.modelId ?? null) ||
    persisted.generationId !== (input.generationId ?? null) ||
    persisted.powertrainId !== (input.powertrainId ?? null)
  ) throw new Error(`${input.label} taxonomy alias conflict: ${aliasKey}`);
}

async function taxonomy(input: {
  tx: Prisma.TransactionClient;
  sourceId: string;
  label: string;
  aliasPrefix: string;
  application: VehiclePolicyApplication;
}) {
  const { tx, application } = input;
  const scope = application.scope ?? "auto";
  const normalizedMake = application.make.toLowerCase();
  const makeKey = `${scope}:${normalizedMake}`;
  const make = await tx.vehicleMake.upsert({
    where: { makeKey },
    create: { makeKey, scope, name: application.make, normalizedName: normalizedMake },
    update: {},
  });
  if (make.scope !== scope || make.normalizedName !== normalizedMake) {
    throw new Error(`${input.label} make taxonomy conflict: ${makeKey}`);
  }
  const normalizedModel = application.model.toLowerCase();
  const modelKey = `${scope}:${normalizedMake}:${normalizedModel}`;
  const model = await tx.vehicleModel.upsert({
    where: { modelKey },
    create: { modelKey, makeId: make.id, name: application.model, normalizedName: normalizedModel },
    update: {},
  });
  if (model.makeId !== make.id || model.normalizedName !== normalizedModel) {
    throw new Error(`${input.label} model taxonomy conflict: ${modelKey}`);
  }
  const generationKey = application.generation
    ? `${scope}:${normalizedMake}:${normalizedModel}:${application.generation.toLowerCase()}`
    : null;
  const generation = generationKey
    ? await tx.vehicleGeneration.upsert({
        where: { generationKey },
        create: {
          generationKey,
          scope,
          make: application.make,
          model: application.model,
          makeId: make.id,
          modelId: model.id,
          generationName: application.generation!,
          chassisCode: application.generation,
          yearFrom: application.yearFrom,
          yearTo: application.yearTo,
        },
        update: {},
      })
    : null;
  if (generation && (generation.makeId !== make.id || generation.modelId !== model.id)) {
    throw new Error(`${input.label} generation taxonomy conflict: ${generationKey}`);
  }
  const powertrainKey = application.engineCode
    ? `${scope}-powertrain:${digest(`${normalizedMake}|${application.engineCode}|${application.fuel}`).slice(0, 24)}`
    : null;
  const powertrain = powertrainKey
    ? await tx.vehiclePowertrain.upsert({
        where: { powertrainKey },
        create: {
          powertrainKey,
          makeId: make.id,
          code: application.engineCode,
          name: application.engineCode!,
          fuelKey: application.fuel,
        },
        update: {},
      })
    : null;
  if (powertrain && (powertrain.makeId !== make.id || powertrain.code !== application.engineCode || powertrain.fuelKey !== application.fuel)) {
    throw new Error(`${input.label} powertrain taxonomy conflict: ${powertrainKey}`);
  }
  await alias({ tx, sourceId: input.sourceId, label: input.label, aliasPrefix: input.aliasPrefix, entityType: "MAKE", value: application.make, makeId: make.id });
  await alias({ tx, sourceId: input.sourceId, label: input.label, aliasPrefix: input.aliasPrefix, entityType: "MODEL", value: application.model, modelId: model.id, parentMakeId: make.id });
  if (generation) await alias({
    tx,
    sourceId: input.sourceId,
    label: input.label,
    aliasPrefix: input.aliasPrefix,
    entityType: "GENERATION",
    value: application.generation!,
    generationId: generation.id,
    parentMakeId: make.id,
    parentModelId: model.id,
  });
  if (powertrain) await alias({
    tx,
    sourceId: input.sourceId,
    label: input.label,
    aliasPrefix: input.aliasPrefix,
    entityType: "POWERTRAIN",
    value: application.engineCode!,
    powertrainId: powertrain.id,
    parentMakeId: make.id,
  });
  return { make, model, generation, powertrain };
}

async function createConstraint(input: {
  tx: Prisma.TransactionClient;
  clauseId: string;
  dimension: ShopCatalogCompatibilityDimension;
  state: "EXACT" | "ANY" | "NOT_APPLICABLE" | "UNKNOWN";
  value?: ExactValue;
}) {
  const constraint = await input.tx.shopCatalogCompatibilityConstraint.create({
    data: { clauseId: input.clauseId, dimension: input.dimension, state: input.state },
  });
  if (input.value) await input.tx.shopCatalogCompatibilityValue.create({
    data: { constraintId: constraint.id, dimension: input.dimension, state: "EXACT", ...input.value },
  });
}

export async function persistVehicleCompatibilityInTransaction(input: {
  tx: Prisma.TransactionClient;
  sourceId: string;
  sourceRecordId: string;
  payloadHash: string;
  label: string;
  aliasPrefix: string;
  normalization: VehiclePolicyNormalization;
}) {
  const { tx, normalization } = input;
  const resolved = [];
  for (const application of normalization.applications) {
    resolved.push(await taxonomy({ tx, sourceId: input.sourceId, label: input.label, aliasPrefix: input.aliasPrefix, application }));
  }
  const targetKey = `variant:${normalization.variantId}`;
  const active = await tx.shopCatalogCompatibilityPolicy.findFirst({
    where: { targetKey, isActive: true },
    select: { id: true, sourceRecordId: true },
  });
  if (active?.sourceRecordId === input.sourceRecordId) return { policyId: active.id, idempotent: true };
  const latest = await tx.shopCatalogCompatibilityPolicy.findFirst({
    where: { targetKey }, orderBy: { revision: "desc" }, select: { revision: true },
  });
  if (active) await tx.shopCatalogCompatibilityPolicy.update({
    where: { id: active.id }, data: { isActive: false, retiredAt: new Date() },
  });
  const policyMode = normalization.verification === "VERIFIED" ? normalization.mode : "NEEDS_REVIEW";
  const policy = await tx.shopCatalogCompatibilityPolicy.create({
    data: {
      targetKey,
      productId: normalization.productId,
      variantId: normalization.variantId,
      mode: policyMode,
      revision: (latest?.revision ?? 0) + 1,
      sourceRecordId: input.sourceRecordId,
      dimensionRules: {
        create: dimensions.map((dimension) => ({
          dimension,
          isRequired:
            policyMode === "VEHICLE_SPECIFIC" &&
            (["SCOPE", "MAKE", "MODEL"].includes(dimension) ||
              (dimension === "ENGINE" && normalization.engineRelevant)),
          defaultState:
            dimension === "ENGINE" || dimension === "FUEL"
              ? normalization.engineRelevant ? "UNKNOWN" : "NOT_APPLICABLE"
              : "ANY",
        })),
      },
    },
  });
  const clauseApplications: Array<VehiclePolicyApplication | null> = normalization.applications.length
    ? normalization.applications
    : [null];
  for (let position = 0; position < clauseApplications.length; position += 1) {
    const application = clauseApplications[position];
    const item = application ? resolved[position]! : null;
    const clause = await tx.shopCatalogCompatibilityClause.create({
      data: {
        policyId: policy.id,
        clauseKey: key("eventuri-clause", application
          ? `${application.scope ?? "auto"}|${application.make}|${application.model}|${application.generation ?? "*"}|${application.engineCode ?? "*"}`
          : `${normalization.recordKey}|unresolved`),
        position,
        verification: normalization.verification,
        sourceRecordId: input.sourceRecordId,
        sourceRef: normalization.recordKey,
        evidenceHash: input.payloadHash,
      },
    });
    const universal = policyMode === "UNIVERSAL";
    const specs: Array<{
      dimension: ShopCatalogCompatibilityDimension;
      state: "EXACT" | "ANY" | "NOT_APPLICABLE" | "UNKNOWN";
      value?: ExactValue;
    }> = application && item
      ? [
          { dimension: "SCOPE", state: "EXACT", value: { textValue: application.scope ?? "auto" } },
          { dimension: "MAKE", state: "EXACT", value: { makeId: item.make.id } },
          { dimension: "MODEL", state: "EXACT", value: { modelId: item.model.id } },
          item.generation
            ? { dimension: "GENERATION", state: "EXACT", value: { generationId: item.generation.id } }
            : { dimension: "GENERATION", state: "ANY" },
          application.generation
            ? { dimension: "CHASSIS", state: "EXACT", value: { textValue: application.generation } }
            : { dimension: "CHASSIS", state: "ANY" },
          application.yearFrom
            ? { dimension: "YEAR", state: "EXACT", value: { yearFrom: application.yearFrom, yearTo: application.yearTo } }
            : { dimension: "YEAR", state: "ANY" },
          normalization.engineRelevant
            ? item.powertrain
              ? { dimension: "ENGINE", state: "EXACT", value: { powertrainId: item.powertrain.id } }
              : { dimension: "ENGINE", state: "UNKNOWN" }
            : { dimension: "ENGINE", state: "NOT_APPLICABLE" },
          normalization.engineRelevant
            ? application.fuel
              ? { dimension: "FUEL", state: "EXACT", value: { textValue: application.fuel } }
              : { dimension: "FUEL", state: "UNKNOWN" }
            : { dimension: "FUEL", state: "NOT_APPLICABLE" },
          { dimension: "BODY_STYLE", state: "ANY" },
          { dimension: "DRIVETRAIN", state: "NOT_APPLICABLE" },
          { dimension: "TRANSMISSION", state: "NOT_APPLICABLE" },
          { dimension: "MARKET", state: "ANY" },
          { dimension: "OPF_GPF", state: "NOT_APPLICABLE" },
        ]
      : dimensions.map((dimension) => ({
          dimension,
          state:
            dimension === "SCOPE" ? "EXACT" :
            universal ? (dimension === "ENGINE" || dimension === "FUEL" ? "NOT_APPLICABLE" : "ANY") :
            (dimension === "ENGINE" || dimension === "FUEL") && !normalization.engineRelevant
              ? "NOT_APPLICABLE"
              : "UNKNOWN",
          value: dimension === "SCOPE" ? { textValue: normalization.applications[0]?.scope ?? normalization.scope ?? "auto" } : undefined,
        }));
    for (const spec of specs) await createConstraint({ tx, clauseId: clause.id, ...spec });
  }
  return { policyId: policy.id, idempotent: false, clauses: clauseApplications.length };
}
