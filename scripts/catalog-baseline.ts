import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  buildShopCatalogBaselineProductEntry,
  buildShopCatalogLossLedger,
  buildShopCatalogLossLedgerFromEntries,
  fingerprintCatalogSnapshotMetadata,
  type CatalogBaselineInput,
  type CatalogBaselineProductEntry,
} from "../src/lib/shopCatalogBaseline";

type Source = "snapshot" | "fixture" | "db";

interface CliOptions {
  source: Source;
  manifest: string;
  fixture?: string;
  environment?: string;
  output?: string;
  help: boolean;
}

const NON_PRODUCTION_ENVIRONMENTS = new Set(["local", "development", "test", "preview", "staging"]);
const ARTIFACT_ROOT = resolve(process.cwd(), "artifacts", "catalog-baseline");

function usage() {
  return `Catalog V2 immutable baseline (read-only)

Default: validate the local fallback snapshot; no database connection and no file writes.

  tsx scripts/catalog-baseline.ts
  tsx scripts/catalog-baseline.ts --source=fixture --fixture=path/to/products.json
  tsx scripts/catalog-baseline.ts --source=db --environment=staging

DB reads require BOTH CATALOG_BASELINE_ALLOW_DB_READ=1 and
CATALOG_BASELINE_DATABASE_URL. Production environments are rejected.

An artifact is written only with --output=artifacts/catalog-baseline/<name>.json.
The artifacts/ directory is gitignored.`;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const values = new Map<string, string>();
  let help = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      help = true;
      continue;
    }
    if (!argument.startsWith("--")) throw new TypeError(`Unexpected argument: ${argument}`);
    const separator = argument.indexOf("=");
    const key = argument.slice(2, separator === -1 ? undefined : separator);
    const inline = separator === -1 ? undefined : argument.slice(separator + 1);
    const value = inline ?? argv[index + 1];
    if (!value || value.startsWith("--")) throw new TypeError(`Missing value for --${key}`);
    if (inline === undefined) index += 1;
    values.set(key, value);
  }
  const source = values.get("source") ?? "snapshot";
  if (source !== "snapshot" && source !== "fixture" && source !== "db") {
    throw new TypeError(`Unsupported source: ${source}`);
  }
  const known = new Set(["source", "manifest", "fixture", "environment", "output"]);
  for (const key of values.keys())
    if (!known.has(key)) throw new TypeError(`Unknown option: --${key}`);
  return {
    source,
    manifest: values.get("manifest") ?? "public/catalog-fallback/manifest.json",
    fixture: values.get("fixture"),
    environment: values.get("environment"),
    output: values.get("output"),
    help,
  };
}

function assertSafeDatabaseRead(options: CliOptions): string {
  const environment = options.environment?.toLowerCase();
  if (!environment || !NON_PRODUCTION_ENVIRONMENTS.has(environment)) {
    throw new Error(
      "DB source requires an explicit non-production --environment (local/development/test/preview/staging)"
    );
  }
  const productionSignals = [
    process.env.VERCEL_ENV,
    process.env.DEPLOY_ENV,
    process.env.APP_ENV,
    process.env.NODE_ENV,
  ]
    .filter(Boolean)
    .map((value) => value!.toLowerCase());
  if (productionSignals.includes("production")) {
    throw new Error("Catalog baseline DB reads are disabled in a production runtime");
  }
  if (process.env.CATALOG_BASELINE_ALLOW_DB_READ !== "1") {
    throw new Error("Set CATALOG_BASELINE_ALLOW_DB_READ=1 to acknowledge the read-only DB audit");
  }
  const datasourceUrl = process.env.CATALOG_BASELINE_DATABASE_URL;
  if (!datasourceUrl) {
    throw new Error(
      "CATALOG_BASELINE_DATABASE_URL is required; generic production URLs are never used"
    );
  }
  return datasourceUrl;
}

