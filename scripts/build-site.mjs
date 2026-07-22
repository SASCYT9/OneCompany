import { spawnSync } from "node:child_process";
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
const nextCli = path.resolve("node_modules", "next", "dist", "bin", "next");

run(tsxCli, ["scripts/prebuild-shop-snapshot.ts"]);
run(tsxCli, ["scripts/generate-shop-filter-indexes.ts"]);
run(nextCli, ["build"]);
