import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ShopProduct } from "../src/lib/shopCatalog";
import { extractProductFitment } from "../src/lib/crossShopFitment";
import {
  getExpectedChassisForMakeModel,
  isExpectedChassisForMakeModel,
  porsche911SubmodelsCompatible,
} from "../src/lib/crossShopFitment";
import { prisma } from "../src/lib/prisma";
import {
  classifyProductFitment,
  type NormalizedFitmentStatus,
} from "../src/lib/shopFitmentQuality";
import { resolveShopProductBrand } from "../src/lib/shopProductBrand";

const PAGE_SIZE = 200;

type AuditProduct = ShopProduct & { id: string };

async function loadPublishedCatalogProducts(): Promise<AuditProduct[]> {
  const products: AuditProduct[] = [];
  let cursor: string | undefined;

  while (true) {
    const rows = await prisma.shopProduct.findMany({
      where: { isPublished: true, status: "ACTIVE" },
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        slug: true,
        sku: true,
        scope: true,
        brand: true,
        vendor: true,
        productType: true,
        tags: true,
        titleUa: true,
        titleEn: true,
        categoryUa: true,
        categoryEn: true,
        shortDescUa: true,
        shortDescEn: true,
        longDescUa: true,
        longDescEn: true,
        bodyHtmlUa: true,
        bodyHtmlEn: true,
        collectionUa: true,
        collectionEn: true,
        highlights: true,
        collections: {
          select: {
            sortOrder: true,
            collection: {
              select: {
                id: true,
                handle: true,
                titleUa: true,
                titleEn: true,
                brand: true,
                isUrban: true,
              },
            },
          },
        },
        variants: {
          select: {
            id: true,
            title: true,
            sku: true,
            position: true,
            option1Value: true,
            option2Value: true,
            option3Value: true,
          },
        },
      },
    });

    for (const row of rows) {
      const highlights = row.highlights as { ua?: string[]; en?: string[] } | null;
      products.push({
        id: row.id,
        slug: row.slug,
        sku: row.sku ?? "",
        scope: row.scope === "moto" ? "moto" : "auto",
        brand: resolveShopProductBrand(row),
        vendor: row.vendor ?? undefined,
        productType: row.productType ?? undefined,
        tags: row.tags,
        title: { ua: row.titleUa, en: row.titleEn },
        category: { ua: row.categoryUa ?? "", en: row.categoryEn ?? "" },
        shortDescription: { ua: row.shortDescUa ?? "", en: row.shortDescEn ?? "" },
        longDescription: {
          ua: row.bodyHtmlUa ?? row.longDescUa ?? "",
          en: row.bodyHtmlEn ?? row.longDescEn ?? "",
        },
        leadTime: { ua: "", en: "" },
        stock: "inStock",
        collection: { ua: row.collectionUa ?? "", en: row.collectionEn ?? "" },
        price: { eur: 0, usd: 0, uah: 0 },
        image: "",
        highlights: Array.from(
          { length: Math.max(highlights?.ua?.length ?? 0, highlights?.en?.length ?? 0) },
          (_, index) => ({
            ua: highlights?.ua?.[index] ?? highlights?.en?.[index] ?? "",
            en: highlights?.en?.[index] ?? highlights?.ua?.[index] ?? "",
          })
        ),
        collections: row.collections.map((entry) => ({
          id: entry.collection.id,
          handle: entry.collection.handle,
          title: { ua: entry.collection.titleUa, en: entry.collection.titleEn },
          brand: entry.collection.brand,
          isUrban: entry.collection.isUrban,
          sortOrder: entry.sortOrder,
        })),
        variants: row.variants.map((variant) => ({
          id: variant.id,
          title: variant.title,
          sku: variant.sku,
          position: variant.position,
          optionValues: [variant.option1Value, variant.option2Value, variant.option3Value].filter(
            (value): value is string => Boolean(value)
          ),
          price: { eur: 0, usd: 0, uah: 0 },
        })),
      });
    }

    if (rows.length < PAGE_SIZE) break;
    cursor = rows.at(-1)?.id;
  }

  return products;
}

