import { promises as fs } from "node:fs";
import path from "node:path";

const allowedAlterTables = new Set([
  "AdminUser",
  "ShopOrder",
  "ShopProduct",
  "ShopProductVariant",
  "ShopSettings",
]);

function parseArgument(name: string) {
  return process.argv
    .slice(2)
    .find((argument) => argument.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
}

function tableNameFromAlterBlock(block: string) {
  return block.match(/ALTER TABLE "([^"]+)"/)?.[1] ?? null;
}

function shouldKeepBlock(block: string) {
  if (/^-- (CreateEnum|AlterEnum|CreateTable|CreateIndex|AddForeignKey)\b/.test(block)) {
    return true;
  }
  if (block.startsWith("-- AlterTable")) {
    const tableName = tableNameFromAlterBlock(block);
    return tableName ? allowedAlterTables.has(tableName) : false;
  }
  return false;
}

async function main() {
  const input = parseArgument("input");
  const output =
    parseArgument("output") ||
    path.join(
      "prisma",
      "migrations",
      "20260719009000_reconcile_existing_schema_history",
      "migration.sql"
    );

  if (!input) throw new Error("--input is required");
  const inputPath = path.resolve(input);
  const allowedInputRoot = path.resolve("backups", "ops-preflight");
  const outputPath = path.resolve(output);
  const allowedOutputRoot = path.resolve("prisma", "migrations");

  if (!inputPath.startsWith(`${allowedInputRoot}${path.sep}`)) {
    throw new Error(`Input must stay inside ${allowedInputRoot}`);
  }
  if (!outputPath.startsWith(`${allowedOutputRoot}${path.sep}`)) {
    throw new Error(`Output must stay inside ${allowedOutputRoot}`);
  }

  const generated = await fs.readFile(inputPath, "utf8");
  const blocks = generated
    .split(
      /(?=^-- (?:CreateEnum|AlterEnum|DropIndex|AlterTable|CreateTable|CreateIndex|AddForeignKey|RenameIndex|RenameForeignKey)\b)/m
    )
    .filter((block) => block.trim());
  const kept = blocks.filter(shouldKeepBlock);
  const sql = `-- Forward-only reconciliation of schema objects that already exist in the
-- configured One Company database but were missing from committed migration
-- history.
--
-- Existing staging/production databases MUST pass scripts/operations/phase0-audit.ts
-- and then mark this migration applied with Prisma migrate resolve. Do not execute
-- this CREATE-heavy body against an existing database. Fresh databases execute it
-- normally, which makes migration replay reproduce prisma/schema.prisma.
--
-- This file intentionally contains no destructive table/column/type or row-removal
-- statements.

BEGIN;

${kept.map((block) => block.trim()).join("\n\n")}

COMMIT;
`;

  const forbidden = [
    /\bDROP TABLE\b/i,
    /\bDROP COLUMN\b/i,
    /\bDROP TYPE\b/i,
    /\bDELETE FROM\b/i,
    /\bTRUNCATE\b/i,
  ];
  const violation = forbidden.find((pattern) => pattern.test(sql));
  if (violation) throw new Error(`Generated reconciliation contains ${violation}`);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, sql, "utf8");

  console.log(
    JSON.stringify(
      {
        inputPath,
        outputPath,
        totalBlocks: blocks.length,
        keptBlocks: kept.length,
        bytes: Buffer.byteLength(sql),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown materialization error";
  console.error(`Legacy reconciliation materialization failed: ${message}`);
  process.exitCode = 1;
});
