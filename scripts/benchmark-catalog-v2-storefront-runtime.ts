import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { gzipSync } from "node:zlib";

const DEFAULT_SAMPLES = 20;
const DEFAULT_WARMUPS = 5;
const TTFB_P95_LIMIT_MS = 300;
const FIRST_RESPONSE_GZIP_LIMIT = 100 * 1024;

function argument(name: string, fallback?: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function positiveInteger(name: string, fallback: number) {
  const value = Number(argument(name, String(fallback)));
  if (!Number.isInteger(value) || value < 1 || value > 200) {
    throw new Error(`--${name} must be an integer within 1..200`);
  }
  return value;
}

function git(...args: string[]) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function requireCleanCommit() {
  if (git("status", "--porcelain")) {
    throw new Error("Runtime evidence must be measured from a clean committed worktree");
  }
  const sha = git("rev-parse", "HEAD").toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error("Git HEAD is not a full commit SHA");
  return sha;
}

function targetUrl() {
  const url = new URL(argument("url", "http://127.0.0.1:3000/ua/shop/catalog"));
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    process.env.CATALOG_STOREFRONT_RUNTIME_ALLOW_REMOTE !== "1"
  ) {
    throw new Error("Remote targets require CATALOG_STOREFRONT_RUNTIME_ALLOW_REMOTE=1");
  }
  if (!/^https?:$/.test(url.protocol)) throw new Error("Runtime target must use HTTP(S)");
  return url;
}

function percentile(values: number[], percentileValue: number) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1)]!;
}

async function request(url: URL) {
  const started = performance.now();
  const response = await fetch(url, {
    headers: { accept: "text/html", "user-agent": "OneCompany-Catalog-V2-Runtime-Gate/1" },
    redirect: "error",
  });
  const ttfbMs = performance.now() - started;
  const body = Buffer.from(await response.arrayBuffer());
  if (response.status !== 200) throw new Error(`Catalog returned HTTP ${response.status}`);
  const html = body.toString("utf8");
  return {
    ttfbMs,
    body,
    html,
    cacheStatus: response.headers.get("x-nextjs-cache") ?? response.headers.get("x-vercel-cache"),
    cacheControl: response.headers.get("cache-control"),
  };
}

async function main() {
  const commitSha = requireCleanCommit();
  const url = targetUrl();
  const samples = positiveInteger("samples", DEFAULT_SAMPLES);
  const warmups = positiveInteger("warmups", DEFAULT_WARMUPS);
  for (let index = 0; index < warmups; index += 1) await request(url);

  const measurements = [];
  for (let index = 0; index < samples; index += 1) measurements.push(await request(url));
  const representative = measurements[0]!;
  const productCardCount = (representative.html.match(/data-catalog-product-id=/g) ?? []).length;
  const meaningfulSsr =
    representative.html.includes('data-catalog-v2="true"') && productCardCount > 0;
  const ttfbValues = measurements.map((entry) => entry.ttfbMs);
  const responseRawBytes = representative.body.byteLength;
  const responseGzipBytes = gzipSync(representative.body, { level: 9 }).byteLength;
  const cacheStatuses = [...new Set(measurements.map((entry) => entry.cacheStatus ?? "NONE"))];
  const checks = {
    meaningfulProductHtmlBeforeHydration: meaningfulSsr,
    ttfbP95Within300Ms: percentile(ttfbValues, 95) < TTFB_P95_LIMIT_MS,
    firstResponseWithin100KiBGzip: responseGzipBytes < FIRST_RESPONSE_GZIP_LIMIT,
  };
  const artifact = {
    version: 1,
    status: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
    commitSha,
    generatedAt: new Date().toISOString(),
    target: url.toString(),
    environment: "caller-declared; localhost enforced unless explicitly overridden",
    samples,
    warmups,
    productCardCount,
    cacheStatuses,
    cacheControl: representative.cacheControl,
    measurements: {
      ttfbMs: {
        p50: Number(percentile(ttfbValues, 50).toFixed(3)),
        p75: Number(percentile(ttfbValues, 75).toFixed(3)),
        p95: Number(percentile(ttfbValues, 95).toFixed(3)),
        max: Number(Math.max(...ttfbValues).toFixed(3)),
      },
      firstResponse: { rawBytes: responseRawBytes, gzipBytes: responseGzipBytes },
    },
    limits: { ttfbP95Ms: TTFB_P95_LIMIT_MS, firstResponseGzipBytes: FIRST_RESPONSE_GZIP_LIMIT },
    checks,
  };
  const directory = path.resolve("artifacts", "catalog-v2-storefront");
  const outputPath = path.join(directory, "catalog-v2-storefront-runtime-gate.json");
  await mkdir(directory, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputPath, ...artifact }, null, 2));
  if (artifact.status !== "PASS") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
