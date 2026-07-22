#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const modeArg = process.argv.find((value) => value.startsWith("--mode="));
const mode = modeArg?.split("=")[1] ?? "prepare";
const supportedModes = new Set(["prepare", "canary", "live"]);

if (!supportedModes.has(mode)) {
  console.error(`[FAIL] Unsupported mode '${mode}'. Use prepare, canary, or live.`);
  process.exit(1);
}

const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function enabled(value) {
  return /^(1|true|yes|on)$/i.test(String(value ?? "").trim());
}

function value(name) {
  return String(process.env[name] ?? "").trim();
}

function requireValue(name, options = {}) {
  const current = value(name);
  if (!current) {
    fail(`${name} is missing.`);
    return;
  }
  if (options.minLength && current.length < options.minLength) {
    fail(`${name} must contain at least ${options.minLength} characters.`);
  }
}

function requireFlag(name, expected) {
  const actual = enabled(value(name));
  if (actual !== expected) {
    fail(`${name} must be ${expected ? "enabled" : "disabled"} in ${mode} mode.`);
  }
}

const expectedMigrations = [
  "20260719009000_reconcile_existing_schema_history",
  "20260719010000_add_ops_board_foundation",
  "20260719011000_add_ops_knowledge_base",
  "20260719012000_add_ops_telegram_intake_jobs",
  "20260719013000_add_ops_automation_approvals_usage",
  "20260720123000_simplify_ops_human_task_workflow",
  "20260720180000_add_ops_telegram_batches",
  "20260720183000_remove_ops_telegram_batch_item_limit",
  "20260722010000_add_ops_shared_tasks",
  "20260722020000_default_ops_task_deadline",
];

for (const migration of expectedMigrations) {
  if (!exists(`prisma/migrations/${migration}/migration.sql`)) {
    fail(`Missing migration: ${migration}.`);
  }
}

const envExample = read(".env.example");
const requiredDocumentedVariables = [
  "OPS_UI_ENABLED",
  "OPS_TELEGRAM_MANAGER_ENABLED",
  "OPS_TELEGRAM_NOTIFICATIONS_ENABLED",
  "OPS_TELEGRAM_AUTO_CREATE_ENABLED",
  "OPS_JOBS_ENABLED",
  "OPS_AUTOMATIONS_ENABLED",
  "OPS_TELEGRAM_BOT_TOKEN",
  "OPS_TELEGRAM_BOT_ID",
  "OPS_TELEGRAM_BOT_USERNAME",
  "OPS_TELEGRAM_WEBHOOK_SECRET",
  "OPS_TELEGRAM_CALLBACK_SECRET",
  "OPS_ADMIN_BASE_URL",
  "OPS_GEMINI_API_KEY",
  "OPS_GEMINI_PRIMARY_MODEL",
  "OPS_GEMINI_FALLBACK_MODEL",
  "OPS_BLOB_STORE_ID",
];

for (const name of requiredDocumentedVariables) {
  if (!new RegExp(`^${name}=`, "m").test(envExample)) {
    fail(`${name} is not documented in .env.example.`);
  }
}

const vercelConfig = JSON.parse(read("vercel.json"));
const operationsCron = vercelConfig.crons?.find(
  (entry) => entry.path === "/api/cron/operations-jobs"
);
if (!operationsCron) {
  fail("The operations watchdog cron is missing from vercel.json.");
} else if (operationsCron.schedule !== "*/15 * * * *") {
  fail("The operations watchdog cron must run every 15 minutes.");
}

const vercelIgnore = read(".vercelignore");
for (const ignored of [".env.*", "/backups/", "/output/", "/artifacts/", "/.playwright-cli/"]) {
  if (!vercelIgnore.split(/\r?\n/).includes(ignored)) {
    fail(`.vercelignore must contain '${ignored}'.`);
  }
}

if (!exists("src/app/api/operations/telegram-manager/webhook/route.ts")) {
  fail("Telegram Manager webhook route is missing.");
}
if (!exists("src/app/api/cron/operations-jobs/route.ts")) {
  fail("Operations jobs cron route is missing.");
}

