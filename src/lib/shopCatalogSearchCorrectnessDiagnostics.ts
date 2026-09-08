import { extractProductFitment, type Fitment } from "@/lib/crossShopFitment";
import { shopFitmentMatchesVehicleConstraints } from "@/lib/shopVehicleConstraints";
import { canonicalVehicleMakeLabel } from "@/lib/shopVehicleTaxonomy";

export type CatalogSearchDiagnosticProduct = {
  id?: string;
  slug: string;
  scope?: string | null;
  brand?: string | null;
  vendor?: string | null;
  tags?: string[] | null;
  title?: { ua?: string | null; en?: string | null } | null;
  [key: string]: unknown;
};

export type CatalogSearchVehicleQuery = {
  make: string;
  model?: string | null;
  chassis?: string | null;
  year?: number | null;
};

type CoverageCounts = {
  total: number;
  auto: number;
  moto: number;
  otherScope: number;
  withMake: number;
  withModel: number;
  withChassis: number;
  missingMake: number;
  missingModel: number;
  missingChassis: number;
  ambiguousMakeEvidence: number;
};

export type CatalogSearchCorrectnessReport = {
  version: 1;
  evidence: {
    kind: "legacy_snapshot";
    canonicalPolicies: "not_observed_without_database";
    projectionClauses: "not_observed_without_database";
  };
  totals: CoverageCounts;
  stores: Record<string, CoverageCounts>;
  query: CatalogSearchVehicleQuery;
  queryMatches: Array<{
    slug: string;
    title: string;
    scope: string;
    fitment: Fitment;
    declaredMakes: string[];
    suspicious: boolean;
    reason: string | null;
  }>;
};

function emptyCounts(): CoverageCounts {
  return {
    total: 0,
    auto: 0,
    moto: 0,
    otherScope: 0,
    withMake: 0,
    withModel: 0,
    withChassis: 0,
    missingMake: 0,
    missingModel: 0,
    missingChassis: 0,
    ambiguousMakeEvidence: 0,
  };
}

function tagValues(product: CatalogSearchDiagnosticProduct, prefix: string) {
  return (product.tags ?? [])
    .filter((tag) => tag.toLocaleLowerCase().startsWith(prefix))
    .map((tag) => tag.slice(prefix.length).trim())
    .filter(Boolean);
}

/** Vehicle makes stated by source brand tags, separate from parser-derived evidence. */
export function declaredVehicleMakes(product: CatalogSearchDiagnosticProduct) {
  return [
    ...new Set(tagValues(product, "brand:").map(canonicalVehicleMakeLabel).filter(Boolean)),
  ].sort();
}

export function diagnoseLegacySnapshotProduct(product: CatalogSearchDiagnosticProduct) {
  const fitment = extractProductFitment(product as never);
  const declaredMakes = declaredVehicleMakes(product);
  const taggedFitmentMakes = tagValues(product, "fits-make:").map(canonicalVehicleMakeLabel);
  const fittedMake = canonicalVehicleMakeLabel(fitment.make ?? "");
  const conflictingDeclaredMakes = fittedMake
    ? [...declaredMakes, ...taggedFitmentMakes].filter((make) => make !== fittedMake)
    : [...declaredMakes, ...taggedFitmentMakes];
  return {
    fitment,
    declaredMakes,
    ambiguousMakeEvidence: Boolean(fittedMake && conflictingDeclaredMakes.length),
    reason:
      fittedMake && conflictingDeclaredMakes.length
        ? `parsed fitment make ${fittedMake} conflicts with source vehicle tags ${[
            ...new Set(conflictingDeclaredMakes),
          ].join(", ")}`
        : null,
  };
}

function recordCoverage(counts: CoverageCounts, product: CatalogSearchDiagnosticProduct) {
  counts.total += 1;
  if (product.scope === "auto") counts.auto += 1;
  else if (product.scope === "moto") counts.moto += 1;
  else counts.otherScope += 1;
  const diagnosis = diagnoseLegacySnapshotProduct(product);
  if (diagnosis.fitment.make) counts.withMake += 1;
  else counts.missingMake += 1;
  if (diagnosis.fitment.models.length) counts.withModel += 1;
  else counts.missingModel += 1;
  if (diagnosis.fitment.chassisCodes.length) counts.withChassis += 1;
  else counts.missingChassis += 1;
  if (diagnosis.ambiguousMakeEvidence) counts.ambiguousMakeEvidence += 1;
}

/**
 * Produces only facts observable in a DB-less fallback snapshot. Canonical
 * policy/projection coverage is intentionally reported as unobserved so this
 * diagnostic cannot be mistaken for a production readiness gate.
 */
export function auditLegacySnapshotCatalog(input: {
  stores: Record<string, readonly CatalogSearchDiagnosticProduct[]>;
  query: CatalogSearchVehicleQuery;
}): CatalogSearchCorrectnessReport {
  const totals = emptyCounts();
  const stores: Record<string, CoverageCounts> = {};
  const queryMatches: CatalogSearchCorrectnessReport["queryMatches"] = [];
  for (const [store, products] of Object.entries(input.stores).sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    const counts = emptyCounts();
    for (const product of products) {
      recordCoverage(counts, product);
      recordCoverage(totals, product);
      const diagnosis = diagnoseLegacySnapshotProduct(product);
      const suspiciousRequestedMake =
        diagnosis.ambiguousMakeEvidence &&
        tagValues(product, "fits-make:").some(
          (value) =>
            canonicalVehicleMakeLabel(value) === canonicalVehicleMakeLabel(input.query.make)
        );
      if (
        shopFitmentMatchesVehicleConstraints(diagnosis.fitment, {
          make: input.query.make,
          model: input.query.model,
          chassis: input.query.chassis,
          year: input.query.year,
        }) ||
        suspiciousRequestedMake
      ) {
        queryMatches.push({
          slug: product.slug,
          title: product.title?.en || product.title?.ua || product.slug,
          scope: product.scope ?? "unknown",
          fitment: diagnosis.fitment,
          declaredMakes: diagnosis.declaredMakes,
          suspicious: diagnosis.ambiguousMakeEvidence,
          reason: diagnosis.reason,
        });
      }
    }
    stores[store] = counts;
  }
  return {
    version: 1,
    evidence: {
      kind: "legacy_snapshot",
      canonicalPolicies: "not_observed_without_database",
      projectionClauses: "not_observed_without_database",
    },
    totals,
    stores,
    query: input.query,
    queryMatches: queryMatches.sort((left, right) => left.slug.localeCompare(right.slug)),
  };
}
