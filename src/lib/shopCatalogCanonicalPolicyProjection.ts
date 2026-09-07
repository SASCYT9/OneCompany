import type {
  ShopCatalogV2CompatibilityPolicy,
  ShopCatalogV2CompatibilityConstraint,
  ShopCatalogV2CompatibilityDimension,
  ShopCatalogV2CompatibilityValue,
} from "./shopCatalogV2Compatibility";

const dimension: Record<string, ShopCatalogV2CompatibilityDimension> = {
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

type CanonicalValue = {
  textValue?: string | null;
  numberValue?: number | { toString(): string } | null;
  booleanValue?: boolean | null;
  yearFrom?: number | null;
  yearTo?: number | null;
  powertrainId?: string | null;
  make?: { name: string } | null;
  model?: { name: string } | null;
  generation?: { generationName: string | null; chassisCode: string | null } | null;
  powertrain?: { code: string | null } | null;
};
type CanonicalConstraint = {
  dimension: string;
  state: "EXACT" | "ANY" | "NOT_APPLICABLE" | "UNKNOWN";
  values: readonly CanonicalValue[];
};
export type CanonicalPolicyProjectionInput = {
  productId: string;
  variantId?: string | null;
  parentProductId?: string | null;
  parentVariantId?: string | null;
  mode: ShopCatalogV2CompatibilityPolicy["mode"];
  dimensionRules?: readonly {
    dimension: string;
    isRequired: boolean;
    defaultState: "EXACT" | "ANY" | "NOT_APPLICABLE" | "UNKNOWN";
  }[];
  clauses: readonly {
    id: string;
    verification: "VERIFIED" | "INFERRED" | "NEEDS_REVIEW";
    sourceRef?: string | null;
    constraints: readonly CanonicalConstraint[];
  }[];
};

/** Maps only fully loaded canonical rows; never resolves raw engine text. */
export function canonicalPoliciesToProjectionV2(
  rows: readonly CanonicalPolicyProjectionInput[]
): ShopCatalogV2CompatibilityPolicy[] {
  return rows.map((policy) => {
    const mappedRules = (policy.dimensionRules ?? []).map((rule) => {
      const mapped = dimension[rule.dimension];
      if (!mapped) throw new TypeError(`Unknown canonical dimension rule ${rule.dimension}`);
      if (rule.defaultState === "EXACT")
        throw new TypeError(`Canonical dimension rule ${rule.dimension} cannot default to EXACT`);
      return { ...rule, mapped };
    });
    const requiredDimensions = mappedRules
      .filter((rule) => rule.isRequired)
      .map((rule) => rule.mapped);
    const dimensionDefaults = Object.fromEntries(
      mappedRules.map((rule) => [rule.mapped, rule.defaultState])
    );
    const clauses = policy.clauses.map((clause) => ({
      id: clause.id,
      verification: clause.verification,
      sourceRef: clause.sourceRef ?? null,
      constraints: clause.constraints.map((constraint) => {
        const mapped = dimension[constraint.dimension];
        if (!mapped) throw new TypeError(`Unknown canonical dimension ${constraint.dimension}`);
        if (constraint.state !== "EXACT") return { dimension: mapped, state: constraint.state };
        const values = constraint.values.map((value): ShopCatalogV2CompatibilityValue | null => {
          if (mapped === "engine") {
            if (value.powertrainId) {
              if (!value.powertrain?.code)
                throw new TypeError("Canonical ENGINE identity is incomplete");
              return {
                kind: "powertrain" as const,
                powertrainId: value.powertrainId,
                code: value.powertrain.code,
              };
            }
            if (clause.verification !== "NEEDS_REVIEW" || !value.textValue)
              throw new TypeError("Unresolved canonical ENGINE requires NEEDS_REVIEW raw text");
            return value.textValue;
          }
          if (mapped === "make") return value.make?.name ?? null;
          // A source may know a model while its make correlation is unresolved
          // (KW is the concrete case). Keep the source text instead of forcing
          // a fabricated taxonomy node; reviewed canonical clauses can still be
          // projected and remain visibly non-verified.
          if (mapped === "model") return value.model?.name ?? value.textValue ?? null;
          if (mapped === "generation")
            return value.generation?.generationName ?? value.generation?.chassisCode ?? null;
          if (mapped === "chassis") return value.textValue ?? value.generation?.chassisCode ?? null;
          if (mapped === "year") return { from: value.yearFrom ?? null, to: value.yearTo ?? null };
          return (
            value.textValue ??
            (value.numberValue === null || value.numberValue === undefined
              ? null
              : Number(value.numberValue)) ??
            value.booleanValue ??
            null
          );
        });
        if (values.some((value) => value === null || value === ""))
          throw new TypeError(`Canonical ${mapped} value is incomplete`);
        return {
          dimension: mapped,
          state: "EXACT" as const,
          values: values as ShopCatalogV2CompatibilityValue[],
        } satisfies ShopCatalogV2CompatibilityConstraint;
      }),
    }));
    return {
      version: 2,
      mode: policy.mode,
      target: { productId: policy.productId, variantId: policy.variantId ?? null },
      parentTarget: policy.parentProductId
        ? { productId: policy.parentProductId, variantId: policy.parentVariantId ?? null }
        : null,
      requiredDimensions,
      dimensionDefaults,
      clauses,
    };
  });
}
