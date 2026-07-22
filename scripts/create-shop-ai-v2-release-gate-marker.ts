import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  createShopAiV2ReleaseGateMarker,
  normalizeShopAiCatalogFingerprint,
  normalizeShopAiCommitSha,
  SHOP_AI_V2_RELEASE_GATE_MAX_AGE_MS,
  SHOP_AI_V2_RELEASE_GATE_SCHEMA_VERSION,
  type ShopAiV2ReleaseGateMarkerPayload,
  validateShopAiV2ReleaseEvalReport,
} from "../src/lib/shopAiV2ReleaseActivationGuard";

type CliOptions = {
  fixturePath: string;
  reportPath: string;
  releaseConfigPath: string;
  outputPath: string;
};

const DEFAULT_FIXTURE_PATH = path.join(
  process.cwd(),
  "tests",
  "shop",
  "evals",
  "stock-ai-cases.json"
);
const DEFAULT_RELEASE_CONFIG_PATH = path.join(
  process.cwd(),
  "tests",
  "shop",
  "evals",
  "stock-ai-release-gate.json"
);

function resolveArgumentPath(value: string) {
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

function parseOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    fixturePath: DEFAULT_FIXTURE_PATH,
    reportPath: process.env.SHOP_AI_EVAL_REPORT_PATH?.trim()
      ? resolveArgumentPath(process.env.SHOP_AI_EVAL_REPORT_PATH)
      : "",
    releaseConfigPath: DEFAULT_RELEASE_CONFIG_PATH,
    outputPath: "",
  };
  for (const argument of argv) {
    if (argument.startsWith("--fixture=")) {
      options.fixturePath = resolveArgumentPath(argument.slice("--fixture=".length));
    } else if (argument.startsWith("--report=")) {
      options.reportPath = resolveArgumentPath(argument.slice("--report=".length));
    } else if (argument.startsWith("--release-config=")) {
      options.releaseConfigPath = resolveArgumentPath(argument.slice("--release-config=".length));
    } else if (argument.startsWith("--output=")) {
      options.outputPath = resolveArgumentPath(argument.slice("--output=".length));
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (!options.reportPath) throw new Error("--report=<path> is required");
  if (!options.outputPath) throw new Error("--output=<path> is required");
  return options;
}

function requireEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function requireSecretEnvironmentValue(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function repositoryRelativePath(filePath: string) {
  const relativePath = path.relative(process.cwd(), filePath);
  if (
    !relativePath ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Release evidence file must stay inside the repository: ${filePath}`);
  }
  return relativePath.replaceAll(path.sep, "/");
}

async function hashReleaseCorpus(fixturePath: string, releaseConfigPath: string) {
  const hasher = createHash("sha256");
  const files = [fixturePath, releaseConfigPath];
  for (const filePath of files) {
    const relativePath = repositoryRelativePath(filePath);
    hasher.update(relativePath, "utf8");
    hasher.update("\0", "utf8");
    hasher.update(await fs.readFile(filePath));
    hasher.update("\0", "utf8");
  }
  return hasher.digest("hex");
}

async function readAndValidateEvalReport(reportPath: string, expectedCommitSha: string) {
  const reportBytes = await fs.readFile(reportPath);
  let report: unknown;
  try {
    report = JSON.parse(reportBytes.toString("utf8")) as unknown;
  } catch {
    throw new Error("One AI V2 eval report is not valid JSON");
  }
  const validation = validateShopAiV2ReleaseEvalReport(report, expectedCommitSha);
  if (!validation.ok) {
    throw new Error(
      `One AI V2 eval report cannot issue a release marker:\n${validation.errors
        .map((error) => `  - ${error}`)
        .join("\n")}`
    );
  }
  const catalogFingerprint = normalizeShopAiCatalogFingerprint(
    report &&
      typeof report === "object" &&
      !Array.isArray(report) &&
      typeof (report as Record<string, unknown>).catalogFingerprint === "string"
      ? ((report as Record<string, unknown>).catalogFingerprint as string)
      : null
  );
  if (!catalogFingerprint) {
    throw new Error("One AI V2 eval report has no valid catalog fingerprint");
  }
  const generatedAt =
    report &&
    typeof report === "object" &&
    !Array.isArray(report) &&
    typeof (report as Record<string, unknown>).generatedAt === "string"
      ? ((report as Record<string, unknown>).generatedAt as string)
      : "";
  const evaluatedAtMs = Date.parse(generatedAt);
  if (!Number.isFinite(evaluatedAtMs) || new Date(evaluatedAtMs).toISOString() !== generatedAt) {
    throw new Error("One AI V2 eval report has no valid generatedAt timestamp");
  }
  return {
    reportSha256: createHash("sha256").update(reportBytes).digest("hex"),
    catalogFingerprint,
    generatedAt,
  };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const expectedCommitSha = normalizeShopAiCommitSha(
    requireEnvironmentValue("SHOP_AI_EVAL_EXPECTED_COMMIT")
  );
  const checkedOutCommitSha = normalizeShopAiCommitSha(
    requireEnvironmentValue("SHOP_AI_EVAL_CHECKED_OUT_COMMIT")
  );
  if (!expectedCommitSha || !checkedOutCommitSha) {
    throw new Error("Release marker requires full 40-character commit SHAs");
  }
  if (expectedCommitSha !== checkedOutCommitSha) {
    throw new Error(
      `Checked-out commit ${checkedOutCommitSha} does not match evaluated commit ${expectedCommitSha}`
    );
  }

  const corpusSha256 = await hashReleaseCorpus(options.fixturePath, options.releaseConfigPath);
  const { reportSha256, catalogFingerprint, generatedAt } = await readAndValidateEvalReport(
    options.reportPath,
    expectedCommitSha
  );
  const evaluatedAt = new Date(generatedAt);
  if (Date.now() >= evaluatedAt.getTime() + SHOP_AI_V2_RELEASE_GATE_MAX_AGE_MS) {
    throw new Error("One AI V2 eval report is too old to issue a release marker");
  }
  const payloadInput = {
    commitSha: expectedCommitSha,
    corpusSha256,
    evalReportSha256: reportSha256,
    catalogFingerprint,
    evaluatedAt: evaluatedAt.toISOString(),
    expiresAt: new Date(evaluatedAt.getTime() + SHOP_AI_V2_RELEASE_GATE_MAX_AGE_MS).toISOString(),
    repository: requireEnvironmentValue("GITHUB_REPOSITORY"),
    workflowRunId: requireEnvironmentValue("GITHUB_RUN_ID"),
    workflowRunAttempt: Number(requireEnvironmentValue("GITHUB_RUN_ATTEMPT")),
  };
  const signingSecret = requireSecretEnvironmentValue("SHOP_AI_V2_RELEASE_GATE_SIGNING_SECRET");
  const marker = createShopAiV2ReleaseGateMarker(payloadInput, signingSecret);
  const payload: ShopAiV2ReleaseGateMarkerPayload = {
    schemaVersion: SHOP_AI_V2_RELEASE_GATE_SCHEMA_VERSION,
    gate: "one-ai-v2-live-release-eval",
    status: "passed",
    ...payloadInput,
  };
  const artifact = {
    marker,
    payload,
    evidence: {
      fixture: repositoryRelativePath(options.fixturePath),
      releaseConfig: repositoryRelativePath(options.releaseConfigPath),
      evalReport: path.basename(options.reportPath),
    },
  };

  await fs.mkdir(path.dirname(options.outputPath), { recursive: true });
  await fs.writeFile(options.outputPath, `${JSON.stringify(artifact, null, 2)}\n`, {
    encoding: "utf8",
  });
  console.log(`Created commit-bound One AI V2 release-gate artifact for ${expectedCommitSha}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
