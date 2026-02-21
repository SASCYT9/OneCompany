type TelegramInlineButton = { text: string; url: string };

type TelegramReplyMarkup = {
  inline_keyboard: Array<Array<TelegramInlineButton>>;
};

type TelegramPayload = {
  chat_id: string;
  message_thread_id?: number;
  text: string;
  parse_mode: 'HTML';
  reply_markup?: TelegramReplyMarkup;
};

type TelegramSendResult = {
  ok: boolean;
  target: string;
  error?: string;
};

type TelegramDestination = {
  chatId: string;
  messageThreadId?: number;
};

type SendTelegramToDestinationsParams = {
  message: string;
  destinations: TelegramDestination[];
  replyMarkup?: TelegramReplyMarkup;
  context: string;
  requiredChatEnv: string[];
};

type BuildActionButtonsParams = {
  email?: string;
  emailSubject: string;
  telegramUsername?: string;
  phone?: string;
  includeTelegramButton?: boolean;
  includeWhatsAppButton?: boolean;
};

function normalizeEnvString(value?: string): string {
  if (!value) return '';
  return value
    .replace(/^"+|"+$/g, '')
    .replace(/\\r\\n|\\n|\\r/g, '')
    .trim();
}

export function normalizeTelegramChatId(rawChatId?: string): string | null {
  const normalized = normalizeEnvString(rawChatId);
  const match = normalized.match(/-?\d+/);
  return match?.[0] || null;
}

export function normalizeTelegramThreadId(rawThreadId?: string): number | null {
  const normalized = normalizeEnvString(rawThreadId);
  const match = normalized.match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function normalizeTelegramUsername(username?: string): string | null {
  if (!username) return null;
  const cleaned = username.trim().replace(/^@+/, '');
  if (!cleaned) return null;
  if (!/^[a-zA-Z0-9_]{5,}$/.test(cleaned)) return null;
  return cleaned;
}

function normalizePhoneForWhatsApp(phone?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits;
}

export function buildTelegramActionButtons(params: BuildActionButtonsParams): TelegramReplyMarkup | undefined {
  const inline_keyboard: Array<Array<TelegramInlineButton>> = [];

  if (params.email) {
    const subject = encodeURIComponent(params.emailSubject);
    const to = encodeURIComponent(params.email);
    inline_keyboard.push([{ text: '📧 Send Email', url: `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}` }]);
  }

  if (params.includeTelegramButton !== false) {
    const username = normalizeTelegramUsername(params.telegramUsername);
    if (username) {
      inline_keyboard.push([{ text: '💬 Send Telegram', url: `https://t.me/${username}` }]);
    }
  }

  if (params.includeWhatsAppButton !== false) {
    const waNumber = normalizePhoneForWhatsApp(params.phone);
    if (waNumber) {
      inline_keyboard.push([{ text: '🟢 Send WhatsApp', url: `https://wa.me/${waNumber}` }]);
    }
  }

  return inline_keyboard.length > 0 ? { inline_keyboard } : undefined;
}

export function getConfiguredContactTopicDestination(): TelegramDestination | null {
  const topicChatId = normalizeTelegramChatId(process.env.TELEGRAM_CONTACT_TOPIC_CHAT_ID || '-1003859998121');
  const topicThreadId = normalizeTelegramThreadId(process.env.TELEGRAM_CONTACT_TOPIC_THREAD_ID || '3');

  if (!topicChatId || !topicThreadId) {
    return null;
  }

  return {
    chatId: topicChatId,
    messageThreadId: topicThreadId,
  };
}

export async function sendTelegramToDestinations({
  message,
  destinations,
  replyMarkup,
  context,
  requiredChatEnv,
}: SendTelegramToDestinationsParams): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.error(`Telegram env is missing for ${context}`, {
      hasToken: !!token,
      hasAnyDestination: destinations.length > 0,
    });
    return { ok: false, error: 'Missing bot env' };
  }

  if (destinations.length === 0) {
    console.error(`Telegram chat configuration is missing for ${context}`, {
      requiredChatEnv,
      optionalTopicEnv: ['TELEGRAM_CONTACT_TOPIC_CHAT_ID', 'TELEGRAM_CONTACT_TOPIC_THREAD_ID'],
    });
    return { ok: false, error: 'Missing chat id env' };
  }

  const payloads: TelegramPayload[] = destinations.map((destination) => ({
    chat_id: destination.chatId,
    message_thread_id: destination.messageThreadId,
    text: message,
    parse_mode: 'HTML',
    reply_markup: replyMarkup,
  }));

  const sendOne = async (payload: TelegramPayload): Promise<TelegramSendResult> => {
    const target = payload.message_thread_id ? `${payload.chat_id}#${payload.message_thread_id}` : payload.chat_id;

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        console.error('Telegram API Error:', data);
        return {
          ok: false,
          target,
          error: data.description || 'Telegram API error',
        };
      }

      return { ok: true, target };
    } catch (error: unknown) {
      console.error('Telegram Request Failed:', error);
      return {
        ok: false,
        target,
        error: error instanceof Error ? error.message : 'Telegram request failed',
      };
    }
  };

  const results = await Promise.all(payloads.map(sendOne));
  const successCount = results.filter((result) => result.ok).length;

  if (successCount === 0) {
    return {
      ok: false,
      error: results.map((result) => `${result.target}: ${result.error || 'Unknown error'}`).join('; '),
    };
  }

  return {
    ok: true,
    error: results
      .filter((result) => !result.ok)
      .map((result) => `${result.target}: ${result.error || 'Unknown error'}`)
      .join('; ') || undefined,
  };
}
