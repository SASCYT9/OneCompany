#!/usr/bin/env tsx
/**
 * Sets `isPublished = false` on iPE products that exist in our DB but are
 * absent from both the latest iPE Shopify snapshot AND the latest match
 * manifest. These are orphan products that iPE no longer publishes — we hide
 * them rather than hard-delete (preserves order history and admin context).
 *
 * Flags:
 *   --apply             write to DB (default: dry-run)
 */

import fs from "node:fs/promises";
import path from "node:path";
import { existsSync, readdirSync } from "node:fs";

import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config({ path: ".env.local" });
config({ path: ".env" });

const APPLY = process.argv.includes("--apply");
const ART_ROOT = path.join(process.cwd(), "artifacts");

function resolveSnapshotDir(): string {
  const root = path.join(ART_ROOT, "ipe-import");
  const dirs = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => existsSync(path.join(root, name, "match-manifest.json")))
    .sort()
    .reverse();
  if (!dirs.length) throw new Error("No iPE snapshot dir with match-manifest.json found");
  return path.join(root, dirs[0]);
}

const prisma = new PrismaClient();

async function main() {
  const SNAPSHOT_DIR = resolveSnapshotDir();
  console.log(`Snapshot dir: ${path.basename(SNAPSHOT_DIR)}`);
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);

  const [snap, manifest] = await Promise.all([
    fs.readFile(path.join(SNAPSHOT_DIR, "official-snapshot.json"), "utf8").then(JSON.parse),
    fs.readFile(path.join(SNAPSHOT_DIR, "match-manifest.json"), "utf8").then(JSON.parse),
  ]);

  const snapHandles = new Set(snap.products.map((p: any) => p.handle));
  const manifestHandles = new Set(
    manifest.rows.map((r: any) => r.officialHandle).filter((h: string | null) => Boolean(h))
  );

  const ipe = await prisma.shopProduct.findMany({
    where: { brand: { contains: "iPE", mode: "insensitive" } },
    select: { id: true, slug: true, titleEn: true, isPublished: true },
  });

  const orphans = ipe.filter((p) => {
    const handle = p.slug.replace(/^ipe-/, "");
    return !snapHandles.has(handle) && !manifestHandles.has(handle);
  });

  console.log(`\nTotal iPE products: ${ipe.length}`);
  console.log(`Orphans (not in snapshot or manifest): ${orphans.length}`);
  for (const o of orphans) {
    console.log(`  ${o.slug}  isPublished=${o.isPublished}  "${o.titleEn}"`);
  }
  const toUnpublish = orphans.filter((o) => o.isPublished);
  console.log(`\nWill change isPublished=true -> false on ${toUnpublish.length} products`);

  if (!APPLY) {
    console.log("\n(dry run — pass --apply to write)");
    await prisma.$disconnect();
    return;
  }

  if (!toUnpublish.length) {
    console.log("Nothing to change.");
    await prisma.$disconnect();
    return;
  }

  const ids = toUnpublish.map((o) => o.id);
  const result = await prisma.shopProduct.updateMany({
    where: { id: { in: ids } },
    data: { isPublished: false },
  });
  console.log(`Updated: ${result.count}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
