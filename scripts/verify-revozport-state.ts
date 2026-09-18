import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
async function main() {
  const dir = ".tmp/revozport-enrichment";
  const beforeName = (await readdir(dir)).filter((n) => /-before\.json$/.test(n) && !n.includes("taxonomy")).sort()[0];
  if (!beforeName) throw new Error("Missing pre-update backup");
  const before = JSON.parse(await readFile(`${dir}/${beforeName}`, "utf8")) as Record<string, unknown>[];
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.shopProduct.findMany({ where: { brand: "Revozport" }, include: { media: true, category: true, metafields: true } });
    assert.equal(rows.length, before.length);
    const untouchedFields = Object.keys(before[0]).filter((key) => /^(price|compareAt)/.test(key)).concat(["stock", "isPublished", "status", "weight", "length", "width", "height", "sku", "slug"]);
    for (const row of rows) {
      const original = before.find((p) => p.id === row.id)!;
      assert.ok(original);
      for (const key of untouchedFields) assert.equal(JSON.stringify((row as unknown as Record<string, unknown>)[key]), JSON.stringify(original[key]), `Unexpected change ${row.sku}.${key}`);
    }
    const drafts = rows.filter((r) => !r.isPublished).map((r) => ({ sku: r.sku, missing: [
      !(r.priceUsd && Number(r.priceUsd) > 0) ? "positive price" : null,
      !r.image ? "image" : null,
      ![r.length, r.width, r.height].every((n) => n && Number(n) > 0) ? "dimensions" : null,
      !(r.weight && Number(r.weight) > 0) ? "weight" : null,
      !r.metafields.some((m) => m.namespace === "revozport_logistics" && m.key === "sea_shipping_usd") ? "SEA quote" : null,
    ].filter(Boolean), note: "Draft status retained; a complete set of fields alone is not approval to publish." }));
    const jobs = await prisma.shopCatalogOutbox.groupBy({ by: ["status"], where: { revision: { actorId: "revozport-content@system.local" }, product: { brand: "Revozport" } }, _count: true });
    const outsideScope = await prisma.shopCatalogProductRevision.count({ where: { actorId: "revozport-content@system.local", product: { brand: { not: "Revozport" } } } });
    assert.equal(outsideScope, 0);
    const report = { checkedAt: new Date().toISOString(), total: rows.length, published: rows.filter((r) => r.isPublished).length,
      drafts: drafts.length, withBrandRelation: rows.filter((r) => r.brandId).length, withCategory: rows.filter((r) => r.categoryId).length,
      withMakeTags: rows.filter((r) => r.tags.some((tag) => tag.startsWith("fits-make:"))).length,
      withMultipleImages: rows.filter((r) => r.media.filter((m) => m.mediaType === "IMAGE").length > 1).length,
      fullyProjected: rows.filter((r) => r.publishedCatalogVersion === r.catalogVersion).length,
      preservedFields: untouchedFields, outsideScopeChanges: outsideScope, jobs, draftDetails: drafts };
    await writeFile(`${dir}/readiness-audit.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, draftDetails: undefined }, null, 2));
  } finally { await prisma.$disconnect(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
