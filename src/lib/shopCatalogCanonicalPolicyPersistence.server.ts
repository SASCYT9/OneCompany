import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { Prisma, type ShopCatalogCompatibilityDimension } from "@prisma/client";

import type {
  ShopCatalogV2CompatibilityConstraint,
  ShopCatalogV2CompatibilityPolicy,
} from "./shopCatalogV2Compatibility";
import { validateLosslessPolicyContract } from "./shopCatalogCanonicalPolicyContract";

const dimensions: Record<
  ShopCatalogCompatibilityDimension,
  ShopCatalogV2CompatibilityConstraint["dimension"]
> = {
  SCOPE: "scope",
  MAKE: "make",
  MODEL: "model",
  GENERATION: "generation",
  CHASSIS: "chassis",
  YEAR: "year",
  ENGINE: "engine",
  FUEL: "fuel",
  BODY_STYLE: "bodyStyle",
  DRIVETRAIN: "drivetrain",
  TRANSMISSION: "transmission",
  MARKET: "market",
  OPF_GPF: "opfGpf",
};

const canonicalDimensions = Object.keys(dimensions) as ShopCatalogCompatibilityDimension[];

type Scope = "auto" | "moto";

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function taxonomyKey(scope: Scope, value: string) {
  return `${scope}:${value.trim().toLowerCase()}`;
}

function powertrainKey(scope: Scope, make: string, value: string) {
  return `${scope}-powertrain:${digest(`${make.trim().toLowerCase()}|${value.trim().toLowerCase()}`)}`;
}

function exactScope(policy: ShopCatalogV2CompatibilityPolicy): Scope {
  const scopeConstraint = policy.clauses
    .flatMap((clause) => clause.constraints)
    .find((constraint) => constraint.dimension === "scope" && constraint.state === "EXACT");
  const scope = scopeConstraint?.state === "EXACT" ? scopeConstraint.values[0] : undefined;
  return scope === "moto" ? "moto" : "auto";
}

type TaxonomyContext = {
  makeId: string | null;
  modelId: string | null;
  generationId: string | null;
  powertrainId: string | null;
};

async function resolveTaxonomy(
  tx: Prisma.TransactionClient,
  input: {
    scope: Scope;
    make: string | null;
    model: string | null;
    generation: string | null;
    engine: { code: string; id: string } | null;
  }
): Promise<TaxonomyContext> {
  let makeId: string | null = null;
  let modelId: string | null = null;
  let generationId: string | null = null;
  let powertrainId: string | null = null;

  if (input.make?.trim()) {
    const normalizedMake = input.make.trim().toLowerCase();
    const make = await tx.vehicleMake.upsert({
      where: { makeKey: taxonomyKey(input.scope, input.make) },
      create: {
        makeKey: taxonomyKey(input.scope, input.make),
        scope: input.scope,
        name: input.make.trim(),
        normalizedName: normalizedMake,
      },
      update: {},
      select: { id: true, scope: true, normalizedName: true },
    });
    if (make.scope !== input.scope || make.normalizedName !== normalizedMake)
      throw new Error(`Canonical make taxonomy conflict: ${input.make}`);
    makeId = make.id;

    if (input.model?.trim()) {
      const normalizedModel = input.model.trim().toLowerCase();
      const model = await tx.vehicleModel.upsert({
        where: { modelKey: `${taxonomyKey(input.scope, input.make)}:${normalizedModel}` },
        create: {
          modelKey: `${taxonomyKey(input.scope, input.make)}:${normalizedModel}`,
          makeId: make.id,
          name: input.model.trim(),
          normalizedName: normalizedModel,
        },
        update: {},
        select: { id: true, makeId: true, normalizedName: true },
      });
      if (model.makeId !== make.id || model.normalizedName !== normalizedModel)
        throw new Error(`Canonical model taxonomy conflict: ${input.model}`);
      modelId = model.id;

      if (input.generation?.trim()) {
        const normalizedGeneration = input.generation.trim().toLowerCase();
        const generation = await tx.vehicleGeneration.upsert({
          where: {
            generationKey: `${taxonomyKey(input.scope, input.make)}:${normalizedModel}:${normalizedGeneration}`,
          },
          create: {
            generationKey: `${taxonomyKey(input.scope, input.make)}:${normalizedModel}:${normalizedGeneration}`,
            scope: input.scope,
            make: input.make.trim(),
            model: input.model.trim(),
            makeId: make.id,
            modelId: model.id,
            generationName: input.generation.trim(),
            chassisCode: input.generation.trim(),
          },
          update: {},
          select: { id: true, makeId: true, modelId: true },
        });
        if (generation.makeId !== make.id || generation.modelId !== model.id)
          throw new Error(`Canonical generation taxonomy conflict: ${input.generation}`);
        generationId = generation.id;
      }
    }

    if (input.engine?.code.trim()) {
      const powertrain = await tx.vehiclePowertrain.upsert({
        where: { powertrainKey: powertrainKey(input.scope, input.make, input.engine.code) },
        create: {
          powertrainKey: powertrainKey(input.scope, input.make, input.engine.code),
          makeId: make.id,
          code: input.engine.code.trim(),
          name: input.engine.code.trim(),
        },
        update: {},
        select: { id: true, makeId: true, code: true },
      });
      if (powertrain.makeId !== make.id || powertrain.code !== input.engine.code.trim())
        throw new Error(`Canonical powertrain taxonomy conflict: ${input.engine.code}`);
      powertrainId = powertrain.id;
    }
  }
  return { makeId, modelId, generationId, powertrainId };
}