type Coverage = {
  total: number;
  make: number;
  model: number;
  chassis: number;
  year: number;
  unknown: number;
  high: number;
  medium: number;
  low: number;
};

type ClassificationCounts = Record<NormalizedFitmentStatus, number>;

type ProductConflict = {
  productId: string;
  sku: string;
  title: string;
  make: string | null;
  models: string[];
  chassisCodes: string[];
  reason: string;
  expectedChassis?: string[];
};

type CanonicalApplicationSummary = {
  total: number;
  verified: number;
  extracted: number;
  needsReview: number;
  blocked: number;
  missingMake: number;
  missingModel: number;
  missingChassis: number;
  invalidYearRange: number;
  modelChassisConflicts: number;
};

const emptyClassificationCounts = (): ClassificationCounts => ({
  inferred: 0,
  verified: 0,
  universal: 0,
  needs_review: 0,
});

const emptyCoverage = (): Coverage => ({
  total: 0,
  make: 0,
  model: 0,
  chassis: 0,
  year: 0,
  unknown: 0,
  high: 0,
  medium: 0,
  low: 0,
});

function addCoverage(coverage: Coverage, fitment: ReturnType<typeof extractProductFitment>) {
  coverage.total += 1;
  if (fitment.make) coverage.make += 1;
  if (fitment.models.length > 0) coverage.model += 1;
  if (fitment.chassisCodes.length > 0) coverage.chassis += 1;
  if (fitment.yearRanges.length > 0) coverage.year += 1;
  coverage[fitment.confidence] += 1;
}

const percentage = (count: number, total: number) =>
  total > 0 ? `${((count / total) * 100).toFixed(1)}%` : "0.0%";

