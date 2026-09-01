import { PrismaClient } from "@prisma/client";

import { readShopCatalogShadowEvidenceWithClient } from "../src/lib/shopCatalogShadowTelemetry.server";

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length).trim();
}

async function main() {
  if (process.env.CATALOG_SHADOW_EVIDENCE_ALLOW_DB_READ !== "1") {
    throw new Error("Set CATALOG_SHADOW_EVIDENCE_ALLOW_DB_READ=1 for this read-only report");
  }
  const databaseUrl = process.env.CATALOG_SHADOW_EVIDENCE_DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("CATALOG_SHADOW_EVIDENCE_DATABASE_URL is required");
  const deploymentCommit = argument("commit")?.toLowerCase() ?? "";
  const hours = Number(argument("hours") ?? "24");
  if (!Number.isSafeInteger(hours) || hours < 1 || hours > 168) {
    throw new TypeError("--hours must be an integer between 1 and 168");
  }
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const report = await readShopCatalogShadowEvidenceWithClient(client, {
      deploymentCommit,
      since: new Date(Date.now() - hours * 60 * 60 * 1000),
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.sampledRequests < 1000 || report.mismatches > 0 || report.errorRate > 0.001) {
      process.exitCode = 2;
    }
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