function resolveArtifactPath(output: string): string {
  const resolved = resolve(process.cwd(), output);
  const child = relative(ARTIFACT_ROOT, resolved);
  if (!child || child.startsWith("..") || isAbsolute(child) || !resolved.endsWith(".json")) {
    throw new Error("--output must be a .json file inside artifacts/catalog-baseline/");
  }
  return resolved;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function validateSnapshot(path: string) {
  const manifestPath = resolve(process.cwd(), path);
  const metadata = fingerprintCatalogSnapshotMetadata(await readJson(manifestPath));
  for (const store of metadata.stores) {
    const shardPath = resolve(dirname(manifestPath), store.file);
    const raw = await readFile(shardPath, "utf8");
    const shard = JSON.parse(raw) as unknown;
    if (!Array.isArray(shard) || shard.length !== store.count) {
      throw new Error(`Snapshot shard ${store.file} does not contain ${store.count} products`);
    }
    const expectedHash = /\.([a-f0-9]{12})\.json$/i.exec(store.file)?.[1];
    if (expectedHash) {
      const actualHash = createHash("sha256").update(raw).digest("hex").slice(0, 12);
      if (actualHash !== expectedHash)
        throw new Error(`Snapshot shard hash mismatch: ${store.file}`);
    }
  }
  return { kind: "snapshot-metadata" as const, manifest: manifestPath, ...metadata };
}

async function readFixture(path: string | undefined) {
  if (!path) throw new Error("--source=fixture requires --fixture=<local-json-path>");
  const fixturePath = resolve(process.cwd(), path);
  const value = await readJson(fixturePath);
  const products = Array.isArray(value)
    ? value
    : value &&
        typeof value === "object" &&
        Array.isArray((value as { products?: unknown }).products)
      ? (value as { products: unknown[] }).products
      : null;
  if (!products) throw new TypeError("Fixture must be a product array or { products: [...] }");
  return {
    kind: "catalog-loss-ledger" as const,
    fixture: fixturePath,
    ledger: buildShopCatalogLossLedger(products as CatalogBaselineInput[]),
  };
}

async function readDatabase(options: CliOptions) {
  const datasourceUrl = assertSafeDatabaseRead(options);
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasourceUrl });
  const entries: CatalogBaselineProductEntry[] = [];
  try {
    await prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        let cursor: string | undefined;
        for (;;) {
          const page = await transaction.shopProduct.findMany({
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            take: 250,
            orderBy: { id: "asc" },
            include: {
              category: true,
              bundle: {
                include: {
                  items: {
                    include: {
                      componentProduct: { select: { id: true, slug: true, sku: true } },
                      componentVariant: { select: { id: true, productId: true, sku: true } },
                    },
                  },
                },
              },
              bundleComponentItems: {
                include: {
                  bundle: { select: { id: true, productId: true } },
                  componentProduct: { select: { id: true, slug: true, sku: true } },
                  componentVariant: { select: { id: true, productId: true, sku: true } },
                },
              },
              cartItems: {
                select: { id: true, productId: true, variantId: true, productSlug: true },
              },
              orderItems: {
                select: { id: true, productId: true, variantId: true, productSlug: true },
              },
              collections: { include: { collection: true } },
              media: true,
              options: true,
              metafields: true,
              variants: {
                include: {
                  inventoryLevels: true,
                  cartItems: {
                    where: { productId: null },
                    select: { id: true, productId: true, variantId: true, productSlug: true },
                  },
                  knowledgeReviewTasks: true,
                },
              },
              vehicleApplications: { include: { reviewTasks: true } },
              knowledgeAttributeValues: {
                include: { definition: true, reviewTasks: true },
              },
              knowledgeChunks: true,
              knowledgeEvidence: true,
              knowledgeRevisions: true,
              knowledgeReviewTasks: true,
              knowledgeOutboxEvents: true,
              variantKnowledge: {
                include: {
                  applications: true,
                  attributeValues: { include: { definition: true } },
                  chunks: true,
                  evidence: true,
                },
              },
              knowledge: { include: { reviewTasks: true } },
            },
          });
          const variantToProduct = new Map<string, string>();
          for (const product of page) {
            for (const variant of product.variants) variantToProduct.set(variant.id, product.id);
          }
          const variantOrderItems =
            variantToProduct.size > 0
              ? await transaction.shopOrderItem.findMany({
                  where: {
                    productId: null,
                    variantId: { in: [...variantToProduct.keys()] },
                  },
                  select: { id: true, productId: true, variantId: true, productSlug: true },
                })
              : [];
          const variantOrderItemsByProduct = new Map<string, typeof variantOrderItems>();
          for (const item of variantOrderItems) {
            if (!item.variantId) continue;
            const productId = variantToProduct.get(item.variantId);
            if (!productId) continue;
            const existing = variantOrderItemsByProduct.get(productId) ?? [];
            existing.push(item);
            variantOrderItemsByProduct.set(productId, existing);
          }
          for (const product of page) {
            entries.push(
              buildShopCatalogBaselineProductEntry({
                ...(product as unknown as CatalogBaselineInput),
                orderItems: [
                  ...product.orderItems,
                  ...(variantOrderItemsByProduct.get(product.id) ?? []),
                ],
              })
            );
          }
          if (page.length < 250) break;
          cursor = page.at(-1)!.id;
        }
      },
      { isolationLevel: "RepeatableRead", timeout: 1_800_000 }
    );
  } finally {
    await prisma.$disconnect();
  }
  return {
    kind: "catalog-loss-ledger" as const,
    environment: options.environment,
    ledger: buildShopCatalogLossLedgerFromEntries(entries),
  };
}

async function maybeWriteArtifact(output: string | undefined, result: unknown) {
  if (!output) return null;
  const path = resolveArtifactPath(output);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), result }, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" }
  );
  return path;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  const result =
    options.source === "snapshot"
      ? await validateSnapshot(options.manifest)
      : options.source === "fixture"
        ? await readFixture(options.fixture)
        : await readDatabase(options);
  const artifact = await maybeWriteArtifact(options.output, result);
  if (result.kind === "catalog-loss-ledger") {
    console.log(
      JSON.stringify({
        source: options.source,
        fingerprint: result.ledger.fingerprint,
        contentFingerprint: result.ledger.contentFingerprint,
        identityFingerprint: result.ledger.identityFingerprint,
        counts: result.ledger.counts,
        identityIssues: result.ledger.identityIssues,
        artifact,
      })
    );
  } else {
    console.log(
      JSON.stringify({
        source: options.source,
        fingerprint: result.fingerprint,
        count: result.count,
        stores: result.stores.length,
        slugCount: result.slugCount,
        artifact,
      })
    );
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
