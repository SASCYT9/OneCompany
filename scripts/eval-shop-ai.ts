import fs from "node:fs/promises";
import path from "node:path";

import type { ShopAiAssistantResponse } from "../src/lib/shopAiAssistantTypes";
import {
  SHOP_AI_CATALOG_FINGERPRINT_HEADER,
  SHOP_AI_COMMIT_HEADER,
  SHOP_AI_EVAL_ACTIVE_CPU_HEADER,
  SHOP_AI_EVAL_AUTHENTICATED_HEADER,
  SHOP_AI_EVAL_EMBEDDING_CALLS_HEADER,
  SHOP_AI_EVAL_GENERATION_CALLS_HEADER,
  SHOP_AI_EVAL_REQUEST_PIPELINE_HEADER,
  SHOP_AI_EVAL_RETRIEVAL_LATENCY_HEADER,
  SHOP_AI_EVAL_TOKEN_HEADER,
  SHOP_AI_PIPELINE_HEADER,
  SHOP_AI_RETRIEVAL_HEADER,
} from "../src/lib/shopAiEvalBoundary";
import {
  evaluateShopAiReleaseGate,
  evaluateShopAiResponse,
  type ShopAiEvalCase,
  validateShopAiEvalCases,
  validateShopAiReleaseGateConfig,
} from "./shop-ai-eval-harness";

const baseUrl = process.env.SHOP_AI_EVAL_BASE_URL || "http://localhost:3000";
const evalToken = process.env.SHOP_AI_EVAL_TOKEN?.trim() ?? "";
const expectedCommit = process.env.SHOP_AI_EVAL_EXPECTED_COMMIT?.trim() ?? "";
const reportPath = process.env.SHOP_AI_EVAL_REPORT_PATH?.trim() ?? "";
const MAX_RESPONSE_BYTES = 100 * 1024;
const MAX_FULL_TURN_MS = 6_000;
const MAX_P95_FULL_TURN_MS = 3_000;
const defaultFixturePath = path.join(
  process.cwd(),
  "tests",
  "shop",
  "evals",
  "stock-ai-cases.json"
);
const defaultReleaseGateConfigPath = path.join(
  process.cwd(),
  "tests",
  "shop",
  "evals",
  "stock-ai-release-gate.json"
);

type CliOptions = {
  fixturePath: string;
  releaseGate: boolean;
  releaseGateConfigPath: string;
  help: boolean;
};

