import "server-only";
import type { PrismaClient } from "@prisma/client";
import { readCoveragePoliciesWithClient } from "./shopCatalogCoveragePolicyReader.server";
import { canonicalPoliciesToProjectionV2 } from "./shopCatalogCanonicalPolicyProjection";
import { buildShopCatalogProjection } from "./shopCatalogProjection.server";
import {
  buildNormalizationCoveragePolicy,
  type CoverageNormalization,
} from "./shopCatalogNormalizationCoverage";
import type { ShopCatalogV2CompatibilityPolicy } from "./shopCatalogV2Compatibility";
import {
  compareSelectorCoverage,
  selectorPoliciesFromProjection,
} from "./shopCatalogSelectorCoverage";

type CoverageDraft = {
  normalization: CoverageNormalization & {
    compatibilityPolicy?: ShopCatalogV2CompatibilityPolicy | null;
  };
  sourceRecord: { recordKey: string };
};

/** Offline, bounded DB pages. Does not run in a storefront request or write projections. */
export async function auditShopCatalogSelectorCoverageWithClient(
  client: PrismaClient,
  sources: ReadonlyMap<string, readonly CoverageDraft[]>
) {
  const reports = [];
  for (const [source, drafts] of sources) {
    const report = {
      source,
      targets: drafts.length,
      canonicalPolicies: 0,
      normalizedClauses: 0,
      canonicalClauses: 0,
      projectedClauses: 0,
      verifiedClauses: 0,
      reviewClauses: 0,
      failedTargets: 0,
      missingSignatures: 0,
      extraSignatures: 0,
      samples: [] as Array<{ target: string; stage: string; detail: unknown }>,
    };
    const targetOf = (normalization: CoverageNormalization) =>
      normalization.variantId
        ? `variant:${normalization.variantId}`
        : `product:${normalization.productId}`;
    for (let start = 0; start < drafts.length; start += 50) {
      const page = drafts.slice(start, start + 50);
      const rows = await readCoveragePoliciesWithClient(
        client,
        page.map((draft) => targetOf(draft.normalization))
      );
      for (const draft of page) {
        const target = targetOf(draft.normalization);
        let failed = false;
        const failure = (stage: string, detail: unknown) => {
          failed = true;
          if (report.samples.length < 10) report.samples.push({ target, stage, detail });
        };
        try {
          const owned = rows.filter((row) => row.targetKey === target);
          if (
            owned.length !== 1 ||
            owned.some(
              (row) =>
                row.sourceRecord?.recordKey !== draft.sourceRecord.recordKey ||
                row.sourceRecord.source.key !== `gate-${source}`
            )
          )
            failure("canonical-owner", { policies: owned.length });
          const expectedPolicies = source === "revozport" && draft.normalization.compatibilityPolicy
            ? [draft.normalization.compatibilityPolicy]
            : [buildNormalizationCoveragePolicy(source, draft.normalization)];
          const canonical = canonicalPoliciesToProjectionV2(owned);
          report.canonicalPolicies += canonical.length;
          report.normalizedClauses += expectedPolicies.reduce((sum, policy) => sum + policy.clauses.length, 0);
          report.canonicalClauses += canonical.reduce(
            (sum, policy) => sum + policy.clauses.length,
            0
          );
          for (const policy of canonical)
            for (const clause of policy.clauses) {
              if (clause.verification === "VERIFIED") report.verifiedClauses++;
              else report.reviewClauses++;
            }
          const normalizedParity = compareSelectorCoverage(expectedPolicies, canonical, {
            caseInsensitiveTaxonomy: true,
          });
          report.missingSignatures += normalizedParity.missingCount;
          report.extraSignatures += normalizedParity.extraCount;
          if (!normalizedParity.passed) failure("normalization-to-canonical", normalizedParity);

          // Minimal envelope isolates compatibility through the real projection builder.
          // Commerce promotion, projection DB writes and storefront option endpoints are separate gates.
          const productId = draft.normalization.productId;
          const build = buildShopCatalogProjection({
            productId,
            sourceVersion: "1",
            canonicalContentHash: "0".repeat(64),
            canonicalRelationCounts: {},
            slug: productId,
            scopeKey: "coverage",
            statusKey: "DRAFT",
            stockKey: "OUT_OF_STOCK",
            isPublished: false,
            stableRank: 0,
            brand: { key: source, labelUa: source, labelEn: source },
            locales: { ua: { title: productId }, en: { title: productId } },
            variants: draft.normalization.variantId
              ? [{ variantId: draft.normalization.variantId, stableRank: 0 }]
              : [],
            compatibilityPolicies: canonical,
          });
          const projected = selectorPoliciesFromProjection(build);
          report.projectedClauses += build.compatibilityClauses.length;
          const projectionParity = compareSelectorCoverage(canonical, projected, {
            canonicalIdentity: true,
            policyRules: true,
            clauseIdentity: true,
          });
          report.missingSignatures += projectionParity.missingCount;
          report.extraSignatures += projectionParity.extraCount;
          if (!projectionParity.passed) failure("canonical-to-projection-build", projectionParity);
        } catch (error) {
          failure("validation", error instanceof Error ? error.message : String(error));
        }
        if (failed) report.failedTargets++;
      }
    }
    reports.push(report);
    process.stdout.write(
      `[selector-coverage] ${source}: ${report.targets} targets, ${report.failedTargets} failed\n`
    );
  }
  return {
    passed: reports.every((report) => report.failedTargets === 0),
    scope: "normalized evidence -> persisted canonical policies -> in-memory projection builder",
    limits:
      "Does not certify raw-source extraction completeness, projection DB publication, storefront option endpoints or production coverage.",
    pageSize: 50,
    sources: reports,
  };
}
