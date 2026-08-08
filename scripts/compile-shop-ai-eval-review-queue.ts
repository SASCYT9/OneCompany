import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { validateShopAiReleaseGateConfig } from "./shop-ai-eval-harness";
import {
  compileApprovedShopAiEvalReviewQueue,
  type ShopAiEvalReviewQueue,
} from "./shop-ai-eval-review-queue";

function valueArgument(name: string) {
  return process.argv.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1);
}

async function readJson(filePath: string) {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

async function main() {
  const queuePath = path.resolve(
    valueArgument("--queue") ?? "artifacts/one-ai/stock-ai-eval-review-queue.json"
  );
  const configPath = path.resolve(
    valueArgument("--release-config") ?? "tests/shop/evals/stock-ai-release-gate.json"
  );
  const outputPath = path.resolve(
    valueArgument("--output") ?? "tests/shop/evals/stock-ai-cases.json"
  );
  const commit = process.argv.includes("--commit");
  const config = validateShopAiReleaseGateConfig(await readJson(configPath));
  if (!config.ok) throw new Error(config.errors.join("\n"));
  const result = compileApprovedShopAiEvalReviewQueue(
    (await readJson(queuePath)) as ShopAiEvalReviewQueue,
    config.value
  );
  console.log(
    JSON.stringify(
      {
        mode: commit ? "commit" : "dry-run",
        queuePath,
        outputPath,
        approvedCases: result.cases.length,
        gatePassed: result.gate?.passed ?? false,
        errors: result.errors,
      },
      null,
      2
    )
  );
  if (!result.ok) {
    process.exitCode = 1;
    return;
  }
  if (!commit) return;
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result.cases, null, 2)}\n`, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