function resolveArgumentPath(value: string) {
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    fixturePath: defaultFixturePath,
    releaseGate: false,
    releaseGateConfigPath: defaultReleaseGateConfigPath,
    help: false,
  };
  for (const argument of argv) {
    if (argument === "--release-gate") {
      options.releaseGate = true;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else if (argument.startsWith("--fixture=")) {
      options.fixturePath = resolveArgumentPath(argument.slice("--fixture=".length));
    } else if (argument.startsWith("--release-config=")) {
      options.releaseGateConfigPath = resolveArgumentPath(
        argument.slice("--release-config=".length)
      );
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

async function readJson(filePath: string) {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
}

async function loadCases(filePath: string) {
  const validated = validateShopAiEvalCases(await readJson(filePath));
  if (!validated.ok) {
    throw new Error(
      `Invalid Shop AI eval fixture ${filePath}:\n${validated.errors.map((error) => `  - ${error}`).join("\n")}`
    );
  }
  return validated.value;
}

function readNumericHeader(headers: Headers, name: string) {
  const raw = headers.get(name);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function assertSafeEvalTarget(value: string) {
  const target = new URL(value);
  const isLocal =
    target.hostname === "localhost" || target.hostname === "127.0.0.1" || target.hostname === "::1";
  if (target.username || target.password) {
    throw new Error("SHOP_AI_EVAL_BASE_URL must not contain URL credentials");
  }
  if (target.protocol !== "https:" && !(isLocal && target.protocol === "http:")) {
    throw new Error("SHOP_AI_EVAL_BASE_URL must use HTTPS, except for localhost development");
  }
}

async function runCase(testCase: ShopAiEvalCase) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/api/shop/stock/assistant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: new URL(baseUrl).origin,
      [SHOP_AI_EVAL_TOKEN_HEADER]: evalToken,
      [SHOP_AI_EVAL_REQUEST_PIPELINE_HEADER]: "v2",
    },
    body: JSON.stringify({
      message: testCase.message,
      history: [{ role: "user", text: testCase.message }],
      context: { locale: testCase.locale, currency: "EUR" },
    }),
    signal: AbortSignal.timeout(35_000),
    redirect: "error",
  });
  const latencyMs = Math.round(performance.now() - startedAt);
  const pipeline = response.headers.get(SHOP_AI_PIPELINE_HEADER);
  const retrieval = response.headers.get(SHOP_AI_RETRIEVAL_HEADER);
  const responseCommit = response.headers.get(SHOP_AI_COMMIT_HEADER);
  const catalogFingerprint = response.headers.get(SHOP_AI_CATALOG_FINGERPRINT_HEADER);
  const evalAuthenticated = response.headers.get(SHOP_AI_EVAL_AUTHENTICATED_HEADER);
  const activeCpuMs = readNumericHeader(response.headers, SHOP_AI_EVAL_ACTIVE_CPU_HEADER);
  const retrievalLatencyMs = readNumericHeader(
    response.headers,
    SHOP_AI_EVAL_RETRIEVAL_LATENCY_HEADER
  );
  const generationCalls = readNumericHeader(response.headers, SHOP_AI_EVAL_GENERATION_CALLS_HEADER);
  const embeddingCalls = readNumericHeader(response.headers, SHOP_AI_EVAL_EMBEDDING_CALLS_HEADER);
  const responseBody = await response.text();
  const responseBytes = new TextEncoder().encode(responseBody).byteLength;
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} (${pipeline ?? "unmarked"}/${retrieval ?? "unmarked"}): ${responseBody}`
    );
  }
  const result = JSON.parse(responseBody) as ShopAiAssistantResponse;
  const errors = evaluateShopAiResponse(testCase, result);
  if (evalAuthenticated !== "1") {
    errors.unshift("server did not authenticate the protected evaluation request");
  }
  if (pipeline !== "v2") {
    errors.unshift(`expected V2 pipeline marker, received ${pipeline ?? "no marker"}`);
  }
  if (retrieval !== "strict" && retrieval !== "not-run") {
    errors.unshift(`expected strict V2 retrieval, received ${retrieval ?? "no retrieval marker"}`);
  }
  if (expectedCommit && responseCommit !== expectedCommit) {
    errors.unshift(
      `expected deployment commit ${expectedCommit}, received ${responseCommit ?? "no commit marker"}`
    );
  }
  if (expectedCommit && !/^[0-9a-f]{64}$/i.test(catalogFingerprint ?? "")) {
    errors.unshift("server did not provide a valid Knowledge V2 catalog fingerprint");
  }
  if (result.degraded) {
    errors.unshift("V2 evaluation response was degraded");
  }
  if (responseBytes > MAX_RESPONSE_BYTES) {
    errors.unshift(`response was ${responseBytes} bytes; maximum is ${MAX_RESPONSE_BYTES} bytes`);
  }
  if (latencyMs > MAX_FULL_TURN_MS) {
    errors.unshift(`full turn took ${latencyMs}ms; maximum is ${MAX_FULL_TURN_MS}ms`);
  }
  return {
    id: testCase.id,
    passed: errors.length === 0,
    errors,
    productCount: result.products.length,
    language: testCase.metadata?.language ?? testCase.locale,
    hardNegative: Boolean(testCase.metadata?.hardNegative),
    pipeline,
    retrieval,
    responseCommit,
    catalogFingerprint,
    latencyMs,
    responseBytes,
    activeCpuMs,
    retrievalLatencyMs,
    generationCalls,
    embeddingCalls,
  };
}

function percentile95(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  if (options.help) {
    console.log(`Usage: npm run shop:ai:eval -- [options]

Options:
  --fixture=<path>         Eval fixture (default: tests/shop/evals/stock-ai-cases.json)
  --release-gate           Require 500+ reviewed cases and 30+ per enabled category
  --release-config=<path>  Enabled-category manifest for the release gate
