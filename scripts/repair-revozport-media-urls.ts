import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";
import { coordinateShopCatalogProductMutationWithClient } from "../src/lib/shopCatalogMutationCoordinator.server";
import { buildShopCatalogAdminSnapshot } from "../src/lib/shopCatalogAdminSnapshot.server";
const run = promisify(execFile);
const file = ".tmp/revozport-enrichment/media-url-validation.json";
const uuid = /_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\./i;
type Checked = { from: string; to: string; valid: boolean };
async function main() {
  if (!process.argv.includes("--commit")) {
    const plans = JSON.parse(await readFile(".tmp/revozport-enrichment/content-plan.json", "utf8")) as { gallery?: string[] }[];
    const urls = [...new Set(plans.flatMap((p) => p.gallery ?? []))].filter((u) => u.startsWith("https://cdn.shopify.com/s/files/1/0723/2802/0188/files/") && uuid.test(u));
    const checked: Checked[] = [];
    let cursor = 0;
    async function worker() {
      while (cursor < urls.length) {
        const from = urls[cursor++];
        const to = from.replace("https://cdn.shopify.com/s/files/1/0723/2802/0188/files/", "https://revozport.com/cdn/shop/files/");
        try {
          const { stdout } = await run("curl.exe", ["--silent", "--show-error", "--head", "--max-time", "30", to]);
          checked.push({ from, to, valid: /^HTTP\/\S+ 200/m.test(stdout) && /content-type: image\//i.test(stdout) });
        } catch { checked.push({ from, to, valid: false }); }
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);
    await writeFile(file, JSON.stringify({ checkedAt: new Date().toISOString(), checked }, null, 2));
    console.log(JSON.stringify({ checked: checked.length, valid: checked.filter((c) => c.valid).length }));
    return;
  }
  if (!process.argv.includes("--target=onecompany.global")) throw new Error("Explicit target required");
  const checks = JSON.parse(await readFile(file, "utf8")) as { checkedAt: string; checked: Checked[] };
  if (Date.now() - Date.parse(checks.checkedAt) > 3600000) throw new Error("Refresh image checks");
  const replacements = new Map(checks.checked.filter((c) => c.valid).map((c) => [c.from, c.to]));
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.shopProduct.findMany({ where: { brand: "Revozport" }, include: { media: true } });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const json = (v: unknown) => JSON.stringify(v, (_, x) => typeof x === "bigint" ? String(x) : x, 2);
    await writeFile(`.tmp/revozport-enrichment/${stamp}-media-before.json`, json(rows));
    const completed: unknown[] = [];
    for (const row of rows) {
      const media = row.media.filter((m) => replacements.has(m.src));
      if (!media.length && !replacements.has(row.image ?? "")) continue;
      const gallery = Array.isArray(row.gallery) ? row.gallery.map((v) => typeof v === "string" ? replacements.get(v) ?? v : v) : null;
      const result = await coordinateShopCatalogProductMutationWithClient(prisma, {
        productId: row.id, expectedCatalogVersion: row.catalogVersion.toString(), changeDomains: ["MEDIA"],
        async mutateAndSnapshot(tx, version) {
          await tx.shopProduct.update({ where: { id: row.id }, data: {
            ...(row.image && replacements.has(row.image) ? { image: replacements.get(row.image)! } : {}),
            ...(gallery ? { gallery } : {}),
            media: { update: media.map((m) => ({ where: { id: m.id }, data: { src: replacements.get(m.src)! } })) },
          } });
          return buildShopCatalogAdminSnapshot(tx, row.id, version, { type: "IMPORT", id: "revozport-content@system.local", reason: "revozport.preserve-official-image-filenames" });
        },
      });
      completed.push({ sku: row.sku, ...result });
      await writeFile(`.tmp/revozport-enrichment/${stamp}-media-completed.json`, json(completed));
    }
    console.log(JSON.stringify({ saved: completed.length }));
  } finally { await prisma.$disconnect(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
