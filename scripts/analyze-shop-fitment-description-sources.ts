import fs from "node:fs";
import path from "node:path";

import { extractProductFitment, isExpectedChassisForMakeModel } from "../src/lib/crossShopFitment";
import { prisma } from "../src/lib/prisma";
import { getShopFitmentCatalogProducts } from "../src/lib/shopFitmentCatalogServer";

const PAGE_SIZE = 300;
const OUTPUT_DIR = path.join(process.cwd(), "artifacts", "stock-fitment-audit");

type BrandStats = {
  brand: string;
  total: number;
  currentMake: number;
  currentModel: number;
  currentChassis: number;
  currentYear: number;
  descriptionWithMake: number;
  descriptionWithModel: number;
  descriptionWithChassis: number;
  descriptionWithYear: number;
  recoverableModel: number;
  recoverableChassis: number;
  recoverableYear: number;
  structuredDescriptionCandidate: number;
  conflictingDescriptionCandidate: number;
};

const percent = (value: number, total: number) =>
  total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0;

async function loadDescriptions() {
  const byId = new Map<string, string>();
  let cursor: string | undefined;
  while (true) {
    const rows = await prisma.shopProduct.findMany({
      where: { isPublished: true, status: "ACTIVE" },
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        shortDescUa: true,
        shortDescEn: true,
        longDescUa: true,
        longDescEn: true,
        bodyHtmlUa: true,
        bodyHtmlEn: true,
      },
    });
    for (const row of rows) {
      byId.set(
        row.id,
        [
          row.shortDescUa,
          row.shortDescEn,
          row.bodyHtmlUa ?? row.longDescUa,
          row.bodyHtmlEn ?? row.longDescEn,
        ]
          .filter(Boolean)
          .join(" | ")
      );
    }
    if (rows.length < PAGE_SIZE) break;
    cursor = rows.at(-1)?.id;
  }
  return byId;
}

function hasModelChassisConflict(make: string | null, models: string[], chassisCodes: string[]) {
  if (!make || models.length === 0 || chassisCodes.length === 0) return false;
  return chassisCodes.some(
    (chassis) => !models.some((model) => isExpectedChassisForMakeModel(make, model, chassis))
  );
}

async function main() {
  const [products, descriptionById] = await Promise.all([
    getShopFitmentCatalogProducts(),
    loadDescriptions(),
  ]);
  const byBrand = new Map<string, BrandStats>();

  for (const product of products) {
    const brand = String(product.brand || product.vendor || "Unknown").trim() || "Unknown";
    const stats = byBrand.get(brand) ?? {
      brand,
      total: 0,
      currentMake: 0,
      currentModel: 0,
      currentChassis: 0,
      currentYear: 0,
      descriptionWithMake: 0,
      descriptionWithModel: 0,
      descriptionWithChassis: 0,
      descriptionWithYear: 0,
      recoverableModel: 0,
      recoverableChassis: 0,
      recoverableYear: 0,
      structuredDescriptionCandidate: 0,
      conflictingDescriptionCandidate: 0,
    };
    stats.total += 1;

    const current = extractProductFitment(product);
    stats.currentMake += current.make ? 1 : 0;
    stats.currentModel += current.models.length ? 1 : 0;
    stats.currentChassis += current.chassisCodes.length ? 1 : 0;
    stats.currentYear += current.yearRanges.length ? 1 : 0;

    const description = descriptionById.get(product.id ?? "") ?? "";
    const fromDescription = extractProductFitment({
      ...product,
      title: { ua: description, en: description },
      collection: { ua: "", en: "" },
      productType: "",
      tags: [],
      collections: [],
      variants: [],
      slug: "",
    });
    stats.descriptionWithMake += fromDescription.make ? 1 : 0;
    stats.descriptionWithModel += fromDescription.models.length ? 1 : 0;
    stats.descriptionWithChassis += fromDescription.chassisCodes.length ? 1 : 0;
    stats.descriptionWithYear += fromDescription.yearRanges.length ? 1 : 0;

    const sameMake =
      !current.make ||
      !fromDescription.make ||
      current.make.toLowerCase() === fromDescription.make.toLowerCase();
    if (!current.models.length && fromDescription.models.length && sameMake) {
      stats.recoverableModel += 1;
    }
    if (!current.chassisCodes.length && fromDescription.chassisCodes.length && sameMake) {
      stats.recoverableChassis += 1;
    }
    if (!current.yearRanges.length && fromDescription.yearRanges.length && sameMake) {
      stats.recoverableYear += 1;
    }

    const conflict = hasModelChassisConflict(
      fromDescription.make,
      fromDescription.models,
      fromDescription.chassisCodes
    );
    if (
      fromDescription.make &&
      fromDescription.models.length &&
      (fromDescription.chassisCodes.length || fromDescription.yearRanges.length)
    ) {
      if (conflict) stats.conflictingDescriptionCandidate += 1;
      else stats.structuredDescriptionCandidate += 1;
    }
    byBrand.set(brand, stats);
  }

  const brands = [...byBrand.values()].sort((a, b) => b.total - a.total);
  const rows = brands.map((item) => ({
    ...item,
    currentMakePct: percent(item.currentMake, item.total),
    currentModelPct: percent(item.currentModel, item.total),
    currentChassisPct: percent(item.currentChassis, item.total),
    currentYearPct: percent(item.currentYear, item.total),
    recoverableModelPct: percent(item.recoverableModel, item.total),
    recoverableChassisPct: percent(item.recoverableChassis, item.total),
    recoverableYearPct: percent(item.recoverableYear, item.total),
  }));
  const totals = rows.reduce(
    (acc, row) => {
      for (const key of [
        "total",
        "currentMake",
        "currentModel",
        "currentChassis",
        "currentYear",
        "recoverableModel",
        "recoverableChassis",
        "recoverableYear",
        "structuredDescriptionCandidate",
        "conflictingDescriptionCandidate",
      ] as const) {
        acc[key] += row[key];
      }
      return acc;
    },
    {
      total: 0,
      currentMake: 0,
      currentModel: 0,
      currentChassis: 0,
      currentYear: 0,
      recoverableModel: 0,
      recoverableChassis: 0,
      recoverableYear: 0,
      structuredDescriptionCandidate: 0,
      conflictingDescriptionCandidate: 0,
    }
  );

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "fitment-description-source-analysis.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), totals, brands: rows }, null, 2)
  );
  const header =
    "| Бренд | Товарів | Модель зараз | Кузов зараз | Рік зараз | +модель з опису | +кузов з опису | +рік з опису | Структуровані кандидати | Конфлікти |";
  const separator = "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|";
  const markdown = [
    "# Fitment evidence by product brand",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    header,
    separator,
    ...rows.map(
      (row) =>
        `| ${row.brand.replaceAll("|", "\\|")} | ${row.total} | ${row.currentModel} (${row.currentModelPct}%) | ${row.currentChassis} (${row.currentChassisPct}%) | ${row.currentYear} (${row.currentYearPct}%) | ${row.recoverableModel} | ${row.recoverableChassis} | ${row.recoverableYear} | ${row.structuredDescriptionCandidate} | ${row.conflictingDescriptionCandidate} |`
    ),
    "",
    "Potential description recovery is evidence for review, not an automatic verified fitment.",
  ].join("\n");
  fs.writeFileSync(path.join(OUTPUT_DIR, "fitment-description-source-analysis.md"), markdown);
  console.log(JSON.stringify({ totals, brands: rows.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
