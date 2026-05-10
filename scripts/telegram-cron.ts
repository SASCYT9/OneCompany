/**
 * Telegram daily reminders + digest (formerly /api/telegram/cron?task=all).
 *
 * Runs sendAdminReminders + sendDailyDigest in parallel, posts to the
 * configured Telegram bot. Migrated off Vercel Cron to save spend.
 *
 * Run via .github/workflows/telegram-cron.yml (daily at 09:00 UTC).
 */

import dotenv from "dotenv";
import { sendAdminReminders, sendDailyDigest } from "../src/lib/bot/reminders";

dotenv.config({ path: ".env.local" });

async function run() {
  console.log("[Telegram Cron] Running reminders + digest...");
  const [reminders, digest] = await Promise.all([sendAdminReminders(), sendDailyDigest()]);
  console.log("[Telegram Cron] Reminders:", reminders);
  console.log("[Telegram Cron] Digest:", digest);
}

run().catch((error) => {
  console.error("[Telegram Cron] Failed:", error);
  process.exit(1);
});