function scopeFromConstraint(
  constraint: ShopCatalogV2CompatibilityConstraint | undefined,
  fallback: Scope
): Scope {
  if (constraint?.state === "EXACT" && constraint.values[0] === "moto") return "moto";
  return fallback;
}

function valueRows(
  constraintId: string,
  dimension: ShopCatalogCompatibilityDimension,
  constraint: ShopCatalogV2CompatibilityConstraint,
  taxonomy: TaxonomyContext
): Prisma.ShopCatalogCompatibilityValueUncheckedCreateInput[] {
  if (constraint.state !== "EXACT") return [];
  return constraint.values.map((value, ordinal) => {
    const row: Prisma.ShopCatalogCompatibilityValueUncheckedCreateInput = {
      constraintId,
      dimension,
      state: "EXACT",
      ordinal,
      textValue: typeof value === "string" ? value : null,
      numberValue: typeof value === "number" ? value : null,
      booleanValue: typeof value === "boolean" ? value : null,
      yearFrom: typeof value === "object" && value !== null && "from" in value ? value.from : null,
      yearTo: typeof value === "object" && value !== null && "to" in value ? value.to : null,
      makeId: dimension === "MAKE" ? taxonomy.makeId : null,
      modelId: dimension === "MODEL" ? taxonomy.modelId : null,
      generationId: dimension === "GENERATION" ? taxonomy.generationId : null,
      powertrainId:
        dimension === "ENGINE" && typeof value === "object" && value !== null && "kind" in value
          ? taxonomy.powertrainId
          : null,
    };
    // Preserve unresolved canonical engine text even when a reviewed clause has no taxonomy node.
    if (dimension === "ENGINE" && typeof value === "object" && value !== null && "kind" in value) {
      row.textValue = value.code;
    }
    return row;
  });
}

/**
 * Persist a validated V2 policy without converting it through the narrower
 * VehiclePolicyApplication shape. This keeps unknown make/model and multi-value
 * clauses lossless while still resolving taxonomy IDs whenever the source gives
 * enough context.
 */
