import fs from "node:fs/promises";
import path from "node:path";

import type { ShopAiAssistantResponse } from "../src/lib/shopAiAssistantTypes";

type EvalCase = {
  id: string;
  locale: "ua" | "en";
  message: string;
  expect: {
    make?: string;
    model?: string;
    chassis?: string;
    year?: number;
    category?: string;
    powerGainHp?: number;
    needsClarification?: boolean;
    opfGpf?: "with" | "without";
    productKind?: "system" | "downpipe" | "link_pipe" | "tips" | "any";
    forbidChassis?: string[];
  };
};

const baseUrl = process.env.SHOP_AI_EVAL_BASE_URL || "http://localhost:3000";

function assertEqual(errors: string[], label: string, actual: unknown, expected: unknown) {
  if (actual !== expected)
    errors.push(`${label}: expected ${String(expected)}, received ${String(actual)}`);
}

async function runCase(testCase: EvalCase) {
  const response = await fetch(`${baseUrl}/api/shop/stock/assistant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: testCase.message,
      history: [{ role: "user", text: testCase.message }],
      context: { locale: testCase.locale, currency: "EUR" },
    }),
    signal: AbortSignal.timeout(35_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  const result = (await response.json()) as ShopAiAssistantResponse;
  const errors: string[] = [];
  const expected = testCase.expect;
  if (expected.make !== undefined)
    assertEqual(errors, "make", result.plan.vehicle.make, expected.make);
  if (expected.model !== undefined)
    assertEqual(errors, "model", result.plan.vehicle.model, expected.model);
  if (expected.chassis !== undefined)
    assertEqual(errors, "chassis", result.plan.vehicle.chassis, expected.chassis);
  if (expected.year !== undefined)
    assertEqual(errors, "year", result.plan.vehicle.year, expected.year);
  if (expected.category !== undefined)
    assertEqual(errors, "category", result.plan.category, expected.category);
  if (expected.powerGainHp !== undefined) {
    assertEqual(errors, "powerGainHp", result.plan.powerGainHp, expected.powerGainHp);
  }
  if (expected.needsClarification !== undefined) {
    assertEqual(
      errors,
      "needsClarification",
      result.plan.needsClarification,
      expected.needsClarification
    );
  }
  if (expected.opfGpf !== undefined)
    assertEqual(errors, "opfGpf", result.plan.opfGpf, expected.opfGpf);
  if (expected.productKind !== undefined) {
    assertEqual(errors, "productKind", result.plan.productKind, expected.productKind);
    const mismatched = result.products.filter(
      (product) => product.facts?.productKind !== expected.productKind
    );
    if (mismatched.length) {
      errors.push(
        `product kind mismatch: ${mismatched.map((product) => product.partNumber).join(", ")}`
      );
    }
  }
  if (result.managerHref !== `/${testCase.locale}/contact?source=one-ai`) {
    errors.push("managerHref is missing or not localized");
  }
  if (!result.managerContext || result.managerContext.request !== testCase.message) {
    errors.push("managerContext is missing the private request handoff");
  }
  if (expected.opfGpf) {
    const mismatched = result.products.filter(
      (product) => product.facts?.opfGpf !== expected.opfGpf
    );
    if (mismatched.length) {
      errors.push(`OPF mismatch: ${mismatched.map((product) => product.partNumber).join(", ")}`);
    }
  }
  for (const forbidden of expected.forbidChassis ?? []) {
    const badProducts = result.products.filter((product) =>
      (product.fitments ?? []).some((fitment) =>
        fitment.chassisCodes.some((chassis) => chassis.toUpperCase() === forbidden.toUpperCase())
      )
    );
    if (badProducts.length) {
      errors.push(
        `forbidden chassis ${forbidden}: ${badProducts.map((product) => product.partNumber).join(", ")}`
      );
    }
  }
  return {
    id: testCase.id,
    passed: errors.length === 0,
    errors,
    productCount: result.products.length,
  };
}

async function main() {
  const fixturePath = path.join(process.cwd(), "tests", "shop", "evals", "stock-ai-cases.json");
  const cases = JSON.parse(await fs.readFile(fixturePath, "utf8")) as EvalCase[];
  const results = [];
  for (const testCase of cases) results.push(await runCase(testCase));
  for (const result of results) {
    console.log(
      `${result.passed ? "PASS" : "FAIL"} ${result.id} (${result.productCount} products)`
    );
    for (const error of result.errors) console.log(`  - ${error}`);
  }
  const failed = results.filter((result) => !result.passed);
  console.log(`\n${results.length - failed.length}/${results.length} evals passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