Environment:
  SHOP_AI_EVAL_BASE_URL        Target preview/staging URL
  SHOP_AI_EVAL_TOKEN           Server-only eval token (minimum 32 characters)
  SHOP_AI_EVAL_EXPECTED_COMMIT Required deployment commit marker for release runs
  SHOP_AI_EVAL_REPORT_PATH     Optional JSON report output path
  --help                   Show this message`);
    return;
  }

  const cases = await loadCases(options.fixturePath);
  let releaseGateReport: ReturnType<typeof evaluateShopAiReleaseGate> | null = null;
  if (options.releaseGate) {
    const config = validateShopAiReleaseGateConfig(await readJson(options.releaseGateConfigPath));
    if (!config.ok) {
      throw new Error(
        `Invalid Shop AI release config ${options.releaseGateConfigPath}:\n${config.errors.map((error) => `  - ${error}`).join("\n")}`
      );
    }
    const gate = evaluateShopAiReleaseGate(cases, config.value);
    releaseGateReport = gate;
    console.log(
      `Release corpus: ${gate.totalCases} cases, ${gate.hardNegativeCases} hard negatives`
    );
    console.log(
      `Languages: ${Object.entries(gate.countsByLanguage)
        .map(([language, count]) => `${language}=${count}`)
        .join(", ")}`
    );
    for (const category of gate.enabledCategories) {
      console.log(`  ${category}: ${gate.countsByCategory[category] ?? 0}`);
    }
    if (!gate.passed) {
      console.error("\nRELEASE GATE FAILED");
      for (const error of gate.errors) console.error(`  - ${error}`);
      process.exitCode = 1;
      return;
    }
    console.log("\nRELEASE GATE PASSED\n");
  }

  if (evalToken.length < 32) {
    throw new Error("SHOP_AI_EVAL_TOKEN must be a server-only token of at least 32 characters");
  }
  if (options.releaseGate && !expectedCommit) {
    throw new Error("SHOP_AI_EVAL_EXPECTED_COMMIT is required for a live release evaluation");
  }
  if (expectedCommit && !/^[0-9a-f]{40}$/i.test(expectedCommit)) {
    throw new Error("SHOP_AI_EVAL_EXPECTED_COMMIT must be a full 40-character Git SHA");
  }
  assertSafeEvalTarget(baseUrl);

  const results = [];
  for (const testCase of cases) results.push(await runCase(testCase));
  for (const result of results) {
    console.log(
      `${result.passed ? "PASS" : "FAIL"} ${result.id} [${result.language}${result.hardNegative ? ", hard-negative" : ""}] (${result.productCount} products, ${result.pipeline ?? "unmarked"}/${result.retrieval ?? "unmarked"})`
    );
    for (const error of result.errors) console.log(`  - ${error}`);
  }
  const p95FullTurnMs = percentile95(results.map((result) => result.latencyMs));
  const releasePerformanceErrors: string[] = [];
  if (options.releaseGate && p95FullTurnMs > MAX_P95_FULL_TURN_MS) {
    releasePerformanceErrors.push(
      `P95 full turn was ${p95FullTurnMs}ms; maximum is ${MAX_P95_FULL_TURN_MS}ms`
    );
  }
  const failed = results.filter((result) => !result.passed);
  const catalogFingerprints = new Set(
    results
      .map((result) => result.catalogFingerprint?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value))
  );
  const evaluatedCatalogFingerprint =
    catalogFingerprints.size === 1 ? [...catalogFingerprints][0] : null;
  if (options.releaseGate && catalogFingerprints.size !== 1) {
    releasePerformanceErrors.push(
      "Release evaluation responses did not use one stable Knowledge V2 catalog fingerprint"
    );
  }
  console.log(`\n${results.length - failed.length}/${results.length} evals passed`);
  console.log(`P95 full turn: ${p95FullTurnMs}ms`);
  for (const error of releasePerformanceErrors) console.error(`  - ${error}`);

  if (reportPath) {
    const resolvedReportPath = resolveArgumentPath(reportPath);
    await fs.mkdir(path.dirname(resolvedReportPath), { recursive: true });
    await fs.writeFile(
      resolvedReportPath,
      `${JSON.stringify(
        {
          schemaVersion: 2,
          generatedAt: new Date().toISOString(),
          expectedCommit: expectedCommit || null,
          catalogFingerprint: evaluatedCatalogFingerprint,
          releaseGate: releaseGateReport,
          limits: {
            maxResponseBytes: MAX_RESPONSE_BYTES,
            maxFullTurnMs: MAX_FULL_TURN_MS,
            maxP95FullTurnMs: MAX_P95_FULL_TURN_MS,
          },
          summary: {
            passed: failed.length === 0 && releasePerformanceErrors.length === 0,
            totalCases: results.length,
            failedCases: failed.length,
            p95FullTurnMs,
            performanceErrors: releasePerformanceErrors,
            telemetryMetrics:
              "reported per case; active CPU, retrieval and provider-call release thresholds require approved staging baselines",
          },
          results,
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    console.log(`Report: ${resolvedReportPath}`);
  }

  if (failed.length || releasePerformanceErrors.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