export async function persistCanonicalPolicyInTransaction(input: {
  tx: Prisma.TransactionClient;
  sourceRecordId: string;
  sourceId: string;
  policy: ShopCatalogV2CompatibilityPolicy;
  label?: string;
}) {
  const errors = validateLosslessPolicyContract(input.policy);
  if (errors.length)
    throw new Error(`${input.label ?? "Canonical"} policy rejected: ${errors.join("; ")}`);

  const targetKey = input.policy.target.variantId
    ? `variant:${input.policy.target.variantId}`
    : `product:${input.policy.target.productId}`;
  const active = await input.tx.shopCatalogCompatibilityPolicy.findFirst({
    where: { targetKey, isActive: true },
    select: { id: true, sourceRecordId: true },
  });
  if (active?.sourceRecordId === input.sourceRecordId)
    return { policyId: active.id, idempotent: true };
  const latest = await input.tx.shopCatalogCompatibilityPolicy.findFirst({
    where: { targetKey },
    orderBy: { revision: "desc" },
    select: { revision: true },
  });
  if (active) {
    await input.tx.shopCatalogCompatibilityPolicy.update({
      where: { id: active.id },
      data: { isActive: false, retiredAt: new Date() },
    });
  }

  const policyScope = exactScope(input.policy);
  const rules = canonicalDimensions.map((dimension) => {
    const mapped = dimensions[dimension];
    const defaultState = input.policy.dimensionDefaults?.[mapped] ?? "UNKNOWN";
    return {
      dimension,
      isRequired: input.policy.requiredDimensions.includes(mapped),
      defaultState,
    };
  });
  const persisted = await input.tx.shopCatalogCompatibilityPolicy.create({
    data: {
      targetKey,
      productId: input.policy.target.productId,
      variantId: input.policy.target.variantId ?? undefined,
      parentProductId: input.policy.parentTarget?.productId,
      parentVariantId: input.policy.parentTarget?.variantId ?? undefined,
      mode: input.policy.mode,
      schemaVersion: input.policy.version,
      revision: (latest?.revision ?? 0) + 1,
      sourceRecordId: input.sourceRecordId,
      dimensionRules: { create: rules },
    },
    select: { id: true },
  });

  const clauseRows: Prisma.ShopCatalogCompatibilityClauseUncheckedCreateInput[] = [];
  const constraintRows: Prisma.ShopCatalogCompatibilityConstraintUncheckedCreateInput[] = [];
  const valueRows: Prisma.ShopCatalogCompatibilityValueUncheckedCreateInput[] = [];
  for (const [position, clause] of input.policy.clauses.entries()) {
    const scopeConstraint = clause.constraints.find(
      (constraint) => constraint.dimension === "scope"
    );
    const scope = scopeFromConstraint(scopeConstraint, policyScope);
    const make = clause.constraints.find((constraint) => constraint.dimension === "make");
    const model = clause.constraints.find((constraint) => constraint.dimension === "model");
    const generation = clause.constraints.find(
      (constraint) => constraint.dimension === "generation"
    );
    const engine = clause.constraints.find((constraint) => constraint.dimension === "engine");
    const context = {
      scope,
      make: make?.state === "EXACT" && typeof make.values[0] === "string" ? make.values[0] : null,
      model:
        model?.state === "EXACT" && typeof model.values[0] === "string" ? model.values[0] : null,
      generation:
        generation?.state === "EXACT" && typeof generation.values[0] === "string"
          ? generation.values[0]
          : null,
      engine:
        engine?.state === "EXACT" &&
        typeof engine.values[0] === "object" &&
        engine.values[0] !== null &&
        "kind" in engine.values[0]
          ? { code: engine.values[0].code, id: engine.values[0].powertrainId }
          : null,
    };
    const taxonomy = await resolveTaxonomy(input.tx, context);
    const clauseId = randomUUID();
    clauseRows.push({
      id: clauseId,
      policyId: persisted.id,
      clauseKey: `canonical:${digest(`${clause.id}|${position}`)}`,
      position,
      verification: clause.verification,
      sourceRecordId: input.sourceRecordId,
      sourceRef: clause.sourceRef ?? null,
      evidenceHash: null,
    });
    for (const constraint of clause.constraints) {
      const dimension = (Object.entries(dimensions).find(
        ([, value]) => value === constraint.dimension
      )?.[0] ?? "") as ShopCatalogCompatibilityDimension;
      if (!dimension) throw new Error(`Unknown canonical policy dimension ${constraint.dimension}`);
      const constraintId = randomUUID();
      constraintRows.push({ id: constraintId, clauseId, dimension, state: constraint.state });
      valueRows.push(...valueRowsForCanonical(constraintId, dimension, constraint, taxonomy));
    }
  }
  if (clauseRows.length)
    await input.tx.shopCatalogCompatibilityClause.createMany({ data: clauseRows });
  if (constraintRows.length)
    await input.tx.shopCatalogCompatibilityConstraint.createMany({ data: constraintRows });
  if (valueRows.length)
    await input.tx.shopCatalogCompatibilityValue.createMany({ data: valueRows });
  return { policyId: persisted.id, idempotent: false, clauses: clauseRows.length };
}

function valueRowsForCanonical(
  constraintId: string,
  dimension: ShopCatalogCompatibilityDimension,
  constraint: ShopCatalogV2CompatibilityConstraint,
  taxonomy: TaxonomyContext
) {
  return valueRows(constraintId, dimension, constraint, taxonomy);
}
