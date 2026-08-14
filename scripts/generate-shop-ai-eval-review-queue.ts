import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient, ShopCatalogStatus } from "@prisma/client";

import { SHOP_AI_V2_ROLLOUT_CATEGORIES } from "../src/lib/shopAiV2RolloutContract";
import { compactShopCode } from "../src/lib/shopVehicleSearch";
import { buildShopAiEvalReviewQueue, type ShopAiEvalReviewSeed } from "./shop-ai-eval-review-queue";

const prisma = new PrismaClient();

function valueArgument(name: string) {
  return process.argv.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1);
}

function positiveIntegerArgument(name: string, fallback: number) {
  const raw = valueArgument(name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 10_000) {
    throw new Error(`${name} must be an integer between 1 and 10000`);
  }
  return value;
}

async function main() {
  const targetCases = positiveIntegerArgument("--target", 500);
  const output = path.resolve(
    valueArgument("--output") ?? "artifacts/one-ai/stock-ai-eval-review-queue.json"
  );
  const fixtureOutput = path.resolve(
    valueArgument("--fixture-output") ??
      path.join(path.dirname(output), "stock-ai-machine-cases.json")
  );
  const deterministicFixtureOutput = path.resolve(
    valueArgument("--deterministic-fixture-output") ??
      path.join(path.dirname(output), "stock-ai-deterministic-cases.json")
  );
  const reviewableFixtureOutput = path.resolve(
    valueArgument("--reviewable-fixture-output") ??
      path.join(path.dirname(output), "stock-ai-reviewable-cases.json")
  );
  const [knowledgeRowsByCategory, catalogSkuRows] = await Promise.all([
    Promise.all(
      SHOP_AI_V2_ROLLOUT_CATEGORIES.map((categoryGroup) =>
        prisma.shopProductKnowledge.findMany({
          where: {
            schemaVersion: { gte: 2 },
            categoryGroup,
            product: { isPublished: true, status: ShopCatalogStatus.ACTIVE },
          },
          orderBy: [{ completenessScore: "desc" }, { productId: "asc" }],
          take: 100,
          select: {
            id: true,
            productId: true,
            categoryGroup: true,
            activeRevision: true,
            product: {
              select: {
                sku: true,
                titleUa: true,
                titleEn: true,
                brand: true,
                variants: {
                  where: { sku: { not: null } },
                  orderBy: { position: "asc" },
                  take: 1,
                  select: { id: true, sku: true },
                },
              },
            },
            vehicleApplications: {
              where: { isActive: true },
              orderBy: [{ sourcePriority: "desc" }, { confidence: "desc" }],
              select: {
                revision: true,
                make: true,
                model: true,
                chassisCode: true,
                yearFrom: true,
                yearTo: true,
                opfGpf: true,
              },
            },
          },
        })
      )
    ),
    prisma.shopProduct.findMany({
      where: { isPublished: true, status: ShopCatalogStatus.ACTIVE },
      select: {
        sku: true,
        variants: {
          where: { sku: { not: null } },
          select: { sku: true },
        },
      },
    }),
  ]);
  const rows = knowledgeRowsByCategory.flat();
  const knownSkuTokens = catalogSkuRows
    .flatMap((row) => [
      compactShopCode(row.sku),
      ...row.variants.map((variant) => compactShopCode(variant.sku)),
    ])
    .filter(Boolean);

  const seeds: ShopAiEvalReviewSeed[] = rows.flatMap((row) => {
    if (!row.categoryGroup) return [];
    const application = row.vehicleApplications.find(
      (candidate) => candidate.revision === row.activeRevision
    );
    const variant = row.product.variants[0];
    return [
      {
        category: row.categoryGroup,
        productId: row.productId,
        variantId: variant?.id ?? null,
        sku: variant?.sku ?? row.product.sku,
        titleUa: row.product.titleUa,
        titleEn: row.product.titleEn,
        brand: row.product.brand,
        // Catalog titles and unreviewed applications may help draft the query,
        // but they cannot become asserted fitment expectations. Review cases
        // here validate product discovery only.
        make: null,
        model: null,
        chassis: null,
        year: null,
        opfGpf:
          application?.opfGpf === "with" || application?.opfGpf === "without"
            ? application.opfGpf
            : null,
        sourceEvidenceId: `ShopProductKnowledge:${row.id}:revision:${row.activeRevision}`,
      },
    ];
  });
  const queue = buildShopAiEvalReviewQueue({
    seeds,
    categories: SHOP_AI_V2_ROLLOUT_CATEGORIES,
    targetCases,
    knownSkuTokens,
  });
  const deterministicCases = queue.items
    .filter((item) => item.oracle.automationEligibility === "deterministic")
    .map((item) => item.draftCase);
  const reviewableCases = queue.items
    .filter((item) => item.oracle.automationEligibility === "source_grounded_reviewable")
    .map((item) => item.draftCase);
  await Promise.all([
    mkdir(path.dirname(output), { recursive: true }),
    mkdir(path.dirname(fixtureOutput), { recursive: true }),
    mkdir(path.dirname(deterministicFixtureOutput), { recursive: true }),
    mkdir(path.dirname(reviewableFixtureOutput), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(output, `${JSON.stringify(queue, null, 2)}\n`, "utf8"),
    writeFile(
      fixtureOutput,
      `${JSON.stringify(
        queue.items.map((item) => item.draftCase),
        null,
        2
      )}\n`,
      "utf8"
    ),
    writeFile(
      deterministicFixtureOutput,
      `${JSON.stringify(deterministicCases, null, 2)}\n`,
      "utf8"
    ),
    writeFile(reviewableFixtureOutput, `${JSON.stringify(reviewableCases, null, 2)}\n`, "utf8"),
  ]);
  const countsBySourceCategory = Object.fromEntries(
    SHOP_AI_V2_ROLLOUT_CATEGORIES.map((category) => [
      category,
      queue.items.filter((item) => item.category === category).length,
    ])
  );
  const countsByExpectedCategory = Object.fromEntries(
    SHOP_AI_V2_ROLLOUT_CATEGORIES.map((category) => [
      category,
      queue.items.filter((item) => item.draftCase.expect.category === category).length,
    ])
  );
  const countsByLanguage = Object.fromEntries(
    ["ua", "en", "ru", "mixed", "translit"].map((language) => [
      language,
      queue.items.filter((item) => item.language === language).length,
    ])
  );
  const countsByMode = Object.fromEntries(
    ["results", "clarification", "no_match"].map((mode) => [
      mode,
      queue.items.filter((item) => item.draftCase.expect.mode === mode).length,
    ])
  );
  const countsByOracle = Object.fromEntries(
    ["catalog_relevance", "clarification", "exact_sku", "mutated_sku_no_match"].map((kind) => [
      kind,
      queue.items.filter((item) => item.oracle.kind === kind).length,
    ])
  );
  console.log(
    JSON.stringify(
      {
        output,
        fixtureOutput,
        deterministicFixtureOutput,
        reviewableFixtureOutput,
        total: queue.items.length,
        deterministicCases: deterministicCases.length,
        reviewableCases: reviewableCases.length,
        status: "review_queue_generated",
        hardNegativeCandidates: queue.items.filter((item) => item.draftCase.metadata?.hardNegative)
          .length,
        exactSkuCandidates: queue.items.filter((item) =>
          item.draftCase.metadata?.tags?.includes("exact-sku")
        ).length,
        countsBySourceCategory,
        countsByExpectedCategory,
        countsByLanguage,
        countsByMode,
        countsByOracle,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
