import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/lib/prisma";
import { normalizeKwShopifyCatalog } from "../src/lib/shopCatalogKwNormalization";
import { vehicleModelKey } from "../src/lib/shopVehicleTaxonomy";
import {
  parseShopifyProductJsonl,
  selectKwShopifyProducts,
} from "../src/lib/shopifyCatalogSnapshot";

const snapshotPath = resolve(
  "backups",
  "shopify",
  "kw-suspensions",
  "2026-09-02",
  "products.jsonl"
);

type FitmentTuple = {
  make: string | null;
  model: string;
  chassisCodes: string[];
  yearFrom: number | null;
  yearTo: number | null;
  engines: string[];
};

const normalizeValues = (values: Array<string | null | undefined>) =>
  [...new Set(values.filter((value): value is string => Boolean(value)).map((value) => value.trim()))]
    .sort((a, b) => a.localeCompare(b));

const tupleKey = (tuple: FitmentTuple) =>
  JSON.stringify({
    make: tuple.make?.trim() ?? null,
    // Display labels may be polished without changing the stable vehicle identity.
    model: vehicleModelKey(tuple.model),
    chassisCodes: normalizeValues(tuple.chassisCodes),
    yearFrom: tuple.yearFrom,
    yearTo: tuple.yearTo,
    engines: normalizeValues(tuple.engines),
  });

async function main() {
  const products = selectKwShopifyProducts(
    parseShopifyProductJsonl(readFileSync(snapshotPath, "utf8"))
  );
  const normalized = normalizeKwShopifyCatalog(products);

  const [bindings, clauses] = await Promise.all([
    prisma.shopCatalogSourceBindingHead.findMany({
      where: {
        entityType: "PRODUCT",
        currentBinding: { product: { brand: "KW Suspensions" } },
      },
      select: {
        externalKey: true,
        currentBinding: { select: { productId: true } },
      },
    }),
    prisma.shopCatalogProjectionClause.findMany({
      where: {
        product: { brand: "KW Suspensions", isPublished: true, status: "ACTIVE" },
      },
      select: {
        productId: true,
        clauseKey: true,
        constraints: {
          where: {
            dimension: { in: ["MAKE", "MODEL", "GENERATION", "CHASSIS", "YEAR", "ENGINE"] },
          },
          select: {
            dimension: true,
            state: true,
            textValue: true,
            yearFrom: true,
            yearTo: true,
          },
        },
      },
    }),
  ]);

  const externalToProduct = new Map(
    bindings
      .filter((binding) => binding.currentBinding.productId)
      .map((binding) => [binding.externalKey, binding.currentBinding.productId!])
  );
  const actualByProduct = new Map<string, string[]>();
  for (const clause of clauses) {
    const exact = clause.constraints.filter((constraint) => constraint.state === "EXACT");
    const text = (dimension: "MAKE" | "MODEL" | "GENERATION" | "CHASSIS" | "ENGINE") =>
      exact
        .filter((constraint) => constraint.dimension === dimension)
        .map((constraint) => constraint.textValue);
    const years = exact.filter((constraint) => constraint.dimension === "YEAR");
    const chassisCodes = normalizeValues([...text("CHASSIS"), ...text("GENERATION")]);
    const tuple: FitmentTuple = {
      make: text("MAKE")[0] ?? null,
      model: text("MODEL")[0] ?? "",
      chassisCodes,
      yearFrom: years[0]?.yearFrom ?? null,
      yearTo: years[0]?.yearTo ?? null,
      engines: normalizeValues(text("ENGINE")),
    };
    const list = actualByProduct.get(clause.productId) ?? [];
    list.push(tupleKey(tuple));
    actualByProduct.set(clause.productId, list);
  }

  const missingBindings: string[] = [];
  const mismatches: Array<{
    externalProductId: string;
    productId: string;
    missing: string[];
    unexpected: string[];
  }> = [];
  const expectedMakes = new Map<string, number>();
  let expectedApplications = 0;

  for (const entry of normalized) {
    const productId = externalToProduct.get(entry.externalProductId);
    if (!productId) {
      missingBindings.push(entry.externalProductId);
      continue;
    }
    const expected = entry.applications.map((application) => {
      if (application.make) {
        expectedMakes.set(application.make, (expectedMakes.get(application.make) ?? 0) + 1);
      }
      return tupleKey(application);
    });
    expectedApplications += expected.length;
    const actual = actualByProduct.get(productId) ?? [];
    const expectedCounts = new Map<string, number>();
    const actualCounts = new Map<string, number>();
    for (const key of expected) expectedCounts.set(key, (expectedCounts.get(key) ?? 0) + 1);
    for (const key of actual) actualCounts.set(key, (actualCounts.get(key) ?? 0) + 1);
    const missing = [...expectedCounts].flatMap(([key, count]) =>
      Array(Math.max(0, count - (actualCounts.get(key) ?? 0))).fill(key)
    );
    const unexpected = [...actualCounts].flatMap(([key, count]) =>
      Array(Math.max(0, count - (expectedCounts.get(key) ?? 0))).fill(key)
    );
    if (missing.length || unexpected.length) {
      mismatches.push({ externalProductId: entry.externalProductId, productId, missing, unexpected });
    }
  }

  const boundProductIds = new Set(bindings.map((binding) => binding.currentBinding.productId));
  const orphanProjectionProducts = [...actualByProduct.keys()].filter(
    (productId) => !boundProductIds.has(productId)
  );
  const report = {
    snapshot: snapshotPath,
    expectedProducts: normalized.length,
    boundProducts: externalToProduct.size,
    expectedApplications,
    projectedApplications: clauses.length,
    makes: Object.fromEntries([...expectedMakes].sort(([a], [b]) => a.localeCompare(b))),
    missingBindings,
    orphanProjectionProducts,
    mismatches,
    passed:
      normalized.length === externalToProduct.size &&
      expectedApplications === clauses.length &&
      missingBindings.length === 0 &&
      orphanProjectionProducts.length === 0 &&
      mismatches.length === 0,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
