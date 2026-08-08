import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient, ShopCatalogStatus } from "@prisma/client";

import { SHOP_AI_V2_ROLLOUT_CATEGORIES } from "../src/lib/shopAiV2RolloutContract";
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
  const rows = (
    await Promise.all(
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
    )
  ).flat();

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
        make: application?.make,
        model: application?.model,
        chassis: application?.chassisCode,
        year: application?.yearFrom ?? application?.yearTo,
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
  });
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
  const countsByCategory = Object.fromEntries(
    SHOP_AI_V2_ROLLOUT_CATEGORIES.map((category) => [
      category,
      queue.items.filter((item) => item.category === category).length,
    ])
  );
  const countsByLanguage = Object.fromEntries(
    ["ua", "en", "ru", "mixed", "translit"].map((language) => [
      language,
      queue.items.filter((item) => item.language === language).length,
    ])
  );
  console.log(
    JSON.stringify(
      {
        output,
        total: queue.items.length,
        status: "pending_human_review",
        hardNegativeCandidates: queue.items.filter((item) => item.draftCase.metadata?.hardNegative)
          .length,
        exactSkuCandidates: queue.items.filter((item) =>
          item.draftCase.metadata?.tags?.includes("exact-sku")
        ).length,
        countsByCategory,
        countsByLanguage,
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
