import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { chromium } from "playwright";

const LCP_P75_LIMIT_MS = 1_800;
const LCP_P95_LIMIT_MS = 2_500;
const FILTER_P95_LIMIT_MS = 1_000;

function argument(name: string, fallback?: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function integer(name: string, fallback: number) {
  const value = Number(argument(name, String(fallback)));
  if (!Number.isInteger(value) || value < 1 || value > 50) throw new Error(`--${name} must be within 1..50`);
  return value;
}

function git(...args: string[]) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function cleanCommit() {
  if (git("status", "--porcelain")) throw new Error("Browser evidence requires a clean committed worktree");
  const sha = git("rev-parse", "HEAD").toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error("Git HEAD is not a full commit SHA");
  return sha;
}

function targetUrl() {
  const url = new URL(argument("url", "http://127.0.0.1:3000/ua/shop/catalog"));
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && process.env.CATALOG_STOREFRONT_BROWSER_ALLOW_REMOTE !== "1") {
    throw new Error("Remote browser targets require CATALOG_STOREFRONT_BROWSER_ALLOW_REMOTE=1");
  }
  return url;
}

function percentile(values: number[], value: number) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil((value / 100) * sorted.length) - 1)]!;
}

async function main() {
  const commitSha = cleanCommit();
  const url = targetUrl();
  const sampleCount = integer("samples", 10);
  const browser = await chromium.launch({ headless: true });
  const lcp: number[] = [];
  const filterLatency: number[] = [];
  const consoleErrors: string[] = [];
  const failedResponses: Array<{ url: string; status: number }> = [];
  try {
    for (let index = 0; index < sampleCount; index += 1) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const page = await context.newPage();
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("response", (response) => {
        if (response.status() >= 400) failedResponses.push({ url: response.url(), status: response.status() });
      });
      await page.addInitScript(() => {
        (window as Window & { __catalogLcp?: number }).__catalogLcp = 0;
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries.at(-1);
          if (last) (window as Window & { __catalogLcp?: number }).__catalogLcp = last.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
      });
      await page.goto(url.toString(), { waitUntil: "networkidle", timeout: 30_000 });
      await page.locator('[data-catalog-v2="true"]').waitFor();
      await page.locator("[data-catalog-product-id]").first().waitFor();
      await page.waitForTimeout(1_000);
      const overlay = await page.locator("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay").count();
      if (overlay) throw new Error("Framework error overlay is visible");
      const measuredLcp = await page.evaluate(() => (window as Window & { __catalogLcp?: number }).__catalogLcp ?? 0);
      if (measuredLcp <= 0) throw new Error("Browser did not report an LCP entry");
      lcp.push(measuredLcp);

      const brand = page.locator('select[name="brand"]');
      const option = await brand.locator('option:not([value=""])').first().getAttribute("value");
      if (!option) throw new Error("Catalog has no selectable brand facet");
      const started = performance.now();
      await brand.selectOption(option);
      await page.waitForURL((next) => next.searchParams.get("brand") === option, { timeout: 10_000 });
      await page.locator('[data-catalog-v2="true"][aria-busy="false"], [data-catalog-v2="true"]').waitFor();
      filterLatency.push(performance.now() - started);
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const lcpP75 = percentile(lcp, 75);
  const lcpP95 = percentile(lcp, 95);
  const filterP95 = percentile(filterLatency, 95);
  const localAnalyticsFailures = failedResponses.filter((entry) => {
    const failedUrl = new URL(entry.url);
    return failedUrl.origin === url.origin && failedUrl.pathname === "/_vercel/insights/script.js" && entry.status === 404;
  });
  const genericResourceErrorsToIgnore = localAnalyticsFailures.length;
  let ignoredGenericResourceErrors = 0;
  const criticalConsoleErrors = consoleErrors.filter((message) => {
    if (message.includes(`${url.origin}/_vercel/insights/script.js`)) return false;
    if (
      message === "Failed to load resource: the server responded with a status of 404 (Not Found)" &&
      ignoredGenericResourceErrors < genericResourceErrorsToIgnore
    ) {
      ignoredGenericResourceErrors += 1;
      return false;
    }
    return true;
  });
  const unexpectedFailedResponses = failedResponses.filter(
    (entry) => !localAnalyticsFailures.includes(entry),
  );
  const checks = {
    lcpP75Within1800Ms: lcpP75 < LCP_P75_LIMIT_MS,
    lcpP95Within2500Ms: lcpP95 < LCP_P95_LIMIT_MS,
    filterP95Within1000Ms: filterP95 < FILTER_P95_LIMIT_MS,
    noApplicationConsoleErrors: criticalConsoleErrors.length === 0,
    noUnexpectedFailedResponses: unexpectedFailedResponses.length === 0,
  };
  const artifact = {
    version: 1,
    status: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
    commitSha,
    generatedAt: new Date().toISOString(),
    target: url.toString(),
    viewport: { width: 1440, height: 1000 },
    samples: sampleCount,
    measurements: {
      lcpMs: { p75: Number(lcpP75.toFixed(3)), p95: Number(lcpP95.toFixed(3)), max: Number(Math.max(...lcp).toFixed(3)) },
      filterNavigationMs: { p95: Number(filterP95.toFixed(3)), max: Number(Math.max(...filterLatency).toFixed(3)) },
    },
    limits: { lcpP75Ms: LCP_P75_LIMIT_MS, lcpP95Ms: LCP_P95_LIMIT_MS, filterP95Ms: FILTER_P95_LIMIT_MS },
    diagnostics: {
      criticalConsoleErrors,
      unexpectedFailedResponses,
      ignoredLocalAnalyticsFailures: localAnalyticsFailures.length,
    },
    checks,
  };
  const directory = path.resolve("artifacts", "catalog-v2-storefront");
  const outputPath = path.join(directory, "catalog-v2-storefront-browser-gate.json");
  await mkdir(directory, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputPath, ...artifact }, null, 2));
  if (artifact.status !== "PASS") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