async function main() {
  const products = await loadPublishedCatalogProducts();
  const productSkuSet = new Set(
    products
      .map((product) =>
        String(product.sku ?? "")
          .trim()
          .toUpperCase()
      )
      .filter(Boolean)
  );
  const overall = emptyCoverage();
  const auto = emptyCoverage();
  const moto = emptyCoverage();
  const classifications = emptyClassificationCounts();
  const dependencies = {
    parentDependent: 0,
    derivedParentSku: 0,
    resolvedParentProduct: 0,
    orphanParentSku: 0,
    missingParentSku: 0,
  };
  const orphanParentSamples: Array<{ sku: string; parentSku: string; title: string }> = [];
  const missingParentSamples: Array<{ sku: string; title: string }> = [];
  const byBrand = new Map<string, Coverage>();
  const reviewByBrand = new Map<string, number>();
  const unknownSamples: Array<{ brand: string; sku: string; title: string }> = [];
  const modelChassisConflicts: ProductConflict[] = [];
  const multiPorscheFamiliesNeedingCorrelation: ProductConflict[] = [];
  const overlyBroadFitments: ProductConflict[] = [];
  const modelOptionsByMake = new Map<string, Set<string>>();
  const porsche911FamilyProducts = new Map<string, number>();

  for (const product of products) {
    const fitment = extractProductFitment(product);
    const classification = classifyProductFitment(product, fitment);
    addCoverage(overall, fitment);
    addCoverage(product.scope === "moto" ? moto : auto, fitment);
    classifications[classification.status] += 1;
    if (classification.dependency?.type === "parent_product") {
      dependencies.parentDependent += 1;
      if (classification.dependency.parentSku) {
        dependencies.derivedParentSku += 1;
        if (productSkuSet.has(classification.dependency.parentSku.trim().toUpperCase())) {
          dependencies.resolvedParentProduct += 1;
        } else {
          dependencies.orphanParentSku += 1;
          if (orphanParentSamples.length < 100) {
            orphanParentSamples.push({
              sku: String(product.sku ?? ""),
              parentSku: classification.dependency.parentSku,
              title: product.title.en || product.title.ua,
            });
          }
        }
      } else {
        dependencies.missingParentSku += 1;
        if (missingParentSamples.length < 100) {
          missingParentSamples.push({
            sku: String(product.sku ?? ""),
            title: product.title.en || product.title.ua,
          });
        }
      }
    }

    const brand = String(product.brand || product.vendor || "Unknown").trim() || "Unknown";
    const brandCoverage = byBrand.get(brand) ?? emptyCoverage();
    addCoverage(brandCoverage, fitment);
    byBrand.set(brand, brandCoverage);
    if (classification.status === "needs_review") {
      reviewByBrand.set(brand, (reviewByBrand.get(brand) ?? 0) + 1);
    }

    if (fitment.confidence === "unknown" && unknownSamples.length < 250) {
      unknownSamples.push({
        brand,
        sku: String(product.sku || ""),
        title: String(product.title?.ua || product.title?.en || ""),
      });
    }

    if (fitment.make) {
      const models = modelOptionsByMake.get(fitment.make) ?? new Set<string>();
      fitment.models.forEach((model) => models.add(model));
      modelOptionsByMake.set(fitment.make, models);
    }

    for (const model of fitment.models) {
      const expected = fitment.make ? getExpectedChassisForMakeModel(fitment.make, model) : null;
      if (
        expected &&
        fitment.chassisCodes.length > 0 &&
        !fitment.chassisCodes.some((chassis) =>
          isExpectedChassisForMakeModel(fitment.make ?? "", model, chassis)
        )
      ) {
        modelChassisConflicts.push({
          productId: product.id,
          sku: product.sku,
          title: product.title.ua || product.title.en,
          make: fitment.make,
          models: fitment.models,
          chassisCodes: fitment.chassisCodes,
          expectedChassis: expected,
          reason: `Жоден кузов товару не відповідає моделі ${model}`,
        });
      }
    }

    const porscheFamilies = fitment.models.filter((model) => /^911(?:\s|$)/i.test(model));
    for (const family of new Set(porscheFamilies)) {
      porsche911FamilyProducts.set(family, (porsche911FamilyProducts.get(family) ?? 0) + 1);
    }
    if (
      porscheFamilies.some((model, index) =>
        porscheFamilies
          .slice(index + 1)
          .some((other) => !porsche911SubmodelsCompatible(model, other))
      )
    ) {
      multiPorscheFamiliesNeedingCorrelation.push({
        productId: product.id,
        sku: product.sku,
        title: product.title.ua || product.title.en,
        make: fitment.make,
        models: fitment.models,
        chassisCodes: fitment.chassisCodes,
        reason: "Товар охоплює кілька сімейств Porsche 911 і потребує окремих application-рядків",
      });
    }

    if (fitment.models.length > 6 || fitment.chassisCodes.length > 8) {
      overlyBroadFitments.push({
        productId: product.id,
        sku: product.sku,
        title: product.title.ua || product.title.en,
        make: fitment.make,
        models: fitment.models,
        chassisCodes: fitment.chassisCodes,
        reason: "Надто широкий автоматично витягнутий fitment потребує перевірки кореляції",
      });
    }
  }

  const canonicalApplications: CanonicalApplicationSummary = {
    total: 0,
    verified: 0,
    extracted: 0,
    needsReview: 0,
    blocked: 0,
    missingMake: 0,
    missingModel: 0,
    missingChassis: 0,
    invalidYearRange: 0,
    modelChassisConflicts: 0,
  };
  const modelChassisConflictProductCount = new Set(
    modelChassisConflicts.map((item) => item.productId)
  ).size;
  const canonicalConflictSamples: Array<Record<string, unknown>> = [];
  let applicationCursor: string | undefined;
  while (true) {
    const applications = await prisma.shopVehicleApplication.findMany({
      where: { product: { isPublished: true, status: "ACTIVE" } },
      orderBy: { id: "asc" },
      take: 500,
      ...(applicationCursor ? { cursor: { id: applicationCursor }, skip: 1 } : {}),
      select: {
        id: true,
        productId: true,
        make: true,
        model: true,
        chassisCode: true,
        yearFrom: true,
        yearTo: true,
        isUniversal: true,
        verificationStatus: true,
      },
    });
    for (const application of applications) {
      canonicalApplications.total += 1;
      if (application.verificationStatus === "VERIFIED") canonicalApplications.verified += 1;
      if (application.verificationStatus === "EXTRACTED") canonicalApplications.extracted += 1;
      if (application.verificationStatus === "NEEDS_REVIEW") canonicalApplications.needsReview += 1;
      if (application.verificationStatus === "BLOCKED") canonicalApplications.blocked += 1;
      if (!application.isUniversal && !application.make) canonicalApplications.missingMake += 1;
      if (!application.isUniversal && !application.model) canonicalApplications.missingModel += 1;
      if (!application.isUniversal && !application.chassisCode)
        canonicalApplications.missingChassis += 1;
      if (
        application.yearFrom != null &&
        application.yearTo != null &&
        application.yearFrom > application.yearTo
      ) {
        canonicalApplications.invalidYearRange += 1;
      }
      if (
        application.make &&
        application.model &&
        application.chassisCode &&
        !isExpectedChassisForMakeModel(application.make, application.model, application.chassisCode)
      ) {
        canonicalApplications.modelChassisConflicts += 1;
        if (canonicalConflictSamples.length < 250) {
          canonicalConflictSamples.push(application);
        }
      }
    }
    if (applications.length < 500) break;
    applicationCursor = applications.at(-1)?.id;
  }

  const brands = Array.from(byBrand, ([brand, coverage]) => ({ brand, ...coverage })).sort(
    (left, right) => right.total - left.total
  );
  const report = {
    generatedAt: new Date().toISOString(),
    overall,
    byScope: { auto, moto },
    classifications,
    dependencies,
    dependencySamples: { orphanParentSamples, missingParentSamples },
    brands,
    reviewByBrand: Array.from(reviewByBrand, ([brand, count]) => ({ brand, count })).sort(
      (left, right) => right.count - left.count
    ),
    unknownSamples,
    consistency: {
      modelChassisConflictCount: modelChassisConflicts.length,
      modelChassisConflictProductCount,
      multiPorscheFamilyProductCount: multiPorscheFamiliesNeedingCorrelation.length,
      overlyBroadFitmentCount: overlyBroadFitments.length,
      modelChassisConflicts,
      multiPorscheFamiliesNeedingCorrelation,
      porsche911FamilyProducts: Array.from(porsche911FamilyProducts, ([family, products]) => ({
        family,
        products,
      })).sort((left, right) => right.products - left.products),
      overlyBroadFitments,
      modelOptionsByMake: Array.from(modelOptionsByMake, ([make, models]) => ({
        make,
        models: Array.from(models).sort(),
      })).sort((left, right) => left.make.localeCompare(right.make)),
    },
    canonicalApplications,
    canonicalConflictSamples,
  };

  const outputDirectory = path.join(process.cwd(), "artifacts", "stock-fitment-audit");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "fitment-audit.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );

  const lines = [
    "# Stock Fitment Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Overall coverage",
    "",
    "| Signal | Products | Coverage |",
    "| --- | ---: | ---: |",
    `| Make | ${overall.make} | ${percentage(overall.make, overall.total)} |`,
    `| Model | ${overall.model} | ${percentage(overall.model, overall.total)} |`,
    `| Chassis | ${overall.chassis} | ${percentage(overall.chassis, overall.total)} |`,
    `| Year | ${overall.year} | ${percentage(overall.year, overall.total)} |`,
    `| High confidence | ${overall.high} | ${percentage(overall.high, overall.total)} |`,
    `| Medium confidence | ${overall.medium} | ${percentage(overall.medium, overall.total)} |`,
    `| Low confidence | ${overall.low} | ${percentage(overall.low, overall.total)} |`,
    `| Unknown | ${overall.unknown} | ${percentage(overall.unknown, overall.total)} |`,
    "",
    "## Scope coverage",
    "",
    "| Scope | Products | Make | Model | Chassis | Unknown |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    `| Auto | ${auto.total} | ${percentage(auto.make, auto.total)} | ${percentage(auto.model, auto.total)} | ${percentage(auto.chassis, auto.total)} | ${percentage(auto.unknown, auto.total)} |`,
    `| Moto | ${moto.total} | ${percentage(moto.make, moto.total)} | ${percentage(moto.model, moto.total)} | ${percentage(moto.chassis, moto.total)} | ${percentage(moto.unknown, moto.total)} |`,
    "",
    "## Workflow classification",
    "",
    "| Status | Products | Share |",
    "| --- | ---: | ---: |",
    `| Inferred | ${classifications.inferred} | ${percentage(classifications.inferred, overall.total)} |`,
    `| Universal | ${classifications.universal} | ${percentage(classifications.universal, overall.total)} |`,
    `| Needs review | ${classifications.needs_review} | ${percentage(classifications.needs_review, overall.total)} |`,
    `| Parent-dependent | ${dependencies.parentDependent} | ${percentage(dependencies.parentDependent, overall.total)} |`,
    `| Parent SKU derived | ${dependencies.derivedParentSku} | ${percentage(dependencies.derivedParentSku, dependencies.parentDependent)} |`,
    `| Parent product exists | ${dependencies.resolvedParentProduct} | ${percentage(dependencies.resolvedParentProduct, dependencies.parentDependent)} |`,
    `| Orphan parent SKU | ${dependencies.orphanParentSku} | ${percentage(dependencies.orphanParentSku, dependencies.parentDependent)} |`,
    `| Parent SKU missing | ${dependencies.missingParentSku} | ${percentage(dependencies.missingParentSku, dependencies.parentDependent)} |`,
    `| Verified | ${classifications.verified} | ${percentage(classifications.verified, overall.total)} |`,
    "",
    "## Coverage by brand",
    "",
    "| Brand | Total | Make | Model | Chassis | Year | Unknown |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...brands.map(
      (brand) =>
        `| ${brand.brand} | ${brand.total} | ${brand.make} | ${brand.model} | ${brand.chassis} | ${brand.year} | ${brand.unknown} |`
    ),
    "",
    "## Consistency checks",
    "",
    `- Model/chassis review signals: ${modelChassisConflicts.length} across ${modelChassisConflictProductCount} products`,
    `- Multi-family Porsche 911 products needing correlated applications: ${multiPorscheFamiliesNeedingCorrelation.length}`,
    `- Overly broad inferred fitments: ${overlyBroadFitments.length}`,
    `- Canonical vehicle applications: ${canonicalApplications.total}`,
    `- Verified canonical applications: ${canonicalApplications.verified} (${percentage(canonicalApplications.verified, canonicalApplications.total)})`,
    `- Canonical model/chassis conflicts: ${canonicalApplications.modelChassisConflicts}`,
    `- Canonical applications missing make/model/chassis: ${canonicalApplications.missingMake}/${canonicalApplications.missingModel}/${canonicalApplications.missingChassis}`,
    "",
    "Unknown product samples are available in `fitment-audit.json`.",
    "",
  ];
  await writeFile(path.join(outputDirectory, "fitment-audit.md"), lines.join("\n"), "utf8");

  console.log(
    JSON.stringify(
      {
        outputDirectory,
        total: overall.total,
        make: `${overall.make} (${percentage(overall.make, overall.total)})`,
        model: `${overall.model} (${percentage(overall.model, overall.total)})`,
        chassis: `${overall.chassis} (${percentage(overall.chassis, overall.total)})`,
        year: `${overall.year} (${percentage(overall.year, overall.total)})`,
        unknown: `${overall.unknown} (${percentage(overall.unknown, overall.total)})`,
        classifications,
        auto,
        moto,
        consistency: {
          modelChassisConflicts: modelChassisConflicts.length,
          modelChassisConflictProducts: modelChassisConflictProductCount,
          multiPorscheFamiliesNeedingCorrelation: multiPorscheFamiliesNeedingCorrelation.length,
          overlyBroadFitments: overlyBroadFitments.length,
        },
        canonicalApplications,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
