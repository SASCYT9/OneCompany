import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve(".env.local");
const targetPath = path.resolve(".env.ops-lab.local");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const result = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = rawLine.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    result[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return result;
}

function required(values, key) {
  const value = String(values[key] ?? "").trim();
  if (!value) {
    throw new Error(`${key} must be configured in .env.local`);
  }
  return value;
}

function secret(existing) {
  return String(existing ?? "").trim() || crypto.randomBytes(32).toString("base64url");
}

const source = parseEnvFile(sourcePath);
const previous = parseEnvFile(targetPath);
const localPassword = required(source, "OPS_LOCAL_ADMIN_PASSWORD");
if (localPassword.length < 14) {
  throw new Error("OPS_LOCAL_ADMIN_PASSWORD must contain at least 14 characters");
}

const values = {
  DATABASE_URL: "postgresql://postgres@127.0.0.1:56432/onecompany_ops_lab?sslmode=disable",
  DIRECT_URL: "postgresql://postgres@127.0.0.1:56432/onecompany_ops_lab?sslmode=disable",
  ADMIN_EMAIL: "owner@onecompany.local",
  ADMIN_NAME: "Саша Цомпель",
  ADMIN_SESSION_SECRET: secret(previous.ADMIN_SESSION_SECRET),
  OPS_LOCAL_ADMIN_PASSWORD: localPassword,
  OPS_LOCAL_TELEGRAM_USER_ID: "478891619",
  OPS_UI_ENABLED: "1",
  OPS_LOCAL_DEMO_MODE: "false",
  OPS_TELEGRAM_MANAGER_ENABLED: "1",
  OPS_TELEGRAM_NOTIFICATIONS_ENABLED: "1",
  OPS_TELEGRAM_AUTO_CREATE_ENABLED: "0",
  OPS_JOBS_ENABLED: "1",
  OPS_AUTOMATIONS_ENABLED: "0",
  OPS_TELEGRAM_BOT_TOKEN: required(source, "OPS_TELEGRAM_BOT_TOKEN"),
  OPS_TELEGRAM_BOT_ID: "8622639642",
  OPS_TELEGRAM_BOT_USERNAME: "OneCompanyOpenClawBot",
  OPS_TELEGRAM_WEBHOOK_SECRET: secret(previous.OPS_TELEGRAM_WEBHOOK_SECRET),
  OPS_TELEGRAM_CALLBACK_SECRET: secret(previous.OPS_TELEGRAM_CALLBACK_SECRET),
  CRON_SECRET: secret(previous.CRON_SECRET),
  OPS_GEMINI_API_KEY: String(
    source.OPS_GEMINI_API_KEY ?? source.SHOP_AI_API_KEY ?? source.GEMINI_API_KEY ?? ""
  ).trim(),
  OPS_GEMINI_PRIMARY_MODEL: String(
    source.OPS_GEMINI_PRIMARY_MODEL ?? "gemini-3.1-flash-lite"
  ).trim(),
  OPS_GEMINI_FALLBACK_MODEL: String(source.OPS_GEMINI_FALLBACK_MODEL ?? "gemini-3.5-flash").trim(),
  OPS_BLOB_READ_WRITE_TOKEN: String(source.OPS_BLOB_READ_WRITE_TOKEN ?? "").trim(),
  OPS_LOCAL_MEDIA_DIR: ".ops-data/operations-media",
};

const body = [
  "# Generated local-only Telegram Lab configuration.",
  "# Never commit this file or copy its values into chat.",
  ...Object.entries(values).map(([key, value]) => `${key}=${value}`),
  "",
].join("\n");

fs.writeFileSync(targetPath, body, { encoding: "utf8", mode: 0o600 });

console.log(
  JSON.stringify(
    {
      prepared: true,
      file: path.basename(targetPath),
      database: "local PostgreSQL on 127.0.0.1:56432",
      bot: "@OneCompanyOpenClawBot",
      autoCreate: false,
      automations: false,
      geminiConfigured: Boolean(values.OPS_GEMINI_API_KEY),
      mediaStore: "private local filesystem",
    },
    null,
    2
  )
);
