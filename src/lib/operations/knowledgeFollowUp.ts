import { OpsJobStage, OpsJobStatus, type OpsJob, type PrismaClient } from "@prisma/client";

import type { OpsAiProvider } from "@/lib/operations/ai";
import { answerOpsKnowledgeQuestion } from "@/lib/operations/knowledgeAnswers";
import {
  OPS_TELEGRAM_RECIPIENT_UNAVAILABLE,
  OpsNotificationError,
  sendOpsTelegramNotification,
} from "@/lib/operations/notifications";

/**
 * A second try at a «?» answer when Gemini was overloaded for every model:
 * the person already has the article list, the short answer follows.
 */
export const OPS_KNOWLEDGE_FOLLOW_UP_JOB = "telegram_knowledge_followup";
export const OPS_KNOWLEDGE_FOLLOW_UP_DELAY_MS = 40_000;
export const OPS_KNOWLEDGE_FOLLOW_UP_NOTE =
  "⏳ ИИ сейчас перегружен — короткий ответ пришлю следом.";

export async function enqueueOpsKnowledgeFollowUp(input: {
  client: Pick<PrismaClient, "opsJob">;
  sourceJobId: string;
  inboxItemId: string | null;
  question: string;
  now?: Date;
}) {
  if (!input.inboxItemId) return false;
  const now = input.now ?? new Date();
  // skipDuplicates: a re-run of the same intake stage keeps a single follow-up.
  await input.client.opsJob.createMany({
    data: [
      {
        idempotencyKey: `knowledge:followup:${input.sourceJobId}`,
        inboxItemId: input.inboxItemId,
        type: OPS_KNOWLEDGE_FOLLOW_UP_JOB,
        status: OpsJobStatus.QUEUED,
        stage: OpsJobStage.NOTIFY,
        availableAt: new Date(now.getTime() + OPS_KNOWLEDGE_FOLLOW_UP_DELAY_MS),
        payload: { question: input.question.slice(0, 500) },
      },
    ],
    skipDuplicates: true,
  });
  return true;
}

export async function executeOpsKnowledgeFollowUpJob(input: {
  client: PrismaClient;
  job: OpsJob;
  fetchImpl?: typeof fetch;
  provider?: OpsAiProvider;
  overloadPauseMs?: number;
}) {
  const payload = (input.job.payload ?? {}) as { question?: unknown };
  const question = typeof payload.question === "string" ? payload.question.trim() : "";
  if (!question || !input.job.inboxItemId) {
    return { outcome: "succeeded" as const, result: { followUp: "skipped_no_question" } };
  }
  const inbox = await input.client.opsInboxItem.findUnique({
    where: { id: input.job.inboxItemId },
    select: { telegramUpdate: { select: { chatId: true, telegramUserId: true, messageId: true } } },
  });
  const target = inbox?.telegramUpdate;
  if (!target?.telegramUserId) {
    return { outcome: "succeeded" as const, result: { followUp: "skipped_target_missing" } };
  }
  const member = await input.client.opsMemberProfile.findFirst({
    where: {
      telegramUserId: target.telegramUserId,
      telegramEnabled: true,
      adminUser: { isActive: true },
    },
    select: { id: true },
  });
  if (!member) {
    return {
      outcome: "succeeded" as const,
      result: { followUp: "skipped_recipient_no_longer_allowed" },
    };
  }
  const answer = await answerOpsKnowledgeQuestion({
    client: input.client,
    question,
    provider: input.provider,
    overloadPauseMs: input.overloadPauseMs,
  });
  if (!answer.aiUsed) {
    const lastAttempt = input.job.attempts + 1 >= input.job.maxAttempts;
    if (answer.aiOverloaded && !lastAttempt) {
      // Retried with the queue's backoff (15 s, 60 s, 5 min).
      throw new Error(`OPS_KNOWLEDGE_AI_OVERLOADED: ${answer.aiError ?? ""}`.slice(0, 300));
    }
    // The article list is already in the chat: give up quietly, no dead letter.
    return {
      outcome: "succeeded" as const,
      result: { followUp: "gave_up", aiError: answer.aiError ?? null },
    };
  }
  try {
    const sent = await sendOpsTelegramNotification({
      chatId: target.chatId,
      text: answer.text,
      replyToMessageId: target.messageId,
      replyMarkup: answer.replyMarkup,
      fetchImpl: input.fetchImpl,
    });
    return {
      outcome: "succeeded" as const,
      result: { followUp: "sent", model: answer.model ?? null, telegramMessageId: sent.messageId },
    };
  } catch (error) {
    if (
      error instanceof OpsNotificationError &&
      (error.code === "NOTIFICATIONS_DISABLED" || error.code === OPS_TELEGRAM_RECIPIENT_UNAVAILABLE)
    ) {
      return { outcome: "succeeded" as const, result: { followUp: "recipient_unavailable" } };
    }
    throw error;
  }
}
