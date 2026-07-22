import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: {
    ...process.env,
    OPS_UI_ENABLED: "true",
    OPS_LOCAL_DEMO_MODE: "true",
    OPS_TELEGRAM_MANAGER_ENABLED: "0",
    OPS_TELEGRAM_NOTIFICATIONS_ENABLED: "0",
    OPS_TELEGRAM_AUTO_CREATE_ENABLED: "0",
    OPS_JOBS_ENABLED: "0",
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
