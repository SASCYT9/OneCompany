import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), false);

const environment = {
  ...process.env,
  DATABASE_URL: process.env.DIRECT_URL || process.env.DATABASE_URL,
};

function run(entrypoint, args) {
  const result = spawnSync(process.execPath, [entrypoint, ...args], {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const tsxCli = path.resolve("node_modules", "tsx", "dist", "cli.mjs");
const tscCli = path.resolve("node_modules", "typescript", "lib", "tsc.js");
const nextCli = path.resolve("node_modules", "next", "dist", "bin", "next");

// Git-triggered Vercel builds do not run the manual predeploy wrapper. Validate
// reader activation before any expensive catalog snapshot or Next build work.
run(tsxCli, ["scripts/check-catalog-v2-release-activation.ts", "--production-build"]);
run(tsxCli, ["scripts/prebuild-shop-snapshot.ts"]);
run(tsxCli, ["scripts/generate-shop-filter-indexes.ts"]);
// Type-check on its own, before `next build`. Inside the build the check ran
// while webpack still held its memory, and the 8 GB Vercel machine went out
// of memory (2026-10-17, twice). The build then skips its own check.
// The incremental state lives in .next/cache, which Vercel restores between
// builds, so only files changed since the last build are re-checked.
mkdirSync(path.resolve(".next", "cache"), { recursive: true });
run(tscCli, [
  "--noEmit",
  "-p",
  "tsconfig.build.json",
  "--tsBuildInfoFile",
  path.join(".next", "cache", "tsc-build.tsbuildinfo"),
]);
environment.ONECOMPANY_TYPECHECKED = "1";
run(nextCli, ["build", "--webpack"]);
