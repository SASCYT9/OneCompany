import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, unlinkSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Run the reviewable local storefront acceptance matrix.
 *
 * This intentionally orchestrates the existing commit-bound gates instead of
 * duplicating their thresholds. It covers both supported locales, a desktop
 * and a mobile viewport, the no-JS HTML response, and the public JSON
 * contracts used by the vehicle selector and suggestions UI.
 */

type GateArtifact = {
  status?: string;
  commitSha?: string;
  [key: string]: unknown;
};

type GateResult = {
  name: string;
  status: "PASS" | "FAIL";
  exitCode: number;
  artifact?: GateArtifact;
  error?: string;
};

const DEFAULT_ORIGIN = "http://127.0.0.1:3000";
const DEFAULT_BROWSER_SAMPLES = 30;
const DEFAULT_RUNTIME_SAMPLES = 30;
const DEFAULT_RUNTIME_WARMUPS = 5;

const matrix = [
  { locale: "ua", width: 390, height: 844 },
  { locale: "ua", width: 1440, height: 1000 },
  { locale: "en", width: 390, height: 844 },
  { locale: "en", width: 1440, height: 1000 },
] as const;

const vehicleQuery = "make=BMW&model=M5&chassis=G90";

function argument(name: string, fallback?: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function positiveInteger(name: string, fallback: number, maximum: number) {
  const value = Number(argument(name, String(fallback)));
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`--${name} must be an integer within 1..${maximum}`);
  }
  return value;
}

function git(...args: string[]) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function requireCleanCommit() {
  if (git("status", "--porcelain")) {
    throw new Error("Storefront acceptance requires a clean committed worktree");
  }
  const commitSha = git("rev-parse", "HEAD").toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(commitSha)) throw new Error("Git HEAD is not a full commit SHA");
  return commitSha;
}

function originUrl() {
  const url = new URL(argument("origin", DEFAULT_ORIGIN));
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("--origin must be an origin such as http://127.0.0.1:3000");
  }
  if (!/^https?:$/.test(url.protocol)) throw new Error("Acceptance origin must use HTTP(S)");
  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (
    !localHosts.has(url.hostname) &&
    process.env.CATALOG_STOREFRONT_ACCEPTANCE_ALLOW_REMOTE !== "1"
  ) {
    throw new Error(
      "Remote acceptance origins require CATALOG_STOREFRONT_ACCEPTANCE_ALLOW_REMOTE=1"
    );
  }
  return url;
}

function requireSsrReaderMode() {
  const mode = process.env.SHOP_CATALOG_V2_READER_MODE?.trim().toLowerCase();
  if (mode !== "ssr") {
    throw new Error(
      "Storefront V2 acceptance requires SHOP_CATALOG_V2_READER_MODE=ssr; reader-off is legacy evidence"
    );
  }
  return mode;
}

function routeUrl(origin: URL, locale: "ua" | "en") {
  return new URL(`/${locale}/shop/catalog?${vehicleQuery}`, origin).toString();
}

function runGate(
  name: string,
  script: string,
  args: string[],
  artifactFile: string,
  commitSha: string
): GateResult {
  const env = { ...process.env };
  const artifactPath = path.resolve("artifacts", "catalog-v2-storefront", artifactFile);
  try {
    unlinkSync(artifactPath);
  } catch {
    // The artifact may not exist before the first run.
  }
  if (process.env.CATALOG_STOREFRONT_ACCEPTANCE_ALLOW_REMOTE === "1") {
    env.CATALOG_STOREFRONT_BROWSER_ALLOW_REMOTE = "1";
    env.CATALOG_STOREFRONT_RUNTIME_ALLOW_REMOTE = "1";
  }
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", path.resolve("scripts", script), ...args],
    { encoding: "utf8", env, windowsHide: true }
  );
  const exitCode = result.status ?? 1;
  let artifact: GateArtifact | undefined;
  try {
    artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as GateArtifact;
  } catch {
    // The child output below is enough to diagnose a process-level failure.
  }
  const childError = result.error?.message ?? result.stderr?.trim();
  return {
    name,
    status:
      exitCode === 0 && artifact?.status === "PASS" && artifact.commitSha === commitSha
        ? "PASS"
        : "FAIL",
    exitCode,
    artifact,
    error: childError ? childError.slice(-2000) : undefined,
  };
}

async function requestJson(url: URL) {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "OneCompany-Catalog-V2-Acceptance/1" },
    redirect: "error",
  });
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(`${url.pathname} returned ${contentType || "no content type"}`);
  }
  let value: unknown;
  try {
    value = JSON.parse(body) as unknown;
  } catch {
    throw new Error(`${url.pathname} returned invalid JSON`);
  }
  return { status: response.status, retryAfter: response.headers.get("retry-after"), value };
}

