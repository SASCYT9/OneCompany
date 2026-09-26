#!/usr/bin/env tsx
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

import {
  WHEELFORCE_FAMILY_CHILD_TAG,
  WHEELFORCE_FAMILY_PARENT_TAG,
} from "../src/lib/wheelforceFamily";

config({ path: ".env.local" });
config({ path: ".env" });
const prisma = new PrismaClient();
const commit = process.argv.includes("--commit");

async function main() {
  const [children, parents] = await Promise.all([
    prisma.shopProduct.findMany({
      where: { brand: { equals: "WheelForce", mode: "insensitive" }, tags: { has: WHEELFORCE_FAMILY_CHILD_TAG } },
      select: { id: true },
    }),
    prisma.shopProduct.findMany({
      where: { brand: { equals: "WheelForce", mode: "insensitive" }, tags: { has: WHEELFORCE_FAMILY_PARENT_TAG } },
      select: { id: true },
    }),
  ]);
  const childIds = children.map((product) => product.id);
  const parentIds = parents.map((product) => product.id);
  const rows = await prisma.shopCatalogProjection.findMany({
    where: { productId: { in: [...childIds, ...parentIds] } },
    select: { id: true, productId: true, locale: true, statusKey: true },
  });
  const childSet = new Set(childIds);
  const parentSet = new Set(parentIds);
  const childRows = rows.filter((row) => childSet.has(row.productId));
  const parentRows = rows.filter((row) => parentSet.has(row.productId));
  console.log(JSON.stringify({
    mode: commit ? "commit" : "dry-run",
    childProducts: children.length,
    parentProducts: parents.length,
    childProjectionRows: childRows.length,
    parentProjectionRows: parentRows.length,
    childRowsToHide: childRows.filter((row) => row.statusKey !== "FAMILY_CHILD").length,
    parentRowsToShow: parentRows.filter((row) => row.statusKey !== "ACTIVE").length,
  }, null, 2));
  if (!commit) return;
  const backupPath = path.resolve("artifacts", `wheelforce-family-projections-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await mkdir(path.dirname(backupPath), { recursive: true });
  await writeFile(backupPath, JSON.stringify(rows, null, 2), "utf8");
  const [hidden, shown] = await Promise.all([
    prisma.shopCatalogProjection.updateMany({
      where: { productId: { in: childIds }, statusKey: { not: "FAMILY_CHILD" } },
      data: { statusKey: "FAMILY_CHILD" },
    }),
    prisma.shopCatalogProjection.updateMany({
      where: { productId: { in: parentIds }, statusKey: { not: "ACTIVE" } },
      data: { statusKey: "ACTIVE" },
    }),
  ]);
  console.log(JSON.stringify({ backupPath, childRowsHidden: hidden.count, parentRowsShown: shown.count }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
