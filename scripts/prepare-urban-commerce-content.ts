import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { cleanUrbanSpoilerEditorialText, urbanDecalSalesRestriction } from "../src/lib/urbanSaleCopy";

async function main() {
  const envPath = process.argv.find((arg) => arg.startsWith("--env-path="))?.slice(11);
  if (!envPath) throw new Error("Explicit env-path required");
  const env = parse(readFileSync(envPath));
  const url = env.DIRECT_URL || env.DATABASE_URL;
  process.env.DATABASE_URL = url;
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const fields = ["shortDescUa", "shortDescEn", "longDescUa", "longDescEn", "bodyHtmlUa", "bodyHtmlEn"] as const;
  const runLabel = process.argv.find((arg) => arg.startsWith("--run-label="))?.slice(12);
  if (runLabel && !/^[a-z0-9-]{1,64}$/.test(runLabel)) throw new Error("Invalid run label");
  const directory = resolve("outputs/site-commerce-2026-10-03", runLabel ?? "");
  mkdirSync(directory, { recursive: true });
  try {
    const rows = await prisma.shopProduct.findMany({ where: { sku: { in: ["URB-SPO-25353093-V1", "URB-DEC-26009343-V1"] } } });
    if (rows.length !== 2) throw new Error("Expected exact Urban SKU pair");
    const plans = rows.map((row) => {
      const changes: Partial<Record<typeof fields[number], string>> = {};
      for (const field of fields) {
        const text = row[field] ?? "";
        let next = text;
        if (row.sku === "URB-SPO-25353093-V1") next = cleanUrbanSpoilerEditorialText(text);
        else if (!/only when ordered together|only together|лише разом|тільки разом/i.test(text)) next = field.startsWith("bodyHtml") ? `<p><strong>${urbanDecalSalesRestriction(field.endsWith("Ua") ? "ua" : "en")}</strong></p>${text}` : `${urbanDecalSalesRestriction(field.endsWith("Ua") ? "ua" : "en")}\n\n${text}`;
        if (next !== text) changes[field] = next;
      }
      return { id: row.id, sku: row.sku, catalogVersion: row.catalogVersion.toString(), before: Object.fromEntries(fields.map((field) => [field, row[field]])), changes };
    });
    writeFileSync(resolve(directory, "urban-content-plan.json"), JSON.stringify({ readAt: new Date().toISOString(), plans }, null, 2));
    console.log(JSON.stringify({ plans: plans.map((plan) => ({ sku: plan.sku, fields: Object.keys(plan.changes) })) }));
    if (process.argv.includes("--commit-spoiler") || process.argv.includes("--commit-decal")) {
      const { coordinateShopCatalogProductMutationWithClient } = await import("../src/lib/shopCatalogMutationCoordinator.server");
      const { buildShopCatalogAdminSnapshot } = await import("../src/lib/shopCatalogAdminSnapshot.server");
      const isDecal = process.argv.includes("--commit-decal");
      if (isDecal && process.argv.includes("--commit-spoiler")) throw new Error("Choose exactly one SKU operation");
      const plan = plans.find((plan) => plan.sku === (isDecal ? "URB-DEC-26009343-V1" : "URB-SPO-25353093-V1"))!;
      if (Object.keys(plan.changes).length) {
        const result = await coordinateShopCatalogProductMutationWithClient(prisma, { productId: plan.id, expectedCatalogVersion: plan.catalogVersion, changeDomains: ["CONTENT"], async mutateAndSnapshot(tx, nextVersion) {
          await tx.shopProduct.update({ where: { id: plan.id }, data: plan.changes });
          return buildShopCatalogAdminSnapshot(tx, plan.id, nextVersion, { type: "IMPORT", id: "owner-approved-site-content-2026-10-03", reason: isDecal ? "Publish owner-approved Urban decal/bodykit restriction with deployed purchase guards" : "Remove only Urban spoiler editorial photo/gallery explanations" });
        } });
        writeFileSync(resolve(directory, isDecal ? "urban-decal-result.json" : "urban-spoiler-result.json"), JSON.stringify(result, null, 2));
        console.log(JSON.stringify({ updated: plan.sku, outboxId: result.outboxId }));
      }
    }
  } finally { await prisma.$disconnect(); }
}
void main().catch((error) => { console.error(error instanceof Error ? error.message : "Urban content preparation failed"); process.exitCode = 1; });
