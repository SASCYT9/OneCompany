import fs from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const envPath = path.resolve(".env.ops-lab.local");
if (!fs.existsSync(envPath)) {
  throw new Error("Run npm run ops:lab:prepare before starting the Local Lab");
}

const labEnv = {};
for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const match = rawLine.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!match) continue;
  labEnv[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
}

const databaseUrl = new URL(String(labEnv.DATABASE_URL ?? ""));
if (
  !["127.0.0.1", "localhost", "::1"].includes(databaseUrl.hostname) ||
  databaseUrl.port !== "56432" ||
  databaseUrl.pathname !== "/onecompany_ops_lab"
) {
  throw new Error("Local Lab refused to start with a non-local database");
}

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, "dev", "-p", "3000", ...process.argv.slice(2)], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: {
    ...process.env,
    ...labEnv,
    OPS_TELEGRAM_AUTO_CREATE_ENABLED: "0",
    OPS_AUTOMATIONS_ENABLED: "0",
  },
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
