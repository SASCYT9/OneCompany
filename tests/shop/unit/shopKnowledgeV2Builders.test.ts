import assert from "node:assert/strict";
import test from "node:test";

import { buildShopKnowledgeV2 } from "../../../src/lib/shopKnowledgeV2/builders";
import {
  knowledgeSourceProduct,
  verifiedF80FitmentMetafield,
  verifiedManagerF80Application,
} from "./shopKnowledgeV2TestFixture";

function verifiedBmwApplicationsMetafield(
  applications: Array<{
    vehicleType: "car";
    make: string;
    models: string[];
    chassisCodes: string[];
    yearRanges: Array<{ from: number; to: number | null }>;
    engines: string[];
    bodyStyles: string[];
    drivetrains: string[];
    markets: string[];
  }>
) {
  const primary = applications[0];
  return {
    ...verifiedF80FitmentMetafield(),
    value: JSON.stringify({
      version: 2,
      status: "verified",
      vehicleType: "car",
      make: primary.make,
      models: primary.models,
      chassisCodes: primary.chassisCodes,
      yearRanges: primary.yearRanges,
      applications,
      confidence: "high",
      source: "manual",
      verifiedAt: "2026-07-17T09:00:00.000Z",
      verifiedBy: "manager-1",
      note: null,
    }),
  };
}

test("builds correlated verified normalized fitment as a manual override", () => {
  const build = buildShopKnowledgeV2(
    knowledgeSourceProduct({ metafields: [verifiedF80FitmentMetafield()] })
  );
  const base = build.applications.find((application) => application.variantId === null);

  assert.ok(base);
  assert.equal(base.make, "BMW");
  assert.equal(base.model, "M3");
  assert.equal(base.chassisCode, "F80");
  assert.equal(base.yearFrom, 2014);
  assert.equal(base.yearTo, 2020);
  assert.equal(base.engine, "S55");
  assert.equal(base.market, "EU");
  assert.equal(base.fitmentStatus, "verified");
  assert.equal(base.source, "manual_fitment");
  assert.equal(base.sourcePriority, 2);
  assert.equal(base.contentHash.length, 64);
  const sourceEvidence = build.evidence.find(
    (evidence) => evidence.evidenceKey === base.evidenceKey
  );
  assert.equal(sourceEvidence?.verifiedBy, "manager-1");
});

test("keeps unverified variant attributes out of a verified fitment application", () => {
  const build = buildShopKnowledgeV2(
    knowledgeSourceProduct({ metafields: [verifiedF80FitmentMetafield()] })
  );
  const variant = build.variants[0];
  const variantApplication = build.applications.find(
    (application) => application.variantId === variant.variantId
  );

  assert.equal(variant.optionValues.Filter, "Non-OPF");
  assert.equal(variant.optionValues.Material, "Titanium");
  assert.ok(variant.searchText.includes("non opf"));
  assert.equal(variantApplication?.opfGpf, "unknown");
  assert.equal(variantApplication?.material, null);
  assert.equal(
    variant.attributes.some(
      (attribute) => attribute.key === "opfGpf" && attribute.value === "without"
    ),
    true
  );
  assert.equal(
    variant.attributes.some(
      (attribute) => attribute.key === "material" && attribute.value === "titanium"
    ),
    true
  );
});

test("verified fitment never promotes poisoned description attributes", () => {
  const build = buildShopKnowledgeV2(
    knowledgeSourceProduct({
      metafields: [verifiedF80FitmentMetafield()],
      shortDescEn: "Poisoned supplier prose: non-OPF titanium downpipe with +999 hp.",
    })
  );
  const application = build.applications.find((candidate) => candidate.variantId === null);

  assert.ok(application);
  assert.equal(application.source, "manual_fitment");
  assert.equal(application.fitmentStatus, "verified");
  assert.equal(application.opfGpf, "unknown");
  assert.equal(application.material, null);
  assert.equal(application.productKind, null);
});

test("legacy normalized-fitment MANAGER rows cannot self-reproduce or retain poisoned facts", () => {
  const legacyManagerApplication = {
    ...verifiedManagerF80Application(),
    applicationKey: "legacy-normalized-manager-row",
    opfGpf: "without",
    material: "titanium",
    productKind: "downpipe",
    evidence: [
      {
        ...verifiedManagerF80Application().evidence[0],
        evidenceKey: "legacy-normalized-manager-evidence",
        fieldPath: "applications.legacy-normalized-manager-row",
        sourceRef: "neutral:metafield:onecompany.normalized_fitment",
        extractorVersion: "2.0.0",
      },
    ],
  };
  const build = buildShopKnowledgeV2(
    knowledgeSourceProduct({
      metafields: [verifiedF80FitmentMetafield()],
      managerApplications: [legacyManagerApplication],
      shortDescEn: "Poisoned description: non-OPF titanium downpipe.",
    })
  );
  const application = build.applications.find((candidate) => candidate.variantId === null);

  assert.ok(application);
  assert.notEqual(application.applicationKey, legacyManagerApplication.applicationKey);
  assert.equal(application.source, "manual_fitment");
  assert.equal(application.sourcePriority, 2);
  assert.equal(application.opfGpf, "unknown");
  assert.equal(application.material, null);
  assert.equal(application.productKind, null);
  assert.equal(
    build.applications.some((candidate) => candidate.source === "manager"),
    false
  );
});