async function checkHttpContracts(origin: URL, readerMode: string): Promise<GateResult[]> {
  const results: GateResult[] = [];
  for (const locale of ["ua", "en"] as const) {
    const fitment = new URL(`/api/shop/stock/fitment?${vehicleQuery}`, origin);
    const suggestions = new URL(
      `/api/shop/stock/suggest?q=${encodeURIComponent("BMW M5 G90")}&locale=${locale}`,
      origin
    );
    for (const [name, url, validate] of [
      [
        `http-fitment-${locale}`,
        fitment,
        (value: unknown) => value !== null && typeof value === "object" && !Array.isArray(value),
      ],
      [
        `http-suggestions-${locale}`,
        suggestions,
        (value: unknown) =>
          value !== null &&
          typeof value === "object" &&
          Array.isArray((value as { data?: unknown }).data),
      ],
    ] as const) {
      try {
        const result = await requestJson(url);
        if (name.startsWith("http-fitment-") && result.status === 503) {
          const blocked = result.value as { code?: unknown; error?: unknown; data?: unknown };
          if (
            argument("allow-unavailable-selectors", "0") === "1" &&
            readerMode === "ssr" &&
            blocked.code === "SELECTOR_NOT_READY" &&
            result.retryAfter === "15" &&
            Array.isArray(blocked.data)
          ) {
            results.push({
              name,
              status: "PASS",
              exitCode: 0,
              artifact: { status: "EXPECTED_BLOCKED", code: blocked.code },
            });
            continue;
          }
        }
        if (result.status !== 200)
          throw new Error(`${url.pathname} returned HTTP ${result.status}`);
        if (!validate(result.value)) {
          throw new Error(`${url.pathname} returned an unexpected JSON shape`);
        }
        results.push({ name, status: "PASS", exitCode: 0 });
      } catch (error) {
        results.push({
          name,
          status: "FAIL",
          exitCode: 1,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  return results;
}

async function main() {
  const commitSha = requireCleanCommit();
  const origin = originUrl();
  const readerMode = requireSsrReaderMode();
  const browserSamples = positiveInteger("browser-samples", DEFAULT_BROWSER_SAMPLES, 50);
  const runtimeSamples = positiveInteger("runtime-samples", DEFAULT_RUNTIME_SAMPLES, 200);
  const runtimeWarmups = positiveInteger("runtime-warmups", DEFAULT_RUNTIME_WARMUPS, 200);
  const results: GateResult[] = [];

  results.push(
    runGate(
      "catalog-v2-storefront-build-gate",
      "measure-catalog-v2-storefront-build.ts",
      [],
      "catalog-v2-storefront-build-gate.json",
      commitSha
    )
  );
  for (const locale of ["ua", "en"] as const) {
    results.push(
      runGate(
        `catalog-v2-storefront-runtime-gate-${locale}`,
        "benchmark-catalog-v2-storefront-runtime.ts",
        [
          `--url=${routeUrl(origin, locale)}`,
          `--samples=${runtimeSamples}`,
          `--warmups=${runtimeWarmups}`,
        ],
        "catalog-v2-storefront-runtime-gate.json",
        commitSha
      )
    );
    const runtimePath = path.resolve(
      "artifacts",
      "catalog-v2-storefront",
      "catalog-v2-storefront-runtime-gate.json"
    );
    try {
      await writeFile(
        path.resolve("artifacts", "catalog-v2-storefront", `acceptance-runtime-${locale}.json`),
        await readFile(runtimePath)
      );
    } catch {
      // The failing gate result carries the useful process error.
    }
  }
  for (const entry of matrix) {
    results.push(
      runGate(
        `catalog-v2-storefront-browser-gate-${entry.locale}-${entry.width}`,
        "benchmark-catalog-v2-storefront-browser.ts",
        [
          `--url=${routeUrl(origin, entry.locale)}`,
          `--width=${entry.width}`,
          `--height=${entry.height}`,
          `--samples=${browserSamples}`,
        ],
        "catalog-v2-storefront-browser-gate.json",
        commitSha
      )
    );
    const browserPath = path.resolve(
      "artifacts",
      "catalog-v2-storefront",
      "catalog-v2-storefront-browser-gate.json"
    );
    try {
      await writeFile(
        path.resolve(
          "artifacts",
          "catalog-v2-storefront",
          `acceptance-browser-${entry.locale}-${entry.width}.json`
        ),
        await readFile(browserPath)
      );
    } catch {
      // The failing gate result carries the useful process error.
    }
  }
  results.push(...(await checkHttpContracts(origin, readerMode)));

  const status = results.every((result) => result.status === "PASS") ? "PASS" : "FAIL";
  const artifact = {
    version: 1,
    status,
    commitSha,
    generatedAt: new Date().toISOString(),
    target: origin.toString(),
    readerMode,
    selectorAvailabilityRequired: argument("allow-unavailable-selectors", "0") !== "1",
    matrix,
    samples: { browser: browserSamples, runtime: runtimeSamples, runtimeWarmups },
    results,
  };
  const directory = path.resolve("artifacts", "catalog-v2-storefront");
  const outputPath = path.join(directory, "catalog-v2-storefront-acceptance.json");
  await mkdir(directory, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputPath, ...artifact }, null, 2));
  if (status !== "PASS") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
