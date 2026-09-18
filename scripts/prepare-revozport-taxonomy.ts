import { mkdir, writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { parseSupplierFitmentContract, supplierContractToNormalizedFitment } from "../src/lib/shopImportFitment";
import { coordinateShopCatalogProductMutationWithClient } from "../src/lib/shopCatalogMutationCoordinator.server";
import { buildShopCatalogAdminSnapshot } from "../src/lib/shopCatalogAdminSnapshot.server";

const commit = process.argv.includes("--commit");
const json = (value: unknown) => JSON.stringify(value, (_, v) => typeof v === "bigint" ? String(v) : v, 2);
async function main() {
  if (commit && !process.argv.includes("--target=onecompany.global")) throw new Error("Explicit target required");
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.shopProduct.findMany({ where: { brand: "Revozport" }, include: { metafields: true } });
    const existingBrand = await prisma.shopBrand.findUnique({ where: { key: "revozport" } });
    const categories = await prisma.shopCategory.findMany();
    const plans = rows.map((row) => {
      const contract = parseSupplierFitmentContract(row.metafields.find((m) => m.namespace === "onecompany" && m.key === "supplier_fitment")?.value);
      const applications = contract ? supplierContractToNormalizedFitment(contract).applications : [];
      const makeTags = applications.map((a) => `fits-make:${a.make.toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, "-")}`);
      const tags = [...new Set([...row.tags, ...makeTags])];
      // Never categorize a SKU-only row from a generic supplier category.
      const category = /stainless steel tailpipe/i.test(row.titleEn) ? "exhaust-systems"
        : /carbon(?: fiber| fibre)?/i.test(row.titleEn) ? "carbon-aero" : null;
      return { row, tags, category };
    });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await mkdir(".tmp/revozport-enrichment", { recursive: true });
    await writeFile(`.tmp/revozport-enrichment/${stamp}-taxonomy-before.json`, json({ rows, existingBrand, categories }));
    console.log(json({ commit, products: rows.length, brandExists: Boolean(existingBrand), carbonCategory: plans.filter((p) => p.category === "carbon-aero").length,
      exhaustCategory: plans.filter((p) => p.category === "exhaust-systems").length, makeTagsAdded: plans.filter((p) => p.tags.length > p.row.tags.length).length }));
    if (!commit) return;
    const brand = existingBrand ?? await prisma.shopBrand.create({ data: { key: "revozport", name: "Revozport", nameUa: "Revozport", nameEn: "Revozport" } });
    if (!brand.isActive) throw new Error("Existing brand is inactive; review required");
    const carbon = categories.find((c) => c.slug === "carbon-aero") ?? await prisma.shopCategory.create({ data: { slug: "carbon-aero", titleUa: "Карбон і аеродинаміка", titleEn: "Carbon and aero" } });
    const exhaust = categories.find((c) => c.slug === "exhaust-systems");
    const results: unknown[] = [];
    let cursor = 0;
    let reportWrite = Promise.resolve();
    async function worker() {
      while (cursor < plans.length) {
      const { row, tags, category } = plans[cursor++];
      const targetCategory = category === "carbon-aero" ? carbon : category === "exhaust-systems" ? exhaust : null;
      if (row.brandId && row.brandId !== brand.id) throw new Error(`Existing conflicting brand relation: ${row.sku}`);
      if (row.categoryId && targetCategory && row.categoryId !== targetCategory.id) throw new Error(`Existing conflicting category: ${row.sku}`);
      const data = {
        ...(!row.brandId ? { catalogBrand: { connect: { id: brand.id } } } : {}),
        ...(!row.categoryId && targetCategory ? { category: { connect: { id: targetCategory.id } } } : {}),
        ...(tags.length > row.tags.length ? { tags } : {}),
      };
      if (!Object.keys(data).length) continue;
      const result = await coordinateShopCatalogProductMutationWithClient(prisma, {
        productId: row.id, expectedCatalogVersion: row.catalogVersion.toString(), changeDomains: ["TAXONOMY", "FITMENT"],
        async mutateAndSnapshot(tx, version) {
          await tx.shopProduct.update({ where: { id: row.id }, data });
          return buildShopCatalogAdminSnapshot(tx, row.id, version, { type: "IMPORT", id: "revozport-content@system.local", reason: "revozport.catalog-taxonomy-and-supplier-make-tags" });
        },
      });
      results.push({ sku: row.sku, ...result });
      const report = json(results);
      reportWrite = reportWrite.then(() => writeFile(`.tmp/revozport-enrichment/${stamp}-taxonomy-completed.json`, report));
      await reportWrite;
      if (results.length % 25 === 0) console.log(`Taxonomy saved ${results.length}/${plans.length}`);
      }
    }
    // Snapshot reads span shared relation tables under SERIALIZABLE isolation.
    // Keep these writes sequential to avoid predicate-lock conflicts.
    await worker();
    console.log(json({ saved: results.length }));
  } finally { await prisma.$disconnect(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
