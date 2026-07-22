import { after, NextRequest, NextResponse } from "next/server";
import { drainOpsJobs } from "@/lib/operations/jobs";
import { createOpsJobStageExecutor } from "@/lib/operations/telegramJobs";
import {
  createOpsTelegramWebhookReply,
  createPrismaOpsTelegramIntakeRepository,
  intakeOpsTelegramUpdate,
  normalizeOpsTelegramUpdate,
  OPS_TELEGRAM_UPDATE_MAX_BYTES,
  resolvePrismaOpsTelegramMember,
  type TelegramManagerUpdate,
  verifyOpsTelegramWebhookSecret,
} from "@/lib/operations/telegram";
import {
  collectOpsTelegramBatchForward,
  executeOpsTelegramBatchCallback,
  isOpsTelegramBatchForward,
  parseOpsTelegramBatchCallbackData,
  shouldAppendToOpenOpsTelegramBatch,
  syncOpsTelegramBatchFinalStatus,
  syncOpsTelegramBatchStatus,
} from "@/lib/operations/telegramBatch";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function telegramManagerEnabled() {
  return /^(1|true)$/i.test(String(process.env.OPS_TELEGRAM_MANAGER_ENABLED ?? ""));
}

function operationsJobsEnabled() {
  return /^(1|true)$/i.test(String(process.env.OPS_JOBS_ENABLED ?? ""));
}

function noStoreJson(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request: NextRequest) {
  if (!telegramManagerEnabled()) {
    return noStoreJson({ ok: false, error: "OPS_TELEGRAM_MANAGER_DISABLED" }, 404);
  }
  const configuredSecret = String(process.env.OPS_TELEGRAM_WEBHOOK_SECRET ?? "").trim();
  if (!configuredSecret) {
    return noStoreJson({ ok: false, error: "WEBHOOK_SECRET_NOT_CONFIGURED" }, 503);
  }
  if (
    !verifyOpsTelegramWebhookSecret(
      request.headers.get("x-telegram-bot-api-secret-token"),
      configuredSecret
    )
  ) {
    return noStoreJson({ ok: false, error: "UNAUTHORIZED" }, 401);
  }

  const declaredSize = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > OPS_TELEGRAM_UPDATE_MAX_BYTES) {
    return noStoreJson({ ok: false, error: "UPDATE_TOO_LARGE" }, 413);
  }
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > OPS_TELEGRAM_UPDATE_MAX_BYTES) {
    return noStoreJson({ ok: false, error: "UPDATE_TOO_LARGE" }, 413);
  }
  let update: TelegramManagerUpdate;
  try {
    update = JSON.parse(rawBody) as TelegramManagerUpdate;
  } catch {
    return noStoreJson({ ok: false, error: "INVALID_JSON" }, 400);
  }

  try {
    const normalized = normalizeOpsTelegramUpdate(update, {
      botUsername: process.env.OPS_TELEGRAM_BOT_USERNAME,
      botId: process.env.OPS_TELEGRAM_BOT_ID,
    });
    if (normalized && parseOpsTelegramBatchCallbackData(normalized.callbackData)) {
      const member = await resolvePrismaOpsTelegramMember(prisma, normalized.telegramUserId);
      if (!member) return noStoreJson({ ok: true });
      const batchResult = await executeOpsTelegramBatchCallback({
        client: prisma,
        update: normalized,
        member,
      });
      if (!batchResult) return noStoreJson({ ok: true });
      after(async () => {
        try {
          await syncOpsTelegramBatchFinalStatus({
            client: prisma,
            batchId: batchResult.batchId,
            text: batchResult.response,
          });
        } catch (error) {
          console.error("[operations.telegram.batch.final-status] sync failed", error);
        }
        if (batchResult.jobId && operationsJobsEnabled()) {
          try {
            await drainOpsJobs({
              client: prisma,
              execute: createOpsJobStageExecutor({ client: prisma }),
              maxJobs: 8,
              timeBudgetMs: 55_000,
            });
          } catch (error) {
            console.error("[operations.telegram.batch.after] durable job kick failed", error);
          }
        }
      });
      return noStoreJson({
        method: "answerCallbackQuery",
        callback_query_id: normalized.callbackQueryId,
        text: batchResult.response,
      });
    }
    if (
      normalized &&
      (isOpsTelegramBatchForward(normalized) ||
        (await shouldAppendToOpenOpsTelegramBatch({ client: prisma, update: normalized })))
    ) {
      const member = await resolvePrismaOpsTelegramMember(prisma, normalized.telegramUserId);
      if (!member) return noStoreJson({ ok: true });
      const batch = await collectOpsTelegramBatchForward({
        client: prisma,
        update: normalized,
        member,
      });
      after(async () => {
        try {
          await syncOpsTelegramBatchStatus({
            client: prisma,
            batchId: batch.id,
          });
        } catch (error) {
          console.error("[operations.telegram.batch.status] sync failed", error);
        }
      });
      return noStoreJson({ ok: true });
    }
    const result = await intakeOpsTelegramUpdate({
      rawUpdate: update,
      repository: createPrismaOpsTelegramIntakeRepository(prisma),
      botUsername: process.env.OPS_TELEGRAM_BOT_USERNAME,
      botId: process.env.OPS_TELEGRAM_BOT_ID,
    });
    if (result.outcome === "ignored") {
      // Telegram retries non-2xx responses. Disallowed/irrelevant messages are
      // intentionally acknowledged without revealing allowlist membership.
      return noStoreJson({ ok: true });
    }
    if (result.outcome === "accepted" && operationsJobsEnabled()) {
      after(async () => {
        try {
          await drainOpsJobs({
            client: prisma,
            execute: createOpsJobStageExecutor({ client: prisma }),
            maxJobs: 8,
            timeBudgetMs: 55_000,
          });
        } catch (error) {
          console.error("[operations.telegram.after] durable job kick failed", error);
        }
      });
    }
    return noStoreJson(createOpsTelegramWebhookReply(result));
  } catch (error) {
    // Returning 503 is deliberate: Telegram will retry and the unique update id
    // prevents duplicate Inbox/jobs after PostgreSQL recovers.
    console.error("[operations.telegram.webhook] intake persistence failed", error);
    return noStoreJson({ ok: false, error: "INTAKE_UNAVAILABLE" }, 503);
  }
}
