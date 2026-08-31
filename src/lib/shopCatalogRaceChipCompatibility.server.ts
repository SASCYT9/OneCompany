import "server-only";

import { createHash } from "node:crypto";

import { Prisma, type ShopCatalogCompatibilityDimension } from "@prisma/client";

import type { RaceChipNormalization } from "./shopCatalogRaceChipNormalization";

const dimensions: ShopCatalogCompatibilityDimension[] = [
  "SCOPE",
  "MAKE",
  "MODEL",
  "GENERATION",
  "CHASSIS",
  "YEAR",
  "ENGINE",
  "FUEL",
  "BODY_STYLE",
  "DRIVETRAIN",
  "TRANSMISSION",
  "MARKET",
  "OPF_GPF",
];

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function key(prefix: string, value: string) {
  return `${prefix}:${digest(value).slice(0, 24)}`;
}

export async function persistRaceChipCompatibilityInTransaction(input: {
  tx: Prisma.TransactionClient;
  sourceId: string;
  sourceRecordId: string;
  payloadHash: string;
  normalization: RaceChipNormalization;
}) {
  const { tx, normalization } = input;
  const normalizedMake = normalization.make.trim().toLowerCase();
  const makeKey = `auto:${normalizedMake}`;
  const make = await tx.vehicleMake.upsert({
    where: { makeKey },
    create: {
      makeKey,
      scope: "auto",
      name: normalization.make,
      normalizedName: normalizedMake,
    },
    update: {},
  });
  if (make.scope !== "auto" || make.normalizedName !== normalizedMake) {
    throw new Error(`RaceChip make taxonomy conflict: ${makeKey}`);
  }
  const normalizedModel = normalization.model.trim().toLowerCase();
  const modelKey = `auto:${normalizedMake}:${normalizedModel}`;
  const model = await tx.vehicleModel.upsert({
    where: { modelKey },
    create: {
      modelKey,
      makeId: make.id,
      name: normalization.model,
      normalizedName: normalizedModel,
    },
    update: {},
  });
  if (model.makeId !== make.id || model.normalizedName !== normalizedModel) {
    throw new Error(`RaceChip model taxonomy conflict: ${modelKey}`);
  }

  const generation = normalization.generation
    ? await tx.vehicleGeneration.upsert({
        where: {
          generationKey: `auto:${normalizedMake}:${normalizedModel}:${normalization.generation.toLowerCase()}`,
        },
        create: {
          generationKey: `auto:${normalizedMake}:${normalizedModel}:${normalization.generation.toLowerCase()}`,
          scope: "auto",
          make: normalization.make,
          model: normalization.model,
          makeId: make.id,
          modelId: model.id,
          generationName: normalization.generation,
          chassisCode: normalization.generation,
          yearFrom: normalization.yearFrom,
          yearTo: normalization.yearTo,
        },
        update: {},
      })
    : null;
  if (
    generation &&
    (generation.makeId !== make.id ||
      generation.modelId !== model.id ||
      generation.generationName?.toLowerCase() !== normalization.generation?.toLowerCase())
  ) {
    throw new Error(`RaceChip generation taxonomy conflict: ${generation.generationKey}`);
  }

  const powertrainKey = key(
    "auto-powertrain",
    `${normalizedMake}|${normalization.engineDescriptor}|${normalization.fuel ?? "unknown"}`
  );
  const powertrain = await tx.vehiclePowertrain.upsert({
    where: { powertrainKey },
    create: {
      powertrainKey,
      makeId: make.id,
      code: normalization.engineDescriptor,
      name: normalization.engineDescriptor,
      fuelKey: normalization.fuel,
    },
    update: {},
  });
  if (
    powertrain.makeId !== make.id ||
    powertrain.code !== normalization.engineDescriptor ||
    powertrain.fuelKey !== normalization.fuel
  ) {
    throw new Error(`RaceChip powertrain taxonomy conflict: ${powertrainKey}`);
  }

  const configuration = generation
    ? await tx.vehicleConfiguration.upsert({
        where: { configurationKey: key("auto-configuration", normalization.configurationKey) },
        create: {
          configurationKey: key("auto-configuration", normalization.configurationKey),
          generationId: generation.id,
          powertrainId: powertrain.id,
          yearFrom: normalization.yearFrom,
          yearTo: normalization.yearTo,
          fuelKey: normalization.fuel,
        },
        update: {},
      })
    : null;
  if (
    configuration &&
    (configuration.generationId !== generation?.id ||
      configuration.powertrainId !== powertrain.id ||
      configuration.yearFrom !== normalization.yearFrom ||
      configuration.yearTo !== normalization.yearTo ||
      configuration.fuelKey !== normalization.fuel)
  ) {
    throw new Error(`RaceChip configuration taxonomy conflict: ${configuration.configurationKey}`);
  }

  const aliases = [
    { entityType: "MAKE" as const, alias: normalization.make, makeId: make.id },
    {
      entityType: "MODEL" as const,
      alias: normalization.model,
      modelId: model.id,
      parentMakeId: make.id,
    },
    ...(generation
      ? [{
          entityType: "GENERATION" as const,
          alias: normalization.generation!,
          generationId: generation.id,
          parentMakeId: make.id,
          parentModelId: model.id,
        }]
      : []),
    {
      entityType: "POWERTRAIN" as const,
      alias: normalization.engineDescriptor,
      powertrainId: powertrain.id,
      parentMakeId: make.id,
    },
    ...(configuration
      ? [{
          entityType: "CONFIGURATION" as const,
          alias: normalization.configurationKey,
          configurationId: configuration.id,
          parentMakeId: make.id,
          parentModelId: model.id,
          parentGenerationId: generation!.id,
        }]
      : []),
  ];
  for (const alias of aliases) {
    const normalizedAlias = alias.alias.trim().toLowerCase();
    const aliasKey = key(
      "racechip-alias",
      `${alias.entityType}|${"makeId" in alias ? alias.makeId : ""}|${"modelId" in alias ? alias.modelId : ""}|${"generationId" in alias ? alias.generationId : ""}|${"powertrainId" in alias ? alias.powertrainId : ""}|${"configurationId" in alias ? alias.configurationId : ""}|${alias.parentMakeId ?? ""}|${alias.parentModelId ?? ""}|${"parentGenerationId" in alias ? alias.parentGenerationId : ""}|${normalizedAlias}`
    );
    const persisted = await tx.vehicleTaxonomyAlias.upsert({
      where: { sourceId_aliasKey: { sourceId: input.sourceId, aliasKey } },
      create: {
        sourceId: input.sourceId,
        aliasKey,
        entityType: alias.entityType,
        scope: "auto",
        alias: alias.alias,
        normalizedAlias,
        makeId: "makeId" in alias ? alias.makeId : undefined,
        modelId: "modelId" in alias ? alias.modelId : undefined,
        generationId: "generationId" in alias ? alias.generationId : undefined,
        powertrainId: "powertrainId" in alias ? alias.powertrainId : undefined,
        configurationId: "configurationId" in alias ? alias.configurationId : undefined,
        parentMakeId: alias.parentMakeId,
        parentModelId: alias.parentModelId,
        parentGenerationId: "parentGenerationId" in alias ? alias.parentGenerationId : undefined,
      },
      update: {},
    });
    if (
      persisted.entityType !== alias.entityType ||
      persisted.scope !== "auto" ||
      persisted.normalizedAlias !== normalizedAlias ||
      persisted.makeId !== ("makeId" in alias ? alias.makeId : null) ||
      persisted.modelId !== ("modelId" in alias ? alias.modelId : null) ||
      persisted.generationId !== ("generationId" in alias ? alias.generationId : null) ||
      persisted.powertrainId !== ("powertrainId" in alias ? alias.powertrainId : null) ||
      persisted.configurationId !== ("configurationId" in alias ? alias.configurationId : null)
    ) {
      throw new Error(`RaceChip taxonomy alias conflict: ${aliasKey}`);
    }
  }

  const targetKey = `variant:${normalization.variantId}`;
  const active = await tx.shopCatalogCompatibilityPolicy.findFirst({
    where: { targetKey, isActive: true },
    select: { id: true, revision: true, sourceRecordId: true },
  });
  if (active?.sourceRecordId === input.sourceRecordId) {
    return { policyId: active.id, idempotent: true, makeId: make.id, modelId: model.id };
  }
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

  const exact = normalization.verification === "VERIFIED";
  const policy = await tx.shopCatalogCompatibilityPolicy.create({
    data: {
      targetKey,
      productId: normalization.productId,
      variantId: normalization.variantId,
      mode: exact ? "VEHICLE_SPECIFIC" : "NEEDS_REVIEW",
      revision: (latest?.revision ?? 0) + 1,
      sourceRecordId: input.sourceRecordId,
      dimensionRules: {
        create: dimensions.map((dimension) => ({
          dimension,
          isRequired:
            ["SCOPE", "MAKE", "MODEL", "YEAR", "ENGINE", "FUEL"].includes(dimension) ||
            (dimension === "GENERATION" && Boolean(generation)),
          defaultState:
            dimension === "GENERATION" && !generation
              ? "ANY"
              : ["CHASSIS", "BODY_STYLE", "DRIVETRAIN", "TRANSMISSION", "MARKET", "OPF_GPF"].includes(dimension)
                ? "NOT_APPLICABLE"
                : "UNKNOWN",
        })),
      },
    },
  });
  const clause = await tx.shopCatalogCompatibilityClause.create({
    data: {
      policyId: policy.id,
      clauseKey: key("racechip-clause", normalization.recordKey),
      position: 0,
      verification: exact ? "VERIFIED" : "NEEDS_REVIEW",
      sourceRecordId: input.sourceRecordId,
      sourceRef: normalization.recordKey,
      evidenceHash: input.payloadHash,
    },
  });

  const specs: Array<{
    dimension: ShopCatalogCompatibilityDimension;
    state: "EXACT" | "ANY" | "NOT_APPLICABLE" | "UNKNOWN";
    value?: Omit<
      Prisma.ShopCatalogCompatibilityValueUncheckedCreateInput,
      "constraintId" | "dimension" | "state"
    >;
  }> = [
    { dimension: "SCOPE", state: "EXACT", value: { textValue: "auto" } },
    { dimension: "MAKE", state: "EXACT", value: { makeId: make.id } },
    { dimension: "MODEL", state: "EXACT", value: { modelId: model.id } },
    generation
      ? { dimension: "GENERATION", state: "EXACT", value: { generationId: generation.id } }
      : { dimension: "GENERATION", state: "ANY" },
    { dimension: "CHASSIS", state: "NOT_APPLICABLE" },
    {
      dimension: "YEAR",
      state: "EXACT",
      value: { yearFrom: normalization.yearFrom, yearTo: normalization.yearTo },
    },
    { dimension: "ENGINE", state: "EXACT", value: { powertrainId: powertrain.id } },
    normalization.fuel
      ? { dimension: "FUEL", state: "EXACT", value: { textValue: normalization.fuel } }
      : { dimension: "FUEL", state: "UNKNOWN" },
    { dimension: "BODY_STYLE", state: "NOT_APPLICABLE" },
    { dimension: "DRIVETRAIN", state: "NOT_APPLICABLE" },
    { dimension: "TRANSMISSION", state: "NOT_APPLICABLE" },
    { dimension: "MARKET", state: "NOT_APPLICABLE" },
    { dimension: "OPF_GPF", state: "NOT_APPLICABLE" },
  ];
  for (const spec of specs) {
    const constraint = await tx.shopCatalogCompatibilityConstraint.create({
      data: { clauseId: clause.id, dimension: spec.dimension, state: spec.state },
    });
    if (spec.value) {
      await tx.shopCatalogCompatibilityValue.create({
        data: {
          constraintId: constraint.id,
          dimension: spec.dimension,
          state: "EXACT",
          ...spec.value,
        },
      });
    }
  }
  return {
    policyId: policy.id,
    idempotent: false,
    makeId: make.id,
    modelId: model.id,
    generationId: generation?.id ?? null,
    powertrainId: powertrain.id,
    configurationId: configuration?.id ?? null,
  };
}
