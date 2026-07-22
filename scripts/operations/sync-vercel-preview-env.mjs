import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const branch = "concept/unified-site-performance";
if (!process.argv.includes(`--confirm-branch=${branch}`)) {
  throw new Error(`Refusing to update Vercel env without --confirm-branch=${branch}`);
}

const sourcePath = path.resolve(".env.ops-lab.local");
if (!fs.existsSync(sourcePath)) {
  throw new Error(".env.ops-lab.local is required");
}

const source = {};
for (const rawLine of fs.readFileSync(sourcePath, "utf8").split(/\r?\n/)) {
  const match = rawLine.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!match) continue;
  source[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
}

const requiredSecretNames = [
  "OPS_GEMINI_API_KEY",
  "OPS_TELEGRAM_BOT_TOKEN",
  "OPS_TELEGRAM_BOT_ID",
  "OPS_TELEGRAM_BOT_USERNAME",
  "OPS_TELEGRAM_WEBHOOK_SECRET",
  "OPS_TELEGRAM_CALLBACK_SECRET",
  "CRON_SECRET",
];
for (const name of requiredSecretNames) {
  if (!String(source[name] ?? "").trim()) {
    throw new Error(`${name} is missing from .env.ops-lab.local`);
  }
}

const values = {
  OPS_UI_ENABLED: "1",
  OPS_LOCAL_DEMO_MODE: "0",
  OPS_TELEGRAM_MANAGER_ENABLED: "1",
  OPS_TELEGRAM_NOTIFICATIONS_ENABLED: "1",
  OPS_TELEGRAM_AUTO_CREATE_ENABLED: "0",
  OPS_JOBS_ENABLED: "1",
  OPS_AUTOMATIONS_ENABLED: "0",
  OPS_GEMINI_API_KEY: source.OPS_GEMINI_API_KEY,
  OPS_GEMINI_PRIMARY_MODEL: "gemini-3.5-flash-lite",
  OPS_GEMINI_FALLBACK_MODEL: "gemini-3.5-flash",
  OPS_TELEGRAM_BOT_TOKEN: source.OPS_TELEGRAM_BOT_TOKEN,
  OPS_TELEGRAM_BOT_ID: source.OPS_TELEGRAM_BOT_ID,
  OPS_TELEGRAM_BOT_USERNAME: source.OPS_TELEGRAM_BOT_USERNAME,
  OPS_TELEGRAM_WEBHOOK_SECRET: source.OPS_TELEGRAM_WEBHOOK_SECRET,
  OPS_TELEGRAM_CALLBACK_SECRET: source.OPS_TELEGRAM_CALLBACK_SECRET,
  CRON_SECRET: source.CRON_SECRET,
};

const windowsVercelCli = process.env.APPDATA
  ? path.join(process.env.APPDATA, "npm", "node_modules", "vercel", "dist", "vc.js")
  : "";
const vercelCommand =
  process.platform === "win32" && fs.existsSync(windowsVercelCli)
    ? { command: process.execPath, prefix: [windowsVercelCli] }
    : { command: "npx", prefix: ["vercel"] };

const adminBaseUrlArgument = process.argv.find((argument) =>
  argument.startsWith("--admin-base-url=")
);
if (adminBaseUrlArgument) {
  const adminBaseUrl = adminBaseUrlArgument.slice("--admin-base-url=".length);
  const parsed = new URL(adminBaseUrl);
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".vercel.app")) {
    throw new Error("Preview admin base URL must be an https://*.vercel.app URL");
  }
  values.OPS_ADMIN_BASE_URL = parsed.origin;
}

for (const [name, value] of Object.entries(values)) {
  const result = spawnSync(
    vercelCommand.command,
    [
      ...vercelCommand.prefix,
      "env",
      "update",
      name,
      "preview",
      branch,
      "--yes",
      "--sensitive",
      "--value",
      value,
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, VERCEL_TELEMETRY_DISABLED: "1" },
      windowsHide: true,
    }
  );
  if (result.status !== 0) {
    throw new Error(
      `${name} update failed: ${String(
        result.error?.message || result.stderr || result.stdout || "unknown error"
      ).trim()}`
    );
  }
  console.log(`${name}=updated`);
}
