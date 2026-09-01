import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import {
  buildShopCatalogReleaseEvidence,
  fingerprintCatalogSourceCoverage,
  readCommitBoundPerformance,
  SHOP_CATALOG_LOGICAL_SOURCES,
} from "../src/lib/shopCatalogReleaseEvidence";
import {
  createShopCatalogReleaseMarker,
  evaluateShopCatalogReleaseActivation,
} from "../src/lib/shopCatalogReleaseActivationGuard";
import { readShopCatalogShadowEvidenceWithClient } from "../src/lib/shopCatalogShadowTelemetry.server";
import { readShopCatalogSourceCoveragePage } from "../src/lib/shopCatalogSourceCoverageReport.server";

function argument(name: string, fallback?: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length).trim() ?? fallback;
}

function fullCommit() {
  const value = argument("commit")?.toLowerCase();
  if (!value || !/^[a-f0-9]{40}$/.test(value)) throw new Error("--commit must be a full 40-character Git SHA");
  return value;
}

async function jsonArtifact(relativePath: string) {
  const absolute = path.resolve(relativePath);
  const artifactRoot = `${path.resolve("artifacts")}${path.sep}`;
  if (!absolute.startsWith(artifactRoot) || path.extname(absolute) !== ".json") {
    throw new Error("gate artifacts must be JSON files below artifacts/");
  }
  return JSON.parse(await readFile(absolute, "utf8")) as Record<string, unknown>;
}

async function sourceCoverage(client: PrismaClient) {
  const result: Array<{ key: string; recordFingerprints: string[] }> = [];
  for (const key of SHOP_CATALOG_LOGICAL_SOURCES) {
    let cursor: string | null = null;
    const recordFingerprints: string[] = [];
    do {
      const page = await readShopCatalogSourceCoveragePage(client, { sourceKey: key, afterRecordId: cursor, limit: 500 });
      if (!page || !page.source.isActive) throw new Error(`source ${key} is missing or inactive`);
      for (const record of page.records) {
        if (!record.activationReady || !record.fingerprint) throw new Error(`source ${key} record ${record.recordKey} is not activation-ready`);
        recordFingerprints.push(record.fingerprint);
      }
      cursor = page.nextRecordId;
    } while (cursor);
    result.push({ key, recordFingerprints });
  }
  return fingerprintCatalogSourceCoverage(result);
}

async function projectionLag(client: PrismaClient) {
  const rows = await client.$queryRaw<Array<{ missing: bigint; lag: bigint | null }>>`
    SELECT
      count(*) FILTER (WHERE ready_locales < 2)::bigint AS missing,
      max(GREATEST(product_version - projection_version, 0))::bigint AS lag
    FROM (
      SELECT product.id,
             product."publishedCatalogVersion" AS product_version,
             count(projection.id) FILTER (
               WHERE projection.locale IN ('ua', 'en')
                 AND projection."catalogVersion" = product."publishedCatalogVersion"
             ) AS ready_locales,
             coalesce(min(projection."catalogVersion"), 0) AS projection_version
      FROM "ShopProduct" product
      LEFT JOIN "ShopCatalogProjection" projection ON projection."productId" = product.id
      WHERE product."isPublished" = true AND product.status = 'ACTIVE'
      GROUP BY product.id, product."publishedCatalogVersion"
    ) readiness
  `;
  const missing = Number(rows[0]?.missing ?? 0);
  if (missing) throw new Error(`${missing} published products lack current ua/en projections`);
  return Number(rows[0]?.lag ?? 0);
}

async function main() {
  if (process.env.CATALOG_RELEASE_EVIDENCE_ALLOW_DB_READ !== "1") throw new Error("Set CATALOG_RELEASE_EVIDENCE_ALLOW_DB_READ=1 for this read-only collector");
  const databaseUrl = process.env.CATALOG_RELEASE_EVIDENCE_DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("CATALOG_RELEASE_EVIDENCE_DATABASE_URL is required");
  const commitSha = fullCommit();
  const hours = Number(argument("shadow-hours", "24"));
  const lifetimeMinutes = Number(argument("lifetime-minutes", "120"));
  if (!Number.isFinite(hours) || hours <= 0 || hours > 168) throw new Error("--shadow-hours must be within 0..168");
  const performance = readCommitBoundPerformance({
    commitSha,
    scale: await jsonArtifact(argument("scale", "artifacts/catalog-v2-scale/catalog-v2-scale-gate.json")!),
    publication: await jsonArtifact(argument("publication", "artifacts/catalog-v2-publication/catalog-v2-publication-gate.json")!),
  });
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const [sourceCoverageFingerprint, lag, shadow] = await Promise.all([
      sourceCoverage(client),
      projectionLag(client),
      readShopCatalogShadowEvidenceWithClient(client, { deploymentCommit: commitSha, since: new Date(Date.now() - hours * 3_600_000) }),
    ]);
    const generatedAt = new Date();
    const evidence = buildShopCatalogReleaseEvidence({
      commitSha,
      generatedAt,
      lifetimeMinutes,
      sourceCoverageFingerprint,
      projectionLag: lag,
      shadow: { sampledRequests: shadow.sampledRequests, mismatches: shadow.mismatches, errorRate: shadow.errorRate },
      performance,
    });
    const validationSecret = "catalog-release-evidence-validation-only";
    const decision = evaluateShopCatalogReleaseActivation({
      requestedMode: "canary",
      deployedCommit: commitSha,
      marker: createShopCatalogReleaseMarker({ evidence, secret: validationSecret }),
      secret: validationSecret,
      now: generatedAt,
    });
    if (!decision.allowed) throw new Error(`release evidence failed closed: ${decision.reasons.join("; ")}`);
    const directory = path.resolve("artifacts", "catalog-v2-release");
    await mkdir(directory, { recursive: true });
    const output = path.join(directory, `catalog-v2-release-evidence-${commitSha}.json`);
    await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ status: "PASS", output, evidence }, null, 2));
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
