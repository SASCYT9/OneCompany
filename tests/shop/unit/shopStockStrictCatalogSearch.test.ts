import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyStrictCatalogKnowledgeRow,
  getStrictCatalogMatchRank,
  parseStrictCatalogSearchConstraints,
  type StrictCatalogKnowledgeRow,
} from "../../../src/app/api/shop/stock/search/strictCatalog";

function constraints(query = "") {
  return parseStrictCatalogSearchConstraints(
    new URLSearchParams(
      `strict=1&category=exhaust&productKind=system&make=BMW&model=M3&chassis=F80&year=2018&engine=S55&opfGpf=with${query}`
    )
  );
}

function knowledgeRow(
  overrides: Partial<StrictCatalogKnowledgeRow> = {}
): StrictCatalogKnowledgeRow {
  return {
    productId: "product-1",
    categoryGroup: "exhaust",
    productKind: "system",
    qualityFlags: [],
    knowledgeMakes: ["BMW"],
    knowledgeModels: ["M3"],
    knowledgeChassisCodes: ["F80"],
    knowledgeYearRanges: [{ from: 2014, to: 2020 }],
    knowledgeEngines: ["S55"],
    knowledgeOpfGpf: "with",
    applicationId: "application-1",
    applicationVariantId: "variant-1",
    applicationMake: "BMW",
    applicationModel: "M3",
    applicationChassis: "F80",
    applicationYearFrom: 2014,
    applicationYearTo: 2020,
    applicationEngine: "S55",
    applicationOpfGpf: "with",
    applicationUniversal: false,
    applicationVerificationStatus: "VERIFIED",
    applicationSource: "MANAGER",
    hasApplications: true,
    ...overrides,
  };
}

test("strict catalog parser accepts canonical product, year, engine and OPF constraints", () => {
  const parsed = constraints("&scope=auto");

  assert.equal(parsed.invalid, false);
  assert.equal(parsed.productKind, "system");
  assert.equal(parsed.year, 2018);
  assert.equal(parsed.engine, "S55");
  assert.equal(parsed.opfGpf, "with");
  assert.equal(parsed.scope, "auto");
  assert.equal(parsed.hasKnowledgeConstraints, true);
});

test("strict catalog parser fails closed for invalid hard constraints", () => {
  const invalidKind = parseStrictCatalogSearchConstraints(
    new URLSearchParams("strict=1&productKind=unknown-kind")
  );
  const invalidYear = parseStrictCatalogSearchConstraints(
    new URLSearchParams("strict=1&year=not-a-year")
  );
  const invalidOpf = parseStrictCatalogSearchConstraints(
    new URLSearchParams("strict=1&opfGpf=maybe")
  );

  assert.equal(invalidKind.invalid, true);
  assert.equal(invalidYear.invalid, true);
  assert.equal(invalidOpf.invalid, true);
});

test("verified correlated application is classified as exact", () => {
  const match = classifyStrictCatalogKnowledgeRow(knowledgeRow(), constraints(), "en");

  assert.equal(match?.matchStatus, "exact");
  assert.deepEqual(match?.missingFacts, []);
  assert.equal(match?.matchedApplicationId, "application-1");
  assert.equal(match?.variantId, "variant-1");
});

test("known year, engine or OPF contradiction is always rejected", () => {
  const wrongYear = classifyStrictCatalogKnowledgeRow(
    knowledgeRow({ applicationYearFrom: 2019 }),
    constraints(),
    "en"
  );
  const wrongEngine = classifyStrictCatalogKnowledgeRow(
    knowledgeRow({ applicationEngine: "B58" }),
    constraints(),
    "en"
  );
  const wrongOpf = classifyStrictCatalogKnowledgeRow(
    knowledgeRow({ applicationOpfGpf: "without" }),
    constraints(),
    "en"
  );

  assert.equal(wrongYear, null);
  assert.equal(wrongEngine, null);
  assert.equal(wrongOpf, null);
});

test("a product with applications but no single correlated match is rejected", () => {
  const match = classifyStrictCatalogKnowledgeRow(
    knowledgeRow({
      applicationId: null,
      applicationMake: null,
      applicationModel: null,
      applicationChassis: null,
      applicationYearFrom: null,
      applicationYearTo: null,
      applicationEngine: null,
      applicationOpfGpf: null,
      hasApplications: true,
    }),
    constraints(),
    "en"
  );

  assert.equal(match, null);
});

test("unknown fitment stays reviewable only with exact category and product kind", () => {
  const unknown = knowledgeRow({
    applicationId: null,
    applicationMake: null,
    applicationModel: null,
    applicationChassis: null,
    applicationYearFrom: null,
    applicationYearTo: null,
    applicationEngine: null,
    applicationOpfGpf: null,
    applicationVerificationStatus: null,
    applicationSource: null,
    hasApplications: false,
    knowledgeMakes: [],
    knowledgeModels: [],
    knowledgeChassisCodes: [],
    knowledgeYearRanges: [],
    knowledgeEngines: [],
    knowledgeOpfGpf: null,
  });
  const match = classifyStrictCatalogKnowledgeRow(unknown, constraints(), "en");
  const wrongKind = classifyStrictCatalogKnowledgeRow(
    { ...unknown, productKind: "downpipe" },
    constraints(),
    "en"
  );

  assert.equal(match?.matchStatus, "requires_verification");
  assert.ok(match?.missingFacts.includes("fitment"));
  assert.ok(match?.missingFacts.includes("year"));
  assert.ok(match?.missingFacts.includes("engine"));
  assert.ok(match?.missingFacts.includes("opf_gpf"));
  assert.equal(wrongKind, null);
});

test("product-level canonical evidence rejects an unknown application with a known conflict", () => {
  const match = classifyStrictCatalogKnowledgeRow(
    knowledgeRow({
      applicationId: null,
      applicationMake: null,
      applicationModel: null,
      applicationChassis: null,
      applicationYearFrom: null,
      applicationYearTo: null,
      applicationEngine: null,
      applicationOpfGpf: null,
      applicationVerificationStatus: null,
      applicationSource: null,
      hasApplications: false,
      knowledgeOpfGpf: "without",
    }),
    constraints(),
    "en"
  );

  assert.equal(match, null);
});

test("missing hard evidence downgrades a verified application and exact stays first", () => {
  const unverified = classifyStrictCatalogKnowledgeRow(
    knowledgeRow({
      qualityFlags: ["missing_hard_attribute:material"],
    }),
    constraints(),
    "en"
  );
  const exact = classifyStrictCatalogKnowledgeRow(
    knowledgeRow({ productId: "exact" }),
    constraints(),
    "en"
  );
  const ranked = [unverified, exact].sort(
    (left, right) => getStrictCatalogMatchRank(left) - getStrictCatalogMatchRank(right)
  );

  assert.equal(unverified?.matchStatus, "requires_verification");
  assert.ok(unverified?.missingFacts.includes("material"));
  assert.equal(ranked[0]?.matchStatus, "exact");
});