test("preserves canonical manager variant fitment and rich facts across reindex", () => {
  const build = buildShopKnowledgeV2(
    knowledgeSourceProduct({
      metafields: [verifiedF80FitmentMetafield()],
      managerApplications: [verifiedManagerF80Application()],
    })
  );

  assert.equal(build.applications.length, 1);
  const application = build.applications[0];
  assert.equal(application.applicationKey, "canonical-manager-application-f80-non-opf");
  assert.equal(application.variantId, "variant-non-opf");
  assert.equal(application.generation, "F8x");
  assert.equal(application.chassisCode, "F80");
  assert.equal(application.engine, "S55");
  assert.equal(application.fuel, "petrol");
  assert.equal(application.transmission, "DCT");
  assert.equal(application.opfGpf, "without");
  assert.equal(application.productKind, "system");
  assert.equal(application.material, "titanium");
  assert.equal(application.source, "manager");
  assert.equal(application.sourcePriority, 1);
  assert.equal(application.fitmentStatus, "verified");
  assert.equal(
    build.applications.some(
      (candidate) =>
        candidate.applicationKey !== application.applicationKey &&
        candidate.model === "M3" &&
        candidate.chassisCode === "F80"
    ),
    false
  );
  const evidence = build.evidence.find(
    (candidate) => candidate.evidenceKey === application.evidenceKey
  );
  assert.equal(evidence?.source, "manager");
  assert.equal(evidence?.sourceRef, "manager:fitment-certificate-42");
  assert.equal(evidence?.extractorVersion, "admin-v1");
  assert.equal(evidence?.isManagerVerified, true);
  assert.equal(evidence?.excerpt, "Manager verified BMW M3 F80 S55 DCT non-OPF titanium system.");
  assert.equal(build.searchText.includes("f8x"), true);
  assert.equal(build.searchText.includes("dct"), true);
});

test("manager strict block survives a later source reindex", () => {
  const build = buildShopKnowledgeV2(
    knowledgeSourceProduct({
      metafields: [verifiedF80FitmentMetafield()],
      managerStrictBlock: true,
    })
  );

  assert.equal(build.status, "BLOCKED");
  assert.equal(build.qualityFlags.includes("blocked_strict:manager"), true);
  assert.equal(build.applications.length, 0);
});

test("preserves explicit M3/F80 and M4/F82 source applications without cross-pairing", () => {
  const metafield = verifiedBmwApplicationsMetafield([
    {
      vehicleType: "car",
      make: "BMW",
      models: ["M3"],
      chassisCodes: ["F80"],
      yearRanges: [{ from: 2014, to: 2020 }],
      engines: ["S55"],
      bodyStyles: ["sedan"],
      drivetrains: ["RWD"],
      markets: ["EU"],
    },
    {
      vehicleType: "car",
      make: "BMW",
      models: ["M4"],
      chassisCodes: ["F82"],
      yearRanges: [{ from: 2014, to: 2020 }],
      engines: ["S55"],
      bodyStyles: ["coupe"],
      drivetrains: ["RWD"],
      markets: ["EU"],
    },
  ]);
  const build = buildShopKnowledgeV2(
    knowledgeSourceProduct({ variants: [], options: [], metafields: [metafield] })
  );
  const pairs = build.applications.map(
    (application) => `${application.model}/${application.chassisCode}`
  );

  assert.deepEqual(pairs.sort(), ["M3/F80", "M4/F82"]);
  assert.equal(pairs.includes("M3/F82"), false);
  assert.equal(pairs.includes("M4/F80"), false);
  assert.equal(
    build.applications.every((application) => application.fitmentStatus === "verified"),
    true
  );
});

test("reduces uncorrelated multi-value fitment to one review-only application", () => {
  const metafield = verifiedBmwApplicationsMetafield([
    {
      vehicleType: "car",
      make: "BMW",
      models: ["M3", "M4"],
      chassisCodes: ["F80", "F82"],
      yearRanges: [{ from: 2014, to: 2020 }],
      engines: ["S55"],
      bodyStyles: [],
      drivetrains: ["RWD"],
      markets: ["EU"],
    },
  ]);
  const build = buildShopKnowledgeV2(
    knowledgeSourceProduct({ variants: [], options: [], metafields: [metafield] })
  );

  assert.equal(build.applications.length, 1);
  assert.equal(build.applications[0].make, "BMW");
  assert.equal(build.applications[0].model, null);
  assert.equal(build.applications[0].chassisCode, null);
  assert.equal(build.applications[0].engine, "S55");
  assert.equal(build.applications[0].fitmentStatus, "needs_review");
  assert.equal(build.applications[0].confidence, "unknown");
  assert.equal(build.qualityFlags.includes("fitment_correlation_needs_review"), true);
  assert.equal(build.status, "NEEDS_REVIEW");
  const evidence = build.evidence.find(
    (item) => item.evidenceKey === build.applications[0].evidenceKey
  );
  const excerpt = JSON.parse(evidence?.excerpt ?? "{}") as {
    uncorrelatedSourceApplication?: { models?: string[]; chassisCodes?: string[] };
  };
  assert.deepEqual(excerpt.uncorrelatedSourceApplication?.models, ["M3", "M4"]);
  assert.deepEqual(excerpt.uncorrelatedSourceApplication?.chassisCodes, ["F80", "F82"]);
});

test("content hashes are idempotent and change only when indexed content changes", () => {
  const product = knowledgeSourceProduct({ metafields: [verifiedF80FitmentMetafield()] });
  const first = buildShopKnowledgeV2(product);
  const second = buildShopKnowledgeV2({ ...product, updatedAt: new Date("2026-07-18") });
  const changed = buildShopKnowledgeV2({
    ...product,
    shortDescEn: `${product.shortDescEn} ECE approved.`,
  });

  assert.equal(first.contentHash, second.contentHash);
  assert.notEqual(first.contentHash, changed.contentHash);
  assert.equal(first.chunks.length, second.chunks.length);
  assert.notEqual(
    first.chunks.map((chunk) => chunk.contentHash).join("|"),
    changed.chunks.map((chunk) => chunk.contentHash).join("|")
  );
});
