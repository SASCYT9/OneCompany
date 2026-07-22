export class OpsNotificationError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "OpsNotificationError";
  }
}

export type OpsTelegramNotificationResult = {
  chatId: bigint;
  messageId: number;
};

export type OpsTelegramButtonStyle = "primary" | "success" | "danger";

export type OpsTelegramInlineButton =
  | { text: string; url: string; style?: OpsTelegramButtonStyle }
  | { text: string; callback_data: string; style?: OpsTelegramButtonStyle };

export type OpsTelegramReplyMarkup = {
  inline_keyboard: OpsTelegramInlineButton[][];
};

function enabled(value: string | undefined) {
  return value === "1" || value?.toLocaleLowerCase("en-US") === "true";
}

function russianTaskWord(count: number) {
  const lastTwo = Math.abs(count) % 100;
  const last = lastTwo % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return "задач";
  if (last === 1) return "задача";
  if (last >= 2 && last <= 4) return "задачи";
  return "задач";
}

export function buildOpsInboxNotification(input: {
  taskCount: number;
  summary: string | null;
  inboxItemId: string;
  adminBaseUrl?: string | null;
  previewOnly: boolean;
  sourceKind?: "message" | "voice" | "batch";
  autoAppliedTasks?: Array<{ id: string; externalId: string; title: string }>;
}) {
  const countText =
    input.taskCount === 0
      ? "Задачи не определены — сообщение оставлено во Входящих."
      : `Подготовлено к проверке: ${input.taskCount} ${russianTaskWord(input.taskCount)}.`;
  const summary = String(input.summary ?? "").trim();
  const autoAppliedTasks = (input.autoAppliedTasks ?? []).slice(0, 5);
  if (autoAppliedTasks.length) {
    const taskLines = autoAppliedTasks.map(
      (task, index) => `${index + 1}. ${task.externalId} — ${task.title}`
    );
    return [
      `✅ Зафиксировал ${autoAppliedTasks.length} ${
        autoAppliedTasks.length === 1 ? "задачу" : autoAppliedTasks.length < 5 ? "задачи" : "задач"
      }:`,
      "",
      ...taskLines,
      summary ? `\n${summary.slice(0, 1_500)}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }
  const previewText =
    input.sourceKind === "voice"
      ? "🎙 Голосовое обработано и готово к проверке."
      : input.sourceKind === "batch"
        ? "📚 Подборка сообщений обработана и готова к проверке."
        : "📥 Сообщение обработано и готово к проверке.";
  return [
    input.previewOnly ? previewText : countText,
    input.previewOnly && input.taskCount > 0 ? countText : null,
    summary ? `\n${summary.slice(0, 1_500)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendOpsTelegramNotification(input: {
  chatId: bigint;
  text: string;
  replyToMessageId?: number | null;
  replyMarkup?: OpsTelegramReplyMarkup;
  token?: string | null;
  fetchImpl?: typeof fetch;
}) {
  if (!enabled(process.env.OPS_TELEGRAM_NOTIFICATIONS_ENABLED)) {
    throw new OpsNotificationError(
      "NOTIFICATIONS_DISABLED",
      "Operations Telegram notifications are disabled"
    );
  }
  const token = String(input.token ?? process.env.OPS_TELEGRAM_BOT_TOKEN ?? "").trim();
  if (!token) {
    throw new OpsNotificationError(
      "TELEGRAM_TOKEN_NOT_CONFIGURED",
      "OPS_TELEGRAM_BOT_TOKEN is required"
    );
  }
  const response = await (input.fetchImpl ?? fetch)(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: input.chatId.toString(),
        text: input.text.slice(0, 4_000),
        disable_web_page_preview: true,
        ...(input.replyToMessageId
          ? {
              reply_parameters: {
                message_id: input.replyToMessageId,
                allow_sending_without_reply: true,
              },
            }
          : {}),
        ...(input.replyMarkup ? { reply_markup: input.replyMarkup } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    }
  );
  if (!response.ok) {
    throw new OpsNotificationError(
      "TELEGRAM_SEND_FAILED",
      `Telegram sendMessage returned ${response.status}`
    );
  }
  const body = (await response.json()) as {
    ok?: boolean;
    result?: { message_id?: number; chat?: { id?: number } };
  };
  const messageId = Number(body.result?.message_id);
  if (!body.ok || !Number.isSafeInteger(messageId)) {
    throw new OpsNotificationError(
      "TELEGRAM_SEND_INVALID",
      "Telegram returned an invalid sendMessage response"
    );
  }
  return {
    chatId: input.chatId,
    messageId,
  } satisfies OpsTelegramNotificationResult;
}

export async function editOpsTelegramNotification(input: {
  chatId: bigint;
  messageId: number;
  text: string;
  replyMarkup?: OpsTelegramReplyMarkup;
  token?: string | null;
  fetchImpl?: typeof fetch;
}) {
  if (!enabled(process.env.OPS_TELEGRAM_NOTIFICATIONS_ENABLED)) {
    throw new OpsNotificationError(
      "NOTIFICATIONS_DISABLED",
      "Operations Telegram notifications are disabled"
    );
  }
  const token = String(input.token ?? process.env.OPS_TELEGRAM_BOT_TOKEN ?? "").trim();
  if (!token) {
    throw new OpsNotificationError(
      "TELEGRAM_TOKEN_NOT_CONFIGURED",
      "OPS_TELEGRAM_BOT_TOKEN is required"
    );
  }
  const response = await (input.fetchImpl ?? fetch)(
    `https://api.telegram.org/bot${token}/editMessageText`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: input.chatId.toString(),
        message_id: input.messageId,
        text: input.text.slice(0, 4_000),
        disable_web_page_preview: true,
        ...(input.replyMarkup ? { reply_markup: input.replyMarkup } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    }
  );
  if (!response.ok) {
    throw new OpsNotificationError(
      "TELEGRAM_EDIT_FAILED",
      `Telegram editMessageText returned ${response.status}`
    );
  }
  const body = (await response.json()) as { ok?: boolean };
  if (!body.ok) {
    throw new OpsNotificationError(
      "TELEGRAM_EDIT_INVALID",
      "Telegram returned an invalid editMessageText response"
    );
  }
}
