import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

const ROUTE = "/[locale]/shop/catalog/page";
const CATALOG_ENTRY = "[project]/src/app/[locale]/shop/catalog/page";
const SHOP_LAYOUT_ENTRY = "[project]/src/app/[locale]/shop/layout";
const INITIAL_JS_GZIP_LIMIT = 150 * 1024;

type BuildManifest = {
  clientModules?: Record<string, unknown>;
  entryJSFiles?: Record<string, string[]>;
  entryCSSFiles?: Record<string, Array<{ path: string; inlined: boolean }>>;
};

function git(...args: string[]) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function requireCleanCommit() {
  const commitSha = git("rev-parse", "HEAD").toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(commitSha)) throw new Error("Git HEAD is not a full commit SHA");
  if (git("status", "--porcelain")) {
    throw new Error("Storefront build evidence must be measured from a clean committed worktree");
  }
  return commitSha;
}

function parseManifest(source: string): BuildManifest {
  const marker = `globalThis.__RSC_MANIFEST[${JSON.stringify(ROUTE)}] = `;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Catalog route ${ROUTE} is absent from its client manifest`);
  const jsonStart = start + marker.length;
  const jsonEnd = source.indexOf(";", jsonStart);
  if (jsonEnd < 0) throw new Error("Catalog client manifest assignment is incomplete");
  return JSON.parse(source.slice(jsonStart, jsonEnd)) as BuildManifest;
}

function unique(values: string[]) {
  return [...new Set(values)].sort();
}

function assertStaticAsset(relativePath: string) {
  const normalized = relativePath.replaceAll("\\", "/");
  if (!/^static\/chunks\/[A-Za-z0-9_.-]+\.(?:js|css)$/.test(normalized)) {
    throw new Error(`Manifest asset escapes .next/static/chunks: ${relativePath}`);
  }
  return path.resolve(".next", normalized);
}

async function measure(files: string[]) {
  let rawBytes = 0;
  let gzipBytes = 0;
  for (const file of files) {
    const contents = await readFile(assertStaticAsset(file));
    rawBytes += contents.byteLength;
    gzipBytes += gzipSync(contents, { level: 9 }).byteLength;
  }
  return { fileCount: files.length, rawBytes, gzipBytes, files };
}

async function main() {
  const commitSha = requireCleanCommit();
  const buildId = readFileSync(path.resolve(".next", "BUILD_ID"), "utf8").trim();
  if (!buildId) throw new Error(".next/BUILD_ID is missing; run a production build first");

  const manifestPath = path.resolve(
    ".next",
    "server",
    "app",
    "[locale]",
    "shop",
    "catalog",
    "page_client-reference-manifest.js",
  );
  const manifest = parseManifest(await readFile(manifestPath, "utf8"));
  const initialJs = unique(manifest.entryJSFiles?.[CATALOG_ENTRY] ?? []);
  const shopLayoutJs = new Set(manifest.entryJSFiles?.[SHOP_LAYOUT_ENTRY] ?? []);
  const incrementalJs = initialJs.filter((file) => !shopLayoutJs.has(file));
  const css = unique((manifest.entryCSSFiles?.[CATALOG_ENTRY] ?? []).map((entry) => entry.path));
  if (!initialJs.length || !incrementalJs.length) throw new Error("Catalog JS entries are missing");

  const clientModuleNames = Object.keys(manifest.clientModules ?? {});
  const legacyStockModulePresent = clientModuleNames.some((name) =>
    name.replaceAll("\\", "/").includes("/src/app/[locale]/shop/stock/"),
  );
  const [initial, incremental, styles] = await Promise.all([
    measure(initialJs),
    measure(incrementalJs),
    measure(css),
  ]);
  const checks = {
    initialJsWithin150KiBGzip: initial.gzipBytes <= INITIAL_JS_GZIP_LIMIT,
    legacyStockModuleIsolated: !legacyStockModulePresent,
  };
  const artifact = {
    version: 1,
    status: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
    commitSha,
    buildId,
    generatedAt: new Date().toISOString(),
    route: ROUTE,
    limits: { initialJsGzipBytes: INITIAL_JS_GZIP_LIMIT },
    measurements: { initialJs: initial, incrementalCatalogJs: incremental, css: styles },
    legacyStockModulePresent,
    checks,
  };

  const outputDirectory = path.resolve("artifacts", "catalog-v2-storefront");
  const outputPath = path.join(outputDirectory, "catalog-v2-storefront-build-gate.json");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputPath, ...artifact }, null, 2));
  if (artifact.status !== "PASS") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
