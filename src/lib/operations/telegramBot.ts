import { Prisma, type PrismaClient } from "@prisma/client";

import {
  ADMIN_PERMISSIONS,
  matchesAdminPermission,
  OWNER_ROLE_KEY,
  SUPERADMIN_ROLE_KEY,
} from "@/lib/admin/adminPermissions";
import { opsAdminLink, opsMiniAppUrl } from "@/lib/operations/adminLinks";
import { loadOpsMyDay, type OpsMyDay, type OpsMyDayTask } from "@/lib/operations/myDay";
import type {
  OpsTelegramInlineButton,
  OpsTelegramReplyMarkup,
} from "@/lib/operations/notifications";
import { parseOpsRepeatRule, type OpsRepeatRule } from "@/lib/operations/recurrence";
import {
  addOpsLocalDays,
  OPS_SNOOZE_HOUR,
  opsLocalClock,
  opsLocalTime,
} from "@/lib/operations/reminders";
import type { NormalizedOpsTelegramUpdate, TelegramManagerUpdate } from "@/lib/operations/telegram";
import {
  createOpsTelegramCallbackState,
  opsTaskActionErrorMessage,
  runOpsTaskQuickAction,
  type OpsTaskQuickAction,
} from "@/lib/operations/telegramCallbacks";
import { matchOpsAssigneeCandidate } from "@/lib/operations/telegramJobs";

/** Persistent keyboard under the chat — the bot's main menu. */
export const OPS_BOT_MENU = {
  today: "📌 Сегодня",
  mine: "📋 Мои задачи",
  create: "➕ Новая задача",
  ask: "❓ Спросить базу",
  app: "📱 Мой день",
} as const;

export type OpsBotCommand = "start" | "help" | "today" | "mine" | "create" | "ask" | "app";

const SLASH_COMMANDS: Record<string, OpsBotCommand> = {
  start: "start",
  help: "help",
  menu: "start",
  today: "today",
  my: "mine",
  mine: "mine",
  tasks: "mine",
  new: "create",
  task: "create",
  ask: "ask",
  app: "app",
  day: "app",
};

const LABEL_COMMANDS = new Map<string, OpsBotCommand>([
  [OPS_BOT_MENU.today, "today"],
  [OPS_BOT_MENU.mine, "mine"],
  [OPS_BOT_MENU.create, "create"],
  [OPS_BOT_MENU.ask, "ask"],
  [OPS_BOT_MENU.app, "app"],
]);

const LIST_TASK_LIMIT = 10;
const LIST_BUTTON_LIMIT = 6;
const BUTTON_TTL_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Menu commands are answered right away without AI. «/ask вопрос» is not a
 * command here: it goes through the normal pipeline to the knowledge base.
 */
export function parseOpsBotCommand(text: string | null | undefined): OpsBotCommand | null {
  const value = String(text ?? "").trim();
  if (!value) return null;
  const label = LABEL_COMMANDS.get(value);
  if (label) return label;
  const slash = /^\/([a-z_]+)(?:@[A-Za-z0-9_]+)?(?:\s+([\s\S]*))?$/i.exec(value);
  if (!slash) return null;
  const command = SLASH_COMMANDS[slash[1].toLowerCase()] ?? "help";
  if (command === "ask" && slash[2]?.trim()) return null;
  return command;
}

export type OpsQuickCommand =
  | { kind: "done"; note: string | null }
  | { kind: "cancel" }
  | { kind: "take" }
  | { kind: "snooze_to"; dueAt: Date }
  | { kind: "hand_over"; reference: string }
  | { kind: "repeat"; rule: OpsRepeatRule | null };

