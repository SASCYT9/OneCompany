export type CatalogExplainPlan = {
  "Node Type": string;
  "Relation Name"?: string;
  Plans?: CatalogExplainPlan[];
};

export type CatalogExplainResult = {
  Plan: CatalogExplainPlan;
  "Planning Time": number;
  "Execution Time": number;
};

export type CatalogScaleMeasurement = {
  scenario: string;
  coldMs: number;
  warmSamplesMs: readonly number[];
  warmP95Ms: number;
  scannedRelations: readonly string[];
  sequentialRelations: readonly string[];
};

export const CATALOG_SCALE_GATE_LIMITS = Object.freeze({
  coldMs: 500,
  warmP95Ms: 100,
  warmRuns: 5,
});

function percentile95(values: readonly number[]) {
  if (values.length === 0) throw new TypeError("at least one warm sample is required");
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}

function collectPlanRelations(
  plan: CatalogExplainPlan,
  scanned: Set<string>,
  sequential: Set<string>
) {
  if (plan["Relation Name"]) {
    scanned.add(plan["Relation Name"]);
    if (plan["Node Type"] === "Seq Scan") sequential.add(plan["Relation Name"]);
  }
  for (const child of plan.Plans ?? []) collectPlanRelations(child, scanned, sequential);
}

export function buildCatalogScaleMeasurement(input: {
  scenario: string;
  cold: CatalogExplainResult;
  warm: readonly CatalogExplainResult[];
}): CatalogScaleMeasurement {
  const scanned = new Set<string>();
  const sequential = new Set<string>();
  for (const result of [input.cold, ...input.warm]) {
    collectPlanRelations(result.Plan, scanned, sequential);
  }
  const warmSamplesMs = input.warm.map((sample) => sample["Execution Time"]);
  return Object.freeze({
    scenario: input.scenario,
    coldMs: input.cold["Execution Time"],
    warmSamplesMs: Object.freeze(warmSamplesMs),
    warmP95Ms: percentile95(warmSamplesMs),
    scannedRelations: Object.freeze([...scanned].sort()),
    sequentialRelations: Object.freeze([...sequential].sort()),
  });
}

export function assertCatalogScaleMeasurement(
  measurement: CatalogScaleMeasurement,
  largeRelations: ReadonlySet<string>
) {
  if (measurement.coldMs >= CATALOG_SCALE_GATE_LIMITS.coldMs) {
    throw new Error(
      `${measurement.scenario} cold query ${measurement.coldMs.toFixed(2)}ms exceeds ${CATALOG_SCALE_GATE_LIMITS.coldMs}ms`
    );
  }
  if (measurement.warmP95Ms >= CATALOG_SCALE_GATE_LIMITS.warmP95Ms) {
    throw new Error(
      `${measurement.scenario} warm p95 ${measurement.warmP95Ms.toFixed(2)}ms exceeds ${CATALOG_SCALE_GATE_LIMITS.warmP95Ms}ms`
    );
  }
  const forbidden = measurement.sequentialRelations.filter((relation) =>
    largeRelations.has(relation)
  );
  if (forbidden.length > 0) {
    throw new Error(`${measurement.scenario} performs sequential scans: ${forbidden.join(", ")}`);
  }
}