if (mode !== "prepare") {
  for (const name of [
    "DATABASE_URL",
    "DIRECT_URL",
    "ADMIN_SESSION_SECRET",
    "NEXTAUTH_SECRET",
    "CRON_SECRET",
    "OPS_TELEGRAM_BOT_TOKEN",
    "OPS_TELEGRAM_BOT_ID",
    "OPS_TELEGRAM_BOT_USERNAME",
    "OPS_TELEGRAM_WEBHOOK_SECRET",
    "OPS_TELEGRAM_CALLBACK_SECRET",
    "OPS_GEMINI_API_KEY",
  ]) {
    requireValue(name);
  }
  requireValue("ADMIN_SESSION_SECRET", { minLength: 32 });
  requireValue("NEXTAUTH_SECRET", { minLength: 32 });
  requireValue("CRON_SECRET", { minLength: 32 });
  requireValue("OPS_TELEGRAM_WEBHOOK_SECRET", { minLength: 32 });
  requireValue("OPS_TELEGRAM_CALLBACK_SECRET", { minLength: 32 });

  if (
    !value("OPS_BLOB_STORE_ID") &&
    !value("OPS_BLOB_READ_WRITE_TOKEN") &&
    !value("BLOB_READ_WRITE_TOKEN")
  ) {
    fail("A dedicated private Ops Blob store is not configured.");
  }
  if (value("OPS_LOCAL_MEDIA_DIR")) {
    fail("OPS_LOCAL_MEDIA_DIR must never be set in production.");
  }
  if (
    enabled(value("ALLOW_DEV_ADMIN_PASSWORD_FALLBACK")) ||
    enabled(value("ENABLE_DEV_AUTH_BYPASS"))
  ) {
    fail("Development authentication bypasses must be disabled in production.");
  }
  if (enabled(value("ADMIN_BOOTSTRAP_ENABLED"))) {
    fail("ADMIN_BOOTSTRAP_ENABLED must be disabled after production admins are provisioned.");
  }
  if (value("OPS_ADMIN_BASE_URL") !== "https://onecompany.global") {
    fail("OPS_ADMIN_BASE_URL must equal https://onecompany.global.");
  }
  if (value("OPS_TELEGRAM_BOT_TOKEN") === value("TELEGRAM_BOT_TOKEN")) {
    fail("The Operations bot token must not reuse the legacy production bot token.");
  }
  if (value("OPS_TELEGRAM_WEBHOOK_SECRET") === value("OPS_TELEGRAM_CALLBACK_SECRET")) {
    fail("Webhook and callback secrets must be distinct.");
  }

  requireFlag("OPS_UI_ENABLED", true);
  requireFlag("OPS_TELEGRAM_AUTO_CREATE_ENABLED", false);
  requireFlag("OPS_AUTOMATIONS_ENABLED", false);

  if (mode === "canary") {
    requireFlag("OPS_TELEGRAM_MANAGER_ENABLED", false);
    requireFlag("OPS_TELEGRAM_NOTIFICATIONS_ENABLED", false);
    requireFlag("OPS_JOBS_ENABLED", false);
  } else {
    requireFlag("OPS_TELEGRAM_MANAGER_ENABLED", true);
    requireFlag("OPS_TELEGRAM_NOTIFICATIONS_ENABLED", true);
    requireFlag("OPS_JOBS_ENABLED", true);
  }

  if (value("OPS_GEMINI_PRIMARY_MODEL") !== "gemini-3.5-flash-lite") {
    warn("OPS_GEMINI_PRIMARY_MODEL is not gemini-3.5-flash-lite.");
  }
}

for (const message of warnings) console.warn(`[WARN] ${message}`);
if (failures.length > 0) {
  for (const message of failures) console.error(`[FAIL] ${message}`);
  console.error(`[BLOCKED] Production readiness check failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log(`[READY] Operations production readiness (${mode}) passed.`);
console.log(
  `[INFO] Verified ${expectedMigrations.length} Ops migrations and fail-closed rollout configuration.`
);