const WEEKDAY_STEMS: Array<[RegExp, number]> = [
  [/^(?:понедельник|понеділ)/u, 1],
  [/^(?:вторник|вівтор)/u, 2],
  [/^(?:сред|серед)/u, 3],
  [/^(?:четверг|четвер)/u, 4],
  [/^(?:пятниц|п'ятниц|пʼятниц)/u, 5],
  [/^(?:суббот|субот)/u, 6],
  [/^(?:воскресень|неділ)/u, 7],
];

const NUMBER_WORDS: Record<string, number> = {
  один: 1,
  одну: 1,
  два: 2,
  две: 2,
  дві: 2,
  три: 3,
  четыре: 4,
  чотири: 4,
  пять: 5,
  "п'ять": 5,
  шесть: 6,
  шість: 6,
  семь: 7,
  сім: 7,
  десять: 10,
};

function isoWeekdayOf(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

/**
 * «завтра», «в пятницу», «через 3 дня», «на неделю», «20.10», «завтра в 15»
 * → a local deadline (18:00 unless a time is given), or null.
 */
export function parseOpsDueText(text: string, now: Date, timeZone = "Europe/Kyiv") {
  let value = text
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[’ʼ`]/g, "'")
    .replace(/[.!]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();
  let hour = OPS_SNOOZE_HOUR;
  let minute = 0;
  const time =
    /\s(?:в|во|о|об|к|до|на)\s(\d{1,2})(?::(\d{2}))?(?:\s?(?:час\p{L}*|годин\p{L}*))?$/u.exec(
      value
    );
  if (time) {
    const parsedHour = Number(time[1]);
    const parsedMinute = Number(time[2] ?? 0);
    if (parsedHour > 23 || parsedMinute > 59) return null;
    hour = parsedHour;
    minute = parsedMinute;
    value = value.slice(0, time.index).trim();
  }
  value = value.replace(/^(?:на|до|в|во|у|к|по)\s/u, "").trim();
  const today = opsLocalClock(now, timeZone).date;
  let date: string | null = null;
  if (/^(?:сегодня|сьогодні)$/u.test(value)) date = today;
  else if (/^завтра$/u.test(value)) date = addOpsLocalDays(today, 1);
  else if (/^(?:послезавтра|післязавтра)$/u.test(value)) date = addOpsLocalDays(today, 2);
  else if (
    /^(?:через )?(?:неделю|неделя|тиждень|следующую неделю|наступний тиждень)$/u.test(value)
  ) {
    date = addOpsLocalDays(today, 7);
  } else {
    const relative = /^через (\d{1,2}|[\p{L}']+) (дн\p{L}*|день|недел\p{L}*|тиж\p{L}*)$/u.exec(
      value
    );
    if (relative) {
      const amount = /^\d+$/.test(relative[1]) ? Number(relative[1]) : NUMBER_WORDS[relative[1]];
      if (!amount) return null;
      const days = /^(?:недел|тиж)/u.test(relative[2]) ? amount * 7 : amount;
      date = addOpsLocalDays(today, days);
    }
  }
  if (!date) {
    const weekdayText = value.replace(
      /^(?:следующ\p{L}* |наступн\p{L}* |эту |этот |цю |цей )/u,
      ""
    );
    const weekday = WEEKDAY_STEMS.find(([pattern]) => pattern.test(weekdayText))?.[1];
    if (weekday && /^[\p{L}']+$/u.test(weekdayText)) {
      const current = isoWeekdayOf(today);
      const ahead = (weekday - current + 7) % 7 || 7;
      date = addOpsLocalDays(today, ahead);
    }
  }
  if (!date) {
    const numeric = /^(\d{1,2})[./](\d{1,2})(?:[./](\d{2}|\d{4}))?$/u.exec(value);
    if (numeric) {
      const day = Number(numeric[1]);
      const month = Number(numeric[2]);
      if (day < 1 || day > 31 || month < 1 || month > 12) return null;
      let year = numeric[3]
        ? Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3])
        : Number(today.slice(0, 4));
      const pad = (part: number) => String(part).padStart(2, "0");
      let candidate = `${year}-${pad(month)}-${pad(day)}`;
      if (!numeric[3] && candidate < today) {
        year += 1;
        candidate = `${year}-${pad(month)}-${pad(day)}`;
      }
      date = candidate;
    }
  }
  if (!date) return null;
  const dueAt = new Date(opsLocalTime(date, hour, timeZone).getTime() + minute * 60_000);
  return dueAt > now ? dueAt : null;
}

const DONE_WORDS =
  "готово|сделано|выполнено|закрыто|done|зроблено|виконано|готово!|сделано!|зроблено!";
const DONE_ALONE =
  /^(?:✅|👍)?\s*(?:готово|сделано|сделал|сделала|сделали|выполнено|выполнил|выполнила|закрыто|done|ок,? готово|зроблено|зробив|зробила|зробили|виконано|виконав|виконала|✅)[.!]*$/iu;
const CANCEL_ALONE =
  /^(?:не нужно|не надо|уже не нужно|неактуально|не актуально|отмена|отмени|отменить|закрой|удали|не потрібно|не треба|вже не треба|скасуй|скасувати|відміна)[.!]*$/iu;
const TAKE_ALONE = /^(?:беру|возьму|я возьму|беру на себя|моя|візьму|беру собі|я візьму)[.!]*$/iu;
const HAND_OVER =
  /^(?:передай(?:те)?|передать|отдай|поручи(?:те)?|переназначь(?:те)?|назначь(?:те)?|доручи(?:ть)?|передай задачу|передати)\s+(?:задачу\s+)?(?:на\s+)?([\p{L}'’ -]{2,40}?)[.!]*$/iu;
const SNOOZE_VERB =
  /^(?:перенеси(?:те)?|перенести|переносим|перенос|отложи(?:те)?|отложить|отложим|сдвинь|сдвинуть|відклади|відкласти|перенеси срок|давай|давайте)\s+(?:срок\s+|термін\s+)?/iu;
const REPEAT_START =
  /^(?:повтор\p{L}*|не повтор\p{L}*|кажд\p{L}*|ежедн\p{L}*|еженед\p{L}*|ежемес\p{L}*|по будн\p{L}*|по робоч\p{L}*|щодня|щотижня|щомісяця|кожн\p{L}*)/iu;

/** Short replies to a task message: «готово», «перенеси на пятницу», «передай Игорю». */
export function parseOpsQuickCommand(
  text: string | null | undefined,
  now: Date,
  timeZone = "Europe/Kyiv"
): OpsQuickCommand | null {
  const value = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!value || value.length > 400) return null;
  if (DONE_ALONE.test(value)) return { kind: "done", note: null };
  const doneWithNote = new RegExp(
    `^(?:✅\\s*)?(?:${DONE_WORDS})[\\s,.:;!—–-]+([\\s\\S]{2,})$`,
    "iu"
  ).exec(value);
  if (doneWithNote) return { kind: "done", note: doneWithNote[1].trim() };
  if (value.length > 80) return null;
  if (CANCEL_ALONE.test(value)) return { kind: "cancel" };
  if (TAKE_ALONE.test(value)) return { kind: "take" };
  const handOver = HAND_OVER.exec(value);
  if (handOver) {
    const reference = handOver[1].trim();
    if (/^(?:мне|меня|мені|мене|себе)$/iu.test(reference)) return { kind: "take" };
    return { kind: "hand_over", reference };
  }
  if (REPEAT_START.test(value) && value.split(" ").length <= 6) {
    const rule = parseOpsRepeatRule(value);
    if (rule) return { kind: "repeat", rule: rule === "off" ? null : rule };
  }
  const withoutVerb = value.replace(SNOOZE_VERB, "");
  const dueAt = parseOpsDueText(withoutVerb, now, timeZone);
  if (dueAt) return { kind: "snooze_to", dueAt };
  return null;
}

export type OpsBotMember = {
  adminUserId: string;
  name: string | null;
  email: string;
  timezone: string;
  permissions: string[];
  canAssign: boolean;
};

export async function resolveOpsBotMember(
  client: PrismaClient,
  telegramUserId: bigint
): Promise<OpsBotMember | null> {
  const profile = await client.opsMemberProfile.findFirst({
    where: { telegramUserId, telegramEnabled: true, adminUser: { isActive: true } },
    select: {
      timezone: true,
      adminUser: {
        select: {
          id: true,
          name: true,
          email: true,
          roles: { select: { role: { select: { key: true, permissions: true } } } },
        },
      },
    },
  });
  if (!profile) return null;
  const roleKeys = profile.adminUser.roles.map(({ role }) => role.key);
  const isOwner = roleKeys.includes(OWNER_ROLE_KEY) || roleKeys.includes(SUPERADMIN_ROLE_KEY);
  const permissions = isOwner
    ? ["*"]
    : profile.adminUser.roles.flatMap(({ role }) => role.permissions);
  if (
    !matchesAdminPermission(permissions, ADMIN_PERMISSIONS.OPS_TASKS_WRITE) &&
    !matchesAdminPermission(permissions, ADMIN_PERMISSIONS.OPS_INBOX_REVIEW)
  ) {
    return null;
  }
  return {
    adminUserId: profile.adminUser.id,
    name: profile.adminUser.name,
    email: profile.adminUser.email,
    timezone: profile.timezone || "Europe/Kyiv",
    permissions,
    canAssign: matchesAdminPermission(permissions, ADMIN_PERMISSIONS.OPS_TASKS_ASSIGN),
  };
}

function firstName(member: { name: string | null; email: string }) {
  return member.name?.trim().split(/\s+/)[0] || member.email.split("@")[0];
}

export function buildOpsBotKeyboard(miniAppUrl: string | null) {
  return {
    keyboard: [
      [{ text: OPS_BOT_MENU.today }, { text: OPS_BOT_MENU.mine }],
      [{ text: OPS_BOT_MENU.create }, { text: OPS_BOT_MENU.ask }],
      // A plain button: Telegram gives keyboard-button web apps no signed init
      // data, so the bot answers with an inline «Открыть» button instead.
      ...(miniAppUrl ? [[{ text: OPS_BOT_MENU.app }]] : []),
    ],
    is_persistent: true,
    resize_keyboard: true,
    input_field_placeholder: "Задача, ответ на задачу или ?вопрос",
  };
}

export function buildOpsBotWelcome(input: { name: string; miniAppUrl: string | null }) {
  return [
    `👋 ${input.name}, я помогаю команде не терять задачи.`,
    "",
    "✍️ Напишите или надиктуйте задачу — оформлю её и спрошу, кому поручить.",
    "↩️ Ответьте на моё сообщение о задаче: «готово», «перенеси на пятницу», «передай Игорю», «повторять каждую неделю».",
    "❓ Вопрос к базе знаний начните с «?» — например «? доставка из Великобритании».",
    input.miniAppUrl ? "📱 «Мой день» — все ваши задачи с кнопками, прямо в Telegram." : null,
    "",
    "Сам пишу только с 9:00 до 21:00: утром — что горит, за 2 часа до срока, в пятницу — разбор зависших.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function shortDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("ru-RU", { timeZone, day: "numeric", month: "short" }).format(
    date
  );
}

function shortTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("ru-RU", { timeZone, hour: "2-digit", minute: "2-digit" }).format(
    date
  );
}

function taskLine(task: OpsMyDayTask, index: number, timeZone: string, now: Date) {
  const title = task.title.length > 70 ? `${task.title.slice(0, 69)}…` : task.title;
  const due = task.dueAt
    ? task.dueAt < now
      ? `срок был ${shortDate(task.dueAt, timeZone)}`
      : opsLocalClock(task.dueAt, timeZone).date === opsLocalClock(now, timeZone).date
        ? `до ${shortTime(task.dueAt, timeZone)}`
        : shortDate(task.dueAt, timeZone)
    : null;
  return `${index}. #${task.number} ${title}${due ? ` — ${due}` : ""}${task.repeat ? " 🔁" : ""}`;
}

type ButtonFactory = (
  action: "done" | "snooze_tomorrow" | "take",
  taskId: string,
  text: string
) => Promise<OpsTelegramInlineButton | null>;

/** «📌 Сегодня» and «📋 Мои задачи» replies, with ✅/⏰ buttons for the urgent ones. */
export async function buildOpsBotTaskList(input: {
  kind: "today" | "mine";
  day: OpsMyDay;
  timeZone: string;
  now: Date;
  miniAppUrl: string | null;
  tasksUrl: string | null;
  button: ButtonFactory;
}): Promise<{ text: string; replyMarkup?: OpsTelegramReplyMarkup }> {
  const { day } = input;
  const groups: Array<[string, OpsMyDayTask[]]> =
    input.kind === "today"
      ? [
          ["⚠️ Просрочено", day.overdue],
          ["📌 Срок сегодня", day.today],
        ]
      : [
          ["⚠️ Просрочено", day.overdue],
          ["📌 Сегодня", day.today],
          ["🗓 Дальше", day.upcoming],
          ["Без срока", day.noDue],
        ];
  const listed: OpsMyDayTask[] = [];
  const lines: string[] = [];
  for (const [title, tasks] of groups) {
    const visible = tasks.slice(0, Math.max(0, LIST_TASK_LIMIT - listed.length));
    if (!tasks.length) continue;
    lines.push("", `${title} (${tasks.length}):`);
    for (const task of visible) {
      listed.push(task);
      lines.push(taskLine(task, listed.length, input.timeZone, input.now));
    }
    if (visible.length < tasks.length) lines.push(`…и ещё ${tasks.length - visible.length}`);
  }
  let header: string;
  if (input.kind === "today") {
    if (listed.length) {
      header = "📌 На сегодня:";
    } else {
      const next = day.upcoming[0];
      header = next
        ? `👌 На сегодня ничего не горит.\nБлижайшее: #${next.number} ${next.title} — ${shortDate(next.dueAt!, input.timeZone)}.`
        : "👌 На сегодня ничего не горит.";
    }
  } else {
    header = listed.length ? `📋 Ваши задачи (${day.counts.open}):` : "📋 Открытых задач нет. 👌";
  }
  if (day.unassigned.length && input.kind === "today") {
    lines.push("", `👤 Без исполнителя: ${day.counts.unassigned} — разберите в «Мой день».`);
  }
  const rows: OpsTelegramInlineButton[][] = [];
  const urgent = listed.filter((task) => day.overdue.includes(task) || day.today.includes(task));
  for (const task of urgent.slice(0, LIST_BUTTON_LIMIT)) {
    const index = listed.indexOf(task) + 1;
    const row: OpsTelegramInlineButton[] = [];
    for (const [action, label] of [
      ["done", `✅ ${index}. Готово`],
      ["snooze_tomorrow", `⏰ ${index}. Завтра`],
    ] as const) {
      const button = await input.button(action, task.id, label);
      if (button) row.push(button);
    }
    if (row.length) rows.push(row);
  }
  const footer: OpsTelegramInlineButton[] = [];
  if (input.miniAppUrl) footer.push({ text: "📱 Мой день", web_app: { url: input.miniAppUrl } });
  if (input.tasksUrl) footer.push({ text: "📋 В админке", url: input.tasksUrl });
  if (footer.length) rows.push(footer);
  return {
    text: [header, ...lines].join("\n").trim(),
    ...(rows.length ? { replyMarkup: { inline_keyboard: rows } } : {}),
  };
}

function replyBody(
  update: NormalizedOpsTelegramUpdate,
  text: string,
  replyMarkup?: unknown,
  quote = false
) {
  return {
    method: "sendMessage",
    chat_id: update.chatId.toString(),
    text: text.slice(0, 4_000),
    link_preview_options: { is_disabled: true },
    ...(quote && update.messageId
      ? { reply_parameters: { message_id: update.messageId, allow_sending_without_reply: true } }
      : {}),
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  };
}

async function recordHandledUpdate(client: PrismaClient, update: NormalizedOpsTelegramUpdate) {
  try {
    await client.opsTelegramUpdate.create({
      data: {
        telegramUpdateId: update.telegramUpdateId,
        chatId: update.chatId,
        telegramUserId: update.telegramUserId,
        messageId: update.messageId,
        messageThreadId: update.messageThreadId,
        updateType: update.updateType,
        rawUpdate: JSON.parse(JSON.stringify(update.rawUpdate)) as Prisma.InputJsonValue,
        isUntrustedForward: update.isUntrustedForward,
      },
      select: { id: true },
    });
    return true;
  } catch (error) {
    // Telegram retried an update we already answered.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return false;
    }
    throw error;
  }
}

async function consumeRateLimit(
  client: PrismaClient,
  update: NormalizedOpsTelegramUpdate,
  now: Date
) {
  const bucket = new Date(now);
  bucket.setUTCSeconds(0, 0);
  const key = `ops:telegram:${update.telegramUserId}:${update.chatId}:${bucket.toISOString()}`;
  const row = await client.requestRateLimit.upsert({
    where: { key },
    create: {
      key,
      count: 1,
      bucketStart: bucket,
      expiresAt: new Date(bucket.getTime() + 60_000),
    },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  return row.count <= 120;
}

async function resolveQuickTarget(
  client: PrismaClient,
  update: NormalizedOpsTelegramUpdate
): Promise<{ taskId: string; commandText: string } | null> {
  const text = update.text ?? "";
  if (update.replyToMessageId) {
    const delivery = await client.opsTelegramDelivery.findUnique({
      where: {
        chatId_telegramMessageId: {
          chatId: update.chatId,
          telegramMessageId: update.replyToMessageId,
        },
      },
      select: { taskId: true },
    });
    if (delivery?.taskId) return { taskId: delivery.taskId, commandText: text };
  }
  const explicit = /^\s*(?:задач[а-яі]*\s*)?[#№](\d{1,9})\b[\s:,—–-]*([\s\S]+)$/iu.exec(text);
  if (explicit) {
    const task = await client.opsTask.findUnique({
      where: { number: Number(explicit[1]) },
      select: { id: true },
    });
    if (task) return { taskId: task.id, commandText: explicit[2].trim() };
  }
  return null;
}

const TRANSLIT: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  ґ: "g",
  д: "d",
  е: "e",
  ё: "e",
  є: "ye",
  ж: "zh",
  з: "z",
  и: "i",
  і: "i",
  ї: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

/** Common short names and dative forms → the full name's stem. */
const NAME_FORMS: Array<[RegExp, string]> = [
  [/^игор/u, "igor"],
  [/^іг?ор/u, "igor"],
  [/^(?:ваня|ване|ваню|вани|иван|іван)/u, "ivan"],
  [/^(?:костя|косте|костю|кости|константин|костянтин)/u, "konst"],
  [/^(?:серёж|сереж|серге|сергі|сергій)/u, "serg"],
  [/^(?:денис|дениск)/u, "denis"],
  [/^(?:саш|олександр|александр|алекс)/u, "ole"],
];

function latinStem(reference: string) {
  const lower = reference.toLocaleLowerCase("ru-RU").replace(/[^\p{Letter}]+/gu, "");
  const form = NAME_FORMS.find(([pattern]) => pattern.test(lower));
  if (form) return form[1];
  return Array.from(lower)
    .map((letter) => TRANSLIT[letter] ?? letter)
    .join("");
}

/** «передай Игорю» → Igor, even though admin names are written in Latin. */
function matchByLatinStem(
  reference: string,
  candidates: Array<{ id: string; name: string | null }>
) {
  const stem = latinStem(reference.split(/\s+/)[0] ?? "");
  if (stem.length < 3) return null;
  for (const length of [Math.min(5, stem.length), Math.min(4, stem.length), 3]) {
    const prefix = stem.slice(0, length);
    const matches = candidates.filter((candidate) =>
      String(candidate.name ?? "")
        .toLocaleLowerCase("en-US")
        .split(/\s+/)
        .some((token) => token.startsWith(prefix))
    );
    if (matches.length === 1) return matches[0].id;
    if (matches.length > 1) return null;
  }
  return null;
}

async function resolveHandOverAssignee(client: PrismaClient, reference: string) {
  const candidates = await client.adminUser.findMany({
    where: { isActive: true },
    select: {
      id: true,
      email: true,
      name: true,
      roles: { select: { role: { select: { key: true, permissions: true } } } },
    },
  });
  const exact = matchOpsAssigneeCandidate(
    reference,
    candidates.map((candidate) => {
      const keys = candidate.roles.map(({ role }) => role.key);
      return {
        id: candidate.id,
        email: candidate.email,
        name: candidate.name,
        permissions:
          keys.includes(OWNER_ROLE_KEY) || keys.includes(SUPERADMIN_ROLE_KEY)
            ? ["*"]
            : candidate.roles.flatMap(({ role }) => role.permissions),
      };
    })
  );
  return exact ?? matchByLatinStem(reference, candidates);
}

function taskButtonFactory(client: PrismaClient, adminUserId: string): ButtonFactory {
  return async (action, taskId, text) => {
    const callbackData = await createOpsTelegramCallbackState({
      client,
      action,
      resourceId: taskId,
      actorAdminUserId: adminUserId,
      ttlMs: BUTTON_TTL_MS,
    });
    return callbackData ? { text, callback_data: callbackData } : null;
  };
}

export type OpsBotHandled = {
  body: Record<string, unknown>;
  /** Set the «Мой день» chat menu button after replying (on /start). */
  menuButtonChatId?: bigint;
};

/**
 * Answers menu commands and task replies straight from the
 * webhook — no Inbox row and no AI. Returns null for everything else, which
 * then follows the normal intake pipeline.
 */
export async function handleOpsTelegramBotUpdate(input: {
  client: PrismaClient;
  rawUpdate: TelegramManagerUpdate;
  update: NormalizedOpsTelegramUpdate | null;
  now?: Date;
}): Promise<OpsBotHandled | null> {
  const now = input.now ?? new Date();
  const update = input.update;
  if (
    !update ||
    update.updateType !== "message" ||
    update.chatType !== "private" ||
    !update.text ||
    update.media ||
    update.isUntrustedForward
  ) {
    return null;
  }
  const command = parseOpsBotCommand(update.text);
  const target = command ? null : await resolveQuickTarget(input.client, update);
  const member =
    command || target ? await resolveOpsBotMember(input.client, update.telegramUserId) : null;
  const quick = target ? parseOpsQuickCommand(target.commandText, now, member?.timezone) : null;
  if (!command && !quick) return null;
  // Unlinked people are ignored without revealing who is on the team.
  if (!member) return { body: { ok: true } };
  if (!(await consumeRateLimit(input.client, update, now))) return { body: { ok: true } };
  if (!(await recordHandledUpdate(input.client, update))) return { body: { ok: true } };

  const miniAppUrl = opsMiniAppUrl();
  if (command) {
    if (command === "start" || command === "help") {
      return {
        body: replyBody(
          update,
          buildOpsBotWelcome({ name: firstName(member), miniAppUrl }),
          buildOpsBotKeyboard(miniAppUrl)
        ),
        ...(command === "start" && miniAppUrl ? { menuButtonChatId: update.chatId } : {}),
      };
    }
    if (command === "create") {
      return {
        body: replyBody(
          update,
          [
            "✍️ Напишите задачу одним сообщением или голосовым.",
            "Можно сразу указать кому и к какому сроку:",
            "«Игорь, до пятницы — узнать сроки Akrapovič для BMW M3».",
            "Можно переслать сообщение клиента — я сам вытащу суть.",
          ].join("\n")
        ),
      };
    }
    if (command === "ask") {
      return {
        body: replyBody(
          update,
          [
            "❓ Задайте вопрос, начав с «?». Например:",
            "«? доставка из Великобритании»",
            "«? скидки Brabus»",
            "Отвечу по базе знаний и дам ссылку на статью.",
          ].join("\n")
        ),
      };
    }
    if (command === "app") {
      return {
        body: replyBody(
          update,
          miniAppUrl
            ? "📱 «Мой день» — все ваши задачи с кнопками."
            : "«Мой день» доступен в админке: Работа → Мой день.",
          miniAppUrl
            ? {
                inline_keyboard: [
                  [{ text: "📱 Открыть «Мой день»", web_app: { url: miniAppUrl } }],
                ],
              }
            : undefined
        ),
      };
    }
    const day = await loadOpsMyDay({
      client: input.client,
      adminUserId: member.adminUserId,
      canAssign: member.canAssign,
      now,
      timeZone: member.timezone,
    });
    const list = await buildOpsBotTaskList({
      kind: command === "today" ? "today" : "mine",
      day,
      timeZone: member.timezone,
      now,
      miniAppUrl,
      tasksUrl: opsAdminLink("/admin/operations/tasks?mine=1"),
      button: taskButtonFactory(input.client, member.adminUserId),
    });
    return { body: replyBody(update, list.text, list.replyMarkup) };
  }

  let action: OpsTaskQuickAction | null = null;
  let note: string | null = null;
  let text: string;
  let link: string | null = null;
  if (quick!.kind === "hand_over") {
    const assigneeId = await resolveHandOverAssignee(input.client, quick!.reference);
    if (assigneeId) action = { kind: "hand_over", assigneeId };
  } else if (quick!.kind === "done") {
    action = { kind: "done" };
    note = quick!.note;
  } else if (quick!.kind === "snooze_to") {
    action = { kind: "snooze_to", dueAt: quick!.dueAt };
  } else if (quick!.kind === "repeat") {
    action = { kind: "repeat", rule: quick!.rule };
  } else {
    action = { kind: quick!.kind };
  }
  if (!action) {
    text = `🤔 Не понял, кому передать «${quick!.kind === "hand_over" ? quick!.reference : ""}». Напишите имя как в админке или передайте в админке.`;
  } else {
    try {
      const result = await runOpsTaskQuickAction({
        client: input.client,
        actorAdminUserId: member.adminUserId,
        taskId: target!.taskId,
        action,
      });
      if (note) {
        await input.client.opsComment.create({
          data: {
            taskId: target!.taskId,
            authorId: member.adminUserId,
            text: note.slice(0, 3_000),
            telegramSourceId: update.telegramUpdateId.toString(),
          },
        });
      }
      text = `✅ ${result.message}${note ? "\nКомментарий сохранил." : ""}`;
      link = result.link;
    } catch (error) {
      const message = opsTaskActionErrorMessage(error);
      if (!message) throw error;
      text = `⚠️ ${message}`;
    }
  }
  return {
    body: replyBody(
      update,
      text,
      link ? { inline_keyboard: [[{ text: "📋 Открыть задачу", url: link }]] } : undefined,
      true
    ),
  };
}

export { opsMiniAppUrl };
